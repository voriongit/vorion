/**
 * Unified Trust Service
 *
 * Provides a single entry point for all trust-related operations, coordinating
 * between multiple trust subsystems:
 *
 * - TrustEngine (core): FICO-style multi-component scoring, inheritance, penalties
 * - TrustScoreCalculator (service): Event-based scoring with decay
 * - TrustGateEngine: Action approval/denial based on trust thresholds
 * - TrustEventStore: Tamper-proof audit trail with hash chain verification
 * - TrustAnomalyDetector: Behavioral anomaly detection
 *
 * USAGE GUIDE:
 * - For initial trust score creation: use TrustEngine.createTrust()
 * - For recording behavioral events: use TrustScoreCalculator.recordEvent()
 * - For action approval decisions: use TrustGateEngine.evaluate()
 * - For audit trail: use TrustEventStore
 * - For anomaly detection: use TrustAnomalyDetector
 *
 * SCORE SYSTEM:
 * - All scores use FICO-style 300-1000 range
 * - Tier thresholds are defined in TIER_THRESHOLDS (exported below)
 * - Event-based scoring starts at baseScore (300) and adds/subtracts points
 */

import { EventEmitter } from 'eventemitter3';
import type { AgentId, TrustLevel, AgentTier, TrustScore } from '../types.js';

// Re-export canonical tier thresholds - SINGLE SOURCE OF TRUTH
export { TIER_THRESHOLDS, SCORE_RANGE, COMPONENT_WEIGHTS } from '../core/types/trust.js';
export type {
    EnhancedTrustScore,
    TrustComponents,
    ComponentScore,
    TrustTrend,
    TrustCalculatorConfig,
} from '../core/types/trust.js';

// Re-export service-level types
export type {
    TrustEventType,
    TrustEvent,
    AgentTrustState,
    ScoreChange,
} from './TrustScoreCalculator.js';

export type {
    RiskLevel,
    ActionCategory,
    GateDecision,
    ActionRequest,
    AgentContext,
    GateResult,
    GateConfig,
} from './TrustGateEngine.js';

// Import implementations for facade methods
import { TrustEngine } from '../core/TrustEngine.js';
import { TrustScoreCalculator as ServiceCalculator, type TrustEventType } from './TrustScoreCalculator.js';
import { TrustGateEngine, type ActionRequest, type AgentContext, type GateResult, type GateConfig } from './TrustGateEngine.js';
import { TrustEventStore } from './TrustEventStore.js';
import { TrustAnomalyDetector, type Anomaly } from './TrustAnomalyDetector.js';
import { TIER_THRESHOLDS, SCORE_RANGE } from '../core/types/trust.js';

// ============================================================================
// Events
// ============================================================================

interface TrustServiceEvents {
    'trust:score-updated': (agentId: string, oldScore: number, newScore: number, reason: string) => void;
    'trust:tier-changed': (agentId: string, oldTier: TrustLevel, newTier: TrustLevel) => void;
    'trust:anomaly-detected': (agentId: string, anomaly: Anomaly) => void;
    'trust:action-evaluated': (result: GateResult) => void;
}

// ============================================================================
// Unified Trust Service
// ============================================================================

export class TrustService extends EventEmitter<TrustServiceEvents> {
    private engine: TrustEngine;
    private calculator: ServiceCalculator;
    private gate: TrustGateEngine;
    private eventStore: TrustEventStore;
    private anomalyDetector: TrustAnomalyDetector;

    constructor(options?: {
        gateConfig?: Partial<GateConfig>;
    }) {
        super();

        // Initialize subsystems
        this.engine = new TrustEngine();
        this.calculator = new ServiceCalculator();
        this.gate = new TrustGateEngine(options?.gateConfig);
        this.eventStore = new TrustEventStore();
        this.anomalyDetector = new TrustAnomalyDetector();

        // Wire up event forwarding
        this.setupEventForwarding();
    }

    private setupEventForwarding(): void {
        // Forward score changes
        this.calculator.on('score:changed', (change) => {
            this.emit('trust:score-updated', change.agentId, change.oldScore, change.newScore, change.eventType);

            // Get org context
            const state = this.calculator.getAgentState(change.agentId);
            const orgId = state?.orgId ?? 'default';

            // Check for tier changes
            const oldTier = this.scoreToTier(change.oldScore);
            const newTier = this.scoreToTier(change.newScore);
            if (oldTier !== newTier) {
                this.emit('trust:tier-changed', change.agentId, oldTier, newTier);
            }

            // Record in event store for audit trail
            this.eventStore.append({
                agentId: change.agentId,
                orgId: orgId,
                eventType: change.eventType as any, // Service eventType maps to store eventType
                points: change.delta,
                oldScore: change.oldScore,
                newScore: change.newScore,
                reason: change.reason,
            });

            // Check for anomalies
            this.anomalyDetector.recordScoreChange(change.agentId, orgId, change.oldScore, change.newScore);
        });

        // Forward gate decisions
        this.gate.on('gate:evaluated', (result) => {
            this.emit('trust:action-evaluated', result);
        });
    }

    // =========================================================================
    // Core Trust Operations
    // =========================================================================

    /**
     * Create trust score for a new agent
     */
    createAgentTrust(agentId: AgentId, params: {
        tier: AgentTier;
        parentId: AgentId | null;
        initialTrust?: number;
    }): TrustScore {
        return this.engine.createTrust(agentId, params);
    }

    /**
     * Get current trust score for an agent
     */
    getTrustScore(agentId: string): number | undefined {
        const state = this.calculator.getAgentState(agentId);
        return state?.currentScore;
    }

