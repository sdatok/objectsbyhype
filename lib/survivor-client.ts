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

export interface JoinParams {
  wsUrl: string;
  matchId: string;
  email: string;
  displayName: string;
  matchToken: string;
  issuedAtMs: number;
}

const ROOM_NAME = "survivor";

export async function joinSurvivorRoom(params: JoinParams): Promise<Room> {
  if (!params.wsUrl) {
    throw new Error("Missing game server URL");
  }
  const client = new Client(params.wsUrl);
  // joinOrCreate routes you to the existing global SurvivorRoom (the server
  // never spawns a second one in our setup).
  const room = await client.joinOrCreate(ROOM_NAME, {
    email: params.email,
    displayName: params.displayName,
    matchId: params.matchId,
    matchToken: params.matchToken,
    issuedAtMs: params.issuedAtMs,
  });
  return room;
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
