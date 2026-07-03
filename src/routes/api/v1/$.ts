import { createFileRoute } from "@tanstack/react-router";

/**
 * Friendly /api/v1/* alias layer. Hides the upstream database URL behind
 * named endpoints. Maps each endpoint to an upstream Supabase REST path
 * and forwards the caller's session bearer token (RLS enforced).
 *
 * GET/POST/OPTIONS all supported with permissive CORS for the same origin.
 */

const ROUTES: Record<string, string> = {
  "new":         "rest/v1/fir_records",
  "submit":      "rest/v1/fir_records",
  "db":          "rest/v1/fir_jobs?select=*,fir_records(case_number,city,area,incident_type)&order=created_at.desc&limit=50",
  "dashboard":   "rest/v1/fir_jobs?select=id,status,created_at,fir_records(case_number,incident_type)&order=created_at.desc&limit=20",
  "profile":     "rest/v1/user_roles?select=*",
  "livechecker": "rest/v1/fir_jobs?select=id,status,updated_at&order=updated_at.desc&limit=10",
  "view":        "rest/v1/fir_jobs?select=*,fir_records(*)",
  "settings":    "rest/v1/user_roles?select=*",
  "recent":      "rest/v1/fir_records?select=id,case_number,city,area,incident_type,created_at&order=created_at.desc&limit=10",
  "signout":     "auth/v1/logout",
};

// Sentinel handled without upstream fetch.
const HEALTH_KEY = "health";

function getUpstream(): string {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL not configured");
  return url.replace(/\/+$/, "");
}

function cors(headers = new Headers()): Headers {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "authorization,content-type,apikey,prefer,x-client-info");
  return headers;
}

async function handle(request: Request, splat: string): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }

  const segment = splat.replace(/^\/+/, "").split("/")[0] ?? "";

  if (segment === HEALTH_KEY) {
    const started = Date.now();
    let upstreamOk = false;
    let upstreamMs: number | null = null;
    let upstreamStatus: number | null = null;
    try {
      const base = getUpstream();
      const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
      const t0 = Date.now();
      const r = await fetch(`${base}/rest/v1/`, { headers: { apikey: key } });
      upstreamMs = Date.now() - t0;
      upstreamStatus = r.status;
      upstreamOk = r.ok || r.status === 404; // PostgREST root often 404s but proves reachability
    } catch {
      upstreamOk = false;
    }
    const body = {
      ok: upstreamOk,
      service: "sceneiq-api",
      version: "v1",
      ssr: true,
      upstream: { ok: upstreamOk, status: upstreamStatus, latency_ms: upstreamMs },
      total_ms: Date.now() - started,
      timestamp: new Date().toISOString(),
    };
    const h = cors(new Headers({ "content-type": "application/json", "cache-control": "no-store" }));
    return new Response(JSON.stringify(body), { status: upstreamOk ? 200 : 503, headers: h });
  }

  const mapped = ROUTES[segment];
  if (!mapped) return new Response(JSON.stringify({ error: "Unknown endpoint" }), { status: 404, headers: cors(new Headers({ "content-type": "application/json" })) });

  const upstreamBase = getUpstream();
  const incomingSearch = new URL(request.url).search.replace(/^\?/, "");
  const joiner = mapped.includes("?") ? "&" : "?";
  const upstream = `${upstreamBase}/${mapped}${incomingSearch ? joiner + incomingSearch : ""}`;

  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  const headers = new Headers();
  for (const h of ["authorization", "content-type", "accept", "prefer", "x-client-info"]) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (publishable) {
    headers.set("apikey", publishable);
    if (!headers.has("authorization")) headers.set("authorization", `Bearer ${publishable}`);
  }
  if (!headers.has("content-type") && (request.method === "POST" || request.method === "PATCH")) {
    headers.set("content-type", "application/json");
  }

  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.arrayBuffer();

  const res = await fetch(upstream, { method: request.method, headers, body });
  const outHeaders = cors(new Headers(res.headers));
  outHeaders.delete("set-cookie");
  return new Response(res.body, { status: res.status, headers: outHeaders });
}

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => handle(request, params._splat ?? ""),
      POST: ({ request, params }) => handle(request, params._splat ?? ""),
      PUT: ({ request, params }) => handle(request, params._splat ?? ""),
      PATCH: ({ request, params }) => handle(request, params._splat ?? ""),
      DELETE: ({ request, params }) => handle(request, params._splat ?? ""),
      OPTIONS: ({ request, params }) => handle(request, params._splat ?? ""),
    },
  },
});