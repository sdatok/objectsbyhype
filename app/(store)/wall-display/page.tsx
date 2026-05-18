import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { unstable_noStore } from "next/cache";
import { prisma } from "@/lib/db";
import { STORE_VISIBLE_STATUSES } from "@/types";
import type { Product } from "@/types";
import { toStoreProduct, PRODUCT_INCLUDE } from "@/lib/map-product";
import ProductGrid from "@/components/store/ProductGrid";

export const metadata: Metadata = {
  title: "Wall Display - OBJECTSBYHYPE",
  description:
    "Handcrafted wall display accessories — small-batch objects designed to be mounted, lit, and lived with.",
};

const WALL_DISPLAY_CATEGORY = "Wall Display";

async function getWallDisplayProducts(): Promise<Product[]> {
  try {
    const products = await prisma.product.findMany({
      where: {
        category: WALL_DISPLAY_CATEGORY,
        status: { in: STORE_VISIBLE_STATUSES },
      },
      include: PRODUCT_INCLUDE,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return products.map((p) => toStoreProduct(p));
  } catch (err) {
    console.error("[wall-display] getProducts", err);
    return [];
  }
}

export default async function WallDisplayPage() {
  unstable_noStore();
  const products = await getWallDisplayProducts();

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative bg-black">
        <div className="relative w-full aspect-[4/5] sm:aspect-[16/10] md:aspect-[21/10] max-h-[760px] overflow-hidden">
          <Image
            src="/objectsbyhype_images/wall-display.png"
            alt="Objectsbyhype wall display — handcrafted accessories"
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
      </section>

      {/* Intro copy */}
      <section className="border-b border-neutral-100">
        <div className="max-w-[900px] mx-auto px-4 py-14 md:py-20 text-center">
          <p className="text-[10px] uppercase tracking-[0.32em] text-neutral-400 mb-4">
            Collection · 01
          </p>
          <h1 className="text-[24px] sm:text-[32px] md:text-[40px] font-light tracking-tight leading-[1.1]">
            Wall Display
          </h1>
          <p className="mt-5 text-[13px] md:text-[14px] leading-relaxed text-neutral-600">
            Handcrafted accessories made to be mounted, lit, and lived with.
            Small-batch objects in a palette of finishes — pieces meant for
            arrangement, layered against the wall as a whole.
          </p>
          <div className="mt-7">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-neutral-500 hover:text-black transition-colors"
            >
              <span>← All categories</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="max-w-[1400px] mx-auto">
        <div className="px-4 pt-12 pb-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">
              Pieces
            </p>
            <h2 className="text-[16px] md:text-[18px] font-medium tracking-tight mt-1.5">
              {products.length}{" "}
              {products.length === 1 ? "object" : "objects"} in this collection
            </h2>
          </div>
        </div>
        <div className="pt-2 pb-20">
          <ProductGrid products={products} columns={5} />
        </div>
      </section>
    </div>
  );
}
