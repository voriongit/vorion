/**
 * Bot Tribunal Voting Engine
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.3: Bot Tribunal Voting Engine
 *
 * Manages multi-agent voting for high-risk decisions.
 * Provides consensus calculation and recommendation generation.
 */

import { EventEmitter } from 'eventemitter3';
import type { ActionRequest, GateResult } from './TrustGateEngine.js';

// ============================================================================
// Types
// ============================================================================

export type VoteDecision = 'approve' | 'deny' | 'abstain';
export type ConsensusType = 'unanimous_approve' | 'unanimous_deny' | 'majority_approve' | 'majority_deny' | 'split' | 'no_quorum';
export type TribunalStatus = 'pending' | 'voting' | 'decided' | 'expired' | 'cancelled';

export interface ValidatorInfo {
    agentId: string;
    name: string;
    tier: string;
    trustScore: number;
    specialization?: string;
}

export interface TribunalVote {
    validatorId: string;
    validatorName: string;
    decision: VoteDecision;
    reasoning: string;
    confidence: number; // 0-1
    riskAssessment?: string;
    votedAt: Date;
}

export interface TribunalSession {
    id: string;
    requestId: string;
    request: ActionRequest;
    gateResult: GateResult;
    validators: ValidatorInfo[];
    votes: TribunalVote[];
    status: TribunalStatus;
    consensus?: ConsensusType;
    recommendation?: TribunalRecommendation;
    createdAt: Date;
    decidedAt?: Date;
    expiresAt: Date;
    metadata?: Record<string, unknown>;
}

export interface TribunalRecommendation {
    decision: 'approve' | 'deny' | 'escalate';
    consensus: ConsensusType;
    confidence: number; // Aggregate confidence
    reasoning: string[];
    dissent?: string[];
    requiresHitl: boolean;
}

export interface TribunalConfig {
    /** Minimum validators required (default: 3) */
    minValidators: number;
    /** Maximum validators (default: 5) */
    maxValidators: number;
    /** Timeout in milliseconds (default: 5 minutes) */
    votingTimeoutMs: number;
    /** Require unanimous for high-risk (default: true) */
    requireUnanimousForCritical: boolean;
    /** Minimum confidence threshold (default: 0.6) */
    minConfidence: number;
    /** Weight by trust score (default: true) */
    weightByTrustScore: boolean;
}

export interface ValidatorSelectionCriteria {
    /** Minimum trust score for validators */
    minTrustScore: number;
    /** Required capabilities */
    requiredCapabilities?: string[];
    /** Preferred specializations */
    preferredSpecializations?: string[];
    /** Exclude validators */
    excludeAgents?: string[];
}

interface EngineEvents {
    'session:created': (session: TribunalSession) => void;
    'vote:received': (session: TribunalSession, vote: TribunalVote) => void;
    'session:decided': (session: TribunalSession) => void;
    'session:expired': (session: TribunalSession) => void;
    'consensus:reached': (session: TribunalSession) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: TribunalConfig = {
    minValidators: 3,
    maxValidators: 5,
    votingTimeoutMs: 5 * 60 * 1000, // 5 minutes
    requireUnanimousForCritical: true,
    minConfidence: 0.6,
    weightByTrustScore: true,
};

// ============================================================================
// Tribunal Voting Engine
// ============================================================================

export class TribunalVotingEngine extends EventEmitter<EngineEvents> {
    private config: TribunalConfig;
    private sessions: Map<string, TribunalSession> = new Map();
    private sessionsByRequest: Map<string, string> = new Map();

    // Available validators (can be set dynamically)
    private availableValidators: Map<string, ValidatorInfo> = new Map();

    // Timeout tracking
    private timeouts: Map<string, NodeJS.Timeout> = new Map();

