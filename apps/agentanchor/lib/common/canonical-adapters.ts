/**
 * Canonical Type Adapters for AgentAnchor
 *
 * This module provides adapters and utilities for converting between
 * legacy AgentAnchor types and the canonical @vorion/contracts types.
 *
 * CANONICAL TYPES (from @vorion/contracts):
 * - TrustBand: T0_UNTRUSTED through T5_MISSION_CRITICAL (0-100 scale)
 * - TrustProfile: Multi-dimensional trust with CT, BT, GT, XT, AC
 * - RiskLevel: 'low' | 'medium' | 'high' | 'critical'
 * - DataSensitivity: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED
 * - Reversibility: REVERSIBLE, PARTIALLY_REVERSIBLE, IRREVERSIBLE
 *
 * LEGACY TYPES (AgentAnchor):
 * - TrustTier: untrusted, novice, proven, trusted, elite, legendary (0-1000 scale)
 * - RiskLevel (numeric): 0-4
 * - TrustScore: 300-1000 range
 */

// =============================================================================
// Canonical Type Definitions (mirrored from @vorion/contracts for local use)
// =============================================================================

/**
 * Canonical TrustBand enum values
 */
export type TrustBand =
  | 'T0_UNTRUSTED'
  | 'T1_SUPERVISED'
  | 'T2_CONSTRAINED'
  | 'T3_TRUSTED'
  | 'T4_AUTONOMOUS'
  | 'T5_MISSION_CRITICAL';

/**
 * Canonical TrustBand as numeric enum for interop
 */
export enum TrustBandEnum {
  T0_UNTRUSTED = 0,
  T1_SUPERVISED = 1,
  T2_CONSTRAINED = 2,
  T3_TRUSTED = 3,
  T4_AUTONOMOUS = 4,
  T5_MISSION_CRITICAL = 5,
}

/**
 * Canonical RiskLevel string union
 */
export type CanonicalRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Canonical DataSensitivity enum
 */
export type DataSensitivity = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

/**
 * Canonical Reversibility enum
 */
export type Reversibility = 'REVERSIBLE' | 'PARTIALLY_REVERSIBLE' | 'IRREVERSIBLE';

/**
 * Canonical trust dimensions
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

// =============================================================================
// Legacy Type Definitions
// =============================================================================

/**
 * Legacy TrustTier from agents/types.ts
 */
export type LegacyAgentTrustTier = 'untrusted' | 'novice' | 'proven' | 'trusted' | 'elite' | 'legendary';

/**
 * Legacy TrustTier from governance/types.ts
 */
export type LegacyGovernanceTrustTier =
  | 'untrusted'
  | 'provisional'
  | 'established'
  | 'trusted'
  | 'verified'
  | 'certified';

/**
 * Legacy numeric RiskLevel from council/types.ts
 */
export type LegacyNumericRiskLevel = 0 | 1 | 2 | 3 | 4;

// =============================================================================
// Canonical Band Thresholds (0-100 scale)
// =============================================================================

export const CANONICAL_BAND_THRESHOLDS: Record<TrustBand, { min: number; max: number }> = {
  T0_UNTRUSTED: { min: 0, max: 20 },
  T1_SUPERVISED: { min: 21, max: 40 },
  T2_CONSTRAINED: { min: 41, max: 55 },
  T3_TRUSTED: { min: 56, max: 70 },
  T4_AUTONOMOUS: { min: 71, max: 85 },
  T5_MISSION_CRITICAL: { min: 86, max: 100 },
};

// =============================================================================
// TrustTier <-> TrustBand Adapters
// =============================================================================

/**
 * Maps legacy agent TrustTier to canonical TrustBand
 */
export const AGENT_TIER_TO_BAND: Record<LegacyAgentTrustTier, TrustBand> = {
  untrusted: 'T0_UNTRUSTED',
  novice: 'T1_SUPERVISED',
  proven: 'T2_CONSTRAINED',
  trusted: 'T3_TRUSTED',
  elite: 'T4_AUTONOMOUS',
  legendary: 'T5_MISSION_CRITICAL',
};

