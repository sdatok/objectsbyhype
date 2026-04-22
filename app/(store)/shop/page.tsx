import { prisma } from "@/lib/db";
import ProductGrid from "@/components/store/ProductGrid";
import ShopFilters from "@/components/store/ShopFilters";
import type { Product } from "@/types";
import { CATEGORIES } from "@/types";
import { toStoreProduct } from "@/lib/map-product";

interface ShopPageProps {
  searchParams: Promise<{
    category?: string;
    brand?: string;
    sort?: string;
  }>;
}

async function getProducts(filters: {
  category?: string;
  brand?: string;
  sort?: string;
}): Promise<{ products: Product[]; brands: string[] }> {
  try {
    const where: Record<string, unknown> = { status: "ACTIVE" };

    if (filters.category && filters.category !== "All") {
      where.category = filters.category;
    }
    if (filters.brand) {
      where.brand = { contains: filters.brand, mode: "insensitive" };
    }

    let orderBy: Record<string, string> = { createdAt: "desc" };
    if (filters.sort === "price-asc") orderBy = { price: "asc" };
    if (filters.sort === "price-desc") orderBy = { price: "desc" };
    if (filters.sort === "name") orderBy = { name: "asc" };

    const [products, allBrands] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          images: { orderBy: { displayOrder: "asc" } },
          sizeStocks: true,
        },
        orderBy,
      }),
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { brand: true },
        distinct: ["brand"],
        orderBy: { brand: "asc" },
      }),
    ]);

    return {
      products: products.map((p) => toStoreProduct(p)),
      brands: allBrands.map((b) => b.brand),
    };
  } catch (err) {
    console.error("[getProducts shop]", err);
    return { products: [], brands: [] };
  }
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const { products, brands } = await getProducts(params);

  const activeCategory = params.category ?? "All";
  const activeBrand = params.brand ?? "";
  const activeSort = params.sort ?? "newest";

  return (
    <div>
      {/* Shop header */}
      <div className="border-b border-neutral-200">
        <div className="max-w-[1400px] mx-auto px-4 py-6 flex items-end justify-between">
          <div>
            <h1 className="text-[11px] uppercase tracking-widest font-bold">
              Shop
            </h1>
            <p className="text-[11px] text-neutral-400 mt-1">
              {products.length} {products.length === 1 ? "item" : "items"}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto">
        {/* Filters bar */}
        <ShopFilters
          categories={["All", ...CATEGORIES]}
          brands={brands}
          activeCategory={activeCategory}
          activeBrand={activeBrand}
          activeSort={activeSort}
        />

        {/* Grid */}
        <ProductGrid products={products} columns={5} />
      </div>
    </div>
  );
}
