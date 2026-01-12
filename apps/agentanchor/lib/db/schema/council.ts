/**
 * Council Schema - Governance decisions
 */

import { pgTable, uuid, text, timestamp, integer, jsonb, pgEnum, index, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { agents } from './agents'

// Enums
export const decisionTypeEnum = pgEnum('decision_type', [
  'approval',
  'rejection',
  'modification',
  'escalation',
  'suspension',
  'reinstatement',
])

export const decisionStatusEnum = pgEnum('decision_status', [
  'pending',
  'approved',
  'rejected',
  'escalated',
  'overridden',
])

// Council Decisions table
export const councilDecisions = pgTable(
  'council_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    // Decision details
    decisionType: decisionTypeEnum('decision_type').notNull(),
    status: decisionStatusEnum('status').default('pending').notNull(),
    // Risk assessment (0-4: Minimal, Low, Medium, High, Critical)
    riskLevel: integer('risk_level').default(0).notNull(),
    // The action/request being evaluated
    subjectAction: text('subject_action').notNull(),
    subjectContext: jsonb('subject_context').$type<Record<string, unknown>>().default({}),
    // Validator reasoning
    reasoning: text('reasoning'),
    validatorAgentId: uuid('validator_agent_id'),
    // Voting (for multi-validator decisions)
    votes: jsonb('votes').$type<{
      for: number
      against: number
      abstain: number
      validators: Array<{
        validatorId: string
        vote: 'for' | 'against' | 'abstain'
        reason?: string
      }>
    }>(),
    // Human override
    humanOverride: boolean('human_override').default(false),
    humanOverrideReason: text('human_override_reason'),
    humanOverrideBy: uuid('human_override_by'),
    // Trust impact
    trustImpact: integer('trust_impact').default(0),
    // Precedent reference
    precedentId: uuid('precedent_id'),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => ({
    agentIdx: index('council_decisions_agent_idx').on(table.agentId),
    statusIdx: index('council_decisions_status_idx').on(table.status),
    riskLevelIdx: index('council_decisions_risk_level_idx').on(table.riskLevel),
    createdAtIdx: index('council_decisions_created_at_idx').on(table.createdAt),
    decisionTypeIdx: index('council_decisions_type_idx').on(table.decisionType),
  })
)

// Relations
export const councilDecisionsRelations = relations(councilDecisions, ({ one }) => ({
  agent: one(agents, {
    fields: [councilDecisions.agentId],
    references: [agents.id],
  }),
  validator: one(agents, {
    fields: [councilDecisions.validatorAgentId],
    references: [agents.id],
  }),
  precedent: one(councilDecisions, {
    fields: [councilDecisions.precedentId],
    references: [councilDecisions.id],
  }),
}))

// Types
export type CouncilDecision = typeof councilDecisions.$inferSelect
export type NewCouncilDecision = typeof councilDecisions.$inferInsert
