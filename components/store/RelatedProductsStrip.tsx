import ProductCard from "./ProductCard";
import type { Product } from "@/types";

interface RelatedProductsStripProps {
  products: Product[];
}

/**
 * PDP “You may also like”: inset, compact cards. Catalog uses ProductGrid (5 col) only.
 */
export default function RelatedProductsStrip({
  products,
}: RelatedProductsStripProps) {
  if (products.length === 0) return null;

  return (
    <section className="border-t border-neutral-200 mt-20 md:mt-28 pt-10 md:pt-14 pb-12 md:pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8">
        <h2 className="text-[11px] uppercase tracking-widest font-bold mb-8">
          You May Also Like
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white">
          {products.map((product) => (
            <div key={product.id} className="bg-white p-2 md:p-2.5">
              <ProductCard product={product} compact />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
