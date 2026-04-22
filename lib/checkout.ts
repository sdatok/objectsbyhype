import { prisma } from "@/lib/db";
import type { PromoCode, PromoType } from "@prisma/client";
import { WELCOME_DISCOUNT_PERCENT } from "@/lib/stripe";
import { ONE_SIZE } from "@/lib/size-stock";

export interface CartLineInput {
  productId: string;
  size: string;
  quantity: number;
}

export interface ValidatedLine {
  productId: string;
  size: string;
  quantity: number;
  unitPrice: number;
  name: string;
  brand: string;
  stockAvailable: number;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Allocate order-level discount across lines proportionally; returns unit prices after discount.
 */
export function allocateDiscountToUnitPrices(
  lines: ValidatedLine[],
  discountTotal: number
): ValidatedLine[] {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  if (discountTotal <= 0 || subtotal <= 0) return lines;
  const ratio = (subtotal - discountTotal) / subtotal;
  const out = lines.map((l) => ({
    ...l,
    unitPrice: roundMoney(l.unitPrice * ratio),
  }));
  const newSub = out.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const target = roundMoney(subtotal - discountTotal);
  const drift = roundMoney(target - newSub);
  if (out.length && Math.abs(drift) > 0.001) {
    const last = out[out.length - 1];
    last.unitPrice = roundMoney(last.unitPrice + drift / last.quantity);
  }
  return out;
}

export async function validateCartLines(
  items: CartLineInput[]
): Promise<{ ok: true; lines: ValidatedLine[] } | { ok: false; error: string }> {
  if (!items.length) return { ok: false, error: "Cart is empty" };

  const lines: ValidatedLine[] = [];

  for (const item of items) {
    if (!item.productId || item.quantity < 1) {
      return { ok: false, error: "Invalid cart item" };
    }
    const size = item.size || ONE_SIZE;

    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: { sizeStocks: true },
    });

    if (!product || product.status !== "ACTIVE") {
      return { ok: false, error: "A product is no longer available" };
    }

    const catalogSizes = product.sizes.length > 0 ? product.sizes : [ONE_SIZE];
    if (!catalogSizes.includes(size)) {
      return { ok: false, error: `Invalid size for ${product.name}` };
    }

    const stockRow = product.sizeStocks.find((s) => s.size === size);
    const stockAvailable = stockRow?.quantity ?? 0;
    if (stockAvailable < item.quantity) {
      return {
        ok: false,
        error: `Not enough stock for ${product.name} (${size})`,
      };
    }

    const base =
      product.sizePricing &&
      typeof product.sizePricing === "object" &&
      size in (product.sizePricing as object) &&
      (product.sizePricing as Record<string, unknown>)[size] != null
        ? Number((product.sizePricing as Record<string, number>)[size])
        : Number(product.price);

    if (!Number.isFinite(base) || base <= 0) {
      return { ok: false, error: "Invalid product price" };
    }

    lines.push({
      productId: product.id,
      size,
      quantity: item.quantity,
      unitPrice: roundMoney(base),
      name: product.name,
      brand: product.brand,
      stockAvailable,
    });
  }

  return { ok: true, lines };
}

export async function resolvePromo(
  code: string | undefined,
  subtotal: number,
  clerkUserId: string | null
): Promise<
  | { ok: true; promo: PromoCode; discount: number }
  | { ok: false; error: string }
  | { ok: true; promo: null; discount: 0 }
> {
  if (!code?.trim()) return { ok: true, promo: null, discount: 0 };

  const normalized = code.trim().toUpperCase();
  const promo = await prisma.promoCode.findUnique({
    where: { code: normalized },
  });

  if (!promo || !promo.active) {
    return { ok: false, error: "Invalid promo code" };
  }
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return { ok: false, error: "This promo code has expired" };
  }
  if (promo.minSubtotal != null && subtotal < Number(promo.minSubtotal)) {
    return { ok: false, error: "Order does not meet minimum for this code" };
  }

  if (promo.maxRedemptions != null) {
    const used = await prisma.order.count({
      where: { promoCodeId: promo.id, status: "PAID" },
    });
    if (used >= promo.maxRedemptions) {
      return { ok: false, error: "This promo code is no longer available" };
    }
  }

  if (promo.perCustomerLimit != null && clerkUserId) {
    const userUses = await prisma.order.count({
      where: {
        promoCodeId: promo.id,
        clerkUserId,
        status: "PAID",
      },
    });
    if (userUses >= promo.perCustomerLimit) {
      return { ok: false, error: "You have already used this code" };
    }
  }

  let discount = 0;
  if (promo.type === "PERCENT") {
    discount = roundMoney((subtotal * Number(promo.value)) / 100);
  } else {
    discount = roundMoney(Number(promo.value));
  }
  discount = Math.min(discount, subtotal);
  return { ok: true, promo, discount };
}

export async function resolveWelcomeDiscount(
  useWelcome: boolean,
  clerkUserId: string | null,
  subtotal: number
): Promise<{ ok: true; discount: number } | { ok: false; error: string }> {
  if (!useWelcome) return { ok: true, discount: 0 };
  if (!clerkUserId) {
    return { ok: false, error: "Sign in to use your welcome discount" };
  }
  const profile = await prisma.customerProfile.findUnique({
    where: { clerkUserId },
  });
  if (!profile) {
    return { ok: false, error: "Complete sign-in to use your welcome discount" };
  }
  if (profile.welcomeDiscountUsed) {
    return { ok: false, error: "Welcome discount already used" };
  }
  const pct = Math.min(100, Math.max(0, WELCOME_DISCOUNT_PERCENT));
  const discount = roundMoney((subtotal * pct) / 100);
  return { ok: true, discount };
}

export function promoTypeFromString(s: string): PromoType | null {
  if (s === "PERCENT" || s === "FIXED") return s;
  return null;
}
