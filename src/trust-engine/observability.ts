/**
 * Observability Classes
 *
 * Per ACI spec, the observability of an agent limits its max trust tier.
 * Observability measures how much visibility we have into an agent's
 * internal workings, which directly impacts how much we can trust it.
 *
 * The 5 classes represent increasing levels of transparency:
 * - BLACK_BOX: No visibility (proprietary, closed-source)
 * - GRAY_BOX: Partial visibility (some logs, limited introspection)
 * - WHITE_BOX: Full code visibility (open source, auditable)
 * - ATTESTED_BOX: Hardware attestation (TEE, secure enclaves)
 * - VERIFIED_BOX: Formally verified (mathematical proofs of correctness)
 *
 * @packageDocumentation
 */

import type { TrustScore } from '../common/types.js';
import { createLogger } from '../common/logger.js';
import { z } from 'zod';

const logger = createLogger({ component: 'observability' });

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Runtime tier type (T0-T5)
 * Matches the tier system used throughout the trust engine
 */
export type RuntimeTier = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Observability Class Enum
 *
 * Defines the 5 levels of observability for agents.
 * Higher observability allows higher trust ceilings.
 */
export enum ObservabilityClass {
  /**
   * BLACK_BOX: No visibility into agent internals
   * - Proprietary, closed-source agents
   * - Cannot inspect decision-making process
   * - Maximum trust ceiling: T2 (60% = score 600)
   */
  BLACK_BOX = 0,

  /**
   * GRAY_BOX: Partial visibility
   * - Some logging and metrics available
   * - Limited introspection capabilities
   * - Maximum trust ceiling: T3 (75% = score 750)
   */
  GRAY_BOX = 1,

  /**
   * WHITE_BOX: Full code visibility
   * - Open source or source-available
   * - Complete audit trail possible
   * - Maximum trust ceiling: T4 (90% = score 900)
   */
  WHITE_BOX = 2,

  /**
   * ATTESTED_BOX: Hardware-attested execution
   * - Runs in Trusted Execution Environment (TEE)
   * - Hardware-backed integrity guarantees
   * - Maximum trust ceiling: T4 (95% = score 950)
   */
  ATTESTED_BOX = 3,

  /**
   * VERIFIED_BOX: Formally verified
   * - Mathematical proofs of correctness
   * - Highest assurance level
   * - Maximum trust ceiling: T5 (100% = score 1000)
   */
  VERIFIED_BOX = 4,
}

/**
 * Observability ceiling configuration
 */
