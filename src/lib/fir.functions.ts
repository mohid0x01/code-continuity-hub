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
    await supabase.from("scene_entities").delete().eq("job_id", data.jobId);
    await supabase.from("scene_events").delete().eq("job_id", data.jobId);
    return { success: true };
  });

// ============================================================
// REAL AI PIPELINE — powered by Lovable AI Gateway
// ============================================================

const ROLE_COLORS: Record<string, string> = {
  suspect: "#ef4444",
  victim: "#3b82f6",
  witness: "#22c55e",
  bystander: "#a855f7",
};
const TYPE_COLORS: Record<string, string> = {
  vehicle: "#C9A84C",
  location: "#C9A84C",
  object: "#94a3b8",
};

const sceneSchema = {
  type: "object",
  properties: {
    entities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["actor", "vehicle", "location", "object"] },
          entity_role: { type: "string", enum: ["suspect", "victim", "witness", "bystander", "none"] },
          label: { type: "string" },
          description: { type: "string" },
          confidence: { type: "number" },
          position_x: { type: "number" },
          position_y: { type: "number" },
          position_z: { type: "number" },
          source_text: { type: "string" },
        },
        required: ["entity_type", "label", "description", "confidence", "position_x", "position_z", "source_text"],
        additionalProperties: false,
      },
    },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sequence_number: { type: "integer" },
          entity_label: { type: "string" },
          action_label: { type: "string" },
          description: { type: "string" },
          origin_x: { type: "number" },
          origin_y: { type: "number" },
          origin_z: { type: "number" },
          dest_x: { type: "number" },
          dest_y: { type: "number" },
          dest_z: { type: "number" },
          duration_seconds: { type: "number" },
          source_text: { type: "string" },
        },
        required: ["sequence_number", "entity_label", "action_label", "description", "origin_x", "origin_z", "dest_x", "dest_z", "source_text"],
        additionalProperties: false,
      },
    },
  },
  required: ["entities", "events"],
  additionalProperties: false,
};

// Provider fallback chain. If the primary model fails (rate-limit / credits /
// timeout / 5xx / malformed output), we transparently try the next model so
// the pipeline stays uninterrupted.
const MODEL_CHAIN = [
  "google/gemini-2.5-flash",
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5-mini",
] as const;

type AttemptLog = { model: string; ok: boolean; error?: string; ms: number };

// ============================================================
// Zod schemas — validate & normalize LLM output
// ============================================================
const entitySchema = z.object({
  entity_type: z.enum(["actor", "vehicle", "location", "object"]),
  entity_role: z.string().optional().nullable(),
  label: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
  position_x: z.coerce.number().finite().default(0),
  position_y: z.coerce.number().finite().default(0),
  position_z: z.coerce.number().finite().default(0),
  source_text: z.string().max(2000).default(""),
});

const eventSchema = z.object({
  sequence_number: z.coerce.number().int().min(1),
  entity_label: z.string().min(1).max(200),
  action_label: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  origin_x: z.coerce.number().finite().default(0),
  origin_y: z.coerce.number().finite().default(0),
  origin_z: z.coerce.number().finite().default(0),
  dest_x: z.coerce.number().finite().default(0),
  dest_y: z.coerce.number().finite().default(0),
  dest_z: z.coerce.number().finite().default(0),
  duration_seconds: z.coerce.number().min(0.1).max(60).default(2),
  source_text: z.string().max(2000).default(""),
});

const sceneOutputSchema = z.object({
  entities: z.array(entitySchema).min(1, "AI returned no entities"),
  events: z.array(eventSchema).default([]),
});

export type NormalizedScene = z.infer<typeof sceneOutputSchema>;

function normalizeScene(raw: unknown): NormalizedScene {
  const parsed = sceneOutputSchema.parse(raw);
  // Drop events that reference a non-existent entity label.
  const labels = new Set(parsed.entities.map((e) => e.label));
  parsed.events = parsed.events.filter((ev) => labels.has(ev.entity_label));
  return parsed;
}

