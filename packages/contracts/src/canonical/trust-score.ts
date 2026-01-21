/**
 * @fileoverview Canonical TrustScore type definitions for the Vorion Platform.
 *
 * This file provides the authoritative definition for trust scores, using a
 * branded type pattern to ensure type safety at compile time. The canonical
 * scale is 0-1000, with utilities for conversion to/from other scales.
 *
 * Trust scores represent an agent's accumulated trust level based on their
 * behavioral history, credentials, and contextual factors.
 *
 * @module @orion/contracts/canonical/trust-score
 */

import { z } from 'zod';

// ============================================================================
// Branded Type Definition
// ============================================================================

/**
 * Brand symbol for TrustScore type safety.
 * @internal
 */
declare const TrustScoreBrand: unique symbol;

/**
 * Branded type for trust scores on the canonical 0-1000 scale.
 *
 * Using a branded type ensures that raw numbers cannot be accidentally
 * used where a validated TrustScore is expected. All TrustScores must
 * be created via `createTrustScore()` to ensure validation.
 *
 * @example
 * ```typescript
 * // Correct usage
 * const score: TrustScore = createTrustScore(750);
 *
 * // Type error - cannot assign raw number to TrustScore
 * const score: TrustScore = 750; // Error!
 * ```
 */
export type TrustScore = number & { readonly [TrustScoreBrand]: typeof TrustScoreBrand };

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum valid trust score (0).
 * Represents complete lack of trust.
 */
export const MIN_TRUST_SCORE: TrustScore = 0 as TrustScore;

/**
 * Maximum valid trust score (1000).
 * Represents maximum achievable trust.
 */
export const MAX_TRUST_SCORE: TrustScore = 1000 as TrustScore;

/**
 * Default trust score for new agents (500).
 * Represents a neutral starting point at the T3_STANDARD threshold.
 */
export const DEFAULT_TRUST_SCORE: TrustScore = 500 as TrustScore;

/**
 * Initial trust score for completely new/unknown agents (250).
 * Places new agents in the T1_OBSERVED band.
 */
export const INITIAL_TRUST_SCORE: TrustScore = 250 as TrustScore;

/**
 * Trust score representing the probationary floor (167).
 * Minimum score to exit T0_UNTRUSTED band.
 */
export const PROBATION_THRESHOLD: TrustScore = 167 as TrustScore;

/**
 * Trust score representing critical threshold (100).
 * Below this triggers circuit breaker protections.
 */
export const CIRCUIT_BREAKER_THRESHOLD: TrustScore = 100 as TrustScore;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a validated TrustScore from a numeric value.
 *
 * Validates that the value is within the canonical 0-1000 range,
 * rounds to the nearest integer, and returns a branded TrustScore.
 *
 * @param value - Numeric value to convert to TrustScore
 * @returns Validated TrustScore
 * @throws {Error} If value is outside the 0-1000 range or not a valid number
 *
 * @example
 * ```typescript
 * const score = createTrustScore(750);     // TrustScore(750)
 * const score = createTrustScore(750.7);   // TrustScore(751) - rounded
 * const score = createTrustScore(-10);     // Throws Error
 * const score = createTrustScore(1500);    // Throws Error
 * ```
 */
export function createTrustScore(value: number): TrustScore {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`TrustScore must be a valid number, got ${typeof value}`);
  }

  if (!Number.isFinite(value)) {
    throw new Error('TrustScore must be a finite number');
  }

  if (value < 0 || value > 1000) {
    throw new Error(`TrustScore must be between 0 and 1000, got ${value}`);
  }

  return Math.round(value) as TrustScore;
}

/**
 * Creates a TrustScore, clamping values to valid range instead of throwing.
 *
 * Useful for normalization scenarios where out-of-range values should
 * be corrected rather than rejected.
 *
 * @param value - Numeric value to convert to TrustScore
 * @returns Validated and clamped TrustScore
 *
 * @example
 * ```typescript
 * createTrustScoreClamped(750);   // TrustScore(750)
 * createTrustScoreClamped(-50);   // TrustScore(0) - clamped to min
 * createTrustScoreClamped(1500);  // TrustScore(1000) - clamped to max
 * ```
 */
export function createTrustScoreClamped(value: number): TrustScore {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return DEFAULT_TRUST_SCORE;
  }

  const clamped = Math.max(0, Math.min(1000, value));
  return Math.round(clamped) as TrustScore;
}

