import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type EvidenceRow = {
  id: string;
  fir_id: string;
  storage_path: string;
  file_name: string;
  file_type: string;
  mime_type: string | null;
  file_size: number | null;
  description: string | null;
  created_at: string;
};

export const listEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { firId: string }) => z.object({ firId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<EvidenceRow[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("evidence_files" as never)
      .select("*")
      .eq("fir_id", data.firId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as EvidenceRow[];
  });

const registerSchema = z.object({
  firId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  fileType: z.enum(["photo", "audio", "video", "document"]),
  mimeType: z.string().max(100).optional(),
  fileSize: z.number().int().nonnegative().optional(),
  description: z.string().max(1000).optional(),
});

export const registerEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof registerSchema>) => registerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("evidence_files" as never)
      .insert({
        fir_id: data.firId,
        uploaded_by: userId,
        storage_path: data.storagePath,
        file_name: data.fileName,
        file_type: data.fileType,
        mime_type: data.mimeType ?? null,
        file_size: data.fileSize ?? null,
        description: data.description ?? null,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; storagePath: string }) =>
    z.object({ id: z.string().uuid(), storagePath: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.storage.from("evidence").remove([data.storagePath]);
    const { error } = await supabase.from("evidence_files" as never).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getEvidenceSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { storagePath: string }) =>
    z.object({ storagePath: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase.storage
      .from("evidence")
      .createSignedUrl(data.storagePath, 3600);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });