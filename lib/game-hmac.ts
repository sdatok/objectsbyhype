import { createHmac, timingSafeEqual } from "crypto";

/**
 * Stateless HMAC for game-session anti-cheat. The client receives the raw
 * `sessionId` and `signature` from /api/game/start; on score submit we
 * recompute the HMAC and compare in constant time. We DON'T trust the
 * client to send the issuedAt timestamp — it lives in the DB record.
 */

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error("SESSION_SECRET is required for game session HMAC");
}

const KEY = Buffer.from(SECRET, "utf8");

export function signGameSession(
  sessionId: string,
  issuedAtMs: number
): string {
  const payload = `${sessionId}:${issuedAtMs}`;
  return createHmac("sha256", KEY).update(payload).digest("hex");
}

export function verifyGameSession(
  sessionId: string,
  issuedAtMs: number,
  candidate: string
): boolean {
  if (!candidate || typeof candidate !== "string") return false;
  const expected = signGameSession(sessionId, issuedAtMs);
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
