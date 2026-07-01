import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const logSchema = z.object({
  action: z.string().min(1).max(100),
  entityType: z.string().max(50).optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export const logAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof logSchema>) => logSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await supabase.from("audit_logs" as never).insert({
      actor_id: userId,
      actor_email: (claims as { email?: string })?.email ?? null,
      action: data.action,
      entity_type: data.entityType ?? null,
      entity_id: data.entityId ?? null,
      metadata: data.metadata ?? {},
    } as never);
    return { ok: true };
  });

export type AuditLogRow = {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: string;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
};

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditLogRow[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("audit_logs" as never)
      .select("id, actor_email, action, entity_type, entity_id, metadata, created_at, ip_address, user_agent")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      actor_email: (r.actor_email as string | null) ?? null,
      action: String(r.action),
      entity_type: (r.entity_type as string | null) ?? null,
      entity_id: (r.entity_id as string | null) ?? null,
      metadata: JSON.stringify(r.metadata ?? {}),
      created_at: String(r.created_at),
      ip_address: (r.ip_address as string | null) ?? null,
      user_agent: (r.user_agent as string | null) ?? null,
    }));
  });