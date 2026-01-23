/**
 * @fileoverview Canonical TrustBand definitions for the Vorion Platform.
 *
 * This file provides the authoritative definition for trust bands (T0-T5),
 * including thresholds, conversion utilities, and Zod validation schemas.
 *
 * Trust bands represent discrete levels of autonomy granted to agents based
 * on their accumulated trust score. The system uses a 6-tier model with
 * equal divisions on a 0-1000 scale.
 *
 * @module @orion/contracts/canonical/trust-band
 */

import { z } from 'zod';

/**
 * Trust bands representing agent autonomy levels.
 *
 * The 6-tier system (T0-T5) maps trust scores to discrete autonomy levels:
 * - T0: No autonomy - requires full human oversight
 * - T1: Minimal autonomy - observed and supervised
 * - T2: Limited autonomy - constrained operations
 * - T3: Standard autonomy - trusted for routine operations
 * - T4: High autonomy - trusted for sensitive operations
 * - T5: Full autonomy - mission-critical with minimal oversight
 *
 * @enum {number}
 */
export enum TrustBand {
  /** Untrusted - No autonomy, full human oversight required */
  T0_UNTRUSTED = 0,
  /** Observed - Minimal autonomy, under active supervision */
  T1_OBSERVED = 1,
  /** Limited - Constrained operations with guardrails */
  T2_LIMITED = 2,
  /** Standard - Trusted for routine operations */
  T3_STANDARD = 3,
  /** Trusted - High autonomy for sensitive operations */
  T4_TRUSTED = 4,
  /** Certified - Full autonomy, mission-critical capable */
  T5_CERTIFIED = 5,
}

/**
 * Threshold configuration for a single trust band.
 *
 * Defines the score range and human-readable label for a trust band.
 */
export interface TrustBandThreshold {
  /** Minimum score (inclusive) for this band */
  readonly min: number;
  /** Maximum score (inclusive) for this band */
  readonly max: number;
  /** Human-readable label for display */
  readonly label: string;
  /** Brief description of the autonomy level */
  readonly description: string;
}

/**
 * Trust band thresholds mapping each band to its score range.
 *
 * Uses a 0-1000 scale with approximately equal divisions (~166.67 points each).
 * The boundaries are set to provide clean divisions while maintaining
 * consistency across the platform.
 *
 * @constant
 */
export const TRUST_BAND_THRESHOLDS: Readonly<Record<TrustBand, TrustBandThreshold>> = {
  [TrustBand.T0_UNTRUSTED]: {
    min: 0,
    max: 166,
    label: 'Untrusted',
    description: 'No autonomy - requires full human oversight for all actions',
  },
  [TrustBand.T1_OBSERVED]: {
    min: 167,
    max: 332,
    label: 'Observed',
    description: 'Minimal autonomy - actions are observed and supervised',
  },
  [TrustBand.T2_LIMITED]: {
    min: 333,
    max: 499,
    label: 'Limited',
    description: 'Limited autonomy - constrained operations with guardrails',
  },
  [TrustBand.T3_STANDARD]: {
    min: 500,
    max: 665,
    label: 'Standard',
    description: 'Standard autonomy - trusted for routine operations',
  },
  [TrustBand.T4_TRUSTED]: {
    min: 666,
    max: 832,
    label: 'Trusted',
    description: 'High autonomy - trusted for sensitive operations',
  },
  [TrustBand.T5_CERTIFIED]: {
    min: 833,
    max: 1000,
    label: 'Certified',
    description: 'Full autonomy - mission-critical with minimal oversight',
  },
} as const;

/**
 * Array of all trust bands in ascending order.
 *
 * Useful for iteration and mapping operations.
 */
export const TRUST_BANDS = [
  TrustBand.T0_UNTRUSTED,
  TrustBand.T1_OBSERVED,
  TrustBand.T2_LIMITED,
  TrustBand.T3_STANDARD,
  TrustBand.T4_TRUSTED,
  TrustBand.T5_CERTIFIED,
] as const;

/**
 * Converts a trust score (0-1000) to its corresponding trust band.
 *
 * Uses the canonical threshold boundaries defined in TRUST_BAND_THRESHOLDS.
 *
 * @param score - Trust score on 0-1000 scale
 * @returns The corresponding TrustBand
 * @throws {Error} If score is outside valid range (0-1000)
 *
 * @example
 * ```typescript
 * scoreToTrustBand(0);    // TrustBand.T0_UNTRUSTED
 * scoreToTrustBand(500);  // TrustBand.T3_STANDARD
 * scoreToTrustBand(900);  // TrustBand.T5_CERTIFIED
 * ```
 */
