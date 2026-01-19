/**
 * Proof Schema
 *
 * Database schema for immutable proof records with hash chain integrity.
 *
 * @packageDocumentation
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { Decision } from '../../common/types.js';

/**
 * Proofs table - immutable evidence records
 */
export const proofs = pgTable(
  'proofs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chainPosition: integer('chain_position').notNull(),
    intentId: uuid('intent_id').notNull(),
    entityId: uuid('entity_id').notNull(),

    // Decision details
    decision: jsonb('decision').notNull().$type<Decision>(),

    // Execution context
    inputs: jsonb('inputs').notNull().$type<Record<string, unknown>>(),
    outputs: jsonb('outputs').notNull().$type<Record<string, unknown>>(),

    // Chain integrity
    hash: text('hash').notNull(),
    previousHash: text('previous_hash').notNull(),

    // Cryptographic signature
    signature: text('signature').notNull(),
    signaturePublicKey: text('signature_public_key'),
    signatureAlgorithm: text('signature_algorithm'),
    signedAt: timestamp('signed_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Unique chain position for ordering
    chainPositionIdx: uniqueIndex('proofs_chain_position_idx').on(
      table.chainPosition
    ),
    // Fast lookups by entity
    entityIdIdx: index('proofs_entity_id_idx').on(table.entityId),
    // Fast lookups by intent
    intentIdIdx: index('proofs_intent_id_idx').on(table.intentId),
    // Chain verification queries
    hashIdx: index('proofs_hash_idx').on(table.hash),
    // Time-based queries
    createdAtIdx: index('proofs_created_at_idx').on(table.createdAt),
  })
);

/**
 * Proof chain metadata - tracks chain state
 */
export const proofChainMeta = pgTable('proof_chain_meta', {
  id: uuid('id').primaryKey().defaultRandom(),
  chainId: text('chain_id').notNull().default('default'),
  lastHash: text('last_hash').notNull(),
  chainLength: integer('chain_length').notNull().default(0),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  lastVerifiedPosition: integer('last_verified_position'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Types
export type Proof = typeof proofs.$inferSelect;
export type NewProof = typeof proofs.$inferInsert;
export type ProofChainMeta = typeof proofChainMeta.$inferSelect;
