/**
 * COGNIGATE - Constrained Execution Runtime
 *
 * Executes approved intents within defined constraints and resource limits.
 * Enterprise-grade implementation with circuit breaker, bulkhead concurrency
 * control, sandbox isolation, metrics, and comprehensive observability.
 *
 * Pipeline position: INTENT -> BASIS -> ENFORCE -> **COGNIGATE** -> PROOF -> TRUST ENGINE
 *
 * Implements the "Actuator" role from STPA control theory - enforcing
 * decisions by executing approved intents within constraints.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import { withCircuitBreakerResult } from '../common/circuit-breaker.js';
import type {
  ID,
  Intent,
  ControlAction,
} from '../common/types.js';
import { VorionError } from '../common/types.js';
import type {
  ExecutionStatus,
  ResourceLimits,
  ResourceUsage,
  ExecutionContext,
  ExecutionResult,
  ExecutionError,
  ExecutionHandler,
  HandlerDefinition,
  HandlerRegistration,
  RetryPolicy,
  SandboxViolation,
  BulkheadConfig,
  BulkheadStatus,
  ActiveExecution,
  CognigateConfig,
  ExecutionAuditEntry,
  ExecutionEventType,
  ExecutionAuditSeverity,
  ExecutionAuditOutcome,
  CognigateHealthStatus,
  CognigateReadinessStatus,
  ExecutionCacheEntry,
  HealthStatus,
} from './types.js';
import {
  ExecutionTimeoutError,
  ResourceExceededError,
  SandboxViolationError,
  HandlerNotFoundError,
  ExecutionTerminatedError,
  BulkheadRejectedError,
  ExecutionContextError,
} from './types.js';

// Re-export types for external consumers
export type {
  ExecutionStatus,
  ResourceLimits,
  ResourceUsage,
  ResourceType,
  ResourceThreshold,
  ExecutionContext,
  ExecutionResult,
  ExecutionError,
  ExecutionRecord,
  ExecutionHandler,
  HandlerDefinition,
  HandlerRegistration,
  RetryPolicy,
  SandboxConfig,
  SandboxViolation,
  BulkheadConfig,
  BulkheadStatus,
  ActiveExecution,
  CognigateConfig,
  ExecutionAuditEntry,
  ExecutionEventType,
  ExecutionAuditSeverity,
  ExecutionAuditOutcome,
  ExecutionEscalation,
  CognigateHealthStatus,
  CognigateReadinessStatus,
  CognigateMetrics,
  ExecutionCacheEntry,
} from './types.js';

export {
  ExecutionTimeoutError,
  ResourceExceededError,
  SandboxViolationError,
  HandlerNotFoundError,
  ExecutionTerminatedError,
  BulkheadRejectedError,
  ExecutionContextError,
} from './types.js';

const logger = createLogger({ component: 'cognigate' });

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

/**
 * Default resource limits applied to all executions unless overridden
 */
const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxMemoryMb: 512,
  maxCpuPercent: 50,
  timeoutMs: 300000,
  maxNetworkRequests: 100,
  maxFileSystemOps: 1000,
  maxConcurrentOps: 10,
  maxPayloadSizeBytes: 10485760, // 10MB
  maxRetries: 3,
  networkTimeoutMs: 30000,
} as const;

/**
 * Default retry policy for handler failures
 */
const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  backoffMs: 1000,
  backoffMultiplier: 2.0,
  maxBackoffMs: 30000,
  retryableErrors: [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'TRANSIENT_ERROR',
  ],
} as const;

/**
 * Default Cognigate service configuration
 */
const DEFAULT_CONFIG: CognigateConfig = {
  defaultResourceLimits: { ...DEFAULT_RESOURCE_LIMITS },
  bulkhead: {
    maxConcurrent: 50,
    maxQueued: 100,
    executionTimeoutMs: 300000,
    queueTimeoutMs: 30000,
    perTenant: true,
    perHandler: false,
  },
  sandbox: {
    enabled: true,
    isolationLevel: 'process',
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxAttempts: 3,
    monitorWindowMs: 60000,
  },
  cache: {
    enabled: true,
    ttlMs: 60000,
    maxSize: 5000,
  },
  audit: {
    enabled: true,
    batchSize: 50,
    flushIntervalMs: 2000,
  },
  metricsEnabled: true,
  gracefulShutdownTimeoutMs: 30000,
  maxExecutionHistoryDays: 90,
} as const;

// =============================================================================
// BULKHEAD MANAGER
// =============================================================================

/**
 * Manages concurrency limits using the bulkhead pattern
 *
 * Prevents any single tenant or handler from consuming all
 * execution capacity, ensuring fair resource distribution.
 */
class BulkheadManager {
  private readonly config: BulkheadConfig;
  private active: number = 0;
  private queued: number = 0;
  private rejectedCount: number = 0;
  private queueTimeoutCount: number = 0;
  private totalQueueWaitMs: number = 0;
  private queueWaitCount: number = 0;
  private readonly tenantActive: Map<string, number> = new Map();
  private readonly handlerActive: Map<string, number> = new Map();
  private readonly waitQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    tenantId: string;
    handlerName: string;
    enqueuedAt: number;
  }> = [];

  constructor(config: BulkheadConfig) {
    this.config = config;
    logger.debug(
      {
        maxConcurrent: config.maxConcurrent,
        maxQueued: config.maxQueued,
        perTenant: config.perTenant,
        perHandler: config.perHandler,
      },
      'Bulkhead manager initialized'
    );
  }

  /**
   * Acquire an execution slot, waiting in queue if necessary
   *
   * @param tenantId - Tenant requesting the slot
   * @param handlerName - Handler that will be invoked
   * @throws BulkheadRejectedError if capacity is exceeded and queue is full
   */
  async acquire(tenantId: string, handlerName: string): Promise<void> {
    // Check if we have immediate capacity
    if (this.active < this.config.maxConcurrent) {
      this.incrementActive(tenantId, handlerName);
      return;
    }

    // Check if queue has capacity
    if (this.queued >= this.config.maxQueued) {
      this.rejectedCount++;
      logger.warn(
        {
          tenantId,
          handlerName,
          active: this.active,
          queued: this.queued,
          maxConcurrent: this.config.maxConcurrent,
          maxQueued: this.config.maxQueued,
        },
        'Bulkhead capacity exceeded, rejecting execution'
      );
      throw new BulkheadRejectedError(
        tenantId,
        this.active,
        this.config.maxConcurrent,
        this.queued,
        this.config.maxQueued
      );
    }

    // Queue the request with timeout
    const enqueuedAt = performance.now();
    this.queued++;

    logger.debug(
      { tenantId, handlerName, queuePosition: this.queued },
      'Execution queued in bulkhead'
    );

    return new Promise<void>((resolve, reject) => {
      const entry = { resolve, reject, tenantId, handlerName, enqueuedAt };
      this.waitQueue.push(entry);

      // Set queue timeout
      const timeoutId = setTimeout(() => {
        const idx = this.waitQueue.indexOf(entry);
        if (idx !== -1) {
          this.waitQueue.splice(idx, 1);
          this.queued--;
          this.queueTimeoutCount++;
          logger.warn(
            { tenantId, handlerName, waitMs: performance.now() - enqueuedAt },
            'Bulkhead queue timeout exceeded'
          );
          reject(new BulkheadRejectedError(
            tenantId,
            this.active,
            this.config.maxConcurrent,
            this.queued,
            this.config.maxQueued
          ));
        }
      }, this.config.queueTimeoutMs);

      // Wrap resolve to clear timeout and track metrics
      const originalResolve = entry.resolve;
      entry.resolve = () => {
        clearTimeout(timeoutId);
        const waitMs = performance.now() - enqueuedAt;
        this.totalQueueWaitMs += waitMs;
        this.queueWaitCount++;
        this.incrementActive(tenantId, handlerName);
        originalResolve();
      };
    });
  }

  /**
   * Release an execution slot, allowing queued executions to proceed
   *
   * @param tenantId - Tenant releasing the slot
   * @param handlerName - Handler that was invoked
   */
  release(tenantId: string, handlerName: string): void {
    this.active = Math.max(0, this.active - 1);

    // Decrement per-tenant counter
    if (this.config.perTenant) {
      const tenantCount = this.tenantActive.get(tenantId) ?? 0;
      this.tenantActive.set(tenantId, Math.max(0, tenantCount - 1));
    }

    // Decrement per-handler counter
    if (this.config.perHandler) {
      const handlerCount = this.handlerActive.get(handlerName) ?? 0;
      this.handlerActive.set(handlerName, Math.max(0, handlerCount - 1));
    }

    // Process next queued execution
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      if (next) {
        this.queued--;
        next.resolve();
      }
    }
  }

  /**
   * Get current bulkhead status
   */
  getStatus(): BulkheadStatus {
    return {
      name: 'cognigate-bulkhead',
      active: this.active,
      queued: this.queued,
      maxConcurrent: this.config.maxConcurrent,
      maxQueued: this.config.maxQueued,
      rejectedCount: this.rejectedCount,
      queueTimeoutCount: this.queueTimeoutCount,
      avgQueueWaitMs: this.queueWaitCount > 0
        ? this.totalQueueWaitMs / this.queueWaitCount
        : 0,
    };
  }

  /**
   * Check if the bulkhead has available capacity
   */
  hasCapacity(): boolean {
    return this.active < this.config.maxConcurrent || this.queued < this.config.maxQueued;
  }

  /**
   * Increment active counters
   */
  private incrementActive(tenantId: string, handlerName: string): void {
    this.active++;

    if (this.config.perTenant) {
      const count = this.tenantActive.get(tenantId) ?? 0;
      this.tenantActive.set(tenantId, count + 1);
    }

    if (this.config.perHandler) {
      const count = this.handlerActive.get(handlerName) ?? 0;
      this.handlerActive.set(handlerName, count + 1);
    }
  }
}

