import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { SceneIQLogo } from "@/components/SceneIQLogo";
import { Eye, EyeOff, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Officer Login — SCENEIQ" },
      { name: "description", content: "Restricted system. Authorized personnel only." },
    ],
  }),
});

function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || "Officer",
              badge_number: badgeNumber || undefined,
            },
          },
        });
        if (signUpError) throw signUpError;
        // Auto-confirm enabled — sign in immediately
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setMessage("Account created. Please sign in.");
          setIsSignUp(false);
        } else {
          navigate({ to: "/dashboard" });
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        navigate({ to: "/dashboard" });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    const demoEmail = "officer@sceneiq.gov.pk";
    const demoPass = "Officer@2026";
    try {
      // Try sign in first
      let { error: signInError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPass,
      });
      if (signInError) {
        // Account doesn't exist — create it
        const { error: signUpError } = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPass,
          options: {
            data: {
              full_name: "ASI Demo Officer",
              badge_number: "BADGE-DEMO-2026",
              district: "Khairpur",
            },
          },
        });
        if (signUpError) throw signUpError;
        ({ error: signInError } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPass,
        }));
        if (signInError) throw signInError;
      }
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 40px, oklch(0.72 0.12 85) 40px, oklch(0.72 0.12 85) 41px)",
      }} />
      <Shield className="absolute bottom-8 left-8 h-24 w-24 text-gold/5" />

      <motion.div
        className="relative w-full max-w-[420px]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="glass-card gold-top-border rounded-[8px] p-8">
          <div className="flex justify-center">
            <SceneIQLogo size="large" />
          </div>

          <h1 className="mt-6 text-center font-display text-2xl font-bold text-text-primary">
            {isSignUp ? "Create Officer Account" : "Officer Authentication"}
          </h1>
          <p className="mt-2 text-center text-[13px] text-destructive/80">
            Restricted system. Authorized personnel only.
          </p>

          {/* Demo credentials hint */}
          <div className="mt-4 rounded-[6px] border border-gold/20 bg-gold/5 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gold">Demo Credentials</p>
            <p className="mt-1 font-mono text-[11px] text-text-secondary">officer@sceneiq.gov.pk</p>
            <p className="font-mono text-[11px] text-text-secondary">Officer@2026</p>
          </div>

          {error && (
            <div className="mt-4 rounded-[4px] border border-destructive/30 bg-destructive/10 px-4 py-2 text-[12px] text-destructive">
              {error}
            </div>
          )}
          {message && (
            <div className="mt-4 rounded-[4px] border border-success/30 bg-success/10 px-4 py-2 text-[12px] text-success">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {isSignUp && (
              <>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. ASI Muhammad Akram"
                    className="glass-input mt-2 w-full rounded-[6px] px-4 py-3 text-sm placeholder:text-text-muted"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">Badge Number</label>
                  <input
                    type="text"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    placeholder="e.g. BADGE-KHP-2024"
                    className="glass-input mt-2 w-full rounded-[6px] px-4 py-3 font-mono text-sm text-gold placeholder:text-text-muted"
                  />
                </div>
              </>
            )}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@example.gov.pk"
                required
                className="glass-input mt-2 w-full rounded-[6px] px-4 py-3 text-sm placeholder:text-text-muted"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                Password
              </label>
              <div className="relative mt-2">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
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

            <button
              type="submit"
              disabled={loading}
              className="glass-button-primary w-full rounded-[6px] py-3 text-[13px] font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
            >
              {loading ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}
            </button>

            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="glass-button w-full rounded-[6px] py-3 text-[12px] font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
            >
              Use Demo Officer Account
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-[1px] flex-1 bg-border-accent" />
            <span className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Secure Portal</span>
            <div className="h-[1px] flex-1 bg-border-accent" />
          </div>

          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
            className="w-full text-center text-[12px] text-text-muted hover:text-gold transition-colors"
          >
            {isSignUp ? "Already have an account? Sign In" : "Need an account? Register"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
