/**
 * INTENT Scheduler
 *
 * Manages scheduled jobs for intent processing:
 * - Cleanup job for GDPR compliance (event retention, soft-delete purging)
 * - Escalation timeout checks
 *
 * Uses leader election to ensure only one instance runs scheduled tasks
 * across multiple server instances.
 */

import cron, { type ScheduledTask as CronTask } from 'node-cron';
import { createLogger } from '../common/logger.js';
import { getConfig } from '../common/config.js';
import { getLeaderElection, type LeaderElection } from '../common/leader-election.js';
import { runCleanup, type CleanupResult } from './cleanup.js';
import { createEscalationService } from './escalation.js';
import {
  cleanupJobRuns,
  recordsCleanedUp,
  recordError,
} from './metrics.js';

const logger = createLogger({ component: 'scheduler' });

interface ScheduledTask {
  name: string;
  task: CronTask;
  cronExpression: string;
}

const scheduledTasks: ScheduledTask[] = [];
let leaderElection: LeaderElection | null = null;

/**
 * Create and register all scheduled tasks (without starting them)
 */
function createScheduledTasks(): void {
  // Clear any existing tasks
  scheduledTasks.length = 0;

  const config = getConfig();
  const escalationService = createEscalationService();

  // Cleanup job - runs at configured schedule (default: 2 AM daily)
  // Using createTask to avoid auto-start; we start tasks explicitly below
  const cleanupTask = cron.createTask(
    config.intent.cleanupCronSchedule,
    async () => {
      // Double-check we're still leader before running
      if (!leaderElection?.isLeader()) {
        logger.debug('Skipping cleanup job - not leader');
        return;
      }

      logger.info('Starting scheduled cleanup job');
      const startTime = Date.now();

      try {
        const result = await runCleanup();
        const durationMs = Date.now() - startTime;

        cleanupJobRuns.inc({ result: 'success' });
        recordsCleanedUp.inc({ type: 'events' }, result.eventsDeleted);
        recordsCleanedUp.inc({ type: 'intents' }, result.intentsPurged);

        logger.info(
          {
            eventsDeleted: result.eventsDeleted,
            intentsPurged: result.intentsPurged,
            durationMs,
            errors: result.errors,
          },
          'Cleanup job completed'
        );
      } catch (error) {
        cleanupJobRuns.inc({ result: 'failure' });
        recordError('CLEANUP_JOB_FAILED', 'scheduler');

        logger.error(
          { error: error instanceof Error ? error.message : 'Unknown error' },
          'Cleanup job failed'
        );
      }
    }
  );

  scheduledTasks.push({
    name: 'cleanup',
    task: cleanupTask,
    cronExpression: config.intent.cleanupCronSchedule,
  });

  // Escalation timeout check - runs at configured schedule (default: every 5 minutes)
  const timeoutTask = cron.createTask(
    config.intent.timeoutCheckCronSchedule,
    async () => {
      // Double-check we're still leader before running
      if (!leaderElection?.isLeader()) {
        logger.debug('Skipping timeout check - not leader');
        return;
      }

      try {
        const processed = await escalationService.processTimeouts();
        if (processed > 0) {
          logger.info({ count: processed }, 'Processed timed out escalations');
        }
      } catch (error) {
        recordError('TIMEOUT_CHECK_FAILED', 'scheduler');
        logger.error(
          { error: error instanceof Error ? error.message : 'Unknown error' },
          'Escalation timeout check failed'
        );
      }
    }
  );

  scheduledTasks.push({
    name: 'escalation-timeout',
    task: timeoutTask,
    cronExpression: config.intent.timeoutCheckCronSchedule,
  });
}

/**
 * Start all cron tasks
 */
function startCronTasks(): void {
  for (const scheduledTask of scheduledTasks) {
    void scheduledTask.task.start();
    logger.info(
      { name: scheduledTask.name, cron: scheduledTask.cronExpression },
      'Scheduled task started'
    );
  }
}

/**
 * Stop all cron tasks
 */
function stopCronTasks(): void {
  for (const scheduledTask of scheduledTasks) {
    void scheduledTask.task.stop();
    logger.info({ name: scheduledTask.name }, 'Scheduled task stopped');
  }
}

/**
 * Start all scheduled jobs
 *
 * Uses leader election to ensure only one instance runs scheduled tasks.
 * If this instance becomes the leader, it starts the cron jobs.
 * If another instance is the leader, this instance periodically checks
 * and will take over if the leader fails.
 */
export async function startScheduler(): Promise<void> {
  // Initialize leader election
  leaderElection = getLeaderElection();

  // Create tasks (but don't start them yet)
  createScheduledTasks();

  // Try to become leader
  const isLeader = await leaderElection.tryBecomeLeader();

  if (isLeader) {
    logger.info(
      { instanceId: leaderElection.getInstanceId() },
      'This instance is the scheduler leader'
    );

    // Start heartbeat to maintain leadership
    leaderElection.startHeartbeat();

    // Start cron jobs
    startCronTasks();

    logger.info({ taskCount: scheduledTasks.length }, 'Scheduler started as leader');
  } else {
    logger.info(
      { instanceId: leaderElection.getInstanceId() },
      'Another instance is the scheduler leader, waiting for leadership'
    );

    // Start periodic leader check - if we become leader, start the cron jobs
    leaderElection.startLeaderCheck(() => {
      logger.info(
        { instanceId: leaderElection?.getInstanceId() },
        'Acquired scheduler leadership, starting cron jobs'
      );
      startCronTasks();
    });

    logger.info('Scheduler started in standby mode');
  }
}

/**
 * Stop all scheduled jobs and resign leadership
 */
export async function stopScheduler(): Promise<void> {
  // Stop cron tasks
  stopCronTasks();

  // Resign leadership (allows faster failover)
  if (leaderElection) {
    await leaderElection.resign();
    leaderElection = null;
  }

  scheduledTasks.length = 0;
  logger.info('Scheduler stopped');
}

/**
 * Get status of all scheduled jobs
 */
export function getSchedulerStatus(): {
  isLeader: boolean;
  instanceId: string | null;
  tasks: Array<{
    name: string;
    cronExpression: string;
    running: boolean;
  }>;
} {
  return {
    isLeader: leaderElection?.isLeader() ?? false,
    instanceId: leaderElection?.getInstanceId() ?? null,
    tasks: scheduledTasks.map((t) => ({
      name: t.name,
      cronExpression: t.cronExpression,
      running: leaderElection?.isLeader() ?? false,
    })),
  };
}

/**
 * Run cleanup job immediately (for testing or manual trigger)
 */
export async function runCleanupNow(): Promise<CleanupResult> {
  logger.info('Running cleanup job on demand');
  const startTime = Date.now();

  try {
    const result = await runCleanup();
    const durationMs = Date.now() - startTime;

    cleanupJobRuns.inc({ result: 'success' });
    recordsCleanedUp.inc({ type: 'events' }, result.eventsDeleted);
    recordsCleanedUp.inc({ type: 'intents' }, result.intentsPurged);

    logger.info(
      {
        eventsDeleted: result.eventsDeleted,
        intentsPurged: result.intentsPurged,
        durationMs,
      },
      'On-demand cleanup completed'
    );

    return result;
  } catch (error) {
    cleanupJobRuns.inc({ result: 'failure' });
    throw error;
  }
}

/**
 * Process escalation timeouts immediately (for testing or manual trigger)
 */
export async function processTimeoutsNow(): Promise<number> {
  const escalationService = createEscalationService();
  const processed = await escalationService.processTimeouts();
  logger.info({ count: processed }, 'On-demand timeout processing completed');
  return processed;
}
