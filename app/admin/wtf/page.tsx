import { prisma } from "@/lib/db";
import WtfImageManager from "@/components/admin/WtfImageManager";

export const dynamic = "force-dynamic";

export default async function AdminWtfPage() {
  const images = await prisma.wtfImage.findMany({
    orderBy: { displayOrder: "asc" },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[18px] font-bold">What&apos;s The Fit</h1>
        <p className="text-[12px] text-neutral-500 mt-0.5 max-w-2xl">
          Upload community fit pics for the public{" "}
          <a
            href="/whats-the-fit"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-black"
          >
            WTF
          </a>{" "}
          page. Order below is for your reference; the live page shuffles on every visit.
          Star favourites: they get a light bias upward but stay mixed in so the wall doesn&apos;t
          look like a block of stars on top.
        </p>
      </div>

      <WtfImageManager
        initialImages={images.map((i) => ({
          id: i.id,
          url: i.url,
          displayOrder: i.displayOrder,
          featured: i.featured,
        }))}
      />
    </div>
  );
}
