import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { SceneIQLogo } from "@/components/SceneIQLogo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id: typeof search["authorization_id"] === "string" ? search["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("This connection request is missing its authorization ID.");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/login", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id");
    if (!authorizationId) throw new Error("This connection request is missing its authorization ID.");

    const [{ data, error }, { data: userData }] = await Promise.all([
      supabase.auth.oauth.getAuthorizationDetails(authorizationId),
      supabase.auth.getUser(),
    ]);
    if (error) throw error;

    const authorization = data as AuthorizationView | null;
    const immediate = authorization?.redirect_url ?? authorization?.redirect_to;
    if (immediate && !authorization?.client) throw redirect({ href: immediate });
    return { details: authorization, accountEmail: userData.user?.email ?? "Signed-in officer" };
  },
  head: () => ({
    meta: [
      { title: "Approve Agent Connection — SCENEIQ" },
      { name: "description", content: "Review and approve a secure agent connection to your permitted SCENEIQ case tools." },
      { property: "og:title", content: "Approve Agent Connection — SCENEIQ" },
      { property: "og:description", content: "Review the account and capabilities before connecting an external agent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <section className="glass-card w-full max-w-lg rounded-[12px] p-8 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-destructive" />
        <h1 className="mt-4 font-display text-2xl font-bold text-text-primary">Connection request unavailable</h1>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          {error instanceof Error ? error.message : "The authorization request could not be loaded. Ask the connecting app to start again."}
        </p>
      </section>
    </main>
  ),
});

type AuthorizationView = {
  client?: { name?: string; redirect_uri?: string; uri?: string };
  redirect_uri?: string;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
};

const scopeLabels: Record<string, string> = {
  openid: "Verify your signed-in identity",
  email: "Share your email address",
  profile: "Share your basic profile",
};

function ConsentPage() {
  const { details, accountEmail } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authorization = details as AuthorizationView | null;
  const clientName = authorization?.client?.name ?? "this agent";
  const redirectUri = authorization?.redirect_uri ?? authorization?.client?.redirect_uri ?? authorization?.client?.uri;
  const scopes = authorization?.scope?.split(/\s+/).filter(Boolean) ?? [];

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data, error: decisionError } = approve
        ? await supabase.auth.oauth.approveAuthorization(authorization_id)
        : await supabase.auth.oauth.denyAuthorization(authorization_id);
      if (decisionError) throw decisionError;
      const result = data as { redirect_url?: string; redirect_to?: string } | null;
      const target = result?.redirect_url ?? result?.redirect_to;
      if (!target) throw new Error("The authorization server did not provide a return address. Start the connection again.");
      window.location.assign(target);
    } catch (decisionError) {
      setBusy(false);
      setError(decisionError instanceof Error ? decisionError.message : "The connection decision could not be completed.");
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="glass-card w-full max-w-xl rounded-[12px] p-6 sm:p-8" aria-labelledby="consent-title">
        <div className="flex flex-col items-center text-center">
          <SceneIQLogo size="large" />
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure agent connection
          </span>
        </div>

        <h1 id="consent-title" className="mt-6 text-center font-display text-2xl font-bold text-text-primary">
          Connect {clientName} to SCENEIQ
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-text-secondary">
          This lets {clientName} use this app as you. It can call the enabled case lookup and reconstruction tools while you are signed in.
        </p>

        <dl className="mt-6 space-y-3 rounded-[6px] border border-border-subtle bg-surface p-4 text-sm">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Signed-in account</dt>
            <dd className="mt-1 break-all text-text-primary">{accountEmail}</dd>
          </div>
          {redirectUri && (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Connection return address</dt>
              <dd className="mt-1 break-all font-mono text-[11px] text-text-secondary">{redirectUri}</dd>
            </div>
          )}
        </dl>

        <div className="mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Shared sign-in information</h2>
          <ul className="mt-3 space-y-2">
            {(scopes.length ? scopes : ["openid"]).map((scope) => (
              <li key={scope} className="flex items-start gap-2 text-sm text-text-secondary">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>{scopeLabels[scope] ?? `Additional permission requested: ${scope}`}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-5 rounded-[4px] border border-border-subtle bg-card px-4 py-3 text-[12px] leading-relaxed text-text-muted">
          Case access remains limited by this app's permissions and backend policies. Approving this connection does not bypass them.
        </p>

        {error && <p role="alert" className="mt-4 rounded-[4px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="glass-button flex flex-1 items-center justify-center gap-2 rounded-[6px] px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
          >
            <X className="h-4 w-4" /> Cancel connection
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="glass-button-primary flex flex-1 items-center justify-center gap-2 rounded-[6px] px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> {busy ? "Working…" : "Approve"}
          </button>
        </div>
      </section>
    </main>
  );
}
