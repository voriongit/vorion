/**
 * PROOF - Immutable Evidence System
 *
 * Creates and maintains cryptographically sealed records of all governance decisions.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
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
 * PROOF service for evidence management
 */
export class ProofService {
  private proofs: Map<ID, Proof> = new Map();
  private chain: Proof[] = [];
  private lastHash: string = '0'.repeat(64);

  /**
   * Create a new proof record
   */
  async create(request: ProofRequest): Promise<Proof> {
    const proof: Proof = {
      id: crypto.randomUUID(),
      chainPosition: this.chain.length,
      intentId: request.intent.id,
      entityId: request.intent.entityId,
      decision: request.decision,
      inputs: request.inputs,
      outputs: request.outputs,
      hash: '', // Will be calculated
      previousHash: this.lastHash,
      signature: '', // TODO: Implement signing
      createdAt: new Date().toISOString(),
    };

    // Calculate hash
    proof.hash = await this.calculateHash(proof);
    this.lastHash = proof.hash;

    // Store
    this.proofs.set(proof.id, proof);
    this.chain.push(proof);

    logger.info(
      {
        proofId: proof.id,
        intentId: proof.intentId,
        chainPosition: proof.chainPosition,
      },
      'Proof created'
    );

    return proof;
  }

  /**
   * Get a proof by ID
   */
  async get(id: ID): Promise<Proof | undefined> {
    return this.proofs.get(id);
  }

  /**
   * Query proofs
   */
  async query(query: ProofQuery): Promise<Proof[]> {
    let results = Array.from(this.proofs.values());

    if (query.entityId) {
      results = results.filter((p) => p.entityId === query.entityId);
    }

    if (query.intentId) {
      results = results.filter((p) => p.intentId === query.intentId);
    }

    if (query.startDate) {
      results = results.filter((p) => p.createdAt >= query.startDate!);
    }

    if (query.endDate) {
      results = results.filter((p) => p.createdAt <= query.endDate!);
    }

    // Sort by chain position (oldest first)
    results.sort((a, b) => a.chainPosition - b.chainPosition);

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Verify a proof's integrity
   */
  async verify(id: ID): Promise<VerificationResult> {
    const proof = this.proofs.get(id);
    const issues: string[] = [];

    if (!proof) {
      return {
        valid: false,
        proofId: id,
        chainPosition: -1,
        issues: ['Proof not found'],
        verifiedAt: new Date().toISOString(),
      };
    }

    // Verify hash
    const { hash: _existingHash, ...proofWithoutHash } = proof;
    const expectedHash = await this.calculateHash(proofWithoutHash);

    if (proof.hash !== expectedHash) {
      issues.push('Hash mismatch');
    }

    // Verify chain linkage
    if (proof.chainPosition > 0) {
      const previous = this.chain[proof.chainPosition - 1];
      if (previous && proof.previousHash !== previous.hash) {
        issues.push('Chain linkage broken');
      }
    }

    logger.info(
      {
        proofId: id,
        valid: issues.length === 0,
        issues,
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
    const issues: string[] = [];
    let lastValidPosition = -1;

    for (let i = 0; i < this.chain.length; i++) {
      const proof = this.chain[i]!;
      const verification = await this.verify(proof.id);

      if (!verification.valid) {
        issues.push(`Position ${i}: ${verification.issues.join(', ')}`);
        break;
      }

      lastValidPosition = i;
    }

    return {
      valid: issues.length === 0,
      lastValidPosition,
      issues,
    };
  }

  /**
   * Calculate hash for a proof record
   */
  private async calculateHash(proof: Omit<Proof, 'hash'>): Promise<string> {
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
   * Get chain statistics
   */
  getStats(): {
    totalProofs: number;
    chainLength: number;
    lastProofAt: string | null;
  } {
    const lastProof = this.chain[this.chain.length - 1];

    return {
      totalProofs: this.proofs.size,
      chainLength: this.chain.length,
      lastProofAt: lastProof?.createdAt ?? null,
    };
  }
}

/**
 * Create a new PROOF service instance
 */
export function createProofService(): ProofService {
  return new ProofService();
}
