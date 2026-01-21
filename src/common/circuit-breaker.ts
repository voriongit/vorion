/**
 * Circuit Breaker pattern implementation for distributed systems
 *
 * Provides resilience for external service calls by:
 * - Tracking failure rates and opening the circuit when threshold is exceeded
 * - Failing fast when circuit is open to prevent cascading failures
 * - Testing recovery with half-open state after reset timeout
 *
 * State transitions:
 * CLOSED -> OPEN: When failure count reaches threshold
 * OPEN -> HALF_OPEN: After reset timeout expires
 * HALF_OPEN -> CLOSED: On successful call
 * HALF_OPEN -> OPEN: On failed call
 *
 * Per-service configurations allow tuning circuit breaker behavior
 * based on service characteristics (e.g., database vs. webhook).
 */

import type { Redis } from 'ioredis';
import { getRedis } from './redis.js';
import { createLogger } from './logger.js';

const logger = createLogger({ component: 'circuit-breaker' });

/**
 * Circuit breaker states
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Per-service circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Service name identifier */
  name: string;
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time in ms before attempting to close the circuit */
  resetTimeoutMs: number;
  /** Maximum attempts in half-open state before reopening */
  halfOpenMaxAttempts: number;
  /** Time window in ms to monitor for failures */
  monitorWindowMs: number;
}

/**
 * Default configurations per service type.
 * These can be overridden via environment variables in config.ts.
 */
export const CIRCUIT_BREAKER_CONFIGS: Record<string, CircuitBreakerConfig> = {
  database: {
    name: 'database',
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxAttempts: 3,
    monitorWindowMs: 60000,
  },
  redis: {
    name: 'redis',
    failureThreshold: 10,
    resetTimeoutMs: 10000,
    halfOpenMaxAttempts: 5,
    monitorWindowMs: 30000,
  },
  webhook: {
    name: 'webhook',
    failureThreshold: 3,
    resetTimeoutMs: 60000,
    halfOpenMaxAttempts: 2,
    monitorWindowMs: 120000,
  },
  policyEngine: {
    name: 'policy-engine',
    failureThreshold: 5,
    resetTimeoutMs: 15000,
    halfOpenMaxAttempts: 3,
    monitorWindowMs: 60000,
  },
  trustEngine: {
    name: 'trust-engine',
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxAttempts: 2,
    monitorWindowMs: 60000,
  },
  auditService: {
    name: 'audit-service',
    failureThreshold: 10,
    resetTimeoutMs: 15000,
    halfOpenMaxAttempts: 3,
    monitorWindowMs: 60000,
  },
  gdprService: {
    name: 'gdpr-service',
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxAttempts: 2,
    monitorWindowMs: 60000,
  },
  consentService: {
    name: 'consent-service',
    failureThreshold: 5,
    resetTimeoutMs: 20000,
    halfOpenMaxAttempts: 2,
    monitorWindowMs: 60000,
  },
};

/**
 * Circuit breaker configuration options
 */
export interface CircuitBreakerOptions {
  /** Unique name for this circuit breaker (used as Redis key prefix) */
  name: string;
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting to close the circuit (default: 30000) */
  resetTimeoutMs?: number;
  /** Maximum attempts in half-open state before reopening (default: 3) */
  halfOpenMaxAttempts?: number;
  /** Time window in ms to monitor for failures (default: 60000) */
  monitorWindowMs?: number;
  /** Optional Redis client (uses shared client if not provided) */
  redis?: Redis;
  /** Callback when circuit state changes */
  onStateChange?: (from: CircuitState, to: CircuitState, breaker: CircuitBreaker) => void;
}

/**
 * Circuit breaker state stored in Redis
 */
interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number | null;
  openedAt: number | null;
  /** Number of attempts made in half-open state */
  halfOpenAttempts: number;
  /** Timestamp of first failure in current monitoring window */
  windowStartTime: number | null;
}

/**
 * Result of circuit breaker execution
 */
