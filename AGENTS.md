# Architecture rules
- Keep Maps data calls authenticated and server-side, while the browser only renders maps and tiles; this protects paid provider credentials.
- Raster ground placement uses explicit projection metadata, and building heights come from geometry rather than a photograph; this prevents false spatial precision.
- Display real map geometry while photoreal tiles load and fall back after bounded loading; missing coverage must not leave characters on an empty scene.
- Select explicitly supplied Google provider credentials before connector credentials within a server-only boundary, never mixing their transports; custom deployments can lack connector runtime secrets.
- Keep FIR location search independent of Google credentials: use authenticated OpenStreetMap geocoding with Pakistani city fallbacks, and render the picker map with OpenStreetMap tiles.