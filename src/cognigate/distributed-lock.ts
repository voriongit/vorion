/**
 * COGNIGATE Distributed Locking Module
 *
 * Provides Redis-based distributed locks following the Redlock pattern to prevent
 * race conditions during concurrent execution operations, escalation resolution,
 * and handler registration within the cognigate module.
 *
 * Uses atomic SET NX PX for lock acquisition and a Lua script for safe release
 * (only deletes the key if the stored token matches, preventing accidental release
 * of another process's lock).
 *
 * Features:
 * - Token-based ownership via randomUUID
 * - Configurable retry count, retry delay, and TTL
 * - Lock acquisition timeout
 * - Lock contention and acquisition metrics via Prometheus
 * - Domain-specific helper functions for execution, escalation, and handler locking
 * - Proper error hierarchy with structured error codes
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { Counter, Histogram, Registry } from 'prom-client';
import { getRedis } from '../common/redis.js';
import { createLogger } from '../common/logger.js';

// =============================================================================
// LOGGER
// =============================================================================

const logger = createLogger({ component: 'cognigate-distributed-lock' });

// =============================================================================
// CONSTANTS
// =============================================================================

/** Redis key prefix for all cognigate locks */
const LOCK_PREFIX = 'cognigate:lock:';

/** Default lock time-to-live in milliseconds */
const DEFAULT_TTL_MS = 30_000;

/** Default number of retry attempts when lock is contended */
const DEFAULT_RETRY_COUNT = 3;

/** Default delay between retry attempts in milliseconds */
const DEFAULT_RETRY_DELAY_MS = 200;

/** Default acquisition timeout in milliseconds (0 = no timeout, uses retries only) */
const DEFAULT_ACQUISITION_TIMEOUT_MS = 0;

/** Minimum allowed TTL to prevent excessively short locks */
const MIN_TTL_MS = 100;

/** Maximum allowed TTL to prevent forgotten locks */
const MAX_TTL_MS = 300_000;

/** Clock drift factor for validity calculations (as per Redlock spec) */
const CLOCK_DRIFT_FACTOR = 0.01;

/**
 * Lua script for safe lock release.
 * Only deletes the key if the stored token matches the provided token,
 * preventing accidental release of another process's lock.
 *
 * Returns 1 if the lock was successfully released, 0 otherwise.
 */
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

/**
 * Lua script for lock extension (renewal).
 * Only extends the TTL if the stored token matches, preventing
 * extension of a lock that has already been acquired by another process.
 *
 * Returns 1 if the lock was successfully extended, 0 otherwise.
 */
