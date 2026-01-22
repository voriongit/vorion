import { Queue, Worker, QueueEvents, JobsOptions, Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Intent, TrustLevel, ControlAction, TrustComponents } from '../common/types.js';
import type { EvaluationResult } from '../basis/types.js';
// PolicyAction interface is imported via MultiPolicyEvaluationResult from policy/index.js
import { TrustEngine } from '../trust-engine/index.js';
import { RuleEvaluator } from '../basis/evaluator.js';
import { createEnforcementService } from '../enforce/index.js';
import { createLogger, createTracedLogger } from '../common/logger.js';
import { getRedis } from '../common/redis.js';
import { getConfig } from '../common/config.js';
import type { IntentService } from './index.js';
import {
  getTraceContext,
  runWithTraceContext,
  createTraceContext,
  addTraceToJobData,
  extractTraceFromJobData,
  type TraceContext,
} from '../common/trace.js';
import {
  recordJobResult,
  updateQueueGauges,
  dlqSize,
  recordPolicyEvaluation,
  recordPolicyOverride,
  recordCircuitBreakerStateChange,
  recordCircuitBreakerExecution,
  recordExecution,
  updateExecutionsInProgress,
  recordTrustDrift,
  recordDecisionTimeTrustFetch,
} from './metrics.js';
import {
  getCircuitBreaker,
  type CircuitState,
} from '../common/circuit-breaker.js';
import {
  getPolicyLoader,
  createPolicyEvaluator,
  type MultiPolicyEvaluationResult,
  type PolicyEvaluationContext,
} from '../policy/index.js';
import {
  createAuditService,
  createAuditHelper,
} from '../audit/index.js';
import { createWebhookService } from './webhooks.js';
import {
  getCachedTrustScore,
  cacheTrustScore,
  getDecisionTimeTrustScoreWithRefresh,
} from '../common/trust-cache.js';
import {
  tracePolicyEvaluate,
  recordPolicyEvaluationResult,
} from './tracing.js';
import { createProofService } from '../proof/index.js';
import {
  createGateway,
  type ExecutionContext,
  type ExecutionResult,
  type ResourceLimits,
} from '../cognigate/index.js';
import type { Decision } from '../common/types.js';

const logger = createLogger({ component: 'intent-queue' });

const queueNames = {
  intake: 'intent:intake',
  evaluate: 'intent:evaluate',
  decision: 'intent:decision',
  execute: 'intent:execute',
  deadLetter: 'intent:dead-letter',
};

/**
 * Get job options from config with jitter for backoff
 */
function getJobOptions(): JobsOptions {
  const config = getConfig();
  const baseDelay = config.intent.retryBackoffMs;
  // Add 0-25% jitter to prevent thundering herd
  const jitter = Math.floor(Math.random() * baseDelay * 0.25);

  return {
    attempts: config.intent.maxRetries,
    backoff: {
      type: 'exponential',
      delay: baseDelay + jitter,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000,
    },
    removeOnFail: false, // Keep failed jobs for inspection
  };
}

const connection = () => getRedis().duplicate();

const trustEngine = new TrustEngine();
const policyLoader = getPolicyLoader();
const policyEvaluator = createPolicyEvaluator();
const ruleEvaluator = new RuleEvaluator();
const enforcementService = createEnforcementService({ defaultAction: 'deny' });
const auditService = createAuditService();
const auditHelper = createAuditHelper(auditService);
const webhookService = createWebhookService();
const proofService = createProofService();

// Cognigate gateway for intent execution - initialized lazily with config
let cognigateGateway: ReturnType<typeof createGateway> | null = null;
function getCognigateGateway() {
  if (!cognigateGateway) {
    const config = getConfig();
    cognigateGateway = createGateway({
      maxMemoryMb: config.cognigate.maxMemoryMb,
      maxCpuPercent: config.cognigate.maxCpuPercent,
      timeoutMs: config.cognigate.timeout,
    });
  }
  return cognigateGateway;
}

// Policy evaluation circuit breaker - prevents cascading failures when policy engine is unhealthy
// Uses per-service circuit breaker configuration from the registry
const policyCircuitBreaker = getCircuitBreaker('policyEngine', (from: CircuitState, to: CircuitState) => {
  recordCircuitBreakerStateChange('policy-engine', from, to);
  logger.info(
    { circuitBreaker: 'policy-engine', from, to },
    'Policy circuit breaker state changed'
  );
});

// Trust Engine circuit breaker - prevents cascading failures when trust service is unavailable
// Falls back to cached scores or default trust level when circuit is open
const trustCircuitBreaker = getCircuitBreaker('trustEngine', (from: CircuitState, to: CircuitState) => {
  recordCircuitBreakerStateChange('trust-engine', from, to);
  logger.info(
    { circuitBreaker: 'trust-engine', from, to },
    'Trust Engine circuit breaker state changed'
  );
});

// Default trust score used when trust engine is unavailable and no cached score exists
const DEFAULT_TRUST_SCORE: {
  score: number;
  level: TrustLevel;
  components: TrustComponents;
} = {
  score: 0,
  level: 0 as TrustLevel,
  components: {
    behavioral: 0,
    compliance: 0,
    identity: 0,
    context: 0,
  },
};

/**
 * Fetch trust score with circuit breaker protection
 * Falls back to cached score or default when trust engine is unavailable
 */
async function fetchTrustScoreWithCircuitBreaker(
  entityId: string,
  tenantId: string,
  jobLogger: ReturnType<typeof createTracedLogger>
): Promise<{ score: number; level: TrustLevel; components: TrustComponents } | null> {
  // Always check cache first
  const cachedScore = await getCachedTrustScore(entityId, tenantId);

  // Check if circuit is open
  const isCircuitOpen = await trustCircuitBreaker.isOpen();
  if (isCircuitOpen) {
    recordCircuitBreakerExecution('trust-engine', 'rejected');
    jobLogger.warn(
      { entityId, circuitState: 'OPEN', usedCachedScore: !!cachedScore },
      'Trust Engine circuit breaker is OPEN, using cached score or default'
    );
    // Return cached score if available, otherwise return default
    return cachedScore ?? DEFAULT_TRUST_SCORE;
  }

  // Execute trust engine call through circuit breaker
  const circuitResult = await trustCircuitBreaker.execute(async () => {
    return trustEngine.getScore(entityId);
  });

  if (circuitResult.success && circuitResult.result) {
    recordCircuitBreakerExecution('trust-engine', 'success');
    // Cache the fresh result
    await cacheTrustScore(entityId, tenantId, circuitResult.result);
    return circuitResult.result;
  } else if (circuitResult.circuitOpen) {
    // Circuit opened during execution
    recordCircuitBreakerExecution('trust-engine', 'rejected');
    jobLogger.warn(
      { entityId, usedCachedScore: !!cachedScore },
      'Trust Engine circuit breaker opened during call, using cached score or default'
    );
    return cachedScore ?? DEFAULT_TRUST_SCORE;
  } else {
    // Execution failed
    recordCircuitBreakerExecution('trust-engine', 'failure');
    jobLogger.warn(
      { entityId, error: circuitResult.error?.message, usedCachedScore: !!cachedScore },
      'Trust Engine call failed, using cached score or default'
    );
    return cachedScore ?? DEFAULT_TRUST_SCORE;
  }
}

