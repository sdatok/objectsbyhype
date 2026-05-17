import type {
  Product as PrismaProduct,
  ProductImage,
  ProductVariant as PrismaVariant,
  ProductVariantImage,
  Prisma,
} from "@prisma/client";
import type { Product, ProductVariant } from "@/types";
import { sizeStocksToMap } from "@/lib/size-stock";

/**
 * Canonical include shape so every store/admin query pulls the same relations
 * (product images, product-level size stocks, and color variants with their
 * own images + size stocks).
 */
export const PRODUCT_INCLUDE = {
  images: { orderBy: { displayOrder: "asc" } },
  sizeStocks: true,
  variants: {
    orderBy: { displayOrder: "asc" },
    include: {
      images: { orderBy: { displayOrder: "asc" } },
      sizeStocks: true,
    },
  },
} as const satisfies Prisma.ProductInclude;

type PrismaVariantWithRelations = PrismaVariant & {
  images: ProductVariantImage[];
  sizeStocks: { size: string; quantity: number }[];
};

export type PrismaProductWithRelations = PrismaProduct & {
  images: ProductImage[];
  sizeStocks: { size: string; quantity: number }[];
  variants?: PrismaVariantWithRelations[];
};

function toStoreVariant(v: PrismaVariantWithRelations): ProductVariant {
  const sizeStocks = sizeStocksToMap(v.sizeStocks);
  return {
    id: v.id,
    colorName: v.colorName,
    colorHex: v.colorHex,
    price: v.price === null || v.price === undefined ? null : Number(v.price),
    displayOrder: v.displayOrder,
    images: [...v.images]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((img) => ({
        id: img.id,
        url: img.url,
        displayOrder: img.displayOrder,
      })),
    sizes: Object.keys(sizeStocks),
    sizeStocks,
  };
}

export function toStoreProduct(p: PrismaProductWithRelations): Product {
  const variants = (p.variants ?? [])
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(toStoreVariant);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    description: p.description,
    price: Number(p.price),
    category: p.category,
    status: p.status,
    sizes: p.sizes,
    sizePricing: p.sizePricing as Record<string, number> | null,
    quantity: p.quantity,
    sizeStocks: sizeStocksToMap(p.sizeStocks),
    consignment: Boolean(p.consignment),
    images: [...p.images]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((img) => ({
        id: img.id,
        url: img.url,
        displayOrder: img.displayOrder,
      })),
    variants,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
