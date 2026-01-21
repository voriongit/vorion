/**
 * INTENT Read Audit Logging
 *
 * SOC2 compliant audit logging for read operations in the INTENT module.
 * Tracks who accessed/viewed data for compliance reporting.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { createLogger } from '../common/logger.js';
import { getDatabase } from '../common/db.js';
import {
  withCircuitBreaker,
  withCircuitBreakerResult,
  CircuitBreakerOpenError,
} from '../common/circuit-breaker.js';
import { auditReads } from './schema.js';
import type { ID } from '../common/types.js';

// Re-export CircuitBreakerOpenError for consumers
export { CircuitBreakerOpenError };

const logger = createLogger({ component: 'intent-audit' });

// =============================================================================
// AUDIT ACTION TYPES
// =============================================================================

export type AuditAction =
  | 'intent.create'
  | 'intent.read'
  | 'intent.read_list'
  | 'intent.update'
  | 'intent.delete'
  | 'escalation.read'
  | 'escalation.approve'
  | 'escalation.reject'
  | 'webhook.read'
  | 'webhook.read_deliveries'
  | 'webhook.read_delivery'
  | 'webhook.read_failed_deliveries'
  | 'webhook.replay'
  | 'gdpr.export'
  | 'gdpr.erase';

// =============================================================================
// AUDIT ENTRY TYPES
// =============================================================================

export type AuditResourceType = 'intent' | 'escalation' | 'webhook' | 'user_data';

export interface AuditEntry {
  id: string;
  tenantId: string;
  userId: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export type CreateAuditEntry = Omit<AuditEntry, 'id' | 'timestamp'>;

// =============================================================================
// AUDIT QUERY TYPES
// =============================================================================

export interface AuditQueryFilters {
  tenantId: ID;
  userId?: string;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditQueryResult {
  entries: AuditEntry[];
  total: number;
  hasMore: boolean;
}

// =============================================================================
// ASYNC AUDIT QUEUE
// =============================================================================

/**
 * Simple in-memory queue for fire-and-forget audit logging.
 * Uses setImmediate to not block the request path.
 */
