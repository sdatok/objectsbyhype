/** Canvas sprite for Luna — a fast, scary black dog. */
export function drawLunaDog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  vx: number,
  vy: number,
  speed: number,
  nowMs: number
) {
  const angle =
    Math.hypot(vx, vy) > 8 ? Math.atan2(vy, vx) : 0;
  const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.012);
  const chase = Math.min(1, speed / 235);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Menacing aura when she's closing in
  if (chase > 0.35) {
    const auraR = radius * (2.2 + chase * 0.5 + pulse * 0.08);
    const grad = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, auraR);
    grad.addColorStop(0, `rgba(180, 0, 0, ${0.12 + chase * 0.18})`);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, auraR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.55, radius * 1.15, radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail — whip-like, animated
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = radius * 0.22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-radius * 0.95, 0);
  ctx.quadraticCurveTo(
    -radius * 1.55,
    Math.sin(nowMs * 0.018) * radius * 0.35,
    -radius * 1.85,
    Math.sin(nowMs * 0.018 + 0.8) * radius * 0.55
  );
  ctx.stroke();

  // Body — lean black mass
  const bodyGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
  bodyGrad.addColorStop(0, "#1a1a1a");
  bodyGrad.addColorStop(0.45, "#080808");
  bodyGrad.addColorStop(1, "#000000");
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 1.15, radius * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Legs — four dark strokes
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = radius * 0.16;
  const legStride = Math.sin(nowMs * 0.022 + chase * 2) * radius * 0.12;
  for (const side of [-1, 1]) {
    for (const [fx, fy] of [
      [0.35, 0.45],
      [-0.15, 0.5],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(radius * fx, side * radius * 0.28);
      ctx.lineTo(radius * (fx + 0.08), side * radius * 0.75 + legStride * side);
      ctx.stroke();
    }
  }

  // Head — angular, forward
  ctx.fillStyle = "#050505";
  ctx.beginPath();
  ctx.moveTo(radius * 0.55, -radius * 0.55);
  ctx.lineTo(radius * 1.35, -radius * 0.08);
  ctx.lineTo(radius * 1.25, radius * 0.42);
  ctx.lineTo(radius * 0.45, radius * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Ears — sharp upright triangles
  for (const side of [-1, 1]) {
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.moveTo(radius * 0.72, side * radius * 0.18);
    ctx.lineTo(radius * 0.95, side * radius * 0.95);
    ctx.lineTo(radius * 0.38, side * radius * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  // Snout
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.ellipse(radius * 1.18, radius * 0.08, radius * 0.34, radius * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(radius * 1.42, radius * 0.04, radius * 0.1, radius * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // Glowing red eyes
  for (const side of [-1, 1]) {
    const ex = radius * 0.82;
    const ey = side * radius * 0.28;
    const glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, radius * 0.22);
    glow.addColorStop(0, `rgba(255, ${40 + pulse * 30}, 20, 1)`);
    glow.addColorStop(0.45, `rgba(220, 0, 0, ${0.85 + chase * 0.15})`);
    glow.addColorStop(1, "rgba(120, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ex, ey, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff1a1a";
    ctx.beginPath();
    ctx.arc(ex, ey, radius * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  // Snarl — teeth and gums
  ctx.fillStyle = "#2a0000";
  ctx.beginPath();
  ctx.ellipse(radius * 1.05, radius * 0.28, radius * 0.22, radius * 0.1, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5f0e8";
  for (let i = 0; i < 4; i++) {
    const tx = radius * (0.92 + i * 0.08);
    ctx.beginPath();
    ctx.moveTo(tx, radius * 0.22);
    ctx.lineTo(tx + radius * 0.05, radius * 0.38);
    ctx.lineTo(tx - radius * 0.02, radius * 0.38);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();

  // Name tag — blood-red, flickering slightly when fast
  ctx.save();
  ctx.fillStyle = chase > 0.6 ? `rgba(255, 40, 40, ${0.85 + pulse * 0.15})` : "#cc2222";
  ctx.font = `bold ${Math.max(9, radius * 0.38)}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText("LUNA", x, y + radius * 1.75);
  ctx.restore();
}
