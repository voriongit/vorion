/**
 * INTENT - Goal Processing
 *
 * Production-grade intent intake with validation, persistence, and audit events.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createLogger } from '../common/logger.js';
import { getConfig } from '../common/config.js';
import { getRedis } from '../common/redis.js';
import { getLockService } from '../common/lock.js';
import {
  VorionError,
  TrustInsufficientError,
} from '../common/types.js';
import {
  validateTransition,
  StateMachineError,
  canCancel,
  getTransitionEvent,
} from './state-machine.js';
import type {
  ID,
  Intent,
  IntentEvaluationRecord,
  IntentStatus,
  TrustLevel,
  TrustScore,
  EvaluationPayload,
} from '../common/types.js';
import {
  IntentRepository,
  type IntentEventRecord,
} from './repository.js';
import { enqueueIntentSubmission } from './queues.js';
import {
  recordIntentSubmission,
  recordTrustGateEvaluation,
  recordStatusTransition,
  recordError,
} from './metrics.js';

const logger = createLogger({ component: 'intent' });

const MAX_CONTEXT_BYTES = 64 * 1024;
const REDACTION_PLACEHOLDER = '[REDACTED]';

export const intentSubmissionSchema = z
  .object({
    entityId: z.string().uuid(),
    goal: z.string().min(1).max(1024),
    context: z.record(z.any()),
    metadata: z.record(z.any()).optional(),
    intentType: z.string().min(1).max(128).optional(),
    priority: z.number().int().min(0).max(9).default(0),
    idempotencyKey: z.string().max(128).optional(),
  })
  .superRefine((value, ctx) => {
    const contextBytes = Buffer.byteLength(
      JSON.stringify(value.context ?? {}),
      'utf8'
    );
    if (contextBytes > MAX_CONTEXT_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Context payload exceeds ${MAX_CONTEXT_BYTES} bytes`,
        path: ['context'],
      });
    }
  });

export type IntentSubmission = z.infer<typeof intentSubmissionSchema>;

export interface SubmitOptions {
  tenantId: ID;
  trustSnapshot?: Record<string, unknown> | null;
  /** Current trust level of the entity (for trust gate validation) */
  trustLevel?: TrustLevel;
  /** Skip trust gate validation (use with caution) */
  bypassTrustGate?: boolean;
}

export interface ListOptions {
  tenantId: ID;
  entityId?: ID;
  status?: IntentStatus;
  limit?: number;
  /** Cursor for pagination (last intent ID from previous page) */
  cursor?: ID;
}

export interface CancelOptions {
  tenantId: ID;
  reason: string;
  cancelledBy?: string;
}

export interface IntentWithEvents {
  intent: Intent;
  events: IntentEventRecord[];
  evaluations?: IntentEvaluationRecord[];
}

/**
 * Intent service for managing intent lifecycle
 */
export class IntentService {
  private config = getConfig();
  private redis = getRedis();

  constructor(private repository = new IntentRepository()) {}

