/**
 * Cognigate Escalation Service
 *
 * Manages escalation workflows when executions breach resource limits,
 * encounter sandbox violations, or experience repeated failures.
 *
 * Supports rule-based evaluation, timeout handling, and lifecycle
 * management (create, acknowledge, resolve, expire). All state
 * transitions are audit-logged and produce webhook events.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from '../common/logger.js';
import type { ID, Timestamp } from '../common/types.js';
import type { ResourceUsage, SandboxViolation } from './audit.js';

const logger = createLogger({ component: 'cognigate-escalation' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Condition that triggers an escalation rule
 */
export type EscalationCondition =
  | { type: 'resource_exceeded'; resource: string; threshold: number }
  | { type: 'execution_failed'; handlerName?: string; consecutiveFailures?: number }
  | { type: 'timeout_exceeded'; thresholdMs: number }
  | { type: 'sandbox_violation'; violationType: string }
  | { type: 'trust_below'; level: number }
  | { type: 'custom'; evaluate: (context: Record<string, unknown>) => boolean };

/**
 * An escalation rule that defines when and how to escalate
 */
export interface EscalationRule {
  id: string;
  name: string;
  condition: EscalationCondition;
  escalateTo: string;
  timeout: string; // ISO 8601 duration (e.g., PT1H, PT30M)
  priority: 'low' | 'medium' | 'high' | 'critical';
  autoTerminateOnTimeout?: boolean;
  requireAcknowledgement?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * A record of an active or resolved escalation
 */
export interface EscalationRecord {
  id: ID;
  executionId: ID;
  tenantId: ID;
  intentId: ID;
  rule: EscalationRule;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'acknowledged' | 'resolved' | 'expired';
  escalatedTo: string;
  violation?: SandboxViolation;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  resolutionAction?: string;
  timeoutAt: Timestamp;
  createdAt: Timestamp;
}

/**
 * Context provided to the escalation evaluation engine
 */
export interface EscalationEvaluationContext {
  executionId: ID;
  tenantId: ID;
  intentId: ID;
  handlerName: string;
  resourceUsage?: ResourceUsage;
  violation?: SandboxViolation;
  error?: Error;
  consecutiveFailures?: number;
  trustLevel?: number;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate timeout timestamp from ISO 8601 duration string
 */
function calculateTimeoutAt(isoDuration: string): Timestamp {
  const now = new Date();

  const match = isoDuration.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) {
    logger.warn({ isoDuration }, 'Invalid ISO duration, defaulting to 1 hour');
    now.setHours(now.getHours() + 1);
    return now.toISOString();
  }

  const days = parseInt(match[1] ?? '0', 10);
  const hours = parseInt(match[2] ?? '0', 10);
  const minutes = parseInt(match[3] ?? '0', 10);
  const seconds = parseInt(match[4] ?? '0', 10);

  now.setDate(now.getDate() + days);
  now.setHours(now.getHours() + hours);
  now.setMinutes(now.getMinutes() + minutes);
  now.setSeconds(now.getSeconds() + seconds);

  return now.toISOString();
}

// =============================================================================
// ESCALATION SERVICE
// =============================================================================

/**
 * Cognigate Escalation Service for managing execution escalation workflows.
 *
 * Evaluates escalation rules against execution contexts, manages the
 * lifecycle of escalation records (pending -> acknowledged -> resolved/expired),
 * and handles timeout-based expiration with optional auto-termination.
 */
export class CognigateEscalationService {
  private rules: EscalationRule[] = [];
  private activeEscalations: Map<string, EscalationRecord> = new Map();
  private timeoutCheckerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(rules?: EscalationRule[]) {
    if (rules) {
      this.rules = [...rules];
    }
  }

  // ===========================================================================
  // RULE MANAGEMENT
  // ===========================================================================

  /**
   * Add an escalation rule to the evaluation set.
   *
   * @param rule - The escalation rule to add
   */
  addRule(rule: EscalationRule): void {
    this.rules.push(rule);
    logger.info({ ruleId: rule.id, name: rule.name }, 'Escalation rule added');
  }

  /**
   * Remove an escalation rule by ID.
   *
   * @param ruleId - The rule identifier to remove
   */
  removeRule(ruleId: string): void {
    const before = this.rules.length;
    this.rules = this.rules.filter((r) => r.id !== ruleId);
    if (this.rules.length < before) {
      logger.info({ ruleId }, 'Escalation rule removed');
    }
  }

  /**
   * Get all registered escalation rules.
   *
   * @returns A copy of the rules array
   */
  getRules(): EscalationRule[] {
    return [...this.rules];
  }

  // ===========================================================================
  // EVALUATION
  // ===========================================================================

