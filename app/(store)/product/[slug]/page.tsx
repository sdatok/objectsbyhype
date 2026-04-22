import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ProductDetail from "@/components/store/ProductDetail";
import RelatedProductsStrip from "@/components/store/RelatedProductsStrip";
import type { Product } from "@/types";
import type { Metadata } from "next";
import { toStoreProduct } from "@/lib/map-product";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

async function getProduct(slug: string): Promise<Product | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { displayOrder: "asc" } },
        sizeStocks: true,
      },
    });
    if (!product) return null;
    return toStoreProduct(product);
  } catch (err) {
    console.error("[getProduct]", err);
    return null;
  }
}

async function getRelated(
  category: string,
  excludeId: string
): Promise<Product[]> {
  try {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE", category, id: { not: excludeId } },
      include: {
        images: { orderBy: { displayOrder: "asc" } },
        sizeStocks: true,
      },
      take: 4,
      orderBy: { createdAt: "desc" },
    });
    return products.map((p) => toStoreProduct(p));
  } catch (err) {
    console.error("[getRelated]", err);
    return [];
  }
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product Not Found" };
  return {
    title: `${product.name} - OBJECTSBYHYPE`,
    description: product.description.slice(0, 160),
    openGraph: {
      images: product.images[0] ? [{ url: product.images[0].url }] : [],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const related = await getRelated(product.category, product.id);

  return (
    <div>
      <ProductDetail product={product} />

      <RelatedProductsStrip products={related} />
    </div>
  );
}
