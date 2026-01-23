/**
 * Execution Sandbox for Cognigate Execution Engine
 *
 * Provides execution isolation and security enforcement through:
 * - Configurable sandbox wrapping with resource limits
 * - Network policy enforcement (allowlist/denylist)
 * - Module access control (allowlist/denylist)
 * - Bulkhead pattern for concurrency isolation (global, per-tenant, per-handler)
 * - Violation tracking and reporting
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from '../common/logger.js';
import type { ID } from '../common/types.js';
import type {
  SandboxConfig,
  SandboxViolation,
  BulkheadConfig,
  ResourceLimits,
} from './types.js';

const logger = createLogger({ component: 'cognigate', subComponent: 'sandbox' });

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum number of violations to retain per execution */
const MAX_VIOLATIONS_PER_EXECUTION = 100;

/** Maximum total violations retained globally */
const MAX_TOTAL_VIOLATIONS = 10000;

/** Default bulkhead queue timeout in milliseconds */
const DEFAULT_QUEUE_TIMEOUT_MS = 30000;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Token returned when a bulkhead slot is acquired.
 * Must be released when execution completes.
 */
export interface BulkheadToken {
  /** Unique token identifier */
  id: string;
  /** Tenant that acquired the slot */
  tenantId: ID;
  /** Handler using the slot */
  handlerName: string;
  /** When the slot was acquired (epoch ms) */
  acquiredAt: number;
}

/**
 * Status information for a bulkhead slot group.
 */
export interface BulkheadStatus {
  /** Number of active executions */
  active: number;
  /** Number of queued requests */
  queued: number;
  /** Maximum concurrent allowed */
  maxConcurrent: number;
  /** Maximum queued allowed */
  maxQueued: number;
  /** Total rejected requests */
  rejectedCount: number;
}

/**
 * Internal slot state for bulkhead management.
 */
interface BulkheadSlot {
  active: number;
  queued: number;
  maxConcurrent: number;
  maxQueued: number;
  waitQueue: Array<{
    resolve: (token: BulkheadToken) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
    tenantId: ID;
    handlerName: string;
  }>;
  rejectedCount: number;
}

// =============================================================================
// EXECUTION SANDBOX
// =============================================================================

/**
 * Provides execution isolation and security enforcement.
 * Wraps handler execution with resource limit checks, network policy
 * enforcement, and module access control.
 */
export class ExecutionSandbox {
  private config: SandboxConfig;
  private violations: SandboxViolation[];
  private violationsByExecution: Map<string, SandboxViolation[]>;

  constructor(config: SandboxConfig) {
    this.config = config;
    this.violations = [];
    this.violationsByExecution = new Map();

    logger.info(
      {
        enabled: config.enabled,
        isolationLevel: config.isolationLevel,
        allowedModules: config.allowedModules?.length ?? 'all',
        deniedModules: config.deniedModules?.length ?? 0,
      },
      'Execution sandbox initialized'
    );
  }

