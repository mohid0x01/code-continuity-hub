import type { Tables } from "@/integrations/supabase/types";
import type { RealWorldScene } from "@/lib/location-scene.functions";

export type SceneEntity = Tables<"scene_entities">;
export type SceneEvent = Tables<"scene_events">;

export const VEHICLE_WORDS =
  /(\bcar\b|\bvehicle\b|\bmotorcar\b|\bsedan\b|\bsuv\b|\bvan\b|\btruck\b|\bmehran\b|\bcorolla\b|\bcultus\b|\balto\b|\bcivic\b|\btoyota\b|\bhonda\b|\bsuzuki\b|گاڑی|کار|gaari|gari)/i;

export const MOTORCYCLE_WORDS = /(\bmotorcycle\b|\bmotorbike\b|\bbike\b|موٹر\s?سائیکل|motorcycle)/i;

/**
 * Deterministically derives what actually gets rendered in the 3D scene.
 * If the narrative clearly mentions a vehicle but the extractor produced no
 * vehicle entity, a synthetic one is spawned so the reconstruction never
 * silently drops the car described in the statement.
 */
export function deriveRenderEntities(
  entities: SceneEntity[],
  firText: string,
  jobId: string | null | undefined,
): SceneEntity[] {
  const hasVehicle = entities.some((e) => e.entity_type === "vehicle");
  const mentioned = VEHICLE_WORDS.test(firText ?? "") || MOTORCYCLE_WORDS.test(firText ?? "");
  if (hasVehicle || !mentioned) return entities;

  const syntheticCar = {
    id: `synthetic-vehicle-${jobId ?? "scene"}`,
    job_id: jobId ?? "",
    entity_type: "vehicle",
    entity_role: null,
    label: MOTORCYCLE_WORDS.test(firText ?? "") ? "Motorcycle mentioned in statement" : "Car mentioned in statement",
    description: "Vehicle inferred from the FIR statement so it appears in the reconstruction.",
    color: "#C9A84C",
    confidence: 0.7,
    position_x: 4,
    position_y: 0,
    position_z: -3,
    source_text: "Inferred from statement vehicle wording",
    metadata: { inferred: true },
    created_at: new Date(0).toISOString(),
  } as unknown as SceneEntity;

  return [...entities, syntheticCar];
}

export interface RenderTimelineStep {
  id: string;
  phase: "location" | "entities" | "events" | "camera";
  title: string;
  detail: string;
  status: "ok" | "warn" | "info";
}

/** Human-readable "how the video was built" trace shown in the viewer UI. */
export function buildRenderTimeline(args: {
  realWorld: RealWorldScene | null;
  entities: SceneEntity[];
  renderEntities: SceneEntity[];
  events: SceneEvent[];
}): RenderTimelineStep[] {
  const { realWorld, entities, renderEntities, events } = args;
  const steps: RenderTimelineStep[] = [];

  steps.push({
    id: "loc",
    phase: "location",
    title: "Real location resolved",
    detail: realWorld
      ? `${realWorld.anchor.lat.toFixed(5)}, ${realWorld.anchor.lng.toFixed(5)} · ${realWorld.source.toUpperCase()} · r=${realWorld.radiusMeters}m`
      : "Waiting for FIR coordinates",
    status: realWorld ? (realWorld.status === "ok" ? "ok" : "warn") : "warn",
  });

  steps.push({
    id: "geo",
    phase: "location",
    title: "Map geometry layered",
    detail: realWorld
      ? `${realWorld.buildings.length} buildings · ${realWorld.roads.length} roads · ${realWorld.landmarks.length} places · ${realWorld.trees.length} trees`
      : "No geometry yet",
    status: realWorld && realWorld.buildings.length + realWorld.roads.length > 0 ? "ok" : "warn",
  });

  const actors = renderEntities.filter((e) => e.entity_type === "actor");
  const vehicles = renderEntities.filter((e) => e.entity_type === "vehicle");
  const inferred = renderEntities.length - entities.length;

  steps.push({
    id: "ent",
    phase: "entities",
    title: "Entities spawned",
    detail: `${actors.length} actors · ${vehicles.length} vehicles${inferred > 0 ? ` · ${inferred} inferred from statement` : ""}`,
    status: renderEntities.length > 0 ? "ok" : "warn",
  });

  steps.push({
    id: "evt",
    phase: "events",
    title: "Event timeline sequenced",
    detail:
      events.length > 0
        ? events
            .slice(0, 4)
            .map((e, i) => `${i + 1}. ${e.action_label ?? e.description ?? "event"}`)
            .join(" → ") + (events.length > 4 ? ` → +${events.length - 4} more` : "")
        : "No events extracted",
    status: events.length > 0 ? "ok" : "warn",
  });

  steps.push({
    id: "cam",
    phase: "camera",
    title: "Camera path chosen",
    detail:
      events.length > 0
        ? "Cinematic orbit locked to the active event's actor/vehicle position"
        : "Static overview orbit (no events to track)",
    status: "info",
  });

  return steps;
}

export interface VehicleDiagnostic {
  id: string;
  label: string;
  inferred: boolean;
  position: [number, number, number];
  reason: string;
  visible: boolean;
}

/** Explains, per vehicle, whether it will actually appear in the 3D scene. */
export function diagnoseVehicles(renderEntities: SceneEntity[], firText: string): VehicleDiagnostic[] {
  const vehicles = renderEntities.filter((e) => e.entity_type === "vehicle");
  if (vehicles.length === 0) {
    const mentioned = VEHICLE_WORDS.test(firText ?? "");
    return mentioned
      ? [
          {
            id: "missing",
            label: "Vehicle mentioned but not spawned",
            inferred: false,
            position: [0, 0, 0],
            reason: "Statement mentions a vehicle but no entity reached the renderer.",
            visible: false,
          },
        ]
      : [];
  }
  return vehicles.map((v) => {
    const x = v.position_x ?? 0;
    const y = v.position_y ?? 0;
    const z = v.position_z ?? 0;
    const inBounds = Math.abs(x) < 500 && Math.abs(z) < 500;
    return {
      id: v.id,
      label: v.label,
      inferred: Boolean((v.metadata as { inferred?: boolean } | null)?.inferred),
      position: [x, y, z],
      reason: inBounds ? "Inside camera bounds — rendered" : "Position outside scene bounds — clamp required",
      visible: inBounds,
    };
  });
}
