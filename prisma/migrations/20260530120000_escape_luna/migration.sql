-- CreateTable
CREATE TABLE "EscapeLunaConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "prizeTitle" TEXT NOT NULL DEFAULT 'Escape Luna Prize',
    "prizeDescription" TEXT,
    "matchSeconds" INTEGER NOT NULL DEFAULT 420,
    "currentMatchId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscapeLunaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscapeLunaMatch" (
    "id" TEXT NOT NULL,
    "status" "SurvivorMatchStatus" NOT NULL DEFAULT 'WAITING',
    "prizeTitle" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "winnerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscapeLunaMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscapeLunaParticipant" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "placement" INTEGER,
    "survivedSeconds" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "EscapeLunaParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EscapeLunaMatch_status_idx" ON "EscapeLunaMatch"("status");

-- CreateIndex
CREATE INDEX "EscapeLunaMatch_createdAt_idx" ON "EscapeLunaMatch"("createdAt");

-- CreateIndex
CREATE INDEX "EscapeLunaParticipant_matchId_idx" ON "EscapeLunaParticipant"("matchId");

-- CreateIndex
CREATE INDEX "EscapeLunaParticipant_email_idx" ON "EscapeLunaParticipant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EscapeLunaParticipant_matchId_email_key" ON "EscapeLunaParticipant"("matchId", "email");

-- AddForeignKey
ALTER TABLE "EscapeLunaParticipant" ADD CONSTRAINT "EscapeLunaParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "EscapeLunaMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed config row
INSERT INTO "EscapeLunaConfig" ("id", "enabled", "prizeTitle", "matchSeconds", "updatedAt")
VALUES ('default', false, 'Escape Luna Prize', 420, CURRENT_TIMESTAMP);
