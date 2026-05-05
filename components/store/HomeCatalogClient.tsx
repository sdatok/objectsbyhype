"use client";

import { useMemo, useRef, useState } from "react";
import type { Product } from "@/types";
import HomeCategoryNav from "./HomeCategoryNav";
import HomeProductGrid from "./HomeProductGrid";

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
    <>
      <HomeCategoryNav
        activeCategory={activeCategory}
        onSelect={onSelectCategory}
      />

      <div
        className={`transition-opacity duration-200 ${
          activeCategory === visibleCategory ? "opacity-100" : "opacity-40"
        }`}
      >
        <HomeProductGrid products={visibleProducts} />
      </div>
    </>
  );
}
