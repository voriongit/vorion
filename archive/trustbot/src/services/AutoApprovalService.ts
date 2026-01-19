/**
 * Auto-Approval Service
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.2: Auto-Approval System
 *
 * Manages automatic approval of low-risk actions from trusted agents.
 * Tracks auto-approvals for audit and analytics.
 */

import { EventEmitter } from 'eventemitter3';
import {
    getTrustGateEngine,
    type ActionRequest,
    type AgentContext,
    type GateResult,
    type GateConfig,
} from './TrustGateEngine.js';

// ============================================================================
// Types
// ============================================================================

export interface AutoApprovalRecord {
    id: string;
    requestId: string;
    agentId: string;
    orgId: string;
    actionType: string;
    category: string;
    trustScore: number;
    tier: string;
    approvedAt: Date;
    executedAt?: Date;
    executionResult?: 'success' | 'failure';
    metadata?: Record<string, unknown>;
}

export interface AutoApprovalCriteria {
    /** Minimum trust score (default: 800) */
    minTrustScore: number;
    /** Maximum recent failures allowed (default: 0) */
    maxRecentFailures: number;
    /** Minimum same-type action history (default: 3) */
    minActionHistory: number;
    /** Low-risk categories eligible for auto-approval */
    eligibleCategories: string[];
    /** Blocked action types (never auto-approve) */
    blockedActions: string[];
    /** Required capabilities for auto-approval */
    requiredCapabilities: string[];
    /** Maximum approvals per hour per agent */
    maxApprovalsPerHour: number;
}

export interface AutoApprovalStats {
    totalApprovals: number;
    successfulExecutions: number;
    failedExecutions: number;
    pendingExecutions: number;
    approvalsByCategory: Record<string, number>;
    approvalsByAgent: Record<string, number>;
    approvalsByHour: number[];
}

export interface AutoApprovalConfig {
    criteria?: Partial<AutoApprovalCriteria>;
    /** Track execution results (default: true) */
    trackExecutions?: boolean;
    /** Maximum records to keep in memory (default: 1000) */
    maxRecords?: number;
}