export interface CircuitBreakerResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  circuitOpen: boolean;
}

/**
 * Circuit Breaker implementation with Redis-backed state for distributed systems
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   name: 'policy-evaluator',
 *   failureThreshold: 5,
 *   resetTimeoutMs: 30000,
 * });
 *
 * const result = await breaker.execute(async () => {
 *   return await policyEvaluator.evaluateMultiple(policies, context);
 * });
 *
 * if (result.circuitOpen) {
 *   // Use fallback logic
 * }
 * ```
 */
export class CircuitBreaker {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxAttempts: number;
  private readonly monitorWindowMs: number;
  private readonly redis: Redis;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState, breaker: CircuitBreaker) => void;

  // Local cache to reduce Redis calls for frequently checked state
  private localStateCache: CircuitBreakerState | null = null;
  private localStateCacheTime: number = 0;
  private readonly localStateCacheTtlMs: number = 1000; // 1 second local cache

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts ?? 3;
    this.monitorWindowMs = options.monitorWindowMs ?? 60000;
    this.redis = options.redis ?? getRedis();
    if (options.onStateChange) {
      this.onStateChange = options.onStateChange;
    }
  }

  /**
   * Get Redis key for this circuit breaker
   */
  private getRedisKey(): string {
    return `vorion:circuit-breaker:${this.name}`;
  }

  /**
   * Get the current state from Redis
   */
  private async getState(): Promise<CircuitBreakerState> {
    // Check local cache first
    const now = Date.now();
    if (this.localStateCache && (now - this.localStateCacheTime) < this.localStateCacheTtlMs) {
      return this.localStateCache;
    }

    try {
      const data = await this.redis.get(this.getRedisKey());

      if (!data) {
        const initialState: CircuitBreakerState = {
          state: 'CLOSED',
          failureCount: 0,
          lastFailureTime: null,
          openedAt: null,
          halfOpenAttempts: 0,
          windowStartTime: null,
        };
        // Update local cache
        this.localStateCache = initialState;
        this.localStateCacheTime = now;
        return initialState;
      }

      const state = JSON.parse(data) as CircuitBreakerState;

      // Update local cache
      this.localStateCache = state;
      this.localStateCacheTime = now;

      return state;
    } catch (error) {
      logger.error({ error, name: this.name }, 'Failed to get circuit breaker state from Redis');
      // Return default closed state on error - fail open
      return {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        openedAt: null,
        halfOpenAttempts: 0,
        windowStartTime: null,
      };
    }
  }

  /**
   * Save state to Redis
   */
  private async setState(state: CircuitBreakerState): Promise<void> {
    try {
      // Set with expiry of 24 hours to prevent stale data accumulation
      await this.redis.setex(
        this.getRedisKey(),
        86400, // 24 hours
        JSON.stringify(state)
      );
      // Update local cache
      this.localStateCache = state;
      this.localStateCacheTime = Date.now();
    } catch (error) {
      logger.error({ error, name: this.name }, 'Failed to save circuit breaker state to Redis');
    }
  }

  /**
   * Get the current circuit state
   */
  async getCircuitState(): Promise<CircuitState> {
    const state = await this.getState();
    const now = Date.now();

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (state.state === 'OPEN' && state.openedAt) {
      const timeSinceOpen = now - state.openedAt;
      if (timeSinceOpen >= this.resetTimeoutMs) {
        // Transition to HALF_OPEN, reset half-open attempts counter
        const newState: CircuitBreakerState = {
          ...state,
          state: 'HALF_OPEN',
          halfOpenAttempts: 0,
        };
        await this.setState(newState);
        this.notifyStateChange(state.state, 'HALF_OPEN');
        logger.info(
          { name: this.name, timeSinceOpenMs: timeSinceOpen },
          'Circuit breaker transitioned to HALF_OPEN'
        );
        return 'HALF_OPEN';
      }
    }

    return state.state;
  }

  /**
   * Check if the circuit is currently open (failing fast)
   */
  async isOpen(): Promise<boolean> {
    const currentState = await this.getCircuitState();
    return currentState === 'OPEN';
  }

  /**
   * Record a successful call
   */
  async recordSuccess(): Promise<void> {
    const state = await this.getState();

    if (state.state === 'HALF_OPEN') {
      // Successful call in HALF_OPEN state - close the circuit
      const newState: CircuitBreakerState = {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        openedAt: null,
        halfOpenAttempts: 0,
        windowStartTime: null,
      };
      await this.setState(newState);
      this.notifyStateChange('HALF_OPEN', 'CLOSED');
      logger.info({ name: this.name }, 'Circuit breaker closed after successful recovery');
    } else if (state.state === 'CLOSED' && state.failureCount > 0) {
      // Reset failure count on success in CLOSED state
      const newState: CircuitBreakerState = {
        ...state,
        failureCount: 0,
        lastFailureTime: null,
        windowStartTime: null,
      };
      await this.setState(newState);
    }
  }

  /**
   * Record a failed call
   */
  async recordFailure(): Promise<void> {
    const state = await this.getState();
    const now = Date.now();

    if (state.state === 'HALF_OPEN') {
      // Increment half-open attempts
      const newHalfOpenAttempts = (state.halfOpenAttempts || 0) + 1;

      if (newHalfOpenAttempts >= this.halfOpenMaxAttempts) {
        // Max half-open attempts reached - reopen the circuit
        const newState: CircuitBreakerState = {
          state: 'OPEN',
          failureCount: state.failureCount + 1,
          lastFailureTime: now,
          openedAt: now,
          halfOpenAttempts: 0,
          windowStartTime: null,
        };
        await this.setState(newState);
        this.notifyStateChange('HALF_OPEN', 'OPEN');
        logger.warn(
          { name: this.name, halfOpenAttempts: newHalfOpenAttempts, maxAttempts: this.halfOpenMaxAttempts },
          'Circuit breaker reopened after max half-open attempts exceeded'
        );
      } else {
        // Still in HALF_OPEN, increment attempt counter
        const newState: CircuitBreakerState = {
          ...state,
          failureCount: state.failureCount + 1,
          lastFailureTime: now,
          halfOpenAttempts: newHalfOpenAttempts,
        };
        await this.setState(newState);
        logger.debug(
          { name: this.name, halfOpenAttempts: newHalfOpenAttempts, maxAttempts: this.halfOpenMaxAttempts },
          'Circuit breaker recorded failure in HALF_OPEN state'
        );
      }
    } else if (state.state === 'CLOSED') {
      // Check if we need to start a new monitoring window
      let windowStartTime = state.windowStartTime;
      let failureCount = state.failureCount;

      if (windowStartTime && now - windowStartTime > this.monitorWindowMs) {
        // Window has expired, reset failure count and start new window
        windowStartTime = now;
        failureCount = 0;
        logger.debug(
          { name: this.name, windowMs: this.monitorWindowMs },
          'Circuit breaker monitoring window expired, resetting failure count'
        );
      } else if (!windowStartTime) {
        // Start new window
        windowStartTime = now;
      }

      const newFailureCount = failureCount + 1;

      if (newFailureCount >= this.failureThreshold) {
        // Threshold exceeded - open the circuit
        const newState: CircuitBreakerState = {
          state: 'OPEN',
          failureCount: newFailureCount,
          lastFailureTime: now,
          openedAt: now,
          halfOpenAttempts: 0,
          windowStartTime: null,
        };
        await this.setState(newState);
        this.notifyStateChange('CLOSED', 'OPEN');
        logger.warn(
          { name: this.name, failureCount: newFailureCount, threshold: this.failureThreshold },
          'Circuit breaker opened due to failure threshold exceeded'
        );
      } else {
        // Increment failure count
        const newState: CircuitBreakerState = {
          ...state,
          failureCount: newFailureCount,
          lastFailureTime: now,
          windowStartTime,
        };
        await this.setState(newState);
        logger.debug(
          { name: this.name, failureCount: newFailureCount, threshold: this.failureThreshold },
          'Circuit breaker recorded failure'
        );
      }
    }
    // If circuit is already OPEN, no action needed
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @param fn - The function to execute
   * @returns Result including whether circuit was open
   */
  async execute<T>(fn: () => Promise<T>): Promise<CircuitBreakerResult<T>> {
    const currentState = await this.getCircuitState();

    if (currentState === 'OPEN') {
      logger.debug({ name: this.name }, 'Circuit breaker is OPEN, failing fast');
      return {
        success: false,
        circuitOpen: true,
        error: new Error(`Circuit breaker '${this.name}' is OPEN`),
      };
    }

    try {
      const result = await fn();
      await this.recordSuccess();
      return {
        success: true,
        result,
        circuitOpen: false,
      };
    } catch (error) {
      await this.recordFailure();
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        circuitOpen: false,
      };
    }
  }

  /**
   * Force the circuit to open state
   * Useful for manual intervention or testing
   */
  async forceOpen(): Promise<void> {
    const state = await this.getState();
    const previousState = state.state;

    const newState: CircuitBreakerState = {
      state: 'OPEN',
      failureCount: this.failureThreshold,
      lastFailureTime: Date.now(),
      openedAt: Date.now(),
      halfOpenAttempts: 0,
      windowStartTime: null,
    };
    await this.setState(newState);

    if (previousState !== 'OPEN') {
      this.notifyStateChange(previousState, 'OPEN');
    }

    logger.info({ name: this.name, previousState }, 'Circuit breaker forcibly opened');
  }

  /**
   * Force the circuit to closed state
   * Useful for manual intervention or testing
   */
  async forceClose(): Promise<void> {
    const state = await this.getState();
    const previousState = state.state;

    const newState: CircuitBreakerState = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: null,
      openedAt: null,
      halfOpenAttempts: 0,
      windowStartTime: null,
    };
    await this.setState(newState);

    if (previousState !== 'CLOSED') {
      this.notifyStateChange(previousState, 'CLOSED');
    }

    logger.info({ name: this.name, previousState }, 'Circuit breaker forcibly closed');
  }

  /**
   * Reset the circuit breaker state completely
   */
  async reset(): Promise<void> {
    try {
      await this.redis.del(this.getRedisKey());
      this.localStateCache = null;
      this.localStateCacheTime = 0;
      logger.info({ name: this.name }, 'Circuit breaker reset');
    } catch (error) {
      logger.error({ error, name: this.name }, 'Failed to reset circuit breaker');
    }
  }

  /**
   * Get detailed status information for monitoring
   */
  async getStatus(): Promise<{
    name: string;
    state: CircuitState;
    failureCount: number;
    failureThreshold: number;
    resetTimeoutMs: number;
    halfOpenMaxAttempts: number;
    halfOpenAttempts: number;
    monitorWindowMs: number;
    lastFailureTime: Date | null;
    openedAt: Date | null;
    timeUntilReset: number | null;
    windowStartTime: Date | null;
  }> {
    const state = await this.getState();
    const now = Date.now();

    let timeUntilReset: number | null = null;
    if (state.state === 'OPEN' && state.openedAt) {
      const elapsed = now - state.openedAt;
      timeUntilReset = Math.max(0, this.resetTimeoutMs - elapsed);
    }

    return {
      name: this.name,
      state: state.state,
      failureCount: state.failureCount,
      failureThreshold: this.failureThreshold,
      resetTimeoutMs: this.resetTimeoutMs,
      halfOpenMaxAttempts: this.halfOpenMaxAttempts,
      halfOpenAttempts: state.halfOpenAttempts || 0,
      monitorWindowMs: this.monitorWindowMs,
      lastFailureTime: state.lastFailureTime ? new Date(state.lastFailureTime) : null,
      openedAt: state.openedAt ? new Date(state.openedAt) : null,
      timeUntilReset,
      windowStartTime: state.windowStartTime ? new Date(state.windowStartTime) : null,
    };
  }

  /**
   * Notify state change callback
   */
  private notifyStateChange(from: CircuitState, to: CircuitState): void {
    if (this.onStateChange) {
      try {
        this.onStateChange(from, to, this);
      } catch (error) {
        logger.error({ error, name: this.name, from, to }, 'Error in circuit breaker state change callback');
      }
    }
  }
}

