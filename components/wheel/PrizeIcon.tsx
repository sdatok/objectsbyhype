import type { PrizeIconType } from "@/lib/wheel-prize-icons";

/** 16×16 pixel grid — each row is a string of palette keys. */
const ICONS: Record<PrizeIconType, string[]> = {
  hat: [
    "    bbbb    ",
    "   bbbbbb   ",
    "  bbbbbbbb  ",
    " bbbbbbbbbb ",
    "bbbbbbbbbbbb",
    " bbbbbbbbbb ",
    "  bbbbbbbb  ",
    "   bbbbbb   ",
    "    bbbb    ",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
  ],
  cash: [
    "            ",
    "   gggggg   ",
    "  gggggggg  ",
    " gggg  gggg ",
    " ggg    ggg ",
    " gggg  gggg ",
    "  gggggggg  ",
    "   gggggg   ",
    "  gggggggg  ",
    " gggg  gggg ",
    " ggg    ggg ",
    " gggg  gggg ",
    "  gggggggg  ",
    "   gggggg   ",
    "            ",
    "            ",
  ],
  hoodie: [
    "   hhhhh    ",
    "  hhhhhhhh  ",
    " hhhhhhhhhh ",
    "hhhhhhhhhhhh",
    "hh        hh",
    "hh        hh",
    "hh        hh",
    "hh        hh",
    "hh        hh",
    "hh        hh",
    " hhhhhhhhhh ",
    "  hhhhhhhh  ",
    "   hhhhhh   ",
    "            ",
    "            ",
    "            ",
  ],
  pants: [
    "            ",
    "  pppppppp  ",
    " pppppppppp ",
    " pppppppppp ",
    " ppp    ppp ",
    " ppp    ppp ",
    " ppp    ppp ",
    " ppp    ppp ",
    " ppp    ppp ",
    " ppp    ppp ",
    " ppp    ppp ",
    " ppp    ppp ",
    " ppp    ppp ",
    " ppp    ppp ",
    " ppp    ppp ",
    "            ",
  ],
  shorts: [
    "            ",
    "  ssssssss  ",
    " ssssssssss ",
    " ssssssssss ",
    " sss    sss ",
    " sss    sss ",
    " sss    sss ",
    " sss    sss ",
    " sss    sss ",
    " sss    sss ",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
  ],
  glasses: [
    "            ",
    "            ",
    "  gg    gg  ",
    " gggg  gggg ",
    " gggg  gggg ",
    "  gg    gg  ",
    "    gggg    ",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
  ],
  wallet: [
    "            ",
    "  wwwwwwww  ",
    " wwwwwwwwww ",
    " wwwwwwwwww ",
    " wwwwwwwwww ",
    " wwwwwwwwww ",
    " wwwwwwwwww ",
    " wwwwwwwwww ",
    "  wwwwwwww  ",
    "   wwwwww   ",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
  ],
  shirt: [
    "   tttttt   ",
    "  tttttttt  ",
    " tttttttttt ",
    "tttttttttttt",
    " tt      tt ",
    "  tt    tt  ",
    "  tttttttt  ",
    "  tttttttt  ",
    "  tttttttt  ",
    "  tttttttt  ",
    "  tttttttt  ",
    "   tttttt   ",
    "            ",
    "            ",
    "            ",
    "            ",
  ],
  jewelry: [
    "     dd     ",
    "    dddd    ",
    "   dddddd   ",
    "  dddddddd  ",
    " dddddddddd ",
    "dddddddddddd",
    " dddddddddd ",
    "  dddddddd  ",
    "   dddddd   ",
    "    dddd    ",
    "     dd     ",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
  ],
  gift: [
    "    rrrr    ",
    "   rrrrrr   ",
    " rrrrrrrrrr ",
    "gggggggggggg",
    "gggggggggggg",
    "gggggggggggg",
    "gggggggggggg",
    "gggggggggggg",
    "gggggggggggg",
    "gggggggggggg",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
    "            ",
  ],
};

const PALETTES: Record<PrizeIconType, Record<string, string>> = {
  hat: { b: "#0891b2" },
  cash: { g: "#22c55e" },
  hoodie: { h: "#7c3aed" },
  pants: { p: "#3b82f6" },
  shorts: { s: "#6366f1" },
  glasses: { g: "#94a3b8" },
  wallet: { w: "#a16207" },
  shirt: { t: "#ec4899" },
  jewelry: { d: "#fbbf24" },
  gift: { r: "#ef4444", g: "#22c55e" },
};

export default function PrizeIcon({
  type,
  size = 40,
  className = "",
}: {
  type: PrizeIconType;
  size?: number;
  className?: string;
}) {
  const rows = ICONS[type];
  const palette = PALETTES[type];
  const w = rows[0]?.length ?? 16;
  const h = rows.length;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: "pixelated" }}
      aria-hidden
    >
      {rows.map((row, y) =>
        row.split("").map((ch, x) => {
          const fill = palette[ch];
          if (!fill || ch === " ") return null;
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
        })
      )}
    </svg>
  );
}
