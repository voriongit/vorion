/**
 * Intent Processing Queue
 *
 * Singleton queue for processing intents with concurrency control.
 * Ensures ordered processing and prevents duplicate processing.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { Intent, ID, IntentStatus } from '../common/types.js';

const logger = createLogger({ component: 'intent-queue' });

/**
 * Queue item with processing metadata
 */
export interface QueueItem {
  intent: Intent;
  priority: number;
  addedAt: number;
  attempts: number;
  lastAttemptAt?: number;
  error?: string;
}

/**
 * Queue processing result
 */
export interface ProcessResult {
  intentId: ID;
  success: boolean;
  status: IntentStatus;
  error?: string;
  processingTimeMs: number;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  maxConcurrent: number;
  maxRetries: number;
  retryDelayMs: number;
  processingTimeoutMs: number;
}

/**
 * Intent processor function type
 */
export type IntentProcessor = (intent: Intent) => Promise<{
  status: IntentStatus;
  error?: string;
}>;

/**
 * Default queue configuration
 */
const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 10,
  maxRetries: 3,
  retryDelayMs: 1000,
  processingTimeoutMs: 30000,
};

/**
 * Intent Queue - Singleton
 *
 * Ensures only one queue instance processes intents.
 * Prevents race conditions and duplicate processing.
 */
export class IntentQueue {
  private static instance: IntentQueue | null = null;
  private static initializingPromise: Promise<IntentQueue> | null = null;

  private config: QueueConfig;
  private queue: Map<ID, QueueItem> = new Map();
  private processing: Set<ID> = new Set();
  private processor: IntentProcessor | null = null;
  private isRunning: boolean = false;
  private processLoopPromise: Promise<void> | null = null;

  // Statistics
  private stats = {
    enqueued: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
  };

