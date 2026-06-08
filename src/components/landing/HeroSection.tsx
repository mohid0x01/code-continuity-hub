import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Play, Sparkles, Shield, Zap, Globe } from "lucide-react";
import { GoldDivider } from "@/components/GoldDivider";
import heroImage from "@/assets/hero-officer.jpg";

const stats = [
  { icon: Zap, label: "Avg. Render", value: "< 30s" },
  { icon: Shield, label: "Provinces", value: "4" },
  { icon: Globe, label: "Languages", value: "EN · UR" },
];

export function HeroSection() {
  return (
    <section id="home" className="relative flex min-h-screen items-center overflow-hidden pt-16">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Officer silhouette"
          className="absolute right-0 top-0 h-full w-full object-cover object-right md:w-[60%]"
          width={960}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/98 to-background/40 md:via-background/95" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>


      {/* Floating particles */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-gold/30"
          style={{
            width: 2 + (i % 4),
            height: 2 + (i % 4),
            left: `${(i * 8 + 10) % 90}%`,
            top: `${(i * 13 + 15) % 85}%`,
          }}
          animate={{
            y: [0, -40, 0],
            opacity: [0.15, 0.7, 0.15],
          }}
          transition={{ repeat: Infinity, duration: 4 + (i % 4), ease: "easeInOut", delay: i * 0.4 }}
        />
      ))}

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <motion.div
          className="max-w-full px-2 md:max-w-[60%] md:px-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Shine badge */}
          <motion.div
            className="shine-badge inline-flex items-center gap-2 rounded-full px-4 py-1.5"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-light">
              Powered by AI · For Pakistan Law Enforcement
            </span>
          </motion.div>

          <GoldDivider />

          <motion.h1
            className="font-display text-4xl font-bold leading-[1.05] md:text-6xl lg:text-[72px]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            <span className="text-text-primary">We Turn Unstructured </span>
            <span className="text-gradient-gold">FIR Text</span>
            <span className="text-text-primary"> Into Visual </span>
            <span className="text-gradient-gold">Crime Reconstructions</span>
          </motion.h1>

          <motion.p
            className="mt-6 max-w-[520px] text-lg leading-relaxed text-text-secondary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            Upload any FIR narrative. Our AI extracts every actor, location, and event — and renders a 3D animated scene reconstruction in under 30 seconds.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Link to="/dashboard">
              <motion.button
                className="glass-button-primary group flex items-center gap-2 rounded-[6px] px-8 py-3 text-[13px] font-semibold uppercase tracking-[0.1em]"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                Access Portal
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </motion.button>
            </Link>
            <motion.button
              className="glass-button group flex items-center gap-2 rounded-[6px] px-8 py-3 text-[13px] font-semibold uppercase tracking-[0.1em]"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play className="h-4 w-4 transition-transform group-hover:scale-110" /> Watch Demo
            </motion.button>
          </motion.div>

          {/* Stats row */}
          <motion.div
            className="mt-12 grid max-w-md grid-cols-3 gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85 }}
          >
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                className="glass-card rounded-lg p-4"
                whileHover={{ y: -4, scale: 1.03 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <s.icon className="mb-2 h-4 w-4 text-gold icon-float" style={{ animationDelay: `${i * 0.4}s` }} />
                <div className="font-display text-xl font-bold text-text-primary">{s.value}</div>
                <div className="text-[9px] uppercase tracking-[0.15em] text-text-muted">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            className="mt-8 text-[12px] text-text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Developed for Shah Abdul Latif University · Institute of Computer Science
          </motion.p>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      >
        <div className="h-8 w-[1px] bg-gradient-to-b from-gold/60 to-transparent" />
      </motion.div>
    </section>
  );
}
