import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { SceneIQLogo } from "@/components/SceneIQLogo";
import { DiamondSeparator } from "@/components/GoldDivider";
import { Menu } from "lucide-react";
import { useState } from "react";

const navLinks = ["Home", "About", "Features", "How It Works", "Contact"];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-subtle glass-panel"
      initial={{ y: -64 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <Link to="/">
          <motion.div whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 300 }}>
            <SceneIQLogo />
          </motion.div>
        </Link>

        <div className="hidden items-center md:flex">
          {navLinks.map((link, i) => (
            <span key={link} className="flex items-center">
              {i > 0 && <DiamondSeparator />}
              <motion.a
                href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-[13px] uppercase tracking-[0.12em] text-text-secondary transition-colors duration-200 hover:text-gold"
                whileHover={{ y: -1 }}
              >
                {link}
              </motion.a>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login">
            <motion.button
              className="glass-button rounded-[6px] px-5 py-2 text-[12px] font-semibold uppercase tracking-[0.12em]"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              Officer Login
            </motion.button>
          </Link>
          <button
            className="icon-hover p-2 text-text-muted md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          className="glass-panel border-t border-border-subtle px-6 py-4 md:hidden"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {navLinks.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
              className="block py-2 text-sm text-text-secondary hover:text-gold"
              onClick={() => setMobileOpen(false)}
            >
              {link}
            </a>
          ))}
        </motion.div>
      )}
    </motion.nav>
  );
}
