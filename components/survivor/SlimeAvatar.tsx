"use client";

import { useEffect, useRef } from "react";
import {
  DEFAULT_SLIME_COLOR,
  type SlimeColor,
} from "@/lib/survivor-slime";

interface SlimeAvatarProps {
  color?: SlimeColor | string;
  face?: number;
  size?: number;
  className?: string;
  aim?: number;
  frozen?: boolean;
  burning?: boolean;
}

/** Canvas slime blob used in lobby, standby, and can mirror in-game style. */
export default function SlimeAvatar({
  color = DEFAULT_SLIME_COLOR,
  face = 0,
  size = 96,
  className = "",
  aim = -Math.PI / 2,
  frozen = false,
  burning = false,
}: SlimeAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawSlime(ctx, size / 2, size / 2, size * 0.28, color, face, aim, frozen, burning);
  }, [color, face, size, aim, frozen, burning]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
    />
  );
}

export function drawSlime(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  face: number,
  aim: number,
  frozen: boolean,
  burning: boolean,
  now = Date.now()
) {
  ctx.save();
  const wobble = Math.sin(now * 0.006) * r * 0.1;
  let body = color;
  let stroke = shadeColor(color, -28);
  if (frozen) {
    body = mixHex(color, "#7dd3fc", 0.55);
    stroke = "#0284c7";
  }

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.55, r * 1.05, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = body;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.12, r * 1.05, r * 0.92 + wobble, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.35, cy - r * 0.15, r * 0.22, r * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();

  const eyeY = cy - r * 0.05;
  const eyeX = r * 0.32;
  ctx.fillStyle = "#111827";
  const eyeR = Math.max(2, r * 0.11);
  if (face === 1) {
    ctx.beginPath();
    ctx.arc(cx - eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(cx + eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx - eyeX + eyeR * 0.3, eyeY - eyeR * 0.25, eyeR * 0.35, 0, Math.PI * 2);
    ctx.arc(cx + eyeX + eyeR * 0.3, eyeY - eyeR * 0.25, eyeR * 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else if (face === 2) {
    ctx.lineWidth = Math.max(2, r * 0.07);
    ctx.strokeStyle = "#111827";
    ctx.beginPath();
    ctx.arc(cx - eyeX, eyeY, eyeR * 0.9, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + eyeX, eyeY, eyeR * 0.9, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else if (face === 3) {
    ctx.beginPath();
    ctx.ellipse(cx - eyeX, eyeY, eyeR * 1.2, eyeR * 0.55, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + eyeX, eyeY, eyeR * 1.2, eyeR * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(cx - eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(cx + eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
  }

  if (frozen) {
    ctx.strokeStyle = "rgba(186,230,253,0.9)";
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.1, r * 1.15, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (burning) {
    ctx.strokeStyle = "rgba(251,146,60,0.75)";
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.shadowColor = "rgba(249,115,22,0.8)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.1, r * 1.05, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(aim) * (r + 8), cy + Math.sin(aim) * (r + 8));
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function shadeColor(hex: string, amount: number): string {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const r = clamp(parseInt(n.slice(0, 2), 16) + amount, 0, 255);
  const g = clamp(parseInt(n.slice(2, 4), 16) + amount, 0, 255);
  const b = clamp(parseInt(n.slice(4, 6), 16) + amount, 0, 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return a;
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const n = hex.replace("#", "");
  if (n.length !== 6) return null;
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
