import { createHmac, timingSafeEqual } from "crypto";

/**
 * Stateless HMAC helpers shared between the Next.js app (Vercel) and the
 * Colyseus game server (Railway). Both sides import THIS file's logic — the
 * server has a small copy under game-server/src/hmac.ts that stays in sync.
 *
 * Three kinds of payloads are signed with the same secret:
 *
 *  1. matchToken    — issued by Next.js to a lobby player; the game server
 *                     verifies it on Colyseus onJoin so headless bots can't
 *                     connect without going through the lobby flow.
 *  2. adminCommand  — signed by Next.js when /admin clicks Start/End; the
 *                     game server verifies it on /admin/* HTTP endpoints.
 *  3. resultWebhook — signed by the game server when it POSTs the finished
 *                     match back to /api/admin/survivor/result; Next.js
 *                     verifies it before writing rows to Postgres.
 */

const SECRET = process.env.SURVIVOR_SECRET;
if (!SECRET) {
  throw new Error("SURVIVOR_SECRET is required for /survivor HMAC");
}

const KEY = Buffer.from(SECRET, "utf8");

function sign(payload: string): string {
  return createHmac("sha256", KEY).update(payload).digest("hex");
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

// ---------- 1. matchToken ----------
// Bind a token to a specific match + lobby identity so a leaked token can't
// be replayed in a different match or under a different email.

export interface MatchTokenPayload {
  matchId: string;
  email: string;
  displayName: string;
  /** UNIX ms when the token was issued. Game server rejects if too old. */
  issuedAtMs: number;
}

/** How long a matchToken stays valid. Players generally connect within
 * seconds of clicking "Join", so 10 minutes is a comfortable ceiling that
 * still keeps replay windows tight. */
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
  if (p.issuedAtMs - nowMs > 60_000) return false; // future-dated by >1m = bad clock or tampered
  return true;
}

// ---------- 2. adminCommand ----------
// Short-lived signature so Next.js can authorize Start/End calls to the
// game server's /admin endpoints over the public internet.

export type AdminCommand = "start" | "end";

export interface AdminCommandPayload {
  command: AdminCommand;
  /** Optional matchId for "end" calls; empty string for "start". */
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

// ---------- 3. resultWebhook ----------
// Signs a stable hash of the result body so an attacker can't POST fake
// match-result rows to /api/admin/survivor/result.

export interface ResultWebhookHeader {
  matchId: string;
  issuedAtMs: number;
}

export const RESULT_WEBHOOK_TTL_MS = 5 * 60 * 1000;

/**
 * The signature covers `matchId + issuedAtMs + sha256(rawBody)`. The raw
 * request body is what the receiver re-hashes; this keeps verification cheap
 * (no canonical JSON serialization required) and tamper-evident.
 */
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

// Convenience for both sides.
import { createHash } from "crypto";
export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}
