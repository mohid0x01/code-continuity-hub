import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Queue an AI 3D incident video generation for a job.
 *
 * Real text-to-video models (Runway/Luma/Replicate) take 30-120s and
 * require an external API. This stub flips `video_status` to `queued`
 * and immediately marks `processing`. A background worker (or future
 * external call) would set `completed` with `video_url`. Until that
 * worker exists, the viewer surfaces a clear "queued" state.
 */
export const queueVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) =>
    z.object({ jobId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("fir_jobs")
      .update({ video_status: "queued", video_url: null } as never)
      .eq("id", data.jobId);
    if (error) throw new Error(error.message);
    return { ok: true, status: "queued" as const };
  });