/**
 * Maps legacy governance TrustTier to canonical TrustBand
 */
export const GOVERNANCE_TIER_TO_BAND: Record<LegacyGovernanceTrustTier, TrustBand> = {
  untrusted: 'T0_UNTRUSTED',
  provisional: 'T1_SUPERVISED',
  established: 'T2_CONSTRAINED',
  trusted: 'T3_TRUSTED',
  verified: 'T4_AUTONOMOUS',
  certified: 'T5_MISSION_CRITICAL',
};

/**
 * Maps canonical TrustBand to legacy agent TrustTier
 */
export const BAND_TO_AGENT_TIER: Record<TrustBand, LegacyAgentTrustTier> = {
  T0_UNTRUSTED: 'untrusted',
  T1_SUPERVISED: 'novice',
  T2_CONSTRAINED: 'proven',
  T3_TRUSTED: 'trusted',
  T4_AUTONOMOUS: 'elite',
  T5_MISSION_CRITICAL: 'legendary',
};

/**
 * Maps canonical TrustBand to legacy governance TrustTier
 */
export const BAND_TO_GOVERNANCE_TIER: Record<TrustBand, LegacyGovernanceTrustTier> = {
  T0_UNTRUSTED: 'untrusted',
  T1_SUPERVISED: 'provisional',
  T2_CONSTRAINED: 'established',
  T3_TRUSTED: 'trusted',
  T4_AUTONOMOUS: 'verified',
  T5_MISSION_CRITICAL: 'certified',
};

/**
 * Convert legacy agent TrustTier to canonical TrustBand
 */
export function agentTierToBand(tier: LegacyAgentTrustTier): TrustBand {
  return AGENT_TIER_TO_BAND[tier];
}

/**
 * Convert legacy governance TrustTier to canonical TrustBand
 */
export function governanceTierToBand(tier: LegacyGovernanceTrustTier): TrustBand {
  return GOVERNANCE_TIER_TO_BAND[tier];
}

/**
 * Convert canonical TrustBand to legacy agent TrustTier
 */
export function bandToAgentTier(band: TrustBand): LegacyAgentTrustTier {
  return BAND_TO_AGENT_TIER[band];
}

/**
 * Convert canonical TrustBand to legacy governance TrustTier
 */
export function bandToGovernanceTier(band: TrustBand): LegacyGovernanceTrustTier {
  return BAND_TO_GOVERNANCE_TIER[band];
}

// =============================================================================
// Trust Score Adapters
// =============================================================================

/**
 * Convert legacy 0-1000 score to canonical 0-100 scale
 */
export function legacyScoreToCanonical(legacyScore: number): number {
  return Math.round(Math.max(0, Math.min(1000, legacyScore)) / 10);
}

/**
 * Convert canonical 0-100 score to legacy 0-1000 scale
 */
export function canonicalScoreToLegacy(canonicalScore: number): number {
  return Math.round(Math.max(0, Math.min(100, canonicalScore)) * 10);
}

/**
 * Convert legacy bot-trust 300-1000 score to canonical 0-100 scale
 */
export function legacyBotTrustScoreToCanonical(legacyScore: number): number {
  const normalized = Math.max(0, Math.min(1000, legacyScore));
  if (normalized < 300) return 0;
  return Math.round(((normalized - 300) / 700) * 100);
}

/**
 * Convert canonical 0-100 score to legacy bot-trust 300-1000 scale
 */
export function canonicalScoreToLegacyBotTrust(canonicalScore: number): number {
  const normalized = Math.max(0, Math.min(100, canonicalScore));
  return Math.round(300 + (normalized / 100) * 700);
}

/**
 * Get canonical TrustBand from a 0-100 score
 */
