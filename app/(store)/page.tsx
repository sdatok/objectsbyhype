import { unstable_noStore } from "next/cache";
import { prisma } from "@/lib/db";
import Reviews from "@/components/store/Reviews";
import StoreFaq from "@/components/store/StoreFaq";
import CuratedSpacesSection from "@/components/store/CuratedSpacesSection";
import HomeCatalogClient from "@/components/store/HomeCatalogClient";
import HomeHero from "@/components/store/HomeHero";
import WallDisplayPromo from "@/components/store/WallDisplayPromo";
import BrandShowcase from "@/components/store/BrandShowcase";
import type { Product } from "@/types";
import { STORE_VISIBLE_STATUSES } from "@/types";
import { toStoreProduct, PRODUCT_INCLUDE } from "@/lib/map-product";

async function getHomeProducts(): Promise<Product[]> {
  try {
    const products = await prisma.product.findMany({
      where: { status: { in: STORE_VISIBLE_STATUSES } },
      include: PRODUCT_INCLUDE,
      // ACTIVE < SOLD alphabetically — keep in-stock items first, then newest within each bucket.
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
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
      <HomeHero />

      <HomeCatalogClient products={products} />

      <WallDisplayPromo />

      <CuratedSpacesSection />

      <BrandShowcase />

      <StoreFaq />

      <Reviews />
    </div>
  );
}
