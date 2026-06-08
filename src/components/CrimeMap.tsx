import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CrimeLocation } from "@/lib/geocode";

export { geocodeFirText, type CrimeLocation } from "@/lib/geocode";

// Fix Leaflet's default icon paths in bundlers
const goldIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:28px;height:28px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle, rgba(201,168,76,0.9) 0%, rgba(201,168,76,0.2) 60%, transparent 70%);animation:crime-pulse 2s ease-in-out infinite;"></div>
      <div style="position:absolute;inset:8px;border-radius:50%;background:#c9a84c;border:2px solid #fff8e0;box-shadow:0 0 12px rgba(201,168,76,0.9);"></div>
    </div>
    <style>@keyframes crime-pulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.6);opacity:.3}}</style>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// CrimeLocation type re-exported from @/lib/geocode at top of file


interface CrimeMapProps {
  locations: CrimeLocation[];
  height?: string;
}

/**
 * Real OpenStreetMap (no API key required) showing crime scene locations
 * geocoded from the FIR text. Defaults to Sindh / Khairpur area when no
 * locations are provided.
 */
export function CrimeMap({ locations, height = "320px" }: CrimeMapProps) {
  // Default center: Khairpur, Sindh
  const valid = locations.filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng));
  const center: [number, number] = valid.length > 0
    ? [valid[0].lat, valid[0].lng]
    : [27.5295, 68.7592];

  useEffect(() => {
    // Force leaflet to recalc size on mount (fixes gray tiles in panels)
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="overflow-hidden rounded-[6px] border border-gold/30"
      style={{ height, background: "#0a0a0a" }}
    >
      <MapContainer
        center={center}
        zoom={valid.length > 0 ? 13 : 9}
        style={{ height: "100%", width: "100%", background: "#0a0a0a" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles-dark"
        />
        {valid.map((loc, i) => (
          <div key={i}>
            <Circle
              center={[loc.lat, loc.lng]}
              radius={120}
              pathOptions={{ color: "#c9a84c", fillColor: "#c9a84c", fillOpacity: 0.15, weight: 1 }}
            />
            <Marker position={[loc.lat, loc.lng]} icon={goldIcon}>
              <Popup>
                <div style={{ fontFamily: "Inter, sans-serif", color: "#111" }}>
                  <strong>{loc.label}</strong>
                  {loc.description && <div style={{ fontSize: 11, marginTop: 4 }}>{loc.description}</div>}
                  <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                    {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          </div>
        ))}
      </MapContainer>
    </div>
  );
}

// geocodeFirText is provided by @/lib/geocode and re-exported at the top.