/**
 * Action priority map - lower number = more restrictive
 * All ControlAction values must be included
 */
const ACTION_PRIORITY: Record<ControlAction, number> = {
  terminate: 0,
  deny: 1,
  escalate: 2,
  limit: 3,
  monitor: 4,
  allow: 5,
};

/**
 * Determine the most restrictive action between rule and policy evaluations
 * Returns the more restrictive action (terminate > deny > escalate > limit > monitor > allow)
 */
function getMostRestrictiveAction(
  ruleAction: ControlAction,
  policyAction?: ControlAction | null
): ControlAction {
  if (!policyAction) {
    return ruleAction;
  }

  const rulePriority = ACTION_PRIORITY[ruleAction];
  const policyPriority = ACTION_PRIORITY[policyAction];

  // Return the action with lower priority number (more restrictive)
  return rulePriority <= policyPriority ? ruleAction : policyAction;
}

// Queue instances
export const intentIntakeQueue = new Queue(queueNames.intake, {
  connection: connection(),
  defaultJobOptions: getJobOptions(),
});

export const intentEvaluateQueue = new Queue(queueNames.evaluate, {
  connection: connection(),
  defaultJobOptions: getJobOptions(),
});

export const intentDecisionQueue = new Queue(queueNames.decision, {
  connection: connection(),
  defaultJobOptions: getJobOptions(),
});

export const intentExecuteQueue = new Queue(queueNames.execute, {
  connection: connection(),
  defaultJobOptions: getJobOptions(),
});

