/**
 * Trust Profile types - represents an agent's current trust state
 */

import type { ObservationTier, TrustBand } from './enums.js';

/**
 * The five trust dimensions used to calculate composite trust
 *
 * Each dimension is scored 0-100 where:
 * - 0: No trust / evidence of failure
 * - 50: Neutral / unproven
 * - 100: Maximum trust / proven excellence
 */
export interface TrustDimensions {
  /** Capability Trust - Does the agent have the skills? */
  CT: number;
  /** Behavioral Trust - Has the agent acted reliably? */
  BT: number;
  /** Governance Trust - Is the agent properly governed? */
  GT: number;
  /** Contextual Trust - Is this the right context for the agent? */
  XT: number;
  /** Assurance Confidence - How confident are we in our assessment? */
  AC: number;
}

/**
 * Configurable weights for trust dimensions
 * All weights must sum to 1.0
 */
export interface TrustWeights {
  CT: number;
  BT: number;
  GT: number;
  XT: number;
  AC: number;
}

/** Default trust dimension weights */
export const DEFAULT_TRUST_WEIGHTS: TrustWeights = {
  CT: 0.25,
  BT: 0.25,
  GT: 0.20,
  XT: 0.15,
  AC: 0.15,
};

/**
 * Evidence item used to calculate trust dimensions
 */
export interface TrustEvidence {
  /** Unique identifier for this evidence */
  evidenceId: string;
  /** Which dimension this evidence affects */
  dimension: keyof TrustDimensions;
  /** Score impact (-100 to +100) */
  impact: number;
  /** Human-readable source of evidence */
  source: string;
  /** When this evidence was collected */
  collectedAt: Date;
  /** When this evidence expires (optional) */
  expiresAt?: Date;
  /** Additional context */
  metadata?: Record<string, unknown>;
}

/**
 * Complete trust profile for an agent
 */
export interface TrustProfile {
  /** Unique profile identifier */
  profileId: string;
  /** Agent this profile belongs to */
  agentId: string;

  /** Individual dimension scores */
  dimensions: TrustDimensions;

  /** Weights used for calculation */
  weights: TrustWeights;

  /** Raw composite score (weighted sum of dimensions) */
  compositeScore: number;

  /** Observation tier determines trust ceiling */
  observationTier: ObservationTier;

  /** Score after applying observation ceiling */
  adjustedScore: number;

  /** Current trust band (T0-T5) */
  band: TrustBand;

  /** When this profile was calculated */
  calculatedAt: Date;

  /** When this profile expires and needs recalculation */
  validUntil?: Date;

  /** Evidence items used in calculation */
  evidence: TrustEvidence[];

  /** Version for optimistic concurrency */
  version: number;
}

/**
 * Summary view of a trust profile
 */
export interface TrustProfileSummary {
  agentId: string;
  compositeScore: number;
  adjustedScore: number;
  band: TrustBand;
  observationTier: ObservationTier;
  calculatedAt: Date;
}

/**
 * Request to calculate trust for an agent
 */
export interface TrustCalculationRequest {
  agentId: string;
  observationTier: ObservationTier;
  evidence: TrustEvidence[];
  weights?: Partial<TrustWeights>;
}

/**
 * Configuration for trust band thresholds
 */
export interface BandThresholds {
  T0: { min: number; max: number };
  T1: { min: number; max: number };
  T2: { min: number; max: number };
  T3: { min: number; max: number };
  T4: { min: number; max: number };
  T5: { min: number; max: number };
}

/** Default band thresholds */
export const DEFAULT_BAND_THRESHOLDS: BandThresholds = {
  T0: { min: 0, max: 20 },
  T1: { min: 21, max: 40 },
  T2: { min: 41, max: 55 },
  T3: { min: 56, max: 70 },
  T4: { min: 71, max: 85 },
  T5: { min: 86, max: 100 },
};

/**
 * Configuration for band transitions
 */
export interface BandingConfig {
  thresholds: BandThresholds;
  /** Points buffer to prevent oscillation */
  hysteresis: number;
  /** Daily decay rate for stale evidence */
  decayRate: number;
  /** Minimum days at current band before promotion */
  promotionDelay: number;
}

/** Default banding configuration */
export const DEFAULT_BANDING_CONFIG: BandingConfig = {
  thresholds: DEFAULT_BAND_THRESHOLDS,
  hysteresis: 3,
  decayRate: 0.01,
  promotionDelay: 7,
};

/**
 * Risk profile for temporal outcome tracking
 * Determines how long to wait before finalizing outcome
 */
export enum RiskProfile {
  /** 5 minutes - computations, queries */
  IMMEDIATE = 'IMMEDIATE',
  /** 4 hours - API calls */
  SHORT_TERM = 'SHORT_TERM',
  /** 3 days - simple transactions */
  MEDIUM_TERM = 'MEDIUM_TERM',
  /** 30 days - financial trades */
  LONG_TERM = 'LONG_TERM',
  /** 90 days - investments */
  EXTENDED = 'EXTENDED',
}

