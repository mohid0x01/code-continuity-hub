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

In **Pages → Settings → Environment variables** add these for **both** Production and Preview:

| Name | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | (from `.env`) | Server — used by `/api/v1/*` proxy |
| `SUPABASE_PUBLISHABLE_KEY` | (from `.env`) | Server |
| `SUPABASE_SERVICE_ROLE_KEY` | (Lovable Cloud → Advanced) | Server — admin ops only |
| `LOVABLE_API_KEY` | (Lovable Cloud → Secrets) | Server — AI Gateway |
| `VITE_SUPABASE_URL` | same as `SUPABASE_URL` | Client build-time |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | same as publishable key | Client build-time |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` | (from `.env`) | Client build-time |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID` | (from `.env`) | Client build-time |

> Setting `VITE_SUPABASE_URL` to the actual Supabase URL is fine — the browser only ever
> talks to `/api/v1/*` on your own domain because that's what the app calls. The URL is used
> server-side by the proxy handler.

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

TanStack Start works on Vercel out-of-the-box via the official Vite adapter.

### Step 1 — Push the repo to GitHub

```bash
git init && git add . && git commit -m "init"
git remote add origin <your-github-repo>
git push -u origin main
```

### Step 2 — Install Vercel adapter (one-time)

```bash
bun add -d @tanstack/start-server-functions-vercel @vercel/node
```

Update `vite.config.ts` target if you want to default to Vercel:

```ts
// vite.config.ts
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  plugins: [tanstackStart({ target: "vercel" })],
});
```

(Cloudflare Workers target is still supported — `target: "cloudflare-module"`.)

### Step 3 — Import project in Vercel

1. Go to <https://vercel.com/new> → Import your GitHub repo.
2. Framework preset: **Other** (Vercel auto-detects Vite).
3. Build Command: `bun run build`
4. Output Directory: `.output/public` (TanStack Start default)

### Step 4 — Environment Variables

Add these in **Vercel Project → Settings → Environment Variables**:

| Name | Value | Scope |
|---|---|---|
| `SUPABASE_URL` | (from `.env`) | Server |
| `SUPABASE_PUBLISHABLE_KEY` | (from `.env`) | Server |
| `SUPABASE_SERVICE_ROLE_KEY` | (from Lovable Cloud → API) | Server |
| `LOVABLE_API_KEY` | (from Lovable Cloud → Secrets) | Server |
| `VITE_SUPABASE_URL` | **leave blank or set to `/api/proxy`** | Client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | (same publishable key) | Client |

> **Hide the Supabase URL:** set `VITE_SUPABASE_URL=https://YOUR-DOMAIN/api/proxy`.
> The proxy route at `src/routes/api/proxy/$.ts` forwards `rest/v1/*`,
> `storage/v1/*`, and `functions/v1/*` to the real Supabase host server-side.
> The browser never sees `yayosibohzruoplhownd.supabase.co`.
>
> Realtime (WebSocket) still connects directly to Supabase — proxying WS through
> Vercel edge isn't supported. If you need realtime fully hidden, host on a
> server that supports WS proxying (Cloudflare Workers / Fly.io).

### Step 5 — Deploy

Push to `main` → Vercel auto-deploys. First deploy ~2 minutes.

### Custom Domain

Vercel → Project → Domains → Add. DNS: CNAME `cname.vercel-dns.com`.

## 3. Post-deploy checks

- Open `/` — landing page loads.
- Sign up / log in — auth works through Supabase publishable key.
- Submit an FIR — pipeline progresses through 5 stages, fallback chain works.
- DevTools → Network: confirm `rest/v1/...` calls hit `/api/proxy/rest/v1/...`
  (not `*.supabase.co`).

## 4. Rollback

Vercel → Deployments → pick previous → "Promote to Production".