export const deadLetterQueue = new Queue(queueNames.deadLetter, {
  connection: connection(),
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// Queue event listeners for monitoring
const queueEvents: QueueEvents[] = [];

[queueNames.intake, queueNames.evaluate, queueNames.decision, queueNames.execute].forEach((name) => {
  const events = new QueueEvents(name, { connection: connection() });
  queueEvents.push(events);

  events.on('failed', ({ jobId, failedReason }) => {
    logger.error({ queue: name, jobId, failedReason }, 'Job failed');
  });

  events.on('stalled', ({ jobId }) => {
    logger.warn({ queue: name, jobId }, 'Job stalled');
  });
});

// Worker instances for graceful shutdown
const workers: Worker[] = [];
let workersStarted = false;
let intentService: IntentService | null = null;
let isShuttingDown = false;

/**
 * Dead letter queue job data structure for comprehensive debugging
 */
export interface DeadLetterJobData {
  /** Original queue name where the job failed */
  originalQueue: string;
  /** Original job ID */
  jobId: string | undefined;
  /** Original job data */
  jobData: Record<string, unknown>;
  /** Error details */
  error: {
    message: string;
    stack?: string;
    name?: string;
  };
  /** Number of retry attempts made */
  attemptsMade: number;
  /** Timestamp when the job was first created */
  createdAt: string;
  /** Timestamp when the job first failed */
  firstFailedAt?: string;
  /** Timestamp when the job was moved to DLQ (after exhausting retries) */
  movedToDlqAt: string;
  /** Intent ID if available */
  intentId?: string;
  /** Tenant ID if available */
  tenantId?: string;
  /** Trace context for distributed tracing */
  traceContext?: {
    traceId?: string;
    spanId?: string;
  };
}

/**
 * Move a failed job to the dead letter queue after max retries.
 * Includes comprehensive metadata for debugging and reprocessing.
 */
async function moveToDeadLetterQueue(
  job: Job,
  error: Error,
  stage: string
): Promise<void> {
  try {
    const jobData = job.data as Record<string, unknown>;
    const traceContext = extractTraceFromJobData(jobData);
    const now = new Date().toISOString();

    // Build error info object conditionally to satisfy exactOptionalPropertyTypes
    const errorInfo: DeadLetterJobData['error'] = {
      message: error.message,
      name: error.name,
    };
    if (error.stack) {
      errorInfo.stack = error.stack;
    }

    const dlqJobData: DeadLetterJobData = {
      originalQueue: stage,
      jobId: job.id,
      jobData,
      error: errorInfo,
      attemptsMade: job.attemptsMade,
      createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : now,
      movedToDlqAt: now,
    };

    // Add optional properties only if they have values
    if (job.failedReason) {
      dlqJobData.firstFailedAt = now;
    }
    if (jobData.intentId) {
      dlqJobData.intentId = jobData.intentId as string;
    }
    if (jobData.tenantId) {
      dlqJobData.tenantId = jobData.tenantId as string;
    }
    if (traceContext) {
      dlqJobData.traceContext = {
        traceId: traceContext.traceId,
        spanId: traceContext.spanId,
      };
    }

    await deadLetterQueue.add('failed-intent', dlqJobData, {
      // Keep DLQ jobs indefinitely for manual inspection
      removeOnComplete: false,
      removeOnFail: false,
    });

    // Update DLQ size metric immediately after adding
    const dlqCount = await deadLetterQueue.getJobCounts('waiting');
    dlqSize.set(dlqCount.waiting ?? 0);

    logger.info(
      {
        jobId: job.id,
        stage,
        intentId: dlqJobData.intentId,
        attemptsMade: job.attemptsMade,
        errorMessage: error.message,
      },
      'Moved failed job to dead letter queue'
    );
  } catch (dlqError) {
    logger.error(
      { jobId: job.id, stage, error: dlqError },
      'Failed to move job to dead letter queue'
    );
  }
}

/**
 * Update intent status to failed when job exhausts retries
 */
async function markIntentFailed(
  intentId: string,
  tenantId: string,
  error: Error
): Promise<void> {
  if (!intentService) return;
  try {
    await intentService.updateStatus(intentId, tenantId, 'failed');
    await intentService.recordEvaluation(intentId, tenantId, {
      stage: 'error',
      error: {
        message: error.message,
        timestamp: new Date().toISOString(),
      },
    });

    // Record failed intent audit event
    await auditHelper.recordIntentEvent(
      tenantId,
      'intent.failed',
      intentId,
      { type: 'service', id: 'intent-queue' },
      {
        outcome: 'failure',
        reason: error.message,
        stateChange: {
          after: { status: 'failed' },
        },
        metadata: {
          errorStack: error.stack,
        },
      }
    );
  } catch (updateError) {
    logger.error(
      { intentId, error: updateError },
      'Failed to mark intent as failed'
    );
  }
}

export async function enqueueIntentSubmission(
  intent: Intent,
  options?: { namespace?: string; traceContext?: TraceContext }
): Promise<void> {
  // Get current trace context or create new one
  const traceContext = options?.traceContext ?? getTraceContext() ?? createTraceContext();

  const jobData = addTraceToJobData({
    intentId: intent.id,
    tenantId: intent.tenantId,
    namespace: options?.namespace,
  }, traceContext);

  await intentIntakeQueue.add('intent.submitted', jobData);

  logger.debug(
    { intentId: intent.id, traceId: traceContext.traceId },
    'Intent enqueued for processing'
  );
}

/**
 * Batch enqueue multiple intents for processing.
 *
 * Uses BullMQ's addBulk for efficient batch queue insertion.
 * All jobs share the same trace context for distributed tracing.
 *
 * @param intents - Array of intents to enqueue
 * @param options - Optional namespace and trace context
 */
export async function enqueueIntentSubmissionsBatch(
  intents: Intent[],
  options?: { namespace?: string; traceContext?: TraceContext }
): Promise<void> {
  if (intents.length === 0) {
    return;
  }

  // Get or create shared trace context for the batch
  const traceContext = options?.traceContext ?? getTraceContext() ?? createTraceContext();

  // Prepare all job data
  const jobs = intents.map((intent) => ({
    name: 'intent.submitted',
    data: addTraceToJobData({
      intentId: intent.id,
      tenantId: intent.tenantId,
      namespace: options?.namespace,
    }, traceContext),
  }));

  // Bulk add all jobs at once
  await intentIntakeQueue.addBulk(jobs);

  logger.debug(
    { count: intents.length, traceId: traceContext.traceId },
    'Batch of intents enqueued for processing'
  );
}

export function registerIntentWorkers(service: IntentService): void {
  if (workersStarted) return;
  workersStarted = true;
  intentService = service;

  const config = getConfig();
  const concurrency = config.intent.queueConcurrency;
  const lockDuration = config.intent.jobTimeoutMs;

  // Intake Worker
  const intakeWorker = new Worker(
    queueNames.intake,
    async (job) => {
      const startTime = Date.now();
      if (!intentService || isShuttingDown) return;

      // Extract trace context from job data or create new one
      const traceContext = extractTraceFromJobData(job.data as Record<string, unknown>) ?? createTraceContext();

      // Run the job within the trace context
      return runWithTraceContext(traceContext, async () => {
        const { intentId, tenantId, namespace } = job.data as {
          intentId: string;
          tenantId: string;
          namespace?: string;
        };

        const jobLogger = createTracedLogger(
          { component: 'intake-worker', jobId: job.id },
          traceContext.traceId,
          traceContext.spanId
        );

        try {
          const intent = await intentService!.get(intentId, tenantId);
          if (!intent) {
            jobLogger.warn({ intentId }, 'Intent no longer exists');
            return;
          }

          // Fetch trust score with circuit breaker protection
          // Falls back to cached score or default when trust engine is unavailable
          const trustRecord = await fetchTrustScoreWithCircuitBreaker(
            intent.entityId,
            tenantId,
            jobLogger
          );
          const trustSnapshot = trustRecord
            ? {
                score: trustRecord.score,
                level: trustRecord.level,
                components: trustRecord.components,
              }
            : null;

          await intentService!.updateTrustMetadata(
            intent.id,
            intent.tenantId,
            trustSnapshot,
            trustRecord?.level,
            trustRecord?.score
          );

          await intentService!.updateStatus(intent.id, intent.tenantId, 'evaluating', 'pending');
          await intentService!.recordEvaluation(intent.id, intent.tenantId, {
            stage: 'trust-snapshot',
            result: trustSnapshot,
          });

          // Record audit event for intent submission
          await auditHelper.recordIntentEvent(
            tenantId,
            'intent.submitted',
            intentId,
            { type: 'agent', id: intent.entityId, name: intent.metadata['agentName'] as string },
            {
              outcome: 'success',
              metadata: {
                intentType: intent.intentType,
                goal: intent.goal,
                trustScore: trustRecord?.score,
                trustLevel: trustRecord?.level,
                namespace,
              },
            }
          ).catch((auditError: unknown) => {
            jobLogger.warn({ error: auditError }, 'Failed to record intake audit event');
          });

          // Propagate trace context to next queue
          const nextJobData = addTraceToJobData({
            intentId: intent.id,
            tenantId: intent.tenantId,
            namespace,
          }, traceContext);

          await intentEvaluateQueue.add('intent.evaluate', nextJobData);

          recordJobResult('intake', 'success', (Date.now() - startTime) / 1000);
        } catch (error) {
          recordJobResult('intake', 'failure', (Date.now() - startTime) / 1000);
          throw error;
        }
      });
    },
    {
      connection: connection(),
      concurrency,
      lockDuration,
      stalledInterval: lockDuration + 5000,
    }
  );

  intakeWorker.on('failed', (job, error) => {
    if (!job) return;
    const { intentId, tenantId } = job.data as { intentId: string; tenantId: string };
    logger.error({ jobId: job.id, intentId, error: error.message }, 'Intent intake job failed');

    // Move to DLQ after final retry
    if (job.attemptsMade >= config.intent.maxRetries) {
      Promise.all([
        moveToDeadLetterQueue(job, error, 'intake'),
        markIntentFailed(intentId, tenantId, error),
      ]).catch((dlqError: unknown) => {
        logger.error(
          { jobId: job.id, intentId, error: dlqError },
          'Failed to move intake job to DLQ or mark intent as failed'
        );
      });
    }
  });

  workers.push(intakeWorker);

  // Evaluate Worker
  const evaluateWorker = new Worker(
    queueNames.evaluate,
    async (job) => {
      const startTime = Date.now();
      if (!intentService || isShuttingDown) return;
      const { intentId, tenantId, namespace } = job.data as {
        intentId: string;
        tenantId: string;
        namespace?: string;
      };

      try {
        const intent = await intentService.get(intentId, tenantId);
        if (!intent) {
          logger.warn({ intentId }, 'Intent no longer exists');
          return;
        }

        // Record evaluation started audit event
        auditHelper.recordIntentEvent(
          tenantId,
          'intent.evaluation.started',
          intentId,
          { type: 'service', id: 'intent-queue' },
          {
            outcome: 'success',
            metadata: {
              intentType: intent.intentType,
              namespace,
            },
          }
        ).catch((auditError: unknown) => {
          logger.warn({ error: auditError }, 'Failed to record evaluation started audit event');
        });

        // Build evaluation context (shared by rule and policy evaluators)
        const evaluationContext = {
          intent: {
            id: intent.id,
            type: intent.intentType ?? 'generic',
            goal: intent.goal,
            context: intent.context,
          },
          entity: {
            id: intent.entityId,
            type: (intent.metadata['entityType'] as string) ?? 'agent',
            trustScore: intent.trustScore ?? 0,
            trustLevel: (intent.trustLevel ?? 0) as TrustLevel,
            attributes: intent.metadata,
          },
          environment: {
            timestamp: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            requestId: randomUUID(),
          },
          custom: {
            namespace: namespace ?? config.intent.defaultNamespace,
          },
        };

        // PARALLEL EVALUATION: Run rule and policy evaluation concurrently
        // This roughly halves evaluation latency by running both evaluations at the same time
        const policyNamespace = namespace ?? config.intent.defaultNamespace;
        const ruleEvalStartTime = Date.now();
        const policyEvalStartTime = Date.now();

        // Build policy evaluation context (slightly different structure than rule context)
        const policyContext: PolicyEvaluationContext = {
          intent: {
            ...intent,
            intentType: intent.intentType ?? 'generic',
          },
          entity: {
            id: intent.entityId,
            type: (intent.metadata['entityType'] as string) ?? 'agent',
            trustScore: intent.trustScore ?? 0,
            trustLevel: (intent.trustLevel ?? 0) as TrustLevel,
            attributes: intent.metadata,
          },
          environment: {
            timestamp: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            requestId: randomUUID(),
          },
        };

        // Run rule evaluation and policy loading/evaluation in parallel
        const [evaluation, policyResult] = await Promise.all([
          // Rule-based evaluation (existing system)
          ruleEvaluator.evaluate(evaluationContext).then((result) => {
            const ruleEvalDuration = Date.now() - ruleEvalStartTime;
            logger.debug(
              {
                intentId: intent.id,
                rulesEvaluated: result.rulesEvaluated.length,
                passed: result.passed,
                finalAction: result.finalAction,
                durationMs: ruleEvalDuration,
              },
              'Rule evaluation completed'
            );
            return result;
          }),

          // Policy-based evaluation (new policy engine) with circuit breaker and tracing
          // Circuit breaker prevents cascading failures when policy engine is unhealthy
          (async (): Promise<{ evaluation: MultiPolicyEvaluationResult | null; error?: Error; circuitOpen?: boolean }> => {
            // Check if circuit is open - if so, skip policy evaluation immediately
            const isCircuitOpen = await policyCircuitBreaker.isOpen();
            if (isCircuitOpen) {
              recordCircuitBreakerExecution('policy-engine', 'rejected');
              logger.warn(
                { intentId: intent.id, circuitState: 'OPEN' },
                'Policy circuit breaker is OPEN, skipping policy evaluation and using rules only'
              );
              return { evaluation: null, circuitOpen: true };
            }

            return tracePolicyEvaluate(
              intent.id,
              intent.tenantId,
              policyNamespace,
              async (span): Promise<{ evaluation: MultiPolicyEvaluationResult | null; error?: Error; circuitOpen?: boolean }> => {
                // Execute policy evaluation through circuit breaker
                const circuitResult = await policyCircuitBreaker.execute(async () => {
                  const policies = await policyLoader.getPolicies(
                    intent.tenantId,
                    policyNamespace
                  );

                  if (policies.length === 0) {
                    recordPolicyEvaluationResult(span, 0, 0, 'none');
                    return null;
                  }

                  const policyEvaluation = policyEvaluator.evaluateMultiple(policies, policyContext);

                  // Record policy evaluation metrics
                  const policyEvalDuration = (Date.now() - policyEvalStartTime) / 1000;
                  const matchedCount = policyEvaluation.policiesEvaluated.filter(
                    (p) => p.matchedRules.length > 0
                  ).length;
                  const policyResultType = policyEvaluation.finalAction === 'allow'
                    ? 'allow'
                    : policyEvaluation.finalAction === 'deny'
                      ? 'deny'
                      : 'escalate';

                  // Record span attributes for policy evaluation
                  recordPolicyEvaluationResult(
                    span,
                    policyEvaluation.policiesEvaluated.length,
                    matchedCount,
                    policyResultType
                  );

                  recordPolicyEvaluation(
                    intent.tenantId,
                    policyNamespace,
                    policyResultType,
                    policyEvalDuration,
                    matchedCount
                  );

                  logger.debug(
                    {
                      intentId: intent.id,
                      policiesEvaluated: policyEvaluation.policiesEvaluated.length,
                      finalAction: policyEvaluation.finalAction,
                      durationMs: Date.now() - policyEvalStartTime,
                    },
                    'Policy evaluation completed'
                  );

                  return policyEvaluation;
                });

                // Handle circuit breaker result
                if (circuitResult.success) {
                  recordCircuitBreakerExecution('policy-engine', 'success');
                  return { evaluation: circuitResult.result ?? null };
                } else if (circuitResult.circuitOpen) {
                  // Circuit opened during execution (shouldn't happen as we check above)
                  recordCircuitBreakerExecution('policy-engine', 'rejected');
                  logger.warn(
                    { intentId: intent.id },
                    'Policy circuit breaker opened during evaluation, continuing with rules only'
                  );
                  return { evaluation: null, circuitOpen: true };
                } else {
                  // Execution failed - circuit breaker already recorded the failure
                  recordCircuitBreakerExecution('policy-engine', 'failure');
                  logger.warn(
                    { intentId: intent.id, error: circuitResult.error },
                    'Policy evaluation failed (circuit breaker tracked), continuing with rules only'
                  );
                  return circuitResult.error
                    ? { evaluation: null, error: circuitResult.error }
                    : { evaluation: null };
                }
              }
            );
          })(),
        ]);

        // Extract policy evaluation result (may be null if no policies or error)
        const policyEvaluation = policyResult.evaluation;

        // Log parallel evaluation timing metrics
        const totalEvalDuration = Date.now() - ruleEvalStartTime;
        logger.debug(
          {
            intentId: intent.id,
            totalDurationMs: totalEvalDuration,
            parallelExecution: true,
          },
          'Parallel evaluation completed'
        );

        await intentService.recordEvaluation(intent.id, intent.tenantId, {
          stage: 'basis',
          evaluation,
          namespace: namespace ?? config.intent.defaultNamespace,
        });

        // Record evaluation completed audit event
        auditHelper.recordIntentEvent(
          tenantId,
          'intent.evaluation.completed',
          intentId,
          { type: 'service', id: 'intent-queue' },
          {
            outcome: 'success',
            metadata: {
              rulesPassed: evaluation.passed,
              rulesAction: evaluation.finalAction,
              rulesEvaluated: evaluation.rulesEvaluated.length,
              policyAction: policyEvaluation?.finalAction,
              policiesEvaluated: policyEvaluation?.policiesEvaluated.length ?? 0,
              namespace,
            },
          }
        ).catch((auditError: unknown) => {
          logger.warn({ error: auditError }, 'Failed to record evaluation completed audit event');
        });

        await intentDecisionQueue.add('intent.decision', {
          intentId: intent.id,
          tenantId: intent.tenantId,
          evaluation,
          policyEvaluation,
        });

        recordJobResult('evaluate', 'success', (Date.now() - startTime) / 1000);
      } catch (error) {
        recordJobResult('evaluate', 'failure', (Date.now() - startTime) / 1000);
        throw error;
      }
    },
    {
      connection: connection(),
      concurrency,
      lockDuration,
      stalledInterval: lockDuration + 5000,
    }
  );

  evaluateWorker.on('failed', (job, error) => {
    if (!job) return;
    const { intentId, tenantId } = job.data as { intentId: string; tenantId: string };
    logger.error({ jobId: job.id, intentId, error: error.message }, 'Intent evaluation job failed');

    if (job.attemptsMade >= config.intent.maxRetries) {
      Promise.all([
        moveToDeadLetterQueue(job, error, 'evaluate'),
        markIntentFailed(intentId, tenantId, error),
      ]).catch((dlqError: unknown) => {
        logger.error(
          { jobId: job.id, intentId, error: dlqError },
          'Failed to move evaluate job to DLQ or mark intent as failed'
        );
      });
    }
  });

  workers.push(evaluateWorker);

  // Decision Worker
  const decisionWorker = new Worker(
    queueNames.decision,
    async (job) => {
      const startTime = Date.now();
      if (!intentService || isShuttingDown) return;
      const { intentId, tenantId, evaluation, policyEvaluation } = job.data as {
        intentId: string;
        tenantId: string;
        evaluation: EvaluationResult;
        policyEvaluation?: MultiPolicyEvaluationResult | null;
      };

      try {
        const intent = await intentService.get(intentId, tenantId);
        if (!intent) {
          logger.warn({ intentId }, 'Intent no longer exists');
          return;
        }

        // ALWAYS fetch live trust score at decision time for trust gate validation
        // This ensures trust gates use current trust state, not stale snapshots
        const trustFetchStart = Date.now();
        const currentTrust = await getDecisionTimeTrustScoreWithRefresh(
          intent.entityId,
          tenantId,
          () => trustEngine.getScore(intent.entityId).then(r => r!)
        );
        const trustFetchDuration = (Date.now() - trustFetchStart) / 1000;

        // Record trust fetch metrics
        const trustSource = trustFetchDuration < 0.005 ? 'cache' : 'engine';
        recordDecisionTimeTrustFetch(tenantId, trustSource, trustFetchDuration);

        const currentLevel = currentTrust?.level ?? 0;
        const currentScore = currentTrust?.score ?? 0;
        const snapshotScore = intent.trustScore ?? 0;
        const snapshotLevel = intent.trustLevel ?? 0;
        const requiredLevel = intentService.getRequiredTrustLevel(intent.intentType);

        // Calculate and log trust drift between intake snapshot and decision time
        const trustDrift = snapshotScore - currentScore;
        const significantDrift = Math.abs(trustDrift) >= 20; // 20 point threshold

        // Record trust drift metrics for monitoring
        recordTrustDrift(
          tenantId,
          intent.intentType,
          snapshotScore,
          currentScore,
          snapshotLevel,
          currentLevel
        );

        if (significantDrift) {
          logger.info(
            {
              intentId,
              entityId: intent.entityId,
              snapshotScore,
              currentScore,
              drift: trustDrift,
              snapshotLevel,
              currentLevel,
              levelChange: snapshotLevel !== currentLevel,
            },
            trustDrift > 0
              ? 'Trust degradation detected at decision time'
              : 'Trust improvement detected at decision time'
          );
        }

        // Record the trust gate check
        // Note: Trust drift metrics are captured via recordTrustDrift() above
        // and detailed drift info is stored in trust metadata update
        await intentService.recordEvaluation(intent.id, intent.tenantId, {
          stage: 'trust-gate',
          passed: currentLevel >= requiredLevel,
          requiredLevel,
          actualLevel: currentLevel,
        });

        if (currentLevel < requiredLevel) {
          logger.warn(
            {
              intentId,
              requiredLevel,
              currentLevel,
              snapshotLevel,
              trustDrift,
              degradedBelowRequirement: snapshotLevel >= requiredLevel,
            },
            'Trust level below requirement at decision stage'
          );
          await intentService.updateStatus(intent.id, intent.tenantId, 'denied', 'evaluating');
          recordJobResult('decision', 'success', (Date.now() - startTime) / 1000);
          return;
        }

        // Update trust metadata if score or level changed
        if (currentTrust && (currentTrust.level !== intent.trustLevel || currentTrust.score !== intent.trustScore)) {
          await intentService.updateTrustMetadata(
            intent.id,
            intent.tenantId,
            {
              score: currentTrust.score,
              level: currentTrust.level,
              components: currentTrust.components,
              revalidatedAt: new Date().toISOString(),
              snapshotScore,
              snapshotLevel,
              drift: trustDrift,
            },
            currentTrust.level,
            currentTrust.score
          );
        }

        // Get rule-based enforcement decision
        const ruleDecision = enforcementService.decide({
          intent,
          evaluation,
          trustScore: intent.trustScore ?? 0,
          trustLevel: (intent.trustLevel ?? 0) as TrustLevel,
        });

        // Determine final action considering policy evaluation
        let finalAction: ControlAction = ruleDecision.action;
        let policyOverride = false;

        if (policyEvaluation?.finalAction) {
          const combinedAction = getMostRestrictiveAction(
            ruleDecision.action,
            policyEvaluation.finalAction
          );

          if (combinedAction !== ruleDecision.action) {
            policyOverride = true;
            finalAction = combinedAction;

            // Record policy override metric
            recordPolicyOverride(
              intent.tenantId,
              ruleDecision.action,
              policyEvaluation.finalAction
            );

            logger.info(
              {
                intentId: intent.id,
                ruleAction: ruleDecision.action,
                policyAction: policyEvaluation.finalAction,
                finalAction,
              },
              'Policy evaluation overrode rule decision'
            );
          }
        }

        // Record both rule and policy evaluations
        await intentService.recordEvaluation(intent.id, intent.tenantId, {
          stage: 'decision',
          decision: {
            ruleDecision: {
              action: ruleDecision.action,
              constraintsEvaluated: ruleDecision.constraintsEvaluated,
            },
            policyDecision: policyEvaluation
              ? {
                  action: policyEvaluation.finalAction,
                  reason: policyEvaluation.reason,
                  policiesEvaluated: policyEvaluation.policiesEvaluated.length,
                  matchedPolicies: policyEvaluation.policiesEvaluated
                    .filter((p) => p.matchedRules.length > 0)
                    .map((p) => ({ policyId: p.policyId, action: p.action, reason: p.reason })),
                }
              : null,
            finalAction,
            policyOverride,
          },
        });

        const nextStatus =
          finalAction === 'allow'
            ? 'approved'
            : finalAction === 'deny'
              ? 'denied'
              : finalAction === 'escalate'
                ? 'escalated'
                : 'pending';

        await intentService.updateStatus(intent.id, intent.tenantId, nextStatus, 'evaluating');

        // Record proof of the decision (fire and forget)
        // Build a proper Decision object for the proof system
        const proofDecision = {
          intentId: intent.id,
          action: finalAction,
          constraintsEvaluated: ruleDecision.constraintsEvaluated ?? [],
          trustScore: intent.trustScore ?? 0,
          trustLevel: (intent.trustLevel ?? 0) as TrustLevel,
          decidedAt: new Date().toISOString(),
        };
        proofService.create({
          intent,
          decision: proofDecision,
          inputs: {
            evaluation,
            policyEvaluation: policyEvaluation ?? null,
            policyOverride,
            reason: policyEvaluation?.reason ?? undefined,
          },
          outputs: {
            nextStatus,
            ruleAction: ruleDecision.action,
            policyAction: policyEvaluation?.finalAction ?? null,
            finalAction,
          },
        }).catch((error: unknown) => {
          logger.warn({ error, intentId: intent.id }, 'Failed to record decision proof');
        });

        // Trigger webhook notifications for approved/denied statuses (fire and forget)
        if (nextStatus === 'approved') {
          webhookService.notifyIntent('intent.approved', intentId, tenantId, { finalAction, policyOverride }).catch((error: unknown) => {
            logger.warn({ error, intentId }, 'Failed to send webhook notification');
          });

          // Enqueue to execution queue for Cognigate processing
          // Extract or create trace context for propagation
          const traceContext = extractTraceFromJobData(job.data as Record<string, unknown>) ?? createTraceContext();
          const executeJobData = addTraceToJobData({
            intentId: intent.id,
            tenantId: intent.tenantId,
            decisionData: {
              action: finalAction,
              constraintsEvaluated: ruleDecision.constraintsEvaluated ?? [],
              reason: policyEvaluation?.reason ?? undefined,
              policyOverride,
            },
          }, traceContext);

          await intentExecuteQueue.add('intent.execute', executeJobData);
          logger.debug({ intentId, traceId: traceContext.traceId }, 'Intent enqueued for execution');
        } else if (nextStatus === 'denied') {
          const reason = policyEvaluation?.reason ?? 'Denied by policy';
          webhookService.notifyIntent('intent.denied', intentId, tenantId, { finalAction, reason }).catch((error: unknown) => {
            logger.warn({ error, intentId }, 'Failed to send webhook notification');
          });
        }
        // Note: 'escalated' status webhook is handled by escalation creation elsewhere

        // Determine the audit event type based on final action
        const auditEventType =
          finalAction === 'allow'
            ? 'intent.approved'
            : finalAction === 'deny'
              ? 'intent.denied'
              : 'intent.escalated';

        // Record decision audit event
        auditHelper.recordIntentEvent(
          tenantId,
          auditEventType,
          intentId,
          { type: 'service', id: 'intent-queue' },
          {
            outcome: 'success',
            stateChange: {
              before: { status: 'evaluating' },
              after: { status: nextStatus },
            },
            metadata: {
              ruleAction: ruleDecision.action,
              policyAction: policyEvaluation?.finalAction,
              finalAction,
              policyOverride,
              trustScore: intent.trustScore,
              trustLevel: intent.trustLevel,
            },
          }
        ).catch((auditError: unknown) => {
          logger.warn({ error: auditError }, 'Failed to record decision audit event');
        });

        recordJobResult('decision', 'success', (Date.now() - startTime) / 1000);
      } catch (error) {
        recordJobResult('decision', 'failure', (Date.now() - startTime) / 1000);
        throw error;
      }
    },
    {
      connection: connection(),
      concurrency,
      lockDuration,
      stalledInterval: lockDuration + 5000,
    }
  );

  decisionWorker.on('failed', (job, error) => {
    if (!job) return;
    const { intentId, tenantId } = job.data as { intentId: string; tenantId: string };
    logger.error({ jobId: job.id, intentId, error: error.message }, 'Intent decision job failed');

    if (job.attemptsMade >= config.intent.maxRetries) {
      Promise.all([
        moveToDeadLetterQueue(job, error, 'decision'),
        markIntentFailed(intentId, tenantId, error),
      ]).catch((dlqError: unknown) => {
        logger.error(
          { jobId: job.id, intentId, error: dlqError },
          'Failed to move decision job to DLQ or mark intent as failed'
        );
      });
    }
  });

  workers.push(decisionWorker);

  // Execution Worker - processes approved intents through Cognigate
  const executeWorker = new Worker(
    queueNames.execute,
    async (job) => {
      const startTime = Date.now();
      if (!intentService || isShuttingDown) return;

      // Extract trace context from job data or create new one
      const traceContext = extractTraceFromJobData(job.data as Record<string, unknown>) ?? createTraceContext();

      return runWithTraceContext(traceContext, async () => {
        const { intentId, tenantId, decisionData, resourceLimits: jobResourceLimits } = job.data as {
          intentId: string;
          tenantId: string;
          decisionData: {
            action: string;
            constraintsEvaluated: unknown[];
            reason?: string;
            policyOverride?: boolean;
          };
          resourceLimits?: Partial<ResourceLimits>;
        };

        const jobLogger = createTracedLogger(
          { component: 'execute-worker', jobId: job.id },
          traceContext.traceId,
          traceContext.spanId
        );

        // Track execution in progress
        updateExecutionsInProgress(tenantId, 1);

        try {
          const intent = await intentService!.get(intentId, tenantId);
          if (!intent) {
            jobLogger.warn({ intentId }, 'Intent no longer exists');
            updateExecutionsInProgress(tenantId, -1);
            return;
          }

          // Verify intent is still in approved status
          if (intent.status !== 'approved') {
            jobLogger.warn(
              { intentId, currentStatus: intent.status },
              'Intent is no longer approved, skipping execution'
            );
            updateExecutionsInProgress(tenantId, -1);
            return;
          }

          // Update status to executing
          await intentService!.updateStatus(intent.id, intent.tenantId, 'executing', 'approved');

          // Build the Decision object for Cognigate
          const decision: Decision = {
            intentId: intent.id,
            action: decisionData.action as 'allow',
            constraintsEvaluated: (decisionData.constraintsEvaluated ?? []) as Decision['constraintsEvaluated'],
            trustScore: intent.trustScore ?? 0,
            trustLevel: (intent.trustLevel ?? 0) as TrustLevel,
            decidedAt: new Date().toISOString(),
          };

          // Build resource limits from config and job data
          const gateway = getCognigateGateway();
          const resourceLimits: ResourceLimits = {
            maxMemoryMb: jobResourceLimits?.maxMemoryMb ?? config.cognigate.maxMemoryMb,
            maxCpuPercent: jobResourceLimits?.maxCpuPercent ?? config.cognigate.maxCpuPercent,
            timeoutMs: jobResourceLimits?.timeoutMs ?? config.cognigate.timeout,
            ...(jobResourceLimits?.maxNetworkRequests !== undefined && { maxNetworkRequests: jobResourceLimits.maxNetworkRequests }),
            ...(jobResourceLimits?.maxFileSystemOps !== undefined && { maxFileSystemOps: jobResourceLimits.maxFileSystemOps }),
          };

          // Build execution context
          const executionContext: ExecutionContext = {
            intent,
            decision,
            resourceLimits,
          };

          jobLogger.info(
            { intentId, intentType: intent.intentType },
            'Starting intent execution through Cognigate'
          );

          // Execute through Cognigate
          let executionResult: ExecutionResult;
          try {
            executionResult = await gateway.execute(executionContext);
          } catch (execError) {
            // Handle execution timeout or catastrophic failure
            const errorMessage = execError instanceof Error ? execError.message : 'Unknown execution error';
            jobLogger.error(
              { intentId, error: errorMessage },
              'Cognigate execution threw an error'
            );

            executionResult = {
              intentId: intent.id,
              success: false,
              outputs: {},
              resourceUsage: {
                memoryPeakMb: 0,
                cpuTimeMs: 0,
                wallTimeMs: Date.now() - startTime,
                networkRequests: 0,
                fileSystemOps: 0,
              },
              startedAt: new Date(startTime).toISOString(),
              completedAt: new Date().toISOString(),
              error: errorMessage,
            };
          }

          const executionDurationSeconds = (Date.now() - startTime) / 1000;

          // Record execution evaluation (using 'decision' stage with execution data in the decision field)
          await intentService!.recordEvaluation(intent.id, intent.tenantId, {
            stage: 'decision' as const,
            decision: {
              execution: {
                success: executionResult.success,
                outputs: executionResult.outputs,
                resourceUsage: executionResult.resourceUsage,
                startedAt: executionResult.startedAt,
                completedAt: executionResult.completedAt,
                error: executionResult.error,
              },
            },
          });

          // Determine result type for metrics
          const resultType = executionResult.success
            ? 'success'
            : executionResult.error?.includes('timeout')
              ? 'timeout'
              : executionResult.error?.includes('not allowed')
                ? 'blocked'
                : 'failure';

          // Record execution metrics
          recordExecution(
            tenantId,
            intent.intentType,
            resultType,
            executionDurationSeconds,
            executionResult.resourceUsage.memoryPeakMb
          );

          // Update intent status based on execution result
          if (executionResult.success) {
            await intentService!.updateStatus(intent.id, intent.tenantId, 'completed', 'executing');

            // Trigger webhook for completion
            webhookService.notifyIntent('intent.completed', intentId, tenantId, {
              outputs: executionResult.outputs,
              resourceUsage: executionResult.resourceUsage,
            }).catch((error: unknown) => {
              jobLogger.warn({ error, intentId }, 'Failed to send completion webhook');
            });

            // Record audit event for successful execution
            auditHelper.recordIntentEvent(
              tenantId,
              'intent.completed',
              intentId,
              { type: 'service', id: 'cognigate' },
              {
                outcome: 'success',
                stateChange: {
                  before: { status: 'executing' },
                  after: { status: 'completed' },
                },
                metadata: {
                  durationMs: executionResult.resourceUsage.wallTimeMs,
                  memoryPeakMb: executionResult.resourceUsage.memoryPeakMb,
                  cpuTimeMs: executionResult.resourceUsage.cpuTimeMs,
                },
              }
            ).catch((auditError: unknown) => {
              jobLogger.warn({ error: auditError }, 'Failed to record execution audit event');
            });

            jobLogger.info(
              { intentId, durationMs: executionResult.resourceUsage.wallTimeMs },
              'Intent execution completed successfully'
            );
          } else {
            await intentService!.updateStatus(intent.id, intent.tenantId, 'failed', 'executing');

            // Note: No webhook for execution failure - 'intent.failed' is not a supported webhook event type
            // Failed executions are recorded in audit logs and metrics for observability

            // Record audit event for failed execution
            auditHelper.recordIntentEvent(
              tenantId,
              'intent.failed',
              intentId,
              { type: 'service', id: 'cognigate' },
              {
                outcome: 'failure',
                reason: executionResult.error ?? 'Execution failed',
                stateChange: {
                  before: { status: 'executing' },
                  after: { status: 'failed' },
                },
                metadata: {
                  durationMs: executionResult.resourceUsage.wallTimeMs,
                  errorType: resultType,
                },
              }
            ).catch((auditError: unknown) => {
              jobLogger.warn({ error: auditError }, 'Failed to record execution failure audit event');
            });

            jobLogger.error(
              { intentId, error: executionResult.error },
              'Intent execution failed'
            );
          }

          updateExecutionsInProgress(tenantId, -1);
          recordJobResult('execute', 'success', executionDurationSeconds);
        } catch (error) {
          updateExecutionsInProgress(tenantId, -1);
          recordJobResult('execute', 'failure', (Date.now() - startTime) / 1000);
          throw error;
        }
      });
    },
    {
      connection: connection(),
      concurrency: Math.min(concurrency, config.cognigate.maxConcurrent), // Respect Cognigate concurrency limit
      lockDuration: config.cognigate.timeout + 10000, // Execution timeout + buffer
      stalledInterval: config.cognigate.timeout + 15000,
    }
  );

  executeWorker.on('failed', (job, error) => {
    if (!job) return;
    const { intentId, tenantId } = job.data as { intentId: string; tenantId: string };
    logger.error({ jobId: job.id, intentId, error: error.message }, 'Intent execution job failed');

    if (job.attemptsMade >= config.intent.maxRetries) {
      Promise.all([
        moveToDeadLetterQueue(job, error, 'execute'),
        markIntentFailed(intentId, tenantId, error),
      ]).catch((dlqError: unknown) => {
        logger.error(
          { jobId: job.id, intentId, error: dlqError },
          'Failed to move execute job to DLQ or mark intent as failed'
        );
      });
    }
  });

  workers.push(executeWorker);

  logger.info(
    { concurrency, lockDuration, maxRetries: config.intent.maxRetries },
    'Intent workers registered'
  );
}

/**
 * Gracefully shutdown all workers
 * Waits for in-flight jobs to complete before closing
 */
export async function shutdownWorkers(timeoutMs = 30000): Promise<void> {
  if (!workersStarted) return;

  isShuttingDown = true;
  logger.info('Initiating graceful shutdown of intent workers');

  const shutdownPromises = workers.map(async (worker) => {
    try {
      await worker.close();
    } catch (error) {
      logger.error({ error }, 'Error closing worker');
    }
  });

  // Close queue event listeners
  const eventClosePromises = queueEvents.map(async (events) => {
    try {
      await events.close();
    } catch (error) {
      logger.error({ error }, 'Error closing queue events');
    }
  });

  // Wait for all with timeout
  const allPromises = [...shutdownPromises, ...eventClosePromises];

  await Promise.race([
    Promise.all(allPromises),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        logger.warn('Shutdown timeout reached, forcing close');
        resolve();
      }, timeoutMs);
    }),
  ]);

  workersStarted = false;
  isShuttingDown = false;
  workers.length = 0;
  queueEvents.length = 0;

  logger.info('Intent workers shutdown complete');
}

