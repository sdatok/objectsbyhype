import { prisma } from "@/lib/db";

const MAX_PATH_LENGTH = 200;

/** Paths we don't want to count toward storefront traffic. */
const IGNORED_PREFIXES = [
  "/api",
  "/admin",
  "/_next",
  "/favicon",
  "/sign-in",
  "/sign-up",
];

/**
 * Records a single storefront page view, fire-and-forget. Wrapped in try/catch
 * so a DB hiccup never breaks the request. Only the pathname is stored — query
 * strings are stripped to keep the table small and to avoid leaking PII like
 * Stripe checkout session ids.
 */
export async function recordPageView(rawPath: string): Promise<void> {
  try {
    if (!rawPath || typeof rawPath !== "string") return;
    const path = normalizePath(rawPath);
    if (!path) return;
    if (IGNORED_PREFIXES.some((p) => path.startsWith(p))) return;

    await prisma.pageView.create({ data: { path } });
  } catch (err) {
    console.error("[recordPageView]", err);
  }
}

function normalizePath(input: string): string {
  // Strip query/hash, clamp length, force a leading slash.
  let p = input.split("?")[0]?.split("#")[0] ?? "";
  if (!p.startsWith("/")) p = `/${p}`;
  return p.slice(0, MAX_PATH_LENGTH);
}
