/**
 * COGNIGATE Module Database Schema
 *
 * Drizzle ORM schema definitions for constrained execution records,
 * execution events, audit records, escalations, and webhook deliveries.
 * Provides persistent storage for the execution runtime engine.
 *
 * @packageDocumentation
 */

import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  jsonb,
  timestamp,
  integer,
  index,
  real,
} from 'drizzle-orm/pg-core';

// =============================================================================
// EXECUTION STATUS TYPES
// =============================================================================

/**
 * Possible execution statuses throughout the lifecycle
 */
export type ExecutionStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled'
  | 'terminated'
  | 'retrying';

/**
 * Escalation priority levels
 */
export type EscalationPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Escalation status values
 */
export type EscalationStatus = 'pending' | 'acknowledged' | 'resolved' | 'expired';

/**
 * Audit record severity levels
 */
export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Audit record outcome types
 */
export type AuditOutcome = 'success' | 'failure' | 'partial';

/**
 * Webhook delivery status values
 */
export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying';

// =============================================================================
// COGNIGATE EXECUTIONS
// =============================================================================

/**
 * Cognigate executions table - Main execution records
 *
 * This table provides:
 * - Complete execution history for audit and compliance
 * - Tracking of resource usage and constraint violations
 * - Support for execution replay and analysis
 * - GDPR-compliant soft delete support
 * - Parent-child execution relationships
 * - Distributed tracing correlation
 */
export const cognigateExecutions = pgTable('cognigate_executions', {
  /** Unique execution record identifier */
  id: text('id').primaryKey(),

  /** Tenant identifier for multi-tenancy */
  tenantId: text('tenant_id').notNull(),

  /** Reference to the approved intent being executed */
  intentId: text('intent_id').notNull(),

  /** Reference to the entity initiating execution */
  entityId: text('entity_id').notNull(),

  /** Unique execution identifier (for idempotency) */
  executionId: text('execution_id').notNull().unique(),

  /** Name of the handler processing the execution */
  handlerName: text('handler_name').notNull(),

  /** Version of the handler at execution time */
  handlerVersion: text('handler_version'),

  /** Current execution status */
  status: text('status').notNull(),

  /** Execution priority (higher = more priority) */
  priority: integer('priority').default(0),

  /** Resource limits applied to this execution */
  resourceLimits: jsonb('resource_limits'),

  /** Actual resource usage during execution */
  resourceUsage: jsonb('resource_usage'),

  /** Execution outputs */
  outputs: jsonb('outputs'),

  /** Error message if execution failed */
  error: text('error'),

  /** Number of retry attempts */
  retryCount: integer('retry_count').default(0),

  /** Parent execution ID for hierarchical executions */
  parentExecutionId: text('parent_execution_id'),

  /** Correlation ID for related operations */
  correlationId: text('correlation_id'),

  /** OpenTelemetry trace ID */
  traceId: text('trace_id'),

  /** OpenTelemetry span ID */
  spanId: text('span_id'),

  /** Request ID for HTTP correlation */
  requestId: text('request_id'),

  /** Sandbox configuration used for this execution */
  sandboxConfig: jsonb('sandbox_config'),

  /** Constraint violations detected during execution */
  violations: jsonb('violations'),

  /** Cryptographic proof hash of execution results */
  proofHash: text('proof_hash'),

  /** Execution deadline (hard timeout) */
  deadline: timestamp('deadline', { withTimezone: true }),

  /** When execution actually started */
  startedAt: timestamp('started_at', { withTimezone: true }),

  /** When execution completed (success or failure) */
  completedAt: timestamp('completed_at', { withTimezone: true }),

  /** Total execution duration in milliseconds */
  durationMs: real('duration_ms'),

  /** Execution context data */
  context: jsonb('context'),

  /** Additional metadata */
  metadata: jsonb('metadata'),

  /** Record creation timestamp */
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

  /** Record last update timestamp */
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

  /** GDPR soft delete timestamp */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  /** Primary query pattern: tenant + creation time */
  tenantCreatedIdx: index('cognigate_exec_tenant_created_idx').on(
    table.tenantId,
    table.createdAt
  ),
  /** Intent lookup */
  intentIdx: index('cognigate_exec_intent_idx').on(table.intentId),
  /** Entity lookup */
  entityIdx: index('cognigate_exec_entity_idx').on(table.entityId),
  /** Execution ID lookup */
  executionIdIdx: index('cognigate_exec_execution_id_idx').on(table.executionId),
  /** Status queries per tenant */
  tenantStatusIdx: index('cognigate_exec_tenant_status_idx').on(
    table.tenantId,
    table.status
  ),
  /** Handler analysis per tenant */
  tenantHandlerCreatedIdx: index('cognigate_exec_tenant_handler_created_idx').on(
    table.tenantId,
    table.handlerName,
    table.createdAt
  ),
  /** Distributed tracing lookup */
  traceIdx: index('cognigate_exec_trace_idx').on(table.traceId),
  /** Request correlation lookup */
  requestIdx: index('cognigate_exec_request_idx').on(table.requestId),
  /** Parent execution lookup */
  parentIdx: index('cognigate_exec_parent_idx').on(table.parentExecutionId),
  /** Correlation ID lookup */
  correlationIdx: index('cognigate_exec_correlation_idx').on(table.correlationId),
  /** Soft delete cleanup */
  deletedAtIdx: index('cognigate_exec_deleted_at_idx').on(table.deletedAt),
}));

