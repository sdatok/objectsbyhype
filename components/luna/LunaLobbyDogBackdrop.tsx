"use client";

import { useEffect, useRef } from "react";
import { drawLunaDog } from "@/components/luna/LunaDogSprite";

/** Animated pixel Luna — full-bleed lobby backdrop. */
export default function LunaLobbyDogBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      const w = canvas.parentElement?.clientWidth ?? 0;
      const h = canvas.parentElement?.clientHeight ?? 0;
      if (w <= 0 || h <= 0) {
        raf = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;

      const pulse = 0.5 + 0.5 * Math.sin(now * 0.0015);
      const radius = Math.min(w, h) * (w < 480 ? 0.34 : 0.28);
      const cx = w * 0.5;
      const cy = h * (w < 480 ? 0.58 : 0.62);

      ctx.save();
      ctx.globalAlpha = 0.42 + pulse * 0.08;
      drawLunaDog(ctx, cx, cy, radius, Math.cos(now * 0.0004) * 40, 0, 210, now);
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0"
    />
  );
}
