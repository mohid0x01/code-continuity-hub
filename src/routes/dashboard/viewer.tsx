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
  ZoomIn,
  ZoomOut,
  Film,
  Paperclip,
  Box,
  FileDown,
  Sparkles,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useSceneStore } from "@/stores/sceneStore";
import { useJobRealtime } from "@/hooks/useJobRealtime";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { queueVideoGeneration, uploadRenderedVideo } from "@/lib/video.functions";
import { logAuditEvent } from "@/lib/audit.functions";
import { exportCourtReportPDF } from "@/lib/pdf-export";
import { EvidenceManager } from "@/components/EvidenceManager";
import { fetchLocationScene } from "@/lib/location-scene.functions";
import type { RealWorldScene } from "@/lib/location-scene.functions";

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
  const [firFull, setFirFull] = useState<Record<string, unknown> | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [showSource, setShowSource] = useState(false);
  const [tab, setTab] = useState<"scene" | "video" | "evidence" | "source">("scene");
  const queueVideoFn = useServerFn(queueVideoGeneration);
  const uploadVideoFn = useServerFn(uploadRenderedVideo);
  const logFn = useServerFn(logAuditEvent);
  const fetchSceneFn = useServerFn(fetchLocationScene);
  const [recording, setRecording] = useState(false);
  const [realWorld, setRealWorld] = useState<RealWorldScene | null>(null);
  const [realWorldLoading, setRealWorldLoading] = useState(false);

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

  const handleDownload = useCallback(() => {
    const payload = { job, entities, events, firText };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconstruction-${jobId?.slice(0, 8) || "scene"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Reconstruction downloaded");
  }, [job, entities, events, firText, jobId]);

  const handleShare = useCallback(async () => {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  }, []);

  const handleExpand = useCallback(() => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }, []);

  const handleZoom = useCallback((dir: "in" | "out") => {
    window.dispatchEvent(new CustomEvent("sceneiq:zoom", { detail: dir }));
  }, []);

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
            .select("*")
            .eq("id", recId)
            .single()
            .then(({ data: rec }) => {
              if (rec) {
                setFirFull(rec as unknown as Record<string, unknown>);
                if (rec.raw_narrative) setFirText(rec.raw_narrative);
              }
            });
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

  const firRec = firFull ?? ((job as Record<string, unknown>)?.fir_records as Record<string, unknown> | undefined);
  const firId = (firRec?.id as string | undefined) ?? undefined;
  const videoUrl = (job as Record<string, unknown>)?.video_url as string | null | undefined;
  const videoStatus = (job as Record<string, unknown>)?.video_status as string | null | undefined;

  // Primary FIR pin extracted from the officer-selected location on submit.
  const primaryPin = (() => {
    const lat = firRec?.latitude as number | null | undefined;
    const lng = firRec?.longitude as number | null | undefined;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const area = (firRec?.area as string | null | undefined) ?? "";
    const city = (firRec?.city as string | null | undefined) ?? "";
    const label = [area, city].filter(Boolean).join(", ") || "Incident Location";
    return { label, lat, lng, description: (firRec?.formatted_address as string | null | undefined) ?? undefined };
  })();

  // Fetch real-world OSM geometry once the FIR lat/lng is known.
  useEffect(() => {
    if (!primaryPin) return;
    let cancelled = false;
    setRealWorldLoading(true);
    fetchSceneFn({ data: { lat: primaryPin.lat, lng: primaryPin.lng, radius: 250 } })
      .then((scene) => { if (!cancelled) setRealWorld(scene as RealWorldScene); })
      .catch(() => { /* fall back to procedural */ })
      .finally(() => { if (!cancelled) setRealWorldLoading(false); });
    return () => { cancelled = true; };
  }, [primaryPin?.lat, primaryPin?.lng, fetchSceneFn]);

  const mapLocations = () => geocodeFirText(
    firText,
    locationEntities.map((l) => l.label),
    { primary: primaryPin },
  );

  const handleGenerateVideo = useCallback(async () => {
    if (!jobId) return;
    if (events.length === 0) { toast.error("No scene events to render"); return; }

    // Ensure we're on the 3D tab so the canvas is mounted & visible.
    setTab("scene");
    // Restart playback from event 0 so recording captures the whole story.
    setCurrentEvent(0);
    setPlaying(true);
    setRecording(true);

    const durationSec = Math.min(30, Math.max(6, events.length * 2 + 2));

    // Wait for the canvas to mount, then start recording.
    // Longer wait ensures RecorderBridge (mounted inside <Canvas>) is live
    // after switching to the "scene" tab — otherwise record-start fires with
    // no listener and the promise below times out, leaving video_status="queued".
    await new Promise((r) => setTimeout(r, 900));

    try {
      toast.info(`Recording ${durationSec}s scene playthrough…`);

      const blob: Blob = await new Promise((resolve, reject) => {
        const onBlob = (e: Event) => {
          window.removeEventListener("sceneiq:record-blob", onBlob);
          resolve((e as CustomEvent).detail.blob as Blob);
        };
        window.addEventListener("sceneiq:record-blob", onBlob);
        window.dispatchEvent(new CustomEvent("sceneiq:record-start", { detail: { durationSec } }));
        setTimeout(() => {
          window.removeEventListener("sceneiq:record-blob", onBlob);
          reject(new Error("Recording timed out"));
        }, (durationSec + 8) * 1000);
      });

      toast.info(`Uploading ${(blob.size / 1024 / 1024).toFixed(1)} MB…`);

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Read failed"));
        reader.readAsDataURL(blob);
      });

      const res = await uploadVideoFn({
        data: { jobId, base64, mime: blob.type || "video/webm", durationSec },
      });
      await logFn({ data: { action: "video.rendered", entityType: "fir_job", entityId: jobId, metadata: { url: res.url } } }).catch(() => {});
      toast.success("3D incident video generated");
      setTab("video");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to queue video");
    } finally {
      setRecording(false);
      setPlaying(false);
    }
  }, [jobId, events.length, queueVideoFn, uploadVideoFn, logFn, setCurrentEvent, setPlaying]);

  const handlePdfExport = useCallback(async () => {
    if (!firRec) { toast.error("FIR data not loaded yet"); return; }
    exportCourtReportPDF({
      caseNumber: String(caseNumber),
      incidentType: (firRec.incident_type as string) ?? null,
      incidentDate: (firRec.incident_date as string) ?? null,
      city: (firRec.city as string) ?? null,
      area: (firRec.area as string) ?? null,
      formattedAddress: (firRec.formatted_address as string) ?? null,
      latitude: (firRec.latitude as number) ?? null,
      longitude: (firRec.longitude as number) ?? null,
      narrative: firText || ((firRec.raw_narrative as string) ?? ""),
      entities: entities.map((e) => ({ label: e.label, entity_type: e.entity_type, entity_role: e.entity_role, confidence: e.confidence })),
      events: events.map((e) => ({ sequence_number: e.sequence_number, description: e.description, action_label: e.action_label })),
      videoUrl: videoUrl ?? null,
      createdAt: new Date().toISOString(),
    });
    await logFn({ data: { action: "report.export_pdf", entityType: "fir_job", entityId: jobId ?? null, metadata: { caseNumber: String(caseNumber) } } }).catch(() => {});
    toast.success("Court report PDF downloaded");
  }, [firRec, firText, entities, events, caseNumber, jobId, videoUrl, logFn]);

  return (
    <div className="-m-8 flex h-[calc(100vh-73px)] flex-col bg-background">
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
          <button onClick={() => handleZoom("in")} title="Zoom in" className="rounded-[4px] p-1.5 text-text-muted hover:bg-surface hover:text-gold"><ZoomIn className="h-4 w-4" /></button>
          <button onClick={() => handleZoom("out")} title="Zoom out" className="rounded-[4px] p-1.5 text-text-muted hover:bg-surface hover:text-gold"><ZoomOut className="h-4 w-4" /></button>
          <button onClick={handleDownload} title="Download JSON" className="rounded-[4px] p-1.5 text-text-muted hover:bg-surface hover:text-gold"><Download className="h-4 w-4" /></button>
          <button onClick={handlePdfExport} title="Export Court Report PDF" className="rounded-[4px] p-1.5 text-emerald-400 hover:bg-emerald-500/10"><FileDown className="h-4 w-4" /></button>
          <button onClick={handleShare} title="Copy share link" className="rounded-[4px] p-1.5 text-text-muted hover:bg-surface hover:text-gold"><Share2 className="h-4 w-4" /></button>
          <button onClick={handleExpand} title="Fullscreen" className="rounded-[4px] p-1.5 text-text-muted hover:bg-surface hover:text-gold"><Expand className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        {leftOpen && (
          <div className="w-[280px] shrink-0 overflow-y-auto border-r border-border bg-card p-4">
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
                 locations={mapLocations()}
              />
            </Suspense>
            <p className="mt-2 text-[10px] text-text-muted">
              Locations geocoded from the FIR narrative onto OpenStreetMap.
            </p>
          </div>
        )}

        {/* 3D Canvas */}
        <div className="relative flex-1">
          {/* Tab bar */}
          <div className="flex h-10 items-center gap-1 border-b border-border-subtle bg-background/80 px-3 backdrop-blur">
            {([
              { id: "scene", label: "3D Scene", icon: Box },
              { id: "video", label: "AI Video", icon: Film },
              { id: "evidence", label: "Evidence", icon: Paperclip },
              { id: "source", label: "Source & Map", icon: FileText },
            ] as const).map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-[4px] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${tab === t.id ? "bg-emerald-500/10 text-emerald-400" : "text-text-muted hover:text-text-secondary"}`}>
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Loader className="mx-auto h-8 w-8 animate-spin text-gold" />
                <p className="mt-4 text-sm text-text-muted">Waiting for pipeline to complete...</p>
                <p className="mt-1 font-mono text-[11px] text-gold">{job?.status || "connecting"}</p>
              </div>
            </div>
          ) : tab === "scene" ? (
            <>
              <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader className="h-6 w-6 animate-spin text-gold" /></div>}>
                <Scene3DCanvas entities={entities} events={events} realWorld={realWorld} />
              </Suspense>

              {/* Real-world overlay badge */}
              <div className="absolute left-4 top-14 rounded-[4px] border border-emerald-500/30 bg-background/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] backdrop-blur">
                {realWorldLoading ? (
                  <span className="text-text-muted">Loading real-world map…</span>
                ) : realWorld && (realWorld.buildings.length + realWorld.roads.length) > 0 ? (
                  <span className="text-emerald-400">
                    Real Location · {realWorld.buildings.length} buildings · {realWorld.roads.length} roads
                  </span>
                ) : (
                  <span className="text-amber-400">Procedural fallback (OSM empty)</span>
                )}
              </div>

              {realWorld?.staticMapUrl && (
                <div className="absolute right-4 top-14 w-52 overflow-hidden rounded-[6px] border border-gold/30 bg-background/70 backdrop-blur">
                  <img src={realWorld.staticMapUrl} alt="Location satellite preview" className="block w-full" />
                  <div className="px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-gold">Satellite Preview</div>
                </div>
              )}

              {events.length > 0 && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-[4px] border border-gold/20 bg-background/80 px-6 py-3 backdrop-blur-md">
                  <p className="max-w-md text-center text-sm text-text-primary">
                    {events[currentEvent]?.description || ""}
                  </p>
                </div>
              )}
            </>
          ) : tab === "video" ? (
            <div className="flex h-[calc(100%-2.5rem)] items-center justify-center p-8">
              {videoUrl ? (
                <video src={videoUrl} controls className="max-h-full max-w-full rounded-[6px] border border-border-subtle shadow-2xl" />
              ) : (
                <div className="text-center">
                  <Film className="mx-auto h-12 w-12 text-emerald-400/50" />
                  <h3 className="mt-4 text-lg font-semibold text-text-primary">AI 3D Incident Video</h3>
                  <p className="mt-2 max-w-md text-sm text-text-muted">
                    Generate a 10-second photoreal 3D reconstruction of this incident driven by the scene manifest, real Pakistan location, and FIR narrative.
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-emerald-400">Status: {videoStatus ?? "not started"}</p>
                  <button onClick={handleGenerateVideo} disabled={recording}
                    className="mt-6 inline-flex items-center gap-2 rounded-[8px] bg-emerald-500/15 px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50">
                    <Sparkles className="h-4 w-4" /> {recording ? "Recording…" : "Generate 3D Video"}
                  </button>
                </div>
              )}
            </div>
          ) : tab === "evidence" ? (
            <div className="h-[calc(100%-2.5rem)] overflow-y-auto p-6">
              {firId ? <EvidenceManager firId={firId} /> : <p className="text-sm text-text-muted">Loading evidence…</p>}
            </div>
          ) : (
            <div className="h-[calc(100%-2.5rem)] overflow-y-auto p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-text-secondary">FIR Narrative</h3>
              <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-[6px] border border-border-subtle bg-background/60 p-4 text-[12px] leading-relaxed text-text-secondary">{firText || "No narrative."}</pre>
              <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.15em] text-text-secondary">Real-World Location</h3>
              <Suspense fallback={<div className="mt-3 h-[300px] animate-pulse rounded-[6px] bg-surface" />}>
                <div className="mt-3"><CrimeMap height="320px" locations={mapLocations()} /></div>
              </Suspense>
            </div>
          )}
        </div>

        {/* Right panel */}
        {rightOpen && (
          <div className="w-[240px] shrink-0 overflow-y-auto border-l border-border bg-card p-4">
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

            <button
              onClick={() => setShowSource((v) => !v)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-[4px] border border-border-accent py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-text-secondary transition-colors hover:border-gold hover:text-gold"
            >
              <FileText className="h-3.5 w-3.5" /> {showSource ? "Hide" : "Show"} Source Text
            </button>
            {showSource && (
              <div className="mt-3 max-h-64 overflow-y-auto rounded-[4px] border border-border-subtle bg-background/60 p-3 text-[11px] leading-relaxed text-text-secondary whitespace-pre-wrap">
                {firText || "No FIR narrative available."}
              </div>
            )}

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