// =============================================================================
// COGNIGATE EVENTS (Event Sourcing)
// =============================================================================

/**
 * Cognigate events table - Event sourcing for execution lifecycle
 *
 * Provides:
 * - Immutable event log for execution state transitions
 * - Cryptographic hash chain for tamper detection
 * - Complete execution lifecycle reconstruction
 */
export const cognigateEvents = pgTable('cognigate_events', {
  /** Unique event identifier */
  id: text('id').primaryKey(),

  /** Reference to the execution this event belongs to */
  executionId: text('execution_id')
    .notNull()
    .references(() => cognigateExecutions.id),

  /** Type of lifecycle event (e.g., 'execution.started', 'execution.completed') */
  eventType: text('event_type').notNull(),

  /** Event payload data */
  payload: jsonb('payload'),

  /** When the event occurred */
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),

  /** Cryptographic hash of this event for integrity verification */
  hash: text('hash'),

  /** Hash of the previous event in the chain */
  previousHash: text('previous_hash'),
}, (table) => ({
  /** Execution event timeline */
  executionOccurredIdx: index('cognigate_events_execution_occurred_idx').on(
    table.executionId,
    table.occurredAt
  ),
  /** Event type analysis */
  eventTypeIdx: index('cognigate_events_type_idx').on(table.eventType),
}));

// =============================================================================
// COGNIGATE AUDIT RECORDS
// =============================================================================

/**
 * Cognigate audit records table - SOC2 compliant audit trail
 *
 * Records all significant actions within the execution runtime for
 * compliance, debugging, and security analysis.
 */
export const cognigateAuditRecords = pgTable('cognigate_audit_records', {
  /** Unique audit record identifier */
  id: text('id').primaryKey(),

  /** Tenant identifier for multi-tenancy */
  tenantId: text('tenant_id').notNull(),

  /** Type of auditable event */
  eventType: text('event_type').notNull(),

  /** Severity level of the event */
  severity: text('severity').notNull(),

  /** Outcome of the audited action */
  outcome: text('outcome').notNull(),

  /** Related execution ID (if applicable) */
  executionId: text('execution_id'),

  /** Related intent ID (if applicable) */
  intentId: text('intent_id'),

  /** Related entity ID (if applicable) */
  entityId: text('entity_id'),

  /** Handler name involved in the event */
  handlerName: text('handler_name'),

  /** Specific action taken */
  action: text('action'),

  /** Human-readable reason for the action */
  reason: text('reason'),

  /** Resource usage at event time */
  resourceUsage: jsonb('resource_usage'),

  /** Violation details if applicable */
  violation: jsonb('violation'),

  /** Actor who triggered the event */
  actorId: text('actor_id'),

  /** Type of actor (system, user, service) */
  actorType: text('actor_type'),

  /** HTTP request ID for correlation */
  requestId: text('request_id'),

  /** OpenTelemetry trace ID */
  traceId: text('trace_id'),

  /** OpenTelemetry span ID */
  spanId: text('span_id'),

  /** Duration of the audited operation in milliseconds */
  durationMs: real('duration_ms'),

  /** State before the action */
  beforeState: jsonb('before_state'),

  /** State after the action */
  afterState: jsonb('after_state'),

  /** Additional metadata */
  metadata: jsonb('metadata'),

  /** When the event actually occurred */
  eventTime: timestamp('event_time', { withTimezone: true }).notNull(),

  /** When the audit record was persisted */
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  /** Primary query pattern: tenant + event time */
  tenantEventTimeIdx: index('cognigate_audit_tenant_event_time_idx').on(
    table.tenantId,
    table.eventTime
  ),
  /** Execution lookup */
  executionIdx: index('cognigate_audit_execution_idx').on(table.executionId),
  /** Intent lookup */
  intentIdx: index('cognigate_audit_intent_idx').on(table.intentId),
  /** Event type analysis */
  eventTypeTimeIdx: index('cognigate_audit_event_type_time_idx').on(
    table.eventType,
    table.eventTime
  ),
  /** Trace correlation */
  traceIdx: index('cognigate_audit_trace_idx').on(table.traceId),
  /** Severity-based queries */
  tenantSeverityTimeIdx: index('cognigate_audit_tenant_severity_time_idx').on(
    table.tenantId,
    table.severity,
    table.eventTime
  ),
}));

