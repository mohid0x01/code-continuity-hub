import { motion } from "framer-motion";
import { GoldDivider } from "@/components/GoldDivider";
import sceneMockup from "@/assets/scene-mockup.jpg";

const stats = [
  { number: "70B", label: "Parameters" },
  { number: "< 30s", label: "Processing" },
  { number: "100%", label: "Browser-Based" },
];

export function AboutSection() {
  return (
    <section id="about" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="label-uppercase">Welcome to SceneIQ</p>
            <h2 className="mt-4 font-display text-4xl font-bold text-text-primary lg:text-5xl">
              The Intelligence Layer Your Investigations Have Been Missing
            </h2>
            <GoldDivider />
            <p className="mt-4 text-base leading-relaxed text-text-secondary">
              <span className="float-left mr-2 font-display text-5xl font-bold leading-none text-gold">W</span>
              hen a First Information Report arrives, critical details hide within dense, multilingual text. SceneIQ applies state-of-the-art natural language processing to parse Roman Urdu and English FIR narratives, extract every entity, and reconstruct the crime scene as an interactive 3D visualization — giving investigators spatial and temporal clarity they've never had before.
            </p>

            <div className="gold-divider my-8" style={{ width: "100%" }} />

            <div className="grid grid-cols-3 gap-8">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <motion.div
                    className="font-display text-3xl font-bold text-gold"
                    whileHover={{ scale: 1.05 }}
                  >
                    {stat.number}
                  </motion.div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.15em] text-text-muted">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="flex items-center justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <motion.div
              className="glass-panel overflow-hidden rounded-[4px] p-1"
              whileHover={{ scale: 1.02, rotate: 0.5 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <img
                src={sceneMockup}
                alt="3D Scene Viewer Interface"
                className="w-full rounded-[2px]"
                loading="lazy"
                width={640}
                height={512}
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
