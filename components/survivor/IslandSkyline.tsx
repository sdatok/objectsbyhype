"use client";

import Image from "next/image";

/** Vendor towers left → right; internet-money is the featured center spire. */
const BUILDINGS = [
  { id: "tomy", src: "/survivor/buildings/tomy.png", alt: "TOMY tower" },
  { id: "kt-corp", src: "/survivor/buildings/kt-corp.png", alt: "K-T Corp tower" },
  {
    id: "6horizonllc",
    src: "/survivor/buildings/6horizonllc.png",
    alt: "6HorizonLLC tower",
  },
  { id: "src", src: "/survivor/buildings/src.png", alt: "SRC tower" },
  {
    id: "internet-money",
    src: "/survivor/buildings/internet-money.png",
    alt: "Internet Money tower",
    featured: true,
  },
  {
    id: "pax-ecommerce",
    src: "/survivor/buildings/pax-ecommerce.png",
    alt: "Pax Ecommerce tower",
  },
  { id: "goat", src: "/survivor/buildings/goat.png", alt: "GOAT tower" },
  {
    id: "gus-supply",
    src: "/survivor/buildings/gus-supply.png",
    alt: "Gus Supply tower",
  },
  {
    id: "dan-sporting",
    src: "/survivor/buildings/dan-sporting.png",
    alt: "Dan Sporting tower",
  },
  { id: "ror-sply", src: "/survivor/buildings/ror-sply.png", alt: "ROR Sply tower" },
] as const;

/**
 * Pixel-art vendor island — sand disc + ocean like the in-game arena, with
 * individual building sprites anchored on the beach. Internet Money is tallest
 * in the center so nothing gets cropped off a wide poster.
 */
export default function IslandSkyline() {
  return (
    <div
      aria-hidden
      className="relative w-full shrink-0 h-[34vh] min-h-[200px] max-h-[380px] sm:h-[40vh] sm:max-h-[440px] overflow-hidden"
    >
      {/* Ocean */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #0a2a4a 0%, #0c4a6e 35%, #0e7490 70%, #082f49 100%)",
        }}
      />

      {/* Gentle wave bands */}
      <div
        className="absolute inset-x-0 top-[18%] h-8 opacity-25"
        style={{
          background:
            "repeating-linear-gradient(90deg, transparent 0, transparent 24px, rgba(255,255,255,0.12) 24px, rgba(255,255,255,0.12) 48px)",
        }}
      />
      <div
        className="absolute inset-x-0 top-[32%] h-6 opacity-15"
        style={{
          background:
            "repeating-linear-gradient(90deg, transparent 0, transparent 18px, rgba(255,255,255,0.1) 18px, rgba(255,255,255,0.1) 36px)",
        }}
      />

      {/* Sand island — matches in-game beach palette */}
      <div
        className="absolute left-1/2 bottom-[8%] -translate-x-1/2 w-[min(98vw,920px)] h-[42%] rounded-[50%]"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% 55%, #f5e6c8 0%, #e8c992 42%, #d4a96a 72%, #c49558 100%)",
          boxShadow:
            "0 0 0 3px rgba(196,149,88,0.35), 0 12px 40px rgba(0,0,0,0.35)",
        }}
      />
      {/* Wet sand ring */}
      <div
        className="absolute left-1/2 bottom-[8%] -translate-x-1/2 w-[min(96vw,900px)] h-[38%] rounded-[50%] opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% 100%, rgba(14,116,144,0.45), transparent 62%)",
        }}
      />

      {/* Palm hints */}
      <div className="absolute bottom-[22%] left-[8%] w-3 h-8 bg-emerald-900/80 rounded-sm opacity-70" />
      <div className="absolute bottom-[24%] left-[9%] w-6 h-3 bg-emerald-600/60 rounded-full -rotate-12" />
      <div className="absolute bottom-[20%] right-[7%] w-3 h-7 bg-emerald-900/80 rounded-sm opacity-70" />
      <div className="absolute bottom-[22%] right-[8%] w-5 h-3 bg-emerald-600/60 rounded-full rotate-12" />

      {/* Building row — bottoms aligned on the sand; scale down on narrow screens */}
      <div className="absolute inset-x-0 bottom-[6%] flex justify-center overflow-visible pointer-events-none">
        <div className="flex items-end justify-center origin-bottom scale-[0.58] sm:scale-[0.78] md:scale-100 -space-x-3 sm:-space-x-4">
          {BUILDINGS.map((b) => {
            const featured = "featured" in b && b.featured;
            return (
              <div
                key={b.id}
                className={`relative shrink-0 ${
                  featured
                    ? "z-20 h-[280px] sm:h-[320px] w-[72px] sm:w-[88px]"
                    : "z-10 h-[210px] sm:h-[250px] w-[56px] sm:w-[68px]"
                }`}
              >
                <Image
                  src={b.src}
                  alt=""
                  fill
                  sizes={featured ? "88px" : "68px"}
                  className="object-contain object-bottom drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]"
                  style={{ imageRendering: "pixelated" }}
                  priority={featured}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Shore foam */}
      <div
        className="absolute inset-x-0 bottom-0 h-10 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent, rgba(14,116,144,0.35) 40%, rgba(8,47,73,0.65))",
        }}
      />
    </div>
  );
}
