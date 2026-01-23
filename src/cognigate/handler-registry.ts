/**
 * Handler Registry for Cognigate Execution Engine
 *
 * Provides type-safe handler registration, lookup, and lifecycle management.
 * Supports multiple handlers per intent type with priority-based resolution,
 * health checking, and execution metrics tracking.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type {
  HandlerDefinition,
  HandlerRegistration,
  RetryPolicy,
} from './types.js';

const logger = createLogger({ component: 'cognigate', subComponent: 'handler-registry' });

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default health check interval in milliseconds (30 seconds) */
const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 30000;

/** Maximum number of consecutive health check failures before marking degraded */
const MAX_HEALTH_FAILURES_BEFORE_DEGRADED = 3;

// =============================================================================
// HANDLER REGISTRY
// =============================================================================

/**
 * Registry for execution handlers with type-safe registration,
 * health checking, and metrics tracking.
 *
 * Supports multiple handlers for the same intent type with
 * priority-based resolution and load-aware selection.
 */
export class HandlerRegistry {
  private handlers: Map<string, HandlerRegistration>;
  private intentTypeIndex: Map<string, string[]>;
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private healthCheckIntervalMs: number;
  private healthFailureCounts: Map<string, number>;
  private drainPromises: Map<string, { resolve: () => void; count: number }>;
  private activeExecutionCounts: Map<string, number>;
  private shutdownRequested: boolean;

  constructor(options?: { healthCheckIntervalMs?: number }) {
    this.handlers = new Map();
    this.intentTypeIndex = new Map();
    this.healthCheckIntervalMs = options?.healthCheckIntervalMs ?? DEFAULT_HEALTH_CHECK_INTERVAL_MS;
    this.healthFailureCounts = new Map();
    this.drainPromises = new Map();
    this.activeExecutionCounts = new Map();
    this.shutdownRequested = false;

    logger.info(
      { healthCheckIntervalMs: this.healthCheckIntervalMs },
      'Handler registry initialized'
    );
  }

  /**
   * Register a new execution handler.
   * Validates the handler definition and adds it to the registry.
   * Throws if the handler name is already registered or definition is invalid.
   *
   * @param definition - The handler definition to register
   * @returns The created handler registration
   */
  register(definition: HandlerDefinition): HandlerRegistration {
    if (this.shutdownRequested) {
      throw new Error('Cannot register handlers during shutdown');
    }

    this.validateDefinition(definition);

    if (this.handlers.has(definition.name)) {
      throw new Error(`Handler '${definition.name}' is already registered`);
    }

    const registration: HandlerRegistration = {
      definition,
      registeredAt: new Date().toISOString(),
      status: 'active',
      executionCount: 0,
      failureCount: 0,
    };

    this.handlers.set(definition.name, registration);

    // Index by intent types
    for (const intentType of definition.intentTypes) {
      const existing = this.intentTypeIndex.get(intentType) ?? [];
      existing.push(definition.name);
      this.intentTypeIndex.set(intentType, existing);
    }

    logger.info(
      {
        name: definition.name,
        version: definition.version,
        intentTypes: definition.intentTypes,
      },
      'Handler registered'
    );

    return registration;
  }

  /**
   * Unregister a handler by name.
   * Removes the handler from all intent type indices.
   *
   * @param name - The name of the handler to unregister
   * @returns True if the handler was found and removed, false otherwise
   */
  unregister(name: string): boolean {
    const registration = this.handlers.get(name);
    if (!registration) {
      logger.warn({ name }, 'Attempted to unregister unknown handler');
      return false;
    }

    // Remove from intent type index
    for (const intentType of registration.definition.intentTypes) {
      const handlers = this.intentTypeIndex.get(intentType);
      if (handlers) {
        const filtered = handlers.filter(h => h !== name);
        if (filtered.length === 0) {
          this.intentTypeIndex.delete(intentType);
        } else {
          this.intentTypeIndex.set(intentType, filtered);
        }
      }
    }

    this.handlers.delete(name);
    this.healthFailureCounts.delete(name);

    logger.info({ name }, 'Handler unregistered');
    return true;
  }

