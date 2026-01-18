import { Queue, Worker, QueueEvents, JobsOptions, Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Intent, TrustLevel } from '../common/types.js';
import type { EvaluationResult } from '../basis/types.js';
import { TrustEngine } from '../trust-engine/index.js';
import { RuleEvaluator } from '../basis/evaluator.js';
import { createEnforcementService } from '../enforce/index.js';
import { createLogger } from '../common/logger.js';
import { getRedis } from '../common/redis.js';
import { getConfig } from '../common/config.js';
import type { IntentService } from './index.js';
import {
  recordJobResult,
  updateQueueGauges,
  dlqSize,
} from './metrics.js';

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
const ruleEvaluator = new RuleEvaluator();
const enforcementService = createEnforcementService({ defaultAction: 'deny' });

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
  } catch (updateError) {
    logger.error(
      { intentId, error: updateError },
      'Failed to mark intent as failed'
    );
  }
}

export async function enqueueIntentSubmission(
  intent: Intent,
  options?: { namespace?: string }
): Promise<void> {
  await intentIntakeQueue.add('intent.submitted', {
    intentId: intent.id,
    tenantId: intent.tenantId,
    namespace: options?.namespace,
  });
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

        const trustRecord = await trustEngine.getScore(intent.entityId);
        const trustSnapshot = trustRecord
          ? {
              score: trustRecord.score,
              level: trustRecord.level,
              components: trustRecord.components,
            }
          : null;

        await intentService.updateTrustMetadata(
          intent.id,
          intent.tenantId,
          trustSnapshot,
          trustRecord?.level,
          trustRecord?.score
        );

        await intentService.updateStatus(intent.id, intent.tenantId, 'evaluating', 'pending');
        await intentService.recordEvaluation(intent.id, intent.tenantId, {
          stage: 'trust-snapshot',
          result: trustSnapshot,
        });

        await intentEvaluateQueue.add('intent.evaluate', {
          intentId: intent.id,
          tenantId: intent.tenantId,
          namespace,
        });

        recordJobResult('intake', 'success', (Date.now() - startTime) / 1000);
      } catch (error) {
        recordJobResult('intake', 'failure', (Date.now() - startTime) / 1000);
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

  intakeWorker.on('failed', async (job, error) => {
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

        const evaluation = await ruleEvaluator.evaluate({
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
            trustLevel: intent.trustLevel ?? 0,
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
        });

        await intentService.recordEvaluation(intent.id, intent.tenantId, {
          stage: 'basis',
          evaluation,
          namespace: namespace ?? config.intent.defaultNamespace,
        });

        await intentDecisionQueue.add('intent.decision', {
          intentId: intent.id,
          tenantId: intent.tenantId,
          evaluation,
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
      const { intentId, tenantId, evaluation } = job.data as {
        intentId: string;
        tenantId: string;
        evaluation: EvaluationResult;
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

        const decision = await enforcementService.decide({
          intent,
          evaluation,
          trustScore: intent.trustScore ?? 0,
          trustLevel: (intent.trustLevel ?? 0) as TrustLevel,
        });

        await intentService.recordEvaluation(intent.id, intent.tenantId, {
          stage: 'decision',
          decision,
        });

        const nextStatus =
          decision.action === 'allow'
            ? 'approved'
            : decision.action === 'deny'
              ? 'denied'
              : decision.action === 'escalate'
                ? 'escalated'
                : 'pending';

        await intentService.updateStatus(intent.id, intent.tenantId, nextStatus, 'evaluating');
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