/**
 * Get queue health status and update Prometheus gauges
 */
export async function getQueueHealth(): Promise<{
  intake: { waiting: number; active: number; failed: number };
  evaluate: { waiting: number; active: number; failed: number };
  decision: { waiting: number; active: number; failed: number };
  execute: { waiting: number; active: number; failed: number };
  deadLetter: { count: number };
}> {
  const [intakeCounts, evaluateCounts, decisionCounts, executeCounts, dlqCount] =
    await Promise.all([
      intentIntakeQueue.getJobCounts('waiting', 'active', 'failed'),
      intentEvaluateQueue.getJobCounts('waiting', 'active', 'failed'),
      intentDecisionQueue.getJobCounts('waiting', 'active', 'failed'),
      intentExecuteQueue.getJobCounts('waiting', 'active', 'failed'),
      deadLetterQueue.getJobCounts('waiting'),
    ]);

  // Update Prometheus gauges
  updateQueueGauges('intake', intakeCounts.waiting ?? 0, intakeCounts.active ?? 0);
  updateQueueGauges('evaluate', evaluateCounts.waiting ?? 0, evaluateCounts.active ?? 0);
  updateQueueGauges('decision', decisionCounts.waiting ?? 0, decisionCounts.active ?? 0);
  updateQueueGauges('execute', executeCounts.waiting ?? 0, executeCounts.active ?? 0);
  dlqSize.set(dlqCount.waiting ?? 0);

  return {
    intake: {
      waiting: intakeCounts.waiting ?? 0,
      active: intakeCounts.active ?? 0,
      failed: intakeCounts.failed ?? 0,
    },
    evaluate: {
      waiting: evaluateCounts.waiting ?? 0,
      active: evaluateCounts.active ?? 0,
      failed: evaluateCounts.failed ?? 0,
    },
    decision: {
      waiting: decisionCounts.waiting ?? 0,
      active: decisionCounts.active ?? 0,
      failed: decisionCounts.failed ?? 0,
    },
    execute: {
      waiting: executeCounts.waiting ?? 0,
      active: executeCounts.active ?? 0,
      failed: executeCounts.failed ?? 0,
    },
    deadLetter: {
      count: dlqCount.waiting ?? 0,
    },
  };
}

