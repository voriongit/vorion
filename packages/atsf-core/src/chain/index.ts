/**
 * CHAIN Layer - Blockchain Anchoring
 *
 * Anchors proof hashes to Polygon blockchain for immutable verification.
 * Supports batching via Merkle trees for cost efficiency.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';

const logger = createLogger({ component: 'chain' });

/**
 * Polygon network configuration
 */
export const POLYGON_NETWORKS = {
  mainnet: {
    rpcUrl: 'https://polygon-rpc.com',
    chainId: 137,
    blockExplorer: 'https://polygonscan.com',
    name: 'Polygon Mainnet',
  },
  amoy: {
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    chainId: 80002,
    blockExplorer: 'https://amoy.polygonscan.com',
    name: 'Polygon Amoy Testnet',
  },
} as const;

export type NetworkName = keyof typeof POLYGON_NETWORKS;

/**
 * Chain anchor configuration
 */
export interface ChainAnchorConfig {
  /** Network to use (mainnet or amoy testnet) */
  network: NetworkName;
  /** Deployed BASISAnchor contract address */
  contractAddress: string;
  /** Private key for transaction signing (hex string) */
  privateKey?: string;
  /** Custom RPC URL override */
  rpcUrl?: string;
  /** Gas limit multiplier (default: 1.2 = 20% buffer) */
  gasMultiplier?: number;
}

/**
 * Proof data to anchor
 */
export interface ProofToAnchor {
  /** SHA-256 hash of the proof (0x-prefixed hex) */
  proofHash: string;
  /** Agent ID associated with the proof */
  agentId: string;
}

/**
 * Result of anchoring operation
 */
export interface AnchorResult {
  /** Batch ID assigned by the contract */
  batchId: bigint;
  /** Transaction hash */
  transactionHash: string;
  /** Block number where anchored */
  blockNumber: number;
  /** Merkle root of the batch */
  merkleRoot: string;
  /** Number of proofs in the batch */
  proofCount: number;
  /** Block explorer URL */
  explorerUrl: string;
}

/**
 * Result of verification operation
 */
export interface VerificationResult {
  /** Whether the proof is valid on-chain */
  valid: boolean;
  /** Batch ID containing the proof */
  batchId: bigint;
  /** Merkle root of the batch */
  merkleRoot: string;
  /** Timestamp when anchored */
  anchoredAt: Date;
  /** Block explorer URL */
  explorerUrl: string;
}

/**
 * Compute SHA-256 hash of a string
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute keccak256 hash (Ethereum-style)
 * Note: In production, use ethers.keccak256
 */
export async function keccak256Concat(a: string, b: string): Promise<string> {
  // For testing, use sha256 as a stand-in
  // In production, replace with ethers.keccak256(ethers.concat([a, b]))
  return sha256(a + b);
}

/**
 * Compute Merkle root from a list of hashes
 */
export async function computeMerkleRoot(hashes: string[]): Promise<string> {
  if (hashes.length === 0) {
    throw new Error('Cannot compute Merkle root of empty list');
  }

  if (hashes.length === 1) {
    return hashes[0];
  }

  let layer = [...hashes];

  while (layer.length > 1) {
    const nextLayer: string[] = [];

    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        // Hash pair together (sorted for deterministic ordering)
        const [left, right] = [layer[i], layer[i + 1]].sort();
        nextLayer.push(await keccak256Concat(left, right));
      } else {
        // Odd element, promote to next layer
        nextLayer.push(layer[i]);
      }
    }

    layer = nextLayer;
  }

  return layer[0];
}

/**
 * Compute Merkle proof for a specific leaf
 */
