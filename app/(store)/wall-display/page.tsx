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
      {/* Hero — show the image at native 4:5 portrait so the sconce
          at the top, the cross grid, and the caption at the bottom
          are all preserved at native resolution. */}
      <section className="bg-white">
        <div className="max-w-[1400px] mx-auto px-4 pt-10 md:pt-16 pb-10 md:pb-14">
          <div className="relative mx-auto w-full max-w-[640px] bg-black overflow-hidden">
            <div className="relative w-full aspect-[819/1024]">
              <Image
                src="/objectsbyhype_images/wall-display.png"
                alt="Objectsbyhype wall display — handcrafted accessories"
                fill
                priority
                unoptimized
                sizes="(max-width: 720px) 100vw, 640px"
                className="object-cover object-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Intro copy */}
      <section className="border-b border-neutral-100">
        <div className="max-w-[1100px] mx-auto px-4 pt-2 pb-16 md:pb-24 text-center">
          <p className="text-[10px] uppercase tracking-[0.32em] text-neutral-400 mb-6">
            Collection · 01
          </p>
          <h1 className="text-black font-black uppercase tracking-[0.18em] md:tracking-[0.22em] leading-[0.95] text-[34px] sm:text-[52px] md:text-[78px] lg:text-[100px]">
            <span className="block">Wall</span>
            <span className="block">Display</span>
          </h1>
          <p className="mx-auto max-w-[640px] mt-8 md:mt-10 text-[13px] md:text-[14px] leading-relaxed text-neutral-600">
            Handcrafted accessories made to be mounted, lit, and lived with.
            Small-batch objects in a palette of finishes — pieces meant for
            arrangement, layered against the wall as a whole.
          </p>
          <div className="mt-8">
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
