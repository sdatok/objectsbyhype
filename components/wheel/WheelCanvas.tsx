"use client";

import { useEffect, useRef } from "react";

const TIER_ANGLES = {
  COMMON: { start: 0.05, end: 0.55 },
  RARE: { start: 0.55, end: 0.82 },
  JACKPOT: { start: 0.82, end: 0.98 },
} as const;

const TIER_COLORS = {
  COMMON: ["#22d3ee", "#0891b2"],
  RARE: ["#a855f7", "#7c3aed"],
  JACKPOT: ["#fbbf24", "#f59e0b"],
};

interface WheelCanvasProps {
  spinning: boolean;
  targetTier: "COMMON" | "RARE" | "JACKPOT";
  onSpinComplete: () => void;
}

export default function WheelCanvas({
  spinning,
  targetTier,
  onSpinComplete,
}: WheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const animRef = useRef<number | null>(null);
  const spinAnimRef = useRef<{
    startMs: number;
    from: number;
    to: number;
    done: boolean;
  } | null>(null);
  const onCompleteRef = useRef(onSpinComplete);
  onCompleteRef.current = onSpinComplete;

  useEffect(() => {
    if (!spinning) return;

    const tierRange = TIER_ANGLES[targetTier];
    const fraction =
      tierRange.start + Math.random() * (tierRange.end - tierRange.start);
    const targetAngle = fraction * Math.PI * 2;
    const from = rotationRef.current;
    const to = from + Math.PI * 2 * 5 + targetAngle;

    spinAnimRef.current = {
      startMs: performance.now(),
      from,
      to,
      done: false,
    };
  }, [spinning, targetTier]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(420, window.innerWidth - 32);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.42;

    const drawWheel = (rotation: number) => {
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);

      for (const tier of ["COMMON", "RARE", "JACKPOT"] as const) {
        const { start, end } = TIER_ANGLES[tier];
        const a0 = start * Math.PI * 2;
        const a1 = end * Math.PI * 2;
        const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
        grad.addColorStop(0, TIER_COLORS[tier][0]!);
        grad.addColorStop(1, TIER_COLORS[tier][1]!);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, a0, a1);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 2;
        ctx.stroke();

        const mid = (a0 + a1) / 2;
        ctx.save();
        ctx.rotate(mid);
        ctx.translate(r * 0.62, 0);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(tier.slice(0, 3), 0, 0);
        ctx.restore();
      }
      ctx.restore();

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c026d3";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "#c026d3";
      ctx.beginPath();
      ctx.moveTo(cx, cy - r - 14);
      ctx.lineTo(cx - 12, cy - r + 8);
      ctx.lineTo(cx + 12, cy - r + 8);
      ctx.closePath();
      ctx.fill();
    };

    const tick = (now: number) => {
      const anim = spinAnimRef.current;
      if (anim && !anim.done) {
        const elapsed = now - anim.startMs;
        const duration = 4000;
        const t = Math.min(1, elapsed / duration);
        const ease = 1 - Math.pow(1 - t, 4);
        rotationRef.current = anim.from + (anim.to - anim.from) * ease;
        if (t >= 1) {
          anim.done = true;
          spinAnimRef.current = null;
          onCompleteRef.current();
        }
      }
      drawWheel(rotationRef.current);
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-50"
        style={{
          background:
            "radial-gradient(circle, rgba(192,38,211,0.5) 0%, transparent 70%)",
        }}
      />
      <canvas ref={canvasRef} className="relative block" />
    </div>
  );
}
