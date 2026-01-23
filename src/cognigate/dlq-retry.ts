/**
 * COGNIGATE Dead Letter Queue Retry Orchestrator
 *
 * Provides automatic retry orchestration for execution jobs that have landed
 * in the Cognigate dead letter queue. Jobs are retried with exponential backoff
 * (with configurable jitter) up to a configurable maximum number of attempts.
 * Jobs exceeding the retry limit remain in the DLQ as permanent failures.
 * Old jobs are automatically purged after a configurable retention period.
 *
 * Key capabilities:
 * - Periodic DLQ scanning on configurable interval (default 60s)
 * - Exponential backoff with configurable multiplier and jitter factor
 * - Maximum retry attempt enforcement (configurable, default 5)
 * - Automatic purge of old entries beyond retention window (default 7 days)
 * - Comprehensive Prometheus metrics with `vorion_cognigate_` prefix
 * - Singleton lifecycle management with start/stop semantics
 * - BullMQ Queue integration for DLQ access and re-enqueueing
 *
 * @packageDocumentation
 */

import { Queue, type Job } from 'bullmq';
import { getRedis } from '../common/redis.js';
import { createLogger } from '../common/logger.js';
import { Counter, Gauge } from 'prom-client';
import { cognigateRegistry } from './metrics.js';

const logger = createLogger({ component: 'cognigate-dlq-retry' });

// =============================================================================
// CONSTANTS
// =============================================================================

/** Primary execution queue name */
const EXECUTIONS_QUEUE_NAME = 'cognigate:executions';

/** Dead letter queue name */
const DLQ_QUEUE_NAME = 'cognigate:dlq';

/** Redis key prefix for retry count tracking */
const RETRY_COUNT_KEY_PREFIX = 'cognigate:dlq:retry_count:';

/** Redis key prefix for last retry timestamp tracking */
const LAST_RETRY_KEY_PREFIX = 'cognigate:dlq:last_retry_at:';

// =============================================================================
// METRICS
// =============================================================================

const dlqRetryAttempts = new Counter({
  name: 'vorion_cognigate_dlq_retry_attempts_total',
  help: 'Total number of DLQ retry attempts made by the orchestrator',
  labelNames: ['handler'] as const,
  registers: [cognigateRegistry],
});

const dlqRetrySuccesses = new Counter({
  name: 'vorion_cognigate_dlq_retry_successes_total',
  help: 'Total number of successful DLQ retries (job re-enqueued to execution queue)',
  labelNames: ['handler'] as const,
  registers: [cognigateRegistry],
});

const dlqRetryFailures = new Counter({
  name: 'vorion_cognigate_dlq_retry_failures_total',
  help: 'Total number of failed DLQ retry attempts',
  labelNames: ['handler', 'reason'] as const,
  registers: [cognigateRegistry],
});

const dlqRetryExhausted = new Counter({
  name: 'vorion_cognigate_dlq_retry_exhausted_total',
  help: 'Total number of jobs that have exhausted all retry attempts and remain permanently failed',
  labelNames: ['handler'] as const,
  registers: [cognigateRegistry],
});

const dlqSize = new Gauge({
  name: 'vorion_cognigate_dlq_size',
  help: 'Current number of jobs in the Cognigate dead letter queue',
  registers: [cognigateRegistry],
});

const dlqPurgedTotal = new Counter({
  name: 'vorion_cognigate_dlq_purged_total',
  help: 'Total number of jobs purged from the DLQ by the auto-purge mechanism',
  registers: [cognigateRegistry],
});

const dlqRetryCycleDuration = new Gauge({
  name: 'vorion_cognigate_dlq_retry_cycle_duration_ms',
  help: 'Duration of the most recent DLQ retry cycle in milliseconds',
  registers: [cognigateRegistry],
});

const dlqRetryBacklogAge = new Gauge({
  name: 'vorion_cognigate_dlq_oldest_job_age_seconds',
  help: 'Age in seconds of the oldest job currently in the DLQ',
  registers: [cognigateRegistry],
});

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Configuration options for the Cognigate DLQ retry orchestrator.
 *
 * All fields have sensible defaults. Pass a partial configuration
 * to override only the values you need.
 */
