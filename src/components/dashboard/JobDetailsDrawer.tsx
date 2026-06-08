import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Loader, AlertTriangle, Clock, RotateCcw, StopCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type FirJob = Tables<"fir_jobs">;

interface JobDetailsDrawerProps {
  job: (FirJob & { fir_records?: { case_number: string; district: string; incident_type: string } | null }) | null;
  open: boolean;
  onClose: () => void;
  onRetry?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
}

const PIPELINE_STAGES = [
  { key: "preprocessing", label: "Preprocessing & Language Normalization", desc: "Detecting language, normalizing Roman Urdu transliterations" },
  { key: "entity_extraction", label: "AI Entity & Event Extraction", desc: "Identifying actors, objects, locations, and temporal markers" },
  { key: "spatial_resolution", label: "Spatial Coordinate Resolution", desc: "Mapping referenced locations to relative spatial positions" },
  { key: "timeline_sequencing", label: "Timeline Sequencing & Validation", desc: "Ordering events chronologically and validating causal chains" },
  { key: "scene_generation", label: "3D Scene Manifest Generation", desc: "Building the scene graph for interactive 3D rendering" },
];

const stageOrder: Record<string, number> = {
  pending: -1,
  preprocessing: 0,
  entity_extraction: 1,
  spatial_resolution: 2,
  timeline_sequencing: 3,
  scene_generation: 4,
  completed: 5,
  failed: -2,
  cancelled: -3,
};

export function JobDetailsDrawer({ job, open, onClose, onRetry, onCancel }: JobDetailsDrawerProps) {
  if (!job) return null;

  const currentStageIdx = stageOrder[job.status] ?? -1;
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  const isCancelled = job.status === ("cancelled" as string);
  const isRunning = !isCompleted && !isFailed && !isCancelled && job.status !== "pending";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col border-l border-border-subtle bg-background shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
              <div>
                <p className="font-mono text-sm text-gold">{job.fir_records?.case_number || job.id.slice(0, 12)}</p>
                <p className="mt-0.5 text-[11px] text-text-muted">{job.fir_records?.district || "—"} · {job.fir_records?.incident_type || "—"}</p>
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-text-muted transition-colors hover:bg-surface hover:text-gold">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Status Banner */}
            <div className={`mx-6 mt-4 rounded-[4px] border px-4 py-3 ${
              isCompleted ? "border-success/30 bg-success/5" :
              isFailed ? "border-destructive/30 bg-destructive/5" :
              isRunning ? "border-gold/30 bg-gold/5 shimmer" :
              "border-border-subtle bg-card"
            }`}>
              <div className="flex items-center gap-2">
                {isCompleted && <Check className="h-4 w-4 text-success" />}
                {isFailed && <AlertTriangle className="h-4 w-4 text-destructive" />}
                {isRunning && <Loader className="h-4 w-4 animate-spin text-gold" />}
                <span className={`text-sm font-semibold uppercase tracking-wider ${
                  isCompleted ? "text-success" : isFailed ? "text-destructive" : isRunning ? "text-gold" : "text-text-muted"
                }`}>
                  {isCompleted ? "Completed" : isFailed ? "Failed" : isCancelled ? "Cancelled" : isRunning ? `Processing — Stage ${currentStageIdx + 1}/5` : "Pending"}
                </span>
              </div>
              {isFailed && job.error_message && (
                <p className="mt-2 text-[12px] text-destructive/80">{job.error_message}</p>
              )}
            </div>

            {/* Pipeline Timeline */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <h3 className="label-uppercase mb-4">Pipeline Timeline</h3>
              <div className="relative space-y-0">
                {PIPELINE_STAGES.map((stage, i) => {
                  const stageIdx = i;
                  const status = isCompleted || stageIdx < currentStageIdx ? "complete" :
                    stageIdx === currentStageIdx && isRunning ? "active" : "pending";

                  return (
                    <div key={stage.key} className="relative flex gap-4 pb-6">
                      {/* Vertical line */}
                      {i < PIPELINE_STAGES.length - 1 && (
                        <div className={`absolute left-[13px] top-7 h-full w-[2px] ${
                          status === "complete" ? "bg-success/40" : "bg-border-subtle"
                        }`} />
                      )}
                      {/* Node */}
                      <div className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                        status === "complete" ? "border-success bg-success/20" :
                        status === "active" ? "border-gold bg-gold/10" :
                        "border-border-accent bg-card"
                      }`}>
                        {status === "complete" ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : status === "active" ? (
                          <Loader className="h-3.5 w-3.5 animate-spin text-gold" />
                        ) : (
                          <span className="text-[10px] font-semibold text-text-muted">{i + 1}</span>
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1">
                        <div className={`text-sm font-semibold ${status === "pending" ? "text-text-muted" : "text-text-primary"}`}>
                          {stage.label}
                        </div>
                        <div className="mt-0.5 text-[11px] text-text-muted">{stage.desc}</div>
                        {status === "active" && (
                          <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wider text-gold gold-pulse">Processing...</span>
                        )}
                        {status === "complete" && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-success/70">
                            <Clock className="h-3 w-3" /> Complete
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Meta Info */}
              <div className="mt-4 space-y-2 rounded-[4px] border border-border-subtle bg-card p-4">
                <h4 className="label-uppercase mb-2">Job Metadata</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <span className="text-text-muted">Job ID</span>
                  <span className="font-mono text-text-secondary">{job.id.slice(0, 12)}...</span>
                  <span className="text-text-muted">Model</span>
                  <span className="font-mono text-text-secondary">{job.llm_model || "—"}</span>
                  <span className="text-text-muted">Created</span>
                  <span className="font-mono text-text-secondary">{new Date(job.created_at).toLocaleString()}</span>
                  <span className="text-text-muted">Updated</span>
                  <span className="font-mono text-text-secondary">{new Date(job.updated_at).toLocaleString()}</span>
                  {job.processing_time_ms && (
                    <>
                      <span className="text-text-muted">Processing Time</span>
                      <span className="font-mono text-gold">{(job.processing_time_ms / 1000).toFixed(1)}s</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-border-subtle px-6 py-4">
              <div className="flex gap-3">
                {isRunning && onCancel && (
                  <button
                    onClick={() => onCancel(job.id)}
                    className="glass-button-destructive flex flex-1 items-center justify-center gap-2 rounded-[6px] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider"
                  >
                    <StopCircle className="h-4 w-4" /> Cancel Pipeline
                  </button>
                )}
                {(isFailed || isCancelled) && onRetry && (
                  <button
                    onClick={() => onRetry(job.id)}
                    className="glass-button flex flex-1 items-center justify-center gap-2 rounded-[6px] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider"
                  >
                    <RotateCcw className="h-4 w-4" /> Retry Pipeline
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
