import { prisma } from "@/lib/db";
import type {
  SurvivorConfig,
  SurvivorMatch,
  SurvivorMatchStatus,
} from "@prisma/client";

const SINGLETON_ID = "default";

/** Shared admin timing bounds (also mirrored in game-server/src/constants.ts). */
export const SURVIVOR_MIN_LOBBY_SECONDS = 1;
export const SURVIVOR_MAX_LOBBY_SECONDS = 600;
export const SURVIVOR_MIN_MATCH_SECONDS = 10;
export const SURVIVOR_MAX_MATCH_SECONDS = 3600;

export function clampLobbySeconds(raw: unknown, fallback = 60): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(
    SURVIVOR_MIN_LOBBY_SECONDS,
    Math.min(SURVIVOR_MAX_LOBBY_SECONDS, n)
  );
}

export function clampMatchSeconds(raw: unknown, fallback = 420): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(
    SURVIVOR_MIN_MATCH_SECONDS,
    Math.min(SURVIVOR_MAX_MATCH_SECONDS, n)
  );
}

/** Public, leak-safe shape returned by /api/survivor/state. */
export interface PublicSurvivorState {
  enabled: boolean;
  prizeTitle: string;
  prizeDescription: string | null;
  matchSeconds: number;
  gameServerWsUrl: string;
  currentMatch: PublicMatchSummary | null;
  lastWinner: { displayName: string; placement: number } | null;
}

export interface PublicMatchSummary {
  id: string;
  status: SurvivorMatchStatus;
  prizeTitle: string;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
}

export async function getOrCreateSurvivorConfig(): Promise<SurvivorConfig> {
  const existing = await prisma.survivorConfig.findUnique({
    where: { id: SINGLETON_ID },
  });
  if (existing) return existing;
  return prisma.survivorConfig.create({ data: { id: SINGLETON_ID } });
}

/** The match the lobby should be talking about, or null if none active. */
export async function getCurrentMatch(
  config: SurvivorConfig
): Promise<SurvivorMatch | null> {
  if (!config.currentMatchId) return null;
  return prisma.survivorMatch.findUnique({
    where: { id: config.currentMatchId },
  });
}

export async function buildPublicSurvivorState(): Promise<PublicSurvivorState> {
  const config = await getOrCreateSurvivorConfig();
  const current = await getCurrentMatch(config);

  const lastEnded = await prisma.survivorMatch.findFirst({
    where: { status: "ENDED" },
    orderBy: { endedAt: "desc" },
  });
  let lastWinner: PublicSurvivorState["lastWinner"] = null;
  if (lastEnded) {
    const winner = await prisma.survivorParticipant.findFirst({
      where: { matchId: lastEnded.id, placement: 1 },
    });
    if (winner) {
      lastWinner = { displayName: winner.displayName, placement: 1 };
    }
  }

  let currentMatch: PublicMatchSummary | null = null;
  if (current) {
    const participantCount = await prisma.survivorParticipant.count({
      where: { matchId: current.id },
    });
    currentMatch = {
      id: current.id,
      status: current.status,
      prizeTitle: current.prizeTitle,
      startedAt: current.startedAt?.toISOString() ?? null,
      endedAt: current.endedAt?.toISOString() ?? null,
      participantCount,
    };
  }

  return {
    enabled: config.enabled,
    prizeTitle: config.prizeTitle,
    prizeDescription: config.prizeDescription,
    matchSeconds: config.matchSeconds,
    gameServerWsUrl: process.env.NEXT_PUBLIC_SURVIVOR_WS_URL ?? "",
    currentMatch,
    lastWinner,
  };
}

export { SINGLETON_ID as SURVIVOR_CONFIG_ID };
