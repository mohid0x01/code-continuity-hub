import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type FirJob = Tables<"fir_jobs">;

const stageLabels: Record<string, string> = {
  pending: "Pending",
  preprocessing: "Stage 1/5 — Preprocessing",
  entity_extraction: "Stage 2/5 — Entity Extraction",
  spatial_resolution: "Stage 3/5 — Spatial Resolution",
  timeline_sequencing: "Stage 4/5 — Timeline Sequencing",
  scene_generation: "Stage 5/5 — Scene Generation",
  completed: "Reconstruction Complete ✓",
  failed: "Pipeline Failed",
  cancelled: "Pipeline Cancelled",
};

export function useJobToasts(jobs: (FirJob & { fir_records?: { case_number: string } | null })[]) {
  const prevStatuses = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    for (const job of jobs) {
      const prev = prevStatuses.current.get(job.id);
      if (prev && prev !== job.status) {
        const caseNum = job.fir_records?.case_number || job.id.slice(0, 8);
        const label = stageLabels[job.status] || job.status;

        if (job.status === "completed") {
          toast.success(`${caseNum} — ${label}`, {
            description: `Processing time: ${job.processing_time_ms ? `${(job.processing_time_ms / 1000).toFixed(1)}s` : "—"}`,
          });
        } else if (job.status === "failed") {
          toast.error(`${caseNum} — ${label}`, {
            description: job.error_message || "An error occurred during processing.",
          });
        } else {
          toast(`${caseNum} — ${label}`, {
            description: "Pipeline advancing...",
            duration: 2500,
          });
        }
      }
      prevStatuses.current.set(job.id, job.status);
    }
  }, [jobs]);
}
