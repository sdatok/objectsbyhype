import Link from "next/link";
import { CATEGORIES } from "@/types";

const NAV_LABELS = ["NEW", ...CATEGORIES] as const;

export default function HomeCategoryNav({
  activeCategory,
}: {
  activeCategory: string;
}) {
  return (
    <nav
      aria-label="Shop by category"
      className="border-b border-neutral-200 bg-white"
    >
      <div className="max-w-[1400px] mx-auto px-4 py-10 md:py-14 flex justify-center">
        <ul className="flex flex-col items-center gap-1 md:gap-1">
          {NAV_LABELS.map((label) => {
            const href =
              label === "NEW" ? "/" : `/?category=${encodeURIComponent(label)}`;
            const isActive =
              label === "NEW"
                ? activeCategory === "NEW"
                : activeCategory === label;
            return (
              <li key={label}>
                <Link
                  href={href}
                  className={`block text-center text-[12px] md:text-[13px] uppercase tracking-[0.14em] transition-colors ${
                    isActive
                      ? "text-black font-medium"
                      : "text-neutral-400 hover:text-neutral-700"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
