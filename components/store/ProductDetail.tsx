"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import type { Product } from "@/types";
import { ONE_SIZE } from "@/lib/size-stock";

interface ProductDetailProps {
  product: Product;
}

export default function ProductDetail({ product }: ProductDetailProps) {
  const sortedImages = [...product.images].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  const [selectedImage, setSelectedImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const catalogSizes =
    product.sizes.length > 0 ? product.sizes : [ONE_SIZE];
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [sizeError, setSizeError] = useState(false);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  function stockForSize(size: string): number {
    return product.sizeStocks[size] ?? 0;
  }

  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") setSelectedImage((i) => Math.min(i + 1, sortedImages.length - 1));
      if (e.key === "ArrowLeft") setSelectedImage((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, sortedImages.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightboxOpen]);

  function handleAddToCart() {
    const size = product.sizes.length > 0 ? selectedSize : ONE_SIZE;
    if (product.sizes.length > 0 && !selectedSize) {
      setSizeError(true);
      return;
    }
    setSizeError(false);
    if (stockForSize(size) < 1) return;

    const effectivePrice =
      product.sizePricing && size && product.sizePricing[size] != null
        ? Number(product.sizePricing[size])
        : product.price;

    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: effectivePrice,
      size,
      imageUrl: sortedImages[0]?.url ?? "",
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 md:py-12 pb-12 md:pb-16 bg-white">
      {/* Desktop: fixed-ish two columns, centered; keeps buy box from stretching edge-to-edge */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,480px)_minmax(0,340px)] md:max-w-[960px] lg:max-w-[1000px] md:mx-auto gap-8 lg:gap-12 items-start">
        {/* Images: wider slot + contain so wide shots aren’t cropped at the sides */}
        <div className="flex gap-3 w-full max-w-[min(100%,460px)] md:max-w-[480px] mx-auto md:mx-0">
          {/* Thumbnails */}
          {sortedImages.length > 1 && (
            <div className="flex flex-col gap-2 w-14 shrink-0">
              {sortedImages.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(idx)}
                  className={`relative aspect-square border-2 transition-colors ${
                    selectedImage === idx
                      ? "border-black"
                      : "border-transparent"
                  }`}
                >
                  <Image
                    src={img.url}
                    alt={`${product.name} ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Main image */}
          <div
            className="relative flex-1 min-w-0 aspect-[3/4] max-h-[min(88vh,620px)] md:max-h-none bg-white cursor-zoom-in"
            onClick={() => sortedImages[selectedImage] && setLightboxOpen(true)}
          >
            {sortedImages[selectedImage] ? (
              <Image
                src={sortedImages[selectedImage].url}
                alt={product.name}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 96vw, 480px"
                quality={92}
                priority
              />
            ) : (
              <div className="w-full h-full bg-white flex items-center justify-center">
                <span className="text-[11px] uppercase tracking-widest text-neutral-400">
                  No Image
                </span>
              </div>
            )}

            {product.status === "SOLD" && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                <span className="text-[12px] uppercase tracking-widest font-medium">
                  Sold Out
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Product info: narrow column on desktop so CTA isn’t ultra-wide */}
        <div className="flex flex-col w-full max-w-[400px] md:max-w-none mx-auto md:mx-0">
          <p className="text-[11px] uppercase tracking-widest text-neutral-400">
            {product.brand}
          </p>
          {product.consignment && (
            <div className="mt-3 flex flex-col gap-2">
              <span className="inline-flex w-fit items-center border-b border-neutral-900 pb-1 text-[9px] font-medium uppercase tracking-[0.28em] text-neutral-800">
                Consignment
              </span>
              <p className="text-[12px] font-normal leading-relaxed tracking-wide text-neutral-500">
                Pre-owned · Excellent condition
              </p>
            </div>
          )}
          <h1
            className={`text-[20px] md:text-[24px] font-bold leading-tight ${
              product.consignment ? "mt-4" : "mt-1"
            }`}
          >
            {product.name}
          </h1>
          <p className="text-[18px] font-medium mt-3">
            {product.sizePricing && Object.keys(product.sizePricing).length > 0 ? (
              selectedSize && product.sizePricing[selectedSize] != null ? (
                `$${Number(product.sizePricing[selectedSize]).toFixed(2)}`
              ) : (
                `From $${Math.min(...Object.values(product.sizePricing).map(Number)).toFixed(2)}`
              )
            ) : (
              `$${Number(product.price).toFixed(2)}`
            )}
          </p>

          {/* Sizes (hidden UI when single OS / no size list) */}
          {product.sizes.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-widest font-medium">
                  Select Size
                </p>
                {sizeError && (
                  <p className="text-[10px] text-red-500 uppercase tracking-widest">
                    Please select a size
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {catalogSizes.map((size) => {
                  const stock = stockForSize(size);
                  const disabled = stock < 1 || product.status === "SOLD";
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedSize(size);
                        setSizeError(false);
                      }}
                      className={`px-4 py-2.5 text-[11px] uppercase tracking-widest border transition-colors ${
                        selectedSize === size
                          ? "bg-black text-white border-black"
                          : disabled
                            ? "border-neutral-200 text-neutral-300 cursor-not-allowed"
                            : "border-neutral-300 hover:border-black"
                      }`}
                    >
                      {size}
                      {stock > 0 && stock <= 5 && (
                        <span className="block text-[9px] font-normal normal-case tracking-normal text-neutral-400 mt-0.5">
                          {stock} left
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add to cart */}
          <button
            onClick={handleAddToCart}
            disabled={
              product.status === "SOLD" ||
              (product.sizes.length > 0 &&
                selectedSize &&
                stockForSize(selectedSize) < 1) ||
              (product.sizes.length === 0 && stockForSize(ONE_SIZE) < 1)
            }
            className={`mt-6 w-full py-4 text-[11px] uppercase tracking-widest font-medium transition-colors ${
              product.status === "SOLD" ||
              (product.sizes.length > 0 &&
                selectedSize &&
                stockForSize(selectedSize) < 1) ||
              (product.sizes.length === 0 && stockForSize(ONE_SIZE) < 1)
                ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                : added
                  ? "bg-neutral-800 text-white"
                  : "bg-black text-white hover:bg-neutral-800"
            }`}
          >
            {product.status === "SOLD" ||
            (product.sizes.length > 0 &&
              selectedSize &&
              stockForSize(selectedSize) < 1) ||
            (product.sizes.length === 0 && stockForSize(ONE_SIZE) < 1)
              ? "Sold Out"
              : added
                ? "Added to Cart"
                : "Add to Cart"}
          </button>

          {/* Description */}
          <div className="mt-8 pt-8 border-t border-neutral-200">
            <p className="text-[11px] uppercase tracking-widest font-medium mb-3">
              Details
            </p>
            <p className="text-[13px] leading-relaxed text-neutral-600">
              {product.description}
            </p>
          </div>

          {/* Category */}
          <div className="mt-6 pt-6 border-t border-neutral-200">
            <p className="text-[11px] text-neutral-400 uppercase tracking-widest">
              Category:{" "}
              <span className="text-black">{product.category}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Lightbox: backdrop receives outside taps; controls sit above image layer (full-bleed image div used to block Close on mobile) */}
      {lightboxOpen && sortedImages[selectedImage] && (
        <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Product image">
          <div
            className="absolute inset-0 bg-black/95"
            onClick={() => setLightboxOpen(false)}
          />

          <button
            type="button"
            className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-[110] min-h-11 min-w-11 px-3 flex items-center justify-center text-white text-[11px] uppercase tracking-widest bg-white/10 hover:bg-white/20 active:bg-white/25 rounded-sm transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(false);
            }}
          >
            Close
          </button>

          {selectedImage > 0 && (
            <button
              type="button"
              className="absolute left-[max(0.75rem,env(safe-area-inset-left))] top-1/2 -translate-y-1/2 z-[110] min-h-11 min-w-11 flex items-center justify-center text-white text-[22px] leading-none opacity-80 hover:opacity-100 bg-white/10 rounded-sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage((i) => i - 1);
              }}
              aria-label="Previous image"
            >
              ‹
            </button>
          )}

          <div className="absolute inset-0 z-[101] flex items-center justify-center pointer-events-none pt-14 pb-16 px-4">
            <div
              className="pointer-events-auto relative h-[min(85dvh,100svh-7rem)] w-full max-w-[min(100%-1rem,1152px)]"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={sortedImages[selectedImage].url}
                alt={product.name}
                fill
                className="object-contain"
                sizes="100vw"
                quality={92}
                priority
              />
            </div>
          </div>

          {selectedImage < sortedImages.length - 1 && (
            <button
              type="button"
              className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-1/2 -translate-y-1/2 z-[110] min-h-11 min-w-11 flex items-center justify-center text-white text-[22px] leading-none opacity-80 hover:opacity-100 bg-white/10 rounded-sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage((i) => i + 1);
              }}
              aria-label="Next image"
            >
              ›
            </button>
          )}

          {sortedImages.length > 1 && (
            <p className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[110] text-white/50 text-[10px] uppercase tracking-widest pointer-events-none">
              {selectedImage + 1} / {sortedImages.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
