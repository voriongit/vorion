/**
 * Intent Schema
 *
 * Database schema for intent processing and lifecycle tracking.
 *
 * @packageDocumentation
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

/**
 * Intent status enum
 */
export const intentStatusEnum = pgEnum('intent_status', [
  'pending',
  'evaluating',
  'approved',
  'denied',
  'escalated',
  'executing',
  'completed',
  'failed',
]);

/**
 * Intents table
 */
export const intents = pgTable(
  'intents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    entityId: uuid('entity_id').notNull(),

    // Intent details
    goal: text('goal').notNull(),
    context: jsonb('context').notNull().$type<Record<string, unknown>>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    // Processing state
    status: intentStatusEnum('status').notNull().default('pending'),
    priority: integer('priority').notNull().default(0),

    // Queue tracking
    queuedAt: timestamp('queued_at', { withTimezone: true }),
    processingStartedAt: timestamp('processing_started_at', { withTimezone: true }),
    processingCompletedAt: timestamp('processing_completed_at', { withTimezone: true }),
    processAttempts: integer('process_attempts').notNull().default(0),
    lastError: text('last_error'),

    // Decision reference
    decisionId: uuid('decision_id'),
    proofId: uuid('proof_id'),
    escalationId: uuid('escalation_id'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('intents_tenant_id_idx').on(table.tenantId),
    entityIdIdx: index('intents_entity_id_idx').on(table.entityId),
    statusIdx: index('intents_status_idx').on(table.status),
    priorityIdx: index('intents_priority_idx').on(table.priority),
    createdAtIdx: index('intents_created_at_idx').on(table.createdAt),
    // Composite for queue processing
    statusPriorityIdx: index('intents_status_priority_idx').on(
      table.status,
      table.priority,
      table.createdAt
    ),
    // Tenant scoped status queries
    tenantStatusIdx: index('intents_tenant_status_idx').on(
      table.tenantId,
      table.status
    ),
  })
);

/**
 * Intent processing log
 */
export const intentProcessingLog = pgTable(
  'intent_processing_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    intentId: uuid('intent_id').notNull(),
    tenantId: uuid('tenant_id').notNull(),

    // Processing details
    phase: text('phase').notNull(), // queued, started, completed, failed, retried
    previousStatus: intentStatusEnum('previous_status'),
    newStatus: intentStatusEnum('new_status'),

    // Performance
    durationMs: integer('duration_ms'),
    attempt: integer('attempt'),

    // Details
    details: jsonb('details').$type<Record<string, unknown>>(),
    error: text('error'),

    // Timestamp
    timestamp: timestamp('timestamp', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    intentIdIdx: index('intent_processing_log_intent_id_idx').on(table.intentId),
    tenantIdIdx: index('intent_processing_log_tenant_id_idx').on(table.tenantId),
    timestampIdx: index('intent_processing_log_timestamp_idx').on(table.timestamp),
  })
);

// Types
export type IntentRecord = typeof intents.$inferSelect;
export type NewIntent = typeof intents.$inferInsert;
export type IntentProcessingLog = typeof intentProcessingLog.$inferSelect;
export type NewIntentProcessingLog = typeof intentProcessingLog.$inferInsert;
