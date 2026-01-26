/**
 * Canonical Validation Module
 *
 * Runtime validation functions and type guards for all canonical types
 * in the Vorion Platform.
 *
 * Use these functions to validate data at runtime boundaries (API inputs,
 * external data sources, configuration loading, etc.)
 *
 * @packageDocumentation
 */

import {
  TrustBand,
  ObservationTier,
  DataSensitivity,
  Reversibility,
  ActionType,
  ProofEventType,
  ComponentType,
  ComponentStatus,
  ApprovalType,
  OBSERVATION_CEILINGS,
} from '../v2/enums.js';

import {
  TrustDimensions,
  TrustWeights,
  DEFAULT_TRUST_WEIGHTS,
  DEFAULT_BAND_THRESHOLDS,
  BandThresholds,
  RiskProfile,
} from '../v2/trust-profile.js';

import { TrustDeltaReason } from '../v2/trust-delta.js';
import { DenialReason } from '../v2/decision.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Valid range for trust scores (0-1000 canonical scale)
 */
export const TRUST_SCORE_RANGE = {
  min: 0,
  max: 1000,
} as const;

/**
 * Valid range for trust dimension scores (0-100 percentage scale)
 * Note: Dimensions use 0-100 percentage, composite score uses 0-1000
 */
export const DIMENSION_SCORE_RANGE = {
  min: 0,
  max: 100,
} as const;

/**
 * Valid range for trust weights (must sum to 1.0)
 */
export const WEIGHT_RANGE = {
  min: 0,
  max: 1,
} as const;

// ============================================================================
// Validation Error Class
// ============================================================================

/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown,
    public readonly expected: string
  ) {
    super(`${field}: ${message} (got ${JSON.stringify(value)}, expected ${expected})`);
    this.name = 'ValidationError';
  }
}

// ============================================================================
// Type Guards - TrustBand
// ============================================================================

/**
 * Check if a value is a valid TrustBand
 */
export function isTrustBand(value: unknown): value is TrustBand {
  return typeof value === 'number' && Object.values(TrustBand).includes(value);
}

/**
 * Check if a value is a valid TrustBand name (string form)
 */
export function isTrustBandName(value: unknown): value is keyof typeof TrustBand {
  return typeof value === 'string' && value in TrustBand;
}

/**
 * Assert that a value is a valid TrustBand
 * @throws ValidationError if invalid
 */
export function assertValidTrustBand(value: unknown, field = 'trustBand'): asserts value is TrustBand {
  if (!isTrustBand(value)) {
    throw new ValidationError(
      'Invalid trust band',
      field,
      value,
      `one of ${Object.keys(TrustBand)
        .filter((k) => isNaN(Number(k)))
        .join(', ')}`
    );
  }
}

/**
 * Parse a trust band from string or number
 */
export function parseTrustBand(value: unknown): TrustBand | null {
  if (typeof value === 'number' && isTrustBand(value)) {
    return value;
  }
  if (typeof value === 'string') {
    // Try as enum key (e.g., "T3_TRUSTED")
    if (value in TrustBand) {
      return TrustBand[value as keyof typeof TrustBand];
    }
    // Try as short form (e.g., "T3")
    const shortFormMatch = value.match(/^T(\d)$/i);
    if (shortFormMatch && shortFormMatch[1]) {
      const level = parseInt(shortFormMatch[1], 10);
      if (level >= 0 && level <= 5) {
        return level as TrustBand;
      }
    }
  }
  return null;
}

// ============================================================================
// Type Guards - TrustScore
// ============================================================================

/**
 * Check if a value is a valid trust score (0-100)
 */
export function isTrustScore(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    !isNaN(value) &&
    value >= TRUST_SCORE_RANGE.min &&
    value <= TRUST_SCORE_RANGE.max
  );
}

/**
 * Assert that a value is a valid trust score
 * @throws ValidationError if invalid
 */
export function assertValidTrustScore(value: unknown, field = 'trustScore'): asserts value is number {
  if (!isTrustScore(value)) {
    throw new ValidationError(
      'Invalid trust score',
      field,
      value,
      `number between ${TRUST_SCORE_RANGE.min} and ${TRUST_SCORE_RANGE.max}`
    );
  }
}

/**
 * Clamp a trust score to valid range
 */
