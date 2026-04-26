import Image from "next/image";

const GALLERY_ITEMS = [
  {
    src: "/objectsbyhype_images/111d8e13c2a0849202a060351e11a234.webp",
    alt: "Designer living room with modern furniture accents",
    className: "md:col-span-2 md:row-span-2",
  },
  {
    src: "/objectsbyhype_images/1a75bda195208a54615696db095e8a32.jpg",
    alt: "Statement coffee table and decor styling",
    className: "",
  },
  {
    src: "/objectsbyhype_images/d9e9530052e73a8a617ee58b47056869.jpg",
    alt: "Warm ambient lamp and chair composition",
    className: "",
  },
  {
    src: "/objectsbyhype_images/2d4926af83d08f296b0a5b858feb20e2.webp",
    alt: "Textured cushion and fabric detail close-up",
    className: "md:col-span-2",
  },
  {
    src: "/objectsbyhype_images/efaa6be4f5c54d6cd1e1a617d1f11954.webp",
    alt: "Contemporary shelf styling for minimalist spaces",
    className: "",
  },
];

export default function HomeEditorialGallery() {
  return (
    <section className="border-b border-neutral-200">
      <div className="max-w-[1400px] mx-auto px-4 py-8 md:py-12">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-[11px] uppercase tracking-widest font-bold">
            Curated Spaces
          </h2>
          <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            Objectsbyhype Home Edit
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[190px] gap-3 md:gap-4">
          {GALLERY_ITEMS.map((item) => (
            <div
              key={item.src}
              className={`relative overflow-hidden border border-neutral-200 ${item.className}`}
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="(max-width: 768px) 100vw, 25vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
