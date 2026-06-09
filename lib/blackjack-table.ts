import type { BlackjackHandPhase, BlackjackSeat } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  checkStackMilestones,
  grantDailyStack,
  IM_MAX_BET,
  IM_MIN_BET,
  canReceiveDailyGrant,
  nextUtcMidnightMs,
} from "@/lib/blackjack-economy";
import { assignBlackjackSeatIndex } from "@/lib/blackjack-seats";
import {
  dealHand,
  doubleHand,
  handJsonToDb,
  hitHand,
  parseHandJson,
  publicHandValue,
  settleHandPayout,
  splitHand,
  standHand,
  visiblePlayerCards,
  type TableHandJson,
} from "@/lib/blackjack-hand";
import { cardsToJson, parseCards } from "@/lib/blackjack-engine";

export async function sitAtTable(input: {
  email: string;
  displayName: string;
}): Promise<BlackjackSeat> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.slice(0, 32);

  const existing = await prisma.blackjackSeat.findUnique({ where: { email } });
  if (existing) return existing;

  const seatIndex = await assignBlackjackSeatIndex();
  if (seatIndex == null) {
    throw new Error("Table is full — all 10 seats taken.");
  }

  await prisma.blackjackWallet.upsert({
    where: { email },
    create: { email, displayName },
    update: { displayName },
  });

  const grant = await grantDailyStack(email);
  if (grant === 0) {
    throw new Error(
      "You're out of internet monies until tomorrow (UTC midnight). Come back for your daily 50 IM."
    );
  }

  return prisma.blackjackSeat.create({
    data: {
      email,
      displayName,
      seatIndex,
      stackCredits: grant,
    },
  });
}

export async function leaveTable(email: string): Promise<void> {
  const seat = await prisma.blackjackSeat.findUnique({ where: { email } });
  if (!seat) return;
  if (seat.handPhase === "PLAYING") {
    throw new Error("Finish your hand before leaving the table.");
  }
  await prisma.blackjackSeat.delete({ where: { email } });
}

export async function setBetAmount(email: string, bet: number): Promise<BlackjackSeat> {
  const seat = await requireSeat(email);
  if (seat.handPhase !== "IDLE" && seat.handPhase !== "SETTLED") {
    throw new Error("Finish your current hand first.");
  }
  if (bet < IM_MIN_BET || bet > IM_MAX_BET) {
    throw new Error(`Bet must be between ${IM_MIN_BET} and ${IM_MAX_BET} IM.`);
  }
  if (bet > seat.stackCredits) {
    throw new Error("Not enough internet monies for that bet.");
  }
  return prisma.blackjackSeat.update({
    where: { email },
    data: {
      currentBet: bet,
      handPhase: "IDLE",
      handJson: Prisma.DbNull,
    },
  });
}

export async function startDeal(email: string, bet?: number): Promise<BlackjackSeat> {
  let seat = await requireSeat(email);
  if (seat.handPhase === "PLAYING") {
    throw new Error("Hand already in progress.");
  }

  if (seat.stackCredits <= 0) {
    if (await canReceiveDailyGrant(email)) {
      const grant = await grantDailyStack(email);
      if (grant > 0) {
        seat = await prisma.blackjackSeat.update({
          where: { email },
          data: { stackCredits: { increment: grant } },
        });
      }
    } else {
      throw new Error(
        "You're out of internet monies until tomorrow (UTC midnight)."
      );
    }
  }

  const amount = bet ?? seat.currentBet;
  if (amount < IM_MIN_BET) {
    throw new Error(`Set a bet of at least ${IM_MIN_BET} IM.`);
  }

  const { hand, stackAfterAnte } = dealHand(amount, seat.stackCredits);

  let updated = await prisma.blackjackSeat.update({
    where: { email },
    data: {
      stackCredits: stackAfterAnte,
      currentBet: amount,
      handPhase: hand.finished ? "SETTLED" : "PLAYING",
      handJson: handJsonToDb(hand),
      playedThisRound: true,
      missedRounds: 0,
      lastActiveAt: new Date(),
      pendingGwCode: null,
      pendingWohCode: null,
    },
  });

  if (hand.finished) {
    updated = await applyHandSettlement(updated, hand);
  }

  return updated;
}

