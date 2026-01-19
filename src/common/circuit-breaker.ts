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
 * Circuit breaker configuration options
 */
export interface CircuitBreakerOptions {
  /** Unique name for this circuit breaker (used as Redis key prefix) */
  name: string;
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting to close the circuit (default: 30000) */
  resetTimeoutMs?: number;
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
    this.redis = options.redis ?? getRedis();
    this.onStateChange = options.onStateChange;
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
        // Transition to HALF_OPEN
        const newState: CircuitBreakerState = {
          ...state,
          state: 'HALF_OPEN',
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
      // Failure in HALF_OPEN state - reopen the circuit
      const newState: CircuitBreakerState = {
        state: 'OPEN',
        failureCount: state.failureCount + 1,
        lastFailureTime: now,
        openedAt: now,
      };
      await this.setState(newState);
      this.notifyStateChange('HALF_OPEN', 'OPEN');
      logger.warn(
        { name: this.name },
        'Circuit breaker reopened after failure in HALF_OPEN state'
      );
    } else if (state.state === 'CLOSED') {
      const newFailureCount = state.failureCount + 1;

      if (newFailureCount >= this.failureThreshold) {
        // Threshold exceeded - open the circuit
        const newState: CircuitBreakerState = {
          state: 'OPEN',
          failureCount: newFailureCount,
          lastFailureTime: now,
          openedAt: now,
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
    lastFailureTime: Date | null;
    openedAt: Date | null;
    timeUntilReset: number | null;
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
      lastFailureTime: state.lastFailureTime ? new Date(state.lastFailureTime) : null,
      openedAt: state.openedAt ? new Date(state.openedAt) : null,
      timeUntilReset,
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
