"use client";

import { Client, Room } from "colyseus.js";

export const LUNA_RECONNECT_KEY = "obh-luna-reconnect";
const ROOM_NAME = "escape-luna";

export interface LunaJoinParams {
  wsUrl: string;
  matchId: string;
  email: string;
  displayName: string;
  matchToken: string;
  issuedAtMs: number;
  slimeColor?: string;
  slimeFace?: number;
  slimeAccessories?: number;
  nameColor?: string;
}

export interface LunaConnection {
  client: Client;
  room: Room;
}

export async function joinLunaRoom(params: LunaJoinParams): Promise<LunaConnection> {
  if (!params.wsUrl) {
    throw new Error("Game server URL is not configured.");
  }
  const client = new Client(params.wsUrl);
  const room = await client.joinOrCreate(ROOM_NAME, {
    email: params.email,
    displayName: params.displayName,
    matchId: params.matchId,
    matchToken: params.matchToken,
    issuedAtMs: params.issuedAtMs,
    slimeColor: params.slimeColor ?? "",
    slimeFace: params.slimeFace ?? 0,
    slimeAccessories: params.slimeAccessories ?? 0,
    nameColor: params.nameColor ?? "",
  });
  return { client, room };
}

export interface LunaInput {
  moveX: number;
  moveY: number;
  aim: number;
  shooting: boolean;
}

export function startLunaInputLoop(
  room: Room,
  inputRef: { current: LunaInput },
  hzInterval = 1000 / 30
): () => void {
  const id = window.setInterval(() => {
    const i = inputRef.current;
    room.send("input", {
      moveX: i.moveX,
      moveY: i.moveY,
      aim: i.aim,
      shooting: false,
    });
  }, hzInterval);
  return () => window.clearInterval(id);
}
