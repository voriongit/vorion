-- Migration: 001_proofs
-- Description: Create proof tables for immutable evidence chain
-- Created: 2026-01-18

-- Proofs table - immutable evidence records
CREATE TABLE IF NOT EXISTS proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_position INTEGER NOT NULL,
    intent_id UUID NOT NULL,
    entity_id UUID NOT NULL,

    -- Decision details (JSONB)
    decision JSONB NOT NULL,

    -- Execution context (JSONB)
    inputs JSONB NOT NULL,
    outputs JSONB NOT NULL,

    -- Chain integrity
    hash TEXT NOT NULL,
    previous_hash TEXT NOT NULL,

    -- Cryptographic signature
    signature TEXT NOT NULL,
    signature_public_key TEXT,
    signature_algorithm TEXT,
    signed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique chain position for ordering
CREATE UNIQUE INDEX IF NOT EXISTS proofs_chain_position_idx ON proofs (chain_position);

-- Fast lookups by entity
CREATE INDEX IF NOT EXISTS proofs_entity_id_idx ON proofs (entity_id);

-- Fast lookups by intent
CREATE INDEX IF NOT EXISTS proofs_intent_id_idx ON proofs (intent_id);

-- Chain verification queries
CREATE INDEX IF NOT EXISTS proofs_hash_idx ON proofs (hash);

-- Time-based queries
CREATE INDEX IF NOT EXISTS proofs_created_at_idx ON proofs (created_at);

-- Proof chain metadata - tracks chain state
CREATE TABLE IF NOT EXISTS proof_chain_meta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id TEXT NOT NULL DEFAULT 'default',
    last_hash TEXT NOT NULL,
    chain_length INTEGER NOT NULL DEFAULT 0,
    last_verified_at TIMESTAMPTZ,
    last_verified_position INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique chain ID
CREATE UNIQUE INDEX IF NOT EXISTS proof_chain_meta_chain_id_idx ON proof_chain_meta (chain_id);

-- Add comments for documentation
COMMENT ON TABLE proofs IS 'Immutable evidence records with cryptographic signatures and hash chain';
COMMENT ON TABLE proof_chain_meta IS 'Metadata tracking the state of proof chains';
COMMENT ON COLUMN proofs.chain_position IS 'Sequential position in the hash chain';
COMMENT ON COLUMN proofs.hash IS 'SHA-256 hash of proof content for integrity verification';
COMMENT ON COLUMN proofs.previous_hash IS 'Hash of the previous proof in the chain';
COMMENT ON COLUMN proofs.signature IS 'Ed25519/ECDSA signature of the hash';