/**
 * Factory function to create a circuit breaker with common defaults
 */
export function createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
  return new CircuitBreaker(options);
}

// =============================================================================
// Circuit Breaker Registry
// =============================================================================

/**
 * Global circuit breaker registry for managing per-service circuit breakers.
 * Uses lazy initialization to create circuit breakers on first access.
 */
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Configuration overrides that can be set at startup
 */
let configOverrides: Record<string, Partial<CircuitBreakerConfig>> = {};

/**
 * Set configuration overrides for circuit breakers.
 * This should be called during application initialization before any circuit breakers are used.
 *
 * @example
 * ```typescript
 * setCircuitBreakerConfigOverrides({
 *   database: { failureThreshold: 10, resetTimeoutMs: 60000 },
 *   redis: { failureThreshold: 20 },
 * });
 * ```
 */
export function setCircuitBreakerConfigOverrides(
  overrides: Record<string, Partial<CircuitBreakerConfig>>
): void {
  configOverrides = overrides;
  logger.info({ services: Object.keys(overrides) }, 'Circuit breaker config overrides set');
}

/**
 * Get or create a circuit breaker for a specific service.
 * Uses the default configuration for the service type, with optional overrides.
 *
 * @param serviceName - The name of the service (e.g., 'database', 'redis', 'webhook')
 * @param onStateChange - Optional callback for state changes
 * @returns The circuit breaker instance for the service
 *
 * @example
 * ```typescript
 * const dbBreaker = getCircuitBreaker('database');
 * const result = await dbBreaker.execute(async () => {
 *   return await db.query('SELECT * FROM users');
 * });
 * ```
 */
