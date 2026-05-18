import Image from "next/image";
import Link from "next/link";

/**
 * Clickable hero-style banner promoting the Wall Display collection.
 * Sits between the product grid and Curated Spaces on the homepage.
 */
export default function WallDisplayPromo() {
  return (
    <section aria-label="Wall Display collection" className="bg-white">
      <div className="max-w-[1600px] mx-auto px-4 py-12 md:py-20">
        <div className="mb-8 md:mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">
              Collection
            </p>
            <h2 className="text-[20px] md:text-[26px] font-light tracking-tight mt-2">
              Wall Display
            </h2>
            <p className="text-[11px] text-neutral-500 mt-1.5">
              Handcrafted accessories, made to be hung.
            </p>
          </div>
          <Link
            href="/wall-display"
            className="group hidden sm:inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-neutral-500 hover:text-black transition-colors"
          >
            <span>Shop the collection</span>
            <span
              aria-hidden
              className="inline-block transition-transform duration-200 group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>

        <Link
          href="/wall-display"
          aria-label="Shop the Wall Display collection"
          className="group relative block overflow-hidden bg-black"
        >
          <div className="relative w-full aspect-[4/5] sm:aspect-[16/10] md:aspect-[21/10] max-h-[720px]">
            <Image
              src="/objectsbyhype_images/wall-display.png"
              alt="Objectsbyhype wall display — handcrafted accessories"
              fill
              priority={false}
              unoptimized
              sizes="(max-width: 1600px) 100vw, 1600px"
              className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
            />
          </div>
        </Link>

        <div className="mt-5 flex justify-center sm:hidden">
          <Link
            href="/wall-display"
            className="group inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-neutral-500 hover:text-black transition-colors"
          >
            <span>Shop the collection</span>
            <span
              aria-hidden
              className="inline-block transition-transform duration-200 group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