/**
 * Retry a job from the dead letter queue
 */
export async function retryDeadLetterJob(jobId: string): Promise<boolean> {
  const job = await deadLetterQueue.getJob(jobId);
  if (!job) {
    logger.warn({ jobId }, 'Dead letter job not found');
    return false;
  }

  const dlqData = job.data as DeadLetterJobData;
  const { originalQueue, jobData } = dlqData;

  // Re-enqueue to original queue
  const targetQueue =
    originalQueue === 'intake'
      ? intentIntakeQueue
      : originalQueue === 'evaluate'
        ? intentEvaluateQueue
        : originalQueue === 'execute'
          ? intentExecuteQueue
          : intentDecisionQueue;

  await targetQueue.add('retry', jobData);
  await job.remove();

  // Update DLQ size metric after removal
  const dlqCount = await deadLetterQueue.getJobCounts('waiting');
  dlqSize.set(dlqCount.waiting ?? 0);

  logger.info({ jobId, originalQueue, intentId: dlqData.intentId }, 'Dead letter job retried');
  return true;
}

/**
 * Get dead letter queue jobs with pagination
 */
export async function getDeadLetterJobs(
  limit: number = 50,
  offset: number = 0
): Promise<{
  jobs: Array<{
    id: string;
    data: DeadLetterJobData;
    addedAt: Date;
  }>;
  total: number;
}> {
  const jobs = await deadLetterQueue.getJobs(['waiting'], offset, offset + limit - 1);
  const counts = await deadLetterQueue.getJobCounts('waiting');

  return {
    jobs: jobs.map((job) => ({
      id: job.id ?? 'unknown',
      data: job.data as DeadLetterJobData,
      addedAt: new Date(job.timestamp),
    })),
    total: counts.waiting ?? 0,
  };
}

