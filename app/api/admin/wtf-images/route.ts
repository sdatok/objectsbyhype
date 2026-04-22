import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidateWtfPage } from "@/lib/revalidate-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  const last = await prisma.wtfImage.findFirst({
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });
  const nextOrder = (last?.displayOrder ?? -1) + 1;

  const row = await prisma.wtfImage.create({
    data: { url, displayOrder: nextOrder },
  });

  revalidateWtfPage();
  return NextResponse.json({
    id: row.id,
    url: row.url,
    displayOrder: row.displayOrder,
    featured: row.featured,
  });
}

export async function PATCH(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { orderedIds?: unknown; id?: unknown; featured?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.id !== undefined || body.featured !== undefined) {
    if (typeof body.id !== "string" || typeof body.featured !== "boolean") {
      return NextResponse.json(
        { error: "For featured toggle, send { id: string, featured: boolean }" },
        { status: 400 }
      );
    }
    if (body.orderedIds !== undefined) {
      return NextResponse.json(
        { error: "Send either orderedIds or id+featured, not both" },
        { status: 400 }
      );
    }
    const updated = await prisma.wtfImage.updateMany({
      where: { id: body.id },
      data: { featured: body.featured },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    revalidateWtfPage();
    return NextResponse.json({ ok: true });
  }

  const orderedIds = body.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "orderedIds must be string[]" }, { status: 400 });
  }

  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.wtfImage.update({
        where: { id },
        data: { displayOrder: idx },
      })
    )
  );

  revalidateWtfPage();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const removed = await prisma.wtfImage.deleteMany({ where: { id } });
  if (removed.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  revalidateWtfPage();
  return NextResponse.json({ ok: true });
}
