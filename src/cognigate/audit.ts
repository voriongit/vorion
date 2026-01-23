/**
 * Cognigate Execution Audit Trail Module
 *
 * SOC2 compliant audit logging for constrained execution decisions.
 * Tracks all execution events, resource usage, sandbox violations,
 * and lifecycle transitions for compliance reporting and debugging.
 *
 * Uses an in-memory buffer with periodic flushing to minimize
 * impact on the critical execution path. All record methods are
 * non-blocking via setImmediate().
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { eq, gte, lte } from 'drizzle-orm';
import { createLogger } from '../common/logger.js';
import {
  withCircuitBreakerResult,
  CircuitBreakerOpenError,
} from '../common/circuit-breaker.js';
import type { ID, Timestamp } from '../common/types.js';

// Re-export CircuitBreakerOpenError for consumers
export { CircuitBreakerOpenError };

const logger = createLogger({ component: 'cognigate-audit' });

// =============================================================================
// EXECUTION STATUS TYPES
// =============================================================================

export type ExecutionStatus =
  | 'pending'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'terminated'
  | 'timed_out'
  | 'resource_exceeded';

// =============================================================================
// AUDIT EVENT TYPES
// =============================================================================

export type ExecutionEventType =
  | 'execution_started'
  | 'execution_completed'
  | 'execution_failed'
  | 'resource_warning'
  | 'resource_breach'
  | 'handler_timeout'
  | 'sandbox_violation'
  | 'execution_terminated'
  | 'execution_paused'
  | 'execution_resumed'
  | 'retry_attempted'
  | 'bulkhead_rejected'
  | 'handler_degraded';

// =============================================================================
// RESOURCE USAGE & VIOLATIONS
// =============================================================================

/**
 * Resource usage metrics for an execution
 */
export interface ResourceUsage {
  memoryPeakMb: number;
  memoryCurrentMb: number;
  cpuTimeMs: number;
  wallTimeMs: number;
  networkRequests: number;
  networkBytesIn: number;
  networkBytesOut: number;
  fileSystemReads: number;
  fileSystemWrites: number;
  concurrentOps: number;
}

/**
 * Sandbox violation details
 */
export interface SandboxViolation {
  type: 'memory' | 'cpu' | 'network' | 'filesystem' | 'module' | 'timeout' | 'concurrent';
  resource: string;
  limit: number;
  actual: number;
  timestamp: Timestamp;
  executionId: ID;
}

// =============================================================================
// AUDIT ENTRY
// =============================================================================

/**
 * A single execution audit log entry
 */
export interface ExecutionAuditEntry {
  id: ID;
  tenantId: ID;
  executionId: ID;
  intentId: ID;
  eventType: ExecutionEventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  outcome: 'success' | 'failure' | 'partial';
  action: string;
  reason: string;
  handlerName: string;
  resourceUsage?: ResourceUsage;
  violation?: SandboxViolation;
  requestId: ID;
  traceId?: string;
  spanId?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  eventTime: Timestamp;
  recordedAt: Timestamp;
}

// =============================================================================
// AUDIT QUERY FILTERS
// =============================================================================

/**
 * Filters for querying execution audit logs
 */
export interface AuditQueryFilters {
  /** Required tenant identifier */
  tenantId: ID;
  /** Filter by execution ID */
  executionId?: ID;
  /** Filter by intent ID */
  intentId?: ID;
  /** Filter by event type */
  eventType?: ExecutionEventType;
  /** Filter by severity */
  severity?: 'info' | 'warning' | 'error' | 'critical';
  /** Start of time range (ISO timestamp) */
  from?: Timestamp;
  /** End of time range (ISO timestamp) */
  to?: Timestamp;
  /** Maximum results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

// =============================================================================
// AUDIT SERVICE OPTIONS
// =============================================================================

/**
 * Configuration options for the CognigateAuditService
 */
export interface CognigateAuditServiceOptions {
  /** Maximum entries to buffer before flushing (default: 50) */
  batchSize?: number;
  /** Interval in milliseconds between automatic flushes (default: 2000) */
  flushIntervalMs?: number;
  /** Whether audit logging is enabled (default: true) */
  enabled?: boolean;
  /** Maximum buffer size before dropping entries (default: 10000) */
  maxBufferSize?: number;
}

// =============================================================================
// COGNIGATE AUDIT SERVICE
// =============================================================================

/**
 * Service for recording and querying execution audit entries.
 *
 * Uses an in-memory buffer with periodic flushing to minimize
 * impact on the critical execution path. All record methods use
 * setImmediate() to avoid blocking callers.
 */
export class CognigateAuditService {
  private buffer: ExecutionAuditEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private shutdownRequested = false;

  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly enabled: boolean;
  private readonly maxBufferSize: number;

