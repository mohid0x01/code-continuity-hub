import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const submitFirSchema = z.object({
  caseNumber: z.string().min(1).max(50),
  district: z.string().min(1).max(100),
  incidentDate: z.string().nullable(),
  incidentType: z.enum(["theft", "assault", "vehicular", "property", "kidnapping", "robbery", "other"]),
  narrative: z.string().min(10).max(50000),
});

export const submitFir = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof submitFirSchema>) => submitFirSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: fir, error: firError } = await supabase
      .from("fir_records")
      .insert({
        case_number: data.caseNumber,
        district: data.district,
        incident_date: data.incidentDate || null,
        incident_type: data.incidentType,
        raw_narrative: data.narrative,
        officer_id: userId,
      })
      .select("id")
      .single();

    if (firError) throw new Error(`Failed to create FIR: ${firError.message}`);

    const { data: job, error: jobError } = await supabase
      .from("fir_jobs")
      .insert({
        fir_id: fir.id,
        officer_id: userId,
        status: "pending",
        pipeline_progress: {},
      })
      .select("id")
      .single();

    if (jobError) throw new Error(`Failed to create job: ${jobError.message}`);

    return { firId: fir.id, jobId: job.id };
  });

export const getJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: job, error } = await supabase
      .from("fir_jobs")
      .select("*, fir_records(*)")
      .eq("id", data.jobId)
      .single();

    if (error) throw new Error(`Job not found: ${error.message}`);
    return job;
  });

export const getSceneData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [entitiesRes, eventsRes] = await Promise.all([
      supabase.from("scene_entities").select("*").eq("job_id", data.jobId),
      supabase.from("scene_events").select("*").eq("job_id", data.jobId).order("sequence_number"),
    ]);

    return {
      entities: entitiesRes.data || [],
      events: eventsRes.data || [],
    };
  });

export const getMyJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data, error } = await supabase
      .from("fir_jobs")
      .select("*, fir_records(case_number, district, incident_type)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return data || [];
  });

export const cancelJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("fir_jobs")
      .update({ status: "failed" as const, error_message: "Cancelled by officer" })
      .eq("id", data.jobId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const retryJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Reset job status
    const { error } = await supabase
      .from("fir_jobs")
      .update({
        status: "pending" as const,
        error_message: null,
        pipeline_progress: {},
        processing_time_ms: null,
        scene_manifest: null,
      })
      .eq("id", data.jobId);
    if (error) throw new Error(error.message);
    // Delete old scene data
    await supabase.from("scene_entities").delete().eq("job_id", data.jobId);
    await supabase.from("scene_events").delete().eq("job_id", data.jobId);
    return { success: true };
  });

