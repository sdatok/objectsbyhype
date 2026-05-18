"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ImageUploader, { type UploadedImage } from "./ImageUploader";

export interface VariantDraft {
  id?: string | null;
  colorName: string;
  colorHex: string;
  price: string; // input value; "" = no override
  images: UploadedImage[];
  sizes: string[];
  /** size -> stock count as string for the input */
  sizeStocks: Record<string, string>;
}

export function makeEmptyVariant(): VariantDraft {
  return {
    id: null,
    colorName: "",
    colorHex: "",
    price: "",
    images: [],
    sizes: [],
    sizeStocks: {},
  };
}

interface VariantEditorProps {
  presetSizes: string[];
  initialVariants?: VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
}

export default function VariantEditor({
  presetSizes,
  initialVariants = [],
  onChange,
}: VariantEditorProps) {
  const [variants, setVariants] = useState<VariantDraft[]>(initialVariants);
  const [openIndex, setOpenIndex] = useState<number | null>(
    initialVariants.length > 0 ? 0 : null
  );
  /** Per-variant draft text for the "custom size" input */
  const [customSize, setCustomSize] = useState<Record<number, string>>({});
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    onChangeRef.current(variants);
  }, [variants]);

  function updateAt(idx: number, patch: Partial<VariantDraft>) {
    setVariants((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, ...patch } : v))
    );
  }

  function addVariant() {
    setVariants((prev) => {
      const next = [...prev, makeEmptyVariant()];
      setOpenIndex(next.length - 1);
      return next;
    });
  }

  function removeVariant(idx: number) {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
    setOpenIndex(null);
  }

  function toggleSize(idx: number, size: string) {
    setVariants((prev) =>
      prev.map((v, i) => {
        if (i !== idx) return v;
        const has = v.sizes.includes(size);
        const sizes = has
          ? v.sizes.filter((s) => s !== size)
          : [...v.sizes, size];
        const sizeStocks = { ...v.sizeStocks };
        if (has) {
          delete sizeStocks[size];
        } else if (sizeStocks[size] === undefined) {
          sizeStocks[size] = "1";
        }
        return { ...v, sizes, sizeStocks };
      })
    );
  }

  function setSizeStock(idx: number, size: string, value: string) {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === idx
          ? { ...v, sizeStocks: { ...v.sizeStocks, [size]: value } }
          : v
      )
    );
  }

  function addCustomSize(idx: number) {
    const raw = customSize[idx] ?? "";
    const trimmed = raw.trim();
    if (!trimmed) return;
    setVariants((prev) =>
      prev.map((v, i) => {
        if (i !== idx) return v;
        if (v.sizes.includes(trimmed)) return v;
        return {
          ...v,
          sizes: [...v.sizes, trimmed],
          sizeStocks: { ...v.sizeStocks, [trimmed]: v.sizeStocks[trimmed] ?? "1" },
        };
      })
    );
    setCustomSize((prev) => ({ ...prev, [idx]: "" }));
  }

  function removeSize(idx: number, size: string) {
    setVariants((prev) =>
      prev.map((v, i) => {
        if (i !== idx) return v;
        const sizeStocks = { ...v.sizeStocks };
        delete sizeStocks[size];
        return {
          ...v,
          sizes: v.sizes.filter((s) => s !== size),
          sizeStocks,
        };
      })
    );
  }

  return (
    <div className="space-y-4">
      {variants.length === 0 && (
        <p className="text-[12px] text-neutral-500 leading-relaxed">
          No color variants yet. Without variants, this product is sold as a
          single configuration using the images, sizes, and stock above.
        </p>
      )}

      {variants.map((v, idx) => {
        const isOpen = openIndex === idx;
        const swatchStyle = v.colorHex
          ? { backgroundColor: v.colorHex }
          : undefined;
        return (
          <div
            key={v.id ?? `new-${idx}`}
            className="border border-neutral-200 rounded"
          >
            {/* Header */}
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  style={swatchStyle}
                  className={`inline-block h-5 w-5 rounded-full border ${
                    v.colorHex
                      ? "border-neutral-300"
                      : "border-neutral-300 bg-neutral-100"
                  }`}
                />
                <span className="text-[13px] font-medium">
                  {v.colorName || (
                    <span className="text-neutral-400 italic">
                      Untitled variant
                    </span>
                  )}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-neutral-400">
                  {v.images.length} image{v.images.length === 1 ? "" : "s"} ·{" "}
                  {v.sizes.length} size{v.sizes.length === 1 ? "" : "s"}
                </span>
              </div>
              <span className="text-[11px] uppercase tracking-widest text-neutral-500">
                {isOpen ? "Close" : "Edit"}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-neutral-200 p-4 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_140px] gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                      Color Name *
                    </label>
                    <input
                      type="text"
                      value={v.colorName}
                      onChange={(e) =>
                        updateAt(idx, { colorName: e.target.value })
                      }
                      placeholder="Cream"
                      className="w-full border border-neutral-300 px-3 py-2 text-[13px] focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                      Hex
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={v.colorHex || "#cccccc"}
                        onChange={(e) =>
                          updateAt(idx, { colorHex: e.target.value })
                        }
                        className="h-9 w-9 border border-neutral-300 cursor-pointer p-0.5 rounded"
                      />
                      <input
                        type="text"
                        value={v.colorHex}
                        onChange={(e) =>
                          updateAt(idx, { colorHex: e.target.value })
                        }
                        placeholder="#ECE5D4"
                        className="flex-1 min-w-0 border border-neutral-300 px-2 py-2 text-[12px] font-mono focus:outline-none focus:border-black transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                      Price ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={v.price}
                      onChange={(e) =>
                        updateAt(idx, { price: e.target.value })
                      }
                      placeholder="Base"
                      className="w-full border border-neutral-300 px-3 py-2 text-[13px] focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                    Images for this color
                  </p>
                  <ImageUploader
                    existingImages={v.images}
                    onChange={(images) => updateAt(idx, { images })}
                  />
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                    Sizes for this color
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {presetSizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleSize(idx, size)}
                        className={`px-3 py-1.5 text-[11px] uppercase tracking-widest border transition-colors ${
                          v.sizes.includes(size)
                            ? "bg-black text-white border-black"
                            : "border-neutral-300 hover:border-black"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>

                  {/* Custom size input — e.g. "32 x 45" for rugs */}
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={customSize[idx] ?? ""}
                      onChange={(e) =>
                        setCustomSize((prev) => ({
                          ...prev,
                          [idx]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomSize(idx);
                        }
                      }}
                      placeholder='Custom size, e.g. 32" x 45"'
                      className="flex-1 min-w-0 border border-neutral-300 px-3 py-2 text-[12px] focus:outline-none focus:border-black transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => addCustomSize(idx)}
                      className="border border-neutral-300 px-3 py-2 text-[11px] uppercase tracking-widest hover:border-black transition-colors whitespace-nowrap"
                    >
                      Add
                    </button>
                  </div>

                  {v.sizes.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {v.sizes.map((size) => (
                        <div
                          key={size}
                          className="border border-neutral-100 rounded p-3"
                        >
                          <div className="flex items-start justify-between mb-2 gap-2">
                            <p className="text-[11px] font-medium uppercase tracking-widest break-words leading-snug">
                              {size}
                            </p>
                            <button
                              type="button"
                              onClick={() => removeSize(idx, size)}
                              title="Remove size"
                              aria-label={`Remove size ${size}`}
                              className="shrink-0 text-[14px] leading-none text-neutral-400 hover:text-red-600 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                          <label className="block text-[9px] uppercase tracking-widest text-neutral-400 mb-1">
                            Stock
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={v.sizeStocks[size] ?? "0"}
                            onChange={(e) =>
                              setSizeStock(idx, size, e.target.value)
                            }
                            className="w-full border border-neutral-300 px-3 py-2 text-[13px] focus:outline-none focus:border-black transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => removeVariant(idx)}
                    className="text-[11px] uppercase tracking-widest text-red-600 hover:text-red-800 transition-colors"
                  >
                    Remove this color
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addVariant}
        className="w-full border border-dashed border-neutral-300 hover:border-black rounded py-3 text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
      >
        + Add color variant
      </button>
    </div>
  );
}
