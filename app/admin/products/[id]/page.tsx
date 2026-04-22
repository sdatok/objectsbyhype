import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ProductForm from "@/components/admin/ProductForm";
import type { Product } from "@/types";
import { toStoreProduct } from "@/lib/map-product";

export const dynamic = "force-dynamic";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

async function getProduct(id: string): Promise<Product | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { displayOrder: "asc" } },
        sizeStocks: true,
      },
    });
    if (!product) return null;
    return toStoreProduct(product);
  } catch {
    return null;
  }
}

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

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const { id } = await params;
  const [product, brands] = await Promise.all([getProduct(id), getBrands()]);
  if (!product) notFound();

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
        >
          ← Back to Products
        </Link>
        <h1 className="text-[18px] font-bold mt-3">Edit Product</h1>
        <p className="text-[12px] text-neutral-400 mt-0.5">{product.name}</p>
      </div>
      <ProductForm product={product} mode="edit" existingBrands={brands} />
    </div>
  );
}
