/**
 * Trust Score Calculator
 *
 * TRUST-1.2 through TRUST-1.7: Multi-component FICO-style trust scoring.
 * Calculates individual component scores and aggregates them into a final score.
 */

import { EventEmitter } from 'eventemitter3';
import type { AgentId, TrustLevel } from '../types.js';
import type {
    ComponentScore,
    TrustComponents,
    EnhancedTrustScore,
    TrustTrend,
    TrustCalculatorConfig,
    DecisionAccuracyData,
    EthicsComplianceData,
    TaskSuccessData,
    OperationalStabilityData,
    PeerReviewsData,
    RiskLevel,
} from './types/trust.js';
import {
    COMPONENT_WEIGHTS,
    SCORE_RANGE,
    TIER_THRESHOLDS,
    RISK_WEIGHTS,
    DEFAULT_CALCULATOR_CONFIG,
} from './types/trust.js';

// ============================================================================
// Events
// ============================================================================

interface TrustCalculatorEvents {
    'score:calculated': (agentId: AgentId, score: EnhancedTrustScore) => void;
    'score:component-updated': (agentId: AgentId, component: keyof TrustComponents, score: ComponentScore) => void;
    'score:trend-changed': (agentId: AgentId, trend: TrustTrend, delta: number) => void;
}

// ============================================================================
// Trust Score Calculator Class
// ============================================================================

export class TrustScoreCalculator extends EventEmitter<TrustCalculatorEvents> {
    private config: TrustCalculatorConfig;
    private scoreHistory: Map<AgentId, Array<{ score: number; timestamp: Date }>> = new Map();

