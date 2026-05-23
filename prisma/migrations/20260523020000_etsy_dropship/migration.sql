-- AlterTable Product: Etsy drop-shipping metadata (admin-only)
ALTER TABLE "Product" ADD COLUMN "etsyUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "etsyShop" TEXT;
ALTER TABLE "Product" ADD COLUMN "etsyCost" DECIMAL(10,2);
ALTER TABLE "Product" ADD COLUMN "etsyNote" TEXT;

-- AlterTable ProductVariant: per-color Etsy overrides
ALTER TABLE "ProductVariant" ADD COLUMN "etsyUrl" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN "etsyCost" DECIMAL(10,2);
ALTER TABLE "ProductVariant" ADD COLUMN "etsyNote" TEXT;

-- AlterTable Order: snapshot of the buyer's shipping address from Stripe Checkout
ALTER TABLE "Order" ADD COLUMN "shippingAddress" JSONB;
