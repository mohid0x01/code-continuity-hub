import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
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
  PanelLeft,
  PanelRight,
  ShieldCheck,
  Clapperboard,
  Crosshair,
  Store,
  UsersRound,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useSceneStore } from "@/stores/sceneStore";
import { useJobRealtime } from "@/hooks/useJobRealtime";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { queueVideoGeneration, uploadRenderedVideo } from "@/lib/video.functions";
import { pollAiVideo, startAiVideo } from "@/lib/ai-video.functions";
import { logAuditEvent } from "@/lib/audit.functions";
import { exportCourtReportPDF } from "@/lib/pdf-export";
import { EvidenceManager } from "@/components/EvidenceManager";
import { fetchLocationScene } from "@/lib/location-scene.functions";
import type { RealWorldScene } from "@/lib/location-scene.functions";
import { deriveRenderEntities, buildRenderTimeline, diagnoseVehicles } from "@/lib/scene-render";
import { isAiVideoProcessing, resolveAiPollResult } from "@/lib/ai-video-state";
import { deriveSceneContext, reconcileSceneEntities, reconcileSceneEvents } from "@/lib/scene-context";
import { isAiRenderMode } from "@/lib/processing-mode";

const Scene3DCanvas = lazy(() =>
  import("@/components/viewer/Scene3DCanvas").then((m) => ({ default: m.Scene3DCanvas }))
);
const CrimeMap = lazy(() =>
  import("@/components/CrimeMap").then((m) => ({ default: m.CrimeMap }))
);
// Import the pure geocoder directly — importing it from CrimeMap pulls Leaflet
// into the SSR graph and crashes server rendering with "window is not defined".
import { geocodeFirText } from "@/lib/geocode";

const searchSchema = z.object({ jobId: z.string().optional(), debug: z.coerce.boolean().optional() });

