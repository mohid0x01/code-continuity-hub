import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Trash2, Image as ImageIcon, Mic, FileText, Loader, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listEvidence,
  registerEvidence,
  deleteEvidence,
  getEvidenceSignedUrl,
  type EvidenceRow,
} from "@/lib/evidence.functions";
import { logAuditEvent } from "@/lib/audit.functions";

function detectType(file: File): "photo" | "audio" | "video" | "document" {
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

export function EvidenceManager({ firId }: { firId: string }) {
  const [items, setItems] = useState<EvidenceRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const listFn = useServerFn(listEvidence);
  const registerFn = useServerFn(registerEvidence);
  const deleteFn = useServerFn(deleteEvidence);
  const signedFn = useServerFn(getEvidenceSignedUrl);
  const logFn = useServerFn(logAuditEvent);

  const refresh = useCallback(async () => {
    try { setItems(await listFn({ data: { firId } })); }
    catch (e) { console.error(e); }
  }, [firId, listFn]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 25MB limit`); continue;
        }
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${firId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("evidence").upload(path, file, {
          cacheControl: "3600", upsert: false, contentType: file.type,
        });
        if (error) { toast.error(`Upload failed: ${error.message}`); continue; }
        await registerFn({
          data: {
            firId, storagePath: path, fileName: file.name, fileType: detectType(file),
            mimeType: file.type, fileSize: file.size,
          },
        });
        await logFn({ data: { action: "evidence.upload", entityType: "fir_record", entityId: firId, metadata: { fileName: file.name, size: file.size } } }).catch(() => {});
      }
      toast.success("Evidence uploaded");
      await refresh();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleOpen = async (item: EvidenceRow) => {
    try {
      const { url } = await signedFn({ data: { storagePath: item.storage_path } });
      window.open(url, "_blank");
    } catch (e) { toast.error("Could not generate link"); }
  };

  const handleDelete = async (item: EvidenceRow) => {
    if (!confirm(`Delete ${item.file_name}?`)) return;
    try {
      await deleteFn({ data: { id: item.id, storagePath: item.storage_path } });
      await logFn({ data: { action: "evidence.delete", entityType: "fir_record", entityId: firId, metadata: { fileName: item.file_name } } }).catch(() => {});
      toast.success("Deleted");
      await refresh();
    } catch (e) { toast.error("Delete failed"); }
  };

  const iconFor = (t: string) => {
    if (t === "photo") return <ImageIcon className="h-4 w-4 text-emerald-400" />;
    if (t === "audio") return <Mic className="h-4 w-4 text-blue-400" />;
    return <FileText className="h-4 w-4 text-text-secondary" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-text-secondary">Evidence ({items.length})</h3>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[6px] border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-400 hover:bg-emerald-500/20">
          {uploading ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload
          <input type="file" multiple accept="image/*,audio/*,video/*,.pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {items.length === 0 ? (
        <p className="rounded-[6px] border border-dashed border-border-subtle p-6 text-center text-xs text-text-muted">
          No evidence uploaded yet. Drop photos, audio recordings, or PDFs here.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 rounded-[6px] border border-border-subtle bg-card p-3">
              {iconFor(it.file_type)}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-text-primary">{it.file_name}</div>
                <div className="font-mono text-[11px] text-text-muted">
                  {it.file_type} · {it.file_size ? (it.file_size / 1024).toFixed(1) + " KB" : "—"} · {new Date(it.created_at).toLocaleString()}
                </div>
              </div>
              <button onClick={() => handleOpen(it)} className="rounded-[4px] p-1.5 text-text-muted hover:text-gold" title="Open"><Download className="h-4 w-4" /></button>
              <button onClick={() => handleDelete(it)} className="rounded-[4px] p-1.5 text-text-muted hover:text-red-400" title="Delete"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}