/**
 * Agents Schema - AI agents and trust history
 */

import { pgTable, uuid, text, timestamp, integer, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { profiles } from './users'

// Enums
export const agentStatusEnum = pgEnum('agent_status', [
  'draft',
  'training',
  'examination',
  'active',
  'suspended',
  'retired',
])

export const trustSourceEnum = pgEnum('trust_source', [
  'council_decision',
  'behavior_analysis',
  'user_feedback',
  'examination',
  'decay',
  'manual_adjustment',
])

// Agents table
export const agents = pgTable(
  'agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    systemPrompt: text('system_prompt'),
    model: text('model').default('claude-3-5-sonnet-20241022').notNull(),
    status: agentStatusEnum('status').default('draft').notNull(),
    // Trust score (0-1000)
    trustScore: integer('trust_score').default(100).notNull(),
    // Configuration
    config: jsonb('config').$type<{
      maxTokens?: number
      temperature?: number
      allowedTools?: string[]
      autonomyLevel?: 'low' | 'medium' | 'high'
    }>().default({}),
    // Metadata
    metadata: jsonb('metadata').$type<{
      category?: string
      tags?: string[]
      version?: string
    }>().default({}),
    // Statistics
    totalInteractions: integer('total_interactions').default(0).notNull(),
    successfulInteractions: integer('successful_interactions').default(0).notNull(),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    graduatedAt: timestamp('graduated_at', { withTimezone: true }),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
  },
  (table) => ({
    ownerIdx: index('agents_owner_idx').on(table.ownerId),
    statusIdx: index('agents_status_idx').on(table.status),
    trustScoreIdx: index('agents_trust_score_idx').on(table.trustScore),
    nameIdx: index('agents_name_idx').on(table.name),
  })
)

// Trust History table - audit trail of all trust score changes
export const trustHistory = pgTable(
  'trust_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    previousScore: integer('previous_score').notNull(),
    newScore: integer('new_score').notNull(),
    change: integer('change').notNull(),
    source: trustSourceEnum('source').notNull(),
    reason: text('reason'),
    // Reference to related entity (e.g., council decision ID)
    referenceId: uuid('reference_id'),
    referenceType: text('reference_type'),
    // Metadata
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    // Timestamp
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    agentIdx: index('trust_history_agent_idx').on(table.agentId),
    createdAtIdx: index('trust_history_created_at_idx').on(table.createdAt),
    sourceIdx: index('trust_history_source_idx').on(table.source),
  })
)

// Relations
export const agentsRelations = relations(agents, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [agents.ownerId],
    references: [profiles.id],
  }),
  trustHistory: many(trustHistory),
}))

export const trustHistoryRelations = relations(trustHistory, ({ one }) => ({
  agent: one(agents, {
    fields: [trustHistory.agentId],
    references: [agents.id],
  }),
}))

// Types
export type Agent = typeof agents.$inferSelect
export type NewAgent = typeof agents.$inferInsert
export type TrustHistory = typeof trustHistory.$inferSelect
export type NewTrustHistory = typeof trustHistory.$inferInsert
