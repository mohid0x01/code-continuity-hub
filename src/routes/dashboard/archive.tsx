import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Search, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/dashboard/archive")({
  component: CaseArchive,
});

const cases = [
  { id: "FIR-2024-SHK-00142", type: "Assault", date: "2024-12-18", district: "Khairpur", actors: 4, vehicles: 1, locations: 3, status: "completed" },
  { id: "FIR-2024-SHK-00141", type: "Theft", date: "2024-12-17", district: "Khairpur", actors: 2, vehicles: 2, locations: 2, status: "processing" },
  { id: "FIR-2024-SHK-00140", type: "Robbery", date: "2024-12-16", district: "Sukkur", actors: 5, vehicles: 1, locations: 4, status: "completed" },
  { id: "FIR-2024-SHK-00139", type: "Vehicular", date: "2024-12-15", district: "Larkana", actors: 3, vehicles: 3, locations: 2, status: "completed" },
  { id: "FIR-2024-SHK-00138", type: "Property", date: "2024-12-14", district: "Khairpur", actors: 2, vehicles: 0, locations: 1, status: "failed" },
  { id: "FIR-2024-SHK-00137", type: "Kidnapping", date: "2024-12-13", district: "Hyderabad", actors: 6, vehicles: 2, locations: 5, status: "completed" },
];

const districts = ["All Districts", "Khairpur", "Sukkur", "Larkana", "Hyderabad"];
const statusFilters = ["All Status", "Completed", "Processing", "Failed"];
const typeFilters = ["All Types", "Assault", "Theft", "Robbery", "Vehicular", "Property", "Kidnapping"];

const statusStyles: Record<string, string> = {
  completed: "bg-gold/10 text-gold",
  processing: "bg-processing/20 text-blue-400",
  failed: "bg-destructive/10 text-destructive",
};

function CaseArchive() {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-text-primary">Case Archive</h1>
      <div className="gold-divider mt-2" style={{ width: "60px" }} />

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search by case number, district..."
            className="w-full rounded-[2px] border border-border-accent bg-input py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>
        {[districts, typeFilters, statusFilters].map((options, i) => (
          <select key={i} className="rounded-[2px] border border-border-accent bg-input px-4 py-2.5 text-sm text-text-secondary focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold">
            {options.map(o => <option key={o}>{o}</option>)}
          </select>
        ))}
      </div>

      {/* Card grid */}
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {cases.map((c, i) => (
          <motion.div
            key={c.id}
            className="group gold-top-border cursor-pointer rounded-[4px] border border-border-subtle bg-card p-5 transition-all duration-250 hover:border-gold/30 hover:-translate-y-0.5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <div className="flex items-start justify-between">
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] ${statusStyles[c.status]}`}>
                {c.status}
              </span>
              <span className="font-mono text-[12px] text-gold">{c.id}</span>
            </div>

            <div className="mt-3">
              <span className="inline-block rounded-[2px] bg-surface px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary">
                {c.type}
              </span>
            </div>

            <div className="mt-3 space-y-1 text-[12px] text-text-muted">
              <div>{c.district} · {c.date}</div>
              <div>{c.actors} actors · {c.vehicles} vehicles · {c.locations} locations</div>
            </div>

            {c.status === "completed" && (
              <Link
                to="/dashboard/viewer"
                className="mt-4 flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-gold opacity-0 transition-opacity group-hover:opacity-100"
              >
                View Reconstruction <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      <div className="mt-8 flex justify-center gap-2">
        {[1, 2, 3].map((p) => (
          <button
            key={p}
            className={`h-8 w-8 rounded-[4px] text-[13px] font-semibold ${
              p === 1 ? "bg-gold text-background" : "text-text-muted hover:text-gold"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
