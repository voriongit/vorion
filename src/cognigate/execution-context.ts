/**
 * Execution Context Builder and Active Execution Tracker for Cognigate
 *
 * Provides facilities for building validated execution contexts from intents
 * and decisions, and tracking active executions across the system.
 * Supports parent-child execution relationships and tenant-scoped queries.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from '../common/logger.js';
import type { ID, Intent, Decision } from '../common/types.js';
import type {
  ResourceLimits,
  ExecutionStatus,
  ExecutionContext as TypesExecutionContext,
} from './types.js';
import type { ResourceMonitor } from './resource-limiter.js';

/**
 * Re-export ExecutionContext from types for convenience.
 */
export type ExecutionContext = TypesExecutionContext;

const logger = createLogger({ component: 'cognigate', subComponent: 'execution-context' });

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default resource limits when none are specified */
const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxMemoryMb: 512,
  maxCpuPercent: 80,
  timeoutMs: 300000,
  maxNetworkRequests: 100,
  maxFileSystemOps: 1000,
  maxConcurrentOps: 10,
  maxPayloadSizeBytes: 10 * 1024 * 1024, // 10 MB
  maxRetries: 3,
  networkTimeoutMs: 30000,
};


// =============================================================================
// ACTIVE EXECUTION INTERFACE
// =============================================================================

/**
 * Represents a currently running execution with its tracking metadata.
 */
export interface ActiveExecution {
  /** Unique execution identifier */
  executionId: ID;
  /** Tenant owning this execution */
  tenantId: ID;
  /** Intent being executed */
  intentId: ID;
  /** Handler name processing the execution */
  handlerName: string;
  /** Current execution status */
  status: ExecutionStatus;
  /** Start timestamp in epoch milliseconds */
  startedAt: number;
  /** Deadline in epoch milliseconds */
  deadline: number;
  /** Abort controller for cancellation */
  abortController: AbortController;
  /** Optional resource monitor reference */
  resourceMonitor?: ResourceMonitor;
  /** Full execution context */
  context: ExecutionContext;
}

// =============================================================================
// EXECUTION CONTEXT BUILDER
// =============================================================================

/**
 * Builds and validates execution contexts from intents and decisions.
 * Generates unique execution IDs and handles resource limit merging.
 */
export class ExecutionContextBuilder {
  /**
   * Build a new execution context from the provided parameters.
   * Generates a unique execution ID, merges resource limits with defaults,
   * and computes the execution deadline.
   *
   * @param params - Parameters for building the execution context
   * @returns A fully populated ExecutionContext
   */
  static build(params: {
    intent: Intent;
    decision: Decision;
    tenantId: ID;
    resourceLimits?: Partial<ResourceLimits>;
    handlerName?: string;
    parentExecutionId?: ID;
    correlationId?: ID;
    traceId?: string;
    spanId?: string;
    priority?: number;
    metadata?: Record<string, unknown>;
  }): ExecutionContext {
    const {
      intent,
      decision,
      tenantId,
      resourceLimits,
      handlerName,
      parentExecutionId,
      correlationId,
      traceId,
      spanId,
      priority,
      metadata,
    } = params;

    // Validate required fields
    if (!intent) {
      throw new Error('Intent is required to build execution context');
    }
    if (!decision) {
      throw new Error('Decision is required to build execution context');
    }
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error('Tenant ID is required to build execution context');
    }

    // Validate decision authorizes execution
    if (decision.action !== 'allow' && decision.action !== 'monitor') {
      throw new Error(
        `Decision action '${decision.action}' does not authorize execution. ` +
        `Only 'allow' and 'monitor' decisions can be executed.`
      );
    }

    // Validate intent-decision relationship
    if (decision.intentId !== intent.id) {
      throw new Error(
        `Decision intentId '${decision.intentId}' does not match intent id '${intent.id}'`
      );
    }

    const execId = randomUUID();
    const mergedLimits: Partial<ResourceLimits> = {
      ...DEFAULT_RESOURCE_LIMITS,
      ...resourceLimits,
    };

    const now = new Date();
    const timeoutMs = mergedLimits.timeoutMs ?? DEFAULT_RESOURCE_LIMITS.timeoutMs;
    const deadlineTime = new Date(now.getTime() + timeoutMs);

    const context: ExecutionContext = {
      executionId: execId,
      intent,
      decision,
      tenantId,
      resourceLimits: mergedLimits,
      handler: handlerName ?? 'default',
      ...(parentExecutionId !== undefined && { parentExecutionId }),
      correlationId: correlationId ?? randomUUID(),
      traceId: traceId ?? randomUUID(),
      spanId: spanId ?? randomUUID().slice(0, 16),
      priority: priority ?? 0,
      metadata: metadata ?? {},
      deadline: deadlineTime.toISOString(),
    };

