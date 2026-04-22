import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

// Public: anyone can submit an item
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      phone,
      itemName,
      brand,
      description,
      askingPrice,
      condition,
      imageUrls,
    } = body;

    if (!name || !email || !itemName || !brand || !description || !condition) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const submission = await prisma.submission.create({
      data: {
        name,
        email,
        phone: phone || null,
        itemName,
        brand,
        description,
        askingPrice: askingPrice ?? null,
        condition,
        imageUrls: imageUrls ?? [],
        status: "PENDING",
      },
    });

    return NextResponse.json(submission, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to submit" },
      { status: 500 }
    );
  }
}

// Admin only: list all submissions
export async function GET(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const submissions = await prisma.submission.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(submissions);
}
