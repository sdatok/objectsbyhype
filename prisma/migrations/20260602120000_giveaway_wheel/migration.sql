-- CreateTable: GiveawayWheelConfig (singleton)
CREATE TABLE "GiveawayWheelConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "commonWeight" INTEGER NOT NULL DEFAULT 60,
    "rareWeight" INTEGER NOT NULL DEFAULT 30,
    "jackpotWeight" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiveawayWheelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable: GiveawayWheelPrize
CREATE TABLE "GiveawayWheelPrize" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tier" "WheelPrizeTier" NOT NULL,
    "quantityInitial" INTEGER NOT NULL DEFAULT 1,
    "quantityRemaining" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiveawayWheelPrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable: GiveawayWheelPlayCode
CREATE TABLE "GiveawayWheelPlayCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "winnerName" TEXT NOT NULL,
    "winnerEmail" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayWheelPlayCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable: GiveawayWheelSpin
CREATE TABLE "GiveawayWheelSpin" (
    "id" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "prizeLabel" TEXT NOT NULL,
    "tier" "WheelPrizeTier" NOT NULL,
    "winnerName" TEXT NOT NULL,
    "winnerEmail" TEXT NOT NULL DEFAULT '',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayWheelSpin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayWheelPlayCode_code_key" ON "GiveawayWheelPlayCode"("code");
CREATE INDEX "GiveawayWheelPlayCode_usedAt_idx" ON "GiveawayWheelPlayCode"("usedAt");
CREATE INDEX "GiveawayWheelPlayCode_winnerEmail_idx" ON "GiveawayWheelPlayCode"("winnerEmail");
CREATE INDEX "GiveawayWheelPlayCode_createdAt_idx" ON "GiveawayWheelPlayCode"("createdAt");

CREATE INDEX "GiveawayWheelPrize_tier_active_idx" ON "GiveawayWheelPrize"("tier", "active");
CREATE INDEX "GiveawayWheelPrize_sortOrder_idx" ON "GiveawayWheelPrize"("sortOrder");

CREATE UNIQUE INDEX "GiveawayWheelSpin_codeId_key" ON "GiveawayWheelSpin"("codeId");
CREATE INDEX "GiveawayWheelSpin_createdAt_idx" ON "GiveawayWheelSpin"("createdAt");
CREATE INDEX "GiveawayWheelSpin_winnerEmail_idx" ON "GiveawayWheelSpin"("winnerEmail");

-- AddForeignKey
ALTER TABLE "GiveawayWheelSpin" ADD CONSTRAINT "GiveawayWheelSpin_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "GiveawayWheelPlayCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GiveawayWheelSpin" ADD CONSTRAINT "GiveawayWheelSpin_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "GiveawayWheelPrize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed singleton config (disabled until admin enables)
INSERT INTO "GiveawayWheelConfig" ("id", "enabled", "commonWeight", "rareWeight", "jackpotWeight", "updatedAt")
VALUES ('default', false, 60, 30, 10, CURRENT_TIMESTAMP);
