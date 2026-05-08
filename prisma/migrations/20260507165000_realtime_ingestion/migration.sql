-- Realtime ingestion storage contract for CrashPulse AI.
-- Keeps existing dashboard fields while adding normalized telemetry columns.

ALTER TABLE "Round"
  ADD COLUMN IF NOT EXISTS "roundId" TEXT,
  ADD COLUMN IF NOT EXISTS "players" INTEGER,
  ADD COLUMN IF NOT EXISTS "bets" INTEGER,
  ADD COLUMN IF NOT EXISTS "cashouts" INTEGER,
  ADD COLUMN IF NOT EXISTS "volatility" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "rawPayload" JSONB,
  ADD COLUMN IF NOT EXISTS "eventType" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT;

ALTER TABLE "Round"
  ALTER COLUMN "multiplier" DROP NOT NULL,
  ALTER COLUMN "volatilityScore" SET DEFAULT 0,
  ALTER COLUMN "streakType" SET DEFAULT 'low',
  ALTER COLUMN "streakLength" SET DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Round_roundId_key" ON "Round"("roundId");
CREATE INDEX IF NOT EXISTS "Round_roundId_idx" ON "Round"("roundId");
CREATE INDEX IF NOT EXISTS "Round_createdAt_idx" ON "Round"("createdAt");
CREATE INDEX IF NOT EXISTS "Round_multiplier_idx" ON "Round"("multiplier");
CREATE INDEX IF NOT EXISTS "Round_streakType_streakLength_idx" ON "Round"("streakType", "streakLength");

ALTER TABLE "Statistics"
  ADD COLUMN IF NOT EXISTS "avg25" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "entropyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "DatasetSnapshot" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "rows" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DatasetSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DatasetSnapshot_createdAt_idx" ON "DatasetSnapshot"("createdAt");
CREATE INDEX IF NOT EXISTS "DatasetSnapshot_format_idx" ON "DatasetSnapshot"("format");
