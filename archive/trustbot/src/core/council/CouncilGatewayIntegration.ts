/**
 * Council Gateway Integration
 *
 * TRUST-3.8: Integrates council governance with HITL Gateway.
 * Routes requests to council when HITL oversight is low (<50%).
 */

import { EventEmitter } from 'eventemitter3';
import type { AgentId, HITLApproval } from '../../types.js';
import type {
    CouncilRequestType,
    CouncilReview,
    SubmitReviewRequest,
} from './types.js';
import type { CouncilService } from './CouncilService.js';
import type { HITLGateway } from '../HITLGateway.js';
import { FEATURES } from '../config/features.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Decision routing outcome.
 */
export type RoutingDecision =
    | { route: 'human'; reason: string }
    | { route: 'council'; reason: string }
    | { route: 'auto-approve'; reason: string };

/**
 * Unified approval request that can be routed to either human or council.
 */
export interface UnifiedApprovalRequest {
    /** Type of request (maps to HITL and Council types) */
    type: 'SPAWN' | 'DECISION' | 'STRATEGY' | 'EMERGENCY';

    /** Requesting agent */
    requestorId: AgentId;

    /** Human-readable summary */
    summary: string;

    /** Detailed context */
    context: Record<string, unknown>;

    /** Urgency level */
    urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    /** Deadline for decision */
    deadline?: Date;

    /** Force routing to specific handler */
    forceRoute?: 'human' | 'council';
}

/**
 * Unified approval result.
 */
export interface UnifiedApprovalResult {
    /** Unique identifier */
    id: string;

    /** How the request was routed */
    route: 'human' | 'council' | 'auto-approved';

    /** Current status */
    status: 'pending' | 'approved' | 'rejected' | 'expired' | 'escalated';

    /** Decision reasoning if decided */
    reasoning?: string;

    /** Confidence level (0-1, only for council decisions) */
    confidence?: number;

    /** Reference to HITL approval if routed to human */
    hitlApprovalId?: string;

    /** Reference to council review if routed to council */
    councilReviewId?: string;

    /** When the decision was made */
    decidedAt?: Date;
}

/**
 * Configuration for gateway integration.
 */
export interface GatewayIntegrationConfig {
    /** HITL level threshold for council routing (default: 50) */
    councilRoutingThreshold: number;

    /** Always route emergencies to human (default: true) */
    alwaysEscalateEmergencies: boolean;

    /** Auto-approve low-risk requests when trust is high */
    enableAutoApprove: boolean;

    /** Minimum trust for auto-approve */
    autoApproveTrustThreshold: number;
}

const DEFAULT_CONFIG: GatewayIntegrationConfig = {
    councilRoutingThreshold: 50,
    alwaysEscalateEmergencies: true,
    enableAutoApprove: false,
    autoApproveTrustThreshold: 800,
};

// ============================================================================
// Events
// ============================================================================

interface GatewayIntegrationEvents {
    'routing:to-human': (request: UnifiedApprovalRequest, reason: string) => void;
    'routing:to-council': (request: UnifiedApprovalRequest, reason: string) => void;
    'routing:auto-approved': (request: UnifiedApprovalRequest, reason: string) => void;
    'decision:approved': (result: UnifiedApprovalResult) => void;
    'decision:rejected': (result: UnifiedApprovalResult) => void;
    'decision:escalated': (result: UnifiedApprovalResult) => void;
}

// ============================================================================
// Council Gateway Integration
// ============================================================================

export class CouncilGatewayIntegration extends EventEmitter<GatewayIntegrationEvents> {
    private councilService: CouncilService;
    private hitlGateway: HITLGateway;
    private config: GatewayIntegrationConfig;
    private results: Map<string, UnifiedApprovalResult> = new Map();
    private hitlToUnified: Map<string, string> = new Map();
    private councilToUnified: Map<string, string> = new Map();

