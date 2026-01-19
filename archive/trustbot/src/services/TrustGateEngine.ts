/**
 * Trust Gate Engine
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.1: Trust Gate Engine
 *
 * Evaluates action requests against trust rules to determine
 * the appropriate oversight level:
 * - Auto-approve (low risk, high trust)
 * - Tribunal review (medium-high risk)
 * - HITL required (high-critical risk)
 * - Deny (insufficient trust/permissions)
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionCategory =
    | 'read'
    | 'write'
    | 'execute'
    | 'delegate'
    | 'spawn'
    | 'financial'
    | 'external_api'
    | 'data_access'
    | 'system_config'
    | 'user_facing';

export type GateDecision =
    | 'auto_approve'
    | 'tribunal_review'
    | 'hitl_required'
    | 'escalate'
    | 'deny'
    | 'rate_limited';

export interface ActionRequest {
    id: string;
    agentId: string;
    orgId: string;
    actionType: string;
    category: ActionCategory;
    description: string;
    estimatedImpact?: string;
    metadata?: Record<string, unknown>;
    urgency?: 'low' | 'normal' | 'high' | 'immediate';
    requestedAt: Date;
}

export interface AgentContext {
    trustScore: number;
    tier: string;
    capabilities: string[];
    recentFailures: number;
    recentSuccesses: number;
    actionHistory: Map<string, number>; // actionType -> count
    lastActionAt?: Date;
}

export interface GateResult {
    requestId: string;
    decision: GateDecision;
    riskLevel: RiskLevel;
    reasons: string[];
    requiredApprovers?: string[];
    autoExpireAt?: Date;
    evaluatedAt: Date;
    rules: RuleEvaluation[];
}

export interface RuleEvaluation {
    ruleName: string;
    passed: boolean;
    message: string;
    weight: number;
}

export interface TrustGateRule {
    name: string;
    description: string;
    priority: number;
    evaluate: (request: ActionRequest, context: AgentContext, config: GateConfig) => RuleEvaluation;
}

export interface GateConfig {
    /** Minimum trust score for auto-approval (default: 800) */
    autoApproveMinScore: number;
    /** Maximum failures in last 24h for auto-approval (default: 0) */
    autoApproveMaxRecentFailures: number;
    /** Minimum actions of same type for auto-approval (default: 3) */
    autoApproveMinSameTypeActions: number;
    /** Trust score threshold for tribunal review (default: 400) */
    tribunalMinScore: number;
    /** Trust score threshold for HITL (default: 200) */
    hitlMinScore: number;
    /** Rate limit: max actions per hour (default: 100) */
    rateLimitPerHour: number;
    /** Rate limit window in ms (default: 1 hour) */
    rateLimitWindowMs: number;
    /** Risk level overrides by action category */
    categoryRiskOverrides: Partial<Record<ActionCategory, RiskLevel>>;
    /** Actions that always require HITL */
    alwaysHitlActions: string[];
    /** Actions that are always denied */
    deniedActions: string[];
}

interface GateEvents {
    'gate:evaluated': (result: GateResult) => void;
    'gate:auto_approved': (result: GateResult) => void;
    'gate:escalated': (result: GateResult) => void;
    'gate:denied': (result: GateResult) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: GateConfig = {
    autoApproveMinScore: 800,
    autoApproveMaxRecentFailures: 0,
    autoApproveMinSameTypeActions: 3,
    tribunalMinScore: 400,
    hitlMinScore: 200,
    rateLimitPerHour: 100,
    rateLimitWindowMs: 60 * 60 * 1000,
    categoryRiskOverrides: {},
    alwaysHitlActions: [],
    deniedActions: [],
};

const CATEGORY_BASE_RISK: Record<ActionCategory, RiskLevel> = {
    read: 'low',
    write: 'medium',
    execute: 'medium',
    delegate: 'high',
    spawn: 'high',
    financial: 'critical',
    external_api: 'medium',
    data_access: 'medium',
    system_config: 'high',
    user_facing: 'medium',
};

const RISK_WEIGHTS: Record<RiskLevel, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
};

