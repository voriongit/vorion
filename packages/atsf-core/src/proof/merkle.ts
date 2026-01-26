/**
 * Merkle Tree Aggregation Service
 *
 * Implements batch proof aggregation using Merkle trees for:
 * - Efficient batch verification
 * - External anchoring (blockchain, timestamping services)
 * - Privacy-preserving proof disclosure
 *
 * Key Features:
 * - SHA-256 based Merkle tree construction
 * - Incremental tree building
 * - Compact inclusion proofs
 * - Anchor commitments for external verification
 *
 * @packageDocumentation
 */

import * as nodeCrypto from 'node:crypto';
import { createLogger } from '../common/logger.js';
import type { ID, Proof } from '../common/types.js';

const logger = createLogger({ component: 'proof:merkle' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Merkle tree node
 */
export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  data?: string; // Only for leaf nodes
}

/**
 * Merkle inclusion proof
 */
export interface MerkleProof {
  /** Leaf hash being proven */
  leafHash: string;
  /** Proof path (sibling hashes) */
  path: Array<{
    hash: string;
    position: 'left' | 'right';
  }>;
  /** Root hash */
  root: string;
  /** Leaf index in tree */
  leafIndex: number;
  /** Total leaves in tree */
  treeSize: number;
}

/**
 * Merkle tree anchor commitment
 */
export interface MerkleAnchor {
  /** Unique anchor ID */
  anchorId: string;
  /** Merkle root hash */
  rootHash: string;
  /** Number of leaves in tree */
  leafCount: number;
  /** Timestamp of anchor creation */
  timestamp: Date;
  /** External anchor references */
  externalAnchors: ExternalAnchor[];
  /** Signature of root by anchor service */
  signature?: string;
}

/**
 * External anchor reference
 */
export interface ExternalAnchor {
  /** Type of external anchor */
  type: 'ethereum' | 'bitcoin' | 'rfc3161' | 'custom';
  /** Transaction hash or reference ID */
  reference: string;
  /** Anchor timestamp */
  timestamp?: Date;
  /** Confirmation status */
  confirmed: boolean;
}

/**
 * Batch aggregation result
 */
export interface BatchAggregationResult {
  /** Anchor record */
  anchor: MerkleAnchor;
  /** Proofs for each item */
  proofs: Map<string, MerkleProof>;
  /** Time taken in ms */
  durationMs: number;
}

// =============================================================================
// MERKLE TREE CONSTRUCTION
// =============================================================================

/**
 * Compute SHA-256 hash
 */
function sha256(data: string | Buffer): string {
  return nodeCrypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Hash two nodes together (sorted for consistency)
 */
function hashNodes(left: string, right: string): string {
  // Sort to ensure consistent ordering regardless of sibling position
  const [first, second] = left < right ? [left, right] : [right, left];
  return sha256(first + second);
}

/**
 * Build Merkle tree from leaf hashes
 */
export function buildMerkleTree(leafHashes: string[]): MerkleNode | null {
  if (leafHashes.length === 0) {
    return null;
  }

  // Create leaf nodes
  let currentLevel: MerkleNode[] = leafHashes.map((hash) => ({
    hash,
    data: hash,
  }));

  // Build tree bottom-up
  while (currentLevel.length > 1) {
    const nextLevel: MerkleNode[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] ?? left; // Duplicate last if odd

      nextLevel.push({
        hash: hashNodes(left.hash, right.hash),
        left,
        right: currentLevel[i + 1] ? right : undefined,
      });
    }

    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

/**
 * Generate Merkle proof for a leaf
 */
export function generateMerkleProof(
  leafHashes: string[],
  leafIndex: number
): MerkleProof | null {
  if (leafIndex < 0 || leafIndex >= leafHashes.length) {
    return null;
  }

  const tree = buildMerkleTree(leafHashes);
  if (!tree) {
    return null;
  }

  const path: MerkleProof['path'] = [];
  let currentIndex = leafIndex;
  let levelSize = leafHashes.length;

  // Build path from leaf to root
  let currentLevel = leafHashes;

  while (currentLevel.length > 1) {
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
    const siblingHash = currentLevel[siblingIndex] ?? currentLevel[currentIndex];

    if (siblingIndex !== currentIndex) {
      path.push({
        hash: siblingHash,
        position: currentIndex % 2 === 0 ? 'right' : 'left',
      });
    }

    // Move to next level
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] ?? left;
      nextLevel.push(hashNodes(left, right));
    }

    currentIndex = Math.floor(currentIndex / 2);
    currentLevel = nextLevel;
  }

  return {
    leafHash: leafHashes[leafIndex],
    path,
    root: tree.hash,
    leafIndex,
    treeSize: leafHashes.length,
  };
}

/**
 * Verify a Merkle proof
 */
export function verifyMerkleProof(proof: MerkleProof): boolean {
  let currentHash = proof.leafHash;

  for (const step of proof.path) {
    if (step.position === 'left') {
      currentHash = hashNodes(step.hash, currentHash);
    } else {
      currentHash = hashNodes(currentHash, step.hash);
    }
  }

  return currentHash === proof.root;
}

// =============================================================================
// MERKLE AGGREGATION SERVICE
// =============================================================================

/**
 * Pending item for aggregation
 */
interface PendingItem {
  id: string;
  hash: string;
  addedAt: Date;
}

/**
 * Merkle aggregation configuration
 */
export interface MerkleAggregationConfig {
  /** Minimum items before auto-anchor */
  minBatchSize: number;
  /** Maximum items before forced anchor */
  maxBatchSize: number;
  /** Maximum time before auto-anchor (ms) */
  maxBatchAgeMs: number;
  /** Enable external anchoring */
  enableExternalAnchoring: boolean;
  /** External anchor service URLs */
  externalAnchorServices?: {
    ethereum?: string;
    bitcoin?: string;
    rfc3161?: string;
  };
  /** Signing key for anchors */
  signingKey?: string;
}

const DEFAULT_CONFIG: MerkleAggregationConfig = {
  minBatchSize: 10,
  maxBatchSize: 1000,
  maxBatchAgeMs: 60000, // 1 minute
  enableExternalAnchoring: false,
};

/**
 * Merkle Aggregation Service
 *
 * Aggregates proofs into Merkle trees for efficient batch verification
 * and external anchoring.
 */
export class MerkleAggregationService {
  private config: MerkleAggregationConfig;
  private pending: PendingItem[] = [];
  private anchors: Map<string, MerkleAnchor> = new Map();
  private proofsByAnchor: Map<string, Map<string, MerkleProof>> = new Map();
  private anchorTimer: NodeJS.Timeout | null = null;
  private signingKey: nodeCrypto.KeyObject | null = null;

  constructor(config: Partial<MerkleAggregationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (config.signingKey) {
      try {
        this.signingKey = nodeCrypto.createPrivateKey({
          key: Buffer.from(config.signingKey, 'base64'),
          format: 'der',
          type: 'pkcs8',
        });
      } catch (error) {
        logger.warn({ error }, 'Failed to load signing key');
      }
    }

    logger.info(
      {
        minBatchSize: this.config.minBatchSize,
        maxBatchSize: this.config.maxBatchSize,
        maxBatchAgeMs: this.config.maxBatchAgeMs,
      },
      'Merkle aggregation service initialized'
    );
  }

  /**
   * Add an item for aggregation
   */
  async addItem(id: string, data: string): Promise<void> {
    const hash = sha256(data);

    this.pending.push({
      id,
      hash,
      addedAt: new Date(),
    });

    logger.debug({ id, hash: hash.substring(0, 16) }, 'Item added to aggregation queue');

    // Check if we should auto-anchor
    if (this.pending.length >= this.config.maxBatchSize) {
      await this.anchor();
    } else if (this.pending.length >= this.config.minBatchSize && !this.anchorTimer) {
      // Start timer for auto-anchor
      this.anchorTimer = setTimeout(async () => {
        await this.anchor();
      }, this.config.maxBatchAgeMs);
    }
  }

  /**
   * Add a proof for aggregation
   */
  async addProof(proof: Proof): Promise<void> {
    const proofData = JSON.stringify({
      proofId: proof.proofId,
      chainHash: proof.chainHash,
      timestamp: proof.timestamp,
    });

    await this.addItem(proof.proofId, proofData);
  }

  /**
   * Force anchor current batch
   */
  async anchor(): Promise<BatchAggregationResult | null> {
    if (this.anchorTimer) {
      clearTimeout(this.anchorTimer);
      this.anchorTimer = null;
    }

    if (this.pending.length === 0) {
      return null;
    }

    const startTime = Date.now();
    const items = [...this.pending];
    this.pending = [];

    // Build Merkle tree
    const leafHashes = items.map((item) => item.hash);
    const tree = buildMerkleTree(leafHashes);

    if (!tree) {
      logger.error('Failed to build Merkle tree');
      return null;
    }

    // Generate proofs for each item
    const proofs = new Map<string, MerkleProof>();
    for (let i = 0; i < items.length; i++) {
      const proof = generateMerkleProof(leafHashes, i);
      if (proof) {
        proofs.set(items[i].id, proof);
      }
    }

    // Create anchor
    const anchorId = nodeCrypto.randomUUID();
    const anchor: MerkleAnchor = {
      anchorId,
      rootHash: tree.hash,
      leafCount: items.length,
      timestamp: new Date(),
      externalAnchors: [],
    };

    // Sign anchor if key available
    if (this.signingKey) {
      const dataToSign = JSON.stringify({
        anchorId: anchor.anchorId,
        rootHash: anchor.rootHash,
        leafCount: anchor.leafCount,
        timestamp: anchor.timestamp.toISOString(),
      });

      const signature = nodeCrypto.sign(null, Buffer.from(dataToSign), this.signingKey);
      anchor.signature = signature.toString('base64');
    }

    // External anchoring
    if (this.config.enableExternalAnchoring) {
      const externalAnchors = await this.submitExternalAnchors(tree.hash);
      anchor.externalAnchors = externalAnchors;
    }

    // Store anchor and proofs
    this.anchors.set(anchorId, anchor);
    this.proofsByAnchor.set(anchorId, proofs);

    const durationMs = Date.now() - startTime;

    logger.info(
      {
        anchorId,
        rootHash: tree.hash.substring(0, 16),
        leafCount: items.length,
        externalAnchors: anchor.externalAnchors.length,
        durationMs,
      },
      'Merkle anchor created'
    );

    return { anchor, proofs, durationMs };
  }

  /**
   * Submit to external anchoring services
   */
  private async submitExternalAnchors(rootHash: string): Promise<ExternalAnchor[]> {
    const anchors: ExternalAnchor[] = [];

    // RFC 3161 timestamp
    if (this.config.externalAnchorServices?.rfc3161) {
      try {
        const result = await this.submitRFC3161Timestamp(
          rootHash,
          this.config.externalAnchorServices.rfc3161
        );
        if (result) {
          anchors.push(result);
        }
      } catch (error) {
        logger.warn({ error }, 'RFC 3161 anchoring failed');
      }
    }

    // Ethereum (placeholder)
    if (this.config.externalAnchorServices?.ethereum) {
      try {
        const result = await this.submitEthereumAnchor(
          rootHash,
          this.config.externalAnchorServices.ethereum
        );
        if (result) {
          anchors.push(result);
        }
      } catch (error) {
        logger.warn({ error }, 'Ethereum anchoring failed');
      }
    }

    return anchors;
  }

  /**
   * Submit RFC 3161 timestamp request
   */
  private async submitRFC3161Timestamp(
    rootHash: string,
    tsaUrl: string
  ): Promise<ExternalAnchor | null> {
    try {
      // Create timestamp request
      // In a full implementation, this would create a proper ASN.1 TSP request
      const response = await fetch(tsaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/timestamp-query',
        },
        body: Buffer.from(rootHash, 'hex'),
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, 'TSA request failed');
        return null;
      }

      const responseData = await response.arrayBuffer();
      const reference = sha256(Buffer.from(responseData)).substring(0, 32);

      return {
        type: 'rfc3161',
        reference,
        timestamp: new Date(),
        confirmed: true,
      };
    } catch (error) {
      logger.error({ error }, 'RFC 3161 timestamp failed');
      return null;
    }
  }

  /**
   * Submit Ethereum anchor
   */
  private async submitEthereumAnchor(
    rootHash: string,
    rpcUrl: string
  ): Promise<ExternalAnchor | null> {
    // Placeholder for Ethereum anchoring
    // In production, this would:
    // 1. Create a transaction with rootHash in data field
    // 2. Sign and submit transaction
    // 3. Wait for confirmation

    logger.debug({ rpcUrl }, 'Ethereum anchoring not fully implemented');
    return null;
  }

  /**
   * Get anchor by ID
   */
  getAnchor(anchorId: string): MerkleAnchor | undefined {
    return this.anchors.get(anchorId);
  }

  /**
   * Get proof for an item
   */
  getProof(anchorId: string, itemId: string): MerkleProof | undefined {
    return this.proofsByAnchor.get(anchorId)?.get(itemId);
  }

  /**
   * Verify item inclusion in an anchor
   */
  verifyInclusion(anchorId: string, itemId: string, data: string): boolean {
    const proof = this.getProof(anchorId, itemId);
    if (!proof) {
      return false;
    }

    // Verify data hash matches leaf
    const dataHash = sha256(data);
    if (dataHash !== proof.leafHash) {
      return false;
    }

    // Verify Merkle proof
    return verifyMerkleProof(proof);
  }

  /**
   * Get all anchors
   */
  getAllAnchors(): MerkleAnchor[] {
    return Array.from(this.anchors.values());
  }

  /**
   * Get pending count
   */
  getPendingCount(): number {
    return this.pending.length;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalAnchors: number;
    totalProofs: number;
    pendingItems: number;
    externalAnchors: number;
  } {
    let totalProofs = 0;
    let externalAnchors = 0;

    for (const [, proofs] of this.proofsByAnchor) {
      totalProofs += proofs.size;
    }

    for (const anchor of this.anchors.values()) {
      externalAnchors += anchor.externalAnchors.length;
    }

    return {
      totalAnchors: this.anchors.size,
      totalProofs,
      pendingItems: this.pending.length,
      externalAnchors,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.anchorTimer) {
      clearTimeout(this.anchorTimer);
      this.anchorTimer = null;
    }
  }
}

/**
 * Create a Merkle aggregation service
 */
export function createMerkleAggregationService(
  config?: Partial<MerkleAggregationConfig>
): MerkleAggregationService {
  return new MerkleAggregationService(config);
}