/**
 * Get dead letter queue jobs filtered by original queue
 */
export async function getDeadLetterJobsByQueue(
  originalQueue: string,
  limit: number = 50
): Promise<Array<{
  id: string;
  data: DeadLetterJobData;
  addedAt: Date;
}>> {
  // Get more jobs than limit since we're filtering
  const jobs = await deadLetterQueue.getJobs(['waiting'], 0, limit * 3);

  return jobs
    .filter((job) => {
      const data = job.data as DeadLetterJobData;
      return data.originalQueue === originalQueue;
    })
    .slice(0, limit)
    .map((job) => ({
      id: job.id ?? 'unknown',
      data: job.data as DeadLetterJobData,
      addedAt: new Date(job.timestamp),
    }));
}

/**
 * Purge old dead letter queue jobs
 * @param olderThanDays - Remove DLQ jobs older than this many days
 * @returns Number of jobs removed
 */
export async function purgeOldDeadLetterJobs(olderThanDays: number): Promise<number> {
  const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  const jobs = await deadLetterQueue.getJobs(['waiting']);

  let removedCount = 0;
  for (const job of jobs) {
    const data = job.data as DeadLetterJobData;
    const movedAt = new Date(data.movedToDlqAt).getTime();

    if (movedAt < cutoffTime) {
      await job.remove();
      removedCount++;
    }
  }

  // Update DLQ size metric after purge
  const dlqCount = await deadLetterQueue.getJobCounts('waiting');
  dlqSize.set(dlqCount.waiting ?? 0);

  logger.info(
    { removedCount, olderThanDays },
    'Purged old dead letter queue jobs'
  );

  return removedCount;
}