export interface CognigateDlqRetryConfig {
  /** Whether the orchestrator is enabled (default: true) */
  enabled: boolean;

  /** How often to scan the DLQ for retryable jobs in milliseconds (default: 60000 = 60s) */
  intervalMs: number;

  /** Maximum number of retry attempts per job before permanent failure (default: 5) */
  maxRetryAttempts: number;

  /** Exponential backoff multiplier applied to baseRetryDelayMs (default: 2) */
  retryBackoffMultiplier: number;

  /** Base delay before the first retry attempt in milliseconds (default: 10000 = 10s) */
  baseRetryDelayMs: number;

  /** Jitter factor (0-1) applied to computed backoff delay to avoid thundering herd (default: 0.15) */
  jitterFactor: number;

  /** Maximum number of jobs to process per retry cycle (default: 25) */
  maxJobsPerCycle: number;

  /** Automatically purge DLQ jobs older than this many days (default: 7) */
  purgeAfterDays: number;

  /** Redis connection options for BullMQ queues */
  redis: { host: string; port: number; password?: string };
}

/**
 * Default configuration values for the DLQ retry orchestrator.
 */
const DEFAULT_CONFIG: CognigateDlqRetryConfig = {
  enabled: true,
  intervalMs: 60000,
  maxRetryAttempts: 5,
  retryBackoffMultiplier: 2,
  baseRetryDelayMs: 10000,
  jitterFactor: 0.15,
  maxJobsPerCycle: 25,
  purgeAfterDays: 7,
  redis: { host: 'localhost', port: 6379 },
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Structure of data stored in a DLQ job, representing a failed execution
 * that was moved from the primary execution queue.
 */
export interface CognigateDlqJobData {
  /** Original job ID from the execution queue */
  originalJobId: string;

  /** The original execution job payload */
  jobData: {
    executionId: string;
    tenantId: string;
    intentId: string;
    handlerName: string;
    priority?: number;
    deadline?: number;
    context: Record<string, unknown>;
  };

  /** Reason the job was moved to the DLQ */
  reason: string;

  /** Number of attempts made before DLQ placement */
  attemptsMade: number;

  /** ISO timestamp when the job was moved to the DLQ */
  movedToDlqAt: string;

  /** ISO timestamp of the original job creation, or null if unavailable */
  originalTimestamp: string | null;
}

/**
 * Summary result of a single retry cycle execution.
 */
export interface RetryCycleSummary {
  /** Number of jobs successfully re-enqueued */
  retried: number;

  /** Number of jobs that failed during retry processing */
  failed: number;

  /** Number of old jobs purged from the DLQ */
  purged: number;

  /** Number of jobs that have exhausted all retry attempts */
  exhausted: number;

  /** Total number of jobs currently in the DLQ */
  dlqTotal: number;

  /** Duration of the retry cycle in milliseconds */
  cycleDurationMs: number;
}

// =============================================================================
// ORCHESTRATOR
// =============================================================================

/**
 * Orchestrates automatic retries of failed execution jobs in the Cognigate
 * dead letter queue.
 *
 * The orchestrator runs on a configurable timer interval, fetches jobs from
 * the DLQ, evaluates each for retry eligibility based on attempt count and
 * exponential backoff timing with jitter, and re-enqueues eligible jobs to
 * the primary execution queue. Jobs that have exhausted their retry budget
 * remain in the DLQ as permanent failures until purged by the auto-purge
 * mechanism.
 *
 * The orchestrator uses Redis-based counters to track per-job retry counts
 * and last retry timestamps, ensuring correctness across restarts.
 */
export class CognigateDlqRetryOrchestrator {
  private timer: NodeJS.Timeout | null = null;
  private readonly config: CognigateDlqRetryConfig;
  private running = false;
  private executionQueue: Queue | null = null;
  private dlqQueue: Queue | null = null;

  constructor(config?: Partial<CognigateDlqRetryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Start the retry orchestrator.
   *
   * Initializes BullMQ queue connections and begins the periodic timer
   * that triggers retry cycles. If the orchestrator is disabled via config,
   * this method is a no-op.
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('Cognigate DLQ retry orchestrator is disabled, not starting');
      return;
    }

    if (this.timer) {
      logger.warn('Cognigate DLQ retry orchestrator is already running');
      return;
    }

    // Initialize BullMQ queue connections
    const connection = {
      host: this.config.redis.host,
      port: this.config.redis.port,
      ...(this.config.redis.password && { password: this.config.redis.password }),
    };

    this.executionQueue = new Queue(EXECUTIONS_QUEUE_NAME, { connection });
    this.dlqQueue = new Queue(DLQ_QUEUE_NAME, { connection });

    logger.info(
      {
        intervalMs: this.config.intervalMs,
        maxRetryAttempts: this.config.maxRetryAttempts,
        maxJobsPerCycle: this.config.maxJobsPerCycle,
        purgeAfterDays: this.config.purgeAfterDays,
        baseRetryDelayMs: this.config.baseRetryDelayMs,
        retryBackoffMultiplier: this.config.retryBackoffMultiplier,
        jitterFactor: this.config.jitterFactor,
      },
      'Starting Cognigate DLQ retry orchestrator'
    );

    this.timer = setInterval(() => {
      this.runCycle().catch((error) => {
        logger.error({ error }, 'Unhandled error in Cognigate DLQ retry cycle');
      });
    }, this.config.intervalMs);

    // Prevent the timer from keeping the process alive during shutdown
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stop the retry orchestrator.
   *
   * Clears the periodic timer and closes BullMQ queue connections.
   * In-flight cycles will complete naturally before connections are closed.
   */
  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    // Close queue connections
    if (this.executionQueue) {
      try {
        await this.executionQueue.close();
      } catch (error) {
        logger.error({ error }, 'Error closing execution queue connection');
      }
      this.executionQueue = null;
    }

    if (this.dlqQueue) {
      try {
        await this.dlqQueue.close();
      } catch (error) {
        logger.error({ error }, 'Error closing DLQ queue connection');
      }
      this.dlqQueue = null;
    }

    logger.info('Cognigate DLQ retry orchestrator stopped');
  }

  /**
   * Check whether the orchestrator is currently running.
   */
  isRunning(): boolean {
    return this.timer !== null;
  }

  // ===========================================================================
  // RETRY CYCLE
  // ===========================================================================

  /**
   * Run a single retry cycle.
   *
   * This method is safe to call externally (e.g., for testing or manual
   * triggering). It will not throw - all errors are caught and logged.
   * Concurrent calls are serialized: if a cycle is already in progress,
   * subsequent calls return immediately with zero counts.
   *
   * @returns Summary of the cycle including retry, failure, purge, and exhaustion counts
   */
  async runCycle(): Promise<RetryCycleSummary> {
    if (this.running) {
      logger.debug('Cognigate DLQ retry cycle already in progress, skipping');
      return { retried: 0, failed: 0, purged: 0, exhausted: 0, dlqTotal: 0, cycleDurationMs: 0 };
    }

    if (!this.dlqQueue || !this.executionQueue) {
      logger.error('Queue connections not initialized; call start() before runCycle()');
      return { retried: 0, failed: 0, purged: 0, exhausted: 0, dlqTotal: 0, cycleDurationMs: 0 };
    }

    this.running = true;
    const cycleStart = Date.now();
    let retried = 0;
    let failed = 0;
    let purged = 0;
    let exhausted = 0;

    try {
      // Step 1: Purge old DLQ jobs beyond retention window
      purged = await this.purgeOldJobs();

      // Step 2: Fetch current DLQ jobs for evaluation
      const dlqJobs = await this.fetchDlqJobs();
      const dlqTotal = dlqJobs.length;

      // Update DLQ size gauge
      dlqSize.set(dlqTotal);

      if (dlqTotal === 0) {
        logger.debug('No jobs in Cognigate DLQ to retry');
        const cycleDurationMs = Date.now() - cycleStart;
        dlqRetryCycleDuration.set(cycleDurationMs);
        return { retried, failed, purged, exhausted, dlqTotal, cycleDurationMs };
      }

      // Update oldest job age metric
      this.updateOldestJobAge(dlqJobs);

      logger.debug(
        { jobCount: dlqTotal },
        'Evaluating Cognigate DLQ jobs for retry eligibility'
      );

      // Step 3: Evaluate each job for retry eligibility
      for (const dlqJob of dlqJobs) {
        if (!dlqJob.id) continue;

        try {
          const jobData = dlqJob.data as CognigateDlqJobData;
          const handlerName = jobData.jobData?.handlerName ?? 'unknown';
          const retryCount = await this.getRetryCount(dlqJob.id);

          // Check if the job has exhausted all retry attempts
          if (retryCount >= this.config.maxRetryAttempts) {
            dlqRetryExhausted.inc({ handler: handlerName });
            exhausted++;
            logger.debug(
              {
                jobId: dlqJob.id,
                retryCount,
                maxRetryAttempts: this.config.maxRetryAttempts,
                handlerName,
              },
              'Cognigate DLQ job exhausted retry attempts, leaving in DLQ'
            );
            continue;
          }

          // Check if exponential backoff period has elapsed
          if (!this.isEligibleForRetry(jobData, retryCount)) {
            logger.debug(
              { jobId: dlqJob.id, retryCount, handlerName },
              'Cognigate DLQ job not yet eligible for retry (backoff not elapsed)'
            );
            continue;
          }

          // Attempt the retry: re-enqueue to the execution queue
          dlqRetryAttempts.inc({ handler: handlerName });

          const success = await this.retryJob(dlqJob, jobData);

          if (success) {
            await this.recordRetryAttempt(dlqJob.id, retryCount + 1);
            dlqRetrySuccesses.inc({ handler: handlerName });
            retried++;
            logger.info(
              {
                jobId: dlqJob.id,
                executionId: jobData.jobData?.executionId,
                tenantId: jobData.jobData?.tenantId,
                handlerName,
                retryAttempt: retryCount + 1,
              },
              'Cognigate DLQ job retried successfully'
            );
          } else {
            dlqRetryFailures.inc({ handler: handlerName, reason: 'enqueue_failed' });
            failed++;
            logger.warn(
              { jobId: dlqJob.id, handlerName },
              'Cognigate DLQ job retry failed: could not re-enqueue'
            );
          }
        } catch (jobError) {
          const jobData = dlqJob.data as CognigateDlqJobData | null;
          const handlerName = jobData?.jobData?.handlerName ?? 'unknown';
          dlqRetryFailures.inc({ handler: handlerName, reason: 'error' });
          failed++;
          logger.error(
            { jobId: dlqJob.id, error: jobError, handlerName },
            'Error processing Cognigate DLQ job for retry'
          );
        }
      }
    } catch (cycleError) {
      logger.error({ error: cycleError }, 'Error during Cognigate DLQ retry cycle');
    } finally {
      this.running = false;
      const cycleDurationMs = Date.now() - cycleStart;
      dlqRetryCycleDuration.set(cycleDurationMs);

      const dlqTotal = await this.getDlqJobCount();
      dlqSize.set(dlqTotal);

      if (retried > 0 || failed > 0 || purged > 0 || exhausted > 0) {
        logger.info(
          { retried, failed, purged, exhausted, dlqTotal, cycleDurationMs },
          'Cognigate DLQ retry cycle completed'
        );
      } else {
        logger.debug(
          { cycleDurationMs, dlqTotal },
          'Cognigate DLQ retry cycle completed (no action taken)'
        );
      }
    }

    const cycleDurationMs = Date.now() - cycleStart;
    return { retried, failed, purged, exhausted, dlqTotal: await this.getDlqJobCount(), cycleDurationMs };
  }

  // ===========================================================================
  // BACKOFF & ELIGIBILITY
  // ===========================================================================

  /**
   * Determine whether a DLQ job is eligible for retry based on exponential
   * backoff timing with jitter.
   *
   * A job is eligible when the time elapsed since it was moved to the DLQ
   * (or since its last retry attempt) exceeds the computed backoff delay.
   *
   * @param jobData - The DLQ job data containing timing information
   * @param retryCount - Current number of retry attempts made
   * @returns Whether the job is eligible for another retry attempt
   */
  private isEligibleForRetry(jobData: CognigateDlqJobData, retryCount: number): boolean {
    if (retryCount >= this.config.maxRetryAttempts) {
      return false;
    }

    const requiredDelay = this.computeBackoffDelay(retryCount);
    const referenceTime = new Date(jobData.movedToDlqAt).getTime();
    const elapsed = Date.now() - referenceTime;

    return elapsed >= requiredDelay;
  }

  /**
   * Compute the backoff delay for a given retry attempt count using exponential
   * backoff with configurable jitter.
   *
   * Formula:
   *   baseDelay = baseRetryDelayMs * (retryBackoffMultiplier ^ attemptCount)
   *   jitter = baseDelay * jitterFactor * random(-1, 1)
   *   delay = baseDelay + jitter
   *
   * Example with defaults (base=10000, multiplier=2, jitter=0.15):
   *   Attempt 0: ~10000ms  (10s +/- 1.5s)
   *   Attempt 1: ~20000ms  (20s +/- 3s)
   *   Attempt 2: ~40000ms  (40s +/- 6s)
   *   Attempt 3: ~80000ms  (80s +/- 12s)
   *   Attempt 4: ~160000ms (160s +/- 24s)
   *
   * @param attemptCount - Zero-based retry attempt index
   * @returns Computed delay in milliseconds (always >= 0)
   */
  private computeBackoffDelay(attemptCount: number): number {
    const baseDelay = this.config.baseRetryDelayMs *
      Math.pow(this.config.retryBackoffMultiplier, attemptCount);

    // Apply jitter: random value between -jitterFactor and +jitterFactor of baseDelay
    const jitterRange = baseDelay * this.config.jitterFactor;
    const jitter = (Math.random() * 2 - 1) * jitterRange;

    return Math.max(0, baseDelay + jitter);
  }

  // ===========================================================================
  // RETRY EXECUTION
  // ===========================================================================

  /**
   * Retry a single DLQ job by re-enqueueing its original payload to the
   * primary execution queue.
   *
   * The original job data is extracted from the DLQ entry, a new job is
   * added to the execution queue with a unique ID (to avoid deduplication
   * conflicts with the original failed job), and the DLQ entry is removed.
   *
   * @param dlqJob - The BullMQ DLQ job instance
   * @param jobData - Parsed DLQ job data
   * @returns Whether the retry was successful
   */
  private async retryJob(dlqJob: Job<CognigateDlqJobData>, jobData: CognigateDlqJobData): Promise<boolean> {
    if (!this.executionQueue || !this.dlqQueue) {
      return false;
    }

    const originalData = jobData.jobData;
    if (!originalData) {
      logger.warn(
        { jobId: dlqJob.id },
        'Cognigate DLQ job has no original execution data, cannot retry'
      );
      return false;
    }

    try {
      // Re-enqueue to execution queue with a retry-specific job ID
      // to avoid collisions with the original failed job
      const retryJobId = `${originalData.executionId}:retry:${Date.now()}`;

      await this.executionQueue.add(
        'execution.process',
        originalData,
        {
          jobId: retryJobId,
          ...(originalData.priority != null && { priority: originalData.priority }),
        }
      );

      // Remove the job from the DLQ after successful re-enqueue
      await dlqJob.remove();

      return true;
    } catch (error) {
      logger.error(
        { jobId: dlqJob.id, executionId: originalData.executionId, error },
        'Failed to re-enqueue Cognigate DLQ job to execution queue'
      );
      return false;
    }
  }

  // ===========================================================================
  // PURGE
  // ===========================================================================

  /**
   * Purge DLQ jobs older than the configured retention period.
   *
   * Jobs are identified as purgeable when their `movedToDlqAt` timestamp
   * exceeds the `purgeAfterDays` threshold. Associated Redis retry tracking
   * keys are also cleaned up.
   *
   * @returns Number of jobs purged
   */
  private async purgeOldJobs(): Promise<number> {
    if (!this.dlqQueue) {
      return 0;
    }

    let purgedCount = 0;
    const purgeThreshold = Date.now() - (this.config.purgeAfterDays * 24 * 60 * 60 * 1000);

    try {
      // Fetch all DLQ jobs (up to a reasonable limit for purge scanning)
      const allJobs = await this.dlqQueue.getJobs(['waiting', 'delayed'], 0, 500);

      for (const job of allJobs) {
        if (!job.id) continue;

        try {
          const jobData = job.data as CognigateDlqJobData;
          const movedAt = new Date(jobData.movedToDlqAt).getTime();

          if (movedAt < purgeThreshold) {
            // Remove associated Redis keys
            await this.cleanupRetryKeys(job.id);

            // Remove the job from the DLQ
            await job.remove();
            purgedCount++;

            logger.debug(
              {
                jobId: job.id,
                movedToDlqAt: jobData.movedToDlqAt,
                executionId: jobData.jobData?.executionId,
              },
              'Purged old Cognigate DLQ job'
            );
          }
        } catch (jobError) {
          logger.error(
            { jobId: job.id, error: jobError },
            'Error purging individual Cognigate DLQ job'
          );
        }
      }

      if (purgedCount > 0) {
        dlqPurgedTotal.inc(purgedCount);
        logger.info(
          { purgedCount, purgeAfterDays: this.config.purgeAfterDays },
          'Purged old Cognigate DLQ jobs'
        );
      }
    } catch (error) {
      logger.error({ error }, 'Error during Cognigate DLQ purge operation');
    }

    return purgedCount;
  }

  // ===========================================================================
  // REDIS STATE MANAGEMENT
  // ===========================================================================

  /**
   * Get the current retry count for a DLQ job from Redis.
   *
   * @param jobId - The DLQ job identifier
   * @returns Current retry count (0 if never retried or on error)
   */
  private async getRetryCount(jobId: string): Promise<number> {
    try {
      const redis = getRedis();
      const count = await redis.get(`${RETRY_COUNT_KEY_PREFIX}${jobId}`);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      logger.error({ jobId, error }, 'Error reading Cognigate DLQ retry count from Redis');
      return 0;
    }
  }

  /**
   * Record a retry attempt for a DLQ job in Redis.
   *
   * Updates both the retry count and the last retry timestamp. Keys are
   * given a TTL of (purgeAfterDays + 1) days to prevent key leakage
   * for jobs that are purged or otherwise removed.
   *
   * @param jobId - The DLQ job identifier
   * @param newCount - The new retry count value
   */
  private async recordRetryAttempt(jobId: string, newCount: number): Promise<void> {
    try {
      const redis = getRedis();
      const ttlSeconds = (this.config.purgeAfterDays + 1) * 24 * 60 * 60;

      const countKey = `${RETRY_COUNT_KEY_PREFIX}${jobId}`;
      const lastRetryKey = `${LAST_RETRY_KEY_PREFIX}${jobId}`;

      // Use pipeline for atomic updates
      const pipeline = redis.pipeline();
      pipeline.set(countKey, String(newCount));
      pipeline.expire(countKey, ttlSeconds);
      pipeline.set(lastRetryKey, String(Date.now()));
      pipeline.expire(lastRetryKey, ttlSeconds);
      await pipeline.exec();
    } catch (error) {
      logger.error(
        { jobId, error },
        'Error recording Cognigate DLQ retry attempt in Redis'
      );
    }
  }

  /**
   * Clean up Redis retry tracking keys for a purged DLQ job.
   *
   * @param jobId - The DLQ job identifier whose keys should be removed
   */
  private async cleanupRetryKeys(jobId: string): Promise<void> {
    try {
      const redis = getRedis();
      await redis.del(
        `${RETRY_COUNT_KEY_PREFIX}${jobId}`,
        `${LAST_RETRY_KEY_PREFIX}${jobId}`
      );
    } catch (error) {
      logger.error(
        { jobId, error },
        'Error cleaning up Cognigate DLQ retry keys from Redis'
      );
    }
  }

  // ===========================================================================
  // QUEUE ACCESS
  // ===========================================================================

  /**
   * Fetch jobs from the DLQ for retry evaluation.
   *
   * Returns up to `maxJobsPerCycle` jobs from the DLQ in waiting state.
   *
   * @returns Array of BullMQ Job instances from the DLQ
   */
  private async fetchDlqJobs(): Promise<Job<CognigateDlqJobData>[]> {
    if (!this.dlqQueue) {
      return [];
    }

    try {
      const jobs = await this.dlqQueue.getJobs(
        ['waiting', 'delayed'],
        0,
        this.config.maxJobsPerCycle - 1
      );
      return jobs as Job<CognigateDlqJobData>[];
    } catch (error) {
      logger.error({ error }, 'Error fetching jobs from Cognigate DLQ');
      return [];
    }
  }

  /**
   * Get the total number of jobs currently in the DLQ.
   *
   * @returns Total job count in DLQ, or 0 on error
   */
  private async getDlqJobCount(): Promise<number> {
    if (!this.dlqQueue) {
      return 0;
    }

    try {
      const counts = await this.dlqQueue.getJobCounts('waiting', 'delayed');
      return (counts.waiting ?? 0) + (counts.delayed ?? 0);
    } catch (error) {
      logger.error({ error }, 'Error getting Cognigate DLQ job count');
      return 0;
    }
  }

  /**
   * Update the oldest job age metric based on the current DLQ contents.
   *
   * @param jobs - Array of DLQ jobs to evaluate
   */
  private updateOldestJobAge(jobs: Job<CognigateDlqJobData>[]): void {
    let oldestTimestamp = Date.now();

    for (const job of jobs) {
      const jobData = job.data as CognigateDlqJobData;
      if (jobData.movedToDlqAt) {
        const movedAt = new Date(jobData.movedToDlqAt).getTime();
        if (movedAt < oldestTimestamp) {
          oldestTimestamp = movedAt;
        }
      }
    }

    const ageSeconds = (Date.now() - oldestTimestamp) / 1000;
    dlqRetryBacklogAge.set(ageSeconds);
  }

  // ===========================================================================
  // DIAGNOSTICS
  // ===========================================================================

  /**
   * Get the current orchestrator configuration (read-only copy).
   *
   * Useful for diagnostic endpoints and health checks.
   */
  getConfig(): Readonly<CognigateDlqRetryConfig> {
    return { ...this.config };
  }
}

