"use client";

import type { BJCard } from "@/lib/blackjack-engine";
import { cardLabel } from "@/lib/blackjack-engine";
import type { PublicBlackjackEntry } from "@/lib/blackjack-types";
import type { DealAnimationState } from "@/components/blackjack/useBlackjackDealAnimation";

const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"];
const SUIT_COLORS = [
  "text-neutral-900",
  "text-red-600",
  "text-red-600",
  "text-neutral-900",
];

function handTotal(cards: BJCard[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 1) {
      aces++;
      total += 11;
    } else if (c.rank >= 10) {
      total += 10;
    } else {
      total += c.rank;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function PlayingCard({
  card,
  hidden,
  animate = "deal",
  style,
}: {
  card?: BJCard;
  hidden?: boolean;
  animate?: "deal" | "flip" | "none";
  style?: React.CSSProperties;
}) {
  const animClass =
    animate === "deal"
      ? "bj-deal-card"
      : animate === "flip"
        ? "bj-flip-card"
        : "";

  if (hidden || !card) {
    return (
      <div className={`bj-card bj-card-back ${animClass}`} style={style}>
        <div className="bj-card-back-pattern" />
        <span className="text-amber-500/50 text-sm font-serif tracking-widest">
          OBH
        </span>
      </div>
    );
  }

  const color = SUIT_COLORS[card.suit] ?? "text-neutral-900";
  const symbol = SUIT_SYMBOLS[card.suit] ?? "?";
  const rank = cardLabel(card).slice(0, -1);

  return (
    <div className={`bj-card bj-card-face ${animClass}`} style={style}>
      <span className={`bj-card-corner top-left ${color}`}>
        {rank}
        <span className="bj-card-suit">{symbol}</span>
      </span>
      <span className={`bj-card-center ${color}`}>{symbol}</span>
      <span className={`bj-card-corner bottom-right ${color}`}>
        {rank}
        <span className="bj-card-suit">{symbol}</span>
      </span>
    </div>
  );
}

function HandBadge({ value }: { value: number }) {
  if (value <= 0) return null;
  return <span className="bj-hand-badge">{value}</span>;
}

interface BlackjackTableProps {
  entry: PublicBlackjackEntry | null;
  prizeTitle: string;
  outcomeLabel?: string | null;
  placement?: number | null;
  anim: DealAnimationState;
}

export default function BlackjackTable({
  entry,
  prizeTitle,
  outcomeLabel,
  placement,
  anim,
}: BlackjackTableProps) {

  const playerVisible = entry?.playerCards.slice(0, anim.playerCount) ?? [];
  const dealerCards = entry?.dealerCards ?? [];

  const dealerSlots: Array<{
    key: string;
    card?: BJCard;
    hidden?: boolean;
    animate?: "deal" | "flip" | "none";
  }> = [];

  if (anim.dealerUpCount >= 1 && dealerCards[0]) {
    dealerSlots.push({
      key: "d0",
      card: dealerCards[0],
      animate: "deal",
    });
  }

  if (entry?.dealerHidden && anim.showHoleBack && !anim.holeRevealed) {
    dealerSlots.push({ key: "hole", hidden: true, animate: "deal" });
  } else if (anim.holeRevealed && dealerCards[1]) {
    dealerSlots.push({ key: "d1", card: dealerCards[1], animate: "flip" });
  } else if (!entry?.dealerHidden && dealerCards[1] && anim.dealerUpCount >= 2) {
    dealerSlots.push({ key: "d1", card: dealerCards[1], animate: "none" });
  }

  for (let i = 0; i < anim.dealerDrawCount; i++) {
    const card = dealerCards[i + 2];
    if (card) {
      dealerSlots.push({ key: `d${i + 2}`, card, animate: "deal" });
    }
  }

  let dealerTotal = 0;
  if (entry && !entry.dealerHidden && dealerCards.length > 0) {
    dealerTotal = handTotal(dealerCards);
  } else if (anim.dealerUpCount >= 1 && dealerCards[0]) {
    dealerTotal = handTotal([dealerCards[0]!]);
  }

  const playerTotal =
    anim.playerCount > 0 && entry ? handTotal(playerVisible) : 0;

  return (
    <div className="bj-table-wrap">
      <div className="bj-table-rail">
        <div className="bj-table-felt">
          <div className="bj-table-brand">
            <span className="bj-table-logo">OBJECTSBYHYPE</span>
            <span className="bj-table-rule">BLACKJACK PAYS 3 TO 2 · INSURANCE PAYS 2 TO 1</span>
            <span className="bj-table-prize">{prizeTitle}</span>
          </div>

          <div className="bj-shoe" aria-hidden>
            <div
              className={`bj-shoe-stack ${anim.isDealing ? "bj-shoe-active" : ""}`}
            />
          </div>

          <div className="bj-hand-zone bj-dealer-zone">
            <div className="bj-hand-label">
              <span>Dealer</span>
              <HandBadge value={dealerTotal} />
            </div>
            <div className="bj-card-row">
              {!entry ? (
                <span className="bj-placeholder">Take a seat to begin</span>
              ) : dealerSlots.length > 0 ? (
                dealerSlots.map((slot, i) => (
                  <PlayingCard
                    key={slot.key}
                    card={slot.card}
                    hidden={slot.hidden}
                    animate={slot.animate}
                    style={{
                      zIndex: i + 1,
                      marginLeft: i > 0 ? -14 : 0,
                    }}
                  />
                ))
              ) : anim.isDealing ? (
                <span className="bj-dealing-text">Dealing…</span>
              ) : null}
            </div>
          </div>

          <div className="bj-table-divider" />

          <div className="bj-hand-zone bj-player-zone">
            <div className="bj-bet-circle" aria-hidden />
            <div className="bj-hand-label">
              <span>Your hand</span>
              <HandBadge value={playerTotal} />
            </div>
            <div className="bj-card-row">
              {!entry ? (
                <span className="bj-placeholder">One hand per round</span>
              ) : playerVisible.length > 0 ? (
                playerVisible.map((c, i) => (
                  <PlayingCard
                    key={`p${i}-${c.rank}-${c.suit}`}
                    card={c}
                    animate={i === playerVisible.length - 1 ? "deal" : "none"}
                    style={{
                      zIndex: i + 1,
                      marginLeft: i > 0 ? -14 : 0,
                    }}
                  />
                ))
              ) : anim.isDealing ? (
                <span className="bj-dealing-text">Dealing…</span>
              ) : null}
            </div>
          </div>

          {outcomeLabel && (
            <div
              className={`bj-outcome-banner ${
                outcomeLabel === "Blackjack!" || outcomeLabel === "You win"
                  ? "bj-outcome-win"
                  : outcomeLabel === "Push"
                    ? "bj-outcome-push"
                    : "bj-outcome-lose"
              }`}
            >
              {outcomeLabel}
              {placement != null && (
                <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                  Rank #{placement} this round
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
