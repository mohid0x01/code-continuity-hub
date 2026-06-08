/**
 * Stylized provincial police shield badges. Pure SVG so they stay crisp,
 * lightweight, and theme-able. Each shield uses the province's signature
 * color and initials.
 */
type Province = "sindh" | "punjab" | "kpk" | "balochistan";

const META: Record<Province, { initials: string; primary: string; accent: string; label: string }> = {
  sindh:       { initials: "SP", primary: "#0a7a3b", accent: "#c9a84c", label: "Sindh" },
  punjab:      { initials: "PP", primary: "#1e3a8a", accent: "#c9a84c", label: "Punjab" },
  kpk:         { initials: "KP", primary: "#7c1d1d", accent: "#c9a84c", label: "KPK" },
  balochistan: { initials: "BP", primary: "#3b2f1a", accent: "#c9a84c", label: "Baloch." },
};

export function PoliceShield({ province, size = 48 }: { province: Province; size?: number }) {
  const m = META[province];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`${m.label} Police emblem`}
      className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] transition-transform duration-300 hover:scale-110 hover:rotate-[-3deg]"
    >
      <defs>
        <linearGradient id={`g-${province}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={m.primary} stopOpacity="1" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {/* Shield body */}
      <path
        d="M32 4 L58 12 V32 C58 46 46 56 32 60 C18 56 6 46 6 32 V12 Z"
        fill={`url(#g-${province})`}
        stroke={m.accent}
        strokeWidth="1.5"
      />
      {/* Crescent + star (Pakistan) */}
      <path
        d="M30 14 a6 6 0 1 0 4 10 a4.5 4.5 0 1 1 -4 -10 z"
        fill={m.accent}
      />
      <polygon
        points="38,16 39,19 42,19 39.5,21 40.5,24 38,22 35.5,24 36.5,21 34,19 37,19"
        fill={m.accent}
      />
      {/* Initials */}
      <text
        x="32"
        y="44"
        textAnchor="middle"
        fontFamily="'Playfair Display', Georgia, serif"
        fontWeight="800"
        fontSize="16"
        fill={m.accent}
        letterSpacing="1"
      >
        {m.initials}
      </text>
      {/* Bottom ribbon dot */}
      <circle cx="32" cy="52" r="1.5" fill={m.accent} />
    </svg>
  );
}

export const POLICE_PROVINCES: { key: Province; label: string }[] = [
  { key: "sindh",       label: "Sindh Police" },
  { key: "punjab",      label: "Punjab Police" },
  { key: "kpk",         label: "KPK Police" },
  { key: "balochistan", label: "Balochistan Police" },
];
