/** Curated homepage imagery (static assets under /public/objectsbyhype_images). */

export type CuratedSpaceItem = {
  src: string;
  alt: string;
  /** Tailwind grid span classes for md+ */
  className?: string;
};

export const CURATED_SPACE_ITEMS: CuratedSpaceItem[] = [
  // Former category hero photos
  {
    src: "/objectsbyhype_images/037b23a4a8083da4f4ef166c8e2cace1.jpg",
    alt: "Curated interior — carpets and texture",
    className: "md:col-span-2 md:row-span-2",
  },
  {
    src: "/objectsbyhype_images/c5b15ffe2698740b1e6a3cbdba7bc074.jpg",
    alt: "Curated interior — cushions and soft forms",
  },
  {
    src: "/objectsbyhype_images/98ad6a19f0eb4bc102adf96ededd9072.jpg",
    alt: "Curated interior — lighting",
  },
  {
    src: "/objectsbyhype_images/3b713453ec591d795b66f2d3e75e1bf2.jpg",
    alt: "Curated interior — seating",
  },
  {
    src: "/objectsbyhype_images/7fcaf64bd28f2c7623a97e8e34144992.jpg",
    alt: "Curated interior — tables",
    className: "md:col-span-2",
  },
  {
    src: "/objectsbyhype_images/e609a34b5a107b660f1deb08b07865a9.jpg",
    alt: "Curated interior — decor",
  },
  // Editorial picks
  {
    src: "/objectsbyhype_images/111d8e13c2a0849202a060351e11a234.webp",
    alt: "Objectsbyhype home edit — living space",
  },
  {
    src: "/objectsbyhype_images/1a75bda195208a54615696db095e8a32.jpg",
    alt: "Objectsbyhype home edit — surfaces",
  },
  {
    src: "/objectsbyhype_images/d9e9530052e73a8a617ee58b47056869.jpg",
    alt: "Objectsbyhype home edit — lounge",
  },
  {
    src: "/objectsbyhype_images/2d4926af83d08f296b0a5b858feb20e2.webp",
    alt: "Objectsbyhype home edit — textiles",
  },
  {
    src: "/objectsbyhype_images/efaa6be4f5c54d6cd1e1a617d1f11954.webp",
    alt: "Objectsbyhype home edit — shelving",
  },
];
