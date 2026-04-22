"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

interface ShopFiltersProps {
  categories: string[];
  brands: string[];
  activeCategory: string;
  activeBrand: string;
  activeSort: string;
}

export default function ShopFilters({
  categories,
  brands,
  activeCategory,
  activeBrand,
  activeSort,
}: ShopFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [filtersOpen, setFiltersOpen] = useState(false);

  function buildUrl(updates: Record<string, string>) {
    const params = new URLSearchParams();
    const merged = { category: activeCategory, brand: activeBrand, sort: activeSort, ...updates };
    if (merged.category && merged.category !== "All") params.set("category", merged.category);
    if (merged.brand) params.set("brand", merged.brand);
    if (merged.sort && merged.sort !== "newest") params.set("sort", merged.sort);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="border-b border-neutral-200">
      {/* Desktop filter row */}
      <div className="hidden md:flex items-center justify-between px-4 py-3 gap-4">
        {/* Categories */}
        <div className="flex items-center gap-1 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => router.push(buildUrl({ category: cat }))}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-widest transition-colors ${
                activeCategory === cat
                  ? "bg-black text-white"
                  : "text-neutral-500 hover:text-black"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Brand filter */}
          {brands.length > 0 && (
            <select
              value={activeBrand}
              onChange={(e) => router.push(buildUrl({ brand: e.target.value }))}
              className="text-[10px] uppercase tracking-widest border border-neutral-200 px-3 py-1.5 bg-white focus:outline-none focus:border-black"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}

          {/* Sort */}
          <select
            value={activeSort}
            onChange={(e) => router.push(buildUrl({ sort: e.target.value }))}
            className="text-[10px] uppercase tracking-widest border border-neutral-200 px-3 py-1.5 bg-white focus:outline-none focus:border-black"
          >
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low–High</option>
            <option value="price-desc">Price: High–Low</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* Mobile filter toggle */}
      <div className="md:hidden">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-[10px] uppercase tracking-widest"
        >
          <span>Filter & Sort</span>
          <span>{filtersOpen ? "−" : "+"}</span>
        </button>

        {filtersOpen && (
          <div className="px-4 pb-4 flex flex-col gap-4">
            {/* Categories */}
            <div className="flex flex-wrap gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    router.push(buildUrl({ category: cat }));
                    setFiltersOpen(false);
                  }}
                  className={`px-3 py-1.5 text-[10px] uppercase tracking-widest transition-colors ${
                    activeCategory === cat
                      ? "bg-black text-white"
                      : "border border-neutral-200 text-neutral-500"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Brand + sort */}
            <div className="flex gap-3">
              {brands.length > 0 && (
                <select
                  value={activeBrand}
                  onChange={(e) => {
                    router.push(buildUrl({ brand: e.target.value }));
                    setFiltersOpen(false);
                  }}
                  className="flex-1 text-[10px] uppercase tracking-widest border border-neutral-200 px-3 py-2 bg-white focus:outline-none"
                >
                  <option value="">All Brands</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={activeSort}
                onChange={(e) => {
                  router.push(buildUrl({ sort: e.target.value }));
                  setFiltersOpen(false);
                }}
                className="flex-1 text-[10px] uppercase tracking-widest border border-neutral-200 px-3 py-2 bg-white focus:outline-none"
              >
                <option value="newest">Newest</option>
                <option value="price-asc">Price ↑</option>
                <option value="price-desc">Price ↓</option>
                <option value="name">A–Z</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
