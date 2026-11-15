import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_reconstruction",
  title: "Get reconstruction timeline",
  description: "Read the extracted people, vehicles, objects, and chronological actions for one permitted case.",
  inputSchema: {
    job_id: z.string().uuid().describe("The job ID returned by list_cases."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ job_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in with OAuth to read a reconstruction.");
    const supabase = supabaseForUser(ctx);
    const { data: job, error: jobError } = await supabase
      .from("fir_jobs")
      .select("id, status, fir_records!inner(case_number)")
      .eq("id", job_id)
      .maybeSingle();

    if (jobError) throw new ToolError(`Could not read reconstruction: ${jobError.message}`);
    if (!job) throw new ToolError("Reconstruction not found or not permitted for this account.");

    const [entitiesResult, eventsResult] = await Promise.all([
      supabase.from("scene_entities").select("id, entity_type, entity_role, label, description, confidence, position_x, position_y, position_z, source_text").eq("job_id", job_id).order("label"),
      supabase.from("scene_events").select("id, sequence_number, entity_id, action_label, description, origin_x, origin_y, origin_z, dest_x, dest_y, dest_z, duration_seconds, source_text").eq("job_id", job_id).order("sequence_number"),
    ]);
    if (entitiesResult.error) throw new ToolError(`Could not read scene entities: ${entitiesResult.error.message}`);
    if (eventsResult.error) throw new ToolError(`Could not read scene events: ${eventsResult.error.message}`);

    const linked = job.fir_records;
    const fir = Array.isArray(linked) ? linked[0] : linked;
    const entities = (entitiesResult.data ?? []).map((entity) => ({
      id: entity.id,
      type: entity.entity_type,
      role: entity.entity_role,
      label: entity.label,
      description: entity.description,
      confidence: entity.confidence,
      position: { x: entity.position_x, y: entity.position_y, z: entity.position_z },
      source_text: entity.source_text,
    }));
    const events = (eventsResult.data ?? []).map((event) => ({
      id: event.id,
      sequence_number: event.sequence_number,
      entity_id: event.entity_id,
      action: event.action_label,
      description: event.description,
      origin: { x: event.origin_x, y: event.origin_y, z: event.origin_z },
      destination: { x: event.dest_x, y: event.dest_y, z: event.dest_z },
      duration_seconds: event.duration_seconds,
      source_text: event.source_text,
    }));

    return {
      content: [{ type: "text", text: `${fir?.case_number ?? job.id}: ${entities.length} entities and ${events.length} timeline events.` }],
      structuredContent: {
        reconstruction: {
          job_id: job.id,
          case_number: fir?.case_number ?? "",
          status: job.status,
          entities,
          events,
        },
      },
    };
  },
});
