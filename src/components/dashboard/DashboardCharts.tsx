import { useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend,
} from "recharts";

interface Job {
  id: string;
  status: string;
  created_at: string;
  processing_time_ms?: number | null;
  fir_records?: { district?: string | null; incident_type?: string | null } | null;
}

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"];

export function DashboardCharts({ jobs }: { jobs: Job[] }) {
  const trend = useMemo(() => {
    const buckets: Record<string, { day: string; jobs: number; completed: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(5, 10);
      buckets[key] = { day: key, jobs: 0, completed: 0 };
    }
    for (const j of jobs) {
      const key = new Date(j.created_at).toISOString().slice(5, 10);
      if (buckets[key]) {
        buckets[key].jobs++;
        if (j.status === "completed") buckets[key].completed++;
      }
    }
    return Object.values(buckets);
  }, [jobs]);

  const byDistrict = useMemo(() => {
    const m: Record<string, number> = {};
    for (const j of jobs) {
      const d = j.fir_records?.district || "Unknown";
      m[d] = (m[d] || 0) + 1;
    }
    return Object.entries(m).map(([name, value]) => ({ name, value })).slice(0, 6);
  }, [jobs]);

  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const j of jobs) {
      const t = j.fir_records?.incident_type || "other";
      m[t] = (m[t] || 0) + 1;
    }
    return Object.entries(m).map(([name, count]) => ({ name, count }));
  }, [jobs]);

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      <div className="gold-top-border rounded-[4px] border border-border-subtle bg-card p-5 lg:col-span-2">
        <h3 className="label-uppercase mb-4">7-Day Submission Trend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trend}>
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" stroke="#888" fontSize={11} />
            <YAxis stroke="#888" fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 6 }} />
            <Area type="monotone" dataKey="jobs" stroke="#3b82f6" fill="url(#g1)" strokeWidth={2} />
            <Area type="monotone" dataKey="completed" stroke="#22c55e" fill="url(#g2)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="gold-top-border rounded-[4px] border border-border-subtle bg-card p-5">
        <h3 className="label-uppercase mb-4">Cases by District</h3>
        {byDistrict.length === 0 ? (
          <p className="text-xs text-text-muted">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byDistrict} dataKey="value" nameKey="name" outerRadius={70} innerRadius={40}>
                {byDistrict.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 6 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="gold-top-border rounded-[4px] border border-border-subtle bg-card p-5 lg:col-span-3">
        <h3 className="label-uppercase mb-4">Incidents by Type</h3>
        {byType.length === 0 ? (
          <p className="text-xs text-text-muted">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byType}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 6 }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
