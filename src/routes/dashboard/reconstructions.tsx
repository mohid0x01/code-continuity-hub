import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Boxes } from "lucide-react";
import { useJobsRealtime } from "@/hooks/useJobRealtime";

export const Route = createFileRoute("/dashboard/reconstructions")({
  head: () => ({
    meta: [
      { title: "My Reconstructions — SCENEIQ" },
      { name: "description", content: "All completed 3D crime-scene reconstructions ready for review and export." },
      { property: "og:title", content: "My Reconstructions — SCENEIQ" },
      { property: "og:description", content: "All completed 3D crime-scene reconstructions ready for review and export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyReconstructions,
});

function MyReconstructions() {
  const jobs = useJobsRealtime();

  // Only viewer-ready cases: completed AND has either 3D scene result or AI video.
  const completedJobs = useMemo(
    () =>
      jobs.filter((j) => {
        if (j.status !== "completed") return false;
        const hasScene = Boolean((j as unknown as { result_scene?: unknown }).result_scene);
        const hasVideo = Boolean(
          (j as unknown as { video_url?: string | null }).video_url,
        );
        return hasScene || hasVideo;
      }),
    [jobs],
  );

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-text-primary">My Reconstructions</h1>
      <div className="gold-divider mt-2" style={{ width: "60px" }} />
      <p className="mt-3 text-sm text-text-secondary">
        All completed scene reconstructions ready for review.
      </p>

      {completedJobs.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-[4px] border border-border-subtle bg-card py-16">
          <Boxes className="h-8 w-8 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">No reconstructions yet. Submit an FIR to generate one.</p>
          <Link
            to="/dashboard/submit"
            className="mt-4 glass-button rounded-[6px] px-6 py-2 text-[12px] font-semibold uppercase tracking-[0.1em]"
          >
            Submit FIR
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {completedJobs.map((c, i) => (
            <motion.div
              key={c.id}
              className="group gold-top-border rounded-[4px] border border-border-subtle bg-card p-5 transition-all duration-250 hover:border-gold/30 hover:-translate-y-0.5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
            >
              <div className="flex items-start justify-between">
                <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-gold">
                  Completed
                </span>
                <span className="font-mono text-[12px] text-gold truncate max-w-[140px]">
                  {c.fir_records?.case_number || c.id.slice(0, 8)}
                </span>
              </div>
              <div className="mt-3">
                <span className="inline-block rounded-[2px] bg-surface px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary">
                  {c.fir_records?.incident_type || "—"}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-[12px] text-text-muted">
                <div>{c.fir_records?.district || "—"} · {new Date(c.created_at).toLocaleDateString()}</div>
                <div>Model: <span className="font-mono">{c.llm_model || "—"}</span></div>
                {c.processing_time_ms && (
                  <div>Time: <span className="font-mono">{(c.processing_time_ms / 1000).toFixed(1)}s</span></div>
                )}
              </div>
              <Link
                to="/dashboard/viewer"
                search={{ jobId: c.id }}
                className="mt-4 flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-gold opacity-70 transition-opacity hover:opacity-100"
              >
                View Reconstruction <ArrowRight className="h-3 w-3" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
