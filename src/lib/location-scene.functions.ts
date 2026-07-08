import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Real-world scene payload derived from OpenStreetMap around a lat/lng.
 * All coordinates in `buildings` / `roads` / `trees` are in LOCAL METRES
 * relative to (anchorLat, anchorLng) — ready for direct use as x/z in the
 * three.js scene (x = east, z = south so it matches three's right-handed
 * default with y-up).
 */
export interface RealWorldScene {
  anchor: { lat: number; lng: number };
  buildings: { footprint: Array<[number, number]>; height: number }[];
  roads: { path: Array<[number, number]>; width: number; kind: string }[];
  trees: Array<[number, number]>;
  staticMapUrl: string | null;
  radiusMeters: number;
  status?: "ok" | "empty" | "unavailable";
}

const inputSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radius: z.number().min(80).max(4000).optional(),
});

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

async function overpassQuery(body: string): Promise<any | null> {
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(body),
      });
      if (res.ok) return await res.json();
      console.warn(`Overpass mirror ${url} returned ${res.status}`);
    } catch (err) {
      console.warn(`Overpass mirror ${url} failed`, err);
    }
  }
  return null;
}

function project(lat: number, lng: number, anchorLat: number, anchorLng: number): [number, number] {
  const R = 6378137;
  const dLat = ((lat - anchorLat) * Math.PI) / 180;
  const dLng = ((lng - anchorLng) * Math.PI) / 180;
  const x = dLng * Math.cos((anchorLat * Math.PI) / 180) * R;
  const z = -dLat * R; // north = -z in three.js convention we chose
  return [x, z];
}

function inferBuildingHeight(tags: Record<string, string> | undefined): number {
  if (!tags) return 6;
  const explicit = tags["height"];
  if (explicit) {
    const n = parseFloat(explicit);
    if (Number.isFinite(n) && n > 0) return Math.min(n, 80);
  }
  const levels = tags["building:levels"];
  if (levels) {
    const n = parseFloat(levels);
    if (Number.isFinite(n) && n > 0) return Math.min(n * 3.2, 80);
  }
  // Rough type heuristics
  const t = tags["building"];
  if (t === "house" || t === "residential" || t === "detached") return 5;
  if (t === "apartments") return 12;
  if (t === "commercial" || t === "retail") return 8;
  if (t === "industrial" || t === "warehouse") return 9;
  return 6;
}

function roadWidth(kind: string): number {
  switch (kind) {
    case "motorway":
    case "trunk":
      return 10;
    case "primary":
      return 8;
    case "secondary":
      return 7;
    case "tertiary":
      return 6;
    case "residential":
    case "unclassified":
      return 5;
    case "service":
    case "living_street":
      return 3.5;
    case "footway":
    case "path":
    case "pedestrian":
      return 1.8;
    default:
      return 5;
  }
}

/**
 * Query Overpass for buildings, roads, and trees within `radius` metres of
 * (lat, lng). Returns a scene bundle ready to render.
 */
export const fetchLocationScene = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { lat, lng } = data;
    const startRadius = data.radius ?? 300;
    // Auto-expand radius until we find OSM data (helps rural / sparse areas).
    const radiusLadder = Array.from(
      new Set([startRadius, 500, 1000, 2000, 4000].filter((r) => r >= startRadius)),
    );

    const buildings: RealWorldScene["buildings"] = [];
    const roads: RealWorldScene["roads"] = [];
    const trees: RealWorldScene["trees"] = [];
    let usedRadius = startRadius;
    let status: "ok" | "empty" | "unavailable" = "unavailable";

    for (const radius of radiusLadder) {
      const query = `
        [out:json][timeout:25];
        (
          way["building"](around:${radius},${lat},${lng});
          way["highway"](around:${radius},${lat},${lng});
          node["natural"="tree"](around:${radius},${lat},${lng});
        );
        out geom tags;
      `;
      const json = await overpassQuery(query);
      if (!json) {
        status = "unavailable";
        continue;
      }
      status = "empty";
      buildings.length = 0;
      roads.length = 0;
      trees.length = 0;
      const elements = (json.elements ?? []) as Array<{
        type: string;
        tags?: Record<string, string>;
        geometry?: Array<{ lat: number; lon: number }>;
        lat?: number;
        lon?: number;
      }>;
      for (const el of elements) {
        if (el.type === "way" && el.geometry && el.geometry.length >= 2) {
          const pts: Array<[number, number]> = el.geometry.map((p) =>
            project(p.lat, p.lon, lat, lng),
          );
          if (el.tags?.["building"]) {
            buildings.push({ footprint: pts, height: inferBuildingHeight(el.tags) });
          } else if (el.tags?.["highway"]) {
            roads.push({ path: pts, width: roadWidth(el.tags["highway"]), kind: el.tags["highway"] });
          }
        } else if (el.type === "node" && typeof el.lat === "number" && typeof el.lon === "number") {
          if (el.tags?.["natural"] === "tree") {
            trees.push(project(el.lat, el.lon, lat, lng));
          }
        }
      }
      usedRadius = radius;
      if (buildings.length + roads.length > 0) {
        status = "ok";
        break;
      }
    }

    // Google Static Map preview via connector gateway (server-side; keeps key private).
    let staticMapUrl: string | null = null;
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (lovableKey && gmapsKey) {
      const gwPath =
        `/maps/api/staticmap?center=${lat},${lng}` +
        `&zoom=18&size=640x480&scale=2&maptype=hybrid` +
        `&markers=color:red%7C${lat},${lng}`;
      try {
        const gw = await fetch(`https://connector-gateway.lovable.dev/google_maps${gwPath}`, {
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": gmapsKey,
          },
        });
        if (gw.ok) {
          const buf = await gw.arrayBuffer();
          const b64 = Buffer.from(buf).toString("base64");
          staticMapUrl = `data:image/png;base64,${b64}`;
        }
      } catch (err) {
        console.error("Static map fetch failed", err);
      }
    }

    const scene: RealWorldScene = {
      anchor: { lat, lng },
      buildings,
      roads,
      trees,
      staticMapUrl,
      radiusMeters: usedRadius,
      status,
    };
    return scene;
  });