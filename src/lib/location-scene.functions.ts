import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RealWorldScene } from "./location-scene.server";

export type { RealWorldScene } from "./location-scene.server";

const inputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(80).max(4000).optional(),
});

// All map functions are sign-in only: they spend paid Google Maps quota.
export const fetchLocationScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<RealWorldScene> => {
    const { buildRealWorldScene } = await import("./location-scene.server");
    return buildRealWorldScene(data);
  });

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Reverse-geocode + satellite thumbnail for the exact pin chosen in the picker. */
export const resolvePickedPoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => pointSchema.parse(data))
  .handler(async ({ data }) => {
    const { resolveExactPoint } = await import("./location-scene.server");
    return resolveExactPoint(data.lat, data.lng);
  });

const autocompleteSchema = z.object({
  input: z.string().trim().min(2).max(120),
  bias: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), radius: z.number().min(100).max(50000) })
    .optional(),
  primaryTypes: z.array(z.string().max(40)).max(5).optional(),
});

export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => autocompleteSchema.parse(data))
  .handler(async ({ data }) => {
    const { placesAutocomplete } = await import("./location-scene.server");
    return placesAutocomplete(data);
  });

export const getPlaceDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ placeId: z.string().min(3).max(300) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { placeDetails } = await import("./location-scene.server");
    return placeDetails(data.placeId);
  });
