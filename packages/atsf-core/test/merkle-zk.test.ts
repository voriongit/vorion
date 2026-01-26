/**
 * Merkle Aggregation and ZK Proofs - Integration Tests
 */

import { describe, it, expect } from 'vitest';
import {
  // Merkle
  buildMerkleTree,
  generateMerkleProof,
  verifyMerkleProof,
  MerkleAggregationService,
  createMerkleAggregationService,

  // ZK Proofs
  createCommitment,
  verifyCommitment,
  generateRangeProof,
  verifyRangeProof,
  generateThresholdProof,
  verifyThresholdProof,
  generateMembershipProof,
  verifyMembershipProof,
  generateTrustTierProof,
  verifyTrustTierProof,
  ZKProofService,
  createZKProofService,
} from '../src/proof/index.js';

// =============================================================================
// MERKLE TREE TESTS
// =============================================================================

describe('Merkle Tree', () => {
  describe('buildMerkleTree', () => {
    it('should build tree from single leaf', () => {
      const tree = buildMerkleTree(['abc123']);
      expect(tree).toBeDefined();
      expect(tree!.hash).toBe('abc123');
    });

    it('should build tree from multiple leaves', () => {
      const leaves = ['a', 'b', 'c', 'd'];
      const tree = buildMerkleTree(leaves);

      expect(tree).toBeDefined();
      expect(tree!.left).toBeDefined();
      expect(tree!.right).toBeDefined();
    });

    it('should handle odd number of leaves', () => {
      const leaves = ['a', 'b', 'c'];
      const tree = buildMerkleTree(leaves);

      expect(tree).toBeDefined();
    });

    it('should return null for empty array', () => {
      const tree = buildMerkleTree([]);
      expect(tree).toBeNull();
    });
  });

  describe('generateMerkleProof', () => {
    it('should generate valid proof for leaf', () => {
      const leaves = ['a', 'b', 'c', 'd'];
      const proof = generateMerkleProof(leaves, 1);

      expect(proof).toBeDefined();
      expect(proof!.leafHash).toBe('b');
      expect(proof!.leafIndex).toBe(1);
      expect(proof!.path.length).toBeGreaterThan(0);
    });

    it('should return null for invalid index', () => {
      const leaves = ['a', 'b'];
      const proof = generateMerkleProof(leaves, 5);
      expect(proof).toBeNull();
    });
  });

  describe('verifyMerkleProof', () => {
    it('should verify valid proof', () => {
      const leaves = ['leaf1', 'leaf2', 'leaf3', 'leaf4'];
      const proof = generateMerkleProof(leaves, 2);

      expect(proof).toBeDefined();
      expect(verifyMerkleProof(proof!)).toBe(true);
    });

    it('should reject tampered proof', () => {
      const leaves = ['leaf1', 'leaf2', 'leaf3', 'leaf4'];
      const proof = generateMerkleProof(leaves, 2);

      // Tamper with leaf hash
      proof!.leafHash = 'tampered';
      expect(verifyMerkleProof(proof!)).toBe(false);
    });
  });
});

describe('Merkle Aggregation Service', () => {
  it('should add items and anchor', async () => {
    const service = createMerkleAggregationService({
      minBatchSize: 2,
      maxBatchSize: 10,
    });

    await service.addItem('item-1', 'data-1');
    await service.addItem('item-2', 'data-2');
    await service.addItem('item-3', 'data-3');

    const result = await service.anchor();

    expect(result).toBeDefined();
    expect(result!.anchor.leafCount).toBe(3);
    expect(result!.proofs.size).toBe(3);
  });

  it('should verify inclusion', async () => {
    const service = createMerkleAggregationService();

    await service.addItem('item-1', 'data-1');
    await service.addItem('item-2', 'data-2');

    const result = await service.anchor();
    const anchorId = result!.anchor.anchorId;

    expect(service.verifyInclusion(anchorId, 'item-1', 'data-1')).toBe(true);
    expect(service.verifyInclusion(anchorId, 'item-1', 'wrong-data')).toBe(false);
  });

  it('should track statistics', async () => {
    const service = createMerkleAggregationService();

    await service.addItem('item-1', 'data-1');
    await service.addItem('item-2', 'data-2');
    await service.anchor();

    const stats = service.getStats();
    expect(stats.totalAnchors).toBe(1);
    expect(stats.totalProofs).toBe(2);
    expect(stats.pendingItems).toBe(0);
  });
});

// =============================================================================
// ZK PROOF TESTS
// =============================================================================

describe('Pedersen Commitments', () => {
  it('should create and verify commitment', () => {
    const value = 500;
    const commitment = createCommitment(value);

    expect(commitment.commitment).toBeDefined();
    expect(commitment.blinding).toBeDefined();

    expect(verifyCommitment(commitment.commitment, value, commitment.blinding)).toBe(true);
    expect(verifyCommitment(commitment.commitment, value + 1, commitment.blinding)).toBe(false);
  });
});

