import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { saveUploadedImage } from "@/lib/server-upload";
import type { UploadFolder } from "@/lib/server-upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const folderField = formData.get("folder");
  const folder: UploadFolder =
    folderField === "wtf" ? "wtf" : "products";

  const file = formData.get("file") as File | null;

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const result = await saveUploadedImage(file, folder);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url });
}
