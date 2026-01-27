/**
 * Trust Telemetry Collection System
 *
 * Collects real-time agent behavior metrics to update trust scores.
 * Integrates with A3I hooks for automatic data collection.
 *
 * 12-Dimension Model aligned with simulation.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { DIMENSIONS, TRUST_TIERS, GATING_THRESHOLDS, TierName } from './simulation';

// =============================================================================
// TELEMETRY TYPES
// =============================================================================

export interface TelemetryEvent {
    timestamp: number;
    agentId: string;
    eventType: TelemetryEventType;
    dimension: string;
    delta: number;           // Score change (-100 to +100)
    source: string;          // What triggered this event
    metadata?: Record<string, unknown>;
}

export type TelemetryEventType =
    | 'task_complete'
    | 'task_failed'
    | 'policy_violation'
    | 'policy_compliance'
    | 'escalation'
    | 'collaboration'
    | 'audit_pass'
    | 'audit_fail'
    | 'consent_grant'
    | 'consent_violation'
    | 'resource_efficient'
    | 'resource_waste'
    | 'explanation_provided'
    | 'opacity_detected'
    | 'resilience_test_pass'
    | 'resilience_test_fail'
    | 'provenance_verified'
    | 'provenance_unknown'
    | 'humility_demonstrated'
    | 'overconfidence_detected'
    | 'alignment_confirmed'
    | 'alignment_drift';

export interface AgentTrustState {
    agentId: string;
    agentName: string;
    tier: TierName;
    tierName: string;
    overall: number;
    dimensions: Record<string, DimensionState>;
    history: TrustSnapshot[];
    lastUpdated: number;
    eventLog: TelemetryEvent[];
}

export interface DimensionState {
    name: string;
    score: number;
    trend: 'up' | 'down' | 'stable';
    recentEvents: number;     // Events in last 24h
    lastEvent?: TelemetryEvent;
}

export interface TrustSnapshot {
    timestamp: number;
    overall: number;
    dimensions: Record<string, number>;
    event?: string;
}

// =============================================================================
// EVENT TO DIMENSION MAPPING
// =============================================================================

const EVENT_DIMENSION_MAP: Record<TelemetryEventType, { dimension: string; baseDelta: number }> = {
    // Foundation
    task_complete: { dimension: 'Capability', baseDelta: 5 },
    task_failed: { dimension: 'Capability', baseDelta: -10 },
    policy_compliance: { dimension: 'Behavior', baseDelta: 3 },
    policy_violation: { dimension: 'Behavior', baseDelta: -20 },

    // Alignment
    alignment_confirmed: { dimension: 'Alignment', baseDelta: 5 },
    alignment_drift: { dimension: 'Alignment', baseDelta: -15 },
    collaboration: { dimension: 'Collaboration', baseDelta: 4 },
    humility_demonstrated: { dimension: 'Humility', baseDelta: 5 },
    overconfidence_detected: { dimension: 'Humility', baseDelta: -8 },
    escalation: { dimension: 'Humility', baseDelta: 3 },

    // Governance
    explanation_provided: { dimension: 'Explainability', baseDelta: 4 },
    opacity_detected: { dimension: 'Explainability', baseDelta: -10 },
    consent_grant: { dimension: 'Consent', baseDelta: 3 },
    consent_violation: { dimension: 'Consent', baseDelta: -25 },
    provenance_verified: { dimension: 'Provenance', baseDelta: 5 },
    provenance_unknown: { dimension: 'Provenance', baseDelta: -15 },

    // Operational
    audit_pass: { dimension: 'Observability', baseDelta: 5 },
    audit_fail: { dimension: 'Observability', baseDelta: -15 },
    resilience_test_pass: { dimension: 'Resilience', baseDelta: 5 },
    resilience_test_fail: { dimension: 'Resilience', baseDelta: -10 },
    resource_efficient: { dimension: 'Stewardship', baseDelta: 3 },
    resource_waste: { dimension: 'Stewardship', baseDelta: -8 },
};

// =============================================================================
// TELEMETRY COLLECTOR
// =============================================================================

export class TelemetryCollector {
    private storePath: string;
    private states: Map<string, AgentTrustState> = new Map();
    private eventBuffer: TelemetryEvent[] = [];
    private flushInterval: NodeJS.Timeout | null = null;

    constructor(storePath: string = '.vorion/trust') {
        this.storePath = storePath;
        this.ensureStoreExists();
        this.loadAllStates();
    }

    private ensureStoreExists(): void {
        try {
            if (!fs.existsSync(this.storePath)) {
                fs.mkdirSync(this.storePath, { recursive: true });
            }
        } catch {
            // Ignore if can't create
        }
    }

    private loadAllStates(): void {
        try {
            const files = fs.readdirSync(this.storePath);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const agentId = file.replace('.json', '');
                    const data = JSON.parse(
                        fs.readFileSync(path.join(this.storePath, file), 'utf-8')
                    );
                    this.states.set(agentId, data);
                }
            }
        } catch {
            // Fresh start if can't load
        }
    }

    /**
     * Initialize trust state for a new agent
     */
    initAgent(agentId: string, agentName: string, initialTier: TierName = 'T0'): AgentTrustState {
        const tierDef = TRUST_TIERS.find(t => t.name === initialTier) || TRUST_TIERS[0]!;
        const baseScore = tierDef.min + Math.floor((tierDef.max - tierDef.min) / 2);

        const dimensions: Record<string, DimensionState> = {};
        for (const dim of DIMENSIONS) {
            dimensions[dim.name] = {
                name: dim.name,
                score: baseScore,
                trend: 'stable',
                recentEvents: 0,
            };
        }

        const state: AgentTrustState = {
            agentId,
            agentName,
            tier: initialTier,
            tierName: tierDef.label,
            overall: baseScore,
            dimensions,
            history: [{
                timestamp: Date.now(),
                overall: baseScore,
                dimensions: Object.fromEntries(
                    Object.entries(dimensions).map(([k, v]) => [k, v.score])
                ),
                event: 'Agent initialized',
            }],
            lastUpdated: Date.now(),
            eventLog: [],
        };

        this.states.set(agentId, state);
        this.persistState(agentId);
        return state;
    }

    /**
     * Record a telemetry event and update trust scores
     */
    recordEvent(event: Omit<TelemetryEvent, 'timestamp'>): void {
        const fullEvent: TelemetryEvent = {
            ...event,
            timestamp: Date.now(),
        };

        this.eventBuffer.push(fullEvent);

        // Process immediately
        this.processEvent(fullEvent);
    }

    private processEvent(event: TelemetryEvent): void {
        let state = this.states.get(event.agentId);
        if (!state) {
            state = this.initAgent(event.agentId, event.agentId);
        }

        // Get dimension mapping
        const mapping = EVENT_DIMENSION_MAP[event.eventType];
        if (!mapping) return;

        const dimension = event.dimension || mapping.dimension;
        const delta = event.delta !== undefined ? event.delta : mapping.baseDelta;

        // Update dimension score
        const dimState = state.dimensions[dimension];
        if (dimState) {
            const oldScore = dimState.score;
            dimState.score = Math.max(0, Math.min(1000, dimState.score + delta));
            dimState.recentEvents++;
            dimState.lastEvent = event;

            // Update trend
            if (dimState.score > oldScore + 5) {
                dimState.trend = 'up';
            } else if (dimState.score < oldScore - 5) {
                dimState.trend = 'down';
            }
        }

        // Recalculate overall score
        state.overall = this.calculateOverall(state);

        // Update tier
        const newTier = this.getTierForScore(state.overall);
        state.tier = newTier.name as TierName;
        state.tierName = newTier.label;

        // Add to event log (keep last 100)
        state.eventLog.unshift(event);
        if (state.eventLog.length > 100) {
            state.eventLog = state.eventLog.slice(0, 100);
        }

        // Add history snapshot (daily)
        const lastSnapshot = state.history[state.history.length - 1];
        const dayMs = 24 * 60 * 60 * 1000;
        if (!lastSnapshot || Date.now() - lastSnapshot.timestamp > dayMs) {
            state.history.push({
                timestamp: Date.now(),
                overall: state.overall,
                dimensions: Object.fromEntries(
                    Object.entries(state.dimensions).map(([k, v]) => [k, v.score])
                ),
                event: `${event.eventType}: ${event.source}`,
            });
            // Keep last 90 days
            if (state.history.length > 90) {
                state.history = state.history.slice(-90);
            }
        }

        state.lastUpdated = Date.now();
        this.states.set(event.agentId, state);
        this.persistState(event.agentId);
    }

    private calculateOverall(state: AgentTrustState): number {
        // Use tier-appropriate weights from simulation
        const weights = this.getWeightsForTier(state.tier);
        let total = 0;
        for (const [dimName, dimState] of Object.entries(state.dimensions)) {
            const weight = weights[dimName] || 0.08;
            total += dimState.score * weight;
        }
        return Math.round(total);
    }

    private getWeightsForTier(tier: TierName): Record<string, number> {
        // Simplified weight distribution by tier
        const baseWeights: Record<string, number> = {
            Observability: 0.10, Capability: 0.10, Behavior: 0.10, Context: 0.08,
            Alignment: 0.12, Collaboration: 0.10, Humility: 0.06,
            Explainability: 0.08, Consent: 0.06, Provenance: 0.06,
            Resilience: 0.08, Stewardship: 0.06,
        };
        return baseWeights;
    }

    private getTierForScore(score: number): { name: string; label: string } {
        for (const tier of TRUST_TIERS) {
            if (score >= tier.min && score <= tier.max) {
                return tier;
            }
        }
        return TRUST_TIERS[0]!;
    }

    private persistState(agentId: string): void {
        try {
            const state = this.states.get(agentId);
            if (state) {
                const filePath = path.join(this.storePath, `${agentId}.json`);
                fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
            }
        } catch {
            // Ignore persistence errors
        }
    }

    /**
     * Get current trust state for an agent
     */
    getState(agentId: string): AgentTrustState | undefined {
        return this.states.get(agentId);
    }

    /**
     * Get all agent states
     */
    getAllStates(): AgentTrustState[] {
        return Array.from(this.states.values());
    }

    /**
     * Check if agent can be promoted to next tier
     */
    checkPromotion(agentId: string): {
        canPromote: boolean;
        blockedBy: string[];
        nextTier: string;
    } {
        const state = this.states.get(agentId);
        if (!state) {
            return { canPromote: false, blockedBy: ['Agent not found'], nextTier: 'T0' };
        }

        const tierIndex = TRUST_TIERS.findIndex(t => t.name === state.tier);
        const nextTier = TRUST_TIERS[tierIndex + 1];
        if (!nextTier) {
            return { canPromote: false, blockedBy: [], nextTier: 'MAX' };
        }

        const gateKey = `${state.tier}->${nextTier.name}`;
        const thresholds = GATING_THRESHOLDS[gateKey];
        if (!thresholds) {
            return { canPromote: true, blockedBy: [], nextTier: nextTier.name };
        }

        const blockedBy: string[] = [];
        for (const [dim, threshold] of Object.entries(thresholds)) {
            const dimState = state.dimensions[dim];
            if (!dimState || dimState.score < threshold) {
                blockedBy.push(`${dim} (${dimState?.score ?? 0} < ${threshold})`);
            }
        }

        return {
            canPromote: blockedBy.length === 0,
            blockedBy,
            nextTier: nextTier.name,
        };
    }

    /**
     * Start automatic flush interval
     */
    startAutoFlush(intervalMs: number = 60000): void {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        this.flushInterval = setInterval(() => {
            for (const agentId of this.states.keys()) {
                this.persistState(agentId);
            }
        }, intervalMs);
    }

    /**
     * Stop automatic flush
     */
    stopAutoFlush(): void {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let collector: TelemetryCollector | null = null;

export function getTelemetryCollector(storePath?: string): TelemetryCollector {
    if (!collector) {
        collector = new TelemetryCollector(storePath);
    }
    return collector;
}

// =============================================================================
// CONVENIENCE FUNCTIONS FOR A3I HOOKS
// =============================================================================

/**
 * Record a successful task completion
 */
export function recordTaskSuccess(agentId: string, taskId: string, metadata?: Record<string, unknown>): void {
    getTelemetryCollector().recordEvent({
        agentId,
        eventType: 'task_complete',
        dimension: 'Capability',
        delta: 5,
        source: taskId,
        metadata,
    });
}

/**
 * Record a task failure
 */
export function recordTaskFailure(agentId: string, taskId: string, reason: string): void {
    getTelemetryCollector().recordEvent({
        agentId,
        eventType: 'task_failed',
        dimension: 'Capability',
        delta: -10,
        source: taskId,
        metadata: { reason },
    });
}

/**
 * Record a policy violation
 */
export function recordPolicyViolation(agentId: string, policy: string, severity: 'low' | 'medium' | 'high'): void {
    const deltas = { low: -5, medium: -15, high: -30 };
    getTelemetryCollector().recordEvent({
        agentId,
        eventType: 'policy_violation',
        dimension: 'Behavior',
        delta: deltas[severity],
        source: policy,
        metadata: { severity },
    });
}

/**
 * Record consent-related events
 */
export function recordConsentEvent(agentId: string, granted: boolean, context: string): void {
    getTelemetryCollector().recordEvent({
        agentId,
        eventType: granted ? 'consent_grant' : 'consent_violation',
        dimension: 'Consent',
        delta: granted ? 3 : -25,
        source: context,
    });
}

/**
 * Record collaboration events
 */
export function recordCollaboration(agentId: string, partnerId: string, success: boolean): void {
    getTelemetryCollector().recordEvent({
        agentId,
        eventType: 'collaboration',
        dimension: 'Collaboration',
        delta: success ? 5 : -3,
        source: partnerId,
        metadata: { success },
    });
}

export default TelemetryCollector;