/**
 * Safely parses a value to TrustScore, returning a result object.
 *
 * @param value - Value to parse
 * @returns Object with success flag and either score or error
 *
 * @example
 * ```typescript
 * const result = parseTrustScore(750);
 * if (result.success) {
 *   console.log(result.score); // TrustScore(750)
 * } else {
 *   console.log(result.error); // Error message
 * }
 * ```
 */
export function parseTrustScore(
  value: unknown
): { success: true; score: TrustScore } | { success: false; error: string } {
  if (typeof value !== 'number') {
    return { success: false, error: `Expected number, got ${typeof value}` };
  }

  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return { success: false, error: 'Value must be a finite number' };
  }

  if (value < 0 || value > 1000) {
    return { success: false, error: `Value must be between 0 and 1000, got ${value}` };
  }

  return { success: true, score: Math.round(value) as TrustScore };
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Normalizes a TrustScore (0-1000) to a 0-100 scale.
 *
 * Useful for display purposes or integration with systems using percentage-based trust.
 *
 * @param score - TrustScore on 0-1000 scale
 * @returns Normalized value on 0-100 scale
 *
 * @example
 * ```typescript
 * normalizeTo100(createTrustScore(750)); // 75
 * normalizeTo100(createTrustScore(500)); // 50
 * ```
 */
export function normalizeTo100(score: TrustScore): number {
  return Math.round(score / 10);
}

/**
 * Converts a 0-100 scale value to a TrustScore (0-1000).
 *
 * Useful for importing trust data from systems using percentage-based trust.
 *
 * @param value - Value on 0-100 scale
 * @returns TrustScore on 0-1000 scale
 * @throws {Error} If value is outside 0-100 range
 *
 * @example
 * ```typescript
 * normalizeFrom100(75); // TrustScore(750)
 * normalizeFrom100(50); // TrustScore(500)
 * ```
 */
export function normalizeFrom100(value: number): TrustScore {
  if (value < 0 || value > 100) {
    throw new Error(`Value must be between 0 and 100, got ${value}`);
  }
  return createTrustScore(value * 10);
}

/**
 * Normalizes a TrustScore (0-1000) to a 0-1 decimal scale.
 *
 * Useful for probabilistic calculations or ML integrations.
 *
 * @param score - TrustScore on 0-1000 scale
 * @returns Normalized value on 0-1 scale
 *
 * @example
 * ```typescript
 * normalizeToDecimal(createTrustScore(750)); // 0.75
 * normalizeToDecimal(createTrustScore(500)); // 0.5
 * ```
 */
export function normalizeToDecimal(score: TrustScore): number {
  return score / 1000;
}

/**
 * Converts a 0-1 decimal value to a TrustScore (0-1000).
 *
 * Useful for converting ML outputs or probability scores to TrustScore.
 *
 * @param value - Value on 0-1 scale
 * @returns TrustScore on 0-1000 scale
 * @throws {Error} If value is outside 0-1 range
 *
 * @example
 * ```typescript
 * normalizeFromDecimal(0.75); // TrustScore(750)
 * normalizeFromDecimal(0.5);  // TrustScore(500)
 * ```
 */
export function normalizeFromDecimal(value: number): TrustScore {
  if (value < 0 || value > 1) {
    throw new Error(`Value must be between 0 and 1, got ${value}`);
  }
  return createTrustScore(value * 1000);
}

// ============================================================================
// Arithmetic Operations
// ============================================================================

/**
 * Adds a delta to a TrustScore, clamping to valid range.
 *
 * @param score - Current TrustScore
 * @param delta - Amount to add (can be negative)
 * @returns New TrustScore clamped to 0-1000
 *
 * @example
 * ```typescript
 * addToTrustScore(createTrustScore(500), 100);  // TrustScore(600)
 * addToTrustScore(createTrustScore(950), 100);  // TrustScore(1000) - clamped
 * addToTrustScore(createTrustScore(50), -100);  // TrustScore(0) - clamped
 * ```
 */
export function addToTrustScore(score: TrustScore, delta: number): TrustScore {
  return createTrustScoreClamped(score + delta);
}

/**
 * Calculates the difference between two TrustScores.
 *
 * @param a - First TrustScore
 * @param b - Second TrustScore
 * @returns Difference (a - b) as a number
 */