    constructor(config: Partial<TribunalConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // =========================================================================
    // Session Management
    // =========================================================================

    /**
     * Create a new tribunal session for a request
     */
    createSession(
        request: ActionRequest,
        gateResult: GateResult,
        selectionCriteria?: ValidatorSelectionCriteria
    ): TribunalSession {
        // Check for existing session
        const existingId = this.sessionsByRequest.get(request.id);
        if (existingId) {
            const existing = this.sessions.get(existingId);
            if (existing && existing.status === 'pending' || existing?.status === 'voting') {
                return existing;
            }
        }

        // Select validators
        const validators = this.selectValidators(selectionCriteria);

        if (validators.length < this.config.minValidators) {
            // Create session but mark as no_quorum
            const session = this.buildSession(request, gateResult, validators);
            session.status = 'decided';
            session.consensus = 'no_quorum';
            session.decidedAt = new Date();
            session.recommendation = {
                decision: 'escalate',
                consensus: 'no_quorum',
                confidence: 0,
                reasoning: ['Insufficient validators available'],
                requiresHitl: true,
            };
            this.storeSession(session);
            this.emit('session:created', session);
            this.emit('session:decided', session);
            return session;
        }

        const session = this.buildSession(request, gateResult, validators);
        this.storeSession(session);

        // Set expiration timeout
        this.setSessionTimeout(session);

        this.emit('session:created', session);
        return session;
    }

    /**
     * Submit a vote for a session
     */
    submitVote(
        sessionId: string,
        validatorId: string,
        decision: VoteDecision,
        reasoning: string,
        confidence: number,
        riskAssessment?: string
    ): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        if (session.status !== 'pending' && session.status !== 'voting') {
            return false;
        }

        // Verify validator is assigned to this session
        const validator = session.validators.find(v => v.agentId === validatorId);
        if (!validator) return false;

        // Check for duplicate vote
        if (session.votes.some(v => v.validatorId === validatorId)) {
            return false;
        }

        const vote: TribunalVote = {
            validatorId,
            validatorName: validator.name,
            decision,
            reasoning,
            confidence: Math.max(0, Math.min(1, confidence)),
            riskAssessment,
            votedAt: new Date(),
        };

        session.votes.push(vote);
        session.status = 'voting';

        this.emit('vote:received', session, vote);

        // Check if all votes are in
        if (session.votes.length >= session.validators.length) {
            this.finalizeSession(session);
        }

        return true;
    }

    /**
     * Get a session by ID
     */
    getSession(sessionId: string): TribunalSession | null {
        return this.sessions.get(sessionId) || null;
    }

    /**
     * Get session by request ID
     */
    getSessionByRequestId(requestId: string): TribunalSession | null {
        const sessionId = this.sessionsByRequest.get(requestId);
        if (!sessionId) return null;
        return this.sessions.get(sessionId) || null;
    }

    /**
     * Get pending sessions
     */
    getPendingSessions(): TribunalSession[] {
        return Array.from(this.sessions.values())
            .filter(s => s.status === 'pending' || s.status === 'voting');
    }

    /**
     * Cancel a session
     */
    cancelSession(sessionId: string, reason?: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        if (session.status === 'decided' || session.status === 'expired' || session.status === 'cancelled') {
            return false;
        }

        session.status = 'cancelled';
        session.decidedAt = new Date();
        session.recommendation = {
            decision: 'escalate',
            consensus: 'no_quorum',
            confidence: 0,
            reasoning: [reason || 'Session cancelled'],
            requiresHitl: true,
        };

        this.clearSessionTimeout(sessionId);
        this.emit('session:decided', session);

        return true;
    }

    // =========================================================================
    // Validator Management
    // =========================================================================

    /**
     * Register a validator agent
     */
    registerValidator(validator: ValidatorInfo): void {
        this.availableValidators.set(validator.agentId, validator);
    }

    /**
     * Unregister a validator
     */
    unregisterValidator(agentId: string): void {
        this.availableValidators.delete(agentId);
    }

    /**
     * Get all registered validators
     */
    getValidators(): ValidatorInfo[] {
        return Array.from(this.availableValidators.values());
    }

    /**
     * Select validators based on criteria
     */
    selectValidators(criteria?: ValidatorSelectionCriteria): ValidatorInfo[] {
        let candidates = Array.from(this.availableValidators.values());

        if (criteria) {
            // Filter by minimum trust score
            if (criteria.minTrustScore) {
                candidates = candidates.filter(v => v.trustScore >= criteria.minTrustScore);
            }

            // Filter by excluded agents
            if (criteria.excludeAgents) {
                candidates = candidates.filter(v => !criteria.excludeAgents!.includes(v.agentId));
            }

            // Sort by preferred specializations
            if (criteria.preferredSpecializations && criteria.preferredSpecializations.length > 0) {
                candidates.sort((a, b) => {
                    const aMatch = a.specialization && criteria.preferredSpecializations!.includes(a.specialization) ? 1 : 0;
                    const bMatch = b.specialization && criteria.preferredSpecializations!.includes(b.specialization) ? 1 : 0;
                    return bMatch - aMatch;
                });
            }
        }

        // Sort by trust score descending
        candidates.sort((a, b) => b.trustScore - a.trustScore);

        // Take top validators up to maxValidators
        return candidates.slice(0, this.config.maxValidators);
    }

