/**
 * GDPR Data Export Service
 *
 * Provides GDPR-compliant data export functionality for the INTENT module.
 * Supports right to access (data export) and right to erasure (soft delete).
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { Queue, Worker, Job } from 'bullmq';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { createLogger } from '../common/logger.js';
import { getConfig } from '../common/config.js';
import { getRedis } from '../common/redis.js';
import { getDatabase, withLongQueryTimeout } from '../common/db.js';
import { createAuditService, createAuditHelper } from '../audit/index.js';
import {
  withCircuitBreaker,
  CircuitBreakerOpenError,
} from '../common/circuit-breaker.js';
import type { ID } from '../common/types.js';
import {
  intents,
  intentEvents,
  intentEvaluations,
  escalations,
  auditRecords,
} from './schema.js';

const logger = createLogger({ component: 'gdpr' });
const config = getConfig();

// =============================================================================
// TYPES
// =============================================================================

export type GdprExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';

export interface GdprExportRequest {
  id: ID;
  userId: ID;
  tenantId: ID;
  status: GdprExportStatus;
  requestedAt: string;
  completedAt?: string;
  expiresAt?: string;
  downloadUrl?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface GdprExportData {
  exportId: ID;
  userId: ID;
  tenantId: ID;
  exportTimestamp: string;
  dataCategories: string[];
  retentionPeriods: Record<string, string>;
  data: {
    intents: GdprIntentData[];
    events: GdprEventData[];
    escalations: GdprEscalationData[];
    auditRecords: GdprAuditData[];
  };
  metadata: {
    totalRecords: number;
    exportVersion: string;
    gdprArticle: string;
  };
}

export interface GdprIntentData {
  id: ID;
  goal: string;
  intentType: string | null;
  status: string;
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface GdprEventData {
  id: ID;
  intentId: ID;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface GdprEscalationData {
  id: ID;
  intentId: ID;
  reason: string;
  reasonCategory: string;
  escalatedTo: string;
  status: string;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface GdprAuditData {
  id: ID;
  eventType: string;
  action: string;
  outcome: string;
  eventTime: string;
  metadata?: Record<string, unknown>;
}

export interface GdprErasureResult {
  userId: ID;
  tenantId: ID;
  erasedAt: string;
  counts: {
    intents: number;
    events: number;
    escalations: number;
  };
}

// =============================================================================
// GDPR SERVICE
// =============================================================================

/**
 * GDPR Service for data export and erasure
 */
export class GdprService {
  private db = getDatabase();
  private redis = getRedis();
  private auditService = createAuditService();
  private auditHelper = createAuditHelper(this.auditService);
  private readonly cachePrefix = 'gdpr:export:';
  private readonly exportTtlSeconds = 24 * 60 * 60; // 24 hours

