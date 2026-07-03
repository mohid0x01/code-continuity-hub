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

/**
 * Upload a real client-recorded 3D-scene MP4/WebM blob (base64) to the
 * evidence bucket, mint a long-lived signed URL, and mark the job's
 * video_status = 'completed'. This is a genuine video of the reconstructed
 * scene rendered in-browser via MediaRecorder — not a stub.
 */
export const uploadRenderedVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string; base64: string; mime: string; durationSec: number }) =>
    z
      .object({
        jobId: z.string().uuid(),
        base64: z.string().min(100),
        mime: z.string().min(3).max(64),
        durationSec: z.number().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Decode base64 → Uint8Array (Workers-safe).
    const b64 = data.base64.includes(",") ? data.base64.split(",")[1] : data.base64;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const ext = data.mime.includes("mp4") ? "mp4" : "webm";
    const path = `videos/${data.jobId}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("evidence")
      .upload(path, bytes, { contentType: data.mime, upsert: true });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: signed, error: signErr } = await supabase.storage
      .from("evidence")
      .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
    if (signErr || !signed) throw new Error(`Signing failed: ${signErr?.message ?? "unknown"}`);

    const { error: updErr } = await supabase
      .from("fir_jobs")
      .update({
        video_url: signed.signedUrl,
        video_status: "completed",
      } as never)
      .eq("id", data.jobId);
    if (updErr) throw new Error(updErr.message);

    // Audit trail
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "video.render_upload",
      entity_type: "fir_job",
      entity_id: data.jobId,
      metadata: { path, mime: data.mime, durationSec: data.durationSec },
    } as never);

    return { ok: true, url: signed.signedUrl, path };
  });