/**
 * HITL Routing Engine
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.4: HITL Routing Engine
 *
 * Routes decisions to appropriate human reviewers based on risk and urgency.
 */

import { EventEmitter } from 'eventemitter3';
import type { ActionRequest, GateResult, RiskLevel } from './TrustGateEngine.js';

// ============================================================================
// Types
// ============================================================================

export type ReviewerRole = 'operator' | 'supervisor' | 'director' | 'security_team';
export type UrgencyLevel = 'low' | 'normal' | 'high' | 'immediate';
export type HITLStatus = 'pending' | 'assigned' | 'in_review' | 'decided' | 'expired' | 'escalated';

export interface Reviewer {
    id: string;
    name: string;
    role: ReviewerRole;
    email?: string;
    orgId: string;
    isAvailable: boolean;
    currentLoad: number;
    maxLoad: number;
    specializations?: string[];
}

export interface HITLRequest {
    id: string;
    requestId: string;
    request: ActionRequest;
    gateResult: GateResult;
    riskLevel: RiskLevel;
    urgency: UrgencyLevel;
    status: HITLStatus;
    assignedTo?: string[];
    requiredApprovers: number;
    approvals: HITLApproval[];
    escalationLevel: number;
    createdAt: Date;
    assignedAt?: Date;
    decidedAt?: Date;
    expiresAt: Date;
    decision?: 'approved' | 'denied';
    metadata?: Record<string, unknown>;
}

export interface HITLApproval {
    reviewerId: string;
    reviewerName: string;
    reviewerRole: ReviewerRole;
    decision: 'approved' | 'denied';
    reasoning: string;
    approvedAt: Date;
}

export interface RoutingRule {
    riskLevel: RiskLevel;
    urgency?: UrgencyLevel;
    routeTo: ReviewerRole[];
    requiredApprovers: number;
    notifyRoles?: ReviewerRole[];
    timeoutMinutes: number;
    autoEscalateAfter?: number;
}

export interface HITLConfig {
    /** Default timeout in minutes */
    defaultTimeoutMinutes: number;
    /** Auto-escalation enabled */
    autoEscalate: boolean;
    /** Escalation timeout in minutes */
    escalationTimeoutMinutes: number;
    /** Max escalation levels */
    maxEscalationLevel: number;
    /** Load balance across reviewers */
    loadBalance: boolean;
}

