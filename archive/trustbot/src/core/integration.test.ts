/**
 * Aurais 2.0 Integration Tests
 *
 * End-to-end tests that verify the full flow across modules:
 * - Trust scoring with FICO components
 * - Cryptographic audit logging
 * - Council governance and voting
 * - Delegation and autonomy budgets
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Core modules
import { TrustEngine, trustEngine } from './TrustEngine.js';
import { TrustScoreCalculator } from './TrustScoreCalculator.js';
import { CryptographicAuditLogger } from './CryptographicAuditLogger.js';
import { SecurityLayer, securityLayer } from './SecurityLayer.js';
import { Blackboard, blackboard } from './Blackboard.js';

// Council modules
import { CouncilService } from './council/CouncilService.js';
import { CouncilMemberRegistry } from './council/CouncilMemberRegistry.js';
import { PrecedentService } from './council/PrecedentService.js';

// Delegation & Autonomy modules
import { DelegationManager } from './delegation/DelegationManager.js';
import { AutonomyBudgetService } from './autonomy/AutonomyBudget.js';

// Types
import type { AgentId, AgentTier } from '../types.js';
import type { Permission } from './SecurityLayer.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestAgentId(name: string): AgentId {
    return `test-agent-${name}-${Date.now()}` as AgentId;
}

function setupAgent(agentId: AgentId, tier: AgentTier): void {
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
        tier,
        parentId: null,
        initialTrust: tierScores[tier] ?? 500,
    });
}

// ============================================================================
// Integration Test Suites
// ============================================================================

describe('Aurais 2.0 Integration Tests', () => {
    // =========================================================================
    // Trust Scoring + Audit Integration
    // =========================================================================

    describe('Trust Scoring + Audit Integration', () => {
        let auditLogger: CryptographicAuditLogger;
        let calculator: TrustScoreCalculator;

        beforeEach(() => {
            auditLogger = new CryptographicAuditLogger();
            calculator = new TrustScoreCalculator();
        });

        it('should calculate FICO score and log to audit trail', async () => {
            const agentId = createTestAgentId('scorer');
            setupAgent(agentId, 3);

            // Calculate enhanced score with component data
            const score = calculator.calculateFullScore(agentId, {
                decisionAccuracy: [{ approved: 90, rejected: 10, riskLevel: 'low' }],
                ethicsCompliance: { violations: 0, escalations: 0 },
                taskSuccess: { completed: 95, failed: 5 },
                operationalStability: { errors: 1, avgResponseTimeMs: 200 },
                peerReviews: { endorsements: 5, resolvedSolutions: 2, totalContributions: 8 },
            });

            // Log the calculation to audit
            const entry = await auditLogger.logEntry({
                action: 'TRUST_SCORE_CALCULATED',
                actor: { type: 'AGENT', id: agentId, tier: 3 },
                outcome: 'SUCCESS',
                details: {
                    ficoScore: score.ficoScore,
                    components: score.components,
                },
            });

            // Verify audit entry
            expect(entry.action).toBe('TRUST_SCORE_CALCULATED');
            expect(entry.entryHash).toBeDefined();
            expect(entry.previousHash).toBeDefined();

            // Verify chain integrity
            const chainStatus = await auditLogger.verifyChain();
            expect(chainStatus.isValid).toBe(true);
        });

        it('should track trust changes with tamper-evident audit', async () => {
            const agentId = createTestAgentId('tracked');
            setupAgent(agentId, 2);

            // Log initial trust
            await auditLogger.logEntry({
                action: 'TRUST_INITIALIZED',
                actor: { type: 'SYSTEM', id: 'aurais', tier: 5 },
                target: { type: 'AGENT', id: agentId },
                outcome: 'SUCCESS',
            });

            // Record positive actions
            for (let i = 0; i < 5; i++) {
                await auditLogger.logEntry({
                    action: 'TRUST_REWARD',
                    actor: { type: 'AGENT', id: agentId, tier: 2 },
                    outcome: 'SUCCESS',
                    details: { reason: 'good_decision' },
                });
            }

            // Verify chain
            const status = await auditLogger.verifyChain();
            expect(status.isValid).toBe(true);
            expect(status.entriesVerified).toBe(6); // 1 init + 5 rewards

            // Export for compliance
            const entries = auditLogger.getAllEntries();
            expect(entries.length).toBe(6);
            expect(entries.every(e => e.entryHash.length === 64)).toBe(true);
        });
    });

    // =========================================================================
    // Council Governance Integration
    // =========================================================================

    describe('Council Governance Integration', () => {
        let memberRegistry: CouncilMemberRegistry;
        let councilService: CouncilService;
        let precedentService: PrecedentService;

        beforeEach(() => {
            memberRegistry = new CouncilMemberRegistry();
            councilService = new CouncilService(memberRegistry);
            precedentService = new PrecedentService();
            councilService.setPrecedentService(precedentService);
        });

        afterEach(() => {
            memberRegistry.clear();
            councilService.clear();
            precedentService.clear();
        });

        it('should complete full review lifecycle', async () => {
            // Setup council members
            const member1 = createTestAgentId('council1');
            const member2 = createTestAgentId('council2');
            const member3 = createTestAgentId('council3');
            const requester = createTestAgentId('requester');

            setupAgent(member1, 4);
            setupAgent(member2, 4);
            setupAgent(member3, 5);
            setupAgent(requester, 3);

            memberRegistry.registerMember(member1, 4, 'security');
            memberRegistry.registerMember(member2, 4, 'operations');
            memberRegistry.registerMember(member3, 5, 'ethics');

            // Submit review
            const review = await councilService.submitForReview({
                requestType: 'TIER_UPGRADE',
                requesterId: requester,
                context: { currentTier: 3, requestedTier: 4, reason: 'good performance' },
            });

            expect(review.status).toBe('pending');
            expect(review.reviewers.length).toBeGreaterThanOrEqual(2);

            // Get assigned reviewers
            const reviewers = review.reviewers.map(r => r.agentId);

            // Submit votes
            await councilService.submitVote({
                reviewId: review.id,
                voterId: reviewers[0],
                vote: 'approve',
                reasoning: 'Agent has shown consistent improvement',
                confidence: 0.9,
            });

            await councilService.submitVote({
                reviewId: review.id,
                voterId: reviewers[1],
                vote: 'approve',
                reasoning: 'Performance metrics are excellent',
                confidence: 0.85,
            });

            // Check decision - status becomes 'approved' when outcome is approve
            const decidedReview = councilService.getReview(review.id);
            expect(['approved', 'decided']).toContain(decidedReview?.status);
            expect(decidedReview?.outcome?.decision).toBe('approved');
        });

        it('should create precedent from approved review', async () => {
            const member1 = createTestAgentId('pm1');
            const member2 = createTestAgentId('pm2');
            const member3 = createTestAgentId('pm3');
            const requester = createTestAgentId('preq');

            setupAgent(member1, 5);
            setupAgent(member2, 5);
            setupAgent(member3, 5);
            setupAgent(requester, 4);

            memberRegistry.registerMember(member1, 5, 'policy');
            memberRegistry.registerMember(member2, 5, 'operations');
            memberRegistry.registerMember(member3, 5, 'ethics');

            // Submit and approve a policy review
            const review = await councilService.submitForReview({
                requestType: 'POLICY_CHANGE',
                requesterId: requester,
                context: {
                    policyArea: 'delegation_limits',
                    proposedChange: 'increase T4 delegation limit to 15',
                },
                priority: 'high',
            });

            const reviewers = review.reviewers.map(r => r.agentId);

            await councilService.submitVote({
                reviewId: review.id,
                voterId: reviewers[0],
                vote: 'approve',
                reasoning: 'Reasonable expansion',
                confidence: 0.95,
            });

            await councilService.submitVote({
                reviewId: review.id,
                voterId: reviewers[1],
                vote: 'approve',
                reasoning: 'Agree with policy update',
                confidence: 0.9,
            });

            // Create precedent from decision
            const decidedReview = councilService.getReview(review.id)!;
            const precedent = await precedentService.createFromReview(decidedReview);

            expect(precedent).toBeDefined();
            expect(precedent.decision).toBe('approved');
            expect(precedent.requestType).toBe('POLICY_CHANGE');
        });
    });

    // =========================================================================
    // Delegation + Autonomy Budget Integration
    // =========================================================================

    describe('Delegation + Autonomy Budget Integration', () => {
        let delegationManager: DelegationManager;
        let autonomyBudget: AutonomyBudgetService;

        beforeEach(() => {
            delegationManager = new DelegationManager({
                minSimilarApprovals: 0,
                minAutoApproveSuccessRate: 0.0, // Allow new agents
            });
            autonomyBudget = new AutonomyBudgetService();
        });

        afterEach(() => {
            delegationManager.clear();
            autonomyBudget.clear();
        });

        it('should auto-approve T4+ delegation and track budget', async () => {
            const agentId = createTestAgentId('delegator');
            setupAgent(agentId, 4);

            // Request delegation
            const request = await delegationManager.requestCapabilities({
                agentId,
                capabilities: ['SPAWN_AGENT'] as Permission[],
                reason: 'Need to spawn worker for task',
                duration: 30 * 60 * 1000, // 30 min - under auto-approve threshold
            });

            // Should auto-approve for T4+ with short duration
            expect(request.status).toBe('approved');
            expect(request.approvedBy).toBe('AUTO');

            // Verify delegation is active
            const activeDelegations = delegationManager.getActiveDelegations(agentId);
            expect(activeDelegations.length).toBe(1);

            // Record actions against budget
            await autonomyBudget.recordAction({
                agentId,
                actionType: 'spawn_agent',
                cost: 5,
            });

            const summary = await autonomyBudget.getBudgetSummary(agentId);
            expect(summary.tier).toBe(4);
            expect(summary.actions.used).toBe(5);
            expect(summary.actions.max).toBe(200); // T4 limit
        });

        it('should enforce budget limits and require delegation', async () => {
            const agentId = createTestAgentId('limited');
            setupAgent(agentId, 1); // T1 - very limited budget

            // T1 has 5 action budget
            for (let i = 0; i < 5; i++) {
                await autonomyBudget.recordAction({
                    agentId,
                    actionType: 'basic_action',
                });
            }

            // Should be at limit now
            const canAct = await autonomyBudget.canPerformAction(agentId, 'another_action');
            expect(canAct.allowed).toBe(false);
            expect(canAct.remaining).toBe(0);

            // Request delegation for more actions
            const request = await delegationManager.requestCapabilities({
                agentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Need to continue work',
                duration: 60 * 60 * 1000,
            });

            // T1 should NOT auto-approve
            expect(request.status).toBe('pending');
        });

        it('should track delegation usage', async () => {
            const agentId = createTestAgentId('tracker');
            setupAgent(agentId, 4);

            // Request and get delegation
            const request = await delegationManager.requestCapabilities({
                agentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Test usage tracking',
                duration: 30 * 60 * 1000,
            });

            expect(request.status).toBe('approved');

            // Use the capability multiple times
            await delegationManager.checkCapability(agentId, 'BLACKBOARD_RESOLVE');
            await delegationManager.checkCapability(agentId, 'BLACKBOARD_RESOLVE');
            await delegationManager.checkCapability(agentId, 'BLACKBOARD_RESOLVE');

            // Check usage count
            const delegations = delegationManager.getActiveDelegations(agentId);
            expect(delegations[0].usageCount).toBe(3);
        });
    });

    // =========================================================================
    // Full System Integration
    // =========================================================================

    describe('Full System Integration', () => {
        let auditLogger: CryptographicAuditLogger;
        let calculator: TrustScoreCalculator;
        let memberRegistry: CouncilMemberRegistry;
        let councilService: CouncilService;
        let delegationManager: DelegationManager;
        let autonomyBudget: AutonomyBudgetService;

        beforeEach(() => {
            auditLogger = new CryptographicAuditLogger();
            calculator = new TrustScoreCalculator();
            memberRegistry = new CouncilMemberRegistry();
            councilService = new CouncilService(memberRegistry);
            delegationManager = new DelegationManager({ minSimilarApprovals: 0, minAutoApproveSuccessRate: 0 });
            autonomyBudget = new AutonomyBudgetService();
        });

        afterEach(() => {
            memberRegistry.clear();
            councilService.clear();
            delegationManager.clear();
            autonomyBudget.clear();
        });

        it('should handle complete agent lifecycle', async () => {
            // === Phase 1: Agent Creation ===
            const agentId = createTestAgentId('lifecycle');
            setupAgent(agentId, 2); // Start at T2

            await auditLogger.logEntry({
                action: 'AGENT_SPAWNED',
                actor: { type: 'SYSTEM', id: 'aurais', tier: 5 },
                target: { type: 'AGENT', id: agentId },
                outcome: 'SUCCESS',
            });

            // === Phase 2: Agent Works and Builds Trust ===
            for (let i = 0; i < 10; i++) {
                await autonomyBudget.recordAction({
                    agentId,
                    actionType: 'task_execution',
                });

                await auditLogger.logEntry({
                    action: 'TASK_COMPLETED',
                    actor: { type: 'AGENT', id: agentId, tier: 2 },
                    outcome: 'SUCCESS',
                });
            }

            // Calculate updated trust score
            const score = calculator.calculateFullScore(agentId, {
                decisionAccuracy: [{ approved: 95, rejected: 5, riskLevel: 'low' }],
                ethicsCompliance: { violations: 0, escalations: 0 },
                taskSuccess: { completed: 100, failed: 0 },
                operationalStability: { errors: 0, avgResponseTimeMs: 150 },
                peerReviews: { endorsements: 8, resolvedSolutions: 3, totalContributions: 12 },
            });
            expect(score.ficoScore).toBeGreaterThan(0);

            // === Phase 3: Agent Requests Tier Upgrade via Council ===
            const councilMember1 = createTestAgentId('cm1');
            const councilMember2 = createTestAgentId('cm2');
            const councilMember3 = createTestAgentId('cm3');
            setupAgent(councilMember1, 5);
            setupAgent(councilMember2, 5);
            setupAgent(councilMember3, 5);

            memberRegistry.registerMember(councilMember1, 5, 'governance');
            memberRegistry.registerMember(councilMember2, 5, 'operations');
            memberRegistry.registerMember(councilMember3, 5, 'ethics');

            const review = await councilService.submitForReview({
                requestType: 'TIER_UPGRADE',
                requesterId: agentId,
                context: {
                    currentTier: 2,
                    requestedTier: 3,
                    trustScore: score.ficoScore,
                    tasksCompleted: 10,
                },
            });

            await auditLogger.logEntry({
                action: 'COUNCIL_REVIEW_SUBMITTED',
                actor: { type: 'AGENT', id: agentId, tier: 2 },
                outcome: 'SUCCESS',
                details: { reviewId: review.id },
            });

            // Council approves
            const reviewers = review.reviewers.map(r => r.agentId);
            await councilService.submitVote({
                reviewId: review.id,
                voterId: reviewers[0],
                vote: 'approve',
                reasoning: 'Good track record',
                confidence: 0.9,
            });
            await councilService.submitVote({
                reviewId: review.id,
                voterId: reviewers[1],
                vote: 'approve',
                reasoning: 'Trust metrics support upgrade',
                confidence: 0.85,
            });

            const decidedReview = councilService.getReview(review.id);
            expect(decidedReview?.outcome?.decision).toBe('approved');

            await auditLogger.logEntry({
                action: 'TIER_UPGRADED',
                actor: { type: 'COUNCIL', id: 'council', tier: 5 },
                target: { type: 'AGENT', id: agentId },
                outcome: 'SUCCESS',
                details: { oldTier: 2, newTier: 3 },
            });

            // === Phase 4: Verify Complete Audit Trail ===
            const chainStatus = await auditLogger.verifyChain();
            expect(chainStatus.isValid).toBe(true);

            const allEntries = auditLogger.getAllEntries();
            expect(allEntries.length).toBeGreaterThan(10);

            // Verify we have entries for major events
            const actions = allEntries.map(e => e.action);
            expect(actions).toContain('AGENT_SPAWNED');
            expect(actions).toContain('TASK_COMPLETED');
            expect(actions).toContain('COUNCIL_REVIEW_SUBMITTED');
            expect(actions).toContain('TIER_UPGRADED');
        });

        it('should maintain audit integrity under concurrent operations', async () => {
            const agents = Array.from({ length: 5 }, (_, i) => createTestAgentId(`concurrent-${i}`));
            agents.forEach(id => setupAgent(id, 3));

            // Simulate concurrent audit logging
            const logPromises = agents.flatMap(agentId =>
                Array.from({ length: 10 }, () =>
                    auditLogger.logEntry({
                        action: 'CONCURRENT_ACTION',
                        actor: { type: 'AGENT', id: agentId, tier: 3 },
                        outcome: 'SUCCESS',
                    })
                )
            );

            await Promise.all(logPromises);

            // Verify chain integrity after concurrent writes
            const status = await auditLogger.verifyChain();
            expect(status.isValid).toBe(true);
            expect(status.entriesVerified).toBe(50); // 5 agents * 10 actions
        });
    });

    // =========================================================================
    // Error Handling Integration
    // =========================================================================

    describe('Error Handling Integration', () => {
        let delegationManager: DelegationManager;
        let autonomyBudget: AutonomyBudgetService;

        beforeEach(() => {
            delegationManager = new DelegationManager();
            autonomyBudget = new AutonomyBudgetService();
        });

        afterEach(() => {
            delegationManager.clear();
            autonomyBudget.clear();
        });

        it('should reject invalid delegation requests gracefully', async () => {
            const agentId = createTestAgentId('invalid');
            setupAgent(agentId, 3);

            // Invalid capability
            await expect(
                delegationManager.requestCapabilities({
                    agentId,
                    capabilities: ['NONEXISTENT_CAP'] as Permission[],
                    reason: 'Test',
                    duration: 60000,
                })
            ).rejects.toThrow(/Invalid capability/);

            // Empty capabilities
            await expect(
                delegationManager.requestCapabilities({
                    agentId,
                    capabilities: [],
                    reason: 'Test',
                    duration: 60000,
                })
            ).rejects.toThrow(/At least one capability/);

            // Duration too long
            await expect(
                delegationManager.requestCapabilities({
                    agentId,
                    capabilities: ['SPAWN_AGENT'] as Permission[],
                    reason: 'Test',
                    duration: 48 * 60 * 60 * 1000, // 48 hours
                })
            ).rejects.toThrow(/Duration exceeds maximum/);
        });

        it('should enforce budget limits strictly', async () => {
            const agentId = createTestAgentId('budgettest');
            setupAgent(agentId, 1); // T1 = 5 actions

            // Use up budget
            for (let i = 0; i < 5; i++) {
                await autonomyBudget.recordAction({
                    agentId,
                    actionType: 'action',
                });
            }

            // Next action should fail
            await expect(
                autonomyBudget.recordAction({
                    agentId,
                    actionType: 'over_limit',
                })
            ).rejects.toThrow(/Daily action limit reached/);
        });
    });
});
