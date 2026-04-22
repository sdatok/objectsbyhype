import Link from "next/link";
import { prisma } from "@/lib/db";
import { brandsForShowcase } from "@/lib/brands";

export default async function BrandShowcase() {
  let inventoryBrands: string[] = [];
  try {
    const rows = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { brand: true },
      distinct: ["brand"],
    });
    inventoryBrands = rows.map((r) => r.brand);
  } catch {
    // Prisma unavailable: fall back to curated list only
  }

  const brands = brandsForShowcase(inventoryBrands);

  return (
    <section className="border-t border-neutral-200 py-20 md:py-24">
      <div className="max-w-[1400px] mx-auto px-4">
        <p className="text-[11px] uppercase tracking-[0.35em] text-neutral-400 text-center mb-12 md:mb-14">
          Shop by Brand
        </p>
        <div className="flex flex-wrap justify-center gap-x-14 md:gap-x-20 gap-y-7 md:gap-y-8">
          {brands.map((brand) => (
            <Link
              key={brand}
              href={`/shop?brand=${encodeURIComponent(brand)}`}
              className="text-[14px] md:text-[15px] uppercase tracking-[0.12em] text-neutral-400 hover:text-black transition-colors duration-150"
            >
              {brand}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