// =============================================================================
// COGNIGATE ESCALATIONS
// =============================================================================

/**
 * Cognigate escalations table - Execution escalation tracking
 *
 * Tracks executions that require human intervention, such as:
 * - Resource limit violations
 * - Suspicious execution patterns
 * - Policy violations during execution
 * - Handler failures requiring review
 */
export const cognigateEscalations = pgTable('cognigate_escalations', {
  /** Unique escalation identifier */
  id: text('id').primaryKey(),

  /** Reference to the execution that triggered escalation */
  executionId: text('execution_id')
    .references(() => cognigateExecutions.id),

  /** Tenant identifier for multi-tenancy */
  tenantId: text('tenant_id').notNull(),

  /** Related intent ID */
  intentId: text('intent_id'),

  /** Reason for escalation */
  reason: text('reason').notNull(),

  /** Escalation priority level */
  priority: text('priority'),

  /** Target recipient for escalation */
  escalatedTo: text('escalated_to'),

  /** Who/what initiated the escalation */
  escalatedBy: text('escalated_by'),

  /** Current escalation status */
  status: text('status').notNull(),

  /** Who resolved the escalation */
  resolvedBy: text('resolved_by'),

  /** When the escalation was resolved */
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),

  /** Action taken to resolve */
  resolutionAction: text('resolution_action'),

  /** Notes about the resolution */
  resolutionNotes: text('resolution_notes'),

  /** Violation details that triggered escalation */
  violation: jsonb('violation'),

  /** Timeout duration (ISO 8601 format) */
  timeout: text('timeout'),

  /** When the escalation will expire */
  timeoutAt: timestamp('timeout_at', { withTimezone: true }),

  /** When the escalation was acknowledged */
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),

  /** Additional context for the escalation */
  context: jsonb('context'),

  /** Additional metadata */
  metadata: jsonb('metadata'),

  /** Record creation timestamp */
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

  /** Record last update timestamp */
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  /** Primary query pattern: tenant + status + creation time */
  tenantStatusCreatedIdx: index('cognigate_escalations_tenant_status_created_idx').on(
    table.tenantId,
    table.status,
    table.createdAt
  ),
  /** Execution lookup */
  executionIdx: index('cognigate_escalations_execution_idx').on(table.executionId),
  /** Intent lookup */
  intentIdx: index('cognigate_escalations_intent_idx').on(table.intentId),
  /** Timeout monitoring */
  timeoutAtIdx: index('cognigate_escalations_timeout_at_idx').on(table.timeoutAt),
  /** Pending timeout checks */
  statusTimeoutIdx: index('cognigate_escalations_status_timeout_idx').on(
    table.status,
    table.timeoutAt
  ),
  /** Priority-based queries */
  tenantPriorityStatusIdx: index('cognigate_escalations_tenant_priority_status_idx').on(
    table.tenantId,
    table.priority,
    table.status
  ),
}));

// =============================================================================
// COGNIGATE WEBHOOK DELIVERIES
// =============================================================================

