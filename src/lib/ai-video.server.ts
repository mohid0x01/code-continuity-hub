// Server-only: Lovable AI Gateway video jobs (Veo) for FIR re-enactments.
const BASE = "https://ai.gateway.lovable.dev";
export const AI_VIDEO_MODEL = "google/veo-3.1-fast";

export type VideoJob = {
  id: string;
  status: "queued" | "in_progress" | "completed" | "failed";
  progress?: number;
  error?: { code: string; message: string };
};

export class VideoGatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function key() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new VideoGatewayError(401, "AI key is not configured");
  return k;
}

async function jobResponse(res: Response): Promise<VideoJob> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null;
    throw new VideoGatewayError(res.status, body?.message ?? body?.error?.message ?? `Video request failed: ${res.status}`);
  }
  return res.json() as Promise<VideoJob>;
}

export async function createVeoJob(prompt: string, negativePrompt: string) {
  return jobResponse(
    await fetch(`${BASE}/v1/videos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_VIDEO_MODEL,
        instances: [{ prompt }],
        parameters: {
          durationSeconds: 8,
          resolution: "720p",
          sampleCount: 1,
          generateAudio: true,
          aspectRatio: "16:9",
          negativePrompt,
          personGeneration: "allow_adult",
        },
      }),
    }),
  );
}

export async function pollVeoJob(id: string) {
  return jobResponse(
    await fetch(`${BASE}/v1/videos/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${key()}` },
    }),
  );
}

export async function downloadVeoJob(id: string): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE}/v1/videos/${encodeURIComponent(id)}/content`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  if (!res.ok) throw new Error(`Video download failed: ${res.status}`);
  return res.arrayBuffer();
}

type Ent = { label: string; entity_type: string; entity_role: string | null; description: string | null };
type Evt = { sequence_number: number; action_label: string; description: string };

/** Build one-scene cinematic prompt from the FIR's real location + extracted entities/events. */
export function buildReenactmentPrompt(input: {
  incidentType: string;
  address: string;
  city: string;
  area: string;
  incidentDate: string | null;
  entities: Ent[];
  events: Evt[];
}) {
  const actors = input.entities
    .filter((e) => e.entity_type === "actor")
    .slice(0, 5)
    .map((e) => `${e.label}${e.entity_role ? ` (${e.entity_role})` : ""}${e.description ? `: ${e.description.slice(0, 120)}` : ""}`);
  const vehicles = input.entities
    .filter((e) => e.entity_type === "vehicle")
    .slice(0, 3)
    .map((e) => `${e.label}${e.description ? ` — ${e.description.slice(0, 80)}` : ""}`);
  const beats = input.events
    .sort((a, b) => a.sequence_number - b.sequence_number)
    .slice(0, 6)
    .map((e, i) => `${i + 1}) ${e.action_label}: ${e.description.slice(0, 160)}`);

  return [
    `Photorealistic forensic police re-enactment video, single continuous shot, filmed like real CCTV/handheld street footage.`,
    `Location: ${input.address} — ${input.area}, ${input.city}, Pakistan. Authentic Pakistani street: real shop fronts with Urdu/English signboards, concrete buildings, electric poles and wires, rickshaws and motorcycles parked, dusty road, natural daylight unless the narrative says night.`,
    `Incident type: ${input.incidentType}.`,
    actors.length ? `People: ${actors.join("; ")}. Pakistani adults in shalwar kameez or local everyday clothing.` : "",
    vehicles.length ? `Vehicles: ${vehicles.join("; ")}.` : "",
    beats.length ? `Sequence of actions in order: ${beats.join(" ")}` : "",
    `Show the actions clearly and factually as a neutral reconstruction, no gore, slow steady camera tracking the main suspect and victim. Audio: ambient street noise, distant traffic. No music.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const REENACTMENT_NEGATIVE = "blood, gore, text overlays, captions, watermark, cartoon, anime, low quality, distorted faces";