    // =========================================================================
    // Consensus Calculation
    // =========================================================================

    /**
     * Calculate consensus from votes
     */
    calculateConsensus(votes: TribunalVote[]): ConsensusType {
        const validVotes = votes.filter(v => v.decision !== 'abstain');

        if (validVotes.length === 0) {
            return 'no_quorum';
        }

        const approvals = validVotes.filter(v => v.decision === 'approve').length;
        const denials = validVotes.filter(v => v.decision === 'deny').length;

        // Unanimous decisions
        if (approvals === validVotes.length) return 'unanimous_approve';
        if (denials === validVotes.length) return 'unanimous_deny';

        // Majority decisions
        if (approvals > denials) return 'majority_approve';
        if (denials > approvals) return 'majority_deny';

        // Equal split
        return 'split';
    }

    /**
     * Calculate weighted consensus (by trust score)
     */
    calculateWeightedConsensus(
        votes: TribunalVote[],
        validators: ValidatorInfo[]
    ): { consensus: ConsensusType; approveWeight: number; denyWeight: number } {
        const validatorMap = new Map(validators.map(v => [v.agentId, v]));

        let approveWeight = 0;
        let denyWeight = 0;
        let totalWeight = 0;

        for (const vote of votes) {
            if (vote.decision === 'abstain') continue;

            const validator = validatorMap.get(vote.validatorId);
            const weight = validator ? validator.trustScore / 1000 : 1;
            totalWeight += weight;

            if (vote.decision === 'approve') {
                approveWeight += weight * vote.confidence;
            } else {
                denyWeight += weight * vote.confidence;
            }
        }

        // Normalize
        if (totalWeight > 0) {
            approveWeight /= totalWeight;
            denyWeight /= totalWeight;
        }

        // Determine consensus
        let consensus: ConsensusType;
        const allApprove = votes.every(v => v.decision === 'approve');
        const allDeny = votes.every(v => v.decision === 'deny');

        if (allApprove) consensus = 'unanimous_approve';
        else if (allDeny) consensus = 'unanimous_deny';
        else if (approveWeight > denyWeight) consensus = 'majority_approve';
        else if (denyWeight > approveWeight) consensus = 'majority_deny';
        else consensus = 'split';

        return { consensus, approveWeight, denyWeight };
    }

    /**
     * Generate recommendation from session
     */
    generateRecommendation(session: TribunalSession): TribunalRecommendation {
        const votes = session.votes;
        const validators = session.validators;

        // Calculate weighted consensus if enabled
        const { consensus, approveWeight, denyWeight } = this.config.weightByTrustScore
            ? this.calculateWeightedConsensus(votes, validators)
            : { consensus: this.calculateConsensus(votes), approveWeight: 0, denyWeight: 0 };

        // Aggregate confidence
        const confidences = votes.filter(v => v.decision !== 'abstain').map(v => v.confidence);
        const avgConfidence = confidences.length > 0
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length
            : 0;

        // Collect reasoning
        const approveReasons = votes.filter(v => v.decision === 'approve').map(v => v.reasoning);
        const denyReasons = votes.filter(v => v.decision === 'deny').map(v => v.reasoning);

        // Determine decision and HITL requirement
        let decision: 'approve' | 'deny' | 'escalate';
        let requiresHitl = false;

        const isCritical = session.gateResult.riskLevel === 'critical';

        if (consensus === 'no_quorum' || consensus === 'split') {
            decision = 'escalate';
            requiresHitl = true;
        } else if (consensus === 'unanimous_approve') {
            decision = 'approve';
        } else if (consensus === 'unanimous_deny') {
            decision = 'deny';
        } else if (consensus === 'majority_approve') {
            if (isCritical && this.config.requireUnanimousForCritical) {
                decision = 'escalate';
                requiresHitl = true;
            } else if (avgConfidence < this.config.minConfidence) {
                decision = 'escalate';
                requiresHitl = true;
            } else {
                decision = 'approve';
            }
        } else { // majority_deny
            decision = 'deny';
        }

        return {
            decision,
            consensus,
            confidence: avgConfidence,
            reasoning: decision === 'approve' ? approveReasons : denyReasons,
            dissent: decision === 'approve' ? denyReasons : approveReasons,
            requiresHitl,
        };
    }

    // =========================================================================
    // Configuration
    // =========================================================================

    /**
     * Update configuration
     */
    updateConfig(config: Partial<TribunalConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): TribunalConfig {
        return { ...this.config };
    }

    // =========================================================================
    // Statistics
    // =========================================================================

