"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { WheelTier } from "@/lib/wheel-prize-icons";
import PrizeCard from "./PrizeCard";

const CARD_WIDTH = 220;
const CARD_GAP = 16;
const STRIDE = CARD_WIDTH + CARD_GAP;
const SPIN_DURATION_MS = 4800;
const LEAD_ITEMS = 32;

export interface StripPrize {
  label: string;
  tier: WheelTier;
}

function pickRandom(pool: StripPrize[]): StripPrize {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function buildStrip(pool: StripPrize[], winnerLabel: string): StripPrize[] {
  const winner =
    pool.find((p) => p.label === winnerLabel) ??
    ({ label: winnerLabel, tier: "COMMON" as const } satisfies StripPrize);

  const strip: StripPrize[] = [];
  for (let i = 0; i < LEAD_ITEMS; i++) strip.push(pickRandom(pool));
  strip.push(winner);
  for (let i = 0; i < 4; i++) strip.push(pickRandom(pool));
  return strip;
}

function targetOffset(winnerIndex: number, viewportWidth: number) {
  return -(winnerIndex * STRIDE) + (viewportWidth / 2 - CARD_WIDTH / 2);
}

interface PrizeStripProps {
  prizes: StripPrize[];
  spinning: boolean;
  targetLabel: string | null;
  onSpinComplete: () => void;
}

export default function PrizeStrip({
  prizes,
  spinning,
  targetLabel,
  onSpinComplete,
}: PrizeStripProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [strip, setStrip] = useState<StripPrize[]>([]);
  const [landed, setLanded] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(400);
  const onCompleteRef = useRef(onSpinComplete);
  onCompleteRef.current = onSpinComplete;

  const pool = useMemo(
    () =>
      prizes.length > 0
        ? prizes
        : [{ label: "???", tier: "COMMON" as const }],
    [prizes]
  );

  const idleStrip = useMemo(
    () => pool.slice(0, Math.min(8, pool.length)),
    [pool]
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!spinning || !targetLabel) return;

    const nextStrip = buildStrip(pool, targetLabel);
    const winnerIndex = LEAD_ITEMS;
    const end = targetOffset(winnerIndex, viewportWidth);
    const start = end - STRIDE * 18;

    setStrip(nextStrip);
    setLanded(false);
    setOffset(start);

    const startMs = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startMs) / SPIN_DURATION_MS);
      const ease = 1 - Math.pow(1 - t, 5);
      setOffset(start + (end - start) * ease);

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setLanded(true);
        window.setTimeout(() => onCompleteRef.current(), 450);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinning, targetLabel, pool, viewportWidth]);

  const animating = spinning && !!targetLabel;
  const idleOffset = viewportWidth / 2 - CARD_WIDTH / 2 - STRIDE * 0.5;
  const displayOffset = animating || landed ? offset : idleOffset;
  const visibleStrip = animating || landed ? strip : idleStrip;

  return (
    <div className="relative w-full max-w-lg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-0.5 -translate-x-1/2 bg-fuchsia-400"
        style={{ boxShadow: "0 0 12px rgba(232,121,249,0.9)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2 w-[240px] border-x-2 border-fuchsia-400/40"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(192,38,211,0.08) 50%, transparent 100%)",
        }}
      />

      <div
        ref={viewportRef}
        className={`relative overflow-hidden border-2 border-fuchsia-500/50 bg-black/70 h-[108px] sm:h-[120px] ${
          spinning && !targetLabel ? "animate-pulse" : ""
        }`}
        style={{ boxShadow: "inset 0 0 40px rgba(124,58,237,0.15)" }}
      >
        <div
          className={`absolute top-0 left-0 flex h-full items-center gap-4 will-change-transform ${
            animating ? "" : "opacity-50"
          }`}
          style={{
            transform: `translateX(${displayOffset}px)`,
            transition: landed ? "transform 120ms ease-out" : undefined,
          }}
        >
          {visibleStrip.map((item, i) => (
            <PrizeCard
              key={`${item.label}-${i}-${animating ? "spin" : "idle"}`}
              label={item.label}
              tier={item.tier}
              compact
              glowing={landed && i === LEAD_ITEMS}
            />
          ))}
        </div>

        {!spinning && prizes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="font-pixel-body text-lg text-neutral-600">Loading prizes…</p>
          </div>
        )}
      </div>
    </div>
  );
}