export function getBandFromScore(score: number): TrustBand {
  if (score <= 20) return 'T0_UNTRUSTED';
  if (score <= 40) return 'T1_SUPERVISED';
  if (score <= 55) return 'T2_CONSTRAINED';
  if (score <= 70) return 'T3_TRUSTED';
  if (score <= 85) return 'T4_AUTONOMOUS';
  return 'T5_MISSION_CRITICAL';
}

/**
 * Get TrustBand numeric value (0-5)
 */
export function getBandNumeric(band: TrustBand): TrustBandEnum {
  return TrustBandEnum[band];
}

// =============================================================================
// RiskLevel Adapters
// =============================================================================

/**
 * Convert legacy numeric RiskLevel to canonical string
 */
export function numericRiskToCanonical(numeric: LegacyNumericRiskLevel): CanonicalRiskLevel {
  switch (numeric) {
    case 0:
    case 1:
      return 'low';
    case 2:
      return 'medium';
    case 3:
      return 'high';
    case 4:
      return 'critical';
    default:
      return 'low';
  }
}

/**
 * Convert canonical RiskLevel string to numeric
 */
export function canonicalRiskToNumeric(canonical: CanonicalRiskLevel): LegacyNumericRiskLevel {
  switch (canonical) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
    case 'critical':
      return 4;
    default:
      return 1;
  }
}

/**
 * Normalize any RiskLevel (numeric or string) to canonical string
 */
export function normalizeRiskLevel(level: LegacyNumericRiskLevel | CanonicalRiskLevel): CanonicalRiskLevel {
  if (typeof level === 'number') {
    return numericRiskToCanonical(level);
  }
  return level;
}

// =============================================================================
// Trust Dimensions Adapters
// =============================================================================

/**
 * Convert legacy bot-trust components to canonical TrustDimensions
 */
export function legacyComponentsToTrustDimensions(components: {
  decision_accuracy: number;
  ethics_compliance: number;
  training_success: number;
  operational_stability: number;
  peer_reviews: number;
}): TrustDimensions {
  return {
    CT: components.decision_accuracy,   // Capability Trust
    BT: components.training_success,    // Behavioral Trust
    GT: components.ethics_compliance,   // Governance Trust
    XT: components.operational_stability, // Contextual Trust
    AC: components.peer_reviews,        // Assurance Confidence
  };
}

/**
 * Convert canonical TrustDimensions to legacy bot-trust components
 */
export function trustDimensionsToLegacyComponents(dimensions: TrustDimensions): {
  decision_accuracy: number;
  ethics_compliance: number;
  training_success: number;
  operational_stability: number;
  peer_reviews: number;
} {
  return {
    decision_accuracy: dimensions.CT,
    ethics_compliance: dimensions.GT,
    training_success: dimensions.BT,
    operational_stability: dimensions.XT,
    peer_reviews: dimensions.AC,
  };
}

/**
 * Calculate composite trust score from dimensions using default weights
 */
export function calculateCompositeScore(dimensions: TrustDimensions): number {
  const weights = {
    CT: 0.25,
    BT: 0.25,
    GT: 0.20,
    XT: 0.15,
    AC: 0.15,
  };

  return Math.round(
    dimensions.CT * weights.CT +
    dimensions.BT * weights.BT +
    dimensions.GT * weights.GT +
    dimensions.XT * weights.XT +
    dimensions.AC * weights.AC
  );
}

// =============================================================================
// Autonomy Level Adapters
// =============================================================================

/**
 * Maps bot-trust AutonomyLevel to canonical TrustBand
 */
export const AUTONOMY_TO_BAND: Record<number, TrustBand> = {
  1: 'T0_UNTRUSTED',   // ASK_LEARN
  2: 'T1_SUPERVISED',  // SUGGEST
  3: 'T2_CONSTRAINED', // EXECUTE_REVIEW
  4: 'T4_AUTONOMOUS',  // AUTONOMOUS_EXCEPTIONS
  5: 'T5_MISSION_CRITICAL', // FULLY_AUTONOMOUS
};

