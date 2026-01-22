/**
 * Enforcement Audit Trail Module
 *
 * SOC2 compliant audit logging for enforcement decisions.
 * Tracks all enforcement decisions, escalations, and decision history
 * for compliance reporting and debugging.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { createLogger } from '../common/logger.js';
import { getDatabase } from '../common/db.js';
import {
  withCircuitBreakerResult,
  CircuitBreakerOpenError,
} from '../common/circuit-breaker.js';
import { auditRecords } from '../intent/schema.js';
import type { ID, Timestamp, ControlAction } from '../common/types.js';
import type {
  EnforcementDecision,
  EnforcementContext,
  EnforcementAuditEntry,
  EscalationRule,
  AuditSeverity,
  AuditOutcome,
} from './types.js';

// Re-export CircuitBreakerOpenError for consumers
export { CircuitBreakerOpenError };

const logger = createLogger({ component: 'enforcement-audit' });

// =============================================================================
// AUDIT EVENT TYPES
// =============================================================================

export type EnforcementAuditEventType =
  | 'enforcement.decision.made'
  | 'enforcement.decision.cached'
  | 'enforcement.escalation.triggered'
  | 'enforcement.escalation.resolved'
  | 'enforcement.constraint.evaluated'
  | 'enforcement.policy.applied';

// =============================================================================
// AUDIT QUERY FILTERS
// =============================================================================

/**
 * Filters for querying enforcement audit logs
 */
export interface AuditQueryFilters {
  /** Required tenant identifier */
  tenantId: ID;
  /** Filter by intent ID */
  intentId?: ID;
  /** Filter by control action */
  action?: ControlAction;
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
 * Configuration options for the EnforcementAuditService
 */
export interface EnforcementAuditServiceOptions {
  /** Maximum entries to buffer before flushing (default: 100) */
  batchSize?: number;
  /** Interval in milliseconds between automatic flushes (default: 1000) */
  flushIntervalMs?: number;
  /** Whether audit logging is enabled (default: true) */
  enabled?: boolean;
}

// =============================================================================
// ENFORCEMENT AUDIT SERVICE
// =============================================================================

/**
 * Service for recording and querying enforcement audit entries.
 *
 * Uses an in-memory buffer with periodic flushing to minimize
 * impact on the critical enforcement decision path.
 */
export class EnforcementAuditService {
  private buffer: EnforcementAuditEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly enabled: boolean;

