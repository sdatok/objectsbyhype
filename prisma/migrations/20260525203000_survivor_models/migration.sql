-- CreateEnum
CREATE TYPE "SurvivorMatchStatus" AS ENUM ('WAITING', 'PLAYING', 'ENDED');

-- CreateTable: SurvivorConfig (singleton)
CREATE TABLE "SurvivorConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "prizeTitle" TEXT NOT NULL DEFAULT 'OBH Survivor Prize',
    "prizeDescription" TEXT,
    "matchSeconds" INTEGER NOT NULL DEFAULT 420,
    "currentMatchId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurvivorConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SurvivorMatch
CREATE TABLE "SurvivorMatch" (
    "id" TEXT NOT NULL,
    "status" "SurvivorMatchStatus" NOT NULL DEFAULT 'WAITING',
    "prizeTitle" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "winnerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurvivorMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SurvivorMatch_status_idx" ON "SurvivorMatch"("status");

-- CreateIndex
CREATE INDEX "SurvivorMatch_createdAt_idx" ON "SurvivorMatch"("createdAt");

-- CreateTable: SurvivorParticipant
CREATE TABLE "SurvivorParticipant" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "placement" INTEGER,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "survivedSeconds" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "SurvivorParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurvivorParticipant_matchId_email_key" ON "SurvivorParticipant"("matchId", "email");

-- CreateIndex
CREATE INDEX "SurvivorParticipant_matchId_idx" ON "SurvivorParticipant"("matchId");

-- CreateIndex
CREATE INDEX "SurvivorParticipant_email_idx" ON "SurvivorParticipant"("email");

-- AddForeignKey
ALTER TABLE "SurvivorParticipant" ADD CONSTRAINT "SurvivorParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "SurvivorMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
