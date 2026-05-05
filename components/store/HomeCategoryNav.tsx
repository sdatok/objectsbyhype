"use client";

import { CATEGORIES } from "@/types";

const NAV_LABELS = ["NEW", ...CATEGORIES] as const;

export default function HomeCategoryNav({
  activeCategory,
  onSelect,
}: {
  activeCategory: string;
  onSelect: (category: string) => void;
}) {
  return (
    <nav
      aria-label="Shop by category"
      className="border-b border-neutral-200 bg-white"
    >
      <div className="max-w-[900px] mx-auto px-4 py-10 md:py-12">
        <ul className="grid grid-cols-3 md:grid-cols-4 gap-y-2 md:gap-y-3 gap-x-4 md:gap-x-8">
          {NAV_LABELS.map((label) => {
            const isActive = activeCategory === label;
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => onSelect(label)}
                  className={`block w-full text-center text-[12px] md:text-[13px] uppercase tracking-[0.14em] transition-colors ${
                    isActive
                      ? "text-black font-medium"
                      : "text-neutral-400 hover:text-neutral-700"
                  }`}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
