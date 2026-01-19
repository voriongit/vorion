/**
 * Decision Timeout Handler
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.6: Decision Timeout Handler
 *
 * Monitors pending decisions and handles timeouts based on urgency.
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export type UrgencyLevel = 'immediate' | 'high' | 'normal' | 'low';
export type TimeoutAction = 'escalate' | 'expire' | 'notify';

export interface PendingDecision {
    id: string;
    requestId: string;
    orgId: string;
    urgency: UrgencyLevel;
    source: 'tribunal' | 'hitl';
    createdAt: Date;
    timeoutAt: Date;
    escalationLevel: number;
    notified: boolean;
    metadata?: Record<string, unknown>;
}

export interface TimeoutRule {
    urgency: UrgencyLevel;
    timeoutMs: number;
    action: TimeoutAction;
    escalationAction?: TimeoutAction;
    warningMs?: number;
}

export interface TimeoutResult {
    decision: PendingDecision;
    action: TimeoutAction;
    handledAt: Date;
    escalated?: boolean;
    expired?: boolean;
    notified?: boolean;
}

export interface TimeoutConfig {
    /** Check interval in ms (default: 60000 = 1 minute) */
    checkIntervalMs: number;
    /** Maximum escalation levels before forced expiry */
    maxEscalations: number;
    /** Grace period in ms before timeout (for warning) */
    warningGraceMs: number;
    /** Enable automatic processing */
    autoProcess: boolean;
}

interface HandlerEvents {
    'decision:registered': (decision: PendingDecision) => void;
    'decision:warning': (decision: PendingDecision) => void;
    'decision:escalated': (result: TimeoutResult) => void;
    'decision:expired': (result: TimeoutResult) => void;
    'decision:notified': (result: TimeoutResult) => void;
    'decision:resolved': (decision: PendingDecision) => void;
    'check:started': () => void;
    'check:completed': (results: TimeoutResult[]) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: TimeoutConfig = {
    checkIntervalMs: 60 * 1000, // 1 minute
    maxEscalations: 3,
    warningGraceMs: 5 * 60 * 1000, // 5 minutes
    autoProcess: true,
};

const DEFAULT_RULES: TimeoutRule[] = [
    {
        urgency: 'immediate',
        timeoutMs: 15 * 60 * 1000, // 15 minutes
        action: 'escalate',
        warningMs: 10 * 60 * 1000, // 10 minute warning
    },
    {
        urgency: 'high',
        timeoutMs: 60 * 60 * 1000, // 1 hour
        action: 'escalate',
        warningMs: 45 * 60 * 1000, // 45 minute warning
    },
    {
        urgency: 'normal',
        timeoutMs: 4 * 60 * 60 * 1000, // 4 hours
        action: 'expire',
        escalationAction: 'escalate',
        warningMs: 3 * 60 * 60 * 1000, // 3 hour warning
    },
    {
        urgency: 'low',
        timeoutMs: 24 * 60 * 60 * 1000, // 24 hours
        action: 'expire',
        warningMs: 20 * 60 * 60 * 1000, // 20 hour warning
    },
];

// ============================================================================
// Decision Timeout Handler
// ============================================================================

export class DecisionTimeoutHandler extends EventEmitter<HandlerEvents> {
    private config: TimeoutConfig;
    private rules: Map<UrgencyLevel, TimeoutRule>;

    // Pending decisions
    private decisions: Map<string, PendingDecision> = new Map();
    private decisionsByRequest: Map<string, string> = new Map();
    private decisionsByOrg: Map<string, string[]> = new Map();

    // Timer
    private checkTimer: NodeJS.Timeout | null = null;
    private isRunning = false;

    // Callbacks for escalation/expiration
    private escalateCallback?: (decision: PendingDecision) => Promise<boolean>;
    private expireCallback?: (decision: PendingDecision) => Promise<boolean>;
    private notifyCallback?: (decision: PendingDecision) => Promise<boolean>;

    constructor(config: Partial<TimeoutConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.rules = new Map(DEFAULT_RULES.map(r => [r.urgency, r]));

        if (this.config.autoProcess) {
            this.start();
        }
    }

    // =========================================================================
    // Decision Registration
    // =========================================================================

    /**
     * Register a pending decision for timeout tracking
     */
    register(
        id: string,
        requestId: string,
        orgId: string,
        urgency: UrgencyLevel,
        source: 'tribunal' | 'hitl',
        metadata?: Record<string, unknown>
    ): PendingDecision {
        const rule = this.rules.get(urgency) || DEFAULT_RULES.find(r => r.urgency === 'normal')!; // Default to normal
        const now = new Date();

        const decision: PendingDecision = {
            id,
            requestId,
            orgId,
            urgency,
            source,
            createdAt: now,
            timeoutAt: new Date(now.getTime() + rule.timeoutMs),
            escalationLevel: 0,
            notified: false,
            metadata,
        };

        this.storeDecision(decision);
        this.emit('decision:registered', decision);

        return decision;
    }

