import { mapImagePlacement } from "./map-image";
import { createServerOnlyFn } from "@tanstack/react-start";
import { googleMapsRequest } from "./google-maps-request";
export interface RealWorldScene {
  anchor: { lat: number; lng: number };
  buildings: {
    footprint: Array<[number, number]>;
    height: number;
    label?: string;
    source?: "osm" | "google" | "inferred";
    /** Roof/wall colour hints resolved from OSM tags (building:colour, material). */
    color?: string;
    kind?: string;
    levels?: number;
  }[];
  roads: {
    path: Array<[number, number]>;
    width: number;
    kind: string;
    source?: "osm" | "google" | "inferred";
    lanes?: number;
    oneway?: boolean;
    surface?: string;
    name?: string;
  }[];
  trees: Array<[number, number]>;
  landmarks: { label: string; kind: string; position: [number, number]; source: "osm" | "google" }[];
  streetLights: Array<[number, number]>;
  /** Rivers, canals, ponds as closed polygons (rendered as water planes). */
  water?: Array<{ polygon: Array<[number, number]>; kind: string }>;
  /** Parks, farmland, residential blocks etc. — flat coloured ground patches. */
  landuse?: Array<{ polygon: Array<[number, number]>; kind: string }>;
  /** Walls, fences, hedges as low extruded lines. */
  barriers?: Array<{ path: Array<[number, number]>; kind: string; height: number }>;
  /** Pedestrian crossings — striped zebra decals on roads. */
  crossings?: Array<[number, number]>;
  staticMapUrl: string | null;
  staticMapPlacement?: { widthMeters: number; offsetX: number; offsetZ: number; attribution: string };
  address: string | null;
  radiusMeters: number;
  status: "ok" | "partial" | "empty" | "unavailable";
  source: "osm" | "google" | "hybrid" | "inferred";
  diagnostics: {
    osmElements: number;
    googlePlaces: number;
    googleRoadPoints: number;
    synthesizedBuildings: number;
    synthesizedRoads: number;
    osmBuildings?: number;
    osmRoads?: number;
    dedupedGoogleBuildings?: number;
  };
}

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

/**
 * Overpass rejects requests without a descriptive User-Agent with HTTP 406
 * ("Not Acceptable"). Missing this header was silently forcing every scene to
 * the synthetic fallback, so it is mandatory on every mirror call.
 */
const OVERPASS_UA = "SceneIQ/1.0 (crime-scene reconstruction; +https://scene-iq.teamcyberops.xyz)";

// ---------------------------------------------------------------------------
// Deterministic cache + retry
// A given lat/lng (rounded to ~1m) always resolves to the exact same scene for
// the cache lifetime, so the viewer never flips between a rich render and an
// empty one on re-mounts or retries.
// ---------------------------------------------------------------------------
const SCENE_CACHE = new Map<string, { at: number; scene: RealWorldScene }>();
const SCENE_CACHE_TTL_MS = 30 * 60 * 1000;
const INFLIGHT = new Map<string, Promise<RealWorldScene>>();

