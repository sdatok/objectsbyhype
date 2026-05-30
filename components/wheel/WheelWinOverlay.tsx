"use client";

import { formatMonthKey } from "@/lib/wheel-config";
import { TIER_STYLES, type WheelTier } from "@/lib/wheel-prize-icons";
import PrizeCard from "./PrizeCard";

export default function WheelWinOverlay({
  prizeLabel,
  tier,
  monthKey,
  demo = false,
  onDismiss,
}: {
  prizeLabel: string;
  tier: WheelTier;
  monthKey: string;
  demo?: boolean;
  onDismiss?: () => void;
}) {
  const style = TIER_STYLES[tier];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/85 backdrop-blur-sm">
      <div className="max-w-md w-full space-y-6 text-center">
        {demo && (
          <p className="font-pixel text-[8px] sm:text-[9px] tracking-[0.25em] text-amber-300">
            PREVIEW SPIN · NO CODE
          </p>
        )}
        <PrizeCard label={prizeLabel} tier={tier} glowing />
        <div
          className="border-2 px-6 py-5"
          style={{
            borderColor: `${style.color}66`,
            boxShadow: `inset 0 0 30px ${style.color}15`,
          }}
        >
          {demo ? (
            <>
              <p className="font-pixel-body text-xl text-neutral-200">
                With a pro code, you could&apos;ve won this.
              </p>
              <p className="font-pixel-body text-lg text-neutral-400 mt-2">
                Pro members get one real spin each month — enter your{" "}
                <span className="text-fuchsia-300">OBH-XXXX-XXXX</span> code to
                lock in prizes like this for {formatMonthKey(monthKey)}.
              </p>
            </>
          ) : (
            <>
              <p className="font-pixel-body text-xl text-neutral-300">
                You&apos;ve used your spin for {formatMonthKey(monthKey)}.
              </p>
              <p className="font-pixel-body text-lg text-neutral-500 mt-2">
                We&apos;ll reach out to fulfill your prize.
              </p>
            </>
          )}
        </div>
        {demo && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="w-full font-pixel text-[10px] sm:text-xs py-4 border-2 border-white text-white hover:bg-fuchsia-600 hover:border-fuchsia-400 transition-colors"
            style={{
              background: "linear-gradient(135deg, #c026d3 0%, #7c3aed 100%)",
              boxShadow: "4px 4px 0 rgba(255,255,255,0.85)",
            }}
          >
            SPIN AGAIN
          </button>
        )}
      </div>
    </div>
  );
}
