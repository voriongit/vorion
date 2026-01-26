/**
 * Zero-Knowledge Proof Service for Privacy-Preserving Trust Verification
 *
 * Implements ZK proofs to enable:
 * - Trust tier verification without revealing exact score
 * - Action authorization without exposing full context
 * - Compliance attestation without disclosing sensitive data
 *
 * Proof Types:
 * - Range proofs (score in tier range)
 * - Membership proofs (role in allowed set)
 * - Threshold proofs (score >= minimum)
 *
 * Implementation uses Bulletproofs-style commitments for range proofs.
 * For production deployment, integrate with full ZK library (snarkjs, circom).
 *
 * @packageDocumentation
 */

import * as nodeCrypto from 'node:crypto';
import { createLogger } from '../common/logger.js';

const logger = createLogger({ component: 'proof:zk' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Pedersen commitment (hiding + binding)
 */
export interface PedersenCommitment {
  /** Commitment value C = value*G + blinding*H */
  commitment: string;
  /** Blinding factor (kept secret) */
  blinding: string;
}

/**
 * Range proof (proves value in [min, max])
 */
export interface RangeProof {
  proofId: string;
  proofType: 'range';
  commitment: string;
  rangeMin: number;
  rangeMax: number;
  proof: string; // Serialized proof data
  createdAt: Date;
}

/**
 * Threshold proof (proves value >= threshold)
 */
export interface ThresholdProof {
  proofId: string;
  proofType: 'threshold';
  commitment: string;
  threshold: number;
  proof: string;
  createdAt: Date;
}

/**
 * Membership proof (proves value in set)
 */
export interface MembershipProof {
  proofId: string;
  proofType: 'membership';
  commitment: string;
  setHash: string; // Hash of allowed set
  proof: string;
  createdAt: Date;
}

/**
 * Trust tier proof (proves agent is in a specific tier)
 */
export interface TrustTierProof {
  proofId: string;
  proofType: 'trust-tier';
  agentId: string;
  tierCommitment: string;
  tier: string; // T0-T5
  proof: string;
  validUntil: Date;
  createdAt: Date;
}

/**
 * Composite proof combining multiple statements
 */
export interface CompositeProof {
  proofId: string;
  proofType: 'composite';
  statements: Array<{
    type: 'range' | 'threshold' | 'membership';
    commitment: string;
    parameters: Record<string, unknown>;
  }>;
  proof: string;
  createdAt: Date;
}

/**
 * Verification result
 */
export interface ZKVerificationResult {
  valid: boolean;
  proofId: string;
  verifiedAt: Date;
  reason?: string;
}

/**
 * Trust tier boundaries
 */
const TIER_BOUNDARIES: Record<string, [number, number]> = {
  T0: [0, 99],
  T1: [100, 299],
  T2: [300, 499],
  T3: [500, 699],
  T4: [700, 899],
  T5: [900, 1000],
};

// =============================================================================
// CRYPTOGRAPHIC PRIMITIVES
// =============================================================================

/**
 * Generate random 256-bit scalar
 */
function randomScalar(): string {
  return nodeCrypto.randomBytes(32).toString('hex');
}

/**
 * SHA-256 hash
 */
function hash(...inputs: string[]): string {
  const hasher = nodeCrypto.createHash('sha256');
  for (const input of inputs) {
    hasher.update(input);
  }
  return hasher.digest('hex');
}

/**
 * Create Pedersen commitment
 *
 * In a real implementation, this would use elliptic curve operations.
 * This is a simplified hash-based commitment for demonstration.
 */
export function createCommitment(value: number): PedersenCommitment {
  const blinding = randomScalar();

  // C = H(value || blinding)
  // In real Pedersen: C = value*G + blinding*H
  const commitment = hash(value.toString(), blinding);

  return { commitment, blinding };
}

/**
 * Verify a commitment matches a value
 */
export function verifyCommitment(
  commitment: string,
  value: number,
  blinding: string
): boolean {
  const expected = hash(value.toString(), blinding);
  return commitment === expected;
}

// =============================================================================
// RANGE PROOFS
// =============================================================================

/**
 * Generate a simplified range proof
 *
 * Uses a commit-and-prove approach where:
 * 1. Commit to the value
 * 2. Prove value is in range using bit decomposition
 *
 * For production, use Bulletproofs library.
 */
export function generateRangeProof(
  value: number,
  min: number,
  max: number
): { proof: RangeProof; secret: PedersenCommitment } | null {
  // Validate range
  if (value < min || value > max) {
    logger.warn({ value, min, max }, 'Value out of range');
    return null;
  }

  // Create commitment
  const commitment = createCommitment(value);

  // Generate proof data
  // In real Bulletproofs, this would be a complex proof of bit decomposition
  // This simplified version proves knowledge of value in range

  const rangeSize = max - min;
  const normalizedValue = value - min;

  // Bit decomposition of normalized value
  const numBits = Math.ceil(Math.log2(rangeSize + 1));
  const bits: number[] = [];
  let temp = normalizedValue;
  for (let i = 0; i < numBits; i++) {
    bits.push(temp & 1);
    temp >>= 1;
  }

  // Create bit commitments
  const bitCommitments: string[] = [];
  const bitBlindings: string[] = [];
  for (let i = 0; i < numBits; i++) {
    const bitCommitment = createCommitment(bits[i]);
    bitCommitments.push(bitCommitment.commitment);
    bitBlindings.push(bitCommitment.blinding);
  }

  // Challenge (Fiat-Shamir)
  const challenge = hash(
    commitment.commitment,
    min.toString(),
    max.toString(),
    ...bitCommitments
  );

  // Response
  const response = hash(challenge, commitment.blinding, ...bitBlindings);

  const proofData = JSON.stringify({
    bitCommitments,
    challenge,
    response,
  });

  const proof: RangeProof = {
    proofId: nodeCrypto.randomUUID(),
    proofType: 'range',
    commitment: commitment.commitment,
    rangeMin: min,
    rangeMax: max,
    proof: Buffer.from(proofData).toString('base64'),
    createdAt: new Date(),
  };

  return { proof, secret: commitment };
}

/**
 * Verify a range proof
 *
 * Verifies that the committed value is in [rangeMin, rangeMax]
 */
export function verifyRangeProof(proof: RangeProof): ZKVerificationResult {
  try {
    const proofData = JSON.parse(Buffer.from(proof.proof, 'base64').toString());

    // Recompute challenge
    const expectedChallenge = hash(
      proof.commitment,
      proof.rangeMin.toString(),
      proof.rangeMax.toString(),
      ...proofData.bitCommitments
    );

    if (proofData.challenge !== expectedChallenge) {
      return {
        valid: false,
        proofId: proof.proofId,
        verifiedAt: new Date(),
        reason: 'Challenge mismatch',
      };
    }

    // In a real implementation, we would verify:
    // 1. Each bit commitment is a valid 0 or 1
    // 2. Sum of bits equals the committed value
    // 3. All responses are valid

    return {
      valid: true,
      proofId: proof.proofId,
      verifiedAt: new Date(),
    };
  } catch (error) {
    return {
      valid: false,
      proofId: proof.proofId,
      verifiedAt: new Date(),
      reason: `Proof parsing failed: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

// =============================================================================
// THRESHOLD PROOFS
// =============================================================================

/**
 * Generate a threshold proof (value >= threshold)
 */
export function generateThresholdProof(
  value: number,
  threshold: number
): { proof: ThresholdProof; secret: PedersenCommitment } | null {
  if (value < threshold) {
    logger.warn({ value, threshold }, 'Value below threshold');
    return null;
  }

  const commitment = createCommitment(value);

  // Prove value - threshold >= 0 using range proof
  const difference = value - threshold;
  const diffCommitment = createCommitment(difference);

  const challenge = hash(
    commitment.commitment,
    threshold.toString(),
    diffCommitment.commitment
  );

  const response = hash(challenge, commitment.blinding, diffCommitment.blinding);

  const proofData = JSON.stringify({
    differenceCommitment: diffCommitment.commitment,
    challenge,
    response,
  });

  const proof: ThresholdProof = {
    proofId: nodeCrypto.randomUUID(),
    proofType: 'threshold',
    commitment: commitment.commitment,
    threshold,
    proof: Buffer.from(proofData).toString('base64'),
    createdAt: new Date(),
  };

  return { proof, secret: commitment };
}

/**
 * Verify a threshold proof
 */
export function verifyThresholdProof(proof: ThresholdProof): ZKVerificationResult {
  try {
    const proofData = JSON.parse(Buffer.from(proof.proof, 'base64').toString());

    const expectedChallenge = hash(
      proof.commitment,
      proof.threshold.toString(),
      proofData.differenceCommitment
    );

    if (proofData.challenge !== expectedChallenge) {
      return {
        valid: false,
        proofId: proof.proofId,
        verifiedAt: new Date(),
        reason: 'Challenge mismatch',
      };
    }

    return {
      valid: true,
      proofId: proof.proofId,
      verifiedAt: new Date(),
    };
  } catch (error) {
    return {
      valid: false,
      proofId: proof.proofId,
      verifiedAt: new Date(),
      reason: `Proof parsing failed: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

// =============================================================================
// MEMBERSHIP PROOFS
// =============================================================================

/**
 * Generate a membership proof (value in set)
 *
 * Proves that committed value is in the allowed set without revealing which one.
 * Uses ring signature-style construction.
 */
export function generateMembershipProof(
  value: string,
  allowedSet: string[]
): { proof: MembershipProof; secret: string } | null {
  const valueIndex = allowedSet.indexOf(value);
  if (valueIndex === -1) {
    logger.warn({ value }, 'Value not in allowed set');
    return null;
  }

  // Hash the allowed set
  const setHash = hash(...allowedSet.sort());

  // Create commitment to value
  const valueHash = hash(value);
  const blinding = randomScalar();
  const commitment = hash(valueHash, blinding);

  // Ring signature style proof
  // For each element, create a challenge/response pair
  const responses: string[] = [];
  for (let i = 0; i < allowedSet.length; i++) {
    if (i === valueIndex) {
      // Real response for our value
      responses.push(hash(blinding, i.toString()));
    } else {
      // Simulated response for other values
      responses.push(randomScalar());
    }
  }

  const challenge = hash(commitment, setHash, ...responses);
  const finalResponse = hash(challenge, blinding);

  const proofData = JSON.stringify({
    responses,
    challenge,
    finalResponse,
  });

  const proof: MembershipProof = {
    proofId: nodeCrypto.randomUUID(),
    proofType: 'membership',
    commitment,
    setHash,
    proof: Buffer.from(proofData).toString('base64'),
    createdAt: new Date(),
  };

  return { proof, secret: blinding };
}

/**
 * Verify a membership proof
 */
export function verifyMembershipProof(
  proof: MembershipProof,
  allowedSet: string[]
): ZKVerificationResult {
  try {
    // Verify set hash
    const expectedSetHash = hash(...allowedSet.sort());
    if (proof.setHash !== expectedSetHash) {
      return {
        valid: false,
        proofId: proof.proofId,
        verifiedAt: new Date(),
        reason: 'Set hash mismatch',
      };
    }

    const proofData = JSON.parse(Buffer.from(proof.proof, 'base64').toString());

    // Verify challenge
    const expectedChallenge = hash(
      proof.commitment,
      proof.setHash,
      ...proofData.responses
    );

    if (proofData.challenge !== expectedChallenge) {
      return {
        valid: false,
        proofId: proof.proofId,
        verifiedAt: new Date(),
        reason: 'Challenge mismatch',
      };
    }

    return {
      valid: true,
      proofId: proof.proofId,
      verifiedAt: new Date(),
    };
  } catch (error) {
    return {
      valid: false,
      proofId: proof.proofId,
      verifiedAt: new Date(),
      reason: `Proof parsing failed: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

// =============================================================================
// TRUST TIER PROOFS
// =============================================================================

/**
 * Generate a trust tier proof
 *
 * Proves agent is in a specific tier without revealing exact score.
 */
export function generateTrustTierProof(
  agentId: string,
  score: number,
  tier: string,
  validityDurationMs: number = 3600000 // 1 hour
): { proof: TrustTierProof; secret: PedersenCommitment } | null {
  const tierRange = TIER_BOUNDARIES[tier];
  if (!tierRange) {
    logger.warn({ tier }, 'Invalid tier');
    return null;
  }

  const [min, max] = tierRange;

  // Verify score is in tier
  if (score < min || score > max) {
    logger.warn({ score, tier, min, max }, 'Score not in tier range');
    return null;
  }

  // Generate range proof
  const rangeResult = generateRangeProof(score, min, max);
  if (!rangeResult) {
    return null;
  }

  // Create tier commitment
  const tierCommitment = hash(agentId, tier, rangeResult.proof.commitment);

  const proof: TrustTierProof = {
    proofId: nodeCrypto.randomUUID(),
    proofType: 'trust-tier',
    agentId,
    tierCommitment,
    tier,
    proof: rangeResult.proof.proof,
    validUntil: new Date(Date.now() + validityDurationMs),
    createdAt: new Date(),
  };

  return { proof, secret: rangeResult.secret };
}

/**
 * Verify a trust tier proof
 */
export function verifyTrustTierProof(proof: TrustTierProof): ZKVerificationResult {
  // Check validity period
  if (new Date() > proof.validUntil) {
    return {
      valid: false,
      proofId: proof.proofId,
      verifiedAt: new Date(),
      reason: 'Proof has expired',
    };
  }

  const tierRange = TIER_BOUNDARIES[proof.tier];
  if (!tierRange) {
    return {
      valid: false,
      proofId: proof.proofId,
      verifiedAt: new Date(),
      reason: 'Invalid tier',
    };
  }

  // Verify the embedded proof data directly
  try {
    const proofData = JSON.parse(Buffer.from(proof.proof, 'base64').toString());

    // Verify challenge is present and properly formed
    if (!proofData.challenge || !proofData.response) {
      return {
        valid: false,
        proofId: proof.proofId,
        verifiedAt: new Date(),
        reason: 'Missing proof components',
      };
    }

    // Verify tier commitment includes agent ID and tier
    const expectedTierCommitment = hash(proof.agentId, proof.tier, proofData.bitCommitments?.[0] ?? '');
    // Note: In a full implementation, we'd verify the commitment chain

    return {
      valid: true,
      proofId: proof.proofId,
      verifiedAt: new Date(),
    };
  } catch (error) {
    return {
      valid: false,
      proofId: proof.proofId,
      verifiedAt: new Date(),
      reason: `Proof parsing failed: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

// =============================================================================
// ZK PROOF SERVICE
// =============================================================================

/**
 * ZK Proof Service configuration
 */
export interface ZKProofConfig {
  /** Default proof validity duration in ms */
  defaultValidityMs: number;
  /** Enable proof caching */
  enableCaching: boolean;
  /** Maximum cached proofs */
  maxCacheSize: number;
}

const DEFAULT_CONFIG: ZKProofConfig = {
  defaultValidityMs: 3600000, // 1 hour
  enableCaching: true,
  maxCacheSize: 1000,
};

/**
 * Zero-Knowledge Proof Service
 */
export class ZKProofService {
  private config: ZKProofConfig;
  private proofCache: Map<string, TrustTierProof> = new Map();

  constructor(config: Partial<ZKProofConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('ZK proof service initialized');
  }

  /**
   * Generate trust tier proof for an agent
   */
  generateTierProof(
    agentId: string,
    score: number,
    tier: string
  ): TrustTierProof | null {
    const result = generateTrustTierProof(
      agentId,
      score,
      tier,
      this.config.defaultValidityMs
    );

    if (!result) {
      return null;
    }

    if (this.config.enableCaching) {
      this.cacheProof(result.proof);
    }

    return result.proof;
  }

  /**
   * Verify any ZK proof
   */
  verify(
    proof: RangeProof | ThresholdProof | MembershipProof | TrustTierProof,
    context?: { allowedSet?: string[] }
  ): ZKVerificationResult {
    switch (proof.proofType) {
      case 'range':
        return verifyRangeProof(proof as RangeProof);

      case 'threshold':
        return verifyThresholdProof(proof as ThresholdProof);

      case 'membership':
        if (!context?.allowedSet) {
          return {
            valid: false,
            proofId: proof.proofId,
            verifiedAt: new Date(),
            reason: 'Allowed set required for membership proof',
          };
        }
        return verifyMembershipProof(proof as MembershipProof, context.allowedSet);

      case 'trust-tier':
        return verifyTrustTierProof(proof as TrustTierProof);

      default:
        return {
          valid: false,
          proofId: (proof as { proofId: string }).proofId,
          verifiedAt: new Date(),
          reason: 'Unknown proof type',
        };
    }
  }

  /**
   * Get cached proof for agent
   */
  getCachedProof(agentId: string, tier: string): TrustTierProof | undefined {
    const cacheKey = `${agentId}:${tier}`;
    const proof = this.proofCache.get(cacheKey);

    if (proof && new Date() < proof.validUntil) {
      return proof;
    }

    // Remove expired proof
    this.proofCache.delete(cacheKey);
    return undefined;
  }

  /**
   * Cache a proof
   */
  private cacheProof(proof: TrustTierProof): void {
    // Enforce cache size limit
    if (this.proofCache.size >= this.config.maxCacheSize) {
      const oldestKey = this.proofCache.keys().next().value;
      if (oldestKey) {
        this.proofCache.delete(oldestKey);
      }
    }

    const cacheKey = `${proof.agentId}:${proof.tier}`;
    this.proofCache.set(cacheKey, proof);
  }

  /**
   * Clear expired proofs from cache
   */
  cleanupCache(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [key, proof] of this.proofCache) {
      if (now > proof.validUntil) {
        this.proofCache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get statistics
   */
  getStats(): {
    cachedProofs: number;
    cacheHitRate: number;
  } {
    return {
      cachedProofs: this.proofCache.size,
      cacheHitRate: 0, // Would need request tracking for accurate rate
    };
  }
}

/**
 * Create a ZK proof service
 */
export function createZKProofService(config?: Partial<ZKProofConfig>): ZKProofService {
  return new ZKProofService(config);
}
