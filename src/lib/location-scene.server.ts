export interface RealWorldScene {
  anchor: { lat: number; lng: number };
  buildings: { footprint: Array<[number, number]>; height: number; label?: string; source?: "osm" | "google" | "inferred" }[];
  roads: { path: Array<[number, number]>; width: number; kind: string; source?: "osm" | "google" | "inferred" }[];
  trees: Array<[number, number]>;
  landmarks: { label: string; kind: string; position: [number, number]; source: "osm" | "google" }[];
  streetLights: Array<[number, number]>;
  staticMapUrl: string | null;
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
  };
}

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

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

async function googleGateway(path: string, init?: RequestInit) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !mapsKey) return null;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${lovableKey}`);
  headers.set("X-Connection-Api-Key", mapsKey);
  const res = await fetch(`https://connector-gateway.lovable.dev/google_maps${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`Google Maps gateway ${path} failed [${res.status}]: ${body.slice(0, 240)}`);
    return null;
  }
  return res;
}

async function fetchStaticMap(lat: number, lng: number, radius: number) {
  const zoom = radius <= 350 ? 18 : radius <= 800 ? 17 : radius <= 1600 ? 16 : 15;
  const path =
    `/maps/api/staticmap?center=${lat},${lng}` +
    `&zoom=${zoom}&size=640x640&scale=2&maptype=hybrid` +
    `&markers=color:red%7C${lat},${lng}`;
  const res = await googleGateway(path);
  if (!res) return null;
  const buf = await res.arrayBuffer();
  return `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
}

async function fetchReverseAddress(lat: number, lng: number) {
  const res = await googleGateway(`/maps/api/geocode/json?latlng=${lat},${lng}`);
  if (!res) return null;
  const json = await res.json().catch(() => null) as { results?: Array<{ formatted_address?: string }> } | null;
  return json?.results?.[0]?.formatted_address ?? null;
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
      if (tags.building) {
        scene.buildings.push({ footprint: pts, height: inferBuildingHeight(tags), label: tags.name, source: "osm" });
      } else if (tags.highway) {
        scene.roads.push({ path: pts, width: roadWidth(tags.highway), kind: tags.highway, source: "osm" });
      }
    }
    const pointLat = typeof el.lat === "number" ? el.lat : el.center?.lat;
    const pointLng = typeof el.lon === "number" ? el.lon : el.center?.lon;
    if (typeof pointLat !== "number" || typeof pointLng !== "number") continue;
    const pos = project(pointLat, pointLng, lat, lng);
    if (tags.natural === "tree") scene.trees.push(pos);
    if (tags.highway === "street_lamp") scene.streetLights.push(pos);
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
  for (const place of places) {
    const plat = place.location?.latitude;
    const plng = place.location?.longitude;
    if (!plat || !plng) continue;
    const [x, z] = project(plat, plng, lat, lng);
    const label = place.displayName?.text || place.formattedAddress || "Google mapped place";
    const kind = place.primaryType || place.types?.[0] || "place";
    scene.landmarks.push({ label, kind, position: [x, z], source: "google" });
    if (!kind.includes("route")) {
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
        way["highway"](around:${radius},${lat},${lng});
        node["natural"="tree"](around:${radius},${lat},${lng});
        node["highway"="street_lamp"](around:${radius},${lat},${lng});
        node["amenity"](around:${radius},${lat},${lng});
        node["shop"](around:${radius},${lat},${lng});
        node["tourism"](around:${radius},${lat},${lng});
        node["office"](around:${radius},${lat},${lng});
      );
      out geom tags center;
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
    scene.diagnostics.osmElements = json.elements?.length ?? 0;
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
  scene.staticMapUrl = staticMapUrl;
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