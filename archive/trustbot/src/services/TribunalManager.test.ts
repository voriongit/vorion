/**
 * TribunalManager Unit Tests
 *
 * Tests the tribunal orchestration service that bridges
 * TrustGateEngine escalations to TribunalVotingEngine sessions.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
    TribunalManager,
    getTribunalManager,
    resetTribunalManager,
    type TribunalManagerConfig,
} from './TribunalManager.js';
import { Blackboard } from '../core/Blackboard.js';
import {
    TrustGateEngine,
    resetTrustGateEngine,
    type ActionRequest,
    type GateResult,
} from './TrustGateEngine.js';
import {
    TribunalVotingEngine,
    resetTribunalVotingEngine,
    type TribunalSession,
    type ValidatorInfo,
} from './TribunalVotingEngine.js';

describe('TribunalManager', () => {
    let manager: TribunalManager;
    let blackboard: Blackboard;
    let gateEngine: TrustGateEngine;
    let votingEngine: TribunalVotingEngine;

    beforeEach(() => {
        resetTribunalManager();
        resetTrustGateEngine();
        resetTribunalVotingEngine();

        blackboard = new Blackboard();
        gateEngine = new TrustGateEngine();
        votingEngine = new TribunalVotingEngine();

        manager = new TribunalManager(blackboard, {}, gateEngine, votingEngine);
    });

    afterEach(() => {
        manager.clear();
    });

    // =========================================================================
    // Helper Functions
    // =========================================================================

    function createActionRequest(overrides: Partial<ActionRequest> = {}): ActionRequest {
        return {
            id: `req-${Date.now()}`,
            agentId: 'agent-001',
            orgId: 'org-001',
            actionType: 'deploy_code',
            category: 'execute',
            description: 'Deploy new feature to production',
            requestedAt: new Date(),
            ...overrides,
        };
    }

    function createGateResult(overrides: Partial<GateResult> = {}): GateResult {
        return {
            requestId: 'req-001',
            decision: 'tribunal_review',
            riskLevel: 'medium',
            reasons: ['Action requires peer review'],
            evaluatedAt: new Date(),
            rules: [],
            ...overrides,
        };
    }

    function createValidator(overrides: Partial<ValidatorInfo> = {}): ValidatorInfo {
        return {
            agentId: `validator-${Date.now()}`,
            name: 'Test Validator',
            tier: 'T3',
            trustScore: 700,
            ...overrides,
        };
    }

    function registerValidators(count: number): ValidatorInfo[] {
        const validators: ValidatorInfo[] = [];
        for (let i = 0; i < count; i++) {
            const validator = createValidator({
                agentId: `validator-${i}`,
                name: `Validator ${i}`,
                trustScore: 700 + i * 50,
            });
            manager.registerValidator(validator);
            validators.push(validator);
        }
        return validators;
    }

    // =========================================================================
    // Initialization Tests
    // =========================================================================

    describe('initialization', () => {
        it('creates manager instance', () => {
            expect(manager).toBeInstanceOf(TribunalManager);
        });

        it('returns singleton via getter', () => {
            const manager1 = getTribunalManager(blackboard);
            const manager2 = getTribunalManager();
            expect(manager1).toBe(manager2);
        });

        it('resets singleton correctly', () => {
            const manager1 = getTribunalManager(blackboard);
            resetTribunalManager();
            const manager2 = getTribunalManager(blackboard);
            expect(manager1).not.toBe(manager2);
        });

        it('throws if blackboard not provided for initial creation', () => {
            resetTribunalManager();
            expect(() => getTribunalManager()).toThrow('Blackboard required');
        });

        it('starts with no sessions', () => {
            const stats = manager.getStats();
            expect(stats.totalSessions).toBe(0);
            expect(stats.activeSessions).toBe(0);
        });
    });

    // =========================================================================
    // Validator Management Tests
    // =========================================================================

    describe('validator management', () => {
        it('registers a validator', () => {
            const registeredSpy = vi.fn();
            manager.on('validator:registered', registeredSpy);

            const validator = createValidator();
            manager.registerValidator(validator);

            expect(registeredSpy).toHaveBeenCalledWith(validator);
            expect(manager.getValidators()).toContainEqual(validator);
        });

        it('unregisters a validator', () => {
            const unregisteredSpy = vi.fn();
            manager.on('validator:unregistered', unregisteredSpy);

            const validator = createValidator({ agentId: 'val-to-remove' });
            manager.registerValidator(validator);
            manager.unregisterValidator('val-to-remove');

            expect(unregisteredSpy).toHaveBeenCalledWith('val-to-remove');
            expect(manager.getValidators().find(v => v.agentId === 'val-to-remove')).toBeUndefined();
        });

        it('auto-registers qualified agents', () => {
            const agents = [
                { agentId: 'agent-1', name: 'Low Trust', tier: 2, trustScore: 400, capabilities: ['execute'] },
                { agentId: 'agent-2', name: 'High Trust Reviewer', tier: 4, trustScore: 800, capabilities: ['review', 'audit'] },
                { agentId: 'agent-3', name: 'Security Specialist', tier: 3, trustScore: 700, capabilities: ['execute'], specialization: 'security' },
                { agentId: 'agent-4', name: 'Low Tier', tier: 2, trustScore: 800, capabilities: ['review'] },
            ];

            const registered = manager.autoRegisterValidators(agents);

            // agent-2 and agent-3 should qualify
            expect(registered).toBe(2);
            const validators = manager.getValidators();
            expect(validators.find(v => v.agentId === 'agent-2')).toBeDefined();
            expect(validators.find(v => v.agentId === 'agent-3')).toBeDefined();
        });
    });

    // =========================================================================
    // Tribunal Session Tests
    // =========================================================================

    describe('tribunal sessions', () => {
        beforeEach(() => {
            registerValidators(3);
        });

        it('starts tribunal and posts to blackboard', () => {
            const startedSpy = vi.fn();
            manager.on('tribunal:started', startedSpy);

            const request = createActionRequest();
            const gateResult = createGateResult({ requestId: request.id });

            const session = manager.startTribunal(request, gateResult);

            expect(session).toBeDefined();
            expect(session.status).toBe('pending');
            expect(startedSpy).toHaveBeenCalled();

            // Check Blackboard entry was created
            const entries = blackboard.getByType('VOTING_SESSION');
            expect(entries.length).toBe(1);
            expect(entries[0].title).toContain('Tribunal');
        });

        it('tracks managed session', () => {
            const request = createActionRequest();
            const gateResult = createGateResult({ requestId: request.id });

            const session = manager.startTribunal(request, gateResult);
            const managed = manager.getSession(session.id);

            expect(managed).not.toBeNull();
            expect(managed?.request).toBe(request);
            expect(managed?.gateResult).toBe(gateResult);
            expect(managed?.startedAt).toBeInstanceOf(Date);
        });

        it('returns session in active sessions list', () => {
            const request = createActionRequest();
            const gateResult = createGateResult({ requestId: request.id });

            manager.startTribunal(request, gateResult);

            const active = manager.getActiveSessions();
            expect(active.length).toBe(1);
        });

        it('emits vote_received on votes', () => {
            const voteSpy = vi.fn();
            manager.on('tribunal:vote_received', voteSpy);

            const request = createActionRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = manager.startTribunal(request, gateResult);

            // Submit a vote
            const validators = manager.getValidators();
            votingEngine.submitVote(
                session.id,
                validators[0].agentId,
                'approve',
                'Looks safe',
                0.9
            );

            expect(voteSpy).toHaveBeenCalled();
        });

        it('handles unanimous approval', async () => {
            const completedSpy = vi.fn();
            manager.on('tribunal:completed', completedSpy);

            const request = createActionRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = manager.startTribunal(request, gateResult);

            // All validators approve
            const validators = manager.getValidators();
            for (const validator of validators) {
                votingEngine.submitVote(
                    session.id,
                    validator.agentId,
                    'approve',
                    'Approved',
                    0.9
                );
            }

            expect(completedSpy).toHaveBeenCalled();
            const [finalSession, recommendation] = completedSpy.mock.calls[0];
            expect(recommendation.decision).toBe('approve');
            expect(recommendation.consensus).toBe('unanimous_approve');
        });

        it('escalates split votes to HITL', () => {
            const escalatedSpy = vi.fn();
            manager.on('tribunal:escalated_to_hitl', escalatedSpy);

            // Register validators with equal trust scores for true split
            manager.clear();
            votingEngine.clear();
            for (let i = 0; i < 4; i++) {
                votingEngine.registerValidator(createValidator({
                    agentId: `equal-val-${i}`,
                    name: `Equal Validator ${i}`,
                    trustScore: 700, // All same trust score
                }));
            }

            const request = createActionRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = manager.startTribunal(request, gateResult);

            // Equal split: 2 approve, 2 deny with same trust/confidence
            const validators = votingEngine.getValidators();
            votingEngine.submitVote(session.id, validators[0].agentId, 'approve', 'Yes', 0.8);
            votingEngine.submitVote(session.id, validators[1].agentId, 'approve', 'Yes', 0.8);
            votingEngine.submitVote(session.id, validators[2].agentId, 'deny', 'No', 0.8);
            votingEngine.submitVote(session.id, validators[3].agentId, 'deny', 'No', 0.8);

            expect(escalatedSpy).toHaveBeenCalled();
        });

        it('updates blackboard entry with decision', () => {
            const request = createActionRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = manager.startTribunal(request, gateResult);

            // Complete voting
            const validators = manager.getValidators();
            for (const validator of validators) {
                votingEngine.submitVote(session.id, validator.agentId, 'approve', 'OK', 0.9);
            }

            // Check Blackboard was updated
            const entries = blackboard.getByType('VOTING_SESSION');
            expect(entries[0].status).toBe('RESOLVED');
            const content = entries[0].content as Record<string, unknown>;
            expect(content.decision).toBe('approve');
        });
    });

    // =========================================================================
    // Gate Integration Tests
    // =========================================================================

    describe('gate integration', () => {
        beforeEach(() => {
            registerValidators(3);
        });

        it('evaluates request through gate and starts tribunal if escalated', async () => {
            const startedSpy = vi.fn();
            manager.on('tribunal:started', startedSpy);

            // Use delegate category (high risk) with proper capabilities
            const request = createActionRequest({ category: 'delegate' });
            const agentContext = {
                trustScore: 500,
                tier: 'T3',
                capabilities: ['execute', 'delegate'],
                recentFailures: 0,
                recentSuccesses: 5,
                actionHistory: new Map(),
            };

            const result = await manager.evaluateAndTribunal(request, agentContext);

            // High-risk delegate category with medium trust should trigger review
            expect(['tribunal_review', 'escalate', 'hitl_required']).toContain(result.gateResult.decision);
        });

        it('auto-starts tribunal on gate:escalated event', () => {
            const startedSpy = vi.fn();
            manager.on('tribunal:started', startedSpy);

            const request = createActionRequest();
            manager.registerRequest(request);

            // Manually trigger gate:escalated
            const gateResult = createGateResult({
                requestId: request.id,
                decision: 'escalate',
            });

            // Store the request with gate result
            (manager as any).pendingRequests.set(request.id, { request, gateResult });

            // Simulate gate escalation
            gateEngine.emit('gate:escalated', gateResult);

            expect(startedSpy).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // Query Methods Tests
    // =========================================================================

    describe('query methods', () => {
        beforeEach(() => {
            registerValidators(3);
        });

        it('returns session by blackboard entry ID', () => {
            const request = createActionRequest();
            const gateResult = createGateResult({ requestId: request.id });

            const session = manager.startTribunal(request, gateResult);
            const managed = manager.getSession(session.id);

            if (managed?.blackboardEntryId) {
                const retrieved = manager.getSessionByBlackboardEntry(managed.blackboardEntryId);
                expect(retrieved).toBe(managed);
            }
        });

        it('returns null for unknown session', () => {
            expect(manager.getSession('unknown-id')).toBeNull();
        });

        it('tracks completed sessions', () => {
            const request = createActionRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = manager.startTribunal(request, gateResult);

            // Complete voting
            const validators = manager.getValidators();
            for (const validator of validators) {
                votingEngine.submitVote(session.id, validator.agentId, 'approve', 'OK', 0.9);
            }

            const completed = manager.getCompletedSessions();
            expect(completed.length).toBe(1);
            expect(completed[0].completedAt).toBeInstanceOf(Date);
        });

        it('returns comprehensive stats', () => {
            const request = createActionRequest();
            const gateResult = createGateResult({ requestId: request.id });
            manager.startTribunal(request, gateResult);

            const stats = manager.getStats();

            expect(stats.totalSessions).toBe(1);
            expect(stats.activeSessions).toBe(1);
            expect(stats.completedSessions).toBe(0);
            expect(stats.validatorCount).toBe(3);
            expect(stats.tribunalStats).toBeDefined();
        });
    });

    // =========================================================================
    // No Quorum Tests
    // =========================================================================

    describe('no quorum handling', () => {
        it('handles no validators scenario', () => {
            // Don't register any validators
            const request = createActionRequest();
            const gateResult = createGateResult({ requestId: request.id });

            const session = manager.startTribunal(request, gateResult);

            // Should immediately decide with no_quorum
            expect(session.status).toBe('decided');
            expect(session.consensus).toBe('no_quorum');
            expect(session.recommendation?.requiresHitl).toBe(true);
        });
    });

    // =========================================================================
    // Lifecycle Tests
    // =========================================================================

    describe('lifecycle', () => {
        it('clears all state', () => {
            registerValidators(3);

            const request = createActionRequest();
            const gateResult = createGateResult({ requestId: request.id });
            manager.startTribunal(request, gateResult);

            manager.clear();

            expect(manager.getStats().totalSessions).toBe(0);
        });
    });

    // =========================================================================
    // Configuration Tests
    // =========================================================================

    describe('configuration', () => {
        it('respects postToBlackboard config', () => {
            const noPostManager = new TribunalManager(
                blackboard,
                { postToBlackboard: false },
                gateEngine,
                votingEngine
            );

            // Register validators on the new manager's voting engine
            for (let i = 0; i < 3; i++) {
                votingEngine.registerValidator(createValidator({ agentId: `val-${i}` }));
            }

            const request = createActionRequest();
            const gateResult = createGateResult({ requestId: request.id });

            noPostManager.startTribunal(request, gateResult);

            // Should not post to Blackboard
            const entries = blackboard.getByType('VOTING_SESSION');
            expect(entries.length).toBe(0);

            noPostManager.clear();
        });
    });
});
