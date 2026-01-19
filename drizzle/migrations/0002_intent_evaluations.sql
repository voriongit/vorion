ALTER TABLE "intents"
  ADD COLUMN IF NOT EXISTS "trust_level" integer,
  ADD COLUMN IF NOT EXISTS "trust_score" integer;

CREATE TABLE IF NOT EXISTS "intent_evaluations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "intent_id" uuid NOT NULL REFERENCES "intents"("id") ON DELETE CASCADE,
  "tenant_id" text NOT NULL,
  "result" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "intent_evaluations_intent_idx"
  ON "intent_evaluations" ("intent_id", "created_at");
