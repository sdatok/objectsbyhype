import { signAdminCommand } from "@/lib/survivor-hmac";
import type { EscapeLunaConfig, EscapeLunaMatch } from "@prisma/client";

interface LunaRoomSnapshot {
  matchId?: string;
  status?: string;
}

export async function ensureLunaGameServerMatchBound(
  match: EscapeLunaMatch,
  config: EscapeLunaConfig,
  lobbySeconds = 60
): Promise<void> {
  const baseUrl = process.env.SURVIVOR_GAME_SERVER_URL;
  const secret = process.env.SURVIVOR_SECRET;
  if (!baseUrl || !secret) return;

  let luna: LunaRoomSnapshot | null = null;
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/admin/state`, {
      headers: { "x-admin-secret": secret },
      cache: "no-store",
    });
    if (!res.ok) return;
    const json = (await res.json()) as { luna?: LunaRoomSnapshot | null };
    luna = json.luna ?? null;
  } catch {
    return;
  }

  if (luna?.matchId === match.id) return;

  const issuedAtMs = Date.now();
  const signature = signAdminCommand({
    command: "start",
    matchId: match.id,
    issuedAtMs,
  });

  const matchSeconds = config.matchSeconds;
  const startedAtMs = match.startedAt?.getTime() ?? 0;
  const estimatedStartMs =
    startedAtMs > 0 ? startedAtMs : match.createdAt.getTime() + lobbySeconds * 1000;
  const matchEndsAtMs = estimatedStartMs + matchSeconds * 1000;
  const likelyPlaying =
    match.status === "PLAYING" ||
    (match.status === "WAITING" && Date.now() >= estimatedStartMs + 5000);

  await fetch(`${baseUrl.replace(/\/$/, "")}/admin/luna/rebind`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Signature": signature,
      "X-Admin-Issued-At": String(issuedAtMs),
    },
    body: JSON.stringify({
      matchId: match.id,
      prizeTitle: match.prizeTitle,
      matchSeconds,
      lobbySeconds,
      targetStatus: likelyPlaying ? "PLAYING" : "COUNTDOWN",
      startedAtMs: likelyPlaying ? estimatedStartMs : 0,
      matchEndsAtMs: likelyPlaying ? matchEndsAtMs : 0,
    }),
  }).catch((err) => {
    console.error("[escape-luna] game server rebind failed", err);
  });
}