async function callLLMWithModel(model: string, narrative: string, incidentType: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const systemPrompt = `You are SceneIQ, an expert forensic scene reconstruction assistant for Pakistani police FIRs.
Analyze the FIR narrative (which may be in English, Urdu, Roman Urdu, or Sindhi) and extract:
1. ENTITIES (actors, vehicles, locations, objects) with roles (suspect/victim/witness/bystander where applicable)
2. EVENTS (timeline of actions) in chronological order

For each entity assign reasonable 3D positions on a scene grid (units = meters, y=0 is ground level):
- Use the primary incident location as origin (0,0,0)
- Spread actors/vehicles in a logical layout (-15..15 on x and z axis)
- Confidence between 0 and 1 based on how clearly mentioned

For each event:
- sequence_number starts at 1 and increases by 1
- entity_label MUST exactly match an entity label above
- origin / dest coordinates show movement (same coords if stationary)
- duration_seconds 1-5

Return ONLY valid JSON matching the schema. No prose, no markdown.`;

  const userPrompt = `Incident type: ${incidentType}\n\nFIR narrative:\n"""${narrative}"""\n\nExtract entities and events.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "emit_scene",
            description: "Emit the reconstructed scene entities and events",
            parameters: sceneSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_scene" } },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`AI gateway error ${res.status}: ${text.slice(0, 200)}`) as Error & {
      status?: number;
      retryable?: boolean;
    };
    err.status = res.status;
    // 429 (rate limit), 408 (timeout), 5xx → try next model. 402 (credits) → also try next.
    err.retryable = res.status === 429 || res.status === 408 || res.status === 402 || res.status >= 500;
    throw err;
  }

  const json = await res.json();
  const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    const err = new Error("AI returned no structured output") as Error & { retryable?: boolean };
    err.retryable = true;
    throw err;
  }

  const parsed = JSON.parse(toolCall.function.arguments) as {
    entities: Array<{
      entity_type: "actor" | "vehicle" | "location" | "object";
      entity_role?: string;
      label: string;
      description: string;
      confidence: number;
      position_x: number;
      position_y?: number;
      position_z: number;
      source_text: string;
    }>;
    events: Array<{
      sequence_number: number;
      entity_label: string;
      action_label: string;
      description: string;
      origin_x: number;
      origin_y?: number;
      origin_z: number;
      dest_x: number;
      dest_y?: number;
      dest_z: number;
      duration_seconds?: number;
      source_text: string;
    }>;
  };

  // Schema-validate & normalize. Throw a retryable error if the LLM produced
  // garbage so the fallback chain can try the next model.
  try {
    return normalizeScene(parsed);
  } catch (e) {
    const err = new Error(
      `AI output failed schema validation: ${e instanceof Error ? e.message : String(e)}`,
    ) as Error & { retryable?: boolean };
    err.retryable = true;
    throw err;
  }
}

async function callLLM(
  narrative: string,
  incidentType: string,
  onAttempt?: (a: AttemptLog) => Promise<void> | void,
) {
  const attempts: AttemptLog[] = [];
  let lastErr: Error | null = null;

  for (const model of MODEL_CHAIN) {
    const start = Date.now();
    try {
      const result = await callLLMWithModel(model, narrative, incidentType);
      if (!result.entities?.length) {
        const err = new Error("AI returned empty entity list") as Error & { retryable?: boolean };
        err.retryable = true;
        throw err;
      }
      const log: AttemptLog = { model, ok: true, ms: Date.now() - start };
      attempts.push(log);
      await onAttempt?.(log);
      return { result, model, attempts };
    } catch (err) {
      const e = err as Error & { retryable?: boolean; status?: number };
      const log: AttemptLog = { model, ok: false, error: e.message, ms: Date.now() - start };
      attempts.push(log);
      await onAttempt?.(log);
      lastErr = e;
      // Non-retryable (e.g. 400 bad request, auth) → stop trying.
      if (e.retryable === false) break;
    }
  }

  const msg = lastErr?.message || "AI pipeline failed across all providers";
  const final = new Error(`All AI providers failed. Last error: ${msg}`);
  (final as Error & { attempts?: AttemptLog[] }).attempts = attempts;
  throw final;
}

export const runMockPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const jobId = data.jobId;
    const startTime = Date.now();

    const stageTimes: Record<string, number> = {};
    const attemptsAll: AttemptLog[] = [];

    const setStage = async (
      stage: string,
      done: string[],
      extra: Record<string, unknown> = {},
    ) => {
      stageTimes[stage] = Date.now();
      await supabase
        .from("fir_jobs")
        .update({
          status: stage as never,
          pipeline_progress: {
            current_stage: stage,
            stages_completed: done,
            stage_started_at: new Date().toISOString(),
            attempts: attemptsAll,
            ...extra,
          },
        })
        .eq("id", jobId);
    };

    try {
      // Stage 1: preprocessing — load narrative
      await setStage("preprocessing", []);
      const { data: job, error: jobErr } = await supabase
        .from("fir_jobs")
        .select("fir_id, fir_records(raw_narrative, incident_type)")
        .eq("id", jobId)
        .single();
      if (jobErr || !job) throw new Error(`Could not load job: ${jobErr?.message}`);
      const fir = (job as { fir_records: { raw_narrative: string; incident_type: string } | null }).fir_records;
      if (!fir) throw new Error("FIR record missing");

      // Stage 2: entity extraction — actual LLM call
      await setStage("entity_extraction", ["preprocessing"]);
      const { result: scene, model: usedModel } = await callLLM(
        fir.raw_narrative,
        fir.incident_type,
        async (attempt) => {
          attemptsAll.push(attempt);
          // Live-publish attempt list so UI can show which providers were tried.
          await supabase
            .from("fir_jobs")
            .update({
              llm_model: attempt.model,
              pipeline_progress: {
                current_stage: "entity_extraction",
                stages_completed: ["preprocessing"],
                attempts: attemptsAll,
                stage_started_at: new Date().toISOString(),
              },
            })
            .eq("id", jobId);
        },
      );

      if (!scene.entities?.length) {
        throw new Error("AI extracted no entities from the narrative");
      }

      // Stage 3: spatial resolution — persist entities
      await setStage("spatial_resolution", ["preprocessing", "entity_extraction"]);

      const entityRows = scene.entities.map((e) => {
        const role = e.entity_role && e.entity_role !== "none" ? e.entity_role : null;
        const color = role ? ROLE_COLORS[role] : TYPE_COLORS[e.entity_type] || "#64748b";
        return {
          job_id: jobId,
          entity_type: e.entity_type,
          entity_role: role as "suspect" | "victim" | "witness" | "bystander" | null,
          label: e.label,
          description: e.description,
          color,
          confidence: Math.max(0, Math.min(1, e.confidence)),
          position_x: e.position_x,
          position_y: e.position_y ?? 0,
          position_z: e.position_z,
          source_text: e.source_text,
        };
      });

      const { data: insertedEntities, error: entErr } = await supabase
        .from("scene_entities")
        .insert(entityRows)
        .select("id, label");
      if (entErr) throw new Error(`Failed to save entities: ${entErr.message}`);

      const entityMap = new Map((insertedEntities || []).map((e) => [e.label, e.id]));

      // Stage 4: timeline sequencing — persist events
      await setStage("timeline_sequencing", ["preprocessing", "entity_extraction", "spatial_resolution"]);

      const eventRows = (scene.events || [])
        .sort((a, b) => a.sequence_number - b.sequence_number)
        .map((ev, idx) => ({
          job_id: jobId,
          sequence_number: idx + 1,
          entity_id: entityMap.get(ev.entity_label) || null,
          action_label: ev.action_label,
          description: ev.description,
          origin_x: ev.origin_x,
          origin_y: ev.origin_y ?? 0,
          origin_z: ev.origin_z,
          dest_x: ev.dest_x,
          dest_y: ev.dest_y ?? 0,
          dest_z: ev.dest_z,
          duration_seconds: ev.duration_seconds ?? 2,
          source_text: ev.source_text,
        }));

      if (eventRows.length) {
        const { error: evtErr } = await supabase.from("scene_events").insert(eventRows);
        if (evtErr) throw new Error(`Failed to save events: ${evtErr.message}`);
      }

      // Stage 5: scene generation
      await setStage("scene_generation", [
        "preprocessing",
        "entity_extraction",
        "spatial_resolution",
        "timeline_sequencing",
      ]);

      const processingTime = Date.now() - startTime;

      await supabase
        .from("fir_jobs")
        .update({
          status: "completed",
          processing_time_ms: processingTime,
          llm_model: usedModel,
          scene_manifest: {
            entity_count: entityRows.length,
            event_count: eventRows.length,
            model: usedModel,
            attempts: attemptsAll,
          },
          pipeline_progress: {
            current_stage: "completed",
            stages_completed: [
              "preprocessing",
              "entity_extraction",
              "spatial_resolution",
              "timeline_sequencing",
              "scene_generation",
            ],
            attempts: attemptsAll,
            stage_times: stageTimes,
          },
        })
        .eq("id", jobId);

      return { success: true, processingTime };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase
        .from("fir_jobs")
        .update({
          status: "failed",
          error_message: msg,
          pipeline_progress: {
            current_stage: "failed",
            attempts: attemptsAll,
            stage_times: stageTimes,
            failed_at: new Date().toISOString(),
          },
        })
        .eq("id", jobId);
      throw new Error(msg);
    }
  });

// Alias with a cleaner name; UI can migrate over time.
export const runPipeline = runMockPipeline;
