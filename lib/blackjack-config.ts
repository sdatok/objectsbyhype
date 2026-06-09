import { prisma } from "@/lib/db";
import { maskEmail } from "@/lib/game-config";
import type { BlackjackConfig, BlackjackRound, BlackjackSeat } from "@prisma/client";
import {
  getLeaderboard,
  IM_DAILY_GRANT,
  IM_MAX_BET,
  IM_MILESTONE_GIVEAWAY,
  IM_MILESTONE_WOH,
  IM_MIN_BET,
  INACTIVE_ROUNDS_KICK,
  nextUtcMidnightMs,
  canReceiveDailyGrant,
} from "@/lib/blackjack-economy";
import { seatedCount } from "@/lib/blackjack-seats";
import {
  dealerCardsForPublic,
  handValueFromSeat,
  lastResultFromHand,
  parseHandJson,
  playerCardsFromSeat,
  tickRoundInactivity,
} from "@/lib/blackjack-table";
import {
  BLACKJACK_CONFIG_ID,
  BLACKJACK_DEFAULT_ROUND_SECONDS,
  BLACKJACK_TABLE_SEATS,
  type PublicBlackjackMySeat,
  type PublicBlackjackSeatPlayer,
  type PublicBlackjackState,
} from "@/lib/blackjack-types";

export {
  BLACKJACK_CONFIG_ID,
  BLACKJACK_DEFAULT_ROUND_SECONDS,
  BLACKJACK_TABLE_SEATS,
};

const MIN_ROUND_SECONDS = 60;
const MAX_ROUND_SECONDS = 3600;

export async function getOrCreateBlackjackConfig(): Promise<BlackjackConfig> {
  const existing = await prisma.blackjackConfig.findUnique({
    where: { id: BLACKJACK_CONFIG_ID },
  });
  if (existing) return existing;
  return prisma.blackjackConfig.create({ data: { id: BLACKJACK_CONFIG_ID } });
}

export function clampRoundSeconds(n: number): number {
  return Math.max(
    MIN_ROUND_SECONDS,
    Math.min(MAX_ROUND_SECONDS, Math.floor(n))
  );
}

async function finishRound(roundId: string, inactiveKick: number): Promise<void> {
  const round = await prisma.blackjackRound.findUnique({ where: { id: roundId } });
  if (!round || round.status === "SETTLED") return;

  await tickRoundInactivity(inactiveKick);

  await prisma.blackjackRound.update({
    where: { id: roundId },
    data: { status: "SETTLED", settledAt: new Date() },
  });
}

export async function ensureOpenRound(
  config: BlackjackConfig
): Promise<{ config: BlackjackConfig; round: BlackjackRound }> {
  let current = config.currentRoundId
    ? await prisma.blackjackRound.findUnique({
        where: { id: config.currentRoundId },
      })
    : null;

  const inactiveKick = config.inactiveRoundKick ?? INACTIVE_ROUNDS_KICK;

  if (current?.status === "OPEN" && Date.now() >= current.endsAt.getTime()) {
    await finishRound(current.id, inactiveKick);
    current = await prisma.blackjackRound.findUnique({
      where: { id: current.id },
    });
  }

  if (current?.status === "OPEN" && Date.now() < current.endsAt.getTime()) {
    return { config, round: current };
  }

  const round = await prisma.blackjackRound.create({
    data: {
      prizeTitle: config.prizeTitle,
      endsAt: new Date(Date.now() + config.roundSeconds * 1000),
    },
  });

  const updated = await prisma.blackjackConfig.update({
    where: { id: config.id },
    data: { currentRoundId: round.id },
  });

  return { config: updated, round };
}

function toPublicSeatPlayer(
  seat: BlackjackSeat,
  viewerEmail?: string | null
): PublicBlackjackSeatPlayer {
  const hand = parseHandJson(seat.handJson);
  const playerCards =
    seat.handPhase === "IDLE" ? [] : playerCardsFromSeat(seat);
  const finished =
    seat.handPhase === "SETTLED" || Boolean(hand?.finished);

  return {
    seatIndex: seat.seatIndex,
    displayName: seat.displayName,
    email: maskEmail(seat.email),
    stackCredits: seat.stackCredits,
    currentBet: seat.currentBet,
    handPhase: seat.handPhase,
    playerCards,
    handValue: playerCards.length ? handValueFromSeat(seat) : 0,
    finished,
    isViewer: viewerEmail ? seat.email === viewerEmail : false,
  };
}