  /**
   * Look up a handler registration by name.
   *
   * @param name - The handler name to look up
   * @returns The handler registration or undefined if not found
   */
  getByName(name: string): HandlerRegistration | undefined {
    return this.handlers.get(name);
  }

  /**
   * Get all handlers registered for a specific intent type.
   *
   * @param intentType - The intent type to look up
   * @returns Array of matching handler registrations
   */
  getByIntentType(intentType: string): HandlerRegistration[] {
    const handlerNames = this.intentTypeIndex.get(intentType) ?? [];
    const registrations: HandlerRegistration[] = [];

    for (const name of handlerNames) {
      const reg = this.handlers.get(name);
      if (reg) {
        registrations.push(reg);
      }
    }

    return registrations;
  }

  /**
   * Resolve the best handler for an intent type.
   * Selects from active handlers, preferring those with lower load
   * (fewer executions, lower failure rate).
   *
   * @param intentType - The intent type to resolve
   * @param priority - Optional priority threshold (handlers with timeout >= priority are preferred)
   * @returns The best matching handler registration, or null if none available
   */
  resolveHandler(intentType: string, priority?: number): HandlerRegistration | null {
    const candidates = this.getByIntentType(intentType)
      .filter(reg => reg.status === 'active');

    if (candidates.length === 0) {
      logger.debug({ intentType }, 'No active handlers found for intent type');
      return null;
    }

    if (candidates.length === 1) {
      return candidates[0] ?? null;
    }

    // Sort by: lowest failure rate, then lowest average duration
    const sorted = candidates.sort((a, b) => {
      const aFailRate = a.executionCount > 0 ? a.failureCount / a.executionCount : 0;
      const bFailRate = b.executionCount > 0 ? b.failureCount / b.executionCount : 0;

      if (aFailRate !== bFailRate) {
        return aFailRate - bFailRate;
      }

      return (a.avgDurationMs ?? 0) - (b.avgDurationMs ?? 0);
    });

    // If priority is specified, prefer handlers with matching or higher timeout
    if (priority !== undefined) {
      const prioritized = sorted.filter(
        reg => (reg.definition.timeout ?? Infinity) >= priority
      );
      if (prioritized.length > 0) {
        return prioritized[0] ?? null;
      }
    }

    return sorted[0] ?? null;
  }

  /**
   * Update the status of a registered handler.
   *
   * @param name - The handler name
   * @param status - The new status to set
   */
  setStatus(name: string, status: HandlerRegistration['status']): void {
    const registration = this.handlers.get(name);
    if (!registration) {
      throw new Error(`Handler '${name}' not found`);
    }

    const previousStatus = registration.status;
    registration.status = status;

    logger.info(
      { name, previousStatus, newStatus: status },
      'Handler status changed'
    );
  }

  /**
   * Record that an execution has started for a handler.
   * Must be called before execution begins so drain() can track in-flight work.
   *
   * @param name - The handler name
   */
  startExecution(name: string): void {
    const current = this.activeExecutionCounts.get(name) ?? 0;
    this.activeExecutionCounts.set(name, current + 1);
  }

  /**
   * Put a handler into draining mode.
   * The handler will not receive new executions, and the returned promise
   * resolves when all in-flight executions complete.
   *
   * @param name - The handler name to drain
   * @returns Promise that resolves when draining is complete
   */
  async drain(name: string): Promise<void> {
    const registration = this.handlers.get(name);
    if (!registration) {
      throw new Error(`Handler '${name}' not found`);
    }

    registration.status = 'draining';

    logger.info({ name }, 'Handler entering drain mode');

    // Check active execution count
    const activeCount = this.activeExecutionCounts.get(name) ?? 0;
    if (activeCount > 0) {
      return new Promise<void>((resolve) => {
        this.drainPromises.set(name, { resolve, count: activeCount });
      });
    }

    // No active executions to wait for
    registration.status = 'inactive';
    logger.info({ name }, 'Handler drained (no active executions)');
  }

