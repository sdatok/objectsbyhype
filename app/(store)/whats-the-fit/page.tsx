import { prisma } from "@/lib/db";
import { sortWithFeaturedBias } from "@/lib/shuffle";

export const metadata = {
  title: "WTF - OBJECTSBYHYPE",
  description: "Community fit pics, curated at OBJECTSBYHYPE.",
};

export const dynamic = "force-dynamic";

export default async function WhatsTheFitPage() {
  const rows = await prisma.wtfImage.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const images = sortWithFeaturedBias(rows);

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-10 md:py-14 bg-white">
      <div className="max-w-2xl mx-auto mb-10 md:mb-12 text-center">
        <h1 className="text-[32px] md:text-[48px] font-black uppercase tracking-tight leading-none mb-3">
          WTF
        </h1>
        <p className="text-[11px] uppercase tracking-widest text-neutral-400 mb-4">
          What&apos;s The Fit?
        </p>
        <p className="text-[13px] text-neutral-500 leading-relaxed">
          Community fit pics, curated at OBJECTSBYHYPE.
        </p>
      </div>
      {images.length === 0 ? (
        <p className="text-center text-[12px] text-neutral-400 uppercase tracking-widest py-20">
          Coming soon.
        </p>
      ) : (
        <div className="columns-2 md:columns-4 gap-3 md:gap-4 space-y-3 md:space-y-4">
          {images.map((img) => (
            <figure
              key={img.id}
              className="break-inside-avoid mb-3 md:mb-4 overflow-hidden bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                className="w-full h-auto block align-middle"
                loading="lazy"
                decoding="async"
              />
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
