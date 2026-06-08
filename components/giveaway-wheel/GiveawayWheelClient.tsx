"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import RetroOverlay from "@/components/survivor/RetroOverlay";
import GiveawayPrizeStrip from "./GiveawayPrizeStrip";
import GiveawayWheelWinOverlay from "./GiveawayWheelWinOverlay";
import type { GiveawayWheelTier } from "@/lib/giveaway-wheel-prize-icons";

export interface PublicGiveawayWheelState {
  enabled: boolean;
  remainingByTier: { COMMON: number; RARE: number; JACKPOT: number };
  totalRemaining: number;
  tierWeights: { common: number; rare: number; jackpot: number };
  prizes: Array<{ label: string; tier: GiveawayWheelTier }>;
}

type Phase = "idle" | "spinning" | "won" | "error";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CODE: "That code isn't valid.",
  ALREADY_USED: "This code was already used.",
  DISABLED: "The giveaway wheel is offline.",
  POOL_EMPTY: "All prizes have been claimed.",
};

export default function GiveawayWheelClient({
  initialState,
}: {
  initialState: PublicGiveawayWheelState;
}) {
  const [state] = useState(initialState);
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [result, setResult] = useState<{
    prizeLabel: string;
    tier: GiveawayWheelTier;
    winnerName: string;
    bonusCode?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLabel, setTargetLabel] = useState<string | null>(null);
  const spinResolveRef = useRef<(() => void) | null>(null);

  const onSpinComplete = useCallback(() => {
    spinResolveRef.current?.();
    spinResolveRef.current = null;
  }, []);

  const spin = async () => {
    if (phase === "spinning") return;
    const trimmedCode = code.trim();
    if (trimmedCode.length < 8) {
      setError("Enter your winner code to spin.");
      setPhase("error");
      return;
    }

    setError(null);
    setTargetLabel(null);
    setPhase("spinning");

    try {
      const res = await fetch("/api/giveaway-wheel/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmedCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data.message ||
          ERROR_MESSAGES[data.error as string] ||
          "Spin failed.";
        setError(msg);
        setPhase("error");
        return;
      }

      setTargetLabel(data.prizeLabel);
      await new Promise<void>((resolve) => {
        spinResolveRef.current = resolve;
      });

      setResult({
        prizeLabel: data.prizeLabel,
        tier: data.tier,
        winnerName: data.winnerName,
        bonusCode: data.bonusCode,
      });
      setPhase("won");
    } catch {
      setError("Network error. Try again.");
      setPhase("error");
    }
  };

  useEffect(() => {
    if (!code || code.length < 8) {
      setWinnerName(null);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/giveaway-wheel/spin", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.ok) setWinnerName(data.winnerName ?? null);
        else setWinnerName(null);
      } catch {
        setWinnerName(null);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [code]);

  return (
    <main className="relative min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(16,185,129,0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(56,189,248,0.2) 0%, transparent 45%)",
        }}
      />

      <header className="relative z-10 text-center mb-6 sm:mb-8">
        <p
          className="font-pixel text-[11px] sm:text-sm md:text-base text-emerald-400 tracking-[0.35em]"
          style={{
            textShadow:
              "0 0 16px rgba(52,211,153,0.95), 0 0 32px rgba(16,185,129,0.7)",
          }}
        >
          🎡 GIVEAWAY WHEEL 🖤🛜
        </p>
        <h1
          className="font-pixel text-base sm:text-xl md:text-2xl mt-3 text-white"
          style={{
            textShadow:
              "0 0 20px rgba(52,211,153,0.8), 0 0 40px rgba(56,189,248,0.4)",
          }}
        >
          GAME WINNER SPIN
        </h1>
        <p className="font-pixel-body text-xl sm:text-2xl text-neutral-300 mt-2">
          One spin per winner code
        </p>
        <div className="mt-5 max-w-md mx-auto border border-emerald-500/35 bg-black/50 px-4 py-3 text-left space-y-2">
          <p className="font-pixel text-[8px] text-emerald-300 tracking-widest">
            HOW IT WORKS
          </p>
          <p className="font-pixel-body text-sm sm:text-base text-neutral-200 leading-relaxed">
            Win a game and we&apos;ll send you a{" "}
            <span className="text-emerald-200">GW-XXXX-XXXX</span> code. Enter
            it below for one spin on the giveaway prize wheel.
          </p>
        </div>
      </header>

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-8">
        <GiveawayPrizeStrip
          prizes={state.prizes}
          spinning={phase === "spinning"}
          targetLabel={targetLabel}
          onSpinComplete={onSpinComplete}
        />

        {phase !== "won" && (
          <div className="w-full max-w-md space-y-4">
            <label className="block">
              <span className="font-pixel text-[8px] text-emerald-300 tracking-widest">
                WINNER CODE
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="GW-XXXX-XXXX"
                disabled={phase === "spinning"}
                className="mt-2 w-full bg-black/70 border-2 border-emerald-500/50 px-4 py-3 font-mono text-center text-lg tracking-widest text-white placeholder-neutral-600 focus:border-emerald-400 focus:outline-none disabled:opacity-50"
              />
            </label>
            {winnerName && (
              <p className="font-pixel-body text-lg text-center text-lime-300">
                Welcome, {winnerName}
              </p>
            )}
            {error && (
              <p className="font-pixel-body text-lg text-center text-rose-400">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={spin}
              disabled={phase === "spinning"}
              className="w-full font-pixel text-[10px] sm:text-xs py-4 border-2 border-white text-white disabled:opacity-40 hover:bg-emerald-600 hover:border-emerald-400 transition-colors"
              style={{
                background:
                  phase === "spinning"
                    ? "linear-gradient(135deg, #059669 0%, #0d9488 100%)"
                    : "linear-gradient(135deg, #10b981 0%, #0891b2 100%)",
                boxShadow: "4px 4px 0 rgba(255,255,255,0.85)",
              }}
            >
              {phase === "spinning" ? "SPINNING…" : "SPIN"}
            </button>
            <p className="font-pixel-body text-base text-center text-neutral-500">
              {state.totalRemaining} prizes left · Common {state.remainingByTier.COMMON} · Rare{" "}
              {state.remainingByTier.RARE} · Jackpot {state.remainingByTier.JACKPOT}
            </p>
          </div>
        )}
      </div>

      {phase === "won" && result && (
        <GiveawayWheelWinOverlay
          prizeLabel={result.prizeLabel}
          tier={result.tier}
          winnerName={result.winnerName}
          bonusCode={result.bonusCode}
        />
      )}

      <RetroOverlay />
    </main>
  );
}
