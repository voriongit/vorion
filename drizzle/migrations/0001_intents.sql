CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "intent_status" AS ENUM ('pending','evaluating','approved','denied','escalated','executing','completed','failed');

CREATE TABLE IF NOT EXISTS "intents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "goal" text NOT NULL,
  "intent_type" text,
  "priority" integer DEFAULT 0,
  "status" intent_status NOT NULL DEFAULT 'pending',
  "trust_snapshot" jsonb,
  "context" jsonb NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "dedupe_hash" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "intents_tenant_dedupe_idx"
  ON "intents" ("tenant_id", "dedupe_hash");

CREATE INDEX IF NOT EXISTS "intents_tenant_created_idx"
  ON "intents" ("tenant_id", "created_at");

CREATE TABLE IF NOT EXISTS "intent_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "intent_id" uuid NOT NULL REFERENCES "intents"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}',
  "occurred_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "intent_events_intent_idx"
  ON "intent_events" ("intent_id", "occurred_at");