export function sceneCacheKey(lat: number, lng: number, radius: number) {
  return `${lat.toFixed(5)}:${lng.toFixed(5)}:${Math.round(radius)}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries a fetch-ish task with deterministic backoff (250ms, 750ms, 1750ms). */
async function withRetry<T>(label: string, attempts: number, task: () => Promise<T>): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await task();
      if (result !== null && result !== undefined) return result;
    } catch (err) {
      console.warn(`[location-scene] ${label} attempt ${i + 1} failed`, err);
    }
    if (i < attempts - 1) await sleep(250 * (1 + i * 2));
  }
  return null;
}

type OverpassElement = {
  type: string;
  id?: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  primaryType?: string;
  types?: string[];
  location?: { latitude?: number; longitude?: number };
};

type GoogleRoadPoint = {
  location?: { latitude?: number; longitude?: number };
  originalIndex?: number;
  placeId?: string;
};

function seededUnit(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function project(lat: number, lng: number, anchorLat: number, anchorLng: number): [number, number] {
  const R = 6378137;
  const dLat = ((lat - anchorLat) * Math.PI) / 180;
  const dLng = ((lng - anchorLng) * Math.PI) / 180;
  const x = dLng * Math.cos((anchorLat * Math.PI) / 180) * R;
  const z = -dLat * R;
  return [x, z];
}

function offsetLatLng(anchorLat: number, anchorLng: number, east: number, north: number) {
  const R = 6378137;
  return {
    lat: anchorLat + (north / R) * (180 / Math.PI),
    lng: anchorLng + (east / (R * Math.cos((anchorLat * Math.PI) / 180))) * (180 / Math.PI),
  };
}

function inferBuildingHeight(tags: Record<string, string> | undefined): number {
  if (!tags) return 6;
  const explicit = tags.height;
  if (explicit) {
    const n = parseFloat(explicit);
    if (Number.isFinite(n) && n > 0) return Math.min(n, 80);
  }
  const levels = tags["building:levels"];
  if (levels) {
    const n = parseFloat(levels);
    if (Number.isFinite(n) && n > 0) return Math.min(n * 3.2, 80);
  }
  const t = tags.building || tags.amenity || tags.shop;
  if (["house", "residential", "detached", "hut"].includes(t)) return 5;
  if (t === "apartments") return 12;
  if (["commercial", "retail", "bank", "marketplace"].includes(t)) return 8;
  if (["school", "college", "university", "hospital"].includes(t)) return 10;
  if (["industrial", "warehouse"].includes(t)) return 9;
  return 6;
}

/** Wall colour resolved from OSM tags so the render matches the real street. */
function inferBuildingColor(tags: Record<string, string> | undefined): string | undefined {
  if (!tags) return undefined;
  const explicit = tags["building:colour"] || tags["building:color"];
  if (explicit && /^#?[0-9a-fA-F]{3,8}$/.test(explicit.replace("#", "#"))) {
    return explicit.startsWith("#") ? explicit : `#${explicit}`;
  }
  const named: Record<string, string> = {
    white: "#e8e4dc", grey: "#b9b6b0", gray: "#b9b6b0", beige: "#ddcfb2",
    brown: "#8d6a45", yellow: "#e0c579", red: "#b5613f", green: "#7d9b76",
    blue: "#7d95b5", sand: "#dcc79c", cream: "#e6dcc2",
  };
  if (explicit && named[explicit.toLowerCase()]) return named[explicit.toLowerCase()];
  const material = (tags["building:material"] || tags.material || "").toLowerCase();
  if (material.includes("brick")) return "#9c5f45";
  if (material.includes("concrete")) return "#b8b5ae";
  if (material.includes("plaster")) return "#ddd4c2";
  if (material.includes("mud") || material.includes("clay")) return "#b08a5f";
  if (material.includes("metal")) return "#9aa4ac";
  return undefined;
}

/** Polygon area (m²) via the shoelace formula on projected metre coordinates. */
function polygonArea(pts: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    a += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  }
  return Math.abs(a / 2);
}

function polygonCentroid(pts: Array<[number, number]>): [number, number] {
  let x = 0;
  let z = 0;
  for (const [px, pz] of pts) {
    x += px;
    z += pz;
  }
  return [x / pts.length, z / pts.length];
}

function isClosed(pts: Array<[number, number]>) {
  if (pts.length < 4) return false;
  const [ax, az] = pts[0];
  const [bx, bz] = pts[pts.length - 1];
  return Math.hypot(ax - bx, az - bz) < 0.5;
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

/** Lane-accurate width: OSM `width` wins, then lanes × 3.2m, then class default. */
function resolvedRoadWidth(tags: Record<string, string>): { width: number; lanes?: number } {
  const explicit = parseFloat(tags.width ?? "");
  const lanes = parseInt(tags.lanes ?? "", 10);
  if (Number.isFinite(explicit) && explicit > 0.8) {
    return { width: Math.min(explicit, 40), lanes: Number.isFinite(lanes) ? lanes : undefined };
  }
  if (Number.isFinite(lanes) && lanes > 0) {
    return { width: Math.min(lanes * 3.2 + 0.8, 40), lanes };
  }
  return { width: roadWidth(tags.highway) };
}

function rectangleFootprint(x: number, z: number, width: number, depth: number, angle = 0): Array<[number, number]> {
  const hw = width / 2;
  const hd = depth / 2;
  const pts: Array<[number, number]> = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [-hw, -hd]];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return pts.map(([px, pz]) => [x + px * c - pz * s, z + px * s + pz * c]);
}