    /**
     * Mark a decision as resolved (removes from tracking)
     */
    resolve(id: string): boolean {
        const decision = this.decisions.get(id);
        if (!decision) return false;

        this.removeDecision(id);
        this.emit('decision:resolved', decision);

        return true;
    }

    /**
     * Resolve by request ID
     */
    resolveByRequestId(requestId: string): boolean {
        const id = this.decisionsByRequest.get(requestId);
        if (!id) return false;
        return this.resolve(id);
    }

    // =========================================================================
    // Timeout Processing
    // =========================================================================

    /**
     * Start automatic timeout processing
     */
    start(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.scheduleNextCheck();
    }

    /**
     * Stop automatic timeout processing
     */
    stop(): void {
        this.isRunning = false;
        if (this.checkTimer) {
            clearTimeout(this.checkTimer);
            this.checkTimer = null;
        }
    }

    /**
     * Process all pending timeouts (manual trigger)
     */
    async processTimeouts(): Promise<TimeoutResult[]> {
        this.emit('check:started');
        const results: TimeoutResult[] = [];
        const now = new Date();

        for (const decision of this.decisions.values()) {
            const result = await this.checkDecision(decision, now);
            if (result) {
                results.push(result);
            }
        }

        this.emit('check:completed', results);
        return results;
    }

    /**
     * Check a single decision for timeout
     */
    private async checkDecision(decision: PendingDecision, now: Date): Promise<TimeoutResult | null> {
        const rule = this.rules.get(decision.urgency);
        if (!rule) return null;

        const timeSinceCreation = now.getTime() - decision.createdAt.getTime();

        // Check for warning threshold
        if (rule.warningMs && !decision.notified && timeSinceCreation >= rule.warningMs) {
            decision.notified = true;
            this.emit('decision:warning', decision);
        }

        // Check for timeout
        if (now >= decision.timeoutAt) {
            return await this.handleTimeout(decision, rule);
        }

        return null;
    }

    /**
     * Handle a timed-out decision
     */
    private async handleTimeout(decision: PendingDecision, rule: TimeoutRule): Promise<TimeoutResult> {
        const result: TimeoutResult = {
            decision,
            action: rule.action,
            handledAt: new Date(),
        };

        // Check if we should escalate instead of expire
        if (decision.escalationLevel > 0 && decision.escalationLevel >= this.config.maxEscalations) {
            // Max escalations reached - force expire
            result.action = 'expire';
        } else if (rule.escalationAction && decision.escalationLevel > 0) {
            // Use escalation action for subsequent timeouts
            result.action = rule.escalationAction;
        }

        switch (result.action) {
            case 'escalate':
                result.escalated = await this.handleEscalation(decision);
                this.emit('decision:escalated', result);
                break;

            case 'expire':
                result.expired = await this.handleExpiration(decision);
                this.emit('decision:expired', result);
                break;

            case 'notify':
                result.notified = await this.handleNotification(decision);
                this.emit('decision:notified', result);
                break;
        }

        return result;
    }

    private async handleEscalation(decision: PendingDecision): Promise<boolean> {
        decision.escalationLevel++;

        // Reset timeout for escalation
        const rule = this.rules.get(decision.urgency);
        if (rule) {
            decision.timeoutAt = new Date(Date.now() + rule.timeoutMs);
        }

        if (this.escalateCallback) {
            try {
                return await this.escalateCallback(decision);
            } catch {
                return false;
            }
        }

        return true;
    }

    private async handleExpiration(decision: PendingDecision): Promise<boolean> {
        this.removeDecision(decision.id);

        if (this.expireCallback) {
            try {
                return await this.expireCallback(decision);
            } catch {
                return false;
            }
        }

        return true;
    }

    private async handleNotification(decision: PendingDecision): Promise<boolean> {
        if (this.notifyCallback) {
            try {
                return await this.notifyCallback(decision);
            } catch {
                return false;
            }
        }

        return true;
    }

    // =========================================================================
    // Decision Retrieval
    // =========================================================================

    /**
     * Get a pending decision by ID
     */
    getDecision(id: string): PendingDecision | null {
        return this.decisions.get(id) || null;
    }

    /**
     * Get pending decision by request ID
     */
    getDecisionByRequestId(requestId: string): PendingDecision | null {
        const id = this.decisionsByRequest.get(requestId);
        if (!id) return null;
        return this.decisions.get(id) || null;
    }

    /**
     * Get all pending decisions
     */
    getPendingDecisions(filters?: {
        orgId?: string;
        urgency?: UrgencyLevel;
        source?: 'tribunal' | 'hitl';
    }): PendingDecision[] {
        let decisions = Array.from(this.decisions.values());

        if (filters?.orgId) {
            decisions = decisions.filter(d => d.orgId === filters.orgId);
        }
        if (filters?.urgency) {
            decisions = decisions.filter(d => d.urgency === filters.urgency);
        }
        if (filters?.source) {
            decisions = decisions.filter(d => d.source === filters.source);
        }

        return decisions.sort((a, b) => a.timeoutAt.getTime() - b.timeoutAt.getTime());
    }