/** Outcome windows in milliseconds for each risk profile */
export const RISK_PROFILE_WINDOWS: Record<RiskProfile, number> = {
  [RiskProfile.IMMEDIATE]: 5 * 60 * 1000,           // 5 minutes
  [RiskProfile.SHORT_TERM]: 4 * 60 * 60 * 1000,     // 4 hours
  [RiskProfile.MEDIUM_TERM]: 3 * 24 * 60 * 60 * 1000, // 3 days
  [RiskProfile.LONG_TERM]: 30 * 24 * 60 * 60 * 1000,  // 30 days
  [RiskProfile.EXTENDED]: 90 * 24 * 60 * 60 * 1000,   // 90 days
};

/**
 * Configuration for asymmetric trust dynamics
 * Per ATSF v2.0: "Trust is hard to gain, easy to lose" (10:1 ratio)
 */
export interface TrustDynamicsConfig {
  /**
   * Logarithmic gain rate for positive evidence
   * Trust gain formula: delta = gainRate * log(1 + (ceiling - current))
   * Default: 0.01 (slow gain)
   */
  gainRate: number;

  /**
   * Exponential loss rate for negative evidence
   * Trust loss formula: delta = -lossRate * current
   * Default: 0.10 (10x faster than gain)
   */
  lossRate: number;

  /**
   * Cooldown period in hours after any trust drop
   * During cooldown, trust cannot increase
   * Default: 168 hours (7 days)
   */
  cooldownHours: number;

  /**
   * Number of direction changes (gain→loss or loss→gain)
   * within the oscillation window that triggers circuit breaker
   * Default: 3
   */
  oscillationThreshold: number;

  /**
   * Time window in hours for oscillation detection
   * Default: 24 hours
   */
  oscillationWindowHours: number;

  /**
   * Penalty multiplier for outcome reversals
   * When provisional success becomes final failure
   * Default: 2.0 (2x normal failure penalty)
   */
  reversalPenaltyMultiplier: number;

  /**
   * Minimum trust score threshold for circuit breaker trigger
   * Default: 10 (trust < 0.10 triggers circuit breaker)
   */
  circuitBreakerThreshold: number;
}

/** Default trust dynamics configuration per ATSF v2.0 */
export const DEFAULT_TRUST_DYNAMICS: TrustDynamicsConfig = {
  gainRate: 0.01,                    // Logarithmic gain (slow)
  lossRate: 0.10,                    // Exponential loss (10x faster)
  cooldownHours: 168,                // 7 days after any drop
  oscillationThreshold: 3,           // 3 direction changes triggers alert
  oscillationWindowHours: 24,        // Within 24 hours
  reversalPenaltyMultiplier: 2.0,    // 2x penalty for reversals
  circuitBreakerThreshold: 10,       // Trust < 10 triggers circuit breaker
};

/**
 * Cooldown state for an agent
 */
export interface CooldownState {
  /** Whether the agent is currently in cooldown */
  inCooldown: boolean;
  /** When the cooldown started */
  cooldownStartedAt?: Date;
  /** When the cooldown ends */
  cooldownEndsAt?: Date;
  /** Reason for cooldown */
  reason?: string;
}

/**
 * Direction change entry for oscillation detection
 */
export interface DirectionChange {
  /** Timestamp of the direction change */
  timestamp: Date;
  /** Previous direction: 'gain' or 'loss' */
  from: 'gain' | 'loss';
  /** New direction: 'gain' or 'loss' */
  to: 'gain' | 'loss';
  /** Trust score at time of change */
  scoreAtChange: number;
}

/**
 * Trust dynamics state for an agent
 */
export interface TrustDynamicsState {
  /** Agent ID */
  agentId: string;
  /** Current cooldown state */
  cooldown: CooldownState;
  /** Recent direction changes for oscillation detection */
  directionChanges: DirectionChange[];
  /** Last trust update direction */
  lastDirection: 'gain' | 'loss' | 'none';
  /** Whether circuit breaker is tripped */
  circuitBreakerTripped: boolean;
  /** Reason for circuit breaker if tripped */
  circuitBreakerReason?: string;
  /** When circuit breaker was tripped */
  circuitBreakerTrippedAt?: Date;
}

/**
 * Provisional outcome for temporal tracking
 */
export interface ProvisionalOutcome {
  /** Unique outcome ID */
  outcomeId: string;
  /** Associated agent ID */
  agentId: string;
  /** Action that generated this outcome */
  actionId: string;
  /** When the action was recorded */
  recordedAt: Date;
  /** Provisional success indicator */
  provisionalSuccess: boolean;
  /** Magnitude of the outcome (for tail risk detection) */
  magnitude: number;
  /** Risk profile determining outcome window */
  riskProfile: RiskProfile;
  /** When the outcome window closes */
  outcomeWindowEnds: Date;
  /** Final success (null if not yet finalized) */
  finalSuccess: boolean | null;
  /** Final magnitude (null if not yet finalized) */
  finalMagnitude: number | null;
  /** Whether this was a reversal (provisional success → final failure) */
  wasReversal: boolean;
}
