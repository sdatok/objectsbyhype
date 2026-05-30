import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { currentMonthKey } from "@/lib/wheel-config";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeWheelCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function generateWheelCode(): string {
  let suffix = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    suffix += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `OBH-${suffix.slice(0, 4)}-${suffix.slice(4, 8)}`;
}

export async function generateUniqueWheelCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateWheelCode();
    const existing = await prisma.wheelPlayCode.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Could not generate unique wheel code");
}

export async function createPlayCodeForMember(
  proMemberId: string,
  monthKey = currentMonthKey()
) {
  const existing = await prisma.wheelPlayCode.findUnique({
    where: {
      proMemberId_monthKey: { proMemberId, monthKey },
    },
  });
  if (existing) return existing;

  const code = await generateUniqueWheelCode();
  return prisma.wheelPlayCode.create({
    data: {
      code,
      proMemberId,
      monthKey,
    },
  });
}

export async function bulkGenerateCodesForMonth(monthKey = currentMonthKey()) {
  const members = await prisma.wheelProMember.findMany({
    where: { active: true },
    select: { id: true },
  });

  const created: Array<{ proMemberId: string; code: string }> = [];
  for (const member of members) {
    const existing = await prisma.wheelPlayCode.findUnique({
      where: {
        proMemberId_monthKey: { proMemberId: member.id, monthKey },
      },
    });
    if (existing) continue;
    const row = await createPlayCodeForMember(member.id, monthKey);
    created.push({ proMemberId: member.id, code: row.code });
  }
  return created;
}