async function overpassQuery(body: string): Promise<{ elements?: OverpassElement[] } | null> {
  for (const url of OVERPASS_MIRRORS) {
    const json = await withRetry(`overpass ${url}`, 3, async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": OVERPASS_UA,
        },
        body: "data=" + encodeURIComponent(body),
      });
      if (!res.ok) throw new Error(`mirror returned ${res.status}`);
      const parsed = (await res.json()) as { elements?: OverpassElement[] };
      // An empty element list is a valid answer but not a useful one — let the
      // retry/mirror loop try elsewhere before we accept "no map data".
      if (!parsed.elements || parsed.elements.length === 0) return null;
      return parsed;
    });
    if (json) return json;
  }
  return null;
}

const googleGateway = createServerOnlyFn(async (path: string, init?: RequestInit, strict = false) => {
  const configured = googleMapsRequest(path, {
    providerKey: process.env['GOOGLE_API_KEY'],
    connectorKey: process.env['GOOGLE_MAPS_API_KEY'],
    lovableKey: process.env['LOVABLE_API_KEY'],
  }, init);
  if (!configured) {
    if (strict) throw new Error("Google Maps credentials are unavailable on this deployment. Configure GOOGLE_API_KEY or link the Google Maps connection, then redeploy.");
    return null;
  }
  const request = async () => {
    const res = await fetch(configured.url, configured.init);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (strict) {
        let reason: string | undefined;
        try { reason = JSON.parse(body)?.error?.details?.find((d: { reason?: string }) => d.reason)?.reason; } catch { /* non-JSON error */ }
        if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") throw new Error("Google Maps server key is referrer-restricted. Set its application restrictions to None or IP addresses in Google Cloud Console.");
        if (reason === "API_KEY_SERVICE_BLOCKED") throw new Error("Google Maps server key does not allow Places API (New). Enable it and add it to the server key's allowed APIs.");
        throw new Error(`Google Maps request failed [${res.status}]: ${body.slice(0, 1000)}`);
      }
      // 4xx are permanent (key restrictions) — don't burn a retry silently.
      console.warn(`Google Maps gateway ${path} failed [${res.status}]: ${body.slice(0, 240)}`);
      if (res.status >= 400 && res.status < 500) return null;
      throw new Error(`gateway ${res.status}`);
    }
    return res;
  };
  return strict ? request() : withRetry(`google ${path.split("?")[0]}`, 2, request);
});

async function fetchStaticMap(lat: number, lng: number, radius: number) {
  const zoom = radius <= 350 ? 18 : radius <= 800 ? 17 : radius <= 1600 ? 16 : 15;
  const path =
    `/maps/api/staticmap?center=${lat},${lng}` +
    `&zoom=${zoom}&size=640x640&scale=2&maptype=hybrid` +
    `&markers=color:red%7C${lat},${lng}`;
  const res = await googleGateway(path);
  if (!res) return await fetchOsmStaticMap(lat, lng, zoom);
  const buf = await res.arrayBuffer();
  return { url: `data:image/png;base64,${Buffer.from(buf).toString("base64")}`, placement: { ...mapImagePlacement(lat, lng, zoom, 640), attribution: "© Google Maps" } };
}

/**
 * Static-map fallback stitched from public OSM raster tiles. Used whenever the
 * Google Static Maps API is unavailable for the configured key, so the officer
 * always sees a real map preview of the incident point.
 */
