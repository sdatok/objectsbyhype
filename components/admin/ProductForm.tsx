"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ImageUploader, { type UploadedImage } from "./ImageUploader";
import { CATEGORIES } from "@/types";
import type { Product } from "@/types";
import { KNOWN_BRANDS } from "@/lib/brands";
import { ONE_SIZE } from "@/lib/size-stock";
import ProductDescription from "@/components/store/ProductDescription";
import VariantEditor, { type VariantDraft } from "./VariantEditor";

const SIZE_PRESETS: Record<string, string[]> = {
  Furniture: ["Small", "Medium", "Large"],
  Decor: ["One Size"],
  Lighting: ["Table", "Floor", "Pendant"],
};

interface ProductFormProps {
  product?: Product;
  mode: "create" | "edit";
  existingBrands: string[];
}

export default function ProductForm({
  product,
  mode,
  existingBrands,
}: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: product?.name ?? "",
    brand: product?.brand ?? "",
    slug: product?.slug ?? "",
    description: product?.description ?? "",
    price: product?.price?.toString() ?? "",
    category: product?.category ?? CATEGORIES[0],
    status: product?.status ?? "DRAFT",
    sizes: product?.sizes ?? ([] as string[]),
    quantity: product?.quantity?.toString() ?? "0",
    consignment: product?.consignment ?? false,
    madeToOrder: product?.madeToOrder ?? false,
    etsyUrl: product?.etsyUrl ?? "",
    etsyShop: product?.etsyShop ?? "",
    etsyCost: product?.etsyCost != null ? String(product.etsyCost) : "",
    etsyNote: product?.etsyNote ?? "",
  });

  const [sizePricing, setSizePricing] = useState<Record<string, string>>(
    product?.sizePricing
      ? Object.fromEntries(
          Object.entries(product.sizePricing).map(([k, v]) => [k, String(v)])
        )
      : {}
  );

  const [images, setImages] = useState<UploadedImage[]>(
    product?.images.map((img) => ({
      url: img.url,
      displayOrder: img.displayOrder,
    })) ?? []
  );

  const [customSize, setCustomSize] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>(
    () =>
      product?.variants?.map((v) => ({
        id: v.id,
        colorName: v.colorName,
        colorHex: v.colorHex ?? "",
        price: v.price != null ? String(v.price) : "",
        images: v.images.map((img) => ({
          url: img.url,
          displayOrder: img.displayOrder,
        })),
        sizes: v.sizes,
        sizeStocks: Object.fromEntries(
          Object.entries(v.sizeStocks).map(([k, val]) => [k, String(val)])
        ),
        etsyUrl: v.etsyUrl ?? "",
        etsyCost: v.etsyCost != null ? String(v.etsyCost) : "",
        etsyNote: v.etsyNote ?? "",
      })) ?? []
  );

  const [sizeQty, setSizeQty] = useState<Record<string, string>>(() => {
    if (product?.sizeStocks && Object.keys(product.sizeStocks).length > 0) {
      return Object.fromEntries(
        Object.entries(product.sizeStocks).map(([k, v]) => [k, String(v)])
      );
    }
    return { [ONE_SIZE]: "1" };
  });

  // Brand combobox state
  const [brandInput, setBrandInput] = useState(product?.brand ?? "");
  const [brandOpen, setBrandOpen] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);

  // Merge DB brands with the known brands list, deduplicated and sorted
  const allBrands = Array.from(
    new Set([...KNOWN_BRANDS, ...existingBrands])
  ).sort((a, b) => a.localeCompare(b));

  const filteredBrands = allBrands.filter((b) =>
    b.toLowerCase().includes(brandInput.toLowerCase())
  );
  const showNewOption =
    brandInput.trim() &&
    !allBrands.some(
      (b) => b.toLowerCase() === brandInput.trim().toLowerCase()
    );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) {
        setBrandOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setSizeQty((prev) => {
      const next = { ...prev };
      for (const s of form.sizes) {
        if (next[s] === undefined) next[s] = "1";
      }
      return next;
    });
  }, [form.sizes]);

  function slugify(str: string) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function update(field: string, value: unknown) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "name" && mode === "create") {
        updated.slug = slugify(value as string);
      }
      return updated;
    });
  }

  function toggleSize(size: string) {
    setForm((prev) => ({
      ...prev,
      sizes: prev.sizes.includes(size)
        ? prev.sizes.filter((s) => s !== size)
        : [...prev.sizes, size],
    }));
  }

  function addCustomSize() {
    const trimmed = customSize.trim();
    if (trimmed && !form.sizes.includes(trimmed)) {
      setForm((prev) => ({ ...prev, sizes: [...prev.sizes, trimmed] }));
    }
    setCustomSize("");
  }

  function setSizePrice(size: string, value: string) {
    setSizePricing((prev) => ({ ...prev, [size]: value }));
  }

  function setSizeStockField(size: string, value: string) {
    setSizeQty((prev) => ({ ...prev, [size]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const parsedSizePricing: Record<string, number> = {};
    for (const [size, val] of Object.entries(sizePricing)) {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) parsedSizePricing[size] = num;
    }

    const sizeStocks: Record<string, number> = {};
    if (form.sizes.length === 0) {
      sizeStocks[ONE_SIZE] = Math.max(0, parseInt(sizeQty[ONE_SIZE] || "0", 10) || 0);
    } else {
      for (const s of form.sizes) {
        sizeStocks[s] = Math.max(0, parseInt(sizeQty[s] || "0", 10) || 0);
      }
    }
    const productLevelSum = Object.values(sizeStocks).reduce((a, b) => a + b, 0);

    let variantStockTotal = 0;
    const variantsPayload = variantDrafts
      .filter((v) => v.colorName.trim().length > 0)
      .map((v, idx) => {
        const cleanedStocks: Record<string, number> = {};
        for (const size of v.sizes) {
          const q = Math.max(0, parseInt(v.sizeStocks[size] || "0", 10) || 0);
          cleanedStocks[size] = q;
          variantStockTotal += q;
        }
        return {
          id: v.id ?? null,
          colorName: v.colorName.trim(),
          colorHex: v.colorHex.trim() || null,
          price: v.price.trim() ? parseFloat(v.price) : null,
          displayOrder: idx,
          images: v.images,
          sizes: v.sizes,
          sizeStocks: cleanedStocks,
          etsyUrl: v.etsyUrl.trim() || null,
          etsyCost: v.etsyCost.trim() ? parseFloat(v.etsyCost) : null,
          etsyNote: v.etsyNote.trim() || null,
        };
      });

    const totalQuantity = productLevelSum + variantStockTotal;

    const trimmedEtsyUrl = form.etsyUrl.trim();
    if (trimmedEtsyUrl) {
      try {
        const parsed = new URL(trimmedEtsyUrl);
        if (!parsed.hostname.toLowerCase().includes("etsy.com")) {
          setError("Etsy URL must be an etsy.com link");
          setLoading(false);
          return;
        }
      } catch {
        setError("Etsy URL is not a valid URL");
        setLoading(false);
        return;
      }
    }

    const payload = {
      ...form,
      brand: brandInput.trim(),
      price: parseFloat(form.price),
      quantity: totalQuantity,
      sizePricing:
        Object.keys(parsedSizePricing).length > 0 ? parsedSizePricing : null,
      sizeStocks,
      images,
      variants: variantsPayload,
      etsyUrl: trimmedEtsyUrl || null,
      etsyShop: form.etsyShop.trim() || null,
      etsyCost: form.etsyCost.trim() ? parseFloat(form.etsyCost) : null,
      etsyNote: form.etsyNote.trim() || null,
    };

    try {
      const url =
        mode === "create" ? "/api/products" : `/api/products/${product!.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Full navigation avoids stale prerendered /admin RSC payload (router.refresh
        // can run before the route swap and still show an old product list).
        window.location.assign("/admin");
        return;
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to save product");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const presetSizes =
    form.category === "Lamps"
      ? SIZE_PRESETS.Lighting
      : form.category === "Decor" || form.category === "Cushions"
      ? SIZE_PRESETS.Decor
      : SIZE_PRESETS.Furniture;

  // Live margin readout for the Drop-shipping section.
  const parsedSalePrice = parseFloat(form.price);
  const parsedCost = parseFloat(form.etsyCost);
  const showMargin =
    Number.isFinite(parsedSalePrice) &&
    parsedSalePrice > 0 &&
    Number.isFinite(parsedCost) &&
    parsedCost >= 0;
  const margin = showMargin ? parsedSalePrice - parsedCost : 0;
  const marginPct = showMargin && parsedSalePrice > 0
    ? Math.round((margin / parsedSalePrice) * 100)
    : 0;

  // Etsy URL inline validation (non-blocking warning — server is the source of truth).
  const trimmedEtsyUrl = form.etsyUrl.trim();
  let etsyUrlValid: boolean | null = null;
  if (trimmedEtsyUrl) {
    try {
      const parsed = new URL(trimmedEtsyUrl);
      etsyUrlValid = parsed.hostname.toLowerCase().includes("etsy.com");
    } catch {
      etsyUrlValid = false;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">
      {/* Images */}
      <section>
        <h2 className="text-[11px] uppercase tracking-widest font-bold mb-4">
          Images
        </h2>
        <ImageUploader existingImages={images} onChange={setImages} />
      </section>

      {/* Basic info */}
      <section className="bg-white border border-neutral-200 rounded p-6 space-y-5">
        <h2 className="text-[11px] uppercase tracking-widest font-bold">
          Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Product Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors"
              required
            />
          </div>

          {/* Brand combobox */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Brand *
            </label>
            <div ref={brandRef} className="relative">
              <input
                type="text"
                value={brandInput}
                onChange={(e) => {
                  setBrandInput(e.target.value);
                  setBrandOpen(true);
                }}
                onFocus={() => setBrandOpen(true)}
                placeholder="Type or select a brand..."
                required
                className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors"
              />
              {brandOpen &&
                (filteredBrands.length > 0 || showNewOption) && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-neutral-200 border-t-0 shadow-sm max-h-48 overflow-y-auto">
                    {filteredBrands.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onMouseDown={() => {
                          setBrandInput(b);
                          setBrandOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 text-[13px] hover:bg-neutral-50 transition-colors"
                      >
                        {b}
                      </button>
                    ))}
                    {showNewOption && (
                      <button
                        type="button"
                        onMouseDown={() => {
                          setBrandInput(brandInput.trim());
                          setBrandOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 text-[13px] text-neutral-500 hover:bg-neutral-50 transition-colors border-t border-neutral-100"
                      >
                        + Create &quot;{brandInput.trim()}&quot;
                      </button>
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Slug *
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => update("slug", e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors font-mono"
              required
            />
            <p className="text-[10px] text-neutral-400 mt-1">
              objectsbyhype.com/product/{form.slug}
            </p>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Base Price (USD) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => update("price", e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors"
              required
            />
            <p className="text-[10px] text-neutral-400 mt-1">
              Used when no per-size price is set
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Category *
            </label>
            <select
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors bg-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors bg-white"
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="SOLD">Sold Out</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-start gap-3 cursor-pointer rounded border border-neutral-200 px-4 py-3.5 hover:border-neutral-300 transition-colors">
            <input
              type="checkbox"
              checked={form.consignment}
              onChange={(e) => update("consignment", e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-black focus:ring-1 focus:ring-black focus:ring-offset-0"
            />
            <span>
              <span className="block text-[11px] uppercase tracking-widest font-medium text-black">
                Consignment
              </span>
              <span className="block text-[10px] text-neutral-500 mt-1 leading-relaxed">
                When on, the product page shows a consignment label and
                &ldquo;Pre-owned · Excellent condition&rdquo; for buyers.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer rounded border border-neutral-200 px-4 py-3.5 hover:border-neutral-300 transition-colors">
            <input
              type="checkbox"
              checked={form.madeToOrder}
              onChange={(e) => update("madeToOrder", e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-black focus:ring-1 focus:ring-black focus:ring-offset-0"
            />
            <span>
              <span className="block text-[11px] uppercase tracking-widest font-medium text-black">
                Hand Made to Order
              </span>
              <span className="block text-[10px] text-neutral-500 mt-1 leading-relaxed">
                When on, the product page shows a &ldquo;Hand made to
                order&rdquo; identifier so buyers know it&apos;s crafted
                after purchase.
              </span>
            </span>
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500">
              Description *
            </label>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
            >
              {showPreview ? "Edit" : "Preview"}
            </button>
          </div>
          {showPreview ? (
            <div className="min-h-[140px] w-full border border-neutral-200 bg-neutral-50 px-3 py-2.5 rounded">
              {form.description.trim() ? (
                <ProductDescription text={form.description} />
              ) : (
                <p className="text-[12px] text-neutral-400 italic">
                  Nothing to preview yet.
                </p>
              )}
            </div>
          ) : (
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={6}
              className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors resize-y font-mono"
              placeholder={
                "Soft, hand-tufted wool rug.\n\n- Made in Portugal\n- 100% New Zealand wool\n- **Limited run** — 50 pieces\n\nDouble-line break for a new paragraph."
              }
              required
            />
          )}
          <p className="text-[10px] text-neutral-400 mt-1.5 leading-relaxed">
            Supports basic formatting: <code>**bold**</code>,{" "}
            <code>*italic*</code>, <code>- bullet</code>, <code>1. numbered</code>
            , blank line for paragraph break. Use the Preview button to check
            how it&apos;ll look.
          </p>
        </div>
      </section>

      {/* Drop-shipping (Etsy) — collapsible, admin-only */}
      <section className="bg-white border border-neutral-200 rounded">
        <details
          open={Boolean(
            form.etsyUrl || form.etsyShop || form.etsyCost || form.etsyNote
          )}
          className="group"
        >
          <summary className="list-none cursor-pointer flex items-center justify-between px-6 py-4 select-none">
            <div>
              <h2 className="text-[11px] uppercase tracking-widest font-bold">
                Drop-shipping (Etsy)
              </h2>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Optional. Paste the Etsy listing you re-order from when this
                product sells. Admin-only — never shown to buyers.
              </p>
            </div>
            <span className="text-[11px] uppercase tracking-widest text-neutral-500 ml-3 shrink-0">
              <span className="group-open:hidden">Open</span>
              <span className="hidden group-open:inline">Close</span>
            </span>
          </summary>

          <div className="px-6 pb-6 pt-2 space-y-5">
            <div>
              <label
                htmlFor="etsy-url"
                className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2"
              >
                Etsy listing URL
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="etsy-url"
                  type="url"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={form.etsyUrl}
                  onChange={(e) => update("etsyUrl", e.target.value)}
                  placeholder="https://www.etsy.com/listing/1234567890/..."
                  className="flex-1 min-w-0 border border-neutral-300 px-3 py-3 text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors"
                />
                {etsyUrlValid ? (
                  <a
                    href={trimmedEtsyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center min-h-[44px] px-4 text-[11px] uppercase tracking-widest border border-black bg-white hover:bg-black hover:text-white transition-colors whitespace-nowrap"
                  >
                    Open listing ↗
                  </a>
                ) : (
                  <span className="hidden sm:inline-flex items-center justify-center min-h-[44px] px-4 text-[11px] uppercase tracking-widest border border-neutral-200 text-neutral-300 whitespace-nowrap select-none">
                    Open listing ↗
                  </span>
                )}
              </div>
              {etsyUrlValid === false && (
                <p className="text-[11px] text-red-600 mt-1.5">
                  This doesn&apos;t look like an etsy.com URL.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="etsy-shop"
                  className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2"
                >
                  Etsy shop name
                </label>
                <input
                  id="etsy-shop"
                  type="text"
                  value={form.etsyShop}
                  onChange={(e) => update("etsyShop", e.target.value)}
                  placeholder="e.g. SunsetCeramicsCo"
                  className="w-full border border-neutral-300 px-3 py-3 text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors"
                />
              </div>
              <div>
                <label
                  htmlFor="etsy-cost"
                  className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2"
                >
                  Your cost on Etsy (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-neutral-400 pointer-events-none">
                    $
                  </span>
                  <input
                    id="etsy-cost"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={form.etsyCost}
                    onChange={(e) => update("etsyCost", e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-neutral-300 pl-7 pr-3 py-3 text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors"
                  />
                </div>
                {showMargin && (
                  <p
                    className={`text-[11px] mt-1.5 ${
                      margin >= 0 ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    Margin: ${margin.toFixed(2)}{" "}
                    <span className="text-neutral-400">({marginPct}%)</span>
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="etsy-note"
                className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2"
              >
                Note to paste at Etsy checkout
              </label>
              <textarea
                id="etsy-note"
                value={form.etsyNote}
                onChange={(e) => update("etsyNote", e.target.value)}
                rows={3}
                placeholder={"e.g. Color: Sand, Size: 24x36\nNo personalization."}
                className="w-full border border-neutral-300 px-3 py-2.5 text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors resize-y font-mono"
              />
              <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
                One-tap copy of this text appears next to the &ldquo;Order on
                Etsy&rdquo; button on each order so you can paste it straight
                into the listing&apos;s personalization field.
              </p>
            </div>
          </div>
        </details>
      </section>

      {/* Sizes + per-size pricing */}
      <section className="bg-white border border-neutral-200 rounded p-6">
        <h2 className="text-[11px] uppercase tracking-widest font-bold mb-4">
          Sizes & Pricing
        </h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {presetSizes.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => toggleSize(size)}
              className={`px-3 py-2 text-[11px] uppercase tracking-widest border transition-colors ${
                form.sizes.includes(size)
                  ? "bg-black text-white border-black"
                  : "border-neutral-300 hover:border-black"
              }`}
            >
              {size}
            </button>
          ))}
        </div>

        {/* Custom size */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={customSize}
            onChange={(e) => setCustomSize(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomSize();
              }
            }}
            placeholder="Custom size..."
            className="border border-neutral-300 px-3 py-2 text-[12px] focus:outline-none focus:border-black transition-colors w-36"
          />
          <button
            type="button"
            onClick={addCustomSize}
            className="border border-neutral-300 px-3 py-2 text-[11px] uppercase tracking-widest hover:border-black transition-colors"
          >
            Add
          </button>
        </div>

        {/* One-size (OS) when no sizes selected */}
        {form.sizes.length === 0 && (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Stock (single size — sold as one SKU)
            </p>
            <input
              type="number"
              min="0"
              value={sizeQty[ONE_SIZE] ?? "0"}
              onChange={(e) => setSizeStockField(ONE_SIZE, e.target.value)}
              className="w-32 border border-neutral-300 px-3 py-2 text-[13px] focus:outline-none focus:border-black transition-colors"
            />
          </div>
        )}

        {/* Per-size price + stock */}
        {form.sizes.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
              Per-size price (blank = base) and stock count
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {form.sizes.map((size) => (
                <div
                  key={size}
                  className="border border-neutral-100 rounded p-3 space-y-2"
                >
                  <p className="text-[11px] font-medium uppercase tracking-widest">
                    {size}
                  </p>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-neutral-400 mb-1">
                      Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-neutral-400">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={sizePricing[size] ?? ""}
                        onChange={(e) => setSizePrice(size, e.target.value)}
                        placeholder={form.price || "-"}
                        className="w-full border border-neutral-300 pl-6 pr-3 py-2 text-[13px] focus:outline-none focus:border-black transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-neutral-400 mb-1">
                      Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={sizeQty[size] ?? "0"}
                      onChange={(e) => setSizeStockField(size, e.target.value)}
                      className="w-full border border-neutral-300 px-3 py-2 text-[13px] focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Color variants */}
      <section className="bg-white border border-neutral-200 rounded p-6">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-[11px] uppercase tracking-widest font-bold">
            Color Variants
          </h2>
        </div>
        <p className="text-[11px] text-neutral-500 mb-4 leading-relaxed">
          Add color options with their own images, sizes, stock, and optional
          price override. When variants are present they replace the
          default images and stock on the storefront. Leave empty for a
          single-configuration product.
        </p>
        <VariantEditor
          presetSizes={presetSizes}
          initialVariants={variantDrafts}
          onChange={setVariantDrafts}
        />
      </section>

      {error && <p className="text-[12px] text-red-500">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white text-[11px] uppercase tracking-widest px-8 py-3.5 hover:bg-neutral-800 transition-colors disabled:bg-neutral-400"
        >
          {loading
            ? "Saving..."
            : mode === "create"
            ? "Create Product"
            : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
