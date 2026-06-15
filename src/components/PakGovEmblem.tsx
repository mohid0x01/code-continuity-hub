import emblem from "@/assets/pak-gov-emblem.png";

/**
 * Pakistan Government emblem — used in headers, login, official surfaces.
 * Has an ambient emerald halo on hover, Resend-style.
 */
export function PakGovEmblem({
  size = 36,
  haloOnly = false,
  className = "",
}: {
  size?: number;
  haloOnly?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Ambient emerald halo */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, oklch(0.78 0.16 155 / 35%), transparent 70%)",
          filter: "blur(8px)",
        }}
      />
      {!haloOnly && (
        <img
          src={emblem}
          alt="Government of Pakistan emblem"
          width={size}
          height={size}
          loading="lazy"
          className="relative z-10 h-full w-full object-contain drop-shadow-[0_0_8px_rgba(120,220,170,0.4)]"
        />
      )}
    </div>
  );
}