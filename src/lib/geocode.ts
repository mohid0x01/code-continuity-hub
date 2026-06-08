/**
 * Lightweight place-name → coordinate lookup for Pakistani districts.
 * Pure JS so it can be imported anywhere without pulling in leaflet.
 */
export interface CrimeLocation {
  label: string;
  lat: number;
  lng: number;
  description?: string;
}

const PLACE_DB: Record<string, [number, number]> = {
  khairpur: [27.5295, 68.7592],
  sukkur: [27.7136, 68.8486],
  karachi: [24.8607, 67.0011],
  hyderabad: [25.396, 68.3578],
  larkana: [27.5571, 68.2126],
  shikarpur: [27.9556, 68.6383],
  nawabshah: [26.2442, 68.41],
  thatta: [24.7461, 67.9243],
  badin: [24.6555, 68.8378],
  mirpurkhas: [25.5276, 69.0142],
  lahore: [31.5204, 74.3587],
  islamabad: [33.6844, 73.0479],
  rawalpindi: [33.5651, 73.0169],
  peshawar: [34.0151, 71.5249],
  quetta: [30.1798, 66.975],
  multan: [30.1575, 71.5249],
  faisalabad: [31.4187, 73.0791],
};

export function geocodeFirText(text: string, fallbackLabels: string[] = []): CrimeLocation[] {
  const found: CrimeLocation[] = [];
  const seen = new Set<string>();
  const blob = (text + " " + fallbackLabels.join(" ")).toLowerCase();
  for (const [name, coords] of Object.entries(PLACE_DB)) {
    if (blob.includes(name) && !seen.has(name)) {
      seen.add(name);
      found.push({
        label: name.charAt(0).toUpperCase() + name.slice(1),
        lat: coords[0],
        lng: coords[1],
        description: "Location referenced in FIR",
      });
    }
  }
  if (found.length > 0) {
    fallbackLabels.forEach((lbl, i) => {
      if (!found.some((f) => f.label.toLowerCase() === lbl.toLowerCase())) {
        found.push({
          label: lbl,
          lat: found[0].lat + (i + 1) * 0.003,
          lng: found[0].lng + (i + 1) * 0.003,
          description: "Scene entity",
        });
      }
    });
  } else {
    // Default to Khairpur if nothing matched
    found.push({
      label: fallbackLabels[0] || "Khairpur",
      lat: 27.5295,
      lng: 68.7592,
      description: "Default district (no precise place matched in FIR)",
    });
  }
  return found;
}
