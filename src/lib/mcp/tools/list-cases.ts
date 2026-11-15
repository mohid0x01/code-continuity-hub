import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_cases",
  title: "List FIR cases",
  description: "List the signed-in officer's FIR cases and reconstruction status, newest first.",
  inputSchema: {
    status: z.enum(["pending", "preprocessing", "entity_extraction", "spatial_resolution", "timeline_sequencing", "scene_generation", "completed", "failed"]).optional().describe("Only return cases in this processing state."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum number of cases to return, from 1 to 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in with OAuth to list cases.");
    let query = supabaseForUser(ctx)
      .from("fir_jobs")
      .select("id, status, render_mode, created_at, llm_model, video_url, scene_manifest, fir_records!inner(case_number, district, city, area, incident_type, incident_date)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw new ToolError(`Could not list cases: ${error.message}`);

    const cases = (data ?? []).map((job) => {
      const linked = job.fir_records;
      const fir = Array.isArray(linked) ? linked[0] : linked;
      return {
        job_id: job.id,
        case_number: fir?.case_number ?? "",
        district: fir?.district ?? "",
        city: fir?.city ?? null,
        area: fir?.area ?? null,
        incident_type: fir?.incident_type ?? "other",
        incident_date: fir?.incident_date ?? null,
        status: job.status,
        render_mode: job.render_mode,
        model: job.llm_model,
        created_at: job.created_at,
        has_scene: Boolean(job.scene_manifest),
        has_video: Boolean(job.video_url),
      };
    });

    return {
      content: [{ type: "text", text: cases.length ? `${cases.length} case(s) returned.` : "No matching cases found." }],
      structuredContent: { cases },
    };
  },
});
