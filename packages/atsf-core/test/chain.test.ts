/**
 * CHAIN Layer Tests
 *
 * Tests for blockchain anchoring functionality including:
 * - Merkle tree computation
 * - Merkle proof generation and verification
 * - Mock chain anchor service
 * - Batch anchoring
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  sha256,
  computeMerkleRoot,
  computeMerkleProof,
  verifyMerkleProof,
  createChainAnchor,
  MockChainAnchorService,
  POLYGON_NETWORKS,
} from '../src/chain/index.js';
import type { ProofToAnchor, ChainAnchorConfig } from '../src/chain/index.js';

describe('CHAIN Layer', () => {
  describe('sha256', () => {
    it('should compute consistent SHA-256 hashes', async () => {
      const hash1 = await sha256('test');
      const hash2 = await sha256('test');

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should produce different hashes for different inputs', async () => {
      const hash1 = await sha256('test1');
      const hash2 = await sha256('test2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('computeMerkleRoot', () => {
    it('should return the single hash for a single-element list', async () => {
      const hash = '0x' + '1'.repeat(64);
      const root = await computeMerkleRoot([hash]);

      expect(root).toBe(hash);
    });

    it('should compute root for two elements', async () => {
      const hashes = [
        '0x' + '1'.repeat(64),
        '0x' + '2'.repeat(64),
      ];

      const root = await computeMerkleRoot(hashes);

      expect(root).toMatch(/^0x[a-f0-9]+$/);
      expect(root).not.toBe(hashes[0]);
      expect(root).not.toBe(hashes[1]);
    });

    it('should compute root for multiple elements', async () => {
      const hashes = [
        await sha256('proof1'),
        await sha256('proof2'),
        await sha256('proof3'),
        await sha256('proof4'),
      ];

      const root = await computeMerkleRoot(hashes);

      expect(root).toMatch(/^0x[a-f0-9]+$/);
    });

    it('should handle odd number of elements', async () => {
      const hashes = [
        await sha256('proof1'),
        await sha256('proof2'),
        await sha256('proof3'),
      ];

      const root = await computeMerkleRoot(hashes);

      expect(root).toMatch(/^0x[a-f0-9]+$/);
    });

    it('should produce deterministic results', async () => {
      const hashes = [
        await sha256('proof1'),
        await sha256('proof2'),
        await sha256('proof3'),
      ];

      const root1 = await computeMerkleRoot(hashes);
      const root2 = await computeMerkleRoot(hashes);

      expect(root1).toBe(root2);
    });

    it('should throw for empty list', async () => {
      await expect(computeMerkleRoot([])).rejects.toThrow('Cannot compute Merkle root of empty list');
    });
  });

  describe('computeMerkleProof', () => {
    it('should compute valid proof for first element', async () => {
      const hashes = [
        await sha256('proof1'),
        await sha256('proof2'),
        await sha256('proof3'),
        await sha256('proof4'),
      ];

      const proof = await computeMerkleProof(hashes, 0);
      const root = await computeMerkleRoot(hashes);

      expect(proof.length).toBeGreaterThan(0);
      expect(await verifyMerkleProof(hashes[0], proof, root)).toBe(true);
    });

    it('should compute valid proof for last element', async () => {
      const hashes = [
        await sha256('proof1'),
        await sha256('proof2'),
        await sha256('proof3'),
        await sha256('proof4'),
      ];

      const proof = await computeMerkleProof(hashes, 3);
      const root = await computeMerkleRoot(hashes);

      expect(await verifyMerkleProof(hashes[3], proof, root)).toBe(true);
    });

    it('should compute valid proof for middle element', async () => {
      const hashes = [
        await sha256('proof1'),
        await sha256('proof2'),
        await sha256('proof3'),
        await sha256('proof4'),
        await sha256('proof5'),
      ];

      const proof = await computeMerkleProof(hashes, 2);
      const root = await computeMerkleRoot(hashes);

      expect(await verifyMerkleProof(hashes[2], proof, root)).toBe(true);
    });

    it('should throw for out-of-bounds index', async () => {
      const hashes = [await sha256('proof1')];

      await expect(computeMerkleProof(hashes, 1)).rejects.toThrow('Target index out of bounds');
      await expect(computeMerkleProof(hashes, -1)).rejects.toThrow('Target index out of bounds');
    });
  });

  describe('verifyMerkleProof', () => {
    it('should verify valid proof', async () => {
      const hashes = [
        await sha256('proof1'),
        await sha256('proof2'),
      ];

      const root = await computeMerkleRoot(hashes);
      const proof = await computeMerkleProof(hashes, 0);

      expect(await verifyMerkleProof(hashes[0], proof, root)).toBe(true);
    });

    it('should reject invalid proof (wrong leaf)', async () => {
      const hashes = [
        await sha256('proof1'),
        await sha256('proof2'),
      ];

      const root = await computeMerkleRoot(hashes);
      const proof = await computeMerkleProof(hashes, 0);

      // Use wrong leaf
      const wrongLeaf = await sha256('wrong');
      expect(await verifyMerkleProof(wrongLeaf, proof, root)).toBe(false);
    });

    it('should reject invalid proof (wrong root)', async () => {
      const hashes = [
        await sha256('proof1'),
        await sha256('proof2'),
      ];

      const proof = await computeMerkleProof(hashes, 0);
      const wrongRoot = await sha256('wrong_root');

      expect(await verifyMerkleProof(hashes[0], proof, wrongRoot)).toBe(false);
    });
  });

  describe('POLYGON_NETWORKS', () => {
    it('should have mainnet configuration', () => {
      expect(POLYGON_NETWORKS.mainnet).toBeDefined();
      expect(POLYGON_NETWORKS.mainnet.chainId).toBe(137);
      expect(POLYGON_NETWORKS.mainnet.name).toBe('Polygon Mainnet');
    });

    it('should have amoy testnet configuration', () => {
      expect(POLYGON_NETWORKS.amoy).toBeDefined();
      expect(POLYGON_NETWORKS.amoy.chainId).toBe(80002);
      expect(POLYGON_NETWORKS.amoy.name).toBe('Polygon Amoy Testnet');
    });
  });

  describe('MockChainAnchorService', () => {
    let service: MockChainAnchorService;
    const config: ChainAnchorConfig = {
      network: 'amoy',
      contractAddress: '0x' + '1'.repeat(40),
    };

    beforeEach(() => {
      service = createChainAnchor(config);
    });

    describe('anchorBatch', () => {
      it('should anchor a single proof', async () => {
        const proofs: ProofToAnchor[] = [
          { proofHash: await sha256('proof1'), agentId: 'agent-1' },
        ];

        const result = await service.anchorBatch(proofs);

        expect(result.batchId).toBe(1n);
        expect(result.proofCount).toBe(1);
        expect(result.merkleRoot).toBe(proofs[0].proofHash);
        expect(result.transactionHash).toMatch(/^0x[a-f0-9]{64}$/);
        expect(result.explorerUrl).toContain('amoy.polygonscan.com');
      });

      it('should anchor multiple proofs', async () => {
        const proofs: ProofToAnchor[] = [
          { proofHash: await sha256('proof1'), agentId: 'agent-1' },
          { proofHash: await sha256('proof2'), agentId: 'agent-2' },
          { proofHash: await sha256('proof3'), agentId: 'agent-3' },
        ];

        const result = await service.anchorBatch(proofs);

        expect(result.batchId).toBe(1n);
        expect(result.proofCount).toBe(3);
        expect(result.merkleRoot).not.toBe(proofs[0].proofHash);
      });

      it('should increment batch IDs', async () => {
        const proofs1: ProofToAnchor[] = [
          { proofHash: await sha256('proof1'), agentId: 'agent-1' },
        ];
        const proofs2: ProofToAnchor[] = [
          { proofHash: await sha256('proof2'), agentId: 'agent-2' },
        ];

        const result1 = await service.anchorBatch(proofs1);
        const result2 = await service.anchorBatch(proofs2);

        expect(result1.batchId).toBe(1n);
        expect(result2.batchId).toBe(2n);
      });

      it('should throw for empty batch', async () => {
        await expect(service.anchorBatch([])).rejects.toThrow('Cannot anchor empty batch');
      });
    });

    describe('verifyProof', () => {
      it('should verify anchored proof', async () => {
        const proofs: ProofToAnchor[] = [
          { proofHash: await sha256('proof1'), agentId: 'agent-1' },
          { proofHash: await sha256('proof2'), agentId: 'agent-2' },
        ];

        const result = await service.anchorBatch(proofs);
        const merkleProof = await computeMerkleProof(
          proofs.map((p) => p.proofHash),
          0
        );

        const isValid = await service.verifyProof(
          proofs[0].proofHash,
          merkleProof,
          result.batchId
        );

        expect(isValid).toBe(true);
      });

      it('should reject proof from non-existent batch', async () => {
        const isValid = await service.verifyProof(
          await sha256('proof1'),
          [],
          999n
        );

        expect(isValid).toBe(false);
      });
    });

    describe('getProofAnchor', () => {
      it('should return anchor info for anchored proof', async () => {
        const proofHash = await sha256('proof1');
        const proofs: ProofToAnchor[] = [{ proofHash, agentId: 'agent-1' }];

        await service.anchorBatch(proofs);
        const anchor = await service.getProofAnchor(proofHash);

        expect(anchor).not.toBeNull();
        expect(anchor!.valid).toBe(true);
        expect(anchor!.batchId).toBe(1n);
        expect(anchor!.anchoredAt).toBeInstanceOf(Date);
      });

      it('should return null for non-anchored proof', async () => {
        const anchor = await service.getProofAnchor(await sha256('not-anchored'));

        expect(anchor).toBeNull();
      });
    });

    describe('getStats', () => {
      it('should track batch and proof counts', async () => {
        const proofs1: ProofToAnchor[] = [
          { proofHash: await sha256('proof1'), agentId: 'agent-1' },
          { proofHash: await sha256('proof2'), agentId: 'agent-2' },
        ];
        const proofs2: ProofToAnchor[] = [
          { proofHash: await sha256('proof3'), agentId: 'agent-3' },
        ];

        await service.anchorBatch(proofs1);
        await service.anchorBatch(proofs2);

        const stats = service.getStats();

        expect(stats.batchCount).toBe(2n);
        expect(stats.totalProofs).toBe(3);
      });
    });
  });

  describe('Integration: PROOF to CHAIN', () => {
    it('should anchor proof hashes and verify them', async () => {
      // Simulate proofs from PROOF layer
      const proofRecords = [
        {
          id: 'prf_1',
          hash: await sha256(JSON.stringify({ id: 'prf_1', decision: 'allow' })),
          agentId: 'agent-alpha',
        },
        {
          id: 'prf_2',
          hash: await sha256(JSON.stringify({ id: 'prf_2', decision: 'deny' })),
          agentId: 'agent-beta',
        },
        {
          id: 'prf_3',
          hash: await sha256(JSON.stringify({ id: 'prf_3', decision: 'escalate' })),
          agentId: 'agent-gamma',
        },
      ];

      // Create chain anchor service
      const chainService = createChainAnchor({
        network: 'amoy',
        contractAddress: '0x' + 'a'.repeat(40),
      });

      // Anchor the batch
      const anchorResult = await chainService.anchorBatch(
        proofRecords.map((p) => ({
          proofHash: p.hash,
          agentId: p.agentId,
        }))
      );

      expect(anchorResult.proofCount).toBe(3);

      // Verify each proof
      for (let i = 0; i < proofRecords.length; i++) {
        const proof = proofRecords[i];
        const merkleProof = await computeMerkleProof(
          proofRecords.map((p) => p.hash),
          i
        );

        const isValid = await chainService.verifyProof(
          proof.hash,
          merkleProof,
          anchorResult.batchId
        );

        expect(isValid).toBe(true);

        // Also check getProofAnchor
        const anchorInfo = await chainService.getProofAnchor(proof.hash);
        expect(anchorInfo).not.toBeNull();
        expect(anchorInfo!.batchId).toBe(anchorResult.batchId);
      }
    });

    it('should detect tampering via Merkle verification', async () => {
      const proofHashes = [
        await sha256('proof1'),
        await sha256('proof2'),
        await sha256('proof3'),
      ];

      const chainService = createChainAnchor({
        network: 'amoy',
        contractAddress: '0x' + 'b'.repeat(40),
      });

      const anchorResult = await chainService.anchorBatch(
        proofHashes.map((hash, i) => ({
          proofHash: hash,
          agentId: `agent-${i}`,
        }))
      );

      // Generate proof for first element
      const validProof = await computeMerkleProof(proofHashes, 0);

      // Valid verification
      expect(
        await chainService.verifyProof(proofHashes[0], validProof, anchorResult.batchId)
      ).toBe(true);

      // Tampered hash should fail
      const tamperedHash = await sha256('tampered');
      expect(
        await chainService.verifyProof(tamperedHash, validProof, anchorResult.batchId)
      ).toBe(false);
    });
  });
});
