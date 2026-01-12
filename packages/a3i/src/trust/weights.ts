/**
 * Trust Weights - Configurable weighting for trust dimensions
 *
 * Weights determine how much each dimension contributes to the
 * composite trust score. All weights must sum to 1.0.
 */

import type { TrustWeights } from '@vorion/contracts';
import { DEFAULT_TRUST_WEIGHTS } from '@vorion/contracts';
import { trustWeightsSchema } from '@vorion/contracts/validators';

export { DEFAULT_TRUST_WEIGHTS };

/**
 * Create trust weights with validation
 */
export function createWeights(partial: Partial<TrustWeights> = {}): TrustWeights {
  const weights = {
    ...DEFAULT_TRUST_WEIGHTS,
    ...partial,
  };

  // Normalize if needed
  const sum = weights.CT + weights.BT + weights.GT + weights.XT + weights.AC;
  if (Math.abs(sum - 1.0) > 0.001) {
    return normalizeWeights(weights);
  }

  return weights;
}

/**
 * Normalize weights to sum to 1.0
 */
export function normalizeWeights(weights: TrustWeights): TrustWeights {
  const sum = weights.CT + weights.BT + weights.GT + weights.XT + weights.AC;
  if (sum === 0) {
    return DEFAULT_TRUST_WEIGHTS;
  }

  return {
    CT: weights.CT / sum,
    BT: weights.BT / sum,
    GT: weights.GT / sum,
    XT: weights.XT / sum,
    AC: weights.AC / sum,
  };
}

/**
 * Validate weights using Zod schema
 * @throws if validation fails
 */
export function validateWeights(weights: unknown): TrustWeights {
  return trustWeightsSchema.parse(weights);
}

/**
 * Check if weights are valid without throwing
 */
export function isValidWeights(weights: unknown): weights is TrustWeights {
  return trustWeightsSchema.safeParse(weights).success;
}

/**
 * Check if weights sum to 1.0 (within tolerance)
 */
export function weightsAreSummedCorrectly(weights: TrustWeights): boolean {
  const sum = weights.CT + weights.BT + weights.GT + weights.XT + weights.AC;
  return Math.abs(sum - 1.0) < 0.001;
}

/**
 * Preset weight configurations for different use cases
 */
export const WEIGHT_PRESETS: Record<string, TrustWeights> = {
  /** Default balanced weights */
  default: DEFAULT_TRUST_WEIGHTS,

  /** Emphasize behavioral trust (for production agents) */
  behavioral_focus: {
    CT: 0.20,
    BT: 0.35,
    GT: 0.20,
    XT: 0.10,
    AC: 0.15,
  },

  /** Emphasize governance (for regulated environments) */
  governance_focus: {
    CT: 0.15,
    BT: 0.20,
    GT: 0.35,
    XT: 0.15,
    AC: 0.15,
  },

  /** Emphasize capability (for technical tasks) */
  capability_focus: {
    CT: 0.35,
    BT: 0.20,
    GT: 0.15,
    XT: 0.15,
    AC: 0.15,
  },

  /** Emphasize context (for context-sensitive operations) */
  context_focus: {
    CT: 0.20,
    BT: 0.20,
    GT: 0.15,
    XT: 0.30,
    AC: 0.15,
  },

  /** High confidence requirement (for critical operations) */
  high_confidence: {
    CT: 0.20,
    BT: 0.20,
    GT: 0.15,
    XT: 0.15,
    AC: 0.30,
  },
};

/**
 * Get a weight preset by name
 */
export function getWeightPreset(name: string): TrustWeights {
  return WEIGHT_PRESETS[name] ?? DEFAULT_TRUST_WEIGHTS;
}

/**
 * List available weight preset names
 */
export function listWeightPresets(): string[] {
  return Object.keys(WEIGHT_PRESETS);
}