    constructor(config: Partial<TrustCalculatorConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CALCULATOR_CONFIG, ...config };
    }

    // -------------------------------------------------------------------------
    // TRUST-1.2: Decision Accuracy Calculator
    // -------------------------------------------------------------------------

    /**
     * Calculate decision accuracy score from task approval history.
     * Uses risk-adjusted weighting to emphasize high-stakes decisions.
     *
     * @param data Array of decision data with approval status and risk levels
     * @returns ComponentScore for decision accuracy
     */
    calculateDecisionAccuracy(data: DecisionAccuracyData[]): ComponentScore {
        const now = new Date();

        if (data.length === 0) {
            // New agent with no history - return neutral score
            return {
                raw: SCORE_RANGE.neutral,
                weighted: SCORE_RANGE.neutral * COMPONENT_WEIGHTS.decisionAccuracy,
                samples: 0,
                confidence: 0,
                lastUpdated: now,
            };
        }

        // Calculate risk-weighted totals
        let weightedApproved = 0;
        let weightedTotal = 0;

        for (const decision of data) {
            const riskMultiplier = RISK_WEIGHTS[decision.riskLevel];
            const decisionWeight = riskMultiplier;

            weightedApproved += decision.approved * decisionWeight;
            weightedTotal += (decision.approved + decision.rejected) * decisionWeight;
        }

        // Calculate raw score (0-100)
        const raw = weightedTotal > 0
            ? Math.round((weightedApproved / weightedTotal) * 100)
            : SCORE_RANGE.neutral;

        // Calculate confidence based on sample size
        const totalSamples = data.reduce((sum, d) => sum + d.approved + d.rejected, 0);
        const confidence = Math.min(1, totalSamples / this.config.minSamplesForFullConfidence);

        return {
            raw,
            weighted: raw * COMPONENT_WEIGHTS.decisionAccuracy,
            samples: totalSamples,
            confidence,
            lastUpdated: now,
        };
    }

    // -------------------------------------------------------------------------
    // TRUST-1.3: Ethics Compliance Calculator
    // -------------------------------------------------------------------------

    /**
     * Calculate ethics compliance score from violations and escalations.
     * Starts at 100 and deducts points for each violation/escalation.
     *
     * @param data Violation and escalation counts
     * @returns ComponentScore for ethics compliance
     */
    calculateEthicsCompliance(data: EthicsComplianceData): ComponentScore {
        const now = new Date();

        // Penalty calculation: -10 per violation, -5 per escalation
        const violationPenalty = data.violations * 10;
        const escalationPenalty = data.escalations * 5;

        // Calculate raw score (floored at 0)
        const raw = Math.max(0, 100 - violationPenalty - escalationPenalty);

        // Ethics compliance data is always complete - full confidence
        const confidence = 1;

        return {
            raw,
            weighted: raw * COMPONENT_WEIGHTS.ethicsCompliance,
            samples: data.violations + data.escalations,
            confidence,
            lastUpdated: now,
        };
    }

    // -------------------------------------------------------------------------
    // TRUST-1.4: Task Success Calculator
    // -------------------------------------------------------------------------

    /**
     * Calculate task success score from completion rate.
     *
     * @param data Completed and failed task counts
     * @returns ComponentScore for task success
     */
    calculateTaskSuccess(data: TaskSuccessData): ComponentScore {
        const now = new Date();
        const total = data.completed + data.failed;

        if (total === 0) {
            // No tasks - return neutral score
            return {
                raw: SCORE_RANGE.neutral,
                weighted: SCORE_RANGE.neutral * COMPONENT_WEIGHTS.taskSuccess,
                samples: 0,
                confidence: 0,
                lastUpdated: now,
            };
        }

        // Calculate raw score: (completed / total) * 100
        const raw = Math.round((data.completed / total) * 100);

        // Confidence based on sample size (full confidence at 50 tasks)
        const confidence = Math.min(1, total / 50);

        return {
            raw,
            weighted: raw * COMPONENT_WEIGHTS.taskSuccess,
            samples: total,
            confidence,
            lastUpdated: now,
        };
    }

    // -------------------------------------------------------------------------
    // TRUST-1.5: Operational Stability Calculator
    // -------------------------------------------------------------------------

    /**
     * Calculate operational stability from error rates and response times.
     *
     * @param data Error count and average response time
     * @returns ComponentScore for operational stability
     */
    calculateOperationalStability(data: OperationalStabilityData): ComponentScore {
        const now = new Date();

        // Error penalty: -5 per error, max -50
        const errorPenalty = Math.min(50, data.errors * 5);

        // Response time penalty: -1 per 100ms above 500ms baseline
        const baselineMs = 500;
        const responsePenalty = data.avgResponseTimeMs > baselineMs
            ? Math.floor((data.avgResponseTimeMs - baselineMs) / 100)
            : 0;

        // Calculate raw score (floored at 0)
        const raw = Math.max(0, 100 - errorPenalty - responsePenalty);

        // Confidence is high if we have data
        const hasData = data.errors > 0 || data.avgResponseTimeMs > 0;
        const confidence = hasData ? 0.8 : 0;

        return {
            raw,
            weighted: raw * COMPONENT_WEIGHTS.operationalStability,
            samples: data.errors,
            confidence,
            lastUpdated: now,
        };
    }

    // -------------------------------------------------------------------------
    // TRUST-1.6: Peer Reviews Calculator
    // -------------------------------------------------------------------------

    /**
     * Calculate peer review score from Blackboard contributions.
     *
     * @param data Endorsements, solutions, and total contributions
     * @returns ComponentScore for peer reviews
     */
    calculatePeerReviews(data: PeerReviewsData): ComponentScore {
        const now = new Date();

        if (data.totalContributions === 0) {
            // No contributions - return 0 score with 0 confidence
            return {
                raw: 0,
                weighted: 0,
                samples: 0,
                confidence: 0,
                lastUpdated: now,
            };
        }

        // Score: +5 per endorsement, +20 per resolved solution, capped at 100
        const endorsementPoints = data.endorsements * 5;
        const solutionPoints = data.resolvedSolutions * 20;
        const raw = Math.min(100, endorsementPoints + solutionPoints);

        // Confidence based on contribution count (full at 20 contributions)
        const confidence = Math.min(1, data.totalContributions / 20);

        return {
            raw,
            weighted: raw * COMPONENT_WEIGHTS.peerReviews,
            samples: data.totalContributions,
            confidence,
            lastUpdated: now,
        };
    }

    // -------------------------------------------------------------------------
    // TRUST-1.7: Weighted Score Aggregation
    // -------------------------------------------------------------------------

    /**
     * Aggregate all component scores into a final FICO-style score.
     *
     * @param components All five component scores
     * @param inheritedScore Score inherited from parent agent (0 if none)
     * @param penalties Current penalty deductions
     * @returns Final score in 300-1000 range
     */
    aggregateScore(
        components: TrustComponents,
        inheritedScore: number = 0,
        penalties: number = 0
    ): { ficoScore: number; level: TrustLevel } {
        // Sum weighted components (each component is 0-100, weights sum to 1.0)
        const weightedSum =
            components.decisionAccuracy.raw * COMPONENT_WEIGHTS.decisionAccuracy +
            components.ethicsCompliance.raw * COMPONENT_WEIGHTS.ethicsCompliance +
            components.taskSuccess.raw * COMPONENT_WEIGHTS.taskSuccess +
            components.operationalStability.raw * COMPONENT_WEIGHTS.operationalStability +
            components.peerReviews.raw * COMPONENT_WEIGHTS.peerReviews;

        // Scale to FICO range (300-1000)
        // weightedSum is 0-100, scale to 700 point range, add 300 base
        const componentScore = SCORE_RANGE.min + (weightedSum / 100) * (SCORE_RANGE.max - SCORE_RANGE.min);

        // Apply inheritance bonus (80% of inherited)
        const inheritanceBonus = inheritedScore * this.config.inheritanceRate;

        // Calculate final score with penalties
        const finalScore = Math.round(
            Math.max(SCORE_RANGE.min, Math.min(SCORE_RANGE.max,
                componentScore + inheritanceBonus - penalties
            ))
        );

        // Derive level from score
        const level = this.scoreToLevel(finalScore);

        return { ficoScore: finalScore, level };
    }

    /**
     * Calculate overall confidence from component confidences.
     * Uses weighted average based on component weights.
     */
    calculateOverallConfidence(components: TrustComponents): number {
        return (
            components.decisionAccuracy.confidence * COMPONENT_WEIGHTS.decisionAccuracy +
            components.ethicsCompliance.confidence * COMPONENT_WEIGHTS.ethicsCompliance +
            components.taskSuccess.confidence * COMPONENT_WEIGHTS.taskSuccess +
            components.operationalStability.confidence * COMPONENT_WEIGHTS.operationalStability +
            components.peerReviews.confidence * COMPONENT_WEIGHTS.peerReviews
        );
    }

    /**
     * Calculate 7-day trend from score history.
     */
    calculateTrend(agentId: AgentId, currentScore: number): { trend: TrustTrend; delta: number } {
        const history = this.scoreHistory.get(agentId) ?? [];

        // Find score from ~7 days ago
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const oldEntry = history.find(h => h.timestamp <= sevenDaysAgo);

        if (!oldEntry) {
            // Not enough history
            return { trend: 'stable', delta: 0 };
        }

        const delta = currentScore - oldEntry.score;

        let trend: TrustTrend;
        if (delta > 10) {
            trend = 'rising';
        } else if (delta < -10) {
            trend = 'falling';
        } else {
            trend = 'stable';
        }

        return { trend, delta };
    }

    /**
     * Record a score for trend tracking.
     */
    recordScore(agentId: AgentId, score: number): void {
        const history = this.scoreHistory.get(agentId) ?? [];
        history.push({ score, timestamp: new Date() });

        // Keep only last 30 days of history
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const filtered = history.filter(h => h.timestamp >= thirtyDaysAgo);

        this.scoreHistory.set(agentId, filtered);
    }

    // -------------------------------------------------------------------------
    // Full Score Calculation
    // -------------------------------------------------------------------------

    /**
     * Calculate complete enhanced trust score for an agent.
     * This is the main entry point for score calculation.
     *
     * @param agentId The agent to calculate score for
     * @param data All input data for component calculations
     * @param inherited Inherited score from parent
     * @param penalties Current penalties
     * @returns Complete EnhancedTrustScore
     */
    calculateFullScore(
        agentId: AgentId,
        data: {
            decisionAccuracy: DecisionAccuracyData[];
            ethicsCompliance: EthicsComplianceData;
            taskSuccess: TaskSuccessData;
            operationalStability: OperationalStabilityData;
            peerReviews: PeerReviewsData;
        },
        inherited: number = 0,
        penalties: number = 0
    ): EnhancedTrustScore {
        const now = new Date();

        // Calculate all components
        const components: TrustComponents = {
            decisionAccuracy: this.calculateDecisionAccuracy(data.decisionAccuracy),
            ethicsCompliance: this.calculateEthicsCompliance(data.ethicsCompliance),
            taskSuccess: this.calculateTaskSuccess(data.taskSuccess),
            operationalStability: this.calculateOperationalStability(data.operationalStability),
            peerReviews: this.calculatePeerReviews(data.peerReviews),
        };

        // Aggregate to final score
        const { ficoScore, level } = this.aggregateScore(components, inherited, penalties);

        // Calculate overall confidence
        const overallConfidence = this.calculateOverallConfidence(components);

        // Calculate trend
        const { trend, delta: trendDelta } = this.calculateTrend(agentId, ficoScore);

        // Record for future trend calculation
        this.recordScore(agentId, ficoScore);

        const enhancedScore: EnhancedTrustScore = {
            // Base TrustScore fields
            level,
            numeric: ficoScore,
            inherited,
            earned: ficoScore - inherited + penalties, // Reverse-engineer earned
            penalties,
            lastVerified: now,
            parentId: null, // Set by caller

            // Enhanced fields
            components,
            ficoScore,
            trend,
            trendDelta,
            overallConfidence,
            lastCalculated: now,
        };

        this.emit('score:calculated', agentId, enhancedScore);

        return enhancedScore;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Convert numeric score to trust level.
     */
    private scoreToLevel(score: number): TrustLevel {
        for (const [level, threshold] of Object.entries(TIER_THRESHOLDS)) {
            if (score >= threshold.min && score <= threshold.max) {
                return level as TrustLevel;
            }
        }
        return 'PASSIVE';
    }

    /**
     * Get current configuration.
     */
    getConfig(): TrustCalculatorConfig {
        return { ...this.config };
    }

    /**
     * Update configuration.
     */
    setConfig(config: Partial<TrustCalculatorConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Clear score history for an agent.
     */
    clearHistory(agentId: AgentId): void {
        this.scoreHistory.delete(agentId);
    }

    /**
     * Clear all score history.
     */
    clearAllHistory(): void {
        this.scoreHistory.clear();
    }
}

// Singleton instance
export const trustScoreCalculator = new TrustScoreCalculator();
