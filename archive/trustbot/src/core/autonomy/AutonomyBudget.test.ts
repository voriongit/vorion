/**
 * Autonomy Budget Service Tests
 *
 * Tests for TRUST-4.6 through TRUST-4.8
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutonomyBudgetService } from './AutonomyBudget.js';
import { trustEngine } from '../TrustEngine.js';
import type { AgentId, AgentTier } from '../../types.js';
import { TIER_BUDGETS } from './types.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestService(): AutonomyBudgetService {
    return new AutonomyBudgetService();
}

function setupTestAgent(agentId: AgentId, tier: number): void {
    // Map tier to appropriate trust score based on TIER_THRESHOLDS from types/trust.ts
    // FICO-style scoring: 300-1000 range
    const tierScores: Record<number, number> = {
        0: 150,   // PASSIVE: 0-299
        1: 375,   // WORKER: 300-449
        2: 525,   // OPERATIONAL: 450-599
        3: 675,   // TACTICAL: 600-749
        4: 825,   // EXECUTIVE: 750-899
        5: 950,   // SOVEREIGN: 900-1000
    };
    trustEngine.createTrust(agentId, {
        tier: tier as AgentTier,
        parentId: null,
        initialTrust: tierScores[tier] ?? 500,
    });
}

// ============================================================================
// Tests
// ============================================================================

describe('AutonomyBudgetService', () => {
    let service: AutonomyBudgetService;

    beforeEach(() => {
        service = createTestService();
    });

    afterEach(() => {
        service.clear();
    });

    // =========================================================================
    // TRUST-4.6: Type Definitions (implicit through TIER_BUDGETS)
    // =========================================================================

    describe('TIER_BUDGETS', () => {
        it('should have correct limits for each tier', () => {
            expect(TIER_BUDGETS[0].actions).toBe(0);
            expect(TIER_BUDGETS[1].actions).toBe(5);
            expect(TIER_BUDGETS[2].actions).toBe(20);
            expect(TIER_BUDGETS[3].actions).toBe(50);
            expect(TIER_BUDGETS[4].actions).toBe(200);
            expect(TIER_BUDGETS[5].actions).toBe(-1); // Unlimited
        });

        it('should have T5 as unlimited (-1)', () => {
            expect(TIER_BUDGETS[5].actions).toBe(-1);
            expect(TIER_BUDGETS[5].delegations).toBe(-1);
            expect(TIER_BUDGETS[5].tokens).toBe(-1);
        });
    });

    // =========================================================================
    // TRUST-4.7: Budget Creation & Reset
    // =========================================================================

    describe('getOrCreateBudget', () => {
        it('should create a new budget for today', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const budget = await service.getOrCreateBudget('agent-t3' as AgentId);

            expect(budget).toBeDefined();
            expect(budget.agentId).toBe('agent-t3');
            expect(budget.tier).toBe(3);
            expect(budget.maxAutonomousActions).toBe(TIER_BUDGETS[3].actions);
            expect(budget.maxDelegations).toBe(TIER_BUDGETS[3].delegations);
            expect(budget.maxTokenSpend).toBe(TIER_BUDGETS[3].tokens);
            expect(budget.autonomousActionsUsed).toBe(0);
        });

        it('should return existing budget', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const budget1 = await service.getOrCreateBudget('agent-t3' as AgentId);
            budget1.autonomousActionsUsed = 5;

            const budget2 = await service.getOrCreateBudget('agent-t3' as AgentId);

            expect(budget2.autonomousActionsUsed).toBe(5);
        });

        it('should set correct tier limits', async () => {
            setupTestAgent('agent-t1' as AgentId, 1);
            setupTestAgent('agent-t4' as AgentId, 4);

            const budget1 = await service.getOrCreateBudget('agent-t1' as AgentId);
            const budget4 = await service.getOrCreateBudget('agent-t4' as AgentId);

            expect(budget1.maxAutonomousActions).toBe(5);
            expect(budget4.maxAutonomousActions).toBe(200);
        });

        it('should set T5 to unlimited', async () => {
            setupTestAgent('agent-t5' as AgentId, 5);

            const budget = await service.getOrCreateBudget('agent-t5' as AgentId);

            expect(budget.maxAutonomousActions).toBe(-1);
            expect(budget.maxDelegations).toBe(-1);
            expect(budget.maxTokenSpend).toBe(-1);
        });
    });

    describe('updateTier', () => {
        it('should update budget limits when tier changes', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const budget1 = await service.getOrCreateBudget('agent-t3' as AgentId);
            expect(budget1.maxAutonomousActions).toBe(50);

            const budget2 = await service.updateTier('agent-t3' as AgentId, 4);

            expect(budget2.tier).toBe(4);
            expect(budget2.maxAutonomousActions).toBe(200);
        });
    });

    // =========================================================================
    // TRUST-4.8: Budget Enforcement
    // =========================================================================

    describe('canPerformAction', () => {
        it('should allow action when under budget', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const result = await service.canPerformAction('agent-t3' as AgentId, 'test-action');

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(49); // 50 - 1
        });

        it('should deny action when at limit', async () => {
            setupTestAgent('agent-t1' as AgentId, 1);

            // Use up the budget
            for (let i = 0; i < 5; i++) {
                await service.recordAction({
                    agentId: 'agent-t1' as AgentId,
                    actionType: 'test',
                });
            }

            const result = await service.canPerformAction('agent-t1' as AgentId, 'test-action');

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('limit reached');
            expect(result.remaining).toBe(0);
        });

        it('should always allow T5 agents', async () => {
            setupTestAgent('agent-t5' as AgentId, 5);

            // Record many actions
            for (let i = 0; i < 100; i++) {
                await service.recordAction({
                    agentId: 'agent-t5' as AgentId,
                    actionType: 'test',
                });
            }

            const result = await service.canPerformAction('agent-t5' as AgentId, 'another-action');

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(Infinity);
        });

        it('should handle multi-cost actions', async () => {
            setupTestAgent('agent-t1' as AgentId, 1);

            const result = await service.canPerformAction('agent-t1' as AgentId, 'expensive', 3);

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(2); // 5 - 3
        });
    });

    describe('recordAction', () => {
        it('should increment usage', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            await service.recordAction({
                agentId: 'agent-t3' as AgentId,
                actionType: 'test-action',
            });

            const budget = service.getBudget('agent-t3' as AgentId);
            expect(budget!.autonomousActionsUsed).toBe(1);
        });

        it('should track action in history', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            await service.recordAction({
                agentId: 'agent-t3' as AgentId,
                actionType: 'tracked-action',
            });

            const budget = service.getBudget('agent-t3' as AgentId);
            expect(budget!.actions).toHaveLength(1);
            expect(budget!.actions[0].actionType).toBe('tracked-action');
        });

        it('should throw when budget exceeded', async () => {
            setupTestAgent('agent-t1' as AgentId, 1);

            // Use up the budget
            for (let i = 0; i < 5; i++) {
                await service.recordAction({
                    agentId: 'agent-t1' as AgentId,
                    actionType: 'test',
                });
            }

            await expect(
                service.recordAction({
                    agentId: 'agent-t1' as AgentId,
                    actionType: 'one-more',
                })
            ).rejects.toThrow(/Daily action limit reached/);
        });

        it('should emit exhausted event at limit', async () => {
            setupTestAgent('agent-t1' as AgentId, 1);

            const handler = vi.fn();
            service.on('budget:exhausted', handler);

            for (let i = 0; i < 5; i++) {
                await service.recordAction({
                    agentId: 'agent-t1' as AgentId,
                    actionType: 'test',
                });
            }

            expect(handler).toHaveBeenCalled();
        });
    });

    describe('canRequestDelegation', () => {
        it('should allow delegation when under limit', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const result = await service.canRequestDelegation('agent-t3' as AgentId);

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(2); // 3 - 1
        });

        it('should deny delegation when at limit', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            // Use up delegations
            await service.recordDelegation('agent-t3' as AgentId);
            await service.recordDelegation('agent-t3' as AgentId);
            await service.recordDelegation('agent-t3' as AgentId);

            const result = await service.canRequestDelegation('agent-t3' as AgentId);

            expect(result.allowed).toBe(false);
        });
    });

    describe('canSpendTokens', () => {
        it('should allow token spend when under limit', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const result = await service.canSpendTokens('agent-t3' as AgentId, 1000);

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(19000); // 20000 - 1000
        });

        it('should deny token spend when exceeds limit', async () => {
            setupTestAgent('agent-t1' as AgentId, 1);

            const result = await service.canSpendTokens('agent-t1' as AgentId, 2000);

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(1000); // Max available
        });
    });

    // =========================================================================
    // Budget Summary
    // =========================================================================

    describe('getBudgetSummary', () => {
        it('should return complete summary', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            // Use some budget
            await service.recordAction({
                agentId: 'agent-t3' as AgentId,
                actionType: 'test',
                cost: 10,
            });

            const summary = await service.getBudgetSummary('agent-t3' as AgentId);

            expect(summary.agentId).toBe('agent-t3');
            expect(summary.tier).toBe(3);
            expect(summary.actions.used).toBe(10);
            expect(summary.actions.max).toBe(50);
            expect(summary.actions.remaining).toBe(40);
            expect(summary.actions.percentUsed).toBe(20);
        });
    });

    // =========================================================================
    // Statistics
    // =========================================================================

    describe('getStats', () => {
        it('should return accurate statistics', async () => {
            setupTestAgent('agent-t3-a' as AgentId, 3);
            setupTestAgent('agent-t3-b' as AgentId, 3);
            setupTestAgent('agent-t4' as AgentId, 4);

            await service.recordAction({
                agentId: 'agent-t3-a' as AgentId,
                actionType: 'test',
                cost: 25,
            });

            await service.recordAction({
                agentId: 'agent-t3-b' as AgentId,
                actionType: 'test',
                cost: 10,
            });

            await service.recordAction({
                agentId: 'agent-t4' as AgentId,
                actionType: 'test',
                cost: 50,
            });

            const stats = service.getStats();

            expect(stats.totalBudgets).toBe(3);
            expect(stats.totalActionsToday).toBe(85); // 25 + 10 + 50
            expect(stats.byTier[3].agents).toBe(2);
            expect(stats.byTier[4].agents).toBe(1);
        });
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================

    describe('edge cases', () => {
        it('should handle T0 agents (no autonomy)', async () => {
            setupTestAgent('agent-t0' as AgentId, 0);

            const budget = await service.getOrCreateBudget('agent-t0' as AgentId);
            expect(budget.maxAutonomousActions).toBe(0);

            const result = await service.canPerformAction('agent-t0' as AgentId, 'any');
            expect(result.allowed).toBe(false);
        });

        it('should handle token costs', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            await service.recordAction({
                agentId: 'agent-t3' as AgentId,
                actionType: 'expensive',
                cost: 1,
                tokenCost: 5000,
            });

            const budget = service.getBudget('agent-t3' as AgentId);
            expect(budget!.tokensSpent).toBe(5000);
        });
    });
});
