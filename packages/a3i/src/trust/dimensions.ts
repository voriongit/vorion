/**
 * Trust Dimensions - The 5 dimensions of agent trust
 *
 * CT - Capability Trust: Does the agent have the technical ability?
 * BT - Behavioral Trust: Has the agent demonstrated reliable behavior?
 * GT - Governance Trust: Is the agent properly governed and compliant?
 * XT - Contextual Trust: Is this the right context for this agent?
 * AC - Assurance Confidence: How confident are we in our assessment?
 */

import type { TrustDimensions } from '@orion/contracts';
import { trustDimensionsSchema } from '@orion/contracts/validators';

/** Initial trust dimensions for a new agent (neutral starting point) */
export const INITIAL_DIMENSIONS: TrustDimensions = {
  CT: 50, // Neutral - capability unproven
  BT: 50, // Neutral - no behavioral history
  GT: 50, // Neutral - governance unverified
  XT: 50, // Neutral - context fit unknown
  AC: 30, // Low - new agents have low confidence
};

/** Minimum valid dimension score */
export const MIN_DIMENSION_SCORE = 0;

/** Maximum valid dimension score */
export const MAX_DIMENSION_SCORE = 100;

/**
 * Create a new TrustDimensions object with validation
 */
export function createDimensions(
  partial: Partial<TrustDimensions> = {}
): TrustDimensions {
  const dimensions = {
    ...INITIAL_DIMENSIONS,
    ...partial,
  };

  // Validate and clamp scores
  return {
    CT: clampScore(dimensions.CT),
    BT: clampScore(dimensions.BT),
    GT: clampScore(dimensions.GT),
    XT: clampScore(dimensions.XT),
    AC: clampScore(dimensions.AC),
  };
}

/**
 * Clamp a score to valid range [0, 100]
 */
export function clampScore(score: number): number {
  return Math.max(MIN_DIMENSION_SCORE, Math.min(MAX_DIMENSION_SCORE, score));
}

/**
 * Validate trust dimensions using Zod schema
 * @throws if validation fails
 */
export function validateDimensions(dimensions: unknown): TrustDimensions {
  return trustDimensionsSchema.parse(dimensions);
}

/**
 * Check if dimensions are valid without throwing
 */
export function isValidDimensions(
  dimensions: unknown
): dimensions is TrustDimensions {
  return trustDimensionsSchema.safeParse(dimensions).success;
}

/**
 * Get the minimum dimension score (weakest link)
 */
export function getMinDimension(dimensions: TrustDimensions): {
  dimension: keyof TrustDimensions;
  score: number;
} {
  const entries = Object.entries(dimensions) as [keyof TrustDimensions, number][];
  const min = entries.reduce((acc, [key, value]) =>
    value < acc.score ? { dimension: key, score: value } : acc,
    { dimension: 'CT' as keyof TrustDimensions, score: 100 }
  );
  return min;
}

/**
 * Get the maximum dimension score (strongest area)
 */
export function getMaxDimension(dimensions: TrustDimensions): {
  dimension: keyof TrustDimensions;
  score: number;
} {
  const entries = Object.entries(dimensions) as [keyof TrustDimensions, number][];
  const max = entries.reduce((acc, [key, value]) =>
    value > acc.score ? { dimension: key, score: value } : acc,
    { dimension: 'CT' as keyof TrustDimensions, score: 0 }
  );
  return max;
}

/**
 * Calculate dimension delta between two profiles
 */
export function getDimensionDelta(
  previous: TrustDimensions,
  current: TrustDimensions
): TrustDimensions {
  return {
    CT: current.CT - previous.CT,
    BT: current.BT - previous.BT,
    GT: current.GT - previous.GT,
    XT: current.XT - previous.XT,
    AC: current.AC - previous.AC,
  };
}

/**
 * Apply adjustments to dimensions
 */
export function adjustDimensions(
  dimensions: TrustDimensions,
  adjustments: Partial<TrustDimensions>
): TrustDimensions {
  return createDimensions({
    CT: dimensions.CT + (adjustments.CT ?? 0),
    BT: dimensions.BT + (adjustments.BT ?? 0),
    GT: dimensions.GT + (adjustments.GT ?? 0),
    XT: dimensions.XT + (adjustments.XT ?? 0),
    AC: dimensions.AC + (adjustments.AC ?? 0),
  });
}

/**
 * Dimension descriptions for documentation/UI
 */
export const DIMENSION_DESCRIPTIONS: Record<keyof TrustDimensions, {
  name: string;
  shortName: string;
  description: string;
  factors: string[];
}> = {
  CT: {
    name: 'Capability Trust',
    shortName: 'CT',
    description: 'Technical ability to perform requested tasks correctly',
    factors: [
      'Task success rate',
      'Domain expertise',
      'Tool proficiency',
      'Error handling',
    ],
  },
  BT: {
    name: 'Behavioral Trust',
    shortName: 'BT',
    description: 'History of reliable, consistent, and safe behavior',
    factors: [
      'Instruction adherence',
      'Consistency of outputs',
      'Safety boundary respect',
      'Predictability',
    ],
  },
  GT: {
    name: 'Governance Trust',
    shortName: 'GT',
    description: 'Alignment with organizational governance and compliance',
    factors: [
      'Policy compliance',
      'Audit trail completeness',
      'Approval workflow adherence',
      'Reporting accuracy',
    ],
  },
  XT: {
    name: 'Contextual Trust',
    shortName: 'XT',
    description: 'Appropriateness for the current operational context',
    factors: [
      'Domain match',
      'Environmental conditions',
      'User permissions',
      'Time sensitivity',
    ],
  },
  AC: {
    name: 'Assurance Confidence',
    shortName: 'AC',
    description: 'Confidence in the accuracy of trust assessment',
    factors: [
      'Evidence quantity',
      'Evidence recency',
      'Assessment coverage',
      'Verification depth',
    ],
  },
};
