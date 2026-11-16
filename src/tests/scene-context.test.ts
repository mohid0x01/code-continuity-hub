import { describe, expect, it } from "vitest";
import { deriveSceneContext, explicitSuspectCount, reconcileSceneEntities, reconcileSceneEvents } from "@/lib/scene-context";
import type { SceneEntity, SceneEvent } from "@/lib/scene-render";

const JOB = "case-shop-001";
const suspect = (id = "suspect-1", label = "Suspect 1"): SceneEntity => ({
  id,
  job_id: JOB,
  entity_type: "actor",
  entity_role: "suspect",
  label,
  description: "Armed suspect",
  color: "#ef4444",
  confidence: 0.9,
  position_x: 0,
  position_y: 0,
  position_z: 0,
  source_text: "Two suspects",
  metadata: {},
  created_at: new Date(0).toISOString(),
} as unknown as SceneEntity);

const aimEvent = {
  id: "aim-1",
  job_id: JOB,
  sequence_number: 1,
  entity_id: "suspect-1",
  action_label: "aim pistol",
  description: "Suspect aims",
  origin_x: 0,
  origin_y: 0,
  origin_z: 0,
  dest_x: 0,
  dest_y: 0,
  dest_z: 0,
  duration_seconds: 2,
  source_text: "armed with a pistol",
  created_at: new Date(0).toISOString(),
} as unknown as SceneEvent;

describe("FIR-exact scene reconstruction", () => {
  const narrative = "Two suspects armed with a pistol enter the shop";

  it("extracts exactly two suspects, a pistol, a shop and the entry action", () => {
    const context = deriveSceneContext([suspect()], narrative);
    expect(context.suspectCount).toBe(2);
    expect(context.weapons).toEqual(["pistol"]);
    expect(context.setting).toBe("shop");
    expect(context.armedSuspects).toBe(true);
    expect(context.entering).toBe(true);
    expect(context.interior).toBe(true);
  });

  it("adds the missing second suspect and arms both rendered suspects", () => {
    const context = deriveSceneContext([suspect()], narrative);
    const rendered = reconcileSceneEntities([suspect()], narrative, JOB, context);
    const suspects = rendered.filter((entity) => entity.entity_type === "actor" && entity.entity_role === "suspect");
    expect(suspects).toHaveLength(2);
    expect(suspects.map((entity) => (entity.metadata as { weaponKind?: string }).weaponKind)).toEqual(["pistol", "pistol"]);
    expect(rendered.filter((entity) => entity.entity_type === "object" && entity.label === "Pistol")).toHaveLength(1);
  });

  it("creates one visible shop entrance event per suspect", () => {
    const context = deriveSceneContext([suspect()], narrative);
    const rendered = reconcileSceneEntities([suspect()], narrative, JOB, context);
    const events = reconcileSceneEvents(rendered, [aimEvent], context);
    const entries = events.filter((event) => event.action_label === "enter shop");
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((event) => event.entity_id)).size).toBe(2);
    expect(entries.every((event) => (event.origin_z ?? 0) > 4 && (event.dest_z ?? 0) < 2)).toBe(true);
  });

  it("understands the same requirements in Roman Urdu", () => {
    const context = deriveSceneContext([suspect()], "Do mulzim pistol lekar dukaan me dakhil hue.");
    expect(context.suspectCount).toBe(2);
    expect(context.weapons).toEqual(["pistol"]);
    expect(context.setting).toBe("shop");
    expect(context.entering).toBe(true);
  });

  it("does not turn a victim count into a suspect count or invent weapons", () => {
    const narrative = "Two victims were inside the house.";
    expect(explicitSuspectCount(narrative)).toBeNull();
    const context = deriveSceneContext([], narrative);
    expect(context.weapons).toEqual([]);
    expect(context.setting).toBe("residence");
  });
});
