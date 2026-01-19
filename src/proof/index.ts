/**
 * PROOF - Immutable Evidence System
 *
 * Creates and maintains cryptographically sealed records of all governance decisions.
 * Uses Ed25519 (or ECDSA P-256 fallback) for cryptographic signatures.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import { sign, verify, sha256, type SignatureResult } from '../common/crypto.js';
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
 * PROOF service for evidence management
 */
export class ProofService {
  private proofs: Map<ID, SignedProof> = new Map();
  private chain: SignedProof[] = [];
  private lastHash: string = '0'.repeat(64);

  /**
   * Create a new proof record with cryptographic signature
   */
  async create(request: ProofRequest): Promise<SignedProof> {
    const proof: SignedProof = {
      id: crypto.randomUUID(),
      chainPosition: this.chain.length,
      intentId: request.intent.id,
      entityId: request.intent.entityId,
      decision: request.decision,
      inputs: request.inputs,
      outputs: request.outputs,
      hash: '', // Will be calculated
      previousHash: this.lastHash,
      signature: '', // Will be signed
      createdAt: new Date().toISOString(),
    };

    // Calculate hash of the proof content
    proof.hash = await this.calculateHash(proof);
    this.lastHash = proof.hash;

    // Sign the hash with Ed25519/ECDSA
    const signatureResult = await sign(proof.hash);
    proof.signature = signatureResult.signature;
    proof.signatureData = {
      publicKey: signatureResult.publicKey,
      algorithm: signatureResult.algorithm,
      signedAt: signatureResult.signedAt,
    };

    // Store
    this.proofs.set(proof.id, proof);
    this.chain.push(proof);

    logger.info(
      {
        proofId: proof.id,
        intentId: proof.intentId,
        chainPosition: proof.chainPosition,
        signed: true,
      },
      'Proof created and signed'
    );

    return proof;
  }

  /**
   * Get a proof by ID
   */
  async get(id: ID): Promise<SignedProof | undefined> {
    return this.proofs.get(id);
  }

  /**
   * Query proofs
   */
  async query(query: ProofQuery): Promise<SignedProof[]> {
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
   * Verify a proof's integrity (hash, chain linkage, and signature)
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
    const expectedHash = await this.calculateHash({
      ...proof,
      hash: '',
      signature: '',
      signatureData: undefined,
    });

    if (proof.hash !== expectedHash) {
      issues.push('Hash mismatch - proof content may have been tampered');
    }

    // Verify chain linkage
    if (proof.chainPosition > 0) {
      const previous = this.chain[proof.chainPosition - 1];
      if (previous && proof.previousHash !== previous.hash) {
        issues.push('Chain linkage broken - previous hash does not match');
      }
    }

    // Verify cryptographic signature
    if (proof.signature && proof.signatureData?.publicKey) {
      const sigResult = await verify(
        proof.hash,
        proof.signature,
        proof.signatureData.publicKey
      );
      if (!sigResult.valid) {
        issues.push(`Signature verification failed: ${sigResult.error || 'invalid signature'}`);
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