export const runMockPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const jobId = data.jobId;
    const startTime = Date.now();

    const stages = [
      "preprocessing",
      "entity_extraction",
      "spatial_resolution",
      "timeline_sequencing",
      "scene_generation",
    ] as const;

    for (const stage of stages) {
      await supabase
        .from("fir_jobs")
        .update({
          status: stage,
          pipeline_progress: {
            current_stage: stage,
            stages_completed: stages.slice(0, stages.indexOf(stage)).map(s => s),
          },
        })
        .eq("id", jobId);

      // Simulate processing delay
      await new Promise((r) => setTimeout(r, 1800));
    }

    // Insert mock entities
    const mockEntities = [
      {
        job_id: jobId,
        entity_type: "actor" as const,
        entity_role: "suspect" as const,
        label: "Ahmed (Mulzim)",
        description: "Primary suspect, arrived on foot from north side",
        color: "#ef4444",
        confidence: 0.94,
        position_x: 0,
        position_y: 0,
        position_z: -8,
        source_text: "Mulzim Ahmed ne raat 11 baje Bazaar Road par",
      },
      {
        job_id: jobId,
        entity_type: "actor" as const,
        entity_role: "victim" as const,
        label: "Imran (Victim)",
        description: "Victim, found near Atta Flour Mill",
        color: "#3b82f6",
        confidence: 0.91,
        position_x: 4,
        position_y: 0,
        position_z: 2,
        source_text: "victim Imran ko loha rod se mara",
      },
      {
        job_id: jobId,
        entity_type: "actor" as const,
        entity_role: "witness" as const,
        label: "Rizwan (Gawah)",
        description: "Witness, observed from Pir Jo Goth Chowk",
        color: "#22c55e",
        confidence: 0.88,
        position_x: 8,
        position_y: 0,
        position_z: 6,
        source_text: "Gawah Rizwan ne Pir Jo Goth Chowk se dekha",
      },
      {
        job_id: jobId,
        entity_type: "vehicle" as const,
        entity_role: null,
        label: "White Suzuki Mehran",
        description: "Suspect's getaway vehicle",
        color: "#C9A84C",
        confidence: 0.72,
        position_x: -2,
        position_y: 0,
        position_z: 10,
        source_text: "safed Suzuki Mehran mein faraar ho gaya",
      },
      {
        job_id: jobId,
        entity_type: "location" as const,
        entity_role: null,
        label: "Bazaar Road Crossing",
        description: "Primary incident location",
        color: "#C9A84C",
        confidence: 0.97,
        position_x: 0,
        position_y: 0,
        position_z: 0,
        source_text: "Bazaar Road par",
      },
      {
        job_id: jobId,
        entity_type: "location" as const,
        entity_role: null,
        label: "Atta Flour Mill",
        description: "Secondary location",
        color: "#C9A84C",
        confidence: 0.85,
        position_x: 4,
        position_y: 0,
        position_z: 2,
        source_text: "Atta Flour Mill ke paas",
      },
    ];

    const { data: insertedEntities, error: entErr } = await supabase
      .from("scene_entities")
      .insert(mockEntities)
      .select("id, label");

    if (entErr) {
      await supabase.from("fir_jobs").update({ status: "failed", error_message: entErr.message }).eq("id", jobId);
      throw new Error(entErr.message);
    }

    const entityMap = new Map((insertedEntities || []).map(e => [e.label, e.id]));

    // Insert mock events
    const mockEvents = [
      {
        job_id: jobId,
        sequence_number: 1,
        entity_id: entityMap.get("Ahmed (Mulzim)") || null,
        action_label: "Arrival",
        description: "Mulzim Ahmed arrives at Bazaar Road on foot from the north side at approximately 23:00.",
        origin_x: 0, origin_y: 0, origin_z: -8,
        dest_x: 0, dest_y: 0, dest_z: -4,
        duration_seconds: 3,
        source_text: "Ahmed raat 11 baje Bazaar Road par paidal aaya",
      },
      {
        job_id: jobId,
        sequence_number: 2,
        entity_id: entityMap.get("Imran (Victim)") || null,
        action_label: "Present at scene",
        description: "Victim Imran is seen walking near Atta Flour Mill carrying a bag.",
        origin_x: 4, origin_y: 0, origin_z: 2,
        dest_x: 3, dest_y: 0, dest_z: 1,
        duration_seconds: 2,
        source_text: "Imran Atta Flour Mill ke paas bag le kar chal raha tha",
      },
      {
        job_id: jobId,
        sequence_number: 3,
        entity_id: entityMap.get("Ahmed (Mulzim)") || null,
        action_label: "Confrontation",
        description: "Ahmed confronts Imran near the Bazaar Road crossing.",
        origin_x: 0, origin_y: 0, origin_z: -4,
        dest_x: 1, dest_y: 0, dest_z: 0,
        duration_seconds: 2,
        source_text: "Ahmed ne Imran ko Bazaar Road crossing par roka",
      },
      {
        job_id: jobId,
        sequence_number: 4,
        entity_id: entityMap.get("Ahmed (Mulzim)") || null,
        action_label: "Assault",
        description: "Ahmed strikes Imran with a loha rod. Imran falls to the ground.",
        origin_x: 1, origin_y: 0, origin_z: 0,
        dest_x: 1, dest_y: 0, dest_z: 0,
        duration_seconds: 2,
        source_text: "Ahmed ne Imran ko loha rod se mara, Imran gir gaya",
      },
      {
        job_id: jobId,
        sequence_number: 5,
        entity_id: entityMap.get("Rizwan (Gawah)") || null,
        action_label: "Witness observation",
        description: "Witness Rizwan observes the incident from Pir Jo Goth Chowk.",
        origin_x: 8, origin_y: 0, origin_z: 6,
        dest_x: 7, dest_y: 0, dest_z: 4,
        duration_seconds: 2,
        source_text: "Gawah Rizwan ne Pir Jo Goth Chowk se dekha",
      },
      {
        job_id: jobId,
        sequence_number: 6,
        entity_id: entityMap.get("Ahmed (Mulzim)") || null,
        action_label: "Escape",
        description: "Ahmed flees the scene in a white Suzuki Mehran heading south.",
        origin_x: 1, origin_y: 0, origin_z: 0,
        dest_x: -2, dest_y: 0, dest_z: 10,
        duration_seconds: 3,
        source_text: "Ahmed safed Suzuki Mehran mein faraar ho gaya",
      },
    ];

    const { error: evtErr } = await supabase.from("scene_events").insert(mockEvents);

    if (evtErr) {
      await supabase.from("fir_jobs").update({ status: "failed", error_message: evtErr.message }).eq("id", jobId);
      throw new Error(evtErr.message);
    }

    const processingTime = Date.now() - startTime;

    await supabase
      .from("fir_jobs")
      .update({
        status: "completed",
        processing_time_ms: processingTime,
        scene_manifest: {
          entity_count: mockEntities.length,
          event_count: mockEvents.length,
          model: "mock-pipeline-v1",
        },
        pipeline_progress: {
          current_stage: "completed",
          stages_completed: [...stages],
        },
      })
      .eq("id", jobId);

    return { success: true, processingTime };
  });
