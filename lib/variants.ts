import type { Prisma } from "@prisma/client";

export interface VariantImageInput {
  url: string;
  displayOrder: number;
}

export interface VariantInput {
  /** Existing variant id when editing. Omitted/empty on create. */
  id?: string | null;
  colorName: string;
  colorHex?: string | null;
  price?: number | string | null;
  displayOrder?: number;
  images: VariantImageInput[];
  sizes: string[];
  /** size -> quantity */
  sizeStocks: Record<string, number>;
}

function normalizeHex(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const trimmed = hex.trim();
  if (!trimmed) return null;
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(withHash) ? withHash : null;
}

function normalizePrice(price: VariantInput["price"]): number | null {
  if (price === null || price === undefined || price === "") return null;
  const n = typeof price === "number" ? price : Number(price);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * Replace all variants for a product atomically.
 * Strategy: delete-all-then-recreate. Variants are append-only from the
 * admin UI today, and existing variant ids aren't surfaced to buyers besides
 * via OrderLineItem.variantId (which is nullable + SetNull).
 *
 * If `variants` is empty, the product reverts to "no variants" mode.
 */
export async function replaceProductVariants(
  tx: Prisma.TransactionClient,
  productId: string,
  variants: VariantInput[]
) {
  await tx.productVariant.deleteMany({ where: { productId } });

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const colorName = v.colorName?.trim();
    if (!colorName) continue;

    const created = await tx.productVariant.create({
      data: {
        productId,
        colorName,
        colorHex: normalizeHex(v.colorHex),
        price: normalizePrice(v.price),
        displayOrder: v.displayOrder ?? i,
      },
    });

    if (v.images?.length) {
      await tx.productVariantImage.createMany({
        data: v.images.map((img, idx) => ({
          variantId: created.id,
          url: img.url,
          displayOrder: img.displayOrder ?? idx,
        })),
      });
    }

    const sizeList = (v.sizes ?? []).filter(Boolean);
    for (const size of sizeList) {
      const qty = Math.max(0, Math.floor(v.sizeStocks?.[size] ?? 0));
      await tx.productVariantSizeStock.create({
        data: { variantId: created.id, size, quantity: qty },
      });
    }
  }
}
