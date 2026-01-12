/**
 * Trust Bridge Schema - External Agent Certification
 *
 * Tables for managing agent submissions, certifications, and credentials
 * for the Trust Bridge universal agent certification protocol.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
  boolean,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Enums
export const submissionStatusEnum = pgEnum('submission_status', [
  'pending',
  'testing',
  'review',
  'passed',
  'failed',
  'flagged',
  'expired',
  'cancelled',
])

export const certificationTierEnum = pgEnum('certification_tier', [
  'basic',
  'standard',
  'advanced',
  'enterprise',
])

export const originPlatformEnum = pgEnum('origin_platform', [
  'google_antigravity',
  'cursor',
  'claude_code',
  'windsurf',
  'aider',
  'continue',
  'github_copilot',
  'amazon_q',
  'custom',
  'other',
])

export const riskCategoryEnum = pgEnum('risk_category', [
  'low',
  'medium',
  'high',
  'critical',
])

// Trust Bridge Submissions table
export const trustBridgeSubmissions = pgTable(
  'trust_bridge_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trackingId: text('tracking_id').unique().notNull(),
    // Submission data stored as JSONB
    submission: jsonb('submission')
      .$type<{
        name: string
        description: string
        version: string
        origin_platform: string
        capabilities: string[]
        risk_category: string
        contact_email: string
        model_provider?: string
        model_identifier?: string
        system_prompt_hash?: string
        organization?: string
        repository_url?: string
        documentation_url?: string
        safety_documentation?: string
        previous_certifications?: Array<{
          platform: string
          score: number
          date: string
          credential_id?: string
        }>
      }>()
      .notNull(),
    status: submissionStatusEnum('status').default('pending').notNull(),
    queuePosition: integer('queue_position'),
    priorityScore: integer('priority_score').default(0),
    estimatedStart: timestamp('estimated_start', { withTimezone: true }),
    // Test results stored as JSONB
    testResults: jsonb('test_results').$type<{
      session_id: string
      total_score: number
      tests_passed: number
      tests_total: number
      category_scores: Record<string, number>
      flags: string[]
      recommendations: string[]
      duration_ms: number
    }>(),
    testSessionId: uuid('test_session_id'),
    // Certification details
    certification: jsonb('certification').$type<{
      tier: string
      trust_score: number
      credential_token: string
      valid_until: string
      council_reviewed: boolean
    }>(),
    credentialToken: text('credential_token'),
    councilReviewed: boolean('council_reviewed').default(false),
    councilDecisionId: uuid('council_decision_id'),
    reviewNotes: text('review_notes'),
    // Timestamps
    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    // Submitter info
    submitterId: text('submitter_id').notNull(),
    submitterTier: text('submitter_tier').default('free'),
    // Standard timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    trackingIdIdx: index('tb_submissions_tracking_id_idx').on(table.trackingId),
    statusIdx: index('tb_submissions_status_idx').on(table.status),
    submitterIdx: index('tb_submissions_submitter_idx').on(table.submitterId),
  })
)

// Trust Bridge Credentials table
export const trustBridgeCredentials = pgTable(
  'trust_bridge_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: text('agent_id').unique().notNull(),
    submissionId: uuid('submission_id').references(
      () => trustBridgeSubmissions.id
    ),
    // JWT token
    token: text('token').notNull(),
    // Decoded payload stored for querying
    payload: jsonb('payload')
      .$type<{
        sub: string
        iss: string
        aud: string
        trust_score: number
        tier: string
        origin_platform: string
        capabilities: string[]
        restrictions: string[]
        iat: number
        exp: number
        jti: string
      }>()
      .notNull(),
    trustScore: integer('trust_score').notNull(),
    tier: certificationTierEnum('tier').notNull(),
    originPlatform: text('origin_platform').notNull(),
    capabilities: text('capabilities').array().default([]).notNull(),
    restrictions: text('restrictions').array().default([]).notNull(),
    // Validity
    issuedAt: timestamp('issued_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revocationReason: text('revocation_reason'),
    // Council review
    councilReviewed: boolean('council_reviewed').default(false),
    councilDecisionId: uuid('council_decision_id'),
    // Truth Chain integration
    truthChainHash: text('truth_chain_hash'),
    // Standard timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    agentIdIdx: index('tb_credentials_agent_id_idx').on(table.agentId),
    tierIdx: index('tb_credentials_tier_idx').on(table.tier),
    expiresAtIdx: index('tb_credentials_expires_at_idx').on(table.expiresAt),
  })
)

// Relations
export const trustBridgeSubmissionsRelations = relations(
  trustBridgeSubmissions,
  ({ one }) => ({
    credential: one(trustBridgeCredentials, {
      fields: [trustBridgeSubmissions.id],
      references: [trustBridgeCredentials.submissionId],
    }),
  })
)

export const trustBridgeCredentialsRelations = relations(
  trustBridgeCredentials,
  ({ one }) => ({
    submission: one(trustBridgeSubmissions, {
      fields: [trustBridgeCredentials.submissionId],
      references: [trustBridgeSubmissions.id],
    }),
  })
)

// Types
export type TrustBridgeSubmission = typeof trustBridgeSubmissions.$inferSelect
export type NewTrustBridgeSubmission = typeof trustBridgeSubmissions.$inferInsert
export type TrustBridgeCredential = typeof trustBridgeCredentials.$inferSelect
export type NewTrustBridgeCredential = typeof trustBridgeCredentials.$inferInsert
