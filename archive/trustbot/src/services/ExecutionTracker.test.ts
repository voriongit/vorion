/**
 * Execution Tracker Tests
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.5: Decision Execution Tracker
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    ExecutionTracker,
    getExecutionTracker,
    resetExecutionTracker,
    type ExecutionRecord,
} from './ExecutionTracker.js';
import type { ActionRequest } from './TrustGateEngine.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createRequest(overrides: Partial<ActionRequest> = {}): ActionRequest {
    return {
        id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        agentId: 'agent_1',
        orgId: 'org_1',
        actionType: 'execute_task',
        category: 'execute',
        description: 'Execute approved task',
        urgency: 'normal',
        requestedAt: new Date(),
        ...overrides,
    };
}

// ============================================================================
// Tests
// ============================================================================

describe('ExecutionTracker', () => {
    let tracker: ExecutionTracker;

    beforeEach(() => {
        vi.useFakeTimers();
        resetExecutionTracker();
        tracker = new ExecutionTracker();
    });

    afterEach(() => {
        vi.useRealTimers();
        tracker.clear();
    });

    // =========================================================================
    // Queue Management
    // =========================================================================

    describe('queueExecution', () => {
        it('should queue execution record', () => {
            tracker.updateConfig({ maxConcurrent: 0 }); // Prevent auto-start
            const request = createRequest();

            const record = tracker.queueExecution(request, 'auto_approval');

            expect(record.id).toBeDefined();
            expect(record.requestId).toBe(request.id);
            expect(record.status).toBe('queued');
            expect(record.approvalSource).toBe('auto_approval');
        });

        it('should auto-start if under concurrent limit', () => {
            const request = createRequest();

            const record = tracker.queueExecution(request, 'auto_approval');

            expect(record.status).toBe('executing');
        });

        it('should stay queued if at concurrent limit', () => {
            tracker.updateConfig({ maxConcurrent: 1 });

            const request1 = createRequest({ id: 'req_1' });
            const request2 = createRequest({ id: 'req_2' });

            const record1 = tracker.queueExecution(request1, 'auto_approval');
            const record2 = tracker.queueExecution(request2, 'tribunal');

            expect(record1.status).toBe('executing');
            expect(record2.status).toBe('queued');
        });

        it('should emit execution:queued event', () => {
            const queuedHandler = vi.fn();
            tracker.on('execution:queued', queuedHandler);

            const request = createRequest();
            tracker.queueExecution(request, 'hitl');

            expect(queuedHandler).toHaveBeenCalled();
        });
    });

    describe('startExecution', () => {
        it('should start queued execution', () => {
            tracker.updateConfig({ maxConcurrent: 0 }); // Prevent auto-start
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');

            // Increase limit and manually start
            tracker.updateConfig({ maxConcurrent: 10 });
            const result = tracker.startExecution(record.id);

            expect(result).toBe(true);
            expect(record.status).toBe('executing');
            expect(record.startedAt).toBeDefined();
        });

        it('should reject if not queued', () => {
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');
            tracker.completeExecution(record.id);

            const result = tracker.startExecution(record.id);

            expect(result).toBe(false);
        });

        it('should emit execution:started event', () => {
            const startedHandler = vi.fn();
            tracker.on('execution:started', startedHandler);

            const request = createRequest();
            tracker.queueExecution(request, 'auto_approval');

            expect(startedHandler).toHaveBeenCalled();
        });
    });

    describe('updateProgress', () => {
        it('should update execution progress', () => {
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');

            const result = tracker.updateProgress(record.id, 50, 'Halfway done');

            expect(result).toBe(true);
            expect(record.progress).toBe(50);
        });

        it('should clamp progress to 0-100', () => {
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');

            tracker.updateProgress(record.id, 150);
            expect(record.progress).toBe(100);

            tracker.updateProgress(record.id, -10);
            expect(record.progress).toBe(0);
        });

        it('should emit execution:progress event', () => {
            const progressHandler = vi.fn();
            tracker.on('execution:progress', progressHandler);

            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');
            tracker.updateProgress(record.id, 50, 'Progress update');

            // Should have been called multiple times (queued, started, progress)
            expect(progressHandler).toHaveBeenCalled();
        });

        it('should reject if not executing', () => {
            tracker.updateConfig({ maxConcurrent: 0 });
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');

            const result = tracker.updateProgress(record.id, 50);

            expect(result).toBe(false);
        });
    });

    describe('completeExecution', () => {
        it('should complete executing record', () => {
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');

            const result = tracker.completeExecution(record.id, { success: true });

            expect(result).toBe(true);
            expect(record.status).toBe('completed');
            expect(record.progress).toBe(100);
            expect(record.completedAt).toBeDefined();
            expect(record.result).toEqual({ success: true });
        });

        it('should calculate duration', () => {
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');

            vi.advanceTimersByTime(5000);
            tracker.completeExecution(record.id);

            expect(record.duration).toBeGreaterThanOrEqual(5000);
        });

        it('should emit execution:completed event', () => {
            const completedHandler = vi.fn();
            tracker.on('execution:completed', completedHandler);

            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');
            tracker.completeExecution(record.id);

            expect(completedHandler).toHaveBeenCalled();
        });

        it('should process next in queue after completion', () => {
            tracker.updateConfig({ maxConcurrent: 1 });

            const request1 = createRequest({ id: 'req_1' });
            const request2 = createRequest({ id: 'req_2' });

            const record1 = tracker.queueExecution(request1, 'auto_approval');
            const record2 = tracker.queueExecution(request2, 'auto_approval');

            expect(record1.status).toBe('executing');
            expect(record2.status).toBe('queued');

            tracker.completeExecution(record1.id);

            expect(record2.status).toBe('executing');
        });
    });

    describe('failExecution', () => {
        it('should retry on failure if under retry limit', () => {
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');

            tracker.failExecution(record.id, 'Temporary error');

            expect(record.retryCount).toBe(1);
            expect(record.status).toBe('executing'); // Re-started from queue
        });

        it('should mark as failed when retries exhausted', () => {
            // maxRetries=1 means retryCount < 1 check fails on first attempt (no retries)
            tracker.updateConfig({ maxRetries: 1 });
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');

            // First failure with maxRetries=1: retryCount becomes 1, 1 < 1 = false, so fails
            tracker.failExecution(record.id, 'Error 1');

            expect(record.status).toBe('failed');
            expect(record.error).toBe('Error 1');
        });

        it('should emit execution:retry event', () => {
            const retryHandler = vi.fn();
            tracker.on('execution:retry', retryHandler);

            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');
            tracker.failExecution(record.id, 'Error');

            expect(retryHandler).toHaveBeenCalled();
        });

        it('should emit execution:failed when exhausted', () => {
            tracker.updateConfig({ maxRetries: 0 });
            const failedHandler = vi.fn();
            tracker.on('execution:failed', failedHandler);

            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');
            tracker.failExecution(record.id, 'Final error');

            expect(failedHandler).toHaveBeenCalled();
        });
    });

    describe('cancelExecution', () => {
        it('should cancel executing record', () => {
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');

            const result = tracker.cancelExecution(record.id, 'User cancelled');

            expect(result).toBe(true);
            expect(record.status).toBe('cancelled');
            expect(record.error).toBe('User cancelled');
        });

        it('should cancel queued record', () => {
            tracker.updateConfig({ maxConcurrent: 0 });
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');

            const result = tracker.cancelExecution(record.id);

            expect(result).toBe(true);
            expect(record.status).toBe('cancelled');
        });

        it('should not cancel completed record', () => {
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');
            tracker.completeExecution(record.id);

            const result = tracker.cancelExecution(record.id);

            expect(result).toBe(false);
        });

        it('should emit execution:cancelled event', () => {
            const cancelledHandler = vi.fn();
            tracker.on('execution:cancelled', cancelledHandler);

            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');
            tracker.cancelExecution(record.id);

            expect(cancelledHandler).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // Timeouts
    // =========================================================================

    describe('execution timeout', () => {
        it('should timeout executing record', () => {
            tracker.updateConfig({ executionTimeoutMs: 1000 });
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');

            vi.advanceTimersByTime(1500);

            expect(record.status).toBe('timeout');
        });

        it('should emit execution:timeout event', () => {
            tracker.updateConfig({ executionTimeoutMs: 1000 });
            const timeoutHandler = vi.fn();
            tracker.on('execution:timeout', timeoutHandler);

            const request = createRequest();
            tracker.queueExecution(request, 'auto_approval');

            vi.advanceTimersByTime(1500);

            expect(timeoutHandler).toHaveBeenCalled();
        });
    });

    describe('queue timeout', () => {
        it('should cancel queued record after queue timeout', () => {
            tracker.updateConfig({ maxConcurrent: 0, queueTimeoutMs: 1000 });
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');

            vi.advanceTimersByTime(1500);

            expect(record.status).toBe('cancelled');
            expect(record.error).toContain('Queue timeout');
        });
    });

    // =========================================================================
    // Record Retrieval
    // =========================================================================

    describe('getRecord', () => {
        it('should return record by ID', () => {
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');

            const retrieved = tracker.getRecord(record.id);

            expect(retrieved?.id).toBe(record.id);
        });

        it('should return null for unknown ID', () => {
            const result = tracker.getRecord('unknown');
            expect(result).toBeNull();
        });
    });

    describe('getRecordByRequestId', () => {
        it('should return record by request ID', () => {
            const request = createRequest({ id: 'unique_request' });
            tracker.queueExecution(request, 'auto_approval');

            const retrieved = tracker.getRecordByRequestId('unique_request');

            expect(retrieved?.requestId).toBe('unique_request');
        });
    });

    describe('getAgentRecords', () => {
        it('should return records for agent', () => {
            const request1 = createRequest({ id: 'req_1', agentId: 'agent_1' });
            const request2 = createRequest({ id: 'req_2', agentId: 'agent_2' });

            tracker.queueExecution(request1, 'auto_approval');
            tracker.queueExecution(request2, 'tribunal');

            const records = tracker.getAgentRecords('agent_1');

            expect(records.length).toBe(1);
            expect(records[0].request.agentId).toBe('agent_1');
        });

        it('should filter by status', () => {
            const request1 = createRequest({ id: 'req_1' });
            const request2 = createRequest({ id: 'req_2' });

            const record1 = tracker.queueExecution(request1, 'auto_approval');
            tracker.queueExecution(request2, 'auto_approval');
            tracker.completeExecution(record1.id);

            const records = tracker.getAgentRecords('agent_1', { status: 'completed' });

            expect(records.length).toBe(1);
        });
    });

    describe('getOrgRecords', () => {
        it('should return records for org', () => {
            const request1 = createRequest({ id: 'req_1', orgId: 'org_1' });
            const request2 = createRequest({ id: 'req_2', orgId: 'org_2' });

            tracker.queueExecution(request1, 'auto_approval');
            tracker.queueExecution(request2, 'tribunal');

            const records = tracker.getOrgRecords('org_1');

            expect(records.length).toBe(1);
            expect(records[0].request.orgId).toBe('org_1');
        });
    });

    describe('getExecutingRecords', () => {
        it('should return only executing records', () => {
            const request1 = createRequest({ id: 'req_1' });
            const request2 = createRequest({ id: 'req_2' });

            const record1 = tracker.queueExecution(request1, 'auto_approval');
            tracker.queueExecution(request2, 'auto_approval');
            tracker.completeExecution(record1.id);

            const executing = tracker.getExecutingRecords();

            expect(executing.length).toBe(1);
            expect(executing[0].status).toBe('executing');
        });
    });

    describe('getQueuedRecords', () => {
        it('should return queued records', () => {
            tracker.updateConfig({ maxConcurrent: 0 });

            const request1 = createRequest({ id: 'req_1' });
            const request2 = createRequest({ id: 'req_2' });

            tracker.queueExecution(request1, 'auto_approval');
            tracker.queueExecution(request2, 'auto_approval');

            const queued = tracker.getQueuedRecords();

            expect(queued.length).toBe(2);
        });
    });

    describe('getProgressHistory', () => {
        it('should return progress history', () => {
            const request = createRequest();
            const record = tracker.queueExecution(request, 'auto_approval');
            tracker.updateProgress(record.id, 25, 'Step 1');
            tracker.updateProgress(record.id, 50, 'Step 2');

            const history = tracker.getProgressHistory(record.id);

            expect(history.length).toBeGreaterThanOrEqual(2);
        });
    });

    // =========================================================================
    // Statistics
    // =========================================================================

    describe('getStats', () => {
        it('should return correct statistics', () => {
            // Set maxRetries=0 first so failures are immediate
            tracker.updateConfig({ maxRetries: 0 });

            const request1 = createRequest({ id: 'req_1' });
            const request2 = createRequest({ id: 'req_2' });
            const request3 = createRequest({ id: 'req_3' });

            const record1 = tracker.queueExecution(request1, 'auto_approval');
            const record2 = tracker.queueExecution(request2, 'tribunal');
            tracker.queueExecution(request3, 'hitl');

            tracker.completeExecution(record1.id);
            tracker.failExecution(record2.id, 'Error');

            const stats = tracker.getStats();

            expect(stats.totalExecutions).toBe(3);
            expect(stats.completedCount).toBe(1);
            expect(stats.failedCount).toBe(1);
            expect(stats.executingCount).toBe(1);
            expect(stats.successRate).toBe(0.5);
            expect(stats.byApprovalSource.auto_approval).toBe(1);
            expect(stats.byApprovalSource.tribunal).toBe(1);
            expect(stats.byApprovalSource.council).toBe(0); // No council approvals in this test
            expect(stats.byApprovalSource.hitl).toBe(1);
        });
    });

    describe('getQueueStats', () => {
        it('should return queue statistics', () => {
            tracker.updateConfig({ maxConcurrent: 2 });

            const request1 = createRequest({ id: 'req_1' });
            const request2 = createRequest({ id: 'req_2' });
            const request3 = createRequest({ id: 'req_3' });

            tracker.queueExecution(request1, 'auto_approval');
            tracker.queueExecution(request2, 'auto_approval');
            tracker.queueExecution(request3, 'auto_approval');

            const stats = tracker.getQueueStats();

            expect(stats.executingCount).toBe(2);
            expect(stats.queueLength).toBe(1);
            expect(stats.maxConcurrent).toBe(2);
            expect(stats.available).toBe(0);
        });
    });

    // =========================================================================
    // Configuration
    // =========================================================================

    describe('configuration', () => {
        it('should update config', () => {
            tracker.updateConfig({ maxConcurrent: 20 });

            const config = tracker.getConfig();

            expect(config.maxConcurrent).toBe(20);
        });
    });

    // =========================================================================
    // Lifecycle
    // =========================================================================

    describe('clear', () => {
        it('should clear all state', () => {
            const request = createRequest();
            tracker.queueExecution(request, 'auto_approval');

            tracker.clear();

            expect(tracker.recordCount).toBe(0);
        });
    });

    // =========================================================================
    // Singleton
    // =========================================================================

    describe('singleton', () => {
        it('should return same instance', () => {
            resetExecutionTracker();
            const instance1 = getExecutionTracker();
            const instance2 = getExecutionTracker();

            expect(instance1).toBe(instance2);
        });

        it('should reset properly', () => {
            const instance1 = getExecutionTracker();
            const request = createRequest();
            instance1.queueExecution(request, 'auto_approval');

            resetExecutionTracker();
            const instance2 = getExecutionTracker();

            expect(instance2.recordCount).toBe(0);
        });
    });
});
