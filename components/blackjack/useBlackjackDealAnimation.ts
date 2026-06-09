import { useEffect, useRef, useState } from "react";
import type { PublicBlackjackMySeat } from "@/lib/blackjack-types";

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

function handKey(seat: PublicBlackjackMySeat): string {
  return `${seat.handPhase}-${seat.playerCards.length}-${seat.dealerCards.length}-${seat.finished}`;
}

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

export function useBlackjackDealAnimation(seat: PublicBlackjackMySeat | null) {
  const [anim, setAnim] = useState<DealAnimationState>(INITIAL);
  const prevRef = useRef<{
    key: string;
    playerLen: number;
    dealerLen: number;
    dealerHidden: boolean;
  } | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!seat || seat.handPhase === "IDLE") {
      setAnim(INITIAL);
      prevRef.current = null;
      return;
    }

    const schedule = (fn: () => void, ms: number) => {
      timersRef.current.push(setTimeout(fn, ms));
    };

    const prev = prevRef.current;
    const key = handKey(seat);
    const isNewHand = !prev || prev.key !== key;
    const playerLen = seat.playerCards.length;
    const dealerLen = seat.dealerCards.length;

    if (isNewHand && playerLen >= 2) {
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

      if (seat.dealerHidden) {
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

      if (seat.finished && !seat.dealerHidden) {
        revealDealerHand(
          dealerLen,
          setAnim,
          schedule,
          DEAL_START + DEAL_GAP * 3 + 200
        );
      }

      prevRef.current = {
        key,
        playerLen,
        dealerLen,
        dealerHidden: seat.dealerHidden,
      };
      return () => timersRef.current.forEach(clearTimeout);
    }

    if (prev && playerLen > prev.playerLen) {
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

    if (prev && prev.dealerHidden && !seat.dealerHidden) {
      setAnim((a) => ({ ...a, isDealing: true, showHoleBack: false }));
      revealDealerHand(dealerLen, setAnim, schedule, 350);
    }

    prevRef.current = {
      key,
      playerLen,
      dealerLen,
      dealerHidden: seat.dealerHidden,
    };

    return () => timersRef.current.forEach(clearTimeout);
  }, [
    seat?.handPhase,
    seat?.playerCards.length,
    seat?.dealerCards.length,
    seat?.dealerHidden,
    seat?.finished,
  ]);

  return anim;
}
