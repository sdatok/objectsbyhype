"use client";

import type { ProductVariant } from "@/types";

interface ColorSwatchRowProps {
  variants: ProductVariant[];
  activeId: string | null;
  onSelect: (variantId: string) => void;
  /** Compact mode: tiny dots used on ProductCard */
  size?: "card" | "pdp";
}

export default function ColorSwatchRow({
  variants,
  activeId,
  onSelect,
  size = "pdp",
}: ColorSwatchRowProps) {
  if (variants.length === 0) return null;
  const dot = size === "card";

  return (
    <div
      className={
        dot
          ? "flex items-center gap-1.5"
          : "flex flex-wrap items-center gap-2.5"
      }
      aria-label="Color"
    >
      {variants.map((v) => {
        const isActive = v.id === activeId;
        const label = v.colorName;
        const hex = v.colorHex;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            className={
              dot
                ? "block rounded-full transition-transform duration-150 hover:scale-110"
                : "group relative flex items-center justify-center"
            }
          >
            {hex ? (
              <span
                style={{ backgroundColor: hex }}
                className={
                  dot
                    ? `inline-block h-3 w-3 rounded-full border ${
                        isActive
                          ? "border-black ring-1 ring-black ring-offset-1 ring-offset-white"
                          : "border-neutral-300"
                      }`
                    : `inline-block h-7 w-7 rounded-full border transition-all ${
                        isActive
                          ? "border-black ring-2 ring-black ring-offset-2 ring-offset-white"
                          : "border-neutral-300 hover:border-neutral-500"
                      }`
                }
              />
            ) : (
              <span
                className={
                  dot
                    ? `inline-flex h-3 min-w-3 items-center justify-center rounded-full border px-1 text-[8px] uppercase ${
                        isActive
                          ? "border-black bg-black text-white"
                          : "border-neutral-300 text-neutral-500"
                      }`
                    : `inline-flex items-center justify-center px-3 py-1.5 text-[10px] uppercase tracking-widest border transition-colors ${
                        isActive
                          ? "border-black bg-black text-white"
                          : "border-neutral-300 hover:border-black"
                      }`
                }
              >
                {dot ? label.slice(0, 1) : label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
