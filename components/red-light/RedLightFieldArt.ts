export const RLGL_FIELD = {
  skyTop: "#87CEEB",
  skyMid: "#B8E4F9",
  reedGold: "#D4A843",
  reedTan: "#C9A227",
  sand: "#E8D5A8",
  sandShadow: "#C4A574",
  sandLine: "rgba(180, 140, 90, 0.35)",
  finishRed: "#E53935",
  wallHouse: "#F5E6C8",
  wallDoor: "#8D6E63",
  guardPink: "#E91E8C",
};

export function drawSquidGameField(
  ctx: CanvasRenderingContext2D,
  opts: {
    halfW: number;
    trackLength: number;
    startY: number;
    finishY: number;
    camY: number;
  }
): void {
  const { halfW, trackLength, startY, finishY, camY } = opts;
  const top = camY - trackLength;
  const bottom = camY + trackLength;

  const skyGrad = ctx.createLinearGradient(0, top, 0, finishY - 200);
  skyGrad.addColorStop(0, RLGL_FIELD.skyTop);
  skyGrad.addColorStop(1, RLGL_FIELD.skyMid);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(-halfW - 200, top, halfW * 2 + 400, finishY - top + 400);

  drawReedWall(ctx, -halfW - 90, top, bottom, true);
  drawReedWall(ctx, halfW + 90, top, bottom, false);

  const sandGrad = ctx.createLinearGradient(0, finishY, 0, startY + 80);
  sandGrad.addColorStop(0, RLGL_FIELD.sandShadow);
  sandGrad.addColorStop(0.4, RLGL_FIELD.sand);
  sandGrad.addColorStop(1, "#F0E2BC");
  ctx.fillStyle = sandGrad;
  ctx.fillRect(-halfW - 30, finishY - 40, halfW * 2 + 60, startY - finishY + 160);

  const laneCount = 14;
  ctx.strokeStyle = RLGL_FIELD.sandLine;
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= laneCount; i++) {
    const t = i / laneCount;
    const y = finishY + (startY - finishY) * t;
    const inset = 40 + t * 20;
    ctx.beginPath();
    ctx.moveTo(-halfW + inset, y);
    ctx.lineTo(halfW - inset, y);
    ctx.stroke();
  }

  ctx.strokeStyle = RLGL_FIELD.finishRed;
  ctx.lineWidth = 6;
  ctx.shadowColor = "rgba(229, 57, 53, 0.6)";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(-halfW + 20, finishY);
  ctx.lineTo(halfW - 20, finishY);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(229, 57, 53, 0.15)";
  ctx.fillRect(-halfW + 20, finishY - 8, halfW * 2 - 40, 16);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 10]);
  ctx.beginPath();
  ctx.moveTo(-halfW + 10, startY);
  ctx.lineTo(halfW - 10, startY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("START", 0, startY + 28);
}

function drawReedWall(
  ctx: CanvasRenderingContext2D,
  x: number,
  yTop: number,
  yBottom: number,
  left: boolean
) {
  const w = 70;
  const grad = ctx.createLinearGradient(left ? x : x - w, 0, left ? x + w : x, 0);
  grad.addColorStop(0, RLGL_FIELD.reedGold);
  grad.addColorStop(0.5, RLGL_FIELD.reedTan);
  grad.addColorStop(1, "#A8892E");
  ctx.fillStyle = grad;
  ctx.fillRect(left ? x : x - w, yTop, w, yBottom - yTop + 400);

  ctx.fillStyle = RLGL_FIELD.skyMid;
  for (let y = yTop; y < yBottom; y += 28) {
    for (let i = 0; i < 5; i++) {
      const ox = (left ? x + 8 : x - w + 8) + i * 12;
      ctx.beginPath();
      ctx.moveTo(ox, y);
      ctx.lineTo(ox + (left ? 4 : -4), y - 18);
      ctx.lineTo(ox + (left ? 10 : -10), y - 8);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawHouseStrip(ctx, x + (left ? w + 8 : -w - 88), yTop + 120, left);
}

function drawHouseStrip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  left: boolean
) {
  for (let i = 0; i < 4; i++) {
    const hy = y + i * 180;
    ctx.fillStyle = RLGL_FIELD.wallHouse;
    ctx.fillRect(x, hy, 80, 60);
    ctx.fillStyle = RLGL_FIELD.wallDoor;
    ctx.fillRect(x + 30, hy + 25, 20, 35);
    ctx.fillStyle = "#90CAF9";
    ctx.fillRect(x + 10, hy + 12, 16, 14);
    ctx.fillRect(x + 54, hy + 12, 16, 14);
  }
}

export function drawPinkGuard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s = 1
) {
  ctx.fillStyle = RLGL_FIELD.guardPink;
  ctx.fillRect(x - 9 * s, y - 30 * s, 18 * s, 34 * s);
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(x, y - 36 * s, 11 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y - 36 * s, 9 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(x, y - 36 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
}
