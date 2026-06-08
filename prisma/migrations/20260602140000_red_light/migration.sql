-- Red Light Green Light (Squid Game mode)
CREATE TABLE "RedLightConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "prizeTitle" TEXT NOT NULL DEFAULT 'Red Light Green Light Prize',
    "prizeDescription" TEXT,
    "matchSeconds" INTEGER NOT NULL DEFAULT 120,
    "currentMatchId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedLightConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RedLightMatch" (
    "id" TEXT NOT NULL,
    "status" "SurvivorMatchStatus" NOT NULL DEFAULT 'WAITING',
    "prizeTitle" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "winnerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedLightMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RedLightParticipant" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "placement" INTEGER,
    "survivedSeconds" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "RedLightParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RedLightMatch_status_idx" ON "RedLightMatch"("status");
CREATE INDEX "RedLightMatch_createdAt_idx" ON "RedLightMatch"("createdAt");
CREATE INDEX "RedLightParticipant_matchId_idx" ON "RedLightParticipant"("matchId");
CREATE INDEX "RedLightParticipant_email_idx" ON "RedLightParticipant"("email");
CREATE UNIQUE INDEX "RedLightParticipant_matchId_email_key" ON "RedLightParticipant"("matchId", "email");

ALTER TABLE "RedLightParticipant" ADD CONSTRAINT "RedLightParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "RedLightMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
