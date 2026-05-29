"use client";

import { useEffect, useRef } from "react";
import {
  DEFAULT_SLIME_COLOR,
  hasAccessory,
  SLIME_ACCESSORY_GUCCI_HAT,
  SLIME_ACCESSORY_SUNGLASSES,
  type SlimeColor,
} from "@/lib/survivor-slime";

interface SlimeAvatarProps {
  color?: SlimeColor | string;
  face?: number;
  accessories?: number;
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
  accessories = 0,
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
    drawSlime(
      ctx,
      size / 2,
      size / 2,
      size * 0.28,
      color,
      face,
      aim,
      frozen,
      burning,
      Date.now(),
      accessories
    );
  }, [color, face, accessories, size, aim, frozen, burning]);

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
  now = Date.now(),
  accessories = 0
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

  if (hasAccessory(accessories, SLIME_ACCESSORY_GUCCI_HAT)) {
    drawGucciHat(ctx, cx, cy, r);
  }

  const eyeY = cy - r * 0.05;
  const eyeX = r * 0.32;
  const eyeR = Math.max(2, r * 0.11);
  const showEyes = !hasAccessory(accessories, SLIME_ACCESSORY_SUNGLASSES);

  if (showEyes) {
    ctx.fillStyle = "#111827";
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
  }

  if (hasAccessory(accessories, SLIME_ACCESSORY_SUNGLASSES)) {
    drawSunglasses(ctx, cx, cy, r, eyeX, eyeY, eyeR);
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

function drawGucciHat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
) {
  const brimY = cy - r * 0.55;
  const crownH = r * 0.42;
  const crownW = r * 0.72;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(cx, brimY + r * 0.08, r * 1.15, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#c4a574";
  ctx.strokeStyle = "#8b6914";
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.beginPath();
  ctx.roundRect(cx - crownW / 2, brimY - crownH, crownW, crownH, r * 0.08);
  ctx.fill();
  ctx.stroke();

  const bandY = brimY - crownH * 0.35;
  const bandH = r * 0.14;
  const stripeW = crownW / 3;
  ctx.fillStyle = "#166534";
  ctx.fillRect(cx - crownW / 2, bandY, stripeW, bandH);
  ctx.fillStyle = "#991b1b";
  ctx.fillRect(cx - crownW / 2 + stripeW, bandY, stripeW, bandH);
  ctx.fillStyle = "#166534";
  ctx.fillRect(cx - crownW / 2 + stripeW * 2, bandY, stripeW, bandH);

  ctx.fillStyle = "#facc15";
  ctx.font = `bold ${Math.max(7, r * 0.22)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GG", cx, brimY - crownH * 0.72);

  ctx.fillStyle = "#b8956a";
  ctx.beginPath();
  ctx.ellipse(cx, brimY, r * 1.05, r * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7c5a1e";
  ctx.stroke();
  ctx.restore();
}

function drawSunglasses(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  eyeX: number,
  eyeY: number,
  eyeR: number
) {
  const lensW = eyeR * 2.4;
  const lensH = eyeR * 1.5;
  ctx.save();
  ctx.fillStyle = "#111827";
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = Math.max(1.5, r * 0.05);

  ctx.beginPath();
  ctx.roundRect(cx - eyeX - lensW / 2, eyeY - lensH / 2, lensW, lensH, eyeR * 0.4);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(cx + eyeX - lensW / 2, eyeY - lensH / 2, lensW, lensH, eyeR * 0.4);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(cx - eyeX + lensW / 2, eyeY);
  ctx.lineTo(cx + eyeX - lensW / 2, eyeY);
  ctx.stroke();

  const grad = ctx.createLinearGradient(cx - eyeX, eyeY, cx - eyeX, eyeY + lensH);
  grad.addColorStop(0, "rgba(255,255,255,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(cx - eyeX - lensW / 2, eyeY - lensH / 2, lensW, lensH * 0.45);
  ctx.fillRect(cx + eyeX - lensW / 2, eyeY - lensH / 2, lensW, lensH * 0.45);

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = Math.max(1.5, r * 0.04);
  ctx.beginPath();
  ctx.moveTo(cx - eyeX - lensW / 2, eyeY);
  ctx.lineTo(cx - eyeX - lensW * 0.9, eyeY + r * 0.08);
  ctx.moveTo(cx + eyeX + lensW / 2, eyeY);
  ctx.lineTo(cx + eyeX + lensW * 0.9, eyeY + r * 0.08);
  ctx.stroke();
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
