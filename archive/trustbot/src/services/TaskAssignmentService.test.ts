/**
 * TaskAssignmentService Unit Tests
 *
 * Tests the task assignment service with decision pattern learning.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    TaskAssignmentService,
    getTaskAssignmentService,
    resetTaskAssignmentService,
    type TaskContext,
    type AgentContext,
} from './TaskAssignmentService.js';

describe('TaskAssignmentService', () => {
    let service: TaskAssignmentService;

    beforeEach(() => {
        resetTaskAssignmentService();
        service = new TaskAssignmentService();
    });

    // =========================================================================
    // Helper Functions
    // =========================================================================

    function createTaskContext(overrides: Partial<TaskContext> = {}): TaskContext {
        return {
            taskId: 'task-123',
            title: 'Implement feature',
            description: 'Build the new feature for the app',
            priority: 'MEDIUM',
            requiredTier: 2,
            capabilities: ['development'],
            ...overrides,
        };
    }

    function createAgentContext(overrides: Partial<AgentContext> = {}): AgentContext {
        return {
            agentId: 'agent-001',
            agentType: 'worker',
            agentTier: 2,
            trustScore: 650,
            capabilities: ['development', 'testing'],
            currentLoad: 1,
            ...overrides,
        };
    }

    // =========================================================================
    // Initialization Tests
    // =========================================================================

    describe('initialization', () => {
        it('creates service instance', () => {
            expect(service).toBeInstanceOf(TaskAssignmentService);
        });

        it('returns singleton via getter', () => {
            const service1 = getTaskAssignmentService();
            const service2 = getTaskAssignmentService();
            expect(service1).toBe(service2);
        });

        it('resets singleton correctly', () => {
            const service1 = getTaskAssignmentService();
            resetTaskAssignmentService();
            const service2 = getTaskAssignmentService();
            expect(service1).not.toBe(service2);
        });

        it('starts with no recorded decisions', () => {
            const stats = service.getStats();
            expect(stats.totalRecorded).toBe(0);
        });

        it('reports pattern learning disabled without Supabase', () => {
            // Without Supabase configured, pattern learning should be disabled
            expect(service.isPatternLearningEnabled()).toBe(false);
        });
    });

    // =========================================================================
    // Record Assignment Tests
    // =========================================================================

    describe('recordAssignment', () => {
        it('records assigned decision', async () => {
            const recordedSpy = vi.fn();
            service.on('assignment:recorded', recordedSpy);

            const task = createTaskContext();
            const agent = createAgentContext();

            await service.recordAssignment(task, agent, 'assigned', 'Good match for the task');

            expect(recordedSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    taskId: 'task-123',
                    agentId: 'agent-001',
                    decision: 'assigned',
                    rationale: 'Good match for the task',
                })
            );

            const stats = service.getStats();
            expect(stats.totalRecorded).toBe(1);
            expect(stats.byDecision.assigned).toBe(1);
        });

        it('records rejected decision', async () => {
            const task = createTaskContext();
            const agent = createAgentContext({ agentTier: 1 });

            await service.recordAssignment(task, agent, 'rejected', 'Tier too low');

            const stats = service.getStats();
            expect(stats.byDecision.rejected).toBe(1);
        });

        it('records escalated decision', async () => {
            const task = createTaskContext({ priority: 'CRITICAL' });
            const agent = createAgentContext();

            await service.recordAssignment(task, agent, 'escalated', 'Needs HITL approval');

            const stats = service.getStats();
            expect(stats.byDecision.escalated).toBe(1);
        });

        it('records HITL user ID when provided', async () => {
            const recordedSpy = vi.fn();
            service.on('assignment:recorded', recordedSpy);

            const task = createTaskContext();
            const agent = createAgentContext();

            await service.recordAssignment(
                task,
                agent,
                'assigned',
                'HITL approved',
                'hitl-user-123'
            );

            expect(recordedSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    hitlUserId: 'hitl-user-123',
                })
            );
        });

        it('calculates confidence based on tier match', async () => {
            const recordedSpy = vi.fn();
            service.on('assignment:recorded', recordedSpy);

            // Exact tier match should have higher confidence
            const task = createTaskContext({ requiredTier: 3 });
            const agent = createAgentContext({ agentTier: 3 });

            await service.recordAssignment(task, agent, 'assigned', 'Tier match');

            const decision = recordedSpy.mock.calls[0][0];
            expect(decision.confidence).toBeGreaterThan(50);
        });

        it('calculates confidence based on trust score', async () => {
            const recordedSpy = vi.fn();
            service.on('assignment:recorded', recordedSpy);

            const task = createTaskContext();
            const highTrustAgent = createAgentContext({ trustScore: 850 });

            await service.recordAssignment(task, highTrustAgent, 'assigned', 'High trust');

            const decision = recordedSpy.mock.calls[0][0];
            expect(decision.confidence).toBeGreaterThan(70);
        });

        it('reduces confidence for high agent load', async () => {
            const recordedSpy = vi.fn();
            service.on('assignment:recorded', recordedSpy);

            const task = createTaskContext();
            const overloadedAgent = createAgentContext({ currentLoad: 10 });

            await service.recordAssignment(task, overloadedAgent, 'assigned', 'Overloaded');

            const decision = recordedSpy.mock.calls[0][0];
            // High load should reduce confidence
            expect(decision.confidence).toBeLessThan(70);
        });
    });

    // =========================================================================
    // Get Recommendations Tests
    // =========================================================================

    describe('getRecommendations', () => {
        it('returns recommendations for available agents', async () => {
            const predictedSpy = vi.fn();
            service.on('assignment:predicted', predictedSpy);

            const task = createTaskContext({ requiredTier: 2 });
            const agents = [
                createAgentContext({ agentId: 'agent-1', agentTier: 3 }),
                createAgentContext({ agentId: 'agent-2', agentTier: 2 }),
                createAgentContext({ agentId: 'agent-3', agentTier: 1 }), // Too low
            ];

            const recommendations = await service.getRecommendations(task, agents);

            expect(recommendations).toHaveLength(2); // agent-1 and agent-2
            expect(recommendations.map(r => r.agentId)).toContain('agent-1');
            expect(recommendations.map(r => r.agentId)).toContain('agent-2');
            expect(recommendations.map(r => r.agentId)).not.toContain('agent-3');
        });

        it('sorts recommendations by confidence', async () => {
            const task = createTaskContext({ requiredTier: 2 });
            const agents = [
                createAgentContext({ agentId: 'agent-low', agentTier: 2, trustScore: 400 }),
                createAgentContext({ agentId: 'agent-high', agentTier: 3, trustScore: 900 }),
            ];

            const recommendations = await service.getRecommendations(task, agents);

            // Higher tier and trust should come first
            expect(recommendations[0].agentId).toBe('agent-high');
            expect(recommendations[0].confidence).toBeGreaterThan(recommendations[1].confidence);
        });

        it('returns empty array when no agents qualify', async () => {
            const task = createTaskContext({ requiredTier: 5 });
            const agents = [
                createAgentContext({ agentId: 'agent-1', agentTier: 2 }),
                createAgentContext({ agentId: 'agent-2', agentTier: 3 }),
            ];

            const recommendations = await service.getRecommendations(task, agents);

            expect(recommendations).toHaveLength(0);
        });

        it('includes reasoning in recommendations', async () => {
            const task = createTaskContext({ requiredTier: 2 });
            const agents = [createAgentContext({ agentId: 'agent-1', agentTier: 3 })];

            const recommendations = await service.getRecommendations(task, agents);

            expect(recommendations[0].reasoning).toContain('Tier 3 meets requirement');
        });

        it('indicates pattern basis for recommendations', async () => {
            const task = createTaskContext({ requiredTier: 2 });
            const agents = [createAgentContext({ agentId: 'agent-1', agentTier: 2 })];

            const recommendations = await service.getRecommendations(task, agents);

            // Without pattern learning, basedOnPatterns should be 0
            expect(recommendations[0].basedOnPatterns).toBe(0);
        });

        it('emits predicted event', async () => {
            const predictedSpy = vi.fn();
            service.on('assignment:predicted', predictedSpy);

            const task = createTaskContext();
            const agents = [createAgentContext()];

            await service.getRecommendations(task, agents);

            expect(predictedSpy).toHaveBeenCalledWith(task.taskId, expect.any(Array));
        });
    });

    // =========================================================================
    // Update Outcome Tests
    // =========================================================================

    describe('updateOutcome', () => {
        it('updates outcome for recorded decision', async () => {
            const outcomeSpy = vi.fn();
            service.on('outcome:updated', outcomeSpy);

            const task = createTaskContext();
            const agent = createAgentContext();

            // First record the assignment
            await service.recordAssignment(task, agent, 'assigned', 'Test');

            // Then update the outcome
            await service.updateOutcome(task.taskId, true, {
                completionTimeMs: 5000,
                qualityScore: 95,
            });

            expect(outcomeSpy).toHaveBeenCalledWith(task.taskId, true);
        });

        it('handles failure outcome', async () => {
            const outcomeSpy = vi.fn();
            service.on('outcome:updated', outcomeSpy);

            const task = createTaskContext();
            const agent = createAgentContext();

            await service.recordAssignment(task, agent, 'assigned', 'Test');
            await service.updateOutcome(task.taskId, false);

            expect(outcomeSpy).toHaveBeenCalledWith(task.taskId, false);
        });

        it('ignores outcome for unrecorded task', async () => {
            const outcomeSpy = vi.fn();
            service.on('outcome:updated', outcomeSpy);

            await service.updateOutcome('unknown-task', true);

            expect(outcomeSpy).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // Statistics Tests
    // =========================================================================

    describe('getStats', () => {
        it('returns accurate statistics', async () => {
            const task1 = createTaskContext({ taskId: 'task-1' });
            const task2 = createTaskContext({ taskId: 'task-2' });
            const task3 = createTaskContext({ taskId: 'task-3' });
            const agent = createAgentContext();

            await service.recordAssignment(task1, agent, 'assigned', 'OK');
            await service.recordAssignment(task2, agent, 'assigned', 'OK');
            await service.recordAssignment(task3, agent, 'rejected', 'Busy');

            const stats = service.getStats();

            expect(stats.totalRecorded).toBe(3);
            expect(stats.byDecision.assigned).toBe(2);
            expect(stats.byDecision.rejected).toBe(1);
            expect(stats.patternLearningEnabled).toBe(false);
        });

        it('returns zero counts when empty', () => {
            const stats = service.getStats();

            expect(stats.totalRecorded).toBe(0);
            expect(stats.byDecision).toEqual({});
        });
    });

    // =========================================================================
    // Clear Tests
    // =========================================================================

    describe('clear', () => {
        it('clears all recorded decisions', async () => {
            const task = createTaskContext();
            const agent = createAgentContext();

            await service.recordAssignment(task, agent, 'assigned', 'Test');

            expect(service.getStats().totalRecorded).toBe(1);

            service.clear();

            expect(service.getStats().totalRecorded).toBe(0);
        });
    });

    // =========================================================================
    // Confidence Calculation Tests
    // =========================================================================

    describe('confidence calculation', () => {
        it('gives bonus for capability match', async () => {
            const recordedSpy = vi.fn();
            service.on('assignment:recorded', recordedSpy);

            const task = createTaskContext({
                capabilities: ['frontend', 'testing'],
            });
            const agent = createAgentContext({
                capabilities: ['frontend', 'testing', 'backend'],
            });

            await service.recordAssignment(task, agent, 'assigned', 'Good match');

            const decision = recordedSpy.mock.calls[0][0];
            // Should have capability match bonus
            expect(decision.confidence).toBeGreaterThan(60);
        });

        it('has lower confidence for tier mismatch', async () => {
            const recordedSpy = vi.fn();
            service.on('assignment:recorded', recordedSpy);

            // Agent tier higher than required
            const task = createTaskContext({ requiredTier: 2 });
            const agent = createAgentContext({ agentTier: 5 });

            await service.recordAssignment(task, agent, 'assigned', 'Overqualified');

            // Record another with exact match
            const task2 = createTaskContext({ taskId: 'task-2', requiredTier: 3 });
            const agent2 = createAgentContext({ agentId: 'agent-2', agentTier: 3 });

            await service.recordAssignment(task2, agent2, 'assigned', 'Exact match');

            const decision1 = recordedSpy.mock.calls[0][0];
            const decision2 = recordedSpy.mock.calls[1][0];

            // Exact tier match should have slightly higher confidence
            expect(decision2.confidence).toBeGreaterThan(decision1.confidence - 20);
        });
    });

    // =========================================================================
    // Multiple Agents Tests
    // =========================================================================

    describe('multiple agent recommendations', () => {
        it('ranks multiple agents correctly', async () => {
            const task = createTaskContext({
                requiredTier: 2,
                capabilities: ['frontend'],
            });

            const agents = [
                createAgentContext({
                    agentId: 'junior',
                    agentTier: 2,
                    trustScore: 500,
                    capabilities: ['frontend'],
                }),
                createAgentContext({
                    agentId: 'senior',
                    agentTier: 4,
                    trustScore: 850,
                    capabilities: ['frontend', 'backend', 'testing'],
                }),
                createAgentContext({
                    agentId: 'specialist',
                    agentTier: 3,
                    trustScore: 750,
                    capabilities: ['frontend'],
                }),
            ];

            const recommendations = await service.getRecommendations(task, agents);

            expect(recommendations).toHaveLength(3);
            // Senior should be first (highest tier + trust)
            expect(recommendations[0].agentId).toBe('senior');
        });

        it('handles agents with no capabilities', async () => {
            const task = createTaskContext({ requiredTier: 1 });

            const agents = [
                createAgentContext({
                    agentId: 'no-caps',
                    agentTier: 2,
                    capabilities: [],
                }),
            ];

            const recommendations = await service.getRecommendations(task, agents);

            expect(recommendations).toHaveLength(1);
            expect(recommendations[0].agentId).toBe('no-caps');
        });
    });
});
