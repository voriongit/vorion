/**
 * Live Gating Engine
 *
 * Enforces multi-dimensional gating thresholds for tier promotion.
 * Prevents agents from advancing without meeting ALL dimension requirements.
 *
 * Key Features:
 * - Multi-dimensional gating (must meet ALL thresholds)
 * - Automatic promotion when thresholds are met
 * - Demotion on sustained score decline
 * - Audit trail for all tier changes
 */

import { TRUST_TIERS, GATING_THRESHOLDS, TierName, DIMENSIONS } from './simulation';
import { getTelemetryCollector, AgentTrustState } from './telemetry';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// GATING TYPES
// =============================================================================

export interface GatingDecision {
    agentId: string;
    timestamp: number;
    currentTier: TierName;
    targetTier: TierName;
    decision: 'promote' | 'demote' | 'hold';
    reason: string;
    blockedDimensions: string[];
    metDimensions: string[];
    overallScore: number;
    dimensionScores: Record<string, number>;
}

export interface PromotionRequest {
    agentId: string;
    requestedBy: string;    // Agent or human ID
    targetTier: TierName;
    justification: string;
}

export interface TierChangeAudit {
    agentId: string;
    timestamp: number;
    fromTier: TierName;
    toTier: TierName;
    decision: GatingDecision;
    approvedBy?: string;
}

// =============================================================================
// GATING ENGINE
// =============================================================================

export class GatingEngine {
    private auditLog: TierChangeAudit[] = [];
    private auditPath: string;
    private autoPromoteEnabled: boolean = true;
    private demotionThreshold: number = 0.8; // Demote if score drops below 80% of tier min

    constructor(auditPath: string = '.vorion/trust/audit') {
        this.auditPath = auditPath;
        this.ensureAuditPath();
        this.loadAuditLog();
    }

    private ensureAuditPath(): void {
        try {
            if (!fs.existsSync(this.auditPath)) {
                fs.mkdirSync(this.auditPath, { recursive: true });
            }
        } catch {
            // Ignore
        }
    }

    private loadAuditLog(): void {
        try {
            const auditFile = path.join(this.auditPath, 'tier-changes.json');
            if (fs.existsSync(auditFile)) {
                this.auditLog = JSON.parse(fs.readFileSync(auditFile, 'utf-8'));
            }
        } catch {
            // Fresh start
        }
    }

    private saveAuditLog(): void {
        try {
            const auditFile = path.join(this.auditPath, 'tier-changes.json');
            fs.writeFileSync(auditFile, JSON.stringify(this.auditLog, null, 2));
        } catch {
            // Ignore
        }
    }

    /**
     * Evaluate gating decision for an agent
     */
    evaluateGating(agentId: string): GatingDecision {
        const collector = getTelemetryCollector();
        const state = collector.getState(agentId);

        if (!state) {
            return {
                agentId,
                timestamp: Date.now(),
                currentTier: 'T0',
                targetTier: 'T0',
                decision: 'hold',
                reason: 'Agent not found in telemetry system',
                blockedDimensions: [],
                metDimensions: [],
                overallScore: 0,
                dimensionScores: {},
            };
        }

        const currentTierIndex = TRUST_TIERS.findIndex(t => t.name === state.tier);
        const currentTierDef = TRUST_TIERS[currentTierIndex];
        const nextTierDef = TRUST_TIERS[currentTierIndex + 1];
        const prevTierDef = TRUST_TIERS[currentTierIndex - 1];

        const dimensionScores: Record<string, number> = {};
        for (const [name, dimState] of Object.entries(state.dimensions)) {
            dimensionScores[name] = dimState.score;
        }

        // Check for demotion
        if (currentTierDef && state.overall < currentTierDef.min * this.demotionThreshold) {
            if (prevTierDef) {
                return {
                    agentId,
                    timestamp: Date.now(),
                    currentTier: state.tier,
                    targetTier: prevTierDef.name as TierName,
                    decision: 'demote',
                    reason: `Overall score (${state.overall}) dropped below ${Math.round(currentTierDef.min * this.demotionThreshold)} (80% of tier minimum)`,
                    blockedDimensions: [],
                    metDimensions: [],
                    overallScore: state.overall,
                    dimensionScores,
                };
            }
        }

        // Check for promotion
        if (!nextTierDef) {
            return {
                agentId,
                timestamp: Date.now(),
                currentTier: state.tier,
                targetTier: state.tier,
                decision: 'hold',
                reason: 'Already at maximum tier (T6 Sovereign)',
                blockedDimensions: [],
                metDimensions: Object.keys(dimensionScores),
                overallScore: state.overall,
                dimensionScores,
            };
        }

        // Check gating thresholds
        const gateKey = `${state.tier}->${nextTierDef.name}`;
        const thresholds = GATING_THRESHOLDS[gateKey];

        if (!thresholds) {
            // No gates defined, use score-based promotion
            if (state.overall >= nextTierDef.min) {
                return {
                    agentId,
                    timestamp: Date.now(),
                    currentTier: state.tier,
                    targetTier: nextTierDef.name as TierName,
                    decision: 'promote',
                    reason: `Overall score (${state.overall}) meets ${nextTierDef.name} minimum (${nextTierDef.min})`,
                    blockedDimensions: [],
                    metDimensions: Object.keys(dimensionScores),
                    overallScore: state.overall,
                    dimensionScores,
                };
            }
        }

        // Check each dimension threshold
        const blockedDimensions: string[] = [];
        const metDimensions: string[] = [];

        for (const [dim, threshold] of Object.entries(thresholds || {})) {
            const score = dimensionScores[dim] ?? 0;
            if (score >= threshold) {
                metDimensions.push(dim);
            } else {
                blockedDimensions.push(`${dim} (${Math.round(score)} < ${threshold})`);
            }
        }

        // Also check overall score meets tier minimum
        const overallMet = state.overall >= nextTierDef.min;
        if (!overallMet) {
            blockedDimensions.push(`Overall (${state.overall} < ${nextTierDef.min})`);
        }

        if (blockedDimensions.length === 0) {
            return {
                agentId,
                timestamp: Date.now(),
                currentTier: state.tier,
                targetTier: nextTierDef.name as TierName,
                decision: 'promote',
                reason: `All gating thresholds met for ${nextTierDef.name}`,
                blockedDimensions: [],
                metDimensions,
                overallScore: state.overall,
                dimensionScores,
            };
        }

        return {
            agentId,
            timestamp: Date.now(),
            currentTier: state.tier,
            targetTier: state.tier,
            decision: 'hold',
            reason: `${blockedDimensions.length} dimension(s) below threshold for ${nextTierDef.name}`,
            blockedDimensions,
            metDimensions,
            overallScore: state.overall,
            dimensionScores,
        };
    }

