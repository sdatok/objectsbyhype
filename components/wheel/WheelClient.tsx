"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import RetroOverlay from "@/components/survivor/RetroOverlay";
import WheelCanvas from "./WheelCanvas";
import WheelWinOverlay from "./WheelWinOverlay";

export interface PublicWheelState {
  enabled: boolean;
  monthKey: string;
  remainingByTier: { COMMON: number; RARE: number; JACKPOT: number };
  totalRemaining: number;
  tierWeights: { common: number; rare: number; jackpot: number };
}

type Phase = "idle" | "spinning" | "won" | "error";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CODE: "That code isn't valid.",
  ALREADY_USED: "This code was already used this month.",
  EXPIRED_MONTH: "This code is for a different month.",
  DISABLED: "The wheel is offline.",
  POOL_EMPTY: "All prizes have been claimed.",
  INACTIVE_MEMBER: "This membership is inactive.",
};

export default function WheelClient({
  initialState,
}: {
  initialState: PublicWheelState;
}) {
  const [state] = useState(initialState);
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [memberName, setMemberName] = useState<string | null>(null);
  const [result, setResult] = useState<{
    prizeLabel: string;
    tier: "COMMON" | "RARE" | "JACKPOT";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spinTarget, setSpinTarget] = useState<"COMMON" | "RARE" | "JACKPOT">(
    "COMMON"
  );
  const spinResolveRef = useRef<(() => void) | null>(null);

  const onSpinComplete = useCallback(() => {
    spinResolveRef.current?.();
    spinResolveRef.current = null;
  }, []);

  const spin = async () => {
    if (phase === "spinning") return;
    setError(null);
    setPhase("spinning");

    try {
      const res = await fetch("/api/wheel/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
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

      setSpinTarget(data.tier);
      await new Promise<void>((resolve) => {
        spinResolveRef.current = resolve;
      });

      setResult({ prizeLabel: data.prizeLabel, tier: data.tier });
      setPhase("won");
    } catch {
      setError("Network error. Try again.");
      setPhase("error");
    }
  };

  useEffect(() => {
    if (!code || code.length < 8) {
      setMemberName(null);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/wheel/spin", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.ok) setMemberName(data.memberName ?? null);
        else setMemberName(null);
      } catch {
        setMemberName(null);
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
            "radial-gradient(ellipse at 50% 20%, rgba(192,38,211,0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(124,58,237,0.2) 0%, transparent 45%)",
        }}
      />

      <header className="relative z-10 text-center mb-6 sm:mb-8">
        <p className="font-pixel text-[8px] sm:text-[10px] text-fuchsia-400 tracking-[0.35em] animate-pulse">
          OBJECTSBYHYPE PRO
        </p>
        <h1
          className="font-pixel text-base sm:text-xl md:text-2xl mt-3"
          style={{
            textShadow:
              "0 0 20px rgba(232,121,249,0.8), 0 0 40px rgba(124,58,237,0.5)",
          }}
        >
          WHEEL OF HYPE
        </h1>
        <p className="font-pixel-body text-xl sm:text-2xl text-neutral-300 mt-2">
          One spin · {state.monthKey}
        </p>
      </header>

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-8">
        <WheelCanvas
          spinning={phase === "spinning"}
          targetTier={spinTarget}
          onSpinComplete={onSpinComplete}
        />

        {phase !== "won" && (
          <div className="w-full max-w-md space-y-4">
            <label className="block">
              <span className="font-pixel text-[8px] text-fuchsia-300 tracking-widest">
                PRO CODE
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="OBH-XXXX-XXXX"
                disabled={phase === "spinning"}
                className="mt-2 w-full bg-black/70 border-2 border-fuchsia-500/50 px-4 py-3 font-mono text-center text-lg tracking-widest text-white placeholder-neutral-600 focus:border-fuchsia-400 focus:outline-none disabled:opacity-50"
              />
            </label>
            {memberName && (
              <p className="font-pixel-body text-lg text-center text-lime-300">
                Welcome, {memberName}
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
              disabled={phase === "spinning" || code.trim().length < 8}
              className="w-full font-pixel text-[10px] sm:text-xs py-4 border-2 border-white text-white disabled:opacity-40 hover:bg-fuchsia-600 hover:border-fuchsia-400 transition-colors"
              style={{
                background:
                  phase === "spinning"
                    ? "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)"
                    : "linear-gradient(135deg, #c026d3 0%, #7c3aed 100%)",
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
        <WheelWinOverlay
          prizeLabel={result.prizeLabel}
          tier={result.tier}
          monthKey={state.monthKey}
        />
      )}

      <RetroOverlay />
    </main>
  );
}