describe('Range Proofs', () => {
  it('should generate valid range proof', () => {
    const value = 500;
    const result = generateRangeProof(value, 300, 700);

    expect(result).toBeDefined();
    expect(result!.proof.rangeMin).toBe(300);
    expect(result!.proof.rangeMax).toBe(700);
  });

  it('should reject out-of-range value', () => {
    const result = generateRangeProof(100, 300, 700);
    expect(result).toBeNull();
  });

  it('should verify valid range proof', () => {
    const result = generateRangeProof(500, 300, 700);
    const verification = verifyRangeProof(result!.proof);

    expect(verification.valid).toBe(true);
  });
});

describe('Threshold Proofs', () => {
  it('should generate valid threshold proof', () => {
    const result = generateThresholdProof(750, 500);

    expect(result).toBeDefined();
    expect(result!.proof.threshold).toBe(500);
  });

  it('should reject below-threshold value', () => {
    const result = generateThresholdProof(400, 500);
    expect(result).toBeNull();
  });

  it('should verify valid threshold proof', () => {
    const result = generateThresholdProof(750, 500);
    const verification = verifyThresholdProof(result!.proof);

    expect(verification.valid).toBe(true);
  });
});

describe('Membership Proofs', () => {
  it('should generate valid membership proof', () => {
    const allowedSet = ['admin', 'operator', 'viewer'];
    const result = generateMembershipProof('operator', allowedSet);

    expect(result).toBeDefined();
  });

  it('should reject non-member value', () => {
    const allowedSet = ['admin', 'operator', 'viewer'];
    const result = generateMembershipProof('hacker', allowedSet);

    expect(result).toBeNull();
  });

  it('should verify valid membership proof', () => {
    const allowedSet = ['admin', 'operator', 'viewer'];
    const result = generateMembershipProof('admin', allowedSet);
    const verification = verifyMembershipProof(result!.proof, allowedSet);

    expect(verification.valid).toBe(true);
  });

  it('should reject proof with wrong set', () => {
    const allowedSet = ['admin', 'operator', 'viewer'];
    const wrongSet = ['admin', 'operator', 'viewer', 'extra'];
    const result = generateMembershipProof('admin', allowedSet);
    const verification = verifyMembershipProof(result!.proof, wrongSet);

    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('Set hash mismatch');
  });
});

describe('Trust Tier Proofs', () => {
  it('should generate T3 proof for score 600', () => {
    const result = generateTrustTierProof('agent-001', 600, 'T3');

    expect(result).toBeDefined();
    expect(result!.proof.tier).toBe('T3');
    expect(result!.proof.agentId).toBe('agent-001');
  });

  it('should reject score outside tier', () => {
    // T3 is 500-699, score 750 is T4
    const result = generateTrustTierProof('agent-001', 750, 'T3');
    expect(result).toBeNull();
  });

  it('should verify valid tier proof', () => {
    const result = generateTrustTierProof('agent-001', 600, 'T3', 3600000);
    const verification = verifyTrustTierProof(result!.proof);

    expect(verification.valid).toBe(true);
  });

  it('should reject expired tier proof', async () => {
    const result = generateTrustTierProof('agent-001', 600, 'T3', 1); // 1ms validity

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 10));

    const verification = verifyTrustTierProof(result!.proof);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('expired');
  });
});

describe('ZK Proof Service', () => {
  it('should generate and cache tier proof', () => {
    const service = createZKProofService();

    const proof = service.generateTierProof('agent-001', 600, 'T3');
    expect(proof).toBeDefined();

    // Should be cached
    const cached = service.getCachedProof('agent-001', 'T3');
    expect(cached).toBeDefined();
    expect(cached!.proofId).toBe(proof!.proofId);
  });

  it('should verify different proof types', () => {
    const service = createZKProofService();

    // Range proof
    const rangeResult = generateRangeProof(500, 300, 700);
    const rangeVerification = service.verify(rangeResult!.proof);
    expect(rangeVerification.valid).toBe(true);

    // Threshold proof
    const thresholdResult = generateThresholdProof(750, 500);
    const thresholdVerification = service.verify(thresholdResult!.proof);
    expect(thresholdVerification.valid).toBe(true);

    // Membership proof
    const membershipResult = generateMembershipProof('admin', ['admin', 'user']);
    const membershipVerification = service.verify(membershipResult!.proof, {
      allowedSet: ['admin', 'user'],
    });
    expect(membershipVerification.valid).toBe(true);
  });

  it('should cleanup expired cache entries', async () => {
    const service = createZKProofService({
      defaultValidityMs: 10, // Very short for testing
    });

    service.generateTierProof('agent-001', 600, 'T3');

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 20));

    const cleaned = service.cleanupCache();
    expect(cleaned).toBe(1);
  });
});
