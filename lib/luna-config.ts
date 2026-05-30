import { prisma } from "@/lib/db";
import type { EscapeLunaConfig, EscapeLunaMatch, SurvivorMatchStatus } from "@prisma/client";

export const LUNA_CONFIG_ID = "default";

export {
  clampLobbySeconds,
  clampMatchSeconds,
  SURVIVOR_MIN_LOBBY_SECONDS as LUNA_MIN_LOBBY_SECONDS,
  SURVIVOR_MAX_LOBBY_SECONDS as LUNA_MAX_LOBBY_SECONDS,
  SURVIVOR_MIN_MATCH_SECONDS as LUNA_MIN_MATCH_SECONDS,
  SURVIVOR_MAX_MATCH_SECONDS as LUNA_MAX_MATCH_SECONDS,
} from "@/lib/survivor-config";

export interface PublicLunaState {
  enabled: boolean;
  prizeTitle: string;
  prizeDescription: string | null;
  matchSeconds: number;
  gameServerWsUrl: string;
  currentMatch: PublicLunaMatchSummary | null;
  lastWinner: { displayName: string; placement: number } | null;
}

export interface PublicLunaMatchSummary {
  id: string;
  status: SurvivorMatchStatus;
  prizeTitle: string;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
}

export async function getOrCreateLunaConfig(): Promise<EscapeLunaConfig> {
  const existing = await prisma.escapeLunaConfig.findUnique({
    where: { id: LUNA_CONFIG_ID },
  });
  if (existing) return existing;
  return prisma.escapeLunaConfig.create({ data: { id: LUNA_CONFIG_ID } });
}

export async function getCurrentLunaMatch(
  config: EscapeLunaConfig
): Promise<EscapeLunaMatch | null> {
  if (!config.currentMatchId) return null;
  return prisma.escapeLunaMatch.findUnique({
    where: { id: config.currentMatchId },
  });
}

export async function buildPublicLunaState(): Promise<PublicLunaState> {
  const config = await getOrCreateLunaConfig();
  const current = await getCurrentLunaMatch(config);

  const lastEnded = await prisma.escapeLunaMatch.findFirst({
    where: { status: "ENDED" },
    orderBy: { endedAt: "desc" },
  });
  let lastWinner: PublicLunaState["lastWinner"] = null;
  if (lastEnded) {
    const winner = await prisma.escapeLunaParticipant.findFirst({
      where: { matchId: lastEnded.id, placement: 1 },
    });
    if (winner) {
      lastWinner = { displayName: winner.displayName, placement: 1 };
    }
  }

  let currentMatch: PublicLunaMatchSummary | null = null;
  if (current) {
    const participantCount = await prisma.escapeLunaParticipant.count({
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
