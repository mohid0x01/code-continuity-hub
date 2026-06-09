import { createFileRoute } from "@tanstack/react-router";

// Generic Supabase REST/Storage proxy.
// Lets the browser call `/api/proxy/rest/v1/...` (or `/storage/v1/...`)
// without ever seeing the real Supabase project URL.
//
// The browser passes its own user session bearer token in `Authorization`
// (or the publishable key as `apikey`), and this route forwards the request
// to the upstream Supabase host. RLS is enforced exactly as if the browser
// had called Supabase directly.
//
// This does NOT proxy realtime websockets — those still go direct.

const ALLOWED_PREFIXES = ["rest/v1/", "storage/v1/", "functions/v1/"] as const;

function getUpstreamBase(): string {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL not configured");
  return url.replace(/\/+$/, "");
}

async function handle(request: Request, splat: string): Promise<Response> {
  const path = splat.replace(/^\/+/, "");
  if (!ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
    return new Response("Forbidden path", { status: 403 });
  }

  const upstream = `${getUpstreamBase()}/${path}${new URL(request.url).search}`;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

  // Forward a minimal, safe set of headers.
  const headers = new Headers();
  const copy = ["authorization", "content-type", "accept", "prefer", "range", "x-client-info"];
  for (const h of copy) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Ensure apikey is always present (Supabase requires it).
  if (!headers.has("apikey") && publishableKey) headers.set("apikey", publishableKey);
  if (!headers.has("authorization") && publishableKey) {
    headers.set("authorization", `Bearer ${publishableKey}`);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
  };

  const res = await fetch(upstream, init);
  // Strip upstream cookies / sensitive headers.
  const outHeaders = new Headers(res.headers);
  outHeaders.delete("set-cookie");
  return new Response(res.body, { status: res.status, headers: outHeaders });
}

export const Route = createFileRoute("/api/proxy/$")({
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