  /**
   * Wrap a handler execution with sandbox constraints.
   * Enforces timeout, monitors for violations, and ensures cleanup.
   *
   * @param executionId - Unique execution identifier
   * @param handler - The async handler function to execute
   * @param limits - Resource limits to enforce
   * @returns The handler's return value
   */
  async wrap<T>(executionId: ID, handler: () => Promise<T>, limits: ResourceLimits): Promise<T> {
    if (!this.config.enabled) {
      return handler();
    }

    logger.debug(
      { executionId, isolationLevel: this.config.isolationLevel },
      'Wrapping execution in sandbox'
    );

    const abortController = new AbortController();
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      // Set up timeout enforcement
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          const violation: SandboxViolation = {
            type: 'resource_limit',
            resource: 'executionTimeMs',
            limit: limits.timeoutMs,
            actual: limits.timeoutMs,
            timestamp: new Date().toISOString(),
            executionId,
          };
          this.recordViolation(violation);
          abortController.abort(new Error(`Execution timeout after ${limits.timeoutMs}ms`));
          reject(new Error(`Sandbox execution timeout after ${limits.timeoutMs}ms`));
        }, limits.timeoutMs);
      });

      // Race handler against timeout
      const result = await Promise.race([
        handler(),
        timeoutPromise,
      ]);

      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Sandbox execution timeout')) {
        logger.warn({ executionId, timeoutMs: limits.timeoutMs }, 'Sandbox execution timed out');
      }
      throw error;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Check if network access to a host is allowed by the configured policy.
   *
   * @param host - The hostname to check
   * @returns True if access is allowed, false otherwise
   */
  checkNetworkAccess(host: string): boolean {
    if (!this.config.networkPolicy) {
      return true;
    }

    const policy = this.config.networkPolicy;

    // If outbound is globally disabled
    if (!policy.allowOutbound) {
      logger.debug({ host }, 'Network access denied: outbound disabled');
      return false;
    }

    // Check denied hosts first (deny takes precedence)
    if (policy.deniedHosts && policy.deniedHosts.length > 0) {
      if (this.matchesHostList(host, policy.deniedHosts)) {
        logger.debug({ host }, 'Network access denied: host in deny list');
        return false;
      }
    }

    // If allowed hosts are specified, host must be in the list
    if (policy.allowedHosts && policy.allowedHosts.length > 0) {
      if (!this.matchesHostList(host, policy.allowedHosts)) {
        logger.debug({ host }, 'Network access denied: host not in allow list');
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a module is allowed to be accessed.
   *
   * @param moduleName - The module name to check
   * @returns True if the module can be loaded, false otherwise
   */
  checkModuleAccess(moduleName: string): boolean {
    // Check denied modules first
    if (this.config.deniedModules && this.config.deniedModules.length > 0) {
      if (this.matchesModuleList(moduleName, this.config.deniedModules)) {
        logger.debug({ moduleName }, 'Module access denied: module in deny list');
        return false;
      }
    }

    // If allowed modules are specified, module must be in the list
    if (this.config.allowedModules && this.config.allowedModules.length > 0) {
      if (!this.matchesModuleList(moduleName, this.config.allowedModules)) {
        logger.debug({ moduleName }, 'Module access denied: module not in allow list');
        return false;
      }
    }

    return true;
  }

  /**
   * Record a sandbox violation.
   * Stores the violation for the specific execution and globally.
   *
   * @param violation - The violation to record
   */
  recordViolation(violation: SandboxViolation): void {
    // Add to global violations (with cap)
    if (this.violations.length >= MAX_TOTAL_VIOLATIONS) {
      this.violations.shift();
    }
    this.violations.push(violation);

    // Add to per-execution violations (with cap)
    const execViolations = this.violationsByExecution.get(violation.executionId) ?? [];
    if (execViolations.length >= MAX_VIOLATIONS_PER_EXECUTION) {
      execViolations.shift();
    }
    execViolations.push(violation);
    this.violationsByExecution.set(violation.executionId, execViolations);

    logger.warn(
      {
        executionId: violation.executionId,
        type: violation.type,
        resource: violation.resource,
        limit: violation.limit,
        actual: violation.actual,
      },
      'Sandbox violation recorded'
    );
  }

  /**
   * Get recorded violations, optionally filtered by execution ID.
   *
   * @param executionId - Optional execution ID to filter by
   * @returns Array of matching violations
   */
  getViolations(executionId?: ID): SandboxViolation[] {
    if (executionId) {
      return [...(this.violationsByExecution.get(executionId) ?? [])];
    }
    return [...this.violations];
  }

  /**
   * Clear violations for a specific execution.
   *
   * @param executionId - The execution ID whose violations to clear
   */
  clearViolations(executionId: ID): void {
    this.violationsByExecution.delete(executionId);
    this.violations = this.violations.filter(v => v.executionId !== executionId);

    logger.debug({ executionId }, 'Violations cleared for execution');
  }

  /**
   * Get the current sandbox configuration.
   */
  getConfig(): SandboxConfig {
    return { ...this.config };
  }

  /**
   * Get the total number of recorded violations.
   */
  getViolationCount(): number {
    return this.violations.length;
  }

  /**
   * Check if a host matches any entry in a host list.
   * Supports wildcard patterns (e.g., "*.example.com").
   */
  private matchesHostList(host: string, hostList: string[]): boolean {
    const normalizedHost = host.toLowerCase().trim();

    for (const pattern of hostList) {
      const normalizedPattern = pattern.toLowerCase().trim();

      // Exact match
      if (normalizedHost === normalizedPattern) {
        return true;
      }

      // Wildcard match (e.g., "*.example.com" matches "api.example.com")
      if (normalizedPattern.startsWith('*.')) {
        const domain = normalizedPattern.slice(2);
        if (normalizedHost.endsWith(domain) && normalizedHost.length > domain.length) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a module matches any entry in a module list.
   * Supports prefix matching (e.g., "fs/" matches "fs/promises").
   */
  private matchesModuleList(moduleName: string, moduleList: string[]): boolean {
    for (const pattern of moduleList) {
      // Exact match
      if (moduleName === pattern) {
        return true;
      }

      // Prefix match with trailing slash
      if (pattern.endsWith('/') && moduleName.startsWith(pattern)) {
        return true;
      }

      // Subpath match
      if (moduleName.startsWith(pattern + '/')) {
        return true;
      }
    }

    return false;
  }
}

// =============================================================================
// BULKHEAD MANAGER
// =============================================================================

/**
 * Manages bulkhead isolation for concurrent execution control.
 * Implements the bulkhead pattern with semaphore-style slot management,
 * supporting global, per-tenant, and per-handler isolation.
 */
export class BulkheadManager {
  private global: BulkheadSlot;
  private perTenant: Map<string, BulkheadSlot>;
  private perHandler: Map<string, BulkheadSlot>;
  private config: BulkheadConfig;
  private activeTokens: Map<string, BulkheadToken>;

  constructor(config: BulkheadConfig) {
    this.config = config;
    this.perTenant = new Map();
    this.perHandler = new Map();
    this.activeTokens = new Map();

    this.global = this.createSlot(config.maxConcurrent, config.maxQueued);

    logger.info(
      {
        maxConcurrent: config.maxConcurrent,
        maxQueued: config.maxQueued,
        perTenant: config.perTenant ?? false,
        perHandler: config.perHandler ?? false,
      },
      'Bulkhead manager initialized'
    );
  }

  /**
   * Acquire an execution slot from the bulkhead.
   * Checks global, per-tenant, and per-handler limits.
   * If no slot is available, queues the request with a timeout.
   *
   * @param tenantId - The tenant requesting a slot
   * @param handlerName - The handler that will execute
   * @param timeoutMs - Optional queue timeout override
   * @returns A BulkheadToken that must be released when done
   */
  async acquire(tenantId: ID, handlerName: string, timeoutMs?: number): Promise<BulkheadToken> {
    const effectiveTimeout = timeoutMs ?? this.config.queueTimeoutMs ?? DEFAULT_QUEUE_TIMEOUT_MS;

    // Acquire from global slot (throws if capacity exceeded)
    await this.acquireFromSlot(
      this.global,
      tenantId,
      handlerName,
      effectiveTimeout,
      'global'
    );

    // Try per-tenant if configured
    if (this.config.perTenant) {
      const tenantSlot = this.getOrCreateTenantSlot(tenantId);
      try {
        await this.acquireFromSlot(tenantSlot, tenantId, handlerName, effectiveTimeout, 'tenant');
      } catch (error) {
        // Release global slot if tenant slot fails
        this.releaseFromSlot(this.global);
        throw error;
      }
    }

    // Try per-handler if configured
    if (this.config.perHandler) {
      const handlerSlot = this.getOrCreateHandlerSlot(handlerName);
      try {
        await this.acquireFromSlot(handlerSlot, tenantId, handlerName, effectiveTimeout, 'handler');
      } catch (error) {
        // Release previous slots
        this.releaseFromSlot(this.global);
        if (this.config.perTenant) {
          const tenantSlot = this.perTenant.get(tenantId);
          if (tenantSlot) {
            this.releaseFromSlot(tenantSlot);
          }
        }
        throw error;
      }
    }

    const token: BulkheadToken = {
      id: randomUUID(),
      tenantId,
      handlerName,
      acquiredAt: Date.now(),
    };

    this.activeTokens.set(token.id, token);

    logger.debug(
      { tokenId: token.id, tenantId, handlerName },
      'Bulkhead slot acquired'
    );

    return token;
  }

  /**
   * Release a previously acquired bulkhead slot.
   * Wakes up the next queued request if any.
   *
   * @param token - The token to release
   */
  release(token: BulkheadToken): void {
    if (!this.activeTokens.has(token.id)) {
      logger.warn({ tokenId: token.id }, 'Attempted to release unknown bulkhead token');
      return;
    }

    this.activeTokens.delete(token.id);

    // Release global slot
    this.releaseFromSlot(this.global);

    // Release per-tenant slot
    if (this.config.perTenant) {
      const tenantSlot = this.perTenant.get(token.tenantId);
      if (tenantSlot) {
        this.releaseFromSlot(tenantSlot);
      }
    }

    // Release per-handler slot
    if (this.config.perHandler) {
      const handlerSlot = this.perHandler.get(token.handlerName);
      if (handlerSlot) {
        this.releaseFromSlot(handlerSlot);
      }
    }

    logger.debug(
      { tokenId: token.id, tenantId: token.tenantId, handlerName: token.handlerName },
      'Bulkhead slot released'
    );
  }

  /**
   * Get the global bulkhead status.
   */
  getStatus(): BulkheadStatus {
    return this.slotToStatus(this.global);
  }

  /**
   * Get the bulkhead status for a specific tenant.
   *
   * @param tenantId - The tenant to query
   */
  getTenantStatus(tenantId: ID): BulkheadStatus {
    const slot = this.perTenant.get(tenantId);
    if (!slot) {
      return {
        active: 0,
        queued: 0,
        maxConcurrent: this.config.maxConcurrent,
        maxQueued: this.config.maxQueued,
        rejectedCount: 0,
      };
    }
    return this.slotToStatus(slot);
  }

  /**
   * Get the bulkhead status for a specific handler.
   *
   * @param handlerName - The handler to query
   */
  getHandlerStatus(handlerName: string): BulkheadStatus {
    const slot = this.perHandler.get(handlerName);
    if (!slot) {
      return {
        active: 0,
        queued: 0,
        maxConcurrent: this.config.maxConcurrent,
        maxQueued: this.config.maxQueued,
        rejectedCount: 0,
      };
    }
    return this.slotToStatus(slot);
  }

  /**
   * Check if an execution can proceed without queuing.
   *
   * @param tenantId - The tenant requesting execution
   * @param handlerName - The handler to be used
   * @returns True if a slot is immediately available
   */
  canExecute(tenantId: ID, handlerName: string): boolean {
    // Check global capacity
    if (this.global.active >= this.global.maxConcurrent) {
      return false;
    }

    // Check per-tenant capacity
    if (this.config.perTenant) {
      const tenantSlot = this.perTenant.get(tenantId);
      if (tenantSlot && tenantSlot.active >= tenantSlot.maxConcurrent) {
        return false;
      }
    }

    // Check per-handler capacity
    if (this.config.perHandler) {
      const handlerSlot = this.perHandler.get(handlerName);
      if (handlerSlot && handlerSlot.active >= handlerSlot.maxConcurrent) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the number of currently active tokens.
   */
  getActiveCount(): number {
    return this.activeTokens.size;
  }

  /**
   * Shutdown the bulkhead manager, rejecting all queued requests.
   */
  shutdown(): void {
    // Reject all queued requests in global slot
    this.drainQueue(this.global, 'Bulkhead manager shutting down');

    // Reject all per-tenant queued requests
    for (const slot of this.perTenant.values()) {
      this.drainQueue(slot, 'Bulkhead manager shutting down');
    }

    // Reject all per-handler queued requests
    for (const slot of this.perHandler.values()) {
      this.drainQueue(slot, 'Bulkhead manager shutting down');
    }

    this.activeTokens.clear();
    logger.info('Bulkhead manager shut down');
  }

  /**
   * Acquire a slot from a specific BulkheadSlot, queuing if necessary.
   */
  private async acquireFromSlot(
    slot: BulkheadSlot,
    tenantId: ID,
    handlerName: string,
    timeoutMs: number,
    scope: string
  ): Promise<BulkheadToken> {
    // If slot available, take it immediately
    if (slot.active < slot.maxConcurrent) {
      slot.active += 1;
      return { id: randomUUID(), tenantId, handlerName, acquiredAt: Date.now() };
    }

    // Check if queue is full
    if (slot.queued >= slot.maxQueued) {
      slot.rejectedCount += 1;
      logger.warn(
        { scope, tenantId, handlerName, active: slot.active, queued: slot.queued },
        'Bulkhead queue full, request rejected'
      );
      throw new Error(
        `Bulkhead ${scope} queue full: ${slot.queued}/${slot.maxQueued} queued, ` +
        `${slot.active}/${slot.maxConcurrent} active`
      );
    }

    // Queue the request with timeout
    return new Promise<BulkheadToken>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove from queue on timeout
        slot.waitQueue = slot.waitQueue.filter(entry => entry.timer !== timer);
        slot.queued -= 1;
        slot.rejectedCount += 1;
        reject(new Error(`Bulkhead ${scope} queue timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      slot.queued += 1;
      slot.waitQueue.push({ resolve, reject, timer, tenantId, handlerName });

      logger.debug(
        { scope, tenantId, handlerName, queuePosition: slot.queued },
        'Request queued in bulkhead'
      );
    });
  }

  /**
   * Release a slot from a specific BulkheadSlot and wake next queued request.
   */
  private releaseFromSlot(slot: BulkheadSlot): void {
    // Check if there's a queued request to wake up
    if (slot.waitQueue.length > 0) {
      const next = slot.waitQueue.shift()!;
      slot.queued -= 1;
      clearTimeout(next.timer);
      // Slot stays active (transferred to next request)
      const token: BulkheadToken = {
        id: randomUUID(),
        tenantId: next.tenantId,
        handlerName: next.handlerName,
        acquiredAt: Date.now(),
      };
      next.resolve(token);
    } else {
      slot.active = Math.max(0, slot.active - 1);
    }
  }

  /**
   * Create a new BulkheadSlot with the specified limits.
   */
  private createSlot(maxConcurrent: number, maxQueued: number): BulkheadSlot {
    return {
      active: 0,
      queued: 0,
      maxConcurrent,
      maxQueued,
      waitQueue: [],
      rejectedCount: 0,
    };
  }

  /**
   * Get or create a per-tenant bulkhead slot.
   */
  private getOrCreateTenantSlot(tenantId: ID): BulkheadSlot {
    let slot = this.perTenant.get(tenantId);
    if (!slot) {
      slot = this.createSlot(this.config.maxConcurrent, this.config.maxQueued);
      this.perTenant.set(tenantId, slot);
    }
    return slot;
  }

  /**
   * Get or create a per-handler bulkhead slot.
   */
  private getOrCreateHandlerSlot(handlerName: string): BulkheadSlot {
    let slot = this.perHandler.get(handlerName);
    if (!slot) {
      slot = this.createSlot(this.config.maxConcurrent, this.config.maxQueued);
      this.perHandler.set(handlerName, slot);
    }
    return slot;
  }

  /**
   * Convert a BulkheadSlot to a BulkheadStatus for external consumption.
   */
  private slotToStatus(slot: BulkheadSlot): BulkheadStatus {
    return {
      active: slot.active,
      queued: slot.queued,
      maxConcurrent: slot.maxConcurrent,
      maxQueued: slot.maxQueued,
      rejectedCount: slot.rejectedCount,
    };
  }

  /**
   * Drain all queued requests from a slot, rejecting them with the given reason.
   */
  private drainQueue(slot: BulkheadSlot, reason: string): void {
    for (const entry of slot.waitQueue) {
      clearTimeout(entry.timer);
      entry.reject(new Error(reason));
    }
    slot.waitQueue = [];
    slot.queued = 0;
  }
}
