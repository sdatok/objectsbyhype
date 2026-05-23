import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { revalidateProductPages } from "@/lib/revalidate-store";
import {
  replaceProductSizeStocks,
  syncProductAggregateQuantity,
  type SizeQuantityMap,
} from "@/lib/size-stock";
import { STORE_VISIBLE_STATUSES } from "@/types";
import { PRODUCT_INCLUDE } from "@/lib/map-product";
import {
  normalizeEtsyNote,
  normalizeEtsyUrl,
  replaceProductVariants,
  type VariantInput,
} from "@/lib/variants";

function parseEtsyCost(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { status: { in: STORE_VISIBLE_STATUSES } },
      include: PRODUCT_INCLUDE,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
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
      madeToOrder,
      sizeStocks,
      etsyUrl,
      etsyShop,
      etsyCost,
      etsyNote,
    } = body;

    if (!name || !brand || !slug || !price || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const normalizedEtsyUrl = normalizeEtsyUrl(etsyUrl);
    if (normalizedEtsyUrl === undefined) {
      return NextResponse.json(
        { error: "Etsy URL must be a valid etsy.com link" },
        { status: 400 }
      );
    }

    const sizeList: string[] = sizes ?? [];
    const stockMap: SizeQuantityMap = sizeStocks ?? {};
    const variants: VariantInput[] = Array.isArray(body.variants)
      ? body.variants
      : [];

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
          madeToOrder: Boolean(madeToOrder),
          etsyUrl: normalizedEtsyUrl,
          etsyShop: typeof etsyShop === "string" && etsyShop.trim()
            ? etsyShop.trim()
            : null,
          etsyCost: parseEtsyCost(etsyCost),
          etsyNote: normalizeEtsyNote(etsyNote),
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
      await replaceProductVariants(tx, p.id, variants);
      return p;
    });

    await syncProductAggregateQuantity(prisma, product.id);

    const full = await prisma.product.findUnique({
      where: { id: product.id },
      include: PRODUCT_INCLUDE,
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
