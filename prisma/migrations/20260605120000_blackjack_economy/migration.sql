-- AlterTable
ALTER TABLE "BlackjackConfig" ADD COLUMN IF NOT EXISTS "tableSeats" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "BlackjackConfig" ADD COLUMN IF NOT EXISTS "inactiveRoundKick" INTEGER NOT NULL DEFAULT 3;

-- CreateEnum
CREATE TYPE "BlackjackHandPhase" AS ENUM ('IDLE', 'PLAYING', 'SETTLED');

-- CreateTable
CREATE TABLE "BlackjackWallet" (
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "savedCredits" INTEGER NOT NULL DEFAULT 0,
    "peakStack" INTEGER NOT NULL DEFAULT 0,
    "lastDailyGrantDate" TEXT,
    "milestonesJson" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlackjackWallet_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "BlackjackSeat" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "stackCredits" INTEGER NOT NULL DEFAULT 0,
    "currentBet" INTEGER NOT NULL DEFAULT 0,
    "handPhase" "BlackjackHandPhase" NOT NULL DEFAULT 'IDLE',
    "handJson" JSONB,
    "playedThisRound" BOOLEAN NOT NULL DEFAULT false,
    "missedRounds" INTEGER NOT NULL DEFAULT 0,
    "pendingGwCode" TEXT,
    "pendingWohCode" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlackjackSeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlackjackSeat_email_key" ON "BlackjackSeat"("email");
CREATE UNIQUE INDEX "BlackjackSeat_seatIndex_key" ON "BlackjackSeat"("seatIndex");
CREATE INDEX "BlackjackSeat_seatIndex_idx" ON "BlackjackSeat"("seatIndex");
CREATE INDEX "BlackjackSeat_stackCredits_idx" ON "BlackjackSeat"("stackCredits");
CREATE INDEX "BlackjackWallet_peakStack_idx" ON "BlackjackWallet"("peakStack");

-- AddForeignKey
ALTER TABLE "BlackjackSeat" ADD CONSTRAINT "BlackjackSeat_email_fkey" FOREIGN KEY ("email") REFERENCES "BlackjackWallet"("email") ON DELETE CASCADE ON UPDATE CASCADE;
