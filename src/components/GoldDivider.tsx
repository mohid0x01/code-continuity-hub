export function GoldDivider({ width = "40px" }: { width?: string }) {
  return <div className="gold-divider my-4" style={{ width }} />;
}

export function DiamondSeparator() {
  return <span className="text-gold-muted text-[10px] mx-3">◆</span>;
}
