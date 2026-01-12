/**
 * Truth Chain Schema - Immutable audit records
 */

import { pgTable, uuid, text, timestamp, bigint, jsonb, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { agents } from './agents'
import { profiles } from './users'

// Enums
export const truthRecordTypeEnum = pgEnum('truth_record_type', [
  'agent_creation',
  'agent_graduation',
  'agent_suspension',
  'council_decision',
  'trust_change',
  'acquisition',
  'human_override',
  'system_event',
])

// Truth Chain table - append-only immutable records
export const truthChain = pgTable(
  'truth_chain',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Chain integrity
    sequenceNumber: bigint('sequence_number', { mode: 'number' }).notNull(),
    previousHash: text('previous_hash'),
    hash: text('hash').notNull(),
    // Record details
    recordType: truthRecordTypeEnum('record_type').notNull(),
    subjectType: text('subject_type').notNull(), // 'agent', 'user', 'decision'
    subjectId: uuid('subject_id').notNull(),
    // The actual record data
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    // Actor who triggered this record
    actorId: uuid('actor_id'),
    actorType: text('actor_type'), // 'user', 'agent', 'system'
    // Verification
    signature: text('signature'),
    anchoredAt: timestamp('anchored_at', { withTimezone: true }), // When anchored to blockchain (optional)
    anchorTxHash: text('anchor_tx_hash'), // Blockchain transaction hash
    // Timestamp (immutable)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sequenceIdx: uniqueIndex('truth_chain_sequence_idx').on(table.sequenceNumber),
    hashIdx: index('truth_chain_hash_idx').on(table.hash),
    subjectIdx: index('truth_chain_subject_idx').on(table.subjectType, table.subjectId),
    recordTypeIdx: index('truth_chain_record_type_idx').on(table.recordType),
    createdAtIdx: index('truth_chain_created_at_idx').on(table.createdAt),
    actorIdx: index('truth_chain_actor_idx').on(table.actorId),
  })
)

// Relations
export const truthChainRelations = relations(truthChain, ({ one }) => ({
  subjectAgent: one(agents, {
    fields: [truthChain.subjectId],
    references: [agents.id],
  }),
  actorProfile: one(profiles, {
    fields: [truthChain.actorId],
    references: [profiles.id],
  }),
}))

// Types
export type TruthChainRecord = typeof truthChain.$inferSelect
export type NewTruthChainRecord = typeof truthChain.$inferInsert
