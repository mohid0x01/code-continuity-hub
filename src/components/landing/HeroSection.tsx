import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, ShieldCheck, Cpu, Video } from "lucide-react";
import { PakGovEmblem } from "@/components/PakGovEmblem";

const pillStats = [
  { icon: Cpu, label: "AI Scene Engine" },
  { icon: Video, label: "10s 3D Video" },
  { icon: ShieldCheck, label: "SuperAdmin Secured" },
];

export function HeroSection() {
  return (
    <section id="home" className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 bg-[oklch(0.05_0_0)]" />
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{ backgroundImage: "radial-gradient(circle at 50% 50%, oklch(0.78 0.16 155 / 0.35), transparent 55%)" }}
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background to-transparent" />

      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1 w-1 rounded-full bg-emerald-400/40"
          style={{ left: `${(i * 17 + 8) % 95}%`, top: `${(i * 13 + 20) % 80}%` }}
          animate={{ y: [0, -20, 0], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}

      <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.06] px-4 py-1.5 backdrop-blur-md"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Pakistan Govt · Live Pilot
          </span>
          <PakGovEmblem size={16} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display mx-auto mt-8 max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-7xl"
        >
          The AI that turns every FIR into a{" "}
          <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-200 bg-clip-text text-transparent">
            3D crime scene
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-text-secondary md:text-lg"
        >
          SceneIQ ingests an FIR narrative, extracts every actor, vehicle, and event,
          then renders a photoreal 10-second incident video pinned to real Pakistan
          coordinates — in under a minute.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            to="/login"
            className="group inline-flex items-center gap-2 rounded-[10px] bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
          >
            <Sparkles className="h-4 w-4" />
            Open SuperAdmin Console
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/[0.08]"
          >
            See how it works
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-14 flex flex-wrap items-center justify-center gap-3"
        >
          {pillStats.map((s) => (
            <motion.div
              key={s.label}
              whileHover={{ y: -2 }}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[12px] text-text-secondary backdrop-blur-md"
            >
              <s.icon className="h-3.5 w-3.5 text-emerald-400" />
              {s.label}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
