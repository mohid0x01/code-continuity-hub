import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_case",
  title: "Get FIR case details",
  description: "Read one permitted FIR case, including its narrative, location, and processing status.",
  inputSchema: {
    job_id: z.string().uuid().describe("The job ID returned by list_cases."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ job_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in with OAuth to read a case.");
    const { data: job, error } = await supabaseForUser(ctx)
      .from("fir_jobs")
      .select("id, fir_id, status, render_mode, created_at, updated_at, processing_time_ms, llm_model, error_message, video_status, fir_records!inner(case_number, district, city, area, formatted_address, latitude, longitude, incident_type, incident_date, raw_narrative, created_at)")
      .eq("id", job_id)
      .maybeSingle();

    if (error) throw new ToolError(`Could not read case: ${error.message}`);
    if (!job) throw new ToolError("Case not found or not permitted for this account.");

    const linked = job.fir_records;
    const fir = Array.isArray(linked) ? linked[0] : linked;
    if (!fir) throw new ToolError("The linked FIR record is unavailable.");

    const caseDetails = {
      job_id: job.id,
      fir_id: job.fir_id,
      case_number: fir.case_number,
      status: job.status,
      render_mode: job.render_mode,
      incident_type: fir.incident_type,
      incident_date: fir.incident_date,
      district: fir.district,
      city: fir.city,
      area: fir.area,
      formatted_address: fir.formatted_address,
      latitude: fir.latitude,
      longitude: fir.longitude,
      narrative: fir.raw_narrative,
      submitted_at: fir.created_at,
      job_created_at: job.created_at,
      job_updated_at: job.updated_at,
      processing_time_ms: job.processing_time_ms,
      model: job.llm_model,
      error_message: job.error_message,
      video_status: job.video_status,
    };

    return {
      content: [{ type: "text", text: `${fir.case_number}: ${job.status}; ${fir.incident_type} in ${fir.district}.` }],
      structuredContent: { case: caseDetails },
    };
  },
});
