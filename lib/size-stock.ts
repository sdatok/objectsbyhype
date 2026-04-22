import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

/** Single-size placeholder when a product has no sizes array */
export const ONE_SIZE = "OS";

export type SizeQuantityMap = Record<string, number>;

/**
 * Replace all size stock rows for a product from admin payload.
 * Sizes not in `sizes` array are removed.
 */
export async function replaceProductSizeStocks(
  tx: Prisma.TransactionClient,
  productId: string,
  sizes: string[],
  sizeStocks: SizeQuantityMap | undefined | null
) {
  await tx.productSizeStock.deleteMany({ where: { productId } });
  for (const size of sizes) {
    const qty = Math.max(0, Math.floor(sizeStocks?.[size] ?? 0));
    await tx.productSizeStock.create({
      data: { productId, size, quantity: qty },
    });
  }
  if (sizes.length === 0) {
    const qty = Math.max(0, Math.floor(sizeStocks?.[ONE_SIZE] ?? 0));
    await tx.productSizeStock.create({
      data: { productId, size: ONE_SIZE, quantity: qty },
    });
  }
}

export async function syncProductAggregateQuantity(
  prisma: PrismaClient,
  productId: string
) {
  const agg = await prisma.productSizeStock.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });
  const sum = agg._sum.quantity ?? 0;
  await prisma.product.update({
    where: { id: productId },
    data: { quantity: sum },
  });
}

export function sizeStocksToMap(
  rows: { size: string; quantity: number }[]
): Record<string, number> {
  return Object.fromEntries(rows.map((r) => [r.size, r.quantity]));
}
