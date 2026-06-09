import { useEffect, useRef, useState } from "react";
import type { PublicBlackjackEntry } from "@/lib/blackjack-types";

export interface DealAnimationState {
  playerCount: number;
  dealerUpCount: number;
  showHoleBack: boolean;
  holeRevealed: boolean;
  dealerDrawCount: number;
  isDealing: boolean;
}

const INITIAL: DealAnimationState = {
  playerCount: 0,
  dealerUpCount: 0,
  showHoleBack: false,
  holeRevealed: false,
  dealerDrawCount: 0,
  isDealing: false,
};

const DEAL_GAP = 480;
const DEAL_START = 180;

function revealDealerHand(
  dealerLen: number,
  setAnim: React.Dispatch<React.SetStateAction<DealAnimationState>>,
  schedule: (fn: () => void, ms: number) => void,
  startMs: number
) {
  schedule(
    () =>
      setAnim((a) => ({
        ...a,
        showHoleBack: false,
        holeRevealed: dealerLen > 1,
        dealerUpCount: Math.min(2, dealerLen),
      })),
    startMs
  );
  const extra = Math.max(0, dealerLen - 2);
  for (let i = 0; i < extra; i++) {
    schedule(
      () => setAnim((a) => ({ ...a, dealerDrawCount: i + 1 })),
      startMs + 520 + i * DEAL_GAP
    );
  }
  schedule(
    () => setAnim((a) => ({ ...a, isDealing: false })),
    startMs + 520 + extra * DEAL_GAP + 180
  );
}

export function useBlackjackDealAnimation(entry: PublicBlackjackEntry | null) {
  const [anim, setAnim] = useState<DealAnimationState>(INITIAL);
  const prevRef = useRef<{
    id: string;
    playerLen: number;
    dealerLen: number;
    dealerHidden: boolean;
  } | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!entry) {
      setAnim(INITIAL);
      prevRef.current = null;
      return;
    }

    const schedule = (fn: () => void, ms: number) => {
      timersRef.current.push(setTimeout(fn, ms));
    };

    const prev = prevRef.current;
    const isNewHand = !prev || prev.id !== entry.id;
    const playerLen = entry.playerCards.length;
    const dealerLen = entry.dealerCards.length;

    if (isNewHand) {
      setAnim({ ...INITIAL, isDealing: true });
      schedule(
        () => setAnim((a) => ({ ...a, playerCount: Math.min(1, playerLen) })),
        DEAL_START
      );
      schedule(
        () =>
          setAnim((a) => ({
            ...a,
            dealerUpCount: Math.min(1, dealerLen),
          })),
        DEAL_START + DEAL_GAP
      );
      schedule(
        () => setAnim((a) => ({ ...a, playerCount: Math.min(2, playerLen) })),
        DEAL_START + DEAL_GAP * 2
      );

      if (entry.dealerHidden) {
        schedule(
          () =>
            setAnim((a) => ({
              ...a,
              showHoleBack: true,
              isDealing: false,
            })),
          DEAL_START + DEAL_GAP * 3
        );
      } else {
        schedule(
          () => setAnim((a) => ({ ...a, isDealing: false })),
          DEAL_START + DEAL_GAP * 2 + 120
        );
      }

      if (entry.finished && !entry.dealerHidden) {
        revealDealerHand(
          dealerLen,
          setAnim,
          schedule,
          DEAL_START + DEAL_GAP * 3 + 200
        );
      }

      prevRef.current = {
        id: entry.id,
        playerLen,
        dealerLen,
        dealerHidden: entry.dealerHidden,
      };
      return () => timersRef.current.forEach(clearTimeout);
    }

    if (playerLen > prev.playerLen) {
      setAnim((a) => ({ ...a, isDealing: true }));
      for (let i = prev.playerLen; i < playerLen; i++) {
        const target = i + 1;
        schedule(
          () =>
            setAnim((a) => ({
              ...a,
              playerCount: target,
              isDealing: target < playerLen,
            })),
          (i - prev.playerLen) * DEAL_GAP + 100
        );
      }
    }

    if (prev.dealerHidden && !entry.dealerHidden) {
      setAnim((a) => ({ ...a, isDealing: true, showHoleBack: false }));
      revealDealerHand(dealerLen, setAnim, schedule, 350);
    }

    prevRef.current = {
      id: entry.id,
      playerLen,
      dealerLen,
      dealerHidden: entry.dealerHidden,
    };

    return () => timersRef.current.forEach(clearTimeout);
  }, [
    entry?.id,
    entry?.playerCards.length,
    entry?.dealerCards.length,
    entry?.dealerHidden,
    entry?.finished,
  ]);

  return anim;
}
