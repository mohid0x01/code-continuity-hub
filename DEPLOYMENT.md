# SceneIQ — Deployment Guide

> **This project is built for the Cloudflare Workers / Pages runtime** (TanStack Start
> with the `cloudflare-module` target). Cloudflare Pages is the recommended host.
> Vercel is possible but requires an adapter swap and loses realtime WebSocket support.

## 1. Backend (Lovable Cloud / Supabase)

No deploy needed — already live. Auto-managed schema migrations + edge runtime.

## 2. Frontend on Cloudflare Pages (recommended)

### Step 1 — Push the repo to GitHub

```bash
git init && git add . && git commit -m "init"
git remote add origin <your-github-repo>
git push -u origin main
```

### Step 2 — Create the Cloudflare Pages project

1. Go to <https://dash.cloudflare.com> → **Workers & Pages** → **Create → Pages → Connect to Git**.
2. Select your GitHub repo.
3. **Framework preset**: `None` (Cloudflare will pick up the Worker output automatically).
4. **Build command**: `bun run build`
5. **Build output directory**: `.output/public`
6. **Root directory**: (leave blank)
7. **Environment variables** — see Step 3 below. Add them **before** the first deploy.
8. Click **Save and Deploy**.

TanStack Start's `cloudflare-module` target emits `.output/server/index.mjs` (the Worker) and
`.output/public/*` (static assets). Cloudflare Pages auto-detects the Worker file and wires
SSR + `/api/v1/*` routes to it. No `wrangler.toml`, `_worker.js`, or `_redirects` file needed.

### Step 3 — Environment Variables

In **Pages → Settings → Environment variables** add these for **both** Production and Preview.

**Important — about `SUPABASE_SERVICE_ROLE_KEY` and `LOVABLE_API_KEY`:**
On the managed Lovable Cloud backend these two secrets are **not exposed** to
users — there is no dashboard page to copy them from. That is by design:
they let a caller bypass RLS or spend AI credits without a session, so
Lovable keeps them inside the managed runtime.

Two options:

1. **Publish on Lovable first (recommended)** — click **Publish** in the editor.
    The app goes live at `https://<project>.lovable.app` with both secrets
    already injected on the server side. All server functions, `/api/v1/*`,
    AI pipeline, admin operations work with no manual key handling. You can
    then point `scene-iq.teamcyberops.xyz` at Lovable via **Project Settings →
    Domains → Connect Domain** (DNS: `A 185.158.133.1`).
2. **Host on Cloudflare Pages without those keys** — the app still works
    for anything that goes through the authenticated user session (sign in,
    submit FIR, view own cases, RLS-scoped reads). What breaks: any server
    function that dynamically imports `client.server` (`supabaseAdmin`) and
    any AI Gateway call. Currently that means the AI pipeline stages will
    fail on Cloudflare. Bring your own OpenAI/Anthropic key via
    **Dashboard → Settings → API Keys (BYOK)** to keep AI working; admin-only
    routes remain unavailable.

Variables to set on Cloudflare Pages:

| Name | Value | Required? |
|---|---|---|
| `SUPABASE_URL` | `https://yayosibohzruoplhownd.supabase.co` (from `.env`) | ✅ yes |
| `SUPABASE_PUBLISHABLE_KEY` | value from `.env` | ✅ yes |
| `VITE_SUPABASE_URL` | same as `SUPABASE_URL` | ✅ yes (build-time) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | same as publishable key | ✅ yes (build-time) |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` | value from `.env` | ✅ yes (maps) |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID` | value from `.env` | optional |
| `SUPABASE_SERVICE_ROLE_KEY` | **not available on Lovable Cloud** — leave unset | ❌ skip |
| `LOVABLE_API_KEY` | **not available on Lovable Cloud** — leave unset | ❌ skip |

> Setting `VITE_SUPABASE_URL` to the actual Supabase URL is fine — the browser only ever
> talks to `/api/v1/*` on your own domain because that's what the app calls. The URL is used
> server-side by the proxy handler.
>
> **If you want the full AI pipeline on Cloudflare**, publish on Lovable first (option 1
> above). There is no supported way to extract `LOVABLE_API_KEY` from Lovable Cloud.

### Step 4 — Custom Domain (`scene-iq.teamcyberops.xyz`)

1. Pages project → **Custom domains → Set up a custom domain**.
2. Enter `scene-iq.teamcyberops.xyz`.
3. If the domain is on Cloudflare DNS already → 1-click. Otherwise create a CNAME
   record at your registrar pointing to `<project>.pages.dev`.
4. **Remove the existing Vercel A/CNAME record for this host** or DNS will keep bouncing.
5. SSL is provisioned automatically (~1 min).

### Step 5 — Verify

