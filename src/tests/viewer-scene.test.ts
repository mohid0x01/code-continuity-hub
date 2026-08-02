import { describe, it, expect } from "vitest";
import { deriveRenderEntities, buildRenderTimeline, diagnoseVehicles } from "@/lib/scene-render";
import { sceneCacheKey } from "@/lib/location-scene.server";
import type { SceneEntity, SceneEvent } from "@/lib/scene-render";

// Known CASE fixture: 0887e56e-2ab at Karachi Saddar coordinates.
const CASE_ID = "0887e56e-2ab";
const LAT = 24.8607;
const LNG = 67.0011;

const actor = {
  id: "a1", job_id: CASE_ID, entity_type: "actor", entity_role: "suspect", label: "Suspect",
  description: null, color: "#f00", confidence: 0.9, position_x: 0, position_y: 0, position_z: 0,
  source_text: null, metadata: null, created_at: new Date(0).toISOString(),
} as unknown as SceneEntity;

const event = {
  id: "e1", job_id: CASE_ID, sequence_number: 1, description: "Suspect flees in a car",
  action_label: "flee", entity_id: "a1", dest_x: 5, dest_z: 5,
} as unknown as SceneEvent;

describe("viewer scene derivation for CASE 0887e56e-2ab", () => {
  const narrative = "Do afrad ne mobile chheena aur ek safed car me farar ho gaye.";

  it("spawns a vehicle when the statement mentions a car but extraction missed it", () => {
    const rendered = deriveRenderEntities([actor], narrative, CASE_ID);
    const vehicles = rendered.filter((e) => e.entity_type === "vehicle");
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].id).toBe(`synthetic-vehicle-${CASE_ID}`);
  });

  it("does not duplicate vehicles that already exist", () => {
    const withCar = { ...actor, id: "v1", entity_type: "vehicle", label: "White car" } as SceneEntity;
    const rendered = deriveRenderEntities([actor, withCar], narrative, CASE_ID);
    expect(rendered.filter((e) => e.entity_type === "vehicle")).toHaveLength(1);
  });

  it("does not invent vehicles when none are mentioned", () => {
    expect(deriveRenderEntities([actor], "Ghar me chori hui.", CASE_ID)).toHaveLength(1);
  });

  it("reports the vehicle as visible inside camera bounds", () => {
    const rendered = deriveRenderEntities([actor], narrative, CASE_ID);
    const diag = diagnoseVehicles(rendered, narrative);
    expect(diag).toHaveLength(1);
    expect(diag[0].visible).toBe(true);
    expect(diag[0].inferred).toBe(true);
  });

  it("builds a render timeline explaining location, entities, events and camera", () => {
    const rendered = deriveRenderEntities([actor], narrative, CASE_ID);
    const steps = buildRenderTimeline({
      realWorld: {
        anchor: { lat: LAT, lng: LNG }, buildings: [], roads: [], trees: [], landmarks: [],
        streetLights: [], staticMapUrl: null, address: "Saddar, Karachi", radiusMeters: 300,
        status: "ok", source: "osm",
        diagnostics: { osmElements: 12, googlePlaces: 0, googleRoadPoints: 0, synthesizedBuildings: 0, synthesizedRoads: 0 },
      },
      entities: [actor],
      renderEntities: rendered,
      events: [event],
    });
    expect(steps.map((s) => s.phase)).toEqual(["location", "location", "entities", "events", "camera"]);
    expect(steps[0].detail).toContain("24.86070");
  });
});

describe("deterministic location cache key", () => {
  it("returns the same key for the same coordinates", () => {
    expect(sceneCacheKey(LAT, LNG, 300)).toBe(sceneCacheKey(LAT, LNG, 300));
    expect(sceneCacheKey(LAT, LNG, 300)).not.toBe(sceneCacheKey(LAT, LNG, 500));
  });
});
