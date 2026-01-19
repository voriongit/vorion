/**
 * Distributed Lock Service
 *
 * Redis-based distributed locking with proper timeout handling,
 * exponential backoff, and deadlock prevention.
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from './logger.js';
import { getRedis } from './redis.js';

const logger = createLogger({ component: 'lock' });

export interface LockOptions {
  /** Lock timeout in milliseconds (how long the lock is held) */
  lockTimeoutMs?: number;
  /** Maximum time to wait for acquiring the lock */
  acquireTimeoutMs?: number;
  /** Initial retry delay in milliseconds */
  retryDelayMs?: number;
  /** Maximum retry delay in milliseconds */
  maxRetryDelayMs?: number;
  /** Jitter factor (0-1) to add randomness to retry delays */
  jitterFactor?: number;
}

export interface Lock {
  /** Unique lock identifier */
  lockId: string;
  /** Lock key */
  key: string;
  /** Whether the lock is currently held */
  held: boolean;
  /** Release the lock */
  release: () => Promise<boolean>;
  /** Extend the lock timeout */
  extend: (additionalMs: number) => Promise<boolean>;
}

export interface LockResult {
  acquired: boolean;
  lock?: Lock;
  error?: string;
}

const DEFAULT_LOCK_TIMEOUT_MS = 30000; // 30 seconds
const DEFAULT_ACQUIRE_TIMEOUT_MS = 10000; // 10 seconds
const DEFAULT_RETRY_DELAY_MS = 50; // 50ms initial retry
const DEFAULT_MAX_RETRY_DELAY_MS = 1000; // 1 second max retry
const DEFAULT_JITTER_FACTOR = 0.25;

/**
 * Distributed Lock Service
 */
export class LockService {
  private redis = getRedis();
  private readonly keyPrefix = 'lock:';

  /**
   * Acquire a distributed lock
   */
  async acquire(key: string, options: LockOptions = {}): Promise<LockResult> {
    const lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    const acquireTimeoutMs = options.acquireTimeoutMs ?? DEFAULT_ACQUIRE_TIMEOUT_MS;
    const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    const maxRetryDelayMs = options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
    const jitterFactor = options.jitterFactor ?? DEFAULT_JITTER_FACTOR;

    const lockKey = this.keyPrefix + key;
    const lockId = randomUUID();
    const lockTimeoutSeconds = Math.ceil(lockTimeoutMs / 1000);

    const startTime = Date.now();
    let attempt = 0;
    let currentDelay = retryDelayMs;

    while (Date.now() - startTime < acquireTimeoutMs) {
      attempt++;

      // Try to acquire the lock using SET NX EX
      const result = await this.redis.set(
        lockKey,
        lockId,
        'EX',
        lockTimeoutSeconds,
        'NX'
      );

      if (result === 'OK') {
        // Lock acquired
        logger.debug({ key, lockId, attempt }, 'Lock acquired');

        const lock: Lock = {
          lockId,
          key,
          held: true,
          release: () => this.release(lockKey, lockId),
          extend: (additionalMs: number) => this.extend(lockKey, lockId, additionalMs),
        };

        return { acquired: true, lock };
      }

      // Lock not acquired, check if we should retry
      const elapsed = Date.now() - startTime;
      if (elapsed + currentDelay >= acquireTimeoutMs) {
        // Not enough time for another attempt
        break;
      }

      // Calculate delay with jitter
      const jitter = currentDelay * jitterFactor * (Math.random() * 2 - 1);
      const delayWithJitter = Math.max(retryDelayMs, currentDelay + jitter);

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delayWithJitter));

      // Exponential backoff
      currentDelay = Math.min(currentDelay * 2, maxRetryDelayMs);
    }

    logger.debug({ key, attempts: attempt }, 'Lock acquisition timed out');
    return { acquired: false, error: 'Lock acquisition timed out' };
  }

  /**
   * Release a lock
   */
  private async release(lockKey: string, lockId: string): Promise<boolean> {
    // Use Lua script for atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, lockKey, lockId);
    const released = result === 1;

    if (released) {
      logger.debug({ key: lockKey, lockId }, 'Lock released');
    } else {
      logger.warn({ key: lockKey, lockId }, 'Lock release failed (not owned or expired)');
    }

    return released;
  }

  /**
   * Extend a lock's timeout
   */
  private async extend(lockKey: string, lockId: string, additionalMs: number): Promise<boolean> {
    const additionalSeconds = Math.ceil(additionalMs / 1000);

    // Use Lua script for atomic check-and-extend
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, lockKey, lockId, additionalSeconds);
    const extended = result === 1;

    if (extended) {
      logger.debug({ key: lockKey, lockId, additionalMs }, 'Lock extended');
    } else {
      logger.warn({ key: lockKey, lockId }, 'Lock extension failed (not owned or expired)');
    }

    return extended;
  }

  /**
   * Execute a function with a lock
   * Automatically acquires and releases the lock
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: LockOptions = {}
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const lockResult = await this.acquire(key, options);

    if (!lockResult.acquired || !lockResult.lock) {
      return { success: false, error: lockResult.error ?? 'Failed to acquire lock' };
    }

    try {
      const result = await fn();
      return { success: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    } finally {
      await lockResult.lock.release();
    }
  }

  /**
   * Check if a lock is currently held
   */
  async isLocked(key: string): Promise<boolean> {
    const lockKey = this.keyPrefix + key;
    const value = await this.redis.get(lockKey);
    return value !== null;
  }

  /**
   * Force release a lock (admin operation)
   * Use with caution - this can cause issues if the lock holder is still active
   */
  async forceRelease(key: string): Promise<boolean> {
    const lockKey = this.keyPrefix + key;
    const result = await this.redis.del(lockKey);
    logger.warn({ key }, 'Lock force released');
    return result === 1;
  }
}

// Singleton instance
let lockServiceInstance: LockService | null = null;

/**
 * Get the lock service singleton
 */
export function getLockService(): LockService {
  if (!lockServiceInstance) {
    lockServiceInstance = new LockService();
  }
  return lockServiceInstance;
}
