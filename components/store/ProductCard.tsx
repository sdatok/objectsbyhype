import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  /** Smaller type + image hints for narrow grids (e.g. “You may also like”). */
  compact?: boolean;
  /** Dense grid: square image, product name only (Yeezy-style homepage). */
  minimal?: boolean;
}

export default function ProductCard({
  product,
  compact,
  minimal,
}: ProductCardProps) {
  const sorted = [...product.images].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
  const primaryImage = sorted[0];
  const secondaryImage = sorted[1];

  if (minimal) {
    return (
      <Link
        href={`/product/${product.slug}`}
        className="group block h-full flex flex-col min-w-0"
      >
        <div className="relative aspect-square bg-white overflow-hidden">
          {primaryImage ? (
            <Image
              src={primaryImage.url}
              alt={product.name}
              fill
              className="object-contain"
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 16vw"
              quality={88}
            />
          ) : (
            <div className="w-full h-full bg-neutral-50" aria-hidden />
          )}
          {product.status === "SOLD" && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <span className="text-[9px] uppercase tracking-widest font-medium">
                Sold Out
              </span>
            </div>
          )}
        </div>
        <p className="text-center font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.08em] text-black pt-2.5 sm:pt-3 px-1 leading-snug">
          {product.name}
        </p>
      </Link>
    );
  }

  return (
    <Link href={`/product/${product.slug}`} className="group block">
      {/* Image container */}
      <div className="relative aspect-[3/4] bg-white overflow-hidden">
        {primaryImage ? (
          <>
            <Image
              src={primaryImage.url}
              alt={product.name}
              fill
              className={`object-contain transition-opacity duration-300 ${
                secondaryImage ? "group-hover:opacity-0" : ""
              }`}
              sizes={
                compact
                  ? "(max-width: 640px) 45vw, 260px"
                  : "(max-width: 640px) 55vw, (max-width: 1024px) 38vw, 28vw"
              }
              quality={88}
            />
            {secondaryImage && (
              <Image
                src={secondaryImage.url}
                alt={product.name}
                fill
                className="object-contain opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                sizes={
                  compact
                    ? "(max-width: 640px) 45vw, 260px"
                    : "(max-width: 640px) 55vw, (max-width: 1024px) 38vw, 28vw"
                }
                quality={88}
              />
            )}
          </>
        ) : (
          <div className="w-full h-full bg-white" />
        )}

        {product.status === "SOLD" && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="text-[10px] uppercase tracking-widest font-medium">
              Sold Out
            </span>
          </div>
        )}
      </div>

      {/* Info: visible on hover on desktop, always on mobile */}
      <div
        className={
          compact
            ? "mt-1.5"
            : "mt-2 px-2 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity md:duration-200"
        }
      >
        <p
          className={`uppercase tracking-widest text-neutral-400 ${
            compact ? "text-[9px]" : "text-[10px]"
          }`}
        >
          {product.brand}
        </p>
        <p
          className={`font-medium mt-0.5 leading-snug ${
            compact ? "text-[11px]" : "text-[12px]"
          }`}
        >
          {product.name}
        </p>
        <p className={`mt-0.5 ${compact ? "text-[11px]" : "text-[12px]"}`}>
          ${Number(product.price).toFixed(2)}
        </p>
      </div>
    </Link>
  );
}
