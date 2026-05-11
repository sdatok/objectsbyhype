import { unstable_noStore } from "next/cache";
import { prisma } from "@/lib/db";
import Reviews from "@/components/store/Reviews";
import StoreFaq from "@/components/store/StoreFaq";
import CuratedSpacesSection from "@/components/store/CuratedSpacesSection";
import HomeCatalogClient from "@/components/store/HomeCatalogClient";
import HomeHero from "@/components/store/HomeHero";
import BrandShowcase from "@/components/store/BrandShowcase";
import { CURATED_SPACE_ITEMS } from "@/lib/curated-spaces";
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

function pickHero() {
  const idx = Math.floor(Math.random() * CURATED_SPACE_ITEMS.length);
  return CURATED_SPACE_ITEMS[idx];
}

export default async function HomePage() {
  unstable_noStore();
  const products = await getHomeProducts();
  const hero = pickHero();

  return (
    <div className="bg-white">
      <HomeHero src={hero.src} alt={hero.alt} />

      <HomeCatalogClient products={products} />

      <CuratedSpacesSection excludeSrc={hero.src} />

      <BrandShowcase />

      <StoreFaq />

      <Reviews />
    </div>
  );
}
