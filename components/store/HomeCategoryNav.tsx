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
      className="bg-white"
    >
      <div className="max-w-[760px] mx-auto px-4 pt-10 md:pt-14 pb-6 md:pb-8">
        <ul className="grid grid-cols-3 gap-y-3 md:gap-y-4 gap-x-6 md:gap-x-12">
          {NAV_LABELS.map((label) => {
            const isActive = activeCategory === label;
            return (
              <li key={label} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => onSelect(label)}
                  className={`relative inline-block text-center text-[11px] md:text-[12px] uppercase tracking-[0.18em] transition-colors duration-200 py-1 ${
                    isActive
                      ? "text-black"
                      : "text-neutral-400 hover:text-neutral-700"
                  }`}
                  aria-pressed={isActive}
                >
                  <span>{label}</span>
                  <span
                    className={`absolute left-1/2 -translate-x-1/2 -bottom-0.5 h-px bg-black transition-all duration-300 ${
                      isActive ? "w-full" : "w-0"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
