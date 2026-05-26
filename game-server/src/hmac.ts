import { createHmac, timingSafeEqual, createHash } from "crypto";

/**
 * Server-side mirror of /lib/survivor-hmac.ts. Kept identical wire format so
 * Next.js can sign and the game server can verify (and vice versa).
 *
 * Reads SURVIVOR_SECRET lazily — calling sign/verify before the env is set
 * throws a clear error instead of crashing at import time.
 */

function getKey(): Buffer {
  const SECRET = process.env.SURVIVOR_SECRET;
  if (!SECRET) {
    throw new Error("SURVIVOR_SECRET is required for /survivor HMAC");
  }
  return Buffer.from(SECRET, "utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", getKey()).update(payload).digest("hex");
}

function verify(payload: string, candidate: string): boolean {
  if (!candidate || typeof candidate !== "string") return false;
  const expected = sign(payload);
  if (expected.length !== candidate.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(candidate, "hex")
    );
  } catch {
    return false;
  }
}

// ---------- matchToken ----------

export interface MatchTokenPayload {
  matchId: string;
  email: string;
  displayName: string;
  issuedAtMs: number;
}

export const MATCH_TOKEN_TTL_MS = 10 * 60 * 1000;

function matchTokenPayloadString(p: MatchTokenPayload): string {
  return `match:${p.matchId}:${p.email}:${p.displayName}:${p.issuedAtMs}`;
}

export function signMatchToken(p: MatchTokenPayload): string {
  return sign(matchTokenPayloadString(p));
}

export function verifyMatchToken(
  p: MatchTokenPayload,
  candidate: string,
  nowMs: number = Date.now()
): boolean {
  if (!verify(matchTokenPayloadString(p), candidate)) return false;
  if (nowMs - p.issuedAtMs > MATCH_TOKEN_TTL_MS) return false;
  if (p.issuedAtMs - nowMs > 60_000) return false;
  return true;
}

// ---------- adminCommand ----------

export type AdminCommand = "start" | "end";

export interface AdminCommandPayload {
  command: AdminCommand;
  matchId: string;
  issuedAtMs: number;
}

export const ADMIN_COMMAND_TTL_MS = 60 * 1000;

function adminCommandPayloadString(p: AdminCommandPayload): string {
  return `admin:${p.command}:${p.matchId}:${p.issuedAtMs}`;
}

export function signAdminCommand(p: AdminCommandPayload): string {
  return sign(adminCommandPayloadString(p));
}

export function verifyAdminCommand(
  p: AdminCommandPayload,
  candidate: string,
  nowMs: number = Date.now()
): boolean {
  if (!verify(adminCommandPayloadString(p), candidate)) return false;
  if (nowMs - p.issuedAtMs > ADMIN_COMMAND_TTL_MS) return false;
  if (p.issuedAtMs - nowMs > 30_000) return false;
  return true;
}

// ---------- resultWebhook ----------

export interface ResultWebhookHeader {
  matchId: string;
  issuedAtMs: number;
}

export const RESULT_WEBHOOK_TTL_MS = 5 * 60 * 1000;

function resultPayloadString(
  header: ResultWebhookHeader,
  bodySha256Hex: string
): string {
  return `result:${header.matchId}:${header.issuedAtMs}:${bodySha256Hex}`;
}

export function signResultWebhook(
  header: ResultWebhookHeader,
  bodySha256Hex: string
): string {
  return sign(resultPayloadString(header, bodySha256Hex));
}

export function verifyResultWebhook(
  header: ResultWebhookHeader,
  bodySha256Hex: string,
  candidate: string,
  nowMs: number = Date.now()
): boolean {
  if (!verify(resultPayloadString(header, bodySha256Hex), candidate))
    return false;
  if (nowMs - header.issuedAtMs > RESULT_WEBHOOK_TTL_MS) return false;
  if (header.issuedAtMs - nowMs > 60_000) return false;
  return true;
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}
