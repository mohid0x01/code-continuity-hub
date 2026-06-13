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

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("audit_logs" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      actor_email: string | null;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      metadata: Record<string, unknown>;
      created_at: string;
    }>;
  });