import ProductCard from "./ProductCard";
import type { Product } from "@/types";

export default function HomeProductGrid({
  products,
}: {
  products: Product[];
}) {
  if (products.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-[11px] uppercase tracking-widest text-neutral-400">
          No products in this category
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 pb-12 md:pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8">
          {products.map((product) => (
            <div key={product.id} className="bg-white min-w-0">
              <ProductCard product={product} minimal />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
