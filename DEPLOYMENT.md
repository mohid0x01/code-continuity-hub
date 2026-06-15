# SceneIQ — Deployment Guide

## 1. Backend (Lovable Cloud / Supabase)

No deploy needed — already live. Auto-managed schema migrations + edge runtime.

## 2. Frontend on Vercel (TanStack Start)

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
