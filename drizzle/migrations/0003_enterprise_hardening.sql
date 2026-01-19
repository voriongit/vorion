-- Migration: Enterprise Hardening
-- Adds CHECK constraints, escalations table, and missing columns

-- =============================================================================
-- 1. Add cancelled status to enum
-- =============================================================================
ALTER TYPE intent_status ADD VALUE IF NOT EXISTS 'cancelled';

-- =============================================================================
-- 2. Add missing columns to intents table
-- =============================================================================
ALTER TABLE "intents"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "cancellation_reason" text;

-- Add CHECK constraints for data integrity
ALTER TABLE "intents"
  ADD CONSTRAINT "intents_priority_check"
    CHECK (priority IS NULL OR (priority >= 0 AND priority <= 9)),
  ADD CONSTRAINT "intents_trust_level_check"
    CHECK (trust_level IS NULL OR (trust_level >= 0 AND trust_level <= 4)),
  ADD CONSTRAINT "intents_trust_score_check"
    CHECK (trust_score IS NULL OR (trust_score >= 0 AND trust_score <= 1000));

-- Index for soft delete cleanup
CREATE INDEX IF NOT EXISTS "intents_deleted_at_idx"
  ON "intents" ("deleted_at")
  WHERE "deleted_at" IS NOT NULL;

-- =============================================================================
-- 3. Add hash chain columns to intent_events
-- =============================================================================
ALTER TABLE "intent_events"
  ADD COLUMN IF NOT EXISTS "hash" text,
  ADD COLUMN IF NOT EXISTS "previous_hash" text,
  ADD COLUMN IF NOT EXISTS "sequence_number" integer;

-- Index for sequence ordering
CREATE INDEX IF NOT EXISTS "intent_events_sequence_idx"
  ON "intent_events" ("intent_id", "sequence_number");

-- =============================================================================
-- 4. Create escalations table (persistent storage)
-- =============================================================================
CREATE TYPE "escalation_status" AS ENUM ('pending', 'acknowledged', 'approved', 'rejected', 'timeout', 'cancelled');

CREATE TYPE "escalation_reason_category" AS ENUM (
  'trust_insufficient',
  'high_risk',
  'policy_violation',
  'manual_review',
  'constraint_escalate'
);

CREATE TABLE IF NOT EXISTS "escalations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "intent_id" uuid NOT NULL REFERENCES "intents"("id") ON DELETE CASCADE,
  "tenant_id" text NOT NULL,

  -- Escalation details
  "reason" text NOT NULL,
  "reason_category" escalation_reason_category NOT NULL,

  -- Routing
  "escalated_to" text NOT NULL,
  "escalated_by" text,

  -- Status
  "status" escalation_status NOT NULL DEFAULT 'pending',

  -- Resolution
  "resolved_by" text,
  "resolved_at" timestamptz,
  "resolution_notes" text,

  -- SLA tracking
  "timeout" text NOT NULL, -- ISO 8601 duration
  "timeout_at" timestamptz NOT NULL,
  "acknowledged_at" timestamptz,
  "sla_breached" boolean DEFAULT FALSE,

  -- Metadata
  "context" jsonb,
  "metadata" jsonb,

  -- Timestamps
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Indexes for escalations
CREATE INDEX IF NOT EXISTS "escalations_tenant_status_idx"
  ON "escalations" ("tenant_id", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "escalations_intent_idx"
  ON "escalations" ("intent_id");

CREATE INDEX IF NOT EXISTS "escalations_timeout_idx"
  ON "escalations" ("timeout_at")
  WHERE "status" = 'pending';

CREATE INDEX IF NOT EXISTS "escalations_pending_idx"
  ON "escalations" ("tenant_id")
  WHERE "status" = 'pending';

-- =============================================================================
-- 5. Create audit_records table (foundation)
-- =============================================================================
CREATE TYPE "audit_severity" AS ENUM ('info', 'warning', 'error', 'critical');
CREATE TYPE "audit_outcome" AS ENUM ('success', 'failure', 'partial');

CREATE TABLE IF NOT EXISTS "audit_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" text NOT NULL,

  -- Event identification
  "event_type" text NOT NULL,
  "event_category" text NOT NULL,
  "severity" audit_severity NOT NULL DEFAULT 'info',

  -- Actor
  "actor_type" text NOT NULL,
  "actor_id" text NOT NULL,
  "actor_name" text,
  "actor_ip" inet,

  -- Target
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "target_name" text,

  -- Context
  "request_id" text NOT NULL,
  "trace_id" text,
  "span_id" text,

  -- Event details
  "action" text NOT NULL,
  "outcome" audit_outcome NOT NULL,
  "reason" text,

  -- Change tracking (encrypted at rest in application)
  "before_state" jsonb,
  "after_state" jsonb,
  "diff_state" jsonb,

  -- Metadata
  "metadata" jsonb,
  "tags" text[],

  -- Chain integrity
  "sequence_number" bigint NOT NULL,
  "previous_hash" text,
  "record_hash" text NOT NULL,

  -- Timestamps
  "event_time" timestamptz NOT NULL DEFAULT now(),
  "recorded_at" timestamptz NOT NULL DEFAULT now()
);

