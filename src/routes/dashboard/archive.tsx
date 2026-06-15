import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, ArrowRight, FileX } from "lucide-react";
import { useJobsRealtime } from "@/hooks/useJobRealtime";

export const Route = createFileRoute("/dashboard/archive")({
  component: CaseArchive,
});

const statusStyles: Record<string, string> = {
  completed: "bg-gold/10 text-gold",
  pending: "bg-text-muted/10 text-text-muted",
  preprocessing: "bg-processing/20 text-blue-400",
  entity_extraction: "bg-processing/20 text-blue-400",
  spatial_resolution: "bg-processing/20 text-blue-400",
  timeline_sequencing: "bg-processing/20 text-blue-400",
  scene_generation: "bg-processing/20 text-blue-400",
  failed: "bg-destructive/10 text-destructive",
};

function CaseArchive() {
  const jobs = useJobsRealtime();
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("all");
  const [status, setStatus] = useState("all");

  const districts = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.fir_records?.district).filter(Boolean))) as string[],
    [jobs],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return jobs.filter((j) => {
      if (district !== "all" && j.fir_records?.district !== district) return false;
      if (status !== "all" && j.status !== status) return false;
      if (q && !(j.fir_records?.case_number || "").toLowerCase().includes(q)
        && !(j.fir_records?.district || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jobs, query, district, status]);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-text-primary">Case Archive</h1>
      <div className="gold-divider mt-2" style={{ width: "60px" }} />

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by case number, district..."
            className="w-full rounded-[2px] border border-border-accent bg-input py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>
        <select value={district} onChange={(e) => setDistrict(e.target.value)}
          className="rounded-[2px] border border-border-accent bg-input px-4 py-2.5 text-sm text-text-secondary focus:border-gold focus:outline-none">
          <option value="all">All Districts</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="rounded-[2px] border border-border-accent bg-input px-4 py-2.5 text-sm text-text-secondary focus:border-gold focus:outline-none">
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-[4px] border border-border-subtle bg-card py-16">
          <FileX className="h-8 w-8 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">No cases match your filters.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              className="group gold-top-border rounded-[4px] border border-border-subtle bg-card p-5 transition-all duration-250 hover:border-gold/30 hover:-translate-y-0.5"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
            >
              <div className="flex items-start justify-between">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] ${statusStyles[c.status] || ""}`}>
                  {c.status}
                </span>
                <span className="font-mono text-[12px] text-gold truncate max-w-[140px]">{c.fir_records?.case_number || c.id.slice(0, 8)}</span>
              </div>
              <div className="mt-3">
                <span className="inline-block rounded-[2px] bg-surface px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary">
                  {c.fir_records?.incident_type || "—"}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-[12px] text-text-muted">
                <div>{c.fir_records?.district || "—"} · {new Date(c.created_at).toLocaleDateString()}</div>
                <div>Model: <span className="font-mono">{c.llm_model || "—"}</span></div>
              </div>
              {c.status === "completed" && (
                <Link to="/dashboard/viewer" search={{ jobId: c.id }}
                  className="mt-4 flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-gold opacity-70 transition-opacity hover:opacity-100">
                  View Reconstruction <ArrowRight className="h-3 w-3" />
                </Link>
              )}
              {c.status === "failed" && (
                <Link to="/dashboard/processing" search={{ jobId: c.id }}
                  className="mt-4 flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-destructive opacity-70 hover:opacity-100">
                  View Errors <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