// ============================================================================
// Built-in Rules
// ============================================================================

const BUILT_IN_RULES: TrustGateRule[] = [
    {
        name: 'trust_score_check',
        description: 'Check if agent has sufficient trust score',
        priority: 100,
        evaluate: (request, context, config) => {
            if (context.trustScore >= config.autoApproveMinScore) {
                return { ruleName: 'trust_score_check', passed: true, message: 'Trust score sufficient for auto-approval', weight: 3 };
            }
            if (context.trustScore >= config.tribunalMinScore) {
                return { ruleName: 'trust_score_check', passed: true, message: 'Trust score sufficient for tribunal review', weight: 2 };
            }
            if (context.trustScore >= config.hitlMinScore) {
                return { ruleName: 'trust_score_check', passed: true, message: 'Trust score requires HITL', weight: 1 };
            }
            return { ruleName: 'trust_score_check', passed: false, message: `Trust score ${context.trustScore} below minimum ${config.hitlMinScore}`, weight: 0 };
        },
    },
    {
        name: 'tier_permission_check',
        description: 'Check if agent tier allows this action category',
        priority: 90,
        evaluate: (request, context) => {
            const categoryToCapability: Record<ActionCategory, string> = {
                read: 'execute',
                write: 'execute',
                execute: 'execute',
                delegate: 'delegate',
                spawn: 'spawn',
                financial: 'approve_medium_risk',
                external_api: 'execute',
                data_access: 'execute',
                system_config: 'approve_medium_risk',
                user_facing: 'execute',
            };

            const requiredCap = categoryToCapability[request.category];
            if (!requiredCap || context.capabilities.includes(requiredCap)) {
                return { ruleName: 'tier_permission_check', passed: true, message: 'Tier has required capability', weight: 2 };
            }
            return { ruleName: 'tier_permission_check', passed: false, message: `Missing capability: ${requiredCap}`, weight: 0 };
        },
    },
    {
        name: 'recent_failures_check',
        description: 'Check recent failure count',
        priority: 80,
        evaluate: (request, context, config) => {
            if (context.recentFailures <= config.autoApproveMaxRecentFailures) {
                return { ruleName: 'recent_failures_check', passed: true, message: 'No recent failures', weight: 2 };
            }
            if (context.recentFailures <= 3) {
                return { ruleName: 'recent_failures_check', passed: true, message: 'Some recent failures, requires review', weight: 1 };
            }
            return { ruleName: 'recent_failures_check', passed: false, message: `Too many recent failures: ${context.recentFailures}`, weight: 0 };
        },
    },
    {
        name: 'first_time_action_check',
        description: 'Check if this is a first-time action type',
        priority: 70,
        evaluate: (request, context, config) => {
            const actionCount = context.actionHistory.get(request.actionType) || 0;
            if (actionCount >= config.autoApproveMinSameTypeActions) {
                return { ruleName: 'first_time_action_check', passed: true, message: 'Action type has history', weight: 2 };
            }
            if (actionCount > 0) {
                return { ruleName: 'first_time_action_check', passed: true, message: 'Limited history for this action type', weight: 1 };
            }
            return { ruleName: 'first_time_action_check', passed: true, message: 'First-time action type, extra review recommended', weight: 0 };
        },
    },
    {
        name: 'denied_action_check',
        description: 'Check if action is on denied list',
        priority: 200,
        evaluate: (request, context, config) => {
            if (config.deniedActions.includes(request.actionType)) {
                return { ruleName: 'denied_action_check', passed: false, message: 'Action type is denied', weight: -100 };
            }
            return { ruleName: 'denied_action_check', passed: true, message: 'Action type not denied', weight: 0 };
        },
    },
    {
        name: 'always_hitl_check',
        description: 'Check if action always requires HITL',
        priority: 190,
        evaluate: (request, context, config) => {
            if (config.alwaysHitlActions.includes(request.actionType)) {
                return { ruleName: 'always_hitl_check', passed: true, message: 'Action type always requires HITL', weight: -50 };
            }
            return { ruleName: 'always_hitl_check', passed: true, message: 'No HITL override', weight: 0 };
        },
    },
];