export function trustScoreDifference(a: TrustScore, b: TrustScore): number {
  return a - b;
}

/**
 * Calculates the weighted average of multiple TrustScores.
 *
 * @param scores - Array of TrustScores
 * @param weights - Optional array of weights (defaults to equal weighting)
 * @returns Weighted average as TrustScore
 * @throws {Error} If arrays are empty or weights don't match scores
 *
 * @example
 * ```typescript
 * weightedAverage([createTrustScore(600), createTrustScore(800)]); // 700
 * weightedAverage(
 *   [createTrustScore(600), createTrustScore(800)],
 *   [0.3, 0.7]
 * ); // 740
 * ```
 */
export function weightedAverage(scores: TrustScore[], weights?: number[]): TrustScore {
  if (scores.length === 0) {
    throw new Error('Cannot calculate average of empty array');
  }

  if (weights) {
    if (weights.length !== scores.length) {
      throw new Error('Weights array must match scores array length');
    }

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (Math.abs(totalWeight - 1) > 0.001) {
      // Normalize weights if they don't sum to 1
      weights = weights.map((w) => w / totalWeight);
    }

    const weighted = scores.reduce((sum, score, i) => sum + score * weights![i], 0);
    return createTrustScoreClamped(weighted);
  }

  const sum = scores.reduce((acc, score) => acc + score, 0);
  return createTrustScoreClamped(sum / scores.length);
}

// ============================================================================
// Comparison Functions
// ============================================================================

/**
 * Compares two TrustScores.
 *
 * @param a - First TrustScore
 * @param b - Second TrustScore
 * @returns -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareTrustScores(a: TrustScore, b: TrustScore): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Checks if a TrustScore meets a minimum threshold.
 *
 * @param score - Score to check
 * @param threshold - Minimum required score
 * @returns True if score meets or exceeds threshold
 */
export function meetsThreshold(score: TrustScore, threshold: TrustScore): boolean {
  return score >= threshold;
}

/**
 * Checks if a TrustScore is below the circuit breaker threshold.
 *
 * @param score - Score to check
 * @returns True if score is critically low
 */
export function isCriticallyLow(score: TrustScore): boolean {
  return score < CIRCUIT_BREAKER_THRESHOLD;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value could be a valid TrustScore.
 *
 * Note: This checks numeric validity, not brand. Use for runtime validation.
 *
 * @param value - Value to check
 * @returns True if value is a number in the 0-1000 range
 *
 * @example
 * ```typescript
 * isTrustScoreValue(750);    // true
 * isTrustScoreValue(-10);    // false
 * isTrustScoreValue('750');  // false
 * ```
 */
export function isTrustScoreValue(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1000
  );
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Zod schema for raw trust score validation (0-1000 range).
 *
 * Validates that a number is within the canonical trust score range.
 */
export const trustScoreValueSchema = z
  .number({
    required_error: 'Trust score is required',
    invalid_type_error: 'Trust score must be a number',
  })
  .min(0, 'Trust score must be at least 0')
  .max(1000, 'Trust score must be at most 1000')
  .int('Trust score must be an integer');

/**
 * Zod schema that validates and transforms to TrustScore branded type.
 *
 * @example
 * ```typescript
 * const score = trustScoreSchema.parse(750); // Returns TrustScore(750)
 * trustScoreSchema.parse(-10); // Throws ZodError
 * ```
 */
export const trustScoreSchema = trustScoreValueSchema.transform(
  (val) => val as TrustScore
);

/**
 * Zod schema for trust score on 0-100 scale with transformation to 0-1000.
 *
 * Useful for parsing input from systems using percentage-based trust.
 */
export const trustScore100Schema = z
  .number()
  .min(0, 'Trust score must be at least 0')
  .max(100, 'Trust score must be at most 100')
  .transform((val) => (val * 10) as TrustScore);

/**
 * Zod schema for trust score on 0-1 decimal scale with transformation to 0-1000.
 *
 * Useful for parsing ML outputs or probability scores.
 */
export const trustScoreDecimalSchema = z
  .number()
  .min(0, 'Trust score must be at least 0')
  .max(1, 'Trust score must be at most 1')
  .transform((val) => Math.round(val * 1000) as TrustScore);

/**
 * Zod schema for optional trust score with default value.
 */
export const trustScoreWithDefaultSchema = trustScoreValueSchema
  .optional()
  .default(500)
  .transform((val) => val as TrustScore);