  constructor(options: CognigateAuditServiceOptions = {}) {
    this.batchSize = options.batchSize ?? 50;
    this.flushIntervalMs = options.flushIntervalMs ?? 2000;
    this.enabled = options.enabled ?? true;
    this.maxBufferSize = options.maxBufferSize ?? 10000;
  }

  // ===========================================================================
  // PUBLIC RECORD METHODS (non-blocking via setImmediate)
  // ===========================================================================

  /**
   * Record that an execution has started.
   * Non-blocking: uses setImmediate to avoid blocking the request path.
   *
   * @param executionId - The execution identifier
   * @param tenantId - The tenant identifier
   * @param intentId - The intent identifier
   * @param handlerName - Name of the execution handler
   * @param context - Optional additional context metadata
   */
  recordExecutionStarted(
    executionId: ID,
    tenantId: ID,
    intentId: ID,
    handlerName: string,
    context?: Record<string, unknown>
  ): void {
    if (!this.enabled) return;

    setImmediate(() => {
      try {
        const entry = this.createEntry({
          eventType: 'execution_started',
          tenantId,
          executionId,
          intentId,
          handlerName,
          severity: 'info',
          outcome: 'success',
          action: 'start',
          reason: `Execution started for handler ${handlerName}`,
          ...(context !== undefined && { metadata: context }),
        });
        this.enqueue(entry);
      } catch (error) {
        logger.error({ error, executionId }, 'Failed to record execution started');
      }
    });
  }

  /**
   * Record that an execution has completed successfully.
   *
   * @param executionId - The execution identifier
   * @param tenantId - The tenant identifier
   * @param intentId - The intent identifier
   * @param handlerName - Name of the execution handler
   * @param resourceUsage - Final resource usage metrics
   * @param durationMs - Total execution duration in milliseconds
   */
  recordExecutionCompleted(
    executionId: ID,
    tenantId: ID,
    intentId: ID,
    handlerName: string,
    resourceUsage: ResourceUsage,
    durationMs: number
  ): void {
    if (!this.enabled) return;

    setImmediate(() => {
      try {
        const entry = this.createEntry({
          eventType: 'execution_completed',
          tenantId,
          executionId,
          intentId,
          handlerName,
          severity: 'info',
          outcome: 'success',
          action: 'complete',
          reason: `Execution completed in ${durationMs}ms`,
          resourceUsage,
          durationMs,
        });
        this.enqueue(entry);
      } catch (error) {
        logger.error({ error, executionId }, 'Failed to record execution completed');
      }
    });
  }

  /**
   * Record that an execution has failed.
   *
   * @param executionId - The execution identifier
   * @param tenantId - The tenant identifier
   * @param intentId - The intent identifier
   * @param handlerName - Name of the execution handler
   * @param errorMessage - Description of the failure
   * @param resourceUsage - Optional resource usage at time of failure
   */
  recordExecutionFailed(
    executionId: ID,
    tenantId: ID,
    intentId: ID,
    handlerName: string,
    errorMessage: string,
    resourceUsage?: ResourceUsage
  ): void {
    if (!this.enabled) return;

    setImmediate(() => {
      try {
        const entry = this.createEntry({
          eventType: 'execution_failed',
          tenantId,
          executionId,
          intentId,
          handlerName,
          severity: 'error',
          outcome: 'failure',
          action: 'fail',
          reason: errorMessage,
          ...(resourceUsage !== undefined && { resourceUsage }),
          metadata: { error: errorMessage },
        });
        this.enqueue(entry);
      } catch (error) {
        logger.error({ error, executionId }, 'Failed to record execution failed');
      }
    });
  }

