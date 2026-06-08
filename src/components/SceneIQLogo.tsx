import emblem from "@/assets/sceneiq-emblem.png";

export function SceneIQLogo({ size = "default" }: { size?: "default" | "large" }) {
  const dim = size === "large" ? "h-14 w-14" : "h-9 w-9";
  const textClass = size === "large" ? "text-3xl" : "text-xl";
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <img
          src={emblem}
          alt="SCENEIQ – Pakistan Police F.I.R. Reconstruction"
          className={`${dim} rounded-full object-contain drop-shadow-[0_0_12px_rgba(201,168,76,0.45)] gold-pulse`}
          width={size === "large" ? 56 : 36}
          height={size === "large" ? 56 : 36}
        />
      </div>
      <span className={`font-display font-bold text-gold tracking-[0.05em] ${textClass}`}>
        SCENEIQ
      </span>
    </div>
  );
}