    logger.debug(
      {
        executionId: execId,
        intentId: intent.id,
        tenantId,
        handler: context.handler,
        timeoutMs,
      },
      'Execution context built'
    );

    return context;
  }

  /**
   * Validate an execution context for completeness and correctness.
   * Throws on any validation failure.
   *
   * @param context - The execution context to validate
   */
  static validate(context: ExecutionContext): void {
    if (!context.executionId || context.executionId.trim().length === 0) {
      throw new Error('Execution context must have a valid executionId');
    }
    if (!context.intent) {
      throw new Error('Execution context must have an intent');
    }
    if (!context.decision) {
      throw new Error('Execution context must have a decision');
    }
    if (!context.tenantId || context.tenantId.trim().length === 0) {
      throw new Error('Execution context must have a valid tenantId');
    }
    if (context.resourceLimits) {
      if (context.resourceLimits.timeoutMs !== undefined && context.resourceLimits.timeoutMs <= 0) {
        throw new Error('Execution context timeoutMs must be positive');
      }
      if (context.resourceLimits.maxMemoryMb !== undefined && context.resourceLimits.maxMemoryMb <= 0) {
        throw new Error('Execution context maxMemoryMb must be positive');
      }
    }
    if (context.handler !== undefined && context.handler.trim().length === 0) {
      throw new Error('Execution context must have a valid handler name');
    }
    if (context.deadline) {
      const deadlineMs = new Date(context.deadline).getTime();
      if (isNaN(deadlineMs)) {
        throw new Error('Execution context deadline must be a valid ISO 8601 timestamp');
      }
    }
  }

  /**
   * Create a child execution context from a parent context.
   * Inherits parent's tenant, correlation ID, and trace context.
   * Generates a new execution ID and span ID.
   *
   * @param parent - The parent execution context
   * @param overrides - Optional fields to override in the child context
   * @returns A new child ExecutionContext
   */
  static createChild(
    parent: ExecutionContext,
    overrides?: Partial<ExecutionContext>
  ): ExecutionContext {
    const childId = randomUUID();
    const now = new Date();
    const parentTimeoutMs = parent.resourceLimits?.timeoutMs ?? DEFAULT_RESOURCE_LIMITS.timeoutMs;
    const timeoutMs = overrides?.resourceLimits?.timeoutMs ?? parentTimeoutMs;
    const deadlineTime = new Date(now.getTime() + timeoutMs);

    const mergedResourceLimits = overrides?.resourceLimits ?? parent.resourceLimits;

    const base: ExecutionContext = {
      executionId: childId,
      intent: parent.intent,
      decision: parent.decision,
      tenantId: parent.tenantId,
      ...(mergedResourceLimits !== undefined && { resourceLimits: { ...mergedResourceLimits } }),
      ...(parent.handler !== undefined && { handler: parent.handler }),
      parentExecutionId: parent.executionId,
      ...(parent.correlationId !== undefined && { correlationId: parent.correlationId }),
      ...(parent.traceId !== undefined && { traceId: parent.traceId }),
      spanId: randomUUID().slice(0, 16),
      ...(parent.priority !== undefined && { priority: parent.priority }),
      metadata: { ...parent.metadata },
      deadline: deadlineTime.toISOString(),
    };

    // Apply overrides, preserving parent-child linkage and excluding
    // resourceLimits (already merged above) and undefined values
    const overridesCleaned = overrides ? Object.fromEntries(
      Object.entries(overrides).filter(
        ([k, v]) => v !== undefined && k !== 'resourceLimits'
      )
    ) : {};

    const child: ExecutionContext = {
      ...base,
      ...overridesCleaned,
      executionId: overrides?.executionId ?? childId,
      ...(overrides?.parentExecutionId !== undefined
        ? { parentExecutionId: overrides.parentExecutionId }
        : { parentExecutionId: parent.executionId }),
    };

    logger.debug(
      {
        childExecutionId: child.executionId,
        parentExecutionId: parent.executionId,
        correlationId: parent.correlationId,
      },
      'Child execution context created'
    );

    return child;
  }
}

// =============================================================================
// ACTIVE EXECUTION TRACKER
// =============================================================================

/**
 * Tracks all currently active executions in the system.
 * Provides lookup by execution ID and tenant, and supports
 * bulk termination for emergency scenarios.
 */
export class ActiveExecutionTracker {
  private executions: Map<string, ActiveExecution>;
  private tenantIndex: Map<string, Set<string>>;