  /**
   * Submit a new intent with trust gate validation and transaction support
   */
  async submit(payload: IntentSubmission, options: SubmitOptions): Promise<Intent> {
    // Trust gate validation with metrics
    if (!options.bypassTrustGate) {
      try {
        this.validateTrustGate(payload.intentType, options.trustLevel);
        recordTrustGateEvaluation(options.tenantId, payload.intentType, 'passed');
      } catch (error) {
        recordTrustGateEvaluation(options.tenantId, payload.intentType, 'rejected');
        recordIntentSubmission(options.tenantId, payload.intentType, 'rejected', options.trustLevel);
        throw error;
      }
    } else {
      recordTrustGateEvaluation(options.tenantId, payload.intentType, 'bypassed');
    }

    const dedupeHash = this.computeDedupeHash(options.tenantId, payload);
    const existing = await this.repository.findByDedupeHash(
      dedupeHash,
      options.tenantId
    );
    if (existing) {
      logger.info({ intentId: existing.id }, 'Returning existing intent (dedupe)');
      recordIntentSubmission(options.tenantId, payload.intentType, 'duplicate', options.trustLevel);
      return existing;
    }

    await this.enforceTenantLimits(options.tenantId);

    // Reserve dedupe key with race condition handling
    const raceResolved = await this.reserveDedupeKey(options.tenantId, dedupeHash);
    if (raceResolved) {
      recordIntentSubmission(options.tenantId, payload.intentType, 'duplicate', options.trustLevel);
      return raceResolved; // Another request completed the insert
    }

    // Use transaction to create intent and initial event atomically
    const intent = await this.repository.createIntentWithEvent(
      {
        tenantId: options.tenantId,
        entityId: payload.entityId,
        goal: payload.goal,
        intentType: payload.intentType ?? null,
        priority: payload.priority,
        status: 'pending',
        trustSnapshot: options.trustSnapshot ?? null,
        context: this.redactStructure(payload.context, 'context'),
        metadata: this.redactStructure(payload.metadata ?? {}, 'metadata'),
        dedupeHash,
      },
      {
        eventType: 'intent.submitted',
        payload: {
          goal: payload.goal,
          intentType: payload.intentType,
          priority: payload.priority,
          trustLevel: options.trustLevel,
        },
      }
    );

    // Record metrics
    recordIntentSubmission(options.tenantId, payload.intentType, 'success', options.trustLevel);
    recordStatusTransition(options.tenantId, 'new', 'pending');

    logger.info({ intentId: intent.id, tenantId: options.tenantId }, 'Intent submitted');

    try {
      await enqueueIntentSubmission(intent, {
        namespace: this.resolveNamespace(intent.intentType ?? undefined),
      });
    } catch (error) {
      logger.error({ error, intentId: intent.id }, 'Failed to enqueue intent submission');
      recordError('ENQUEUE_FAILED', 'intent-service');
    }
    return intent;
  }

  async get(id: ID, tenantId: ID): Promise<Intent | null> {
    return this.repository.findById(id, tenantId);
  }

  async getWithEvents(id: ID, tenantId: ID): Promise<IntentWithEvents | null> {
    const intent = await this.repository.findById(id, tenantId);
    if (!intent) return null;
    const events = await this.repository.getRecentEvents(intent.id);
    const evaluations = await this.repository.listEvaluations(intent.id);
    return { intent, events, evaluations };
  }

  async updateStatus(
    id: ID,
    tenantId: ID,
    status: IntentStatus,
    previousStatus?: IntentStatus,
    options?: { skipValidation?: boolean; hasReason?: boolean; hasPermission?: boolean }
  ): Promise<Intent | null> {
    // Get current intent to determine previous status if not provided
    const currentIntent = await this.repository.findById(id, tenantId);
    if (!currentIntent) return null;

    const fromStatus = previousStatus ?? currentIntent.status;

    // Validate state machine transition (unless explicitly skipped)
    if (!options?.skipValidation) {
      const validationOptions: { hasReason?: boolean; hasPermission?: boolean } = {};
      if (options?.hasReason !== undefined) {
        validationOptions.hasReason = options.hasReason;
      }
      if (options?.hasPermission !== undefined) {
        validationOptions.hasPermission = options.hasPermission;
      }

      const validationResult = validateTransition(fromStatus, status, validationOptions);

      if (!validationResult.valid) {
        throw new StateMachineError(validationResult, fromStatus, status);
      }
    }

    const intent = await this.repository.updateStatus(id, tenantId, status);
    if (intent) {
      // Record status transition metric
      recordStatusTransition(tenantId, fromStatus, status);

      // Get event type from state machine
      const eventType = getTransitionEvent(fromStatus, status) ?? 'intent.status.changed';

      await this.repository.recordEvent({
        intentId: intent.id,
        eventType,
        payload: { status, previousStatus: fromStatus },
      });
      logger.info({ intentId: intent.id, status, previousStatus: fromStatus }, 'Intent status updated');
    }
    return intent;
  }

