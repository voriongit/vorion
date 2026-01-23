-- =============================================================================
-- COGNIGATE Module Schema Migration
-- Migration: 0001_cognigate_schema
-- Created: 2026-01-22
-- Description: Creates all tables and indexes for the cognigate module
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE cognigate_execution_status AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled',
    'timeout'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cognigate_escalation_status AS ENUM (
    'pending',
    'acknowledged',
    'approved',
    'rejected',
    'timeout',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cognigate_escalation_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cognigate_audit_severity AS ENUM (
    'info',
    'warning',
    'error',
    'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cognigate_audit_outcome AS ENUM (
    'success',
    'failure',
    'timeout',
    'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cognigate_webhook_status AS ENUM (
    'pending',
    'delivered',
    'failed',
    'retrying'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

-- Cognigate Executions
CREATE TABLE IF NOT EXISTS cognigate_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  intent_id UUID NOT NULL,
  handler_name TEXT NOT NULL,

  -- Execution state
  status cognigate_execution_status NOT NULL DEFAULT 'pending',

  -- Execution data
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  resource_usage JSONB,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- GDPR soft delete
  deleted_at TIMESTAMPTZ
);

-- Cognigate Events (Event Sourcing)
CREATE TABLE IF NOT EXISTS cognigate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES cognigate_executions(id),
  tenant_id TEXT NOT NULL,

  -- Event details
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cognigate Audit Records
CREATE TABLE IF NOT EXISTS cognigate_audit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,

  -- References
  execution_id UUID,
  intent_id UUID,

  -- Event identification
  event_type TEXT NOT NULL,
  severity cognigate_audit_severity NOT NULL DEFAULT 'info',
  outcome cognigate_audit_outcome NOT NULL,

  -- Action details
  action TEXT,
  reason TEXT,
  handler_name TEXT,

  -- Resource tracking
  resource_usage JSONB,
  violation JSONB,

  -- Tracing
  request_id TEXT,
  trace_id TEXT,
  span_id TEXT,

  -- Performance
  duration_ms INTEGER,

  -- Metadata
  metadata JSONB,

  -- Timestamps
  event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cognigate Escalations
CREATE TABLE IF NOT EXISTS cognigate_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES cognigate_executions(id),
  tenant_id TEXT NOT NULL,
  intent_id UUID NOT NULL,

  -- Escalation details
  rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL,
  priority cognigate_escalation_priority NOT NULL DEFAULT 'medium',

  -- Status
  status cognigate_escalation_status NOT NULL DEFAULT 'pending',

  -- Resolution
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,

  -- Violation context
  violation JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cognigate Webhook Deliveries
CREATE TABLE IF NOT EXISTS cognigate_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  url TEXT NOT NULL,

  -- Delivery data
  payload JSONB NOT NULL,
  status cognigate_webhook_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,

  -- Timing
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  -- Response
  response_status INTEGER,
  response_body TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Cognigate Executions indexes
CREATE INDEX IF NOT EXISTS cognigate_executions_tenant_created_idx
  ON cognigate_executions (tenant_id, created_at);

CREATE INDEX IF NOT EXISTS cognigate_executions_intent_idx
  ON cognigate_executions (intent_id);

CREATE INDEX IF NOT EXISTS cognigate_executions_tenant_status_idx
  ON cognigate_executions (tenant_id, status);

CREATE INDEX IF NOT EXISTS cognigate_executions_handler_idx
  ON cognigate_executions (handler_name, created_at);

CREATE INDEX IF NOT EXISTS cognigate_executions_tenant_handler_idx
  ON cognigate_executions (tenant_id, handler_name, status);

CREATE INDEX IF NOT EXISTS cognigate_executions_started_at_idx
  ON cognigate_executions (started_at);

CREATE INDEX IF NOT EXISTS cognigate_executions_deleted_at_idx
  ON cognigate_executions (deleted_at);

-- Cognigate Events indexes
CREATE INDEX IF NOT EXISTS cognigate_events_execution_idx
  ON cognigate_events (execution_id, created_at);

CREATE INDEX IF NOT EXISTS cognigate_events_tenant_idx
  ON cognigate_events (tenant_id, created_at);

CREATE INDEX IF NOT EXISTS cognigate_events_type_idx
  ON cognigate_events (event_type, created_at);

-- Cognigate Audit Records indexes
CREATE INDEX IF NOT EXISTS cognigate_audit_tenant_time_idx
  ON cognigate_audit_records (tenant_id, event_time);

CREATE INDEX IF NOT EXISTS cognigate_audit_execution_idx
  ON cognigate_audit_records (execution_id);

CREATE INDEX IF NOT EXISTS cognigate_audit_intent_idx
  ON cognigate_audit_records (intent_id);

CREATE INDEX IF NOT EXISTS cognigate_audit_event_type_idx
  ON cognigate_audit_records (event_type, event_time);

CREATE INDEX IF NOT EXISTS cognigate_audit_trace_idx
  ON cognigate_audit_records (trace_id);

CREATE INDEX IF NOT EXISTS cognigate_audit_severity_idx
  ON cognigate_audit_records (tenant_id, severity, event_time);

CREATE INDEX IF NOT EXISTS cognigate_audit_handler_idx
  ON cognigate_audit_records (handler_name, event_time);

-- Cognigate Escalations indexes
CREATE INDEX IF NOT EXISTS cognigate_escalations_execution_idx
  ON cognigate_escalations (execution_id);

CREATE INDEX IF NOT EXISTS cognigate_escalations_tenant_status_idx
  ON cognigate_escalations (tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS cognigate_escalations_intent_idx
  ON cognigate_escalations (intent_id);

CREATE INDEX IF NOT EXISTS cognigate_escalations_priority_idx
  ON cognigate_escalations (tenant_id, priority, status);

-- Cognigate Webhook Deliveries indexes
CREATE INDEX IF NOT EXISTS cognigate_webhook_deliveries_tenant_idx
  ON cognigate_webhook_deliveries (tenant_id, created_at);

CREATE INDEX IF NOT EXISTS cognigate_webhook_deliveries_pending_idx
  ON cognigate_webhook_deliveries (status, next_retry_at);

CREATE INDEX IF NOT EXISTS cognigate_webhook_deliveries_status_idx
  ON cognigate_webhook_deliveries (tenant_id, status);

CREATE INDEX IF NOT EXISTS cognigate_webhook_deliveries_event_type_idx
  ON cognigate_webhook_deliveries (event_type, created_at);

-- ---------------------------------------------------------------------------
-- MIGRATION TRACKING
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cognigate_migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO cognigate_migrations (name)
SELECT '0001_cognigate_schema'
WHERE NOT EXISTS (
  SELECT 1 FROM cognigate_migrations WHERE name = '0001_cognigate_schema'
);
