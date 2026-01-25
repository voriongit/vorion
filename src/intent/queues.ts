import { Queue, Worker, QueueEvents, JobsOptions, Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Intent, TrustLevel, ControlAction } from '../common/types.js';
import type { EvaluationResult } from '../basis/types.js';
import type { PolicyAction } from '../policy/types.js';
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
  updateCircuitBreakerFailures,
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
  type AuditService,
} from '../audit/index.js';
import { createWebhookService } from './webhooks.js';
import {
  getCachedTrustScore,
  cacheTrustScore,
} from '../common/trust-cache.js';
import {
  tracePolicyEvaluate,
  recordPolicyEvaluationResult,
} from './tracing.js';

const logger = createLogger({ component: 'intent-queue' });

const queueNames = {
  intake: 'intent:intake',
  evaluate: 'intent:evaluate',
  decision: 'intent:decision',
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

// Policy evaluation circuit breaker - prevents cascading failures when policy engine is unhealthy
// Uses per-service circuit breaker configuration from the registry
const policyCircuitBreaker = getCircuitBreaker('policyEngine', (from: CircuitState, to: CircuitState) => {
  recordCircuitBreakerStateChange('policy-engine', from, to);
  logger.info(
    { circuitBreaker: 'policy-engine', from, to },
    'Policy circuit breaker state changed'
  );
});

/**
 * Action priority map - lower number = more restrictive
 */
const ACTION_PRIORITY: Record<ControlAction, number> = {
  deny: 1,
  escalate: 2,
  limit: 3,
  monitor: 4,
  terminate: 5,
  allow: 6,
};

/**
 * Convert policy action interface to control action string
 */
function policyActionToControlAction(action: PolicyAction): ControlAction {
  return action.action;
}

/**
 * Determine the most restrictive action between rule and policy evaluations
 * Returns the more restrictive action (deny > escalate > limit > monitor > terminate > allow)
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
  return rulePriority <= policyPriority
    ? ruleAction
    : policyAction;
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

export const deadLetterQueue = new Queue(queueNames.deadLetter, {
  connection: connection(),
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// Queue event listeners for monitoring
const queueEvents: QueueEvents[] = [];

[queueNames.intake, queueNames.evaluate, queueNames.decision].forEach((name) => {
  const events = new QueueEvents(name, { connection: connection() });
  queueEvents.push(events);

  events.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
    logger.error({ queue: name, jobId, failedReason }, 'Job failed');
  });

  events.on('stalled', ({ jobId }: { jobId: string }) => {
    logger.warn({ queue: name, jobId }, 'Job stalled');
  });
});

// Worker instances for graceful shutdown
const workers: Worker[] = [];
let workersStarted = false;
let intentService: IntentService | null = null;
let isShuttingDown = false;

/**
 * Move a failed job to the dead letter queue after max retries
 */
async function moveToDeadLetterQueue(
  job: Job,
  error: Error,
  stage: string
): Promise<void> {
  try {
    await deadLetterQueue.add('failed-intent', {
      originalQueue: stage,
      jobId: job.id,
      jobData: job.data,
      error: {
        message: error.message,
        stack: error.stack,
      },
      attemptsMade: job.attemptsMade,
      failedAt: new Date().toISOString(),
    });
    logger.info(
      { jobId: job.id, stage },
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
    async (job: Job) => {
      const startTime = Date.now();
      if (!intentService || isShuttingDown) return;

      // Extract trace context from job data or create new one
      const traceContext = extractTraceFromJobData(job.data) ?? createTraceContext();

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

          // Check cache first, then fall back to trust engine
          let trustRecord = await getCachedTrustScore(intent.entityId, tenantId);
          if (!trustRecord) {
            // Cache miss - fetch from trust engine
            trustRecord = await trustEngine.getScore(intent.entityId) ?? null;
            // Cache the result for future lookups
            if (trustRecord) {
              await cacheTrustScore(intent.entityId, tenantId, trustRecord);
            }
          }
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
          ).catch((auditError) => {
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

  intakeWorker.on('failed', async (job: Job | undefined, error: Error) => {
    if (!job) return;
    const { intentId, tenantId } = job.data as { intentId: string; tenantId: string };
    logger.error({ jobId: job.id, intentId, error: error.message }, 'Intent intake job failed');

    // Move to DLQ after final retry
    if (job.attemptsMade >= config.intent.maxRetries) {
      await moveToDeadLetterQueue(job, error, 'intake');
      await markIntentFailed(intentId, tenantId, error);
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
        ).catch((auditError) => {
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
            attributes: intent.metadata as Record<string, unknown>,
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

                  const policyEvaluation = await policyEvaluator.evaluateMultiple(policies, policyContext);

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
                  return { evaluation: null, error: circuitResult.error };
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
        ).catch((auditError) => {
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

  evaluateWorker.on('failed', async (job, error) => {
    if (!job) return;
    const { intentId, tenantId } = job.data as { intentId: string; tenantId: string };
    logger.error({ jobId: job.id, intentId, error: error.message }, 'Intent evaluation job failed');

    if (job.attemptsMade >= config.intent.maxRetries) {
      await moveToDeadLetterQueue(job, error, 'evaluate');
      await markIntentFailed(intentId, tenantId, error);
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

        // Re-validate trust at decision stage if configured
        if (config.intent.revalidateTrustAtDecision) {
          const currentTrust = await trustEngine.getScore(intent.entityId);
          const currentLevel = currentTrust?.level ?? 0;
          const requiredLevel = intentService.getRequiredTrustLevel(intent.intentType);

          // Record the trust gate check
          await intentService.recordEvaluation(intent.id, intent.tenantId, {
            stage: 'trust-gate',
            passed: currentLevel >= requiredLevel,
            requiredLevel,
            actualLevel: currentLevel,
          });

          if (currentLevel < requiredLevel) {
            logger.warn(
              { intentId, requiredLevel, currentLevel },
              'Trust level degraded below requirement at decision stage'
            );
            await intentService.updateStatus(intent.id, intent.tenantId, 'denied', 'evaluating');
            recordJobResult('decision', 'success', (Date.now() - startTime) / 1000);
            return;
          }

          // Update trust metadata if changed
          if (currentTrust && currentTrust.level !== intent.trustLevel) {
            await intentService.updateTrustMetadata(
              intent.id,
              intent.tenantId,
              {
                score: currentTrust.score,
                level: currentTrust.level,
                components: currentTrust.components,
                revalidatedAt: new Date().toISOString(),
              },
              currentTrust.level,
              currentTrust.score
            );
          }
        }

        // Get rule-based enforcement decision
        const ruleDecision = await enforcementService.decide({
          intent,
          evaluation,
          trustScore: intent.trustScore ?? 0,
          trustLevel: (intent.trustLevel ?? 0) as TrustLevel,
        });

        // Determine final action considering policy evaluation
        let finalAction: ControlAction = ruleDecision.action;
        let policyOverride = false;

        if (policyEvaluation && policyEvaluation.finalAction) {
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

        // Trigger webhook notifications for approved/denied statuses (fire and forget)
        if (nextStatus === 'approved') {
          webhookService.notifyIntent('intent.approved', intentId, tenantId, { finalAction, policyOverride }).catch((error) => {
            logger.warn({ error, intentId }, 'Failed to send webhook notification');
          });
        } else if (nextStatus === 'denied') {
          const reason = policyEvaluation?.reason ?? 'Denied by policy';
          webhookService.notifyIntent('intent.denied', intentId, tenantId, { finalAction, reason }).catch((error) => {
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
        ).catch((auditError) => {
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

  decisionWorker.on('failed', async (job, error) => {
    if (!job) return;
    const { intentId, tenantId } = job.data as { intentId: string; tenantId: string };
    logger.error({ jobId: job.id, intentId, error: error.message }, 'Intent decision job failed');

    if (job.attemptsMade >= config.intent.maxRetries) {
      await moveToDeadLetterQueue(job, error, 'decision');
      await markIntentFailed(intentId, tenantId, error);
    }
  });

  workers.push(decisionWorker);

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
  deadLetter: { count: number };
}> {
  const [intakeCounts, evaluateCounts, decisionCounts, dlqCount] =
    await Promise.all([
      intentIntakeQueue.getJobCounts('waiting', 'active', 'failed'),
      intentEvaluateQueue.getJobCounts('waiting', 'active', 'failed'),
      intentDecisionQueue.getJobCounts('waiting', 'active', 'failed'),
      deadLetterQueue.getJobCounts('waiting'),
    ]);

  // Update Prometheus gauges
  updateQueueGauges('intake', intakeCounts.waiting ?? 0, intakeCounts.active ?? 0);
  updateQueueGauges('evaluate', evaluateCounts.waiting ?? 0, evaluateCounts.active ?? 0);
  updateQueueGauges('decision', decisionCounts.waiting ?? 0, decisionCounts.active ?? 0);
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

  const { originalQueue, jobData } = job.data as {
    originalQueue: string;
    jobData: Record<string, unknown>;
  };

  // Re-enqueue to original queue
  const targetQueue =
    originalQueue === 'intake'
      ? intentIntakeQueue
      : originalQueue === 'evaluate'
        ? intentEvaluateQueue
        : intentDecisionQueue;

  await targetQueue.add('retry', jobData);
  await job.remove();

  logger.info({ jobId, originalQueue }, 'Dead letter job retried');
  return true;
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