    constructor(
        councilService: CouncilService,
        hitlGateway: HITLGateway,
        config: Partial<GatewayIntegrationConfig> = {}
    ) {
        super();
        this.councilService = councilService;
        this.hitlGateway = hitlGateway;
        this.config = { ...DEFAULT_CONFIG, ...config };

        this.setupEventListeners();
    }

    /**
     * Set up event listeners for council and HITL decisions.
     */
    private setupEventListeners(): void {
        // Listen for council decisions
        this.councilService.on('council:decision-made', (review: CouncilReview) => {
            const unifiedId = this.councilToUnified.get(review.id);
            if (unifiedId) {
                const result = this.results.get(unifiedId);
                if (result) {
                    result.status = review.status === 'approved' ? 'approved' : 'rejected';
                    result.reasoning = review.outcome?.reasoning;
                    result.confidence = review.outcome?.confidence;
                    result.decidedAt = review.decidedAt;

                    if (result.status === 'approved') {
                        this.emit('decision:approved', result);
                    } else {
                        this.emit('decision:rejected', result);
                    }
                }
            }
        });

        // Listen for council escalations
        this.councilService.on('council:review-escalated', (review: CouncilReview) => {
            const unifiedId = this.councilToUnified.get(review.id);
            if (unifiedId) {
                const result = this.results.get(unifiedId);
                if (result) {
                    result.status = 'escalated';
                    this.emit('decision:escalated', result);

                    // Escalate to human
                    this.escalateToHuman(unifiedId, review);
                }
            }
        });

        // Listen for HITL decisions
        this.hitlGateway.on('approval:granted', (approval) => {
            const unifiedId = this.hitlToUnified.get(approval.id);
            if (unifiedId) {
                const result = this.results.get(unifiedId);
                if (result) {
                    result.status = 'approved';
                    result.reasoning = approval.response?.reason;
                    result.decidedAt = approval.response?.respondedAt;
                    this.emit('decision:approved', result);
                }
            }
        });

        this.hitlGateway.on('approval:rejected', (approval) => {
            const unifiedId = this.hitlToUnified.get(approval.id);
            if (unifiedId) {
                const result = this.results.get(unifiedId);
                if (result) {
                    result.status = 'rejected';
                    result.reasoning = approval.response?.reason;
                    result.decidedAt = approval.response?.respondedAt;
                    this.emit('decision:rejected', result);
                }
            }
        });

        this.hitlGateway.on('approval:expired', (approval) => {
            const unifiedId = this.hitlToUnified.get(approval.id);
            if (unifiedId) {
                const result = this.results.get(unifiedId);
                if (result) {
                    result.status = 'expired';
                    this.emit('decision:escalated', result);
                }
            }
        });
    }

    /**
     * Escalate a council review to human oversight.
     */
    private escalateToHuman(unifiedId: string, review: CouncilReview): void {
        const result = this.results.get(unifiedId);
        if (!result) return;

        // Create HITL approval for escalated review
        const approval = this.hitlGateway.requestApproval({
            type: this.councilToHitlType(review.requestType),
            requestor: review.requesterId,
            summary: `[ESCALATED] Council could not reach consensus: ${JSON.stringify(review.context)}`,
            details: {
                originalReview: review.id,
                votes: [...review.votes.values()].map(v => ({
                    vote: v.vote,
                    reasoning: v.reasoning,
                })),
            },
            urgency: review.priority === 'critical' ? 'CRITICAL' :
                    review.priority === 'high' ? 'HIGH' : 'MEDIUM',
        });

        result.hitlApprovalId = approval.id;
        result.route = 'human';
        this.hitlToUnified.set(approval.id, unifiedId);
    }

    // -------------------------------------------------------------------------
    // Main API
    // -------------------------------------------------------------------------