  /**
   * Export all user data for GDPR compliance (Article 15 - Right of Access)
   * Uses extended statement timeout for complex multi-table queries.
   * Protected by circuit breaker to prevent cascading failures.
   *
   * @param userId - The user/entity ID to export data for
   * @param tenantId - The tenant context
   * @returns Complete export data structure
   * @throws StatementTimeoutError if the query exceeds the long query timeout
   * @throws CircuitBreakerOpenError if the GDPR service circuit breaker is open
   */
  async exportUserData(userId: ID, tenantId: ID): Promise<GdprExportData> {
    const exportId = randomUUID();
    const exportTimestamp = new Date().toISOString();

    logger.info({ userId, tenantId, exportId }, 'Starting GDPR data export');

    // Wrap the entire export in circuit breaker protection
    return withCircuitBreaker('gdprService', async () => {
      // Use long query timeout for GDPR exports as they can involve complex joins
      return withLongQueryTimeout(async () => {
        // Fetch all user intents (including soft-deleted for complete history)
        const userIntents = await this.db
          .select()
          .from(intents)
          .where(
            and(
              eq(intents.entityId, userId),
              eq(intents.tenantId, tenantId)
            )
          )
          .orderBy(desc(intents.createdAt));

        const intentIds = userIntents.map((i) => i.id);

        // Fetch events for all user intents
        let userEvents: typeof intentEvents.$inferSelect[] = [];
        if (intentIds.length > 0) {
          userEvents = await this.db
            .select()
            .from(intentEvents)
            .where(inArray(intentEvents.intentId, intentIds))
            .orderBy(desc(intentEvents.occurredAt));
        }

        // Fetch escalations for user intents
        let userEscalations: typeof escalations.$inferSelect[] = [];
        if (intentIds.length > 0) {
          userEscalations = await this.db
            .select()
            .from(escalations)
            .where(
              and(
                inArray(escalations.intentId, intentIds),
                eq(escalations.tenantId, tenantId)
              )
            )
            .orderBy(desc(escalations.createdAt));
        }

        // Fetch audit records where user is the actor or target
        const userAuditRecords = await this.db
          .select()
          .from(auditRecords)
          .where(
            and(
              eq(auditRecords.tenantId, tenantId),
              eq(auditRecords.actorId, userId)
            )
          )
          .orderBy(desc(auditRecords.eventTime))
          .limit(1000); // Limit audit records to prevent massive exports

      // Transform data to GDPR export format
      const exportData: GdprExportData = {
        exportId,
        userId,
        tenantId,
        exportTimestamp,
        dataCategories: [
          'intents',
          'intent_events',
          'escalations',
          'audit_records',
        ],
        retentionPeriods: {
          intents: config.intent.softDeleteRetentionDays
            ? `${config.intent.softDeleteRetentionDays} days after deletion`
            : '90 days after deletion',
          intent_events: config.intent.eventRetentionDays
            ? `${config.intent.eventRetentionDays} days`
            : '365 days',
          escalations: 'Retained with associated intent',
          audit_records: config.audit?.retentionDays
            ? `${config.audit.retentionDays} days`
            : '2555 days (7 years)',
        },
        data: {
          intents: userIntents.map((intent) => ({
            id: intent.id,
            goal: intent.goal,
            intentType: intent.intentType,
            status: intent.status,
            context: (intent.context ?? {}) as Record<string, unknown>,
            metadata: (intent.metadata ?? {}) as Record<string, unknown>,
            createdAt: intent.createdAt.toISOString(),
            updatedAt: intent.updatedAt.toISOString(),
            deletedAt: intent.deletedAt?.toISOString() ?? null,
          })),
          events: userEvents.map((event) => ({
            id: event.id,
            intentId: event.intentId,
            eventType: event.eventType,
            payload: (event.payload ?? {}) as Record<string, unknown>,
            occurredAt: event.occurredAt.toISOString(),
          })),
          escalations: userEscalations.map((esc) => ({
            id: esc.id,
            intentId: esc.intentId,
            reason: esc.reason,
            reasonCategory: esc.reasonCategory,
            escalatedTo: esc.escalatedTo,
            status: esc.status,
            createdAt: esc.createdAt.toISOString(),
            resolvedAt: esc.resolvedAt?.toISOString() ?? null,
          })),
          auditRecords: userAuditRecords.map((record) => ({
            id: record.id,
            eventType: record.eventType,
            action: record.action,
            outcome: record.outcome,
            eventTime: record.eventTime.toISOString(),
            metadata: (record.metadata ?? undefined) as Record<string, unknown> | undefined,
          })),
        },
        metadata: {
          totalRecords:
            userIntents.length +
            userEvents.length +
            userEscalations.length +
            userAuditRecords.length,
          exportVersion: '1.0',
          gdprArticle: 'Article 15 - Right of Access',
        },
      };

      logger.info(
        {
          userId,
          tenantId,
          exportId,
          intentsCount: userIntents.length,
          eventsCount: userEvents.length,
          escalationsCount: userEscalations.length,
          auditCount: userAuditRecords.length,
        },
        'GDPR data export completed'
      );

        return exportData;
      }, 'exportUserData');
    });
  }

  /**
   * Create an async export request (queues the export job)
   *
   * @param userId - The user/entity ID to export data for
   * @param tenantId - The tenant context
   * @param requestedBy - User who initiated the request
   * @returns Export request record
   */
  async createExportRequest(
    userId: ID,
    tenantId: ID,
    requestedBy: ID
  ): Promise<GdprExportRequest> {
    const requestId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.exportTtlSeconds * 1000);

    const request: GdprExportRequest = {
      id: requestId,
      userId,
      tenantId,
      status: 'pending',
      requestedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      metadata: {
        requestedBy,
      },
    };

    // Store request in Redis
    await this.redis.set(
      this.cachePrefix + requestId,
      JSON.stringify(request),
      'EX',
      this.exportTtlSeconds
    );

    // Record audit event
    await this.auditHelper.recordIntentEvent(
      tenantId,
      'data.exported',
      requestId,
      { type: 'user', id: requestedBy },
      {
        outcome: 'success',
        metadata: {
          gdprAction: 'export_request_created',
          targetUserId: userId,
          expiresAt: expiresAt.toISOString(),
        },
      }
    );

    logger.info(
      { requestId, userId, tenantId, requestedBy },
      'GDPR export request created'
    );