async function fetchOsmStaticMap(lat: number, lng: number, zoom: number) {
  try {
    const n = 2 ** zoom;
    const x = Math.floor(((lng + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
    const res = await fetch(`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`, {
      headers: { "User-Agent": OVERPASS_UA },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return { url: `data:image/png;base64,${Buffer.from(buf).toString("base64")}`, placement: { ...mapImagePlacement(lat, lng, zoom, 256, { x, y }), attribution: "© OpenStreetMap contributors" } };
  } catch {
    return null;
  }
}

async function fetchReverseAddress(lat: number, lng: number) {
  const res = await googleGateway(`/maps/api/geocode/json?latlng=${lat},${lng}`);
  if (!res) return null;
  const json = await res.json().catch(() => null) as { results?: Array<{ formatted_address?: string }> } | null;
  return json?.results?.[0]?.formatted_address ?? null;
}

/**
 * Precision resolver for the location picker: turns an exact lat/lng into the
 * nearest real street address plus a Google static satellite thumbnail so the
 * officer visually confirms the pin before the FIR is saved.
 */
export async function resolveExactPoint(lat: number, lng: number) {
  const [address, staticMapUrl] = await Promise.all([
    fetchReverseAddress(lat, lng).catch(() => null),
    fetchStaticMap(lat, lng, 250).catch(() => null),
  ]);
  return { lat, lng, address, staticMapUrl: staticMapUrl?.url ?? null };
}

async function fetchGooglePlaces(lat: number, lng: number, radius: number) {
  const queries = [
    `buildings shops schools mosques hospitals police near ${lat},${lng}`,
    `landmarks roads houses stores near ${lat},${lng}`,
  ];
  const places = new Map<string, GooglePlace>();
  for (const textQuery of queries) {
    const res = await googleGateway("/places/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types",
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: 20,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: Math.min(Math.max(radius, 300), 3000),
          },
        },
      }),
    });
    if (!res) continue;
    const json = await res.json().catch(() => null) as { places?: GooglePlace[] } | null;
    for (const p of json?.places ?? []) {
      const key = p.id || `${p.displayName?.text}-${p.location?.latitude}-${p.location?.longitude}`;
      if (p.location?.latitude && p.location?.longitude && !places.has(key)) places.set(key, p);
    }
  }
  return [...places.values()].slice(0, 32);
}

async function fetchGoogleRoads(lat: number, lng: number, radius: number) {
  const span = Math.min(Math.max(radius, 180), 650);
  const samples: string[] = [];
  for (let i = -4; i <= 4; i++) {
    const d = (i / 4) * span;
    const a = offsetLatLng(lat, lng, d, 0);
    const b = offsetLatLng(lat, lng, 0, d);
    samples.push(`${a.lat},${a.lng}`, `${b.lat},${b.lng}`);
  }
  const res = await googleGateway(`/roads/v1/nearestRoads?points=${encodeURIComponent(samples.join("|"))}`);
  if (!res) return [] as GoogleRoadPoint[];
  const json = await res.json().catch(() => null) as { snappedPoints?: GoogleRoadPoint[] } | null;
  return json?.snappedPoints ?? [];
}

function applyOsmElements(scene: RealWorldScene, elements: OverpassElement[], lat: number, lng: number) {
  for (const el of elements) {
    const tags = el.tags ?? {};
    if (el.type === "way" && el.geometry && el.geometry.length >= 2) {
      const pts: Array<[number, number]> = el.geometry.map((p) => project(p.lat, p.lon, lat, lng));
      if (tags.building || tags["building:part"]) {
        // Skip slivers that are OSM mapping noise rather than real structures.
        if (isClosed(pts) && polygonArea(pts) < 4) continue;
        const levels = parseFloat(tags["building:levels"] ?? "");
        scene.buildings.push({
          footprint: pts,
          height: inferBuildingHeight(tags),
          label: tags.name,
          source: "osm",
          color: inferBuildingColor(tags),
          kind: tags.building || tags["building:part"],
          levels: Number.isFinite(levels) ? levels : undefined,
        });
        scene.diagnostics.osmBuildings = (scene.diagnostics.osmBuildings ?? 0) + 1;
      } else if (tags.highway) {
        const { width, lanes } = resolvedRoadWidth(tags);
        scene.roads.push({
          path: pts,
          width,
          kind: tags.highway,
          source: "osm",
          lanes,
          oneway: tags.oneway === "yes" || tags.oneway === "1",
          surface: tags.surface,
          name: tags.name,
        });
        scene.diagnostics.osmRoads = (scene.diagnostics.osmRoads ?? 0) + 1;
      } else if (tags.barrier) {
        scene.barriers = scene.barriers ?? [];
        const h = tags.barrier === "wall" ? 2.4 : tags.barrier === "hedge" ? 1.4 : 1.8;
        scene.barriers.push({ path: pts, kind: tags.barrier, height: h });
      } else if (tags.natural === "water" || tags.waterway || tags.landuse === "reservoir") {
        scene.water = scene.water ?? [];
        if (isClosed(pts)) scene.water.push({ polygon: pts, kind: tags.natural || tags.waterway || "water" });
      } else if (tags.landuse || tags.leisure === "park" || tags.leisure === "pitch" || tags.amenity === "parking") {
        scene.landuse = scene.landuse ?? [];
        if (isClosed(pts) && polygonArea(pts) > 20) {
          scene.landuse.push({ polygon: pts, kind: tags.landuse || tags.leisure || tags.amenity || "area" });
        }
      }
    }
    const pointLat = typeof el.lat === "number" ? el.lat : el.center?.lat;
    const pointLng = typeof el.lon === "number" ? el.lon : el.center?.lon;
    if (typeof pointLat !== "number" || typeof pointLng !== "number") continue;
    const pos = project(pointLat, pointLng, lat, lng);
    if (tags.natural === "tree") scene.trees.push(pos);
    if (tags.highway === "street_lamp") scene.streetLights.push(pos);
    if (tags.highway === "crossing" || tags.footway === "crossing") {
      scene.crossings = scene.crossings ?? [];
      scene.crossings.push(pos);
    }
    if (tags.name || tags.amenity || tags.shop || tags.tourism || tags.office) {
      scene.landmarks.push({
        label: tags.name || tags.amenity || tags.shop || tags.tourism || tags.office || "Mapped place",
        kind: tags.amenity || tags.shop || tags.tourism || tags.office || "place",
        position: pos,
        source: "osm",
      });
    }
  }
}

