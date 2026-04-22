export type ProductStatus = "DRAFT" | "ACTIVE" | "SOLD" | "ARCHIVED";
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
  /** Quantity available per size label */
  sizeStocks: Record<string, number>;
  /** Curated resale: shown on PDP with condition copy when true */
  consignment: boolean;
  images: ProductImage[];
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
] as const;

export type Category = (typeof CATEGORIES)[number];