  /**
   * Cancel an in-flight intent
   */
  async cancel(id: ID, options: CancelOptions): Promise<Intent | null> {
    // Get current status for metrics before cancellation
    const currentIntent = await this.repository.findById(id, options.tenantId);
    if (!currentIntent) return null;

    const previousStatus = currentIntent.status;

    // Validate cancellation is allowed from current state
    if (!canCancel(previousStatus)) {
      throw new VorionError(
        `Cannot cancel intent in '${previousStatus}' status`,
        'INVALID_STATE_TRANSITION'
      );
    }

    const intent = await this.repository.cancelIntent(
      id,
      options.tenantId,
      options.reason
    );

    if (intent) {
      // Record status transition metric
      recordStatusTransition(options.tenantId, previousStatus ?? 'pending', 'cancelled');

      const evaluationPayload: EvaluationPayload = options.cancelledBy
        ? { stage: 'cancelled', reason: options.reason, cancelledBy: options.cancelledBy }
        : { stage: 'cancelled', reason: options.reason };
      await this.repository.recordEvaluation({
        intentId: intent.id,
        tenantId: options.tenantId,
        result: evaluationPayload,
      });

      await this.repository.recordEvent({
        intentId: intent.id,
        eventType: 'intent.cancelled',
        payload: {
          reason: options.reason,
          cancelledBy: options.cancelledBy,
        },
      });

      logger.info(
        { intentId: intent.id, reason: options.reason },
        'Intent cancelled'
      );
    }

    return intent;
  }

  /**
   * Soft delete an intent (GDPR compliant)
   */
  async delete(id: ID, tenantId: ID): Promise<Intent | null> {
    const intent = await this.repository.softDelete(id, tenantId);

    if (intent) {
      await this.repository.recordEvent({
        intentId: intent.id,
        eventType: 'intent.deleted',
        payload: { deletedAt: intent.deletedAt },
      });
      logger.info({ intentId: intent.id }, 'Intent soft deleted');
    }

    return intent;
  }

  async list(options: ListOptions): Promise<Intent[]> {
    return this.repository.listIntents(options);
  }

  async updateTrustMetadata(
    id: ID,
    tenantId: ID,
    trustSnapshot: Record<string, unknown> | null,
    trustLevel?: TrustLevel,
    trustScore?: TrustScore
  ): Promise<Intent | null> {
    return this.repository.updateTrustMetadata(
      id,
      tenantId,
      trustSnapshot,
      trustLevel,
      trustScore
    );
  }

  async recordEvaluation(
    intentId: ID,
    tenantId: ID,
    payload: EvaluationPayload
  ): Promise<IntentEvaluationRecord> {
    return this.repository.recordEvaluation({
      intentId,
      tenantId,
      result: payload,
    });
  }

  /**
   * Verify event chain integrity for an intent
   */
  async verifyEventChain(intentId: ID): Promise<{
    valid: boolean;
    invalidAt?: number;
    error?: string;
  }> {
    return this.repository.verifyEventChain(intentId);
  }

  /**
   * Get minimum required trust level for an intent type
   */
  getRequiredTrustLevel(intentType?: string | null): TrustLevel {
    if (!intentType) {
      return this.config.intent.defaultMinTrustLevel as TrustLevel;
    }
    const gates = this.config.intent.trustGates;
    return (gates[intentType] ?? this.config.intent.defaultMinTrustLevel) as TrustLevel;
  }

  /**
   * Validate trust gate for intent submission
   */
  private validateTrustGate(intentType?: string, trustLevel?: TrustLevel): void {
    const requiredLevel = this.getRequiredTrustLevel(intentType);
    const actualLevel = trustLevel ?? 0;

    if (actualLevel < requiredLevel) {
      throw new TrustInsufficientError(requiredLevel as TrustLevel, actualLevel as TrustLevel);
    }
  }

  private async enforceTenantLimits(tenantId: ID): Promise<void> {
    const maxInFlight =
      this.config.intent.tenantMaxInFlight[tenantId] ??
      this.config.intent.defaultMaxInFlight;
    if (!maxInFlight) return;
    const inFlight = await this.repository.countActiveIntents(tenantId);
    if (inFlight >= maxInFlight) {
      throw new VorionError(
        `Tenant ${tenantId} exceeded concurrent intent limit (${maxInFlight})`,
        'INTENT_RATE_LIMIT'
      );
    }
  }