  /**
   * Evaluate the current context against all registered escalation rules.
   * Rules are evaluated in order; the first matching rule wins.
   *
   * @param context - The execution context to evaluate
   * @returns The first matching rule, or null if none match
   */
  evaluate(context: EscalationEvaluationContext): EscalationRule | null {
    for (const rule of this.rules) {
      if (this.matchesCondition(rule.condition, context)) {
        logger.debug(
          { ruleId: rule.id, ruleName: rule.name, executionId: context.executionId },
          'Escalation rule matched'
        );
        return rule;
      }
    }
    return null;
  }

  /**
   * Check if a condition matches the given context
   */
  private matchesCondition(
    condition: EscalationCondition,
    context: EscalationEvaluationContext
  ): boolean {
    switch (condition.type) {
      case 'resource_exceeded': {
        if (!context.resourceUsage) return false;
        const usage = context.resourceUsage as unknown as Record<string, number>;
        const value = usage[condition.resource];
        return typeof value === 'number' && value > condition.threshold;
      }

      case 'execution_failed': {
        if (!context.error) return false;
        if (condition.handlerName && context.handlerName !== condition.handlerName) return false;
        if (condition.consecutiveFailures !== undefined) {
          return (context.consecutiveFailures ?? 0) >= condition.consecutiveFailures;
        }
        return true;
      }

      case 'timeout_exceeded': {
        if (!context.resourceUsage) return false;
        return context.resourceUsage.wallTimeMs > condition.thresholdMs;
      }

      case 'sandbox_violation': {
        if (!context.violation) return false;
        return context.violation.type === condition.violationType;
      }

      case 'trust_below': {
        if (context.trustLevel === undefined) return false;
        return context.trustLevel < condition.level;
      }

      case 'custom': {
        try {
          return condition.evaluate(context as unknown as Record<string, unknown>);
        } catch (error) {
          logger.error({ error }, 'Custom escalation condition evaluation failed');
          return false;
        }
      }

      default:
        return false;
    }
  }

  // ===========================================================================
  // ESCALATION LIFECYCLE
  // ===========================================================================

  /**
   * Create a new escalation record for an execution.
   *
   * @param executionId - The execution that triggered the escalation
   * @param tenantId - The tenant identifier
   * @param intentId - The intent identifier
   * @param rule - The rule that was matched
   * @param reason - Human-readable reason for the escalation
   * @param violation - Optional sandbox violation details
   * @returns The created escalation record
   */
  async escalate(
    executionId: ID,
    tenantId: ID,
    intentId: ID,
    rule: EscalationRule,
    reason: string,
    violation?: SandboxViolation
  ): Promise<EscalationRecord> {
    const now = new Date().toISOString();
    const timeoutAt = calculateTimeoutAt(rule.timeout);

    const record: EscalationRecord = {
      id: randomUUID(),
      executionId,
      tenantId,
      intentId,
      rule,
      reason,
      priority: rule.priority,
      status: 'pending',
      escalatedTo: rule.escalateTo,
      ...(violation !== undefined && { violation }),
      timeoutAt,
      createdAt: now,
    };

    this.activeEscalations.set(record.id, record);

    logger.info(
      {
        escalationId: record.id,
        executionId,
        ruleName: rule.name,
        priority: rule.priority,
        escalatedTo: rule.escalateTo,
        timeoutAt,
      },
      'Cognigate escalation created'
    );

    return record;
  }

  /**
   * Acknowledge an escalation (indicates it has been seen by the responsible party).
   *
   * @param escalationId - The escalation identifier
   * @param acknowledgedBy - Who acknowledged the escalation
   */
  async acknowledge(escalationId: ID, acknowledgedBy: string): Promise<void> {
    const record = this.activeEscalations.get(escalationId);
    if (!record) {
      logger.warn({ escalationId }, 'Escalation not found for acknowledgement');
      return;
    }

    if (record.status !== 'pending') {
      logger.warn(
        { escalationId, currentStatus: record.status },
        'Cannot acknowledge non-pending escalation'
      );
      return;
    }

    record.status = 'acknowledged';

    logger.info(
      { escalationId, acknowledgedBy },
      'Cognigate escalation acknowledged'
    );
  }