interface ServiceEvents {
    'approval:granted': (record: AutoApprovalRecord) => void;
    'approval:executed': (record: AutoApprovalRecord) => void;
    'approval:failed': (record: AutoApprovalRecord) => void;
    'approval:rejected': (request: ActionRequest, reason: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CRITERIA: AutoApprovalCriteria = {
    minTrustScore: 800,
    maxRecentFailures: 0,
    minActionHistory: 3,
    eligibleCategories: ['read', 'write', 'execute', 'external_api', 'data_access'],
    blockedActions: [],
    requiredCapabilities: ['execute'],
    maxApprovalsPerHour: 50,
};

// ============================================================================
// Auto-Approval Service
// ============================================================================

export class AutoApprovalService extends EventEmitter<ServiceEvents> {
    private criteria: AutoApprovalCriteria;
    private trackExecutions: boolean;
    private maxRecords: number;

    // Approval records
    private approvalRecords: Map<string, AutoApprovalRecord> = new Map();
    private recordsByAgent: Map<string, string[]> = new Map();
    private recordsByOrg: Map<string, string[]> = new Map();

    // Approval rate tracking
    private approvalCounters: Map<string, { count: number; windowStart: number }> = new Map();

    // Org-specific criteria
    private orgCriteria: Map<string, Partial<AutoApprovalCriteria>> = new Map();

    constructor(config: AutoApprovalConfig = {}) {
        super();
        this.criteria = { ...DEFAULT_CRITERIA, ...config.criteria };
        this.trackExecutions = config.trackExecutions ?? true;
        this.maxRecords = config.maxRecords ?? 1000;
    }

    // =========================================================================
    // Auto-Approval Evaluation
    // =========================================================================

    /**
     * Attempt to auto-approve an action request
     * Returns the approval record if approved, null if not eligible
     */
    tryAutoApprove(request: ActionRequest, context: AgentContext): AutoApprovalRecord | null {
        const criteria = this.getOrgCriteria(request.orgId);

        // Check eligibility
        const eligibility = this.checkEligibility(request, context, criteria);
        if (!eligibility.eligible) {
            this.emit('approval:rejected', request, eligibility.reason);
            return null;
        }

        // Use TrustGateEngine for final decision
        const gateEngine = getTrustGateEngine();
        const gateResult = gateEngine.evaluate(request, context);

        if (gateResult.decision !== 'auto_approve') {
            this.emit('approval:rejected', request, `Gate decision: ${gateResult.decision}`);
            return null;
        }

        // Check approval rate limit
        if (!this.checkApprovalRateLimit(request.agentId, criteria)) {
            this.emit('approval:rejected', request, 'Approval rate limit exceeded');
            return null;
        }

        // Create approval record
        const record = this.createApprovalRecord(request, context);
        this.storeRecord(record);
        this.incrementApprovalCounter(request.agentId);

        this.emit('approval:granted', record);
        return record;
    }

    /**
     * Check if request is eligible for auto-approval (before gate evaluation)
     */
    checkEligibility(
        request: ActionRequest,
        context: AgentContext,
        criteria?: AutoApprovalCriteria
    ): { eligible: boolean; reason: string } {
        const c = criteria || this.getOrgCriteria(request.orgId);

        // Trust score check
        if (context.trustScore < c.minTrustScore) {
            return {
                eligible: false,
                reason: `Trust score ${context.trustScore} below minimum ${c.minTrustScore}`,
            };
        }

        // Recent failures check
        if (context.recentFailures > c.maxRecentFailures) {
            return {
                eligible: false,
                reason: `Recent failures ${context.recentFailures} exceed maximum ${c.maxRecentFailures}`,
            };
        }

        // Category eligibility
        if (!c.eligibleCategories.includes(request.category)) {
            return {
                eligible: false,
                reason: `Category ${request.category} not eligible for auto-approval`,
            };
        }

        // Blocked actions
        if (c.blockedActions.includes(request.actionType)) {
            return {
                eligible: false,
                reason: `Action ${request.actionType} is blocked from auto-approval`,
            };
        }

        // Required capabilities
        for (const cap of c.requiredCapabilities) {
            if (!context.capabilities.includes(cap)) {
                return {
                    eligible: false,
                    reason: `Missing required capability: ${cap}`,
                };
            }
        }

        // Action history (first-time check)
        const actionCount = context.actionHistory.get(request.actionType) || 0;
        if (actionCount < c.minActionHistory) {
            return {
                eligible: false,
                reason: `Insufficient action history: ${actionCount}/${c.minActionHistory}`,
            };
        }

        return { eligible: true, reason: 'All criteria met' };
    }

    /**
     * Check if a request would be auto-approved (dry run)
     */
    wouldAutoApprove(request: ActionRequest, context: AgentContext): {
        wouldApprove: boolean;
        eligibility: { eligible: boolean; reason: string };
        gateDecision?: string;
    } {
        const eligibility = this.checkEligibility(request, context);
        if (!eligibility.eligible) {
            return { wouldApprove: false, eligibility };
        }

        const gateEngine = getTrustGateEngine();
        const gateResult = gateEngine.evaluate(request, context);

        return {
            wouldApprove: gateResult.decision === 'auto_approve',
            eligibility,
            gateDecision: gateResult.decision,
        };
    }

    // =========================================================================
    // Execution Tracking
    // =========================================================================

    /**
     * Record that an approved action has been executed
     */
    recordExecution(recordId: string, result: 'success' | 'failure'): boolean {
        const record = this.approvalRecords.get(recordId);
        if (!record) return false;

        record.executedAt = new Date();
        record.executionResult = result;

        if (result === 'success') {
            this.emit('approval:executed', record);
        } else {
            this.emit('approval:failed', record);
        }

        return true;
    }

    /**
     * Get pending (not yet executed) approvals
     */
    getPendingApprovals(agentId?: string, orgId?: string): AutoApprovalRecord[] {
        const records: AutoApprovalRecord[] = [];

        for (const record of this.approvalRecords.values()) {
            if (record.executedAt) continue;
            if (agentId && record.agentId !== agentId) continue;
            if (orgId && record.orgId !== orgId) continue;
            records.push(record);
        }

        return records.sort((a, b) => b.approvedAt.getTime() - a.approvedAt.getTime());
    }

    // =========================================================================
    // Record Retrieval
    // =========================================================================

    /**
     * Get approval record by ID
     */
    getRecord(id: string): AutoApprovalRecord | null {
        return this.approvalRecords.get(id) || null;
    }

    /**
     * Get approval record by request ID
     */
    getRecordByRequestId(requestId: string): AutoApprovalRecord | null {
        for (const record of this.approvalRecords.values()) {
            if (record.requestId === requestId) {
                return record;
            }
        }
        return null;
    }

    /**
     * Get approvals for an agent
     */
    getAgentApprovals(agentId: string, options?: {
        limit?: number;
        since?: Date;
    }): AutoApprovalRecord[] {
        const recordIds = this.recordsByAgent.get(agentId) || [];
        let records = recordIds
            .map(id => this.approvalRecords.get(id))
            .filter((r): r is AutoApprovalRecord => r !== undefined);

        if (options?.since) {
            records = records.filter(r => r.approvedAt >= options.since!);
        }

        records.sort((a, b) => b.approvedAt.getTime() - a.approvedAt.getTime());

        if (options?.limit) {
            records = records.slice(0, options.limit);
        }

        return records;
    }

    /**
     * Get approvals for an organization
     */
    getOrgApprovals(orgId: string, options?: {
        limit?: number;
        since?: Date;
    }): AutoApprovalRecord[] {
        const recordIds = this.recordsByOrg.get(orgId) || [];
        let records = recordIds
            .map(id => this.approvalRecords.get(id))
            .filter((r): r is AutoApprovalRecord => r !== undefined);

        if (options?.since) {
            records = records.filter(r => r.approvedAt >= options.since!);
        }

        records.sort((a, b) => b.approvedAt.getTime() - a.approvedAt.getTime());

        if (options?.limit) {
            records = records.slice(0, options.limit);
        }

        return records;
    }

    // =========================================================================
    // Statistics
    // =========================================================================

    /**
     * Get auto-approval statistics
     */
    getStats(orgId?: string): AutoApprovalStats {
        let records = Array.from(this.approvalRecords.values());

        if (orgId) {
            records = records.filter(r => r.orgId === orgId);
        }

        const approvalsByCategory: Record<string, number> = {};
        const approvalsByAgent: Record<string, number> = {};
        const approvalsByHour: number[] = new Array(24).fill(0);

        let successfulExecutions = 0;
        let failedExecutions = 0;
        let pendingExecutions = 0;

        for (const record of records) {
            // Count by category
            approvalsByCategory[record.category] = (approvalsByCategory[record.category] || 0) + 1;

            // Count by agent
            approvalsByAgent[record.agentId] = (approvalsByAgent[record.agentId] || 0) + 1;

            // Count by hour
            const hour = record.approvedAt.getHours();
            approvalsByHour[hour]++;

            // Execution results
            if (record.executionResult === 'success') {
                successfulExecutions++;
            } else if (record.executionResult === 'failure') {
                failedExecutions++;
            } else if (!record.executedAt) {
                pendingExecutions++;
            }
        }

        return {
            totalApprovals: records.length,
            successfulExecutions,
            failedExecutions,
            pendingExecutions,
            approvalsByCategory,
            approvalsByAgent,
            approvalsByHour,
        };
    }

    /**
     * Get success rate for auto-approved actions
     */
    getSuccessRate(agentId?: string, orgId?: string): number {
        let records = Array.from(this.approvalRecords.values());

        if (agentId) {
            records = records.filter(r => r.agentId === agentId);
        }
        if (orgId) {
            records = records.filter(r => r.orgId === orgId);
        }

        const executed = records.filter(r => r.executionResult);
        if (executed.length === 0) return 1; // No data = assume 100%

        const successful = executed.filter(r => r.executionResult === 'success').length;
        return successful / executed.length;
    }

    // =========================================================================
    // Configuration
    // =========================================================================

    /**
     * Set org-specific criteria
     */
    setOrgCriteria(orgId: string, criteria: Partial<AutoApprovalCriteria>): void {
        this.orgCriteria.set(orgId, criteria);
    }

    /**
     * Get org-specific criteria (merged with defaults)
     */
    getOrgCriteria(orgId: string): AutoApprovalCriteria {
        const orgCriteria = this.orgCriteria.get(orgId);
        if (!orgCriteria) return this.criteria;

        return {
            ...this.criteria,
            ...orgCriteria,
            eligibleCategories: orgCriteria.eligibleCategories || this.criteria.eligibleCategories,
            blockedActions: [
                ...this.criteria.blockedActions,
                ...(orgCriteria.blockedActions || []),
            ],
            requiredCapabilities: orgCriteria.requiredCapabilities || this.criteria.requiredCapabilities,
        };
    }

    /**
     * Update global criteria
     */
    updateCriteria(criteria: Partial<AutoApprovalCriteria>): void {
        this.criteria = { ...this.criteria, ...criteria };
    }

    /**
     * Get current criteria
     */
    getCriteria(): AutoApprovalCriteria {
        return { ...this.criteria };
    }

    /**
     * Block an action type from auto-approval
     */
    blockAction(actionType: string, orgId?: string): void {
        if (orgId) {
            const orgCriteria = this.orgCriteria.get(orgId) || {};
            orgCriteria.blockedActions = [...(orgCriteria.blockedActions || []), actionType];
            this.orgCriteria.set(orgId, orgCriteria);
        } else {
            this.criteria.blockedActions.push(actionType);
        }
    }

    /**
     * Unblock an action type
     */
    unblockAction(actionType: string, orgId?: string): void {
        if (orgId) {
            const orgCriteria = this.orgCriteria.get(orgId);
            if (orgCriteria?.blockedActions) {
                orgCriteria.blockedActions = orgCriteria.blockedActions.filter(a => a !== actionType);
            }
        } else {
            this.criteria.blockedActions = this.criteria.blockedActions.filter(a => a !== actionType);
        }
    }

    // =========================================================================
    // Rate Limiting
    // =========================================================================

    /**
     * Check if agent is within approval rate limit
     */
    private checkApprovalRateLimit(agentId: string, criteria: AutoApprovalCriteria): boolean {
        const now = Date.now();
        const counter = this.approvalCounters.get(agentId);
        const windowMs = 60 * 60 * 1000; // 1 hour

        if (!counter || now - counter.windowStart > windowMs) {
            return true;
        }

        return counter.count < criteria.maxApprovalsPerHour;
    }

    /**
     * Increment approval counter
     */
    private incrementApprovalCounter(agentId: string): void {
        const now = Date.now();
        const counter = this.approvalCounters.get(agentId);
        const windowMs = 60 * 60 * 1000;

        if (!counter || now - counter.windowStart > windowMs) {
            this.approvalCounters.set(agentId, { count: 1, windowStart: now });
        } else {
            counter.count++;
        }
    }

    /**
     * Get remaining approvals for agent
     */
    getRemainingApprovals(agentId: string, orgId?: string): number {
        const criteria = orgId ? this.getOrgCriteria(orgId) : this.criteria;
        const now = Date.now();
        const counter = this.approvalCounters.get(agentId);
        const windowMs = 60 * 60 * 1000;

        if (!counter || now - counter.windowStart > windowMs) {
            return criteria.maxApprovalsPerHour;
        }

        return Math.max(0, criteria.maxApprovalsPerHour - counter.count);
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    private createApprovalRecord(request: ActionRequest, context: AgentContext): AutoApprovalRecord {
        return {
            id: this.generateRecordId(),
            requestId: request.id,
            agentId: request.agentId,
            orgId: request.orgId,
            actionType: request.actionType,
            category: request.category,
            trustScore: context.trustScore,
            tier: context.tier,
            approvedAt: new Date(),
            metadata: request.metadata,
        };
    }

    private storeRecord(record: AutoApprovalRecord): void {
        // Store main record
        this.approvalRecords.set(record.id, record);

        // Index by agent
        const agentRecords = this.recordsByAgent.get(record.agentId) || [];
        agentRecords.push(record.id);
        this.recordsByAgent.set(record.agentId, agentRecords);

        // Index by org
        const orgRecords = this.recordsByOrg.get(record.orgId) || [];
        orgRecords.push(record.id);
        this.recordsByOrg.set(record.orgId, orgRecords);

        // Prune old records if needed
        if (this.approvalRecords.size > this.maxRecords) {
            this.pruneOldRecords();
        }
    }

    private pruneOldRecords(): void {
        const records = Array.from(this.approvalRecords.values())
            .sort((a, b) => a.approvedAt.getTime() - b.approvedAt.getTime());

        // Remove oldest 10%
        const toRemove = Math.floor(records.length * 0.1);
        for (let i = 0; i < toRemove; i++) {
            const record = records[i];
            this.approvalRecords.delete(record.id);

            // Remove from indexes
            const agentRecords = this.recordsByAgent.get(record.agentId);
            if (agentRecords) {
                const idx = agentRecords.indexOf(record.id);
                if (idx >= 0) agentRecords.splice(idx, 1);
            }

            const orgRecords = this.recordsByOrg.get(record.orgId);
            if (orgRecords) {
                const idx = orgRecords.indexOf(record.id);
                if (idx >= 0) orgRecords.splice(idx, 1);
            }
        }
    }

    private generateRecordId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `auto_${timestamp}_${random}`;
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /**
     * Clear all state
     */
    clear(): void {
        this.approvalRecords.clear();
        this.recordsByAgent.clear();
        this.recordsByOrg.clear();
        this.approvalCounters.clear();
        this.orgCriteria.clear();
    }

    /**
     * Get total record count
     */
    get size(): number {
        return this.approvalRecords.size;
    }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: AutoApprovalService | null = null;

export function getAutoApprovalService(config?: AutoApprovalConfig): AutoApprovalService {
    if (!instance) {
        instance = new AutoApprovalService(config);
    }
    return instance;
}

export function resetAutoApprovalService(): void {
    if (instance) {
        instance.clear();
    }
    instance = null;
}

export default AutoApprovalService;
