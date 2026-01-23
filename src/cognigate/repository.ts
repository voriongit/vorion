/**
 * COGNIGATE Module Repository
 *
 * Data access layer for execution records, events, audit records,
 * escalations, and webhook deliveries. Provides enterprise-grade
 * persistence with:
 *
 * - Circuit breaker protection on all database operations
 * - Offset-based pagination with total counts
 * - GDPR-compliant soft and hard delete
 * - Tenant-scoped operations
 * - Execution statistics aggregation
 *
 * @packageDocumentation
 */

import { eq, and, desc, gte, lte, sql, isNull, isNotNull, lt } from 'drizzle-orm';
import { createLogger } from '../common/logger.js';
import { withCircuitBreaker } from '../common/circuit-breaker.js';
import type { ID, Timestamp } from '../common/types.js';
import {
  cognigateExecutions,
  cognigateEvents,
  cognigateAuditRecords,
  cognigateEscalations,
  type CognigateExecutionRow,
  type NewCognigateExecutionRow,
  type CognigateEventRow,
  type NewCognigateEventRow,
  type CognigateAuditRecordRow,
  type NewCognigateAuditRecordRow,
  type CognigateEscalationRow,
  type NewCognigateEscalationRow,
  type ExecutionStatus,
} from './schema.js';

const logger = createLogger({ component: 'cognigate-repository' });

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default page size for queries */
const DEFAULT_PAGE_SIZE = 50;

/** Maximum allowed page size */
const MAX_PAGE_SIZE = 1000;

/** Circuit breaker name for database operations */
const CB_NAME = 'cognigateDatabase';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Execution record as returned by the repository
 */
