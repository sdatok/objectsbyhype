import { prisma } from "@/lib/db";
import Reviews from "@/components/store/Reviews";
import StoreFaq from "@/components/store/StoreFaq";
import CuratedSpacesSection from "@/components/store/CuratedSpacesSection";
import HomeCatalogClient from "@/components/store/HomeCatalogClient";
import HomeHero from "@/components/store/HomeHero";
import HomeLiveGames from "@/components/store/HomeLiveGames";
import HomeGameSection from "@/components/game/HomeGameSection";
import WallDisplayPromo from "@/components/store/WallDisplayPromo";
import BrandShowcase from "@/components/store/BrandShowcase";
import type { Product } from "@/types";
import { STORE_VISIBLE_STATUSES } from "@/types";
import { toStoreProduct, PRODUCT_INCLUDE } from "@/lib/map-product";
import { Suspense } from "react";

/** Cache the catalog + game header for 60s — cuts DB + function cost on repeat traffic. */
export const revalidate = 60;

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
  const products = await getHomeProducts();

  return (
    <div className="bg-white">
      <HomeHero />

      <Suspense fallback={null}>
        <HomeLiveGames />
      </Suspense>

      <Suspense fallback={null}>
        <HomeGameSection />
      </Suspense>

      <HomeCatalogClient products={products} />

      <WallDisplayPromo />

      <CuratedSpacesSection />

      <BrandShowcase />

      <StoreFaq />

      <Reviews />
    </div>
  );
}
