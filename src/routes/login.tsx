import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { SceneIQLogo } from "@/components/SceneIQLogo";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { verifyAdminKey } from "@/lib/admin.functions";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "SuperAdmin Login — SCENEIQ" },
      { name: "description", content: "Government of Pakistan · SCENEIQ Admin Portal. Restricted access." },
      { property: "og:title", content: "SuperAdmin Login — SCENEIQ" },
      { property: "og:description", content: "Restricted sign-in for the SCENEIQ administration portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const verifyKey = useServerFn(verifyAdminKey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Step 1: sign in only — no self-registration. Single SuperAdmin account.
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error("Invalid email or password");

      // Step 2: verify private key + superadmin role server-side.
      try {
        await verifyKey({ data: { privateKey } });
      } catch (verifyErr) {
        await supabase.auth.signOut();
        throw verifyErr;
      }

      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      {/* Dotted grid backdrop, Resend-style */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(oklch(0.78 0.16 155 / 12%) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 80%)",
        }}
      />

      <motion.div
        className="relative w-full max-w-[440px]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="glass-card rounded-[12px] p-8">
          <div className="flex flex-col items-center">
            <SceneIQLogo size="large" />
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
              <ShieldCheck className="h-3 w-3" /> SuperAdmin Portal
            </span>
          </div>

          <h1 className="mt-6 text-center font-display text-2xl font-bold text-text-primary">
            Restricted Access
          </h1>
          <p className="mt-2 text-center text-[12px] text-text-muted">
            Government of Pakistan · SCENEIQ Forensic Reconstruction Platform
          </p>

          {error && (
            <div className="mt-4 rounded-[4px] border border-destructive/30 bg-destructive/10 px-4 py-2 text-[12px] text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@sceneiq.gov.pk"
                required
                className="glass-input mt-2 w-full rounded-[6px] px-4 py-3 text-sm placeholder:text-text-muted"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">Password</label>
              <div className="relative mt-2">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  minLength={8}
                  className="glass-input w-full rounded-[6px] px-4 py-3 pr-10 text-sm placeholder:text-text-muted"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gold/60 hover:text-gold"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                <KeyRound className="h-3 w-3 text-gold" /> Private Key
              </label>
              <input
                type="password"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="System-issued private key"
                required
                className="glass-input mt-2 w-full rounded-[6px] px-4 py-3 font-mono text-sm placeholder:text-text-muted"
              />
              <p className="mt-1.5 text-[10px] text-text-muted">
                Issued by HQ. Required to unlock SuperAdmin access.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="glass-button-primary w-full rounded-[6px] py-3 text-[13px] font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Authenticate"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-[1px] flex-1 bg-border-accent" />
            <span className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Secure Portal</span>
            <div className="h-[1px] flex-1 bg-border-accent" />
          </div>

          <p className="text-center text-[11px] leading-relaxed text-text-muted">
            All access attempts are logged. Unauthorized use is a federal offense under PECA-2016 §3-22.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
