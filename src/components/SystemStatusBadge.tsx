import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

type Status = "ok" | "degraded" | "down" | "loading";

interface HealthResp {
  ok: boolean;
  upstream?: { ok: boolean; latency_ms: number | null };
  total_ms?: number;
}

export function SystemStatusBadge() {
  const [status, setStatus] = useState<Status>("loading");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const t0 = performance.now();
        const r = await fetch("/api/v1/health", { cache: "no-store" });
        const j = (await r.json()) as HealthResp;
        if (cancelled) return;
        setLatency(j.upstream?.latency_ms ?? Math.round(performance.now() - t0));
        setStatus(j.ok ? (j.upstream?.latency_ms && j.upstream.latency_ms > 1200 ? "degraded" : "ok") : "down");
      } catch {
        if (!cancelled) { setStatus("down"); setLatency(null); }
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const color = status === "ok" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
    : status === "degraded" ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
    : status === "down" ? "text-red-400 border-red-500/30 bg-red-500/10"
    : "text-text-muted border-border-subtle bg-surface";
  const label = status === "ok" ? "OPERATIONAL"
    : status === "degraded" ? "SLOW"
    : status === "down" ? "OFFLINE" : "CHECKING";

  return (
    <div
      title={`Proxy /api/v1/health · ${label}${latency !== null ? ` · ${latency}ms` : ""}`}
      className={`hidden md:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${color}`}
    >
      <Activity className={`h-3 w-3 ${status === "ok" ? "animate-pulse" : ""}`} />
      {label}
      {latency !== null && <span className="font-mono opacity-70">{latency}ms</span>}
    </div>
  );
}