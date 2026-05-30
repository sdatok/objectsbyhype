"use client";

import { formatMonthKey } from "@/lib/wheel-config";

const TIER_COPY = {
  COMMON: { headline: "NICE PULL", color: "#22d3ee" },
  RARE: { headline: "RARE HIT", color: "#a855f7" },
  JACKPOT: { headline: "JACKPOT", color: "#fbbf24" },
};

export default function WheelWinOverlay({
  prizeLabel,
  tier,
  monthKey,
}: {
  prizeLabel: string;
  tier: "COMMON" | "RARE" | "JACKPOT";
  monthKey: string;
}) {
  const copy = TIER_COPY[tier];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/85 backdrop-blur-sm">
      <div
        className="max-w-md w-full border-4 p-8 text-center animate-pulse"
        style={{
          borderColor: copy.color,
          boxShadow: `0 0 60px ${copy.color}55, inset 0 0 40px ${copy.color}22`,
        }}
      >
        <p
          className="font-pixel text-[10px] sm:text-xs tracking-[0.3em]"
          style={{ color: copy.color }}
        >
          {copy.headline}
        </p>
        <h2 className="font-pixel text-sm sm:text-lg mt-4 text-white leading-relaxed">
          {prizeLabel}
        </h2>
        <p className="font-pixel-body text-xl text-neutral-300 mt-6">
          You&apos;ve used your spin for {formatMonthKey(monthKey)}.
        </p>
        <p className="font-pixel-body text-lg text-neutral-500 mt-2">
          We&apos;ll reach out to fulfill your prize.
        </p>
      </div>
    </div>
  );
}
