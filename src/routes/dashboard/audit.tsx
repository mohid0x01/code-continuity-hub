import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLogs, type AuditLogRow } from "@/lib/audit.functions";
import { Shield, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/dashboard/audit")({
  component: AuditPage,
});

function AuditPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const fn = useServerFn(listAuditLogs);

  const load = async () => {
    setLoading(true);
    try { setRows(await fn({})); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary flex items-center gap-3">
            <Shield className="h-7 w-7 text-emerald-400" /> Audit Log
          </h1>
          <p className="mt-1 text-sm text-text-secondary">Immutable trail of every SuperAdmin action.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-[6px] border border-border-accent px-3 py-2 text-xs uppercase tracking-[0.1em] text-text-secondary hover:text-gold">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      <div className="gold-divider mt-2" style={{ width: "60px" }} />

      <div className="mt-6 overflow-hidden rounded-[6px] border border-border-subtle bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface text-[11px] uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3 text-left">Timestamp</th>
              <th className="px-4 py-3 text-left">Actor</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Entity</th>
              <th className="px-4 py-3 text-left">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr><td colSpan={5} className="p-6 text-center text-xs text-text-muted">No audit events recorded yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border-subtle hover:bg-surface/40">
                <td className="px-4 py-3 font-mono text-[11px] text-text-muted">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-text-secondary">{r.actor_email ?? "—"}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">{r.action}</span></td>
                <td className="px-4 py-3 font-mono text-[11px] text-text-muted">{r.entity_type ?? "—"}{r.entity_id ? `:${r.entity_id.slice(0, 8)}` : ""}</td>
                <td className="px-4 py-3 font-mono text-[10px] text-text-muted truncate max-w-xs">{r.metadata}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}