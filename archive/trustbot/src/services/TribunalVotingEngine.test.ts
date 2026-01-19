/**
 * Tribunal Voting Engine Tests
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.3: Bot Tribunal Voting Engine
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    TribunalVotingEngine,
    getTribunalVotingEngine,
    resetTribunalVotingEngine,
    type ValidatorInfo,
    type TribunalVote,
    type TribunalSession,
} from './TribunalVotingEngine.js';
import type { ActionRequest, GateResult } from './TrustGateEngine.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createRequest(overrides: Partial<ActionRequest> = {}): ActionRequest {
    return {
        id: `req_${Date.now()}`,
        agentId: 'agent_1',
        orgId: 'org_1',
        actionType: 'high_risk_action',
        category: 'delegate',
        description: 'High risk action requiring tribunal',
        urgency: 'normal',
        requestedAt: new Date(),
        ...overrides,
    };
}

function createGateResult(overrides: Partial<GateResult> = {}): GateResult {
    return {
        requestId: 'req_123',
        decision: 'tribunal_review',
        riskLevel: 'high',
        reasons: ['Requires tribunal review'],
        evaluatedAt: new Date(),
        rules: [],
        ...overrides,
    };
}

function createValidator(id: string, trustScore = 800): ValidatorInfo {
    return {
        agentId: id,
        name: `Validator ${id}`,
        tier: 'TRUSTED',
        trustScore,
        specialization: 'security',
    };
}

function setupValidators(engine: TribunalVotingEngine, count: number): ValidatorInfo[] {
    const validators: ValidatorInfo[] = [];
    for (let i = 0; i < count; i++) {
        const v = createValidator(`validator_${i}`, 800 + i * 50);
        engine.registerValidator(v);
        validators.push(v);
    }
    return validators;
}

// ============================================================================
// Tests
// ============================================================================

describe('TribunalVotingEngine', () => {
    let engine: TribunalVotingEngine;

    beforeEach(() => {
        vi.useFakeTimers();
        resetTribunalVotingEngine();
        engine = new TribunalVotingEngine();
    });

    afterEach(() => {
        vi.useRealTimers();
        engine.clear();
    });

    // =========================================================================
    // Session Creation
    // =========================================================================

    describe('createSession', () => {
        it('should create a session with selected validators', () => {
            setupValidators(engine, 5);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });

            const session = engine.createSession(request, gateResult);

            expect(session.id).toBeDefined();
            expect(session.requestId).toBe(request.id);
            expect(session.status).toBe('pending');
            expect(session.validators.length).toBeGreaterThanOrEqual(3);
            expect(session.votes).toHaveLength(0);
        });

        it('should return existing session for same request', () => {
            setupValidators(engine, 5);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });

            const session1 = engine.createSession(request, gateResult);
            const session2 = engine.createSession(request, gateResult);

            expect(session1.id).toBe(session2.id);
        });

        it('should mark session as no_quorum when insufficient validators', () => {
            // Only 2 validators, need minimum 3
            setupValidators(engine, 2);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });

            const session = engine.createSession(request, gateResult);

            expect(session.status).toBe('decided');
            expect(session.consensus).toBe('no_quorum');
            expect(session.recommendation?.decision).toBe('escalate');
            expect(session.recommendation?.requiresHitl).toBe(true);
        });

        it('should select validators based on trust score', () => {
            // Add validators with varying trust scores
            engine.registerValidator(createValidator('low', 500));
            engine.registerValidator(createValidator('med1', 700));
            engine.registerValidator(createValidator('med2', 750));
            engine.registerValidator(createValidator('high1', 900));
            engine.registerValidator(createValidator('high2', 950));

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });

            const session = engine.createSession(request, gateResult);

            // Should select highest trust score validators
            const scores = session.validators.map(v => v.trustScore);
            expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
            expect(scores[1]).toBeGreaterThanOrEqual(scores[2]);
        });

        it('should emit session:created event', () => {
            setupValidators(engine, 5);
            const createdHandler = vi.fn();
            engine.on('session:created', createdHandler);

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            engine.createSession(request, gateResult);

            expect(createdHandler).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // Voting
    // =========================================================================

    describe('submitVote', () => {
        it('should accept valid vote from assigned validator', () => {
            const validators = setupValidators(engine, 5);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            const result = engine.submitVote(
                session.id,
                validators[0].agentId,
                'approve',
                'Looks safe',
                0.9
            );

            expect(result).toBe(true);
            expect(session.votes).toHaveLength(1);
            expect(session.status).toBe('voting');
        });

        it('should reject vote from non-assigned validator', () => {
            setupValidators(engine, 5);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            const result = engine.submitVote(
                session.id,
                'unknown_validator',
                'approve',
                'Looks safe',
                0.9
            );

            expect(result).toBe(false);
            expect(session.votes).toHaveLength(0);
        });

        it('should reject duplicate vote from same validator', () => {
            const validators = setupValidators(engine, 5);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            engine.submitVote(session.id, validators[0].agentId, 'approve', 'First vote', 0.9);
            const result = engine.submitVote(session.id, validators[0].agentId, 'deny', 'Second vote', 0.8);

            expect(result).toBe(false);
            expect(session.votes).toHaveLength(1);
        });

        it('should finalize session when all votes are in', () => {
            const validators = setupValidators(engine, 3);
            engine.updateConfig({ minValidators: 3, maxValidators: 3 });

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            // Submit all votes
            for (const v of session.validators) {
                engine.submitVote(session.id, v.agentId, 'approve', 'Safe', 0.9);
            }

            expect(session.status).toBe('decided');
            expect(session.consensus).toBe('unanimous_approve');
            expect(session.recommendation).toBeDefined();
        });

        it('should emit vote:received event', () => {
            const validators = setupValidators(engine, 5);
            const voteHandler = vi.fn();
            engine.on('vote:received', voteHandler);

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            engine.submitVote(session.id, validators[0].agentId, 'approve', 'Safe', 0.9);

            expect(voteHandler).toHaveBeenCalled();
        });

        it('should clamp confidence to 0-1 range', () => {
            const validators = setupValidators(engine, 5);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            engine.submitVote(session.id, validators[0].agentId, 'approve', 'Safe', 1.5);

            expect(session.votes[0].confidence).toBe(1);
        });
    });

    // =========================================================================
    // Consensus Calculation
    // =========================================================================

    describe('calculateConsensus', () => {
        it('should return unanimous_approve when all approve', () => {
            const votes: TribunalVote[] = [
                { validatorId: 'v1', validatorName: 'V1', decision: 'approve', reasoning: '', confidence: 0.9, votedAt: new Date() },
                { validatorId: 'v2', validatorName: 'V2', decision: 'approve', reasoning: '', confidence: 0.8, votedAt: new Date() },
                { validatorId: 'v3', validatorName: 'V3', decision: 'approve', reasoning: '', confidence: 0.95, votedAt: new Date() },
            ];

            const consensus = engine.calculateConsensus(votes);

            expect(consensus).toBe('unanimous_approve');
        });

        it('should return unanimous_deny when all deny', () => {
            const votes: TribunalVote[] = [
                { validatorId: 'v1', validatorName: 'V1', decision: 'deny', reasoning: '', confidence: 0.9, votedAt: new Date() },
                { validatorId: 'v2', validatorName: 'V2', decision: 'deny', reasoning: '', confidence: 0.8, votedAt: new Date() },
                { validatorId: 'v3', validatorName: 'V3', decision: 'deny', reasoning: '', confidence: 0.95, votedAt: new Date() },
            ];

            const consensus = engine.calculateConsensus(votes);

            expect(consensus).toBe('unanimous_deny');
        });

        it('should return majority_approve when more approve', () => {
            const votes: TribunalVote[] = [
                { validatorId: 'v1', validatorName: 'V1', decision: 'approve', reasoning: '', confidence: 0.9, votedAt: new Date() },
                { validatorId: 'v2', validatorName: 'V2', decision: 'approve', reasoning: '', confidence: 0.8, votedAt: new Date() },
                { validatorId: 'v3', validatorName: 'V3', decision: 'deny', reasoning: '', confidence: 0.95, votedAt: new Date() },
            ];

            const consensus = engine.calculateConsensus(votes);

            expect(consensus).toBe('majority_approve');
        });

        it('should return majority_deny when more deny', () => {
            const votes: TribunalVote[] = [
                { validatorId: 'v1', validatorName: 'V1', decision: 'deny', reasoning: '', confidence: 0.9, votedAt: new Date() },
                { validatorId: 'v2', validatorName: 'V2', decision: 'deny', reasoning: '', confidence: 0.8, votedAt: new Date() },
                { validatorId: 'v3', validatorName: 'V3', decision: 'approve', reasoning: '', confidence: 0.95, votedAt: new Date() },
            ];

            const consensus = engine.calculateConsensus(votes);

            expect(consensus).toBe('majority_deny');
        });

        it('should return split when equal votes', () => {
            const votes: TribunalVote[] = [
                { validatorId: 'v1', validatorName: 'V1', decision: 'approve', reasoning: '', confidence: 0.9, votedAt: new Date() },
                { validatorId: 'v2', validatorName: 'V2', decision: 'deny', reasoning: '', confidence: 0.9, votedAt: new Date() },
            ];

            const consensus = engine.calculateConsensus(votes);

            expect(consensus).toBe('split');
        });

        it('should ignore abstain votes', () => {
            const votes: TribunalVote[] = [
                { validatorId: 'v1', validatorName: 'V1', decision: 'approve', reasoning: '', confidence: 0.9, votedAt: new Date() },
                { validatorId: 'v2', validatorName: 'V2', decision: 'approve', reasoning: '', confidence: 0.8, votedAt: new Date() },
                { validatorId: 'v3', validatorName: 'V3', decision: 'abstain', reasoning: '', confidence: 0, votedAt: new Date() },
            ];

            const consensus = engine.calculateConsensus(votes);

            expect(consensus).toBe('unanimous_approve');
        });

        it('should return no_quorum when all abstain', () => {
            const votes: TribunalVote[] = [
                { validatorId: 'v1', validatorName: 'V1', decision: 'abstain', reasoning: '', confidence: 0, votedAt: new Date() },
                { validatorId: 'v2', validatorName: 'V2', decision: 'abstain', reasoning: '', confidence: 0, votedAt: new Date() },
            ];

            const consensus = engine.calculateConsensus(votes);

            expect(consensus).toBe('no_quorum');
        });
    });

    // =========================================================================
    // Weighted Consensus
    // =========================================================================

    describe('calculateWeightedConsensus', () => {
        it('should weight votes by trust score', () => {
            const validators: ValidatorInfo[] = [
                createValidator('v1', 900), // Higher weight
                createValidator('v2', 500), // Lower weight
                createValidator('v3', 500), // Lower weight
            ];

            const votes: TribunalVote[] = [
                { validatorId: 'v1', validatorName: 'V1', decision: 'approve', reasoning: '', confidence: 1, votedAt: new Date() },
                { validatorId: 'v2', validatorName: 'V2', decision: 'deny', reasoning: '', confidence: 1, votedAt: new Date() },
                { validatorId: 'v3', validatorName: 'V3', decision: 'deny', reasoning: '', confidence: 1, votedAt: new Date() },
            ];

            const result = engine.calculateWeightedConsensus(votes, validators);

            // High-trust validator's approve should have significant weight
            expect(result.approveWeight).toBeGreaterThan(0);
            expect(result.denyWeight).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // Recommendation Generation
    // =========================================================================

    describe('generateRecommendation', () => {
        it('should recommend approve for unanimous approval', () => {
            const validators = setupValidators(engine, 3);
            engine.updateConfig({ minValidators: 3, maxValidators: 3 });

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            for (const v of session.validators) {
                engine.submitVote(session.id, v.agentId, 'approve', 'Safe', 0.9);
            }

            expect(session.recommendation?.decision).toBe('approve');
            expect(session.recommendation?.requiresHitl).toBe(false);
        });

        it('should recommend deny for unanimous denial', () => {
            const validators = setupValidators(engine, 3);
            engine.updateConfig({ minValidators: 3, maxValidators: 3 });

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            for (const v of session.validators) {
                engine.submitVote(session.id, v.agentId, 'deny', 'Risky', 0.9);
            }

            expect(session.recommendation?.decision).toBe('deny');
        });

        it('should escalate for split decision', () => {
            engine.registerValidator(createValidator('v1', 800));
            engine.registerValidator(createValidator('v2', 800));
            engine.updateConfig({ minValidators: 2, maxValidators: 2 });

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            engine.submitVote(session.id, 'v1', 'approve', 'Safe', 0.9);
            engine.submitVote(session.id, 'v2', 'deny', 'Risky', 0.9);

            expect(session.recommendation?.decision).toBe('escalate');
            expect(session.recommendation?.requiresHitl).toBe(true);
        });

        it('should escalate critical actions without unanimous approval', () => {
            const validators = setupValidators(engine, 3);
            engine.updateConfig({ minValidators: 3, maxValidators: 3, requireUnanimousForCritical: true });

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'critical' });
            const session = engine.createSession(request, gateResult);

            // 2 approve, 1 deny = majority approve but not unanimous
            engine.submitVote(session.id, session.validators[0].agentId, 'approve', 'Safe', 0.9);
            engine.submitVote(session.id, session.validators[1].agentId, 'approve', 'Safe', 0.9);
            engine.submitVote(session.id, session.validators[2].agentId, 'deny', 'Risk', 0.9);

            expect(session.recommendation?.decision).toBe('escalate');
            expect(session.recommendation?.requiresHitl).toBe(true);
        });

        it('should escalate when confidence is too low', () => {
            const validators = setupValidators(engine, 3);
            engine.updateConfig({ minValidators: 3, maxValidators: 3, minConfidence: 0.7 });

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'high' });
            const session = engine.createSession(request, gateResult);

            // Majority approve but with low confidence
            engine.submitVote(session.id, session.validators[0].agentId, 'approve', 'Maybe', 0.5);
            engine.submitVote(session.id, session.validators[1].agentId, 'approve', 'Maybe', 0.5);
            engine.submitVote(session.id, session.validators[2].agentId, 'deny', 'Risk', 0.5);

            expect(session.recommendation?.decision).toBe('escalate');
            expect(session.recommendation?.requiresHitl).toBe(true);
        });
    });

    // =========================================================================
    // Session Timeout
    // =========================================================================

    describe('session timeout', () => {
        it('should expire session after timeout', () => {
            setupValidators(engine, 5);
            engine.updateConfig({ votingTimeoutMs: 1000 });

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            // Fast-forward time
            vi.advanceTimersByTime(1500);

            expect(session.status).toBe('expired');
            expect(session.recommendation?.decision).toBe('escalate');
        });

        it('should use partial votes on expiration', () => {
            const validators = setupValidators(engine, 5);
            engine.updateConfig({ votingTimeoutMs: 1000 });

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            // Submit some votes but not all
            engine.submitVote(session.id, validators[0].agentId, 'approve', 'Safe', 0.9);
            engine.submitVote(session.id, validators[1].agentId, 'approve', 'Safe', 0.8);

            // Fast-forward time
            vi.advanceTimersByTime(1500);

            expect(session.status).toBe('expired');
            expect(session.votes.length).toBe(2);
            expect(session.recommendation?.requiresHitl).toBe(true);
        });

        it('should emit session:expired event', () => {
            setupValidators(engine, 5);
            engine.updateConfig({ votingTimeoutMs: 1000 });

            const expiredHandler = vi.fn();
            engine.on('session:expired', expiredHandler);

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            engine.createSession(request, gateResult);

            vi.advanceTimersByTime(1500);

            expect(expiredHandler).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // Session Management
    // =========================================================================

    describe('getSession', () => {
        it('should return session by ID', () => {
            setupValidators(engine, 5);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            const retrieved = engine.getSession(session.id);

            expect(retrieved?.id).toBe(session.id);
        });

        it('should return null for unknown ID', () => {
            const result = engine.getSession('unknown');
            expect(result).toBeNull();
        });
    });

    describe('getSessionByRequestId', () => {
        it('should return session by request ID', () => {
            setupValidators(engine, 5);
            const request = createRequest({ id: 'unique_request' });
            const gateResult = createGateResult({ requestId: request.id });
            engine.createSession(request, gateResult);

            const retrieved = engine.getSessionByRequestId('unique_request');

            expect(retrieved?.requestId).toBe('unique_request');
        });
    });

    describe('getPendingSessions', () => {
        it('should return only pending and voting sessions', () => {
            const validators = setupValidators(engine, 3);
            engine.updateConfig({ minValidators: 3, maxValidators: 3 });

            // Create pending session
            const request1 = createRequest({ id: 'req_1' });
            const gateResult1 = createGateResult({ requestId: request1.id });
            engine.createSession(request1, gateResult1);

            // Create decided session
            const request2 = createRequest({ id: 'req_2' });
            const gateResult2 = createGateResult({ requestId: request2.id });
            const session2 = engine.createSession(request2, gateResult2);
            for (const v of session2.validators) {
                engine.submitVote(session2.id, v.agentId, 'approve', 'Safe', 0.9);
            }

            const pending = engine.getPendingSessions();

            expect(pending.length).toBe(1);
            expect(pending[0].requestId).toBe('req_1');
        });
    });

    describe('cancelSession', () => {
        it('should cancel pending session', () => {
            setupValidators(engine, 5);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            const result = engine.cancelSession(session.id, 'Manual cancellation');

            expect(result).toBe(true);
            expect(session.status).toBe('cancelled');
            expect(session.recommendation?.decision).toBe('escalate');
        });

        it('should not cancel already decided session', () => {
            const validators = setupValidators(engine, 3);
            engine.updateConfig({ minValidators: 3, maxValidators: 3 });

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            // Complete the session
            for (const v of session.validators) {
                engine.submitVote(session.id, v.agentId, 'approve', 'Safe', 0.9);
            }

            const result = engine.cancelSession(session.id);

            expect(result).toBe(false);
            expect(session.status).toBe('decided');
        });
    });

    // =========================================================================
    // Validator Management
    // =========================================================================

    describe('registerValidator', () => {
        it('should register validator', () => {
            const validator = createValidator('v1');
            engine.registerValidator(validator);

            expect(engine.validatorCount).toBe(1);
            expect(engine.getValidators()[0].agentId).toBe('v1');
        });
    });

    describe('unregisterValidator', () => {
        it('should unregister validator', () => {
            const validator = createValidator('v1');
            engine.registerValidator(validator);
            engine.unregisterValidator('v1');

            expect(engine.validatorCount).toBe(0);
        });
    });

    describe('selectValidators', () => {
        it('should select validators by minimum trust score', () => {
            engine.registerValidator(createValidator('low', 400));
            engine.registerValidator(createValidator('high1', 800));
            engine.registerValidator(createValidator('high2', 850));
            engine.registerValidator(createValidator('high3', 900));

            const selected = engine.selectValidators({ minTrustScore: 700 });

            expect(selected.every(v => v.trustScore >= 700)).toBe(true);
        });

        it('should exclude specified agents', () => {
            setupValidators(engine, 5);

            const selected = engine.selectValidators({
                excludeAgents: ['validator_0', 'validator_1'],
            });

            expect(selected.some(v => v.agentId === 'validator_0')).toBe(false);
            expect(selected.some(v => v.agentId === 'validator_1')).toBe(false);
        });
    });

    // =========================================================================
    // Configuration
    // =========================================================================

    describe('configuration', () => {
        it('should update config', () => {
            engine.updateConfig({ votingTimeoutMs: 10000 });

            const config = engine.getConfig();

            expect(config.votingTimeoutMs).toBe(10000);
        });
    });

    // =========================================================================
    // Statistics
    // =========================================================================

    describe('getStats', () => {
        it('should return correct statistics', () => {
            const validators = setupValidators(engine, 3);
            engine.updateConfig({ minValidators: 3, maxValidators: 3 });

            // Create and complete a session
            const request1 = createRequest({ id: 'req_1' });
            const gateResult1 = createGateResult({ requestId: request1.id });
            const session1 = engine.createSession(request1, gateResult1);
            for (const v of session1.validators) {
                engine.submitVote(session1.id, v.agentId, 'approve', 'Safe', 0.9);
            }

            // Create pending session
            const request2 = createRequest({ id: 'req_2' });
            const gateResult2 = createGateResult({ requestId: request2.id });
            engine.createSession(request2, gateResult2);

            const stats = engine.getStats();

            expect(stats.totalSessions).toBe(2);
            expect(stats.decidedSessions).toBe(1);
            expect(stats.pendingSessions).toBe(1);
            expect(stats.consensusBreakdown.unanimous_approve).toBe(1);
        });
    });

    // =========================================================================
    // Lifecycle
    // =========================================================================

    describe('clear', () => {
        it('should clear all state', () => {
            setupValidators(engine, 5);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            engine.createSession(request, gateResult);

            engine.clear();

            expect(engine.sessionCount).toBe(0);
            expect(engine.validatorCount).toBe(0);
        });
    });

    // =========================================================================
    // Singleton
    // =========================================================================

    describe('singleton', () => {
        it('should return same instance', () => {
            resetTribunalVotingEngine();
            const instance1 = getTribunalVotingEngine();
            const instance2 = getTribunalVotingEngine();

            expect(instance1).toBe(instance2);
        });

        it('should reset properly', () => {
            const instance1 = getTribunalVotingEngine();
            setupValidators(instance1, 3);

            resetTribunalVotingEngine();
            const instance2 = getTribunalVotingEngine();

            expect(instance2.validatorCount).toBe(0);
        });
    });

    // =========================================================================
    // Events
    // =========================================================================

    describe('events', () => {
        it('should emit consensus:reached when all votes in', () => {
            const validators = setupValidators(engine, 3);
            engine.updateConfig({ minValidators: 3, maxValidators: 3 });

            const consensusHandler = vi.fn();
            engine.on('consensus:reached', consensusHandler);

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            for (const v of session.validators) {
                engine.submitVote(session.id, v.agentId, 'approve', 'Safe', 0.9);
            }

            expect(consensusHandler).toHaveBeenCalled();
        });

        it('should emit session:decided when finalized', () => {
            const validators = setupValidators(engine, 3);
            engine.updateConfig({ minValidators: 3, maxValidators: 3 });

            const decidedHandler = vi.fn();
            engine.on('session:decided', decidedHandler);

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const session = engine.createSession(request, gateResult);

            for (const v of session.validators) {
                engine.submitVote(session.id, v.agentId, 'approve', 'Safe', 0.9);
            }

            expect(decidedHandler).toHaveBeenCalled();
        });
    });
});
