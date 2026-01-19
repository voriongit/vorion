/**
 * Trust Schema
 *
 * Database schema for trust records, signals, and history.
 *
 * @packageDocumentation
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

/**
 * Trust level enum (0-4)
 */
export const trustLevelEnum = pgEnum('trust_level', ['0', '1', '2', '3', '4']);

/**
 * Trust records table - current trust state for entities
 */
export const trustRecords = pgTable(
  'trust_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id').notNull().unique(),

    // Current score (0-1000)
    score: integer('score').notNull().default(200),
    level: trustLevelEnum('level').notNull().default('1'),

    // Component scores (0.0 - 1.0)
    behavioralScore: real('behavioral_score').notNull().default(0.5),
    complianceScore: real('compliance_score').notNull().default(0.5),
    identityScore: real('identity_score').notNull().default(0.5),
    contextScore: real('context_score').notNull().default(0.5),

    // Metadata
    signalCount: integer('signal_count').notNull().default(0),
    lastCalculatedAt: timestamp('last_calculated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    entityIdIdx: index('trust_records_entity_id_idx').on(table.entityId),
    scoreIdx: index('trust_records_score_idx').on(table.score),
    levelIdx: index('trust_records_level_idx').on(table.level),
  })
);

/**
 * Trust signals table - behavioral events affecting trust
 */
export const trustSignals = pgTable(
  'trust_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id').notNull(),

    // Signal details
    type: text('type').notNull(), // e.g., 'behavioral.success', 'compliance.violation'
    value: real('value').notNull(), // 0.0 - 1.0
    weight: real('weight').notNull().default(1.0),

    // Context
    source: text('source'), // Where the signal came from
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    // Timestamp
    timestamp: timestamp('timestamp', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    entityIdIdx: index('trust_signals_entity_id_idx').on(table.entityId),
    typeIdx: index('trust_signals_type_idx').on(table.type),
    timestampIdx: index('trust_signals_timestamp_idx').on(table.timestamp),
    // Composite for efficient signal queries
    entityTimestampIdx: index('trust_signals_entity_timestamp_idx').on(
      table.entityId,
      table.timestamp
    ),
  })
);

/**
 * Trust history table - significant score changes
 */
export const trustHistory = pgTable(
  'trust_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id').notNull(),

    // Score snapshot
    score: integer('score').notNull(),
    previousScore: integer('previous_score'),
    level: trustLevelEnum('level').notNull(),
    previousLevel: trustLevelEnum('previous_level'),

    // Change details
    reason: text('reason').notNull(),
    signalId: uuid('signal_id'), // Reference to triggering signal

    // Timestamp
    timestamp: timestamp('timestamp', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    entityIdIdx: index('trust_history_entity_id_idx').on(table.entityId),
    timestampIdx: index('trust_history_timestamp_idx').on(table.timestamp),
    // For history queries with ordering
    entityTimestampIdx: index('trust_history_entity_timestamp_idx').on(
      table.entityId,
      table.timestamp
    ),
  })
);

// Types
export type TrustRecord = typeof trustRecords.$inferSelect;
export type NewTrustRecord = typeof trustRecords.$inferInsert;
export type TrustSignal = typeof trustSignals.$inferSelect;
export type NewTrustSignal = typeof trustSignals.$inferInsert;
export type TrustHistory = typeof trustHistory.$inferSelect;
export type NewTrustHistory = typeof trustHistory.$inferInsert;