// ============================================================================
// Trust Gate Engine
// ============================================================================

export class TrustGateEngine extends EventEmitter<GateEvents> {
    private config: GateConfig;
    private rules: TrustGateRule[];
    private orgConfigs: Map<string, Partial<GateConfig>> = new Map();
    private rateLimitCounters: Map<string, { count: number; windowStart: number }> = new Map();

    constructor(config: Partial<GateConfig> = {}, customRules?: TrustGateRule[]) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.rules = [...BUILT_IN_RULES, ...(customRules || [])].sort((a, b) => b.priority - a.priority);
    }

    // =========================================================================
    // Gate Evaluation
    // =========================================================================

    /**
     * Evaluate an action request through the trust gate
     */
    evaluate(request: ActionRequest, context: AgentContext): GateResult {
        const config = this.getOrgConfig(request.orgId);
        const ruleResults: RuleEvaluation[] = [];

        // Check rate limiting first
        if (!this.checkRateLimit(request.agentId, config)) {
            const result: GateResult = {
                requestId: request.id,
                decision: 'rate_limited',
                riskLevel: 'medium',
                reasons: ['Rate limit exceeded'],
                evaluatedAt: new Date(),
                rules: [{ ruleName: 'rate_limit', passed: false, message: 'Rate limit exceeded', weight: 0 }],
            };
            this.emit('gate:evaluated', result);
            return result;
        }

        // Evaluate all rules
        for (const rule of this.rules) {
            const evaluation = rule.evaluate(request, context, config);
            ruleResults.push(evaluation);
        }

        // Calculate risk level
        const riskLevel = this.calculateRiskLevel(request, context, config);

        // Determine decision
        const decision = this.determineDecision(ruleResults, riskLevel, context, config);

        // Build result
        const result: GateResult = {
            requestId: request.id,
            decision,
            riskLevel,
            reasons: this.buildReasons(ruleResults, decision),
            evaluatedAt: new Date(),
            rules: ruleResults,
        };

        // Add expiry for decisions that require action
        if (decision === 'tribunal_review' || decision === 'hitl_required') {
            result.autoExpireAt = this.calculateExpiry(riskLevel, request.urgency);
        }

        // Add required approvers for HITL
        if (decision === 'hitl_required' || decision === 'escalate') {
            result.requiredApprovers = this.determineApprovers(riskLevel, request.urgency);
        }

        // Emit events
        this.emit('gate:evaluated', result);
        if (decision === 'auto_approve') {
            this.emit('gate:auto_approved', result);
        } else if (decision === 'escalate') {
            this.emit('gate:escalated', result);
        } else if (decision === 'deny') {
            this.emit('gate:denied', result);
        }

        // Update rate limit counter
        this.incrementRateLimit(request.agentId, config);

        return result;
    }

    /**
     * Calculate risk level for the action
     */
    private calculateRiskLevel(request: ActionRequest, context: AgentContext, config: GateConfig): RiskLevel {
        // Start with category base risk
        let baseRisk = config.categoryRiskOverrides[request.category] || CATEGORY_BASE_RISK[request.category];
        let riskWeight = RISK_WEIGHTS[baseRisk];

        // Adjust for trust score
        if (context.trustScore < 400) {
            riskWeight += 1;
        } else if (context.trustScore >= 800) {
            riskWeight -= 1;
        }

        // Adjust for recent failures
        if (context.recentFailures > 0) {
            riskWeight += Math.min(context.recentFailures, 2);
        }

        // Adjust for first-time action
        const actionCount = context.actionHistory.get(request.actionType) || 0;
        if (actionCount === 0) {
            riskWeight += 1;
        }

        // Clamp and convert back to level
        riskWeight = Math.max(1, Math.min(4, riskWeight));
        const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
        return riskLevels[riskWeight - 1];
    }

    /**
     * Determine gate decision based on rule results
     */
    private determineDecision(
        rules: RuleEvaluation[],
        riskLevel: RiskLevel,
        context: AgentContext,
        config: GateConfig
    ): GateDecision {
        // Check for hard denials
        const denialRule = rules.find(r => !r.passed && r.weight <= -100);
        if (denialRule) {
            return 'deny';
        }

        // Check for forced HITL
        const hitlRule = rules.find(r => r.weight <= -50);
        if (hitlRule) {
            return 'hitl_required';
        }

        // Sum up rule weights
        const totalWeight = rules.reduce((sum, r) => sum + (r.passed ? r.weight : 0), 0);
        const passingRules = rules.filter(r => r.passed).length;
        const failingRules = rules.filter(r => !r.passed).length;

        // Any critical failure means deny
        if (failingRules > 0 && rules.some(r => !r.passed && r.weight === 0)) {
            // Check if it's a permission issue
            const permissionFail = rules.find(r => r.ruleName === 'tier_permission_check' && !r.passed);
            if (permissionFail) {
                return 'deny';
            }
        }

        // Decision matrix based on risk and trust
        if (riskLevel === 'critical') {
            return 'escalate';
        }

        if (riskLevel === 'high') {
            if (context.trustScore >= config.autoApproveMinScore && totalWeight >= 8) {
                return 'tribunal_review';
            }
            return 'hitl_required';
        }

        if (riskLevel === 'medium') {
            if (context.trustScore >= config.autoApproveMinScore && totalWeight >= 7) {
                return 'auto_approve';
            }
            if (context.trustScore >= config.tribunalMinScore) {
                return 'tribunal_review';
            }
            return 'hitl_required';
        }

        // Low risk
        if (context.trustScore >= config.tribunalMinScore && totalWeight >= 5) {
            return 'auto_approve';
        }
        if (context.trustScore >= config.hitlMinScore) {
            return 'tribunal_review';
        }
        return 'hitl_required';
    }

    /**
     * Build human-readable reasons for the decision
     */
    private buildReasons(rules: RuleEvaluation[], decision: GateDecision): string[] {
        const reasons: string[] = [];

        for (const rule of rules) {
            if (!rule.passed || rule.weight < 0) {
                reasons.push(rule.message);
            }
        }

        if (reasons.length === 0) {
            switch (decision) {
                case 'auto_approve':
                    reasons.push('All trust checks passed');
                    break;
                case 'tribunal_review':
                    reasons.push('Action requires tribunal review');
                    break;
                case 'hitl_required':
                    reasons.push('Human review required');
                    break;
                default:
                    reasons.push('Standard review process');
            }
        }

        return reasons;
    }

    /**
     * Calculate auto-expire time based on risk and urgency
     */
    private calculateExpiry(riskLevel: RiskLevel, urgency?: string): Date {
        const now = Date.now();
        let expiryMs: number;

        switch (riskLevel) {
            case 'critical':
                expiryMs = 15 * 60 * 1000; // 15 minutes
                break;
            case 'high':
                expiryMs = urgency === 'immediate' ? 15 * 60 * 1000 : 60 * 60 * 1000; // 15 min or 1 hour
                break;
            case 'medium':
                expiryMs = 4 * 60 * 60 * 1000; // 4 hours
                break;
            default:
                expiryMs = 24 * 60 * 60 * 1000; // 24 hours
        }

        return new Date(now + expiryMs);
    }

    /**
     * Determine required approvers based on risk
     */
    private determineApprovers(riskLevel: RiskLevel, urgency?: string): string[] {
        switch (riskLevel) {
            case 'critical':
                return ['director', 'security'];
            case 'high':
                return urgency === 'immediate' ? ['supervisor', 'on-call'] : ['supervisor'];
            case 'medium':
                return ['operator'];
            default:
                return ['operator'];
        }
    }

    // =========================================================================
    // Rate Limiting
    // =========================================================================

    /**
     * Check if agent is within rate limits
     */
    private checkRateLimit(agentId: string, config: GateConfig): boolean {
        const now = Date.now();
        const counter = this.rateLimitCounters.get(agentId);

        if (!counter) {
            return true;
        }

        // Check if window has expired
        if (now - counter.windowStart > config.rateLimitWindowMs) {
            this.rateLimitCounters.delete(agentId);
            return true;
        }

        return counter.count < config.rateLimitPerHour;
    }

    /**
     * Increment rate limit counter
     */
    private incrementRateLimit(agentId: string, config: GateConfig): void {
        const now = Date.now();
        const counter = this.rateLimitCounters.get(agentId);

        if (!counter || now - counter.windowStart > config.rateLimitWindowMs) {
            this.rateLimitCounters.set(agentId, { count: 1, windowStart: now });
        } else {
            counter.count++;
        }
    }

    /**
     * Get current rate limit status for an agent
     */
    getRateLimitStatus(agentId: string): { remaining: number; resetAt: Date } {
        const config = this.config;
        const now = Date.now();
        const counter = this.rateLimitCounters.get(agentId);

        if (!counter || now - counter.windowStart > config.rateLimitWindowMs) {
            return {
                remaining: config.rateLimitPerHour,
                resetAt: new Date(now + config.rateLimitWindowMs),
            };
        }

        return {
            remaining: Math.max(0, config.rateLimitPerHour - counter.count),
            resetAt: new Date(counter.windowStart + config.rateLimitWindowMs),
        };
    }

    // =========================================================================
    // Configuration
    // =========================================================================

    /**
     * Set organization-specific config
     */
    setOrgConfig(orgId: string, config: Partial<GateConfig>): void {
        this.orgConfigs.set(orgId, config);
    }

    /**
     * Get organization config (merged with defaults)
     */
    getOrgConfig(orgId: string): GateConfig {
        const orgConfig = this.orgConfigs.get(orgId);
        if (!orgConfig) return this.config;

        return {
            ...this.config,
            ...orgConfig,
            categoryRiskOverrides: {
                ...this.config.categoryRiskOverrides,
                ...orgConfig.categoryRiskOverrides,
            },
            alwaysHitlActions: [
                ...this.config.alwaysHitlActions,
                ...(orgConfig.alwaysHitlActions || []),
            ],
            deniedActions: [
                ...this.config.deniedActions,
                ...(orgConfig.deniedActions || []),
            ],
        };
    }

    /**
     * Update global config
     */
    updateConfig(config: Partial<GateConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current config
     */
    getConfig(): GateConfig {
        return { ...this.config };
    }

    /**
     * Add a custom rule
     */
    addRule(rule: TrustGateRule): void {
        this.rules.push(rule);
        this.rules.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Remove a rule by name
     */
    removeRule(ruleName: string): boolean {
        const index = this.rules.findIndex(r => r.name === ruleName);
        if (index >= 0) {
            this.rules.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Get all rules
     */
    getRules(): TrustGateRule[] {
        return [...this.rules];
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    /**
     * Get risk level for a category
     */
    getCategoryRisk(category: ActionCategory, orgId?: string): RiskLevel {
        const config = orgId ? this.getOrgConfig(orgId) : this.config;
        return config.categoryRiskOverrides[category] || CATEGORY_BASE_RISK[category];
    }

    /**
     * Check if action type is denied
     */
    isActionDenied(actionType: string, orgId?: string): boolean {
        const config = orgId ? this.getOrgConfig(orgId) : this.config;
        return config.deniedActions.includes(actionType);
    }

    /**
     * Check if action type requires HITL
     */
    requiresHitl(actionType: string, orgId?: string): boolean {
        const config = orgId ? this.getOrgConfig(orgId) : this.config;
        return config.alwaysHitlActions.includes(actionType);
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /**
     * Clear all state
     */
    clear(): void {
        this.rateLimitCounters.clear();
        this.orgConfigs.clear();
    }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: TrustGateEngine | null = null;

export function getTrustGateEngine(config?: Partial<GateConfig>): TrustGateEngine {
    if (!instance) {
        instance = new TrustGateEngine(config);
    }
    return instance;
}

export function resetTrustGateEngine(): void {
    if (instance) {
        instance.clear();
    }
    instance = null;
}

export default TrustGateEngine;
