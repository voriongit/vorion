/**
 * Trust Scores Schema
 *
 * Drizzle ORM schema for atsf-core trust engine persistence.
 */

import { pgTable, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core'

/**
 * Trust scores table for AI agent trust records
 */
export const trustScores = pgTable('trust_scores', {
  entityId: text('entity_id').primaryKey().notNull(),
  score: integer('score').notNull().default(100),
  level: integer('level').notNull().default(1),
  components: jsonb('components').notNull().default({
    behavioral: 0.5,
    compliance: 0.5,
    identity: 0.5,
    context: 0.5,
  }),
  signals: jsonb('signals').notNull().default([]),
  lastCalculatedAt: timestamp('last_calculated_at', { withTimezone: true }).notNull().defaultNow(),
  history: jsonb('history').notNull().default([]),
  recentFailures: text('recent_failures').array().notNull().default([]),
  recentSuccesses: text('recent_successes').array().notNull().default([]),
  peakScore: integer('peak_score').notNull().default(100),
  consecutiveSuccesses: integer('consecutive_successes').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Type for inserting a trust score record
 */
export type InsertTrustScore = typeof trustScores.$inferInsert

/**
 * Type for selecting a trust score record
 */
export type SelectTrustScore = typeof trustScores.$inferSelect
