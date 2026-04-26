import Link from "next/link";
import Image from "next/image";

type CategoryTile = {
  label: string;
  href: string;
  imageUrl: string;
};

const CATEGORY_TILES: CategoryTile[] = [
  {
    label: "Carpets",
    href: "/shop?category=Carpets",
    imageUrl: "/objectsbyhype_images/037b23a4a8083da4f4ef166c8e2cace1.jpg",
  },
  {
    label: "Cushions",
    href: "/shop?category=Cushions",
    imageUrl: "/objectsbyhype_images/c5b15ffe2698740b1e6a3cbdba7bc074.jpg",
  },
  {
    label: "Lamps",
    href: "/shop?category=Lamps",
    imageUrl: "/objectsbyhype_images/98ad6a19f0eb4bc102adf96ededd9072.jpg",
  },
  {
    label: "Chairs",
    href: "/shop?category=Chairs",
    imageUrl: "/objectsbyhype_images/3b713453ec591d795b66f2d3e75e1bf2.jpg",
  },
  {
    label: "Tables",
    href: "/shop?category=Tables",
    imageUrl: "/objectsbyhype_images/7fcaf64bd28f2c7623a97e8e34144992.jpg",
  },
  {
    label: "Decor",
    href: "/shop?category=Decor",
    imageUrl: "/objectsbyhype_images/e609a34b5a107b660f1deb08b07865a9.jpg",
  },
];

export default function CategoryHeaderGrid() {
  return (
    <section className="border-b border-neutral-200">
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-[24px] md:text-[40px] font-black uppercase tracking-[-0.02em] leading-none">
              OBJECTSBYHYPE
            </h1>
            <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-neutral-500">
              Designer furniture and hype home objects
            </p>
          </div>
          <Link
            href="/shop"
            className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
          >
            View all products
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORY_TILES.map((tile) => (
            <Link
              key={tile.label}
              href={tile.href}
              className="group relative h-[220px] md:h-[260px] overflow-hidden border border-neutral-200"
            >
              <Image
                src={tile.imageUrl}
                alt={tile.label}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/45" />
              <div className="absolute inset-0 p-5 flex items-end">
                <span className="text-white text-[11px] md:text-[12px] uppercase tracking-[0.2em] font-semibold">
                  {tile.label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