/**
 * Get the policy evaluation circuit breaker status
 * Useful for health checks and monitoring
 */
export async function getPolicyCircuitBreakerStatus(): Promise<{
  name: string;
  state: CircuitState;
  failureCount: number;
  failureThreshold: number;
  resetTimeoutMs: number;
  lastFailureTime: Date | null;
  openedAt: Date | null;
  timeUntilReset: number | null;
}> {
  return policyCircuitBreaker.getStatus();
}

/**
 * Force the policy circuit breaker to open state
 * Useful for manual intervention during incidents
 */
export async function forcePolicyCircuitBreakerOpen(): Promise<void> {
  await policyCircuitBreaker.forceOpen();
  logger.warn({}, 'Policy circuit breaker forcibly opened');
}

/**
 * Force the policy circuit breaker to closed state
 * Useful for recovery after manual intervention
 */
export async function forcePolicyCircuitBreakerClose(): Promise<void> {
  await policyCircuitBreaker.forceClose();
  logger.info({}, 'Policy circuit breaker forcibly closed');
}

/**
 * Reset the policy circuit breaker state
 * Clears all failure counts and state
 */
export async function resetPolicyCircuitBreaker(): Promise<void> {
  await policyCircuitBreaker.reset();
  logger.info({}, 'Policy circuit breaker reset');
}