export function scoreToTrustBand(score: number): TrustBand {
  if (score < 0 || score > 1000) {
    throw new Error(`Trust score must be between 0 and 1000, got ${score}`);
  }

  if (score <= 166) return TrustBand.T0_UNTRUSTED;
  if (score <= 332) return TrustBand.T1_OBSERVED;
  if (score <= 499) return TrustBand.T2_LIMITED;
  if (score <= 665) return TrustBand.T3_STANDARD;
  if (score <= 832) return TrustBand.T4_TRUSTED;
  return TrustBand.T5_CERTIFIED;
}

/**
 * Converts a trust band to its midpoint score.
 *
 * Returns the midpoint of the band's score range, useful for
 * initializing agents at a given trust level.
 *
 * @param band - The trust band to convert
 * @returns The midpoint score for the band (0-1000 scale)
 *
 * @example
 * ```typescript
 * trustBandToScore(TrustBand.T0_UNTRUSTED); // 83
 * trustBandToScore(TrustBand.T3_STANDARD);  // 582
 * trustBandToScore(TrustBand.T5_CERTIFIED); // 916
 * ```
 */
export function trustBandToScore(band: TrustBand): number {
  const threshold = TRUST_BAND_THRESHOLDS[band];
  return Math.round((threshold.min + threshold.max) / 2);
}

/**
 * Gets the minimum score required to achieve a trust band.
 *
 * @param band - The target trust band
 * @returns The minimum score needed to reach this band
 *
 * @example
 * ```typescript
 * getTrustBandMinScore(TrustBand.T3_STANDARD); // 500
 * getTrustBandMinScore(TrustBand.T5_CERTIFIED); // 833
 * ```
 */
export function getTrustBandMinScore(band: TrustBand): number {
  return TRUST_BAND_THRESHOLDS[band].min;
}

/**
 * Gets the maximum score for a trust band.
 *
 * @param band - The target trust band
 * @returns The maximum score within this band
 *
 * @example
 * ```typescript
 * getTrustBandMaxScore(TrustBand.T0_UNTRUSTED); // 166
 * getTrustBandMaxScore(TrustBand.T5_CERTIFIED); // 1000
 * ```
 */
export function getTrustBandMaxScore(band: TrustBand): number {
  return TRUST_BAND_THRESHOLDS[band].max;
}

/**
 * Gets the human-readable label for a trust band.
 *
 * @param band - The trust band
 * @returns Human-readable label string
 *
 * @example
 * ```typescript
 * getTrustBandLabel(TrustBand.T3_STANDARD); // "Standard"
 * ```
 */
export function getTrustBandLabel(band: TrustBand): string {
  return TRUST_BAND_THRESHOLDS[band].label;
}

/**
 * Gets the description for a trust band.
 *
 * @param band - The trust band
 * @returns Description of the autonomy level
 */
export function getTrustBandDescription(band: TrustBand): string {
  return TRUST_BAND_THRESHOLDS[band].description;
}

/**
 * Checks if a given band is higher (more trusted) than another.
 *
 * @param band - The band to check
 * @param otherBand - The band to compare against
 * @returns True if band is higher than otherBand
 *
 * @example
 * ```typescript
 * isTrustBandHigher(TrustBand.T4_TRUSTED, TrustBand.T2_LIMITED); // true
 * isTrustBandHigher(TrustBand.T1_OBSERVED, TrustBand.T3_STANDARD); // false
 * ```
 */
export function isTrustBandHigher(band: TrustBand, otherBand: TrustBand): boolean {
  return band > otherBand;
}

/**
 * Checks if a given band meets or exceeds a required minimum band.
 *
 * @param band - The band to check
 * @param requiredBand - The minimum required band
 * @returns True if band meets or exceeds the requirement
 *
 * @example
 * ```typescript
 * meetsMinimumTrustBand(TrustBand.T4_TRUSTED, TrustBand.T3_STANDARD); // true
 * meetsMinimumTrustBand(TrustBand.T2_LIMITED, TrustBand.T3_STANDARD); // false
 * ```
 */
