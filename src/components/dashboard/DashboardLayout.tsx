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
  ShieldCheck,
  Shield,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useJobsRealtime } from "@/hooks/useJobRealtime";
import { useNotificationWire } from "@/hooks/useNotificationWire";
import { useNotificationStore } from "@/stores/notificationStore";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

const navItems = [
  { label: "Dashboard Overview", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Submit New FIR", icon: FilePlus, href: "/dashboard/submit" },
  { label: "My Reconstructions", icon: Boxes, href: "/dashboard/reconstructions" },
  { label: "Case Archive", icon: Archive, href: "/dashboard/archive" },
  { label: "Audit Log", icon: Shield, href: "/dashboard/audit" },
  { label: "Settings", icon: Settings, href: "/dashboard/settings" },
];

export function DashboardSidebar() {
  const location = useLocation();
  const [email, setEmail] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-border bg-sidebar">
      <div className="px-5 py-5">
        <Link to="/dashboard">
          <SceneIQLogo />
        </Link>
        <div className="mt-4 rounded-[6px] border border-gold/20 bg-gold/[0.04] p-3">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-gold" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gold">
              SuperAdmin
            </span>
          </div>
          <div className="mt-1.5 truncate font-mono text-[11px] text-text-secondary" title={email}>
            {email || "—"}
          </div>
          <div className="mt-1.5 inline-block rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-success">
            ● Active session
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
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-[4px] px-3 py-2.5 text-left text-[13px] text-text-muted transition-colors hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

export function DashboardHeader() {
  const { theme, toggle } = useTheme();
  const jobs = useJobsRealtime();
  useNotificationWire(jobs);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount());
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string>("Administrator");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email.split("@")[0]);
    });
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const notifIcon = (type: string) => {
    if (type === "completed") return <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />;
    if (type === "failed") return <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-destructive" />;
    if (type === "new_job") return <Bell className="mt-0.5 h-4 w-4 shrink-0 text-gold" />;
    return <span className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-blue-400" />;
  };

  const timeAgo = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <header className="flex items-center justify-between border-b border-subtle px-8 py-5">
      <div>
        <h1 className="font-display text-3xl font-bold text-text-primary">
          {greeting}, <span className="text-gold">{email}</span>
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Government of Pakistan · SCENEIQ Admin ·{" "}
          <span className="font-mono text-gold">
            {new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
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
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-background gold-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 top-12 z-50 w-80 rounded-[6px] border border-border-subtle bg-card shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Notifications</h4>
                  <p className="text-[11px] text-text-muted">{unreadCount} unread</p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gold hover:text-gold-light transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-text-muted">No notifications yet</p>
                ) : notifications.slice(0, 20).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { markRead(n.id); setOpen(false); }}
                    className={`flex w-full items-start gap-3 border-b border-border-subtle px-4 py-3 text-left transition-colors hover:bg-surface ${!n.read ? "bg-gold/[0.04]" : ""}`}
                  >
                    {notifIcon(n.type)}
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12px] truncate ${!n.read ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                        {n.title}
                      </div>
                      <div className="text-[10px] text-text-muted truncate">{n.description}</div>
                      <div className="text-[9px] text-text-muted mt-0.5">{timeAgo(n.timestamp)}</div>
                    </div>
                    {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 font-display text-sm font-bold text-gold uppercase">
          {email.slice(0, 2)}
        </div>
      </div>
    </header>
  );
}
