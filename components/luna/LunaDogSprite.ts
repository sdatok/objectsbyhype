/** Canvas sprite for Luna — a fast, scary black dog. */
export function drawLunaDog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  vx: number,
  vy: number,
  speed: number,
  nowMs: number,
  jumpAtMs = 0,
  shooting = false,
  shootAim = 0
) {
  const movingAngle =
    Math.hypot(vx, vy) > 8 ? Math.atan2(vy, vx) : 0;
  const angle = shooting ? shootAim : movingAngle;
  const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.012);
  const chase = Math.min(1, speed / 235);
  const jumpAge = jumpAtMs > 0 ? nowMs - jumpAtMs : Infinity;
  const jumpLift =
    jumpAge < 520 ? Math.sin((jumpAge / 520) * Math.PI) * radius * 2.4 : 0;

  ctx.save();
  ctx.translate(x, y - jumpLift);
  ctx.rotate(angle);

  if (shooting) {
    const telegraph = 0.55 + 0.45 * Math.sin(nowMs * 0.02);
    ctx.strokeStyle = `rgba(255, 60, 40, ${0.25 + telegraph * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(0) * radius * 5.5, Math.sin(0) * radius * 5.5);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 40, 30, ${0.35 + telegraph * 0.25})`;
    ctx.beginPath();
    ctx.arc(radius * 1.35, 0, radius * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  // Menacing aura when she's closing in
  if (chase > 0.35 && !shooting) {
    const auraR = radius * (2.2 + chase * 0.5 + pulse * 0.08);
    const grad = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, auraR);
    grad.addColorStop(0, `rgba(180, 0, 0, ${0.12 + chase * 0.18})`);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, auraR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground shadow — shrinks while airborne
  const shadowScale = jumpLift > 0 ? Math.max(0.25, 1 - jumpLift / (radius * 2.4)) : 1;
  ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * shadowScale})`;
  ctx.beginPath();
  ctx.ellipse(
    0,
    radius * 0.55 + jumpLift * 0.35,
    radius * 1.15 * shadowScale,
    radius * 0.35 * shadowScale,
    0,
    0,
    Math.PI * 2
  );
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

/** Small puppy — eliminated players hunt survivors. */
export function drawLunaPuppy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  vx: number,
  vy: number,
  nowMs: number,
  displayName: string
) {
  const angle = Math.hypot(vx, vy) > 6 ? Math.atan2(vy, vx) : 0;
  const wag = Math.sin(nowMs * 0.024) * radius * 0.15;
  const lineW = Math.max(1.5, radius * 0.14);

  // Soft halo so infected runners stay visible on dark mobile canvases.
  const halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.1);
  halo.addColorStop(0, "rgba(255, 170, 60, 0.28)");
  halo.addColorStop(0.55, "rgba(255, 90, 30, 0.12)");
  halo.addColorStop(1, "rgba(255, 90, 30, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.5, radius * 1.1, radius * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#3a2010";
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-radius * 0.85, 0);
  ctx.quadraticCurveTo(
    -radius * 1.35,
    wag,
    -radius * 1.55,
    wag * 1.4
  );
  ctx.stroke();

  ctx.fillStyle = "#6b3a18";
  ctx.strokeStyle = "#ffb066";
  ctx.lineWidth = Math.max(1.5, radius * 0.1);
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 1.12, radius * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#4a2810";
  ctx.strokeStyle = "#ff9a45";
  ctx.beginPath();
  ctx.moveTo(radius * 0.5, -radius * 0.45);
  ctx.lineTo(radius * 1.15, -radius * 0.05);
  ctx.lineTo(radius * 1.05, radius * 0.35);
  ctx.lineTo(radius * 0.4, radius * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  for (const side of [-1, 1]) {
    ctx.fillStyle = "#3a2008";
    ctx.strokeStyle = "#ff8a35";
    ctx.beginPath();
    ctx.moveTo(radius * 0.65, side * radius * 0.15);
    ctx.lineTo(radius * 0.82, side * radius * 0.72);
    ctx.lineTo(radius * 0.35, side * radius * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = "#120806";
  ctx.beginPath();
  ctx.arc(radius * 0.95, radius * 0.02, Math.max(2, radius * 0.07), 0, Math.PI * 2);
  ctx.fill();

  for (const side of [-1, 1]) {
    ctx.fillStyle = "#ffcc44";
    ctx.beginPath();
    ctx.arc(
      radius * 0.72,
      side * radius * 0.22,
      Math.max(2, radius * 0.08),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#ffd56a";
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = Math.max(2, radius * 0.08);
  ctx.font = `bold ${Math.max(10, radius * 0.42)}px monospace`;
  ctx.textAlign = "center";
  ctx.strokeText(displayName.slice(0, 12), x, y + radius * 1.65);
  ctx.fillText(displayName.slice(0, 12), x, y + radius * 1.65);
  ctx.restore();
}
