"use client";

import { GIVEAWAY_TIER_STYLES, type GiveawayWheelTier } from "@/lib/giveaway-wheel-prize-icons";
import WheelConfetti, { WheelWinPop } from "@/components/wheel/WheelConfetti";
import GiveawayPrizeCard from "./GiveawayPrizeCard";

export default function GiveawayWheelWinOverlay({
  prizeLabel,
  tier,
  winnerName,
  bonusCode,
}: {
  prizeLabel: string;
  tier: GiveawayWheelTier;
  winnerName: string;
  bonusCode?: string;
}) {
  const style = GIVEAWAY_TIER_STYLES[tier];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/85 backdrop-blur-sm overflow-hidden">
      <WheelConfetti tier={tier} intense={tier === "JACKPOT"} />
      <WheelWinPop>
        <div className="max-w-md w-full space-y-6 text-center">
          <p
            className="font-pixel text-[9px] sm:text-[10px] tracking-[0.35em]"
            style={{
              color: style.color,
              textShadow: `0 0 20px ${style.color}99`,
            }}
          >
            🎡 WINNER
          </p>
          <div
            className="relative"
            style={{ filter: `drop-shadow(0 0 28px ${style.color}55)` }}
          >
            <GiveawayPrizeCard label={prizeLabel} tier={tier} glowing />
          </div>
          <div
            className="border-2 px-6 py-5"
            style={{
              borderColor: `${style.color}66`,
              boxShadow: `inset 0 0 30px ${style.color}15`,
            }}
          >
            <p className="font-pixel-body text-xl text-neutral-200">
              Nice run, {winnerName}.
            </p>
            <p className="font-pixel-body text-lg text-neutral-400 mt-2">
              We&apos;ll reach out to fulfill your prize.
            </p>
            {bonusCode && (
              <p className="font-pixel-body text-base text-emerald-300 mt-4">
                Bonus spin code:{" "}
                <span className="font-mono tracking-widest">{bonusCode}</span>
              </p>
            )}
          </div>
        </div>
      </WheelWinPop>
    </div>
  );
}
