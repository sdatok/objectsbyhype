const DOLL_SRC = "/red-light/young-hee-doll.png";

let dollImage: HTMLImageElement | null = null;
let dollLoadStarted = false;

export function preloadYoungHeeDoll(): void {
  if (dollLoadStarted || typeof window === "undefined") return;
  dollLoadStarted = true;
  const img = new Image();
  img.src = DOLL_SRC;
  img.onload = () => {
    dollImage = img;
  };
}

export function isYoungHeeReady(): boolean {
  return !!dollImage && dollImage.complete && dollImage.naturalWidth > 0;
}

/** Draw Young-hee at finish line. turn01: 0 = back/green, 1 = facing/red. */
export function drawYoungHeeDoll(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  turn01: number,
  phase: string
): void {
  const facing = Math.max(0, Math.min(1, turn01));
  const s = scale;

  drawDeadTree(ctx, x, y - 130 * s, s);

  ctx.save();
  ctx.translate(x, y);

  if (facing < 0.08) {
    drawDollBack(ctx, s);
  } else if (facing > 0.92 && isYoungHeeReady() && dollImage) {
    drawDollFrontImage(ctx, dollImage, s, phase === "RED");
  } else {
    const t = facing;
    ctx.globalAlpha = 0.35 + t * 0.65;
    if (t < 0.5) {
      ctx.scale(1 - t * 0.15, 1);
      drawDollBack(ctx, s * (1 - t * 0.1));
    } else if (isYoungHeeReady() && dollImage) {
      drawDollFrontImage(ctx, dollImage, s * (0.85 + (t - 0.5) * 0.3), phase === "RED");
    } else {
      drawDollBack(ctx, s);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawDeadTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#3d2817";
  ctx.lineWidth = 7 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -95 * s);
  ctx.stroke();
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(0, -55 * s);
  ctx.lineTo(-38 * s, -88 * s);
  ctx.moveTo(0, -72 * s);
  ctx.lineTo(32 * s, -102 * s);
  ctx.moveTo(0, -40 * s);
  ctx.lineTo(-22 * s, -58 * s);
  ctx.stroke();
  ctx.restore();
}

function drawDollBack(ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = "#FF8C00";
  ctx.fillRect(-28 * s, -8 * s, 56 * s, 62 * s);
  ctx.fillStyle = "#FFD54F";
  ctx.beginPath();
  ctx.ellipse(0, -22 * s, 26 * s, 24 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(-22 * s, -28 * s, 9 * s, 0, Math.PI * 2);
  ctx.arc(22 * s, -28 * s, 9 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(-18 * s, 54 * s, 14 * s, 22 * s);
  ctx.fillRect(4 * s, 54 * s, 14 * s, 22 * s);
  ctx.fillStyle = "#111";
  ctx.fillRect(-16 * s, 72 * s, 18 * s, 8 * s);
  ctx.fillRect(6 * s, 72 * s, 18 * s, 8 * s);
}

function drawDollFrontImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  s: number,
  redEyes: boolean
) {
  const h = 200 * s;
  const w = (img.naturalWidth / img.naturalHeight) * h;
  ctx.drawImage(img, -w / 2, -h + 20 * s, w, h);

  if (redEyes) {
    ctx.fillStyle = "rgba(239, 68, 68, 0.55)";
    ctx.beginPath();
    ctx.ellipse(-w * 0.13, -h * 0.72, w * 0.06, h * 0.04, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.13, -h * 0.72, w * 0.06, h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function dollTurnProgress(
  phase: string,
  phaseEndsAtMs: number,
  nowMs: number,
  turningMs: number
): number {
  if (phase === "GREEN") return 0;
  if (phase === "RED") return 1;
  if (phase === "TURNING" && turningMs > 0) {
    const left = Math.max(0, phaseEndsAtMs - nowMs);
    return 1 - left / turningMs;
  }
  return 0.5;
}