/**
 * Get the trust engine circuit breaker status
 * Useful for health checks and monitoring
 */
export async function getTrustCircuitBreakerStatus(): Promise<{
  name: string;
  state: CircuitState;
  failureCount: number;
  failureThreshold: number;
  resetTimeoutMs: number;
  lastFailureTime: Date | null;
  openedAt: Date | null;
  timeUntilReset: number | null;
}> {
  return trustCircuitBreaker.getStatus();
}

/**
 * Force the trust engine circuit breaker to open state
 * Useful for manual intervention during incidents
 */
export async function forceTrustCircuitBreakerOpen(): Promise<void> {
  await trustCircuitBreaker.forceOpen();
  logger.warn({}, 'Trust engine circuit breaker forcibly opened');
}

/**
 * Force the trust engine circuit breaker to closed state
 * Useful for recovery after manual intervention
 */
export async function forceTrustCircuitBreakerClose(): Promise<void> {
  await trustCircuitBreaker.forceClose();
  logger.info({}, 'Trust engine circuit breaker forcibly closed');
}

/**
 * Reset the trust engine circuit breaker state
 * Clears all failure counts and state
 */
export async function resetTrustCircuitBreaker(): Promise<void> {
  await trustCircuitBreaker.reset();
  logger.info({}, 'Trust engine circuit breaker reset');
}