export async function performHandAction(
  email: string,
  action: "hit" | "stand" | "double" | "split"
): Promise<BlackjackSeat> {
  let seat = await requireSeat(email);
  if (seat.handPhase !== "PLAYING") {
    throw new Error("No active hand.");
  }

  const hand = parseHandJson(seat.handJson);
  if (!hand || hand.finished) throw new Error("No active hand.");

  let nextHand: TableHandJson;
  let stackCredits = seat.stackCredits;

  switch (action) {
    case "hit":
      nextHand = hitHand({ ...hand });
      break;
    case "stand":
      nextHand = standHand({ ...hand });
      break;
    case "double": {
      const r = doubleHand({ ...hand }, stackCredits);
      nextHand = r.hand;
      stackCredits -= r.extraBet;
      break;
    }
    case "split": {
      const r = splitHand({ ...hand }, stackCredits);
      nextHand = r.hand;
      stackCredits -= r.extraBet;
      break;
    }
    default:
      throw new Error("Invalid action.");
  }

  let updated = await prisma.blackjackSeat.update({
    where: { email },
    data: {
      stackCredits,
      handJson: handJsonToDb(nextHand),
      handPhase: nextHand.finished ? "SETTLED" : "PLAYING",
      lastActiveAt: new Date(),
    },
  });

  if (nextHand.finished) {
    updated = await applyHandSettlement(updated, nextHand);
  }

  return updated;
}

async function applyHandSettlement(
  seat: BlackjackSeat,
  hand: TableHandJson
): Promise<BlackjackSeat> {
  const { payout, netChange } = settleHandPayout(hand);
  const newStack = seat.stackCredits + payout;

  const milestones = await checkStackMilestones({
    email: seat.email,
    displayName: seat.displayName,
    stackCredits: newStack,
  });

  return prisma.blackjackSeat.update({
    where: { email: seat.email },
    data: {
      stackCredits: newStack,
      handPhase: "SETTLED",
      handJson: handJsonToDb(hand),
      pendingGwCode: milestones.giveawayCode ?? seat.pendingGwCode,
      pendingWohCode: milestones.wohCode ?? seat.pendingWohCode,
    },
  });
}

export async function autoSettleSeat(seat: BlackjackSeat): Promise<void> {
  if (seat.handPhase !== "PLAYING") return;
  const hand = parseHandJson(seat.handJson);
  if (!hand) return;

  let working = { ...hand };
  while (!working.finished) {
    working = standHand(working);
  }

  await applyHandSettlement(
    await prisma.blackjackSeat.update({
      where: { email: seat.email },
      data: { handJson: handJsonToDb(working) },
    }),
    working
  );
}

export async function tickRoundInactivity(inactiveKick: number): Promise<void> {
  const seats = await prisma.blackjackSeat.findMany();

  for (const seat of seats) {
    if (seat.handPhase === "PLAYING") {
      await autoSettleSeat(seat);
    }
  }

  const refreshed = await prisma.blackjackSeat.findMany();
  for (const seat of refreshed) {
    if (!seat.playedThisRound) {
      const missed = seat.missedRounds + 1;
      if (missed >= inactiveKick) {
        await prisma.blackjackSeat.delete({ where: { email: seat.email } });
      } else {
        await prisma.blackjackSeat.update({
          where: { email: seat.email },
          data: { missedRounds: missed, playedThisRound: false },
        });
      }
    } else {
      await prisma.blackjackSeat.update({
        where: { email: seat.email },
        data: { missedRounds: 0, playedThisRound: false },
      });
    }
  }
}

async function requireSeat(email: string): Promise<BlackjackSeat> {
  const seat = await prisma.blackjackSeat.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!seat) throw new Error("You're not seated — take a seat first.");
  return seat;
}

export function dealerCardsForPublic(hand: TableHandJson | null, phase: BlackjackHandPhase) {
  if (!hand) return { cards: [] as ReturnType<typeof parseCards>, hidden: true };
  const finished = hand.finished || phase === "SETTLED";
  if (finished || !hand.dealerHidden) {
    return { cards: hand.dealerCards, hidden: false };
  }
  return {
    cards: hand.dealerCards.length > 0 ? [hand.dealerCards[0]!] : [],
    hidden: hand.dealerCards.length > 1,
  };
}

export function lastResultFromHand(hand: TableHandJson | null) {
  if (!hand?.finished) return null;
  const { outcomes, netChange, payout } = settleHandPayout(hand);
  return { outcomes, netChange, payout };
}

export async function playEligibility(email: string) {
  const seat = await prisma.blackjackSeat.findUnique({ where: { email } });
  const canGrant = await canReceiveDailyGrant(email);
  const stack = seat?.stackCredits ?? 0;
  const canPlay = stack > 0 || canGrant;
  return {
    canPlayToday: canPlay,
    nextGrantAt: canPlay ? null : new Date(nextUtcMidnightMs()).toISOString(),
  };
}

export function playerCardsFromSeat(seat: BlackjackSeat) {
  const hand = parseHandJson(seat.handJson);
  return visiblePlayerCards(hand);
}

export function handValueFromSeat(seat: BlackjackSeat) {
  const hand = parseHandJson(seat.handJson);
  return publicHandValue(hand);
}

export { parseHandJson, cardsToJson };