export function clampTrustScore(value: number): number {
  return Math.max(TRUST_SCORE_RANGE.min, Math.min(TRUST_SCORE_RANGE.max, value));
}

/**
 * Round a trust score to specified decimal places
 */
export function roundTrustScore(value: number, decimals = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

// ============================================================================
// Type Guards - ObservationTier
// ============================================================================

/**
 * Check if a value is a valid ObservationTier
 */
export function isObservationTier(value: unknown): value is ObservationTier {
  return typeof value === 'string' && Object.values(ObservationTier).includes(value as ObservationTier);
}

/**
 * Assert that a value is a valid ObservationTier
 * @throws ValidationError if invalid
 */
export function assertValidObservationTier(
  value: unknown,
  field = 'observationTier'
): asserts value is ObservationTier {
  if (!isObservationTier(value)) {
    throw new ValidationError(
      'Invalid observation tier',
      field,
      value,
      `one of ${Object.values(ObservationTier).join(', ')}`
    );
  }
}

/**
 * Get the trust ceiling for an observation tier
 */
export function getObservationCeiling(tier: ObservationTier): number {
  return OBSERVATION_CEILINGS[tier];
}

/**
 * Apply observation ceiling to a trust score
 */
export function applyObservationCeiling(score: number, tier: ObservationTier): number {
  const ceiling = getObservationCeiling(tier);
  return Math.min(score, ceiling);
}

// ============================================================================
// Type Guards - DataSensitivity
// ============================================================================

/**
 * Check if a value is a valid DataSensitivity
 */
export function isDataSensitivity(value: unknown): value is DataSensitivity {
  return typeof value === 'string' && Object.values(DataSensitivity).includes(value as DataSensitivity);
}

/**
 * Assert that a value is a valid DataSensitivity
 * @throws ValidationError if invalid
 */
export function assertValidDataSensitivity(
  value: unknown,
  field = 'dataSensitivity'
): asserts value is DataSensitivity {
  if (!isDataSensitivity(value)) {
    throw new ValidationError(
      'Invalid data sensitivity',
      field,
      value,
      `one of ${Object.values(DataSensitivity).join(', ')}`
    );
  }
}

/**
 * Get numeric severity level for data sensitivity (0-3)
 */
export function getDataSensitivityLevel(sensitivity: DataSensitivity): number {
  const levels: Record<DataSensitivity, number> = {
    [DataSensitivity.PUBLIC]: 0,
    [DataSensitivity.INTERNAL]: 1,
    [DataSensitivity.CONFIDENTIAL]: 2,
    [DataSensitivity.RESTRICTED]: 3,
  };
  return levels[sensitivity];
}

// ============================================================================
// Type Guards - Reversibility
// ============================================================================

/**
 * Check if a value is a valid Reversibility
 */
export function isReversibility(value: unknown): value is Reversibility {
  return typeof value === 'string' && Object.values(Reversibility).includes(value as Reversibility);
}

/**
 * Assert that a value is a valid Reversibility
 * @throws ValidationError if invalid
 */
export function assertValidReversibility(value: unknown, field = 'reversibility'): asserts value is Reversibility {
  if (!isReversibility(value)) {
    throw new ValidationError(
      'Invalid reversibility',
      field,
      value,
      `one of ${Object.values(Reversibility).join(', ')}`
    );
  }
}

// ============================================================================
// Type Guards - ActionType
// ============================================================================

/**
 * Check if a value is a valid ActionType
 */
export function isActionType(value: unknown): value is ActionType {
  return typeof value === 'string' && Object.values(ActionType).includes(value as ActionType);
}

/**
 * Assert that a value is a valid ActionType
 * @throws ValidationError if invalid
 */
export function assertValidActionType(value: unknown, field = 'actionType'): asserts value is ActionType {
  if (!isActionType(value)) {
    throw new ValidationError(
      'Invalid action type',
      field,
      value,
      `one of ${Object.values(ActionType).join(', ')}`
    );
  }
}

// ============================================================================
// Type Guards - ProofEventType
// ============================================================================

/**
 * Check if a value is a valid ProofEventType
 */
export function isProofEventType(value: unknown): value is ProofEventType {
  return typeof value === 'string' && Object.values(ProofEventType).includes(value as ProofEventType);
}

/**
 * Assert that a value is a valid ProofEventType
 * @throws ValidationError if invalid
 */
export function assertValidProofEventType(
  value: unknown,
  field = 'proofEventType'
): asserts value is ProofEventType {
  if (!isProofEventType(value)) {
    throw new ValidationError(
      'Invalid proof event type',
      field,
      value,
      `one of ${Object.values(ProofEventType).join(', ')}`
    );
  }
}

// ============================================================================
// Type Guards - ComponentType
// ============================================================================

/**
 * Check if a value is a valid ComponentType
 */
export function isComponentType(value: unknown): value is ComponentType {
  return typeof value === 'string' && Object.values(ComponentType).includes(value as ComponentType);
}

/**
 * Assert that a value is a valid ComponentType
 * @throws ValidationError if invalid
 */
export function assertValidComponentType(value: unknown, field = 'componentType'): asserts value is ComponentType {
  if (!isComponentType(value)) {
    throw new ValidationError(
      'Invalid component type',
      field,
      value,
      `one of ${Object.values(ComponentType).join(', ')}`
    );
  }
}

// ============================================================================
// Type Guards - ComponentStatus
// ============================================================================

/**
 * Check if a value is a valid ComponentStatus
 */
export function isComponentStatus(value: unknown): value is ComponentStatus {
  return typeof value === 'string' && Object.values(ComponentStatus).includes(value as ComponentStatus);
}

/**
 * Assert that a value is a valid ComponentStatus
 * @throws ValidationError if invalid
 */
export function assertValidComponentStatus(
  value: unknown,
  field = 'componentStatus'
): asserts value is ComponentStatus {
  if (!isComponentStatus(value)) {
    throw new ValidationError(
      'Invalid component status',
      field,
      value,
      `one of ${Object.values(ComponentStatus).join(', ')}`
    );
  }
}

// ============================================================================
// Type Guards - ApprovalType
// ============================================================================

/**
 * Check if a value is a valid ApprovalType
 */
export function isApprovalType(value: unknown): value is ApprovalType {
  return typeof value === 'string' && Object.values(ApprovalType).includes(value as ApprovalType);
}

/**
 * Assert that a value is a valid ApprovalType
 * @throws ValidationError if invalid
 */
export function assertValidApprovalType(value: unknown, field = 'approvalType'): asserts value is ApprovalType {
  if (!isApprovalType(value)) {
    throw new ValidationError(
      'Invalid approval type',
      field,
      value,
      `one of ${Object.values(ApprovalType).join(', ')}`
    );
  }
}

// ============================================================================
// Type Guards - TrustDeltaReason
// ============================================================================

/**
 * Check if a value is a valid TrustDeltaReason
 */
export function isTrustDeltaReason(value: unknown): value is TrustDeltaReason {
  return typeof value === 'string' && Object.values(TrustDeltaReason).includes(value as TrustDeltaReason);
}

/**
 * Assert that a value is a valid TrustDeltaReason
 * @throws ValidationError if invalid
 */
export function assertValidTrustDeltaReason(
  value: unknown,
  field = 'trustDeltaReason'
): asserts value is TrustDeltaReason {
  if (!isTrustDeltaReason(value)) {
    throw new ValidationError(
      'Invalid trust delta reason',
      field,
      value,
      `one of ${Object.values(TrustDeltaReason).join(', ')}`
    );
  }
}

// ============================================================================
// Type Guards - DenialReason
// ============================================================================

/**
 * Check if a value is a valid DenialReason
 */
export function isDenialReason(value: unknown): value is DenialReason {
  return typeof value === 'string' && Object.values(DenialReason).includes(value as DenialReason);
}

/**
 * Assert that a value is a valid DenialReason
 * @throws ValidationError if invalid
 */
export function assertValidDenialReason(value: unknown, field = 'denialReason'): asserts value is DenialReason {
  if (!isDenialReason(value)) {
    throw new ValidationError(
      'Invalid denial reason',
      field,
      value,
      `one of ${Object.values(DenialReason).join(', ')}`
    );
  }
}

// ============================================================================
// Type Guards - RiskProfile
// ============================================================================

/**
 * Check if a value is a valid RiskProfile
 */
export function isRiskProfile(value: unknown): value is RiskProfile {
  return typeof value === 'string' && Object.values(RiskProfile).includes(value as RiskProfile);
}

/**
 * Assert that a value is a valid RiskProfile
 * @throws ValidationError if invalid
 */
export function assertValidRiskProfile(value: unknown, field = 'riskProfile'): asserts value is RiskProfile {
  if (!isRiskProfile(value)) {
    throw new ValidationError(
      'Invalid risk profile',
      field,
      value,
      `one of ${Object.values(RiskProfile).join(', ')}`
    );
  }
}

// ============================================================================
// Composite Type Guards - TrustDimensions
// ============================================================================

/**
 * Check if a value has valid TrustDimensions structure
 */
export function isTrustDimensions(value: unknown): value is TrustDimensions {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const dimensions = value as Record<string, unknown>;
  const requiredKeys = ['CT', 'BT', 'GT', 'XT', 'AC'] as const;

  return requiredKeys.every(
    (key) =>
      key in dimensions &&
      typeof dimensions[key] === 'number' &&
      (dimensions[key] as number) >= DIMENSION_SCORE_RANGE.min &&
      (dimensions[key] as number) <= DIMENSION_SCORE_RANGE.max
  );
}

/**
 * Assert that a value has valid TrustDimensions
 * @throws ValidationError if invalid
 */
export function assertValidTrustDimensions(
  value: unknown,
  field = 'trustDimensions'
): asserts value is TrustDimensions {
  if (typeof value !== 'object' || value === null) {
    throw new ValidationError('Invalid trust dimensions', field, value, 'object with CT, BT, GT, XT, AC');
  }

  const dimensions = value as Record<string, unknown>;
  const requiredKeys = ['CT', 'BT', 'GT', 'XT', 'AC'] as const;

  for (const key of requiredKeys) {
    if (!(key in dimensions)) {
      throw new ValidationError(`Missing dimension ${key}`, `${field}.${key}`, undefined, `number 0-100`);
    }

    const dimValue = dimensions[key];
    if (typeof dimValue !== 'number' || isNaN(dimValue)) {
      throw new ValidationError(`Invalid dimension ${key}`, `${field}.${key}`, dimValue, `number 0-100`);
    }

    if (dimValue < DIMENSION_SCORE_RANGE.min || dimValue > DIMENSION_SCORE_RANGE.max) {
      throw new ValidationError(
        `Dimension ${key} out of range`,
        `${field}.${key}`,
        dimValue,
        `number between ${DIMENSION_SCORE_RANGE.min} and ${DIMENSION_SCORE_RANGE.max}`
      );
    }
  }
}

// ============================================================================
// Composite Type Guards - TrustWeights
// ============================================================================

/**
 * Check if a value has valid TrustWeights structure
 */
export function isTrustWeights(value: unknown): value is TrustWeights {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const weights = value as Record<string, unknown>;
  const requiredKeys = ['CT', 'BT', 'GT', 'XT', 'AC'] as const;

  const hasValidKeys = requiredKeys.every(
    (key) =>
      key in weights &&
      typeof weights[key] === 'number' &&
      (weights[key] as number) >= WEIGHT_RANGE.min &&
      (weights[key] as number) <= WEIGHT_RANGE.max
  );

  if (!hasValidKeys) {
    return false;
  }

  // Check sum equals 1.0 (with tolerance for floating point)
  const sum = requiredKeys.reduce((acc, key) => acc + (weights[key] as number), 0);
  return Math.abs(sum - 1.0) < 0.001;
}

/**
 * Assert that a value has valid TrustWeights
 * @throws ValidationError if invalid
 */
export function assertValidTrustWeights(value: unknown, field = 'trustWeights'): asserts value is TrustWeights {
  if (typeof value !== 'object' || value === null) {
    throw new ValidationError('Invalid trust weights', field, value, 'object with CT, BT, GT, XT, AC summing to 1.0');
  }

  const weights = value as Record<string, unknown>;
  const requiredKeys = ['CT', 'BT', 'GT', 'XT', 'AC'] as const;

  let sum = 0;
  for (const key of requiredKeys) {
    if (!(key in weights)) {
      throw new ValidationError(`Missing weight ${key}`, `${field}.${key}`, undefined, `number 0-1`);
    }

    const weightValue = weights[key];
    if (typeof weightValue !== 'number' || isNaN(weightValue)) {
      throw new ValidationError(`Invalid weight ${key}`, `${field}.${key}`, weightValue, `number 0-1`);
    }

    if (weightValue < WEIGHT_RANGE.min || weightValue > WEIGHT_RANGE.max) {
      throw new ValidationError(
        `Weight ${key} out of range`,
        `${field}.${key}`,
        weightValue,
        `number between ${WEIGHT_RANGE.min} and ${WEIGHT_RANGE.max}`
      );
    }

    sum += weightValue;
  }

  if (Math.abs(sum - 1.0) >= 0.001) {
    throw new ValidationError('Weights do not sum to 1.0', field, sum, '1.0');
  }
}

// ============================================================================
// Band Threshold Validation
// ============================================================================

/**
 * Check if a value has valid BandThresholds structure
 */
export function isBandThresholds(value: unknown): value is BandThresholds {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const thresholds = value as Record<string, unknown>;
  const requiredBands = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5'] as const;

  return requiredBands.every((band) => {
    const bandValue = thresholds[band];
    if (typeof bandValue !== 'object' || bandValue === null) {
      return false;
    }

    const range = bandValue as Record<string, unknown>;
    return (
      typeof range.min === 'number' &&
      typeof range.max === 'number' &&
      range.min >= 0 &&
      range.max <= 100 &&
      range.min <= range.max
    );
  });
}

/**
 * Assert that a value has valid BandThresholds
 * @throws ValidationError if invalid
 */
export function assertValidBandThresholds(value: unknown, field = 'bandThresholds'): asserts value is BandThresholds {
  if (typeof value !== 'object' || value === null) {
    throw new ValidationError('Invalid band thresholds', field, value, 'object with T0-T5 ranges');
  }

  const thresholds = value as Record<string, unknown>;
  const requiredBands = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5'] as const;

  for (const band of requiredBands) {
    if (!(band in thresholds)) {
      throw new ValidationError(`Missing band ${band}`, `${field}.${band}`, undefined, `{min: number, max: number}`);
    }

    const bandValue = thresholds[band];
    if (typeof bandValue !== 'object' || bandValue === null) {
      throw new ValidationError(`Invalid band ${band}`, `${field}.${band}`, bandValue, `{min: number, max: number}`);
    }

    const range = bandValue as Record<string, unknown>;
    if (typeof range.min !== 'number' || typeof range.max !== 'number') {
      throw new ValidationError(
        `Invalid band ${band} range`,
        `${field}.${band}`,
        range,
        `{min: number, max: number}`
      );
    }

    if (range.min < 0 || range.max > 100 || range.min > range.max) {
      throw new ValidationError(
        `Band ${band} range out of bounds`,
        `${field}.${band}`,
        range,
        `min >= 0, max <= 100, min <= max`
      );
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate the trust band for a given score using default thresholds
 */
export function calculateTrustBand(score: number, thresholds = DEFAULT_BAND_THRESHOLDS): TrustBand {
  assertValidTrustScore(score);

  if (score <= thresholds.T0.max) return TrustBand.T0_UNTRUSTED;
  if (score <= thresholds.T1.max) return TrustBand.T1_SUPERVISED;
  if (score <= thresholds.T2.max) return TrustBand.T2_CONSTRAINED;
  if (score <= thresholds.T3.max) return TrustBand.T3_TRUSTED;
  if (score <= thresholds.T4.max) return TrustBand.T4_AUTONOMOUS;
  return TrustBand.T5_MISSION_CRITICAL;
}

/**
 * Calculate composite trust score from dimensions
 */
export function calculateCompositeScore(
  dimensions: TrustDimensions,
  weights: TrustWeights = DEFAULT_TRUST_WEIGHTS
): number {
  assertValidTrustDimensions(dimensions);
  assertValidTrustWeights(weights);

  const score =
    dimensions.CT * weights.CT +
    dimensions.BT * weights.BT +
    dimensions.GT * weights.GT +
    dimensions.XT * weights.XT +
    dimensions.AC * weights.AC;

  return roundTrustScore(score);
}

/**
 * Validate all fields of an object against a schema
 */
export function validateObject<T extends Record<string, unknown>>(
  obj: unknown,
  validators: Record<keyof T, (value: unknown, field: string) => void>
): obj is T {
  if (typeof obj !== 'object' || obj === null) {
    throw new ValidationError('Invalid object', 'root', obj, 'non-null object');
  }

  const record = obj as Record<string, unknown>;

  for (const [field, validator] of Object.entries(validators)) {
    validator(record[field], field);
  }

  return true;
}
