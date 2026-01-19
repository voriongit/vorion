/**
 * PROOF - Immutable Evidence System
 *
 * Creates and maintains cryptographically sealed records of all governance decisions.
 * Uses Ed25519 (or ECDSA P-256 fallback) for cryptographic signatures.
 * Persists to PostgreSQL for durability.
 *
 * @packageDocumentation
 */

import { eq, and, gte, lte, asc, desc } from 'drizzle-orm';
import { createLogger } from '../common/logger.js';
import { sign, verify } from '../common/crypto.js';
import { getDatabase, type Database } from '../common/db.js';
import { proofs, proofChainMeta, type NewProof } from '../db/schema/proofs.js';
import type { Proof, Decision, Intent, ID } from '../common/types.js';

const logger = createLogger({ component: 'proof' });

/**
 * Proof creation request
 */
export interface ProofRequest {
  intent: Intent;
  decision: Decision;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}

/**
 * Proof verification result
 */
export interface VerificationResult {
  valid: boolean;
  proofId: ID;
  chainPosition: number;
  issues: string[];
  verifiedAt: string;
}

/**
 * Proof query options
 */
export interface ProofQuery {
  entityId?: ID;
  intentId?: ID;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Extended proof with signature metadata
 */
export interface SignedProof extends Proof {
  signatureData?: {
    publicKey: string;
    algorithm: string;
    signedAt: string;
  };
}

/**
 * Chain statistics
 */
export interface ChainStats {
  totalProofs: number;
  chainLength: number;
  lastProofAt: string | null;
}

/**
 * PROOF service for evidence management with PostgreSQL persistence
 */
export class ProofService {
  private db: Database | null = null;
  private chainId: string = 'default';
  private lastHash: string = '0'.repeat(64);
  private chainLength: number = 0;
  private initialized: boolean = false;

  /**
   * Initialize the service and load chain state from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.db = await getDatabase();

    // Load chain metadata
    const meta = await this.db
      .select()
      .from(proofChainMeta)
      .where(eq(proofChainMeta.chainId, this.chainId))
      .limit(1);

    if (meta.length > 0) {
      this.lastHash = meta[0]!.lastHash;
      this.chainLength = meta[0]!.chainLength;
      logger.info(
        { chainLength: this.chainLength, lastHash: this.lastHash.slice(0, 16) + '...' },
        'Chain state loaded from database'
      );
    } else {
      // Create initial chain metadata
      await this.db.insert(proofChainMeta).values({
        chainId: this.chainId,
        lastHash: this.lastHash,
        chainLength: 0,
      });
      logger.info('New proof chain initialized');
    }

    this.initialized = true;
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<Database> {
    if (!this.initialized || !this.db) {
      await this.initialize();
    }
    return this.db!;
  }

  /**
   * Create a new proof record with cryptographic signature
   */
  async create(request: ProofRequest): Promise<SignedProof> {
    const db = await this.ensureInitialized();

    const proofId = crypto.randomUUID();
    const chainPosition = this.chainLength;
    const createdAt = new Date();

    // Build proof data for hashing
    const proofData = {
      id: proofId,
      chainPosition,
      intentId: request.intent.id,
      entityId: request.intent.entityId,
      decision: request.decision,
      inputs: request.inputs,
      outputs: request.outputs,
      previousHash: this.lastHash,
      createdAt: createdAt.toISOString(),
    };

    // Calculate hash of the proof content
    const hash = await this.calculateHash(proofData);

    // Sign the hash with Ed25519/ECDSA
    const signatureResult = await sign(hash);

    // Insert into database
    const newProof: NewProof = {
      id: proofId,
      chainPosition,
      intentId: request.intent.id,
      entityId: request.intent.entityId,
      decision: request.decision,
      inputs: request.inputs,
      outputs: request.outputs,
      hash,
      previousHash: this.lastHash,
      signature: signatureResult.signature,
      signaturePublicKey: signatureResult.publicKey,
      signatureAlgorithm: signatureResult.algorithm,
      signedAt: new Date(signatureResult.signedAt),
      createdAt,
    };

    await db.transaction(async (tx) => {
      // Insert proof
      await tx.insert(proofs).values(newProof);

      // Update chain metadata
      await tx
        .update(proofChainMeta)
        .set({
          lastHash: hash,
          chainLength: chainPosition + 1,
          updatedAt: new Date(),
        })
        .where(eq(proofChainMeta.chainId, this.chainId));
    });

    // Update local state
    this.lastHash = hash;
    this.chainLength = chainPosition + 1;

    const signedProof: SignedProof = {
      id: proofId,
      chainPosition,
      intentId: request.intent.id,
      entityId: request.intent.entityId,
      decision: request.decision,
      inputs: request.inputs,
      outputs: request.outputs,
      hash,
      previousHash: proofData.previousHash,
      signature: signatureResult.signature,
      createdAt: createdAt.toISOString(),
      signatureData: {
        publicKey: signatureResult.publicKey,
        algorithm: signatureResult.algorithm,
        signedAt: signatureResult.signedAt,
      },
    };

    logger.info(
      {
        proofId,
        intentId: request.intent.id,
        chainPosition,
        signed: true,
      },
      'Proof created and signed'
    );

    return signedProof;
  }

