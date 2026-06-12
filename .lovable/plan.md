## Goal
SceneIQ ko reshape karna: single SuperAdmin SAAS jahan victim/operator FIR narrative daale, AI 3D incident reconstruction + video banaye real Pakistan location ke saath. Theme = Resend/Grok shiny-black glassmorphism.

## Phase 1 — Auth & Identity (Backend + UI)
- **Remove demo / officer concept entirely.** No officer_profiles UI, no "officer" wording in routes.
- **Single SuperAdmin login** at `/login`:
  - Email + Password (Lovable Cloud auth — Supabase)
  - Additional gate: "Private Key" field must equal `SceneIQ-Admin` (checked client + server-side in a `verifyAdminKey` server fn that also asserts role=`superadmin` via `user_roles` table)
  - First-time bootstrap: migration seeds one superadmin role row keyed by email you specify; nobody else can sign up (signups disabled)
- **DB migration**
  - `app_role` enum (`superadmin`)
  - `user_roles` table + `has_role()` security-definer fn
  - Drop/ignore `officer_profiles` references in app code (table stays for now, just unused)
  - Rename `officer_id` columns conceptually to "created_by" via a view, or just keep column but treat as admin id

## Phase 2 — Logo & Theme (Resend/Grok shiny-black glass)
- **Logo**: Pakistan Government emblem (Star & Crescent, gold on green) generated via imagegen as `src/assets/pak-gov-logo.png` + SceneIQ wordmark — used in navbar, login, dashboard sidebar, footer
- **Theme tokens** (`src/styles.css`) — full rewrite to match attached screenshot:
  - Background: pure shiny black `oklch(0.08 0 0)` with subtle radial gradient + dotted grid overlay (like Resend's domain page)
  - Glass panels: `bg-white/[0.03] backdrop-blur-xl border-white/[0.06]` with inset highlight
  - Accent: emerald-green pill badges (`oklch(0.75 0.18 155)`) for "Verified" style status — matches screenshot
  - Buttons: rectangle + fully-rounded circle variants, subtle inner glow on hover
  - Animated icons: lucide icons wrapped in `motion.div` with hover scale + glow (like Resend's domain icon with green ambient halo)
- **Typography**: keep Space Grotesk headings, Inter body — but tighter tracking like Resend
- Light mode kept as inverse (clean white) — toggle stays

## Phase 3 — Reconstructions / Submit Flow
- **Case Number = auto-generated**, read-only input
  - Format: `FIR-{YYYY}-{6-digit-seq}` (DB sequence in migration)
  - Generated server-side on insert; UI shows preview but never editable
- **Location cascading dropdowns powered by Google Maps Platform connector**:
  1. City/District (Places Autocomplete restricted to PK, type=`administrative_area_level_2`)
  2. Area (Places Autocomplete biased to selected district)
  3. Auto-geocode → lat/lng stored on FIR record
  4. Mini map preview of pinned location
- Need to **connect Google Maps Platform** via `standard_connectors--connect` first (will prompt you)
- Remove old free-text district field

## Phase 4 — AI 3D Video Generator (the big one)
- Existing pipeline already extracts entities + events via Lovable AI
- New stage after `scene_generation`: **`video_generation`**
  - Take scene manifest + first keyframe from Scene3DCanvas (offscreen render)
  - Call `videogen--generate_video` with a prompt built from narrative + entity layout + real Pakistan location backdrop
  - Store resulting video URL on `fir_jobs.video_url`
- **Viewer page upgrade** (`/dashboard/viewer`):
  - Tab 1: Interactive 3D scene (existing)
  - Tab 2: AI-generated incident video player (new) with download
  - Tab 3: Timeline & entity inspector (existing, polished)
  - Tab 4: Source narrative + location map

## Phase 5 — Polish & "what you're missing"
Things I'll add that you didn't list but the SAAS needs:
- **Victim intake mode** — public-facing kiosk route `/intake` (no login) where victim dictates/types narrative, admin reviews before submission
- **Evidence uploads** — photos/audio attached to FIR (Supabase storage)
- **Chain-of-custody audit log** — every status change recorded
- **PDF export** of reconstruction report (case#, narrative, entities, events, video link, map)
- **Multilingual narrative** — auto-detect Urdu/Roman Urdu/Sindhi/English (already in prompt, add UI badge)
- **Print-friendly case summary** for court submission

## Technical Notes
- TanStack Start server fns for all writes; Google Maps via connector gateway (not direct API)
- Video gen is async — webhook/polling pattern, status stored on job
- Single-user signup disabled via `supabase--configure_auth`
- All new tables get GRANTs + RLS keyed to `has_role(auth.uid(), 'superadmin')`

## Order of Execution
I'll do Phase 1 + 2 + 3 in this turn (auth, theme, case#/maps) since they're tightly coupled UX, then Phase 4 (video) + 5 (polish) in follow-up turns after you confirm Google Maps connector is linked.

## Questions before I start
1. **Superadmin email** for the seeded account? (I'll create the migration that assigns superadmin role to this email when they sign up — first-time bootstrap)
2. **Google Maps connector** — ok if I trigger the connect dialog now? Needed for City/District/Area autocomplete.
3. **Video generation** — `videogen` tool generates short clips (~5-10s). For longer incidents we'd stitch multiple clips or use animated 3D playback as fallback. Confirm short AI clip is acceptable for v1.
4. **Public victim intake** (`/intake` no-login) — keep or skip? If kept, abuse protection = rate-limit + admin moderation queue.