/**
 * Maps canonical TrustBand to bot-trust AutonomyLevel
 */
export const BAND_TO_AUTONOMY: Record<TrustBand, number> = {
  T0_UNTRUSTED: 1,
  T1_SUPERVISED: 2,
  T2_CONSTRAINED: 3,
  T3_TRUSTED: 3,
  T4_AUTONOMOUS: 4,
  T5_MISSION_CRITICAL: 5,
};

/**
 * Convert bot-trust AutonomyLevel to canonical TrustBand
 */
export function autonomyLevelToBand(level: number): TrustBand {
  return AUTONOMY_TO_BAND[level] || 'T0_UNTRUSTED';
}

/**
 * Convert canonical TrustBand to bot-trust AutonomyLevel
 */
export function bandToAutonomyLevel(band: TrustBand): number {
  return BAND_TO_AUTONOMY[band];
}

// =============================================================================
// Risk to Trust Band Mapping
// =============================================================================

/**
 * Maps canonical RiskLevel to minimum required TrustBand
 */
export const RISK_TO_MIN_BAND: Record<CanonicalRiskLevel, TrustBand> = {
  low: 'T0_UNTRUSTED',
  medium: 'T2_CONSTRAINED',
  high: 'T3_TRUSTED',
  critical: 'T5_MISSION_CRITICAL',
};

/**
 * Maps canonical TrustBand to maximum allowed RiskLevel for autonomous action
 */
export const BAND_TO_MAX_RISK: Record<TrustBand, CanonicalRiskLevel> = {
  T0_UNTRUSTED: 'low',
  T1_SUPERVISED: 'low',
  T2_CONSTRAINED: 'medium',
  T3_TRUSTED: 'medium',
  T4_AUTONOMOUS: 'high',
  T5_MISSION_CRITICAL: 'critical',
};

/**
 * Check if a trust band can autonomously perform an action at a given risk level
 */
export function canActAutonomously(band: TrustBand, riskLevel: CanonicalRiskLevel): boolean {
  const riskOrder: CanonicalRiskLevel[] = ['low', 'medium', 'high', 'critical'];
  const maxRisk = BAND_TO_MAX_RISK[band];
  return riskOrder.indexOf(riskLevel) <= riskOrder.indexOf(maxRisk);
}

/**
 * Get minimum trust band required for autonomous action at given risk level
 */
export function getMinimumBandForRisk(riskLevel: CanonicalRiskLevel): TrustBand {
  return RISK_TO_MIN_BAND[riskLevel];
}

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Validate that a score is within canonical 0-100 range
 */
export function isValidCanonicalScore(score: number): boolean {
  return score >= 0 && score <= 100;
}

/**
 * Validate that a score is within legacy 0-1000 range
 */
export function isValidLegacyScore(score: number): boolean {
  return score >= 0 && score <= 1000;
}

/**
 * Validate that a score is within legacy bot-trust 300-1000 range
 */
export function isValidLegacyBotTrustScore(score: number): boolean {
  return score >= 300 && score <= 1000;
}

/**
 * Type guard for canonical RiskLevel
 */
export function isCanonicalRiskLevel(value: unknown): value is CanonicalRiskLevel {
  return typeof value === 'string' && ['low', 'medium', 'high', 'critical'].includes(value);
}

/**
 * Type guard for legacy numeric RiskLevel
 */
export function isLegacyNumericRiskLevel(value: unknown): value is LegacyNumericRiskLevel {
  return typeof value === 'number' && [0, 1, 2, 3, 4].includes(value);
}

/**
 * Type guard for TrustBand
 */
export function isTrustBand(value: unknown): value is TrustBand {
  return typeof value === 'string' && [
    'T0_UNTRUSTED',
    'T1_SUPERVISED',
    'T2_CONSTRAINED',
    'T3_TRUSTED',
    'T4_AUTONOMOUS',
    'T5_MISSION_CRITICAL',
  ].includes(value);
}