    /**
     * Get tribunal statistics
     */
    getStats(): {
        totalSessions: number;
        pendingSessions: number;
        decidedSessions: number;
        expiredSessions: number;
        consensusBreakdown: Record<ConsensusType, number>;
        averageVotingTime: number;
    } {
        const sessions = Array.from(this.sessions.values());

        const consensusBreakdown: Record<ConsensusType, number> = {
            unanimous_approve: 0,
            unanimous_deny: 0,
            majority_approve: 0,
            majority_deny: 0,
            split: 0,
            no_quorum: 0,
        };

        let totalVotingTime = 0;
        let votingTimeCount = 0;

        for (const session of sessions) {
            if (session.consensus) {
                consensusBreakdown[session.consensus]++;
            }

            if (session.decidedAt && session.createdAt) {
                totalVotingTime += session.decidedAt.getTime() - session.createdAt.getTime();
                votingTimeCount++;
            }
        }

        return {
            totalSessions: sessions.length,
            pendingSessions: sessions.filter(s => s.status === 'pending' || s.status === 'voting').length,
            decidedSessions: sessions.filter(s => s.status === 'decided').length,
            expiredSessions: sessions.filter(s => s.status === 'expired').length,
            consensusBreakdown,
            averageVotingTime: votingTimeCount > 0 ? totalVotingTime / votingTimeCount : 0,
        };
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    private buildSession(
        request: ActionRequest,
        gateResult: GateResult,
        validators: ValidatorInfo[]
    ): TribunalSession {
        return {
            id: this.generateSessionId(),
            requestId: request.id,
            request,
            gateResult,
            validators,
            votes: [],
            status: 'pending',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + this.config.votingTimeoutMs),
        };
    }

    private storeSession(session: TribunalSession): void {
        this.sessions.set(session.id, session);
        this.sessionsByRequest.set(session.requestId, session.id);
    }

    private finalizeSession(session: TribunalSession): void {
        this.clearSessionTimeout(session.id);

        session.consensus = this.config.weightByTrustScore
            ? this.calculateWeightedConsensus(session.votes, session.validators).consensus
            : this.calculateConsensus(session.votes);

        session.recommendation = this.generateRecommendation(session);
        session.status = 'decided';
        session.decidedAt = new Date();

        this.emit('consensus:reached', session);
        this.emit('session:decided', session);
    }

    private setSessionTimeout(session: TribunalSession): void {
        const timeout = setTimeout(() => {
            this.expireSession(session.id);
        }, this.config.votingTimeoutMs);

        this.timeouts.set(session.id, timeout);
    }

    private clearSessionTimeout(sessionId: string): void {
        const timeout = this.timeouts.get(sessionId);
        if (timeout) {
            clearTimeout(timeout);
            this.timeouts.delete(sessionId);
        }
    }

    private expireSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        if (session.status === 'pending' || session.status === 'voting') {
            // Generate recommendation from partial votes
            if (session.votes.length > 0) {
                session.consensus = this.calculateConsensus(session.votes);
                session.recommendation = this.generateRecommendation(session);
                session.recommendation.reasoning.push('Session expired with incomplete votes');
                session.recommendation.requiresHitl = true;
            } else {
                session.consensus = 'no_quorum';
                session.recommendation = {
                    decision: 'escalate',
                    consensus: 'no_quorum',
                    confidence: 0,
                    reasoning: ['No votes received before expiration'],
                    requiresHitl: true,
                };
            }

            session.status = 'expired';
            session.decidedAt = new Date();

            this.emit('session:expired', session);
            this.emit('session:decided', session);
        }

        this.timeouts.delete(sessionId);
    }

    private generateSessionId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `tribunal_${timestamp}_${random}`;
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /**
     * Clear all state
     */
    clear(): void {
        // Clear all timeouts
        for (const timeout of this.timeouts.values()) {
            clearTimeout(timeout);
        }

        this.sessions.clear();
        this.sessionsByRequest.clear();
        this.availableValidators.clear();
        this.timeouts.clear();
    }

    /**
     * Get session count
     */
    get sessionCount(): number {
        return this.sessions.size;
    }

    /**
     * Get validator count
     */
    get validatorCount(): number {
        return this.availableValidators.size;
    }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: TribunalVotingEngine | null = null;

export function getTribunalVotingEngine(config?: Partial<TribunalConfig>): TribunalVotingEngine {
    if (!instance) {
        instance = new TribunalVotingEngine(config);
    }
    return instance;
}

export function resetTribunalVotingEngine(): void {
    if (instance) {
        instance.clear();
    }
    instance = null;
}

export default TribunalVotingEngine;
