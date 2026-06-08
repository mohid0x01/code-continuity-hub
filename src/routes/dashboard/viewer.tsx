import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Expand,
  Download,
  Share2,
  User,
  Car,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  AlertTriangle,
  FileText,
  Loader,
} from "lucide-react";
import { z } from "zod";
import { useSceneStore } from "@/stores/sceneStore";
import { useJobRealtime } from "@/hooks/useJobRealtime";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const Scene3DCanvas = lazy(() =>
  import("@/components/viewer/Scene3DCanvas").then((m) => ({ default: m.Scene3DCanvas }))
);
const CrimeMap = lazy(() =>
  import("@/components/CrimeMap").then((m) => ({ default: m.CrimeMap }))
);
import { geocodeFirText } from "@/components/CrimeMap";

const searchSchema = z.object({ jobId: z.string().optional() });

export const Route = createFileRoute("/dashboard/viewer")({
  validateSearch: (search) => searchSchema.parse(search),
  component: SceneViewer,
});

type SceneEntity = Tables<"scene_entities">;
type SceneEvent = Tables<"scene_events">;

function SceneViewer() {
  const { jobId } = Route.useSearch();
  const job = useJobRealtime(jobId || null);
  const [entities, setEntities] = useState<SceneEntity[]>([]);
  const [events, setEvents] = useState<SceneEvent[]>([]);
  const [firText, setFirText] = useState<string>("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const currentEvent = useSceneStore((s) => s.currentEvent);
  const playing = useSceneStore((s) => s.playing);
  const speed = useSceneStore((s) => s.speed);
  const totalEvents = useSceneStore((s) => s.totalEvents);
  const setCurrentEvent = useSceneStore((s) => s.setCurrentEvent);
  const setPlaying = useSceneStore((s) => s.setPlaying);
  const setSpeed = useSceneStore((s) => s.setSpeed);
  const setTotalEvents = useSceneStore((s) => s.setTotalEvents);
  const nextEvent = useSceneStore((s) => s.nextEvent);
  const prevEvent = useSceneStore((s) => s.prevEvent);

  // Fetch scene data when job completes
  useEffect(() => {
    if (!jobId || job?.status !== "completed") return;
    supabase
      .from("scene_entities")
      .select("*")
      .eq("job_id", jobId)
      .then(({ data }) => { if (data) setEntities(data); });
    supabase
      .from("scene_events")
      .select("*")
      .eq("job_id", jobId)
      .order("sequence_number")
      .then(({ data }) => {
        if (data) {
          setEvents(data);
          setTotalEvents(data.length);
          setCurrentEvent(0);
        }
      });
    // Also fetch FIR text via the job's fir_id
    supabase
      .from("fir_jobs")
      .select("fir_id")
      .eq("id", jobId)
      .single()
      .then(({ data }) => {
        const recId = data?.fir_id;
        if (recId) {
          supabase
            .from("fir_records")
            .select("raw_narrative")
            .eq("id", recId)
            .single()
            .then(({ data: rec }) => { if (rec?.raw_narrative) setFirText(rec.raw_narrative); });
        }
      });
  }, [jobId, job?.status, setTotalEvents, setCurrentEvent]);

  // Auto-play
  useEffect(() => {
    if (!playing || events.length === 0) return;
    const interval = setInterval(() => {
      const store = useSceneStore.getState();
      if (store.currentEvent >= store.totalEvents - 1) {
        setPlaying(false);
      } else {
        nextEvent();
      }
    }, 2000 / speed);
    return () => clearInterval(interval);
  }, [playing, speed, events.length, setPlaying, nextEvent]);

  const actorEntities = entities.filter(e => e.entity_type === "actor");
  const locationEntities = entities.filter(e => e.entity_type === "location");
  const vehicleEntities = entities.filter(e => e.entity_type === "vehicle");

  const roleColor = (role: string | null) => {
    switch (role) {
      case "suspect": return "border-l-red-500";
      case "victim": return "border-l-blue-500";
      case "witness": return "border-l-green-500";
      default: return "border-l-gold";
    }
  };

  const roleBadge = (role: string | null) => {
    switch (role) {
      case "suspect": return "bg-red-500/10 text-red-400";
      case "victim": return "bg-blue-500/10 text-blue-400";
      case "witness": return "bg-green-500/10 text-green-400";
      default: return "bg-gold/10 text-gold";
    }
  };

  const isLoading = !job || (job.status !== "completed" && job.status !== "failed");
  const caseNumber = (job as Record<string, unknown>)?.fir_records
    ? ((job as Record<string, unknown>).fir_records as Record<string, string>)?.case_number
    : jobId?.slice(0, 12) || "—";

  return (
    <div className="-m-8 flex h-[calc(100vh-73px)] flex-col bg-[oklch(0.06_0.005_250)]">
      {/* Top bar */}
      <div className="flex h-12 items-center justify-between border-b border-border-subtle bg-background px-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-text-muted hover:text-gold"><ArrowLeft className="h-4 w-4" /></Link>
          <span className="font-mono text-sm text-gold">{String(caseNumber)}</span>
          {isLoading && <Loader className="h-3 w-3 animate-spin text-blue-400" />}
        </div>
        <span className="text-sm text-text-secondary">
          {job?.status === "completed" ? "Scene Reconstruction" : `Pipeline: ${job?.status || "loading"}`}
        </span>
        <div className="flex items-center gap-2">
          <button className="rounded-[4px] p-1.5 text-text-muted hover:bg-surface hover:text-gold"><Download className="h-4 w-4" /></button>
          <button className="rounded-[4px] p-1.5 text-text-muted hover:bg-surface hover:text-gold"><Share2 className="h-4 w-4" /></button>
          <button className="rounded-[4px] p-1.5 text-text-muted hover:bg-surface hover:text-gold"><Expand className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        {leftOpen && (
          <div className="w-[280px] shrink-0 overflow-y-auto border-r border-border-subtle bg-[oklch(0.1_0.005_60)] p-4">
            <h3 className="label-uppercase mb-3">Scene Entities</h3>
            <div className="space-y-2">
              {[...actorEntities, ...vehicleEntities].map((e) => (
                <div key={e.id} className={`group cursor-pointer rounded-[4px] border border-border-subtle bg-card p-3 transition-all hover:bg-surface-elevated ${roleColor(e.entity_role)} border-l-[3px]`}>
                  <div className="flex items-center gap-2">
                    {e.entity_type === "vehicle" ? <Car className="h-4 w-4 text-gold" /> : <User className="h-4 w-4 text-text-secondary" />}
                    <span className="text-sm font-medium text-text-primary">{e.label}</span>
                  </div>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${roleBadge(e.entity_role)}`}>
                    {e.entity_role || e.entity_type}
                  </span>
                  <div className="mt-1 flex items-center gap-1">
                    <div className="h-1 flex-1 rounded-full bg-border-subtle">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${(e.confidence || 0) * 100}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-text-muted">{((e.confidence || 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="label-uppercase mb-3 mt-6">Locations</h3>
            <div className="space-y-2">
              {locationEntities.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-[4px] border border-border-subtle bg-card p-3">
                  <MapPin className="h-4 w-4 text-gold" />
                  <span className="text-sm text-text-secondary">{l.label}</span>
                </div>
              ))}
            </div>

            <h3 className="label-uppercase mb-3 mt-6 flex items-center gap-2">
              <MapPin className="h-3 w-3" /> Real-World Map
            </h3>
            <Suspense fallback={<div className="h-[260px] animate-pulse rounded-[6px] bg-surface" />}>
              <CrimeMap
                height="260px"
                 locations={geocodeFirText(firText, locationEntities.map((l) => l.label))}
              />
            </Suspense>
            <p className="mt-2 text-[10px] text-text-muted">
              Locations geocoded from the FIR narrative onto OpenStreetMap.
            </p>
          </div>
        )}

        {/* 3D Canvas */}
        <div className="relative flex-1">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Loader className="mx-auto h-8 w-8 animate-spin text-gold" />
                <p className="mt-4 text-sm text-text-muted">Waiting for pipeline to complete...</p>
                <p className="mt-1 font-mono text-[11px] text-gold">{job?.status || "connecting"}</p>
              </div>
            </div>
          ) : (
            <>
              <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader className="h-6 w-6 animate-spin text-gold" /></div>}>
                <Scene3DCanvas entities={entities} events={events} />
              </Suspense>

              {events.length > 0 && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-[4px] border border-gold/20 bg-background/80 px-6 py-3 backdrop-blur-md">
                  <p className="max-w-md text-center text-sm text-text-primary">
                    {events[currentEvent]?.description || ""}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right panel */}
        {rightOpen && (
          <div className="w-[240px] shrink-0 overflow-y-auto border-l border-border-subtle bg-[oklch(0.1_0.005_60)] p-4">
            <h3 className="label-uppercase mb-3">Reconstruction Data</h3>

            <div className="space-y-3">
              {actorEntities.map((e) => (
                <div key={e.id}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-text-secondary">{e.label.split(" (")[0]}</span>
                    <span className="font-mono text-gold">{((e.confidence || 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-border-subtle">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${(e.confidence || 0) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {entities.some(e => (e.confidence || 0) < 0.8) && (
              <div className="mt-6">
                <h3 className="label-uppercase mb-3 text-amber-500">
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  Low Confidence Flags
                </h3>
                {entities.filter(e => (e.confidence || 0) < 0.8).map(e => (
                  <div key={e.id} className="mb-2 rounded-[4px] border border-amber-500/20 bg-amber-500/5 p-3 text-[12px] text-amber-400">
                    {e.label}: {((e.confidence || 0) * 100).toFixed(0)}% — {e.source_text || "inferred"}
                  </div>
                ))}
              </div>
            )}

            <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-[4px] border border-border-accent py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-text-secondary transition-colors hover:border-gold hover:text-gold">
              <FileText className="h-3.5 w-3.5" /> Source Text
            </button>

            <div className="mt-6 space-y-2 text-[11px] text-text-muted">
              <div>Model: <span className="font-mono text-text-secondary">{job?.llm_model || "—"}</span></div>
              <div>Processing: <span className="font-mono text-text-secondary">{job?.processing_time_ms ? `${(job.processing_time_ms / 1000).toFixed(1)}s` : "—"}</span></div>
              <div>Entities: <span className="font-mono text-text-secondary">{entities.length}</span></div>
              <div>Events: <span className="font-mono text-text-secondary">{events.length}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom timeline */}
      <div className="border-t border-border-subtle bg-background px-6 py-4">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[12px] text-gold">
            EVENT {events.length > 0 ? currentEvent + 1 : 0} / {totalEvents}
          </span>

          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentEvent(0)} className="text-text-muted hover:text-gold"><ChevronLeft className="h-4 w-4" /><ChevronLeft className="-ml-3 h-4 w-4" /></button>
            <button onClick={prevEvent} className="text-text-muted hover:text-gold"><ChevronLeft className="h-4 w-4" /></button>
            <button
              onClick={() => setPlaying(!playing)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-background"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button onClick={nextEvent} className="text-text-muted hover:text-gold"><ChevronRight className="h-4 w-4" /></button>
            <button onClick={() => setCurrentEvent(totalEvents - 1)} className="text-text-muted hover:text-gold"><ChevronRight className="h-4 w-4" /><ChevronRight className="-ml-3 h-4 w-4" /></button>
          </div>

          {/* Scrubber */}
          <div className="flex-1">
            <div className="relative h-1.5 rounded-full bg-border-subtle">
              <div className="h-full rounded-full bg-gold transition-all" style={{ width: totalEvents > 0 ? `${((currentEvent + 1) / totalEvents) * 100}%` : "0%" }} />
              {events.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentEvent(i)}
                  className={`absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 transition-all ${
                    i <= currentEvent ? "border-gold bg-gold" : "border-border-accent bg-card"
                  }`}
                  style={{ left: `${((i + 0.5) / totalEvents) * 100}%` }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-1">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${speed === s ? "bg-gold text-background" : "text-text-muted hover:text-gold"}`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[12px] text-text-muted">{events[currentEvent]?.description || "No events loaded"}</p>
      </div>
    </div>
  );
}
