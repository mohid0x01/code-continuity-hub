import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ADMIN_PRIVATE_KEY = "SceneIQ-Admin";

/** Verify the caller is a signed-in superadmin AND supplied the right private key. */
export const verifyAdminKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { privateKey: string }) =>
    z.object({ privateKey: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.privateKey !== ADMIN_PRIVATE_KEY) {
      throw new Error("Invalid private key");
    }
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "superadmin",
    });
    if (error) throw new Error(error.message);
    if (!isAdmin) throw new Error("Not authorized: superadmin role required");
    return { ok: true as const, userId: context.userId };
  });

/** Lightweight role check for the dashboard layout. */
export const getMyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const isSuperadmin = (data ?? []).some((r) => r.role === "superadmin");
    return { isSuperadmin, email: context.claims?.email as string | undefined };
  });