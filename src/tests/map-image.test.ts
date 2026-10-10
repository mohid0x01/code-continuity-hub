import { describe, expect, it } from "vitest";
import { mapImagePlacement } from "@/lib/map-image";

describe("real location raster placement", () => {
  it("keeps centered Google imagery at the incident origin with measured coverage", () => {
    const placement = mapImagePlacement(0, 0, 18, 640);
    expect(placement.offsetX).toBe(0);
    expect(placement.offsetZ).toBe(0);
    expect(placement.widthMeters).toBeCloseTo(382.185, 2);
  });
  it("positions an OSM tile by its actual center instead of stretching it around the incident", () => {
    const placement = mapImagePlacement(0, 0, 18, 256, { x: 131072, y: 131072 });
    expect(placement.offsetX).toBeCloseTo(placement.widthMeters / 2, 6);
    expect(placement.offsetZ).toBeCloseTo(placement.widthMeters / 2, 6);
    expect(placement.widthMeters).toBeCloseTo(152.874, 2);
  });
});