import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Check, Loader, RotateCcw, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useJobRealtime } from "@/hooks/useJobRealtime";
import { retryJob, runMockPipeline } from "@/lib/fir.functions";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({
  jobId: z.string().optional(),
});

export const Route = createFileRoute("/dashboard/processing")({
  head: () => ({
    meta: [
      { title: "Pipeline Processing — SCENEIQ" },
      { name: "description", content: "Live progress of the SCENEIQ AI pipeline stages for a submitted FIR." },
      { property: "og:title", content: "Pipeline Processing — SCENEIQ" },
      { property: "og:description", content: "Live progress of the SCENEIQ AI pipeline stages for a submitted FIR." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search) => searchSchema.parse(search),
  component: ProcessingPage,
});

const stageMap: Record<string, number> = {
  pending: -1,
  preprocessing: 0,
  entity_extraction: 1,
  spatial_resolution: 2,
  timeline_sequencing: 3,
  scene_generation: 4,
  completed: 5,
  failed: -2,
};

const STAGE_KEYS = [
  "preprocessing",
  "entity_extraction",
  "spatial_resolution",
  "timeline_sequencing",
  "scene_generation",
] as const;

const stages = [
  { key: "preprocessing", title: "Stage 1 · Narrative Preprocessing", desc: "Loading FIR text, detecting language (English / Urdu / Roman Urdu / Sindhi)" },
  { key: "entity_extraction", title: "Stage 2 · AI Entity & Event Extraction", desc: "Calling Lovable AI with fallback chain; structured tool-call output" },
  { key: "spatial_resolution", title: "Stage 3 · Spatial Coordinate Resolution", desc: "Validating schema; resolving 3D positions for every entity" },
  { key: "timeline_sequencing", title: "Stage 4 · Timeline Sequencing", desc: "Re-ordering events chronologically; linking to entities" },
  { key: "scene_generation", title: "Stage 5 · 3D Scene Manifest", desc: "Building scene graph and persisting reconstruction" },
] as const;

type Attempt = { model: string; ok: boolean; error?: string; ms: number };
type Progress = {
  current_stage?: string;
  stages_completed?: string[];
  attempts?: Attempt[];
  stage_times?: Record<string, number>;
  stage_started_at?: string;
};

function ProcessingPage() {
  const { jobId } = Route.useSearch();
  const navigate = useNavigate();
  const job = useJobRealtime(jobId || null);
  const retryJobFn = useServerFn(retryJob);
  const runPipelineFn = useServerFn(runMockPipeline);
  const [retrying, setRetrying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);

  const currentStage = job ? stageMap[job.status] ?? -1 : -1;
  const isCompleted = job?.status === "completed";
  const isFailed = job?.status === "failed";
  const progress = (job?.pipeline_progress as Progress | null) ?? {};
  const attempts = progress.attempts ?? [];
  const activeModel = job?.llm_model;

  // Auto-navigate on completion (once)
  useEffect(() => {
    if (isCompleted && jobId) {
      const t = setTimeout(() => navigate({ to: "/dashboard/viewer", search: { jobId } }), 1500);
      return () => clearTimeout(t);
    }
  }, [isCompleted, jobId, navigate]);

  // Live elapsed-time ticker for the current stage
  useEffect(() => {
    if (isCompleted || isFailed || !progress.stage_started_at) return;
    const started = new Date(progress.stage_started_at).getTime();
    setElapsed(Math.max(0, Date.now() - started));
    const t = setInterval(() => setElapsed(Math.max(0, Date.now() - started)), 250);
    return () => clearInterval(t);
  }, [progress.stage_started_at, isCompleted, isFailed]);

  const handleRetry = async () => {
    if (!jobId) return;
    setRetrying(true);
    try {
      await retryJobFn({ data: { jobId } });
      toast.success("Restarting pipeline...");
      runPipelineFn({ data: { jobId } }).catch(console.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to retry");
    } finally {
      setRetrying(false);
    }
  };

  const progressPct = isCompleted ? 100 : Math.max(0, ((currentStage + 1) / stages.length) * 100);

  // Auto scroll to the error panel whenever the job transitions to failed
  // (covers initial load AND retry-then-fail again).
  useEffect(() => {
    if (isFailed && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isFailed, job?.error_message]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <div className="fixed left-60 right-0 top-0 z-50 h-[2px] bg-border-subtle">
        <motion.div
          className={`h-full ${isFailed ? "bg-destructive" : "bg-gold"}`}
          initial={{ width: "0%" }}
          animate={{ width: `${isFailed ? 100 : progressPct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center">
          <p className="font-mono text-lg text-gold">{jobId ? jobId.slice(0, 8).toUpperCase() : "..."}</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-text-primary">
            {isFailed ? "Pipeline Failed" : isCompleted ? "Reconstruction Complete" : "Processing Your FIR"}
          </h1>
          {!isFailed && !isCompleted && (
            <p className="mt-2 text-sm text-text-muted">Do not close this tab. Your reconstruction is being generated.</p>
          )}
          {activeModel && !isFailed && (
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-text-muted">
              Model · <span className="text-gold">{activeModel}</span>
            </p>
          )}
        </div>

        {isFailed && (
          <motion.div
            ref={errorRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-[4px] border border-destructive/40 bg-destructive/5 p-5"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-destructive">Pipeline error</h3>
                <p className="mt-1 break-words text-[13px] text-text-secondary">
                  {job?.error_message || "An error occurred while processing the FIR."}
                </p>
                {attempts.length > 0 && (
                  <div className="mt-3 rounded-[3px] border border-destructive/20 bg-background/40 p-2">
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
                      Fallback attempts ({attempts.length})
                    </div>
                    <div className="space-y-1">
                      {attempts.map((a, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 font-mono text-[10px] ${
                            a.ok ? "text-success" : "text-destructive"
                          }`}
                        >
                          <span>{a.ok ? "✓" : "✗"}</span>
                          <span className="flex-1 truncate">{a.model}</span>
                          <span className="opacity-60">{(a.ms / 1000).toFixed(1)}s</span>
                          {a.error && (
                            <span className="ml-2 max-w-[40%] truncate opacity-70" title={a.error}>
                              {a.error}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="glass-button-primary inline-flex items-center gap-2 rounded-[6px] px-5 py-2 text-[12px] font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
                {retrying ? "Retrying..." : "Retry Pipeline"}
              </button>
              <Link
                to="/dashboard/submit"
                className="glass-button inline-flex items-center gap-2 rounded-[6px] px-5 py-2 text-[12px] font-semibold uppercase tracking-[0.1em]"
              >
                Resubmit New FIR
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-text-muted hover:text-text-primary"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
              </Link>
            </div>
          </motion.div>
        )}

        <div className="mt-10 space-y-3 text-left">
          {stages.map((stage, i) => {
            const status: "complete" | "active" | "failed" | "pending" =
              isCompleted || (currentStage >= 0 && i < currentStage)
                ? "complete"
                : i === currentStage
                ? "active"
                : isFailed && i === Math.max(0, stageMap[progress.current_stage || "preprocessing"] ?? 0)
                ? "failed"
                : "pending";
            const stageDuration = progress.stage_times?.[stage.key];
            const nextKey = STAGE_KEYS[i + 1];
            const stageMs =
              stageDuration && nextKey && progress.stage_times?.[nextKey]
                ? progress.stage_times[nextKey] - stageDuration
                : undefined;
            return (
              <motion.div
                key={stage.title}
                className={`flex items-start gap-4 rounded-[4px] border p-4 transition-all duration-300 ${
                  status === "active"
                    ? "border-gold/40 bg-gold/5 shimmer"
                    : status === "complete"
                    ? "border-success/20 bg-success/5"
                    : status === "failed"
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border-subtle bg-card"
                }`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                  status === "complete"
                    ? "border-success bg-success/20"
                    : status === "active"
                    ? "border-gold bg-gold/10"
                    : status === "failed"
                    ? "border-destructive bg-destructive/10"
                    : "border-border-accent"
                }`}>
                  {status === "complete" ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : status === "active" ? (
                    <Loader className="h-3.5 w-3.5 animate-spin text-gold" />
                  ) : status === "failed" ? (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <span className="text-[10px] font-semibold text-text-muted">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className={`text-sm font-semibold ${status === "pending" ? "text-text-muted" : "text-text-primary"}`}>
                      {stage.title}
                    </div>
                    {status === "complete" && stageMs !== undefined && (
                      <span className="font-mono text-[11px] text-success">{(stageMs / 1000).toFixed(2)}s</span>
                    )}
                    {status === "active" && (
                      <span className="font-mono text-[11px] text-gold">{(elapsed / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[12px] text-text-muted">{stage.desc}</div>
                  {status === "active" && (
                    <span className="mt-1 inline-block text-[11px] font-semibold uppercase tracking-[0.1em] text-gold gold-pulse">
                      Processing...
                    </span>
                  )}
                  {status === "active" && stage.key === "entity_extraction" && attempts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {attempts.map((a, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 rounded-[3px] border px-2 py-1 font-mono text-[10px] ${
                            a.ok
                              ? "border-success/30 bg-success/5 text-success"
                              : "border-destructive/30 bg-destructive/5 text-destructive"
                          }`}
                        >
                          <span>{a.ok ? "✓" : "↻"}</span>
                          <span className="flex-1 truncate">{a.model}</span>
                          <span className="opacity-70">{(a.ms / 1000).toFixed(1)}s</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-8 text-center font-mono text-[12px] text-text-muted">
          {isCompleted
            ? `Completed in ${job?.processing_time_ms ? `${(job.processing_time_ms / 1000).toFixed(1)}s` : "—"} · Redirecting to 3D viewer...`
            : isFailed
            ? "Pipeline halted. Review the error above and choose an action."
            : attempts.length > 1
            ? `Trying ${attempts.length} provider${attempts.length > 1 ? "s" : ""}...`
            : "Live processing..."}
        </p>
      </motion.div>
    </div>
  );
}
