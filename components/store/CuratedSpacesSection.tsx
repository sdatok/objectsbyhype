"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CURATED_SPACE_ITEMS } from "@/lib/curated-spaces";

export default function CuratedSpacesSection({
  excludeSrc,
}: {
  excludeSrc?: string;
} = {}) {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null
  );

  const items = useMemo(
    () =>
      excludeSrc
        ? CURATED_SPACE_ITEMS.filter((item) => item.src !== excludeSrc)
        : CURATED_SPACE_ITEMS,
    [excludeSrc]
  );

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setLightbox(null);
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [lightbox, onKeyDown]);

  return (
    <section className="bg-white">
      <div className="max-w-[1600px] mx-auto px-4 py-12 md:py-20">
        <div className="mb-8 md:mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">
              Lookbook
            </p>
            <h2 className="text-[20px] md:text-[26px] font-light tracking-tight mt-2">
              Curated Spaces
            </h2>
          </div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Tap an image to expand
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[150px] sm:auto-rows-[180px] md:auto-rows-[220px] gap-2 md:gap-3">
          {items.map((item) => (
            <button
              key={item.src}
              type="button"
              onClick={() => setLightbox({ src: item.src, alt: item.alt })}
              className={`group relative overflow-hidden bg-neutral-50 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${item.className ?? ""}`}
              aria-label={`Open larger view: ${item.alt}`}
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                unoptimized
              />
            </button>
          ))}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/88 p-4"
          role="presentation"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-[11px] uppercase tracking-widest hover:opacity-80"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            Close
          </button>
          <div
            className="relative w-full max-w-5xl aspect-[4/3] max-h-[85vh]"
            role="dialog"
            aria-modal="true"
            aria-label={lightbox.alt}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightbox.src}
              alt={lightbox.alt}
              fill
              className="object-contain"
              sizes="100vw"
              priority
              unoptimized
            />
          </div>
        </div>
      )}
    </section>
  );
}
