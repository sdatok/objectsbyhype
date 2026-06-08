"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GiveawayWheelTier } from "@/lib/giveaway-wheel-prize-icons";
import GiveawayPrizeCard from "./GiveawayPrizeCard";

export const GIVEAWAY_STRIP_CARD_WIDTH = 220;
const CARD_GAP = 16;
const SPIN_DURATION_MS = 10_000;
const WINNER_INDEX = 55;
const TRAVEL_ITEMS = 42;
const TRAIL_ITEMS = 50;

export interface GiveawayStripPrize {
  label: string;
  tier: GiveawayWheelTier;
}

function pickRandom(pool: GiveawayStripPrize[]): GiveawayStripPrize {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function buildStrip(pool: GiveawayStripPrize[], winnerLabel: string): GiveawayStripPrize[] {
  const winner =
    pool.find((p) => p.label === winnerLabel) ??
    ({ label: winnerLabel, tier: "COMMON" as const } satisfies GiveawayStripPrize);

  const strip: GiveawayStripPrize[] = [];
  for (let i = 0; i < WINNER_INDEX; i++) strip.push(pickRandom(pool));
  strip.push(winner);
  for (let i = 0; i < TRAIL_ITEMS; i++) strip.push(pickRandom(pool));
  return strip;
}

function measureStripMetrics(stripEl: HTMLElement) {
  const first = stripEl.children[0] as HTMLElement | undefined;
  const second = stripEl.children[1] as HTMLElement | undefined;
  const cardWidth = first?.offsetWidth ?? GIVEAWAY_STRIP_CARD_WIDTH;
  const stride =
    first && second
      ? second.offsetLeft - first.offsetLeft
      : cardWidth + CARD_GAP;
  return { cardWidth, stride };
}

function winnerOffset(
  winnerIndex: number,
  viewportWidth: number,
  cardWidth: number,
  stride: number
) {
  return -(winnerIndex * stride) + (viewportWidth / 2 - cardWidth / 2);
}

function spinEase(t: number) {
  return 1 - Math.pow(1 - t, 6);
}

function applyTransform(el: HTMLElement, px: number) {
  el.style.transform = `translate3d(${px}px, 0, 0)`;
}

export default function GiveawayPrizeStrip({
  prizes,
  spinning,
  targetLabel,
  onSpinComplete,
}: {
  prizes: GiveawayStripPrize[];
  spinning: boolean;
  targetLabel: string | null;
  onSpinComplete: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const [landed, setLanded] = useState(false);
  const [displayOffset, setDisplayOffset] = useState(0);
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

  const spinStrip = useMemo(() => {
    if (!spinning || !targetLabel) return null;
    return buildStrip(pool, targetLabel);
  }, [spinning, targetLabel, pool]);

  const animating = spinning && !!targetLabel;
  const showSpinStrip = animating || landed;
  const visibleStrip = showSpinStrip && spinStrip ? spinStrip : idleStrip;

  useLayoutEffect(() => {
    if (!spinStrip) return;

    setLanded(false);

    let measureRaf = 0;
    let animRaf = 0;
    let completeTimer = 0;
    let cancelled = false;

    measureRaf = requestAnimationFrame(() => {
      measureRaf = requestAnimationFrame(() => {
        if (cancelled) return;

        const stripEl = stripRef.current;
        const viewportEl = viewportRef.current;
        if (!stripEl || !viewportEl) {
          onCompleteRef.current();
          return;
        }

        const { cardWidth, stride } = measureStripMetrics(stripEl);
        const vw = viewportEl.clientWidth;
        const end = winnerOffset(WINNER_INDEX, vw, cardWidth, stride);
        const start = end - stride * TRAVEL_ITEMS;

        offsetRef.current = start;
        applyTransform(stripEl, start);
        setDisplayOffset(start);

        const startMs = performance.now();

        const tick = (now: number) => {
          if (cancelled) return;

          const t = Math.min(1, (now - startMs) / SPIN_DURATION_MS);
          const px = start + (end - start) * spinEase(t);
          offsetRef.current = px;
          applyTransform(stripEl, px);

          if (t < 1) {
            animRaf = requestAnimationFrame(tick);
          } else {
            offsetRef.current = end;
            applyTransform(stripEl, end);
            setDisplayOffset(end);
            setLanded(true);
            completeTimer = window.setTimeout(() => onCompleteRef.current(), 500);
          }
        };

        animRaf = requestAnimationFrame(tick);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(measureRaf);
      cancelAnimationFrame(animRaf);
      window.clearTimeout(completeTimer);
    };
  }, [spinStrip]);

  useEffect(() => {
    if (showSpinStrip) return;
    const viewportEl = viewportRef.current;
    const stripEl = stripRef.current;
    if (!viewportEl || !stripEl) return;

    const { cardWidth, stride } = measureStripMetrics(stripEl);
    const idle =
      winnerOffset(0, viewportEl.clientWidth, cardWidth, stride) - stride * 0.5;
    offsetRef.current = idle;
    applyTransform(stripEl, idle);
    setDisplayOffset(idle);
  }, [idleStrip, showSpinStrip]);

  return (
    <div className="relative w-full max-w-lg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-0.5 -translate-x-1/2 bg-emerald-400"
        style={{ boxShadow: "0 0 12px rgba(52,211,153,0.9)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2 w-[240px] border-x-2 border-emerald-400/40"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.08) 50%, transparent 100%)",
        }}
      />

      <div
        ref={viewportRef}
        className={`relative overflow-hidden border-2 border-emerald-500/50 bg-black/70 h-[108px] sm:h-[120px] ${
          spinning && !targetLabel ? "animate-pulse" : ""
        }`}
        style={{ boxShadow: "inset 0 0 40px rgba(16,185,129,0.15)" }}
      >
        <div
          ref={stripRef}
          className={`absolute top-0 left-0 flex h-full items-center gap-4 ${
            showSpinStrip ? "" : "opacity-50"
          }`}
          style={{
            transform: `translate3d(${displayOffset}px, 0, 0)`,
            willChange: showSpinStrip ? "transform" : "auto",
            backfaceVisibility: "hidden",
          }}
        >
          {visibleStrip.map((item, i) => (
            <GiveawayPrizeCard
              key={
                showSpinStrip
                  ? `spin-${i}-${item.label}`
                  : `idle-${i}-${item.label}`
              }
              label={item.label}
              tier={item.tier}
              compact
              glowing={landed && i === WINNER_INDEX}
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