    return request;
  }

  /**
   * Get export request status
   *
   * @param requestId - The export request ID
   * @param tenantId - The tenant context for validation
   * @returns Export request or null if not found/expired
   */
  async getExportRequest(
    requestId: ID,
    tenantId: ID
  ): Promise<GdprExportRequest | null> {
    const cached = await this.redis.get(this.cachePrefix + requestId);
    if (!cached) return null;

    const request = JSON.parse(cached) as GdprExportRequest;

    // Validate tenant
    if (request.tenantId !== tenantId) {
      return null;
    }

    // Check if expired
    if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
      request.status = 'expired';
    }

    return request;
  }

  /**
   * Update export request status
   *
   * @param requestId - The export request ID
   * @param updates - Fields to update
   */
  async updateExportRequest(
    requestId: ID,
    updates: Partial<GdprExportRequest>
  ): Promise<GdprExportRequest | null> {
    const cached = await this.redis.get(this.cachePrefix + requestId);
    if (!cached) return null;

    const request = JSON.parse(cached) as GdprExportRequest;
    const updated: GdprExportRequest = { ...request, ...updates };

    // Calculate remaining TTL
    const ttl = await this.redis.ttl(this.cachePrefix + requestId);
    if (ttl > 0) {
      await this.redis.set(
        this.cachePrefix + requestId,
        JSON.stringify(updated),
        'EX',
        ttl
      );
    }

    return updated;
  }

  /**
   * Store completed export data
   *
   * @param requestId - The export request ID
   * @param data - The export data
   */
  async storeExportData(requestId: ID, data: GdprExportData): Promise<string> {
    const dataKey = `${this.cachePrefix}data:${requestId}`;

    // Store the export data
    await this.redis.set(
      dataKey,
      JSON.stringify(data),
      'EX',
      this.exportTtlSeconds
    );

    // Generate download URL (in production, this would be a signed URL or file storage)
    const downloadUrl = `/api/v1/intent/gdpr/export/${requestId}/download`;

    // Update request with download URL
    await this.updateExportRequest(requestId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      downloadUrl,
    });

    return downloadUrl;
  }

  /**
   * Get stored export data for download
   *
   * @param requestId - The export request ID
   * @param tenantId - The tenant context for validation
   * @returns Export data or null if not found/expired
   */
  async getExportData(
    requestId: ID,
    tenantId: ID
  ): Promise<GdprExportData | null> {
    // First verify the request
    const request = await this.getExportRequest(requestId, tenantId);
    if (!request || request.status !== 'completed') {
      return null;
    }

    const dataKey = `${this.cachePrefix}data:${requestId}`;
    const cached = await this.redis.get(dataKey);
    if (!cached) return null;

    return JSON.parse(cached) as GdprExportData;
  }

  /**
   * Soft delete all user data (Article 17 - Right to Erasure)
   * Protected by circuit breaker to prevent cascading failures.
   *
   * @param userId - The user/entity ID to erase data for
   * @param tenantId - The tenant context
   * @param erasedBy - User who initiated the erasure
   * @returns Erasure result with counts
   * @throws CircuitBreakerOpenError if the GDPR service circuit breaker is open
   */
  async eraseUserData(
    userId: ID,
    tenantId: ID,
    erasedBy: ID
  ): Promise<GdprErasureResult> {
    const now = new Date();

    logger.info({ userId, tenantId, erasedBy }, 'Starting GDPR data erasure');

    // Wrap the entire erasure operation in circuit breaker protection
    return withCircuitBreaker('gdprService', async () => {
      // Get all user intents
      const userIntents = await this.db
        .select({ id: intents.id })
        .from(intents)
        .where(
          and(
            eq(intents.entityId, userId),
            eq(intents.tenantId, tenantId)
          )
        );

      const intentIds = userIntents.map((i) => i.id);

      // Soft delete intents (clear PII but keep audit trail)
      const intentResult = await this.db
        .update(intents)
        .set({
          deletedAt: now,
          updatedAt: now,
          context: {}, // Clear sensitive data
          metadata: { erasedAt: now.toISOString(), erasedBy },
          goal: '[ERASED]',
        })
        .where(
          and(
            eq(intents.entityId, userId),
            eq(intents.tenantId, tenantId)
          )
        )
        .returning({ id: intents.id });

      // Clear event payloads for erased intents
      let eventsCleared = 0;
      if (intentIds.length > 0) {
        const eventResult = await this.db
          .update(intentEvents)
          .set({
            payload: { erased: true, erasedAt: now.toISOString() },
          })
          .where(inArray(intentEvents.intentId, intentIds))
          .returning({ id: intentEvents.id });

        eventsCleared = eventResult.length;
      }

      // Mark escalations as erased
      let escalationsMarked = 0;
      if (intentIds.length > 0) {
        const escalationResult = await this.db
          .update(escalations)
          .set({
            metadata: { erased: true, erasedAt: now.toISOString(), erasedBy },
            context: null,
            updatedAt: now,
          })
          .where(
            and(
              inArray(escalations.intentId, intentIds),
              eq(escalations.tenantId, tenantId)
            )
          )
          .returning({ id: escalations.id });

        escalationsMarked = escalationResult.length;
      }

      const result: GdprErasureResult = {
        userId,
        tenantId,
        erasedAt: now.toISOString(),
        counts: {
          intents: intentResult.length,
          events: eventsCleared,
          escalations: escalationsMarked,
        },
      };

      // Record audit event for erasure
      await this.auditService.record({
        tenantId,
        eventType: 'data.deleted',
        actor: { type: 'user', id: erasedBy },
        target: { type: 'user', id: userId },
        action: 'gdpr_erasure',
        outcome: 'success',
        metadata: {
          gdprArticle: 'Article 17 - Right to Erasure',
          counts: result.counts,
        },
      });

      logger.info(
        { userId, tenantId, erasedBy, counts: result.counts },
        'GDPR data erasure completed'
      );

      return result;
    });
  }
}

