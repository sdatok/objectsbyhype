import { revalidatePath } from "next/cache";

/**
 * Invalidate store pages that depend on the product catalog (homepage slice,
 * shop grid, and the product detail page).
 */
export function revalidateProductPages(slug: string | null): void {
  revalidatePath("/");
  revalidatePath("/shop");
  if (slug) {
    revalidatePath(`/product/${slug}`);
  }
  // Admin lists and forms read from DB; bust cache so new/edited products show at once
  revalidatePath("/admin", "layout");
}

export function revalidateWtfPage(): void {
  revalidatePath("/whats-the-fit");
  revalidatePath("/admin/wtf");
}
