import { createFileRoute } from "@tanstack/react-router";

/**
 * Public visitor beacon. Called from __root on every route change.
 * Logs IP, user-agent, path, referer into audit_logs so SuperAdmin can
 * see all traffic to the site.
 */
export const Route = createFileRoute("/api/public/visitor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { path?: string; referer?: string };
          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            request.headers.get("x-real-ip") ??
            null;
          const ua = request.headers.get("user-agent") ?? null;
          const referer =
            body.referer ?? request.headers.get("referer") ?? null;
          const path = body.path ?? null;

          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          await supabaseAdmin.from("audit_logs" as never).insert({
            action: "page_view",
            entity_type: "visitor",
            ip_address: ip,
            user_agent: ua,
            metadata: { path, referer },
          } as never);
          return new Response("ok");
        } catch {
          return new Response("ok");
        }
      },
    },
  },
});