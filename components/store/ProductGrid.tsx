import ProductCard from "./ProductCard";
import type { Product } from "@/types";

interface ProductGridProps {
  products: Product[];
  columns?: 2 | 3 | 5;
  /** Hard cap on cards (e.g. homepage New Arrivals). Applied here so it cannot be bypassed. */
  maxItems?: number;
}

export default function ProductGrid({
  products,
  columns = 5,
  maxItems,
}: ProductGridProps) {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  };

  const items =
    maxItems != null && maxItems >= 0
      ? products.slice(0, maxItems)
      : products;

  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-[12px] uppercase tracking-widest text-neutral-400">
          No products found
        </p>
      </div>
    );
  }

  return (
    <div className="px-4">
      <div className={`grid ${gridCols[columns]} gap-0`}>
        {items.map((product) => (
          <div key={product.id} className="bg-white">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  );
}