export interface ObservabilityCeiling {
  /** Percentage of maximum trust allowed (0-100) */
  percentage: number;
  /** Maximum tier allowed */
  maxTier: RuntimeTier;
  /** Maximum score allowed */
  maxScore: number;
  /** Human-readable description */
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Observability ceiling definitions
 *
 * Maps each observability class to its trust ceiling.
 * These ceilings are hard limits - no amount of positive behavioral
 * signals can push an agent above their observability ceiling.
 */
export const OBSERVABILITY_CEILINGS: Record<ObservabilityClass, ObservabilityCeiling> = {
  [ObservabilityClass.BLACK_BOX]: {
    percentage: 60,
    maxTier: 2,
    maxScore: 600,
    description: 'No visibility - limited to constrained operations',
  },
  [ObservabilityClass.GRAY_BOX]: {
    percentage: 75,
    maxTier: 3,
    maxScore: 750,
    description: 'Partial visibility - standard trusted operations',
  },
  [ObservabilityClass.WHITE_BOX]: {
    percentage: 90,
    maxTier: 4,
    maxScore: 900,
    description: 'Full code visibility - autonomous operations',
  },
  [ObservabilityClass.ATTESTED_BOX]: {
    percentage: 95,
    maxTier: 4,
    maxScore: 950,
    description: 'Hardware attestation - high autonomy with integrity guarantees',
  },
  [ObservabilityClass.VERIFIED_BOX]: {
    percentage: 100,
    maxTier: 5,
    maxScore: 1000,
    description: 'Formally verified - full autonomy for mission-critical operations',
  },
};

/**
 * Observability class names for display
 */
export const OBSERVABILITY_CLASS_NAMES: Record<ObservabilityClass, string> = {
  [ObservabilityClass.BLACK_BOX]: 'Black Box',
  [ObservabilityClass.GRAY_BOX]: 'Gray Box',
  [ObservabilityClass.WHITE_BOX]: 'White Box',
  [ObservabilityClass.ATTESTED_BOX]: 'Attested Box',
  [ObservabilityClass.VERIFIED_BOX]: 'Verified Box',
};

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Schema for ObservabilityClass validation
 */
export const ObservabilityClassSchema = z.nativeEnum(ObservabilityClass);

/**
 * Schema for observability metadata
 */
export const ObservabilityMetadataSchema = z.object({
  class: ObservabilityClassSchema,
  attestationProvider: z.string().optional(),
  verificationProof: z.string().optional(),
  sourceCodeUrl: z.string().url().optional(),
  lastAuditDate: z.date().optional(),
});

export type ObservabilityMetadata = z.infer<typeof ObservabilityMetadataSchema>;

// ============================================================================
// Functions
// ============================================================================

/**
 * Get the trust ceiling for an observability class
 *
 * @param observability - The observability class
 * @returns The maximum runtime tier allowed
 */
export function getObservabilityCeiling(observability: ObservabilityClass): RuntimeTier {
  return OBSERVABILITY_CEILINGS[observability].maxTier;
}

/**
 * Get the maximum score for an observability class
 *
 * @param observability - The observability class
 * @returns The maximum trust score allowed
 */
export function getObservabilityMaxScore(observability: ObservabilityClass): number {
  return OBSERVABILITY_CEILINGS[observability].maxScore;
}

/**
 * Apply observability ceiling to a trust score
 *
 * Ensures the score does not exceed the maximum allowed
 * for the given observability class.
 *
 * @param score - The trust score to check
 * @param observability - The observability class of the agent
 * @returns The score, capped at the observability ceiling
 */
export function applyObservabilityCeiling(
  score: TrustScore,
  observability: ObservabilityClass
): TrustScore {
  const ceiling = OBSERVABILITY_CEILINGS[observability];
  const maxScore = Math.floor(1000 * (ceiling.percentage / 100));
  const result = Math.min(score, maxScore);

  if (result < score) {
    logger.debug(
      {
        originalScore: score,
        cappedScore: result,
        observabilityClass: OBSERVABILITY_CLASS_NAMES[observability],
        ceiling: ceiling.percentage,
      },
      'Applied observability ceiling to trust score'
    );
  }

  return result as TrustScore;
}

/**
 * Check if a trust tier is allowed for an observability class
 *
 * @param tier - The trust tier to check
 * @param observability - The observability class
 * @returns True if the tier is within the allowed ceiling
 */
export function isTierAllowedForObservability(
  tier: RuntimeTier,
  observability: ObservabilityClass
): boolean {
  const maxTier = OBSERVABILITY_CEILINGS[observability].maxTier;
  return tier <= maxTier;
}

/**
 * Get the minimum observability class required for a trust tier
 *
 * @param tier - The desired trust tier
 * @returns The minimum observability class needed
 */
export function getRequiredObservabilityForTier(tier: RuntimeTier): ObservabilityClass {
  if (tier <= 2) return ObservabilityClass.BLACK_BOX;
  if (tier <= 3) return ObservabilityClass.GRAY_BOX;
  if (tier <= 4) return ObservabilityClass.WHITE_BOX; // or ATTESTED_BOX
  return ObservabilityClass.VERIFIED_BOX;
}

/**
 * Determine observability class from agent metadata
 *
 * Analyzes agent properties to determine its observability class.
 *
 * @param metadata - Agent metadata with observability indicators
 * @returns The determined observability class
 */
export function determineObservabilityClass(
  metadata: Partial<ObservabilityMetadata>
): ObservabilityClass {
  // If explicitly set, use that
  if (metadata.class !== undefined) {
    return metadata.class;
  }

  // Infer from available properties
  if (metadata.verificationProof) {
    return ObservabilityClass.VERIFIED_BOX;
  }
  if (metadata.attestationProvider) {
    return ObservabilityClass.ATTESTED_BOX;
  }
  if (metadata.sourceCodeUrl) {
    return ObservabilityClass.WHITE_BOX;
  }
  if (metadata.lastAuditDate) {
    return ObservabilityClass.GRAY_BOX;
  }

  // Default to most restrictive
  return ObservabilityClass.BLACK_BOX;
}

/**
 * Get human-readable description of observability constraints
 *
 * @param observability - The observability class
 * @returns Description of the trust implications
 */
export function describeObservabilityConstraints(observability: ObservabilityClass): string {
  const ceiling = OBSERVABILITY_CEILINGS[observability];
  const name = OBSERVABILITY_CLASS_NAMES[observability];
  return `${name}: ${ceiling.description} (max T${ceiling.maxTier}, ${ceiling.percentage}% ceiling)`;
}
