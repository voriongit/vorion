/**
 * Crypto Audit Log Schema
 * Drizzle ORM schema for the cryptographic audit log table
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// Crypto Audit Log table - append-only immutable records
export const cryptoAuditLog = pgTable(
  'crypto_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Chain integrity
    sequenceNumber: bigint('sequence_number', { mode: 'number' }).notNull(),
    previousHash: text('previous_hash').notNull(),
    entryHash: text('entry_hash').notNull(),
    // Action details
    action: text('action').notNull(),
    actorType: text('actor_type').notNull(), // 'HUMAN', 'AGENT', 'SYSTEM'
    actorId: text('actor_id').notNull(),
    actorTier: text('actor_tier'),
    targetType: text('target_type'), // 'AGENT', 'ENTRY', 'SYSTEM'
    targetId: text('target_id'),
    // Payload
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    outcome: text('outcome').notNull(), // 'SUCCESS', 'DENIED', 'ERROR'
    reason: text('reason'),
    merkleRoot: text('merkle_root'),
    // Timestamp (immutable)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sequenceIdx: uniqueIndex('crypto_audit_log_sequence_idx').on(table.sequenceNumber),
    hashIdx: index('crypto_audit_log_hash_idx').on(table.entryHash),
    actorIdx: index('crypto_audit_log_actor_idx').on(table.actorId),
    actionIdx: index('crypto_audit_log_action_idx').on(table.action),
    createdAtIdx: index('crypto_audit_log_created_at_idx').on(table.createdAt),
  })
)

// Types
export type CryptoAuditLogRecord = typeof cryptoAuditLog.$inferSelect
export type NewCryptoAuditLogRecord = typeof cryptoAuditLog.$inferInsert
