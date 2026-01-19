/**
 * DisconnectionHandler Tests
 *
 * Epic 10: Agent Connection Layer
 * Story 10.7: Graceful Disconnection Handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    DisconnectionHandler,
    TaskInfo,
    DisconnectionReason,
    resetDisconnectionHandler,
} from './DisconnectionHandler.js';

describe('DisconnectionHandler', () => {
    let handler: DisconnectionHandler;

    beforeEach(() => {
        vi.useFakeTimers();
        resetDisconnectionHandler();
        handler = new DisconnectionHandler({
            reconnectionWindowMs: 5000, // 5 seconds for testing
            autoReassign: true,
            maxPreservedTasks: 10,
            cleanupIntervalMs: 1000,
            stateRetentionMs: 10000, // 10 seconds for testing
        });
    });

    afterEach(() => {
        handler.clear();
        vi.useRealTimers();
    });

    // =========================================================================
    // Task Management
    // =========================================================================

    describe('Task Management', () => {
        it('should register a task', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'pending',
                progress: 0,
                createdAt: new Date(),
            });

            const task = handler.getTask('task_1');
            expect(task).not.toBeNull();
            expect(task?.taskId).toBe('task_1');
            expect(task?.agentId).toBe('agent_1');
            expect(task?.status).toBe('pending');
        });

        it('should track tasks by agent', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            handler.registerTask({
                taskId: 'task_2',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'query',
                status: 'pending',
                progress: 0,
                createdAt: new Date(),
            });

            const tasks = handler.getAgentTasks('agent_1');
            expect(tasks.length).toBe(2);
        });

        it('should update task status', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'pending',
                progress: 0,
                createdAt: new Date(),
            });

            const updated = handler.updateTaskStatus('task_1', 'in_progress', 25);
            expect(updated).toBe(true);

            const task = handler.getTask('task_1');
            expect(task?.status).toBe('in_progress');
            expect(task?.progress).toBe(25);
        });

        it('should complete a task', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            handler.completeTask('task_1');

            const task = handler.getTask('task_1');
            expect(task?.status).toBe('completed');
            expect(task?.progress).toBe(100);
        });

        it('should fail a task', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            handler.failTask('task_1');

            const task = handler.getTask('task_1');
            expect(task?.status).toBe('failed');
        });

        it('should remove a task', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'completed',
                progress: 100,
                createdAt: new Date(),
            });

            const removed = handler.removeTask('task_1');
            expect(removed).toBe(true);
            expect(handler.getTask('task_1')).toBeNull();
        });

        it('should get in-progress tasks', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            handler.registerTask({
                taskId: 'task_2',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'query',
                status: 'completed',
                progress: 100,
                createdAt: new Date(),
            });

            const inProgress = handler.getInProgressTasks('agent_1');
            expect(inProgress.length).toBe(1);
            expect(inProgress[0].taskId).toBe('task_1');
        });

        it('should enforce max preserved tasks limit', () => {
            // Register more than max tasks
            for (let i = 0; i < 15; i++) {
                handler.registerTask({
                    taskId: `task_${i}`,
                    agentId: 'agent_1',
                    orgId: 'org_1',
                    type: 'execute',
                    status: i < 5 ? 'completed' : 'in_progress',
                    progress: i < 5 ? 100 : 50,
                    createdAt: new Date(),
                });
            }

            // Should have removed some completed tasks
            const tasks = handler.getAgentTasks('agent_1');
            expect(tasks.length).toBeLessThanOrEqual(10);
        });
    });

    // =========================================================================
    // Disconnection Handling
    // =========================================================================

    describe('Disconnection Handling', () => {
        it('should mark in-progress tasks as agent_disconnected', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            handler.registerTask({
                taskId: 'task_2',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'query',
                status: 'in_progress',
                progress: 25,
                createdAt: new Date(),
            });

            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'network_error');

            const task1 = handler.getTask('task_1');
            const task2 = handler.getTask('task_2');

            expect(task1?.status).toBe('agent_disconnected');
            expect(task2?.status).toBe('agent_disconnected');
        });

        it('should not affect completed tasks on disconnection', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'completed',
                progress: 100,
                createdAt: new Date(),
            });

            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'network_error');

            const task = handler.getTask('task_1');
            expect(task?.status).toBe('completed');
        });

        it('should emit disconnection event with affected tasks', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            const events: any[] = [];
            handler.on('agent:disconnected', (event) => events.push(event));

            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'timeout');

            expect(events.length).toBe(1);
            expect(events[0].agentId).toBe('agent_1');
            expect(events[0].reason).toBe('timeout');
            expect(events[0].affectedTasks).toContain('task_1');
        });

        it('should emit task:orphaned event for each affected task', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            handler.registerTask({
                taskId: 'task_2',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'query',
                status: 'in_progress',
                progress: 25,
                createdAt: new Date(),
            });

            const orphanedTasks: any[] = [];
            handler.on('task:orphaned', (task) => orphanedTasks.push(task));

            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'network_error');

            expect(orphanedTasks.length).toBe(2);
        });

        it('should record disconnection history', () => {
            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'timeout');
            handler.handleDisconnection('agent_1', 'org_1', 'conn_2', 'network_error');

            const history = handler.getDisconnectionHistory('agent_1');
            expect(history.length).toBe(2);
            expect(history[0].reason).toBe('timeout');
            expect(history[1].reason).toBe('network_error');
        });

        it('should update agent state on disconnection', () => {
            handler.markAgentConnected('agent_1', 'org_1');
            expect(handler.isAgentConnected('agent_1')).toBe(true);

            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'client_close');

            expect(handler.isAgentConnected('agent_1')).toBe(false);
            const state = handler.getAgentState('agent_1');
            expect(state?.disconnectionReason).toBe('client_close');
        });

        it('should identify graceful vs non-graceful disconnections', () => {
            const gracefulEvent = handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'client_close');
            const nonGracefulEvent = handler.handleDisconnection('agent_2', 'org_1', 'conn_2', 'network_error');

            expect(gracefulEvent.wasGraceful).toBe(true);
            expect(nonGracefulEvent.wasGraceful).toBe(false);
        });
    });

    // =========================================================================
    // Reconnection Handling
    // =========================================================================

    describe('Reconnection Handling', () => {
        it('should resume tasks on reconnection within window', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'network_error');

            // Reconnect within window (5 seconds)
            vi.advanceTimersByTime(3000);

            const event = handler.handleReconnection('agent_1', 'org_1', 'conn_2');

            expect(event.resumableTasks).toContain('task_1');

            const task = handler.getTask('task_1');
            expect(task?.status).toBe('in_progress');
        });

        it('should emit task:resumed event', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'network_error');

            const resumedTasks: any[] = [];
            handler.on('task:resumed', (task) => resumedTasks.push(task));

            vi.advanceTimersByTime(2000);
            handler.handleReconnection('agent_1', 'org_1', 'conn_2');

            expect(resumedTasks.length).toBe(1);
            expect(resumedTasks[0].taskId).toBe('task_1');
        });

        it('should not resume tasks after window expires', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'network_error');

            // Wait past reconnection window (5 seconds)
            vi.advanceTimersByTime(6000);

            const event = handler.handleReconnection('agent_1', 'org_1', 'conn_2');

            expect(event.resumableTasks.length).toBe(0);

            const task = handler.getTask('task_1');
            expect(task?.status).toBe('agent_disconnected');
        });

        it('should update agent state on reconnection', () => {
            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'network_error');
            expect(handler.isAgentConnected('agent_1')).toBe(false);

            handler.handleReconnection('agent_1', 'org_1', 'conn_2');

            expect(handler.isAgentConnected('agent_1')).toBe(true);
        });

        it('should include previous disconnection in reconnection event', () => {
            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'timeout');

            vi.advanceTimersByTime(1000);

            const event = handler.handleReconnection('agent_1', 'org_1', 'conn_2');

            expect(event.previousDisconnection).toBeDefined();
            expect(event.previousDisconnection?.reason).toBe('timeout');
        });

        it('should cancel pending reassignment on reconnection', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            const expiredTasks: any[] = [];
            handler.on('task:expired', (task) => expiredTasks.push(task));

            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'network_error');

            // Reconnect before window expires
            vi.advanceTimersByTime(3000);
            handler.handleReconnection('agent_1', 'org_1', 'conn_2');

            // Wait past original window
            vi.advanceTimersByTime(5000);

            // Task should not be expired since we reconnected
            expect(expiredTasks.length).toBe(0);
        });
    });

    // =========================================================================
    // Task Reassignment
    // =========================================================================

    describe('Task Reassignment', () => {
        it('should reassign a task to another agent', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'agent_disconnected',
                progress: 50,
                createdAt: new Date(),
            });

            const reassignment = handler.reassignTask('task_1', 'agent_2', 'manual');

            expect(reassignment).not.toBeNull();
            expect(reassignment?.fromAgentId).toBe('agent_1');
            expect(reassignment?.toAgentId).toBe('agent_2');

            const task = handler.getTask('task_1');
            expect(task?.agentId).toBe('agent_2');
            expect(task?.status).toBe('reassigned');
        });

        it('should emit task:reassigned event', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'agent_disconnected',
                progress: 50,
                createdAt: new Date(),
            });

            const reassignments: any[] = [];
            handler.on('task:reassigned', (r) => reassignments.push(r));

            handler.reassignTask('task_1', 'agent_2', 'auto');

            expect(reassignments.length).toBe(1);
            expect(reassignments[0].taskId).toBe('task_1');
        });

        it('should reassign all orphaned tasks for an agent', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'agent_disconnected',
                progress: 50,
                createdAt: new Date(),
            });

            handler.registerTask({
                taskId: 'task_2',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'query',
                status: 'agent_disconnected',
                progress: 25,
                createdAt: new Date(),
            });

            const reassignments = handler.reassignOrphanedTasks('agent_1', 'agent_2');

            expect(reassignments.length).toBe(2);
            expect(handler.getAgentTasks('agent_2').length).toBe(2);
        });

        it('should get available agents for reassignment', () => {
            handler.markAgentConnected('agent_1', 'org_1');
            handler.markAgentConnected('agent_2', 'org_1');
            handler.markAgentConnected('agent_3', 'org_2'); // Different org

            const available = handler.getAvailableAgents('org_1', 'agent_1');

            expect(available).toContain('agent_2');
            expect(available).not.toContain('agent_1'); // Excluded
            expect(available).not.toContain('agent_3'); // Different org
        });

        it('should emit task:expired after reconnection window', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            const expiredTasks: any[] = [];
            handler.on('task:expired', (task) => expiredTasks.push(task));

            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'network_error');

            // Wait for reconnection window to expire
            vi.advanceTimersByTime(6000);

            expect(expiredTasks.length).toBe(1);
            expect(expiredTasks[0].taskId).toBe('task_1');
        });
    });

    // =========================================================================
    // Orphaned Tasks
    // =========================================================================

    describe('Orphaned Tasks', () => {
        it('should get all orphaned tasks', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'agent_disconnected',
                progress: 50,
                createdAt: new Date(),
            });

            handler.registerTask({
                taskId: 'task_2',
                agentId: 'agent_2',
                orgId: 'org_1',
                type: 'query',
                status: 'agent_disconnected',
                progress: 25,
                createdAt: new Date(),
            });

            handler.registerTask({
                taskId: 'task_3',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 75,
                createdAt: new Date(),
            });

            const orphaned = handler.getOrphanedTasks();
            expect(orphaned.length).toBe(2);
        });

        it('should filter orphaned tasks by org', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'agent_disconnected',
                progress: 50,
                createdAt: new Date(),
            });

            handler.registerTask({
                taskId: 'task_2',
                agentId: 'agent_2',
                orgId: 'org_2',
                type: 'query',
                status: 'agent_disconnected',
                progress: 25,
                createdAt: new Date(),
            });

            const orphanedOrg1 = handler.getOrphanedTasks('org_1');
            const orphanedOrg2 = handler.getOrphanedTasks('org_2');

            expect(orphanedOrg1.length).toBe(1);
            expect(orphanedOrg2.length).toBe(1);
        });
    });

    // =========================================================================
    // Cleanup
    // =========================================================================

    describe('Cleanup', () => {
        it('should clean stale state after retention period', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'completed',
                progress: 100,
                createdAt: new Date(),
            });

            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'client_close');

            // Wait past retention period
            vi.advanceTimersByTime(15000);

            const cleaned = handler.cleanupStaleState();
            expect(cleaned).toBeGreaterThanOrEqual(1);

            expect(handler.getAgentState('agent_1')).toBeNull();
        });

        it('should not clean connected agent state', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'completed',
                progress: 100,
                createdAt: new Date(),
            });

            handler.markAgentConnected('agent_1', 'org_1');

            vi.advanceTimersByTime(15000);

            handler.cleanupStaleState();

            expect(handler.getAgentState('agent_1')).not.toBeNull();
        });

        it('should emit state:cleaned event', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'completed',
                progress: 100,
                createdAt: new Date(),
            });

            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'client_close');

            const cleanedEvents: any[] = [];
            handler.on('state:cleaned', (agentId, tasksRemoved) => {
                cleanedEvents.push({ agentId, tasksRemoved });
            });

            vi.advanceTimersByTime(15000);
            handler.cleanupStaleState();

            expect(cleanedEvents.length).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // Statistics
    // =========================================================================

    describe('Statistics', () => {
        it('should return accurate stats', () => {
            handler.markAgentConnected('agent_1', 'org_1');
            handler.markAgentConnected('agent_2', 'org_1');

            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            handler.registerTask({
                taskId: 'task_2',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'query',
                status: 'agent_disconnected',
                progress: 25,
                createdAt: new Date(),
            });

            handler.handleDisconnection('agent_2', 'org_1', 'conn_2', 'timeout');

            const stats = handler.getStats();

            expect(stats.totalAgents).toBe(2);
            expect(stats.connectedAgents).toBe(1);
            expect(stats.disconnectedAgents).toBe(1);
            expect(stats.totalTasks).toBe(2);
            expect(stats.orphanedTasks).toBe(1);
        });
    });

    // =========================================================================
    // Lifecycle
    // =========================================================================

    describe('Lifecycle', () => {
        it('should start and stop cleanup timer', () => {
            handler.startCleanup();

            // Should be running
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'completed',
                progress: 100,
                createdAt: new Date(),
            });

            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'client_close');

            handler.stopCleanup();

            // Should have stopped - no cleanup
            vi.advanceTimersByTime(15000);
            expect(handler.getAgentState('agent_1')).not.toBeNull();
        });

        it('should shutdown gracefully', async () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            handler.handleDisconnection('agent_1', 'org_1', 'conn_1', 'network_error');

            const shutdownPromise = handler.shutdown(100);
            vi.advanceTimersByTime(200);
            await shutdownPromise;

            expect(handler.getStats().totalTasks).toBe(0);
        });

        it('should clear all state', () => {
            handler.registerTask({
                taskId: 'task_1',
                agentId: 'agent_1',
                orgId: 'org_1',
                type: 'execute',
                status: 'in_progress',
                progress: 50,
                createdAt: new Date(),
            });

            handler.markAgentConnected('agent_1', 'org_1');

            handler.clear();

            expect(handler.getTask('task_1')).toBeNull();
            expect(handler.getAgentState('agent_1')).toBeNull();
        });
    });
});