-- Audit indexes
CREATE INDEX IF NOT EXISTS "audit_tenant_time_idx"
  ON "audit_records" ("tenant_id", "event_time" DESC);

CREATE INDEX IF NOT EXISTS "audit_actor_idx"
  ON "audit_records" ("actor_id", "event_time" DESC);

CREATE INDEX IF NOT EXISTS "audit_target_idx"
  ON "audit_records" ("target_type", "target_id", "event_time" DESC);

CREATE INDEX IF NOT EXISTS "audit_event_type_idx"
  ON "audit_records" ("event_type", "event_time" DESC);

CREATE INDEX IF NOT EXISTS "audit_request_idx"
  ON "audit_records" ("request_id");

CREATE INDEX IF NOT EXISTS "audit_trace_idx"
  ON "audit_records" ("trace_id")
  WHERE "trace_id" IS NOT NULL;

-- =============================================================================
-- 6. Create policies table (foundation for Policy Engine)
-- =============================================================================
CREATE TYPE "policy_status" AS ENUM ('draft', 'published', 'deprecated', 'archived');

CREATE TABLE IF NOT EXISTS "policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" text NOT NULL,
  "name" text NOT NULL,
  "namespace" text NOT NULL DEFAULT 'default',
  "description" text,
  "version" integer NOT NULL DEFAULT 1,
  "status" policy_status NOT NULL DEFAULT 'draft',

  -- Policy definition
  "definition" jsonb NOT NULL,
  "checksum" text NOT NULL,

  -- Audit
  "created_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "published_at" timestamptz,

  -- Unique constraint on tenant + namespace + name + version
  CONSTRAINT "policies_tenant_name_version_unique"
    UNIQUE ("tenant_id", "namespace", "name", "version")
);

CREATE INDEX IF NOT EXISTS "policies_tenant_status_idx"
  ON "policies" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "policies_namespace_idx"
  ON "policies" ("namespace")
  WHERE "status" = 'published';

-- Policy versions for history
CREATE TABLE IF NOT EXISTS "policy_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "policy_id" uuid NOT NULL REFERENCES "policies"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "definition" jsonb NOT NULL,
  "checksum" text NOT NULL,
  "change_summary" text,
  "created_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "policy_versions_unique" UNIQUE ("policy_id", "version")
);

CREATE INDEX IF NOT EXISTS "policy_versions_policy_idx"
  ON "policy_versions" ("policy_id");

-- =============================================================================
-- 7. Create encryption_keys table (for key rotation)
-- =============================================================================
CREATE TYPE "encryption_key_status" AS ENUM ('pending', 'active', 'rotating', 'expired', 'revoked');

CREATE TABLE IF NOT EXISTS "encryption_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" text, -- NULL for system-wide keys

  -- Key identification
  "key_id" text NOT NULL UNIQUE,
  "version" integer NOT NULL DEFAULT 1,

  -- Key material (encrypted with master key from KMS)
  "encrypted_key" bytea NOT NULL,
  "key_checksum" text NOT NULL,

  -- Algorithm
  "algorithm" text NOT NULL DEFAULT 'aes-256-gcm',

  -- Status
  "status" encryption_key_status NOT NULL DEFAULT 'pending',

  -- Lifecycle
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "activated_at" timestamptz,
  "rotated_at" timestamptz,
  "expires_at" timestamptz,
  "revoked_at" timestamptz,

  -- Usage tracking
  "last_used_at" timestamptz,
  "usage_count" bigint DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "encryption_keys_tenant_status_idx"
  ON "encryption_keys" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "encryption_keys_expiry_idx"
  ON "encryption_keys" ("status", "expires_at")
  WHERE "status" = 'active';

-- =============================================================================
-- 8. Update function for updated_at timestamp
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_intents_updated_at ON intents;
CREATE TRIGGER update_intents_updated_at
  BEFORE UPDATE ON intents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_escalations_updated_at ON escalations;
CREATE TRIGGER update_escalations_updated_at
  BEFORE UPDATE ON escalations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_policies_updated_at ON policies;
CREATE TRIGGER update_policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