  constructor(options: EnforcementAuditServiceOptions = {}) {
    this.batchSize = options.batchSize ?? 100;
    this.flushIntervalMs = options.flushIntervalMs ?? 1000;
    this.enabled = options.enabled ?? true;

    if (this.enabled) {
      this.scheduleFlush();
    }
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Record an enforcement decision asynchronously.
   * Uses setImmediate to avoid blocking the request path.
   *
   * @param decision - The enforcement decision to audit
   * @param context - The context in which the decision was made
   */
  recordDecision(decision: EnforcementDecision, context: EnforcementContext): void {
    if (!this.enabled) {
      return;
    }

    setImmediate(() => {
      try {
        const entry = this.createAuditEntry(
          decision,
          context,
          decision.cached ? 'enforcement.decision.cached' : 'enforcement.decision.made'
        );
        this.buffer.push(entry);

        // Flush if buffer is getting large
        if (this.buffer.length >= this.batchSize) {
          this.flush().catch((err: unknown) => {
            logger.error({ error: err }, 'Background enforcement audit flush failed');
          });
        }
      } catch (error) {
        // Log but don't throw - audit logging should never fail requests
        logger.error({ error, decisionId: decision.id }, 'Failed to record enforcement decision');
      }
    });
  }

  /**
   * Record an escalation event asynchronously.
   *
   * @param decision - The enforcement decision that triggered escalation
   * @param rule - The escalation rule that was triggered
   */
  recordEscalation(decision: EnforcementDecision, rule: EscalationRule): void {
    if (!this.enabled) {
      return;
    }

    setImmediate(() => {
      try {
        const entry = this.createEscalationAuditEntry(decision, rule);
        this.buffer.push(entry);

        // Flush if buffer is getting large
        if (this.buffer.length >= this.batchSize) {
          this.flush().catch((err: unknown) => {
            logger.error({ error: err }, 'Background enforcement escalation audit flush failed');
          });
        }
      } catch (error) {
        logger.error(
          { error, decisionId: decision.id, ruleId: rule.id },
          'Failed to record escalation event'
        );
      }
    });
  }

  /**
   * Flush all buffered entries to the database.
   * Protected by circuit breaker to prevent cascading failures.
   */
  async flush(): Promise<void> {
    if (this.processing || this.buffer.length === 0) {
      return;
    }

    this.processing = true;
    const batch = this.buffer.splice(0, this.batchSize);

    try {
      await this.persistBatch(batch);
    } catch (error) {
      // Re-queue failed entries for retry (with limit to prevent memory issues)
      if (this.buffer.length < 10000) {
        this.buffer.unshift(...batch);
      } else {
        logger.warn({ dropped: batch.length }, 'Dropping audit entries due to queue overflow');
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Query enforcement audit logs with filters.
   *
   * @param filters - Query filters
   * @returns Matching audit entries
   */
  async query(filters: AuditQueryFilters): Promise<EnforcementAuditEntry[]> {
    const db = getDatabase();
    const limit = Math.min(filters.limit ?? 50, 1000);
    const offset = filters.offset ?? 0;

    const conditions = [
      eq(auditRecords.tenantId, filters.tenantId),
      eq(auditRecords.eventCategory, 'enforcement'),
    ];

    if (filters.intentId) {
      conditions.push(eq(auditRecords.targetId, filters.intentId));
    }

    if (filters.action) {
      conditions.push(eq(auditRecords.action, filters.action));
    }

    if (filters.from) {
      conditions.push(gte(auditRecords.eventTime, new Date(filters.from)));
    }

    if (filters.to) {
      conditions.push(lte(auditRecords.eventTime, new Date(filters.to)));
    }

    const rows = await db
      .select()
      .from(auditRecords)
      .where(and(...conditions))
      .orderBy(desc(auditRecords.eventTime))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => this.rowToAuditEntry(row));
  }

  /**
   * Get the decision history for a specific intent.
   *
   * @param intentId - The intent identifier
   * @param tenantId - The tenant identifier
   * @returns Decision history entries
   */
  async getDecisionHistory(intentId: ID, tenantId: ID): Promise<EnforcementAuditEntry[]> {
    return this.query({
      tenantId,
      intentId,
      limit: 100,
    });
  }

  /**
   * Gracefully shutdown the audit service.
   * Flushes any pending entries before returning.
   */
  async shutdown(): Promise<void> {
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
          'Flush failed during enforcement audit shutdown'
        );
      }
      attempts++;
    }

    if (this.buffer.length > 0) {
      logger.error(
        { remaining: this.buffer.length },
        'Enforcement audit shutdown completed with unflushed entries'
      );
    }

    logger.info('Enforcement audit service shutdown complete');
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Create an audit entry from a decision and context.
   */
  private createAuditEntry(
    decision: EnforcementDecision,
    context: EnforcementContext,
    eventType: EnforcementAuditEventType
  ): EnforcementAuditEntry {
    const now = new Date().toISOString();

    // Determine severity based on action
    let severity: AuditSeverity = 'info';
    if (decision.action === 'deny' || decision.action === 'terminate') {
      severity = 'warning';
    } else if (decision.action === 'escalate') {
      severity = 'warning';
    }

    // Determine outcome
    const outcome: AuditOutcome = decision.action === 'allow' ? 'success' : 'partial';

    const entry: EnforcementAuditEntry = {
      id: randomUUID(),
      tenantId: decision.tenantId,
      decisionId: decision.id,
      intentId: decision.intentId,
      entityId: context.entity.id,
      entityType: context.entity.type,
      action: decision.action,
      outcome,
      severity,
      reason: decision.reason,
      policiesEvaluated: decision.policiesEvaluated.map((p) => p.policyId),
      constraintsEvaluated: decision.constraints.map((c) => c.constraintId),
      trustScore: decision.trustScore,
      trustLevel: decision.trustLevel,
      durationMs: decision.durationMs,
      cached: decision.cached,
      requestId: context.environment.requestId,
      metadata: {
        eventType,
        confidence: decision.confidence,
        policiesCount: decision.policiesEvaluated.length,
        constraintsCount: decision.constraints.length,
      },
      eventTime: decision.decidedAt,
      recordedAt: now,
    };

    if (decision.appliedPolicy?.policyId) {
      entry.appliedPolicyId = decision.appliedPolicy.policyId;
    }

    if (context.environment.clientIp) {
      entry.clientIp = context.environment.clientIp;
    }

    if (context.environment.userAgent) {
      entry.userAgent = context.environment.userAgent;
    }

    if (decision.traceId) {
      entry.traceId = decision.traceId;
    }

    if (decision.spanId) {
      entry.spanId = decision.spanId;
    }

    return entry;
  }

  /**
   * Create an audit entry for an escalation event.
   */
  private createEscalationAuditEntry(
    decision: EnforcementDecision,
    rule: EscalationRule
  ): EnforcementAuditEntry {
    const now = new Date().toISOString();

    const entry: EnforcementAuditEntry = {
      id: randomUUID(),
      tenantId: decision.tenantId,
      decisionId: decision.id,
      intentId: decision.intentId,
      entityId: '', // Will be filled from context if available
      entityType: 'system',
      action: 'escalate',
      outcome: 'partial',
      severity: 'warning',
      reason: `Escalation triggered by rule: ${rule.name ?? rule.id ?? 'unknown'}`,
      policiesEvaluated: decision.policiesEvaluated.map((p) => p.policyId),
      constraintsEvaluated: decision.constraints.map((c) => c.constraintId),
      trustScore: decision.trustScore,
      trustLevel: decision.trustLevel,
      durationMs: decision.durationMs,
      cached: false,
      requestId: decision.traceId ?? randomUUID(),
      metadata: {
        eventType: 'enforcement.escalation.triggered' as EnforcementAuditEventType,
        escalationRule: {
          id: rule.id,
          name: rule.name,
          escalateTo: rule.escalateTo,
          timeout: rule.timeout,
          priority: rule.priority,
        },
      },
      eventTime: decision.decidedAt,
      recordedAt: now,
    };

    if (decision.appliedPolicy?.policyId) {
      entry.appliedPolicyId = decision.appliedPolicy.policyId;
    }

    if (decision.traceId) {
      entry.traceId = decision.traceId;
    }

    if (decision.spanId) {
      entry.spanId = decision.spanId;
    }

    return entry;
  }

  /**
   * Persist a batch of audit entries to the database.
   * Uses circuit breaker to prevent cascading failures.
   */
  private async persistBatch(entries: EnforcementAuditEntry[]): Promise<void> {
    const result = await withCircuitBreakerResult('enforcementAuditService', async () => {
      const db = getDatabase();

      const values = entries.map((entry) => ({
        id: entry.id,
        tenantId: entry.tenantId,
        eventType: (entry.metadata?.eventType as string) ?? 'enforcement.decision.made',
        eventCategory: 'enforcement',
        severity: entry.severity,
        actorType: entry.entityType,
        actorId: entry.entityId || 'system',
        actorName: null,
        actorIp: entry.clientIp ?? null,
        targetType: 'intent',
        targetId: entry.intentId,
        targetName: null,
        requestId: entry.requestId,
        traceId: entry.traceId ?? null,
        spanId: entry.spanId ?? null,
        action: entry.action,
        outcome: entry.outcome,
        reason: entry.reason,
        beforeState: null,
        afterState: null,
        diffState: null,
        metadata: {
          decisionId: entry.decisionId,
          policiesEvaluated: entry.policiesEvaluated,
          appliedPolicyId: entry.appliedPolicyId,
          constraintsEvaluated: entry.constraintsEvaluated,
          trustScore: entry.trustScore,
          trustLevel: entry.trustLevel,
          durationMs: entry.durationMs,
          cached: entry.cached,
          userAgent: entry.userAgent,
          ...entry.metadata,
        },
        tags: ['enforcement'],
        sequenceNumber: Date.now(), // Use timestamp as sequence for simplicity
        previousHash: null,
        recordHash: randomUUID(), // Simplified hash for audit entries
        eventTime: new Date(entry.eventTime),
        recordedAt: new Date(entry.recordedAt),
        archived: false,
        archivedAt: null,
      }));

      await db.insert(auditRecords).values(values);
      return entries.length;
    });

    if (result.success) {
      logger.debug({ count: entries.length }, 'Enforcement audit entries flushed to database');
    } else if (result.circuitOpen) {
      logger.warn(
        { count: entries.length },
        'Audit circuit breaker is open, re-queuing entries for retry'
      );
      throw new Error('Circuit breaker open');
    } else {
      logger.error(
        { error: result.error, count: entries.length },
        'Failed to flush enforcement audit entries'
      );
      throw result.error;
    }
  }

  /**
   * Schedule periodic flush of the buffer.
   */
  private scheduleFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * Convert a database row to an EnforcementAuditEntry.
   */
  private rowToAuditEntry(row: typeof auditRecords.$inferSelect): EnforcementAuditEntry {
    const metadata = row.metadata as Record<string, unknown> | null;

    const entry: EnforcementAuditEntry = {
      id: row.id,
      tenantId: row.tenantId,
      decisionId: (metadata?.decisionId as string) ?? row.id,
      intentId: row.targetId,
      entityId: row.actorId,
      entityType: row.actorType as EnforcementAuditEntry['entityType'],
      action: row.action as ControlAction,
      outcome: row.outcome as AuditOutcome,
      severity: row.severity as AuditSeverity,
      reason: row.reason ?? '',
      policiesEvaluated: (metadata?.policiesEvaluated as string[]) ?? [],
      constraintsEvaluated: (metadata?.constraintsEvaluated as string[]) ?? [],
      trustScore: (metadata?.trustScore as number) ?? 0,
      trustLevel: (metadata?.trustLevel as EnforcementAuditEntry['trustLevel']) ?? 0,
      durationMs: (metadata?.durationMs as number) ?? 0,
      cached: (metadata?.cached as boolean) ?? false,
      requestId: row.requestId,
      eventTime: row.eventTime.toISOString(),
      recordedAt: row.recordedAt.toISOString(),
    };

    if (metadata?.appliedPolicyId) {
      entry.appliedPolicyId = metadata.appliedPolicyId as string;
    }

    if (row.actorIp) {
      entry.clientIp = row.actorIp;
    }

    if (metadata?.userAgent) {
      entry.userAgent = metadata.userAgent as string;
    }

    if (row.traceId) {
      entry.traceId = row.traceId;
    }

    if (row.spanId) {
      entry.spanId = row.spanId;
    }

    if (metadata) {
      entry.metadata = metadata;
    }

    return entry;
  }
}

// =============================================================================
// SINGLETON MANAGEMENT
// =============================================================================

let auditServiceInstance: EnforcementAuditService | null = null;

/**
 * Create a new EnforcementAuditService instance.
 *
 * @param options - Service configuration options
 * @returns A new EnforcementAuditService instance
 */
export function createEnforcementAuditService(
  options?: EnforcementAuditServiceOptions
): EnforcementAuditService {
  return new EnforcementAuditService(options);
}

/**
 * Get the singleton EnforcementAuditService instance.
 * Creates a new instance with default options if none exists.
 *
 * @returns The singleton EnforcementAuditService instance
 */
export function getEnforcementAuditService(): EnforcementAuditService {
  if (!auditServiceInstance) {
    auditServiceInstance = new EnforcementAuditService();
  }
  return auditServiceInstance;
}

/**
 * Reset the singleton EnforcementAuditService instance.
 * Primarily used for testing to ensure a clean state between tests.
 */
export function resetEnforcementAuditService(): void {
  if (auditServiceInstance) {
    // Don't await - this is a sync function for testing
    void auditServiceInstance.shutdown();
    auditServiceInstance = null;
  }
}