export function getCircuitBreaker(
  serviceName: string,
  onStateChange?: (from: CircuitState, to: CircuitState, breaker: CircuitBreaker) => void
): CircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    // Default values for unknown services
    const DEFAULT_FAILURE_THRESHOLD = 5;
    const DEFAULT_RESET_TIMEOUT_MS = 30000;
    const DEFAULT_HALF_OPEN_MAX_ATTEMPTS = 3;
    const DEFAULT_MONITOR_WINDOW_MS = 60000;

    // Get base config if it exists
    const baseConfig = CIRCUIT_BREAKER_CONFIGS[serviceName];

    // Apply any config overrides
    const overrides = configOverrides[serviceName];
    const finalConfig: CircuitBreakerConfig = {
      name: serviceName, // Always use the requested service name
      failureThreshold: overrides?.failureThreshold ?? baseConfig?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD,
      resetTimeoutMs: overrides?.resetTimeoutMs ?? baseConfig?.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS,
      halfOpenMaxAttempts: overrides?.halfOpenMaxAttempts ?? baseConfig?.halfOpenMaxAttempts ?? DEFAULT_HALF_OPEN_MAX_ATTEMPTS,
      monitorWindowMs: overrides?.monitorWindowMs ?? baseConfig?.monitorWindowMs ?? DEFAULT_MONITOR_WINDOW_MS,
    };

    const breaker = new CircuitBreaker({
      name: finalConfig.name,
      failureThreshold: finalConfig.failureThreshold,
      resetTimeoutMs: finalConfig.resetTimeoutMs,
      halfOpenMaxAttempts: finalConfig.halfOpenMaxAttempts,
      monitorWindowMs: finalConfig.monitorWindowMs,
      ...(onStateChange && { onStateChange }),
    });

    circuitBreakers.set(serviceName, breaker);

    logger.debug(
      {
        serviceName,
        config: {
          failureThreshold: finalConfig.failureThreshold,
          resetTimeoutMs: finalConfig.resetTimeoutMs,
          halfOpenMaxAttempts: finalConfig.halfOpenMaxAttempts,
          monitorWindowMs: finalConfig.monitorWindowMs,
        },
      },
      'Created circuit breaker for service'
    );
  }

  return circuitBreakers.get(serviceName)!;
}

