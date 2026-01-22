/**
 * INTENT - Goal Processing
 *
 * Production-grade intent intake with validation, persistence, and audit events.
 */

import { createHash, createHmac } from 'node:crypto';
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
  type PaginatedResult,
} from './repository.js';
import { enqueueIntentSubmission, enqueueIntentSubmissionsBatch } from './queues.js';
import {
  ConsentService,
  ConsentRequiredError,
  type ConsentValidationResult,
} from './consent.js';
import {
  recordIntentSubmission,
  recordTrustGateEvaluation,
  recordStatusTransition,
  recordError,
  recordLockContention,
  recordTrustGateBypass,
  recordDeduplication,
  recordIntentContextSize,
  recordBatchOperation,
} from './metrics.js';
import {
  traceDedupeCheck,
  traceLockAcquire,
  recordDedupeResult,
  recordLockResult,
} from './tracing.js';

const logger = createLogger({ component: 'intent' });

// Type-safe JSON value schema for proper validation instead of z.unknown()
const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ])
);

// Payload size limits for security and performance
const MAX_PAYLOAD_SIZE_BYTES = 1024 * 1024; // 1MB max total payload
const MAX_CONTEXT_BYTES = 64 * 1024; // 64KB max context (backward compatible)
const MAX_CONTEXT_KEYS = 100;
const MAX_STRING_LENGTH = 10000;
const REDACTION_PLACEHOLDER = '[REDACTED]';

/** Export constants for use in tests and configuration */
export const PAYLOAD_LIMITS = {
  MAX_PAYLOAD_SIZE_BYTES,
  MAX_CONTEXT_BYTES,
  MAX_CONTEXT_KEYS,
  MAX_STRING_LENGTH,
} as const;

/**
 * Schema for validating intent payload records with size limits
 */
export const intentPayloadSchema = z.record(jsonValueSchema)
  .refine(
    (payload) => {
      const size = Buffer.byteLength(JSON.stringify(payload), 'utf8');
      return size <= MAX_PAYLOAD_SIZE_BYTES;
    },
    { message: `Payload exceeds maximum size of ${MAX_PAYLOAD_SIZE_BYTES} bytes` }
  )
  .refine(
    (payload) => Object.keys(payload).length <= MAX_CONTEXT_KEYS,
    { message: `Payload exceeds maximum of ${MAX_CONTEXT_KEYS} keys` }
  );

