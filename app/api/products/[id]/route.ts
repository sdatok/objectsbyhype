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

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { displayOrder: "asc" } },
        sizeStocks: true,
      },
    });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
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

    const sizeList: string[] = sizes ?? [];
    const stockMap: SizeQuantityMap = sizeStocks ?? {};

    const product = await prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: id } });

      const p = await tx.product.update({
        where: { id },
        data: {
          name,
          brand,
          slug,
          description,
          price,
          category,
          status,
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
      await replaceProductSizeStocks(tx, id, sizeList, stockMap);
      return p;
    });

    await syncProductAggregateQuantity(prisma, id);

    const full = await prisma.product.findUnique({
      where: { id },
      include: { images: true, sizeStocks: true },
    });

    revalidateProductPages(product.slug);
    return NextResponse.json(full);
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to update";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const allowed = ["status", "quantity", "price"] as const;
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No patchable fields" }, { status: 400 });
    }
    const product = await prisma.product.update({ where: { id }, data });
    revalidateProductPages(product.slug);
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { slug: true },
    });
    await prisma.product.delete({ where: { id } });
    revalidateProductPages(existing?.slug ?? null);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
