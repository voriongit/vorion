import { relations } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { INTENT_STATUSES } from '../common/types.js';

export const intentStatusEnum = pgEnum('intent_status', [...INTENT_STATUSES]);

export const intents = pgTable('intents', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: text('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(),
  goal: text('goal').notNull(),
  intentType: text('intent_type'),
  priority: integer('priority').default(0),
  status: intentStatusEnum('status').notNull().default('pending'),
  trustSnapshot: jsonb('trust_snapshot'),
  context: jsonb('context').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  dedupeHash: text('dedupe_hash').notNull(),
  trustLevel: integer('trust_level'),
  trustScore: integer('trust_score'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  // GDPR soft delete
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  // Cancellation support
  cancellationReason: text('cancellation_reason'),
}, (table) => ({
  tenantCreatedIdx: index('intents_tenant_created_idx').on(
    table.tenantId,
    table.createdAt
  ),
  dedupeIdx: uniqueIndex('intents_tenant_dedupe_idx').on(
    table.tenantId,
    table.dedupeHash
  ),
  // Soft delete index for cleanup job
  deletedAtIdx: index('intents_deleted_at_idx').on(table.deletedAt),
}));

export const intentEvents = pgTable('intent_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  intentId: uuid('intent_id')
    .notNull()
    .references(() => intents.id),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Cryptographic hash for tamper detection (SHA-256)
  hash: text('hash'),
  // Previous event hash for chain integrity
  previousHash: text('previous_hash'),
}, (table) => ({
  intentEventIdx: index('intent_events_intent_idx').on(
    table.intentId,
    table.occurredAt
  ),
}));

export const intentEvaluations = pgTable('intent_evaluations', {
  id: uuid('id').defaultRandom().primaryKey(),
  intentId: uuid('intent_id')
    .notNull()
    .references(() => intents.id),
  tenantId: text('tenant_id').notNull(),
  result: jsonb('result').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const intentRelations = relations(intents, ({ many }) => ({
  events: many(intentEvents),
  evaluations: many(intentEvaluations),
}));

export type IntentRow = typeof intents.$inferSelect;
export type NewIntentRow = typeof intents.$inferInsert;
export type IntentEventRow = typeof intentEvents.$inferSelect;
export type NewIntentEventRow = typeof intentEvents.$inferInsert;
export type IntentEvaluationRow = typeof intentEvaluations.$inferSelect;
export type NewIntentEvaluationRow = typeof intentEvaluations.$inferInsert;