class AuditQueue {
  private queue: CreateAuditEntry[] = [];
  private processing = false;
  private readonly maxBatchSize = 100;
  private readonly flushIntervalMs = 1000;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Start periodic flush
    this.startFlushTimer();
  }

  /**
   * Add an entry to the queue for async processing
   */
  enqueue(entry: CreateAuditEntry): void {
    this.queue.push(entry);

    // If queue is getting large, process immediately
    if (this.queue.length >= this.maxBatchSize) {
      void this.flush();
    }
  }

  /**
   * Start the periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * Flush the queue to the database.
   * Uses circuit breaker to prevent cascading failures and avoid
   * overwhelming the database during outages.
   */
  private async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const batch = this.queue.splice(0, this.maxBatchSize);

    try {
      // Use withCircuitBreakerResult to avoid throwing on circuit open
      // since audit logging should never fail the main request
      const result = await withCircuitBreakerResult('auditService', async () => {
        const db = getDatabase();
        const now = new Date();

        const values = batch.map((entry) => ({
          id: randomUUID(),
          tenantId: entry.tenantId,
          userId: entry.userId,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          metadata: entry.metadata ?? null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
          timestamp: now,
        }));

        await db.insert(auditReads).values(values);
        return batch.length;
      });

      if (result.success) {
        logger.debug({ count: batch.length }, 'Audit entries flushed to database');
      } else if (result.circuitOpen) {
        // Circuit is open - re-queue for later retry
        logger.warn(
          { count: batch.length },
          'Audit circuit breaker is open, re-queuing entries for retry'
        );
        if (this.queue.length < 10000) {
          this.queue.unshift(...batch);
        } else {
          logger.warn({ dropped: batch.length }, 'Dropping audit entries due to queue overflow');
        }
      } else {
        // Execution failed
        logger.error(
          { error: result.error, count: batch.length },
          'Failed to flush audit entries'
        );
        // Re-queue failed entries for retry (with limit to prevent memory issues)
        if (this.queue.length < 10000) {
          this.queue.unshift(...batch);
        } else {
          logger.warn({ dropped: batch.length }, 'Dropping audit entries due to queue overflow');
        }
      }
    } catch (error) {
      // Catch-all for unexpected errors
      logger.error({ error, count: batch.length }, 'Unexpected error flushing audit entries');

      // Re-queue failed entries for retry
      if (this.queue.length < 10000) {
        this.queue.unshift(...batch);
      } else {
        logger.warn({ dropped: batch.length }, 'Dropping audit entries due to queue overflow');
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Force flush and cleanup (for graceful shutdown)
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

// Singleton queue instance
let auditQueue: AuditQueue | null = null;

function getAuditQueue(): AuditQueue {
  if (!auditQueue) {
    auditQueue = new AuditQueue();
  }
  return auditQueue;
}

// =============================================================================
// AUDIT FUNCTIONS
// =============================================================================

/**
 * Record an audit entry asynchronously.
 * Uses a queue to batch writes and avoid blocking the request path.
 *
 * @param entry - The audit entry to record (without id and timestamp)
 */
export function recordAudit(entry: CreateAuditEntry): void {
  // Fire and forget - enqueue for async processing
  setImmediate(() => {
    try {
      getAuditQueue().enqueue(entry);
    } catch (error) {
      // Log but don't throw - audit logging should never fail requests
      logger.error({ error, entry }, 'Failed to enqueue audit entry');
    }
  });
}

/**
 * Record an audit entry synchronously (for testing or critical paths).
 * Prefer recordAudit() for production use.
 * Protected by circuit breaker to prevent cascading failures.
 *
 * @param entry - The audit entry to record
 * @returns The created audit entry with id and timestamp
 * @throws CircuitBreakerOpenError if the audit service circuit breaker is open
 */
export async function recordAuditSync(entry: CreateAuditEntry): Promise<AuditEntry> {
  return withCircuitBreaker('auditService', async () => {
    const db = getDatabase();
    const now = new Date();
    const id = randomUUID();

    const [row] = await db
      .insert(auditReads)
      .values({
        id,
        tenantId: entry.tenantId,
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.metadata ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        timestamp: now,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to insert audit entry - no row returned');
    }

    logger.debug(
      { auditId: row.id, action: entry.action, resourceType: entry.resourceType },
      'Audit entry recorded'
    );

    const result: AuditEntry = {
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      action: row.action as AuditAction,
      resourceType: row.resourceType as AuditResourceType,
      resourceId: row.resourceId,
      timestamp: row.timestamp,
    };

    if (row.metadata != null) {
      result.metadata = row.metadata as Record<string, unknown>;
    }
    if (row.ipAddress != null) {
      result.ipAddress = row.ipAddress;
    }
    if (row.userAgent != null) {
      result.userAgent = row.userAgent;
    }

    return result;
  });
}

// =============================================================================
// AUDIT QUERY FUNCTIONS
// =============================================================================

/**
 * Query audit log entries for compliance reporting.
 * Supports filtering by user, action, resource, and time range.
 * Protected by circuit breaker to prevent cascading failures.
 *
 * @param filters - Query filters
 * @returns Paginated audit entries
 * @throws CircuitBreakerOpenError if the audit service circuit breaker is open
 */
export async function queryAuditLog(filters: AuditQueryFilters): Promise<AuditQueryResult> {
  return withCircuitBreaker('auditService', async () => {
    const db = getDatabase();
    const limit = Math.min(filters.limit ?? 50, 1000);
    const offset = filters.offset ?? 0;

    const conditions = [eq(auditReads.tenantId, filters.tenantId)];

    if (filters.userId) {
      conditions.push(eq(auditReads.userId, filters.userId));
    }

    if (filters.action) {
      conditions.push(eq(auditReads.action, filters.action));
    }

    if (filters.resourceType) {
      conditions.push(eq(auditReads.resourceType, filters.resourceType));
    }

    if (filters.resourceId) {
      conditions.push(eq(auditReads.resourceId, filters.resourceId));
    }

    if (filters.from) {
      conditions.push(gte(auditReads.timestamp, filters.from));
    }

    if (filters.to) {
      conditions.push(lte(auditReads.timestamp, filters.to));
    }

    // Get total count
    const allRows = await db
      .select()
      .from(auditReads)
      .where(and(...conditions));

    const total = allRows.length;

    // Get paginated results
    const rows = await db
      .select()
      .from(auditReads)
      .where(and(...conditions))
      .orderBy(desc(auditReads.timestamp))
      .limit(limit)
      .offset(offset);

    const entries: AuditEntry[] = rows.map((row) => {
      const entry: AuditEntry = {
        id: row.id,
        tenantId: row.tenantId,
        userId: row.userId,
        action: row.action as AuditAction,
        resourceType: row.resourceType as AuditResourceType,
        resourceId: row.resourceId,
        timestamp: row.timestamp,
      };

      if (row.metadata != null) {
        entry.metadata = row.metadata as Record<string, unknown>;
      }
      if (row.ipAddress != null) {
        entry.ipAddress = row.ipAddress;
      }
      if (row.userAgent != null) {
        entry.userAgent = row.userAgent;
      }

      return entry;
    });

    return {
      entries,
      total,
      hasMore: offset + entries.length < total,
    };
  });
}

/**
 * Get audit entries for a specific resource.
 * Useful for showing access history on a detail page.
 *
 * @param tenantId - Tenant identifier
 * @param resourceType - Type of resource
 * @param resourceId - Resource identifier
 * @param limit - Maximum entries to return
 * @returns Recent audit entries for the resource
 */
export async function getResourceAuditHistory(
  tenantId: ID,
  resourceType: AuditResourceType,
  resourceId: string,
  limit = 100
): Promise<AuditEntry[]> {
  const result = await queryAuditLog({
    tenantId,
    resourceType,
    resourceId,
    limit,
  });

  return result.entries;
}

/**
 * Get audit entries for a specific user.
 * Useful for user activity reports and compliance audits.
 *
 * @param tenantId - Tenant identifier
 * @param userId - User identifier
 * @param options - Query options
 * @returns Audit entries for the user
 */
export async function getUserAuditHistory(
  tenantId: ID,
  userId: string,
  options?: { from?: Date; to?: Date; limit?: number }
): Promise<AuditEntry[]> {
  const filters: AuditQueryFilters = {
    tenantId,
    userId,
  };

  if (options?.from !== undefined) {
    filters.from = options.from;
  }
  if (options?.to !== undefined) {
    filters.to = options.to;
  }
  if (options?.limit !== undefined) {
    filters.limit = options.limit;
  }

  const result = await queryAuditLog(filters);

  return result.entries;
}

// =============================================================================
// CLEANUP & SHUTDOWN
// =============================================================================

/**
 * Gracefully shutdown the audit system.
 * Flushes any pending entries before returning.
 */
export async function shutdownAuditSystem(): Promise<void> {
  if (auditQueue) {
    await auditQueue.shutdown();
    auditQueue = null;
  }
}

// =============================================================================
// HELPER FUNCTIONS FOR ROUTES
// =============================================================================

/**
 * Extract request metadata for audit logging.
 * Helper function to standardize metadata extraction from requests.
 *
 * @param request - Fastify request object
 * @returns Metadata object with IP and user agent
 */
export function extractRequestMetadata(request: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}): { ipAddress?: string; userAgent?: string } {
  const userAgentHeader = request.headers?.['user-agent'];
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;

  const result: { ipAddress?: string; userAgent?: string } = {};

  if (request.ip !== undefined) {
    result.ipAddress = request.ip;
  }
  if (userAgent !== undefined) {
    result.userAgent = userAgent;
  }

  return result;
}
