import { prisma } from "@/lib/db";
import { maskEmail } from "@/lib/game-config";
import type { PublicBlackjackChatMessage } from "@/lib/blackjack-types";

const MAX_CHAT_BODY = 280;
const MAX_CHATS_PER_EMAIL_PER_MINUTE = 8;

export function sanitizeChatBody(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_CHAT_BODY);
}

export async function listBlackjackChatMessages(
  roundId: string,
  afterMs?: number | null,
  viewerEmail?: string | null
): Promise<PublicBlackjackChatMessage[]> {
  const after =
    afterMs && Number.isFinite(afterMs) ? new Date(afterMs) : undefined;

  const rows = await prisma.blackjackChatMessage.findMany({
    where: {
      roundId,
      ...(after ? { createdAt: { gt: after } } : {}),
    },
    orderBy: { createdAt: after ? "asc" : "desc" },
    take: after ? 50 : 40,
  });

  const ordered = after ? rows : [...rows].reverse();

  return ordered.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    isViewer: viewerEmail ? row.email === viewerEmail : false,
  }));
}

export async function postBlackjackChatMessage(input: {
  roundId: string;
  email: string;
  displayName: string;
  body: string;
}): Promise<PublicBlackjackChatMessage> {
  const body = sanitizeChatBody(input.body);
  if (body.length < 1) {
    throw new Error("Message cannot be empty.");
  }

  const recent = await prisma.blackjackChatMessage.count({
    where: {
      roundId: input.roundId,
      email: input.email,
      createdAt: { gte: new Date(Date.now() - 60_000) },
    },
  });
  if (recent >= MAX_CHATS_PER_EMAIL_PER_MINUTE) {
    throw new Error("Slow down — too many messages.");
  }

  const row = await prisma.blackjackChatMessage.create({
    data: {
      roundId: input.roundId,
      email: input.email,
      displayName: input.displayName.slice(0, 32),
      body,
    },
  });

  return {
    id: row.id,
    displayName: row.displayName,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    isViewer: true,
  };
}

export { maskEmail as maskBlackjackEmail };
