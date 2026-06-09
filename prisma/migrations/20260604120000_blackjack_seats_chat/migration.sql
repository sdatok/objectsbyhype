-- AlterTable
ALTER TABLE "BlackjackConfig" ALTER COLUMN "roundSeconds" SET DEFAULT 120;

-- AlterTable
ALTER TABLE "BlackjackEntry" ADD COLUMN "seatIndex" INTEGER NOT NULL DEFAULT 0;

-- Backfill seat indices per round
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "roundId" ORDER BY "joinedAt") - 1 AS idx
  FROM "BlackjackEntry"
)
UPDATE "BlackjackEntry" AS e
SET "seatIndex" = r.idx
FROM ranked AS r
WHERE e.id = r.id;

-- CreateIndex
CREATE UNIQUE INDEX "BlackjackEntry_roundId_seatIndex_key" ON "BlackjackEntry"("roundId", "seatIndex");

-- CreateTable
CREATE TABLE "BlackjackChatMessage" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "body" VARCHAR(280) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlackjackChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlackjackChatMessage_roundId_createdAt_idx" ON "BlackjackChatMessage"("roundId", "createdAt");

-- AddForeignKey
ALTER TABLE "BlackjackChatMessage" ADD CONSTRAINT "BlackjackChatMessage_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "BlackjackRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
