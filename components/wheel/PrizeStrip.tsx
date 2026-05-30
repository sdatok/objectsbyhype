"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { WheelTier } from "@/lib/wheel-prize-icons";
import PrizeCard from "./PrizeCard";

/** Must match compact PrizeCard width. gap-4 = 16px between cards. */
export const STRIP_CARD_WIDTH = 220;
const CARD_GAP = 16;
const SPIN_DURATION_MS = 10_000;
/** Index of the winning card in the built strip. */
const WINNER_INDEX = 55;
/** How many card-widths the strip travels during the spin. */
const TRAVEL_ITEMS = 42;
/** Tail filler so cards still exist off-screen at the start offset. */
const TRAIL_ITEMS = 50;

export interface StripPrize {
  label: string;
  tier: WheelTier;
}

function pickRandom(pool: StripPrize[]): StripPrize {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function buildStrip(pool: StripPrize[], winnerLabel: string): StripPrize[] {
  const winner =
    pool.find((p) => p.label === winnerLabel) ??
    ({ label: winnerLabel, tier: "COMMON" as const } satisfies StripPrize);

  const strip: StripPrize[] = [];
  for (let i = 0; i < WINNER_INDEX; i++) strip.push(pickRandom(pool));
  strip.push(winner);
  for (let i = 0; i < TRAIL_ITEMS; i++) strip.push(pickRandom(pool));
  return strip;
}

export function measureStripMetrics(stripEl: HTMLElement) {
  const first = stripEl.children[0] as HTMLElement | undefined;
  const second = stripEl.children[1] as HTMLElement | undefined;
  const cardWidth = first?.offsetWidth ?? STRIP_CARD_WIDTH;
  const stride =
    first && second
      ? second.offsetLeft - first.offsetLeft
      : cardWidth + CARD_GAP;
  return { cardWidth, stride };
}

export function winnerOffset(
  winnerIndex: number,
  viewportWidth: number,
  cardWidth: number,
  stride: number
) {
  return -(winnerIndex * stride) + (viewportWidth / 2 - cardWidth / 2);
}

/** Fast early travel, long ease-out at the end. */
function spinEase(t: number) {
  return 1 - Math.pow(1 - t, 6);
}

function applyTransform(el: HTMLElement, px: number) {
  el.style.transform = `translate3d(${px}px, 0, 0)`;
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
  const visibleStrip =
    showSpinStrip && spinStrip ? spinStrip : idleStrip;

  useLayoutEffect(() => {
    if (!spinStrip) return;

    setLanded(false);

    let measureRaf = 0;
    let animRaf = 0;
    let completeTimer = 0;
    let cancelled = false;

    // Two frames so every card is laid out before we measure stride.
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
            <PrizeCard
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
