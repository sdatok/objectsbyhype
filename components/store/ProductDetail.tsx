"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import type { Product, ProductVariant } from "@/types";
import { ONE_SIZE } from "@/lib/size-stock";
import ProductDescription from "./ProductDescription";
import ColorSwatchRow from "./ColorSwatchRow";

interface ProductDetailProps {
  product: Product;
  /** Optional preselected color (case-insensitive match on colorName) */
  initialColorName?: string;
}

function findInitialVariant(
  product: Product,
  initialColorName?: string
): ProductVariant | null {
  if (product.variants.length === 0) return null;
  if (initialColorName) {
    const wanted = initialColorName.trim().toLowerCase();
    const match = product.variants.find(
      (v) => v.colorName.toLowerCase() === wanted
    );
    if (match) return match;
  }
  return product.variants[0];
}

export default function ProductDetail({
  product,
  initialColorName,
}: ProductDetailProps) {
  const hasVariants = product.variants.length > 0;

  const [activeVariantId, setActiveVariantId] = useState<string | null>(() => {
    const v = findInitialVariant(product, initialColorName);
    return v?.id ?? null;
  });

  const activeVariant: ProductVariant | null = useMemo(() => {
    if (!hasVariants) return null;
    return (
      product.variants.find((v) => v.id === activeVariantId) ??
      product.variants[0] ??
      null
    );
  }, [product.variants, activeVariantId, hasVariants]);

  // Effective collections, driven by variant when present.
  const effectiveImages = useMemo(() => {
    const imgs = activeVariant?.images?.length
      ? activeVariant.images
      : product.images;
    return [...imgs].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [activeVariant, product.images]);

  const effectiveSizes = useMemo(() => {
    if (activeVariant) return activeVariant.sizes;
    return product.sizes;
  }, [activeVariant, product.sizes]);

  const catalogSizes =
    effectiveSizes.length > 0 ? effectiveSizes : [ONE_SIZE];

  function stockForSize(size: string): number {
    if (activeVariant) return activeVariant.sizeStocks[size] ?? 0;
    return product.sizeStocks[size] ?? 0;
  }

  const effectivePriceForSize = (size: string): number => {
    if (activeVariant && activeVariant.price != null) {
      return Number(activeVariant.price);
    }
    if (
      product.sizePricing &&
      size &&
      product.sizePricing[size] != null
    ) {
      return Number(product.sizePricing[size]);
    }
    return Number(product.price);
  };

  const [selectedImage, setSelectedImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [sizeError, setSizeError] = useState(false);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  // Reset selection state when the chosen variant changes.
  useEffect(() => {
    setSelectedImage(0);
    setSelectedSize("");
    setSizeError(false);
  }, [activeVariantId]);

  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight")
        setSelectedImage((i) => Math.min(i + 1, effectiveImages.length - 1));
      if (e.key === "ArrowLeft")
        setSelectedImage((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, effectiveImages.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightboxOpen]);

  function handleAddToCart() {
    const requiresSize = effectiveSizes.length > 0;
    const size = requiresSize ? selectedSize : ONE_SIZE;
    if (requiresSize && !selectedSize) {
      setSizeError(true);
      return;
    }
    setSizeError(false);
    if (stockForSize(size) < 1) return;

    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: effectivePriceForSize(size),
      size,
      imageUrl: effectiveImages[0]?.url ?? "",
      quantity: 1,
      variantId: activeVariant?.id ?? null,
      variantLabel: activeVariant?.colorName ?? null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  // Display price logic — handles variant override, per-size pricing, base price.
  const displayPrice = (() => {
    if (activeVariant && activeVariant.price != null) {
      return `$${Number(activeVariant.price).toFixed(2)}`;
    }
    if (selectedSize) {
      return `$${effectivePriceForSize(selectedSize).toFixed(2)}`;
    }
    if (
      !activeVariant &&
      product.sizePricing &&
      Object.keys(product.sizePricing).length > 0
    ) {
      return `From $${Math.min(
        ...Object.values(product.sizePricing).map(Number)
      ).toFixed(2)}`;
    }
    return `$${Number(product.price).toFixed(2)}`;
  })();

  const addDisabled =
    product.status === "SOLD" ||
    (effectiveSizes.length > 0 &&
      Boolean(selectedSize) &&
      stockForSize(selectedSize) < 1) ||
    (effectiveSizes.length === 0 && stockForSize(ONE_SIZE) < 1);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 md:py-12 pb-12 md:pb-16 bg-white">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,480px)_minmax(0,340px)] md:max-w-[960px] lg:max-w-[1000px] md:mx-auto gap-8 lg:gap-12 items-start">
        <div className="flex gap-3 w-full max-w-[min(100%,460px)] md:max-w-[480px] mx-auto md:mx-0">
          {effectiveImages.length > 1 && (
            <div className="flex flex-col gap-2 w-14 shrink-0">
              {effectiveImages.map((img, idx) => (
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

          <div
            className="relative flex-1 min-w-0 aspect-[3/4] max-h-[min(88vh,620px)] md:max-h-none bg-white cursor-zoom-in"
            onClick={() =>
              effectiveImages[selectedImage] && setLightboxOpen(true)
            }
          >
            {effectiveImages[selectedImage] ? (
              <Image
                src={effectiveImages[selectedImage].url}
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
          <p className="text-[18px] font-medium mt-3">{displayPrice}</p>

          {/* Color variants */}
          {hasVariants && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-widest font-medium">
                  Color
                </p>
                {activeVariant && (
                  <p className="text-[11px] text-neutral-500">
                    {activeVariant.colorName}
                  </p>
                )}
              </div>
              <ColorSwatchRow
                variants={product.variants}
                activeId={activeVariant?.id ?? null}
                onSelect={(id) => setActiveVariantId(id)}
              />
            </div>
          )}

          {effectiveSizes.length > 0 && (
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

          <button
            onClick={handleAddToCart}
            disabled={addDisabled}
            className={`mt-6 w-full py-4 text-[11px] uppercase tracking-widest font-medium transition-colors ${
              addDisabled
                ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                : added
                  ? "bg-neutral-800 text-white"
                  : "bg-black text-white hover:bg-neutral-800"
            }`}
          >
            {addDisabled
              ? "Sold Out"
              : added
                ? "Added to Cart"
                : "Add to Cart"}
          </button>

          <div className="mt-8 pt-8 border-t border-neutral-200">
            <p className="text-[11px] uppercase tracking-widest font-medium mb-3">
              Details
            </p>
            <ProductDescription text={product.description} />
          </div>

          <div className="mt-6 pt-6 border-t border-neutral-200">
            <p className="text-[11px] text-neutral-400 uppercase tracking-widest">
              Category:{" "}
              <span className="text-black">{product.category}</span>
            </p>
          </div>
        </div>
      </div>

      {lightboxOpen && effectiveImages[selectedImage] && (
        <div
          className="fixed inset-0 z-[100]"
          role="dialog"
          aria-modal="true"
          aria-label="Product image"
        >
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
                src={effectiveImages[selectedImage].url}
                alt={product.name}
                fill
                className="object-contain"
                sizes="100vw"
                quality={92}
                priority
              />
            </div>
          </div>

          {selectedImage < effectiveImages.length - 1 && (
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

          {effectiveImages.length > 1 && (
            <p className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[110] text-white/50 text-[10px] uppercase tracking-widest pointer-events-none">
              {selectedImage + 1} / {effectiveImages.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
