import { useEffect, useRef } from "react";
import { useNotificationStore, type NotificationType } from "@/stores/notificationStore";
import type { Tables } from "@/integrations/supabase/types";

type FirJob = Tables<"fir_jobs"> & {
  fir_records?: { case_number: string; district: string; incident_type: string } | null;
};

const stageLabels: Record<string, string> = {
  pending: "Queued",
  preprocessing: "Stage 1/5 — Preprocessing",
  entity_extraction: "Stage 2/5 — Entity Extraction",
  spatial_resolution: "Stage 3/5 — Spatial Resolution",
  timeline_sequencing: "Stage 4/5 — Timeline Sequencing",
  scene_generation: "Stage 5/5 — Scene Generation",
  completed: "Reconstruction Complete ✓",
  failed: "Pipeline Failed",
  cancelled: "Pipeline Cancelled",
};

function getNotifType(status: string): NotificationType {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  if (status === "pending") return "new_job";
  return "stage_change";
}

export function useNotificationWire(jobs: FirJob[]) {
  const prevStatuses = useRef<Map<string, string>>(new Map());
  const add = useNotificationStore((s) => s.add);
  const initialized = useRef(false);

  useEffect(() => {
    // Skip first render to avoid flooding with existing jobs
    if (!initialized.current) {
      for (const job of jobs) {
        prevStatuses.current.set(job.id, job.status);
      }
      initialized.current = true;
      return;
    }

    for (const job of jobs) {
      const prev = prevStatuses.current.get(job.id);
      const caseNum = job.fir_records?.case_number || job.id.slice(0, 8);

      // New job appeared
      if (prev === undefined) {
        add({
          jobId: job.id,
          caseNumber: caseNum,
          type: "new_job",
          title: `New FIR Submitted`,
          description: `${caseNum} — ${job.fir_records?.district || "Unknown district"}`,
        });
        prevStatuses.current.set(job.id, job.status);
        continue;
      }

      // Status changed
      if (prev !== job.status) {
        const label = stageLabels[job.status] || job.status;
        const type = getNotifType(job.status);

        let description = `${caseNum} → ${label}`;
        if (job.status === "completed" && job.processing_time_ms) {
          description += ` (${(job.processing_time_ms / 1000).toFixed(1)}s)`;
        }
        if (job.status === "failed" && job.error_message) {
          description = `${caseNum} — ${job.error_message}`;
        }

        add({
          jobId: job.id,
          caseNumber: caseNum,
          type,
          title: label,
          description,
        });
        prevStatuses.current.set(job.id, job.status);
      }
    }
  }, [jobs, add]);
}
