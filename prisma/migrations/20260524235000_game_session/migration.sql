-- CreateTable: GameSession
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "ip" TEXT,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameSession_issuedAt_idx" ON "GameSession"("issuedAt");

-- CreateIndex
CREATE INDEX "GameSession_usedAt_idx" ON "GameSession"("usedAt");