    /**
     * Execute a tier change (promotion or demotion)
     */
    executeTierChange(decision: GatingDecision, approvedBy?: string): boolean {
        if (decision.decision === 'hold') {
            return false;
        }

        const collector = getTelemetryCollector();
        const state = collector.getState(decision.agentId);

        if (!state) {
            return false;
        }

        // Record audit entry
        const audit: TierChangeAudit = {
            agentId: decision.agentId,
            timestamp: Date.now(),
            fromTier: decision.currentTier,
            toTier: decision.targetTier,
            decision,
            approvedBy,
        };

        this.auditLog.push(audit);
        this.saveAuditLog();

        // The tier change is reflected in the agent state through telemetry
        // The telemetry collector recalculates tier based on overall score
        console.log(
            `[GatingEngine] ${decision.decision.toUpperCase()}: ${decision.agentId} ` +
            `${decision.currentTier} -> ${decision.targetTier} ` +
            `(${decision.reason})`
        );

        return true;
    }

    /**
     * Process a manual promotion request
     */
    processPromotionRequest(request: PromotionRequest): GatingDecision {
        const decision = this.evaluateGating(request.agentId);

        // Check if requested tier matches evaluation
        if (decision.targetTier !== request.targetTier) {
            return {
                ...decision,
                decision: 'hold',
                reason: `Requested tier ${request.targetTier} does not match evaluated tier ${decision.targetTier}. ` +
                        `Blocked by: ${decision.blockedDimensions.join(', ')}`,
            };
        }

        return decision;
    }

    /**
     * Run automatic gating evaluation for all agents
     */
    runAutoGating(): GatingDecision[] {
        if (!this.autoPromoteEnabled) {
            return [];
        }

        const collector = getTelemetryCollector();
        const decisions: GatingDecision[] = [];

        for (const state of collector.getAllStates()) {
            const decision = this.evaluateGating(state.agentId);

            if (decision.decision !== 'hold') {
                this.executeTierChange(decision, 'auto-gating');
                decisions.push(decision);
            }
        }

        return decisions;
    }

    /**
     * Get gating requirements for next tier
     */
    getNextTierRequirements(currentTier: TierName): {
        nextTier: string;
        thresholds: Record<string, number>;
        scoreRequired: number;
    } | null {
        const tierIndex = TRUST_TIERS.findIndex(t => t.name === currentTier);
        const nextTierDef = TRUST_TIERS[tierIndex + 1];

        if (!nextTierDef) {
            return null;
        }

        const gateKey = `${currentTier}->${nextTierDef.name}`;
        const thresholds = GATING_THRESHOLDS[gateKey] || {};

        return {
            nextTier: nextTierDef.name,
            thresholds,
            scoreRequired: nextTierDef.min,
        };
    }

    /**
     * Get audit history for an agent
     */
    getAgentAuditHistory(agentId: string): TierChangeAudit[] {
        return this.auditLog.filter(a => a.agentId === agentId);
    }

    /**
     * Get recent audit entries
     */
    getRecentAuditEntries(limit: number = 50): TierChangeAudit[] {
        return this.auditLog.slice(-limit).reverse();
    }

    /**
     * Enable/disable auto-promotion
     */
    setAutoPromote(enabled: boolean): void {
        this.autoPromoteEnabled = enabled;
    }

    /**
     * Set demotion threshold (percentage of tier minimum)
     */
    setDemotionThreshold(threshold: number): void {
        this.demotionThreshold = Math.max(0.5, Math.min(1.0, threshold));
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let gatingEngine: GatingEngine | null = null;

export function getGatingEngine(auditPath?: string): GatingEngine {
    if (!gatingEngine) {
        gatingEngine = new GatingEngine(auditPath);
    }
    return gatingEngine;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Check if an agent can be promoted
 */
export function canPromote(agentId: string): {
    canPromote: boolean;
    blockedBy: string[];
    nextTier: string;
} {
    const decision = getGatingEngine().evaluateGating(agentId);
    return {
        canPromote: decision.decision === 'promote',
        blockedBy: decision.blockedDimensions,
        nextTier: decision.targetTier,
    };
}

/**
 * Request manual promotion review
 */
export function requestPromotion(
    agentId: string,
    requestedBy: string,
    targetTier: TierName,
    justification: string
): GatingDecision {
    return getGatingEngine().processPromotionRequest({
        agentId,
        requestedBy,
        targetTier,
        justification,
    });
}

/**
 * Run auto-gating for all agents
 */
export function runAutoGating(): GatingDecision[] {
    return getGatingEngine().runAutoGating();
}

export default GatingEngine;