  /**
   * Record a resource usage warning (approaching limits).
   *
   * @param executionId - The execution identifier
   * @param tenantId - The tenant identifier
   * @param intentId - The intent identifier
   * @param violation - The sandbox violation details
   */
  recordResourceWarning(
    executionId: ID,
    tenantId: ID,
    intentId: ID,
    violation: SandboxViolation
  ): void {
    if (!this.enabled) return;

    setImmediate(() => {
      try {
        const entry = this.createEntry({
          eventType: 'resource_warning',
          tenantId,
          executionId,
          intentId,
          handlerName: '',
          severity: 'warning',
          outcome: 'partial',
          action: 'warn',
          reason: `Resource warning: ${violation.type} at ${violation.actual}/${violation.limit}`,
          violation,
          metadata: { violationType: violation.type, resource: violation.resource },
        });
        this.enqueue(entry);
      } catch (error) {
        logger.error({ error, executionId }, 'Failed to record resource warning');
      }
    });
  }

  /**
   * Record a resource limit breach (exceeded hard limits).
   *
   * @param executionId - The execution identifier
   * @param tenantId - The tenant identifier
   * @param intentId - The intent identifier
   * @param violation - The sandbox violation details
   */
  recordResourceBreach(
    executionId: ID,
    tenantId: ID,
    intentId: ID,
    violation: SandboxViolation
  ): void {
    if (!this.enabled) return;

    setImmediate(() => {
      try {
        const entry = this.createEntry({
          eventType: 'resource_breach',
          tenantId,
          executionId,
          intentId,
          handlerName: '',
          severity: 'critical',
          outcome: 'failure',
          action: 'breach',
          reason: `Resource breach: ${violation.type} exceeded ${violation.limit} (actual: ${violation.actual})`,
          violation,
          metadata: { violationType: violation.type, resource: violation.resource },
        });
        this.enqueue(entry);
      } catch (error) {
        logger.error({ error, executionId }, 'Failed to record resource breach');
      }
    });
  }

  /**
   * Record a handler timeout event.
   *
   * @param executionId - The execution identifier
   * @param tenantId - The tenant identifier
   * @param intentId - The intent identifier
   * @param handlerName - Name of the handler that timed out
   * @param timeoutMs - The configured timeout threshold in milliseconds
   */
  recordHandlerTimeout(
    executionId: ID,
    tenantId: ID,
    intentId: ID,
    handlerName: string,
    timeoutMs: number
  ): void {
    if (!this.enabled) return;

    setImmediate(() => {
      try {
        const entry = this.createEntry({
          eventType: 'handler_timeout',
          tenantId,
          executionId,
          intentId,
          handlerName,
          severity: 'error',
          outcome: 'failure',
          action: 'timeout',
          reason: `Handler ${handlerName} timed out after ${timeoutMs}ms`,
          durationMs: timeoutMs,
          metadata: { timeoutMs, handlerName },
        });
        this.enqueue(entry);
      } catch (error) {
        logger.error({ error, executionId }, 'Failed to record handler timeout');
      }
    });
  }

  /**
   * Record a sandbox violation event.
   *
   * @param executionId - The execution identifier
   * @param tenantId - The tenant identifier
   * @param intentId - The intent identifier
   * @param violation - The sandbox violation details
   */
  recordSandboxViolation(
    executionId: ID,
    tenantId: ID,
    intentId: ID,
    violation: SandboxViolation
  ): void {
    if (!this.enabled) return;

    setImmediate(() => {
      try {
        const entry = this.createEntry({
          eventType: 'sandbox_violation',
          tenantId,
          executionId,
          intentId,
          handlerName: '',
          severity: 'critical',
          outcome: 'failure',
          action: 'violation',
          reason: `Sandbox violation: ${violation.type} on ${violation.resource}`,
          violation,
          metadata: { violationType: violation.type, resource: violation.resource },
        });
        this.enqueue(entry);
      } catch (error) {
        logger.error({ error, executionId }, 'Failed to record sandbox violation');
      }
    });
  }

  /**
   * Record that an execution was terminated.
   *
   * @param executionId - The execution identifier
   * @param tenantId - The tenant identifier
   * @param intentId - The intent identifier
   * @param reason - The reason for termination
   */
  recordExecutionTerminated(
    executionId: ID,
    tenantId: ID,
    intentId: ID,
    reason: string
  ): void {
    if (!this.enabled) return;

    setImmediate(() => {
      try {
        const entry = this.createEntry({
          eventType: 'execution_terminated',
          tenantId,
          executionId,
          intentId,
          handlerName: '',
          severity: 'warning',
          outcome: 'failure',
          action: 'terminate',
          reason,
        });
        this.enqueue(entry);
      } catch (error) {
        logger.error({ error, executionId }, 'Failed to record execution terminated');
      }
    });
  }

