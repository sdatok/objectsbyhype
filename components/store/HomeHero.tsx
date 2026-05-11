import Image from "next/image";

export default function HomeHero({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <section
      aria-label="Featured space"
      className="relative w-full bg-neutral-50"
    >
      <div className="relative w-full h-[260px] sm:h-[340px] md:h-[420px] lg:h-[520px] overflow-hidden">
        <Image
          src={src}
          alt={alt}
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/40" />
        <div className="absolute inset-x-0 bottom-0 px-5 sm:px-8 md:px-12 pb-5 md:pb-8">
          <div className="max-w-[1600px] mx-auto flex flex-col gap-2">
            <p className="text-white/85 text-[10px] sm:text-[11px] uppercase tracking-[0.32em]">
              Home Edit
            </p>
            <h1 className="text-white text-[22px] sm:text-[28px] md:text-[36px] lg:text-[44px] font-light leading-[1.05] tracking-[-0.01em] max-w-[640px]">
              Designer furniture, curated.
            </h1>
          </div>
        </div>
      </div>
    </section>
  );
}
