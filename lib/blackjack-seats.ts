import { prisma } from "@/lib/db";
import { BLACKJACK_TABLE_SEATS } from "@/lib/blackjack-economy";

export async function assignBlackjackSeatIndex(): Promise<number | null> {
  const taken = await prisma.blackjackSeat.findMany({
    select: { seatIndex: true },
  });
  const used = new Set(taken.map((t) => t.seatIndex));
  for (let i = 0; i < BLACKJACK_TABLE_SEATS; i++) {
    if (!used.has(i)) return i;
  }
  return null;
}

export async function seatedCount(): Promise<number> {
  return prisma.blackjackSeat.count();
}