    /**
     * Get decisions expiring soon
     */
    getExpiringSoon(withinMs: number = 30 * 60 * 1000): PendingDecision[] {
        const now = Date.now();
        const threshold = now + withinMs;

        return Array.from(this.decisions.values())
            .filter(d => d.timeoutAt.getTime() <= threshold)
            .sort((a, b) => a.timeoutAt.getTime() - b.timeoutAt.getTime());
    }

    // =========================================================================
    // Callback Registration
    // =========================================================================

    /**
     * Set escalation callback
     */
    onEscalate(callback: (decision: PendingDecision) => Promise<boolean>): void {
        this.escalateCallback = callback;
    }

    /**
     * Set expiration callback
     */
    onExpire(callback: (decision: PendingDecision) => Promise<boolean>): void {
        this.expireCallback = callback;
    }

    /**
     * Set notification callback
     */
    onNotify(callback: (decision: PendingDecision) => Promise<boolean>): void {
        this.notifyCallback = callback;
    }

    // =========================================================================
    // Rules Configuration
    // =========================================================================

    /**
     * Set a timeout rule
     */
    setRule(rule: TimeoutRule): void {
        this.rules.set(rule.urgency, rule);
    }

    /**
     * Get a timeout rule
     */
    getRule(urgency: UrgencyLevel): TimeoutRule | null {
        return this.rules.get(urgency) || null;
    }

    /**
     * Get all rules
     */
    getRules(): TimeoutRule[] {
        return Array.from(this.rules.values());
    }

    // =========================================================================
    // Configuration
    // =========================================================================

    /**
     * Update configuration
     */
    updateConfig(config: Partial<TimeoutConfig>): void {
        this.config = { ...this.config, ...config };

        // Restart timer with new interval if running
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }

    /**
     * Get current configuration
     */
    getConfig(): TimeoutConfig {
        return { ...this.config };
    }

    // =========================================================================
    // Statistics
    // =========================================================================

    /**
     * Get timeout statistics
     */
    getStats(orgId?: string): {
        totalPending: number;
        byUrgency: Record<UrgencyLevel, number>;
        bySource: Record<string, number>;
        expiringSoon: number;
        escalatedCount: number;
    } {
        let decisions = Array.from(this.decisions.values());

        if (orgId) {
            decisions = decisions.filter(d => d.orgId === orgId);
        }

        const byUrgency: Record<UrgencyLevel, number> = {
            immediate: 0,
            high: 0,
            normal: 0,
            low: 0,
        };

        const bySource: Record<'tribunal' | 'hitl', number> = {
            tribunal: 0,
            hitl: 0,
        };

        let escalatedCount = 0;

        for (const d of decisions) {
            byUrgency[d.urgency] = (byUrgency[d.urgency] ?? 0) + 1;
            bySource[d.source] = (bySource[d.source] ?? 0) + 1;
            if (d.escalationLevel > 0) escalatedCount++;
        }

        const expiringSoon = this.getExpiringSoon().filter(
            d => !orgId || d.orgId === orgId
        ).length;

        return {
            totalPending: decisions.length,
            byUrgency,
            bySource,
            expiringSoon,
            escalatedCount,
        };
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    private storeDecision(decision: PendingDecision): void {
        this.decisions.set(decision.id, decision);
        this.decisionsByRequest.set(decision.requestId, decision.id);

        const orgDecisions = this.decisionsByOrg.get(decision.orgId) || [];
        orgDecisions.push(decision.id);
        this.decisionsByOrg.set(decision.orgId, orgDecisions);
    }

    private removeDecision(id: string): void {
        const decision = this.decisions.get(id);
        if (!decision) return;

        this.decisions.delete(id);
        this.decisionsByRequest.delete(decision.requestId);

        const orgDecisions = this.decisionsByOrg.get(decision.orgId);
        if (orgDecisions) {
            const index = orgDecisions.indexOf(id);
            if (index >= 0) {
                orgDecisions.splice(index, 1);
            }
        }
    }

    private scheduleNextCheck(): void {
        if (!this.isRunning) return;

        this.checkTimer = setTimeout(async () => {
            await this.processTimeouts();
            this.scheduleNextCheck();
        }, this.config.checkIntervalMs);
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /**
     * Clear all state
     */
    clear(): void {
        this.stop();
        this.decisions.clear();
        this.decisionsByRequest.clear();
        this.decisionsByOrg.clear();
    }

    /**
     * Get pending decision count
     */
    get pendingCount(): number {
        return this.decisions.size;
    }

    /**
     * Check if running
     */
    get running(): boolean {
        return this.isRunning;
    }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: DecisionTimeoutHandler | null = null;

export function getDecisionTimeoutHandler(config?: Partial<TimeoutConfig>): DecisionTimeoutHandler {
    if (!instance) {
        instance = new DecisionTimeoutHandler(config);
    }
    return instance;
}

export function resetDecisionTimeoutHandler(): void {
    if (instance) {
        instance.clear();
    }
    instance = null;
}

export default DecisionTimeoutHandler;