  /**
   * Get a proof by ID
   */
  async get(id: ID): Promise<SignedProof | undefined> {
    const db = await this.ensureInitialized();

    const result = await db
      .select()
      .from(proofs)
      .where(eq(proofs.id, id))
      .limit(1);

    if (result.length === 0) return undefined;

    return this.toSignedProof(result[0]!);
  }

  /**
   * Query proofs
   */
  async query(query: ProofQuery): Promise<SignedProof[]> {
    const db = await this.ensureInitialized();

    const conditions = [];

    if (query.entityId) {
      conditions.push(eq(proofs.entityId, query.entityId));
    }

    if (query.intentId) {
      conditions.push(eq(proofs.intentId, query.intentId));
    }

    if (query.startDate) {
      conditions.push(gte(proofs.createdAt, new Date(query.startDate)));
    }

    if (query.endDate) {
      conditions.push(lte(proofs.createdAt, new Date(query.endDate)));
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;

    const results = await db
      .select()
      .from(proofs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(proofs.chainPosition))
      .limit(limit)
      .offset(offset);

    return results.map((r) => this.toSignedProof(r));
  }

  /**
   * Verify a proof's integrity (hash, chain linkage, and signature)
   */
  async verify(id: ID): Promise<VerificationResult> {
    const db = await this.ensureInitialized();
    const issues: string[] = [];

    const result = await db
      .select()
      .from(proofs)
      .where(eq(proofs.id, id))
      .limit(1);

    if (result.length === 0) {
      return {
        valid: false,
        proofId: id,
        chainPosition: -1,
        issues: ['Proof not found'],
        verifiedAt: new Date().toISOString(),
      };
    }

    const proof = result[0]!;

    // Verify hash
    const proofData = {
      id: proof.id,
      chainPosition: proof.chainPosition,
      intentId: proof.intentId,
      entityId: proof.entityId,
      decision: proof.decision,
      inputs: proof.inputs,
      outputs: proof.outputs,
      previousHash: proof.previousHash,
      createdAt: proof.createdAt.toISOString(),
    };

    const expectedHash = await this.calculateHash(proofData);

    if (proof.hash !== expectedHash) {
      issues.push('Hash mismatch - proof content may have been tampered');
    }

    // Verify chain linkage
    if (proof.chainPosition > 0) {
      const previousResult = await db
        .select()
        .from(proofs)
        .where(eq(proofs.chainPosition, proof.chainPosition - 1))
        .limit(1);

      if (previousResult.length > 0) {
        const previous = previousResult[0]!;
        if (proof.previousHash !== previous.hash) {
          issues.push('Chain linkage broken - previous hash does not match');
        }
      } else {
        issues.push('Previous proof in chain not found');
      }
    }

    // Verify cryptographic signature
    if (proof.signature && proof.signaturePublicKey) {
      const sigResult = await verify(
        proof.hash,
        proof.signature,
        proof.signaturePublicKey
      );
      if (!sigResult.valid) {
        issues.push(
          `Signature verification failed: ${sigResult.error || 'invalid signature'}`
        );
      }
    } else {
      issues.push('Missing signature or public key');
    }

    logger.info(
      {
        proofId: id,
        valid: issues.length === 0,
        issues,
        signatureVerified: issues.length === 0,
      },
      'Proof verified'
    );

    return {
      valid: issues.length === 0,
      proofId: id,
      chainPosition: proof.chainPosition,
      issues,
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Verify the entire chain integrity
   */
  async verifyChain(): Promise<{
    valid: boolean;
    lastValidPosition: number;
    issues: string[];
  }> {
    const db = await this.ensureInitialized();
    const issues: string[] = [];
    let lastValidPosition = -1;

    // Get all proofs in order
    const allProofs = await db
      .select()
      .from(proofs)
      .orderBy(asc(proofs.chainPosition));

    for (let i = 0; i < allProofs.length; i++) {
      const proof = allProofs[i]!;
      const verification = await this.verify(proof.id);

      if (!verification.valid) {
        issues.push(`Position ${i}: ${verification.issues.join(', ')}`);
        break;
      }

      lastValidPosition = i;
    }

    // Update chain metadata with verification result
    await db
      .update(proofChainMeta)
      .set({
        lastVerifiedAt: new Date(),
        lastVerifiedPosition: lastValidPosition,
        updatedAt: new Date(),
      })
      .where(eq(proofChainMeta.chainId, this.chainId));

    return {
      valid: issues.length === 0,
      lastValidPosition,
      issues,
    };
  }

  /**
   * Calculate hash for a proof record
   */
  private async calculateHash(
    proof: Omit<Proof, 'hash' | 'signature'>
  ): Promise<string> {
    const data = JSON.stringify({
      id: proof.id,
      chainPosition: proof.chainPosition,
      intentId: proof.intentId,
      entityId: proof.entityId,
      decision: proof.decision,
      inputs: proof.inputs,
      outputs: proof.outputs,
      previousHash: proof.previousHash,
      createdAt: proof.createdAt,
    });

    // Use Web Crypto API for SHA-256
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Convert database row to SignedProof
   */
  private toSignedProof(row: typeof proofs.$inferSelect): SignedProof {
    return {
      id: row.id,
      chainPosition: row.chainPosition,
      intentId: row.intentId,
      entityId: row.entityId,
      decision: row.decision,
      inputs: row.inputs,
      outputs: row.outputs,
      hash: row.hash,
      previousHash: row.previousHash,
      signature: row.signature,
      createdAt: row.createdAt.toISOString(),
      signatureData: row.signaturePublicKey
        ? {
            publicKey: row.signaturePublicKey,
            algorithm: row.signatureAlgorithm ?? 'unknown',
            signedAt: row.signedAt?.toISOString() ?? row.createdAt.toISOString(),
          }
        : undefined,
    };
  }

  /**
   * Get chain statistics
   */
  async getStats(): Promise<ChainStats> {
    const db = await this.ensureInitialized();

    const result = await db
      .select()
      .from(proofs)
      .orderBy(desc(proofs.createdAt))
      .limit(1);

    return {
      totalProofs: this.chainLength,
      chainLength: this.chainLength,
      lastProofAt: result.length > 0 ? result[0]!.createdAt.toISOString() : null,
    };
  }
}

/**
 * Create a new PROOF service instance
 */
export function createProofService(): ProofService {
  return new ProofService();
}
