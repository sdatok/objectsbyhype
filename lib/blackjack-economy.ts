import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createGiveawayPlayCode } from "@/lib/giveaway-wheel-codes";
import { createPlayCodeForMember, generateUniqueWheelCode } from "@/lib/wheel-codes";
import { currentMonthKey } from "@/lib/wheel-config";

export const IM_DAILY_GRANT = 50;
export const IM_MILESTONE_GIVEAWAY = 100;
export const IM_MILESTONE_WOH = 400;
export const IM_MIN_BET = 5;
export const IM_MAX_BET = 250;
export const BLACKJACK_TABLE_SEATS = 10;
export const INACTIVE_ROUNDS_KICK = 3;

export function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function nextUtcMidnightMs(from = new Date()): number {
  const d = new Date(from);
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

export async function getOrCreateWallet(email: string, displayName?: string) {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.blackjackWallet.findUnique({
    where: { email: normalized },
  });
  if (existing) {
    if (displayName && displayName !== existing.displayName) {
      return prisma.blackjackWallet.update({
        where: { email: normalized },
        data: { displayName: displayName.slice(0, 32) },
      });
    }
    return existing;
  }
  return prisma.blackjackWallet.create({
    data: {
      email: normalized,
      displayName: (displayName ?? normalized.split("@")[0] ?? "Player").slice(
        0,
        32
      ),
    },
  });
}

export async function canReceiveDailyGrant(email: string): Promise<boolean> {
  const wallet = await getOrCreateWallet(email);
  const today = utcDateKey();
  return wallet.lastDailyGrantDate !== today;
}

export async function grantDailyStack(email: string): Promise<number> {
  const wallet = await getOrCreateWallet(email);
  const today = utcDateKey();
  if (wallet.lastDailyGrantDate === today) return 0;
  await prisma.blackjackWallet.update({
    where: { email: wallet.email },
    data: { lastDailyGrantDate: today },
  });
  return IM_DAILY_GRANT;
}

export async function updatePeakStack(email: string, stackCredits: number) {
  const wallet = await getOrCreateWallet(email);
  const total = wallet.savedCredits + stackCredits;
  if (total <= wallet.peakStack) return;
  await prisma.blackjackWallet.update({
    where: { email: wallet.email },
    data: { peakStack: total },
  });
}

interface MilestoneState {
  day: string;
  giveaway: boolean;
  woh: boolean;
}

function parseMilestones(raw: unknown): MilestoneState {
  const today = utcDateKey();
  if (!raw || typeof raw !== "object") {
    return { day: today, giveaway: false, woh: false };
  }
  const o = raw as MilestoneState;
  if (o.day !== today) return { day: today, giveaway: false, woh: false };
  return {
    day: today,
    giveaway: Boolean(o.giveaway),
    woh: Boolean(o.woh),
  };
}

export async function checkStackMilestones(input: {
  email: string;
  displayName: string;
  stackCredits: number;
}): Promise<{ giveawayCode: string | null; wohCode: string | null }> {
  const wallet = await getOrCreateWallet(input.email, input.displayName);
  let ms = parseMilestones(wallet.milestonesJson);
  let giveawayCode: string | null = null;
  let wohCode: string | null = null;

  if (
    !ms.giveaway &&
    input.stackCredits >= IM_MILESTONE_GIVEAWAY
  ) {
    const code = await createGiveawayPlayCode({
      winnerName: input.displayName,
      winnerEmail: input.email,
      source: "Blackjack",
      notes: `stack:${input.stackCredits} milestone:${IM_MILESTONE_GIVEAWAY}`,
    });
    giveawayCode = code.code;
    ms = { ...ms, giveaway: true };
  }

  if (!ms.woh && input.stackCredits >= IM_MILESTONE_WOH) {
    wohCode = await grantWohSpinCode(input.email, input.displayName);
    ms = { ...ms, woh: true };
  }

  if (ms.giveaway !== parseMilestones(wallet.milestonesJson).giveaway ||
      ms.woh !== parseMilestones(wallet.milestonesJson).woh ||
      ms.day !== parseMilestones(wallet.milestonesJson).day) {
    await prisma.blackjackWallet.update({
      where: { email: wallet.email },
      data: { milestonesJson: { ...ms } as Prisma.InputJsonValue },
    });
  }

  await updatePeakStack(input.email, input.stackCredits);
  return { giveawayCode, wohCode };
}

async function grantWohSpinCode(
  email: string,
  displayName: string
): Promise<string> {
  const monthKey = currentMonthKey();
  let member = await prisma.wheelProMember.findFirst({
    where: { email, notes: { contains: "blackjack-high-roller" } },
  });
  if (!member) {
    member = await prisma.wheelProMember.create({
      data: {
        name: displayName.slice(0, 48),
        email,
        monthlyPrice: 0,
        active: true,
        notes: "blackjack-high-roller auto-provisioned",
      },
    });
  } else if (!member.active) {
    member = await prisma.wheelProMember.update({
      where: { id: member.id },
      data: { active: true },
    });
  }

  const existing = await prisma.wheelPlayCode.findUnique({
    where: { proMemberId_monthKey: { proMemberId: member.id, monthKey } },
  });
  if (existing?.usedAt) {
    const code = await generateUniqueWheelCode();
    return prisma.wheelPlayCode
      .create({
        data: { code, proMemberId: member.id, monthKey },
      })
      .then((r) => r.code);
  }
  if (existing) return existing.code;
  const row = await createPlayCodeForMember(member.id, monthKey);
  return row.code;
}

export async function saveCreditsToBank(email: string, amount?: number) {
  const seat = await prisma.blackjackSeat.findUnique({ where: { email } });
  if (!seat) throw new Error("You must be seated to save credits.");
  if (seat.handPhase !== "IDLE") {
    throw new Error("Finish your hand before saving.");
  }
  const move = amount ?? seat.stackCredits;
  if (move <= 0) throw new Error("Nothing to save.");
  if (move > seat.stackCredits) throw new Error("Not enough table credits.");

  await prisma.$transaction([
    prisma.blackjackSeat.update({
      where: { email },
      data: { stackCredits: { decrement: move } },
    }),
    prisma.blackjackWallet.update({
      where: { email },
      data: { savedCredits: { increment: move } },
    }),
  ]);

  const updated = await prisma.blackjackSeat.findUnique({ where: { email } });
  if (updated) await updatePeakStack(email, updated.stackCredits);
  return move;
}

export async function getLeaderboard(limit = 10) {
  const rows = await prisma.blackjackWallet.findMany({
    orderBy: [{ peakStack: "desc" }, { updatedAt: "asc" }],
    take: limit,
    where: { peakStack: { gt: 0 } },
  });
  return rows.map((r, i) => ({
    rank: i + 1,
    displayName: r.displayName,
    email: r.email.replace(/(.{2}).+(@.+)/, "$1***$2"),
    peakStack: r.peakStack,
    savedCredits: r.savedCredits,
  }));
}
