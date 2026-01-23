/**
 * Cognigate Queue Service
 *
 * BullMQ-based async job queue for execution processing in the
 * Cognigate constrained execution runtime.
 *
 * Features:
 * - Configurable concurrency and retry behavior
 * - Job priority support
 * - Stalled job detection and recovery
 * - Dead letter queue for permanent failures
 * - Graceful drain on shutdown
 * - Job deduplication by executionId
 * - Queue health monitoring
 *
 * @packageDocumentation
 */

import { Queue, Worker, type Job } from 'bullmq';
import { createLogger } from '../common/logger.js';
import type { ID } from '../common/types.js';

const logger = createLogger({ component: 'cognigate-queue' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Configuration for the Cognigate queue service
 */
export interface CognigateQueueConfig {
  /** Redis connection options */
  redis: { host: string; port: number; password?: string };
  /** Worker concurrency (default: 10) */
  concurrency?: number;
  /** Maximum retry attempts for failed jobs (default: 3) */
  maxRetries?: number;
  /** Base delay between retries in milliseconds (default: 5000) */
  retryDelay?: number;
  /** Interval for stalled job detection in milliseconds (default: 30000) */
  stalledInterval?: number;
}

/**
 * An execution job to be processed by the queue
 */
export interface ExecutionJob {
  executionId: ID;
  tenantId: ID;
  intentId: ID;
  handlerName: string;
  priority?: number;
  deadline?: number;
  context: Record<string, unknown>;
}

/**
 * Handler function for processing execution jobs
 */
export type ExecutionJobHandler = (job: ExecutionJob) => Promise<void>;

/**
 * Queue statistics
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  deadLetter: number;
}

// =============================================================================
// QUEUE NAMES
// =============================================================================

const QUEUE_NAME = 'cognigate:execution';
const DLQ_NAME = 'cognigate:dead-letter';

// =============================================================================
// COGNIGATE QUEUE SERVICE
// =============================================================================

/**
 * BullMQ-based queue service for async execution processing.
 *
 * Provides reliable job enqueueing, processing with concurrency control,
 * dead letter queue for permanent failures, and graceful shutdown with
 * active job draining.
 */
export class CognigateQueueService {
  private queue: Queue;
  private dlq: Queue;
  private worker: Worker | null = null;

  private readonly concurrency: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly stalledInterval: number;

  constructor(config: CognigateQueueConfig) {
    this.concurrency = config.concurrency ?? 10;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 5000;
    this.stalledInterval = config.stalledInterval ?? 30000;

    const connection = {
      host: config.redis.host,
      port: config.redis.port,
      ...(config.redis.password && { password: config.redis.password }),
    };

    this.queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: this.maxRetries,
        backoff: {
          type: 'exponential',
          delay: this.retryDelay,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000,
        },
        removeOnFail: false,
      },
    });

    this.dlq = new Queue(DLQ_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
      },
    });

    logger.info(
      { concurrency: this.concurrency, maxRetries: this.maxRetries },
      'Cognigate queue service initialized'
    );
  }

  // ===========================================================================
  // QUEUE OPERATIONS
  // ===========================================================================

  /**
   * Enqueue a single execution job for processing.
   * Jobs are deduplicated by executionId.
   *
   * @param job - The execution job to enqueue
   * @returns The job ID assigned by BullMQ
   */
  async enqueue(job: ExecutionJob): Promise<string> {
    const addedJob = await this.queue.add(
      'execution.process',
      job,
      {
        jobId: job.executionId, // Deduplication by executionId
        ...(job.priority != null && { priority: job.priority }),
        ...(job.deadline != null && { timestamp: job.deadline }),
      }
    );

    logger.debug(
      { jobId: addedJob.id, executionId: job.executionId, handlerName: job.handlerName },
      'Execution job enqueued'
    );

    return addedJob.id ?? job.executionId;
  }

  /**
   * Enqueue multiple execution jobs in a batch.
   *
   * @param jobs - Array of execution jobs to enqueue
   * @returns Array of job IDs assigned by BullMQ
   */
  async enqueueBatch(jobs: ExecutionJob[]): Promise<string[]> {
    if (jobs.length === 0) return [];

    const bulkJobs = jobs.map((job) => ({
      name: 'execution.process',
      data: job,
      opts: {
        jobId: job.executionId,
        ...(job.priority != null && { priority: job.priority }),
      },
    }));

    const addedJobs = await this.queue.addBulk(bulkJobs);

    logger.debug(
      { count: addedJobs.length },
      'Execution jobs batch enqueued'
    );

    return addedJobs.map((j) => j.id ?? '');
  }

  /**
   * Get a job by its ID.
   *
   * @param jobId - The job identifier
   * @returns The job instance or null if not found
   */
  async getJob(jobId: string): Promise<Job | null> {
    const job = await this.queue.getJob(jobId);
    return job ?? null;
  }

  /**
   * Remove a job from the queue by ID.
   *
   * @param jobId - The job identifier to remove
   */
  async removeJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.debug({ jobId }, 'Execution job removed');
    }
  }

  // ===========================================================================
  // WORKER
  // ===========================================================================

  /**
   * Start processing jobs from the queue with the given handler.
   *
   * @param handler - Function to process each execution job
   */
  startProcessing(handler: ExecutionJobHandler): void {
    if (this.worker) {
      logger.warn('Worker already started, stopping existing worker first');
      void this.stopProcessing();
    }

    this.worker = new Worker(
      QUEUE_NAME,
      async (job: Job<ExecutionJob>) => {
        const startTime = Date.now();
        const executionJob = job.data;

        logger.debug(
          { jobId: job.id, executionId: executionJob.executionId },
          'Processing execution job'
        );

        try {
          await handler(executionJob);

          const durationMs = Date.now() - startTime;
          logger.info(
            { jobId: job.id, executionId: executionJob.executionId, durationMs },
            'Execution job completed'
          );
        } catch (error) {
          const durationMs = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          logger.error(
            { jobId: job.id, executionId: executionJob.executionId, error: errorMessage, durationMs },
            'Execution job failed'
          );

          throw error;
        }
      },
      {
        connection: {
          host: (this.queue as any).opts?.connection?.host,
          port: (this.queue as any).opts?.connection?.port,
          password: (this.queue as any).opts?.connection?.password,
        },
        concurrency: this.concurrency,
        stalledInterval: this.stalledInterval,
        lockDuration: this.stalledInterval + 5000,
      }
    );

    // Handle permanently failed jobs
    this.worker.on('failed', (job, error) => {
      if (!job) return;

      if (job.attemptsMade >= this.maxRetries) {
        void this.moveToDeadLetter(
          job.id ?? job.data.executionId,
          error.message
        );
      }
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn({ jobId }, 'Cognigate execution job stalled');
    });

    logger.info(
      { concurrency: this.concurrency, stalledInterval: this.stalledInterval },
      'Cognigate queue worker started'
    );
  }

  /**
   * Stop the worker and wait for active jobs to complete.
   */
  async stopProcessing(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info('Cognigate queue worker stopped');
    }
  }

  // ===========================================================================
  // STATUS & MONITORING
  // ===========================================================================

  /**
   * Get comprehensive queue statistics.
   *
   * @returns Queue stats including all job states and DLQ count
   */
  async getQueueStats(): Promise<QueueStats> {
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed'
    );

    const dlqCounts = await this.dlq.getJobCounts('waiting');

    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      deadLetter: dlqCounts.waiting ?? 0,
    };
  }

  /**
   * Get all currently active (processing) jobs.
   *
   * @returns Array of active jobs
   */
  async getActiveJobs(): Promise<Job[]> {
    return this.queue.getJobs(['active']);
  }

  /**
   * Get failed jobs with optional limit.
   *
   * @param limit - Maximum number of jobs to return (default: 50)
   * @returns Array of failed jobs
   */
  async getFailedJobs(limit = 50): Promise<Job[]> {
    return this.queue.getJobs(['failed'], 0, limit - 1);
  }

  /**
   * Get waiting jobs with optional limit.
   *
   * @param limit - Maximum number of jobs to return (default: 50)
   * @returns Array of waiting jobs
   */
  async getWaitingJobs(limit = 50): Promise<Job[]> {
    return this.queue.getJobs(['waiting'], 0, limit - 1);
  }

  // ===========================================================================
  // DEAD LETTER QUEUE
  // ===========================================================================

  /**
   * Move a job to the dead letter queue.
   * Called when a job has exhausted all retry attempts.
   *
   * @param jobId - The job identifier
   * @param reason - The reason for moving to DLQ
   */
  async moveToDeadLetter(jobId: string, reason: string): Promise<void> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        logger.warn({ jobId }, 'Job not found for DLQ move');
        return;
      }

      await this.dlq.add('dead-letter', {
        originalJobId: jobId,
        jobData: job.data,
        reason,
        attemptsMade: job.attemptsMade,
        movedToDlqAt: new Date().toISOString(),
        originalTimestamp: job.timestamp ? new Date(job.timestamp).toISOString() : null,
      });

      await job.remove();

      logger.info(
        { jobId, reason, executionId: (job.data as ExecutionJob).executionId },
        'Execution job moved to dead letter queue'
      );
    } catch (error) {
      logger.error(
        { jobId, error },
        'Failed to move execution job to dead letter queue'
      );
    }
  }

  /**
   * Get jobs from the dead letter queue.
   *
   * @param limit - Maximum number of jobs to return (default: 50)
   * @returns Array of dead letter jobs
   */
  async getDeadLetterJobs(limit = 50): Promise<Job[]> {
    return this.dlq.getJobs(['waiting'], 0, limit - 1);
  }

  /**
   * Retry a job from the dead letter queue by re-enqueueing it.
   *
   * @param jobId - The DLQ job identifier to retry
   */
  async retryDeadLetter(jobId: string): Promise<void> {
    const dlqJob = await this.dlq.getJob(jobId);
    if (!dlqJob) {
      logger.warn({ jobId }, 'Dead letter job not found for retry');
      return;
    }

    const originalData = (dlqJob.data as Record<string, unknown>).jobData as ExecutionJob;
    if (!originalData) {
      logger.warn({ jobId }, 'Dead letter job has no original data');
      return;
    }

    // Re-enqueue the original job
    await this.enqueue(originalData);

    // Remove from DLQ
    await dlqJob.remove();

    logger.info(
      { jobId, executionId: originalData.executionId },
      'Dead letter job retried'
    );
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * Drain the queue: wait for all active jobs to complete,
   * then remove all waiting jobs.
   */
  async drain(): Promise<void> {
    logger.info('Draining cognigate execution queue');

    await this.queue.drain();

    logger.info('Cognigate execution queue drained');
  }

  /**
   * Obliterate the queue: remove all jobs and reset state.
   * Use with caution - this is destructive.
   */
  async obliterate(): Promise<void> {
    logger.warn('Obliterating cognigate execution queue');

    await this.queue.obliterate({ force: true });

    logger.info('Cognigate execution queue obliterated');
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Gracefully shutdown the queue service.
   * Stops the worker, waits for active jobs to complete,
   * and closes queue connections.
   */
  async shutdown(): Promise<void> {
    logger.info('Initiating cognigate queue service shutdown');

    // Stop processing new jobs
    if (this.worker) {
      try {
        await this.worker.close();
        this.worker = null;
        logger.info('Cognigate queue worker closed');
      } catch (error) {
        logger.error({ error }, 'Error closing cognigate queue worker');
      }
    }

    // Close queue connections
    try {
      await this.queue.close();
      logger.info('Cognigate execution queue closed');
    } catch (error) {
      logger.error({ error }, 'Error closing cognigate execution queue');
    }

    try {
      await this.dlq.close();
      logger.info('Cognigate dead letter queue closed');
    } catch (error) {
      logger.error({ error }, 'Error closing cognigate dead letter queue');
    }

    logger.info('Cognigate queue service shutdown complete');
  }
}

// =============================================================================
// FACTORY
// =============================================================================

let queueServiceInstance: CognigateQueueService | null = null;

/**
 * Create a new CognigateQueueService instance.
 *
 * @param config - Queue configuration with Redis connection details
 * @returns A new CognigateQueueService instance
 */
export function createCognigateQueueService(
  config: CognigateQueueConfig
): CognigateQueueService {
  return new CognigateQueueService(config);
}

/**
 * Get the singleton CognigateQueueService instance.
 *
 * @param config - Queue configuration (required on first call)
 * @returns The singleton queue service
 */
export function getCognigateQueueService(
  config?: CognigateQueueConfig
): CognigateQueueService {
  if (!queueServiceInstance) {
    if (!config) {
      throw new Error('CognigateQueueService requires config on first initialization');
    }
    queueServiceInstance = new CognigateQueueService(config);
  }
  return queueServiceInstance;
}

/**
 * Reset the queue service singleton (for testing).
 */
export async function resetCognigateQueueService(): Promise<void> {
  if (queueServiceInstance) {
    await queueServiceInstance.shutdown();
    queueServiceInstance = null;
  }
}
