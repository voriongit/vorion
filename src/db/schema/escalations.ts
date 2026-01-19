/**
 * Escalation Schema
 *
 * Database schema for escalation requests and decisions.
 *
 * @packageDocumentation
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

/**
 * Escalation status enum
 */
export const escalationStatusEnum = pgEnum('escalation_status', [
  'pending',
  'approved',
  'rejected',
  'timeout',
  'cancelled',
]);

/**
 * Escalation priority enum
 */
export const escalationPriorityEnum = pgEnum('escalation_priority', [
  'low',
  'medium',
  'high',
  'critical',
]);

/**
 * Escalations table
 */
export const escalations = pgTable(
  'escalations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    intentId: uuid('intent_id').notNull(),
    entityId: uuid('entity_id').notNull(),

    // Escalation details
    reason: text('reason').notNull(),
    priority: escalationPriorityEnum('priority').notNull().default('medium'),
    status: escalationStatusEnum('status').notNull().default('pending'),

    // Assignment
    escalatedTo: text('escalated_to').notNull(), // Role or user ID
    escalatedBy: uuid('escalated_by'), // System or user who triggered escalation

    // Context
    context: jsonb('context').$type<Record<string, unknown>>(),
    requestedAction: text('requested_action'), // What action was requested

    // Resolution
    resolvedBy: uuid('resolved_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolution: text('resolution'),
    resolutionNotes: text('resolution_notes'),

    // Timeout
    timeoutAt: timestamp('timeout_at', { withTimezone: true }).notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('escalations_tenant_id_idx').on(table.tenantId),
    intentIdIdx: index('escalations_intent_id_idx').on(table.intentId),
    entityIdIdx: index('escalations_entity_id_idx').on(table.entityId),
    statusIdx: index('escalations_status_idx').on(table.status),
    escalatedToIdx: index('escalations_escalated_to_idx').on(table.escalatedTo),
    timeoutAtIdx: index('escalations_timeout_at_idx').on(table.timeoutAt),
    // Composite for tenant-scoped queries
    tenantStatusIdx: index('escalations_tenant_status_idx').on(
      table.tenantId,
      table.status
    ),
  })
);

/**
 * Escalation audit log
 */
export const escalationAudit = pgTable(
  'escalation_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    escalationId: uuid('escalation_id').notNull(),
    tenantId: uuid('tenant_id').notNull(),

    // Action details
    action: text('action').notNull(), // created, approved, rejected, reassigned, etc.
    actorId: uuid('actor_id'), // User who performed action (null for system)
    actorType: text('actor_type').notNull().default('user'), // user, system, timeout

    // State change
    previousStatus: escalationStatusEnum('previous_status'),
    newStatus: escalationStatusEnum('new_status'),

    // Details
    details: jsonb('details').$type<Record<string, unknown>>(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    // Timestamp
    timestamp: timestamp('timestamp', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    escalationIdIdx: index('escalation_audit_escalation_id_idx').on(
      table.escalationId
    ),
    tenantIdIdx: index('escalation_audit_tenant_id_idx').on(table.tenantId),
    timestampIdx: index('escalation_audit_timestamp_idx').on(table.timestamp),
  })
);

// Types
export type Escalation = typeof escalations.$inferSelect;
export type NewEscalation = typeof escalations.$inferInsert;
export type EscalationAudit = typeof escalationAudit.$inferSelect;
export type NewEscalationAudit = typeof escalationAudit.$inferInsert;