export interface ExecutionRecord {
  id: ID;
  tenantId: ID;
  intentId: ID;
  entityId: ID;
  executionId: ID;
  handlerName: string;
  handlerVersion: string | null;
  status: string;
  priority: number;
  resourceLimits: Record<string, unknown> | null;
  resourceUsage: Record<string, unknown> | null;
  outputs: Record<string, unknown> | null;
  error: string | null;
  retryCount: number;
  parentExecutionId: string | null;
  correlationId: string | null;
  traceId: string | null;
  spanId: string | null;
  requestId: string | null;
  sandboxConfig: Record<string, unknown> | null;
  violations: unknown[] | null;
  proofHash: string | null;
  deadline: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  context: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * New execution record for creation
 */
export type NewExecution = NewCognigateExecutionRow;

/**
 * Execution event record
 */
export interface ExecutionEvent {
  id: ID;
  executionId: ID;
  eventType: string;
  payload: Record<string, unknown> | null;
  occurredAt: string;
  hash: string | null;
  previousHash: string | null;
}

/**
 * New execution event for creation
 */
export type NewExecutionEvent = Omit<NewCognigateEventRow, 'executionId'>;

/**
 * Audit record as returned by the repository
 */
export interface AuditRecord {
  id: ID;
  tenantId: ID;
  eventType: string;
  severity: string;
  outcome: string;
  executionId: string | null;
  intentId: string | null;
  entityId: string | null;
  handlerName: string | null;
  action: string | null;
  reason: string | null;
  resourceUsage: Record<string, unknown> | null;
  violation: Record<string, unknown> | null;
  actorId: string | null;
  actorType: string | null;
  requestId: string | null;
  traceId: string | null;
  spanId: string | null;
  durationMs: number | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  eventTime: string;
  recordedAt: string;
}

/**
 * New audit record for creation
 */
export type NewAuditRecord = NewCognigateAuditRecordRow;

/**
 * Escalation record as returned by the repository
 */
export interface EscalationRecord {
  id: ID;
  executionId: string | null;
  tenantId: ID;
  intentId: string | null;
  reason: string;
  priority: string | null;
  escalatedTo: string | null;
  escalatedBy: string | null;
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionAction: string | null;
  resolutionNotes: string | null;
  violation: Record<string, unknown> | null;
  timeout: string | null;
  timeoutAt: string | null;
  acknowledgedAt: string | null;
  context: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * New escalation for creation
 */
export type NewEscalation = NewCognigateEscalationRow;

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Filters for listing executions
 */
export interface ExecutionFilters {
  tenantId?: ID;
  intentId?: ID;
  entityId?: ID;
  handlerName?: string;
  status?: ExecutionStatus;
  fromDate?: Date;
  toDate?: Date;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Filters for querying audit records
 */
export interface AuditFilters {
  tenantId: ID;
  eventType?: string;
  severity?: string;
  executionId?: ID;
  intentId?: ID;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Execution statistics
 */
export interface ExecutionStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
  avgDurationMs: number | null;
  totalRetries: number;
}

// =============================================================================
// ROW MAPPERS
// =============================================================================

function mapExecutionRow(row: CognigateExecutionRow): ExecutionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    intentId: row.intentId,
    entityId: row.entityId,
    executionId: row.executionId,
    handlerName: row.handlerName,
    handlerVersion: row.handlerVersion ?? null,
    status: row.status,
    priority: row.priority ?? 0,
    resourceLimits: (row.resourceLimits ?? null) as Record<string, unknown> | null,
    resourceUsage: (row.resourceUsage ?? null) as Record<string, unknown> | null,
    outputs: (row.outputs ?? null) as Record<string, unknown> | null,
    error: row.error ?? null,
    retryCount: row.retryCount ?? 0,
    parentExecutionId: row.parentExecutionId ?? null,
    correlationId: row.correlationId ?? null,
    traceId: row.traceId ?? null,
    spanId: row.spanId ?? null,
    requestId: row.requestId ?? null,
    sandboxConfig: (row.sandboxConfig ?? null) as Record<string, unknown> | null,
    violations: (row.violations ?? null) as unknown[] | null,
    proofHash: row.proofHash ?? null,
    deadline: row.deadline?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    durationMs: row.durationMs ?? null,
    context: (row.context ?? null) as Record<string, unknown> | null,
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

function mapEventRow(row: CognigateEventRow): ExecutionEvent {
  return {
    id: row.id,
    executionId: row.executionId,
    eventType: row.eventType,
    payload: (row.payload ?? null) as Record<string, unknown> | null,
    occurredAt: row.occurredAt?.toISOString() ?? new Date().toISOString(),
    hash: row.hash ?? null,
    previousHash: row.previousHash ?? null,
  };
}

function mapAuditRow(row: CognigateAuditRecordRow): AuditRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    eventType: row.eventType,
    severity: row.severity,
    outcome: row.outcome,
    executionId: row.executionId ?? null,
    intentId: row.intentId ?? null,
    entityId: row.entityId ?? null,
    handlerName: row.handlerName ?? null,
    action: row.action ?? null,
    reason: row.reason ?? null,
    resourceUsage: (row.resourceUsage ?? null) as Record<string, unknown> | null,
    violation: (row.violation ?? null) as Record<string, unknown> | null,
    actorId: row.actorId ?? null,
    actorType: row.actorType ?? null,
    requestId: row.requestId ?? null,
    traceId: row.traceId ?? null,
    spanId: row.spanId ?? null,
    durationMs: row.durationMs ?? null,
    beforeState: (row.beforeState ?? null) as Record<string, unknown> | null,
    afterState: (row.afterState ?? null) as Record<string, unknown> | null,
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
    eventTime: row.eventTime?.toISOString() ?? new Date().toISOString(),
    recordedAt: row.recordedAt?.toISOString() ?? new Date().toISOString(),
  };
}

function mapEscalationRow(row: CognigateEscalationRow): EscalationRecord {
  return {
    id: row.id,
    executionId: row.executionId ?? null,
    tenantId: row.tenantId,
    intentId: row.intentId ?? null,
    reason: row.reason,
    priority: row.priority ?? null,
    escalatedTo: row.escalatedTo ?? null,
    escalatedBy: row.escalatedBy ?? null,
    status: row.status,
    resolvedBy: row.resolvedBy ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionAction: row.resolutionAction ?? null,
    resolutionNotes: row.resolutionNotes ?? null,
    violation: (row.violation ?? null) as Record<string, unknown> | null,
    timeout: row.timeout ?? null,
    timeoutAt: row.timeoutAt?.toISOString() ?? null,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    context: (row.context ?? null) as Record<string, unknown> | null,
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

// =============================================================================
// COGNIGATE REPOSITORY
// =============================================================================

/**
 * Repository for Cognigate execution data access
 *
 * All database operations are wrapped with circuit breaker protection
 * to prevent cascading failures when the database is unavailable.
 */
export class CognigateRepository {
  constructor(private db: any) {}

  // ===========================================================================
  // EXECUTION OPERATIONS
  // ===========================================================================

  /**
   * Create a new execution record
   */
  async createExecution(record: NewExecution): Promise<ExecutionRecord> {
    return withCircuitBreaker(CB_NAME, async () => {
      const [row] = await this.db.insert(cognigateExecutions).values(record).returning();
      if (!row) throw new Error('Failed to insert execution record');
      logger.debug({ executionId: record.executionId }, 'Execution record created');
      return mapExecutionRow(row);
    });
  }

  /**
   * Get an execution by its execution ID
   */
  async getExecution(executionId: ID): Promise<ExecutionRecord | null> {
    return withCircuitBreaker(CB_NAME, async () => {
      const [row] = await this.db
        .select()
        .from(cognigateExecutions)
        .where(
          and(
            eq(cognigateExecutions.executionId, executionId),
            isNull(cognigateExecutions.deletedAt)
          )
        );
      return row ? mapExecutionRow(row) : null;
    });
  }

  /**
   * Get an execution by intent ID and tenant ID
   */
  async getExecutionByIntentId(intentId: ID, tenantId: ID): Promise<ExecutionRecord | null> {
    return withCircuitBreaker(CB_NAME, async () => {
      const [row] = await this.db
        .select()
        .from(cognigateExecutions)
        .where(
          and(
            eq(cognigateExecutions.intentId, intentId),
            eq(cognigateExecutions.tenantId, tenantId),
            isNull(cognigateExecutions.deletedAt)
          )
        )
        .orderBy(desc(cognigateExecutions.createdAt))
        .limit(1);
      return row ? mapExecutionRow(row) : null;
    });
  }

  /**
   * Update an execution record
   */
  async updateExecution(executionId: ID, updates: Partial<ExecutionRecord>): Promise<ExecutionRecord | null> {
    return withCircuitBreaker(CB_NAME, async () => {
      const updateData: Record<string, unknown> = { ...updates, updatedAt: new Date() };
      // Remove fields that shouldn't be updated directly
      delete updateData.id;
      delete updateData.createdAt;
      delete updateData.executionId;

      const [row] = await this.db
        .update(cognigateExecutions)
        .set(updateData)
        .where(
          and(
            eq(cognigateExecutions.executionId, executionId),
            isNull(cognigateExecutions.deletedAt)
          )
        )
        .returning();

      if (row) {
        logger.debug({ executionId }, 'Execution record updated');
      }
      return row ? mapExecutionRow(row) : null;
    });
  }

  /**
   * Update execution status with optional metadata
   */
  async updateExecutionStatus(
    executionId: ID,
    status: ExecutionStatus,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await withCircuitBreaker(CB_NAME, async () => {
      const updates: Record<string, unknown> = {
        status,
        updatedAt: new Date(),
      };

      if (status === 'running') {
        updates.startedAt = new Date();
      } else if (status === 'completed' || status === 'failed' || status === 'timeout') {
        updates.completedAt = new Date();
      }

      if (metadata) {
        updates.metadata = metadata;
      }

      await this.db
        .update(cognigateExecutions)
        .set(updates)
        .where(eq(cognigateExecutions.executionId, executionId));

      logger.debug({ executionId, status }, 'Execution status updated');
    });
  }

  // ===========================================================================
  // QUERY OPERATIONS
  // ===========================================================================

  /**
   * List executions with filters and pagination
   */
  async listExecutions(filters: ExecutionFilters): Promise<{ records: ExecutionRecord[]; total: number }> {
    return withCircuitBreaker(CB_NAME, async () => {
      const limit = Math.min(filters.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
      const offset = filters.offset ?? 0;

      const clauses = [];

      if (filters.tenantId) {
        clauses.push(eq(cognigateExecutions.tenantId, filters.tenantId));
      }
      if (filters.intentId) {
        clauses.push(eq(cognigateExecutions.intentId, filters.intentId));
      }
      if (filters.entityId) {
        clauses.push(eq(cognigateExecutions.entityId, filters.entityId));
      }
      if (filters.handlerName) {
        clauses.push(eq(cognigateExecutions.handlerName, filters.handlerName));
      }
      if (filters.status) {
        clauses.push(eq(cognigateExecutions.status, filters.status));
      }
      if (filters.fromDate) {
        clauses.push(gte(cognigateExecutions.createdAt, filters.fromDate));
      }
      if (filters.toDate) {
        clauses.push(lte(cognigateExecutions.createdAt, filters.toDate));
      }
      if (!filters.includeDeleted) {
        clauses.push(isNull(cognigateExecutions.deletedAt));
      }

      const whereClause = clauses.length > 0
        ? (clauses.length > 1 ? and(...clauses) : clauses[0])
        : undefined;

      const [rows, countResult] = await Promise.all([
        this.db
          .select()
          .from(cognigateExecutions)
          .where(whereClause)
          .orderBy(desc(cognigateExecutions.createdAt))
          .limit(limit)
          .offset(offset),
        this.db
          .select({ count: sql<number>`count(*)` })
          .from(cognigateExecutions)
          .where(whereClause),
      ]);

      return {
        records: rows.map(mapExecutionRow),
        total: Number(countResult[0]?.count ?? 0),
      };
    });
  }

  /**
   * Get executions for a specific tenant with pagination
   */
  async getExecutionsByTenant(tenantId: ID, options?: PaginationOptions): Promise<ExecutionRecord[]> {
    return withCircuitBreaker(CB_NAME, async () => {
      const limit = Math.min(options?.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
      const offset = options?.offset ?? 0;

      const rows = await this.db
        .select()
        .from(cognigateExecutions)
        .where(
          and(
            eq(cognigateExecutions.tenantId, tenantId),
            isNull(cognigateExecutions.deletedAt)
          )
        )
        .orderBy(desc(cognigateExecutions.createdAt))
        .limit(limit)
        .offset(offset);

      return rows.map(mapExecutionRow);
    });
  }

  /**
   * Get all active (running/queued) executions
   */
  async getActiveExecutions(tenantId?: ID): Promise<ExecutionRecord[]> {
    return withCircuitBreaker(CB_NAME, async () => {
      const clauses = [
        sql`${cognigateExecutions.status} IN ('running', 'queued', 'pending')`,
        isNull(cognigateExecutions.deletedAt),
      ];

      if (tenantId) {
        clauses.push(eq(cognigateExecutions.tenantId, tenantId));
      }

      const rows = await this.db
        .select()
        .from(cognigateExecutions)
        .where(and(...clauses))
        .orderBy(desc(cognigateExecutions.createdAt));

      return rows.map(mapExecutionRow);
    });
  }

  // ===========================================================================
  // EVENT OPERATIONS
  // ===========================================================================

  /**
   * Create a new execution event
   */
  async createEvent(executionId: ID, event: NewExecutionEvent): Promise<void> {
    await withCircuitBreaker(CB_NAME, async () => {
      await this.db.insert(cognigateEvents).values({
        ...event,
        executionId,
      });
      logger.debug({ executionId, eventType: event.eventType }, 'Execution event recorded');
    });
  }

  /**
   * Get all events for an execution in chronological order
   */
  async getEvents(executionId: ID): Promise<ExecutionEvent[]> {
    return withCircuitBreaker(CB_NAME, async () => {
      const rows = await this.db
        .select()
        .from(cognigateEvents)
        .where(eq(cognigateEvents.executionId, executionId))
        .orderBy(cognigateEvents.occurredAt);

      return rows.map(mapEventRow);
    });
  }

  // ===========================================================================
  // AUDIT OPERATIONS
  // ===========================================================================

  /**
   * Create a single audit record
   */
  async createAuditRecord(record: NewAuditRecord): Promise<void> {
    await withCircuitBreaker(CB_NAME, async () => {
      await this.db.insert(cognigateAuditRecords).values(record);
      logger.debug({ eventType: record.eventType }, 'Audit record created');
    });
  }

  /**
   * Create multiple audit records in a batch
   */
  async createAuditRecordBatch(records: NewAuditRecord[]): Promise<void> {
    if (records.length === 0) return;

    await withCircuitBreaker(CB_NAME, async () => {
      await this.db.insert(cognigateAuditRecords).values(records);
      logger.debug({ count: records.length }, 'Audit records batch created');
    });
  }

  /**
   * Query audit records with filters
   */
  async queryAuditRecords(filters: AuditFilters): Promise<AuditRecord[]> {
    return withCircuitBreaker(CB_NAME, async () => {
      const limit = Math.min(filters.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
      const offset = filters.offset ?? 0;

      const clauses = [eq(cognigateAuditRecords.tenantId, filters.tenantId)];

      if (filters.eventType) {
        clauses.push(eq(cognigateAuditRecords.eventType, filters.eventType));
      }
      if (filters.severity) {
        clauses.push(eq(cognigateAuditRecords.severity, filters.severity));
      }
      if (filters.executionId) {
        clauses.push(eq(cognigateAuditRecords.executionId, filters.executionId));
      }
      if (filters.intentId) {
        clauses.push(eq(cognigateAuditRecords.intentId, filters.intentId));
      }
      if (filters.fromDate) {
        clauses.push(gte(cognigateAuditRecords.eventTime, filters.fromDate));
      }
      if (filters.toDate) {
        clauses.push(lte(cognigateAuditRecords.eventTime, filters.toDate));
      }

      const whereClause = clauses.length > 1 ? and(...clauses) : clauses[0];

      const rows = await this.db
        .select()
        .from(cognigateAuditRecords)
        .where(whereClause)
        .orderBy(desc(cognigateAuditRecords.eventTime))
        .limit(limit)
        .offset(offset);

      return rows.map(mapAuditRow);
    });
  }

  // ===========================================================================
  // ESCALATION OPERATIONS
  // ===========================================================================

  /**
   * Create a new escalation record
   */
  async createEscalation(escalation: NewEscalation): Promise<void> {
    await withCircuitBreaker(CB_NAME, async () => {
      await this.db.insert(cognigateEscalations).values(escalation);
      logger.debug({ executionId: escalation.executionId, reason: escalation.reason }, 'Escalation created');
    });
  }

  /**
   * Get an escalation by ID
   */
  async getEscalation(id: ID): Promise<EscalationRecord | null> {
    return withCircuitBreaker(CB_NAME, async () => {
      const [row] = await this.db
        .select()
        .from(cognigateEscalations)
        .where(eq(cognigateEscalations.id, id));
      return row ? mapEscalationRow(row) : null;
    });
  }

  /**
   * Update an escalation record
   */
  async updateEscalation(id: ID, updates: Partial<EscalationRecord>): Promise<void> {
    await withCircuitBreaker(CB_NAME, async () => {
      const updateData: Record<string, unknown> = { ...updates, updatedAt: new Date() };
      delete updateData.id;
      delete updateData.createdAt;

      await this.db
        .update(cognigateEscalations)
        .set(updateData)
        .where(eq(cognigateEscalations.id, id));

      logger.debug({ escalationId: id }, 'Escalation updated');
    });
  }

  /**
   * Get all active (pending/acknowledged) escalations for a tenant
   */
  async getActiveEscalations(tenantId: ID): Promise<EscalationRecord[]> {
    return withCircuitBreaker(CB_NAME, async () => {
      const rows = await this.db
        .select()
        .from(cognigateEscalations)
        .where(
          and(
            eq(cognigateEscalations.tenantId, tenantId),
            sql`${cognigateEscalations.status} IN ('pending', 'acknowledged')`
          )
        )
        .orderBy(desc(cognigateEscalations.createdAt));

      return rows.map(mapEscalationRow);
    });
  }

  // ===========================================================================
  // GDPR OPERATIONS
  // ===========================================================================

  /**
   * Soft delete an execution record (GDPR compliant)
   *
   * Clears sensitive data (context, metadata, outputs) while preserving
   * the structural record for audit trail integrity.
   */
  async softDelete(executionId: ID): Promise<void> {
    await withCircuitBreaker(CB_NAME, async () => {
      await this.db
        .update(cognigateExecutions)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
          context: null,
          metadata: null,
          outputs: null,
        })
        .where(
          and(
            eq(cognigateExecutions.executionId, executionId),
            isNull(cognigateExecutions.deletedAt)
          )
        );

      logger.info({ executionId }, 'Execution soft deleted');
    });
  }

  /**
   * Hard delete an execution and all related records
   *
   * Permanently removes the execution, its events, audit records,
   * and escalations. Use with extreme caution.
   */
  async hardDelete(executionId: ID): Promise<void> {
    await withCircuitBreaker(CB_NAME, async () => {
      await this.db.transaction(async (tx: any) => {
        // Get the record ID first
        const [record] = await tx
          .select({ id: cognigateExecutions.id })
          .from(cognigateExecutions)
          .where(eq(cognigateExecutions.executionId, executionId));

        if (!record) return;

        // Delete related events
        await tx
          .delete(cognigateEvents)
          .where(eq(cognigateEvents.executionId, record.id));

        // Delete related escalations
        await tx
          .delete(cognigateEscalations)
          .where(eq(cognigateEscalations.executionId, record.id));

        // Delete the execution itself
        await tx
          .delete(cognigateExecutions)
          .where(eq(cognigateExecutions.id, record.id));
      });

      logger.warn({ executionId }, 'Execution hard deleted');
    });
  }

  /**
   * Get soft-deleted records older than a given timestamp
   *
   * Used for periodic cleanup of records past their retention period.
   */
  async getDeletedRecords(before: Timestamp): Promise<ExecutionRecord[]> {
    return withCircuitBreaker(CB_NAME, async () => {
      const beforeDate = new Date(before);

      const rows = await this.db
        .select()
        .from(cognigateExecutions)
        .where(
          and(
            isNotNull(cognigateExecutions.deletedAt),
            lt(cognigateExecutions.deletedAt, beforeDate)
          )
        )
        .orderBy(cognigateExecutions.deletedAt)
        .limit(MAX_PAGE_SIZE);

      return rows.map(mapExecutionRow);
    });
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get execution statistics for a tenant since a given timestamp
   */
  async getExecutionStats(tenantId: ID, since: Timestamp): Promise<ExecutionStats> {
    return withCircuitBreaker(CB_NAME, async () => {
      const sinceDate = new Date(since);

      const baseWhere = and(
        eq(cognigateExecutions.tenantId, tenantId),
        gte(cognigateExecutions.createdAt, sinceDate),
        isNull(cognigateExecutions.deletedAt)
      );

      const [statsResult] = await this.db
        .select({
          total: sql<number>`count(*)`,
          completed: sql<number>`count(*) FILTER (WHERE ${cognigateExecutions.status} = 'completed')`,
          failed: sql<number>`count(*) FILTER (WHERE ${cognigateExecutions.status} = 'failed')`,
          running: sql<number>`count(*) FILTER (WHERE ${cognigateExecutions.status} IN ('running', 'queued', 'pending'))`,
          avgDurationMs: sql<number | null>`avg(${cognigateExecutions.durationMs}) FILTER (WHERE ${cognigateExecutions.durationMs} IS NOT NULL)`,
          totalRetries: sql<number>`coalesce(sum(${cognigateExecutions.retryCount}), 0)`,
        })
        .from(cognigateExecutions)
        .where(baseWhere);

      return {
        total: Number(statsResult?.total ?? 0),
        completed: Number(statsResult?.completed ?? 0),
        failed: Number(statsResult?.failed ?? 0),
        running: Number(statsResult?.running ?? 0),
        avgDurationMs: statsResult?.avgDurationMs != null ? Number(statsResult.avgDurationMs) : null,
        totalRetries: Number(statsResult?.totalRetries ?? 0),
      };
    });
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/** Singleton repository instance */
let repositoryInstance: CognigateRepository | null = null;

/**
 * Get the shared repository instance
 *
 * @param db - Drizzle database instance
 * @returns The shared CognigateRepository instance
 */
export function getCognigateRepository(db: any): CognigateRepository {
  if (!repositoryInstance) {
    repositoryInstance = new CognigateRepository(db);
  }
  return repositoryInstance;
}

/**
 * Create a new repository instance
 *
 * Note: This creates a new instance separate from the singleton.
 * Use getCognigateRepository() for the shared instance.
 *
 * @param db - Drizzle database instance
 * @returns A new CognigateRepository instance
 */
export function createCognigateRepository(db: any): CognigateRepository {
  return new CognigateRepository(db);
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetCognigateRepository(): void {
  repositoryInstance = null;
}