/**
 * Get all registered circuit breakers with their current status.
 * Useful for health checks and monitoring dashboards.
 *
 * @returns Map of service names to their circuit breaker status
 */
export async function getAllCircuitBreakerStatuses(): Promise<
  Map<string, Awaited<ReturnType<CircuitBreaker['getStatus']>>>
> {
  const statuses = new Map<string, Awaited<ReturnType<CircuitBreaker['getStatus']>>>();
  const entries = Array.from(circuitBreakers);

  for (const [serviceName, breaker] of entries) {
    statuses.set(serviceName, await breaker.getStatus());
  }

  return statuses;
}

/**
 * Reset a specific circuit breaker by service name.
 * Useful for manual recovery during incidents.
 *
 * @param serviceName - The service name to reset
 * @returns True if the circuit breaker was found and reset
 */
export async function resetCircuitBreaker(serviceName: string): Promise<boolean> {
  const breaker = circuitBreakers.get(serviceName);
  if (!breaker) {
    return false;
  }

  await breaker.reset();
  logger.info({ serviceName }, 'Circuit breaker reset via registry');
  return true;
}

/**
 * Clear all circuit breakers from the registry.
 * Primarily for testing purposes.
 */
export function clearCircuitBreakerRegistry(): void {
  circuitBreakers.clear();
  configOverrides = {};
  logger.debug({}, 'Circuit breaker registry cleared');
}