export async function computeMerkleProof(
  hashes: string[],
  targetIndex: number
): Promise<string[]> {
  if (targetIndex < 0 || targetIndex >= hashes.length) {
    throw new Error('Target index out of bounds');
  }

  const proof: string[] = [];
  let layer = [...hashes];
  let index = targetIndex;

  while (layer.length > 1) {
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;

    if (siblingIndex < layer.length) {
      proof.push(layer[siblingIndex]);
    }

    // Build next layer
    const nextLayer: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        const [left, right] = [layer[i], layer[i + 1]].sort();
        nextLayer.push(await keccak256Concat(left, right));
      } else {
        nextLayer.push(layer[i]);
      }
    }

    layer = nextLayer;
    index = Math.floor(index / 2);
  }

  return proof;
}

/**
 * Verify a Merkle proof
 */
export async function verifyMerkleProof(
  leaf: string,
  proof: string[],
  root: string
): Promise<boolean> {
  let current = leaf;

  for (const sibling of proof) {
    const [left, right] = [current, sibling].sort();
    current = await keccak256Concat(left, right);
  }

  return current === root;
}

/**
 * Mock ChainAnchorService for testing
 * In production, use the full implementation with ethers.js
 */
export class MockChainAnchorService {
  private config: ChainAnchorConfig;
  private batchCount = 0n;
  private batches: Map<bigint, { merkleRoot: string; proofHashes: string[]; timestamp: Date }> =
    new Map();
  private proofToBatch: Map<string, bigint> = new Map();

  constructor(config: ChainAnchorConfig) {
    this.config = config;
    logger.info({ network: config.network }, 'MockChainAnchorService initialized');
  }

  /**
   * Mock anchor batch - simulates blockchain anchoring
   */
  async anchorBatch(proofs: ProofToAnchor[]): Promise<AnchorResult> {
    if (proofs.length === 0) {
      throw new Error('Cannot anchor empty batch');
    }

    const proofHashes = proofs.map((p) => p.proofHash);
    const merkleRoot = await computeMerkleRoot(proofHashes);

    this.batchCount += 1n;
    const batchId = this.batchCount;

    this.batches.set(batchId, {
      merkleRoot,
      proofHashes,
      timestamp: new Date(),
    });

    for (const hash of proofHashes) {
      this.proofToBatch.set(hash, batchId);
    }

    const networkConfig = POLYGON_NETWORKS[this.config.network];
    const mockTxHash = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;

    logger.info(
      {
        batchId: batchId.toString(),
        proofCount: proofs.length,
        merkleRoot,
      },
      'Batch anchored (mock)'
    );

    return {
      batchId,
      transactionHash: mockTxHash,
      blockNumber: Math.floor(Math.random() * 1000000) + 50000000,
      merkleRoot,
      proofCount: proofs.length,
      explorerUrl: `${networkConfig.blockExplorer}/tx/${mockTxHash}`,
    };
  }

  /**
   * Mock verify proof
   */
  async verifyProof(
    proofHash: string,
    merkleProof: string[],
    batchId: bigint
  ): Promise<boolean> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      return false;
    }

    return verifyMerkleProof(proofHash, merkleProof, batch.merkleRoot);
  }

  /**
   * Mock get proof anchor info
   */
  async getProofAnchor(proofHash: string): Promise<VerificationResult | null> {
    const batchId = this.proofToBatch.get(proofHash);
    if (!batchId) {
      return null;
    }

    const batch = this.batches.get(batchId);
    if (!batch) {
      return null;
    }

    const networkConfig = POLYGON_NETWORKS[this.config.network];

    return {
      valid: true,
      batchId,
      merkleRoot: batch.merkleRoot,
      anchoredAt: batch.timestamp,
      explorerUrl: `${networkConfig.blockExplorer}/address/${this.config.contractAddress}`,
    };
  }

  /**
   * Get batch info
   */
  getBatch(batchId: bigint) {
    return this.batches.get(batchId);
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      batchCount: this.batchCount,
      totalProofs: this.proofToBatch.size,
    };
  }
}

/**
 * Create a chain anchor service
 * Returns mock service by default; use createRealChainAnchor for production
 */
export function createChainAnchor(config: ChainAnchorConfig): MockChainAnchorService {
  return new MockChainAnchorService(config);
}
