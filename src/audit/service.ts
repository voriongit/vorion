/**
 * Audit Service
 *
 * Records and queries audit events with chain integrity.
 *
 * @packageDocumentation
 */

import { eq, and, desc, asc, gte, lte, lt, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { createLogger } from '../common/logger.js';
import { getDatabase } from '../common/db.js';
import { getTraceContext } from '../common/trace.js';
import { auditRecords } from '../intent/schema.js';
import type { ID } from '../common/types.js';
import type {
  AuditRecord,
  CreateAuditRecordInput,
  AuditQueryFilters,
  AuditQueryResult,
  AuditSeverity,
  AuditCategory,
  ChainIntegrityResult,
  AuditArchiveResult,
  AuditPurgeResult,
  AuditCleanupResult,
} from './types.js';
import { AUDIT_EVENT_TYPES as eventTypes } from './types.js';

const logger = createLogger({ component: 'audit-service' });

/**
 * Generate a unique request ID if not provided
 */
function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Compute hash for an audit record
 */
function computeRecordHash(
  record: Omit<CreateAuditRecordInput, 'requestId'> & {
    requestId: ID;
    sequenceNumber: number;
    previousHash: string | null;
    eventTime: string;
  }
): string {
  const payload = {
    tenantId: record.tenantId,
    eventType: record.eventType,
    actor: record.actor,
    target: record.target,
    action: record.action,
    outcome: record.outcome,
    sequenceNumber: record.sequenceNumber,
    previousHash: record.previousHash,
    eventTime: record.eventTime,
  };

  return createHash('sha256')
    .update(JSON.stringify(payload, Object.keys(payload).sort()))
    .digest('hex');
}

/**
 * Get event metadata (category and severity) for an event type
 */
function getEventMetadata(
  eventType: string
): { category: AuditCategory; severity: AuditSeverity } {
  const metadata = (eventTypes as Record<string, { category: AuditCategory; severity: AuditSeverity }>)[eventType];

  if (metadata) {
    return metadata;
  }

  // Default for unknown event types
  return { category: 'system', severity: 'info' };
}

/**
 * Audit Service class
 */
export class AuditService {
  /**
   * Record an audit event
   */
  async record(input: CreateAuditRecordInput): Promise<AuditRecord> {
    const db = getDatabase();

    // Get trace context if available
    const traceContext = getTraceContext();

    // Determine event metadata
    const { category, severity } = getEventMetadata(input.eventType);

    // Generate or use provided IDs
    const requestId = input.requestId ?? traceContext?.traceId ?? generateRequestId();
    const eventTime = input.eventTime ?? new Date().toISOString();

    // Get the latest record for this tenant to build the chain
    const [latestRecord] = await db
      .select({
        sequenceNumber: auditRecords.sequenceNumber,
        recordHash: auditRecords.recordHash,
      })
      .from(auditRecords)
      .where(eq(auditRecords.tenantId, input.tenantId))
      .orderBy(desc(auditRecords.sequenceNumber))
      .limit(1);

    const sequenceNumber = Number(latestRecord?.sequenceNumber ?? 0) + 1;
    const previousHash = latestRecord?.recordHash ?? null;

    // Compute the record hash
    const recordHash = computeRecordHash({
      ...input,
      requestId,
      sequenceNumber,
      previousHash,
      eventTime,
    });

    // Insert the record
    const [row] = await db
      .insert(auditRecords)
      .values({
        tenantId: input.tenantId,
        eventType: input.eventType,
        eventCategory: category,
        severity,
        actorType: input.actor.type,
        actorId: input.actor.id,
        actorName: input.actor.name,
        actorIp: input.actor.ip,
        targetType: input.target.type,
        targetId: input.target.id,
        targetName: input.target.name,
        requestId,
        traceId: input.traceId ?? traceContext?.traceId,
        spanId: input.spanId ?? traceContext?.spanId,
        action: input.action,
        outcome: input.outcome,
        reason: input.reason,
        beforeState: input.stateChange?.before,
        afterState: input.stateChange?.after,
        diffState: input.stateChange?.diff,
        metadata: input.metadata,
        tags: input.tags,
        sequenceNumber,
        previousHash,
        recordHash,
        eventTime: new Date(eventTime),
      })
      .returning();

    logger.info(
      {
        auditId: row.id,
        eventType: input.eventType,
        tenantId: input.tenantId,
        actorId: input.actor.id,
        targetId: input.target.id,
        sequenceNumber,
      },
      'Audit event recorded'
    );

    return this.rowToAuditRecord(row);
  }

  /**
   * Query audit records with filters
   */
  async query(filters: AuditQueryFilters): Promise<AuditQueryResult> {
    const db = getDatabase();

    const conditions = [eq(auditRecords.tenantId, filters.tenantId)];

    if (filters.eventType) {
      conditions.push(eq(auditRecords.eventType, filters.eventType));
    }
    if (filters.eventCategory) {
      conditions.push(eq(auditRecords.eventCategory, filters.eventCategory));
    }
    if (filters.severity) {
      conditions.push(eq(auditRecords.severity, filters.severity));
    }
    if (filters.actorId) {
      conditions.push(eq(auditRecords.actorId, filters.actorId));
    }
    if (filters.actorType) {
      conditions.push(eq(auditRecords.actorType, filters.actorType));
    }
    if (filters.targetId) {
      conditions.push(eq(auditRecords.targetId, filters.targetId));
    }
    if (filters.targetType) {
      conditions.push(eq(auditRecords.targetType, filters.targetType));
    }
    if (filters.outcome) {
      conditions.push(eq(auditRecords.outcome, filters.outcome));
    }
    if (filters.requestId) {
      conditions.push(eq(auditRecords.requestId, filters.requestId));
    }
    if (filters.traceId) {
      conditions.push(eq(auditRecords.traceId, filters.traceId));
    }
    if (filters.startTime) {
      conditions.push(gte(auditRecords.eventTime, new Date(filters.startTime)));
    }
    if (filters.endTime) {
      conditions.push(lte(auditRecords.eventTime, new Date(filters.endTime)));
    }
    if (filters.tags && filters.tags.length > 0) {
      // Check if any of the provided tags are in the record's tags array
      conditions.push(sql`${auditRecords.tags} && ${filters.tags}`);
    }

    const limit = Math.min(filters.limit ?? 50, 1000);
    const offset = filters.offset ?? 0;
    const orderBy = filters.orderBy === 'recordedAt' ? auditRecords.recordedAt : auditRecords.eventTime;
    const orderFn = filters.orderDirection === 'asc' ? asc : desc;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditRecords)
      .where(and(...conditions));

    const total = Number(countResult?.count ?? 0);

    // Get records
    const rows = await db
      .select()
      .from(auditRecords)
      .where(and(...conditions))
      .orderBy(orderFn(orderBy))
      .limit(limit)
      .offset(offset);

    return {
      records: rows.map((row) => this.rowToAuditRecord(row)),
      total,
      hasMore: offset + rows.length < total,
    };
  }

  /**
   * Get a single audit record by ID
   */
  async findById(id: ID, tenantId: ID): Promise<AuditRecord | null> {
    const db = getDatabase();

    const [row] = await db
      .select()
      .from(auditRecords)
      .where(and(eq(auditRecords.id, id), eq(auditRecords.tenantId, tenantId)))
      .limit(1);

    return row ? this.rowToAuditRecord(row) : null;
  }

  /**
   * Get audit records for a specific target
   */
  async getForTarget(
    tenantId: ID,
    targetType: string,
    targetId: ID,
    options?: { limit?: number; offset?: number }
  ): Promise<AuditRecord[]> {
    const db = getDatabase();
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const rows = await db
      .select()
      .from(auditRecords)
      .where(
        and(
          eq(auditRecords.tenantId, tenantId),
          eq(auditRecords.targetType, targetType),
          eq(auditRecords.targetId, targetId)
        )
      )
      .orderBy(desc(auditRecords.eventTime))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => this.rowToAuditRecord(row));
  }

  /**
   * Get audit records for a specific trace
   */
  async getByTrace(tenantId: ID, traceId: string): Promise<AuditRecord[]> {
    const db = getDatabase();

    const rows = await db
      .select()
      .from(auditRecords)
      .where(
        and(eq(auditRecords.tenantId, tenantId), eq(auditRecords.traceId, traceId))
      )
      .orderBy(asc(auditRecords.eventTime));

    return rows.map((row) => this.rowToAuditRecord(row));
  }

  /**
   * Verify chain integrity for a tenant
   */
  async verifyChainIntegrity(
    tenantId: ID,
    options?: { startSequence?: number; limit?: number }
  ): Promise<ChainIntegrityResult> {
    const db = getDatabase();

    const conditions = [eq(auditRecords.tenantId, tenantId)];

    if (options?.startSequence !== undefined) {
      conditions.push(gte(auditRecords.sequenceNumber, BigInt(options.startSequence)));
    }

    const limit = options?.limit ?? 10000;

    const rows = await db
      .select({
        id: auditRecords.id,
        sequenceNumber: auditRecords.sequenceNumber,
        previousHash: auditRecords.previousHash,
        recordHash: auditRecords.recordHash,
      })
      .from(auditRecords)
      .where(and(...conditions))
      .orderBy(asc(auditRecords.sequenceNumber))
      .limit(limit);

    if (rows.length === 0) {
      return {
        valid: true,
        recordsChecked: 0,
      };
    }

    let previousHash: string | null = null;
    let firstRecord: ID | undefined;
    let lastRecord: ID | undefined;

    for (const row of rows) {
      if (!firstRecord) {
        firstRecord = row.id;
      }
      lastRecord = row.id;

      // First record in sequence should have null previousHash or match our starting point
      if (previousHash !== null && row.previousHash !== previousHash) {
        logger.error(
          {
            recordId: row.id,
            sequenceNumber: row.sequenceNumber,
            expectedPreviousHash: previousHash,
            actualPreviousHash: row.previousHash,
          },
          'Chain integrity violation detected'
        );

        return {
          valid: false,
          recordsChecked: rows.indexOf(row) + 1,
          firstRecord,
          lastRecord: row.id,
          brokenAt: row.id,
          error: `Hash chain broken at sequence ${row.sequenceNumber}`,
        };
      }

      previousHash = row.recordHash;
    }

    return {
      valid: true,
      recordsChecked: rows.length,
      firstRecord,
      lastRecord,
    };
  }

  /**
   * Get audit statistics for a tenant
   */
  async getStats(
    tenantId: ID,
    options?: { startTime?: string; endTime?: string }
  ): Promise<{
    totalRecords: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    byOutcome: Record<string, number>;
  }> {
    const db = getDatabase();

    const conditions = [eq(auditRecords.tenantId, tenantId)];

    if (options?.startTime) {
      conditions.push(gte(auditRecords.eventTime, new Date(options.startTime)));
    }
    if (options?.endTime) {
      conditions.push(lte(auditRecords.eventTime, new Date(options.endTime)));
    }

    // Total count
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditRecords)
      .where(and(...conditions));

    // By category
    const categoryResults = await db
      .select({
        category: auditRecords.eventCategory,
        count: sql<number>`count(*)`,
      })
      .from(auditRecords)
      .where(and(...conditions))
      .groupBy(auditRecords.eventCategory);

    // By severity
    const severityResults = await db
      .select({
        severity: auditRecords.severity,
        count: sql<number>`count(*)`,
      })
      .from(auditRecords)
      .where(and(...conditions))
      .groupBy(auditRecords.severity);

    // By outcome
    const outcomeResults = await db
      .select({
        outcome: auditRecords.outcome,
        count: sql<number>`count(*)`,
      })
      .from(auditRecords)
      .where(and(...conditions))
      .groupBy(auditRecords.outcome);

    return {
      totalRecords: Number(totalResult?.count ?? 0),
      byCategory: Object.fromEntries(
        categoryResults.map((r) => [r.category, Number(r.count)])
      ),
      bySeverity: Object.fromEntries(
        severityResults.map((r) => [r.severity, Number(r.count)])
      ),
      byOutcome: Object.fromEntries(
        outcomeResults.map((r) => [r.outcome, Number(r.count)])
      ),
    };
  }

  /**
   * Convert database row to AuditRecord
   */
  private rowToAuditRecord(row: typeof auditRecords.$inferSelect): AuditRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      eventType: row.eventType,
      eventCategory: row.eventCategory as AuditCategory,
      severity: row.severity as AuditSeverity,
      actor: {
        type: row.actorType as AuditRecord['actor']['type'],
        id: row.actorId,
        name: row.actorName ?? undefined,
        ip: row.actorIp ?? undefined,
      },
      target: {
        type: row.targetType as AuditRecord['target']['type'],
        id: row.targetId,
        name: row.targetName ?? undefined,
      },
      requestId: row.requestId,
      traceId: row.traceId,
      spanId: row.spanId,
      action: row.action,
      outcome: row.outcome as AuditRecord['outcome'],
      reason: row.reason,
      stateChange: (row.beforeState || row.afterState || row.diffState)
        ? {
            before: row.beforeState as Record<string, unknown> | undefined,
            after: row.afterState as Record<string, unknown> | undefined,
            diff: row.diffState as Record<string, unknown> | undefined,
          }
        : undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      tags: row.tags ?? undefined,
      sequenceNumber: Number(row.sequenceNumber),
      previousHash: row.previousHash,
      recordHash: row.recordHash,
      eventTime: row.eventTime.toISOString(),
      recordedAt: row.recordedAt.toISOString(),
      archived: row.archived,
      archivedAt: row.archivedAt?.toISOString() ?? null,
    };
  }

  // ==========================================================================
  // ARCHIVE & RETENTION METHODS
  // ==========================================================================

  /**
   * Archive audit records older than specified days.
   * Archived records are marked but not deleted, preserving chain integrity.
   *
   * @param archiveAfterDays - Archive records older than this many days
   * @param batchSize - Number of records to process per batch
   * @returns Archive operation result
   */
  async archiveOldRecords(
    archiveAfterDays: number,
    batchSize: number = 1000
  ): Promise<AuditArchiveResult> {
    const startTime = performance.now();
    const db = getDatabase();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - archiveAfterDays);

    // Update records in batches to avoid locking issues
    const result = await db
      .update(auditRecords)
      .set({
        archived: true,
        archivedAt: new Date(),
      })
      .where(
        and(
          eq(auditRecords.archived, false),
          lt(auditRecords.eventTime, cutoffDate)
        )
      )
      .returning({
        id: auditRecords.id,
        eventTime: auditRecords.eventTime,
      });

    const durationMs = Math.round(performance.now() - startTime);
    const sortedByTime = result.sort(
      (a, b) => a.eventTime.getTime() - b.eventTime.getTime()
    );

    const archiveResult: AuditArchiveResult = {
      recordsArchived: result.length,
      durationMs,
      oldestArchivedDate: sortedByTime[0]?.eventTime.toISOString(),
      newestArchivedDate: sortedByTime[sortedByTime.length - 1]?.eventTime.toISOString(),
    };

    logger.info(
      {
        recordsArchived: archiveResult.recordsArchived,
        archiveAfterDays,
        cutoffDate: cutoffDate.toISOString(),
        durationMs,
      },
      'Audit records archived'
    );

    return archiveResult;
  }

  /**
   * Permanently delete audit records older than the retention period.
   * Only deletes archived records to ensure recent records are preserved.
   *
   * IMPORTANT: This permanently removes data. Ensure compliance requirements
   * are met before calling this method.
   *
   * @param retentionDays - Delete records older than this many days
   * @param batchSize - Number of records to delete per batch
   * @returns Purge operation result
   */
  async purgeOldRecords(
    retentionDays: number,
    batchSize: number = 1000
  ): Promise<AuditPurgeResult> {
    const startTime = performance.now();
    const db = getDatabase();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Only delete archived records past retention period
    // This provides a safety net: records must be archived first
    const result = await db
      .delete(auditRecords)
      .where(
        and(
          eq(auditRecords.archived, true),
          lt(auditRecords.eventTime, cutoffDate)
        )
      )
      .returning({
        id: auditRecords.id,
        eventTime: auditRecords.eventTime,
      });

    const durationMs = Math.round(performance.now() - startTime);
    const sortedByTime = result.sort(
      (a, b) => a.eventTime.getTime() - b.eventTime.getTime()
    );

    const purgeResult: AuditPurgeResult = {
      recordsPurged: result.length,
      durationMs,
      oldestPurgedDate: sortedByTime[0]?.eventTime.toISOString(),
      newestPurgedDate: sortedByTime[sortedByTime.length - 1]?.eventTime.toISOString(),
    };

    logger.info(
      {
        recordsPurged: purgeResult.recordsPurged,
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
        durationMs,
      },
      'Audit records purged'
    );

    return purgeResult;
  }

  /**
   * Run full audit cleanup: archive old records, then purge expired ones.
   * This is the main entry point for scheduled audit maintenance.
   *
   * @param options - Cleanup configuration
   * @returns Combined cleanup result
   */
  async runCleanup(options: {
    archiveAfterDays: number;
    retentionDays: number;
    batchSize?: number;
    archiveEnabled?: boolean;
  }): Promise<AuditCleanupResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    const batchSize = options.batchSize ?? 1000;

    let archived: AuditArchiveResult = {
      recordsArchived: 0,
      durationMs: 0,
    };

    let purged: AuditPurgeResult = {
      recordsPurged: 0,
      durationMs: 0,
    };

    // Step 1: Archive old records (if enabled)
    if (options.archiveEnabled !== false) {
      try {
        archived = await this.archiveOldRecords(options.archiveAfterDays, batchSize);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Archive failed: ${message}`);
        logger.error({ error }, 'Audit archive failed');
      }
    }

    // Step 2: Purge expired archived records
    try {
      purged = await this.purgeOldRecords(options.retentionDays, batchSize);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Purge failed: ${message}`);
      logger.error({ error }, 'Audit purge failed');
    }

    const totalDurationMs = Math.round(performance.now() - startTime);

    const result: AuditCleanupResult = {
      archived,
      purged,
      totalDurationMs,
      errors,
    };

    logger.info(
      {
        archived: archived.recordsArchived,
        purged: purged.recordsPurged,
        errors: errors.length,
        totalDurationMs,
      },
      'Audit cleanup completed'
    );

    return result;
  }

  /**
   * Get retention statistics for a tenant
   */
  async getRetentionStats(tenantId: ID): Promise<{
    totalRecords: number;
    activeRecords: number;
    archivedRecords: number;
    oldestRecord?: string;
    newestRecord?: string;
    oldestArchived?: string;
  }> {
    const db = getDatabase();

    // Total count
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditRecords)
      .where(eq(auditRecords.tenantId, tenantId));

    // Active (non-archived) count
    const [activeResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditRecords)
      .where(
        and(
          eq(auditRecords.tenantId, tenantId),
          eq(auditRecords.archived, false)
        )
      );

    // Archived count
    const [archivedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditRecords)
      .where(
        and(
          eq(auditRecords.tenantId, tenantId),
          eq(auditRecords.archived, true)
        )
      );

    // Oldest record
    const [oldest] = await db
      .select({ eventTime: auditRecords.eventTime })
      .from(auditRecords)
      .where(eq(auditRecords.tenantId, tenantId))
      .orderBy(asc(auditRecords.eventTime))
      .limit(1);

    // Newest record
    const [newest] = await db
      .select({ eventTime: auditRecords.eventTime })
      .from(auditRecords)
      .where(eq(auditRecords.tenantId, tenantId))
      .orderBy(desc(auditRecords.eventTime))
      .limit(1);

    // Oldest archived
    const [oldestArchived] = await db
      .select({ archivedAt: auditRecords.archivedAt })
      .from(auditRecords)
      .where(
        and(
          eq(auditRecords.tenantId, tenantId),
          eq(auditRecords.archived, true)
        )
      )
      .orderBy(asc(auditRecords.archivedAt))
      .limit(1);

    return {
      totalRecords: Number(totalResult?.count ?? 0),
      activeRecords: Number(activeResult?.count ?? 0),
      archivedRecords: Number(archivedResult?.count ?? 0),
      oldestRecord: oldest?.eventTime.toISOString(),
      newestRecord: newest?.eventTime.toISOString(),
      oldestArchived: oldestArchived?.archivedAt?.toISOString(),
    };
  }
}

