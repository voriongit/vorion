-- =============================================================================
-- COGNIGATE Module Schema Down Migration
-- Migration: 0001_cognigate_schema (ROLLBACK)
-- Created: 2026-01-22
-- Description: Drops all tables, indexes, and enums for the cognigate module
-- =============================================================================

-- ---------------------------------------------------------------------------
-- REMOVE MIGRATION RECORD
-- ---------------------------------------------------------------------------

DELETE FROM cognigate_migrations WHERE name = '0001_cognigate_schema';

-- ---------------------------------------------------------------------------
-- DROP INDEXES (in reverse order)
-- ---------------------------------------------------------------------------

-- Cognigate Webhook Deliveries indexes
DROP INDEX IF EXISTS cognigate_webhook_deliveries_event_type_idx;
DROP INDEX IF EXISTS cognigate_webhook_deliveries_status_idx;
DROP INDEX IF EXISTS cognigate_webhook_deliveries_pending_idx;
DROP INDEX IF EXISTS cognigate_webhook_deliveries_tenant_idx;

-- Cognigate Escalations indexes
DROP INDEX IF EXISTS cognigate_escalations_priority_idx;
DROP INDEX IF EXISTS cognigate_escalations_intent_idx;
DROP INDEX IF EXISTS cognigate_escalations_tenant_status_idx;
DROP INDEX IF EXISTS cognigate_escalations_execution_idx;

-- Cognigate Audit Records indexes
DROP INDEX IF EXISTS cognigate_audit_handler_idx;
DROP INDEX IF EXISTS cognigate_audit_severity_idx;
DROP INDEX IF EXISTS cognigate_audit_trace_idx;
DROP INDEX IF EXISTS cognigate_audit_event_type_idx;
DROP INDEX IF EXISTS cognigate_audit_intent_idx;
DROP INDEX IF EXISTS cognigate_audit_execution_idx;
DROP INDEX IF EXISTS cognigate_audit_tenant_time_idx;

-- Cognigate Events indexes
DROP INDEX IF EXISTS cognigate_events_type_idx;
DROP INDEX IF EXISTS cognigate_events_tenant_idx;
DROP INDEX IF EXISTS cognigate_events_execution_idx;

-- Cognigate Executions indexes
DROP INDEX IF EXISTS cognigate_executions_deleted_at_idx;
DROP INDEX IF EXISTS cognigate_executions_started_at_idx;
DROP INDEX IF EXISTS cognigate_executions_tenant_handler_idx;
DROP INDEX IF EXISTS cognigate_executions_handler_idx;
DROP INDEX IF EXISTS cognigate_executions_tenant_status_idx;
DROP INDEX IF EXISTS cognigate_executions_intent_idx;
DROP INDEX IF EXISTS cognigate_executions_tenant_created_idx;

-- ---------------------------------------------------------------------------
-- DROP TABLES (in reverse dependency order)
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS cognigate_webhook_deliveries;
DROP TABLE IF EXISTS cognigate_escalations;
DROP TABLE IF EXISTS cognigate_audit_records;
DROP TABLE IF EXISTS cognigate_events;
DROP TABLE IF EXISTS cognigate_executions;
DROP TABLE IF EXISTS cognigate_migrations;

-- ---------------------------------------------------------------------------
-- DROP ENUM TYPES
-- ---------------------------------------------------------------------------

DROP TYPE IF EXISTS cognigate_webhook_status;
DROP TYPE IF EXISTS cognigate_audit_outcome;
DROP TYPE IF EXISTS cognigate_audit_severity;
DROP TYPE IF EXISTS cognigate_escalation_priority;
DROP TYPE IF EXISTS cognigate_escalation_status;
DROP TYPE IF EXISTS cognigate_execution_status;
