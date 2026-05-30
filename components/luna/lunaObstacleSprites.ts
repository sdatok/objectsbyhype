const TOWER_SPRITE_URLS: Record<string, string> = {
  tower_kt_corp: "/survivor/buildings/tower_kt_corp.png",
  tower_dan_sporting: "/survivor/buildings/tower_dan_sporting.png",
  tower_horizon: "/survivor/buildings/tower_horizon.png",
  tower_goat: "/survivor/buildings/tower_goat.png",
  tower_src: "/survivor/buildings/tower_src.png",
  tower_pax: "/survivor/buildings/tower_pax.png",
  tower_internet_money: "/survivor/buildings/tower_internet_money.png",
  tower_tomy: "/survivor/buildings/tower_tomy.png",
  tower_ror_sply: "/survivor/buildings/tower_ror_sply.png",
  tower_gus_supply: "/survivor/buildings/tower_gus_supply.png",
};

const BLACK_KEY = 16;
const spriteCache = new Map<string, HTMLCanvasElement>();

function isBackgroundPixel(r: number, g: number, b: number, kind: string) {
  if (r <= BLACK_KEY && g <= BLACK_KEY && b <= BLACK_KEY) return true;
  if (kind.startsWith("tower_")) {
    const neutral =
      Math.abs(r - g) <= 12 && Math.abs(g - b) <= 12 && Math.abs(r - b) <= 12;
    if (neutral && r >= 168 && g >= 168 && b >= 168) return true;
  }
  return false;
}

function processSprite(img: HTMLImageElement, kind: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (isBackgroundPixel(d[i]!, d[i + 1]!, d[i + 2]!, kind)) d[i + 3] = 0;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function preloadLunaObstacleSprites() {
  for (const [kind, src] of Object.entries(TOWER_SPRITE_URLS)) {
    if (spriteCache.has(kind)) continue;
    const img = new Image();
    img.src = src;
    img.onload = () => spriteCache.set(kind, processSprite(img, kind));
  }
}

interface LunaObstacle {
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function drawLunaObstacle(
  ctx: CanvasRenderingContext2D,
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  o: LunaObstacle,
  scale: number
) {
  const tl = toScreen(o.x - o.w / 2, o.y - o.h / 2);
  const w = o.w * scale;
  const h = o.h * scale;

  if (o.kind.startsWith("tower_")) {
    const img = spriteCache.get(o.kind);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (img && img.width > 0) {
      ctx.drawImage(img, tl.x, tl.y, w, h);
    } else {
      ctx.fillStyle = "#1a1a22";
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = 2;
      ctx.fillRect(tl.x, tl.y, w, h);
      ctx.strokeRect(tl.x, tl.y, w, h);
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle = o.kind === "rock" ? "#4a4a52" : "#2d241c";
  ctx.strokeStyle = "#1a1510";
  ctx.lineWidth = 2;
  ctx.fillRect(tl.x, tl.y, w, h);
  ctx.strokeRect(tl.x, tl.y, w, h);
}
