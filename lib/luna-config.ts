import { prisma } from "@/lib/db";
import type { EscapeLunaConfig, EscapeLunaMatch, SurvivorMatchStatus } from "@prisma/client";

export const LUNA_CONFIG_ID = "default";

function parseLunaMaxPlayers(): number {
  const raw =
    process.env.NEXT_PUBLIC_LUNA_MAX_PLAYERS ??
    process.env.LUNA_MAX_PLAYERS ??
    "100";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 100;
  return Math.max(2, Math.min(100, n));
}

export const LUNA_MAX_PLAYERS = parseLunaMaxPlayers();
/** Token route cap: fighters plus spectator headroom before Colyseus rejects. */
export const LUNA_MAX_LOBBY_PARTICIPANTS =
  LUNA_MAX_PLAYERS + Math.max(25, Math.ceil(LUNA_MAX_PLAYERS * 0.5));

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
  maxPlayers: number;
  currentMatch: PublicLunaMatchSummary | null;
  lastWinner: { displayName: string; placement: number } | null;
}

export interface PublicLunaMatchSummary {
  id: string;
  status: SurvivorMatchStatus | "COUNTDOWN";
  prizeTitle: string;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
  countdownEndsAtMs: number | null;
}

async function fetchLiveLunaRoomSnapshot(): Promise<{
  matchId?: string;
  status?: string;
  countdownEndsAtMs?: number;
} | null> {
  const baseUrl = process.env.SURVIVOR_GAME_SERVER_URL;
  const secret = process.env.SURVIVOR_SECRET;
  if (!baseUrl || !secret) return null;
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/admin/state`, {
      headers: { "x-admin-secret": secret },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      luna?: {
        matchId?: string;
        status?: string;
        countdownEndsAtMs?: number;
      } | null;
    };
    return json.luna ?? null;
  } catch {
    return null;
  }
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
    const live = await fetchLiveLunaRoomSnapshot();
    const liveStatus =
      live?.matchId === current.id && live.status
        ? live.status === "COUNTDOWN"
          ? "COUNTDOWN"
          : live.status === "PLAYING"
            ? "PLAYING"
            : live.status === "ENDED"
              ? "ENDED"
              : current.status
        : current.status;
    currentMatch = {
      id: current.id,
      status: liveStatus,
      prizeTitle: current.prizeTitle,
      startedAt: current.startedAt?.toISOString() ?? null,
      endedAt: current.endedAt?.toISOString() ?? null,
      participantCount,
      countdownEndsAtMs:
        live?.matchId === current.id && live.countdownEndsAtMs
          ? live.countdownEndsAtMs
          : null,
    };
  }

  return {
    enabled: config.enabled,
    prizeTitle: config.prizeTitle,
    prizeDescription: config.prizeDescription,
    matchSeconds: config.matchSeconds,
    gameServerWsUrl: process.env.NEXT_PUBLIC_SURVIVOR_WS_URL ?? "",
    maxPlayers: LUNA_MAX_PLAYERS,
    currentMatch,
    lastWinner,
  };
}
