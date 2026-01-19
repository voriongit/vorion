/**
 * Decision Pipeline Orchestrator
 *
 * Unified entry point for routing action requests through the appropriate
 * approval channels and into execution. Coordinates between:
 *
 * - TrustGateEngine: Primary risk assessment and routing decision
 * - AutoApprovalService: Low-risk auto-approvals
 * - TribunalVotingEngine: Medium-high risk multi-agent consensus
 * - CouncilService: Critical governance decisions (T4+ members)
 * - HITLRouter: Human-in-the-loop for high/critical risk
 * - ExecutionTracker: Queue and execute approved actions
 *
 * DECISION FLOW:
 * 1. ActionRequest → TrustGateEngine.evaluate() → GateDecision
 * 2. Route based on GateDecision:
 *    - auto_approve → ExecutionTracker
 *    - tribunal_review → TribunalVotingEngine → ExecutionTracker
 *    - hitl_required/escalate → CouncilGateway (council or HITL) → ExecutionTracker
 *    - deny → Rejected
 * 3. Track full approval chain for audit
 *
 * FALLBACK BEHAVIORS:
 * - If tribunal has no quorum → escalate to HITL
 * - If council unavailable → escalate to HITL
 * - If HITL reviewers unavailable → queue with escalation notice
 * - If execution fails → retry with exponential backoff
 */

import { EventEmitter } from 'eventemitter3';
import {
    TrustGateEngine,
    type ActionRequest,
    type AgentContext,
    type GateResult,
    type GateDecision,
} from './TrustGateEngine.js';
import {
    ExecutionTracker,
    type ExecutionRecord,
    type ApprovalSource,
} from './ExecutionTracker.js';
import { TribunalVotingEngine } from './TribunalVotingEngine.js';
import { AutoApprovalService } from './AutoApprovalService.js';
import { HITLRouter } from './HITLRouter.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Decision in the approval chain
 */
export interface ApprovalDecision {
    timestamp: Date;
    level: ApprovalSource;
    decision: 'approved' | 'rejected' | 'escalated' | 'pending';
    reasoning: string;
    actors: string[];
    metadata?: Record<string, unknown>;
}

/**
 * Complete request chain tracking all decisions
 */
