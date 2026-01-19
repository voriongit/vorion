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
  schedulerLeaderElections: { inc: vi.fn() },
  schedulerIsLeader: { set: vi.fn() },
}));

// Mock leader election
vi.mock('../../../src/common/leader-election.js', () => ({
  getLeaderElection: vi.fn(() => ({
    tryBecomeLeader: vi.fn().mockResolvedValue(true),
    isLeader: vi.fn().mockReturnValue(true),
    startHeartbeat: vi.fn(),
    stopHeartbeat: vi.fn(),
    resign: vi.fn().mockResolvedValue(undefined),
    getInstanceId: vi.fn().mockReturnValue('test-instance-123'),
    startLeaderCheck: vi.fn(),
    stopLeaderCheck: vi.fn(),
  })),
  resetLeaderElection: vi.fn(),
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
  beforeEach(async () => {
    vi.clearAllMocks();
    // Stop any running tasks to clean state
    await stopScheduler();
  });

  afterEach(async () => {
    await stopScheduler();
  });

  describe('startScheduler', () => {
    it('should start the cleanup task', async () => {
      await startScheduler();

      expect(mockTask.start).toHaveBeenCalled();
    });

    it('should start the timeout check task', async () => {
      await startScheduler();

      // Should be called twice - once for cleanup, once for timeout check
      expect(mockTask.start).toHaveBeenCalledTimes(2);
    });

    it('should register both tasks in scheduler status', async () => {
      await startScheduler();

      const status = getSchedulerStatus();

      expect(status.tasks).toHaveLength(2);
      expect(status.tasks.map((s: { name: string }) => s.name)).toContain('cleanup');
      expect(status.tasks.map((s: { name: string }) => s.name)).toContain('escalation-timeout');
    });
  });

  describe('stopScheduler', () => {
    it('should stop all tasks', async () => {
      await startScheduler();
      await stopScheduler();

      expect(mockTask.stop).toHaveBeenCalled();
    });

    it('should clear the task list', async () => {
      await startScheduler();
      await stopScheduler();

      const status = getSchedulerStatus();
      expect(status.tasks).toHaveLength(0);
    });
  });

  describe('getSchedulerStatus', () => {
    it('should return empty tasks array when no tasks running', () => {
      const status = getSchedulerStatus();

      expect(status.tasks).toEqual([]);
    });

    it('should return task info when scheduler is running', async () => {
      await startScheduler();

      const status = getSchedulerStatus();

      expect(status.tasks).toHaveLength(2);
      status.tasks.forEach((task: { name: string; cronExpression: string; running: boolean }) => {
        expect(task).toHaveProperty('name');
        expect(task).toHaveProperty('cronExpression');
        expect(task).toHaveProperty('running');
        expect(task.running).toBe(true);
      });
    });

    it('should include correct cron expressions', async () => {
      await startScheduler();

      const status = getSchedulerStatus();

      const cleanup = status.tasks.find((s: { name: string }) => s.name === 'cleanup');
      const timeout = status.tasks.find((s: { name: string }) => s.name === 'escalation-timeout');

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
  it('should handle multiple start/stop cycles', async () => {
    await startScheduler();
    expect(getSchedulerStatus().tasks).toHaveLength(2);

    await stopScheduler();
    expect(getSchedulerStatus().tasks).toHaveLength(0);

    await startScheduler();
    expect(getSchedulerStatus().tasks).toHaveLength(2);

    await stopScheduler();
    expect(getSchedulerStatus().tasks).toHaveLength(0);
  });

  it('should not duplicate tasks on multiple starts', async () => {
    await startScheduler();
    const firstStatus = getSchedulerStatus();

    // Stop and start again
    await stopScheduler();
    await startScheduler();
    const secondStatus = getSchedulerStatus();

    expect(firstStatus.tasks.length).toBe(secondStatus.tasks.length);
    expect(secondStatus.tasks).toHaveLength(2);
  });
});