export const intentSubmissionSchema = z
  .object({
    entityId: z.string().uuid(),
    goal: z.string().min(1).max(MAX_STRING_LENGTH),
    context: intentPayloadSchema,
    metadata: z.record(jsonValueSchema).optional(),
    intentType: z.string().max(100).optional(),
    priority: z.number().int().min(0).max(10).default(0),
    idempotencyKey: z.string().max(255).optional(),
  })
  .superRefine((value, ctx) => {
    // Check total payload size
    const totalPayloadBytes = Buffer.byteLength(
      JSON.stringify(value),
      'utf8'
    );
    if (totalPayloadBytes > MAX_PAYLOAD_SIZE_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Total payload exceeds maximum size of ${MAX_PAYLOAD_SIZE_BYTES} bytes`,
        path: [],
      });
    }

    // Check context size (backward compatible with original limit)
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

/**
 * Schema for bulk intent submission options
 */
export const bulkIntentOptionsSchema = z.object({
  /** Stop processing on first error (default: false - continue processing all items) */
  stopOnError: z.boolean().default(false),
  /** Return successful items even if some fail (default: true) */
  returnPartial: z.boolean().default(true),
});

export type BulkIntentOptions = z.infer<typeof bulkIntentOptionsSchema>;

/**
 * Schema for bulk intent submission request
 */
export const bulkIntentSubmissionSchema = z.object({
  /** Array of intents to submit (1-100 items) */
  intents: z.array(intentSubmissionSchema).min(1).max(100),
  /** Optional processing options */
  options: bulkIntentOptionsSchema.optional(),
});

export type BulkIntentSubmission = z.infer<typeof bulkIntentSubmissionSchema>;

/**
 * Result for a single failed intent in bulk submission
 */
export interface BulkIntentFailure {
  /** Index of the failed intent in the original array */
  index: number;
  /** The original input that failed */
  input: IntentSubmission;
  /** Error message describing the failure */
  error: string;
}

/**
 * Result of bulk intent submission
 */
export interface BulkIntentResult {
  /** Successfully created intents */
  successful: Intent[];
  /** Failed intents with error details */
  failed: BulkIntentFailure[];
  /** Summary statistics */
  stats: {
    /** Total number of intents in the request */
    total: number;
    /** Number of successfully created intents */
    succeeded: number;
    /** Number of failed intents */
    failed: number;
  };
}

/**
 * Result of true batch intent submission (atomic operation)
 */
export interface BulkBatchResult {
  /** Successfully created intents (all or none in atomic mode) */
  intents: Intent[];
  /** Validation failures (pre-transaction) */
  validationErrors: Array<{
    index: number;
    input: IntentSubmission;
    error: string;
  }>;
  /** Summary statistics */
  stats: {
    /** Total number of intents in the request */
    total: number;
    /** Number of intents that passed validation */
    validated: number;
    /** Number of successfully created intents */
    created: number;
    /** Number of intents enqueued for processing */
    enqueued: number;
    /** Whether the operation was atomic (all-or-nothing) */
    atomic: boolean;
    /** Duration of the batch operation in milliseconds */
    durationMs: number;
  };
}

export interface SubmitOptions {
  tenantId: ID;
  trustSnapshot?: Record<string, unknown> | null;
  /** Current trust level of the entity (for trust gate validation) */
  trustLevel?: TrustLevel;
  /** Skip trust gate validation (use with caution) */
  bypassTrustGate?: boolean;
  /** User ID for consent validation (required when consent checking is enabled) */
  userId?: ID;
  /** Skip consent validation (use with caution - only for system intents) */
  bypassConsentCheck?: boolean;
}

export interface ListOptions {
  tenantId: ID;
  entityId?: ID;
  status?: IntentStatus;
  /** Page size limit (default: 50, max: 1000) */
  limit?: number;
  /** Offset for pagination (default: 0) */
  offset?: number;
  /** Cursor for pagination (last intent ID from previous page) - mutually exclusive with offset */
  cursor?: ID;
  /**
   * If true, throw an error when limit exceeds MAX_PAGE_SIZE instead of silently capping.
   * Default: false (silently cap to MAX_PAGE_SIZE for backwards compatibility)
   */
  strictLimitValidation?: boolean;
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
  private consentService: ConsentService;

  constructor(
    private repository = new IntentRepository(),
    consentService?: ConsentService
  ) {
    this.consentService = consentService ?? new ConsentService();
  }

  /**
   * Submit a new intent with trust gate validation and transaction support
   */
  async submit(payload: IntentSubmission, options: SubmitOptions): Promise<Intent> {
    // Record context size for observability
    const contextBytes = Buffer.byteLength(
      JSON.stringify(payload.context ?? {}),
      'utf8'
    );
    recordIntentContextSize(options.tenantId, payload.intentType, contextBytes);

    // Consent validation (GDPR/SOC2 compliance)
    // Check data_processing consent before processing any intent
    if (!options.bypassConsentCheck && options.userId) {
      const consentValidation = await this.validateDataProcessingConsent(
        options.userId,
        options.tenantId
      );

      if (!consentValidation.valid) {
        logger.warn(
          { userId: options.userId, tenantId: options.tenantId, reason: consentValidation.reason },
          'Intent submission rejected: data processing consent not granted'
        );
        recordIntentSubmission(options.tenantId, payload.intentType, 'consent_denied', options.trustLevel);
        throw new ConsentRequiredError(
          options.userId,
          options.tenantId,
          'data_processing',
          consentValidation.reason
        );
      }

      logger.debug(
        { userId: options.userId, tenantId: options.tenantId, consentVersion: consentValidation.version },
        'Data processing consent validated'
      );
    }

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
      // Record trust gate bypass for observability
      recordTrustGateBypass(options.tenantId, payload.intentType);
    }

    const dedupeHash = this.computeDedupeHash(options.tenantId, payload);
    const existing = await traceDedupeCheck(
      options.tenantId,
      payload.entityId,
      dedupeHash,
      async (span) => {
        const result = await this.repository.findByDedupeHash(
          dedupeHash,
          options.tenantId
        );
        recordDedupeResult(span, result !== null);
        return result;
      }
    );
    if (existing) {
      logger.info({ intentId: existing.id }, 'Returning existing intent (dedupe)');
      recordIntentSubmission(options.tenantId, payload.intentType, 'duplicate', options.trustLevel);
      recordDeduplication(options.tenantId, 'duplicate');
      return existing;
    }

    await this.enforceTenantLimits(options.tenantId);

    // Reserve dedupe key with race condition handling
    const raceResolved = await this.reserveDedupeKey(options.tenantId, dedupeHash);
    if (raceResolved) {
      recordIntentSubmission(options.tenantId, payload.intentType, 'duplicate', options.trustLevel);
      recordDeduplication(options.tenantId, 'race_resolved');
      return raceResolved; // Another request completed the insert
    }

    // Record successful new intent deduplication
    recordDeduplication(options.tenantId, 'new');

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
    const eventsResult = await this.repository.getRecentEvents(intent.id);
    const evaluationsResult = await this.repository.listEvaluations(intent.id);
    return { intent, events: eventsResult.items, evaluations: evaluationsResult.items };
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

    // Get event type from state machine
    const eventType = getTransitionEvent(fromStatus, status) ?? 'intent.status.changed';

    // Use atomic transaction to update status and record event together
    // This prevents inconsistent state if event recording fails after status update
    const intent = await this.repository.updateStatusWithEvent(
      id,
      tenantId,
      status,
      eventType,
      { status, previousStatus: fromStatus }
    );

    if (intent) {
      // Record status transition metric (outside transaction - metrics are non-critical)
      recordStatusTransition(tenantId, fromStatus, status);
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

    // Build evaluation and event payloads
    const evaluationPayload: EvaluationPayload = options.cancelledBy
      ? { stage: 'cancelled', reason: options.reason, cancelledBy: options.cancelledBy }
      : { stage: 'cancelled', reason: options.reason };

    const eventPayload = {
      reason: options.reason,
      cancelledBy: options.cancelledBy,
    };

    // Use atomic transaction to cancel intent, record evaluation, and record event together
    // This prevents inconsistent state if any operation fails after partial completion
    const intent = await this.repository.cancelIntentWithEvent(
      id,
      options.tenantId,
      options.reason,
      evaluationPayload as Record<string, unknown>,
      eventPayload
    );

    if (intent) {
      // Record status transition metric (outside transaction - metrics are non-critical)
      recordStatusTransition(options.tenantId, previousStatus ?? 'pending', 'cancelled');

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
    // Use atomic transaction to soft delete intent and record event together
    // This prevents inconsistent state if event recording fails after deletion
    const intent = await this.repository.softDeleteWithEvent(id, tenantId);

    if (intent) {
      logger.info({ intentId: intent.id }, 'Intent soft deleted');
    }

    return intent;
  }

  /**
   * List intents with pagination.
   * Returns paginated results with metadata for cursor/offset-based pagination.
   *
   * @param options - List options including pagination parameters
   * @returns Paginated result with intents and pagination metadata
   */
  async list(options: ListOptions): Promise<PaginatedResult<Intent>> {
    return this.repository.listIntents(options);
  }

  /**
   * Submit multiple intents in bulk for batch processing efficiency.
   *
   * This method processes intents sequentially, recording success/failure for each.
   * By default, it continues processing even if some intents fail.
   *
   * @param submissions - Array of intent submissions to process
   * @param options - Bulk submission options including tenantId and stopOnError flag
   * @returns BulkIntentResult with successful intents, failed intents, and statistics
   *
   * @example
   * ```typescript
   * const result = await intentService.submitBulk(
   *   [
   *     { entityId: 'uuid1', goal: 'Goal 1', context: {} },
   *     { entityId: 'uuid2', goal: 'Goal 2', context: {} },
   *   ],
   *   { tenantId: 'tenant-1', stopOnError: false }
   * );
   * // result.stats.succeeded === 2
   * ```
   */
  async submitBulk(
    submissions: IntentSubmission[],
    options: {
      tenantId: ID;
      stopOnError?: boolean;
      trustSnapshot?: Record<string, unknown> | null;
      trustLevel?: TrustLevel;
      bypassTrustGate?: boolean;
      userId?: ID;
      bypassConsentCheck?: boolean;
    }
  ): Promise<BulkIntentResult> {
    const results: BulkIntentResult = {
      successful: [],
      failed: [],
      stats: { total: submissions.length, succeeded: 0, failed: 0 },
    };

    logger.info(
      { tenantId: options.tenantId, count: submissions.length },
      'Starting bulk intent submission'
    );

    for (let i = 0; i < submissions.length; i++) {
      const submission = submissions[i];
      if (!submission) continue;

      try {
        const submitOptions: SubmitOptions = {
          tenantId: options.tenantId,
        };
        if (options.trustSnapshot !== undefined) {
          submitOptions.trustSnapshot = options.trustSnapshot;
        }
        if (options.trustLevel !== undefined) {
          submitOptions.trustLevel = options.trustLevel;
        }
        if (options.bypassTrustGate !== undefined) {
          submitOptions.bypassTrustGate = options.bypassTrustGate;
        }
        if (options.userId !== undefined) {
          submitOptions.userId = options.userId;
        }
        if (options.bypassConsentCheck !== undefined) {
          submitOptions.bypassConsentCheck = options.bypassConsentCheck;
        }
        const intent = await this.submit(submission, submitOptions);

        results.successful.push(intent);
        results.stats.succeeded++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        results.failed.push({
          index: i,
          input: submission,
          error: errorMessage,
        });
        results.stats.failed++;

        logger.warn(
          { tenantId: options.tenantId, index: i, error: errorMessage },
          'Bulk intent submission failed for item'
        );

        if (options.stopOnError) {
          logger.info(
            { tenantId: options.tenantId, stoppedAtIndex: i, processed: i + 1, total: submissions.length },
            'Bulk intent submission stopped due to stopOnError flag'
          );
          break;
        }
      }
    }

    logger.info(
      {
        tenantId: options.tenantId,
        total: results.stats.total,
        succeeded: results.stats.succeeded,
        failed: results.stats.failed,
      },
      'Bulk intent submission completed'
    );

    return results;
  }

  /**
   * Submit multiple intents in a true batch operation with database transaction.
   *
   * This method provides significantly better performance than submitBulk by:
   * 1. Validating all intents upfront (fail-fast)
   * 2. Using batch database insert in a single transaction (atomic)
   * 3. Creating all initial events in a single batch
   * 4. Enqueueing all to the intake queue in batch
   *
   * The operation is atomic - either all intents are created or none are.
   * Validation errors are collected and returned without creating any intents.
   *
   * @param submissions - Array of intent submissions to process
   * @param options - Batch submission options including tenantId
   * @returns BulkBatchResult with created intents, validation errors, and stats
   *
   * @example
   * ```typescript
   * const result = await intentService.submitBulkBatch(
   *   [
   *     { entityId: 'uuid1', goal: 'Goal 1', context: {} },
   *     { entityId: 'uuid2', goal: 'Goal 2', context: {} },
   *   ],
   *   { tenantId: 'tenant-1' }
   * );
   * // result.stats.created === 2 (if all passed validation)
   * // result.stats.atomic === true
   * ```
   */
  async submitBulkBatch(
    submissions: IntentSubmission[],
    options: {
      tenantId: ID;
      trustSnapshot?: Record<string, unknown> | null;
      trustLevel?: TrustLevel;
      bypassTrustGate?: boolean;
      userId?: ID;
      bypassConsentCheck?: boolean;
      /** Namespace for queue routing */
      namespace?: string;
    }
  ): Promise<BulkBatchResult> {
    const startTime = Date.now();

    const result: BulkBatchResult = {
      intents: [],
      validationErrors: [],
      stats: {
        total: submissions.length,
        validated: 0,
        created: 0,
        enqueued: 0,
        atomic: true,
        durationMs: 0,
      },
    };

    if (submissions.length === 0) {
      result.stats.durationMs = Date.now() - startTime;
      return result;
    }

    logger.info(
      { tenantId: options.tenantId, count: submissions.length },
      'Starting batch intent submission'
    );

    // Phase 1: Validate all intents upfront
    const validationStart = Date.now();
    const validatedIntents: Array<{
      index: number;
      submission: IntentSubmission;
      dedupeHash: string;
    }> = [];

    for (let i = 0; i < submissions.length; i++) {
      const submission = submissions[i];
      if (!submission) continue;

      try {
        // Check context size
        const contextBytes = Buffer.byteLength(
          JSON.stringify(submission.context ?? {}),
          'utf8'
        );
        recordIntentContextSize(options.tenantId, submission.intentType, contextBytes);

        // Consent validation (GDPR/SOC2 compliance)
        if (!options.bypassConsentCheck && options.userId) {
          const consentValidation = await this.validateDataProcessingConsent(
            options.userId,
            options.tenantId
          );

          if (!consentValidation.valid) {
            throw new ConsentRequiredError(
              options.userId,
              options.tenantId,
              'data_processing',
              consentValidation.reason
            );
          }
        }

        // Trust gate validation
        if (!options.bypassTrustGate) {
          this.validateTrustGate(submission.intentType, options.trustLevel);
        }

        // Compute dedupe hash
        const dedupeHash = this.computeDedupeHash(options.tenantId, submission);

        // Check for duplicates in database
        const existing = await this.repository.findByDedupeHash(
          dedupeHash,
          options.tenantId
        );
        if (existing) {
          throw new VorionError(
            `Duplicate intent detected (existing ID: ${existing.id})`,
            'INTENT_DUPLICATE'
          );
        }

        validatedIntents.push({
          index: i,
          submission,
          dedupeHash,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.validationErrors.push({
          index: i,
          input: submission,
          error: errorMessage,
        });
      }
    }

    const validationDuration = (Date.now() - validationStart) / 1000;
    result.stats.validated = validatedIntents.length;

    // Record validation phase metrics
    recordBatchOperation(
      options.tenantId,
      'validate',
      result.validationErrors.length === 0 ? 'success' : 'partial',
      submissions.length,
      validationDuration
    );

    // If all validations failed, return early
    if (validatedIntents.length === 0) {
      logger.warn(
        { tenantId: options.tenantId, total: submissions.length, errors: result.validationErrors.length },
        'Batch submission failed: all intents failed validation'
      );
      result.stats.durationMs = Date.now() - startTime;
      recordBatchOperation(
        options.tenantId,
        'submit',
        'failure',
        submissions.length,
        result.stats.durationMs / 1000
      );
      return result;
    }

    // Phase 2: Batch insert with transaction
    // Note: insert timing is tracked via overall durationMs calculation, not separately
    try {
      // Prepare intent data for batch insert
      const intentsWithEvents = validatedIntents.map(({ submission, dedupeHash }) => ({
        intentData: {
          tenantId: options.tenantId,
          entityId: submission.entityId,
          goal: submission.goal,
          intentType: submission.intentType ?? null,
          priority: submission.priority,
          status: 'pending' as const,
          trustSnapshot: options.trustSnapshot ?? null,
          context: this.redactStructure(submission.context, 'context'),
          metadata: this.redactStructure(submission.metadata ?? {}, 'metadata'),
          dedupeHash,
        },
        eventData: {
          eventType: 'intent.submitted',
          payload: {
            goal: submission.goal,
            intentType: submission.intentType,
            priority: submission.priority,
            trustLevel: options.trustLevel,
            batchSubmission: true,
          },
        },
      }));

      // Atomic batch insert with events
      const createdIntents = await this.repository.createIntentsBatchWithEvents(
        intentsWithEvents
      );

      result.intents = createdIntents;
      result.stats.created = createdIntents.length;

      // Record success metrics for each intent
      for (const intent of createdIntents) {
        recordIntentSubmission(options.tenantId, intent.intentType, 'success', options.trustLevel);
        recordStatusTransition(options.tenantId, 'new', 'pending');
      }

      logger.info(
        { tenantId: options.tenantId, created: createdIntents.length },
        'Batch intent insert completed'
      );
    } catch (error) {
      // Transaction failed - no intents were created
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { tenantId: options.tenantId, error: errorMessage },
        'Batch intent insert failed'
      );

      // Mark all validated intents as failed
      for (const { index, submission } of validatedIntents) {
        result.validationErrors.push({
          index,
          input: submission,
          error: `Transaction failed: ${errorMessage}`,
        });
        recordIntentSubmission(options.tenantId, submission.intentType, 'error', options.trustLevel);
      }

      result.stats.durationMs = Date.now() - startTime;
      recordBatchOperation(
        options.tenantId,
        'submit',
        'failure',
        submissions.length,
        result.stats.durationMs / 1000
      );
      return result;
    }

    // insertDuration intentionally not used; timing is tracked via recordBatchOperation

    // Phase 3: Batch enqueue to processing queue
    const enqueueStart = Date.now();
    try {
      await enqueueIntentSubmissionsBatch(result.intents, {
        namespace: this.resolveNamespace(options.namespace),
      });
      result.stats.enqueued = result.intents.length;

      const enqueueDuration = (Date.now() - enqueueStart) / 1000;
      recordBatchOperation(
        options.tenantId,
        'enqueue',
        'success',
        result.intents.length,
        enqueueDuration
      );

      logger.info(
        { tenantId: options.tenantId, enqueued: result.stats.enqueued },
        'Batch intent enqueue completed'
      );
    } catch (error) {
      // Enqueue failed but intents were created - partial success
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { tenantId: options.tenantId, error: errorMessage },
        'Batch intent enqueue failed'
      );
      recordError('BATCH_ENQUEUE_FAILED', 'intent-service');
    }

    // Calculate final metrics
    result.stats.durationMs = Date.now() - startTime;
    const totalDuration = result.stats.durationMs / 1000;

    // Determine overall result
    const overallResult = result.validationErrors.length === 0 && result.stats.created === submissions.length
      ? 'success'
      : result.stats.created > 0
        ? 'partial'
        : 'failure';

    recordBatchOperation(
      options.tenantId,
      'submit',
      overallResult,
      submissions.length,
      totalDuration
    );

    logger.info(
      {
        tenantId: options.tenantId,
        total: result.stats.total,
        validated: result.stats.validated,
        created: result.stats.created,
        enqueued: result.stats.enqueued,
        validationErrors: result.validationErrors.length,
        durationMs: result.stats.durationMs,
        throughput: result.stats.created / totalDuration,
      },
      'Batch intent submission completed'
    );

    return result;
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

  /**
   * Validate data processing consent for a user
   * Required for GDPR/SOC2 compliance before processing any intent
   */
  private async validateDataProcessingConsent(
    userId: ID,
    tenantId: ID
  ): Promise<ConsentValidationResult> {
    return this.consentService.validateConsent(userId, tenantId, 'data_processing');
  }

  /**
   * Get the consent service instance for direct consent management
   */
  getConsentService(): ConsentService {
    return this.consentService;
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

    // Try to acquire a distributed lock with tracing
    const lockResult = await traceLockAcquire(
      tenantId,
      lockKey,
      async (span) => {
        const result = await lockService.acquire(lockKey, {
          lockTimeoutMs: 30000, // Hold lock for max 30 seconds
          acquireTimeoutMs: 5000, // Wait up to 5 seconds to acquire
          retryDelayMs: 50, // Start with 50ms retry delay
          maxRetryDelayMs: 500, // Max 500ms between retries
          jitterFactor: 0.25, // 25% jitter
        });
        recordLockResult(span, result.acquired, 5000);
        return result;
      }
    );

    if (!lockResult.acquired || !lockResult.lock) {
      // Record lock contention - timeout scenario
      recordLockContention(tenantId, 'timeout');

      // Could not acquire lock - check if intent was created by another request
      const existing = await this.repository.findByDedupeHash(dedupeHash, tenantId);
      if (existing) {
        // Record lock contention - conflict scenario (another request won)
        recordLockContention(tenantId, 'conflict');
        logger.info({ intentId: existing.id }, 'Race resolved: returning existing intent');
        return existing;
      }

      // Lock acquisition timed out and no existing intent found
      throw new VorionError(
        'Intent submission in progress, please retry',
        'INTENT_LOCKED'
      );
    }

    // Record successful lock acquisition
    recordLockContention(tenantId, 'acquired');

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
    const cloned = JSON.parse(JSON.stringify(payload ?? {})) as Record<string, unknown>;
    const prefixWithDot = `${prefix}.`;
    const relevant = this.config.intent.sensitivePaths
      .filter((path: string) => path.startsWith(prefixWithDot))
      .map((path: string) => path.slice(prefixWithDot.length));

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

  /**
   * Compute a secure deduplication hash using HMAC-SHA256.
   *
   * Security features:
   * - Uses HMAC with a secret key to prevent hash prediction attacks
   * - Includes a timestamp bucket to limit replay window
   * - Falls back to plain SHA-256 only in development (with warning)
   *
   * @param tenantId - The tenant identifier
   * @param payload - The intent submission payload
   * @returns A hex-encoded HMAC digest for deduplication
   */
  private computeDedupeHash(tenantId: ID, payload: IntentSubmission): string {
    const secret = this.config.intent.dedupeSecret;
    const windowSeconds = this.config.intent.dedupeTimestampWindowSeconds;

    // Compute timestamp bucket for replay protection
    // Requests within the same bucket will have the same hash component
    const timestampBucket = Math.floor(Date.now() / 1000 / windowSeconds);

    // Build the data to hash
    const dataComponents = [
      tenantId,
      payload.entityId,
      payload.goal,
      JSON.stringify(payload.context ?? {}),
      payload.intentType ?? '',
      payload.idempotencyKey ?? '',
      timestampBucket.toString(),
    ];
    const data = dataComponents.join('|');

    if (secret) {
      // Production: Use HMAC-SHA256 with secret
      const hmac = createHmac('sha256', secret);
      hmac.update(data);
      return hmac.digest('hex');
    }

    // Development fallback: Use plain SHA-256 (with warning logged once)
    if (!this.warnedAboutMissingDedupeSecret) {
      logger.warn(
        'VORION_DEDUPE_SECRET not set - using insecure SHA-256 for deduplication. ' +
        'This is acceptable for development but MUST be configured in production.'
      );
      this.warnedAboutMissingDedupeSecret = true;
    }

    const hash = createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }

  private warnedAboutMissingDedupeSecret = false;
}

/**
 * Create a new intent service instance
 */
export function createIntentService(): IntentService {
  return new IntentService();
}

// Re-export consent management types and functions
export {
  ConsentService,
  ConsentRequiredError,
  ConsentPolicyNotFoundError,
  createConsentService,
  type ConsentType,
  type ConsentMetadata,
  type UserConsent,
  type ConsentPolicy,
  type ConsentHistoryEntry,
  type ConsentValidationResult,
} from './consent.js';

// Re-export OpenAPI specification and routes
export {
  intentOpenApiSpec,
  getOpenApiSpec,
  getOpenApiSpecJson,
} from './openapi.js';

export {
  registerIntentRoutes,
} from './routes.js';

// Re-export graceful shutdown utilities
export {
  isServerShuttingDown,
  getActiveRequestCount,
  trackRequest,
  gracefulShutdown,
  registerShutdownHandlers,
  shutdownRequestHook,
  shutdownResponseHook,
  resetShutdownState,
  type GracefulShutdownOptions,
} from './shutdown.js';

// Re-export pagination constants and types from repository
export {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type PaginatedResult,
} from './repository.js';
