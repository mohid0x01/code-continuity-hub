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
  // Sindh
  khairpur: [27.5295, 68.7592], sukkur: [27.7136, 68.8486], karachi: [24.8607, 67.0011],
  hyderabad: [25.396, 68.3578], larkana: [27.5571, 68.2126], shikarpur: [27.9556, 68.6383],
  nawabshah: [26.2442, 68.41], thatta: [24.7461, 67.9243], badin: [24.6555, 68.8378],
  mirpurkhas: [25.5276, 69.0142], jacobabad: [28.2769, 68.4514], dadu: [26.7319, 67.7756],
  ghotki: [28.0103, 69.3144], jamshoro: [25.4317, 68.2811], kashmore: [28.4333, 69.5833],
  matiari: [25.5917, 68.4500], sanghar: [26.0464, 68.9489], "tando allahyar": [25.4608, 68.7178],
  "tando muhammad khan": [25.1262, 68.5314], umerkot: [25.3614, 69.7361], naushahro: [26.8389, 68.1239],
  sehwan: [26.4239, 67.8650], moro: [26.6614, 68.0086], rohri: [27.6919, 68.8939],
  // Punjab
  lahore: [31.5204, 74.3587], rawalpindi: [33.5651, 73.0169], multan: [30.1575, 71.5249],
  faisalabad: [31.4187, 73.0791], gujranwala: [32.1877, 74.1945], sialkot: [32.4945, 74.5229],
  bahawalpur: [29.3956, 71.6836], sargodha: [32.0836, 72.6711], sahiwal: [30.6706, 73.1064],
  okara: [30.8138, 73.4534], kasur: [31.1187, 74.4500], jhang: [31.2681, 72.3181],
  sheikhupura: [31.7167, 73.9850], gujrat: [32.5742, 74.0789], rahim: [28.4202, 70.2952],
  "dera ghazi khan": [30.0561, 70.6403], muzaffargarh: [30.0703, 71.1933], khanewal: [30.3017, 71.9322],
  vehari: [30.0411, 72.3489], chiniot: [31.7197, 72.9789], jhelum: [32.9425, 73.7257],
  attock: [33.7708, 72.3603], chakwal: [32.9333, 72.8500], mianwali: [32.5839, 71.5370],
  bhakkar: [31.6258, 71.0628], khushab: [32.2956, 72.3500], hafizabad: [32.0707, 73.6883],
  mandibahauddin: [32.5861, 73.4914], narowal: [32.1014, 74.8736], pakpattan: [30.3431, 73.3856],
  lodhran: [29.5331, 71.6347], "rajanpur": [29.1042, 70.3303], "tobatek": [30.9709, 72.4825],
  // KPK
  peshawar: [34.0151, 71.5249], mardan: [34.1989, 72.0231], abbottabad: [34.1463, 73.2117],
  swat: [35.2227, 72.4258], mingora: [34.7796, 72.3614], kohat: [33.5869, 71.4414],
  bannu: [32.9889, 70.6047], "dera ismail khan": [31.8314, 70.9019], chitral: [35.8511, 71.7869],
  haripur: [33.9961, 72.9333], mansehra: [34.3322, 73.2014], swabi: [34.1208, 72.4694],
  charsadda: [34.1453, 71.7308], nowshera: [34.0153, 71.9747], hangu: [33.5325, 71.0556],
  // Balochistan
  quetta: [30.1798, 66.975], gwadar: [25.1264, 62.3225], turbat: [26.0014, 63.0444],
  khuzdar: [27.8000, 66.6167], chaman: [30.9219, 66.4597], "dera bugti": [29.0367, 69.1700],
  sibi: [29.5428, 67.8772], "loralai": [30.3697, 68.5969], zhob: [31.3408, 69.4486],
  hub: [25.0033, 66.9028], pasni: [25.2636, 63.4742], ormara: [25.2092, 64.6364],
  // Federal / AJK / GB
  islamabad: [33.6844, 73.0479], muzaffarabad: [34.3700, 73.4711], mirpur: [33.1486, 73.7517],
  gilgit: [35.9208, 74.3144], skardu: [35.2971, 75.6333], hunza: [36.3167, 74.6500],
};

export interface GeocodeOptions {
  /** The primary FIR location picked by the officer (exact lat/lng). Always pinned first. */
  primary?: { label: string; lat: number; lng: number; description?: string } | null;
}

/**
 * Extract every location pin the map should show:
 *  1. The primary FIR pin (exact coords from the location picker) — always first if given.
 *  2. Every Pakistani city/district mentioned in the narrative (deduped).
 *  3. Every AI-extracted scene location entity — scattered around the primary
 *     pin so they don't collapse into a single marker.
 */
export function geocodeFirText(
  text: string,
  fallbackLabels: string[] = [],
  options: GeocodeOptions = {},
): CrimeLocation[] {
  const found: CrimeLocation[] = [];
  const seen = new Set<string>();

  // 1) Primary FIR pin
  if (options.primary && Number.isFinite(options.primary.lat) && Number.isFinite(options.primary.lng)) {
    found.push({
      label: options.primary.label || "Incident Location",
      lat: options.primary.lat,
      lng: options.primary.lng,
      description: options.primary.description ?? "Primary FIR location",
    });
    seen.add((options.primary.label || "").toLowerCase());
  }

  // 2) Cities/districts referenced in the narrative
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

  // 3) AI-extracted scene locations — scatter around the anchor pin
  const anchor = found[0];
  if (anchor) {
    fallbackLabels.forEach((lbl, i) => {
      const key = lbl.toLowerCase();
      if (seen.has(key)) return;
      if (found.some((f) => f.label.toLowerCase() === key)) return;
      // Deterministic ring scatter (~300-800m) so multiple scene points render distinctly.
      const angle = (i * 137.508) * (Math.PI / 180); // golden-angle
      const radius = 0.004 + (i % 4) * 0.0025;       // ~450m..1.3km
      seen.add(key);
      found.push({
        label: lbl,
        lat: anchor.lat + Math.cos(angle) * radius,
        lng: anchor.lng + Math.sin(angle) * radius,
        description: "Scene entity (AI-extracted)",
      });
    });
  } else {
    // Nothing matched at all → fallback so the map still renders.
    found.push({
      label: fallbackLabels[0] || "Khairpur",
      lat: 27.5295,
      lng: 68.7592,
      description: "Default district (no precise place matched in FIR)",
    });
  }

  return found;
}
