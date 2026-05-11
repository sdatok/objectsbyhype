"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { Product } from "@/types";
import HomeCategoryNav from "./HomeCategoryNav";
import HomeProductGrid from "./HomeProductGrid";

const MAX_HOMEPAGE_ITEMS = 12;

export default function HomeCatalogClient({
  products,
}: {
  products: Product[];
}) {
  const [activeCategory, setActiveCategory] = useState("NEW");
  const [visibleCategory, setVisibleCategory] = useState("NEW");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleProducts = useMemo(() => {
    if (visibleCategory === "NEW") return products;
    return products.filter((p) => p.category === visibleCategory);
  }, [products, visibleCategory]);

  const hasMore = visibleProducts.length > MAX_HOMEPAGE_ITEMS;
  const shopHref =
    visibleCategory === "NEW"
      ? "/shop"
      : `/shop?category=${encodeURIComponent(visibleCategory)}`;

  function onSelectCategory(category: string) {
    if (category === activeCategory) return;
    setActiveCategory(category);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisibleCategory(category);
      timerRef.current = null;
    }, 130);
  }

  return (
    <section aria-label="Shop products" className="bg-white">
      <HomeCategoryNav
        activeCategory={activeCategory}
        onSelect={onSelectCategory}
      />

      <div
        className={`transition-opacity duration-200 ${
          activeCategory === visibleCategory ? "opacity-100" : "opacity-30"
        }`}
      >
        <HomeProductGrid
          products={visibleProducts}
          maxItems={MAX_HOMEPAGE_ITEMS}
        />
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2 pb-12 md:pb-16">
          <Link
            href={shopHref}
            className="group inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-neutral-500 hover:text-black transition-colors"
          >
            <span>View all</span>
            <span
              aria-hidden
              className="inline-block transition-transform duration-200 group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
      )}
    </section>
  );
}