    /**
     * Get trust tier for a score
     */
    scoreToTier(score: number): TrustLevel {
        for (const [level, threshold] of Object.entries(TIER_THRESHOLDS)) {
            if (score >= threshold.min && score <= threshold.max) {
                return level as TrustLevel;
            }
        }
        return 'PASSIVE';
    }

    /**
     * Get tier number for a trust level
     */
    tierToNumber(level: TrustLevel): AgentTier {
        return TIER_THRESHOLDS[level]?.tier ?? 0;
    }

    // =========================================================================
    // Event-Based Scoring
    // =========================================================================

    /**
     * Record a trust-affecting event (task completion, failure, violation, etc.)
     */
    recordEvent(
        agentId: string,
        orgId: string,
        eventType: TrustEventType,
        options?: {
            reason?: string;
            points?: number;
            metadata?: Record<string, unknown>;
        }
    ): void {
        // Get score before
        const stateBefore = this.calculator.getAgentState(agentId);
        const scoreBefore = stateBefore?.currentScore ?? 300;

        // Record the event
        const event = this.calculator.recordEvent(agentId, orgId, eventType, options);

        // Get score after
        const stateAfter = this.calculator.getAgentState(agentId);
        const scoreAfter = stateAfter?.currentScore ?? 300;

        // Also record in tamper-proof event store
        this.eventStore.append({
            agentId,
            orgId,
            eventType: eventType as any, // TrustEventType from calculator maps to store
            points: event.points,
            oldScore: scoreBefore,
            newScore: scoreAfter,
            reason: options?.reason,
            metadata: options?.metadata,
        });

        // Feed to anomaly detector
        this.anomalyDetector.recordEvent(agentId, orgId, eventType, event.points);
    }

    /**
     * Get score breakdown for an agent showing contribution of each event type
     */
    getScoreBreakdown(agentId: string): Record<TrustEventType, {
        count: number;
        totalPoints: number;
        currentContribution: number;
    }> | null {
        return this.calculator.getScoreBreakdown(agentId);
    }

    // =========================================================================
    // Action Gating
    // =========================================================================

    /**
     * Evaluate an action request against trust rules
     */
    evaluateAction(request: ActionRequest, context: AgentContext): GateResult {
        return this.gate.evaluate(request, context);
    }

    /**
     * Check if an agent can auto-approve an action type
     */
    canAutoApprove(agentId: string, actionType: string, context: AgentContext): boolean {
        const result = this.gate.evaluate({
            id: `check-${Date.now()}`,
            agentId,
            orgId: 'check',
            actionType,
            category: 'execute',
            description: 'Auto-approval check',
            requestedAt: new Date(),
        }, context);

        return result.decision === 'auto_approve';
    }

    // =========================================================================
    // Audit & Verification
    // =========================================================================

    /**
     * Verify integrity of an agent's trust event chain
     */
    verifyEventChain(agentId: string): {
        valid: boolean;
        errors: string[];
    } {
        return this.eventStore.verifyAgentChain(agentId);
    }

    /**
     * Get anomalies detected for an agent
     */
    checkForAnomalies(agentId: string): Anomaly[] {
        return this.anomalyDetector.getAnomalies({ agentId });
    }

    // =========================================================================
    // Statistics
    // =========================================================================

    /**
     * Get trust statistics for an organization
     */
    getOrgStats(orgId: string): {
        totalAgents: number;
        byTier: Record<TrustLevel, number>;
        avgScore: number;
    } {
        const scores = this.calculator.getOrgScores(orgId);
        const byTier: Record<TrustLevel, number> = {
            SOVEREIGN: 0,
            EXECUTIVE: 0,
            TACTICAL: 0,
            OPERATIONAL: 0,
            WORKER: 0,
            PASSIVE: 0,
        };

        let totalScore = 0;
        for (const [_agentId, score] of scores) {
            const tier = this.scoreToTier(score);
            byTier[tier]++;
            totalScore += score;
        }

        return {
            totalAgents: scores.size,
            byTier,
            avgScore: scores.size > 0 ? totalScore / scores.size : SCORE_RANGE.default,
        };
    }

    // =========================================================================
    // Subsystem Access (for advanced usage)
    // =========================================================================

    /**
     * Get direct access to the core TrustEngine
     * Use for: inheritance management, HITL level, validation reports
     */
    getEngine(): TrustEngine {
        return this.engine;
    }

    /**
     * Get direct access to the event-based calculator
     * Use for: organization-specific configs, event decay management
     */
    getCalculator(): ServiceCalculator {
        return this.calculator;
    }

    /**
     * Get direct access to the gate engine
     * Use for: custom rules, rate limit configuration
     */
    getGate(): TrustGateEngine {
        return this.gate;
    }

    /**
     * Get direct access to the event store
     * Use for: audit trail queries, replay functionality
     */
    getEventStore(): TrustEventStore {
        return this.eventStore;
    }

    /**
     * Get direct access to the anomaly detector
     * Use for: threshold configuration, batch anomaly checks
     */
    getAnomalyDetector(): TrustAnomalyDetector {
        return this.anomalyDetector;
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: TrustService | null = null;

/**
 * Get the singleton TrustService instance
 */
export function getTrustService(options?: { gateConfig?: Partial<GateConfig> }): TrustService {
    if (!instance) {
        instance = new TrustService(options);
    }
    return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetTrustService(): void {
    instance = null;
}

// Default export
export default TrustService;