export const Route = createFileRoute("/dashboard/viewer")({
  head: () => ({
    meta: [
      { title: "Scene Reconstruction Viewer — SCENEIQ" },
      { name: "description", content: "Explore the 3D reconstruction, AI video, evidence and source map of an FIR case." },
      { property: "og:title", content: "Scene Reconstruction Viewer — SCENEIQ" },
      { property: "og:description", content: "Explore the 3D reconstruction, AI video, evidence and source map of an FIR case." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  // Never throw on odd query strings — a parse failure here renders the global
  // "This page didn't load" shell instead of the viewer.
  validateSearch: (search) => {
    const parsed = searchSchema.safeParse(search);
    return parsed.success ? parsed.data : ({} as z.infer<typeof searchSchema>);
  },
  component: SceneViewer,
  errorComponent: ViewerError,
});

function ViewerError({ error }: { error: unknown }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-400" />
      <h2 className="text-lg font-semibold text-text-primary">Viewer could not render this case</h2>
      <p className="max-w-md text-sm text-text-muted">{(error instanceof Error ? error.message : "") || "Unknown rendering error."}</p>
      <div className="mt-2 flex gap-2">
        <button onClick={() => window.location.reload()} className="rounded-[6px] bg-emerald-500/15 px-4 py-2 text-sm text-emerald-400">Try again</button>
        <Link to="/dashboard" className="rounded-[6px] border border-border-accent px-4 py-2 text-sm text-text-secondary">Back to dashboard</Link>
      </div>
    </div>
  );
}

type SceneEntity = Tables<"scene_entities">;
type SceneEvent = Tables<"scene_events">;

function SceneViewer() {
  const { jobId, debug: debugSearch } = Route.useSearch();
  const [debugOn, setDebugOn] = useState(Boolean(debugSearch));
  const job = useJobRealtime(jobId || null);
  const [entities, setEntities] = useState<SceneEntity[]>([]);
  const [events, setEvents] = useState<SceneEvent[]>([]);
  const [firText, setFirText] = useState<string>("");
  const [firFull, setFirFull] = useState<Record<string, unknown> | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [showSource, setShowSource] = useState(false);
  const [tab, setTab] = useState<"scene" | "video" | "evidence" | "source">("scene");
  const uploadVideoFn = useServerFn(uploadRenderedVideo);
  const logFn = useServerFn(logAuditEvent);
  const fetchSceneFn = useServerFn(fetchLocationScene);
  const [recording, setRecording] = useState(false);
  const [realWorld, setRealWorld] = useState<RealWorldScene | null>(null);
  const [realWorldLoading, setRealWorldLoading] = useState(false);
  const [photoreal, setPhotoreal] = useState(true);
  const [tilesStatus, setTilesStatus] = useState<{ s: "loading" | "ready" | "failed"; msg?: string } | null>(null);
  const onTilesStatus = useCallback((s: "loading" | "ready" | "failed", msg?: string) => setTilesStatus({ s, msg }), []);

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

  const extractedRenderEntities = useMemo(() => deriveRenderEntities(entities, firText, jobId), [entities, firText, jobId]);
  const sceneContext = useMemo(() => deriveSceneContext(extractedRenderEntities, firText), [extractedRenderEntities, firText]);
  const renderEntities = useMemo(
    () => reconcileSceneEntities(extractedRenderEntities, firText, jobId, sceneContext),
    [extractedRenderEntities, firText, jobId, sceneContext],
  );
  const renderEvents = useMemo(() => reconcileSceneEvents(renderEntities, events, sceneContext), [renderEntities, events, sceneContext]);
  const renderTimeline = buildRenderTimeline({ realWorld, entities, renderEntities, events: renderEvents });
  const vehicleDiagnostics = diagnoseVehicles(renderEntities, firText);

  useEffect(() => {
    setTotalEvents(renderEvents.length);
    if (useSceneStore.getState().currentEvent >= renderEvents.length) setCurrentEvent(Math.max(0, renderEvents.length - 1));
  }, [renderEvents.length, setTotalEvents, setCurrentEvent]);

  const handleDownload = useCallback(() => {
    const payload = { job, entities, events, renderEvents, sceneContext, firText };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconstruction-${jobId?.slice(0, 8) || "scene"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Reconstruction downloaded");
  }, [job, entities, events, renderEvents, sceneContext, firText, jobId]);

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
    if (!playing || renderEvents.length === 0) return;
    const interval = setInterval(() => {
      const store = useSceneStore.getState();
      if (store.currentEvent >= store.totalEvents - 1) {
        setPlaying(false);
      } else {
        nextEvent();
      }
    }, 2000 / speed);
    return () => clearInterval(interval);
  }, [playing, speed, renderEvents.length, setPlaying, nextEvent]);

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
  const videoStatusRaw = (job as Record<string, unknown>)?.video_status as string | null | undefined;
  const [aiState, setAiState] = useState<{ status: string; url?: string | null; error?: string; progress?: number } | null>(null);
  const videoUrl2 = aiState?.url ?? videoUrl;
  const videoStatus = aiState?.status ?? videoStatusRaw;
  const aiMode = isAiRenderMode(job?.render_mode);
  const aiError = aiState?.error ?? ((job as Record<string, unknown>)?.ai_video_error as string | null | undefined);
  const pollAiFn = useServerFn(pollAiVideo);
  const startAiFn = useServerFn(startAiVideo);
  // Poll the AI clip while it renders; the server stores the MP4 then returns its URL.
  useEffect(() => {
    if (!jobId || !aiMode || !isAiVideoProcessing(videoStatus)) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const r = await pollAiFn({ data: { jobId } });
        if (stop) return;
        setAiState(resolveAiPollResult(r as never));
        if (r.status === "processing") timer = setTimeout(tick, 8000);
      } catch (e) { if (!stop) setAiState({ status: "ai_failed", error: e instanceof Error ? e.message : "Poll failed" }); }
    };
    tick();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [jobId, videoStatus, pollAiFn, aiMode]);
  const handleAiVideo = async () => {
    if (!jobId) return;
    try { await startAiFn({ data: { jobId } }); setAiState({ status: "processing" }); }
    catch (e) { setAiState({ status: "ai_failed", error: e instanceof Error ? e.message : "Failed" }); }
  };

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

  // Fetch real-world geometry once the FIR lat/lng is known. The server merges
  // OSM + Google Maps data and always keeps the scene anchored to this pin.
  useEffect(() => {
    if (!primaryPin) return;
    let cancelled = false;
    setRealWorldLoading(true);
    fetchSceneFn({ data: { lat: primaryPin.lat, lng: primaryPin.lng, radius: 300 } })
      .then((scene) => { if (!cancelled) setRealWorld(scene as RealWorldScene); })
      .catch(() => {
        if (!cancelled) {
          setRealWorld({
            anchor: { lat: primaryPin.lat, lng: primaryPin.lng },
            buildings: [],
            roads: [],
            trees: [],
            landmarks: [],
            streetLights: [],
            staticMapUrl: null,
            address: primaryPin.description ?? primaryPin.label,
            radiusMeters: 300,
            status: "unavailable",
            source: "inferred",
            diagnostics: { osmElements: 0, googlePlaces: 0, googleRoadPoints: 0, synthesizedBuildings: 0, synthesizedRoads: 0 },
          });
        }
      })
      .finally(() => { if (!cancelled) setRealWorldLoading(false); });
    return () => { cancelled = true; };
  }, [primaryPin?.lat, primaryPin?.lng, fetchSceneFn]);

  const renderActorEntities = renderEntities.filter(e => e.entity_type === "actor");
  const renderVehicleEntities = renderEntities.filter(e => e.entity_type === "vehicle");

  const mapLocations = () => geocodeFirText(
    firText,
    locationEntities.map((l) => l.label),
    { primary: primaryPin },
  );

  const handleGenerateVideo = useCallback(async () => {
    if (!jobId) return;
    if (renderEvents.length === 0) { toast.error("No scene events to render"); return; }

    // Ensure we're on the 3D tab so the canvas is mounted & visible.
    setTab("scene");
    // Restart playback from event 0 so recording captures the whole story.
    setCurrentEvent(0);
    setSpeed(1);
    setPlaying(true);
    setRecording(true);

    const durationSec = Math.min(30, Math.max(6, renderEvents.length * 2 + 2));

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
  }, [jobId, renderEvents.length, uploadVideoFn, logFn, setCurrentEvent, setPlaying, setSpeed]);

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
      <div className="flex h-14 items-center justify-between border-b border-border-subtle bg-card/80 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-text-muted hover:text-gold"><ArrowLeft className="h-4 w-4" /></Link>
          <span className="font-mono text-sm text-gold">{String(caseNumber)}</span>
          {isLoading && <Loader className="h-3 w-3 animate-spin text-blue-400" />}
        </div>
        <span className="text-sm text-text-secondary">
          {job?.status === "completed" ? "Scene Reconstruction" : `Pipeline: ${job?.status || "loading"}`}
        </span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setLeftOpen((v) => !v)} title="Toggle case panel" className={`rounded-md p-2 ${leftOpen ? "bg-gold/10 text-gold" : "text-text-muted hover:bg-surface"}`}><PanelLeft className="h-4 w-4" /></button>
          <button onClick={() => setRightOpen((v) => !v)} title="Toggle reconstruction panel" className={`rounded-md p-2 ${rightOpen ? "bg-gold/10 text-gold" : "text-text-muted hover:bg-surface"}`}><PanelRight className="h-4 w-4" /></button>
          <span className="mx-1 h-5 w-px bg-border-subtle" />
          <button onClick={() => setDebugOn((v) => !v)} title="Toggle real-location debug overlay"
            className={`rounded-[4px] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${debugOn ? "bg-emerald-500/15 text-emerald-400" : "text-text-muted hover:text-text-secondary"}`}>
            Debug
          </button>
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
          <div className="hidden w-[264px] shrink-0 overflow-y-auto border-r border-border-subtle bg-card/80 p-4 backdrop-blur-xl lg:block">
            <section className="mb-5 rounded-lg border border-gold/25 bg-gold/[0.06] p-3">
              <div className="flex items-center gap-2 text-gold"><Crosshair className="h-4 w-4" /><h3 className="text-[11px] font-semibold uppercase tracking-[0.13em]">FIR Scene Match</h3></div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-card px-2 py-1 text-[10px] text-text-secondary"><UsersRound className="h-3 w-3" />{sceneContext.summary[0]}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-card px-2 py-1 text-[10px] text-text-secondary"><Store className="h-3 w-3" />{sceneContext.setting.replace("_", " ")}</span>
                {sceneContext.weapons.map((weapon) => <span key={weapon} className="rounded-full border border-gold/30 bg-gold/10 px-2 py-1 text-[10px] font-semibold uppercase text-gold">{weapon}</span>)}
              </div>
              {sceneContext.entering && <p className="mt-2 text-[10px] leading-relaxed text-text-muted">Each suspect has a separate animated entrance event.</p>}
            </section>
            <h3 className="label-uppercase mb-3">Scene Entities</h3>
            <div className="space-y-2">
              {[...renderActorEntities, ...renderVehicleEntities].map((e) => (
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
              FIR pin, statement locations, and mapped surroundings are tied to the selected incident coordinates.
            </p>
          </div>
        )}

        {/* 3D Canvas */}
        <div className="relative min-w-0 flex-1">
          {/* Tab bar */}
          <div className="flex h-12 items-center gap-1 overflow-x-auto border-b border-border-subtle bg-card/70 px-3 backdrop-blur-xl">
            {([
              { id: "scene", label: "3D Scene", icon: Box },
              { id: "video", label: aiMode ? "AI Video" : "Video", icon: Film },
              { id: "evidence", label: "Evidence", icon: Paperclip },
              { id: "source", label: "Source & Map", icon: FileText },
            ] as const).map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${tab === t.id ? "bg-gold/10 text-gold shadow-[inset_0_0_0_1px_var(--color-gold-dim)]" : "text-text-muted hover:bg-surface hover:text-text-secondary"}`}>
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
                <Scene3DCanvas entities={renderEntities} events={renderEvents} realWorld={realWorld} context={sceneContext} debug={debugOn} photoreal={photoreal} onPhotorealStatus={onTilesStatus} />
              </Suspense>

              {realWorld && !sceneContext.interior && (
                <button
                  type="button"
                  onClick={() => { setPhotoreal((v) => !v); setTilesStatus(null); }}
                  className="glass-input absolute right-4 top-14 rounded-[4px] px-3 py-1.5 text-[10px] uppercase tracking-[0.1em]"
                  title="Switch between Google photorealistic 3D city and the map-built 3D model"
                >
                  {photoreal
                    ? tilesStatus?.s === "failed"
                      ? "Google 3D unavailable · map model shown"
                      : tilesStatus?.s === "ready"
                        ? "Google 3D City ✓ · switch to map model"
                        : "Loading Google 3D City…"
                    : "Map model · switch to Google 3D City"}
                </button>
              )}

              {/* Real-world overlay badge */}
              <div className="absolute left-4 top-14 rounded-[4px] border border-emerald-500/30 bg-background/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] backdrop-blur">
                {realWorldLoading ? (
                  <span className="text-text-muted">Loading real-world map…</span>
                ) : realWorld ? (
                    <span className="text-emerald-400">
                    {sceneContext.interior
                      ? `FIR ${sceneContext.setting.replace("_", " ").toUpperCase()} INTERIOR · REAL LOCATION ANCHORED`
                      : `Real Location · ${realWorld.source.toUpperCase()} · ${realWorld.buildings.length} buildings · ${realWorld.roads.length} roads · ${realWorld.landmarks.length} places · r=${realWorld.radiusMeters}m`}
                  </span>
                ) : (
                  <span className="text-amber-400">Waiting for selected location coordinates…</span>
                )}
              </div>

              {debugOn && (
                <div className="absolute left-4 top-24 max-h-[70%] w-[320px] overflow-y-auto rounded-[6px] border border-emerald-500/30 bg-background/85 p-3 text-[11px] backdrop-blur">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-400">Real-location debug</p>
                  <div className="space-y-1 font-mono text-text-secondary">
                    <div>lat/lng: {primaryPin ? `${primaryPin.lat.toFixed(6)}, ${primaryPin.lng.toFixed(6)}` : "none"}</div>
                    <div>address: {realWorld?.address ?? "—"}</div>
                    <div>fetch: {realWorldLoading ? "loading" : realWorld?.status ?? "idle"} · source: {realWorld?.source ?? "—"}</div>
                    <div>radius: {realWorld?.radiusMeters ?? "—"}m · static map: {realWorld?.staticMapUrl ? "yes" : "no"}</div>
                    <div>osm elements: {realWorld?.diagnostics.osmElements ?? 0}</div>
                    <div>google places: {realWorld?.diagnostics.googlePlaces ?? 0} · road pts: {realWorld?.diagnostics.googleRoadPoints ?? 0}</div>
                    <div>synth buildings: {realWorld?.diagnostics.synthesizedBuildings ?? 0} · synth roads: {realWorld?.diagnostics.synthesizedRoads ?? 0}</div>
                  </div>

                  <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-400">Vehicle diagnostics</p>
                  {vehicleDiagnostics.length === 0 ? (
                    <p className="text-text-muted">No vehicle mentioned in this statement.</p>
                  ) : (
                    vehicleDiagnostics.map((v) => (
                      <div key={v.id} className={`mb-1 rounded-[4px] border p-2 ${v.visible ? "border-emerald-500/30 text-emerald-300" : "border-red-500/30 text-red-300"}`}>
                        <div className="font-semibold">{v.label}{v.inferred ? " (inferred)" : ""}</div>
                        <div className="font-mono text-[10px]">xyz {v.position.map((n) => n.toFixed(1)).join(", ")}</div>
                        <div className="text-[10px]">{v.reason}</div>
                      </div>
                    ))
                  )}

                  <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-400">Render timeline</p>
                  {renderTimeline.map((s) => (
                    <div key={s.id} className="mb-1 border-l-2 pl-2" style={{ borderColor: s.status === "ok" ? "#22c55e" : s.status === "warn" ? "#f59e0b" : "#64748b" }}>
                      <div className="text-text-primary">{s.title}</div>
                      <div className="text-[10px] text-text-muted">{s.detail}</div>
                    </div>
                  ))}
                </div>
              )}

              {realWorld?.staticMapUrl && (
                <div className="absolute right-4 top-24 w-52 overflow-hidden rounded-[6px] border border-gold/30 bg-background/70 backdrop-blur">
                  <img src={realWorld.staticMapUrl} alt="Location satellite preview" className="block w-full" />
                  <div className="px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-gold">Satellite Preview</div>
                </div>
              )}

              {renderEvents.length > 0 && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-[4px] border border-gold/20 bg-background/80 px-6 py-3 backdrop-blur-md">
                  <p className="max-w-md text-center text-sm text-text-primary">
                    {renderEvents[currentEvent]?.description || ""}
                  </p>
                </div>
              )}
            </>
          ) : tab === "video" ? (
            <div className="h-[calc(100%-3rem)] overflow-y-auto p-6 lg:p-10">
              {videoUrl2 ? (
                <div className="mx-auto max-w-5xl">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div><p className="label-uppercase">Incident recording</p><h3 className="mt-1 text-xl font-semibold text-text-primary">Reconstruction video</h3></div>
                    <span className="rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold">Ready</span>
                  </div>
                  <video src={videoUrl2} controls className="max-h-[70vh] w-full rounded-xl border border-border-subtle bg-background shadow-2xl" />
                </div>
              ) : (
                <div className="mx-auto max-w-4xl">
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl border border-gold/20 bg-gold/10 p-3"><Film className="h-6 w-6 text-gold" /></div>
                    <div><p className="label-uppercase">Video workspace</p><h3 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">Turn this timeline into an incident video</h3><p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">{aiMode ? "Use the exact 3D scene for a deterministic recording, or request one cinematic Veo 3.1 reconstruction from the same case data." : "Record the exact SCENEIQ Engine 3D scene. This Engine job has no AI video option and makes no AI calls."}</p></div>
                  </div>
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-text-secondary"><span className="h-1.5 w-1.5 rounded-full bg-gold" />{videoStatus ?? "not started"}{(videoStatus === "processing" || videoStatus === "ai_processing") ? ` · ${aiState?.progress ?? 0}%` : ""}</div>
                  <div className={`mt-6 grid gap-4 ${aiMode ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                    <section className="rounded-xl border border-border-subtle bg-card/80 p-5 shadow-xl">
                      <Clapperboard className="h-5 w-5 text-gold" />
                      <h4 className="mt-4 font-semibold text-text-primary">Record the 3D scene</h4>
                      <p className="mt-2 min-h-16 text-sm leading-relaxed text-text-muted">Captures the mapped location, rigged actors, vehicle and every timeline event at 60 fps. Best for a repeatable case record.</p>
                      <button onClick={handleGenerateVideo} disabled={recording} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-3 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
                        {recording ? <Loader className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{recording ? "Recording scene…" : "Generate 3D video"}
                      </button>
                    </section>
                    {aiMode && (
                      <section className="rounded-xl border border-border-subtle bg-card/80 p-5 shadow-xl">
                        <ShieldCheck className="h-5 w-5 text-gold" />
                        <h4 className="mt-4 font-semibold text-text-primary">Cinematic AI render · Veo 3.1</h4>
                        <p className="mt-2 min-h-16 text-sm leading-relaxed text-text-muted">Creates one 1080p clip from the FIR location, people, vehicles and actions. The finished MP4 is saved to private case storage.</p>
                        <button onClick={handleAiVideo} disabled={isAiVideoProcessing(videoStatus)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gold/35 bg-gold/10 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gold transition hover:bg-gold/15 disabled:opacity-50">
                          {(videoStatus === "processing" || videoStatus === "ai_processing") && <Loader className="h-4 w-4 animate-spin" />}{videoStatus === "processing" || videoStatus === "ai_processing" ? "AI rendering…" : videoStatus === "ai_failed" ? "Start a new AI render" : "Generate with AI"}
                        </button>
                      </section>
                    )}
                  </div>
                  {aiMode && aiError && (videoStatus === "ai_failed" || videoStatus === "failed") && (
                    <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">This AI request did not produce a video</p><p className="mt-1 leading-relaxed">{aiError}</p><p className="mt-2 text-xs opacity-80">The request was not automatically retried or rephrased. You can still record the 3D scene above.</p></div>
                    </div>
                  )}
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
          <div className="hidden w-[272px] shrink-0 overflow-y-auto border-l border-border-subtle bg-card/80 p-4 backdrop-blur-xl xl:block">
            <h3 className="label-uppercase mb-3">Reconstruction Data</h3>

            <div className="space-y-3">
              {[...renderActorEntities, ...renderVehicleEntities].map((e) => (
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
              <div>Model: <span className="font-mono text-text-secondary">{aiMode ? job?.llm_model || "—" : "SCENEIQ Engine · No AI"}</span></div>
              <div>Processing: <span className="font-mono text-text-secondary">{job?.processing_time_ms ? `${(job.processing_time_ms / 1000).toFixed(1)}s` : "—"}</span></div>
              <div>Entities: <span className="font-mono text-text-secondary">{entities.length}</span></div>
              <div>Events: <span className="font-mono text-text-secondary">{events.length}</span></div>
            </div>

            <h3 className="label-uppercase mb-3 mt-6">How this video is built</h3>
            <div className="space-y-2">
              {renderTimeline.map((s) => (
                <div key={`panel-${s.id}`} className="rounded-[4px] border border-border-subtle bg-card p-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${s.status === "ok" ? "bg-emerald-400" : s.status === "warn" ? "bg-amber-400" : "bg-text-muted"}`} />
                    <span className="text-[11px] font-semibold text-text-primary">{s.title}</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-text-muted">{s.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom timeline */}
      <div className="border-t border-border-subtle bg-card/85 px-6 py-4 shadow-[0_-16px_40px_color-mix(in_oklab,var(--background)_35%,transparent)] backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[12px] text-gold">
            EVENT {events.length > 0 ? currentEvent + 1 : 0} / {totalEvents}
          </span>

          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentEvent(0)} className="text-text-muted hover:text-gold"><ChevronLeft className="h-4 w-4" /><ChevronLeft className="-ml-3 h-4 w-4" /></button>
            <button onClick={prevEvent} aria-label="Previous event" className="text-text-muted hover:text-gold"><ChevronLeft className="h-4 w-4" /></button>
            <button
              onClick={() => setPlaying(!playing)}
              aria-label={playing ? "Pause timeline" : "Play timeline"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-primary-foreground shadow-lg transition hover:scale-105"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button onClick={nextEvent} aria-label="Next event" className="text-text-muted hover:text-gold"><ChevronRight className="h-4 w-4" /></button>
            <button onClick={() => setCurrentEvent(totalEvents - 1)} className="text-text-muted hover:text-gold"><ChevronRight className="h-4 w-4" /><ChevronRight className="-ml-3 h-4 w-4" /></button>
          </div>

          {/* Scrubber */}
          <div className="flex-1">
            <div className="relative h-1.5 rounded-full bg-border-subtle">
              <div className="h-full rounded-full bg-gold transition-all" style={{ width: totalEvents > 0 ? `${((currentEvent + 1) / totalEvents) * 100}%` : "0%" }} />
              {renderEvents.map((_, i) => (
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
        <p className="mt-2 text-[12px] text-text-muted">{renderEvents[currentEvent]?.description || "No events loaded"}</p>
      </div>
    </div>
  );
}