  constructor() {
    this.executions = new Map();
    this.tenantIndex = new Map();

    logger.info('Active execution tracker initialized');
  }

  /**
   * Begin tracking a new active execution.
   *
   * @param executionId - Unique execution identifier
   * @param context - The execution context
   * @param abortController - Controller for aborting the execution
   */
  track(executionId: ID, context: ExecutionContext, abortController: AbortController): void {
    if (this.executions.has(executionId)) {
      throw new Error(`Execution ${executionId} is already being tracked`);
    }

    const timeoutMs = context.resourceLimits?.timeoutMs ?? DEFAULT_RESOURCE_LIMITS.timeoutMs;
    const deadlineMs = context.deadline
      ? new Date(context.deadline).getTime()
      : Date.now() + timeoutMs;

    const active: ActiveExecution = {
      executionId,
      tenantId: context.tenantId,
      intentId: context.intent.id,
      handlerName: context.handler ?? 'default',
      status: 'pending',
      startedAt: Date.now(),
      deadline: deadlineMs,
      abortController,
      context,
    };

    this.executions.set(executionId, active);

    // Update tenant index
    const tenantSet = this.tenantIndex.get(context.tenantId) ?? new Set();
    tenantSet.add(executionId);
    this.tenantIndex.set(context.tenantId, tenantSet);

    logger.debug(
      { executionId, tenantId: context.tenantId, intentId: context.intent.id },
      'Execution tracked'
    );
  }

  /**
   * Get an active execution by ID.
   *
   * @param executionId - The execution ID to look up
   * @returns The active execution or undefined if not found
   */
  get(executionId: ID): ActiveExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Remove a completed execution from tracking.
   *
   * @param executionId - The execution ID to remove
   */
  remove(executionId: ID): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return;
    }

    this.executions.delete(executionId);

    // Update tenant index
    const tenantSet = this.tenantIndex.get(execution.tenantId);
    if (tenantSet) {
      tenantSet.delete(executionId);
      if (tenantSet.size === 0) {
        this.tenantIndex.delete(execution.tenantId);
      }
    }

    logger.debug({ executionId, tenantId: execution.tenantId }, 'Execution removed from tracking');
  }

  /**
   * Get all active executions for a specific tenant.
   *
   * @param tenantId - The tenant ID to query
   * @returns Array of active executions for the tenant
   */
  getByTenant(tenantId: ID): ActiveExecution[] {
    const executionIds = this.tenantIndex.get(tenantId);
    if (!executionIds) {
      return [];
    }

    const results: ActiveExecution[] = [];
    for (const id of executionIds) {
      const execution = this.executions.get(id);
      if (execution) {
        results.push(execution);
      }
    }

    return results;
  }

  /**
   * Get the total count of active executions.
   */
  count(): number {
    return this.executions.size;
  }

  /**
   * Get the count of active executions for a specific tenant.
   *
   * @param tenantId - The tenant ID to count
   */
  countByTenant(tenantId: ID): number {
    const tenantSet = this.tenantIndex.get(tenantId);
    return tenantSet?.size ?? 0;
  }

  /**
   * Update the status of a tracked execution.
   *
   * @param executionId - The execution to update
   * @param status - The new status
   */
  updateStatus(executionId: ID, status: ExecutionStatus): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      logger.warn({ executionId }, 'Attempted to update status of untracked execution');
      return;
    }
    execution.status = status;
  }

  /**
   * Terminate all active executions.
   * Aborts each execution's abort controller with the provided reason.
   *
   * @param reason - Reason for bulk termination
   */
  terminateAll(reason: string): void {
    const count = this.executions.size;
    logger.warn({ count, reason }, 'Terminating all active executions');

    for (const [executionId, execution] of this.executions.entries()) {
      try {
        execution.abortController.abort(new Error(reason));
        execution.status = 'terminated';
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(
          { executionId, error: errorMessage },
          'Failed to abort execution during bulk termination'
        );
      }
    }

    logger.info({ count, reason }, 'All executions terminated');
  }

  /**
   * Get all executions that have exceeded their deadline.
   *
   * @returns Array of executions past their deadline
   */
  getExpired(): ActiveExecution[] {
    const now = Date.now();
    const expired: ActiveExecution[] = [];

    for (const execution of this.executions.values()) {
      if (now > execution.deadline) {
        expired.push(execution);
      }
    }

    return expired;
  }

  /**
   * Set the resource monitor reference for an active execution.
   *
   * @param executionId - The execution ID
   * @param monitor - The resource monitor instance
   */
  setResourceMonitor(executionId: ID, monitor: ResourceMonitor): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} is not being tracked`);
    }
    execution.resourceMonitor = monitor;
  }
}
