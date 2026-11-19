import { describe, expect, it } from "vitest";
import { buildEngineScene } from "@/lib/engine-scene";

describe("SCENEIQ Engine deterministic scene builder", () => {
  it("maps two armed suspects, a pistol, a shop and one entrance per suspect", () => {
    const scene = buildEngineScene("Two suspects armed with a pistol enter the shop");
    const suspects = scene.entities.filter((entity) => entity.entity_role === "suspect");
    expect(suspects).toHaveLength(2);
    expect(scene.entities.filter((entity) => entity.label === "Pistol")).toHaveLength(1);
    expect(scene.entities.filter((entity) => entity.label === "Shop")).toHaveLength(1);
    const entries = scene.events.filter((event) => event.action_label === "enter shop");
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((event) => event.entity_label))).toEqual(new Set(["Suspect 1", "Suspect 2"]));
  });

  it("does not turn victims into suspects or invent a weapon", () => {
    const scene = buildEngineScene("Two victims were inside the house.");
    expect(scene.entities.filter((entity) => entity.entity_role === "victim")).toHaveLength(2);
    expect(scene.entities.filter((entity) => entity.entity_role === "suspect")).toHaveLength(0);
    expect(scene.entities.filter((entity) => entity.entity_type === "object")).toHaveLength(0);
    expect(scene.entities.some((entity) => entity.label === "Residence")).toBe(true);
  });

  it("maps a stated motorcycle and witness without adding unstated people", () => {
    const scene = buildEngineScene("A witness saw a motorcycle parked outside the bank.");
    expect(scene.entities.filter((entity) => entity.entity_role === "witness")).toHaveLength(1);
    expect(scene.entities.filter((entity) => entity.entity_role === "suspect")).toHaveLength(0);
    expect(scene.entities.filter((entity) => entity.label === "Motorcycle")).toHaveLength(1);
    expect(scene.events.some((event) => event.action_label === "parked at scene")).toBe(true);
    expect(scene.entities.some((entity) => entity.label === "Bank")).toBe(true);
  });
});