  /**
   * Reserve dedupe key with proper distributed locking.
   * Uses exponential backoff and proper lock semantics to handle race conditions.
   * Returns null if reservation succeeded, or an existing Intent if found after conflict.
   */
  private async reserveDedupeKey(
    tenantId: ID,
    dedupeHash: string
  ): Promise<Intent | null> {
    const lockService = getLockService();
    const lockKey = `intent:dedupe:${tenantId}:${dedupeHash}`;

    // Try to acquire a distributed lock
    const lockResult = await lockService.acquire(lockKey, {
      lockTimeoutMs: 30000, // Hold lock for max 30 seconds
      acquireTimeoutMs: 5000, // Wait up to 5 seconds to acquire
      retryDelayMs: 50, // Start with 50ms retry delay
      maxRetryDelayMs: 500, // Max 500ms between retries
      jitterFactor: 0.25, // 25% jitter
    });

    if (!lockResult.acquired || !lockResult.lock) {
      // Could not acquire lock - check if intent was created by another request
      const existing = await this.repository.findByDedupeHash(dedupeHash, tenantId);
      if (existing) {
        logger.info({ intentId: existing.id }, 'Race resolved: returning existing intent');
        return existing;
      }

      // Lock acquisition timed out and no existing intent found
      throw new VorionError(
        'Intent submission in progress, please retry',
        'INTENT_LOCKED'
      );
    }

    try {
      // Double-check database while holding lock
      const existing = await this.repository.findByDedupeHash(dedupeHash, tenantId);
      if (existing) {
        logger.info({ intentId: existing.id }, 'Intent already exists (found under lock)');
        return existing;
      }

      // Also set a Redis key for faster dedupe checks (optimization)
      const ttl = this.config.intent.dedupeTtlSeconds;
      const dedupeKey = `intent:dedupe:marker:${tenantId}:${dedupeHash}`;
      await this.redis.set(dedupeKey, '1', 'EX', ttl);

      return null; // Reservation succeeded, caller should proceed with insert
    } finally {
      // Release the lock after insert is complete (caller will release via callback)
      // Note: In a more robust implementation, we'd pass the lock to the caller
      // For now, we release immediately since the DB unique constraint is the final guard
      await lockResult.lock.release();
    }
  }

  private resolveNamespace(intentType?: string | null): string {
    if (!intentType) return this.config.intent.defaultNamespace;
    return (
      this.config.intent.namespaceRouting[intentType] ??
      this.config.intent.defaultNamespace
    );
  }

  private redactStructure(
    payload: Record<string, unknown>,
    prefix: 'context' | 'metadata'
  ): Record<string, unknown> {
    const cloned = JSON.parse(JSON.stringify(payload ?? {}));
    const prefixWithDot = `${prefix}.`;
    const relevant = this.config.intent.sensitivePaths
      .filter((path) => path.startsWith(prefixWithDot))
      .map((path) => path.slice(prefixWithDot.length));

    for (const path of relevant) {
      this.applyRedaction(cloned, path.split('.'));
    }

    return cloned;
  }

  private applyRedaction(target: Record<string, unknown>, parts: string[]): void {
    if (!parts.length) {
      return;
    }

    let current: Record<string, unknown> = target;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      if (i === parts.length - 1) {
        if (current && typeof current === 'object' && part in current) {
          current[part] = REDACTION_PLACEHOLDER;
        }
        return;
      }

      if (current && typeof current === 'object' && part in current) {
        const next = current[part];
        if (next && typeof next === 'object') {
          current = next as Record<string, unknown>;
        } else {
          return;
        }
      } else {
        return;
      }
    }
  }

  private computeDedupeHash(tenantId: ID, payload: IntentSubmission): string {
    const hash = createHash('sha256');
    hash.update(tenantId);
    hash.update(payload.entityId);
    hash.update(payload.goal);
    hash.update(JSON.stringify(payload.context ?? {}));
    if (payload.intentType) {
      hash.update(payload.intentType);
    }
    if (payload.idempotencyKey) {
      hash.update(payload.idempotencyKey);
    }
    return hash.digest('hex');
  }
}

/**
 * Create a new intent service instance
 */
export function createIntentService(): IntentService {
  return new IntentService();
}
