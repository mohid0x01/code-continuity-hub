# Architecture rules
- Keep Maps data calls authenticated and server-side, while the browser only renders maps and tiles; this protects paid provider credentials.
- Raster ground placement uses explicit projection metadata, and building heights come from geometry rather than a photograph; this prevents false spatial precision.
- Display real map geometry while photoreal tiles load and fall back after bounded loading; missing coverage must not leave characters on an empty scene.