const EXTEND_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`;

// =============================================================================
// METRICS REGISTRY
// =============================================================================

/**
 * Dedicated Prometheus registry for cognigate distributed lock metrics.
 * Exported to allow aggregation with the broader cognigate metrics registry.
 */
export const cognigateDistributedLockRegistry = new Registry();

// =============================================================================
// METRICS
// =============================================================================

/**
 * Counter for lock contention events.
 * Incremented when lock acquisition fails after exhausting all retries.
 */
export const cognigateLocKContentionTotal = new Counter({
  name: 'vorion_cognigate_lock_contention_total',
  help: 'Total lock contention events in cognigate module (all retries exhausted)',
  labelNames: ['resource', 'lock_type'] as const,
  registers: [cognigateDistributedLockRegistry],
});

/**
 * Counter for total lock acquisition attempts.
 * Tracks both successful and failed acquisition attempts.
 */
export const cognigateLockAcquisitionsTotal = new Counter({
  name: 'vorion_cognigate_lock_acquisitions_total',
  help: 'Total lock acquisition attempts in cognigate module',
  labelNames: ['resource', 'lock_type', 'result'] as const,
  registers: [cognigateDistributedLockRegistry],
});

/**
 * Counter for lock release events.
 */
export const cognigateLockReleasesTotal = new Counter({
  name: 'vorion_cognigate_lock_releases_total',
  help: 'Total lock release events in cognigate module',
  labelNames: ['resource', 'lock_type', 'result'] as const,
  registers: [cognigateDistributedLockRegistry],
});

/**
 * Histogram for lock acquisition duration.
 * Measures the time spent trying to acquire a lock (including retries).
 */
export const cognigateLockAcquisitionDuration = new Histogram({
  name: 'vorion_cognigate_lock_acquisition_duration_seconds',
  help: 'Time spent acquiring locks in cognigate module (including retries)',
  labelNames: ['resource', 'lock_type'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [cognigateDistributedLockRegistry],
});

/**
 * Histogram for lock hold duration.
 * Measures how long a lock is held before release.
 */
export const cognigateLockHoldDuration = new Histogram({
  name: 'vorion_cognigate_lock_hold_duration_seconds',
  help: 'Duration locks are held in cognigate module',
  labelNames: ['resource', 'lock_type'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [cognigateDistributedLockRegistry],
});

/**
 * Counter for lock extension attempts.
 */
export const cognigateLockExtensionsTotal = new Counter({
  name: 'vorion_cognigate_lock_extensions_total',
  help: 'Total lock extension attempts in cognigate module',
  labelNames: ['resource', 'lock_type', 'result'] as const,
  registers: [cognigateDistributedLockRegistry],
});

/**
 * Counter for lock timeout events.
 * Incremented when acquisition timeout is reached before obtaining the lock.
 */
export const cognigateLockTimeoutsTotal = new Counter({
  name: 'vorion_cognigate_lock_timeouts_total',
  help: 'Total lock acquisition timeout events in cognigate module',
  labelNames: ['resource', 'lock_type'] as const,
  registers: [cognigateDistributedLockRegistry],
});

// =============================================================================
// ERROR CLASSES
// =============================================================================

/**
 * Error thrown when a distributed lock cannot be acquired after all retries.
 */
export class CognigateLockError extends Error {
  readonly resource: string;
  readonly code: string = 'COGNIGATE_LOCK_ERROR';

  constructor(resource: string, message?: string) {
    super(message ?? `Failed to acquire cognigate lock for resource: ${resource}`);
    this.name = 'CognigateLockError';
    this.resource = resource;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when lock acquisition exceeds the configured timeout.
 */
export class CognigateLockTimeoutError extends CognigateLockError {
  readonly timeoutMs: number;
  override readonly code = 'COGNIGATE_LOCK_TIMEOUT';

  constructor(resource: string, timeoutMs: number) {
    super(
      resource,
      `Lock acquisition timed out after ${timeoutMs}ms for resource: ${resource}`
    );
    this.name = 'CognigateLockTimeoutError';
    this.timeoutMs = timeoutMs;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Lock type discriminator for metrics and logging purposes.
 */
export type LockType = 'execution' | 'escalation' | 'handler' | 'generic';

/**
 * Options for configuring lock acquisition behavior.
 */
export interface CognigateLockOptions {
  /** Lock time-to-live in milliseconds (default: 30000ms, min: 100ms, max: 300000ms) */
  ttlMs?: number;
  /** Number of retry attempts if lock is held (default: 3) */
  retryCount?: number;
  /** Delay between retry attempts in milliseconds (default: 200ms) */
  retryDelayMs?: number;
  /** Maximum time to wait for lock acquisition in milliseconds (0 = no timeout) */
  acquisitionTimeoutMs?: number;
  /** Lock type for metrics categorization (default: 'generic') */
  lockType?: LockType;
}

/**
 * Represents a successfully acquired distributed lock.
 */
export interface CognigateAcquiredLock {
  /** The full Redis key for this lock */
  key: string;
  /** Unique token used to identify lock ownership */
  token: string;
  /** Timestamp (ms since epoch) when the lock expires */
  expiresAt: number;
  /** The lock type for metrics categorization */
  lockType: LockType;
  /** Release the lock. Returns true if released successfully, false if already expired or stolen. */
  release(): Promise<boolean>;
  /** Extend the lock TTL. Returns true if extended, false if lock is no longer owned. */
  extend(ttlMs?: number): Promise<boolean>;
  /** Check if the lock is still theoretically valid (not expired based on local clock). */
  isValid(): boolean;
}

// =============================================================================
// CORE CLASS
// =============================================================================

/**
 * Distributed lock manager for the cognigate module.
 *
 * Encapsulates lock acquisition, release, and extension logic with
 * built-in metrics, logging, and configurable retry behavior.
 *
 * @example
 * ```typescript
 * const lockManager = new CognigateDistributedLockManager();
 *
 * const lock = await lockManager.acquire('my-resource', {
 *   ttlMs: 10_000,
 *   retryCount: 5,
 *   lockType: 'execution',
 * });
 *
 * if (lock) {
 *   try {
 *     // Perform protected operation
 *   } finally {
 *     await lock.release();
 *   }
 * }
 * ```
 */
export class CognigateDistributedLockManager {
  private readonly prefix: string;
  private readonly defaultOptions: Required<CognigateLockOptions>;

  constructor(options?: {
    prefix?: string;
    defaults?: CognigateLockOptions;
  }) {
    this.prefix = options?.prefix ?? LOCK_PREFIX;
    this.defaultOptions = {
      ttlMs: options?.defaults?.ttlMs ?? DEFAULT_TTL_MS,
      retryCount: options?.defaults?.retryCount ?? DEFAULT_RETRY_COUNT,
      retryDelayMs: options?.defaults?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
      acquisitionTimeoutMs: options?.defaults?.acquisitionTimeoutMs ?? DEFAULT_ACQUISITION_TIMEOUT_MS,
      lockType: options?.defaults?.lockType ?? 'generic',
    };
  }

  /**
   * Attempt to acquire a distributed lock for the given resource.
   *
   * Uses Redis SET with NX (only set if not exists) and PX (expiry in ms)
   * for atomic lock acquisition. Retries with configurable delay if the lock
   * is currently held by another process.
   *
   * @param resource - The resource identifier to lock (will be prefixed)
   * @param options - Lock configuration options (merged with defaults)
   * @returns The acquired lock object, or null if acquisition failed
   */
  async acquire(
    resource: string,
    options?: CognigateLockOptions
  ): Promise<CognigateAcquiredLock | null> {
    const redis = getRedis();
    const ttlMs = clampTtl(options?.ttlMs ?? this.defaultOptions.ttlMs);
    const retryCount = options?.retryCount ?? this.defaultOptions.retryCount;
    const retryDelayMs = options?.retryDelayMs ?? this.defaultOptions.retryDelayMs;
    const acquisitionTimeoutMs = options?.acquisitionTimeoutMs ?? this.defaultOptions.acquisitionTimeoutMs;
    const lockType = options?.lockType ?? this.defaultOptions.lockType;

    const key = this.prefix + resource;
    const token = randomUUID();
    const startTime = Date.now();

    logger.debug(
      { resource, key, ttlMs, retryCount, retryDelayMs, acquisitionTimeoutMs, lockType },
      'Attempting to acquire cognigate lock'
    );

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      // Check acquisition timeout
      if (acquisitionTimeoutMs > 0) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= acquisitionTimeoutMs) {
          cognigateLockTimeoutsTotal.inc({ resource, lock_type: lockType });
          cognigateLockAcquisitionsTotal.inc({ resource, lock_type: lockType, result: 'timeout' });

          logger.debug(
            { resource, key, elapsed, acquisitionTimeoutMs, lockType },
            'Cognigate lock acquisition timed out'
          );

          const durationSeconds = (Date.now() - startTime) / 1000;
          cognigateLockAcquisitionDuration.observe(
            { resource, lock_type: lockType },
            durationSeconds
          );

          return null;
        }
      }

      // Wait before retrying (skip on first attempt)
      if (attempt > 0) {
        const jitter = Math.floor(Math.random() * (retryDelayMs * 0.25));
        await sleep(retryDelayMs + jitter);
      }

      try {
        const result = await redis.set(key, token, 'PX', ttlMs, 'NX');

        if (result === 'OK') {
          const clockDrift = Math.floor(ttlMs * CLOCK_DRIFT_FACTOR) + 2;
          const expiresAt = Date.now() + ttlMs - clockDrift;
          const acquiredAt = Date.now();

          const durationSeconds = (acquiredAt - startTime) / 1000;
          cognigateLockAcquisitionDuration.observe(
            { resource, lock_type: lockType },
            durationSeconds
          );
          cognigateLockAcquisitionsTotal.inc({ resource, lock_type: lockType, result: 'acquired' });

          logger.debug(
            { resource, key, token, ttlMs, attempt, lockType, durationMs: acquiredAt - startTime },
            'Cognigate lock acquired'
          );

          const lock: CognigateAcquiredLock = {
            key,
            token,
            expiresAt,
            lockType,
            release: async (): Promise<boolean> => {
              const holdDuration = (Date.now() - acquiredAt) / 1000;
              cognigateLockHoldDuration.observe(
                { resource, lock_type: lockType },
                holdDuration
              );
              return this.release(key, token, resource, lockType);
            },
            extend: async (extensionTtlMs?: number): Promise<boolean> => {
              const newTtl = clampTtl(extensionTtlMs ?? ttlMs);
              return this.extend(key, token, newTtl, resource, lockType);
            },
            isValid: (): boolean => {
              return Date.now() < expiresAt;
            },
          };

          return lock;
        }

        // Lock is held by another process
        if (attempt < retryCount) {
          logger.debug(
            { resource, key, attempt, retryCount, lockType },
            'Cognigate lock contention, retrying'
          );
        }
      } catch (error) {
        logger.warn(
          { resource, key, attempt, error, lockType },
          'Error during cognigate lock acquisition attempt'
        );

        // On Redis errors, still retry
        if (attempt >= retryCount) {
          break;
        }
      }
    }

    // All retries exhausted
    const durationSeconds = (Date.now() - startTime) / 1000;
    cognigateLockAcquisitionDuration.observe(
      { resource, lock_type: lockType },
      durationSeconds
    );
    cognigateLocKContentionTotal.inc({ resource, lock_type: lockType });
    cognigateLockAcquisitionsTotal.inc({ resource, lock_type: lockType, result: 'contention' });

    logger.debug(
      { resource, key, retryCount, lockType, durationMs: Date.now() - startTime },
      'Failed to acquire cognigate lock after all retries'
    );

    return null;
  }

  /**
   * Execute a function while holding a distributed lock.
   *
   * Acquires the lock, executes the provided function, and releases the lock
   * regardless of success or failure. Throws if lock cannot be acquired.
   *
   * @param resource - The resource identifier to lock
   * @param fn - The async function to execute while holding the lock
   * @param options - Lock configuration options
   * @returns The result of the executed function
   * @throws {CognigateLockError} If the lock cannot be acquired after retries
   * @throws {CognigateLockTimeoutError} If acquisition timeout is reached
   */
  async withLock<T>(
    resource: string,
    fn: () => Promise<T>,
    options?: CognigateLockOptions
  ): Promise<T> {
    const acquisitionTimeoutMs = options?.acquisitionTimeoutMs ?? this.defaultOptions.acquisitionTimeoutMs;
    const lock = await this.acquire(resource, options);

    if (!lock) {
      if (acquisitionTimeoutMs > 0) {
        throw new CognigateLockTimeoutError(resource, acquisitionTimeoutMs);
      }
      throw new CognigateLockError(resource);
    }

    try {
      return await fn();
    } finally {
      await lock.release();
    }
  }

  /**
   * Safely release a lock using a Lua script that checks token ownership.
   *
   * @param key - The Redis key for the lock
   * @param token - The ownership token to verify
   * @param resource - The resource name for logging/metrics
   * @param lockType - The lock type for metrics
   * @returns true if the lock was released, false if already expired or held by another owner
   */
  private async release(
    key: string,
    token: string,
    resource: string,
    lockType: LockType
  ): Promise<boolean> {
    const redis = getRedis();

    try {
      const result = await redis.eval(RELEASE_SCRIPT, 1, key, token);
      const released = result === 1;

      cognigateLockReleasesTotal.inc({
        resource,
        lock_type: lockType,
        result: released ? 'released' : 'expired',
      });

      logger.debug(
        { key, token, released, lockType },
        released
          ? 'Cognigate lock released'
          : 'Cognigate lock already expired or stolen'
      );

      return released;
    } catch (error) {
      cognigateLockReleasesTotal.inc({
        resource,
        lock_type: lockType,
        result: 'error',
      });

      logger.warn(
        { key, token, error, lockType },
        'Error releasing cognigate lock'
      );

      return false;
    }
  }

  /**
   * Extend a lock's TTL using a Lua script that verifies token ownership.
   *
   * @param key - The Redis key for the lock
   * @param token - The ownership token to verify
   * @param ttlMs - The new TTL in milliseconds
   * @param resource - The resource name for logging/metrics
   * @param lockType - The lock type for metrics
   * @returns true if extended, false if lock is no longer owned
   */
  private async extend(
    key: string,
    token: string,
    ttlMs: number,
    resource: string,
    lockType: LockType
  ): Promise<boolean> {
    const redis = getRedis();

    try {
      const result = await redis.eval(EXTEND_SCRIPT, 1, key, token, String(ttlMs));
      const extended = result === 1;

      cognigateLockExtensionsTotal.inc({
        resource,
        lock_type: lockType,
        result: extended ? 'extended' : 'not_owner',
      });

      logger.debug(
        { key, token, ttlMs, extended, lockType },
        extended
          ? 'Cognigate lock extended'
          : 'Cognigate lock extension failed (not owner)'
      );

      return extended;
    } catch (error) {
      cognigateLockExtensionsTotal.inc({
        resource,
        lock_type: lockType,
        result: 'error',
      });

      logger.warn(
        { key, token, ttlMs, error, lockType },
        'Error extending cognigate lock'
      );

      return false;
    }
  }
}

// =============================================================================
// DEFAULT INSTANCE
// =============================================================================

/**
 * Default lock manager instance used by the module-level helper functions.
 */
const defaultManager = new CognigateDistributedLockManager();

// =============================================================================
// MODULE-LEVEL FUNCTIONS
// =============================================================================

/**
 * Acquire a distributed lock for the given resource using the default manager.
 *
 * @param resource - The resource identifier to lock
 * @param options - Lock configuration options
 * @returns The acquired lock object, or null if acquisition failed
 */
export async function acquireCognigateLock(
  resource: string,
  options?: CognigateLockOptions
): Promise<CognigateAcquiredLock | null> {
  return defaultManager.acquire(resource, options);
}

/**
 * Execute a function while holding a distributed lock using the default manager.
 *
 * @param resource - The resource identifier to lock
 * @param fn - The async function to execute while holding the lock
 * @param options - Lock configuration options
 * @returns The result of the executed function
 * @throws {CognigateLockError} If lock cannot be acquired
 * @throws {CognigateLockTimeoutError} If acquisition timeout is reached
 */
export async function withCognigateLock<T>(
  resource: string,
  fn: () => Promise<T>,
  options?: CognigateLockOptions
): Promise<T> {
  return defaultManager.withLock(resource, fn, options);
}

// =============================================================================
// DOMAIN-SPECIFIC LOCK KEY HELPERS
// =============================================================================

/**
 * Generate the lock resource key for an execution operation.
 *
 * @param executionId - The execution UUID
 * @returns The resource string for use with acquire/withLock
 */
export function executionLockKey(executionId: string): string {
  return `execution:${executionId}`;
}

/**
 * Generate the lock resource key for an escalation resolution.
 *
 * @param escalationId - The escalation UUID
 * @returns The resource string for use with acquire/withLock
 */
export function escalationLockKey(escalationId: string): string {
  return `escalation:${escalationId}`;
}

/**
 * Generate the lock resource key for handler registration.
 *
 * @param handlerName - The handler name
 * @returns The resource string for use with acquire/withLock
 */
export function handlerLockKey(handlerName: string): string {
  return `handler:${handlerName}`;
}

// =============================================================================
// DOMAIN-SPECIFIC HELPER FUNCTIONS
// =============================================================================

/**
 * Execute a function while holding a lock on a specific execution.
 *
 * Prevents concurrent modifications to the same execution (e.g., two processes
 * attempting to update execution state simultaneously).
 *
 * @param executionId - The execution UUID to lock
 * @param fn - The async function to execute while holding the lock
 * @param options - Additional lock options (lockType is automatically set to 'execution')
 * @returns The result of the executed function
 * @throws {CognigateLockError} If the lock cannot be acquired
 *
 * @example
 * ```typescript
 * const result = await withExecutionLock(executionId, async () => {
 *   const execution = await getExecution(executionId);
 *   execution.status = 'completed';
 *   return saveExecution(execution);
 * });
 * ```
 */
export async function withExecutionLock<T>(
  executionId: string,
  fn: () => Promise<T>,
  options?: Omit<CognigateLockOptions, 'lockType'>
): Promise<T> {
  const resource = executionLockKey(executionId);
  return defaultManager.withLock(resource, fn, {
    ...options,
    lockType: 'execution',
    ttlMs: options?.ttlMs ?? 15_000,
  });
}

/**
 * Execute a function while holding a lock on a specific escalation.
 *
 * Prevents concurrent resolution of the same escalation (e.g., two operators
 * approving the same escalation simultaneously).
 *
 * @param escalationId - The escalation UUID to lock
 * @param fn - The async function to execute while holding the lock
 * @param options - Additional lock options (lockType is automatically set to 'escalation')
 * @returns The result of the executed function
 * @throws {CognigateLockError} If the lock cannot be acquired
 *
 * @example
 * ```typescript
 * const result = await withEscalationLock(escalationId, async () => {
 *   const escalation = await getEscalation(escalationId);
 *   if (escalation.status !== 'pending') {
 *     throw new Error('Escalation already resolved');
 *   }
 *   return resolveEscalation(escalation, 'approved');
 * });
 * ```
 */
export async function withEscalationLock<T>(
  escalationId: string,
  fn: () => Promise<T>,
  options?: Omit<CognigateLockOptions, 'lockType'>
): Promise<T> {
  const resource = escalationLockKey(escalationId);
  return defaultManager.withLock(resource, fn, {
    ...options,
    lockType: 'escalation',
    ttlMs: options?.ttlMs ?? 30_000,
  });
}

/**
 * Execute a function while holding a lock on a specific handler.
 *
 * Prevents concurrent registration or modification of the same handler
 * (e.g., two deployments attempting to register the same handler name).
 *
 * @param handlerName - The handler name to lock
 * @param fn - The async function to execute while holding the lock
 * @param options - Additional lock options (lockType is automatically set to 'handler')
 * @returns The result of the executed function
 * @throws {CognigateLockError} If the lock cannot be acquired
 *
 * @example
 * ```typescript
 * const result = await withHandlerLock('payment-processor', async () => {
 *   const existing = await getHandler('payment-processor');
 *   if (existing) {
 *     return updateHandler(existing, newConfig);
 *   }
 *   return registerHandler('payment-processor', newConfig);
 * });
 * ```
 */
export async function withHandlerLock<T>(
  handlerName: string,
  fn: () => Promise<T>,
  options?: Omit<CognigateLockOptions, 'lockType'>
): Promise<T> {
  const resource = handlerLockKey(handlerName);
  return defaultManager.withLock(resource, fn, {
    ...options,
    lockType: 'handler',
    ttlMs: options?.ttlMs ?? 10_000,
    retryCount: options?.retryCount ?? 5,
  });
}

// =============================================================================
// METRICS ACCESS
// =============================================================================

/**
 * Get all distributed lock metrics as Prometheus text format.
 */
export async function getDistributedLockMetrics(): Promise<string> {
  return cognigateDistributedLockRegistry.metrics();
}

/**
 * Get the metrics content type header value.
 */
export function getDistributedLockMetricsContentType(): string {
  return cognigateDistributedLockRegistry.contentType;
}

/**
 * Reset all distributed lock metrics (for testing).
 */
export function resetDistributedLockMetrics(): void {
  cognigateDistributedLockRegistry.resetMetrics();
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Clamp TTL to valid range [MIN_TTL_MS, MAX_TTL_MS].
 *
 * @param ttlMs - The requested TTL
 * @returns The clamped TTL value
 */
function clampTtl(ttlMs: number): number {
  if (ttlMs < MIN_TTL_MS) {
    logger.warn(
      { requestedTtl: ttlMs, clampedTo: MIN_TTL_MS },
      'Lock TTL below minimum, clamping'
    );
    return MIN_TTL_MS;
  }
  if (ttlMs > MAX_TTL_MS) {
    logger.warn(
      { requestedTtl: ttlMs, clampedTo: MAX_TTL_MS },
      'Lock TTL above maximum, clamping'
    );
    return MAX_TTL_MS;
  }
  return ttlMs;
}

/**
 * Sleep for the specified duration.
 *
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