    /**
     * Request approval through the unified gateway.
     * Automatically routes to human or council based on HITL level.
     */
    async requestApproval(request: UnifiedApprovalRequest): Promise<UnifiedApprovalResult> {
        // Check if council is enabled
        if (!FEATURES.isEnabled('ENABLE_COUNCIL')) {
            return this.routeToHuman(request, 'Council governance not enabled');
        }

        // Determine routing
        const routing = this.determineRouting(request);

        switch (routing.route) {
            case 'human':
                return this.routeToHuman(request, routing.reason);
            case 'council':
                return this.routeToCouncil(request, routing.reason);
            case 'auto-approve':
                return this.autoApprove(request, routing.reason);
        }
    }

    /**
     * Determine how to route a request.
     */
    determineRouting(request: UnifiedApprovalRequest): RoutingDecision {
        // Force routing if specified
        if (request.forceRoute) {
            return {
                route: request.forceRoute,
                reason: 'Explicitly forced routing',
            };
        }

        // Always route emergencies to human
        if (request.type === 'EMERGENCY' && this.config.alwaysEscalateEmergencies) {
            return {
                route: 'human',
                reason: 'Emergency requests always require human oversight',
            };
        }

        // Critical urgency goes to human
        if (request.urgency === 'CRITICAL') {
            return {
                route: 'human',
                reason: 'Critical urgency requires human oversight',
            };
        }

        // Check HITL level
        const hitlLevel = this.hitlGateway.getGovernanceLevel();

        if (hitlLevel >= this.config.councilRoutingThreshold) {
            return {
                route: 'human',
                reason: `HITL level (${hitlLevel}%) above council threshold (${this.config.councilRoutingThreshold}%)`,
            };
        }

        // Route to council when HITL is low
        return {
            route: 'council',
            reason: `HITL level (${hitlLevel}%) below threshold - delegating to council`,
        };
    }

    /**
     * Route request to human approval.
     */
    private routeToHuman(request: UnifiedApprovalRequest, reason: string): UnifiedApprovalResult {
        const approval = this.hitlGateway.requestApproval({
            type: request.type,
            requestor: request.requestorId,
            summary: request.summary,
            details: request.context,
            urgency: request.urgency,
            deadline: request.deadline,
        });

        const result: UnifiedApprovalResult = {
            id: approval.id,
            route: 'human',
            status: 'pending',
            hitlApprovalId: approval.id,
        };

        this.results.set(result.id, result);
        this.hitlToUnified.set(approval.id, result.id);
        this.emit('routing:to-human', request, reason);

        return result;
    }

    /**
     * Route request to council review.
     */
    private async routeToCouncil(request: UnifiedApprovalRequest, reason: string): Promise<UnifiedApprovalResult> {
        const councilRequest: SubmitReviewRequest = {
            requestType: this.hitlToCouncilType(request.type),
            requesterId: request.requestorId,
            context: {
                ...request.context,
                summary: request.summary,
            },
            priority: this.urgencyToPriority(request.urgency),
            timeoutMs: request.deadline
                ? request.deadline.getTime() - Date.now()
                : undefined,
        };

        const review = await this.councilService.submitForReview(councilRequest);

        const result: UnifiedApprovalResult = {
            id: review.id,
            route: 'council',
            status: review.status === 'pending' ? 'pending' :
                    review.status === 'approved' ? 'approved' : 'rejected',
            councilReviewId: review.id,
            reasoning: review.outcome?.reasoning,
            confidence: review.outcome?.confidence,
            decidedAt: review.decidedAt,
        };

        this.results.set(result.id, result);
        this.councilToUnified.set(review.id, result.id);
        this.emit('routing:to-council', request, reason);

        // If already decided (e.g., by precedent), emit decision event
        if (result.status !== 'pending') {
            if (result.status === 'approved') {
                this.emit('decision:approved', result);
            } else {
                this.emit('decision:rejected', result);
            }
        }

        return result;
    }

