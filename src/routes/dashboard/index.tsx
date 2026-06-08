import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, CheckCircle, Loader, TrendingUp, ArrowRight, AlertCircle, Eye, RotateCcw, StopCircle } from "lucide-react";
import { useJobsRealtime } from "@/hooks/useJobRealtime";
import { useJobToasts } from "@/hooks/useJobToasts";
import { JobDetailsDrawer } from "@/components/dashboard/JobDetailsDrawer";
import { useServerFn } from "@tanstack/react-start";
import { cancelJob, retryJob, runMockPipeline } from "@/lib/fir.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
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

const statusLabels: Record<string, string> = {
  pending: "Pending",
  preprocessing: "Stage 1/5",
  entity_extraction: "Stage 2/5",
  spatial_resolution: "Stage 3/5",
  timeline_sequencing: "Stage 4/5",
  scene_generation: "Stage 5/5",
  completed: "Completed",
  failed: "Failed",
};

function DashboardHome() {
  const jobs = useJobsRealtime();
  useJobToasts(jobs);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const selectedJob = jobs.find(j => j.id === selectedJobId) || null;

  const cancelJobFn = useServerFn(cancelJob);
  const retryJobFn = useServerFn(retryJob);
  const runPipelineFn = useServerFn(runMockPipeline);

  const handleCancel = async (jobId: string) => {
    try {
      await cancelJobFn({ data: { jobId } });
      toast.success("Pipeline cancelled");
    } catch {
      toast.error("Failed to cancel pipeline");
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      await retryJobFn({ data: { jobId } });
      toast("Pipeline reset — restarting...");
      runPipelineFn({ data: { jobId } }).catch(console.error);
    } catch {
      toast.error("Failed to retry pipeline");
    }
  };

  const totalFirs = jobs.length;
  const completed = jobs.filter(j => j.status === "completed").length;
  const processing = jobs.filter(j => !["completed", "failed", "pending"].includes(j.status)).length;
  const successRate = totalFirs > 0 ? ((completed / totalFirs) * 100).toFixed(1) : "0.0";

  const stats = [
    { label: "Total FIRs Submitted", value: String(totalFirs), icon: FileText },
    { label: "Reconstructions Completed", value: String(completed), icon: CheckCircle },
    { label: "Processing", value: String(processing), icon: Loader, pulse: processing > 0 },
    { label: "Success Rate", value: `${successRate}%`, icon: TrendingUp },
  ];

  return (
    <div>
      {/* Stats */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="gold-top-border rounded-[4px] border border-border-subtle bg-card p-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">{stat.label}</span>
              <stat.icon className={`h-4 w-4 text-gold ${stat.pulse ? "gold-pulse" : ""}`} />
            </div>
            <div className="mt-3 font-display text-3xl font-bold text-gold">{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Recent Cases */}
      <div className="mt-10">
        <h2 className="label-uppercase mb-4">Recent Cases</h2>
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[4px] border border-border-subtle bg-card py-16">
            <AlertCircle className="h-8 w-8 text-text-muted" />
            <p className="mt-3 text-sm text-text-muted">No FIR records yet. Submit your first FIR to get started.</p>
            <Link to="/dashboard/submit" className="mt-4 glass-button rounded-[6px] px-6 py-2 text-[12px] font-semibold uppercase tracking-[0.1em]">
              Submit FIR
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[4px] border border-border-subtle">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-surface">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Case No.</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">District</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Submitted</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => (
                  <tr key={job.id} className={`border-b border-border-subtle transition-colors hover:bg-surface-overlay ${i % 2 === 0 ? "bg-card" : "bg-[oklch(0.11_0.005_60)]"}`}>
                    <td className="px-4 py-3 font-mono text-sm text-gold">{job.fir_records?.case_number || "—"}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{job.fir_records?.district || "—"}</td>
                    <td className="px-4 py-3 font-mono text-sm text-text-muted">{new Date(job.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] ${statusStyles[job.status] || ""}`}>
                        {statusLabels[job.status] || job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedJobId(job.id)}
                          className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-text-muted hover:text-gold transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-3.5 w-3.5" /> Details
                        </button>
                        {job.status === "completed" && (
                          <Link to="/dashboard/viewer" search={{ jobId: job.id }} className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-gold hover:text-gold-light">
                            View <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                        {!["completed", "failed", "pending"].includes(job.status) && (
                          <button onClick={() => handleCancel(job.id)} className="flex items-center gap-1 text-[11px] text-destructive/70 hover:text-destructive transition-colors" title="Cancel">
                            <StopCircle className="h-3 w-3" />
                          </button>
                        )}
                        {job.status === "failed" && (
                          <button onClick={() => handleRetry(job.id)} className="flex items-center gap-1 text-[11px] text-gold/70 hover:text-gold transition-colors" title="Retry">
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                        {!["completed", "failed", "pending"].includes(job.status) && (
                          <Link to="/dashboard/processing" search={{ jobId: job.id }} className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-blue-400">
                            <Loader className="h-3 w-3 animate-spin" /> Live
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <JobDetailsDrawer
        job={selectedJob}
        open={!!selectedJobId}
        onClose={() => setSelectedJobId(null)}
        onCancel={handleCancel}
        onRetry={handleRetry}
      />
    </div>
  );
}
