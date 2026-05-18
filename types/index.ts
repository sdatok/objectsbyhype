export type ProductStatus = "DRAFT" | "ACTIVE" | "SOLD" | "ARCHIVED";

/**
 * Statuses that should appear on storefront product lists.
 * SOLD items remain visible (with a Sold Out indicator) so buyers see
 * historical inventory and that products move; DRAFT/ARCHIVED are hidden.
 */
export const STORE_VISIBLE_STATUSES: ProductStatus[] = ["ACTIVE", "SOLD"];
export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "SUPPLIER_ORDERED"
  | "SUPPLIER_SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export interface ProductImage {
  id: string;
  url: string;
  displayOrder: number;
}

/**
 * Optional color variant of a product. A product can have zero variants
 * (then product-level images/sizes/price are used) or many.
 */
export interface ProductVariant {
  id: string;
  colorName: string;
  /** Hex string like "#ECE5D4" for the swatch; null = fall back to labeled chip */
  colorHex: string | null;
  /** Optional price override. null = inherit Product.price */
  price: number | null;
  displayOrder: number;
  images: ProductImage[];
  /** Sizes offered for this color */
  sizes: string[];
  /** Per-size stock for this color */
  sizeStocks: Record<string, number>;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  description: string;
  price: number;
  category: string;
  status: ProductStatus;
  sizes: string[];
  sizePricing: Record<string, number> | null;
  /** Sum of per-size stock (legacy field; use sizeStocks for UI) */
  quantity: number;
  /** Quantity available per size label (used when variants is empty) */
  sizeStocks: Record<string, number>;
  /** Curated resale: shown on PDP with condition copy when true */
  consignment: boolean;
  images: ProductImage[];
  /** Color variants. Empty array = single-color product (use product-level fields). */
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  size: string;
  imageUrl: string;
  quantity: number;
  /** Color variant chosen; null for products without variants */
  variantId?: string | null;
  /** Snapshot of the color name for display in cart/email/receipts */
  variantLabel?: string | null;
}

export const CATEGORIES = [
  "Carpets",
  "Cushions",
  "Lamps",
  "Chairs",
  "Tables",
  "Shelving",
  "Decor",
  "Office",
  "Wall Display",
] as const;

export type Category = (typeof CATEGORIES)[number];
