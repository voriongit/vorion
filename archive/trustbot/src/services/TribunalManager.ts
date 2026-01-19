/**
 * Tribunal Manager Service
 *
 * Orchestrates the tribunal peer review process by:
 * 1. Listening to TrustGateEngine escalation events
 * 2. Creating tribunal sessions via TribunalVotingEngine
 * 3. Posting VOTING_SESSION entries to Blackboard for visibility
 * 4. Managing validator registration and lifecycle
 * 5. Syncing tribunal decisions back to Blackboard
 *
 * Integration Flow:
 *   [TrustGateEngine] --gate:escalated--> [TribunalManager] --> [TribunalVotingEngine]
 *                                              |
 *                                              v
 *                                         [Blackboard]
 */

import { EventEmitter } from 'eventemitter3';
import type { Blackboard } from '../core/Blackboard.js';
import type { AgentId, BlackboardEntry } from '../types.js';
import {
    TrustGateEngine,
    getTrustGateEngine,
    type ActionRequest,
    type GateResult,
} from './TrustGateEngine.js';
import {
    TribunalVotingEngine,
    getTribunalVotingEngine,
    type TribunalSession,
    type TribunalRecommendation,
    type ValidatorInfo,
    type ValidatorSelectionCriteria,
} from './TribunalVotingEngine.js';

// ============================================================================
// Types
// ============================================================================

export interface TribunalManagerConfig {
    /** Auto-register agents with trust score above this as validators */
    autoRegisterMinTrustScore: number;
    /** Minimum tier for auto-registration as validator */
    autoRegisterMinTier: number;
    /** Specializations that qualify agents as validators */
    validatorSpecializations: string[];
    /** Post tribunal sessions to Blackboard */
    postToBlackboard: boolean;
    /** Auto-start tribunal on gate:escalated */
    autoStartOnEscalation: boolean;
}

export interface ManagedSession {
    session: TribunalSession;
    blackboardEntryId?: string;
    request: ActionRequest;
    gateResult: GateResult;
    startedAt: Date;
    completedAt?: Date;
}

