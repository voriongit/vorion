/**
 * Intent Cleanup Job
 *
 * Handles retention policy enforcement for intents and events.
 * Run as a scheduled job (cron) or call directly.
 */

import { createLogger } from '../common/logger.js';
import { getConfig } from '../common/config.js';
import { IntentRepository } from './repository.js';

const logger = createLogger({ component: 'intent-cleanup' });

export interface CleanupResult {
  eventsDeleted: number;
  intentsPurged: number;
  durationMs: number;
  errors: string[];
}

/**
 * Run cleanup for old events and soft-deleted intents
 */
export async function runCleanup(): Promise<CleanupResult> {
  const startTime = performance.now();
  const config = getConfig();
  const repository = new IntentRepository();
  const errors: string[] = [];

  let eventsDeleted = 0;
  let intentsPurged = 0;

  // Delete old events based on retention policy
  try {
    eventsDeleted = await repository.deleteOldEvents(
      config.intent.eventRetentionDays
    );
    logger.info(
      { eventsDeleted, retentionDays: config.intent.eventRetentionDays },
      'Old events deleted'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Event cleanup failed: ${message}`);
    logger.error({ error }, 'Failed to delete old events');
  }

  // Purge soft-deleted intents past retention period
  try {
    intentsPurged = await repository.purgeDeletedIntents(
      config.intent.softDeleteRetentionDays
    );
    logger.info(
      { intentsPurged, retentionDays: config.intent.softDeleteRetentionDays },
      'Soft-deleted intents purged'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Intent purge failed: ${message}`);
    logger.error({ error }, 'Failed to purge soft-deleted intents');
  }

  const durationMs = Math.round(performance.now() - startTime);

  logger.info(
    { eventsDeleted, intentsPurged, durationMs, errorCount: errors.length },
    'Cleanup job completed'
  );

  return {
    eventsDeleted,
    intentsPurged,
    durationMs,
    errors,
  };
}

/**
 * Schedule cleanup job to run at interval
 * Returns a function to stop the scheduled job
 */
export function scheduleCleanup(intervalMs: number = 24 * 60 * 60 * 1000): () => void {
  logger.info({ intervalMs }, 'Scheduling cleanup job');

  const intervalId = setInterval(async () => {
    try {
      await runCleanup();
    } catch (error) {
      logger.error({ error }, 'Scheduled cleanup failed');
    }
  }, intervalMs);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    logger.info('Cleanup job unscheduled');
  };
}
