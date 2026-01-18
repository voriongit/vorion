/**
 * INTENT Scheduler
 *
 * Manages scheduled jobs for intent processing:
 * - Cleanup job for GDPR compliance (event retention, soft-delete purging)
 * - Escalation timeout checks
 */

import cron, { type ScheduledTask as CronTask } from 'node-cron';
import { createLogger } from '../common/logger.js';
import { getConfig } from '../common/config.js';
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

/**
 * Start all scheduled jobs
 */
export function startScheduler(): void {
  const config = getConfig();
  const escalationService = createEscalationService();

  // Cleanup job - runs at configured schedule (default: 2 AM daily)
  // Using createTask to avoid auto-start; we start tasks explicitly below
  const cleanupTask = cron.createTask(
    config.intent.cleanupCronSchedule,
    async () => {
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

  // Start all tasks
  for (const scheduledTask of scheduledTasks) {
    scheduledTask.task.start();
    logger.info(
      { name: scheduledTask.name, cron: scheduledTask.cronExpression },
      'Scheduled task started'
    );
  }

  logger.info({ taskCount: scheduledTasks.length }, 'Scheduler started');
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduler(): void {
  for (const scheduledTask of scheduledTasks) {
    scheduledTask.task.stop();
    logger.info({ name: scheduledTask.name }, 'Scheduled task stopped');
  }

  scheduledTasks.length = 0;
  logger.info('Scheduler stopped');
}

/**
 * Get status of all scheduled jobs
 */
export function getSchedulerStatus(): Array<{
  name: string;
  cronExpression: string;
  running: boolean;
}> {
  return scheduledTasks.map((t) => ({
    name: t.name,
    cronExpression: t.cronExpression,
    running: true, // node-cron doesn't expose running state directly
  }));
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
