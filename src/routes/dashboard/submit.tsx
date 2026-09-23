import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { submitFir, runMockPipeline } from "@/lib/fir.functions";
import { supabase } from "@/integrations/supabase/client";
import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";
import { Lock, Sparkles, FileText } from "lucide-react";

// Load all template files from /Commands at build time.
const templateModules = import.meta.glob("/Commands/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const templates = Object.entries(templateModules)
  .map(([path, raw]) => {
    const slug = path.split("/").pop()!.replace(/\.txt$/, "");
    const firstLine = raw.split("\n").find((l) => l.startsWith("#"));
    const title = firstLine ? firstLine.replace(/^#\s*/, "").trim() : slug;
    const body = raw.replace(/^#.*\n\n?/, "").trim();
    return { slug, title, body };
  })
  .sort((a, b) => a.title.localeCompare(b.title));

export const Route = createFileRoute("/dashboard/submit")({
  head: () => ({
    meta: [
      { title: "Submit New FIR — SCENEIQ" },
      { name: "description", content: "File an FIR narrative and pick the exact incident location for 3D reconstruction." },
      { property: "og:title", content: "Submit New FIR — SCENEIQ" },
      { property: "og:description", content: "File an FIR narrative and pick the exact incident location for 3D reconstruction." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubmitFIR,
});

const incidentTypes = [
  { label: "Theft", value: "theft" },
  { label: "Assault", value: "assault" },
  { label: "Vehicular", value: "vehicular" },
  { label: "Property", value: "property" },
  { label: "Kidnapping", value: "kidnapping" },
  { label: "Robbery", value: "robbery" },
  { label: "Other", value: "other" },
] as const;
const pipelineStages = [
  "Preprocessing",
  "Entity Extraction",
  "Spatial Resolution",
  "Timeline Sequencing",
  "Scene Generation",
  "Video Render",
];
const tips = [
  "Include all actor descriptions as stated",
  "Mention locations by name or landmark",
  "Include directional references if present",
  "Roman Urdu is fully supported",
  "Minimum 50 words for accurate reconstruction",
];

function SubmitFIR() {
  const [narrative, setNarrative] = useState("");
  const [templateSlug, setTemplateSlug] = useState("");
  const [previewCaseNumber, setPreviewCaseNumber] = useState("FIR-2026-XXXXXX");
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentType, setIncidentType] = useState<typeof incidentTypes[number]["value"]>("assault");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Show a preview of the next case number (purely cosmetic — real number is
  // assigned by the database when the row is inserted).
  useEffect(() => {
    const year = new Date().getFullYear();
    const rand = String(Math.floor(100000 + Math.random() * 900000));
    setPreviewCaseNumber(`FIR-${year}-${rand}`);
  }, []);

  const submitFirFn = useServerFn(submitFir);
  const runPipelineFn = useServerFn(runMockPipeline);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (narrative.length < 10) {
      setError("Narrative must be at least 10 characters.");
      return;
    }
    if (!location) {
      setError("Please pick a city and area from the map suggestions.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/login" });
        return;
      }

      const result = await submitFirFn({
        data: {
          city: location.city,
          area: location.area,
          latitude: location.latitude,
          longitude: location.longitude,
          formattedAddress: location.formattedAddress,
          incidentDate: incidentDate || null,
          incidentType,
          narrative,
        },
      });

      // Fire pipeline in background (don't await)
      runPipelineFn({ data: { jobId: result.jobId } }).catch(console.error);

      // Navigate to processing page with jobId
      navigate({ to: "/dashboard/processing", search: { jobId: result.jobId } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit FIR");
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <motion.div
        className="lg:col-span-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="font-display text-3xl font-bold text-text-primary">
          New Incident Reconstruction
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          AI will extract entities, build a 3D scene, and render a video re-enactment.
        </p>
        <div className="gold-divider mt-2" style={{ width: "60px" }} />

        {error && (
          <div className="mt-4 rounded-[4px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {/* Template picker */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              <FileText className="h-3 w-3" /> Load FIR Template ({templates.length} available)
            </label>
            <select
              value={templateSlug}
              onChange={(e) => {
                const slug = e.target.value;
                setTemplateSlug(slug);
                const t = templates.find((x) => x.slug === slug);
                if (t) setNarrative(t.body);
              }}
              className="glass-input mt-2 w-full rounded-[6px] px-4 py-3 text-sm text-text-primary"
            >
              <option value="">— Select a template to prefill narrative —</option>
              {templates.map((t) => (
                <option key={t.slug} value={t.slug}>{t.title}</option>
              ))}
            </select>
          </div>

          {/* Auto case number — read-only */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              <Lock className="h-3 w-3" /> Case Number (Auto-generated)
            </label>
            <div className="relative mt-2">
              <input
                type="text"
                value={previewCaseNumber}
                readOnly
                aria-readonly
                tabIndex={-1}
                className="glass-input w-full cursor-not-allowed rounded-[6px] px-4 py-3 pr-24 font-mono text-sm text-gold"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-success">
                Auto
              </span>
            </div>
            <p className="mt-1.5 text-[10px] text-text-muted">
              Final case number is assigned by the system at submission. Preview shown above.
            </p>
          </div>

          {/* Location: Google Maps cascading picker */}
          <LocationPicker onChange={setLocation} />

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">Date of Incident</label>
              <input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="glass-input mt-2 w-full rounded-[6px] px-4 py-3 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">Incident Type</label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as typeof incidentType)}
                className="glass-input mt-2 w-full rounded-[6px] px-4 py-3 text-sm text-text-primary"
              >
                {incidentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">FIR Narrative</label>
            <div className="relative mt-2">
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                rows={10}
                placeholder="Enter the full FIR narrative here. Roman Urdu and English both supported. Example: Mulzim Ahmed ne raat 11 baje Bazaar Road par victim Imran ko loha rod se mara..."
                className="glass-input w-full resize-none rounded-[6px] px-4 py-3 text-sm leading-relaxed text-text-primary placeholder:text-text-muted"
              />
              <span className="absolute bottom-3 right-3 font-mono text-[11px] text-text-muted">
                {narrative.length} chars
              </span>
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={submitting || !location}
            className="glass-button-primary w-full rounded-[6px] py-3.5 text-[13px] font-semibold uppercase tracking-[0.1em] disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {submitting ? "Submitting…" : (
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Reconstruct Scene
              </span>
            )}
          </motion.button>
        </form>
      </motion.div>

      {/* Right panel */}
      <motion.div
        className="lg:col-span-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="gold-top-border rounded-[4px] border border-border-subtle bg-card p-6">
          <h3 className="text-sm font-semibold text-text-primary">Submission Guidelines</h3>
          <div className="mt-4 space-y-3">
            {tips.map((tip) => (
              <div key={tip} className="flex items-start gap-2">
                <span className="mt-0.5 text-gold">✦</span>
                <span className="text-sm text-text-secondary">{tip}</span>
              </div>
            ))}
          </div>

          <div className="gold-divider my-6" style={{ width: "100%" }} />

          <h4 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">Pipeline Stages</h4>
          <div className="mt-4 space-y-3">
            {pipelineStages.map((stage, i) => (
              <div key={stage} className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border-accent text-[10px] font-semibold text-text-muted">
                  {i + 1}
                </div>
                <span className="text-sm text-text-secondary">{stage}</span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center font-mono text-[11px] text-text-muted">
            Average processing time: 18-30 seconds
          </p>
        </div>
      </motion.div>
    </div>
  );
}
