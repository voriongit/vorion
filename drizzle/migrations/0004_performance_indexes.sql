-- Performance Indexes Migration
-- Addresses CRITICAL scalability issues: Missing database indexes causing full table scans
--
-- These indexes optimize hot query paths:
-- 1. intents_tenant_status_idx - used by countActiveIntents()
-- 2. escalations_timeout_status_idx - used by processTimeouts()
-- 3. audit_records_trace_idx - used for distributed tracing queries
--
-- Note: intent_events already has intent_events_intent_idx on (intentId, occurredAt)
--       which covers event chain queries

-- Index for countActiveIntents() queries
-- Optimizes: SELECT COUNT(*) FROM intents WHERE tenant_id = ? AND status = ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS "intents_tenant_status_idx"
ON "intents" ("tenant_id", "status");

-- Index for processTimeouts() queries
-- Optimizes: SELECT * FROM escalations WHERE status = 'pending' AND timeout_at < NOW()
CREATE INDEX CONCURRENTLY IF NOT EXISTS "escalations_timeout_status_idx"
ON "escalations" ("status", "timeout_at");

-- Index for distributed tracing queries
-- Optimizes: SELECT * FROM audit_records WHERE trace_id = ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_records_trace_idx"
ON "audit_records" ("trace_id");
