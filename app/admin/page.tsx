import Link from "next/link";
import { prisma } from "@/lib/db";
import AdminProductTable from "@/components/admin/AdminProductTable";
import { toStoreProduct } from "@/lib/map-product";

export const dynamic = "force-dynamic";

async function getAllProducts() {
  try {
    const products = await prisma.product.findMany({
      include: {
        images: { orderBy: { displayOrder: "asc" }, take: 1 },
        sizeStocks: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return products.map((p) => toStoreProduct(p));
  } catch (err) {
    console.error("[getAllProducts admin]", err);
    return [];
  }
}

export default async function AdminPage() {
  const products = await getAllProducts();

  const counts = {
    total: products.length,
    active: products.filter((p) => p.status === "ACTIVE").length,
    draft: products.filter((p) => p.status === "DRAFT").length,
    sold: products.filter((p) => p.status === "SOLD").length,
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[18px] font-bold">Products</h1>
          <p className="text-[12px] text-neutral-500 mt-0.5">
            {counts.total} total · {counts.active} active · {counts.draft} draft ·{" "}
            {counts.sold} sold
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="bg-black text-white text-[11px] uppercase tracking-widest px-5 py-2.5 hover:bg-neutral-800 transition-colors"
        >
          + Add Product
        </Link>
      </div>

      {/* Table */}
      <AdminProductTable products={products} />
    </div>
  );
}