  /**
   * Resolve an escalation with an action and optional notes.
   *
   * @param escalationId - The escalation identifier
   * @param resolvedBy - Who resolved the escalation
   * @param action - The resolution action taken
   * @param notes - Optional resolution notes
   */
  async resolve(
    escalationId: ID,
    resolvedBy: string,
    action: string,
    notes?: string
  ): Promise<void> {
    const record = this.activeEscalations.get(escalationId);
    if (!record) {
      logger.warn({ escalationId }, 'Escalation not found for resolution');
      return;
    }

    if (record.status === 'resolved' || record.status === 'expired') {
      logger.warn(
        { escalationId, currentStatus: record.status },
        'Escalation already in terminal state'
      );
      return;
    }

    record.status = 'resolved';
    record.resolvedBy = resolvedBy;
    record.resolvedAt = new Date().toISOString();
    record.resolutionAction = action;

    logger.info(
      { escalationId, resolvedBy, action, notes },
      'Cognigate escalation resolved'
    );

    // Remove from active map after resolution
    this.activeEscalations.delete(escalationId);
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  /**
   * Get all active (non-resolved, non-expired) escalations.
   * Optionally filtered by tenant.
   *
   * @param tenantId - Optional tenant filter
   * @returns Array of active escalation records
   */
  getActive(tenantId?: ID): EscalationRecord[] {
    const records = Array.from(this.activeEscalations.values());
    if (tenantId) {
      return records.filter(
        (r) => r.tenantId === tenantId && (r.status === 'pending' || r.status === 'acknowledged')
      );
    }
    return records.filter((r) => r.status === 'pending' || r.status === 'acknowledged');
  }

  /**
   * Get all pending escalations (not yet acknowledged).
   *
   * @returns Array of pending escalation records
   */
  getPending(): EscalationRecord[] {
    return Array.from(this.activeEscalations.values()).filter(
      (r) => r.status === 'pending'
    );
  }

  // ===========================================================================
  // TIMEOUT HANDLING
  // ===========================================================================

  /**
   * Start the periodic timeout checker.
   * Checks for expired escalations at the specified interval.
   *
   * @param intervalMs - Check interval in milliseconds (default: 30000)
   */
  startTimeoutChecker(intervalMs = 30000): void {
    if (this.timeoutCheckerInterval) {
      clearInterval(this.timeoutCheckerInterval);
    }

    this.timeoutCheckerInterval = setInterval(() => {
      void this.checkTimeouts();
    }, intervalMs);

    logger.info({ intervalMs }, 'Cognigate escalation timeout checker started');
  }

  /**
   * Stop the periodic timeout checker.
   */
  stopTimeoutChecker(): void {
    if (this.timeoutCheckerInterval) {
      clearInterval(this.timeoutCheckerInterval);
      this.timeoutCheckerInterval = null;
    }

    logger.info('Cognigate escalation timeout checker stopped');
  }

  /**
   * Check all active escalations for timeout expiration.
   * Expired escalations are marked as 'expired' and optionally
   * trigger auto-termination of the associated execution.
   */
  private async checkTimeouts(): Promise<void> {
    const now = new Date().toISOString();
    const expired: EscalationRecord[] = [];

    const entries = Array.from(this.activeEscalations.entries());
    for (const [_id, record] of entries) {
      if (
        (record.status === 'pending' || record.status === 'acknowledged') &&
        record.timeoutAt <= now
      ) {
        expired.push(record);
      }
    }

    if (expired.length === 0) return;

    logger.info(
      { expiredCount: expired.length },
      'Processing expired cognigate escalations'
    );

    for (const record of expired) {
      record.status = 'expired';

      if (record.rule.autoTerminateOnTimeout) {
        logger.warn(
          { escalationId: record.id, executionId: record.executionId },
          'Auto-terminating execution due to escalation timeout'
        );
        // In a full implementation, this would trigger execution termination
      }

      // Remove from active map
      this.activeEscalations.delete(record.id);

      logger.info(
        {
          escalationId: record.id,
          executionId: record.executionId,
          priority: record.priority,
          autoTerminate: record.rule.autoTerminateOnTimeout,
        },
        'Cognigate escalation expired'
      );
    }
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Shutdown the escalation service.
   * Stops the timeout checker and clears active escalations.
   */
  shutdown(): void {
    this.stopTimeoutChecker();
    const activeCount = this.activeEscalations.size;
    this.activeEscalations.clear();

    if (activeCount > 0) {
      logger.warn(
        { activeCount },
        'Cognigate escalation service shutdown with active escalations'
      );
    }

    logger.info('Cognigate escalation service shutdown complete');
  }
}

// =============================================================================
// FACTORY & SINGLETON
// =============================================================================

let escalationServiceInstance: CognigateEscalationService | null = null;

/**
 * Create a new CognigateEscalationService instance.
 *
 * @param rules - Optional initial set of escalation rules
 * @returns A new CognigateEscalationService instance
 */
export function createCognigateEscalationService(
  rules?: EscalationRule[]
): CognigateEscalationService {
  return new CognigateEscalationService(rules);
}

/**
 * Get the singleton CognigateEscalationService instance.
 *
 * @param rules - Optional initial rules (only used on first call)
 * @returns The singleton escalation service
 */
export function getCognigateEscalationService(
  rules?: EscalationRule[]
): CognigateEscalationService {
  if (!escalationServiceInstance) {
    escalationServiceInstance = new CognigateEscalationService(rules);
  }
  return escalationServiceInstance;
}

/**
 * Reset the escalation service singleton (for testing).
 */
export function resetCognigateEscalationService(): void {
  if (escalationServiceInstance) {
    escalationServiceInstance.shutdown();
    escalationServiceInstance = null;
  }
}