function applyGoogleRoads(scene: RealWorldScene, snapped: GoogleRoadPoint[], lat: number, lng: number, radius: number) {
  const groups = new Map<string, GoogleRoadPoint[]>();
  for (const p of snapped) {
    if (!p.location?.latitude || !p.location?.longitude) continue;
    const key = p.placeId || "road";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  for (const points of groups.values()) {
    const path = points
      .sort((a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0))
      .map((p) => project(p.location!.latitude!, p.location!.longitude!, lat, lng));
    const unique = path.filter(([x, z], i) => i === 0 || Math.hypot(x - path[i - 1][0], z - path[i - 1][1]) > 2);
    if (unique.length >= 2) scene.roads.push({ path: unique, width: 5.5, kind: "google_nearest_road", source: "google" });
  }
  if (scene.roads.length === 0 && snapped[0]?.location?.latitude && snapped[0]?.location?.longitude) {
    const [, roadZ] = project(snapped[0].location.latitude, snapped[0].location.longitude, lat, lng);
    scene.roads.push({ path: [[-radius / 2, roadZ], [radius / 2, roadZ]], width: 5.5, kind: "google_nearest_road", source: "inferred" });
    scene.diagnostics.synthesizedRoads += 1;
  }
}

function applyGooglePlaces(scene: RealWorldScene, places: GooglePlace[], lat: number, lng: number) {
  // Real OSM footprints always win: a Google POI sitting inside/near an already
  // mapped building must not spawn a second synthetic box on top of it.
  const osmCentroids = scene.buildings
    .filter((b) => b.source === "osm")
    .map((b) => ({ c: polygonCentroid(b.footprint), r: Math.max(6, Math.sqrt(polygonArea(b.footprint))) }));
  for (const place of places) {
    const plat = place.location?.latitude;
    const plng = place.location?.longitude;
    if (!plat || !plng) continue;
    const [x, z] = project(plat, plng, lat, lng);
    const label = place.displayName?.text || place.formattedAddress || "Google mapped place";
    const kind = place.primaryType || place.types?.[0] || "place";
    scene.landmarks.push({ label, kind, position: [x, z], source: "google" });
    const overlapsMapped = osmCentroids.some(({ c, r }) => Math.hypot(c[0] - x, c[1] - z) < r);
    if (overlapsMapped) {
      scene.diagnostics.dedupedGoogleBuildings = (scene.diagnostics.dedupedGoogleBuildings ?? 0) + 1;
    }
    if (!kind.includes("route") && !overlapsMapped) {
      const u = seededUnit(label);
      const w = 5 + u * 8;
      const d = 5 + seededUnit(`${label}:d`) * 8;
      const h = kind.includes("school") || kind.includes("hospital") ? 10 : 4 + seededUnit(`${label}:h`) * 9;
      scene.buildings.push({
        footprint: rectangleFootprint(x, z, w, d, seededUnit(`${label}:a`) * Math.PI),
        height: h,
        label,
        source: "google",
      });
      scene.diagnostics.synthesizedBuildings += 1;
    }
  }
}

function fillAnchoredDetail(scene: RealWorldScene, radius: number) {
  if (scene.roads.length === 0) {
    scene.roads.push(
      { path: [[-radius * 0.55, 0], [radius * 0.55, 0]], width: 5.5, kind: "incident_access_axis", source: "inferred" },
      { path: [[0, -radius * 0.55], [0, radius * 0.55]], width: 4.5, kind: "incident_cross_axis", source: "inferred" },
    );
    scene.diagnostics.synthesizedRoads += 2;
  }

  if (scene.buildings.length === 0) {
    const slots: Array<[number, number]> = [[-22, -18], [24, -12], [-18, 20], [26, 22], [8, -32], [-34, 8]];
    slots.forEach(([x, z], i) => {
      scene.buildings.push({
        footprint: rectangleFootprint(x, z, 7 + (i % 3) * 2, 6 + (i % 2) * 3, i * 0.22),
        height: 4.5 + (i % 4) * 2,
        label: `Mapped structure ${i + 1}`,
        source: "inferred",
      });
      scene.diagnostics.synthesizedBuildings += 1;
    });
  }

  if (scene.trees.length === 0) {
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -radius * 0.35 + i * ((radius * 0.7) / 17);
      scene.trees.push([side * (10 + (i % 4) * 2.5), z]);
    }
  }
  if (scene.streetLights.length === 0) {
    for (let i = -3; i <= 3; i++) {
      scene.streetLights.push([-5.5, i * 16], [5.5, i * 16]);
    }
  }
}