  /**
   * Perform a health check on a specific handler.
   * Uses the handler's healthCheck function if defined.
   *
   * @param name - The handler name to health-check
   * @returns True if healthy, false otherwise
   */
  async checkHealth(name: string): Promise<boolean> {
    const registration = this.handlers.get(name);
    if (!registration) {
      throw new Error(`Handler '${name}' not found`);
    }

    if (!registration.definition.healthCheck) {
      // No health check defined, assume healthy
      return true;
    }

    try {
      const healthy = await registration.definition.healthCheck();

      if (healthy) {
        this.healthFailureCounts.set(name, 0);
        if (registration.status === 'degraded') {
          registration.status = 'active';
          logger.info({ name }, 'Handler recovered from degraded state');
        }
      } else {
        this.incrementHealthFailure(name, registration);
      }

      return healthy;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        { name, error: errorMessage },
        'Health check threw an exception'
      );
      this.incrementHealthFailure(name, registration);
      return false;
    }
  }

  /**
   * Run health checks on all registered handlers.
   *
   * @returns Map of handler names to their health status
   */
  async checkAllHealth(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    const checks = Array.from(this.handlers.keys()).map(async (name) => {
      const healthy = await this.checkHealth(name);
      results.set(name, healthy);
    });

    await Promise.allSettled(checks);
    return results;
  }

  /**
   * Record an execution result for metrics tracking.
   * Updates execution count, failure count, and rolling average duration.
   *
   * @param name - The handler name
   * @param durationMs - Execution duration in milliseconds
   * @param success - Whether the execution succeeded
   */
  recordExecution(name: string, durationMs: number, success: boolean): void {
    const registration = this.handlers.get(name);
    if (!registration) {
      logger.warn({ name }, 'Attempted to record execution for unknown handler');
      return;
    }

    registration.executionCount += 1;
    registration.lastExecutedAt = new Date().toISOString();

    if (!success) {
      registration.failureCount += 1;
    }

    // Decrement active execution count
    const activeCount = this.activeExecutionCounts.get(name) ?? 0;
    if (activeCount > 0) {
      this.activeExecutionCounts.set(name, activeCount - 1);
    }

    // Update rolling average duration
    const prevAvg = registration.avgDurationMs ?? 0;
    const prevTotal = prevAvg * (registration.executionCount - 1);
    registration.avgDurationMs = (prevTotal + durationMs) / registration.executionCount;

    // Check drain completion
    const drainEntry = this.drainPromises.get(name);
    if (drainEntry && registration.status === 'draining') {
      const remaining = this.activeExecutionCounts.get(name) ?? 0;
      if (remaining <= 0) {
        registration.status = 'inactive';
        drainEntry.resolve();
        this.drainPromises.delete(name);
        logger.info({ name }, 'Handler drain completed');
      }
    }

    logger.debug(
      {
        name,
        durationMs,
        success,
        executionCount: registration.executionCount,
        failureCount: registration.failureCount,
        avgDurationMs: registration.avgDurationMs,
      },
      'Execution recorded'
    );
  }

  /**
   * Get all current handler registrations.
   *
   * @returns Array of all handler registrations
   */
  getRegistrations(): HandlerRegistration[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get the total number of registered handlers.
   */
  getRegistrationCount(): number {
    return this.handlers.size;
  }

  /**
   * Get all registered intent types.
   */
  getRegisteredIntentTypes(): string[] {
    return Array.from(this.intentTypeIndex.keys());
  }

  /**
   * Start periodic health checks for all registered handlers.
   */
  startHealthChecks(): void {
    if (this.healthCheckInterval) {
      logger.warn('Health checks already running');
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkAllHealth();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Health check cycle failed');
      }
    }, this.healthCheckIntervalMs);

    logger.info(
      { intervalMs: this.healthCheckIntervalMs },
      'Periodic health checks started'
    );
  }

  /**
   * Stop periodic health checks.
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      logger.info('Periodic health checks stopped');
    }
  }

  /**
   * Gracefully shut down the handler registry.
   * Stops health checks and drains all active handlers.
   */
  async shutdown(): Promise<void> {
    this.shutdownRequested = true;
    this.stopHealthChecks();

    logger.info('Handler registry shutting down');

    // Drain all active handlers
    const drainPromises: Promise<void>[] = [];
    for (const [name, registration] of this.handlers.entries()) {
      if (registration.status === 'active') {
        drainPromises.push(this.drain(name));
      }
    }

    await Promise.allSettled(drainPromises);

    this.handlers.clear();
    this.intentTypeIndex.clear();
    this.healthFailureCounts.clear();
    this.drainPromises.clear();

    logger.info('Handler registry shut down complete');
  }

  /**
   * Increment the health failure counter and potentially mark handler as degraded.
   */
  private incrementHealthFailure(name: string, registration: HandlerRegistration): void {
    const failures = (this.healthFailureCounts.get(name) ?? 0) + 1;
    this.healthFailureCounts.set(name, failures);

    if (failures >= MAX_HEALTH_FAILURES_BEFORE_DEGRADED && registration.status === 'active') {
      registration.status = 'degraded';
      logger.warn(
        { name, consecutiveFailures: failures },
        'Handler marked as degraded after consecutive health check failures'
      );
    }
  }

  /**
   * Validate a handler definition for required fields and correctness.
   */
  private validateDefinition(definition: HandlerDefinition): void {
    if (!definition.name || definition.name.trim().length === 0) {
      throw new Error('Handler name is required and must be non-empty');
    }

    if (!definition.version || definition.version.trim().length === 0) {
      throw new Error('Handler version is required and must be non-empty');
    }

    if (!definition.intentTypes || definition.intentTypes.length === 0) {
      throw new Error('Handler must specify at least one intent type');
    }

    for (const intentType of definition.intentTypes) {
      if (!intentType || intentType.trim().length === 0) {
        throw new Error('Intent types must be non-empty strings');
      }
    }

    if (!definition.handler || typeof definition.handler !== 'function') {
      throw new Error('Handler function is required and must be a function');
    }

    if (definition.timeout !== undefined && definition.timeout <= 0) {
      throw new Error('Handler timeout must be a positive number');
    }

    if (definition.retryPolicy) {
      this.validateRetryPolicy(definition.retryPolicy);
    }

    // Validate resource defaults if provided
    if (definition.resourceDefaults) {
      if (definition.resourceDefaults.maxMemoryMb !== undefined && definition.resourceDefaults.maxMemoryMb <= 0) {
        throw new Error('resourceDefaults.maxMemoryMb must be positive');
      }
      if (definition.resourceDefaults.maxCpuPercent !== undefined &&
          (definition.resourceDefaults.maxCpuPercent <= 0 || definition.resourceDefaults.maxCpuPercent > 100)) {
        throw new Error('resourceDefaults.maxCpuPercent must be between 1 and 100');
      }
      if (definition.resourceDefaults.timeoutMs !== undefined && definition.resourceDefaults.timeoutMs <= 0) {
        throw new Error('resourceDefaults.timeoutMs must be positive');
      }
    }
  }

  /**
   * Validate a retry policy for correctness.
   */
  private validateRetryPolicy(policy: RetryPolicy): void {
    if (policy.maxRetries < 0) {
      throw new Error('retryPolicy.maxRetries cannot be negative');
    }
    if (policy.backoffMs <= 0) {
      throw new Error('retryPolicy.backoffMs must be positive');
    }
    if (policy.backoffMultiplier < 1) {
      throw new Error('retryPolicy.backoffMultiplier must be at least 1');
    }
    if (policy.maxBackoffMs < policy.backoffMs) {
      throw new Error('retryPolicy.maxBackoffMs must be greater than or equal to backoffMs');
    }
  }
}