// =============================================================================
// Circuit Breaker Open Error
// =============================================================================

/**
 * Error thrown when a circuit breaker is open and blocking execution.
 * This error allows callers to distinguish circuit breaker rejections
 * from actual execution failures.
 */
export class CircuitBreakerOpenError extends Error {
  public readonly serviceName: string;
  public readonly circuitState: CircuitState;

  constructor(serviceName: string, circuitState: CircuitState = 'OPEN') {
    super(`Circuit breaker '${serviceName}' is ${circuitState} - request rejected`);
    this.name = 'CircuitBreakerOpenError';
    this.serviceName = serviceName;
    this.circuitState = circuitState;
  }
}

// =============================================================================
// Circuit Breaker Metrics Callback Type
// =============================================================================

/**
 * Callback type for recording circuit breaker metrics.
 * This allows the circuit breaker module to emit metrics without
 * depending directly on the metrics module (avoiding circular deps).
 */
export type CircuitBreakerMetricsCallback = {
  recordStateChange: (serviceName: string, fromState: CircuitState, toState: CircuitState) => void;
  recordFailure: (serviceName: string) => void;
  recordSuccess: (serviceName: string) => void;
  updateState: (serviceName: string, state: CircuitState) => void;
};

/**
 * Default metrics callback (no-op)
 * Can be overridden via setCircuitBreakerMetricsCallback
 */
let metricsCallback: CircuitBreakerMetricsCallback = {
  recordStateChange: () => {},
  recordFailure: () => {},
  recordSuccess: () => {},
  updateState: () => {},
};

/**
 * Set the metrics callback for circuit breaker operations.
 * This should be called during application initialization to wire up
 * Prometheus metrics without creating circular dependencies.
 *
 * @param callback - The metrics callback functions
 */
export function setCircuitBreakerMetricsCallback(callback: CircuitBreakerMetricsCallback): void {
  metricsCallback = callback;
  logger.debug({}, 'Circuit breaker metrics callback configured');
}

// =============================================================================
// withCircuitBreaker Utility Function
// =============================================================================