export function meetsMinimumTrustBand(band: TrustBand, requiredBand: TrustBand): boolean {
  return band >= requiredBand;
}

// Note: isTrustBand type guard is exported from canonical/validation.ts to avoid duplication

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Zod schema for TrustBand enum validation.
 *
 * Validates that a value is a valid TrustBand enum member.
 *
 * @example
 * ```typescript
 * trustBandSchema.parse(TrustBand.T3_STANDARD); // Success
 * trustBandSchema.parse(3); // Success
 * trustBandSchema.parse(6); // Throws ZodError
 * ```
 */
export const trustBandSchema = z.nativeEnum(TrustBand, {
  errorMap: () => ({ message: 'Invalid trust band. Must be T0-T5 (0-5).' }),
});

/**
 * Zod schema for TrustBandThreshold validation.
 */
export const trustBandThresholdSchema = z.object({
  min: z.number().int().min(0).max(1000),
  max: z.number().int().min(0).max(1000),
  label: z.string().min(1),
  description: z.string().min(1),
}).refine(
  (data) => data.min <= data.max,
  { message: 'min must be less than or equal to max' }
);

/**
 * Zod schema for validating a trust score that will be converted to a band.
 *
 * Validates the score is within the 0-1000 range.
 */
export const trustBandScoreSchema = z.number()
  .min(0, 'Trust score must be at least 0')
  .max(1000, 'Trust score must be at most 1000')
  .transform((score) => ({
    score,
    band: scoreToTrustBand(score),
  }));

// ============================================================================
// Legacy Compatibility
// ============================================================================

/**
 * Maps legacy string-based tier names to canonical TrustBand values.
 *
 * Provides compatibility with older systems that used string tiers.
 *
 * @deprecated Use TrustBand enum directly. This is for migration only.
 */
export const LEGACY_TIER_TO_BAND: Readonly<Record<string, TrustBand>> = {
  // From apps/agentanchor/lib/agents/types.ts
  untrusted: TrustBand.T0_UNTRUSTED,
  novice: TrustBand.T1_OBSERVED,
  proven: TrustBand.T2_LIMITED,
  trusted: TrustBand.T3_STANDARD,
  elite: TrustBand.T4_TRUSTED,
  legendary: TrustBand.T5_CERTIFIED,
  // From apps/agentanchor/lib/governance/types.ts
  provisional: TrustBand.T1_OBSERVED,
  established: TrustBand.T2_LIMITED,
  verified: TrustBand.T4_TRUSTED,
  certified: TrustBand.T5_CERTIFIED,
  // Uppercase variants (from trust-signal.ts)
  UNTRUSTED: TrustBand.T0_UNTRUSTED,
  PROVISIONAL: TrustBand.T1_OBSERVED,
  TRUSTED: TrustBand.T3_STANDARD,
  VERIFIED: TrustBand.T4_TRUSTED,
  CERTIFIED: TrustBand.T5_CERTIFIED,
  LEGENDARY: TrustBand.T5_CERTIFIED,
} as const;

/**
 * Converts a legacy string tier name to the canonical TrustBand.
 *
 * @deprecated Use TrustBand enum directly. This is for migration only.
 * @param legacyTier - Legacy string tier name
 * @returns The corresponding TrustBand, or T0_UNTRUSTED if not recognized
 */
export function legacyTierToTrustBand(legacyTier: string): TrustBand {
  const normalized = legacyTier.toLowerCase();
  return LEGACY_TIER_TO_BAND[normalized] ?? LEGACY_TIER_TO_BAND[legacyTier] ?? TrustBand.T0_UNTRUSTED;
}

/**
 * Converts a TrustBand to a legacy string tier format.
 *
 * @deprecated Use TrustBand enum directly. This is for migration only.
 * @param band - The trust band
 * @returns Lowercase legacy tier string
 */
export function trustBandToLegacyTier(band: TrustBand): string {
  const labels: Record<TrustBand, string> = {
    [TrustBand.T0_UNTRUSTED]: 'untrusted',
    [TrustBand.T1_OBSERVED]: 'provisional',
    [TrustBand.T2_LIMITED]: 'established',
    [TrustBand.T3_STANDARD]: 'trusted',
    [TrustBand.T4_TRUSTED]: 'verified',
    [TrustBand.T5_CERTIFIED]: 'certified',
  };
  return labels[band];
}