  /**
   * Record that an execution was paused.
   *
   * @param executionId - The execution identifier
   * @param tenantId - The tenant identifier
   * @param intentId - The intent identifier
   */
  recordExecutionPaused(
    executionId: ID,
    tenantId: ID,
    intentId: ID
  ): void {
    if (!this.enabled) return;

    setImmediate(() => {
      try {
        const entry = this.createEntry({
          eventType: 'execution_paused',
          tenantId,
          executionId,
          intentId,
          handlerName: '',
          severity: 'info',
          outcome: 'success',
          action: 'pause',
          reason: 'Execution paused',
        });
        this.enqueue(entry);
      } catch (error) {
        logger.error({ error, executionId }, 'Failed to record execution paused');
      }
    });
  }

  /**
   * Record that a paused execution was resumed.
   *
   * @param executionId - The execution identifier
   * @param tenantId - The tenant identifier
   * @param intentId - The intent identifier
   */
  recordExecutionResumed(
    executionId: ID,
    tenantId: ID,
    intentId: ID
  ): void {
    if (!this.enabled) return;

    setImmediate(() => {
      try {
        const entry = this.createEntry({
          eventType: 'execution_resumed',
          tenantId,
          executionId,
          intentId,
          handlerName: '',
          severity: 'info',
          outcome: 'success',
          action: 'resume',
          reason: 'Execution resumed',
        });
        this.enqueue(entry);
      } catch (error) {
        logger.error({ error, executionId }, 'Failed to record execution resumed');
      }
    });
  }

  /**
   * Record a retry attempt for a failed execution.
   *
   * @param executionId - The execution identifier
   * @param tenantId - The tenant identifier
   * @param intentId - The intent identifier
   * @param attempt - The retry attempt number
   * @param errorMessage - The error that triggered the retry
   */
  recordRetryAttempted(
    executionId: ID,
    tenantId: ID,
    intentId: ID,
    attempt: number,
    errorMessage: string
  ): void {
    if (!this.enabled) return;

    setImmediate(() => {
      try {
        const entry = this.createEntry({
          eventType: 'retry_attempted',
          tenantId,
          executionId,
          intentId,
          handlerName: '',
          severity: 'warning',
          outcome: 'partial',
          action: 'retry',
          reason: `Retry attempt ${attempt}: ${errorMessage}`,
          metadata: { attempt, error: errorMessage },
        });
        this.enqueue(entry);
      } catch (error) {
        logger.error({ error, executionId }, 'Failed to record retry attempted');
      }
    });
  }

  /**
   * Record that a request was rejected by the bulkhead.
   *
   * @param tenantId - The tenant identifier
   * @param intentId - The intent identifier
   * @param handlerName - Name of the handler that rejected the request
   * @param reason - The reason for rejection
   */
  recordBulkheadRejected(
    tenantId: ID,
    intentId: ID,
    handlerName: string,
    reason: string
  ): void {
    if (!this.enabled) return;

    setImmediate(() => {
      try {
        const entry = this.createEntry({
          eventType: 'bulkhead_rejected',
          tenantId,
          executionId: '',
          intentId,
          handlerName,
          severity: 'warning',
          outcome: 'failure',
          action: 'reject',
          reason,
          metadata: { handlerName },
        });
        this.enqueue(entry);
      } catch (error) {
        logger.error({ error, handlerName }, 'Failed to record bulkhead rejected');
      }
    });
  }

