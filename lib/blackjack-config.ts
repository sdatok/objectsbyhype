import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createGiveawayPlayCode } from "@/lib/giveaway-wheel-codes";
import { maskEmail } from "@/lib/game-config";
import type {
  BlackjackConfig,
  BlackjackEntry,
  BlackjackRound,
} from "@prisma/client";
import {
  compareEntries,
  parseCards,
  sessionFromEntry,
  standSession,
  cardsToJson,
  type BJCard,
} from "@/lib/blackjack-engine";
import {
  BLACKJACK_CONFIG_ID,
  BLACKJACK_DEFAULT_ROUND_SECONDS,
  BLACKJACK_WHEEL_WINNERS,
  type PublicBlackjackEntry,
  type PublicBlackjackLeader,
  type PublicBlackjackState,
} from "@/lib/blackjack-types";

export {
  BLACKJACK_CONFIG_ID,
  BLACKJACK_DEFAULT_ROUND_SECONDS,
  BLACKJACK_WHEEL_WINNERS,
};
export type { PublicBlackjackEntry, PublicBlackjackLeader, PublicBlackjackState };

const MIN_ROUND_SECONDS = 60;
const MAX_ROUND_SECONDS = 3600;

export async function getOrCreateBlackjackConfig(): Promise<
  import("@prisma/client").BlackjackConfig
> {
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

function toPublicEntry(
  entry: BlackjackEntry,
  revealDealer: boolean
): PublicBlackjackEntry {
  const playerCards = parseCards(entry.playerCards);
  const dealerCards = parseCards(entry.dealerCards);
  const finished = entry.outcome != null;
  return {
    id: entry.id,
    displayName: entry.displayName,
    email: maskEmail(entry.email),
    playerCards,
    dealerCards:
      finished || revealDealer
        ? dealerCards
        : dealerCards.length > 0
          ? [dealerCards[0]!]
          : [],
    dealerHidden: !finished && !revealDealer && dealerCards.length > 1,
    outcome: entry.outcome,
    handValue: entry.handValue,
    placement: entry.placement,
    wheelCode: entry.wheelCode,
    finished,
  };
}

async function finishEntry(entry: BlackjackEntry): Promise<BlackjackEntry> {
  if (entry.outcome) return entry;
  const session = standSession(sessionFromEntry(entry));
  const resolved = session.state;
  return prisma.blackjackEntry.update({
    where: { id: entry.id },
    data: {
      playerCards: cardsToJson(resolved.playerCards),
      dealerCards: cardsToJson(resolved.dealerCards),
      deckRemaining: Prisma.DbNull,
      outcome: resolved.outcome,
      handValue: resolved.handValue,
      finishedAt: new Date(),
    },
  });
}

export async function settleBlackjackRound(roundId: string): Promise<void> {
  const round = await prisma.blackjackRound.findUnique({
    where: { id: roundId },
    include: { entries: true },
  });
  if (!round || round.status === "SETTLED") return;

  const unfinished = round.entries.filter((e) => e.outcome == null);
  for (const entry of unfinished) {
    await finishEntry(entry);
  }

  const entries = await prisma.blackjackEntry.findMany({
    where: { roundId },
  });

  const ranked = [...entries].sort(compareEntries);
  for (let i = 0; i < ranked.length; i++) {
    const placement = i + 1;
    await prisma.blackjackEntry.update({
      where: { id: ranked[i]!.id },
      data: { placement },
    });
  }

  await prisma.blackjackRound.update({
    where: { id: roundId },
    data: { status: "SETTLED", settledAt: new Date() },
  });

  const top = ranked.slice(0, BLACKJACK_WHEEL_WINNERS);
  for (const entry of top) {
    const current = await prisma.blackjackEntry.findUnique({
      where: { id: entry.id },
    });
    if (!current || current.wheelCode) continue;
    const code = await createGiveawayPlayCode({
      winnerName: current.displayName,
      winnerEmail: current.email,
      source: "Blackjack",
      notes: `round:${roundId} placement:${current.placement}`,
    });
    await prisma.blackjackEntry.update({
      where: { id: current.id },
      data: { wheelCode: code.code },
    });
  }
}

export async function ensureOpenRound(
  config: BlackjackConfig
): Promise<{ config: BlackjackConfig; round: BlackjackRound }> {
  let current = config.currentRoundId
    ? await prisma.blackjackRound.findUnique({
        where: { id: config.currentRoundId },
      })
    : null;

  if (current?.status === "OPEN" && Date.now() >= current.endsAt.getTime()) {
    await settleBlackjackRound(current.id);
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

export async function buildPublicBlackjackState(
  viewerEmail?: string | null
): Promise<PublicBlackjackState> {
  let config = await getOrCreateBlackjackConfig();
  const { config: syncedConfig, round: current } = await ensureOpenRound(config);
  config = syncedConfig;

  const entryCount = await prisma.blackjackEntry.count({
    where: { roundId: current.id },
  });

  let myEntry: PublicBlackjackEntry | null = null;
  let recentResult: PublicBlackjackEntry | null = null;
  if (viewerEmail) {
    const mine = await prisma.blackjackEntry.findUnique({
      where: {
        roundId_email: { roundId: current.id, email: viewerEmail },
      },
    });
    if (mine) myEntry = toPublicEntry(mine, false);

    const lastMine = await prisma.blackjackEntry.findFirst({
      where: {
        email: viewerEmail,
        round: { status: "SETTLED" },
      },
      orderBy: { finishedAt: "desc" },
    });
    if (lastMine && lastMine.roundId !== current.id) {
      recentResult = toPublicEntry(lastMine, true);
    }
  }

  const lastSettled = await prisma.blackjackRound.findFirst({
    where: { status: "SETTLED" },
    orderBy: { settledAt: "desc" },
  });

  let lastWinners: PublicBlackjackLeader[] = [];
  if (lastSettled) {
    const winners = await prisma.blackjackEntry.findMany({
      where: {
        roundId: lastSettled.id,
        placement: { lte: BLACKJACK_WHEEL_WINNERS },
        outcome: { not: null },
      },
      orderBy: { placement: "asc" },
    });
    lastWinners = winners.map((w) => ({
      placement: w.placement!,
      displayName: w.displayName,
      email: maskEmail(w.email),
      outcome: w.outcome!,
      handValue: w.handValue,
      wheelCode: w.wheelCode,
    }));
  }

  const secondsRemaining = Math.max(
    0,
    Math.floor((current.endsAt.getTime() - Date.now()) / 1000)
  );

  return {
    enabled: config.enabled,
    prizeTitle: config.prizeTitle,
    prizeDescription: config.prizeDescription,
    roundSeconds: config.roundSeconds,
    currentRound: {
      id: current.id,
      status: current.status,
      startedAt: current.startedAt.toISOString(),
      endsAt: current.endsAt.toISOString(),
      secondsRemaining,
      entryCount,
    },
    myEntry,
    lastWinners,
    recentResult,
  };
}
