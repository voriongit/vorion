/**
 * Enhanced Trust Scoring Type Definitions
 *
 * TRUST-1.1: Type definitions for the FICO-style trust scoring system.
 * These types support multi-component trust calculation with weighted aggregation.
 */

import type { TrustScore, TrustLevel, AgentTier } from '../../types.js';

// ============================================================================
// Component Weights
// ============================================================================

/**
 * Weight distribution for trust score components.
 * Total must equal 1.0 (100%).
 */
export const COMPONENT_WEIGHTS = {
    /** Decision accuracy - approval rates on risk-weighted tasks */
    decisionAccuracy: 0.35,
    /** Ethics compliance - inverse of violations and escalations */
    ethicsCompliance: 0.25,
    /** Task success - completion rate of assigned tasks */
    taskSuccess: 0.20,
    /** Operational stability - error rates and response times */
    operationalStability: 0.15,
    /** Peer reviews - Blackboard contributions and endorsements */
    peerReviews: 0.05,
} as const;

/**
 * Score range for FICO-style trust scoring (300-1000)
 */
export const SCORE_RANGE = {
    /** Minimum possible trust score */
    min: 300,
    /** Maximum possible trust score */
    max: 1000,
    /** Default score for new agents with no history */
    default: 500,
    /** Neutral score for components with no data */
    neutral: 50,
} as const;

// ============================================================================
// Score Range to Tier Mapping
// ============================================================================

/**
 * Trust tier configuration mapping score ranges to tier levels.
 */
export const TIER_THRESHOLDS: Record<TrustLevel, { min: number; max: number; tier: AgentTier }> = {
    SOVEREIGN: { min: 900, max: 1000, tier: 5 },
    EXECUTIVE: { min: 750, max: 899, tier: 4 },
    TACTICAL: { min: 600, max: 749, tier: 3 },
    OPERATIONAL: { min: 450, max: 599, tier: 2 },
    WORKER: { min: 300, max: 449, tier: 1 },
    PASSIVE: { min: 0, max: 299, tier: 0 },
};

// ============================================================================
// Component Score Interface
// ============================================================================

/**
 * Individual component score with metadata.
 * Each trust component produces this structure.
 */
export interface ComponentScore {
    /** Raw score (0-100 scale before weighting) */
    raw: number;

    /** Weighted score (raw * component weight) */
    weighted: number;

    /** Number of data samples used in calculation */
    samples: number;

    /** Confidence level (0-1) based on sample size */
    confidence: number;

    /** When this component was last calculated */
    lastUpdated: Date;
}

// ============================================================================
// Trust Components Interface
// ============================================================================

/**
 * All five trust score components.
 * Each component contributes to the final FICO-style score.
 */
export interface TrustComponents {
    /**
     * Decision Accuracy (35% weight)
     * Based on task approval rates with risk-adjusted weighting.
     * - Low risk tasks: 1x multiplier
     * - Medium risk: 1.5x multiplier
     * - High risk: 2x multiplier
     * - Critical risk: 3x multiplier
     */
    decisionAccuracy: ComponentScore;

    /**
     * Ethics Compliance (25% weight)
     * Based on violation and escalation history.
     * - Each violation: -10 points
     * - Each escalation: -5 points
     * - Starts at 100, floors at 0
     */
    ethicsCompliance: ComponentScore;

    /**
     * Task Success (20% weight)
     * Based on completed vs failed task ratio.
     * - Formula: (completed / (completed + failed)) * 100
     * - No tasks = 50 (neutral)
     */
    taskSuccess: ComponentScore;

    /**
     * Operational Stability (15% weight)
     * Based on error rates and response times.
     * - Error penalty: -5 per error (max -50)
     * - Response penalty: -1 per 100ms above 500ms baseline
     */
    operationalStability: ComponentScore;

    /**
     * Peer Reviews (5% weight)
     * Based on Blackboard contributions and endorsements.
     * - Each endorsement: +5 points
     * - Each resolved solution: +20 points
     * - Capped at 100
     */
    peerReviews: ComponentScore;
}

// ============================================================================
// Enhanced Trust Score Interface
// ============================================================================

/**
 * Trend direction for trust score over time.
 */
export type TrustTrend = 'rising' | 'stable' | 'falling';

/**
 * Enhanced trust score with FICO-style scoring and component breakdown.
 * Extends the base TrustScore with additional fields.
 */
export interface EnhancedTrustScore extends TrustScore {
    /**
     * Individual component scores.
     * Each component has its own raw score, weight, and confidence.
     */
    components: TrustComponents;

    /**
     * Final FICO-style score (300-1000 range).
     * Calculated from weighted component scores.
     */
    ficoScore: number;

    /**
     * 7-day trend indicator.
     * Based on score change over the past week.
     */
    trend: TrustTrend;

    /**
     * Score change from 7 days ago.
     * Positive values indicate improvement.
     */
    trendDelta: number;

    /**
     * Overall confidence in the score (0-1).
     * Weighted average of component confidences.
     */
    overallConfidence: number;

    /**
     * When the enhanced score was last fully calculated.
     */
    lastCalculated: Date;
}

// ============================================================================
// Calculator Configuration
// ============================================================================

/**
 * Configuration for trust score calculation.
 */
export interface TrustCalculatorConfig {
    /** Lookback period in days for historical data (default: 90) */
    lookbackDays: number;

    /** Minimum samples for full confidence (default: 100) */
    minSamplesForFullConfidence: number;

    /** Inheritance rate from parent agent (default: 0.8) */
    inheritanceRate: number;

    /** Whether to use FICO scoring (feature flag) */
    useFicoScoring: boolean;
}

/**
 * Default calculator configuration.
 */
export const DEFAULT_CALCULATOR_CONFIG: TrustCalculatorConfig = {
    lookbackDays: 90,
    minSamplesForFullConfidence: 100,
    inheritanceRate: 0.8,
    useFicoScoring: true,
};

// ============================================================================
// Risk Weights for Decision Accuracy
// ============================================================================

/**
 * Risk level multipliers for decision accuracy calculation.
 */
export const RISK_WEIGHTS = {
    low: 1,
    medium: 1.5,
    high: 2,
    critical: 3,
} as const;

export type RiskLevel = keyof typeof RISK_WEIGHTS;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Input data for calculating decision accuracy.
 */
export interface DecisionAccuracyData {
    approved: number;
    rejected: number;
    riskLevel: RiskLevel;
}

/**
 * Input data for calculating ethics compliance.
 */
export interface EthicsComplianceData {
    violations: number;
    escalations: number;
}

/**
 * Input data for calculating task success.
 */
export interface TaskSuccessData {
    completed: number;
    failed: number;
}

/**
 * Input data for calculating operational stability.
 */
export interface OperationalStabilityData {
    errors: number;
    avgResponseTimeMs: number;
}

/**
 * Input data for calculating peer reviews.
 */
export interface PeerReviewsData {
    endorsements: number;
    resolvedSolutions: number;
    totalContributions: number;
}
