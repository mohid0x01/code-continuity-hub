import { useEffect, useRef } from "react";

/**
 * Fullscreen fixed-position canvas of twinkling stars.
 * Lightweight 2D animation (GPU-accelerated via requestAnimationFrame).
 * Sits behind all app content (z-index 0, with content elevated above).
 */
export function TwinklingStars({ density = 140 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let stars: { x: number; y: number; r: number; a: number; s: number; hue: number }[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.floor((w * h) / 14000) + density;
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.2,
        a: Math.random(),
        s: 0.005 + Math.random() * 0.02,
        hue: Math.random() < 0.85 ? 45 : 200, // gold-ish or cool blue
      }));
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      // soft vignette glow
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      grad.addColorStop(0, "rgba(201,168,76,0.04)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (const st of stars) {
        st.a += st.s;
        const alpha = (Math.sin(st.a) + 1) / 2;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        const color = st.hue === 45
          ? `rgba(255, 220, 140, ${alpha * 0.9})`
          : `rgba(180, 210, 255, ${alpha * 0.8})`;
        ctx.fillStyle = color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    tick();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [density]);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />
  );
}
