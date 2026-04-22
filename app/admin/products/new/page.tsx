import Link from "next/link";
import { prisma } from "@/lib/db";
import ProductForm from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

async function getBrands(): Promise<string[]> {
  try {
    const brands = await prisma.product.findMany({
      select: { brand: true },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
    });
    return brands.map((b) => b.brand);
  } catch {
    return [];
  }
}

export default async function NewProductPage() {
  const brands = await getBrands();
  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
        >
          ← Back to Products
        </Link>
        <h1 className="text-[18px] font-bold mt-3">Add Product</h1>
      </div>
      <ProductForm mode="create" existingBrands={brands} />
    </div>
  );
}
