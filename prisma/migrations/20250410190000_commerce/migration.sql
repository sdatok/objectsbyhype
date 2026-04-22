-- CreateEnum
CREATE TYPE "PromoType" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "quantity" SET DEFAULT 0;

-- AlterTable Order: add nullable columns first, backfill subtotal, then NOT NULL
ALTER TABLE "Order" ADD COLUMN "clerkUserId" TEXT;
ALTER TABLE "Order" ADD COLUMN "discountTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "promoCodeId" TEXT;
ALTER TABLE "Order" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "Order" ADD COLUMN "stripeSessionId" TEXT;
ALTER TABLE "Order" ADD COLUMN "subtotal" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN "welcomeDiscountApplied" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Order" SET "subtotal" = "total" WHERE "subtotal" IS NULL;
ALTER TABLE "Order" ALTER COLUMN "subtotal" SET NOT NULL;

-- CreateTable
CREATE TABLE "ProductSizeStock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductSizeStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "welcomeDiscountUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("clerkUserId")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PromoType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "perCustomerLimit" INTEGER,
    "minSubtotal" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLineItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,

    CONSTRAINT "OrderLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSizeStock_productId_idx" ON "ProductSizeStock"("productId");

CREATE UNIQUE INDEX "ProductSizeStock_productId_size_key" ON "ProductSizeStock"("productId", "size");

CREATE INDEX "CustomerProfile_email_idx" ON "CustomerProfile"("email");

CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

CREATE INDEX "OrderLineItem_orderId_idx" ON "OrderLineItem"("orderId");

CREATE INDEX "OrderLineItem_productId_idx" ON "OrderLineItem"("productId");

CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");

CREATE UNIQUE INDEX "Order_stripePaymentIntentId_key" ON "Order"("stripePaymentIntentId");

CREATE INDEX "Order_status_idx" ON "Order"("status");

CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

CREATE INDEX "Order_clerkUserId_idx" ON "Order"("clerkUserId");

-- AddForeignKey
ALTER TABLE "ProductSizeStock" ADD CONSTRAINT "ProductSizeStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill per-size rows from existing products (legacy quantity on first size only)
INSERT INTO "ProductSizeStock" ("id", "productId", "size", "quantity")
SELECT gen_random_uuid()::text, p.id, trim(sz), 0
FROM "Product" p
CROSS JOIN LATERAL unnest(p.sizes) AS t(sz);

UPDATE "ProductSizeStock" pss
SET quantity = GREATEST(p.quantity, 0)
FROM "Product" p
WHERE pss."productId" = p.id
  AND pss.id = (
    SELECT pss2.id FROM "ProductSizeStock" pss2
    WHERE pss2."productId" = p.id
    ORDER BY pss2.size
    LIMIT 1
  );

INSERT INTO "ProductSizeStock" ("id", "productId", "size", "quantity")
SELECT gen_random_uuid()::text, p.id, 'OS', GREATEST(p.quantity, 0)
FROM "Product" p
WHERE cardinality(p.sizes) = 0
  AND NOT EXISTS (SELECT 1 FROM "ProductSizeStock" s WHERE s."productId" = p.id);
