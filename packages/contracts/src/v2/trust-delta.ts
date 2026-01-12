/**
 * Trust Delta types - represents changes to trust state
 */

import type { TrustBand } from './enums.js';
import type { TrustDimensions, TrustEvidence } from './trust-profile.js';

/**
 * Reason for trust change
 */
export enum TrustDeltaReason {
  /** Positive evidence from successful execution */
  POSITIVE_EVIDENCE = 'positive_evidence',
  /** Negative evidence from failed execution */
  NEGATIVE_EVIDENCE = 'negative_evidence',
  /** Manual adjustment by administrator */
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  /** Time-based decay */
  TIME_DECAY = 'time_decay',
  /** Band promotion after stability period */
  BAND_PROMOTION = 'band_promotion',
  /** Band demotion due to incidents */
  BAND_DEMOTION = 'band_demotion',
  /** Recalculation with new evidence */
  RECALCULATION = 'recalculation',
  /** Observation tier change affecting ceiling */
  OBSERVATION_TIER_CHANGE = 'observation_tier_change',
  /** Policy change affecting calculation */
  POLICY_CHANGE = 'policy_change',
}

/**
 * Trust delta - a change in an agent's trust profile
 */
export interface TrustDelta {
  /** Unique delta identifier */
  deltaId: string;

  /** Agent whose trust changed */
  agentId: string;

  /** Profile ID before the change */
  previousProfileId: string;

  /** Profile ID after the change */
  newProfileId: string;

  /** Correlation ID if this resulted from an action */
  correlationId?: string;

  /** Why did trust change? */
  reason: TrustDeltaReason;

  /** Previous scores */
  previousDimensions: TrustDimensions;

  /** New scores */
  newDimensions: TrustDimensions;

  /** Previous composite score */
  previousCompositeScore: number;

  /** New composite score */
  newCompositeScore: number;

  /** Previous adjusted score */
  previousAdjustedScore: number;

  /** New adjusted score */
  newAdjustedScore: number;

  /** Previous trust band */
  previousBand: TrustBand;

  /** New trust band */
  newBand: TrustBand;

  /** Did the band change? */
  bandChanged: boolean;

  /** Evidence that caused this delta */
  triggeringEvidence?: TrustEvidence;

  /** Human-readable explanation */
  explanation: string;

  /** When the change occurred */
  occurredAt: Date;

  /** Who/what initiated the change */
  initiatedBy: string;
}

/**
 * Summary of trust delta for listings
 */
export interface TrustDeltaSummary {
  deltaId: string;
  agentId: string;
  reason: TrustDeltaReason;
  previousAdjustedScore: number;
  newAdjustedScore: number;
  scoreChange: number;
  bandChanged: boolean;
  previousBand: TrustBand;
  newBand: TrustBand;
  occurredAt: Date;
}

/**
 * Request to apply a manual trust adjustment
 */
export interface ManualTrustAdjustmentRequest {
  agentId: string;
  dimension: keyof TrustDimensions;
  adjustment: number; // -100 to +100
  reason: string;
  initiatedBy: string;
}

/**
 * Trust trend analysis
 */
export interface TrustTrend {
  agentId: string;
  period: {
    start: Date;
    end: Date;
  };
  dataPoints: number;
  startScore: number;
  endScore: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  scoreChange: number;
  bandChanges: number;
  promotions: number;
  demotions: number;
  trend: 'improving' | 'stable' | 'declining';
  volatility: number; // Standard deviation
}