export interface RequestChain {
    requestId: string;
    request: ActionRequest;
    gateResult: GateResult;
    approvalChain: ApprovalDecision[];
    executionRecord?: ExecutionRecord;
    finalStatus: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Fallback behavior configuration
 */
export interface FallbackConfig {
    /** If tribunal has no quorum, escalate to HITL */
    tribunalNoQuorum: 'hitl' | 'deny';
    /** If council unavailable, escalate to HITL */
    councilUnavailable: 'hitl' | 'deny';
    /** If HITL reviewers unavailable */
    hitlUnavailable: 'queue_with_notice' | 'deny';
    /** Maximum escalation attempts before denial */
    maxEscalations: number;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
    /** Fallback behaviors */
    fallbacks: FallbackConfig;
    /** HITL level threshold for council routing (0-100) */
    councilRoutingThreshold: number;
    /** Enable auto-approval bypass for testing */
    bypassAutoApproval: boolean;
}

// ============================================================================
// Events
// ============================================================================

interface OrchestratorEvents {
    'request:received': (request: ActionRequest) => void;
    'gate:evaluated': (requestId: string, result: GateResult) => void;
    'approval:decision': (requestId: string, decision: ApprovalDecision) => void;
    'execution:queued': (requestId: string, record: ExecutionRecord) => void;
    'request:denied': (requestId: string, reason: string) => void;
    'escalation:triggered': (requestId: string, from: ApprovalSource, to: ApprovalSource, reason: string) => void;
    'fallback:activated': (requestId: string, reason: string, action: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: OrchestratorConfig = {
    fallbacks: {
        tribunalNoQuorum: 'hitl',
        councilUnavailable: 'hitl',
        hitlUnavailable: 'queue_with_notice',
        maxEscalations: 3,
    },
    councilRoutingThreshold: 50,
    bypassAutoApproval: false,
};

// ============================================================================
// Decision Pipeline Orchestrator
// ============================================================================

export class DecisionPipelineOrchestrator extends EventEmitter<OrchestratorEvents> {
    private config: OrchestratorConfig;
    private requestChains: Map<string, RequestChain> = new Map();

    // Subsystems
    private trustGate: TrustGateEngine;
    private executionTracker: ExecutionTracker;
    private tribunalEngine: TribunalVotingEngine;
    private autoApprovalService: AutoApprovalService;
    private hitlRouter: HITLRouter;

    // Current HITL level (0-100, fetched from TrustEngine)
    private hitlLevel: number = 100;

    constructor(
        config: Partial<OrchestratorConfig> = {},
        subsystems?: {
            trustGate?: TrustGateEngine;
            executionTracker?: ExecutionTracker;
            tribunalEngine?: TribunalVotingEngine;
            autoApprovalService?: AutoApprovalService;
            hitlRouter?: HITLRouter;
        }
    ) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Initialize subsystems (use provided or create defaults)
        this.trustGate = subsystems?.trustGate ?? new TrustGateEngine();
        this.executionTracker = subsystems?.executionTracker ?? new ExecutionTracker();
        this.tribunalEngine = subsystems?.tribunalEngine ?? new TribunalVotingEngine();
        this.autoApprovalService = subsystems?.autoApprovalService ?? new AutoApprovalService();
        this.hitlRouter = subsystems?.hitlRouter ?? new HITLRouter();
    }

    // =========================================================================
    // Configuration
    // =========================================================================

    /**
     * Update HITL level (should be called when TrustEngine HITL changes)
     */
    setHITLLevel(level: number): void {
        this.hitlLevel = Math.max(0, Math.min(100, level));
    }

    /**
     * Update orchestrator configuration
     */
    updateConfig(config: Partial<OrchestratorConfig>): void {
        this.config = { ...this.config, ...config };
    }

    // =========================================================================
    // Main Entry Point
    // =========================================================================

    /**
     * Route an action request through the decision pipeline.
     * This is the primary entry point for all action requests.
     */
    async routeRequest(
        request: ActionRequest,
        context: AgentContext
    ): Promise<RequestChain> {
        this.emit('request:received', request);

        // Initialize request chain
        const chain: RequestChain = {
            requestId: request.id,
            request,
            gateResult: null as any, // Will be set below
            approvalChain: [],
            finalStatus: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.requestChains.set(request.id, chain);

        try {
            // Step 1: Evaluate through trust gate
            const gateResult = this.trustGate.evaluate(request, context);
            chain.gateResult = gateResult;
            this.emit('gate:evaluated', request.id, gateResult);

            // Step 2: Route based on gate decision
            await this.handleGateDecision(chain, gateResult, context);

            return chain;
        } catch (error) {
            chain.finalStatus = 'failed';
            chain.updatedAt = new Date();
            throw error;
        }
    }

    // =========================================================================
    // Decision Routing
    // =========================================================================

    private async handleGateDecision(
        chain: RequestChain,
        gateResult: GateResult,
        context: AgentContext
    ): Promise<void> {
        const decision = gateResult.decision;

        switch (decision) {
            case 'auto_approve':
                await this.handleAutoApproval(chain, gateResult);
                break;

            case 'tribunal_review':
                await this.handleTribunalReview(chain, gateResult, context);
                break;

            case 'hitl_required':
            case 'escalate':
                await this.handleHITLOrCouncil(chain, gateResult, context);
                break;

            case 'rate_limited':
                this.recordDenial(chain, 'Rate limited - too many requests');
                break;

            case 'deny':
                this.recordDenial(chain, gateResult.reasons.join('; '));
                break;

            default:
                this.recordDenial(chain, `Unknown gate decision: ${decision}`);
        }
    }

    // =========================================================================
    // Approval Handlers
    // =========================================================================

    private async handleAutoApproval(
        chain: RequestChain,
        gateResult: GateResult
    ): Promise<void> {
        // Record approval decision
        const decision: ApprovalDecision = {
            timestamp: new Date(),
            level: 'auto_approval',
            decision: 'approved',
            reasoning: 'Low risk action auto-approved based on trust score',
            actors: ['SYSTEM'],
            metadata: { gateReasons: gateResult.reasons },
        };
        chain.approvalChain.push(decision);
        this.emit('approval:decision', chain.requestId, decision);

        // Queue for execution
        await this.queueExecution(chain, 'auto_approval');
    }

    private async handleTribunalReview(
        chain: RequestChain,
        gateResult: GateResult,
        context: AgentContext
    ): Promise<void> {
        try {
            // Create tribunal session - uses actual API signature
            const session = this.tribunalEngine.createSession(
                chain.request,
                gateResult
            );

            // Check if session was immediately decided (no quorum case)
            if (session.status === 'decided') {
                if (session.consensus === 'no_quorum') {
                    this.handleTribunalFallback(chain, gateResult, context, 'Insufficient validators');
                    return;
                }
            }

            // For async resolution, we'd listen to 'session:decided' event
            // For now, check if recommendation available
            if (session.recommendation) {
                const approveCount = session.votes.filter(v => v.decision === 'approve').length;
                const totalVotes = session.votes.length;
                const voters = session.votes.map(v => v.validatorId);

                if (session.recommendation.decision === 'approve') {
                    const decision: ApprovalDecision = {
                        timestamp: new Date(),
                        level: 'tribunal',
                        decision: 'approved',
                        reasoning: `Tribunal approved with ${approveCount}/${totalVotes} votes`,
                        actors: voters,
                        metadata: { sessionId: session.id, consensus: session.consensus },
                    };
                    chain.approvalChain.push(decision);
                    this.emit('approval:decision', chain.requestId, decision);

                    await this.queueExecution(chain, 'tribunal', session.id);
                } else if (session.recommendation.decision === 'deny') {
                    const denyCount = session.votes.filter(v => v.decision === 'deny').length;
                    const decision: ApprovalDecision = {
                        timestamp: new Date(),
                        level: 'tribunal',
                        decision: 'rejected',
                        reasoning: `Tribunal rejected with ${denyCount}/${totalVotes} votes`,
                        actors: voters,
                    };
                    chain.approvalChain.push(decision);
                    this.recordDenial(chain, 'Tribunal rejected the request');
                } else {
                    // Escalate or no consensus
                    this.handleTribunalFallback(chain, gateResult, context, 'No consensus reached');
                }
            } else {
                // Session created but pending votes - mark chain as pending
                chain.finalStatus = 'pending';
                const decision: ApprovalDecision = {
                    timestamp: new Date(),
                    level: 'tribunal',
                    decision: 'pending',
                    reasoning: `Awaiting tribunal votes (session: ${session.id})`,
                    actors: session.validators.map(v => v.agentId),
                };
                chain.approvalChain.push(decision);
                this.emit('approval:decision', chain.requestId, decision);
            }
        } catch (error) {
            // Tribunal failed - apply fallback
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.handleTribunalFallback(chain, gateResult, context, errorMessage);
        }
    }

    private handleTribunalFallback(
        chain: RequestChain,
        gateResult: GateResult,
        context: AgentContext,
        reason: string
    ): void {
        this.emit('fallback:activated', chain.requestId, reason, this.config.fallbacks.tribunalNoQuorum);

        if (this.config.fallbacks.tribunalNoQuorum === 'hitl') {
            const escalationDecision: ApprovalDecision = {
                timestamp: new Date(),
                level: 'tribunal',
                decision: 'escalated',
                reasoning: `Escalating to HITL: ${reason}`,
                actors: [],
            };
            chain.approvalChain.push(escalationDecision);
            this.emit('escalation:triggered', chain.requestId, 'tribunal', 'hitl', reason);

            // Route to HITL
            this.handleHITLOrCouncil(chain, gateResult, context);
        } else {
            this.recordDenial(chain, `Tribunal failed: ${reason}`);
        }
    }

    private async handleHITLOrCouncil(
        chain: RequestChain,
        gateResult: GateResult,
        context: AgentContext
    ): Promise<void> {
        // Determine routing: Council vs HITL based on HITL level
        const useCouncil = this.hitlLevel < this.config.councilRoutingThreshold;

        if (useCouncil) {
            await this.handleCouncilReview(chain, gateResult, context);
        } else {
            await this.handleHITLReview(chain, gateResult, context);
        }
    }

    private async handleCouncilReview(
        chain: RequestChain,
        gateResult: GateResult,
        context: AgentContext
    ): Promise<void> {
        try {
            // Note: CouncilService integration would go here
            // For now, we'll simulate council availability check
            const councilAvailable = true; // Would check CouncilMemberRegistry

            if (!councilAvailable) {
                this.handleCouncilFallback(chain, gateResult, context, 'No council members available');
                return;
            }

            // Council review would be submitted here
            // For now, record as pending
            const decision: ApprovalDecision = {
                timestamp: new Date(),
                level: 'council',
                decision: 'pending',
                reasoning: 'Submitted to council for review',
                actors: [],
            };
            chain.approvalChain.push(decision);
            chain.finalStatus = 'pending';
            this.emit('approval:decision', chain.requestId, decision);

            // Note: In a full implementation, this would await council decision
            // and then call queueExecution or recordDenial

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.handleCouncilFallback(chain, gateResult, context, errorMessage);
        }
    }

    private handleCouncilFallback(
        chain: RequestChain,
        gateResult: GateResult,
        context: AgentContext,
        reason: string
    ): void {
        this.emit('fallback:activated', chain.requestId, reason, this.config.fallbacks.councilUnavailable);

        if (this.config.fallbacks.councilUnavailable === 'hitl') {
            const escalationDecision: ApprovalDecision = {
                timestamp: new Date(),
                level: 'council',
                decision: 'escalated',
                reasoning: `Escalating to HITL: ${reason}`,
                actors: [],
            };
            chain.approvalChain.push(escalationDecision);
            this.emit('escalation:triggered', chain.requestId, 'council', 'hitl', reason);

            // Force HITL route
            this.handleHITLReview(chain, gateResult, context);
        } else {
            this.recordDenial(chain, `Council unavailable: ${reason}`);
        }
    }

    private async handleHITLReview(
        chain: RequestChain,
        gateResult: GateResult,
        context: AgentContext
    ): Promise<void> {
        try {
            // Route to human reviewer - uses actual API signature
            const hitlRequest = this.hitlRouter.routeToHuman(
                chain.request,
                gateResult,
                chain.request.urgency || 'normal'
            );

            // Check if request was successfully created and routed
            if (hitlRequest.status === 'pending' || hitlRequest.status === 'assigned' || hitlRequest.status === 'in_review') {
                const decision: ApprovalDecision = {
                    timestamp: new Date(),
                    level: 'hitl',
                    decision: 'pending',
                    reasoning: `Routed to HITL review (request: ${hitlRequest.id})`,
                    actors: [], // Reviewers assigned asynchronously
                    metadata: { hitlRequestId: hitlRequest.id, urgency: hitlRequest.urgency },
                };
                chain.approvalChain.push(decision);
                chain.finalStatus = 'pending';
                this.emit('approval:decision', chain.requestId, decision);

                // Note: In a full implementation, this would listen to
                // 'request:approved' or 'request:denied' events from HITLRouter
                // and then call queueExecution or recordDenial

            } else if (hitlRequest.status === 'expired') {
                this.handleHITLFallback(chain, gateResult, context, 'HITL request expired');
            } else {
                this.handleHITLFallback(chain, gateResult, context, 'Unexpected HITL status');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.handleHITLFallback(chain, gateResult, context, errorMessage);
        }
    }

    private handleHITLFallback(
        chain: RequestChain,
        gateResult: GateResult,
        context: AgentContext,
        reason: string
    ): void {
        this.emit('fallback:activated', chain.requestId, reason, this.config.fallbacks.hitlUnavailable);

        if (this.config.fallbacks.hitlUnavailable === 'queue_with_notice') {
            const decision: ApprovalDecision = {
                timestamp: new Date(),
                level: 'hitl',
                decision: 'pending',
                reasoning: `Queued for review (${reason})`,
                actors: [],
                metadata: { fallbackQueued: true },
            };
            chain.approvalChain.push(decision);
            chain.finalStatus = 'pending';
            this.emit('approval:decision', chain.requestId, decision);
        } else {
            this.recordDenial(chain, `HITL unavailable: ${reason}`);
        }
    }

    // =========================================================================
    // Execution
    // =========================================================================

    private async queueExecution(
        chain: RequestChain,
        source: ApprovalSource,
        approvalId?: string
    ): Promise<void> {
        const record = await this.executionTracker.queueExecution(
            chain.request,
            source,
            approvalId
        );

        chain.executionRecord = record;
        chain.finalStatus = 'executing';
        chain.updatedAt = new Date();

        this.emit('execution:queued', chain.requestId, record);
    }

    private recordDenial(chain: RequestChain, reason: string): void {
        chain.finalStatus = 'rejected';
        chain.updatedAt = new Date();
        this.emit('request:denied', chain.requestId, reason);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private mapRiskToRequestType(riskLevel: string): string {
        const mapping: Record<string, string> = {
            low: 'standard',
            medium: 'elevated',
            high: 'high_risk',
            critical: 'critical',
        };
        return mapping[riskLevel] || 'standard';
    }

    // =========================================================================
    // Query Methods
    // =========================================================================

    /**
     * Get a request chain by ID
     */
    getRequestChain(requestId: string): RequestChain | null {
        return this.requestChains.get(requestId) || null;
    }

    /**
     * Get all request chains
     */
    getAllChains(): RequestChain[] {
        return Array.from(this.requestChains.values());
    }

    /**
     * Get chains by status
     */
    getChainsByStatus(status: RequestChain['finalStatus']): RequestChain[] {
        return this.getAllChains().filter(c => c.finalStatus === status);
    }

    /**
     * Get statistics
     */
    getStats(): {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        executing: number;
        completed: number;
        failed: number;
        byGateDecision: Record<GateDecision, number>;
    } {
        const chains = this.getAllChains();

        const byGateDecision: Record<GateDecision, number> = {
            auto_approve: 0,
            tribunal_review: 0,
            hitl_required: 0,
            escalate: 0,
            deny: 0,
            rate_limited: 0,
        };

        for (const chain of chains) {
            if (chain.gateResult) {
                byGateDecision[chain.gateResult.decision]++;
            }
        }

        return {
            total: chains.length,
            pending: chains.filter(c => c.finalStatus === 'pending').length,
            approved: chains.filter(c => c.finalStatus === 'approved').length,
            rejected: chains.filter(c => c.finalStatus === 'rejected').length,
            executing: chains.filter(c => c.finalStatus === 'executing').length,
            completed: chains.filter(c => c.finalStatus === 'completed').length,
            failed: chains.filter(c => c.finalStatus === 'failed').length,
            byGateDecision,
        };
    }

    /**
     * Clear all stored chains (for testing)
     */
    clear(): void {
        this.requestChains.clear();
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: DecisionPipelineOrchestrator | null = null;

/**
 * Get the singleton orchestrator instance
 */
export function getOrchestrator(config?: Partial<OrchestratorConfig>): DecisionPipelineOrchestrator {
    if (!instance) {
        instance = new DecisionPipelineOrchestrator(config);
    }
    return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetOrchestrator(): void {
    instance = null;
}

export default DecisionPipelineOrchestrator;
