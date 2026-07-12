import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { RealWorldScene } from "./location-scene.server";

export type { RealWorldScene } from "./location-scene.server";

const inputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(80).max(4000).optional(),
});

export const fetchLocationScene = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<RealWorldScene> => {
    const { buildRealWorldScene } = await import("./location-scene.server");
    return buildRealWorldScene(data);
  });