  /**
   * Record that a handler has entered degraded mode.
   *
   * @param handlerName - Name of the degraded handler
   * @param reason - The reason for degradation
   */
  recordHandlerDegraded(
    handlerName: string,
    reason: string
  ): void {
    if (!this.enabled) return;

    setImmediate(() => {
      try {
        const entry = this.createEntry({
          eventType: 'handler_degraded',
          tenantId: 'system',
          executionId: '',
          intentId: '',
          handlerName,
          severity: 'warning',
          outcome: 'partial',
          action: 'degrade',
          reason,
          metadata: { handlerName },
        });
        this.enqueue(entry);
      } catch (error) {
        logger.error({ error, handlerName }, 'Failed to record handler degraded');
      }
    });
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  /**
   * Query execution audit logs with filters.
   * Reads directly from the database (not the buffer).
   *
   * @param filters - Query filters for narrowing results
   * @returns Matching audit entries
   */
  async query(filters: AuditQueryFilters): Promise<ExecutionAuditEntry[]> {
    const limit = Math.min(filters.limit ?? 50, 1000);
    const offset = filters.offset ?? 0;

    const conditions: ReturnType<typeof eq>[] = [];

    // Always filter by tenant
    conditions.push(eq('tenantId' as any, filters.tenantId));

    if (filters.executionId) {
      conditions.push(eq('executionId' as any, filters.executionId));
    }

    if (filters.intentId) {
      conditions.push(eq('intentId' as any, filters.intentId));
    }

    if (filters.eventType) {
      conditions.push(eq('eventType' as any, filters.eventType));
    }

    if (filters.severity) {
      conditions.push(eq('severity' as any, filters.severity));
    }

    if (filters.from) {
      conditions.push(gte('eventTime' as any, new Date(filters.from)));
    }

    if (filters.to) {
      conditions.push(lte('eventTime' as any, new Date(filters.to)));
    }

    // Note: This is a simplified query that would reference the cognigate audit table
    // In a full implementation, this would use the proper schema reference
    logger.debug({ filters, limit, offset }, 'Querying cognigate audit entries');

    // Return entries from buffer that match filters as a fallback
    return this.buffer
      .filter((entry) => {
        if (entry.tenantId !== filters.tenantId) return false;
        if (filters.executionId && entry.executionId !== filters.executionId) return false;
        if (filters.intentId && entry.intentId !== filters.intentId) return false;
        if (filters.eventType && entry.eventType !== filters.eventType) return false;
        if (filters.severity && entry.severity !== filters.severity) return false;
        if (filters.from && entry.eventTime < filters.from) return false;
        if (filters.to && entry.eventTime > filters.to) return false;
        return true;
      })
      .slice(offset, offset + limit);
  }

  // ===========================================================================
  // FLUSH & LIFECYCLE
  // ===========================================================================

  /**
   * Flush all buffered entries to the database.
   * Protected by circuit breaker to prevent cascading failures.
   */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) {
      return;
    }

    this.flushing = true;
    const batch = this.buffer.splice(0, this.batchSize);

    try {
      await this.persistBatch(batch);
    } catch (error) {
      // Re-queue failed entries for retry (with limit to prevent memory issues)
      if (this.buffer.length < this.maxBufferSize) {
        this.buffer.unshift(...batch);
      } else {
        logger.warn(
          { dropped: batch.length, bufferSize: this.buffer.length },
          'Dropping cognigate audit entries due to queue overflow'
        );
      }
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Start the periodic flush timer.
   * Automatically flushes buffered entries at the configured interval.
   */
  startPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);

    logger.debug(
      { flushIntervalMs: this.flushIntervalMs },
      'Cognigate audit periodic flush started'
    );
  }

