import { PakGovEmblem } from "@/components/PakGovEmblem";

export function SceneIQLogo({ size = "default" }: { size?: "default" | "large" }) {
  const textClass = size === "large" ? "text-3xl" : "text-xl";
  const dim = size === "large" ? 56 : 36;
  return (
    <div className="flex items-center gap-3">
      <PakGovEmblem size={dim} />
      <div className="flex flex-col leading-none">
        <span className={`font-display font-bold text-foreground tracking-[0.02em] ${textClass}`}>
          SCENE<span className="text-gold">IQ</span>
        </span>
        {size === "large" && (
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
            Govt. of Pakistan · Police
          </span>
        )}
      </div>
    </div>
  );
}
