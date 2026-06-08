"use client";

import { Client, Room } from "colyseus.js";

export const RED_LIGHT_RECONNECT_KEY = "obh-red-light-reconnect";
const ROOM_NAME = "red-light";

export interface RedLightJoinParams {
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

export interface RedLightConnection {
  client: Client;
  room: Room;
}

export async function joinRedLightRoom(
  params: RedLightJoinParams
): Promise<RedLightConnection> {
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

export interface RedLightInput {
  moveX: number;
  moveY: number;
  forward: boolean;
}

export function startRedLightInputLoop(
  room: Room,
  inputRef: { current: RedLightInput },
  hzInterval = 1000 / 30
): () => void {
  const id = window.setInterval(() => {
    const i = inputRef.current;
    room.send("input", {
      moveX: i.moveX,
      moveY: i.moveY,
      forward: i.forward,
    });
  }, hzInterval);
  return () => window.clearInterval(id);
}
