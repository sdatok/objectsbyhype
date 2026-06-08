-- CreateEnum
CREATE TYPE "BlackjackRoundStatus" AS ENUM ('OPEN', 'SETTLED');

-- CreateEnum
CREATE TYPE "BlackjackOutcome" AS ENUM ('BLACKJACK', 'WIN', 'PUSH', 'LOSE', 'BUST');

-- CreateTable
CREATE TABLE "BlackjackConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "prizeTitle" TEXT NOT NULL DEFAULT 'Giveaway Wheel Spin',
    "prizeDescription" TEXT,
    "roundSeconds" INTEGER NOT NULL DEFAULT 180,
    "currentRoundId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlackjackConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlackjackRound" (
    "id" TEXT NOT NULL,
    "status" "BlackjackRoundStatus" NOT NULL DEFAULT 'OPEN',
    "prizeTitle" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlackjackRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlackjackEntry" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "playerCards" JSONB NOT NULL,
    "dealerCards" JSONB NOT NULL,
    "outcome" "BlackjackOutcome",
    "handValue" INTEGER NOT NULL DEFAULT 0,
    "placement" INTEGER,
    "wheelCode" TEXT,
    "finishedAt" TIMESTAMP(3),
    "deckRemaining" JSONB,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlackjackEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlackjackRound_status_idx" ON "BlackjackRound"("status");

-- CreateIndex
CREATE INDEX "BlackjackRound_endsAt_idx" ON "BlackjackRound"("endsAt");

-- CreateIndex
CREATE INDEX "BlackjackRound_createdAt_idx" ON "BlackjackRound"("createdAt");

-- CreateIndex
CREATE INDEX "BlackjackEntry_roundId_idx" ON "BlackjackEntry"("roundId");

-- CreateIndex
CREATE INDEX "BlackjackEntry_email_idx" ON "BlackjackEntry"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BlackjackEntry_roundId_email_key" ON "BlackjackEntry"("roundId", "email");

-- AddForeignKey
ALTER TABLE "BlackjackEntry" ADD CONSTRAINT "BlackjackEntry_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "BlackjackRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
