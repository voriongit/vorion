/**
 * INTENT Escalation Service
 *
 * Manages human-in-the-loop approval workflows for high-risk intents.
 * Uses PostgreSQL as primary storage with Redis for caching and fast lookups.
 * Supports escalation creation, acknowledgment, approval/rejection, and timeout handling.
 */

import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, lt, lte, sql } from 'drizzle-orm';
import { createLogger } from '../common/logger.js';
import { getConfig } from '../common/config.js';
import { getRedis } from '../common/redis.js';
import { getDatabase } from '../common/db.js';
import type { ID } from '../common/types.js';
import { EscalationError, DatabaseError } from '../common/errors.js';
import {
  escalations,
  type EscalationRow,
  type NewEscalationRow,
} from './schema.js';
import {
  escalationsCreated,
  escalationResolutions,
  escalationPendingDuration,
  escalationsPending,
} from './metrics.js';

const logger = createLogger({ component: 'escalation' });

export type EscalationStatus = 'pending' | 'acknowledged' | 'approved' | 'rejected' | 'timeout' | 'cancelled';

export interface EscalationRecord {
  id: ID;
  intentId: ID;
  tenantId: ID;
  reason: string;
  reasonCategory: 'trust_insufficient' | 'high_risk' | 'policy_violation' | 'manual_review' | 'constraint_escalate';
  escalatedTo: string; // Role or user ID
  escalatedBy?: string;
  status: EscalationStatus;
  resolution?: {
    resolvedBy: string;
    resolvedAt: string;
    notes?: string;
  };
  timeout: string; // ISO duration (e.g., "PT1H" for 1 hour)
  timeoutAt: string; // ISO timestamp when escalation expires
  acknowledgedAt?: string;
  slaBreached: boolean;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEscalationOptions {
  intentId: ID;
  tenantId: ID;
  reason: string;
  reasonCategory: EscalationRecord['reasonCategory'];
  escalatedTo: string;
  escalatedBy?: string;
  timeout?: string; // ISO duration, defaults to config
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ResolveEscalationOptions {
  resolvedBy: string;
  notes?: string;
}

export interface ListEscalationFilters {
  tenantId: ID;
  status?: EscalationStatus | EscalationStatus[];
  intentId?: ID;
  escalatedTo?: string;
  limit?: number;
  cursor?: ID;
  includeSlaBreached?: boolean;
}

/**
 * Calculate timeout timestamp from ISO duration
 */
function calculateTimeout(isoDuration: string): Date {
  const now = new Date();

  // Parse ISO 8601 duration (simplified: PT1H, PT30M, P1D, etc.)
  const match = isoDuration.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) {
    throw new EscalationError(`Invalid ISO duration: ${isoDuration}`, { isoDuration });
  }

  const days = parseInt(match[1] ?? '0', 10);
  const hours = parseInt(match[2] ?? '0', 10);
  const minutes = parseInt(match[3] ?? '0', 10);
  const seconds = parseInt(match[4] ?? '0', 10);

  now.setDate(now.getDate() + days);
  now.setHours(now.getHours() + hours);
  now.setMinutes(now.getMinutes() + minutes);
  now.setSeconds(now.getSeconds() + seconds);

  return now;
}

/**
 * Map database row to EscalationRecord
 */
function mapRow(row: EscalationRow): EscalationRecord {
  const base: EscalationRecord = {
    id: row.id,
    intentId: row.intentId,
    tenantId: row.tenantId,
    reason: row.reason,
    reasonCategory: row.reasonCategory,
    escalatedTo: row.escalatedTo,
    status: row.status,
    timeout: row.timeout,
    timeoutAt: row.timeoutAt.toISOString(),
    slaBreached: row.slaBreached ?? false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  if (row.escalatedBy) {
    base.escalatedBy = row.escalatedBy;
  }

  if (row.acknowledgedAt) {
    base.acknowledgedAt = row.acknowledgedAt.toISOString();
  }

  if (row.resolvedBy && row.resolvedAt) {
    base.resolution = {
      resolvedBy: row.resolvedBy,
      resolvedAt: row.resolvedAt.toISOString(),
    };
    if (row.resolutionNotes) {
      base.resolution.notes = row.resolutionNotes;
    }
  }

  if (row.context) {
    base.context = row.context as Record<string, unknown>;
  }

  if (row.metadata) {
    base.metadata = row.metadata as Record<string, unknown>;
  }

  return base;
}

/**
 * Escalation Service with PostgreSQL persistence and Redis caching
 */
export class EscalationService {
  private config = getConfig();
  private redis = getRedis();
  private db = getDatabase();
  private readonly cachePrefix = 'escalation:cache:';
  private readonly indexPrefix = 'escalation:idx:';
  private readonly cacheTtlSeconds = 300; // 5 minutes cache TTL

  /**
   * Create a new escalation for an intent
   */
  async create(options: CreateEscalationOptions): Promise<EscalationRecord> {
    const timeout = options.timeout ?? this.config.intent.escalationTimeout ?? 'PT1H';
    const timeoutAt = calculateTimeout(timeout);
    const now = new Date();

    const newEscalation: NewEscalationRow = {
      id: randomUUID(),
      intentId: options.intentId,
      tenantId: options.tenantId,
      reason: options.reason,
      reasonCategory: options.reasonCategory,
      escalatedTo: options.escalatedTo,
      escalatedBy: options.escalatedBy ?? null,
      status: 'pending',
      timeout,
      timeoutAt,
      context: options.context ?? null,
      metadata: options.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    };

    // Insert into PostgreSQL
    const [row] = await this.db.insert(escalations).values(newEscalation).returning();
    if (!row) throw new DatabaseError('Failed to create escalation', { intentId: options.intentId });

    const escalation = mapRow(row);

    // Update Redis indexes for fast lookups
    await this.updateRedisIndexes(escalation, 'add');

    // Record metrics
    escalationsCreated.inc({
      tenant_id: options.tenantId,
      intent_type: (options.metadata?.intentType as string) ?? 'unknown',
      reason_category: options.reasonCategory,
    });
    escalationsPending.inc({ tenant_id: options.tenantId });

    logger.info(
      { escalationId: escalation.id, intentId: options.intentId, timeout },
      'Escalation created'
    );

    return escalation;
  }

  /**
   * Get an escalation by ID
   */
  async get(id: ID, tenantId?: ID): Promise<EscalationRecord | null> {
    // Try cache first
    const cached = await this.redis.get(this.cachePrefix + id);
    if (cached) {
      const escalation = JSON.parse(cached) as EscalationRecord;
      // Verify tenant if provided
      if (tenantId && escalation.tenantId !== tenantId) {
        return null;
      }
      return escalation;
    }

    // Query database
    const conditions = [eq(escalations.id, id)];
    if (tenantId) {
      conditions.push(eq(escalations.tenantId, tenantId));
    }

    const [row] = await this.db
      .select()
      .from(escalations)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

    if (!row) return null;

    const escalation = mapRow(row);

    // Populate cache
    await this.redis.set(
      this.cachePrefix + id,
      JSON.stringify(escalation),
      'EX',
      this.cacheTtlSeconds
    );

    return escalation;
  }

  /**
   * Get escalation by intent ID (most recent)
   */
  async getByIntentId(intentId: ID, tenantId?: ID): Promise<EscalationRecord | null> {
    const conditions = [eq(escalations.intentId, intentId)];
    if (tenantId) {
      conditions.push(eq(escalations.tenantId, tenantId));
    }

    const [row] = await this.db
      .select()
      .from(escalations)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .orderBy(desc(escalations.createdAt))
      .limit(1);

    if (!row) return null;
    return mapRow(row);
  }

  /**
   * List escalations with filters
   */
  async list(filters: ListEscalationFilters): Promise<EscalationRecord[]> {
    const { tenantId, status, intentId, escalatedTo, limit = 50, cursor } = filters;
    const conditions = [eq(escalations.tenantId, tenantId)];

    if (status) {
      if (Array.isArray(status)) {
        conditions.push(inArray(escalations.status, status));
      } else {
        conditions.push(eq(escalations.status, status));
      }
    }

    if (intentId) {
      conditions.push(eq(escalations.intentId, intentId));
    }

    if (escalatedTo) {
      conditions.push(eq(escalations.escalatedTo, escalatedTo));
    }

    // Cursor-based pagination
    if (cursor) {
      const [cursorEsc] = await this.db
        .select({ createdAt: escalations.createdAt })
        .from(escalations)
        .where(eq(escalations.id, cursor));

      if (cursorEsc?.createdAt) {
        conditions.push(lt(escalations.createdAt, cursorEsc.createdAt));
      }
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await this.db
      .select()
      .from(escalations)
      .where(whereClause)
      .orderBy(desc(escalations.createdAt))
      .limit(Math.min(limit, 100));

    return rows.map(mapRow);
  }

  /**
   * List pending escalations for a tenant (optimized with Redis index)
   */
  async listPending(tenantId: ID): Promise<EscalationRecord[]> {
    // Use Redis set for fast pending lookup
    const pendingIds = await this.redis.smembers(`${this.indexPrefix}pending:${tenantId}`);

    if (pendingIds.length === 0) {
      // Fall back to database if index is empty (cold start)
      return this.list({ tenantId, status: 'pending' });
    }

    // Fetch from database to ensure consistency
    const rows = await this.db
      .select()
      .from(escalations)
      .where(
        and(
          eq(escalations.tenantId, tenantId),
          eq(escalations.status, 'pending'),
          inArray(escalations.id, pendingIds)
        )
      )
      .orderBy(escalations.createdAt);

    return rows.map(mapRow);
  }

  /**
   * Acknowledge an escalation (SLA tracking)
   */
  async acknowledge(id: ID, tenantId: ID, acknowledgedBy: string): Promise<EscalationRecord | null> {
    const escalation = await this.get(id, tenantId);
    if (!escalation) return null;

    if (escalation.status !== 'pending') {
      logger.warn({ escalationId: id, currentStatus: escalation.status }, 'Cannot acknowledge non-pending escalation');
      return escalation;
    }

    const now = new Date();

    const [row] = await this.db
      .update(escalations)
      .set({
        status: 'acknowledged',
        acknowledgedAt: now,
        updatedAt: now,
        metadata: {
          ...(escalation.metadata ?? {}),
          acknowledgedBy,
        },
      })
      .where(
        and(
          eq(escalations.id, id),
          eq(escalations.tenantId, tenantId),
          eq(escalations.status, 'pending')
        )
      )
      .returning();

    if (!row) return escalation;

    const updated = mapRow(row);

    // Update cache and indexes
    await this.invalidateCache(id);
    await this.redis.srem(`${this.indexPrefix}pending:${tenantId}`, id);

    logger.info({ escalationId: id, acknowledgedBy }, 'Escalation acknowledged');

    return updated;
  }

  /**
   * Approve an escalation
   */
  async approve(id: ID, tenantId: ID, options: ResolveEscalationOptions): Promise<EscalationRecord | null> {
    return this.resolve(id, tenantId, 'approved', options);
  }

  /**
   * Reject an escalation
   */
  async reject(id: ID, tenantId: ID, options: ResolveEscalationOptions): Promise<EscalationRecord | null> {
    return this.resolve(id, tenantId, 'rejected', options);
  }

  /**
   * Cancel an escalation
   */
  async cancel(id: ID, tenantId: ID, options: ResolveEscalationOptions): Promise<EscalationRecord | null> {
    return this.resolve(id, tenantId, 'cancelled', options);
  }

  /**
   * Resolve an escalation (internal)
   */
  private async resolve(
    id: ID,
    tenantId: ID,
    status: 'approved' | 'rejected' | 'cancelled',
    options: ResolveEscalationOptions
  ): Promise<EscalationRecord | null> {
    const escalation = await this.get(id, tenantId);
    if (!escalation) return null;

    if (!['pending', 'acknowledged'].includes(escalation.status)) {
      logger.warn({ escalationId: id, currentStatus: escalation.status }, 'Escalation already resolved');
      return escalation;
    }

    const now = new Date();
    const pendingDuration = (now.getTime() - new Date(escalation.createdAt).getTime()) / 1000;

    // Check SLA breach
    const timeoutAt = new Date(escalation.timeoutAt);
    const slaBreached = now > timeoutAt;

    const [row] = await this.db
      .update(escalations)
      .set({
        status,
        resolvedBy: options.resolvedBy,
        resolvedAt: now,
        resolutionNotes: options.notes ?? null,
        slaBreached,
        updatedAt: now,
      })
      .where(
        and(
          eq(escalations.id, id),
          eq(escalations.tenantId, tenantId),
          inArray(escalations.status, ['pending', 'acknowledged'])
        )
      )
      .returning();

    if (!row) return escalation;

    const updated = mapRow(row);

    // Update cache and indexes
    await this.invalidateCache(id);
    await this.updateRedisIndexes(updated, 'remove');

    // Record metrics
    escalationResolutions.inc({
      tenant_id: tenantId,
      resolution: status,
    });
    escalationPendingDuration.observe(
      { tenant_id: tenantId, resolution: status },
      pendingDuration
    );
    escalationsPending.dec({ tenant_id: tenantId });

    logger.info(
      { escalationId: id, status, resolvedBy: options.resolvedBy, pendingDuration, slaBreached },
      'Escalation resolved'
    );

    return updated;
  }

  /**
   * Process timed out escalations
   */
  async processTimeouts(): Promise<number> {
    const now = new Date();

    // Find all pending/acknowledged escalations past timeout
    const timedOut = await this.db
      .select()
      .from(escalations)
      .where(
        and(
          inArray(escalations.status, ['pending', 'acknowledged']),
          lte(escalations.timeoutAt, now)
        )
      );

    let processed = 0;

    for (const row of timedOut) {
      const pendingDuration = (now.getTime() - row.createdAt.getTime()) / 1000;

      await this.db
        .update(escalations)
        .set({
          status: 'timeout',
          slaBreached: true,
          updatedAt: now,
        })
        .where(eq(escalations.id, row.id));

      // Update indexes
      await this.invalidateCache(row.id);
      await this.redis.srem(`${this.indexPrefix}pending:${row.tenantId}`, row.id);
      await this.redis.zrem(`${this.indexPrefix}timeouts`, row.id);

      // Record metrics
      escalationResolutions.inc({
        tenant_id: row.tenantId,
        resolution: 'timeout',
      });
      escalationPendingDuration.observe(
        { tenant_id: row.tenantId, resolution: 'timeout' },
        pendingDuration
      );
      escalationsPending.dec({ tenant_id: row.tenantId });

      logger.warn(
        { escalationId: row.id, intentId: row.intentId },
        'Escalation timed out'
      );

      processed++;
    }

    return processed;
  }

  /**
   * Get escalation history for an intent
   */
  async getHistory(intentId: ID, tenantId?: ID): Promise<EscalationRecord[]> {
    const conditions = [eq(escalations.intentId, intentId)];
    if (tenantId) {
      conditions.push(eq(escalations.tenantId, tenantId));
    }

    const rows = await this.db
      .select()
      .from(escalations)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .orderBy(escalations.createdAt);

    return rows.map(mapRow);
  }

  /**
   * Check if an intent has a pending escalation
   */
  async hasPendingEscalation(intentId: ID): Promise<boolean> {
    const escalation = await this.getByIntentId(intentId);
    return escalation?.status === 'pending' || escalation?.status === 'acknowledged';
  }

  /**
   * Get SLA breach statistics for a tenant
   */
  async getSlaStats(tenantId: ID, since?: Date): Promise<{
    total: number;
    breached: number;
    breachRate: number;
    avgResolutionTime: number;
  }> {
    const conditions = [eq(escalations.tenantId, tenantId)];
    if (since) {
      conditions.push(lte(escalations.createdAt, since));
    }

    const [stats] = await this.db
      .select({
        total: sql<number>`count(*)`,
        breached: sql<number>`count(*) filter (where ${escalations.slaBreached} = true)`,
        avgTime: sql<number>`avg(extract(epoch from (coalesce(${escalations.resolvedAt}, now()) - ${escalations.createdAt})))`,
      })
      .from(escalations)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

    const total = Number(stats?.total ?? 0);
    const breached = Number(stats?.breached ?? 0);
    const avgResolutionTime = Number(stats?.avgTime ?? 0);

    return {
      total,
      breached,
      breachRate: total > 0 ? breached / total : 0,
      avgResolutionTime,
    };
  }

  /**
   * Update Redis indexes for fast lookups
   */
  private async updateRedisIndexes(
    escalation: EscalationRecord,
    operation: 'add' | 'remove'
  ): Promise<void> {
    const pendingKey = `${this.indexPrefix}pending:${escalation.tenantId}`;
    const timeoutKey = `${this.indexPrefix}timeouts`;
    const intentKey = `${this.indexPrefix}intent:${escalation.intentId}`;

    if (operation === 'add' && ['pending', 'acknowledged'].includes(escalation.status)) {
      await this.redis.sadd(pendingKey, escalation.id);
      await this.redis.zadd(timeoutKey, new Date(escalation.timeoutAt).getTime(), escalation.id);
      await this.redis.rpush(intentKey, escalation.id);
    } else if (operation === 'remove') {
      await this.redis.srem(pendingKey, escalation.id);
      await this.redis.zrem(timeoutKey, escalation.id);
    }
  }

  /**
   * Invalidate cache for an escalation
   */
  private async invalidateCache(id: ID): Promise<void> {
    await this.redis.del(this.cachePrefix + id);
  }

  /**
   * Rebuild Redis indexes from PostgreSQL (for recovery/consistency)
   */
  async rebuildIndexes(tenantId?: ID): Promise<{ indexed: number }> {
    const conditions = tenantId ? [eq(escalations.tenantId, tenantId)] : [];

    // Get all pending/acknowledged escalations
    const pendingRows = await this.db
      .select()
      .from(escalations)
      .where(
        conditions.length > 0
          ? and(...conditions, inArray(escalations.status, ['pending', 'acknowledged']))
          : inArray(escalations.status, ['pending', 'acknowledged'])
      );

    // Clear existing indexes if tenant-specific
    if (tenantId) {
      await this.redis.del(`${this.indexPrefix}pending:${tenantId}`);
    }

    // Rebuild indexes
    for (const row of pendingRows) {
      const escalation = mapRow(row);
      await this.updateRedisIndexes(escalation, 'add');
    }

    logger.info({ tenantId, indexed: pendingRows.length }, 'Rebuilt escalation indexes');

    return { indexed: pendingRows.length };
  }
}

/**
 * Create a new escalation service instance
 */
export function createEscalationService(): EscalationService {
  return new EscalationService();
}
