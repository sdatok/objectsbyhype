import { prisma } from "@/lib/db";
import type { GameConfig, GameScore } from "@prisma/client";

const SINGLETON_ID = "default";

/** Public shape — never leak admin-only fields. */
export interface PublicGameState {
  enabled: boolean;
  prizeTitle: string;
  prizeDescription: string | null;
  windowStartedAt: string;
  windowEndsAt: string;
  windowHours: number;
  gameSpeed: number;
  maxMisses: number;
  taskBaseSeconds: number;
  /** Top scores in the current window, ordered desc. */
  leaderboard: PublicScore[];
  /** The most recently closed window's winner, if any. */
  lastWinner: PublicScore | null;
}

export interface PublicScore {
  email: string;
  displayName: string | null;
  score: number;
  createdAt: string;
}

export async function getOrCreateGameConfig(): Promise<GameConfig> {
  const existing = await prisma.gameConfig.findUnique({
    where: { id: SINGLETON_ID },
  });
  if (existing) return existing;
  return prisma.gameConfig.create({ data: { id: SINGLETON_ID } });
}

/**
 * If the current window has expired, automatically roll a new window so the
 * countdown on the home page never shows a negative value. Returns the
 * possibly-updated config.
 */
export async function rollWindowIfExpired(
  config: GameConfig
): Promise<GameConfig> {
  const endsAt = computeWindowEndsAt(config);
  if (Date.now() < endsAt.getTime()) return config;
  return prisma.gameConfig.update({
    where: { id: config.id },
    data: { windowStartedAt: new Date() },
  });
}

export function computeWindowEndsAt(config: {
  windowStartedAt: Date;
  windowHours: number;
}): Date {
  return new Date(
    config.windowStartedAt.getTime() + config.windowHours * 60 * 60 * 1000
  );
}

/** Light-weight masking so we don't expose full emails on the leaderboard. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local}***@${domain}`;
  return `${local[0]}${local[1]}***@${domain}`;
}

function toPublicScore(s: GameScore): PublicScore {
  return {
    email: maskEmail(s.email),
    displayName: s.displayName,
    score: s.score,
    createdAt: s.createdAt.toISOString(),
  };
}

export async function buildPublicGameState(): Promise<PublicGameState> {
  const config = await rollWindowIfExpired(await getOrCreateGameConfig());

  const [scores, lastWinner] = await Promise.all([
    prisma.gameScore.findMany({
      where: { windowStartedAt: config.windowStartedAt },
      orderBy: [{ score: "desc" }, { secondsPlayed: "asc" }, { createdAt: "asc" }],
      take: 10,
    }),
    findLastWinner(config.windowStartedAt),
  ]);

  return {
    enabled: config.enabled,
    prizeTitle: config.prizeTitle,
    prizeDescription: config.prizeDescription,
    windowStartedAt: config.windowStartedAt.toISOString(),
    windowEndsAt: computeWindowEndsAt(config).toISOString(),
    windowHours: config.windowHours,
    gameSpeed: config.gameSpeed,
    maxMisses: config.maxMisses,
    taskBaseSeconds: config.taskBaseSeconds,
    leaderboard: scores.map(toPublicScore),
    lastWinner: lastWinner ? toPublicScore(lastWinner) : null,
  };
}

/**
 * Highest score from the most-recent *previous* window. Implemented by
 * grabbing the highest-scoring entry that pre-dates the current window's start.
 */
async function findLastWinner(
  currentWindowStartedAt: Date
): Promise<GameScore | null> {
  // First find the latest windowStartedAt value strictly before the current one.
  const previous = await prisma.gameScore.findFirst({
    where: { windowStartedAt: { lt: currentWindowStartedAt } },
    orderBy: { windowStartedAt: "desc" },
    select: { windowStartedAt: true },
  });
  if (!previous) return null;
  return prisma.gameScore.findFirst({
    where: { windowStartedAt: previous.windowStartedAt },
    orderBy: [{ score: "desc" }, { secondsPlayed: "asc" }, { createdAt: "asc" }],
  });
}

export { SINGLETON_ID as GAME_CONFIG_ID };
