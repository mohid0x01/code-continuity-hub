import { SceneIQLogo } from "@/components/SceneIQLogo";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Github, ExternalLink, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer id="contact" className="border-t border-subtle bg-[oklch(0.06_0.005_60)]">
      <div className="gold-divider" style={{ width: "100%" }} />
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <SceneIQLogo />
            <p className="mt-4 max-w-xs text-sm text-text-secondary">
              AI-powered FIR scene reconstruction for Pakistan law enforcement. Turning unstructured narratives into actionable intelligence.
            </p>
            <div className="mt-4 flex gap-3">
              <motion.a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border-accent text-text-muted transition-colors hover:border-gold hover:text-gold"
                whileHover={{ scale: 1.15, rotate: -5 }}
              >
                <Github className="h-4 w-4" />
              </motion.a>
              <motion.a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border-accent text-text-muted transition-colors hover:border-gold hover:text-gold"
                whileHover={{ scale: 1.15, rotate: 5 }}
              >
                <Mail className="h-4 w-4" />
              </motion.a>
              <motion.a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border-accent text-text-muted transition-colors hover:border-gold hover:text-gold"
                whileHover={{ scale: 1.15, rotate: -5 }}
              >
                <ExternalLink className="h-4 w-4" />
              </motion.a>
            </div>
          </motion.div>
          <div className="flex gap-16">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gold">Platform</h4>
              <div className="mt-4 flex flex-col gap-2">
                <Link to="/login" className="text-sm text-text-secondary transition-colors hover:text-gold">Officer Portal</Link>
                <a href="#features" className="text-sm text-text-secondary transition-colors hover:text-gold">Features</a>
                <a href="#how-it-works" className="text-sm text-text-secondary transition-colors hover:text-gold">How It Works</a>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gold">Institution</h4>
              <div className="mt-4 flex flex-col gap-2">
                <span className="text-sm text-text-secondary">SALU Khairpur</span>
                <span className="text-sm text-text-secondary">ICS Department</span>
              </div>
            </motion.div>
          </div>
        </div>
        <div className="mt-12 border-t border-subtle pt-6 text-center text-[12px] text-text-muted">
          © {new Date().getFullYear()} SCENEIQ. Institute of Computer Science, Shah Abdul Latif University, Khairpur.
        </div>
      </div>
    </footer>
  );
}
