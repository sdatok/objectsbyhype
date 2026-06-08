import { prisma } from "@/lib/db";
import type { RedLightConfig, RedLightMatch, SurvivorMatchStatus } from "@prisma/client";

export const RED_LIGHT_CONFIG_ID = "default";
export const RLGL_DEFAULT_MATCH_SECONDS = 120;

function parseRedLightMaxPlayers(): number {
  const raw =
    process.env.NEXT_PUBLIC_RED_LIGHT_MAX_PLAYERS ??
    process.env.RED_LIGHT_MAX_PLAYERS ??
    "100";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 100;
  return Math.max(2, Math.min(100, n));
}

export const RED_LIGHT_MAX_PLAYERS = parseRedLightMaxPlayers();
export const RED_LIGHT_MAX_LOBBY_PARTICIPANTS =
  RED_LIGHT_MAX_PLAYERS + Math.max(25, Math.ceil(RED_LIGHT_MAX_PLAYERS * 0.5));

export {
  clampLobbySeconds,
  clampMatchSeconds,
  SURVIVOR_MIN_LOBBY_SECONDS as RED_LIGHT_MIN_LOBBY_SECONDS,
  SURVIVOR_MAX_LOBBY_SECONDS as RED_LIGHT_MAX_LOBBY_SECONDS,
  SURVIVOR_MIN_MATCH_SECONDS as RED_LIGHT_MIN_MATCH_SECONDS,
  SURVIVOR_MAX_MATCH_SECONDS as RED_LIGHT_MAX_MATCH_SECONDS,
} from "@/lib/survivor-config";

export interface PublicRedLightState {
  enabled: boolean;
  prizeTitle: string;
  prizeDescription: string | null;
  matchSeconds: number;
  gameServerWsUrl: string;
  maxPlayers: number;
  currentMatch: PublicRedLightMatchSummary | null;
  lastWinner: { displayName: string; placement: number } | null;
}

export interface PublicRedLightMatchSummary {
  id: string;
  status: SurvivorMatchStatus | "COUNTDOWN";
  prizeTitle: string;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
  countdownEndsAtMs: number | null;
}

async function fetchLiveRedLightRoomSnapshot(): Promise<{
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
      redLight?: {
        matchId?: string;
        status?: string;
        countdownEndsAtMs?: number;
      } | null;
    };
    return json.redLight ?? null;
  } catch {
    return null;
  }
}

export async function getOrCreateRedLightConfig(): Promise<RedLightConfig> {
  const existing = await prisma.redLightConfig.findUnique({
    where: { id: RED_LIGHT_CONFIG_ID },
  });
  if (existing) return existing;
  return prisma.redLightConfig.create({ data: { id: RED_LIGHT_CONFIG_ID } });
}

export async function getCurrentRedLightMatch(
  config: RedLightConfig
): Promise<RedLightMatch | null> {
  if (!config.currentMatchId) return null;
  return prisma.redLightMatch.findUnique({
    where: { id: config.currentMatchId },
  });
}

const OFFLINE_RED_LIGHT_STATE: PublicRedLightState = {
  enabled: false,
  prizeTitle: "Red Light Green Light Prize",
  prizeDescription: null,
  matchSeconds: RLGL_DEFAULT_MATCH_SECONDS,
  gameServerWsUrl: process.env.NEXT_PUBLIC_SURVIVOR_WS_URL ?? "",
  maxPlayers: RED_LIGHT_MAX_PLAYERS,
  currentMatch: null,
  lastWinner: null,
};

export async function buildPublicRedLightState(): Promise<PublicRedLightState> {
  try {
    return await buildPublicRedLightStateInner();
  } catch (err) {
    console.error("[red-light] buildPublicRedLightState failed", err);
    return OFFLINE_RED_LIGHT_STATE;
  }
}

async function buildPublicRedLightStateInner(): Promise<PublicRedLightState> {
  const config = await getOrCreateRedLightConfig();
  const current = await getCurrentRedLightMatch(config);

  const lastEnded = await prisma.redLightMatch.findFirst({
    where: { status: "ENDED" },
    orderBy: { endedAt: "desc" },
  });
  let lastWinner: PublicRedLightState["lastWinner"] = null;
  if (lastEnded) {
    const winner = await prisma.redLightParticipant.findFirst({
      where: { matchId: lastEnded.id, placement: 1 },
    });
    if (winner) {
      lastWinner = { displayName: winner.displayName, placement: 1 };
    }
  }

  let currentMatch: PublicRedLightMatchSummary | null = null;
  if (current) {
    const participantCount = await prisma.redLightParticipant.count({
      where: { matchId: current.id },
    });
    const live = await fetchLiveRedLightRoomSnapshot();
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
    maxPlayers: RED_LIGHT_MAX_PLAYERS,
    currentMatch,
    lastWinner,
  };
}
