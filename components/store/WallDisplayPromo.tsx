import Image from "next/image";
import Link from "next/link";

/**
 * Clickable hero-style banner promoting the Wall Display collection.
 * Sits between the product grid and Curated Spaces on the homepage.
 */
export default function WallDisplayPromo() {
  return (
    <section aria-label="Wall Display collection" className="bg-white">
      <div className="max-w-[1600px] mx-auto px-4 py-14 md:py-20 text-center">
        <p className="text-[10px] uppercase tracking-[0.32em] text-neutral-400">
          Collection
        </p>

        <h2 className="mt-3 text-black font-black uppercase tracking-[0.18em] md:tracking-[0.22em] leading-[0.95] text-[28px] sm:text-[40px] md:text-[56px] lg:text-[68px]">
          <span className="block">Wall</span>
          <span className="block">Display</span>
        </h2>

        <p className="mt-5 text-[11px] sm:text-[12px] text-neutral-500 tracking-wide">
          Handcrafted accessories, made to be hung.
        </p>

        <div className="mt-8 md:mt-10">
          <Link
            href="/wall-display"
            aria-label="Shop the Wall Display collection"
            className="group relative block overflow-hidden bg-black mx-auto w-full max-w-[720px] rounded-2xl md:rounded-3xl shadow-sm"
          >
            {/* Crop the source 4:5 portrait into a square so we keep the
                sconce + cross grid (object-top) and drop the in-image
                caption strip at the bottom. */}
            <div className="relative w-full aspect-square">
              <Image
                src="/objectsbyhype_images/wall-display.png"
                alt="Objectsbyhype wall display — handcrafted accessories"
                fill
                priority={false}
                unoptimized
                sizes="(max-width: 720px) 100vw, 720px"
                className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              />
            </div>
          </Link>
        </div>

        <div className="mt-7">
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
