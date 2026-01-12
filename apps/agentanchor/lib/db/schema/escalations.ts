/**
 * Escalations Schema - Human-in-the-loop review queue
 * FR76-81: Human escalation handling
 */

import { pgTable, uuid, text, timestamp, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { agents } from './agents'
import { councilDecisions } from './council'
import { profiles } from './users'

// Enums
export const escalationStatusEnum = pgEnum('escalation_status', [
  'pending',
  'assigned',
  'in_review',
  'approved',
  'rejected',
  'expired',
])

export const escalationPriorityEnum = pgEnum('escalation_priority', [
  'low',
  'medium',
  'high',
  'critical',
])

// Human Escalations table
export const escalations = pgTable(
  'escalations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Link to the decision that triggered escalation
    decisionId: uuid('decision_id').notNull().references(() => councilDecisions.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    // Escalation details
    status: escalationStatusEnum('status').default('pending').notNull(),
    priority: escalationPriorityEnum('priority').default('medium').notNull(),
    reason: text('reason').notNull(),
    context: jsonb('context').$type<{
      actionType: string
      actionDetails: string
      riskLevel: number
      councilVotes?: Record<string, string>
      precedentConflicts?: string[]
    }>().notNull(),
    // Assignment
    assignedTo: uuid('assigned_to').references(() => profiles.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    // Resolution
    resolution: text('resolution'),
    resolutionReason: text('resolution_reason'),
    resolvedBy: uuid('resolved_by').references(() => profiles.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    // Override creates precedent
    createsPrecedent: jsonb('creates_precedent').$type<boolean>().default(false),
    precedentNote: text('precedent_note'),
    // Expiry (escalations should not sit forever)
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    decisionIdx: index('escalations_decision_idx').on(table.decisionId),
    agentIdx: index('escalations_agent_idx').on(table.agentId),
    statusIdx: index('escalations_status_idx').on(table.status),
    priorityIdx: index('escalations_priority_idx').on(table.priority),
    assignedToIdx: index('escalations_assigned_idx').on(table.assignedTo),
    createdAtIdx: index('escalations_created_at_idx').on(table.createdAt),
  })
)

// Relations
export const escalationsRelations = relations(escalations, ({ one }) => ({
  decision: one(councilDecisions, {
    fields: [escalations.decisionId],
    references: [councilDecisions.id],
  }),
  agent: one(agents, {
    fields: [escalations.agentId],
    references: [agents.id],
  }),
  assignee: one(profiles, {
    fields: [escalations.assignedTo],
    references: [profiles.id],
  }),
  resolver: one(profiles, {
    fields: [escalations.resolvedBy],
    references: [profiles.id],
  }),
}))

// Types
export type Escalation = typeof escalations.$inferSelect
export type NewEscalation = typeof escalations.$inferInsert
