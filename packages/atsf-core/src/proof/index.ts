/**
 * PROOF - Immutable Evidence System
 *
 * Creates and maintains cryptographically sealed records of all governance decisions.
 * Uses Ed25519 for cryptographic signing of proof records.
 *
 * @packageDocumentation
 */

import * as nodeCrypto from 'node:crypto';
import { createLogger } from '../common/logger.js';
import type { Proof, Decision, Intent, ID } from '../common/types.js';

const logger = createLogger({ component: 'proof' });

/**
 * Ed25519 key pair for signing proofs
 */
export interface SigningKeyPair {
  publicKey: string; // Base64-encoded public key
  privateKey: string; // Base64-encoded private key
}

/**
 * Signing configuration for proof service
 */
export interface SigningConfig {
  /** Private key for signing (base64-encoded Ed25519) */
  privateKey?: string;
  /** Public key for verification (base64-encoded Ed25519) */
  publicKey?: string;
  /** Key ID for multi-key scenarios */
  keyId?: string;
}

/**
 * Generate a new Ed25519 key pair for signing
 */
export function generateKeyPair(): SigningKeyPair {
  const { publicKey, privateKey } = nodeCrypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

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
  private privateKey: nodeCrypto.KeyObject | null = null;
  private publicKey: nodeCrypto.KeyObject | null = null;
  private keyId: string;

  constructor(config?: SigningConfig) {
    this.keyId = config?.keyId ?? 'default';

    if (config?.privateKey) {
      this.privateKey = nodeCrypto.createPrivateKey({
        key: Buffer.from(config.privateKey, 'base64'),
        format: 'der',
        type: 'pkcs8',
      });
      // Derive public key from private key
      this.publicKey = nodeCrypto.createPublicKey(this.privateKey);
      logger.info({ keyId: this.keyId }, 'Signing key loaded');
    } else if (config?.publicKey) {
      this.publicKey = nodeCrypto.createPublicKey({
        key: Buffer.from(config.publicKey, 'base64'),
        format: 'der',
        type: 'spki',
      });
      logger.info({ keyId: this.keyId }, 'Verification-only key loaded');
    } else {
      logger.warn('No signing key configured - proofs will not be signed');
    }
  }

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
      signature: '', // Will be signed after hash calculation
      createdAt: new Date().toISOString(),
    };

    // Calculate hash
    proof.hash = await this.calculateHash(proof);
    this.lastHash = proof.hash;

    // Sign the proof hash
    proof.signature = this.sign(proof.hash);

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

    // Verify hash - create object without hash property for recalculation
    const { hash: _existingHash, ...proofWithoutHash } = proof;
    const expectedHash = await this.calculateHash(proofWithoutHash);

    if (proof.hash !== expectedHash) {
      issues.push('Hash mismatch');
    }

    // Verify signature
    if (proof.signature) {
      if (!this.verifySignature(proof.hash, proof.signature)) {
        issues.push('Invalid signature');
      }
    } else if (this.publicKey) {
      // Signature missing but we have a key configured
      issues.push('Signature missing');
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
   * Sign data with Ed25519 private key
   * @returns Base64-encoded signature, or empty string if no key configured
   */
  private sign(data: string): string {
    if (!this.privateKey) {
      return '';
    }

    const signature = nodeCrypto.sign(null, Buffer.from(data), this.privateKey);
    return signature.toString('base64');
  }

  /**
   * Verify Ed25519 signature
   * @returns true if valid, false if invalid or no public key
   */
  private verifySignature(data: string, signature: string): boolean {
    if (!this.publicKey) {
      // No key to verify with - skip signature verification
      return true;
    }

    try {
      return nodeCrypto.verify(
        null,
        Buffer.from(data),
        this.publicKey,
        Buffer.from(signature, 'base64')
      );
    } catch {
      return false;
    }
  }

  /**
   * Get the public key for external verification
   * @returns Base64-encoded public key, or null if not configured
   */
  getPublicKey(): string | null {
    if (!this.publicKey) {
      return null;
    }
    return this.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  }

  /**
   * Check if signing is enabled
   */
  isSigningEnabled(): boolean {
    return this.privateKey !== null;
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
 * @param config Optional signing configuration
 */
export function createProofService(config?: SigningConfig): ProofService {
  return new ProofService(config);
}

// =============================================================================
// MERKLE AGGREGATION
// =============================================================================

export {
  // Types
  type MerkleNode,
  type MerkleProof,
  type MerkleAnchor,
  type ExternalAnchor,
  type BatchAggregationResult,
  type MerkleAggregationConfig,

  // Functions
  buildMerkleTree,
  generateMerkleProof,
  verifyMerkleProof,

  // Service
  MerkleAggregationService,
  createMerkleAggregationService,
} from './merkle.js';

// =============================================================================
// ZERO-KNOWLEDGE PROOFS
// =============================================================================

export {
  // Types
  type PedersenCommitment,
  type RangeProof,
  type ThresholdProof,
  type MembershipProof,
  type TrustTierProof,
  type CompositeProof,
  type ZKVerificationResult,
  type ZKProofConfig,

  // Primitives
  createCommitment,
  verifyCommitment,

  // Range proofs
  generateRangeProof,
  verifyRangeProof,

  // Threshold proofs
  generateThresholdProof,
  verifyThresholdProof,

  // Membership proofs
  generateMembershipProof,
  verifyMembershipProof,

  // Trust tier proofs
  generateTrustTierProof,
  verifyTrustTierProof,

  // Service
  ZKProofService,
  createZKProofService,
} from './zk-proofs.js';
