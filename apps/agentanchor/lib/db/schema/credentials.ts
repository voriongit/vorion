/**
 * Portable Trust Credentials Schema
 * FR157-162: Portable Trust Credential system for external verification
 */

import { pgTable, uuid, text, timestamp, integer, jsonb, pgEnum, index, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { agents } from './agents'
import { profiles } from './users'

// Enums
export const credentialStatusEnum = pgEnum('credential_status', [
  'active',
  'expired',
  'revoked',
])

// Portable Trust Credentials table
export const credentials = pgTable(
  'credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    issuerId: uuid('issuer_id').notNull().references(() => profiles.id),

    // Credential data at time of issuance
    trustScore: integer('trust_score').notNull(),
    trustTier: text('trust_tier').notNull(),
    trustTierCode: integer('trust_tier_code').notNull(),

    // Governance summary snapshot
    governanceSummary: jsonb('governance_summary').$type<{
      totalDecisions: number
      approvalRate: number
      escalationRate: number
      lastCouncilReview?: string
    }>(),

    // Certification data
    certificationData: jsonb('certification_data').$type<{
      academyGraduated: boolean
      graduationDate?: string
      specializations: string[]
      mentorCertified: boolean
    }>(),

    // Truth Chain anchor
    truthChainHash: text('truth_chain_hash'),
    truthChainBlockHeight: integer('truth_chain_block_height'),

    // JWT metadata
    jwtId: text('jwt_id').notNull().unique(), // jti claim
    keyId: text('key_id').notNull(), // kid - which signing key was used

    // Status
    status: credentialStatusEnum('status').default('active').notNull(),

    // Timestamps
    issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
  },
  (table) => ({
    agentIdx: index('credentials_agent_idx').on(table.agentId),
    jwtIdIdx: index('credentials_jwt_id_idx').on(table.jwtId),
    statusIdx: index('credentials_status_idx').on(table.status),
    expiresIdx: index('credentials_expires_idx').on(table.expiresAt),
  })
)

// Credential Revocation List - for fast revocation checking
export const credentialRevocations = pgTable(
  'credential_revocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jwtId: text('jwt_id').notNull().unique(),
    agentId: uuid('agent_id').notNull().references(() => agents.id),
    reason: text('reason').notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }).defaultNow().notNull(),
    revokedBy: uuid('revoked_by').references(() => profiles.id),
  },
  (table) => ({
    jwtIdIdx: index('revocations_jwt_id_idx').on(table.jwtId),
    agentIdx: index('revocations_agent_idx').on(table.agentId),
  })
)

// Signing Keys registry - for key rotation support
export const signingKeys = pgTable(
  'signing_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    keyId: text('key_id').notNull().unique(), // e.g., aa_key_2025_001
    algorithm: text('algorithm').default('ES256').notNull(),
    publicKey: text('public_key').notNull(), // PEM format
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
  },
  (table) => ({
    keyIdIdx: index('signing_keys_key_id_idx').on(table.keyId),
    activeIdx: index('signing_keys_active_idx').on(table.isActive),
  })
)

// Verification log - for analytics and rate limiting
export const verificationLog = pgTable(
  'verification_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jwtId: text('jwt_id'),
    agentId: uuid('agent_id'),
    requestIp: text('request_ip'),
    userAgent: text('user_agent'),
    result: text('result').notNull(), // 'valid', 'invalid', 'expired', 'revoked'
    errorCode: text('error_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index('verification_log_created_at_idx').on(table.createdAt),
    ipIdx: index('verification_log_ip_idx').on(table.requestIp),
  })
)

// Relations
export const credentialsRelations = relations(credentials, ({ one }) => ({
  agent: one(agents, {
    fields: [credentials.agentId],
    references: [agents.id],
  }),
  issuer: one(profiles, {
    fields: [credentials.issuerId],
    references: [profiles.id],
  }),
}))

// Types
export type Credential = typeof credentials.$inferSelect
export type NewCredential = typeof credentials.$inferInsert
export type CredentialRevocation = typeof credentialRevocations.$inferSelect
export type SigningKey = typeof signingKeys.$inferSelect
export type VerificationLogEntry = typeof verificationLog.$inferSelect
