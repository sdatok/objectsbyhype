import Link from "next/link";
import { unstable_noStore } from "next/cache";
import { prisma } from "@/lib/db";
import ProductGrid from "@/components/store/ProductGrid";
import Reviews from "@/components/store/Reviews";
import StoreFaq from "@/components/store/StoreFaq";
import CategoryHeaderGrid from "@/components/store/CategoryHeaderGrid";
import HomeEditorialGallery from "@/components/store/HomeEditorialGallery";
import type { Product } from "@/types";
import { toStoreProduct } from "@/lib/map-product";

/** Homepage New Arrivals: max 3 rows at lg (5 columns). */
const NEW_ARRIVALS_GRID_MAX = 15;

async function getHomepageProducts(): Promise<{
  featured: Product[];
  activeProductCount: number;
}> {
  try {
    const [products, activeProductCount] = await Promise.all([
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        include: {
          images: { orderBy: { displayOrder: "asc" } },
          sizeStocks: true,
        },
        orderBy: { createdAt: "desc" },
        take: 24,
      }),
      prisma.product.count({ where: { status: "ACTIVE" } }),
    ]);
    const featured: Product[] = products.map((p) => toStoreProduct(p));
    return { featured, activeProductCount };
  } catch (err) {
    console.error("[getHomepageProducts]", err);
    return { featured: [], activeProductCount: 0 };
  }
}

export default async function HomePage() {
  unstable_noStore();
  const { featured, activeProductCount } = await getHomepageProducts();
  const hasMoreNewArrivals = activeProductCount > NEW_ARRIVALS_GRID_MAX;

  return (
    <div>
      <CategoryHeaderGrid />
      <HomeEditorialGallery />

      {featured.length > 0 && (
        <section>
          <div className="max-w-[1400px] mx-auto px-4 py-8 flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-widest font-bold">
              New Arrivals
            </h2>
            <Link
              href="/shop"
              className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
            >
              View all
            </Link>
          </div>
          <ProductGrid
            products={featured}
            columns={5}
            maxItems={NEW_ARRIVALS_GRID_MAX}
          />
          {hasMoreNewArrivals && (
            <div className="max-w-[1400px] mx-auto px-4 pt-6 pb-4 text-center">
              <Link
                href="/shop"
                className="inline-block text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors border-b border-neutral-300 hover:border-black pb-0.5"
              >
                See more new arrivals
              </Link>
            </div>
          )}
        </section>
      )}

      {featured.length === 0 && (
        <section className="py-32 text-center">
          <p className="text-[11px] uppercase tracking-widest text-neutral-400">
            New furniture drops coming soon
          </p>
        </section>
      )}

      <StoreFaq />

      {/* Reviews */}
      <Reviews />
    </div>
  );
}
