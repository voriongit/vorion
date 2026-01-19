/**
 * Delegation Manager
 *
 * TRUST-4.2 through TRUST-4.5: Manages temporary capability delegation.
 * Handles request creation, auto-approval, routing, and active delegation management.
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import type { AgentId, AgentTier, TrustLevel } from '../../types.js';
import type { Permission } from '../SecurityLayer.js';
import { securityLayer } from '../SecurityLayer.js';
import { trustEngine } from '../TrustEngine.js';
import { FEATURES } from '../config/features.js';
import type {
    DelegationRequest,
    ActiveDelegation,
    DelegationHistory,
    DelegationConfig,
    DelegationEvents,
    DelegationStats,
    CreateDelegationRequest,
    AutoApprovalCheck,
    ApprovalSource,
} from './types.js';
import {
    DEFAULT_DELEGATION_CONFIG,
    RESTRICTED_CAPABILITIES,
} from './types.js';

// ============================================================================
// Errors
// ============================================================================

export class DelegationError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'DelegationError';
    }
}

// ============================================================================
// Valid Permissions
// ============================================================================

const VALID_PERMISSIONS: Permission[] = [
    'HITL_MODIFY',
    'TRUST_REWARD',
    'TRUST_PENALIZE',
    'SPAWN_AGENT',
    'VIEW_AUDIT_LOG',
    'SYSTEM_CONFIG',
    'BLACKBOARD_POST',
    'BLACKBOARD_RESOLVE',
    'AGENT_TERMINATE',
];

// ============================================================================
// Delegation Manager
// ============================================================================

export class DelegationManager extends EventEmitter<DelegationEvents> {
    private requests: Map<string, DelegationRequest> = new Map();
    private activeDelegations: Map<AgentId, ActiveDelegation[]> = new Map();
    private history: DelegationHistory[] = [];
    private config: DelegationConfig;

    // Cleanup interval for expired delegations
    private cleanupInterval?: NodeJS.Timeout;

    constructor(config: Partial<DelegationConfig> = {}) {
        super();
        this.config = { ...DEFAULT_DELEGATION_CONFIG, ...config };
    }

    /**
     * Start automatic cleanup of expired delegations.
     */
    startCleanupInterval(intervalMs: number = 60000): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpired();
        }, intervalMs);
    }

    /**
     * Stop automatic cleanup.
     */
    stopCleanupInterval(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
    }

    // -------------------------------------------------------------------------
    // TRUST-4.2: Delegation Request Creation
    // -------------------------------------------------------------------------

    /**
     * Request temporary capabilities for an agent.
     */
    async requestCapabilities(params: CreateDelegationRequest): Promise<DelegationRequest> {
        const { agentId, capabilities, reason, duration, context = {} } = params;

        // Validate duration
        if (duration <= 0) {
            throw new DelegationError(
                'Duration must be positive',
                'INVALID_DURATION'
            );
        }

        if (duration > this.config.maxDurationMs) {
            throw new DelegationError(
                `Duration exceeds maximum (${this.config.maxDurationMs}ms)`,
                'DURATION_EXCEEDED'
            );
        }

        // Validate capabilities
        for (const cap of capabilities) {
            if (!this.isValidPermission(cap)) {
                throw new DelegationError(
                    `Invalid capability: ${cap}`,
                    'INVALID_CAPABILITY'
                );
            }
        }

        if (capabilities.length === 0) {
            throw new DelegationError(
                'At least one capability must be requested',
                'NO_CAPABILITIES'
            );
        }

        // Validate reason
        if (!reason || reason.trim().length === 0) {
            throw new DelegationError(
                'Reason is required',
                'REASON_REQUIRED'
            );
        }

        // Get agent's track record
        const trust = trustEngine.getTrust(agentId);
        const tier = trust ? this.levelToTier(trust.level) : 0;
        const successRate = await this.getSuccessRate(agentId);
        const similarApprovals = await this.getSimilarApprovals(agentId, capabilities);

        const request: DelegationRequest = {
            id: uuidv4(),
            requesterId: agentId,
            requestedCapabilities: [...capabilities],
            reason: reason.trim(),
            duration,
            context,
            status: 'pending',
            createdAt: new Date(),
            requesterSuccessRate: successRate,
            requesterTier: tier as AgentTier,
            similarRequestsApproved: similarApprovals,
        };

        this.requests.set(request.id, request);
        this.emit('delegation:requested', request);

        // Log to audit
        securityLayer.logAudit({
            action: 'TASK_DELEGATED',
            actor: { type: 'AGENT', id: agentId, tier: tier as AgentTier },
            details: {
                requestId: request.id,
                capabilities,
                duration,
                reason,
            },
            outcome: 'SUCCESS',
        });

        // TRUST-4.3 & 4.4: Process the request
        return this.processRequest(request);
    }

    /**
     * Check if a permission is valid.
     */
    private isValidPermission(permission: Permission): boolean {
        return VALID_PERMISSIONS.includes(permission);
    }

    /**
     * Get agent's historical success rate.
     */
    private async getSuccessRate(agentId: AgentId): Promise<number> {
        const agentHistory = this.history.filter(h => h.agentId === agentId);

        if (agentHistory.length === 0) {
            return 0.5; // Default for new agents
        }

        const successCount = agentHistory.filter(h => h.wasSuccessful).length;
        return successCount / agentHistory.length;
    }

    /**
     * Get count of similar requests that were approved.
     */
    private async getSimilarApprovals(
        agentId: AgentId,
        capabilities: Permission[]
    ): Promise<number> {
        const capSet = new Set(capabilities);

        return this.history.filter(h => {
            if (h.agentId !== agentId) return false;
            if (h.outcome !== 'completed') return false;
            if (!h.wasSuccessful) return false;

            // Check if capabilities overlap
            return h.capabilities.some(c => capSet.has(c));
        }).length;
    }

    // -------------------------------------------------------------------------
    // TRUST-4.3: Auto-Approval Logic
    // -------------------------------------------------------------------------

    /**
     * Check if a request can be auto-approved.
     */
    checkAutoApproval(request: DelegationRequest): AutoApprovalCheck {
        const reasons: string[] = [];

        if (!this.config.enableAutoApproval) {
            return { canAutoApprove: false, reasons: ['Auto-approval disabled'] };
        }

        if (!FEATURES.isEnabled('ENABLE_DELEGATION')) {
            return { canAutoApprove: false, reasons: ['Delegation feature disabled'] };
        }

        // Check tier
        if (request.requesterTier < this.config.minAutoApproveTier) {
            reasons.push(`Tier ${request.requesterTier} below minimum ${this.config.minAutoApproveTier}`);
        }

        // Check success rate
        if (request.requesterSuccessRate < this.config.minAutoApproveSuccessRate) {
            reasons.push(`Success rate ${(request.requesterSuccessRate * 100).toFixed(1)}% below ${this.config.minAutoApproveSuccessRate * 100}%`);
        }

        // Check similar approvals
        if (request.similarRequestsApproved < this.config.minSimilarApprovals) {
            reasons.push(`Only ${request.similarRequestsApproved} similar approvals (need ${this.config.minSimilarApprovals})`);
        }

        // Check duration
        if (request.duration > this.config.maxAutoApproveDurationMs) {
            reasons.push(`Duration ${request.duration}ms exceeds auto-approve limit ${this.config.maxAutoApproveDurationMs}ms`);
        }

        // Check for restricted capabilities
        const restricted = request.requestedCapabilities.filter(c =>
            this.config.restrictedCapabilities.includes(c)
        );
        if (restricted.length > 0) {
            reasons.push(`Restricted capabilities: ${restricted.join(', ')}`);
        }

        return {
            canAutoApprove: reasons.length === 0,
            reasons,
        };
    }

    /**
     * Auto-approve a request.
     */
    private async autoApprove(request: DelegationRequest): Promise<DelegationRequest> {
        request.status = 'approved';
        request.approvedBy = 'AUTO';
        request.approvedAt = new Date();
        request.expiresAt = new Date(Date.now() + request.duration);

        const delegation = await this.createActiveDelegation(request);

        securityLayer.logAudit({
            action: 'TASK_DELEGATED',
            actor: { type: 'SYSTEM', id: 'DELEGATION_MANAGER' },
            target: { type: 'AGENT', id: request.requesterId },
            details: {
                requestId: request.id,
                delegationId: delegation.id,
                autoApproved: true,
            },
            outcome: 'SUCCESS',
        });

        this.emit('delegation:auto-approved', request, delegation);

        return request;
    }

    // -------------------------------------------------------------------------
    // TRUST-4.4: Delegation Approval Routing
    // -------------------------------------------------------------------------

    /**
     * Process a delegation request (auto-approve or route for approval).
     */
    private async processRequest(request: DelegationRequest): Promise<DelegationRequest> {
        const autoCheck = this.checkAutoApproval(request);

        if (autoCheck.canAutoApprove) {
            return this.autoApprove(request);
        }

        // For now, we'll leave the request pending
        // In a full implementation, this would route to HITL or Council
        // based on the current HITL level

        // The integration with HITLGateway/CouncilGatewayIntegration
        // would happen here, but we keep the request pending for manual handling
        return request;
    }

    /**
     * Manually approve a request.
     */
    async approveRequest(
        requestId: string,
        approvedBy: ApprovalSource,
        _reason?: string
    ): Promise<DelegationRequest> {
        const request = this.requests.get(requestId);
        if (!request) {
            throw new DelegationError(
                `Request ${requestId} not found`,
                'REQUEST_NOT_FOUND'
            );
        }

        if (request.status !== 'pending') {
            throw new DelegationError(
                `Request is already ${request.status}`,
                'REQUEST_NOT_PENDING'
            );
        }

        request.status = 'approved';
        request.approvedBy = approvedBy;
        request.approvedAt = new Date();
        request.expiresAt = new Date(Date.now() + request.duration);

        const delegation = await this.createActiveDelegation(request);

        securityLayer.logAudit({
            action: 'TASK_DELEGATED',
            actor: { type: 'SYSTEM', id: 'DELEGATION_MANAGER' },
            target: { type: 'AGENT', id: request.requesterId },
            details: {
                requestId: request.id,
                delegationId: delegation.id,
                approvedBy,
            },
            outcome: 'SUCCESS',
        });

        this.emit('delegation:approved', request, delegation);

        return request;
    }

    /**
     * Reject a delegation request.
     */
    async rejectRequest(requestId: string, reason: string): Promise<DelegationRequest> {
        const request = this.requests.get(requestId);
        if (!request) {
            throw new DelegationError(
                `Request ${requestId} not found`,
                'REQUEST_NOT_FOUND'
            );
        }

        if (request.status !== 'pending') {
            throw new DelegationError(
                `Request is already ${request.status}`,
                'REQUEST_NOT_PENDING'
            );
        }

        request.status = 'rejected';
        request.rejectionReason = reason;

        securityLayer.logAudit({
            action: 'TASK_DELEGATED',
            actor: { type: 'SYSTEM', id: 'DELEGATION_MANAGER' },
            target: { type: 'AGENT', id: request.requesterId },
            details: {
                requestId: request.id,
                rejected: true,
                reason,
            },
            outcome: 'DENIED',
            reason,
        });

        this.emit('delegation:rejected', request, reason);

        return request;
    }

    // -------------------------------------------------------------------------
    // TRUST-4.5: Active Delegation Management
    // -------------------------------------------------------------------------

    /**
     * Create an active delegation from an approved request.
     */
    private async createActiveDelegation(request: DelegationRequest): Promise<ActiveDelegation> {
        const delegation: ActiveDelegation = {
            id: uuidv4(),
            agentId: request.requesterId,
            capabilities: [...request.requestedCapabilities],
            grantedAt: new Date(),
            expiresAt: request.expiresAt!,
            reason: request.reason,
            approvedBy: request.approvedBy!,
            requestId: request.id,
            usageCount: 0,
        };

        const agentDelegations = this.activeDelegations.get(request.requesterId) ?? [];
        agentDelegations.push(delegation);
        this.activeDelegations.set(request.requesterId, agentDelegations);

        return delegation;
    }

    /**
     * Check if an agent has a capability (base or delegated).
     */
    async checkCapability(agentId: AgentId, capability: Permission): Promise<boolean> {
        // Check base permissions via token
        // (In a full implementation, we'd check the agent's token)

        // Check delegated permissions
        const delegations = this.getActiveDelegations(agentId);
        const now = new Date();

        for (const delegation of delegations) {
            if (delegation.expiresAt > now && delegation.capabilities.includes(capability)) {
                // Track usage if enabled
                if (this.config.trackUsage) {
                    delegation.usageCount++;
                    delegation.lastUsedAt = now;
                    this.emit('delegation:used', delegation, capability);
                }
                return true;
            }
        }

        return false;
    }

    /**
     * Get active delegations for an agent.
     */
    getActiveDelegations(agentId: AgentId): ActiveDelegation[] {
        const delegations = this.activeDelegations.get(agentId) ?? [];
        const now = new Date();

        // Filter out expired (but don't remove yet - cleanup handles that)
        return delegations.filter(d => d.expiresAt > now);
    }

    /**
     * Get all active delegations across all agents.
     */
    getAllActiveDelegations(): ActiveDelegation[] {
        const all: ActiveDelegation[] = [];
        const now = new Date();

        for (const delegations of this.activeDelegations.values()) {
            for (const d of delegations) {
                if (d.expiresAt > now) {
                    all.push(d);
                }
            }
        }

        return all;
    }

    /**
     * Revoke a delegation.
     */
    async revokeDelegation(delegationId: string, reason: string): Promise<boolean> {
        for (const [agentId, delegations] of this.activeDelegations) {
            const delegation = delegations.find(d => d.id === delegationId);
            if (delegation) {
                const index = delegations.indexOf(delegation);
                delegations.splice(index, 1);

                if (delegations.length === 0) {
                    this.activeDelegations.delete(agentId);
                }

                // Update the original request
                const request = this.requests.get(delegation.requestId);
                if (request) {
                    request.status = 'revoked';
                    request.revokedAt = new Date();
                    request.revocationReason = reason;
                }

                // Add to history
                this.history.push({
                    requestId: delegation.requestId,
                    agentId: delegation.agentId,
                    capabilities: delegation.capabilities,
                    duration: delegation.expiresAt.getTime() - delegation.grantedAt.getTime(),
                    outcome: 'revoked',
                    wasSuccessful: false,
                    issues: [reason],
                    startedAt: delegation.grantedAt,
                    endedAt: new Date(),
                });

                securityLayer.logAudit({
                    action: 'TASK_DELEGATED',
                    actor: { type: 'SYSTEM', id: 'DELEGATION_MANAGER' },
                    target: { type: 'AGENT', id: agentId },
                    details: {
                        delegationId,
                        revoked: true,
                        reason,
                    },
                    outcome: 'SUCCESS',
                });

                this.emit('delegation:revoked', delegation, reason);
                return true;
            }
        }

        return false;
    }

    /**
     * Clean up expired delegations.
     */
    cleanupExpired(): number {
        const now = new Date();
        let cleaned = 0;

        for (const [agentId, delegations] of this.activeDelegations) {
            const expired = delegations.filter(d => d.expiresAt <= now);

            for (const delegation of expired) {
                const index = delegations.indexOf(delegation);
                if (index !== -1) {
                    delegations.splice(index, 1);
                    cleaned++;

                    // Update request status
                    const request = this.requests.get(delegation.requestId);
                    if (request && request.status === 'approved') {
                        request.status = 'expired';
                    }

                    // Add to history
                    this.history.push({
                        requestId: delegation.requestId,
                        agentId: delegation.agentId,
                        capabilities: delegation.capabilities,
                        duration: delegation.expiresAt.getTime() - delegation.grantedAt.getTime(),
                        outcome: 'expired',
                        wasSuccessful: true, // Assume success if expired naturally
                        startedAt: delegation.grantedAt,
                        endedAt: delegation.expiresAt,
                    });

                    this.emit('delegation:expired', delegation);
                }
            }

            if (delegations.length === 0) {
                this.activeDelegations.delete(agentId);
            }
        }

        return cleaned;
    }

    /**
     * Mark a delegation as successfully completed.
     */
    markSuccess(delegationId: string): boolean {
        for (const delegations of this.activeDelegations.values()) {
            const delegation = delegations.find(d => d.id === delegationId);
            if (delegation) {
                // Add to history as completed
                this.history.push({
                    requestId: delegation.requestId,
                    agentId: delegation.agentId,
                    capabilities: delegation.capabilities,
                    duration: Date.now() - delegation.grantedAt.getTime(),
                    outcome: 'completed',
                    wasSuccessful: true,
                    startedAt: delegation.grantedAt,
                    endedAt: new Date(),
                });
                return true;
            }
        }
        return false;
    }

    /**
     * Mark a delegation as failed.
     */
    markFailure(delegationId: string, issues: string[]): boolean {
        for (const delegations of this.activeDelegations.values()) {
            const delegation = delegations.find(d => d.id === delegationId);
            if (delegation) {
                // Add to history as failed
                this.history.push({
                    requestId: delegation.requestId,
                    agentId: delegation.agentId,
                    capabilities: delegation.capabilities,
                    duration: Date.now() - delegation.grantedAt.getTime(),
                    outcome: 'completed',
                    wasSuccessful: false,
                    issues,
                    startedAt: delegation.grantedAt,
                    endedAt: new Date(),
                });
                return true;
            }
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // Query Methods
    // -------------------------------------------------------------------------

    /**
     * Get a request by ID.
     */
    getRequest(requestId: string): DelegationRequest | undefined {
        return this.requests.get(requestId);
    }

    /**
     * Get pending requests.
     */
    getPendingRequests(): DelegationRequest[] {
        return [...this.requests.values()].filter(r => r.status === 'pending');
    }

    /**
     * Get requests by agent.
     */
    getRequestsByAgent(agentId: AgentId): DelegationRequest[] {
        return [...this.requests.values()].filter(r => r.requesterId === agentId);
    }

    /**
     * Get delegation history.
     */
    getHistory(limit?: number): DelegationHistory[] {
        const sorted = [...this.history].sort(
            (a, b) => b.endedAt.getTime() - a.endedAt.getTime()
        );
        return limit ? sorted.slice(0, limit) : sorted;
    }

    /**
     * Get statistics.
     */
    getStats(): DelegationStats {
        const requests = [...this.requests.values()];
        const activeDelegations = this.getAllActiveDelegations();

        const approved = requests.filter(r => r.status === 'approved');
        const autoApproved = requests.filter(r => r.approvedBy === 'AUTO');
        const rejected = requests.filter(r => r.status === 'rejected');

        const completedHistory = this.history.filter(h => h.outcome === 'completed');
        const successCount = completedHistory.filter(h => h.wasSuccessful).length;
        const avgSuccessRate = completedHistory.length > 0
            ? successCount / completedHistory.length
            : 0;

        return {
            totalRequests: requests.length,
            approvedRequests: approved.length,
            rejectedRequests: rejected.length,
            autoApprovedRequests: autoApproved.length,
            activeDelegations: activeDelegations.length,
            expiredDelegations: this.history.filter(h => h.outcome === 'expired').length,
            revokedDelegations: this.history.filter(h => h.outcome === 'revoked').length,
            averageSuccessRate: avgSuccessRate,
        };
    }

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    /**
     * Get configuration.
     */
    getConfig(): DelegationConfig {
        return { ...this.config };
    }

    /**
     * Update configuration.
     */
    setConfig(config: Partial<DelegationConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Clear all data (for testing).
     */
    clear(): void {
        this.stopCleanupInterval();
        this.requests.clear();
        this.activeDelegations.clear();
        this.history = [];
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Convert trust level to tier.
     */
    private levelToTier(level: TrustLevel): AgentTier {
        const tierMap: Record<TrustLevel, AgentTier> = {
            SOVEREIGN: 5,
            EXECUTIVE: 4,
            TACTICAL: 3,
            OPERATIONAL: 2,
            WORKER: 1,
            PASSIVE: 0,
        };
        return tierMap[level] ?? 0;
    }
}

// Singleton instance
export const delegationManager = new DelegationManager();
