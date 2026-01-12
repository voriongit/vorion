/**
 * Async Observer Queue - Non-blocking audit trail
 *
 * Implements fire-and-forget logging that doesn't block agent responses.
 * Events are queued and processed asynchronously, with batch anchoring
 * to the blockchain at configurable intervals.
 */

import { AuditEvent, AuditEventType, RiskLevel, GovernanceDecision } from './types';
import crypto from 'crypto';

// =============================================================================
// Queue Types
// =============================================================================

export interface QueuedEvent extends AuditEvent {
  queuedAt: Date;
  processedAt?: Date;
  retryCount: number;
  batchId?: string;
}

export interface EventBatch {
  id: string;
  events: QueuedEvent[];
  merkleRoot: string;
  createdAt: Date;
  anchoredAt?: Date;
  blockchainTxHash?: string;
}

export interface ObserverConfig {
  maxQueueSize: number;        // Max events before force flush (default 1000)
  flushIntervalMs: number;     // Time between flushes (default 60000 = 1 min)
  batchSize: number;           // Events per batch (default 100)
  retryLimit: number;          // Max retries for failed events (default 3)
  anchorIntervalMs: number;    // Time between blockchain anchors (default 3600000 = 1 hour)
  enableBlockchainAnchor: boolean; // Whether to anchor to Polygon (default false for dev)
}

const DEFAULT_CONFIG: ObserverConfig = {
  maxQueueSize: 1000,
  flushIntervalMs: 60000,      // 1 minute
  batchSize: 100,
  retryLimit: 3,
  anchorIntervalMs: 3600000,   // 1 hour
  enableBlockchainAnchor: false,
};

// =============================================================================
// Merkle Tree Implementation
// =============================================================================

