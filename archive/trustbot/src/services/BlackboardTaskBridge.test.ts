/**
 * BlackboardTaskBridge Unit Tests
 *
 * Tests the bridge between T5-Planner Blackboard posts and
 * the workflow task execution system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BlackboardTaskBridge, resetBlackboardTaskBridge } from './BlackboardTaskBridge.js';
import { Blackboard } from '../core/Blackboard.js';

describe('BlackboardTaskBridge', () => {
    let blackboard: Blackboard;
    let bridge: BlackboardTaskBridge;

    beforeEach(() => {
        resetBlackboardTaskBridge();
        blackboard = new Blackboard();
        bridge = new BlackboardTaskBridge(blackboard);
    });

    // =========================================================================
    // Initialization Tests
    // =========================================================================

    describe('initialization', () => {
        it('creates bridge with default config', () => {
            expect(bridge).toBeInstanceOf(BlackboardTaskBridge);
        });

        it('creates bridge with custom config', () => {
            const customBridge = new BlackboardTaskBridge(blackboard, {
                autoConvert: false,
                requiredTierDefault: 3,
                sourceFilter: ['agent-1'],
            });
            expect(customBridge).toBeInstanceOf(BlackboardTaskBridge);
        });

        it('starts with no bridged tasks', () => {
            expect(bridge.getAllTasks()).toHaveLength(0);
        });
    });

    // =========================================================================
    // Auto-Bridge Tests
    // =========================================================================

    describe('auto-bridging', () => {
        it('automatically bridges TASK entries when autoConvert is true', () => {
            const taskBridgedSpy = vi.fn();
            bridge.on('task:bridged', taskBridgedSpy);

            // Post a TASK entry to the blackboard
            blackboard.post({
                type: 'TASK',
                title: 'Implement feature X',
                author: 'T5-PLANNER',
                content: { description: 'Build the new feature' },
                priority: 'HIGH',
            });

            expect(taskBridgedSpy).toHaveBeenCalledTimes(1);
            expect(bridge.getAllTasks()).toHaveLength(1);

            const task = bridge.getAllTasks()[0];
            expect(task.title).toBe('Implement feature X');
            expect(task.priority).toBe('HIGH');
            expect(task.status).toBe('QUEUED');
        });

        it('does not bridge non-TASK entries', () => {
            const taskBridgedSpy = vi.fn();
            bridge.on('task:bridged', taskBridgedSpy);

            blackboard.post({
                type: 'OBSERVATION',
                title: 'System observation',
                author: 'T5-PLANNER',
                content: { note: 'Everything is fine' },
            });

            expect(taskBridgedSpy).not.toHaveBeenCalled();
            expect(bridge.getAllTasks()).toHaveLength(0);
        });

        it('does not re-bridge already bridged entries', () => {
            const entry = blackboard.post({
                type: 'TASK',
                title: 'Task 1',
                author: 'T5-PLANNER',
                content: {},
            });

            expect(bridge.getAllTasks()).toHaveLength(1);

            // Try to manually bridge the same entry
            const result = bridge.bridgeEntryById(entry.id);
            expect(result).toBeNull();
            expect(bridge.getAllTasks()).toHaveLength(1);
        });

        it('respects sourceFilter config', () => {
            const filteredBridge = new BlackboardTaskBridge(blackboard, {
                sourceFilter: ['allowed-agent'],
            });

            // Post from filtered agent - should bridge
            blackboard.post({
                type: 'TASK',
                title: 'Allowed task',
                author: 'allowed-agent',
                content: {},
            });

            // Post from non-filtered agent - should not bridge
            blackboard.post({
                type: 'TASK',
                title: 'Blocked task',
                author: 'other-agent',
                content: {},
            });

            expect(filteredBridge.getAllTasks()).toHaveLength(1);
            expect(filteredBridge.getAllTasks()[0].title).toBe('Allowed task');
        });

        it('respects autoConvert=false config', () => {
            const manualBridge = new BlackboardTaskBridge(blackboard, {
                autoConvert: false,
            });

            blackboard.post({
                type: 'TASK',
                title: 'Manual task',
                author: 'T5-PLANNER',
                content: {},
            });

            expect(manualBridge.getAllTasks()).toHaveLength(0);
        });
    });

    // =========================================================================
    // Manual Bridging Tests
    // =========================================================================

    describe('manual bridging', () => {
        it('bridges entry by ID', () => {
            const manualBridge = new BlackboardTaskBridge(blackboard, {
                autoConvert: false,
            });

            const entry = blackboard.post({
                type: 'TASK',
                title: 'Manual bridge task',
                author: 'T5-PLANNER',
                content: { description: 'Test description' },
            });

            const task = manualBridge.bridgeEntryById(entry.id);

            expect(task).not.toBeNull();
            expect(task!.title).toBe('Manual bridge task');
            expect(task!.blackboardEntryId).toBe(entry.id);
        });

        it('returns null for non-existent entry', () => {
            const result = bridge.bridgeEntryById('non-existent-id');
            expect(result).toBeNull();
        });

        it('bridges all pending TASK entries', () => {
            const manualBridge = new BlackboardTaskBridge(blackboard, {
                autoConvert: false,
            });

            // Post multiple tasks
            blackboard.post({ type: 'TASK', title: 'Task 1', author: 'agent-1', content: {} });
            blackboard.post({ type: 'TASK', title: 'Task 2', author: 'agent-1', content: {} });
            blackboard.post({ type: 'OBSERVATION', title: 'Not a task', author: 'agent-1', content: {} });

            expect(manualBridge.getAllTasks()).toHaveLength(0);

            const bridged = manualBridge.bridgeAllPending();

            expect(bridged).toHaveLength(2);
            expect(manualBridge.getAllTasks()).toHaveLength(2);
        });
    });

    // =========================================================================
    // Content Extraction Tests
    // =========================================================================

    describe('content extraction', () => {
        it('extracts description from content.description', () => {
            blackboard.post({
                type: 'TASK',
                title: 'Task with description',
                author: 'T5-PLANNER',
                content: { description: 'Detailed task description' },
            });

            const task = bridge.getAllTasks()[0];
            expect(task.description).toBe('Detailed task description');
        });

        it('extracts description from content.objective.description', () => {
            blackboard.post({
                type: 'TASK',
                title: 'Task with objective',
                author: 'T5-PLANNER',
                content: {
                    objective: {
                        title: 'Objective title',
                        description: 'Objective description',
                    },
                },
            });

            const task = bridge.getAllTasks()[0];
            expect(task.description).toBe('Objective description');
        });

        it('extracts description from content.tasks array', () => {
            blackboard.post({
                type: 'TASK',
                title: 'Task list',
                author: 'T5-PLANNER',
                content: { tasks: ['Step 1', 'Step 2', 'Step 3'] },
            });

            const task = bridge.getAllTasks()[0];
            expect(task.description).toBe('Execute: Step 1, Step 2, Step 3');
        });

        it('falls back to title when no description available', () => {
            blackboard.post({
                type: 'TASK',
                title: 'Simple task',
                author: 'T5-PLANNER',
                content: {},
            });

            const task = bridge.getAllTasks()[0];
            expect(task.description).toBe('Simple task');
        });

        it('extracts requiredTier from content', () => {
            blackboard.post({
                type: 'TASK',
                title: 'Tier 3 task',
                author: 'T5-PLANNER',
                content: { requiredTier: 3 },
            });

            const task = bridge.getAllTasks()[0];
            expect(task.requiredTier).toBe(3);
        });

        it('uses default tier when not specified', () => {
            blackboard.post({
                type: 'TASK',
                title: 'Default tier task',
                author: 'T5-PLANNER',
                content: {},
            });

            const task = bridge.getAllTasks()[0];
            expect(task.requiredTier).toBe(2); // Default
        });
    });

    // =========================================================================
    // Task Creator Callback Tests
    // =========================================================================

    describe('task creator callback', () => {
        it('calls registered task creator when bridging', () => {
            const createTaskMock = vi.fn().mockReturnValue({
                id: 'workflow-task-123',
                blackboardEntryId: undefined,
            });

            bridge.registerTaskCreator(createTaskMock);

            blackboard.post({
                type: 'TASK',
                title: 'Create via callback',
                author: 'T5-PLANNER',
                content: { description: 'Test' },
                priority: 'HIGH',
            });

            expect(createTaskMock).toHaveBeenCalledWith({
                title: 'Create via callback',
                description: 'Test',
                priority: 'HIGH',
                requiredTier: 2,
            });

            // Task should use the ID from the callback
            const task = bridge.getAllTasks()[0];
            expect(task.id).toBe('workflow-task-123');
        });

        it('handles task creator errors gracefully', () => {
            const errorSpy = vi.fn();
            bridge.on('sync:error', errorSpy);

            bridge.registerTaskCreator(() => {
                throw new Error('Creation failed');
            });

            blackboard.post({
                type: 'TASK',
                title: 'Failing task',
                author: 'T5-PLANNER',
                content: {},
            });

            expect(errorSpy).toHaveBeenCalled();
            // Task should still be bridged locally
            expect(bridge.getAllTasks()).toHaveLength(1);
        });
    });

    // =========================================================================
    // Task Lifecycle Tests
    // =========================================================================

    describe('task lifecycle', () => {
        it('assigns task to agent', () => {
            const assignedSpy = vi.fn();
            bridge.on('task:assigned', assignedSpy);

            const entry = blackboard.post({
                type: 'TASK',
                title: 'Assignable task',
                author: 'T5-PLANNER',
                content: {},
            });

            const task = bridge.getTaskByEntryId(entry.id)!;
            bridge.assignTask(task.id, 'agent-worker-1');

            expect(assignedSpy).toHaveBeenCalledWith(
                expect.objectContaining({ id: task.id, assignedTo: 'agent-worker-1' }),
                'agent-worker-1'
            );

            const updatedTask = bridge.getTask(task.id)!;
            expect(updatedTask.status).toBe('IN_PROGRESS');
            expect(updatedTask.assignedTo).toBe('agent-worker-1');
        });

        it('completes task and syncs to blackboard', () => {
            const completedSpy = vi.fn();
            bridge.on('task:completed', completedSpy);

            const entry = blackboard.post({
                type: 'TASK',
                title: 'Completable task',
                author: 'T5-PLANNER',
                content: {},
            });

            const task = bridge.getTaskByEntryId(entry.id)!;
            bridge.assignTask(task.id, 'agent-1');
            bridge.completeTask(task.id, { output: 'Success!' });

            expect(completedSpy).toHaveBeenCalledWith(
                expect.objectContaining({ id: task.id, status: 'COMPLETED' }),
                { output: 'Success!' }
            );

            // Check blackboard was updated
            const updatedEntry = blackboard.get(entry.id);
            expect(updatedEntry?.status).toBe('RESOLVED');
        });

        it('fails task and syncs to blackboard', () => {
            const failedSpy = vi.fn();
            bridge.on('task:failed', failedSpy);

            const entry = blackboard.post({
                type: 'TASK',
                title: 'Failing task',
                author: 'T5-PLANNER',
                content: {},
            });

            const task = bridge.getTaskByEntryId(entry.id)!;
            bridge.assignTask(task.id, 'agent-1');
            bridge.failTask(task.id, 'Something went wrong');

            expect(failedSpy).toHaveBeenCalledWith(
                expect.objectContaining({ id: task.id, status: 'FAILED' }),
                'Something went wrong'
            );

            const updatedTask = bridge.getTask(task.id)!;
            expect(updatedTask.result).toEqual({ error: 'Something went wrong' });
        });

        it('handles assignment of non-existent task', () => {
            bridge.assignTask('non-existent', 'agent-1');
            // Should not throw, just no-op
        });

        it('handles completion of non-existent task', () => {
            bridge.completeTask('non-existent', {});
            // Should not throw, just no-op
        });
    });

    // =========================================================================
    // Bidirectional Sync Tests
    // =========================================================================

    describe('bidirectional sync', () => {
        it('syncs blackboard resolution to task', () => {
            const entry = blackboard.post({
                type: 'TASK',
                title: 'Externally resolved task',
                author: 'T5-PLANNER',
                content: {},
            });

            const task = bridge.getTaskByEntryId(entry.id)!;
            expect(task.status).toBe('QUEUED');

            // Resolve the entry externally (simulating another system)
            blackboard.resolve(entry.id, {
                resolution: 'Resolved externally',
                resolvedBy: 'external-system',
            });

            const updatedTask = bridge.getTask(task.id)!;
            expect(updatedTask.status).toBe('COMPLETED');
        });

        it('respects enableBidirectionalSync=false', () => {
            const noSyncBridge = new BlackboardTaskBridge(blackboard, {
                enableBidirectionalSync: false,
            });

            const entry = blackboard.post({
                type: 'TASK',
                title: 'No sync task',
                author: 'T5-PLANNER',
                content: {},
            });

            const task = noSyncBridge.getTaskByEntryId(entry.id)!;
            noSyncBridge.assignTask(task.id, 'agent-1');
            noSyncBridge.completeTask(task.id, { result: 'done' });

            // Blackboard should NOT be updated
            const updatedEntry = blackboard.get(entry.id);
            expect(updatedEntry?.status).toBe('OPEN');
        });
    });

    // =========================================================================
    // Query Tests
    // =========================================================================

    describe('queries', () => {
        beforeEach(() => {
            // Create multiple tasks
            blackboard.post({ type: 'TASK', title: 'Task 1', author: 'agent-1', content: {}, priority: 'LOW' });
            blackboard.post({ type: 'TASK', title: 'Task 2', author: 'agent-2', content: {}, priority: 'HIGH' });
            blackboard.post({ type: 'TASK', title: 'Task 3', author: 'agent-1', content: {}, priority: 'MEDIUM' });
        });

        it('gets all tasks', () => {
            expect(bridge.getAllTasks()).toHaveLength(3);
        });

        it('gets task by ID', () => {
            const allTasks = bridge.getAllTasks();
            const task = bridge.getTask(allTasks[0].id);
            expect(task).not.toBeNull();
            expect(task!.title).toBe('Task 1');
        });

        it('returns null for non-existent task ID', () => {
            expect(bridge.getTask('non-existent')).toBeNull();
        });

        it('gets task by blackboard entry ID', () => {
            const entries = blackboard.getByType('TASK');
            const task = bridge.getTaskByEntryId(entries[0].id);
            expect(task).not.toBeNull();
        });

        it('gets tasks by status', () => {
            const allTasks = bridge.getAllTasks();

            // All start as QUEUED
            expect(bridge.getTasksByStatus('QUEUED')).toHaveLength(3);
            expect(bridge.getTasksByStatus('IN_PROGRESS')).toHaveLength(0);

            // Assign one
            bridge.assignTask(allTasks[0].id, 'agent-1');
            expect(bridge.getTasksByStatus('QUEUED')).toHaveLength(2);
            expect(bridge.getTasksByStatus('IN_PROGRESS')).toHaveLength(1);

            // Complete one
            bridge.completeTask(allTasks[0].id, {});
            expect(bridge.getTasksByStatus('COMPLETED')).toHaveLength(1);
        });

        it('gets statistics', () => {
            const allTasks = bridge.getAllTasks();
            bridge.assignTask(allTasks[0].id, 'agent-1');
            bridge.completeTask(allTasks[0].id, {});
            bridge.assignTask(allTasks[1].id, 'agent-2');

            const stats = bridge.getStats();

            expect(stats.total).toBe(3);
            expect(stats.queuedCount).toBe(1);
            expect(stats.inProgressCount).toBe(1);
            expect(stats.completedCount).toBe(1);
            expect(stats.failedCount).toBe(0);
        });
    });

    // =========================================================================
    // Clear Tests
    // =========================================================================

    describe('clear', () => {
        it('clears all bridged tasks', () => {
            blackboard.post({ type: 'TASK', title: 'Task 1', author: 'agent-1', content: {} });
            blackboard.post({ type: 'TASK', title: 'Task 2', author: 'agent-1', content: {} });

            expect(bridge.getAllTasks()).toHaveLength(2);

            bridge.clear();

            expect(bridge.getAllTasks()).toHaveLength(0);
        });
    });
});
