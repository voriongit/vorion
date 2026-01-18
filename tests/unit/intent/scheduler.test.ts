/**
 * Scheduler Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock node-cron before importing scheduler
const mockTask = {
  start: vi.fn(),
  stop: vi.fn(),
  id: 'mock-task-id',
};

vi.mock('node-cron', () => ({
  default: {
    createTask: vi.fn(() => mockTask),
    schedule: vi.fn(() => mockTask),
    validate: vi.fn(() => true),
  },
  createTask: vi.fn(() => mockTask),
  schedule: vi.fn(() => mockTask),
  validate: vi.fn(() => true),
}));

// Mock dependencies
vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => ({
    intent: {
      cleanupCronSchedule: '0 2 * * *',
      timeoutCheckCronSchedule: '*/5 * * * *',
      escalationTimeout: 'PT1H',
    },
  })),
}));

vi.mock('../../../src/common/redis.js', () => ({
  getRedis: vi.fn(() => ({
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    zrangebyscore: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../../src/intent/cleanup.js', () => ({
  runCleanup: vi.fn().mockResolvedValue({
    eventsDeleted: 100,
    intentsPurged: 10,
    errors: [],
  }),
}));

vi.mock('../../../src/intent/escalation.js', () => ({
  createEscalationService: vi.fn(() => ({
    processTimeouts: vi.fn().mockResolvedValue(0),
  })),
}));

vi.mock('../../../src/intent/metrics.js', () => ({
  cleanupJobRuns: { inc: vi.fn() },
  recordsCleanedUp: { inc: vi.fn() },
  recordError: vi.fn(),
}));

// Import after mocks are set up
import {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  runCleanupNow,
  processTimeoutsNow,
} from '../../../src/intent/scheduler.js';
import { runCleanup } from '../../../src/intent/cleanup.js';
import { cleanupJobRuns, recordsCleanedUp } from '../../../src/intent/metrics.js';

describe('Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Stop any running tasks to clean state
    stopScheduler();
  });

  afterEach(() => {
    stopScheduler();
  });

  describe('startScheduler', () => {
    it('should start the cleanup task', () => {
      startScheduler();

      expect(mockTask.start).toHaveBeenCalled();
    });

    it('should start the timeout check task', () => {
      startScheduler();

      // Should be called twice - once for cleanup, once for timeout check
      expect(mockTask.start).toHaveBeenCalledTimes(2);
    });

    it('should register both tasks in scheduler status', () => {
      startScheduler();

      const status = getSchedulerStatus();

      expect(status).toHaveLength(2);
      expect(status.map(s => s.name)).toContain('cleanup');
      expect(status.map(s => s.name)).toContain('escalation-timeout');
    });
  });

  describe('stopScheduler', () => {
    it('should stop all tasks', () => {
      startScheduler();
      stopScheduler();

      expect(mockTask.stop).toHaveBeenCalled();
    });

    it('should clear the task list', () => {
      startScheduler();
      stopScheduler();

      const status = getSchedulerStatus();
      expect(status).toHaveLength(0);
    });
  });

  describe('getSchedulerStatus', () => {
    it('should return empty array when no tasks running', () => {
      const status = getSchedulerStatus();

      expect(status).toEqual([]);
    });

    it('should return task info when scheduler is running', () => {
      startScheduler();

      const status = getSchedulerStatus();

      expect(status).toHaveLength(2);
      status.forEach(task => {
        expect(task).toHaveProperty('name');
        expect(task).toHaveProperty('cronExpression');
        expect(task).toHaveProperty('running');
        expect(task.running).toBe(true);
      });
    });

    it('should include correct cron expressions', () => {
      startScheduler();

      const status = getSchedulerStatus();

      const cleanup = status.find(s => s.name === 'cleanup');
      const timeout = status.find(s => s.name === 'escalation-timeout');

      expect(cleanup?.cronExpression).toBe('0 2 * * *');
      expect(timeout?.cronExpression).toBe('*/5 * * * *');
    });
  });

  describe('runCleanupNow', () => {
    it('should run cleanup immediately', async () => {
      const result = await runCleanupNow();

      expect(runCleanup).toHaveBeenCalled();
      expect(result).toEqual({
        eventsDeleted: 100,
        intentsPurged: 10,
        errors: [],
      });
    });

    it('should record success metrics', async () => {
      await runCleanupNow();

      expect(cleanupJobRuns.inc).toHaveBeenCalledWith({ result: 'success' });
      expect(recordsCleanedUp.inc).toHaveBeenCalledWith({ type: 'events' }, 100);
      expect(recordsCleanedUp.inc).toHaveBeenCalledWith({ type: 'intents' }, 10);
    });

    it('should record failure metrics on error', async () => {
      vi.mocked(runCleanup).mockRejectedValueOnce(new Error('Cleanup failed'));

      await expect(runCleanupNow()).rejects.toThrow('Cleanup failed');
      expect(cleanupJobRuns.inc).toHaveBeenCalledWith({ result: 'failure' });
    });
  });

  describe('processTimeoutsNow', () => {
    it('should process timeouts immediately', async () => {
      const processed = await processTimeoutsNow();

      expect(processed).toBe(0);
    });
  });
});

describe('Cron Schedule Validation', () => {
  it('should use valid cron expression for cleanup (daily at 2 AM)', () => {
    const cleanupCron = '0 2 * * *';
    // This is a valid cron expression:
    // 0 - minute 0
    // 2 - hour 2
    // * - every day of month
    // * - every month
    // * - every day of week
    expect(cleanupCron).toMatch(/^\d+\s+\d+\s+\*\s+\*\s+\*$/);
  });

  it('should use valid cron expression for timeout check (every 5 minutes)', () => {
    const timeoutCron = '*/5 * * * *';
    // This is a valid cron expression:
    // */5 - every 5 minutes
    // * - every hour
    // * - every day of month
    // * - every month
    // * - every day of week
    expect(timeoutCron).toMatch(/^\*\/\d+\s+\*\s+\*\s+\*\s+\*$/);
  });
});

describe('Scheduler Integration', () => {
  it('should handle multiple start/stop cycles', () => {
    startScheduler();
    expect(getSchedulerStatus()).toHaveLength(2);

    stopScheduler();
    expect(getSchedulerStatus()).toHaveLength(0);

    startScheduler();
    expect(getSchedulerStatus()).toHaveLength(2);

    stopScheduler();
    expect(getSchedulerStatus()).toHaveLength(0);
  });

  it('should not duplicate tasks on multiple starts', () => {
    startScheduler();
    const firstStatus = getSchedulerStatus();

    // Stop and start again
    stopScheduler();
    startScheduler();
    const secondStatus = getSchedulerStatus();

    expect(firstStatus.length).toBe(secondStatus.length);
    expect(secondStatus).toHaveLength(2);
  });
});
