import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useDevSettings } from "@/lib/dev-settings";
import { supabase } from "@/integrations/supabase/client";
import { GripVertical, Eye, EyeOff, Save, Activity, TrendingUp, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

type Tab = "models" | "keys" | "limits" | "analytics";

function SettingsPage() {
  const { settings, update } = useDevSettings();
  const [tab, setTab] = useState<Tab>("models");
  const [revealKey, setRevealKey] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState<{ model: string; total: number; success: number; avgMs: number }[]>([]);

  useEffect(() => {
    if (tab !== "analytics") return;
    supabase.from("pipeline_attempts" as never).select("model, ok, latency_ms").limit(1000)
      .then(({ data }) => {
        const m: Record<string, { total: number; success: number; sumMs: number; n: number }> = {};
        for (const a of (data as Array<{ model: string; ok: boolean; latency_ms: number | null }>) || []) {
          if (!m[a.model]) m[a.model] = { total: 0, success: 0, sumMs: 0, n: 0 };
          m[a.model].total++;
          if (a.ok) m[a.model].success++;
          if (a.latency_ms) { m[a.model].sumMs += a.latency_ms; m[a.model].n++; }
        }
        setStats(Object.entries(m).map(([model, s]) => ({
          model, total: s.total, success: s.success, avgMs: s.n ? Math.round(s.sumMs / s.n) : 0,
        })));
      });
  }, [tab]);

  const moveModel = (idx: number, dir: -1 | 1) => {
    const arr = [...settings.modelChain];
    const t = idx + dir;
    if (t < 0 || t >= arr.length) return;
    [arr[idx], arr[t]] = [arr[t], arr[idx]];
    update({ modelChain: arr });
  };
  const toggleModel = (idx: number) => {
    const arr = [...settings.modelChain];
    arr[idx] = { ...arr[idx], enabled: !arr[idx].enabled };
    update({ modelChain: arr });
  };

  const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
    { id: "models", label: "Model Chain", icon: Zap },
    { id: "keys", label: "API Keys (BYOK)", icon: Save },
    { id: "limits", label: "Rate Limits", icon: Activity },
    { id: "analytics", label: "Usage Analytics", icon: TrendingUp },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-text-primary">Developer Settings</h1>
      <p className="mt-1 text-sm text-text-secondary">Configure your AI pipeline, manage API keys, and monitor SaaS usage.</p>
      <div className="gold-divider mt-2" style={{ width: "60px" }} />

      <div className="mt-6 flex gap-2 border-b border-border-subtle">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors ${
              tab === t.id ? "border-gold text-gold" : "border-transparent text-text-muted hover:text-text-secondary"
            }`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 max-w-3xl">
        {tab === "models" && (
          <div className="gold-top-border rounded-[4px] border border-border-subtle bg-card p-6">
            <h3 className="text-sm font-semibold text-text-primary">Fallback Order</h3>
            <p className="mt-1 text-xs text-text-muted">Pipeline tries models top-to-bottom. Disabled models are skipped.</p>
            <div className="mt-4 space-y-2">
              {settings.modelChain.map((m, i) => (
                <div key={m.id} className="flex items-center gap-3 rounded-[4px] border border-border-subtle bg-surface p-3">
                  <div className="flex flex-col">
                    <button onClick={() => moveModel(i, -1)} disabled={i === 0} className="text-text-muted hover:text-gold disabled:opacity-30">▲</button>
                    <button onClick={() => moveModel(i, 1)} disabled={i === settings.modelChain.length - 1} className="text-text-muted hover:text-gold disabled:opacity-30">▼</button>
                  </div>
                  <GripVertical className="h-4 w-4 text-text-muted" />
                  <div className="flex-1">
                    <div className="text-sm text-text-primary">{m.label}</div>
                    <div className="font-mono text-[11px] text-text-muted">{m.id}</div>
                  </div>
                  <span className="rounded-full bg-surface-overlay px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">{m.provider}</span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" checked={m.enabled} onChange={() => toggleModel(i)} className="peer sr-only" />
                    <div className="h-5 w-9 rounded-full bg-surface-overlay after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-text-muted after:transition-all peer-checked:bg-gold/30 peer-checked:after:translate-x-4 peer-checked:after:bg-gold" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "keys" && (
          <div className="gold-top-border rounded-[4px] border border-border-subtle bg-card p-6">
            <h3 className="text-sm font-semibold text-text-primary">Bring Your Own Keys</h3>
            <p className="mt-1 text-xs text-text-muted">Optional. If set, requests will use your keys instead of Lovable AI Gateway. Stored only in this browser.</p>
            <div className="mt-4 space-y-4">
              {(["openai", "google", "anthropic"] as const).map((p) => (
                <div key={p}>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">{p} API Key</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      type={revealKey[p] ? "text" : "password"}
                      value={settings.apiKeys[p]}
                      onChange={(e) => update({ apiKeys: { ...settings.apiKeys, [p]: e.target.value } })}
                      placeholder={`sk-...`}
                      className="flex-1 rounded-[2px] border border-border-accent bg-input px-4 py-3 font-mono text-sm text-text-primary focus:border-gold focus:outline-none"
                    />
                    <button onClick={() => setRevealKey({ ...revealKey, [p]: !revealKey[p] })}
                      className="rounded-[2px] border border-border-accent px-3 text-text-muted hover:text-gold">
                      {revealKey[p] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={() => toast.success("API keys saved locally")} className="rounded-[6px] bg-gold px-5 py-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-background">
                Save Keys
              </button>
            </div>
          </div>
        )}

        {tab === "limits" && (
          <div className="gold-top-border rounded-[4px] border border-border-subtle bg-card p-6">
            <h3 className="text-sm font-semibold text-text-primary">Rate Limits & Retries</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[
                { k: "maxJobsPerMinute", label: "Max Jobs / Minute", min: 1, max: 120 },
                { k: "timeoutMs", label: "Timeout (ms)", min: 5000, max: 600000 },
                { k: "retryCount", label: "Retry Count", min: 0, max: 10 },
              ].map((f) => (
                <div key={f.k}>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">{f.label}</label>
                  <input
                    type="number"
                    min={f.min}
                    max={f.max}
                    value={settings.rateLimit[f.k as keyof typeof settings.rateLimit]}
                    onChange={(e) => update({ rateLimit: { ...settings.rateLimit, [f.k]: Number(e.target.value) } })}
                    className="mt-2 w-full rounded-[2px] border border-border-accent bg-input px-4 py-3 font-mono text-sm text-text-primary focus:border-gold focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3">
              <label className="flex items-center gap-3 text-sm text-text-secondary">
                <input type="checkbox" checked={settings.preferences.autoRetryOnFail}
                  onChange={(e) => update({ preferences: { ...settings.preferences, autoRetryOnFail: e.target.checked } })} />
                Auto-retry failed pipelines
              </label>
              <label className="flex items-center gap-3 text-sm text-text-secondary">
                <input type="checkbox" checked={settings.preferences.notifyOnCompletion}
                  onChange={(e) => update({ preferences: { ...settings.preferences, notifyOnCompletion: e.target.checked } })} />
                Toast notifications on job completion
              </label>
            </div>
          </div>
        )}

        {tab === "analytics" && (
          <div className="gold-top-border rounded-[4px] border border-border-subtle bg-card p-6">
            <h3 className="text-sm font-semibold text-text-primary">Per-Model Usage</h3>
            <p className="mt-1 text-xs text-text-muted">Live from pipeline_attempts (last 1000 calls).</p>
            {stats.length === 0 ? (
              <p className="mt-4 text-xs text-text-muted">No pipeline attempts logged yet. Submit an FIR to populate.</p>
            ) : (
              <div className="mt-4 overflow-hidden rounded-[4px] border border-border-subtle">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface text-[11px] uppercase tracking-wider text-text-muted">
                      <th className="px-3 py-2 text-left">Model</th>
                      <th className="px-3 py-2 text-right">Calls</th>
                      <th className="px-3 py-2 text-right">Success</th>
                      <th className="px-3 py-2 text-right">Success Rate</th>
                      <th className="px-3 py-2 text-right">Avg Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s) => (
                      <tr key={s.model} className="border-b border-border-subtle">
                        <td className="px-3 py-2 font-mono text-[12px] text-gold">{s.model}</td>
                        <td className="px-3 py-2 text-right">{s.total}</td>
                        <td className="px-3 py-2 text-right text-emerald-400">{s.success}</td>
                        <td className="px-3 py-2 text-right">{((s.success / s.total) * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right font-mono text-text-muted">{s.avgMs}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
