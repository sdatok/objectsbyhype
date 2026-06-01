"use client";

import type { ReactNode } from "react";
import type { WheelTier } from "@/lib/wheel-prize-icons";

const TIER_PALETTES: Record<WheelTier, string[]> = {
  COMMON: ["#22d3ee", "#67e8f9", "#a5f3fc", "#e0f2fe", "#ffffff"],
  RARE: ["#a855f7", "#c026d3", "#e879f9", "#f0abfc", "#7c3aed"],
  JACKPOT: ["#fbbf24", "#f59e0b", "#fcd34d", "#fde68a", "#fb923c", "#ffffff"],
};

export default function WheelConfetti({
  tier,
  intense = false,
}: {
  tier: WheelTier;
  /** More pieces for real wins and jackpots. */
  intense?: boolean;
}) {
  const colors = TIER_PALETTES[tier];
  const count = intense ? (tier === "JACKPOT" ? 72 : 52) : 32;
  const pieces = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${(i * 13 + 5) % 100}%`,
    delay: `${(i % 10) * 0.12}s`,
    duration: `${2.2 + (i % 6) * 0.35}s`,
    color: colors[i % colors.length]!,
    size: 5 + (i % 5),
    rotate: (i * 41) % 360,
    round: i % 3 === 0,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
      <style>{`
        @keyframes wheel-confetti-fall {
          0% {
            transform: translateY(-12vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(112vh) rotate(720deg);
            opacity: 0.25;
          }
        }
        @keyframes wheel-win-pop {
          0% { transform: scale(0.82); opacity: 0; }
          18% { transform: scale(1.06); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .wheel-confetti-piece {
          animation: wheel-confetti-fall linear forwards;
        }
        .wheel-win-pop {
          animation: wheel-win-pop 0.6s ease-out both;
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="wheel-confetti-piece absolute top-0"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            width: p.size,
            height: p.round ? p.size : p.size * 1.35,
            borderRadius: p.round ? "9999px" : "1px",
            background: p.color,
            boxShadow: `0 0 8px ${p.color}99`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function WheelWinPop({ children }: { children: ReactNode }) {
  return <div className="wheel-win-pop relative z-10">{children}</div>;
}
