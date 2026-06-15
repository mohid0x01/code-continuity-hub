import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type FirJob = Tables<"fir_jobs">;

function createRealtimeChannelName(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

export function useJobRealtime(jobId: string | null) {
  const [job, setJob] = useState<FirJob | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let active = true;

    // Initial fetch
    supabase
      .from("fir_jobs")
      .select("*")
      .eq("id", jobId)
      .single()
      .then(({ data }) => {
        if (active && data) setJob(data);
      });

    const channelName = createRealtimeChannelName(`job-${jobId}`);
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "fir_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          setJob(payload.new as FirJob);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  return job;
}

export function useJobsRealtime() {
  const [jobs, setJobs] = useState<(FirJob & { fir_records: { case_number: string; district: string; incident_type: string } | null })[]>([]);

  useEffect(() => {
    let active = true;

    supabase
      .from("fir_jobs")
      .select("*, fir_records(case_number, district, incident_type)")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (active && data) setJobs(data as typeof jobs);
      });

    const channelName = createRealtimeChannelName("all-jobs");
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fir_jobs",
        },
        async () => {
          // Re-fetch with joined data on any change
          const { data } = await supabase
            .from("fir_jobs")
            .select("*, fir_records(case_number, district, incident_type)")
            .order("created_at", { ascending: false })
            .limit(50);
          if (active && data) setJobs(data as typeof jobs);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return jobs;
}
