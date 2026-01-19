-- Trust Scores Table for atsf-core Persistence
-- This table stores trust engine records for AI agents

CREATE TABLE IF NOT EXISTS "trust_scores" (
  "entity_id" text PRIMARY KEY NOT NULL,
  "score" integer NOT NULL DEFAULT 100,
  "level" integer NOT NULL DEFAULT 1,
  "components" jsonb NOT NULL DEFAULT '{"behavioral": 0.5, "compliance": 0.5, "identity": 0.5, "context": 0.5}',
  "signals" jsonb NOT NULL DEFAULT '[]',
  "last_calculated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "history" jsonb NOT NULL DEFAULT '[]',
  "recent_failures" text[] NOT NULL DEFAULT '{}',
  "recent_successes" text[] NOT NULL DEFAULT '{}',
  "peak_score" integer NOT NULL DEFAULT 100,
  "consecutive_successes" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS "trust_scores_score_idx" ON "trust_scores" USING btree ("score");
CREATE INDEX IF NOT EXISTS "trust_scores_level_idx" ON "trust_scores" USING btree ("level");
CREATE INDEX IF NOT EXISTS "trust_scores_updated_idx" ON "trust_scores" USING btree ("updated_at");

COMMENT ON TABLE "trust_scores" IS 'Trust engine records for AI agents - atsf-core persistence';
COMMENT ON COLUMN "trust_scores"."entity_id" IS 'Agent or entity unique identifier';
COMMENT ON COLUMN "trust_scores"."score" IS 'Current trust score (0-1000)';
COMMENT ON COLUMN "trust_scores"."level" IS 'Trust tier (0-5: Sandbox to Autonomous)';
COMMENT ON COLUMN "trust_scores"."components" IS 'Component scores (behavioral, compliance, identity, context)';
COMMENT ON COLUMN "trust_scores"."signals" IS 'Recent trust signals (max 1000)';
COMMENT ON COLUMN "trust_scores"."recent_failures" IS 'Recent failure timestamps for accelerated decay';
COMMENT ON COLUMN "trust_scores"."recent_successes" IS 'Recent success timestamps for accelerated recovery';
COMMENT ON COLUMN "trust_scores"."peak_score" IS 'Highest score achieved (for recovery tracking)';
COMMENT ON COLUMN "trust_scores"."consecutive_successes" IS 'Consecutive successful signals (for accelerated recovery)';
