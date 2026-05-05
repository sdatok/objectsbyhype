import { unstable_noStore } from "next/cache";
import { prisma } from "@/lib/db";
import Reviews from "@/components/store/Reviews";
import StoreFaq from "@/components/store/StoreFaq";
import CuratedSpacesSection from "@/components/store/CuratedSpacesSection";
import HomeCategoryNav from "@/components/store/HomeCategoryNav";
import HomeProductGrid from "@/components/store/HomeProductGrid";
import BrandShowcase from "@/components/store/BrandShowcase";
import type { Product } from "@/types";
import { CATEGORIES } from "@/types";
import { toStoreProduct } from "@/lib/map-product";

interface HomePageProps {
  searchParams: Promise<{ category?: string }>;
}

function normalizeActiveCategory(category?: string): string {
  if (!category || category === "NEW") return "NEW";
  const allowed = new Set(CATEGORIES as readonly string[]);
  return allowed.has(category) ? category : "NEW";
}

async function getHomeProducts(categoryFilter?: string): Promise<Product[]> {
  try {
    const where: Record<string, unknown> = { status: "ACTIVE" };
    if (categoryFilter) {
      where.category = categoryFilter;
    }

    const products = await prisma.product.findMany({
      where,
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

export default async function HomePage({ searchParams }: HomePageProps) {
  unstable_noStore();
  const params = await searchParams;
  const activeCategory = normalizeActiveCategory(params.category);
  const categoryFilter =
    activeCategory === "NEW" ? undefined : activeCategory;

  const products = await getHomeProducts(categoryFilter);

  return (
    <div className="bg-white">
      <CuratedSpacesSection />

      <HomeCategoryNav activeCategory={activeCategory} />

      <HomeProductGrid products={products} />

      <BrandShowcase />

      <StoreFaq />

      <Reviews />
    </div>
  );
}
