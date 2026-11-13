import { describe, expect, it } from "vitest";
import { searchKnownPakistanCities } from "@/lib/geocode";
import { placeDetails } from "@/lib/location-scene.server";

describe("Google-independent FIR city search", () => {
  it("returns a selectable Karachi result with its real coordinates", () => {
    expect(searchKnownPakistanCities("Karachi")).toEqual([
      {
        placeId: "pkcity:karachi",
        primary: "Karachi",
        secondary: "Pakistan",
        lat: 24.8607,
        lng: 67.0011,
      },
    ]);
  });

  it("matches a city inside a longer search phrase", () => {
    expect(searchKnownPakistanCities("Karachi Pakistan")[0]?.placeId).toBe("pkcity:karachi");
  });

  it("returns no city fallback for an unknown name", () => {
    expect(searchKnownPakistanCities("Unknown Place 123")).toEqual([]);
  });

  it("resolves a local city suggestion without any Google credentials", async () => {
    await expect(placeDetails("pkcity:karachi")).resolves.toMatchObject({
      name: "Karachi",
      formattedAddress: "Karachi, Pakistan",
      lat: 24.8607,
      lng: 67.0011,
    });
  });

  it("rejects coordinates outside the supported Pakistan search area", async () => {
    await expect(placeDetails("osm:40,90:Outside%20Pakistan")).resolves.toBeNull();
  });
});