  private constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info({ config: this.config }, 'Intent queue initialized');
  }

  /**
   * Get the singleton instance
   */
  static getInstance(config?: Partial<QueueConfig>): IntentQueue {
    if (!IntentQueue.instance) {
      IntentQueue.instance = new IntentQueue(config);
    }
    return IntentQueue.instance;
  }

  /**
   * Initialize the singleton instance asynchronously
   * Ensures thread-safe initialization
   */
  static async initialize(config?: Partial<QueueConfig>): Promise<IntentQueue> {
    if (IntentQueue.instance) {
      return IntentQueue.instance;
    }

    // Prevent concurrent initialization
    if (IntentQueue.initializingPromise) {
      return IntentQueue.initializingPromise;
    }

    IntentQueue.initializingPromise = (async () => {
      IntentQueue.instance = new IntentQueue(config);
      return IntentQueue.instance;
    })();

    try {
      return await IntentQueue.initializingPromise;
    } finally {
      IntentQueue.initializingPromise = null;
    }
  }

  /**
   * Reset the singleton (for testing)
   */
  static reset(): void {
    if (IntentQueue.instance) {
      IntentQueue.instance.stop();
      IntentQueue.instance = null;
    }
  }

  /**
   * Set the intent processor
   */
  setProcessor(processor: IntentProcessor): void {
    this.processor = processor;
    logger.info('Intent processor registered');
  }

  /**
   * Enqueue an intent for processing
   */
  async enqueue(intent: Intent, priority: number = 0): Promise<void> {
    // Check for duplicate
    if (this.queue.has(intent.id) || this.processing.has(intent.id)) {
      logger.warn({ intentId: intent.id }, 'Intent already in queue or processing');
      return;
    }

    const item: QueueItem = {
      intent,
      priority,
      addedAt: Date.now(),
      attempts: 0,
    };

    this.queue.set(intent.id, item);
    this.stats.enqueued++;

    logger.debug(
      { intentId: intent.id, priority, queueSize: this.queue.size },
      'Intent enqueued'
    );

    // Start processing if not running
    if (this.isRunning && !this.processLoopPromise) {
      this.processLoopPromise = this.processLoop();
    }
  }

  /**
   * Start the queue processing loop
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Queue already running');
      return;
    }

    if (!this.processor) {
      throw new Error('No processor registered. Call setProcessor() first.');
    }

    this.isRunning = true;
    this.processLoopPromise = this.processLoop();
    logger.info('Intent queue started');
  }

  /**
   * Stop the queue processing
   */
  stop(): void {
    this.isRunning = false;
    logger.info('Intent queue stopping');
  }

  /**
   * Main processing loop
   */
  private async processLoop(): Promise<void> {
    while (this.isRunning) {
      // Get next items to process (up to maxConcurrent)
      const available = this.config.maxConcurrent - this.processing.size;
      if (available <= 0 || this.queue.size === 0) {
        // Wait before checking again
        await this.sleep(100);
        continue;
      }

      // Get highest priority items
      const items = this.getNextItems(available);

      // Process items concurrently
      const promises = items.map((item) => this.processItem(item));
      await Promise.allSettled(promises);
    }

    this.processLoopPromise = null;
    logger.info('Intent queue stopped');
  }

  /**
   * Get next items to process sorted by priority
   */
  private getNextItems(count: number): QueueItem[] {
    const items = Array.from(this.queue.values())
      .filter((item) => {
        // Skip if in retry delay
        if (item.lastAttemptAt) {
          const delay = this.config.retryDelayMs * Math.pow(2, item.attempts - 1);
          if (Date.now() - item.lastAttemptAt < delay) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        // Higher priority first, then older items first
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.addedAt - b.addedAt;
      })
      .slice(0, count);

    return items;
  }

  /**
   * Process a single queue item
   */
  private async processItem(item: QueueItem): Promise<ProcessResult> {
    const { intent } = item;
    const startTime = Date.now();

    // Move from queue to processing
    this.queue.delete(intent.id);
    this.processing.add(intent.id);
    item.attempts++;
    item.lastAttemptAt = Date.now();

    logger.debug(
      { intentId: intent.id, attempt: item.attempts },
      'Processing intent'
    );

    try {
      // Process with timeout
      const result = await this.withTimeout(
        this.processor!(intent),
        this.config.processingTimeoutMs
      );

      this.stats.processed++;
      this.stats.succeeded++;

      logger.info(
        {
          intentId: intent.id,
          status: result.status,
          processingTimeMs: Date.now() - startTime,
        },
        'Intent processed successfully'
      );

      return {
        intentId: intent.id,
        success: true,
        status: result.status,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      item.error = errorMessage;

      // Check if should retry
      if (item.attempts < this.config.maxRetries) {
        // Re-queue for retry
        this.queue.set(intent.id, item);
        this.stats.retried++;

        logger.warn(
          {
            intentId: intent.id,
            attempt: item.attempts,
            maxRetries: this.config.maxRetries,
            error: errorMessage,
          },
          'Intent processing failed, will retry'
        );
      } else {
        // Max retries exceeded
        this.stats.processed++;
        this.stats.failed++;

        logger.error(
          {
            intentId: intent.id,
            attempts: item.attempts,
            error: errorMessage,
          },
          'Intent processing failed permanently'
        );
      }

      return {
        intentId: intent.id,
        success: false,
        status: 'failed',
        error: errorMessage,
        processingTimeMs: Date.now() - startTime,
      };
    } finally {
      this.processing.delete(intent.id);
    }
  }

  /**
   * Execute with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Processing timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueSize: number;
    processingCount: number;
    enqueued: number;
    processed: number;
    succeeded: number;
    failed: number;
    retried: number;
  } {
    return {
      queueSize: this.queue.size,
      processingCount: this.processing.size,
      ...this.stats,
    };
  }

  /**
   * Check if an intent is in the queue or processing
   */
  isQueued(intentId: ID): boolean {
    return this.queue.has(intentId) || this.processing.has(intentId);
  }

  /**
   * Get queue item status
   */
  getItemStatus(intentId: ID): 'queued' | 'processing' | 'not_found' {
    if (this.processing.has(intentId)) return 'processing';
    if (this.queue.has(intentId)) return 'queued';
    return 'not_found';
  }

  /**
   * Remove an intent from the queue (if not processing)
   */
  remove(intentId: ID): boolean {
    if (this.processing.has(intentId)) {
      logger.warn({ intentId }, 'Cannot remove intent while processing');
      return false;
    }

    const removed = this.queue.delete(intentId);
    if (removed) {
      logger.debug({ intentId }, 'Intent removed from queue');
    }
    return removed;
  }

  /**
   * Clear all queued items (not processing)
   */
  clear(): number {
    const count = this.queue.size;
    this.queue.clear();
    logger.info({ count }, 'Queue cleared');
    return count;
  }
}

/**
 * Get the singleton queue instance
 */
export function getIntentQueue(config?: Partial<QueueConfig>): IntentQueue {
  return IntentQueue.getInstance(config);
}

/**
 * Initialize the queue singleton
 */
export async function initializeIntentQueue(
  config?: Partial<QueueConfig>
): Promise<IntentQueue> {
  return IntentQueue.initialize(config);
}