// =============================================================================
// EXECUTION RESULT CACHE
// =============================================================================

/**
 * Simple LRU cache for execution results
 *
 * Caches idempotent execution results to avoid redundant handler
 * invocations for identical intents.
 */
class ExecutionCache {
  private readonly entries: Map<string, ExecutionCacheEntry> = new Map();
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(ttlMs: number, maxSize: number) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  /**
   * Get a cached execution result
   *
   * @param key - Cache key
   * @returns Cached result or undefined if not found/expired
   */
  get(key: string): ExecutionResult | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      this.misses++;
      return undefined;
    }

    entry.hitCount++;
    this.hits++;
    return entry.result;
  }

  /**
   * Store an execution result in the cache
   *
   * @param key - Cache key
   * @param result - Execution result to cache
   */
  set(key: string, result: ExecutionResult): void {
    // Enforce size limit with LRU eviction
    if (this.entries.size >= this.maxSize) {
      const keysToDelete = Array.from(this.entries.keys()).slice(
        0,
        Math.floor(this.maxSize * 0.1)
      );
      for (const k of keysToDelete) {
        this.entries.delete(k);
      }
    }

    this.entries.set(key, {
      result,
      cachedAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
      hitCount: 0,
    });
  }

  /**
   * Generate a cache key from execution context
   */
  generateKey(context: ExecutionContext): string {
    return [
      context.tenantId,
      context.intent.id,
      context.intent.entityId,
      context.handler ?? context.intent.intentType ?? 'default',
      JSON.stringify(context.intent.context),
    ].join(':');
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.entries.clear();
    logger.info({}, 'Execution cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; hitRate: number; hits: number; misses: number } {
    const total = this.hits + this.misses;
    return {
      size: this.entries.size,
      hitRate: total > 0 ? this.hits / total : 0,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

// =============================================================================
// SERVICE METRICS (INTERNAL)
// =============================================================================

/**
 * Internal metrics tracking for observability
 */
interface ServiceMetrics {
  executionsStarted: number;
  executionsCompleted: number;
  executionsFailed: number;
  executionsTerminated: number;
  executionsTimedOut: number;
  executionDurationMs: number[];
  handlersRegistered: number;
  retryAttempts: number;
  resourceWarnings: number;
  resourceBreaches: number;
  sandboxViolations: number;
}

/**
 * Create initial metrics state
 */
function createInitialMetrics(): ServiceMetrics {
  return {
    executionsStarted: 0,
    executionsCompleted: 0,
    executionsFailed: 0,
    executionsTerminated: 0,
    executionsTimedOut: 0,
    executionDurationMs: [],
    handlersRegistered: 0,
    retryAttempts: 0,
    resourceWarnings: 0,
    resourceBreaches: 0,
    sandboxViolations: 0,
  };
}

// =============================================================================
// COGNIGATE SERVICE
// =============================================================================

/**
 * Enterprise-grade Constrained Execution Runtime
 *
 * Provides:
 * - Handler registration and routing
 * - Bulkhead concurrency control
 * - Resource limit enforcement
 * - Execution timeout with AbortController
 * - Retry with exponential backoff
 * - Circuit breaker for handler resilience
 * - Execution result caching
 * - Sandbox violation detection
 * - Comprehensive metrics and audit logging
 * - Graceful execution lifecycle management (pause/resume/terminate)
 *
 * @example
 * ```typescript
 * const service = createCognigateService({
 *   defaultResourceLimits: { timeoutMs: 60000 },
 *   bulkhead: { maxConcurrent: 25 },
 * });
 *
 * service.registerHandler({
 *   name: 'data-processor',
 *   version: '1.0.0',
 *   intentTypes: ['process_data'],
 *   handler: async (intent, context, signal) => {
 *     return { processed: true };
 *   },
 *   metadata: {},
 * });
 *
 * const result = await service.execute(context);
 * ```
 */
export class CognigateService {
  private readonly handlers: Map<string, HandlerRegistration>;
  private readonly activeExecutions: Map<string, ActiveExecution>;
  private readonly bulkhead: BulkheadManager;
  private readonly config: CognigateConfig;
  private readonly abortControllers: Map<string, AbortController>;
  private readonly cache: ExecutionCache;
  private readonly metrics: ServiceMetrics;
  private readonly startedAt: number;
  private readonly auditBuffer: ExecutionAuditEntry[] = [];
  private auditFlushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<CognigateConfig>) {
    this.config = this.mergeConfig(config);
    this.handlers = new Map();
    this.activeExecutions = new Map();
    this.abortControllers = new Map();
    this.bulkhead = new BulkheadManager(this.config.bulkhead);
    this.cache = new ExecutionCache(
      this.config.cache.ttlMs,
      this.config.cache.maxSize
    );
    this.metrics = createInitialMetrics();
    this.startedAt = Date.now();

    // Start audit flush timer if audit is enabled
    if (this.config.audit.enabled) {
      this.auditFlushTimer = setInterval(
        () => this.flushAuditBuffer(),
        this.config.audit.flushIntervalMs
      );
    }

    logger.info(
      {
        bulkheadMaxConcurrent: this.config.bulkhead.maxConcurrent,
        bulkheadMaxQueued: this.config.bulkhead.maxQueued,
        cacheEnabled: this.config.cache.enabled,
        cacheTtlMs: this.config.cache.ttlMs,
        sandboxEnabled: this.config.sandbox.enabled,
        defaultTimeoutMs: this.config.defaultResourceLimits.timeoutMs,
        metricsEnabled: this.config.metricsEnabled,
        auditEnabled: this.config.audit.enabled,
      },
      'Cognigate service initialized'
    );
  }

  // ===========================================================================
  // HANDLER MANAGEMENT
  // ===========================================================================

  /**
   * Register an execution handler
   *
   * Handlers are matched to intents by intent type. Multiple handlers
   * can be registered for the same intent type, but only the most
   * recently registered one will be used.
   *
   * @param definition - Handler definition including function and metadata
   * @throws ExecutionContextError if handler name is empty or already registered
   */
  registerHandler(definition: HandlerDefinition): void {
    if (!definition.name || definition.name.trim().length === 0) {
      throw new ExecutionContextError(
        'Handler name must not be empty',
        'definition.name'
      );
    }

    if (this.handlers.has(definition.name)) {
      logger.warn(
        { handlerName: definition.name, version: definition.version },
        'Overwriting existing handler registration'
      );
    }

    const registration: HandlerRegistration = {
      definition,
      registeredAt: new Date().toISOString(),
      status: 'active',
      executionCount: 0,
      failureCount: 0,
    };

    this.handlers.set(definition.name, registration);
    this.metrics.handlersRegistered++;

    logger.info(
      {
        handlerName: definition.name,
        version: definition.version,
        intentTypes: definition.intentTypes,
        timeout: definition.timeout,
        hasRetryPolicy: !!definition.retryPolicy,
        hasHealthCheck: !!definition.healthCheck,
      },
      'Handler registered'
    );
  }

  /**
   * Unregister an execution handler
   *
   * Removes the handler from the registry. Active executions using
   * this handler will complete but no new executions will be routed to it.
   *
   * @param name - Name of the handler to unregister
   * @throws HandlerNotFoundError if handler is not registered
   */
  unregisterHandler(name: string): void {
    const registration = this.handlers.get(name);
    if (!registration) {
      throw new HandlerNotFoundError('unknown', name);
    }

    // Mark as draining before removal
    registration.status = 'draining';

    // Check for active executions using this handler
    const activeCount = Array.from(this.activeExecutions.values())
      .filter((exec) => exec.handlerName === name)
      .length;

    if (activeCount > 0) {
      logger.warn(
        { handlerName: name, activeExecutions: activeCount },
        'Unregistering handler with active executions'
      );
    }

    this.handlers.delete(name);

    logger.info(
      {
        handlerName: name,
        executionCount: registration.executionCount,
        failureCount: registration.failureCount,
      },
      'Handler unregistered'
    );
  }

  /**
   * Get a registered handler by name
   *
   * @param name - Handler name to look up
   * @returns Handler registration or undefined if not found
   */
  getHandler(name: string): HandlerRegistration | undefined {
    return this.handlers.get(name);
  }

  /**
   * List all registered handlers
   *
   * @returns Array of all handler registrations
   */
  listHandlers(): HandlerRegistration[] {
    return Array.from(this.handlers.values());
  }

  // ===========================================================================
  // CORE EXECUTION
  // ===========================================================================

  /**
   * Execute an approved intent within constraints
   *
   * This is the primary execution method that:
   * 1. Validates the execution context
   * 2. Checks bulkhead capacity
   * 3. Resolves the appropriate handler
   * 4. Builds resource limits (global defaults + handler defaults + context overrides)
   * 5. Creates AbortController with deadline
   * 6. Tracks the active execution
   * 7. Executes the handler with circuit breaker protection
   * 8. Monitors resource usage
   * 9. Checks for resource violations
   * 10. Builds the execution result
   * 11. Records metrics and audit entries
   * 12. Removes from active executions
   * 13. Returns the result
   *
   * @param context - Complete execution context
   * @returns Promise resolving to the execution result
   * @throws ExecutionContextError if context validation fails
   * @throws BulkheadRejectedError if concurrency limits are exceeded
   * @throws HandlerNotFoundError if no suitable handler is found
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = performance.now();
    const executionId = context.executionId;

    try {
      // Step 1: Validate the execution context
      this.validateContext(context);

      logger.info(
        {
          executionId,
          intentId: context.intent.id,
          tenantId: context.tenantId,
          handler: context.handler,
          priority: context.priority,
          hasDeadline: !!context.deadline,
          parentExecutionId: context.parentExecutionId,
        },
        'Starting execution'
      );

      // Step 2: Resolve the handler
      const handler = this.resolveHandler(context);

      // Step 3: Build resource limits
      const resourceLimits = this.buildResourceLimits(context, handler);

      // Step 4: Check bulkhead capacity and acquire slot
      await this.bulkhead.acquire(context.tenantId, handler.definition.name);

      this.metrics.executionsStarted++;

      // Step 5: Create AbortController with deadline
      const abortController = new AbortController();
      this.abortControllers.set(executionId, abortController);

      const deadline = this.calculateDeadline(context, resourceLimits);
      const deadlineTimer = setTimeout(() => {
        abortController.abort();
        logger.warn(
          { executionId, deadline, timeoutMs: resourceLimits.timeoutMs },
          'Execution deadline reached, aborting'
        );
      }, Math.max(0, deadline - Date.now()));

      // Wire external abort signal if provided
      if (context.abortSignal) {
        context.abortSignal.addEventListener('abort', () => {
          abortController.abort();
          logger.info({ executionId }, 'External abort signal received');
        });
      }

      // Step 6: Track active execution
      const activeExecution: ActiveExecution = {
        executionId,
        tenantId: context.tenantId,
        intentId: context.intent.id,
        handlerName: handler.definition.name,
        status: 'initializing' as ExecutionStatus,
        startedAt: new Date().toISOString(),
        deadline,
        abortController,
        resourceUsage: this.createEmptyResourceUsage(),
        resourceLimits,
        priority: context.priority ?? 0,
        retryCount: 0,
      };
      this.activeExecutions.set(executionId, activeExecution);

      // Record audit entry for execution start
      this.recordAuditEntry({
        executionId,
        tenantId: context.tenantId,
        intentId: context.intent.id,
        eventType: 'execution_started',
        severity: 'info',
        outcome: 'success',
        action: context.decision.action,
        reason: 'Execution initiated',
        handlerName: handler.definition.name,
        ...(context.traceId ? { traceId: context.traceId } : {}),
        ...(context.spanId ? { spanId: context.spanId } : {}),
        metadata: { priority: context.priority, parentExecutionId: context.parentExecutionId },
      });

      try {
        // Step 7: Execute with retry and circuit breaker
        activeExecution.status = 'running';
        const result = await this.executeWithRetry(context, handler, resourceLimits, abortController);

        // Step 8: Update handler statistics
        handler.executionCount++;
        handler.lastExecutedAt = new Date().toISOString();
        const durationMs = performance.now() - startTime;
        handler.avgDurationMs = handler.avgDurationMs
          ? (handler.avgDurationMs + durationMs) / 2
          : durationMs;

        // Step 9: Record success metrics
        this.metrics.executionsCompleted++;
        this.metrics.executionDurationMs.push(durationMs);
        if (this.metrics.executionDurationMs.length > 1000) {
          this.metrics.executionDurationMs.shift();
        }

        // Record audit entry for completion
        this.recordAuditEntry({
          executionId,
          tenantId: context.tenantId,
          intentId: context.intent.id,
          eventType: 'execution_completed',
          severity: 'info',
          outcome: 'success',
          action: 'allow',
          reason: `Execution completed in ${Math.round(durationMs)}ms`,
          handlerName: handler.definition.name,
          resourceUsage: result.resourceUsage,
          ...(context.traceId ? { traceId: context.traceId } : {}),
          ...(context.spanId ? { spanId: context.spanId } : {}),
        });

        logger.info(
          {
            executionId,
            intentId: context.intent.id,
            handlerName: handler.definition.name,
            durationMs: Math.round(durationMs),
            retryCount: result.retryCount,
            status: result.status,
          },
          'Execution completed successfully'
        );

        return result;
      } finally {
        // Step 12: Cleanup
        clearTimeout(deadlineTimer);
        this.activeExecutions.delete(executionId);
        this.abortControllers.delete(executionId);
        this.bulkhead.release(context.tenantId, handler.definition.name);
      }
    } catch (error) {
      const durationMs = performance.now() - startTime;

      // Determine execution status from error type
      let status: ExecutionStatus = 'failed';
      let errorCode = 'EXECUTION_ERROR';
      let retryable = false;

      if (error instanceof ExecutionTimeoutError) {
        status = 'timed_out';
        errorCode = 'EXECUTION_TIMEOUT';
        this.metrics.executionsTimedOut++;
      } else if (error instanceof ResourceExceededError) {
        status = 'resource_exceeded';
        errorCode = 'RESOURCE_EXCEEDED';
      } else if (error instanceof ExecutionTerminatedError) {
        status = 'terminated';
        errorCode = 'EXECUTION_TERMINATED';
        this.metrics.executionsTerminated++;
      } else if (error instanceof BulkheadRejectedError) {
        status = 'failed';
        errorCode = 'BULKHEAD_REJECTED';
      } else if (error instanceof HandlerNotFoundError) {
        status = 'failed';
        errorCode = 'HANDLER_NOT_FOUND';
      } else if (error instanceof ExecutionContextError) {
        status = 'failed';
        errorCode = 'CONTEXT_INVALID';
      } else {
        retryable = true;
      }

      this.metrics.executionsFailed++;

      const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';

      // Record audit entry for failure
      this.recordAuditEntry({
        executionId,
        tenantId: context.tenantId,
        intentId: context.intent.id,
        eventType: 'execution_failed',
        severity: status === 'timed_out' ? 'warning' : 'error',
        outcome: 'failure',
        action: 'deny',
        reason: errorMessage,
        handlerName: context.handler ?? 'unknown',
        ...(context.traceId ? { traceId: context.traceId } : {}),
        ...(context.spanId ? { spanId: context.spanId } : {}),
        metadata: { errorCode, retryable },
      });

      logger.error(
        {
          executionId,
          intentId: context.intent.id,
          tenantId: context.tenantId,
          error: errorMessage,
          errorCode,
          status,
          durationMs: Math.round(durationMs),
        },
        'Execution failed'
      );

      // Build failure result
      const executionError: ExecutionError = {
        code: errorCode,
        message: errorMessage,
        retryable,
      };
      if (error instanceof VorionError && error.details) {
        executionError.details = error.details;
      }

      return this.createExecutionResult(
        executionId,
        context,
        status,
        {},
        this.createEmptyResourceUsage(),
        durationMs,
        executionError,
        0,
        context.handler ?? 'unknown'
      );
    }
  }

  /**
   * Execute with caching support
   *
   * Checks the cache before executing. If a valid cached result
   * exists, returns it immediately. Otherwise, executes normally
   * and caches the successful result.
   *
   * @param context - Complete execution context
   * @returns Promise resolving to the execution result (possibly cached)
   */
  async executeWithCache(context: ExecutionContext): Promise<ExecutionResult> {
    if (!this.config.cache.enabled) {
      return this.execute(context);
    }

    const cacheKey = this.cache.generateKey(context);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      logger.debug(
        {
          executionId: context.executionId,
          intentId: context.intent.id,
          cacheKey,
        },
        'Execution cache hit'
      );
      return cached;
    }

    const result = await this.execute(context);

    // Only cache successful results
    if (result.status === 'completed') {
      this.cache.set(cacheKey, result);
      logger.debug(
        {
          executionId: context.executionId,
          intentId: context.intent.id,
        },
        'Execution result cached'
      );
    }

    return result;
  }

  // ===========================================================================
  // EXECUTION LIFECYCLE
  // ===========================================================================

  /**
   * Terminate a running execution
   *
   * Sends an abort signal to the execution handler and records
   * the termination in the audit trail.
   *
   * @param executionId - ID of the execution to terminate
   * @param reason - Reason for termination
   * @returns true if the execution was found and terminated
   */
  async terminate(executionId: ID, reason: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      logger.warn(
        { executionId },
        'Terminate requested for unknown execution'
      );
      return false;
    }

    logger.warn(
      {
        executionId,
        intentId: execution.intentId,
        tenantId: execution.tenantId,
        handlerName: execution.handlerName,
        reason,
      },
      'Terminating execution'
    );

    // Abort the execution
    execution.abortController.abort();
    execution.status = 'terminated';

    // Record audit entry
    this.recordAuditEntry({
      executionId,
      tenantId: execution.tenantId,
      intentId: execution.intentId,
      eventType: 'execution_terminated',
      severity: 'warning',
      outcome: 'terminated',
      action: 'terminate',
      reason,
      handlerName: execution.handlerName,
      resourceUsage: execution.resourceUsage,
    });

    this.metrics.executionsTerminated++;

    return true;
  }

  /**
   * Pause a running execution
   *
   * Note: Actual pause semantics depend on handler cooperation.
   * The handler must check the execution status to honor pause requests.
   *
   * @param executionId - ID of the execution to pause
   * @returns true if the execution was found and marked as paused
   */
  async pause(executionId: ID): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      logger.warn(
        { executionId },
        'Pause requested for unknown execution'
      );
      return false;
    }

    if (execution.status !== 'running') {
      logger.warn(
        { executionId, currentStatus: execution.status },
        'Cannot pause execution in non-running state'
      );
      return false;
    }

    execution.status = 'paused';

    logger.info(
      {
        executionId,
        intentId: execution.intentId,
        handlerName: execution.handlerName,
      },
      'Execution paused'
    );

    this.recordAuditEntry({
      executionId,
      tenantId: execution.tenantId,
      intentId: execution.intentId,
      eventType: 'execution_paused',
      severity: 'info',
      outcome: 'success',
      action: 'limit',
      reason: 'Execution paused by request',
      handlerName: execution.handlerName,
    });

    return true;
  }

  /**
   * Resume a paused execution
   *
   * @param executionId - ID of the execution to resume
   * @returns true if the execution was found and resumed
   */
  async resume(executionId: ID): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      logger.warn(
        { executionId },
        'Resume requested for unknown execution'
      );
      return false;
    }

    if (execution.status !== 'paused') {
      logger.warn(
        { executionId, currentStatus: execution.status },
        'Cannot resume execution in non-paused state'
      );
      return false;
    }

    execution.status = 'running';

    logger.info(
      {
        executionId,
        intentId: execution.intentId,
        handlerName: execution.handlerName,
      },
      'Execution resumed'
    );

    this.recordAuditEntry({
      executionId,
      tenantId: execution.tenantId,
      intentId: execution.intentId,
      eventType: 'execution_resumed',
      severity: 'info',
      outcome: 'success',
      action: 'allow',
      reason: 'Execution resumed by request',
      handlerName: execution.handlerName,
    });

    return true;
  }

  // ===========================================================================
  // STATUS AND OBSERVABILITY
  // ===========================================================================

  /**
   * Get all currently active executions
   *
   * @returns Array of active execution tracking records
   */
  getActiveExecutions(): ActiveExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get the status of a specific execution
   *
   * @param executionId - Execution to check
   * @returns Current execution status, or null if not found
   */
  async getExecutionStatus(executionId: ID): Promise<ExecutionStatus | null> {
    const execution = this.activeExecutions.get(executionId);
    return execution?.status ?? null;
  }

  /**
   * Get the current health status of the Cognigate service
   *
   * @returns Comprehensive health status including all subsystems
   */
  getHealthStatus(): CognigateHealthStatus {
    const now = new Date().toISOString();
    const activeHandlers = Array.from(this.handlers.values())
      .filter((h) => h.status === 'active');
    const degradedHandlers = Array.from(this.handlers.values())
      .filter((h) => h.status === 'degraded');

    const handlersStatus: HealthStatus = degradedHandlers.length > 0
      ? 'degraded'
      : activeHandlers.length > 0
        ? 'healthy'
        : 'unhealthy';

    const bulkheadStatus = this.bulkhead.getStatus();
    const bulkheadHealth: HealthStatus = bulkheadStatus.active >= bulkheadStatus.maxConcurrent * 0.9
      ? 'degraded'
      : 'healthy';

    const overallStatus: HealthStatus = handlersStatus === 'unhealthy'
      ? 'unhealthy'
      : handlersStatus === 'degraded' || bulkheadHealth === 'degraded'
        ? 'degraded'
        : 'healthy';

    return {
      status: overallStatus,
      checks: {
        handlers: {
          name: 'handlers',
          status: handlersStatus,
          message: `${activeHandlers.length} active, ${degradedHandlers.length} degraded`,
          lastCheckedAt: now,
        },
        bulkhead: {
          name: 'bulkhead',
          status: bulkheadHealth,
          message: `${bulkheadStatus.active}/${bulkheadStatus.maxConcurrent} active`,
          lastCheckedAt: now,
        },
        sandbox: {
          name: 'sandbox',
          status: 'healthy',
          message: this.config.sandbox.enabled ? 'Enabled' : 'Disabled',
          lastCheckedAt: now,
        },
        cache: {
          name: 'cache',
          status: 'healthy',
          message: this.config.cache.enabled
            ? `${this.cache.getStats().size} entries cached`
            : 'Disabled',
          lastCheckedAt: now,
        },
        circuitBreakers: {
          name: 'circuitBreakers',
          status: 'healthy',
          lastCheckedAt: now,
        },
      },
      uptime: Date.now() - this.startedAt,
      activeExecutions: this.activeExecutions.size,
      queuedExecutions: bulkheadStatus.queued,
      totalExecutions: this.metrics.executionsStarted,
      totalFailures: this.metrics.executionsFailed,
    };
  }

  /**
   * Get readiness status for orchestration probes
   *
   * @returns Readiness status with individual checks
   */
  getReadinessStatus(): CognigateReadinessStatus {
    const hasActiveHandlers = Array.from(this.handlers.values())
      .some((h) => h.status === 'active');
    const bulkheadReady = this.bulkhead.hasCapacity();

    return {
      ready: hasActiveHandlers && bulkheadReady,
      checks: {
        handlersReady: hasActiveHandlers,
        bulkheadReady,
        sandboxReady: true, // Sandbox is always ready (initialized on demand)
        circuitBreakersReady: true, // Circuit breakers start in closed state
      },
      startedAt: new Date(this.startedAt).toISOString(),
      uptimeMs: Date.now() - this.startedAt,
    };
  }

  /**
   * Get current service metrics snapshot
   *
   * @returns Copy of internal metrics
   */
  getMetrics(): ServiceMetrics {
    return {
      ...this.metrics,
      executionDurationMs: [...this.metrics.executionDurationMs],
    };
  }

  /**
   * Get cache statistics
   *
   * @returns Cache hit rate and size information
   */
  getCacheStats(): { size: number; hitRate: number; hits: number; misses: number } {
    return this.cache.getStats();
  }

  /**
   * Get bulkhead status
   *
   * @returns Current bulkhead capacity and rejection metrics
   */
  getBulkheadStatus(): BulkheadStatus {
    return this.bulkhead.getStatus();
  }

  /**
   * Gracefully shut down the service
   *
   * Waits for active executions to complete (up to timeout),
   * then terminates remaining executions and cleans up resources.
   */
  async shutdown(): Promise<void> {
    logger.info(
      {
        activeExecutions: this.activeExecutions.size,
        timeoutMs: this.config.gracefulShutdownTimeoutMs,
      },
      'Cognigate service shutting down'
    );

    // Stop audit flush timer
    if (this.auditFlushTimer) {
      clearInterval(this.auditFlushTimer);
      this.auditFlushTimer = null;
    }

    // Wait for active executions to complete
    const shutdownDeadline = Date.now() + this.config.gracefulShutdownTimeoutMs;
    while (this.activeExecutions.size > 0 && Date.now() < shutdownDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Terminate remaining executions
    if (this.activeExecutions.size > 0) {
      logger.warn(
        { remaining: this.activeExecutions.size },
        'Terminating remaining executions during shutdown'
      );
      for (const execId of this.activeExecutions.keys()) {
        await this.terminate(execId, 'Service shutdown');
      }
    }

    // Flush remaining audit entries
    this.flushAuditBuffer();

    // Clear cache
    this.cache.clear();

    logger.info({}, 'Cognigate service shut down complete');
  }

  // ===========================================================================
  // INTERNAL: EXECUTION ENGINE
  // ===========================================================================

  /**
   * Execute handler with retry and circuit breaker protection
   *
   * @param context - Execution context
   * @param handler - Resolved handler registration
   * @param resourceLimits - Merged resource limits
   * @param abortController - AbortController for this execution
   * @returns Execution result
   */
  private async executeWithRetry(
    context: ExecutionContext,
    handler: HandlerRegistration,
    resourceLimits: ResourceLimits,
    abortController: AbortController
  ): Promise<ExecutionResult> {
    const retryPolicy = handler.definition.retryPolicy ?? DEFAULT_RETRY_POLICY;
    const maxAttempts = Math.min(retryPolicy.maxRetries + 1, resourceLimits.maxRetries + 1);
    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Check if aborted
      if (abortController.signal.aborted) {
        throw new ExecutionTerminatedError(
          context.executionId,
          'Execution aborted before retry'
        );
      }

      try {
        const result = await this.executeHandler(context, handler, resourceLimits, abortController);
        result.retryCount = retryCount;
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount = attempt;

        // Check if we should retry
        if (attempt < maxAttempts - 1 && this.shouldRetry(lastError, attempt, retryPolicy)) {
          const backoffMs = this.getBackoffMs(attempt, retryPolicy);

          this.metrics.retryAttempts++;

          logger.warn(
            {
              executionId: context.executionId,
              attempt: attempt + 1,
              maxAttempts,
              backoffMs,
              error: lastError.message,
            },
            'Retrying execution after failure'
          );

          // Record retry audit entry
          this.recordAuditEntry({
            executionId: context.executionId,
            tenantId: context.tenantId,
            intentId: context.intent.id,
            eventType: 'retry_attempted',
            severity: 'warning',
            outcome: 'partial',
            action: 'allow',
            reason: `Retry attempt ${attempt + 1}: ${lastError.message}`,
            handlerName: handler.definition.name,
            metadata: { attempt: attempt + 1, backoffMs },
          });

          // Update active execution retry count
          const activeExec = this.activeExecutions.get(context.executionId);
          if (activeExec) {
            activeExec.retryCount = attempt + 1;
          }

          // Wait for backoff period (respecting abort signal)
          await this.waitWithAbort(backoffMs, abortController.signal);
        } else {
          // Not retryable or max attempts reached
          break;
        }
      }
    }

    // All attempts exhausted
    if (lastError instanceof ExecutionTimeoutError ||
        lastError instanceof ResourceExceededError ||
        lastError instanceof SandboxViolationError ||
        lastError instanceof ExecutionTerminatedError) {
      throw lastError;
    }

    // Wrap unknown errors
    handler.failureCount++;
    throw lastError ?? new Error('Execution failed after all retry attempts');
  }

  /**
   * Execute the handler function with timeout and resource monitoring
   *
   * @param context - Execution context
   * @param handler - Handler registration
   * @param resourceLimits - Resource limits
   * @param abortController - Abort controller
   * @returns Execution result
   */
  private async executeHandler(
    context: ExecutionContext,
    handler: HandlerRegistration,
    resourceLimits: ResourceLimits,
    abortController: AbortController
  ): Promise<ExecutionResult> {
    const startTime = performance.now();

    // Execute through circuit breaker
    const circuitBreakerName = `cognigate-handler-${handler.definition.name}`;

    const cbResult = await withCircuitBreakerResult<Record<string, unknown>>(
      circuitBreakerName,
      () => this.executeWithTimeout(
        handler.definition.handler,
        context.intent,
        context.intent.context,
        resourceLimits.timeoutMs,
        abortController.signal
      )
    );

    if (cbResult.circuitOpen) {
      logger.warn(
        {
          executionId: context.executionId,
          handlerName: handler.definition.name,
        },
        'Circuit breaker open for handler'
      );
      handler.status = 'degraded';
      throw new VorionError(
        `Circuit breaker open for handler ${handler.definition.name}`,
        'CIRCUIT_BREAKER_OPEN',
        { handlerName: handler.definition.name }
      );
    }

    if (!cbResult.success || !cbResult.result) {
      const error = cbResult.error ?? new Error('Handler execution failed');
      throw error;
    }

    const endTime = performance.now();
    const durationMs = endTime - startTime;

    // Track resource usage
    const resourceUsage = this.trackResourceUsage(context.executionId, durationMs);

    // Check for resource limit violations
    const violation = this.checkResourceLimits(resourceUsage, resourceLimits);
    if (violation) {
      this.metrics.resourceBreaches++;
      this.recordAuditEntry({
        executionId: context.executionId,
        tenantId: context.tenantId,
        intentId: context.intent.id,
        eventType: 'resource_breach',
        severity: 'warning',
        outcome: 'partial',
        action: 'limit',
        reason: `Resource breach: ${violation.type} on ${violation.resource}`,
        handlerName: handler.definition.name,
        violation,
        resourceUsage,
      });

      logger.warn(
        {
          executionId: context.executionId,
          violation,
        },
        'Resource limit breach detected (post-execution)'
      );
    }

    // Build successful result
    return this.createExecutionResult(
      context.executionId,
      context,
      'completed',
      cbResult.result,
      resourceUsage,
      durationMs,
      undefined,
      0,
      handler.definition.name
    );
  }

  /**
   * Execute a handler function with timeout enforcement
   *
   * Uses Promise.race with AbortController to enforce execution deadlines.
   *
   * @param handler - Handler function to execute
   * @param intent - Intent to pass to handler
   * @param handlerContext - Context data for handler
   * @param timeoutMs - Maximum execution time
   * @param signal - Abort signal for cancellation
   * @returns Handler output data
   * @throws ExecutionTimeoutError if timeout is exceeded
   * @throws ExecutionTerminatedError if abort signal fires
   */
  private async executeWithTimeout(
    handler: ExecutionHandler,
    intent: Intent,
    handlerContext: Record<string, unknown>,
    timeoutMs: number,
    signal: AbortSignal
  ): Promise<Record<string, unknown>> {
    // Check if already aborted
    if (signal.aborted) {
      throw new ExecutionTerminatedError(intent.id, 'Execution aborted before start');
    }

    const startTime = performance.now();

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      let settled = false;

      // Timeout timer
      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          const elapsed = performance.now() - startTime;
          reject(new ExecutionTimeoutError(intent.id, timeoutMs, elapsed));
        }
      }, timeoutMs);

      // Abort signal listener
      const abortHandler = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          reject(new ExecutionTerminatedError(intent.id, 'Execution terminated by signal'));
        }
      };
      signal.addEventListener('abort', abortHandler, { once: true });

      // Execute the handler
      handler(intent, handlerContext, signal)
        .then((result) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            signal.removeEventListener('abort', abortHandler);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            signal.removeEventListener('abort', abortHandler);
            reject(error);
          }
        });
    });
  }

  // ===========================================================================
  // INTERNAL: VALIDATION AND RESOLUTION
  // ===========================================================================

  /**
   * Validate an execution context before processing
   *
   * Checks that all required fields are present and that the
   * decision action is 'allow' (only approved intents can execute).
   *
   * @param context - Context to validate
   * @throws ExecutionContextError if validation fails
   */
  private validateContext(context: ExecutionContext): void {
    if (!context.executionId || context.executionId.trim().length === 0) {
      throw new ExecutionContextError(
        'executionId is required',
        'executionId'
      );
    }

    if (!context.tenantId || context.tenantId.trim().length === 0) {
      throw new ExecutionContextError(
        'tenantId is required',
        'tenantId'
      );
    }

    if (!context.intent) {
      throw new ExecutionContextError(
        'intent is required',
        'intent'
      );
    }

    if (!context.intent.id) {
      throw new ExecutionContextError(
        'intent.id is required',
        'intent.id'
      );
    }

    if (!context.decision) {
      throw new ExecutionContextError(
        'decision is required',
        'decision'
      );
    }

    // Only approved intents can be executed
    if (context.decision.action !== 'allow') {
      throw new ExecutionContextError(
        `Decision action must be 'allow' for execution, got '${context.decision.action}'`,
        'decision.action',
        context.decision.action
      );
    }

    if (!context.metadata) {
      throw new ExecutionContextError(
        'metadata is required (use empty object {})',
        'metadata'
      );
    }

    // Validate deadline if provided
    if (context.deadline) {
      const deadlineMs = new Date(context.deadline).getTime();
      if (isNaN(deadlineMs)) {
        throw new ExecutionContextError(
          'deadline must be a valid ISO 8601 timestamp',
          'deadline',
          context.deadline
        );
      }
      if (deadlineMs <= Date.now()) {
        throw new ExecutionContextError(
          'deadline must be in the future',
          'deadline',
          context.deadline
        );
      }
    }

    logger.debug(
      {
        executionId: context.executionId,
        tenantId: context.tenantId,
        intentId: context.intent.id,
      },
      'Execution context validated'
    );
  }

  /**
   * Resolve the appropriate handler for an execution context
   *
   * Resolution order:
   * 1. Explicit handler name from context
   * 2. Handler matching intent type
   * 3. Handler matching 'default' intent type
   *
   * @param context - Execution context with handler hint
   * @returns Resolved handler registration
   * @throws HandlerNotFoundError if no suitable handler is found
   */
  private resolveHandler(context: ExecutionContext): HandlerRegistration {
    // Check explicit handler name
    if (context.handler) {
      const handler = this.handlers.get(context.handler);
      if (!handler) {
        throw new HandlerNotFoundError(
          context.intent.intentType ?? 'unknown',
          context.handler
        );
      }
      if (handler.status !== 'active') {
        logger.warn(
          {
            handlerName: context.handler,
            status: handler.status,
          },
          'Resolved handler is not in active state'
        );
      }
      return handler;
    }

    // Match by intent type
    const intentType = context.intent.intentType
      ?? (context.intent.context['type'] as string)
      ?? 'default';

    for (const registration of this.handlers.values()) {
      if (registration.status !== 'active') continue;
      if (registration.definition.intentTypes.includes(intentType)) {
        logger.debug(
          {
            handlerName: registration.definition.name,
            intentType,
          },
          'Handler resolved by intent type'
        );
        return registration;
      }
    }

    // Try default handler
    for (const registration of this.handlers.values()) {
      if (registration.status !== 'active') continue;
      if (registration.definition.intentTypes.includes('*') ||
          registration.definition.intentTypes.includes('default')) {
        logger.debug(
          {
            handlerName: registration.definition.name,
            intentType,
          },
          'Using default handler'
        );
        return registration;
      }
    }

    throw new HandlerNotFoundError(intentType);
  }

  /**
   * Build merged resource limits from global defaults, handler defaults, and context overrides
   *
   * Priority: context overrides > handler defaults > global defaults
   *
   * @param context - Execution context with optional resource limit overrides
   * @param handler - Handler registration with optional resource defaults
   * @returns Fully resolved resource limits
   */
  private buildResourceLimits(
    context: ExecutionContext,
    handler: HandlerRegistration
  ): ResourceLimits {
    const limits: ResourceLimits = {
      ...this.config.defaultResourceLimits,
      ...(handler.definition.resourceDefaults ?? {}),
      ...(context.resourceLimits ?? {}),
    };

    // Apply handler-specific timeout if set
    if (handler.definition.timeout && !context.resourceLimits?.timeoutMs) {
      limits.timeoutMs = handler.definition.timeout;
    }

    logger.debug(
      {
        executionId: context.executionId,
        timeoutMs: limits.timeoutMs,
        maxMemoryMb: limits.maxMemoryMb,
        maxNetworkRequests: limits.maxNetworkRequests,
      },
      'Resource limits resolved'
    );

    return limits;
  }

  /**
   * Track resource usage for an execution
   *
   * Note: In a production implementation, this would integrate with
   * OS-level resource monitoring. This implementation provides
   * timing-based metrics.
   *
   * @param executionId - Execution to track
   * @param elapsedMs - Wall time elapsed
   * @returns Current resource usage snapshot
   */
  private trackResourceUsage(executionId: ID, elapsedMs: number): ResourceUsage {
    const activeExec = this.activeExecutions.get(executionId);

    // Build usage from active execution tracking or estimate from timing
    const usage: ResourceUsage = {
      memoryPeakMb: activeExec?.resourceUsage.memoryPeakMb ?? 0,
      memoryCurrentMb: activeExec?.resourceUsage.memoryCurrentMb ?? 0,
      cpuTimeMs: elapsedMs,
      wallTimeMs: elapsedMs,
      networkRequests: activeExec?.resourceUsage.networkRequests ?? 0,
      networkBytesIn: activeExec?.resourceUsage.networkBytesIn ?? 0,
      networkBytesOut: activeExec?.resourceUsage.networkBytesOut ?? 0,
      fileSystemReads: activeExec?.resourceUsage.fileSystemReads ?? 0,
      fileSystemWrites: activeExec?.resourceUsage.fileSystemWrites ?? 0,
      concurrentOps: activeExec?.resourceUsage.concurrentOps ?? 0,
    };

    // Try to get process-level memory info if available
    if (typeof process !== 'undefined' && process.memoryUsage) {
      try {
        const memUsage = process.memoryUsage();
        usage.memoryCurrentMb = Math.round(memUsage.heapUsed / 1024 / 1024);
        usage.memoryPeakMb = Math.max(
          usage.memoryPeakMb,
          Math.round(memUsage.heapUsed / 1024 / 1024)
        );
      } catch {
        // Memory tracking unavailable in this environment
      }
    }

    // Update active execution tracking
    if (activeExec) {
      activeExec.resourceUsage = usage;
    }

    return usage;
  }

  /**
   * Check resource usage against configured limits
   *
   * @param usage - Current resource usage
   * @param limits - Configured resource limits
   * @returns SandboxViolation if a limit is breached, null otherwise
   */
  private checkResourceLimits(
    usage: ResourceUsage,
    limits: ResourceLimits
  ): SandboxViolation | null {
    // Check memory limit
    if (usage.memoryPeakMb > limits.maxMemoryMb) {
      return {
        type: 'resource_limit',
        resource: 'memory',
        limit: limits.maxMemoryMb,
        actual: usage.memoryPeakMb,
        timestamp: new Date().toISOString(),
        executionId: '',
      };
    }

    // Check wall time (timeout)
    if (usage.wallTimeMs > limits.timeoutMs) {
      return {
        type: 'resource_limit',
        resource: 'time',
        limit: limits.timeoutMs,
        actual: usage.wallTimeMs,
        timestamp: new Date().toISOString(),
        executionId: '',
      };
    }

    // Check network requests
    if (usage.networkRequests > limits.maxNetworkRequests) {
      return {
        type: 'network_access',
        resource: 'network_requests',
        limit: limits.maxNetworkRequests,
        actual: usage.networkRequests,
        timestamp: new Date().toISOString(),
        executionId: '',
      };
    }

    // Check filesystem operations
    const totalFsOps = usage.fileSystemReads + usage.fileSystemWrites;
    if (totalFsOps > limits.maxFileSystemOps) {
      return {
        type: 'filesystem_access',
        resource: 'filesystem_ops',
        limit: limits.maxFileSystemOps,
        actual: totalFsOps,
        timestamp: new Date().toISOString(),
        executionId: '',
      };
    }

    // Check concurrent operations
    if (usage.concurrentOps > limits.maxConcurrentOps) {
      return {
        type: 'resource_limit',
        resource: 'concurrent_ops',
        limit: limits.maxConcurrentOps,
        actual: usage.concurrentOps,
        timestamp: new Date().toISOString(),
        executionId: '',
      };
    }

    return null;
  }

  // ===========================================================================
  // INTERNAL: RESULT BUILDING
  // ===========================================================================

  /**
   * Create an ExecutionResult record
   *
   * @param executionId - Unique execution ID
   * @param context - Original execution context
   * @param status - Final execution status
   * @param outputs - Handler outputs
   * @param resourceUsage - Resource usage during execution
   * @param durationMs - Total duration in milliseconds
   * @param error - Optional error information
   * @param retryCount - Number of retries performed
   * @param handlerName - Name of the handler that was invoked
   * @returns Complete execution result
   */
  private createExecutionResult(
    executionId: ID,
    context: ExecutionContext,
    status: ExecutionStatus,
    outputs: Record<string, unknown>,
    resourceUsage: ResourceUsage,
    durationMs: number,
    error?: ExecutionError,
    retryCount: number = 0,
    handlerName: string = 'unknown'
  ): ExecutionResult {
    const now = new Date().toISOString();
    const startedAt = new Date(Date.now() - durationMs).toISOString();

    const metadata: Record<string, unknown> = {};
    if (context.correlationId) metadata['correlationId'] = context.correlationId;
    if (context.traceId) metadata['traceId'] = context.traceId;
    if (context.spanId) metadata['spanId'] = context.spanId;
    if (context.parentExecutionId) metadata['parentExecutionId'] = context.parentExecutionId;
    if (context.priority !== undefined) metadata['priority'] = context.priority;

    const result: ExecutionResult = {
      executionId,
      intentId: context.intent.id,
      tenantId: context.tenantId,
      status,
      outputs,
      resourceUsage,
      startedAt,
      completedAt: now,
      durationMs: Math.round(durationMs),
      retryCount,
      handlerName,
      metadata,
    };

    if (error) {
      result.error = error;
    }

    return result;
  }

  /**
   * Create an empty resource usage record
   */
  private createEmptyResourceUsage(): ResourceUsage {
    return {
      memoryPeakMb: 0,
      memoryCurrentMb: 0,
      cpuTimeMs: 0,
      wallTimeMs: 0,
      networkRequests: 0,
      networkBytesIn: 0,
      networkBytesOut: 0,
      fileSystemReads: 0,
      fileSystemWrites: 0,
      concurrentOps: 0,
    };
  }

  // ===========================================================================
  // INTERNAL: RETRY LOGIC
  // ===========================================================================

  /**
   * Calculate the absolute deadline for an execution
   *
   * Uses the earliest of:
   * - Context-provided deadline
   * - Current time + resource limit timeout
   *
   * @param context - Execution context with optional deadline
   * @param resourceLimits - Resolved resource limits
   * @returns Absolute deadline timestamp in milliseconds
   */
  private calculateDeadline(context: ExecutionContext, resourceLimits: ResourceLimits): number {
    const timeoutDeadline = Date.now() + resourceLimits.timeoutMs;

    if (context.deadline) {
      const contextDeadline = new Date(context.deadline).getTime();
      return Math.min(timeoutDeadline, contextDeadline);
    }

    return timeoutDeadline;
  }

  /**
   * Determine if an error is retryable based on the retry policy
   *
   * @param error - The error that occurred
   * @param attempt - Current attempt number (0-based)
   * @param policy - Retry policy configuration
   * @returns true if the error should be retried
   */
  private shouldRetry(error: Error, attempt: number, policy: RetryPolicy): boolean {
    // Never retry certain error types
    if (error instanceof ExecutionTimeoutError) return false;
    if (error instanceof ExecutionTerminatedError) return false;
    if (error instanceof ExecutionContextError) return false;
    if (error instanceof SandboxViolationError) return false;
    if (error instanceof HandlerNotFoundError) return false;
    if (error instanceof BulkheadRejectedError) return false;

    // Check max attempts
    if (attempt >= policy.maxRetries) return false;

    // Check if error matches retryable patterns
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();
    const errorCode = (error as NodeJS.ErrnoException).code?.toLowerCase() ?? '';

    return policy.retryableErrors.some((pattern) => {
      const patternLower = pattern.toLowerCase();
      return (
        errorMessage.includes(patternLower) ||
        errorName.includes(patternLower) ||
        errorCode.includes(patternLower)
      );
    });
  }

  /**
   * Calculate backoff delay for a retry attempt
   *
   * Uses exponential backoff with jitter to prevent thundering herd.
   *
   * @param attempt - Current attempt number (0-based)
   * @param policy - Retry policy configuration
   * @returns Backoff delay in milliseconds
   */
  private getBackoffMs(attempt: number, policy: RetryPolicy): number {
    const exponentialBackoff = policy.backoffMs * Math.pow(policy.backoffMultiplier, attempt);
    const cappedBackoff = Math.min(exponentialBackoff, policy.maxBackoffMs);

    // Add jitter (0-25% of the backoff)
    const jitter = cappedBackoff * Math.random() * 0.25;

    return Math.round(cappedBackoff + jitter);
  }

  /**
   * Wait for a specified duration, respecting an abort signal
   *
   * @param ms - Duration to wait in milliseconds
   * @param signal - Abort signal that can cancel the wait
   */
  private async waitWithAbort(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new ExecutionTerminatedError('unknown', 'Aborted during backoff wait'));
        return;
      }

      const timeoutId = setTimeout(() => {
        signal.removeEventListener('abort', abortHandler);
        resolve();
      }, ms);

      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new ExecutionTerminatedError('unknown', 'Aborted during backoff wait'));
      };

      signal.addEventListener('abort', abortHandler, { once: true });
    });
  }

  // ===========================================================================
  // INTERNAL: AUDIT AND METRICS
  // ===========================================================================

  /**
   * Record an audit entry for an execution event
   *
   * Entries are buffered and flushed periodically for performance.
   *
   * @param params - Audit entry parameters
   */
  private recordAuditEntry(params: {
    executionId: ID;
    tenantId: ID;
    intentId: ID;
    eventType: ExecutionEventType;
    severity: ExecutionAuditSeverity;
    outcome: ExecutionAuditOutcome;
    action: ControlAction;
    reason: string;
    handlerName: string;
    resourceUsage?: ResourceUsage;
    violation?: SandboxViolation;
    traceId?: string;
    spanId?: string;
    metadata?: Record<string, unknown>;
  }): void {
    if (!this.config.audit.enabled) return;

    const entry: ExecutionAuditEntry = {
      id: `audit-${params.executionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId: params.tenantId,
      executionId: params.executionId,
      intentId: params.intentId,
      eventType: params.eventType,
      severity: params.severity,
      outcome: params.outcome,
      action: params.action,
      reason: params.reason,
      handlerName: params.handlerName,
      eventTime: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
    };

    // Only set optional fields when they have values
    if (params.resourceUsage) entry.resourceUsage = params.resourceUsage;
    if (params.violation) entry.violation = params.violation;
    if (params.traceId) entry.traceId = params.traceId;
    if (params.spanId) entry.spanId = params.spanId;
    if (params.metadata) entry.metadata = params.metadata;

    this.auditBuffer.push(entry);

    // Flush if buffer is full
    if (this.auditBuffer.length >= this.config.audit.batchSize) {
      this.flushAuditBuffer();
    }
  }

  /**
   * Flush buffered audit entries
   *
   * In a production implementation, this would write to a persistent
   * audit store. Currently logs the entries for observability.
   */
  private flushAuditBuffer(): void {
    if (this.auditBuffer.length === 0) return;

    const entries = this.auditBuffer.splice(0, this.auditBuffer.length);

    logger.debug(
      { entryCount: entries.length },
      'Flushing audit buffer'
    );

    // Log each entry at appropriate level
    for (const entry of entries) {
      const logData = {
        auditId: entry.id,
        executionId: entry.executionId,
        tenantId: entry.tenantId,
        intentId: entry.intentId,
        eventType: entry.eventType,
        outcome: entry.outcome,
        handlerName: entry.handlerName,
      };

      switch (entry.severity) {
        case 'critical':
        case 'error':
          logger.error(logData, `[AUDIT] ${entry.reason}`);
          break;
        case 'warning':
          logger.warn(logData, `[AUDIT] ${entry.reason}`);
          break;
        case 'info':
        default:
          logger.debug(logData, `[AUDIT] ${entry.reason}`);
          break;
      }
    }
  }

  // ===========================================================================
  // INTERNAL: CONFIGURATION
  // ===========================================================================

  /**
   * Merge user configuration with defaults
   *
   * Performs a deep merge ensuring all required fields have values.
   *
   * @param config - Partial user configuration
   * @returns Complete configuration with all defaults applied
   */
  private mergeConfig(config?: Partial<CognigateConfig>): CognigateConfig {
    if (!config) {
      return { ...DEFAULT_CONFIG, defaultResourceLimits: { ...DEFAULT_RESOURCE_LIMITS } };
    }

    const merged: CognigateConfig = {
      defaultResourceLimits: {
        ...DEFAULT_RESOURCE_LIMITS,
        ...(config.defaultResourceLimits ?? {}),
      },
      sandbox: {
        ...DEFAULT_CONFIG.sandbox,
        ...(config.sandbox ?? {}),
      },
      bulkhead: {
        ...DEFAULT_CONFIG.bulkhead,
        ...(config.bulkhead ?? {}),
      },
      circuitBreaker: {
        ...DEFAULT_CONFIG.circuitBreaker,
        ...(config.circuitBreaker ?? {}),
      },
      cache: {
        ...DEFAULT_CONFIG.cache,
        ...(config.cache ?? {}),
      },
      audit: {
        ...DEFAULT_CONFIG.audit,
        ...(config.audit ?? {}),
      },
      metricsEnabled: config.metricsEnabled ?? DEFAULT_CONFIG.metricsEnabled,
      gracefulShutdownTimeoutMs: config.gracefulShutdownTimeoutMs ?? DEFAULT_CONFIG.gracefulShutdownTimeoutMs,
      maxExecutionHistoryDays: config.maxExecutionHistoryDays ?? DEFAULT_CONFIG.maxExecutionHistoryDays,
    };

    const thresholds = config.resourceThresholds ?? DEFAULT_CONFIG.resourceThresholds;
    if (thresholds) {
      merged.resourceThresholds = thresholds;
    }

    return merged;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new Cognigate service instance
 *
 * @param config - Optional partial configuration (defaults will be applied)
 * @returns A configured CognigateService instance
 *
 * @example
 * ```typescript
 * const cognigate = createCognigateService({
 *   defaultResourceLimits: {
 *     timeoutMs: 60000,
 *     maxMemoryMb: 256,
 *   },
 *   bulkhead: {
 *     maxConcurrent: 25,
 *     maxQueued: 50,
 *   },
 *   sandbox: {
 *     enabled: true,
 *     isolationLevel: 'process',
 *   },
 * });
 *
 * // Register a handler
 * cognigate.registerHandler({
 *   name: 'data-processor',
 *   version: '1.0.0',
 *   intentTypes: ['process_data', 'transform_data'],
 *   handler: async (intent, context, signal) => {
 *     // Check for abort signal
 *     if (signal.aborted) throw new Error('Aborted');
 *     return { processed: true, records: 42 };
 *   },
 *   metadata: { owner: 'data-team' },
 * });
 *
 * // Execute an approved intent
 * const result = await cognigate.execute({
 *   executionId: 'exec-123',
 *   tenantId: 'tenant-456',
 *   intent: approvedIntent,
 *   decision: allowDecision,
 *   metadata: {},
 * });
 * ```
 */
export function createCognigateService(config?: Partial<CognigateConfig>): CognigateService {
  return new CognigateService(config);
}
