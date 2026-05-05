import { unstable_noStore } from "next/cache";
import { prisma } from "@/lib/db";
import Reviews from "@/components/store/Reviews";
import StoreFaq from "@/components/store/StoreFaq";
import CuratedSpacesSection from "@/components/store/CuratedSpacesSection";
import HomeCatalogClient from "@/components/store/HomeCatalogClient";
import BrandShowcase from "@/components/store/BrandShowcase";
import type { Product } from "@/types";
import { toStoreProduct } from "@/lib/map-product";

async function getHomeProducts(): Promise<Product[]> {
  try {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      include: {
        images: { orderBy: { displayOrder: "asc" } },
        sizeStocks: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return products.map((p) => toStoreProduct(p));
  } catch (err) {
    console.error("[getHomeProducts]", err);
    return [];
  }
}

export default async function HomePage() {
  unstable_noStore();
  const products = await getHomeProducts();

  return (
    <div className="bg-white">
      <CuratedSpacesSection />

      <HomeCatalogClient products={products} />

      <BrandShowcase />

      <StoreFaq />

      <Reviews />
    </div>
  );
}
