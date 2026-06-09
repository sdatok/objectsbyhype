import type { Prisma } from "@prisma/client";
import type { BlackjackOutcome } from "@prisma/client";
import {
  cardsToJson,
  handValue,
  isBlackjack,
  isBust,
  parseCards,
  startSession,
  type BJCard,
} from "@/lib/blackjack-engine";
import { IM_MAX_BET, IM_MIN_BET } from "@/lib/blackjack-economy";

export interface PlayerHandState {
  cards: BJCard[];
  bet: number;
  doubled: boolean;
  stood: boolean;
  bust: boolean;
  blackjack: boolean;
}

export interface TableHandJson {
  hands: PlayerHandState[];
  activeHandIndex: number;
  dealerCards: BJCard[];
  deckRemaining: BJCard[];
  dealerHidden: boolean;
  finished: boolean;
}

export function emptyHandJson(): TableHandJson {
  return {
    hands: [],
    activeHandIndex: 0,
    dealerCards: [],
    deckRemaining: [],
    dealerHidden: true,
    finished: false,
  };
}

export function parseHandJson(raw: unknown): TableHandJson | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as TableHandJson;
  if (!Array.isArray(o.hands)) return null;
  return {
    hands: o.hands.map((h) => ({
      cards: parseCards(h.cards),
      bet: h.bet ?? 0,
      doubled: Boolean(h.doubled),
      stood: Boolean(h.stood),
      bust: Boolean(h.bust),
      blackjack: Boolean(h.blackjack),
    })),
    activeHandIndex: o.activeHandIndex ?? 0,
    dealerCards: parseCards(o.dealerCards),
    deckRemaining: parseCards(o.deckRemaining),
    dealerHidden: o.dealerHidden ?? true,
    finished: Boolean(o.finished),
  };
}

export function handJsonToDb(h: TableHandJson): Prisma.InputJsonValue {
  return {
    hands: h.hands.map((hand) => ({
      cards: cardsToJson(hand.cards),
      bet: hand.bet,
      doubled: hand.doubled,
      stood: hand.stood,
      bust: hand.bust,
      blackjack: hand.blackjack,
    })),
    activeHandIndex: h.activeHandIndex,
    dealerCards: cardsToJson(h.dealerCards),
    deckRemaining: cardsToJson(h.deckRemaining),
    dealerHidden: h.dealerHidden,
    finished: h.finished,
  };
}

function drawFrom(deck: BJCard[]): { card: BJCard; deck: BJCard[] } {
  const next = [...deck];
  const card = next.pop();
  if (!card) {
    const session = startSession();
    return { card: session.state.playerCards[0]!, deck: session.deckRemaining };
  }
  return { card, deck: next };
}

export function dealHand(bet: number, stackCredits: number): {
  hand: TableHandJson;
  stackAfterAnte: number;
} {
  if (bet < IM_MIN_BET || bet > IM_MAX_BET) {
    throw new Error(`Bet must be between ${IM_MIN_BET} and ${IM_MAX_BET} IM.`);
  }
  if (bet > stackCredits) throw new Error("Not enough internet monies.");

  const session = startSession();
  const playerCards = session.state.playerCards;
  const dealerCards = session.state.dealerCards;
  const deck = session.deckRemaining;

  const pBJ = isBlackjack(playerCards);
  const dBJ = isBlackjack(dealerCards);

  const hand: TableHandJson = {
    hands: [
      {
        cards: playerCards,
        bet,
        doubled: false,
        stood: pBJ || dBJ,
        bust: false,
        blackjack: pBJ,
      },
    ],
    activeHandIndex: 0,
    dealerCards,
    deckRemaining: deck,
    dealerHidden: !pBJ && !dBJ,
    finished: pBJ || dBJ,
  };

  if (hand.finished) {
    hand.dealerHidden = false;
  }

  return { hand, stackAfterAnte: stackCredits - bet };
}

function activeHand(h: TableHandJson): PlayerHandState {
  return h.hands[h.activeHandIndex]!;
}

function allHandsDone(h: TableHandJson): boolean {
  return h.hands.every((hand) => hand.stood || hand.bust);
}

function advanceHand(h: TableHandJson): boolean {
  if (h.activeHandIndex >= h.hands.length - 1) return false;
  h.activeHandIndex++;
  return true;
}

function dealerPlay(h: TableHandJson) {
  h.dealerHidden = false;
  while (handValue(h.dealerCards) < 17) {
    const drawn = drawFrom(h.deckRemaining);
    h.dealerCards = [...h.dealerCards, drawn.card];
    h.deckRemaining = drawn.deck;
  }
}