// =============================================================================
// SINGLETON MANAGEMENT
// =============================================================================

let _orchestrator: CognigateDlqRetryOrchestrator | null = null;

/**
 * Start the Cognigate DLQ retry orchestrator (singleton).
 *
 * If an orchestrator is already running, it will be stopped and replaced
 * with a new instance using the provided configuration.
 *
 * @param config - Partial configuration to override defaults
 * @returns The orchestrator instance
 */
export async function startCognigateDlqRetry(
  config?: Partial<CognigateDlqRetryConfig>
): Promise<CognigateDlqRetryOrchestrator> {
  if (_orchestrator) {
    await _orchestrator.stop();
  }

  _orchestrator = new CognigateDlqRetryOrchestrator(config);
  _orchestrator.start();
  return _orchestrator;
}

/**
 * Stop the Cognigate DLQ retry orchestrator (singleton).
 *
 * Gracefully shuts down the orchestrator, clearing the timer and
 * closing queue connections.
 */
export async function stopCognigateDlqRetry(): Promise<void> {
  if (_orchestrator) {
    await _orchestrator.stop();
    _orchestrator = null;
  }
}

/**
 * Get the current Cognigate DLQ retry orchestrator instance.
 *
 * @returns The orchestrator instance, or null if not started
 */
export function getCognigateDlqRetryOrchestrator(): CognigateDlqRetryOrchestrator | null {
  return _orchestrator;
}
