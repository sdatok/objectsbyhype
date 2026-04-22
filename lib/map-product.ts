import type { Product as PrismaProduct, ProductImage } from "@prisma/client";
import type { Product } from "@/types";
import { sizeStocksToMap } from "@/lib/size-stock";

export type PrismaProductWithRelations = PrismaProduct & {
  images: ProductImage[];
  sizeStocks: { size: string; quantity: number }[];
};

export function toStoreProduct(p: PrismaProductWithRelations): Product {
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
    images: p.images.map((img) => ({
      id: img.id,
      url: img.url,
      displayOrder: img.displayOrder,
    })),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
