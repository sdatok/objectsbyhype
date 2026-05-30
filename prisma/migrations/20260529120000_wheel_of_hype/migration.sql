-- CreateEnum
CREATE TYPE "WheelPrizeTier" AS ENUM ('COMMON', 'RARE', 'JACKPOT');

-- CreateTable
CREATE TABLE "WheelConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "commonWeight" INTEGER NOT NULL DEFAULT 60,
    "rareWeight" INTEGER NOT NULL DEFAULT 30,
    "jackpotWeight" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WheelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WheelProMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "monthlyPrice" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WheelProMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WheelPrize" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tier" "WheelPrizeTier" NOT NULL,
    "quantityInitial" INTEGER NOT NULL DEFAULT 1,
    "quantityRemaining" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WheelPrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WheelPlayCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "proMemberId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WheelPlayCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WheelSpin" (
    "id" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "proMemberId" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "prizeLabel" TEXT NOT NULL,
    "tier" "WheelPrizeTier" NOT NULL,
    "monthKey" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WheelSpin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WheelPlayCode_code_key" ON "WheelPlayCode"("code");

-- CreateIndex
CREATE INDEX "WheelProMember_email_idx" ON "WheelProMember"("email");

-- CreateIndex
CREATE INDEX "WheelProMember_active_idx" ON "WheelProMember"("active");

-- CreateIndex
CREATE INDEX "WheelPrize_tier_active_idx" ON "WheelPrize"("tier", "active");

-- CreateIndex
CREATE INDEX "WheelPrize_sortOrder_idx" ON "WheelPrize"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WheelPlayCode_proMemberId_monthKey_key" ON "WheelPlayCode"("proMemberId", "monthKey");

-- CreateIndex
CREATE INDEX "WheelPlayCode_monthKey_idx" ON "WheelPlayCode"("monthKey");

-- CreateIndex
CREATE INDEX "WheelPlayCode_usedAt_idx" ON "WheelPlayCode"("usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WheelSpin_codeId_key" ON "WheelSpin"("codeId");

-- CreateIndex
CREATE INDEX "WheelSpin_monthKey_idx" ON "WheelSpin"("monthKey");

-- CreateIndex
CREATE INDEX "WheelSpin_proMemberId_idx" ON "WheelSpin"("proMemberId");

-- CreateIndex
CREATE INDEX "WheelSpin_createdAt_idx" ON "WheelSpin"("createdAt");

-- AddForeignKey
ALTER TABLE "WheelPlayCode" ADD CONSTRAINT "WheelPlayCode_proMemberId_fkey" FOREIGN KEY ("proMemberId") REFERENCES "WheelProMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WheelSpin" ADD CONSTRAINT "WheelSpin_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "WheelPlayCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WheelSpin" ADD CONSTRAINT "WheelSpin_proMemberId_fkey" FOREIGN KEY ("proMemberId") REFERENCES "WheelProMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WheelSpin" ADD CONSTRAINT "WheelSpin_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "WheelPrize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default config
INSERT INTO "WheelConfig" ("id", "enabled", "commonWeight", "rareWeight", "jackpotWeight", "updatedAt")
VALUES ('default', true, 60, 30, 10, CURRENT_TIMESTAMP);
