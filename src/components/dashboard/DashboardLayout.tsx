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
  Sun,
  Moon,
  CheckCircle,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useJobsRealtime } from "@/hooks/useJobRealtime";

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
  const { theme, toggle } = useTheme();
  const jobs = useJobsRealtime();
  const recent = jobs.slice(0, 6);
  const unread = jobs.filter((j) => j.status === "completed" || j.status === "failed").length;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="rounded-[4px] p-2 text-text-muted transition-colors hover:bg-surface hover:text-gold"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="relative rounded-[4px] p-2 text-text-muted transition-colors hover:bg-surface hover:text-gold"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-background gold-pulse">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 top-12 z-50 w-80 rounded-[6px] border border-border-subtle bg-card shadow-2xl">
              <div className="border-b border-border-subtle px-4 py-3">
                <h4 className="text-sm font-semibold text-text-primary">Notifications</h4>
                <p className="text-[11px] text-text-muted">{recent.length} recent jobs</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {recent.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-text-muted">No activity yet</p>
                ) : recent.map((j) => (
                  <Link
                    key={j.id}
                    to={j.status === "completed" ? "/dashboard/viewer" : "/dashboard/processing"}
                    search={{ jobId: j.id }}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 border-b border-border-subtle px-4 py-3 transition-colors hover:bg-surface"
                  >
                    {j.status === "completed" ? (
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    ) : j.status === "failed" ? (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-destructive" />
                    ) : (
                      <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-blue-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-text-primary truncate">
                        {j.fir_records?.case_number || j.id.slice(0, 8)}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {j.status} · {new Date(j.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="h-9 w-9 rounded-full bg-gold/20 text-center font-display text-sm font-bold leading-9 text-gold">
          KS
        </div>
      </div>
    </header>
  );
}