/**
 * Cognigate webhook deliveries table - Webhook delivery tracking
 *
 * Tracks webhook delivery attempts for execution lifecycle events,
 * supporting retry logic with exponential backoff.
 */
export const cognigateWebhookDeliveries = pgTable('cognigate_webhook_deliveries', {
  /** Unique delivery record identifier */
  id: text('id').primaryKey(),

  /** Reference to the webhook configuration */
  webhookId: text('webhook_id').notNull(),

  /** Tenant identifier for multi-tenancy */
  tenantId: text('tenant_id').notNull(),

  /** Type of event being delivered */
  eventType: text('event_type').notNull(),

  /** Webhook payload */
  payload: jsonb('payload'),

  /** Current delivery status */
  status: text('status'),

  /** Number of delivery attempts */
  attempts: integer('attempts').default(0),

  /** Timestamp of the last delivery attempt */
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),

  /** Error message from last failed attempt */
  lastError: text('last_error'),

  /** When to retry next (for exponential backoff) */
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

  /** When the webhook was successfully delivered */
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),

  /** HTTP response status code from target */
  responseStatus: integer('response_status'),

  /** HTTP response body from target (truncated) */
  responseBody: text('response_body'),

  /** Record creation timestamp */
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  /** Webhook-specific queries */
  webhookCreatedIdx: index('cognigate_webhook_deliveries_webhook_created_idx').on(
    table.webhookId,
    table.createdAt
  ),
  /** Tenant-specific queries */
  tenantCreatedIdx: index('cognigate_webhook_deliveries_tenant_created_idx').on(
    table.tenantId,
    table.createdAt
  ),
  /** Pending retry processing */
  statusNextRetryIdx: index('cognigate_webhook_deliveries_status_next_retry_idx').on(
    table.status,
    table.nextRetryAt
  ),
  /** Tenant status overview */
  tenantStatusIdx: index('cognigate_webhook_deliveries_tenant_status_idx').on(
    table.tenantId,
    table.status
  ),
}));

// =============================================================================
// RELATIONS
// =============================================================================

/**
 * Execution relations - links executions to events and escalations
 */
export const executionRelations = relations(cognigateExecutions, ({ many }) => ({
  events: many(cognigateEvents),
  escalations: many(cognigateEscalations),
}));

/**
 * Event relations - links events back to their execution
 */
export const eventRelations = relations(cognigateEvents, ({ one }) => ({
  execution: one(cognigateExecutions, {
    fields: [cognigateEvents.executionId],
    references: [cognigateExecutions.id],
  }),
}));

/**
 * Escalation relations - links escalations back to their execution
 */
export const escalationRelations = relations(cognigateEscalations, ({ one }) => ({
  execution: one(cognigateExecutions, {
    fields: [cognigateEscalations.executionId],
    references: [cognigateExecutions.id],
  }),
}));

// =============================================================================
// TYPE EXPORTS
// =============================================================================

/** Inferred select type for execution records */
export type CognigateExecutionRow = typeof cognigateExecutions.$inferSelect;

/** Inferred insert type for execution records */
export type NewCognigateExecutionRow = typeof cognigateExecutions.$inferInsert;

/** Inferred select type for event records */
export type CognigateEventRow = typeof cognigateEvents.$inferSelect;

/** Inferred insert type for event records */
export type NewCognigateEventRow = typeof cognigateEvents.$inferInsert;

/** Inferred select type for audit records */
export type CognigateAuditRecordRow = typeof cognigateAuditRecords.$inferSelect;

/** Inferred insert type for audit records */
export type NewCognigateAuditRecordRow = typeof cognigateAuditRecords.$inferInsert;

/** Inferred select type for escalation records */
export type CognigateEscalationRow = typeof cognigateEscalations.$inferSelect;

/** Inferred insert type for escalation records */
export type NewCognigateEscalationRow = typeof cognigateEscalations.$inferInsert;

/** Inferred select type for webhook delivery records */
export type CognigateWebhookDeliveryRow = typeof cognigateWebhookDeliveries.$inferSelect;

/** Inferred insert type for webhook delivery records */
export type NewCognigateWebhookDeliveryRow = typeof cognigateWebhookDeliveries.$inferInsert;
