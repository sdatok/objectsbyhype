"use client";

import { Client, Room } from "colyseus.js";

/**
 * Tiny wrapper around colyseus.js that keeps connection details + input
 * batching localized to one place. The component only talks to the returned
 * Room and the mutable `inputRef`.
 *
 * State is delta-decoded by colyseus.js for us — components read room.state
 * directly on each render frame.
 */

export const SURVIVOR_RECONNECT_KEY = "obh-survivor-reconnect";

export interface SurvivorReconnectSession {
  wsUrl: string;
  matchId: string;
  email: string;
  displayName: string;
  reconnectionToken: string;
  savedAtMs: number;
}

export function readSurvivorReconnectSession(): SurvivorReconnectSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SURVIVOR_RECONNECT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SurvivorReconnectSession;
    if (
      !parsed?.wsUrl ||
      !parsed.matchId ||
      !parsed.reconnectionToken ||
      !parsed.email
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSurvivorReconnectSession(
  session: SurvivorReconnectSession
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SURVIVOR_RECONNECT_KEY, JSON.stringify(session));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSurvivorReconnectSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SURVIVOR_RECONNECT_KEY);
  } catch {
    /* ignore */
  }
}

export interface JoinParams {
  wsUrl: string;
  matchId: string;
  email: string;
  displayName: string;
  matchToken: string;
  issuedAtMs: number;
  slimeColor?: string;
  slimeFace?: number;
  /** @deprecated */
  slimeAccessories?: number;
  slimeHeadAccessory?: number;
  slimeBodyAccessory?: number;
  nameColor?: string;
  nameOutline?: number;
  nameBadge?: number;
}

const ROOM_NAME = "survivor";

export interface SurvivorConnection {
  client: Client;
  room: Room;
}

export async function joinSurvivorRoom(
  params: JoinParams
): Promise<SurvivorConnection> {
  if (!params.wsUrl) {
    throw new Error(
      "Game server URL is not configured. Ask admin to set NEXT_PUBLIC_SURVIVOR_WS_URL."
    );
  }
  if (typeof window !== "undefined") {
    console.info("[survivor] connecting", {
      wsUrl: params.wsUrl,
      matchId: params.matchId,
      email: params.email,
    });
  }
  const client = new Client(params.wsUrl);
  try {
    // joinOrCreate routes you to the existing global SurvivorRoom (the server
    // never spawns a second one in our setup).
    const room = await client.joinOrCreate(ROOM_NAME, {
      email: params.email,
      displayName: params.displayName,
      matchId: params.matchId,
      matchToken: params.matchToken,
      issuedAtMs: params.issuedAtMs,
      slimeColor: params.slimeColor ?? "",
      slimeFace: params.slimeFace ?? 0,
      slimeAccessories: params.slimeAccessories ?? 0,
      slimeHeadAccessory: params.slimeHeadAccessory ?? 0,
      slimeBodyAccessory: params.slimeBodyAccessory ?? 0,
      nameColor: params.nameColor ?? "",
      nameOutline: params.nameOutline ?? 0,
      nameBadge: params.nameBadge ?? 0,
    });
    if (typeof window !== "undefined") {
      console.info("[survivor] joined room", {
        sessionId: room.sessionId,
        roomId: room.roomId,
      });
    }
    return { client, room };
  } catch (err) {
    // Colyseus surfaces matchmaker / CORS / WSS errors as bare errors with a
    // generic message ("Failed to fetch"). Rewrap so the lobby UI tells the
    // operator what to actually fix.
    if (typeof window !== "undefined") {
      console.error("[survivor] joinOrCreate failed", err);
    }
    const original = err instanceof Error ? err.message : String(err);
    if (/failed to fetch|network|cors/i.test(original)) {
      throw new Error(
        `Couldn't reach the game server (${params.wsUrl}). Likely CORS or the server is down. Original: ${original}`
      );
    }
    throw err;
  }
}

/** Re-attach to a room after an unexpected WebSocket drop (needs allowReconnection on server). */
export async function reconnectSurvivorRoom(
  client: Client,
  reconnectionToken: string
): Promise<Room> {
  return client.reconnect(reconnectionToken);
}

export interface MutableInput {
  moveX: number;
  moveY: number;
  aim: number;
  shooting: boolean;
}

/**
 * Send the current input every interval. Returns a cancel fn. We send even
 * when input hasn't changed because the server uses `aim` for facing-direction
 * even on idle frames, and a tiny periodic packet keeps the room from
 * pruning the player as idle.
 */
export function startInputLoop(
  room: Room,
  inputRef: { current: MutableInput },
  hzInterval = 1000 / 30
): () => void {
  const id = window.setInterval(() => {
    const i = inputRef.current;
    room.send("input", {
      moveX: i.moveX,
      moveY: i.moveY,
      aim: i.aim,
      shooting: i.shooting,
    });
  }, hzInterval);
  return () => window.clearInterval(id);
}
