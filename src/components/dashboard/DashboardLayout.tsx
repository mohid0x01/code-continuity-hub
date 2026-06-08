import { Link, useLocation } from "@tanstack/react-router";
import { SceneIQLogo } from "@/components/SceneIQLogo";
import {
  LayoutDashboard,
  FilePlus,
  Boxes,
  Archive,
  Settings,
  LogOut,
  Bell,
} from "lucide-react";

const navItems = [
  { label: "Dashboard Overview", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Submit New FIR", icon: FilePlus, href: "/dashboard/submit" },
  { label: "My Reconstructions", icon: Boxes, href: "/dashboard/viewer" },
  { label: "Case Archive", icon: Archive, href: "/dashboard/archive" },
  { label: "Settings", icon: Settings, href: "/dashboard/settings" },
];

export function DashboardSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-subtle bg-[oklch(0.1_0.005_60)]">
      <div className="px-5 py-5">
        <Link to="/dashboard">
          <SceneIQLogo />
        </Link>
        <div className="mt-4 rounded-[4px] border border-border-accent bg-surface p-3">
          <div className="text-sm font-semibold text-text-primary">ASI Karim Shah</div>
          <div className="mt-1 font-mono text-[11px] text-gold">Badge #SHK-2847</div>
          <div className="mt-1 inline-block rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-gold">
            Khairpur District
          </div>
        </div>
      </div>

      <nav className="mt-2 flex-1 px-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`mb-1 flex items-center gap-3 rounded-[4px] px-3 py-2.5 text-[13px] transition-all duration-200 ${
                isActive
                  ? "border-l-[3px] border-gold bg-gold/5 text-gold"
                  : "border-l-[3px] border-transparent text-text-secondary hover:bg-surface hover:text-text-primary"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-5">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-[4px] px-3 py-2.5 text-[13px] text-text-muted transition-colors hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Link>
      </div>
    </aside>
  );
}

export function DashboardHeader() {
  return (
    <header className="flex items-center justify-between border-b border-subtle px-8 py-5">
      <div>
        <h1 className="font-display text-3xl font-bold text-text-primary">
          Good morning, Officer Karim
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Khairpur District ·{" "}
          <span className="font-mono text-gold">{new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
        </p>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative rounded-[4px] p-2 text-text-muted transition-colors hover:bg-surface hover:text-gold">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-gold gold-pulse" />
        </button>
        <div className="h-9 w-9 rounded-full bg-gold/20 text-center font-display text-sm font-bold leading-9 text-gold">
          KS
        </div>
      </div>
    </header>
  );
}