- `https://scene-iq.teamcyberops.xyz/` → landing page renders.
- `https://scene-iq.teamcyberops.xyz/api/v1/health` → `{ok:true, upstream:{ok:true, ...}}`.
- Sign in, submit an FIR → pipeline completes end-to-end.

### Troubleshooting

- **500 on every route** → env vars missing. Re-check Step 3, redeploy.
- **404 on refresh** → build failed silently. Open the failed deploy log and search for
  `error`; a missing route file or type error will surface there.
- **`Expected 3 parts in JWT; got 1`** → you accidentally set the service-role key as
  `SUPABASE_PUBLISHABLE_KEY`. Swap them.
- **Realtime not connecting** → allow `wss://*.supabase.co` in any CSP you added.

### Rollback

Cloudflare Pages → Deployments → pick a previous deploy → **Rollback to this deployment**.

---

## 3. (Alternative) Frontend on Vercel

> **Verified setup.** The build emits Vercel's Build Output API (`.vercel/output`)
> via Nitro's `vercel` preset — SSR, server functions and `/api/v1/*` routes all
> run as one serverless function. Locally tested end-to-end with `vercel build`.

**How it works (already wired in the repo):**
- `vite.config.ts` attaches Nitro **only when `VERCEL=1`** (set by Vercel's build
  runner) or when `NITRO_PRESET` is set — the Lovable preview and local dev are
  untouched.
- `vercel.json` pins Framework: **None**, Install: `bun install`,
  Build: `bun run build`. No Output Directory setting is needed — Vercel picks up
  `.vercel/output` automatically.

### Step 1 — Push the repo to GitHub

```bash
git add . && git commit -m "vercel deployment" && git push origin main
```

### Step 2 — Import in Vercel

1. Go to <https://vercel.com/new> → Import `mohid0x01/code-continuity-hub`.
2. Leave all build settings as-is — they come from `vercel.json`.
3. Click **Deploy** (first build can fail on missing env vars — add them in Step 3, then redeploy).

### Step 3 — Environment Variables

**Vercel → Project → Settings → Environment Variables** (add for Production **and** Preview):

| Name | Value | Scope |
|---|---|---|
| `SUPABASE_URL` | `https://yayosibohzruoplhownd.supabase.co` (from `.env`) | Server |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (from `.env`) | Server |
| `VITE_SUPABASE_URL` | **must be the full `https://yayosibohzruoplhownd.supabase.co`** — a relative value like `/api/proxy` crashes the app with `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL` | Client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | same publishable key | Client |
| `VITE_SUPABASE_PROJECT_ID` | from `.env` | Client |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` | from `.env` | Client |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID` | from `.env` (optional) | Client |
| `SUPABASE_SERVICE_ROLE_KEY` | **not available on Lovable Cloud — leave unset** | — |
| `LOVABLE_API_KEY` | **not available on Lovable Cloud — leave unset** | — |

> Without the two managed secrets, admin-only server operations and the AI
> pipeline stages that need the gateway key will not run on Vercel. Use the
> in-app **Settings → API Keys (BYOK)** for AI, or publish on Lovable for the
> full feature set. Realtime notifications are browser-side WebSockets and
> work as-is (they connect directly to the DB host, not through Vercel).

### Step 4 — Deploy

Push to `main` → Vercel auto-deploys. Build takes ~2 minutes.

### Step 5 — Verify

- `https://<project>.vercel.app/` → landing page renders (SSR).
- `https://<project>.vercel.app/api/v1/health` → `{ok:true, ...}`.
- Sign in → dashboard loads → submit an FIR → pipeline completes.

### Custom Domain

Vercel → Project → Settings → Domains → Add `scene-iq.teamcyberops.xyz`.
DNS: CNAME `scene-iq` → `cname.vercel-dns.com` (or Vercel's A record for apex).
Remove any old Cloudflare DNS record for the same host. SSL is automatic.

### Rollback

Vercel → Deployments → pick a previous deploy → **Promote to Production**.

### Troubleshooting

- **`No Output Directory named "public"`** → deploying a commit older than the
  fix; push the latest code (the `vercel.json` + Nitro wiring).
- **500 on every route** → env vars missing in Step 3.
- **`Expected 3 parts in JWT; got 1`** → service-role key set as
  `SUPABASE_PUBLISHABLE_KEY` — swap them.
- **Slow cold starts** → the server bundle is large (Three.js, Leaflet, jsPDF);
  normal for a hobby plan, Pro instances start faster.

---

## 4. Post-deploy checks (either host)

- Open `/` — landing page loads.
- Sign in — auth works through the publishable key.
- Submit an FIR — pipeline progresses through 5 stages, fallback chain works.
- DevTools → Network: confirm REST calls hit `/api/proxy/rest/v1/...`
  (not `*.supabase.co`).
