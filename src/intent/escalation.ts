/**
 * INTENT Escalation Service
 *
 * Manages human-in-the-loop approval workflows for high-risk intents.
 * Supports escalation creation, approval/rejection, and timeout handling.
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from '../common/logger.js';
import { getConfig } from '../common/config.js';
import { getRedis } from '../common/redis.js';
import type { ID } from '../common/types.js';
import {
  escalationsCreated,
  escalationResolutions,
  escalationPendingDuration,
  escalationsPending,
} from './metrics.js';

const logger = createLogger({ component: 'escalation' });

export type EscalationStatus = 'pending' | 'approved' | 'rejected' | 'timeout';

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
  metadata: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
}

export interface ResolveEscalationOptions {
  resolvedBy: string;
  notes?: string;
}

/**
 * Calculate timeout timestamp from ISO duration
 */
function calculateTimeout(isoDuration: string): Date {
  const now = new Date();

  // Parse ISO 8601 duration (simplified: PT1H, PT30M, P1D, etc.)
  const match = isoDuration.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) {
    throw new Error(`Invalid ISO duration: ${isoDuration}`);
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
 * Escalation Service
 */
export class EscalationService {
  private config = getConfig();
  private redis = getRedis();
  private readonly keyPrefix = 'escalation:';

  /**
   * Create a new escalation for an intent
   */
  async create(options: CreateEscalationOptions): Promise<EscalationRecord> {
    const timeout = options.timeout ?? this.config.intent.escalationTimeout ?? 'PT1H';
    const timeoutAt = calculateTimeout(timeout);

    const baseEscalation = {
      id: randomUUID(),
      intentId: options.intentId,
      tenantId: options.tenantId,
      reason: options.reason,
      reasonCategory: options.reasonCategory,
      escalatedTo: options.escalatedTo,
      status: 'pending' as const,
      timeout,
      timeoutAt: timeoutAt.toISOString(),
      metadata: options.metadata ?? {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const escalation: EscalationRecord = options.escalatedBy
      ? { ...baseEscalation, escalatedBy: options.escalatedBy }
      : baseEscalation;

    // Store in Redis with TTL slightly longer than timeout
    const ttlSeconds = Math.ceil((timeoutAt.getTime() - Date.now()) / 1000) + 3600; // +1 hour buffer
    await this.redis.set(
      this.keyPrefix + escalation.id,
      JSON.stringify(escalation),
      'EX',
      ttlSeconds
    );

    // Add to tenant's pending escalations set
    await this.redis.sadd(
      `${this.keyPrefix}pending:${options.tenantId}`,
      escalation.id
    );

    // Add to intent's escalation list
    await this.redis.rpush(
      `${this.keyPrefix}intent:${options.intentId}`,
      escalation.id
    );

    // Schedule timeout check
    await this.redis.zadd(
      `${this.keyPrefix}timeouts`,
      timeoutAt.getTime(),
      escalation.id
    );

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
  async get(id: ID): Promise<EscalationRecord | null> {
    const data = await this.redis.get(this.keyPrefix + id);
    if (!data) return null;
    return JSON.parse(data) as EscalationRecord;
  }

  /**
   * Get escalation by intent ID (most recent)
   */
  async getByIntentId(intentId: ID): Promise<EscalationRecord | null> {
    const ids = await this.redis.lrange(`${this.keyPrefix}intent:${intentId}`, -1, -1);
    if (!ids.length || !ids[0]) return null;
    return this.get(ids[0]);
  }

  /**
   * List pending escalations for a tenant
   */
  async listPending(tenantId: ID): Promise<EscalationRecord[]> {
    const ids = await this.redis.smembers(`${this.keyPrefix}pending:${tenantId}`);
    const escalations: EscalationRecord[] = [];

    for (const id of ids) {
      const escalation = await this.get(id);
      if (escalation && escalation.status === 'pending') {
        escalations.push(escalation);
      }
    }

    return escalations.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  /**
   * Approve an escalation
   */
  async approve(id: ID, options: ResolveEscalationOptions): Promise<EscalationRecord | null> {
    return this.resolve(id, 'approved', options);
  }

  /**
   * Reject an escalation
   */
  async reject(id: ID, options: ResolveEscalationOptions): Promise<EscalationRecord | null> {
    return this.resolve(id, 'rejected', options);
  }

  /**
   * Resolve an escalation (internal)
   */
  private async resolve(
    id: ID,
    status: 'approved' | 'rejected',
    options: ResolveEscalationOptions
  ): Promise<EscalationRecord | null> {
    const escalation = await this.get(id);
    if (!escalation) return null;
    if (escalation.status !== 'pending') {
      logger.warn({ escalationId: id, currentStatus: escalation.status }, 'Escalation already resolved');
      return escalation;
    }

    const now = new Date();
    const pendingDuration = (now.getTime() - new Date(escalation.createdAt).getTime()) / 1000;

    escalation.status = status;
    const baseResolution = {
      resolvedBy: options.resolvedBy,
      resolvedAt: now.toISOString(),
    };
    escalation.resolution = options.notes
      ? { ...baseResolution, notes: options.notes }
      : baseResolution;
    escalation.updatedAt = now.toISOString();

    // Update in Redis
    const ttl = await this.redis.ttl(this.keyPrefix + id);
    await this.redis.set(
      this.keyPrefix + id,
      JSON.stringify(escalation),
      'EX',
      Math.max(ttl, 86400) // Keep for at least 24 hours after resolution
    );

    // Remove from pending set
    await this.redis.srem(`${this.keyPrefix}pending:${escalation.tenantId}`, id);

    // Remove from timeout schedule
    await this.redis.zrem(`${this.keyPrefix}timeouts`, id);

    // Record metrics
    escalationResolutions.inc({
      tenant_id: escalation.tenantId,
      resolution: status,
    });
    escalationPendingDuration.observe(
      { tenant_id: escalation.tenantId, resolution: status },
      pendingDuration
    );
    escalationsPending.dec({ tenant_id: escalation.tenantId });

    logger.info(
      { escalationId: id, status, resolvedBy: options.resolvedBy, pendingDuration },
      'Escalation resolved'
    );

    return escalation;
  }

  /**
   * Process timed out escalations
   */
  async processTimeouts(): Promise<number> {
    const now = Date.now();
    const timedOutIds = await this.redis.zrangebyscore(
      `${this.keyPrefix}timeouts`,
      '-inf',
      now.toString()
    );

    let processed = 0;

    for (const id of timedOutIds) {
      const escalation = await this.get(id);
      if (!escalation || escalation.status !== 'pending') {
        await this.redis.zrem(`${this.keyPrefix}timeouts`, id);
        continue;
      }

      const pendingDuration = (now - new Date(escalation.createdAt).getTime()) / 1000;

      escalation.status = 'timeout';
      escalation.updatedAt = new Date().toISOString();

      // Update in Redis
      const ttl = await this.redis.ttl(this.keyPrefix + id);
      await this.redis.set(
        this.keyPrefix + id,
        JSON.stringify(escalation),
        'EX',
        Math.max(ttl, 86400)
      );

      // Remove from pending set
      await this.redis.srem(`${this.keyPrefix}pending:${escalation.tenantId}`, id);

      // Remove from timeout schedule
      await this.redis.zrem(`${this.keyPrefix}timeouts`, id);

      // Record metrics
      escalationResolutions.inc({
        tenant_id: escalation.tenantId,
        resolution: 'timeout',
      });
      escalationPendingDuration.observe(
        { tenant_id: escalation.tenantId, resolution: 'timeout' },
        pendingDuration
      );
      escalationsPending.dec({ tenant_id: escalation.tenantId });

      logger.warn(
        { escalationId: id, intentId: escalation.intentId },
        'Escalation timed out'
      );

      processed++;
    }

    return processed;
  }

  /**
   * Get escalation history for an intent
   */
  async getHistory(intentId: ID): Promise<EscalationRecord[]> {
    const ids = await this.redis.lrange(`${this.keyPrefix}intent:${intentId}`, 0, -1);
    const escalations: EscalationRecord[] = [];

    for (const id of ids) {
      const escalation = await this.get(id);
      if (escalation) {
        escalations.push(escalation);
      }
    }

    return escalations;
  }

  /**
   * Check if an intent has a pending escalation
   */
  async hasPendingEscalation(intentId: ID): Promise<boolean> {
    const escalation = await this.getByIntentId(intentId);
    return escalation?.status === 'pending';
  }
}

/**
 * Create a new escalation service instance
 */
export function createEscalationService(): EscalationService {
  return new EscalationService();
}