export async function buildRealWorldScene(input: { lat: number; lng: number; radius?: number }): Promise<RealWorldScene> {
  const key = sceneCacheKey(input.lat, input.lng, input.radius ?? 300);
  const cached = SCENE_CACHE.get(key);
  if (cached && Date.now() - cached.at < SCENE_CACHE_TTL_MS) return cached.scene;

  const inflight = INFLIGHT.get(key);
  if (inflight) return inflight;

  const task = (async () => {
    const scene = await buildRealWorldSceneUncached(input);
    // Only cache renders that actually carry geometry, so a transient upstream
    // outage can't pin an empty scene to this location for 30 minutes.
    if (scene.buildings.length + scene.roads.length + scene.landmarks.length > 0) {
      SCENE_CACHE.set(key, { at: Date.now(), scene });
    }
    return scene;
  })().finally(() => INFLIGHT.delete(key));

  INFLIGHT.set(key, task);
  return task;
}

async function buildRealWorldSceneUncached(input: { lat: number; lng: number; radius?: number }): Promise<RealWorldScene> {
  const { lat, lng } = input;
  const startRadius = input.radius ?? 300;
  const radiusLadder = Array.from(new Set([startRadius, 500, 1000, 2000, 4000].filter((r) => r >= startRadius)));
  const scene: RealWorldScene = {
    anchor: { lat, lng },
    buildings: [],
    roads: [],
    trees: [],
    landmarks: [],
    streetLights: [],
    water: [],
    landuse: [],
    barriers: [],
    crossings: [],
    staticMapUrl: null,
    address: null,
    radiusMeters: startRadius,
    status: "unavailable",
    source: "inferred",
    diagnostics: { osmElements: 0, googlePlaces: 0, googleRoadPoints: 0, synthesizedBuildings: 0, synthesizedRoads: 0 },
  };

  for (const radius of radiusLadder) {
    const query = `
      [out:json][timeout:25];
      (
        way["building"](around:${radius},${lat},${lng});
        way["building:part"](around:${radius},${lat},${lng});
        way["highway"](around:${radius},${lat},${lng});
        way["barrier"](around:${radius},${lat},${lng});
        way["natural"="water"](around:${radius},${lat},${lng});
        way["waterway"](around:${radius},${lat},${lng});
        way["landuse"](around:${radius},${lat},${lng});
        way["leisure"](around:${radius},${lat},${lng});
        way["amenity"="parking"](around:${radius},${lat},${lng});
        node["natural"="tree"](around:${radius},${lat},${lng});
        node["highway"="street_lamp"](around:${radius},${lat},${lng});
        node["highway"="crossing"](around:${radius},${lat},${lng});
        node["amenity"](around:${radius},${lat},${lng});
        node["shop"](around:${radius},${lat},${lng});
        node["tourism"](around:${radius},${lat},${lng});
        node["office"](around:${radius},${lat},${lng});
      );
      out geom;
    `;
    const json = await overpassQuery(query);
    if (!json) continue;
    scene.status = "empty";
    scene.radiusMeters = radius;
    scene.buildings = [];
    scene.roads = [];
    scene.trees = [];
    scene.landmarks = [];
    scene.streetLights = [];
    scene.water = [];
    scene.landuse = [];
    scene.barriers = [];
    scene.crossings = [];
    scene.diagnostics.osmElements = json.elements?.length ?? 0;
    scene.diagnostics.osmBuildings = 0;
    scene.diagnostics.osmRoads = 0;
    applyOsmElements(scene, json.elements ?? [], lat, lng);
    if (scene.buildings.length + scene.roads.length + scene.landmarks.length > 0) {
      scene.status = "ok";
      scene.source = "osm";
      break;
    }
  }

  const googleRadius = Math.max(scene.radiusMeters, startRadius);
  const [staticMapUrl, address, googlePlaces, googleRoadPoints] = await Promise.all([
    fetchStaticMap(lat, lng, googleRadius).catch(() => null),
    fetchReverseAddress(lat, lng).catch(() => null),
    fetchGooglePlaces(lat, lng, googleRadius).catch(() => []),
    fetchGoogleRoads(lat, lng, googleRadius).catch(() => []),
  ]);
  scene.staticMapUrl = staticMapUrl?.url ?? null;
  scene.staticMapPlacement = staticMapUrl?.placement;
  scene.address = address;
  scene.diagnostics.googlePlaces = googlePlaces.length;
  scene.diagnostics.googleRoadPoints = googleRoadPoints.length;

  if (googleRoadPoints.length) applyGoogleRoads(scene, googleRoadPoints, lat, lng, Math.min(googleRadius, 650));
  if (googlePlaces.length) applyGooglePlaces(scene, googlePlaces, lat, lng);

  if (scene.buildings.length + scene.roads.length + scene.landmarks.length > 0) {
    scene.status = scene.status === "ok" ? "ok" : "partial";
    scene.source = scene.source === "osm" ? "hybrid" : "google";
  }

  fillAnchoredDetail(scene, Math.min(Math.max(googleRadius, 180), 650));

  if (scene.status === "unavailable" || scene.status === "empty") {
    scene.status = scene.staticMapUrl || scene.address ? "partial" : "empty";
    scene.source = scene.staticMapUrl || scene.address ? "inferred" : "inferred";
  }

  return scene;
}
// ---------------------------------------------------------------------------
// Places (New) proxied through the backend — the browser key no longer
// authorises Places, so the picker calls these via authenticated server fns.
// ---------------------------------------------------------------------------
export async function placesAutocomplete(input: {
  input: string;
  sessionToken: string;
  bias?: { lat: number; lng: number; radius: number };
  primaryTypes?: string[];
}) {
  const body: Record<string, unknown> = {
    input: input.input,
    sessionToken: input.sessionToken,
    includedRegionCodes: ["pk"],
  };
  if (input.primaryTypes?.length) body.includedPrimaryTypes = input.primaryTypes;
  if (input.bias) {
    body.locationBias = {
      circle: { center: { latitude: input.bias.lat, longitude: input.bias.lng }, radius: input.bias.radius },
    };
  }
  const res = await googleGateway("/places/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text,suggestions.placePrediction.text.text",
    },
    body: JSON.stringify(body),
  }, true);
  if (!res) return [];
  type S = { placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } } };
  const json = (await res.json().catch(() => null)) as { suggestions?: S[] } | null;
  return (json?.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<S["placePrediction"]> => !!p?.placeId)
    .slice(0, 6)
    .map((p) => ({
      placeId: p.placeId ?? "",
      primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

export async function placeDetails(placeId: string, sessionToken?: string) {
  const qs = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
  const res = await googleGateway(`/places/v1/places/${encodeURIComponent(placeId)}${qs}`, {
    headers: { "X-Goog-FieldMask": "id,displayName,formattedAddress,location" },
  }, true);
  if (!res) return null;
  const p = (await res.json().catch(() => null)) as {
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  } | null;
  if (p?.location?.latitude === undefined || p.location.longitude === undefined) return null;
  return {
    name: p.displayName?.text ?? "",
    formattedAddress: p.formattedAddress ?? "",
    lat: p.location.latitude,
    lng: p.location.longitude,
  };
}