/**
 * Create a new audit service instance
 */
export function createAuditService(): AuditService {
  return new AuditService();
}

/**
 * Convenience function for recording common audit events
 */
export class AuditHelper {
  constructor(private service: AuditService) {}

  /**
   * Record an intent lifecycle event
   */
  async recordIntentEvent(
    tenantId: ID,
    eventType: string,
    intentId: ID,
    actor: { type: 'user' | 'agent' | 'service' | 'system'; id: ID; name?: string },
    options?: {
      outcome?: 'success' | 'failure' | 'partial';
      reason?: string;
      stateChange?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
      metadata?: Record<string, unknown>;
    }
  ): Promise<AuditRecord> {
    return this.service.record({
      tenantId,
      eventType,
      actor,
      target: { type: 'intent', id: intentId },
      action: eventType.replace('intent.', ''),
      outcome: options?.outcome ?? 'success',
      reason: options?.reason,
      stateChange: options?.stateChange,
      metadata: options?.metadata,
    });
  }

  /**
   * Record a policy evaluation event
   */
  async recordPolicyEvaluation(
    tenantId: ID,
    policyId: ID,
    intentId: ID,
    actor: { type: 'user' | 'agent' | 'service' | 'system'; id: ID },
    result: {
      action: string;
      matched: boolean;
      rulesEvaluated: number;
    }
  ): Promise<AuditRecord> {
    return this.service.record({
      tenantId,
      eventType: 'policy.evaluation.completed',
      actor,
      target: { type: 'policy', id: policyId },
      action: 'evaluate',
      outcome: result.matched ? 'success' : 'failure',
      metadata: {
        intentId,
        action: result.action,
        rulesEvaluated: result.rulesEvaluated,
      },
    });
  }

  /**
   * Record an escalation event
   */
  async recordEscalationEvent(
    tenantId: ID,
    eventType: string,
    escalationId: ID,
    intentId: ID,
    actor: { type: 'user' | 'agent' | 'service' | 'system'; id: ID; name?: string },
    options?: {
      outcome?: 'success' | 'failure' | 'partial';
      reason?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<AuditRecord> {
    return this.service.record({
      tenantId,
      eventType,
      actor,
      target: { type: 'escalation', id: escalationId },
      action: eventType.replace('escalation.', ''),
      outcome: options?.outcome ?? 'success',
      reason: options?.reason,
      metadata: {
        ...options?.metadata,
        intentId,
      },
    });
  }
}

/**
 * Create an audit helper
 */
export function createAuditHelper(service: AuditService): AuditHelper {
  return new AuditHelper(service);
}