function hashEvent(event: AuditEvent): string {
  const data = JSON.stringify({
    id: event.id,
    type: event.type,
    agentId: event.agentId,
    userId: event.userId,
    action: event.action,
    timestamp: event.timestamp.toISOString(),
    riskLevel: event.riskLevel,
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hashPair(left: string, right: string): string {
  const combined = left < right ? left + right : right + left;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

export function buildMerkleTree(events: AuditEvent[]): {
  root: string;
  leaves: string[];
  tree: string[][];
} {
  if (events.length === 0) {
    return { root: '', leaves: [], tree: [] };
  }

  // Create leaf hashes
  const leaves = events.map(hashEvent);

  // Build tree layers
  const tree: string[][] = [leaves];
  let currentLayer = leaves;

  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];

    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = currentLayer[i + 1] || left; // Duplicate last if odd
      nextLayer.push(hashPair(left, right));
    }

    tree.push(nextLayer);
    currentLayer = nextLayer;
  }

  return {
    root: currentLayer[0],
    leaves,
    tree,
  };
}

export function generateMerkleProof(
  tree: string[][],
  leafIndex: number
): string[] {
  const proof: string[] = [];
  let index = leafIndex;

  for (let i = 0; i < tree.length - 1; i++) {
    const layer = tree[i];
    const isRightNode = index % 2 === 1;
    const siblingIndex = isRightNode ? index - 1 : index + 1;

    if (siblingIndex < layer.length) {
      proof.push(layer[siblingIndex]);
    }

    index = Math.floor(index / 2);
  }

  return proof;
}

// =============================================================================
// Observer Queue
// =============================================================================

export class ObserverQueue {
  private queue: QueuedEvent[] = [];
  private batches: EventBatch[] = [];
  private config: ObserverConfig;
  private flushTimer: NodeJS.Timeout | null = null;
  private anchorTimer: NodeJS.Timeout | null = null;
  private processing: boolean = false;
  private onFlush?: (batch: EventBatch) => Promise<void>;
  private onAnchor?: (batch: EventBatch) => Promise<string>;

  constructor(
    config: Partial<ObserverConfig> = {},
    callbacks?: {
      onFlush?: (batch: EventBatch) => Promise<void>;
      onAnchor?: (batch: EventBatch) => Promise<string>;
    }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.onFlush = callbacks?.onFlush;
    this.onAnchor = callbacks?.onAnchor;
  }

  /**
   * Start the queue processing timers
   */
  start(): void {
    // Flush timer
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.flushIntervalMs);

    // Anchor timer (if enabled)
    if (this.config.enableBlockchainAnchor) {
      this.anchorTimer = setInterval(() => {
        this.anchorBatches().catch(console.error);
      }, this.config.anchorIntervalMs);
    }
  }

  /**
   * Stop the queue processing
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.anchorTimer) {
      clearInterval(this.anchorTimer);
      this.anchorTimer = null;
    }
  }

  /**
   * Push an event to the queue (non-blocking)
   */
  push(event: AuditEvent): void {
    const queuedEvent: QueuedEvent = {
      ...event,
      queuedAt: new Date(),
      retryCount: 0,
    };

    this.queue.push(queuedEvent);

    // Force flush if queue is too large
    if (this.queue.length >= this.config.maxQueueSize) {
      this.flush().catch(console.error);
    }
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get pending batches count
   */
  pendingBatches(): number {
    return this.batches.filter(b => !b.anchoredAt).length;
  }

  /**
   * Flush queue to batches
   */
  async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    try {
      // Take events from queue in batches
      while (this.queue.length > 0) {
        const batchEvents = this.queue.splice(0, this.config.batchSize);

        // Build merkle tree for batch
        const { root } = buildMerkleTree(batchEvents);

        const batch: EventBatch = {
          id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          events: batchEvents.map(e => ({ ...e, processedAt: new Date() })),
          merkleRoot: root,
          createdAt: new Date(),
        };

        this.batches.push(batch);

        // Call flush callback if provided (e.g., save to database)
        if (this.onFlush) {
          await this.onFlush(batch);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Anchor unanchored batches to blockchain
   */
  async anchorBatches(): Promise<void> {
    if (!this.config.enableBlockchainAnchor) return;

    const unanchored = this.batches.filter(b => !b.anchoredAt);

    for (const batch of unanchored) {
      try {
        if (this.onAnchor) {
          const txHash = await this.onAnchor(batch);
          batch.blockchainTxHash = txHash;
          batch.anchoredAt = new Date();
        }
      } catch (error) {
        console.error(`Failed to anchor batch ${batch.id}:`, error);
      }
    }
  }

  /**
   * Get batch by ID
   */
  getBatch(batchId: string): EventBatch | undefined {
    return this.batches.find(b => b.id === batchId);
  }

  /**
   * Get all batches for an agent
   */
  getAgentBatches(agentId: string): EventBatch[] {
    return this.batches.filter(b =>
      b.events.some(e => e.agentId === agentId)
    );
  }

  /**
   * Verify an event exists in a batch using Merkle proof
   */
  verifyEvent(batchId: string, eventId: string): {
    verified: boolean;
    proof?: string[];
    root?: string;
  } {
    const batch = this.getBatch(batchId);
    if (!batch) return { verified: false };

    const eventIndex = batch.events.findIndex(e => e.id === eventId);
    if (eventIndex === -1) return { verified: false };

    const { tree, root } = buildMerkleTree(batch.events);
    const proof = generateMerkleProof(tree, eventIndex);

    return {
      verified: true,
      proof,
      root,
    };
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueSize: number;
    totalBatches: number;
    anchoredBatches: number;
    pendingBatches: number;
    totalEvents: number;
  } {
    const anchoredBatches = this.batches.filter(b => b.anchoredAt).length;

    return {
      queueSize: this.queue.length,
      totalBatches: this.batches.length,
      anchoredBatches,
      pendingBatches: this.batches.length - anchoredBatches,
      totalEvents: this.batches.reduce((sum, b) => sum + b.events.length, 0),
    };
  }
}

// =============================================================================
// Quick Event Creators
// =============================================================================

export function createAuditEvent(
  type: AuditEventType,
  agentId: string,
  userId: string,
  sessionId: string,
  action: string,
  details: Record<string, unknown>,
  riskLevel: RiskLevel,
  decision: GovernanceDecision
): AuditEvent {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    type,
    agentId,
    userId,
    sessionId,
    action,
    details,
    riskLevel,
    decision,
  };
}

// =============================================================================
// Singleton Instance
// =============================================================================

let observerQueue: ObserverQueue | null = null;

export function getObserverQueue(
  config?: Partial<ObserverConfig>,
  callbacks?: {
    onFlush?: (batch: EventBatch) => Promise<void>;
    onAnchor?: (batch: EventBatch) => Promise<string>;
  }
): ObserverQueue {
  if (!observerQueue) {
    observerQueue = new ObserverQueue(config, callbacks);
    observerQueue.start();
  }
  return observerQueue;
}

export function resetObserverQueue(): void {
  if (observerQueue) {
    observerQueue.stop();
    observerQueue = null;
  }
}

// =============================================================================
// Express Integration Helper
// =============================================================================

/**
 * Fire-and-forget audit logging
 * Use this in route handlers - it returns immediately
 */
export function logAuditEvent(event: AuditEvent): void {
  const queue = getObserverQueue();
  queue.push(event);
}

/**
 * Quick log helper for common patterns
 */
export function logAgentAction(
  agentId: string,
  userId: string,
  sessionId: string,
  action: string,
  details: Record<string, unknown> = {},
  riskLevel: RiskLevel = 'low'
): void {
  const event = createAuditEvent(
    'action_executed',
    agentId,
    userId,
    sessionId,
    action,
    details,
    riskLevel,
    { allowed: true, requiresApproval: false, escalateTo: null, reason: 'Logged', trustImpact: 0, auditRequired: true }
  );
  logAuditEvent(event);
}
