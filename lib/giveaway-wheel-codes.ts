import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeGiveawayWheelCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function generateGiveawayWheelCode(): string {
  let suffix = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    suffix += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `GW-${suffix.slice(0, 4)}-${suffix.slice(4, 8)}`;
}

export async function generateUniqueGiveawayWheelCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateGiveawayWheelCode();
    const existing = await prisma.giveawayWheelPlayCode.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Could not generate unique giveaway wheel code");
}

export async function createGiveawayPlayCode(input: {
  winnerName: string;
  winnerEmail?: string;
  source?: string;
  notes?: string | null;
}) {
  const winnerName = input.winnerName.trim();
  if (winnerName.length < 2) {
    throw new Error("Winner name is required.");
  }

  const code = await generateUniqueGiveawayWheelCode();
  return prisma.giveawayWheelPlayCode.create({
    data: {
      code,
      winnerName,
      winnerEmail: input.winnerEmail?.trim().toLowerCase() ?? "",
      source: input.source?.trim() ?? "",
      notes: input.notes?.trim() || null,
    },
  });
}