interface ManagerEvents {
    'tribunal:started': (session: TribunalSession, blackboardEntryId?: string) => void;
    'tribunal:vote_received': (session: TribunalSession) => void;
    'tribunal:completed': (session: TribunalSession, recommendation: TribunalRecommendation) => void;
    'tribunal:escalated_to_hitl': (session: TribunalSession, reason: string) => void;
    'validator:registered': (validator: ValidatorInfo) => void;
    'validator:unregistered': (agentId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: TribunalManagerConfig = {
    autoRegisterMinTrustScore: 600,
    autoRegisterMinTier: 3,
    validatorSpecializations: ['review', 'audit', 'validation', 'security', 'governance'],
    postToBlackboard: true,
    autoStartOnEscalation: true,
};

// ============================================================================
// Tribunal Manager
// ============================================================================

export class TribunalManager extends EventEmitter<ManagerEvents> {
    private blackboard: Blackboard;
    private gateEngine: TrustGateEngine;
    private votingEngine: TribunalVotingEngine;
    private config: TribunalManagerConfig;

    private managedSessions: Map<string, ManagedSession> = new Map();
    private sessionToBlackboard: Map<string, string> = new Map(); // sessionId -> entryId
    private pendingRequests: Map<string, { request: ActionRequest; gateResult: GateResult }> = new Map();

    constructor(
        blackboard: Blackboard,
        config?: Partial<TribunalManagerConfig>,
        gateEngine?: TrustGateEngine,
        votingEngine?: TribunalVotingEngine
    ) {
        super();
        this.blackboard = blackboard;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.gateEngine = gateEngine ?? getTrustGateEngine();
        this.votingEngine = votingEngine ?? getTribunalVotingEngine();

        this.setupEventListeners();
    }

    // =========================================================================
    // Event Listeners Setup
    // =========================================================================

    private setupEventListeners(): void {
        // Listen for gate escalations
        this.gateEngine.on('gate:escalated', (result: GateResult) => {
            if (this.config.autoStartOnEscalation) {
                this.handleGateEscalation(result);
            }
        });

        // Listen for tribunal decisions
        this.votingEngine.on('session:decided', (session: TribunalSession) => {
            this.handleSessionDecided(session);
        });

        // Listen for votes
        this.votingEngine.on('vote:received', (session: TribunalSession) => {
            this.emit('tribunal:vote_received', session);
            this.updateBlackboardVoteProgress(session);
        });

        // Listen for session expiry
        this.votingEngine.on('session:expired', (session: TribunalSession) => {
            this.handleSessionDecided(session);
        });
    }

    // =========================================================================
    // Gate Escalation Handling
    // =========================================================================

    /**
     * Handle gate:escalated event by starting tribunal
     */
    private handleGateEscalation(result: GateResult): void {
        const pending = this.pendingRequests.get(result.requestId);
        if (!pending) {
            // Request not registered - this is expected for external escalations
            // The caller should use startTribunal() directly with request context
            return;
        }

        this.startTribunal(pending.request, result);
    }

    /**
     * Register an action request for potential tribunal review
     */
    registerRequest(request: ActionRequest): void {
        this.pendingRequests.set(request.id, { request, gateResult: null as unknown as GateResult });
    }

    /**
     * Evaluate request through gate and start tribunal if escalated
     */
    async evaluateAndTribunal(
        request: ActionRequest,
        agentContext: {
            trustScore: number;
            tier: string;
            capabilities: string[];
            recentFailures: number;
            recentSuccesses: number;
            actionHistory: Map<string, number>;
        }
    ): Promise<{ gateResult: GateResult; tribunalSession?: TribunalSession }> {
        // Store pending request
        this.pendingRequests.set(request.id, { request, gateResult: null as unknown as GateResult });

        // Evaluate through gate
        const gateResult = this.gateEngine.evaluate(request, agentContext);
        this.pendingRequests.set(request.id, { request, gateResult });

        // Check if tribunal is needed
        if (gateResult.decision === 'tribunal_review' || gateResult.decision === 'escalate') {
            const session = this.startTribunal(request, gateResult);
            return { gateResult, tribunalSession: session };
        }

        return { gateResult };
    }

    // =========================================================================
    // Tribunal Session Management
    // =========================================================================

    /**
     * Start a tribunal session for a request
     */
    startTribunal(
        request: ActionRequest,
        gateResult: GateResult,
        selectionCriteria?: ValidatorSelectionCriteria
    ): TribunalSession {
        // Create tribunal session
        const session = this.votingEngine.createSession(request, gateResult, selectionCriteria);

        // Track managed session
        const managed: ManagedSession = {
            session,
            request,
            gateResult,
            startedAt: new Date(),
        };
        this.managedSessions.set(session.id, managed);

        // Post to Blackboard for visibility
        let blackboardEntryId: string | undefined;
        if (this.config.postToBlackboard) {
            blackboardEntryId = this.postTribunalToBlackboard(session, request, gateResult);
            managed.blackboardEntryId = blackboardEntryId;
            this.sessionToBlackboard.set(session.id, blackboardEntryId);
        }

        this.emit('tribunal:started', session, blackboardEntryId);
        return session;
    }

    /**
     * Post tribunal session to Blackboard as VOTING_SESSION
     */
    private postTribunalToBlackboard(
        session: TribunalSession,
        request: ActionRequest,
        gateResult: GateResult
    ): string {
        const entry = this.blackboard.post({
            type: 'VOTING_SESSION',
            title: `Tribunal: ${request.description}`,
            author: 'TRIBUNAL_MANAGER' as AgentId,
            content: {
                sessionId: session.id,
                requestId: request.id,
                actionType: request.actionType,
                category: request.category,
                description: request.description,
                estimatedImpact: request.estimatedImpact,
                riskLevel: gateResult.riskLevel,
                reasons: gateResult.reasons,
                validators: session.validators.map(v => ({
                    agentId: v.agentId,
                    name: v.name,
                    tier: v.tier,
                    trustScore: v.trustScore,
                })),
                votingStatus: 'pending',
                votesReceived: 0,
                votesRequired: session.validators.length,
                expiresAt: session.expiresAt.toISOString(),
            },
            priority: this.mapRiskToPriority(gateResult.riskLevel),
            visibility: 'ALL',
        });

        return entry.id;
    }

    /**
     * Update Blackboard entry with vote progress
     */
    private updateBlackboardVoteProgress(session: TribunalSession): void {
        const entryId = this.sessionToBlackboard.get(session.id);
        if (!entryId) return;

        const entry = this.blackboard.get(entryId);
        if (!entry) return;

        this.blackboard.updateContent(entryId, {
            ...(entry.content as Record<string, unknown>),
            votingStatus: 'in_progress',
            votesReceived: session.votes.length,
            votesRequired: session.validators.length,
            votes: session.votes.map(v => ({
                validatorId: v.validatorId,
                decision: v.decision,
                confidence: v.confidence,
                votedAt: v.votedAt.toISOString(),
            })),
        });
    }

    // =========================================================================
    // Session Decision Handling
    // =========================================================================

    /**
     * Handle tribunal session decision
     */
    private handleSessionDecided(session: TribunalSession): void {
        const managed = this.managedSessions.get(session.id);
        if (!managed) return;

        managed.completedAt = new Date();
        const recommendation = session.recommendation;

        if (!recommendation) return;

        // Update Blackboard with final decision
        if (managed.blackboardEntryId) {
            this.updateBlackboardWithDecision(session, recommendation);
        }

        // Emit appropriate event
        if (recommendation.requiresHitl) {
            this.emit('tribunal:escalated_to_hitl', session, recommendation.reasoning.join('; '));
        } else {
            this.emit('tribunal:completed', session, recommendation);
        }

        // Cleanup pending request
        this.pendingRequests.delete(session.requestId);
    }

    /**
     * Update Blackboard with final tribunal decision
     */
    private updateBlackboardWithDecision(
        session: TribunalSession,
        recommendation: TribunalRecommendation
    ): void {
        const entryId = this.sessionToBlackboard.get(session.id);
        if (!entryId) return;

        const entry = this.blackboard.get(entryId);
        if (!entry) return;

        // Update content with decision
        this.blackboard.updateContent(entryId, {
            ...(entry.content as Record<string, unknown>),
            votingStatus: 'completed',
            decision: recommendation.decision,
            consensus: recommendation.consensus,
            confidence: recommendation.confidence,
            reasoning: recommendation.reasoning,
            dissent: recommendation.dissent,
            requiresHitl: recommendation.requiresHitl,
            decidedAt: session.decidedAt?.toISOString(),
        });

        // Resolve the entry
        this.blackboard.resolve(entryId, {
            resolution: `Tribunal ${recommendation.decision}: ${recommendation.reasoning[0] || 'Peer review complete'}`,
            resolvedBy: 'TRIBUNAL_MANAGER' as AgentId,
        });
    }

    // =========================================================================
    // Validator Management
    // =========================================================================

    /**
     * Register an agent as a validator
     */
    registerValidator(validator: ValidatorInfo): void {
        this.votingEngine.registerValidator(validator);
        this.emit('validator:registered', validator);
    }

    /**
     * Unregister a validator
     */
    unregisterValidator(agentId: string): void {
        this.votingEngine.unregisterValidator(agentId);
        this.emit('validator:unregistered', agentId);
    }

    /**
     * Auto-register qualified agents as validators
     */
    autoRegisterValidators(agents: Array<{
        agentId: string;
        name: string;
        tier: number;
        trustScore: number;
        capabilities: string[];
        specialization?: string;
    }>): number {
        let registered = 0;

        for (const agent of agents) {
            // Check minimum requirements
            if (agent.trustScore < this.config.autoRegisterMinTrustScore) continue;
            if (agent.tier < this.config.autoRegisterMinTier) continue;

            // Check for validator-qualifying specialization
            const hasValidatorSpecialization = agent.specialization &&
                this.config.validatorSpecializations.some(s =>
                    agent.specialization!.toLowerCase().includes(s)
                );

            // Check for review/audit capabilities
            const hasReviewCapability = agent.capabilities.some(c =>
                ['review', 'audit', 'validate', 'approve'].includes(c.toLowerCase())
            );

            if (hasValidatorSpecialization || hasReviewCapability || agent.tier >= 4) {
                this.registerValidator({
                    agentId: agent.agentId,
                    name: agent.name,
                    tier: `T${agent.tier}`,
                    trustScore: agent.trustScore,
                    specialization: agent.specialization,
                });
                registered++;
            }
        }

        return registered;
    }

    /**
     * Get all registered validators
     */
    getValidators(): ValidatorInfo[] {
        return this.votingEngine.getValidators();
    }

    // =========================================================================
    // Query Methods
    // =========================================================================

    /**
     * Get a managed session by ID
     */
    getSession(sessionId: string): ManagedSession | null {
        return this.managedSessions.get(sessionId) ?? null;
    }

    /**
     * Get session by Blackboard entry ID
     */
    getSessionByBlackboardEntry(entryId: string): ManagedSession | null {
        for (const [sessionId, bbEntryId] of this.sessionToBlackboard) {
            if (bbEntryId === entryId) {
                return this.managedSessions.get(sessionId) ?? null;
            }
        }
        return null;
    }

    /**
     * Get all active sessions
     */
    getActiveSessions(): ManagedSession[] {
        return Array.from(this.managedSessions.values())
            .filter(s => !s.completedAt);
    }

    /**
     * Get all completed sessions
     */
    getCompletedSessions(): ManagedSession[] {
        return Array.from(this.managedSessions.values())
            .filter(s => s.completedAt);
    }

    /**
     * Get statistics
     */
    getStats(): {
        totalSessions: number;
        activeSessions: number;
        completedSessions: number;
        validatorCount: number;
        tribunalStats: ReturnType<TribunalVotingEngine['getStats']>;
    } {
        return {
            totalSessions: this.managedSessions.size,
            activeSessions: this.getActiveSessions().length,
            completedSessions: this.getCompletedSessions().length,
            validatorCount: this.votingEngine.validatorCount,
            tribunalStats: this.votingEngine.getStats(),
        };
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    private mapRiskToPriority(riskLevel: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
        switch (riskLevel) {
            case 'critical': return 'CRITICAL';
            case 'high': return 'HIGH';
            case 'medium': return 'MEDIUM';
            default: return 'LOW';
        }
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /**
     * Clear all state
     */
    clear(): void {
        this.managedSessions.clear();
        this.sessionToBlackboard.clear();
        this.pendingRequests.clear();
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let managerInstance: TribunalManager | null = null;

/**
 * Get or create the TribunalManager singleton
 */
export function getTribunalManager(
    blackboard?: Blackboard,
    config?: Partial<TribunalManagerConfig>
): TribunalManager {
    if (!managerInstance) {
        if (!blackboard) {
            throw new Error('Blackboard required for initial TribunalManager creation');
        }
        managerInstance = new TribunalManager(blackboard, config);
    }
    return managerInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetTribunalManager(): void {
    if (managerInstance) {
        managerInstance.clear();
    }
    managerInstance = null;
}