async function toPublicMySeat(
  seat: BlackjackSeat,
  inactiveKick: number
): Promise<PublicBlackjackMySeat> {
  const wallet = await prisma.blackjackWallet.findUnique({
    where: { email: seat.email },
  });
  const hand = parseHandJson(seat.handJson);
  const dealer = dealerCardsForPublic(hand, seat.handPhase);
  const playerCards = playerCardsFromSeat(seat);
  const canGrant = await canReceiveDailyGrant(seat.email);
  const canPlay = seat.stackCredits > 0 || canGrant;

  return {
    seatIndex: seat.seatIndex,
    stackCredits: seat.stackCredits,
    savedCredits: wallet?.savedCredits ?? 0,
    currentBet: seat.currentBet,
    handPhase: seat.handPhase,
    playerCards,
    dealerCards: dealer.cards,
    dealerHidden: dealer.hidden,
    handValue: playerCards.length ? handValueFromSeat(seat) : 0,
    activeHandIndex: hand?.activeHandIndex ?? 0,
    handCount: hand?.hands.length ?? 0,
    finished: seat.handPhase === "SETTLED" || Boolean(hand?.finished),
    lastResult: lastResultFromHand(hand),
    pendingGwCode: seat.pendingGwCode,
    pendingWohCode: seat.pendingWohCode,
    canPlayToday: canPlay,
    nextGrantAt: canPlay
      ? null
      : new Date(nextUtcMidnightMs()).toISOString(),
    missedRounds: seat.missedRounds,
    inactiveKick,
  };
}

export async function buildPublicBlackjackState(
  viewerEmail?: string | null
): Promise<PublicBlackjackState> {
  let config = await getOrCreateBlackjackConfig();
  const { config: syncedConfig, round: current } = await ensureOpenRound(config);
  config = syncedConfig;

  const tableSeats = config.tableSeats ?? BLACKJACK_TABLE_SEATS;
  const inactiveKick = config.inactiveRoundKick ?? INACTIVE_ROUNDS_KICK;

  const allSeats = await prisma.blackjackSeat.findMany({
    orderBy: { seatIndex: "asc" },
  });

  const seats: Array<PublicBlackjackSeatPlayer | null> = Array.from(
    { length: tableSeats },
    () => null
  );
  for (const row of allSeats) {
    if (row.seatIndex >= 0 && row.seatIndex < tableSeats) {
      seats[row.seatIndex] = toPublicSeatPlayer(row, viewerEmail);
    }
  }

  let mySeat: PublicBlackjackMySeat | null = null;
  if (viewerEmail) {
    const mine = allSeats.find((s) => s.email === viewerEmail) ?? null;
    if (mine) mySeat = await toPublicMySeat(mine, inactiveKick);
  }

  const leaderboard = await getLeaderboard(10);
  const count = await seatedCount();

  const secondsRemaining = Math.max(
    0,
    Math.floor((current.endsAt.getTime() - Date.now()) / 1000)
  );

  return {
    enabled: config.enabled,
    prizeTitle: config.prizeTitle,
    prizeDescription: config.prizeDescription,
    roundSeconds: config.roundSeconds,
    tableSeats,
    imDailyGrant: IM_DAILY_GRANT,
    imMilestoneGiveaway: IM_MILESTONE_GIVEAWAY,
    imMilestoneWoh: IM_MILESTONE_WOH,
    imMinBet: IM_MIN_BET,
    imMaxBet: IM_MAX_BET,
    inactiveKick,
    currentRound: {
      id: current.id,
      status: current.status,
      startedAt: current.startedAt.toISOString(),
      endsAt: current.endsAt.toISOString(),
      secondsRemaining,
      seatedCount: count,
    },
    seats,
    mySeat,
    leaderboard,
  };
}

export async function forceFinishCurrentRound(): Promise<void> {
  const config = await getOrCreateBlackjackConfig();
  if (!config.currentRoundId) return;
  const current = await prisma.blackjackRound.findUnique({
    where: { id: config.currentRoundId },
  });
  if (current?.status === "OPEN") {
    await finishRound(
      current.id,
      config.inactiveRoundKick ?? INACTIVE_ROUNDS_KICK
    );
  }
}
