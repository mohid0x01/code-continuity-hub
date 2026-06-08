import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-text-primary">Settings</h1>
      <div className="gold-divider mt-2" style={{ width: "60px" }} />

      <div className="mt-8 max-w-lg space-y-6">
        <div className="gold-top-border rounded-[4px] border border-border-subtle bg-card p-6">
          <h3 className="text-sm font-semibold text-text-primary">Officer Profile</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">Full Name</label>
              <input defaultValue="ASI Karim Shah" className="mt-2 w-full rounded-[2px] border border-border-accent bg-input px-4 py-3 text-sm text-text-primary focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">Badge Number</label>
              <input defaultValue="SHK-2847" className="mt-2 w-full rounded-[2px] border border-border-accent bg-input px-4 py-3 font-mono text-sm text-gold focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" readOnly />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">District</label>
              <input defaultValue="Khairpur" className="mt-2 w-full rounded-[2px] border border-border-accent bg-input px-4 py-3 text-sm text-text-primary focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" readOnly />
            </div>
          </div>
          <button className="mt-6 rounded-[6px] bg-gold px-6 py-2.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-background transition-all hover:bg-gold-light">
            Update Profile
          </button>
        </div>
      </div>
    </div>
  );
}