/**
 * Execute a function with circuit breaker protection.
 *
 * This is a convenience wrapper that:
 * 1. Gets or creates the appropriate circuit breaker for the service
 * 2. Executes the function through the circuit breaker
 * 3. Records metrics for state changes, successes, and failures
 * 4. Throws CircuitBreakerOpenError when the circuit is open
 *
 * @param serviceName - The service name identifier (must match CIRCUIT_BREAKER_CONFIGS keys)
 * @param fn - The async function to execute
 * @returns The result of the function
 * @throws CircuitBreakerOpenError when the circuit is open
 * @throws The original error if the function fails
 *
 * @example
 * ```typescript
 * // Protect a database call
 * const result = await withCircuitBreaker('database', async () => {
 *   return await db.query('SELECT * FROM users WHERE id = $1', [userId]);
 * });
 *
 * // Protect an external API call
 * try {
 *   const data = await withCircuitBreaker('gdprService', async () => {
 *     return await gdprApi.exportUserData(userId);
 *   });
 * } catch (error) {
 *   if (error instanceof CircuitBreakerOpenError) {
 *     // Handle circuit open - use fallback or return cached data
 *     return cachedData;
 *   }
 *   throw error;
 * }
 * ```
 */
export async function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>
): Promise<T> {
  // Get or create the circuit breaker for this service
  const breaker = getCircuitBreaker(serviceName, (from, to) => {
    // Record state change metric
    metricsCallback.recordStateChange(serviceName, from, to);
    logger.info(
      { service: serviceName, fromState: from, toState: to },
      'Circuit breaker state changed'
    );
  });

  // Update the current state metric
  const currentState = await breaker.getCircuitState();
  metricsCallback.updateState(serviceName, currentState);

  // Execute through the circuit breaker
  const result = await breaker.execute(fn);

  // Handle the result
  if (result.circuitOpen) {
    // Circuit is open - throw CircuitBreakerOpenError
    logger.debug(
      { service: serviceName, state: 'OPEN' },
      'Circuit breaker rejected request'
    );
    throw new CircuitBreakerOpenError(serviceName, 'OPEN');
  }

  if (result.success) {
    // Success - record metric
    metricsCallback.recordSuccess(serviceName);
    return result.result as T;
  }

  // Failure - record metric and rethrow
  metricsCallback.recordFailure(serviceName);

  if (result.error) {
    throw result.error;
  }

  // Should not reach here, but throw generic error just in case
  throw new Error(`Circuit breaker '${serviceName}' execution failed`);
}

/**
 * Execute a function with circuit breaker protection, returning a result object
 * instead of throwing on circuit open.
 *
 * This variant is useful when you want to handle circuit open gracefully
 * without try/catch.
 *
 * @param serviceName - The service name identifier
 * @param fn - The async function to execute
 * @returns Result object with success flag, result/error, and circuitOpen indicator
 *
 * @example
 * ```typescript
 * const result = await withCircuitBreakerResult('auditService', async () => {
 *   return await auditService.record(event);
 * });
 *
 * if (result.circuitOpen) {
 *   // Queue for retry later
 *   await queueForRetry(event);
 * } else if (!result.success) {
 *   logger.error({ error: result.error }, 'Audit failed');
 * }
 * ```
 */
export async function withCircuitBreakerResult<T>(
  serviceName: string,
  fn: () => Promise<T>
): Promise<CircuitBreakerResult<T>> {
  // Get or create the circuit breaker for this service
  const breaker = getCircuitBreaker(serviceName, (from, to) => {
    metricsCallback.recordStateChange(serviceName, from, to);
    logger.info(
      { service: serviceName, fromState: from, toState: to },
      'Circuit breaker state changed'
    );
  });

  // Update the current state metric
  const currentState = await breaker.getCircuitState();
  metricsCallback.updateState(serviceName, currentState);

  // Execute through the circuit breaker
  const result = await breaker.execute(fn);

  // Record metrics based on result
  if (!result.circuitOpen) {
    if (result.success) {
      metricsCallback.recordSuccess(serviceName);
    } else {
      metricsCallback.recordFailure(serviceName);
    }
  }

  return result;
}