// =============================================================================
// GDPR EXPORT QUEUE
// =============================================================================

const GDPR_EXPORT_QUEUE_NAME = 'gdpr:export';

let gdprExportQueue: Queue | null = null;
let gdprExportWorker: Worker | null = null;
let gdprService: GdprService | null = null;

/**
 * Get or create the GDPR export queue
 */
export function getGdprExportQueue(): Queue {
  if (!gdprExportQueue) {
    const redis = getRedis();
    gdprExportQueue = new Queue(GDPR_EXPORT_QUEUE_NAME, {
      connection: redis.duplicate(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          age: 24 * 60 * 60, // Keep completed jobs for 24 hours
          count: 100,
        },
        removeOnFail: false,
      },
    });
  }
  return gdprExportQueue;
}

/**
 * Enqueue a GDPR export job
 *
 * @param requestId - The export request ID
 * @param userId - The user to export data for
 * @param tenantId - The tenant context
 */
export async function enqueueGdprExport(
  requestId: ID,
  userId: ID,
  tenantId: ID
): Promise<void> {
  const queue = getGdprExportQueue();
  await queue.add('export', {
    requestId,
    userId,
    tenantId,
    enqueuedAt: new Date().toISOString(),
  });

  logger.info({ requestId, userId, tenantId }, 'GDPR export job enqueued');
}

/**
 * Process GDPR export jobs
 */
async function processGdprExportJob(
  job: Job<{ requestId: ID; userId: ID; tenantId: ID }>
): Promise<void> {
  const { requestId, userId, tenantId } = job.data;

  logger.info({ requestId, userId, tenantId }, 'Processing GDPR export job');

  if (!gdprService) {
    gdprService = new GdprService();
  }

  try {
    // Update status to processing
    await gdprService.updateExportRequest(requestId, { status: 'processing' });

    // Perform the export
    const exportData = await gdprService.exportUserData(userId, tenantId);

    // Store the export data and get download URL
    await gdprService.storeExportData(requestId, exportData);

    logger.info(
      { requestId, userId, tenantId, recordCount: exportData.metadata.totalRecords },
      'GDPR export job completed'
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await gdprService.updateExportRequest(requestId, {
      status: 'failed',
      error: errorMessage,
    });

    logger.error(
      { requestId, userId, tenantId, error: errorMessage },
      'GDPR export job failed'
    );

    throw error;
  }
}

/**
 * Register GDPR export worker
 */
export function registerGdprWorker(): void {
  if (gdprExportWorker) return;

  const redis = getRedis();
  gdprExportWorker = new Worker(
    GDPR_EXPORT_QUEUE_NAME,
    processGdprExportJob,
    {
      connection: redis.duplicate(),
      concurrency: 2, // Limit concurrent exports to avoid overload
      lockDuration: 5 * 60 * 1000, // 5 minutes lock
    }
  );

  gdprExportWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'GDPR export worker completed job');
  });

  gdprExportWorker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, error: error.message },
      'GDPR export worker job failed'
    );
  });

  logger.info('GDPR export worker registered');
}

/**
 * Shutdown GDPR export worker
 */
export async function shutdownGdprWorker(): Promise<void> {
  if (gdprExportWorker) {
    await gdprExportWorker.close();
    gdprExportWorker = null;
    logger.info('GDPR export worker shutdown');
  }

  if (gdprExportQueue) {
    await gdprExportQueue.close();
    gdprExportQueue = null;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a new GDPR service instance
 */
export function createGdprService(): GdprService {
  return new GdprService();
}