interface RouterEvents {
    'request:created': (request: HITLRequest) => void;
    'request:assigned': (request: HITLRequest, reviewers: Reviewer[]) => void;
    'request:approved': (request: HITLRequest, approval: HITLApproval) => void;
    'request:denied': (request: HITLRequest, approval: HITLApproval) => void;
    'request:decided': (request: HITLRequest) => void;
    'request:escalated': (request: HITLRequest) => void;
    'request:expired': (request: HITLRequest) => void;
    'notification:send': (type: string, recipients: string[], data: Record<string, unknown>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: HITLConfig = {
    defaultTimeoutMinutes: 30,
    autoEscalate: true,
    escalationTimeoutMinutes: 15,
    maxEscalationLevel: 3,
    loadBalance: true,
};

const DEFAULT_ROUTING_RULES: RoutingRule[] = [
    {
        riskLevel: 'low',
        routeTo: ['operator'],
        requiredApprovers: 1,
        timeoutMinutes: 60,
    },
    {
        riskLevel: 'medium',
        urgency: 'low',
        routeTo: ['operator'],
        requiredApprovers: 1,
        timeoutMinutes: 30,
    },
    {
        riskLevel: 'medium',
        urgency: 'normal',
        routeTo: ['operator'],
        requiredApprovers: 1,
        timeoutMinutes: 30,
    },
    {
        riskLevel: 'medium',
        urgency: 'high',
        routeTo: ['supervisor'],
        requiredApprovers: 1,
        notifyRoles: ['operator'],
        timeoutMinutes: 15,
    },
    {
        riskLevel: 'high',
        routeTo: ['supervisor'],
        requiredApprovers: 1,
        notifyRoles: ['operator', 'director'],
        timeoutMinutes: 15,
        autoEscalateAfter: 10,
    },
    {
        riskLevel: 'critical',
        routeTo: ['director'],
        requiredApprovers: 2,
        notifyRoles: ['supervisor', 'security_team'],
        timeoutMinutes: 10,
        autoEscalateAfter: 5,
    },
];

const ESCALATION_PATH: ReviewerRole[] = ['operator', 'supervisor', 'director', 'security_team'];

// ============================================================================
// HITL Router
// ============================================================================

export class HITLRouter extends EventEmitter<RouterEvents> {
    private config: HITLConfig;
    private routingRules: RoutingRule[];

    // Reviewers by org
    private reviewers: Map<string, Map<string, Reviewer>> = new Map();

    // HITL requests
    private requests: Map<string, HITLRequest> = new Map();
    private requestsByRequestId: Map<string, string> = new Map();
    private requestsByReviewer: Map<string, string[]> = new Map();

    // Timeouts
    private timeouts: Map<string, NodeJS.Timeout> = new Map();
    private escalationTimeouts: Map<string, NodeJS.Timeout> = new Map();

    constructor(config: Partial<HITLConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.routingRules = [...DEFAULT_ROUTING_RULES];
    }

    // =========================================================================
    // Request Routing
    // =========================================================================

    /**
     * Route a request to HITL review
     */
    routeToHuman(
        request: ActionRequest,
        gateResult: GateResult,
        urgency: UrgencyLevel = 'normal'
    ): HITLRequest {
        // Find matching routing rule
        const rule = this.findRoutingRule(gateResult.riskLevel, urgency);
        const timeoutMinutes = rule?.timeoutMinutes || this.config.defaultTimeoutMinutes;

        const hitlRequest: HITLRequest = {
            id: this.generateRequestId(),
            requestId: request.id,
            request,
            gateResult,
            riskLevel: gateResult.riskLevel,
            urgency,
            status: 'pending',
            requiredApprovers: rule?.requiredApprovers || 1,
            approvals: [],
            escalationLevel: 0,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + timeoutMinutes * 60 * 1000),
        };

        // Store request
        this.requests.set(hitlRequest.id, hitlRequest);
        this.requestsByRequestId.set(request.id, hitlRequest.id);

        this.emit('request:created', hitlRequest);

        // Assign reviewers
        this.assignReviewers(hitlRequest, rule);

        // Set timeout
        this.setRequestTimeout(hitlRequest);

        // Set escalation timeout if configured
        if (rule?.autoEscalateAfter && this.config.autoEscalate) {
            this.setEscalationTimeout(hitlRequest, rule.autoEscalateAfter);
        }

        // Send notifications
        if (rule?.notifyRoles) {
            this.notifyRoles(hitlRequest, rule.notifyRoles);
        }

        return hitlRequest;
    }

    /**
     * Submit an approval/denial decision
     */
    submitDecision(
        hitlRequestId: string,
        reviewerId: string,
        decision: 'approved' | 'denied',
        reasoning: string
    ): boolean {
        const hitlRequest = this.requests.get(hitlRequestId);
        if (!hitlRequest) return false;

        if (hitlRequest.status === 'decided' || hitlRequest.status === 'expired') {
            return false;
        }

        // Verify reviewer is assigned
        if (!hitlRequest.assignedTo?.includes(reviewerId)) {
            return false;
        }

        // Check for duplicate decision
        if (hitlRequest.approvals.some(a => a.reviewerId === reviewerId)) {
            return false;
        }

        // Get reviewer info
        const reviewer = this.getReviewer(reviewerId, hitlRequest.request.orgId);
        if (!reviewer) return false;

        const approval: HITLApproval = {
            reviewerId,
            reviewerName: reviewer.name,
            reviewerRole: reviewer.role,
            decision,
            reasoning,
            approvedAt: new Date(),
        };

        hitlRequest.approvals.push(approval);
        hitlRequest.status = 'in_review';

        if (decision === 'approved') {
            this.emit('request:approved', hitlRequest, approval);
        } else {
            this.emit('request:denied', hitlRequest, approval);
        }

        // Check if we have enough approvals
        this.checkDecisionComplete(hitlRequest);

        return true;
    }

    /**
     * Escalate a request to next level
     */
    escalate(hitlRequestId: string, reason?: string): boolean {
        const hitlRequest = this.requests.get(hitlRequestId);
        if (!hitlRequest) return false;

        if (hitlRequest.status === 'decided' || hitlRequest.status === 'expired') {
            return false;
        }

        if (hitlRequest.escalationLevel >= this.config.maxEscalationLevel) {
            return false;
        }

        hitlRequest.escalationLevel++;
        hitlRequest.status = 'escalated';

        // Clear existing timeouts
        this.clearRequestTimeout(hitlRequestId);
        this.clearEscalationTimeout(hitlRequestId);

        // Find next escalation role
        const currentRoles = hitlRequest.assignedTo
            ?.map(id => this.getReviewer(id, hitlRequest.request.orgId)?.role)
            .filter(Boolean) as ReviewerRole[];

        const nextRole = this.getNextEscalationRole(currentRoles);

        if (nextRole) {
            // Assign new reviewers at escalation level
            const escalationRule: RoutingRule = {
                riskLevel: hitlRequest.riskLevel,
                routeTo: [nextRole],
                requiredApprovers: 1,
                timeoutMinutes: this.config.escalationTimeoutMinutes,
            };

            this.assignReviewers(hitlRequest, escalationRule, true);
        }

        // Reset timeouts
        this.setRequestTimeout(hitlRequest);

        this.emit('request:escalated', hitlRequest);

        // Send escalation notification
        this.emit('notification:send', 'escalation', [], {
            requestId: hitlRequest.id,
            escalationLevel: hitlRequest.escalationLevel,
            reason,
        });

        return true;
    }

    // =========================================================================
    // Reviewer Management
    // =========================================================================

    /**
     * Register a reviewer
     */
    registerReviewer(reviewer: Reviewer): void {
        if (!this.reviewers.has(reviewer.orgId)) {
            this.reviewers.set(reviewer.orgId, new Map());
        }
        this.reviewers.get(reviewer.orgId)!.set(reviewer.id, reviewer);
    }

    /**
     * Unregister a reviewer
     */
    unregisterReviewer(reviewerId: string, orgId: string): void {
        this.reviewers.get(orgId)?.delete(reviewerId);
    }

    /**
     * Get a reviewer by ID
     */
    getReviewer(reviewerId: string, orgId: string): Reviewer | null {
        return this.reviewers.get(orgId)?.get(reviewerId) || null;
    }

    /**
     * Get reviewers by role
     */
    getReviewersByRole(role: ReviewerRole, orgId: string): Reviewer[] {
        const orgReviewers = this.reviewers.get(orgId);
        if (!orgReviewers) return [];

        return Array.from(orgReviewers.values()).filter(r => r.role === role);
    }

    /**
     * Get available reviewers by role
     */
    getAvailableReviewers(role: ReviewerRole, orgId: string): Reviewer[] {
        return this.getReviewersByRole(role, orgId)
            .filter(r => r.isAvailable && r.currentLoad < r.maxLoad);
    }

    /**
     * Update reviewer availability
     */
    setReviewerAvailability(reviewerId: string, orgId: string, isAvailable: boolean): void {
        const reviewer = this.getReviewer(reviewerId, orgId);
        if (reviewer) {
            reviewer.isAvailable = isAvailable;
        }
    }

    // =========================================================================
    // Request Management
    // =========================================================================

    /**
     * Get HITL request by ID
     */
    getRequest(hitlRequestId: string): HITLRequest | null {
        return this.requests.get(hitlRequestId) || null;
    }

    /**
     * Get HITL request by original request ID
     */
    getRequestByRequestId(requestId: string): HITLRequest | null {
        const hitlId = this.requestsByRequestId.get(requestId);
        if (!hitlId) return null;
        return this.requests.get(hitlId) || null;
    }

    /**
     * Get pending requests for a reviewer
     */
    getReviewerQueue(reviewerId: string): HITLRequest[] {
        const requestIds = this.requestsByReviewer.get(reviewerId) || [];
        return requestIds
            .map(id => this.requests.get(id))
            .filter((r): r is HITLRequest => r !== undefined && r.status !== 'decided' && r.status !== 'expired')
            .sort((a, b) => {
                // Sort by urgency then creation time
                const urgencyOrder = { immediate: 0, high: 1, normal: 2, low: 3 };
                const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
                if (urgencyDiff !== 0) return urgencyDiff;
                return a.createdAt.getTime() - b.createdAt.getTime();
            });
    }

    /**
     * Get all pending requests
     */
    getPendingRequests(orgId?: string): HITLRequest[] {
        return Array.from(this.requests.values())
            .filter(r => {
                if (r.status === 'decided' || r.status === 'expired') return false;
                if (orgId && r.request.orgId !== orgId) return false;
                return true;
            })
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    // =========================================================================
    // Routing Rules
    // =========================================================================

    /**
     * Add a routing rule
     */
    addRoutingRule(rule: RoutingRule): void {
        this.routingRules.push(rule);
    }

    /**
     * Set routing rules (replaces defaults)
     */
    setRoutingRules(rules: RoutingRule[]): void {
        this.routingRules = rules;
    }

    /**
     * Get routing rules
     */
    getRoutingRules(): RoutingRule[] {
        return [...this.routingRules];
    }

    /**
     * Find matching routing rule
     */
    findRoutingRule(riskLevel: RiskLevel, urgency?: UrgencyLevel): RoutingRule | null {
        // First try exact match
        let rule = this.routingRules.find(
            r => r.riskLevel === riskLevel && r.urgency === urgency
        );

        // Fall back to risk level only
        if (!rule) {
            rule = this.routingRules.find(
                r => r.riskLevel === riskLevel && !r.urgency
            );
        }

        return rule || null;
    }

    // =========================================================================
    // Configuration
    // =========================================================================

    /**
     * Update configuration
     */
    updateConfig(config: Partial<HITLConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): HITLConfig {
        return { ...this.config };
    }

    // =========================================================================
    // Statistics
    // =========================================================================

    /**
     * Get router statistics
     */
    getStats(orgId?: string): {
        totalRequests: number;
        pendingRequests: number;
        decidedRequests: number;
        expiredRequests: number;
        escalatedRequests: number;
        avgDecisionTimeMs: number;
        approvalRate: number;
    } {
        let requests = Array.from(this.requests.values());
        if (orgId) {
            requests = requests.filter(r => r.request.orgId === orgId);
        }

        const decided = requests.filter(r => r.status === 'decided');
        const approved = decided.filter(r => r.decision === 'approved');

        let totalDecisionTime = 0;
        for (const r of decided) {
            if (r.decidedAt && r.createdAt) {
                totalDecisionTime += r.decidedAt.getTime() - r.createdAt.getTime();
            }
        }

        return {
            totalRequests: requests.length,
            pendingRequests: requests.filter(r => r.status === 'pending' || r.status === 'assigned' || r.status === 'in_review').length,
            decidedRequests: decided.length,
            expiredRequests: requests.filter(r => r.status === 'expired').length,
            escalatedRequests: requests.filter(r => r.escalationLevel > 0).length,
            avgDecisionTimeMs: decided.length > 0 ? totalDecisionTime / decided.length : 0,
            approvalRate: decided.length > 0 ? approved.length / decided.length : 0,
        };
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    private assignReviewers(hitlRequest: HITLRequest, rule: RoutingRule | null, append = false): void {
        const orgId = hitlRequest.request.orgId;
        const reviewers: Reviewer[] = [];

        if (rule) {
            for (const role of rule.routeTo) {
                const available = this.getAvailableReviewers(role, orgId);

                if (this.config.loadBalance) {
                    // Sort by current load (ascending)
                    available.sort((a, b) => a.currentLoad - b.currentLoad);
                }

                if (available.length > 0) {
                    reviewers.push(available[0]);
                }
            }
        }

        if (reviewers.length > 0) {
            if (append && hitlRequest.assignedTo) {
                hitlRequest.assignedTo.push(...reviewers.map(r => r.id));
                // Preserve escalated status when appending
            } else {
                hitlRequest.assignedTo = reviewers.map(r => r.id);
                hitlRequest.status = 'assigned';
            }
            hitlRequest.assignedAt = new Date();

            // Update reviewer loads
            for (const reviewer of reviewers) {
                reviewer.currentLoad++;
                const reviewerRequests = this.requestsByReviewer.get(reviewer.id) || [];
                reviewerRequests.push(hitlRequest.id);
                this.requestsByReviewer.set(reviewer.id, reviewerRequests);
            }

            this.emit('request:assigned', hitlRequest, reviewers);
        }
    }

    private notifyRoles(hitlRequest: HITLRequest, roles: ReviewerRole[]): void {
        const orgId = hitlRequest.request.orgId;
        const recipients: string[] = [];

        for (const role of roles) {
            const reviewers = this.getReviewersByRole(role, orgId);
            for (const r of reviewers) {
                if (r.email) recipients.push(r.email);
            }
        }

        if (recipients.length > 0) {
            this.emit('notification:send', 'hitl_request', recipients, {
                requestId: hitlRequest.id,
                riskLevel: hitlRequest.riskLevel,
                urgency: hitlRequest.urgency,
            });
        }
    }

    private checkDecisionComplete(hitlRequest: HITLRequest): void {
        const approvals = hitlRequest.approvals;

        // Check for any denial - immediate denial
        const denials = approvals.filter(a => a.decision === 'denied');
        if (denials.length > 0) {
            this.completeRequest(hitlRequest, 'denied');
            return;
        }

        // Check if we have enough approvals
        const approvedCount = approvals.filter(a => a.decision === 'approved').length;
        if (approvedCount >= hitlRequest.requiredApprovers) {
            this.completeRequest(hitlRequest, 'approved');
        }
    }

    private completeRequest(hitlRequest: HITLRequest, decision: 'approved' | 'denied'): void {
        hitlRequest.status = 'decided';
        hitlRequest.decision = decision;
        hitlRequest.decidedAt = new Date();

        // Clear timeouts
        this.clearRequestTimeout(hitlRequest.id);
        this.clearEscalationTimeout(hitlRequest.id);

        // Update reviewer loads
        if (hitlRequest.assignedTo) {
            for (const reviewerId of hitlRequest.assignedTo) {
                const reviewer = this.getReviewer(reviewerId, hitlRequest.request.orgId);
                if (reviewer && reviewer.currentLoad > 0) {
                    reviewer.currentLoad--;
                }
            }
        }

        this.emit('request:decided', hitlRequest);
    }

    private setRequestTimeout(hitlRequest: HITLRequest): void {
        const timeoutMs = hitlRequest.expiresAt.getTime() - Date.now();
        if (timeoutMs <= 0) {
            this.expireRequest(hitlRequest.id);
            return;
        }

        const timeout = setTimeout(() => {
            this.expireRequest(hitlRequest.id);
        }, timeoutMs);

        this.timeouts.set(hitlRequest.id, timeout);
    }

    private clearRequestTimeout(requestId: string): void {
        const timeout = this.timeouts.get(requestId);
        if (timeout) {
            clearTimeout(timeout);
            this.timeouts.delete(requestId);
        }
    }

    private setEscalationTimeout(hitlRequest: HITLRequest, minutes: number): void {
        const timeout = setTimeout(() => {
            if (hitlRequest.status !== 'decided' && hitlRequest.status !== 'expired') {
                this.escalate(hitlRequest.id, 'Auto-escalation due to timeout');
            }
        }, minutes * 60 * 1000);

        this.escalationTimeouts.set(hitlRequest.id, timeout);
    }

    private clearEscalationTimeout(requestId: string): void {
        const timeout = this.escalationTimeouts.get(requestId);
        if (timeout) {
            clearTimeout(timeout);
            this.escalationTimeouts.delete(requestId);
        }
    }

    private expireRequest(requestId: string): void {
        const hitlRequest = this.requests.get(requestId);
        if (!hitlRequest) return;

        if (hitlRequest.status === 'decided') return;

        hitlRequest.status = 'expired';
        hitlRequest.decidedAt = new Date();

        this.clearEscalationTimeout(requestId);

        // Update reviewer loads
        if (hitlRequest.assignedTo) {
            for (const reviewerId of hitlRequest.assignedTo) {
                const reviewer = this.getReviewer(reviewerId, hitlRequest.request.orgId);
                if (reviewer && reviewer.currentLoad > 0) {
                    reviewer.currentLoad--;
                }
            }
        }

        this.emit('request:expired', hitlRequest);
    }

    private getNextEscalationRole(currentRoles: ReviewerRole[]): ReviewerRole | null {
        // Find highest current role index
        let highestIndex = -1;
        for (const role of currentRoles) {
            const index = ESCALATION_PATH.indexOf(role);
            if (index > highestIndex) {
                highestIndex = index;
            }
        }

        // Return next role in path
        const nextIndex = highestIndex + 1;
        if (nextIndex < ESCALATION_PATH.length) {
            return ESCALATION_PATH[nextIndex];
        }

        return null;
    }

    private generateRequestId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `hitl_${timestamp}_${random}`;
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
        for (const timeout of this.escalationTimeouts.values()) {
            clearTimeout(timeout);
        }

        this.requests.clear();
        this.requestsByRequestId.clear();
        this.requestsByReviewer.clear();
        this.reviewers.clear();
        this.timeouts.clear();
        this.escalationTimeouts.clear();
    }

    /**
     * Get request count
     */
    get requestCount(): number {
        return this.requests.size;
    }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: HITLRouter | null = null;

export function getHITLRouter(config?: Partial<HITLConfig>): HITLRouter {
    if (!instance) {
        instance = new HITLRouter(config);
    }
    return instance;
}

export function resetHITLRouter(): void {
    if (instance) {
        instance.clear();
    }
    instance = null;
}

export default HITLRouter;
