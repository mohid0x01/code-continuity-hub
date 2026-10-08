import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const idSchema = z.object({ jobId: z.string().uuid() });

/** Start one AI re-enactment clip for a completed FIR job (explicit user/officer action). */
export const startAiVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: job, error } = await supabase
      .from("fir_jobs")
      .select("id, ai_video_job_id, video_status, fir_records(city, area, formatted_address, incident_type, incident_date)")
      .eq("id", data.jobId)
      .single();
    if (error || !job) throw new Error("Job not found");
    if (job.ai_video_job_id && job.video_status === "ai_processing") return { ok: true, status: "ai_processing" };

    const fir = job.fir_records as unknown as {
      city: string | null; area: string | null; formatted_address: string | null; incident_type: string; incident_date: string | null;
    };
    const [{ data: ents }, { data: evts }] = await Promise.all([
      supabase.from("scene_entities").select("label, entity_type, entity_role, description").eq("job_id", data.jobId),
      supabase.from("scene_events").select("sequence_number, action_label, description").eq("job_id", data.jobId),
    ]);

    const ai = await import("./ai-video.server");
    const prompt = ai.buildReenactmentPrompt({
      incidentType: fir.incident_type,
      address: fir.formatted_address ?? "",
      city: fir.city ?? "",
      area: fir.area ?? "",
      incidentDate: fir.incident_date,
      entities: ents ?? [],
      events: evts ?? [],
    });
    try {
      const vj = await ai.createVeoJob(prompt, ai.REENACTMENT_NEGATIVE);
      await supabase.from("fir_jobs").update({
        ai_video_job_id: vj.id, video_status: "ai_processing", ai_video_error: null,
      }).eq("id", data.jobId);
      return { ok: true, status: "ai_processing" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI video failed to start";
      await supabase.from("fir_jobs").update({ video_status: "ai_failed", ai_video_error: msg }).eq("id", data.jobId);
      throw new Error(msg);
    }
  });

/** Poll the AI clip; on completion store the MP4 in private storage and save its signed URL. */
export const pollAiVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: job } = await supabase
      .from("fir_jobs").select("ai_video_job_id, ai_video_path, video_url, video_status").eq("id", data.jobId).single();
    if (!job?.ai_video_job_id) return { status: "none" as const };
    if (job.ai_video_path && job.video_url) return { status: "completed" as const, url: job.video_url };

    const ai = await import("./ai-video.server");
    const vj = await ai.pollVeoJob(job.ai_video_job_id);
    if (vj.status === "failed") {
      const msg = vj.error?.message ?? "AI video generation failed";
      await supabase.from("fir_jobs").update({ video_status: "ai_failed", ai_video_error: msg }).eq("id", data.jobId);
      return { status: "failed" as const, error: msg };
    }
    if (vj.status !== "completed") return { status: "processing" as const, progress: vj.progress ?? 0 };

    const bytes = await ai.downloadVeoJob(vj.id);
    const path = `videos/${data.jobId}/ai-${vj.id}.mp4`;
    const { error: upErr } = await supabase.storage.from("evidence").upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
    const { data: signed } = await supabase.storage.from("evidence").createSignedUrl(path, 60 * 60 * 24 * 365);
    await supabase.from("fir_jobs").update({
      ai_video_path: path, video_url: signed?.signedUrl ?? null, video_status: "completed",
    }).eq("id", data.jobId);
    return { status: "completed" as const, url: signed?.signedUrl ?? null };
  });