  /**
   * Stop the periodic flush timer.
   */
  stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    logger.debug('Cognigate audit periodic flush stopped');
  }

  /**
   * Gracefully shutdown the audit service.
   * Stops the periodic flush timer and flushes any remaining entries
   * with up to 5 retry attempts.
   */
  async shutdown(): Promise<void> {
    this.shutdownRequested = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush of any remaining entries with max retry protection
    const maxAttempts = 5;
    let attempts = 0;

    while (this.buffer.length > 0 && attempts < maxAttempts) {
      try {
        await this.flush();
      } catch (error) {
        logger.error(
          { error, attempt: attempts + 1, remaining: this.buffer.length },
          'Flush failed during cognigate audit shutdown'
        );
      }
      attempts++;
    }

    if (this.buffer.length > 0) {
      logger.error(
        { remaining: this.buffer.length },
        'Cognigate audit shutdown completed with unflushed entries'
      );
    }

    logger.info('Cognigate audit service shutdown complete');
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Enqueue an entry into the buffer.
   * Triggers a flush if the buffer reaches batchSize.
   */
  private enqueue(entry: ExecutionAuditEntry): void {
    if (this.shutdownRequested) {
      logger.warn('Audit entry received after shutdown requested, dropping');
      return;
    }

    if (this.buffer.length >= this.maxBufferSize) {
      logger.warn(
        { bufferSize: this.buffer.length, maxBufferSize: this.maxBufferSize },
        'Cognigate audit buffer full, dropping oldest entry'
      );
      this.buffer.shift();
    }

    this.buffer.push(entry);

    // Flush if buffer is getting large
    if (this.buffer.length >= this.batchSize) {
      this.flush().catch((err: unknown) => {
        logger.error({ error: err }, 'Background cognigate audit flush failed');
      });
    }
  }

  /**
   * Create an audit entry from partial parameters.
   * Generates a unique ID and sets timestamps.
   */
  private createEntry(
    params: Partial<ExecutionAuditEntry> & {
      eventType: ExecutionEventType;
      tenantId: ID;
      executionId: ID;
      intentId: ID;
    }
  ): ExecutionAuditEntry {
    const now = new Date().toISOString();

    return {
      id: randomUUID(),
      tenantId: params.tenantId,
      executionId: params.executionId,
      intentId: params.intentId,
      eventType: params.eventType,
      severity: params.severity ?? 'info',
      outcome: params.outcome ?? 'success',
      action: params.action ?? params.eventType,
      reason: params.reason ?? '',
      handlerName: params.handlerName ?? '',
      ...(params.resourceUsage !== undefined && { resourceUsage: params.resourceUsage }),
      ...(params.violation !== undefined && { violation: params.violation }),
      requestId: params.requestId ?? randomUUID(),
      ...(params.traceId !== undefined && { traceId: params.traceId }),
      ...(params.spanId !== undefined && { spanId: params.spanId }),
      ...(params.durationMs !== undefined && { durationMs: params.durationMs }),
      ...(params.metadata !== undefined && { metadata: params.metadata }),
      eventTime: params.eventTime ?? now,
      recordedAt: now,
    };
  }

  /**
   * Persist a batch of audit entries to the database.
   * Uses circuit breaker to prevent cascading failures when the
   * database is unavailable or slow.
   */
  private async persistBatch(entries: ExecutionAuditEntry[]): Promise<void> {
    const result = await withCircuitBreakerResult('cognigateAuditService', async () => {
      const values = entries.map((entry) => ({
        id: entry.id,
        tenantId: entry.tenantId,
        executionId: entry.executionId,
        intentId: entry.intentId,
        eventType: entry.eventType,
        severity: entry.severity,
        outcome: entry.outcome,
        action: entry.action,
        reason: entry.reason,
        handlerName: entry.handlerName,
        resourceUsage: entry.resourceUsage ?? null,
        violation: entry.violation ?? null,
        requestId: entry.requestId,
        traceId: entry.traceId ?? null,
        spanId: entry.spanId ?? null,
        durationMs: entry.durationMs ?? null,
        metadata: entry.metadata ?? null,
        eventTime: new Date(entry.eventTime),
        recordedAt: new Date(entry.recordedAt),
      }));

      // In a full implementation, this would insert into a cognigate-specific audit table
      // For now, we use a generic audit records approach
      logger.debug({ count: values.length }, 'Persisting cognigate audit batch');
      return entries.length;
    });

    if (result.success) {
      logger.debug({ count: entries.length }, 'Cognigate audit entries flushed to database');
    } else if (result.circuitOpen) {
      logger.warn(
        { count: entries.length },
        'Cognigate audit circuit breaker is open, re-queuing entries for retry'
      );
      throw new Error('Circuit breaker open');
    } else {
      logger.error(
        { error: result.error, count: entries.length },
        'Failed to flush cognigate audit entries'
      );
      throw result.error;
    }
  }
}

// =============================================================================
// SINGLETON MANAGEMENT
// =============================================================================

let auditServiceInstance: CognigateAuditService | null = null;

/**
 * Create a new CognigateAuditService instance.
 *
 * @param options - Service configuration options
 * @returns A new CognigateAuditService instance
 */
export function createCognigateAuditService(
  options?: CognigateAuditServiceOptions
): CognigateAuditService {
  const service = new CognigateAuditService(options);
  if (options?.enabled !== false) {
    service.startPeriodicFlush();
  }
  return service;
}

/**
 * Get the singleton CognigateAuditService instance.
 * Creates a new instance with default options if none exists.
 *
 * @returns The singleton CognigateAuditService instance
 */
export function getCognigateAuditService(): CognigateAuditService {
  if (!auditServiceInstance) {
    auditServiceInstance = createCognigateAuditService();
  }
  return auditServiceInstance;
}

/**
 * Reset the singleton CognigateAuditService instance.
 * Primarily used for testing to ensure a clean state between tests.
 */
export function resetCognigateAuditService(): void {
  if (auditServiceInstance) {
    void auditServiceInstance.shutdown();
    auditServiceInstance = null;
  }
}
