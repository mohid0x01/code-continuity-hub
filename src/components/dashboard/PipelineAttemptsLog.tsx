import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Clock } from "lucide-react";

interface Attempt {
  id: string;
  stage: string;
  model: string;
  attempt_number: number;
  ok: boolean;
  status_code: number | null;
  error_message: string | null;
  latency_ms: number | null;
  created_at: string;
}

export function PipelineAttemptsLog({ jobId }: { jobId: string | null }) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) { setAttempts([]); return; }
    setLoading(true);
    supabase.from("pipeline_attempts" as never)
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setAttempts((data as unknown as Attempt[]) || []);
        setLoading(false);
      });
    const ch = supabase
      .channel(`attempts-${jobId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pipeline_attempts", filter: `job_id=eq.${jobId}` },
        (p) => setAttempts((prev) => [...prev, p.new as Attempt]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [jobId]);

  if (!jobId) {
    return <p className="text-xs text-text-muted">Select a case to view its pipeline attempts.</p>;
  }
  if (loading) return <p className="text-xs text-text-muted">Loading attempts…</p>;
  if (attempts.length === 0) return <p className="text-xs text-text-muted">No attempts logged for this case.</p>;

  return (
    <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
      {attempts.map((a) => (
        <div key={a.id} className={`flex items-center gap-3 rounded-[4px] border p-2.5 text-[12px] ${
          a.ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-destructive/20 bg-destructive/5"
        }`}>
          {a.ok ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-gold">{a.stage}</span>
              <span className="text-text-muted">·</span>
              <span className="text-text-secondary truncate">{a.model}</span>
              <span className="text-text-muted">#{a.attempt_number}</span>
            </div>
            {a.error_message && (
              <div className="mt-0.5 text-[11px] text-destructive truncate" title={a.error_message}>{a.error_message}</div>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-text-muted shrink-0">
            <Clock className="h-3 w-3" />{a.latency_ms ?? "—"}ms
          </div>
        </div>
      ))}
    </div>
  );
}
