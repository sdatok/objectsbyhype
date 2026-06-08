import { randomBytes } from "crypto";
import type { BlackjackOutcome, Prisma } from "@prisma/client";

/** rank 1=Ace … 13=King, suit 0=Spades … 3=Clubs */
export interface BJCard {
  rank: number;
  suit: number;
}

export interface BJHandState {
  playerCards: BJCard[];
  dealerCards: BJCard[];
  outcome: BlackjackOutcome | null;
  handValue: number;
}

export interface BJSession {
  state: BJHandState;
  deckRemaining: BJCard[];
}

const SUITS = ["S", "H", "D", "C"] as const;
const RANK_LABELS = [
  "",
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export function cardLabel(card: BJCard): string {
  return `${RANK_LABELS[card.rank] ?? "?"}${SUITS[card.suit] ?? "?"}`;
}

function buildShoe(decks = 6): BJCard[] {
  const shoe: BJCard[] = [];
  for (let d = 0; d < decks; d++) {
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) {
        shoe.push({ rank, suit });
      }
    }
  }
  return shoe;
}

function shuffleInPlace(cards: BJCard[]) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0]! % (i + 1);
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
}

function draw(deck: BJCard[]): { card: BJCard; deck: BJCard[] } {
  if (deck.length === 0) {
    const fresh = buildShoe();
    shuffleInPlace(fresh);
    const card = fresh.pop()!;
    return { card, deck: fresh };
  }
  const next = [...deck];
  const card = next.pop()!;
  return { card, deck: next };
}

export function handValue(cards: BJCard[]): number {
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

export function isBlackjack(cards: BJCard[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

export function isBust(cards: BJCard[]): boolean {
  return handValue(cards) > 21;
}

export function startSession(): BJSession {
  const shoe = buildShoe();
  shuffleInPlace(shoe);
  let deck = shoe;
  const p1 = draw(deck);
  deck = p1.deck;
  const p2 = draw(deck);
  deck = p2.deck;
  const d1 = draw(deck);
  deck = d1.deck;
  const d2 = draw(deck);
  deck = d2.deck;

  const playerCards = [p1.card, p2.card];
  const dealerCards = [d1.card, d2.card];

  if (isBlackjack(playerCards) || isBlackjack(dealerCards)) {
    return {
      state: resolveHand({ playerCards, dealerCards, deck }),
      deckRemaining: deck,
    };
  }

  return {
    state: {
      playerCards,
      dealerCards,
      outcome: null,
      handValue: handValue(playerCards),
    },
    deckRemaining: deck,
  };
}

export function hitSession(session: BJSession): BJSession {
  if (session.state.outcome) return session;
  const drawn = draw(session.deckRemaining);
  const playerCards = [...session.state.playerCards, drawn.card];
  if (isBust(playerCards)) {
    return {
      state: resolveHand({
        playerCards,
        dealerCards: session.state.dealerCards,
        deck: drawn.deck,
      }),
      deckRemaining: drawn.deck,
    };
  }
  return {
    state: {
      playerCards,
      dealerCards: session.state.dealerCards,
      outcome: null,
      handValue: handValue(playerCards),
    },
    deckRemaining: drawn.deck,
  };
}

export function standSession(session: BJSession): BJSession {
  if (session.state.outcome) return session;
  return {
    state: resolveHand({
      playerCards: session.state.playerCards,
      dealerCards: session.state.dealerCards,
      deck: session.deckRemaining,
    }),
    deckRemaining: session.deckRemaining,
  };
}

function dealerDraw(dealerCards: BJCard[], deck: BJCard[]): {
  dealerCards: BJCard[];
  deck: BJCard[];
} {
  let cards = [...dealerCards];
  let remaining = deck;
  while (handValue(cards) < 17) {
    const drawn = draw(remaining);
    cards = [...cards, drawn.card];
    remaining = drawn.deck;
  }
  return { dealerCards: cards, deck: remaining };
}

function resolveHand(input: {
  playerCards: BJCard[];
  dealerCards: BJCard[];
  deck: BJCard[];
}): BJHandState {
  const playerCards = input.playerCards;
  let dealerCards = input.dealerCards;
  let deck = input.deck;
  const playerBj = isBlackjack(playerCards);
  const dealerBj = isBlackjack(dealerCards);

  if (playerBj || dealerBj) {
    let outcome: BlackjackOutcome;
    if (playerBj && dealerBj) outcome = "PUSH";
    else if (playerBj) outcome = "BLACKJACK";
    else outcome = "LOSE";
    return {
      playerCards,
      dealerCards,
      outcome,
      handValue: handValue(playerCards),
    };
  }

  if (isBust(playerCards)) {
    return {
      playerCards,
      dealerCards,
      outcome: "BUST",
      handValue: handValue(playerCards),
    };
  }

  const dealerResult = dealerDraw(dealerCards, deck);
  dealerCards = dealerResult.dealerCards;
  const pVal = handValue(playerCards);
  const dVal = handValue(dealerCards);

  let outcome: BlackjackOutcome;
  if (isBust(dealerCards)) outcome = "WIN";
  else if (pVal > dVal) outcome = "WIN";
  else if (pVal < dVal) outcome = "LOSE";
  else outcome = "PUSH";

  return {
    playerCards,
    dealerCards,
    outcome,
    handValue: pVal,
  };
}

const OUTCOME_RANK: Record<BlackjackOutcome, number> = {
  BLACKJACK: 5,
  WIN: 4,
  PUSH: 3,
  LOSE: 2,
  BUST: 1,
};

export function compareEntries(
  a: {
    outcome: BlackjackOutcome | null;
    handValue: number;
    finishedAt: Date | null;
    joinedAt: Date;
  },
  b: {
    outcome: BlackjackOutcome | null;
    handValue: number;
    finishedAt: Date | null;
    joinedAt: Date;
  }
): number {
  const aRank = a.outcome ? OUTCOME_RANK[a.outcome] : 0;
  const bRank = b.outcome ? OUTCOME_RANK[b.outcome] : 0;
  if (aRank !== bRank) return bRank - aRank;
  if (a.handValue !== b.handValue) return b.handValue - a.handValue;
  const aTime = (a.finishedAt ?? a.joinedAt).getTime();
  const bTime = (b.finishedAt ?? b.joinedAt).getTime();
  return aTime - bTime;
}

export function parseCards(raw: unknown): BJCard[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is BJCard =>
      c &&
      typeof c === "object" &&
      typeof (c as BJCard).rank === "number" &&
      typeof (c as BJCard).suit === "number"
  );
}

export function sessionFromEntry(entry: {
  playerCards: unknown;
  dealerCards: unknown;
  deckRemaining: unknown;
  outcome: BlackjackOutcome | null;
  handValue: number;
}): BJSession {
  return {
    state: {
      playerCards: parseCards(entry.playerCards),
      dealerCards: parseCards(entry.dealerCards),
      outcome: entry.outcome,
      handValue: entry.handValue,
    },
    deckRemaining: parseCards(entry.deckRemaining),
  };
}

export function cardsToJson(cards: BJCard[]): Prisma.InputJsonValue {
  return cards.map((c) => ({ rank: c.rank, suit: c.suit }));
}