    /**
     * Auto-approve a low-risk request.
     */
    private autoApprove(request: UnifiedApprovalRequest, reason: string): UnifiedApprovalResult {
        const result: UnifiedApprovalResult = {
            id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            route: 'auto-approved',
            status: 'approved',
            reasoning: reason,
            confidence: 1.0,
            decidedAt: new Date(),
        };

        this.results.set(result.id, result);
        this.emit('routing:auto-approved', request, reason);
        this.emit('decision:approved', result);

        return result;
    }

    // -------------------------------------------------------------------------
    // Query Methods
    // -------------------------------------------------------------------------

    /**
     * Get a result by ID.
     */
    getResult(id: string): UnifiedApprovalResult | undefined {
        return this.results.get(id);
    }

    /**
     * Get all pending results.
     */
    getPendingResults(): UnifiedApprovalResult[] {
        return [...this.results.values()].filter(r => r.status === 'pending');
    }

    /**
     * Get routing statistics.
     */
    getRoutingStats(): {
        totalRequests: number;
        routedToHuman: number;
        routedToCouncil: number;
        autoApproved: number;
        approved: number;
        rejected: number;
        pending: number;
        escalated: number;
    } {
        const results = [...this.results.values()];

        return {
            totalRequests: results.length,
            routedToHuman: results.filter(r => r.route === 'human').length,
            routedToCouncil: results.filter(r => r.route === 'council').length,
            autoApproved: results.filter(r => r.route === 'auto-approved').length,
            approved: results.filter(r => r.status === 'approved').length,
            rejected: results.filter(r => r.status === 'rejected').length,
            pending: results.filter(r => r.status === 'pending').length,
            escalated: results.filter(r => r.status === 'escalated').length,
        };
    }

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    /**
     * Get current configuration.
     */
    getConfig(): GatewayIntegrationConfig {
        return { ...this.config };
    }

    /**
     * Update configuration.
     */
    setConfig(config: Partial<GatewayIntegrationConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Set the council routing threshold.
     */
    setCouncilRoutingThreshold(threshold: number): void {
        if (threshold < 0 || threshold > 100) {
            throw new Error('Threshold must be between 0 and 100');
        }
        this.config.councilRoutingThreshold = threshold;
    }

    // -------------------------------------------------------------------------
    // Type Mapping Helpers
    // -------------------------------------------------------------------------

    private hitlToCouncilType(type: 'SPAWN' | 'DECISION' | 'STRATEGY' | 'EMERGENCY'): CouncilRequestType {
        const mapping: Record<string, CouncilRequestType> = {
            'SPAWN': 'SPAWN',
            'DECISION': 'CAPABILITY_GRANT',
            'STRATEGY': 'POLICY_CHANGE',
            'EMERGENCY': 'POLICY_CHANGE',
        };
        return mapping[type] ?? 'CAPABILITY_GRANT';
    }

    private councilToHitlType(type: CouncilRequestType): 'SPAWN' | 'DECISION' | 'STRATEGY' | 'EMERGENCY' {
        const mapping: Record<CouncilRequestType, 'SPAWN' | 'DECISION' | 'STRATEGY' | 'EMERGENCY'> = {
            'SPAWN': 'SPAWN',
            'TIER_UPGRADE': 'DECISION',
            'POLICY_CHANGE': 'STRATEGY',
            'CAPABILITY_GRANT': 'DECISION',
        };
        return mapping[type] ?? 'DECISION';
    }

    private urgencyToPriority(urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): 'low' | 'normal' | 'high' | 'critical' {
        const mapping: Record<string, 'low' | 'normal' | 'high' | 'critical'> = {
            'LOW': 'low',
            'MEDIUM': 'normal',
            'HIGH': 'high',
            'CRITICAL': 'critical',
        };
        return mapping[urgency ?? 'MEDIUM'] ?? 'normal';
    }

    /**
     * Clear all results (for testing).
     */
    clear(): void {
        this.results.clear();
        this.hitlToUnified.clear();
        this.councilToUnified.clear();
    }
}
