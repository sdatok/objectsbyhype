"use client";

import type { BJCard } from "@/lib/blackjack-engine";
import { cardLabel } from "@/lib/blackjack-engine";
import type {
  PublicBlackjackMySeat,
  PublicBlackjackSeatPlayer,
} from "@/lib/blackjack-types";
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
  animate = "none",
  size = "full",
  style,
}: {
  card?: BJCard;
  hidden?: boolean;
  animate?: "deal" | "flip" | "none";
  size?: "full" | "mini" | "micro";
  style?: React.CSSProperties;
}) {
  const animClass =
    animate === "deal"
      ? "bj-deal-card"
      : animate === "flip"
        ? "bj-flip-card"
        : "";

  const sizeClass =
    size === "micro"
      ? "bj-card-micro"
      : size === "mini"
        ? "bj-card-mini"
        : "bj-card";

  if (hidden || !card) {
    return (
      <div className={`${sizeClass} bj-card-back ${animClass}`} style={style}>
        {size === "full" && <div className="bj-card-back-pattern" />}
        <span className="text-amber-500/50 text-[8px] font-serif tracking-widest">
          OBH
        </span>
      </div>
    );
  }

  const color = SUIT_COLORS[card.suit] ?? "text-neutral-900";
  const symbol = SUIT_SYMBOLS[card.suit] ?? "?";
  const rank = cardLabel(card).slice(0, -1);

  if (size !== "full") {
    return (
      <div className={`${sizeClass} bj-card-face ${animClass}`} style={style}>
        <span
          className={`font-bold leading-none ${color} ${
            size === "micro" ? "text-[7px]" : "text-[8px]"
          }`}
        >
          {rank}
          {symbol}
        </span>
      </div>
    );
  }

  return (
    <div className={`${sizeClass} bj-card-face ${animClass}`} style={style}>
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

function SeatSlot({
  seatIndex,
  player,
  viewerSeat,
  anim,
  outcomeLabel,
}: {
  seatIndex: number;
  player: PublicBlackjackSeatPlayer | null;
  viewerSeat: PublicBlackjackMySeat | null;
  anim: DealAnimationState;
  outcomeLabel?: string | null;
}) {
  const isViewer = player?.isViewer ?? false;
  const occupied = player != null;

  let cards: BJCard[] = [];
  if (occupied && isViewer && viewerSeat) {
    cards = viewerSeat.playerCards.slice(0, anim.playerCount);
  } else if (occupied) {
    cards = player.playerCards;
  }

  const total =
    cards.length > 0
      ? isViewer && viewerSeat
        ? handTotal(cards)
        : player!.handValue
      : 0;

  return (
    <div
      className={`bj-seat bj-seat-${seatIndex} ${occupied ? "bj-seat-occupied" : ""} ${isViewer ? "bj-seat-viewer" : ""}`}
    >
      <div className="bj-seat-chip" aria-hidden />
      {occupied ? (
        <>
          <p className="bj-seat-name">
            {player.displayName}
            {isViewer && <span className="bj-seat-you"> · you</span>}
          </p>
          <p className="bj-seat-stack">{player.stackCredits} IM</p>
          {player.currentBet > 0 &&
            (player.handPhase === "PLAYING" || player.handPhase === "SETTLED") && (
              <p className="bj-seat-bet">bet {player.currentBet}</p>
            )}
          <div className="bj-seat-cards">
            {cards.length === 0 && player.handPhase === "IDLE" ? (
              <span className="bj-seat-waiting">waiting</span>
            ) : (
              cards.map((c, i) => (
                <PlayingCard
                  key={`${seatIndex}-${i}-${c.rank}-${c.suit}`}
                  card={c}
                  size="micro"
                  animate={
                    isViewer && i === cards.length - 1 && anim.isDealing
                      ? "deal"
                      : "none"
                  }
                  style={{
                    marginLeft: i > 0 ? -4 : 0,
                    zIndex: i + 1,
                  }}
                />
              ))
            )}
          </div>
          <div className="bj-seat-meta">
            <HandBadge value={total} />
            {player.finished && player.handPhase === "SETTLED" && (
              <span className="bj-seat-outcome">done</span>
            )}
          </div>
          {isViewer && outcomeLabel && (
            <p className="bj-seat-result">{outcomeLabel}</p>
          )}
        </>
      ) : (
        <p className="bj-seat-empty">Seat {seatIndex + 1}</p>
      )}
    </div>
  );
}

interface BlackjackTableProps {
  mySeat: PublicBlackjackMySeat | null;
  seats: Array<PublicBlackjackSeatPlayer | null>;
  tableSeats: number;
  outcomeLabel?: string | null;
  anim: DealAnimationState;
}

export default function BlackjackTable({
  mySeat,
  seats,
  tableSeats,
  outcomeLabel,
  anim,
}: BlackjackTableProps) {
  const dealerCards = mySeat?.dealerCards ?? [];

  const dealerSlots: Array<{
    key: string;
    card?: BJCard;
    hidden?: boolean;
    animate?: "deal" | "flip" | "none";
  }> = [];

  if (anim.dealerUpCount >= 1 && dealerCards[0]) {
    dealerSlots.push({ key: "d0", card: dealerCards[0], animate: "deal" });
  }
  if (mySeat?.dealerHidden && anim.showHoleBack && !anim.holeRevealed) {
    dealerSlots.push({ key: "hole", hidden: true, animate: "deal" });
  } else if (anim.holeRevealed && dealerCards[1]) {
    dealerSlots.push({ key: "d1", card: dealerCards[1], animate: "flip" });
  } else if (!mySeat?.dealerHidden && dealerCards[1] && anim.dealerUpCount >= 2) {
    dealerSlots.push({ key: "d1", card: dealerCards[1], animate: "none" });
  } else if (!mySeat?.dealerHidden && dealerCards[1]) {
    dealerSlots.push({ key: "d1", card: dealerCards[1], animate: "none" });
  }
  for (let i = 0; i < anim.dealerDrawCount; i++) {
    const card = dealerCards[i + 2];
    if (card) dealerSlots.push({ key: `d${i + 2}`, card, animate: "deal" });
  }

  let dealerTotal = 0;
  if (mySeat && !mySeat.dealerHidden && dealerCards.length > 0) {
    dealerTotal = handTotal(dealerCards);
  } else if (anim.dealerUpCount >= 1 && dealerCards[0]) {
    dealerTotal = handTotal([dealerCards[0]!]);
  }

  const anyoneSeated = seats.some(Boolean);
  const seatList =
    seats.length === tableSeats
      ? seats
      : Array.from({ length: tableSeats }, (_, i) => seats[i] ?? null);

  return (
    <div className="bj-table-wrap">
      <div className="bj-table-rail">
        <div className="bj-table-felt bj-table-felt-multi">
          <div className="bj-table-brand">
            <span className="bj-table-logo">OBJECTSBYHYPE</span>
            <span className="bj-table-rule">
              BLACKJACK PAYS 3 TO 2 · {tableSeats} SEATS · INTERNET MONIES
            </span>
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
              {!anyoneSeated ? (
                <span className="bj-placeholder">Take a seat to begin</span>
              ) : mySeat && dealerSlots.length > 0 ? (
                dealerSlots.map((slot, i) => (
                  <PlayingCard
                    key={slot.key}
                    card={slot.card}
                    hidden={slot.hidden}
                    animate={slot.animate}
                    size="mini"
                    style={{ zIndex: i + 1, marginLeft: i > 0 ? -10 : 0 }}
                  />
                ))
              ) : mySeat && anim.isDealing ? (
                <span className="bj-dealing-text">Dealing…</span>
              ) : (
                <span className="bj-placeholder">
                  Deal a hand to play vs the dealer
                </span>
              )}
            </div>
          </div>

          <div className="bj-seats-ring">
            {seatList.map((player, seatIndex) => (
              <SeatSlot
                key={seatIndex}
                seatIndex={seatIndex}
                player={player}
                viewerSeat={mySeat}
                anim={anim}
                outcomeLabel={player?.isViewer ? outcomeLabel : undefined}
              />
            ))}
          </div>

          {outcomeLabel && mySeat && (
            <div
              className={`bj-outcome-banner ${
                outcomeLabel.includes("win") || outcomeLabel.includes("Blackjack")
                  ? "bj-outcome-win"
                  : outcomeLabel === "Push"
                    ? "bj-outcome-push"
                    : "bj-outcome-lose"
              }`}
            >
              {outcomeLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
