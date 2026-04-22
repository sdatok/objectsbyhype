import Link from "next/link";

type CategoryTile = {
  label: string;
  href: string;
  imageUrl: string;
};

const CATEGORY_TILES: CategoryTile[] = [
  {
    label: "Carpets",
    href: "/shop?category=Carpets",
    imageUrl:
      "https://images.unsplash.com/photo-1575414003591-ece8d0416c7a?auto=format&fit=crop&w=1600&q=80",
  },
  {
    label: "Cushions",
    href: "/shop?category=Cushions",
    imageUrl:
      "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1600&q=80",
  },
  {
    label: "Lamps",
    href: "/shop?category=Lamps",
    imageUrl:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80",
  },
  {
    label: "Chairs",
    href: "/shop?category=Chairs",
    imageUrl:
      "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1600&q=80",
  },
  {
    label: "Tables",
    href: "/shop?category=Tables",
    imageUrl:
      "https://images.unsplash.com/photo-1538688423619-a81d3f23454b?auto=format&fit=crop&w=1600&q=80",
  },
  {
    label: "Decor",
    href: "/shop?category=Decor",
    imageUrl:
      "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1600&q=80",
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
              <img
                src={tile.imageUrl}
                alt={tile.label}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
