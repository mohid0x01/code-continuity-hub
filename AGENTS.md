# Architecture rules
- Keep Maps data calls authenticated and server-side, while the browser only renders maps and tiles; this protects paid provider credentials.
- Raster ground placement uses explicit projection metadata, and building heights come from geometry rather than a photograph; this prevents false spatial precision.
- Display real map geometry while photoreal tiles load and fall back after bounded loading; missing coverage must not leave characters on an empty scene.
- Select explicitly supplied Google provider credentials before connector credentials within a server-only boundary, never mixing their transports; custom deployments can lack connector runtime secrets.
- Keep FIR location search independent of Google credentials: use authenticated OpenStreetMap geocoding with Pakistani city fallbacks, and render the picker map with OpenStreetMap tiles.
- Expose agent integrations through OAuth-protected MCP tools with caller-scoped database access; keep browser-local WebMCP registrations separate so existing permissions remain authoritative.
- Fully bundle SSR npm dependencies for Cloudflare, alias `h3-v2` to `h3`, and leave only native `cloudflare:workers` external; published SSR assets cannot resolve package imports at runtime. Vercel instead shims that optional binding and must use bundled model/texture URLs because `/__l5e` is served only by Lovable hosts.