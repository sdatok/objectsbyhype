import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { revalidateProductPages } from "@/lib/revalidate-store";
import {
  replaceProductSizeStocks,
  syncProductAggregateQuantity,
  type SizeQuantityMap,
} from "@/lib/size-stock";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      include: {
        images: { orderBy: { displayOrder: "asc" } },
        sizeStocks: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(products);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      brand,
      slug,
      description,
      price,
      category,
      status,
      sizes,
      sizePricing,
      quantity,
      images,
      consignment,
      sizeStocks,
    } = body;

    if (!name || !brand || !slug || !price || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sizeList: string[] = sizes ?? [];
    const stockMap: SizeQuantityMap = sizeStocks ?? {};

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          name,
          brand,
          slug,
          description: description ?? "",
          price,
          category,
          status: status ?? "DRAFT",
          sizes: sizeList,
          sizePricing: sizePricing ?? null,
          quantity: quantity ?? 0,
          consignment: Boolean(consignment),
          images: {
            create: (images ?? []).map(
              (img: { url: string; displayOrder: number }) => ({
                url: img.url,
                displayOrder: img.displayOrder,
              })
            ),
          },
        },
        include: { images: true },
      });
      await replaceProductSizeStocks(tx, p.id, sizeList, stockMap);
      return p;
    });

    await syncProductAggregateQuantity(prisma, product.id);

    const full = await prisma.product.findUnique({
      where: { id: product.id },
      include: { images: true, sizeStocks: true },
    });

    revalidateProductPages(product.slug);
    return NextResponse.json(full, { status: 201 });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to create product";
    if (message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "A product with this slug already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