export function hitHand(h: TableHandJson): TableHandJson {
  if (h.finished) throw new Error("Hand is over.");
  const hand = activeHand(h);
  if (hand.stood || hand.bust) throw new Error("Cannot hit this hand.");

  const drawn = drawFrom(h.deckRemaining);
  hand.cards = [...hand.cards, drawn.card];
  h.deckRemaining = drawn.deck;

  if (isBust(hand.cards)) {
    hand.bust = true;
    hand.stood = true;
    if (!advanceHand(h) || allHandsDone(h)) {
      if (h.hands.some((x) => !x.bust)) dealerPlay(h);
      h.finished = true;
    }
  }
  return h;
}

export function standHand(h: TableHandJson): TableHandJson {
  if (h.finished) throw new Error("Hand is over.");
  const hand = activeHand(h);
  hand.stood = true;
  if (!advanceHand(h) && allHandsDone(h)) {
    dealerPlay(h);
    h.finished = true;
  }
  return h;
}

export function doubleHand(h: TableHandJson, stackCredits: number): {
  hand: TableHandJson;
  extraBet: number;
} {
  if (h.finished) throw new Error("Hand is over.");
  const hand = activeHand(h);
  if (hand.cards.length !== 2 || hand.doubled) {
    throw new Error("Can only double down on your first two cards.");
  }
  if (stackCredits < hand.bet) {
    throw new Error("Not enough IM to double.");
  }

  hand.doubled = true;
  const extraBet = hand.bet;
  hand.bet *= 2;

  const drawn = drawFrom(h.deckRemaining);
  hand.cards = [...hand.cards, drawn.card];
  h.deckRemaining = drawn.deck;
  hand.stood = true;

  if (isBust(hand.cards)) hand.bust = true;
  if (!advanceHand(h) && allHandsDone(h)) {
    if (h.hands.some((x) => !x.bust)) dealerPlay(h);
    h.finished = true;
  }

  return { hand: h, extraBet };
}

export function splitHand(h: TableHandJson, stackCredits: number): {
  hand: TableHandJson;
  extraBet: number;
} {
  if (h.finished) throw new Error("Hand is over.");
  if (h.hands.length > 1) throw new Error("Already split.");
  const hand = activeHand(h);
  if (hand.cards.length !== 2) throw new Error("Need two cards to split.");
  if (hand.cards[0]!.rank !== hand.cards[1]!.rank) {
    throw new Error("Can only split matching ranks.");
  }
  if (stackCredits < hand.bet) {
    throw new Error("Not enough IM for split bet.");
  }

  const bet = hand.bet;
  const c0 = hand.cards[0]!;
  const c1 = hand.cards[1]!;
  const d1 = drawFrom(h.deckRemaining);
  const d2 = drawFrom(d1.deck);

  h.hands = [
    {
      cards: [c0, d1.card],
      bet,
      doubled: false,
      stood: false,
      bust: isBust([c0, d1.card]),
      blackjack: isBlackjack([c0, d1.card]),
    },
    {
      cards: [c1, d2.card],
      bet,
      doubled: false,
      stood: false,
      bust: isBust([c1, d2.card]),
      blackjack: isBlackjack([c1, d2.card]),
    },
  ];
  h.deckRemaining = d2.deck;
  h.activeHandIndex = 0;

  if (h.hands[0]!.blackjack) h.hands[0]!.stood = true;
  if (h.hands[1]!.blackjack) h.hands[1]!.stood = true;
  if (allHandsDone(h)) {
    dealerPlay(h);
    h.finished = true;
  }

  return { hand: h, extraBet: bet };
}

export interface HandSettleResult {
  payout: number;
  outcomes: BlackjackOutcome[];
  netChange: number;
  totalBet: number;
}

export function settleHandPayout(h: TableHandJson): HandSettleResult {
  if (!h.finished) throw new Error("Hand not finished.");
  const dVal = handValue(h.dealerCards);
  const dBust = isBust(h.dealerCards);
  const dBJ = isBlackjack(h.dealerCards) && h.dealerCards.length === 2;

  let payout = 0;
  let totalBet = 0;
  const outcomes: BlackjackOutcome[] = [];

  for (const hand of h.hands) {
    totalBet += hand.bet;
    const pVal = handValue(hand.cards);

    if (hand.bust) {
      outcomes.push("BUST");
      continue;
    }
    if (hand.blackjack && !dBJ) {
      payout += Math.floor(hand.bet * 2.5);
      outcomes.push("BLACKJACK");
      continue;
    }
    if (dBust || pVal > dVal) {
      payout += hand.bet * 2;
      outcomes.push("WIN");
      continue;
    }
    if (pVal === dVal || (hand.blackjack && dBJ)) {
      payout += hand.bet;
      outcomes.push("PUSH");
      continue;
    }
    outcomes.push("LOSE");
  }

  return { payout, outcomes, netChange: payout - totalBet, totalBet };
}

export function visiblePlayerCards(h: TableHandJson | null): BJCard[] {
  if (!h || h.hands.length === 0) return [];
  return h.hands.flatMap((x) => x.cards);
}

export function publicHandValue(h: TableHandJson | null): number {
  const cards = visiblePlayerCards(h);
  return cards.length ? handValue(cards) : 0;
}
