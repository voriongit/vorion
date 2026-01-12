/**
 * Trust Calculator - Core trust scoring engine
 *
 * Calculates composite trust scores from dimension values and weights,
 * applying observation tier ceilings and decay over time.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  TrustProfile,
  TrustDimensions,
  TrustWeights,
  TrustEvidence,
  ObservationTier,
} from '@orion/contracts';
import {
  OBSERVATION_CEILINGS,
  DEFAULT_TRUST_WEIGHTS,
  DEFAULT_BANDING_CONFIG,
} from '@orion/contracts';
import { createDimensions, INITIAL_DIMENSIONS } from './dimensions.js';
import { createWeights } from './weights.js';
import { getBand } from '../banding/bands.js';

/**
 * Options for trust calculation
 */
export interface CalculationOptions {
  /** Custom weights to use */
  weights?: Partial<TrustWeights>;
  /** Current time (for decay calculations) */
  now?: Date;
  /** Apply time decay to evidence */
  applyDecay?: boolean;
  /** Decay rate per day (0.0 to 1.0) */
  decayRate?: number;
}

/**
 * Result of aggregating evidence into dimensions
 */
interface EvidenceAggregation {
  dimensions: TrustDimensions;
  evidenceCount: number;
  latestEvidence: Date | null;
}

/**
 * Calculate a composite trust score from dimensions and weights
 */
export function calculateCompositeScore(
  dimensions: TrustDimensions,
  weights: TrustWeights = DEFAULT_TRUST_WEIGHTS
): number {
  const score =
    dimensions.CT * weights.CT +
    dimensions.BT * weights.BT +
    dimensions.GT * weights.GT +
    dimensions.XT * weights.XT +
    dimensions.AC * weights.AC;

  // Round to 2 decimal places
  return Math.round(score * 100) / 100;
}

/**
 * Apply observation tier ceiling to a score
 */
export function applyObservationCeiling(
  score: number,
  tier: ObservationTier
): number {
  const ceiling = OBSERVATION_CEILINGS[tier];
  return Math.min(score, ceiling);
}

/**
 * Aggregate evidence into dimension scores
 */
export function aggregateEvidence(
  evidence: TrustEvidence[],
  options: CalculationOptions = {}
): EvidenceAggregation {
  const { now = new Date(), applyDecay = true, decayRate = DEFAULT_BANDING_CONFIG.decayRate } = options;

  // Start with initial dimensions
  const dimensionScores: Record<keyof TrustDimensions, number[]> = {
    CT: [],
    BT: [],
    GT: [],
    XT: [],
    AC: [],
  };

  let latestEvidence: Date | null = null;

  for (const ev of evidence) {
    // Skip expired evidence
    if (ev.expiresAt && ev.expiresAt < now) {
      continue;
    }

    // Calculate decay factor if enabled
    let impact = ev.impact;
    if (applyDecay) {
      const daysSinceCollection = Math.max(
        0,
        (now.getTime() - ev.collectedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const decayFactor = Math.pow(1 - decayRate, daysSinceCollection);
      impact = ev.impact * decayFactor;
    }

    dimensionScores[ev.dimension].push(impact);

    if (!latestEvidence || ev.collectedAt > latestEvidence) {
      latestEvidence = ev.collectedAt;
    }
  }

  // Average impacts for each dimension, starting from baseline
  const dimensions: TrustDimensions = { ...INITIAL_DIMENSIONS };
  for (const dim of Object.keys(dimensions) as (keyof TrustDimensions)[]) {
    const impacts = dimensionScores[dim];
    if (impacts.length > 0) {
      const avgImpact = impacts.reduce((a, b) => a + b, 0) / impacts.length;
      dimensions[dim] = Math.max(0, Math.min(100, INITIAL_DIMENSIONS[dim] + avgImpact));
    }
  }

  return {
    dimensions: createDimensions(dimensions),
    evidenceCount: evidence.length,
    latestEvidence,
  };
}

/**
 * Calculate a complete trust profile for an agent
 */
export function calculateTrustProfile(
  agentId: string,
  observationTier: ObservationTier,
  evidence: TrustEvidence[],
  options: CalculationOptions = {}
): TrustProfile {
  const weights = createWeights(options.weights);
  const now = options.now ?? new Date();

  // Aggregate evidence into dimensions
  const aggregation = aggregateEvidence(evidence, options);
  const dimensions = aggregation.dimensions;

  // Calculate composite score
  const compositeScore = calculateCompositeScore(dimensions, weights);

  // Apply observation ceiling
  const adjustedScore = applyObservationCeiling(compositeScore, observationTier);

  // Determine trust band
  const band = getBand(adjustedScore);

  return {
    profileId: uuidv4(),
    agentId,
    dimensions,
    weights,
    compositeScore,
    observationTier,
    adjustedScore,
    band,
    calculatedAt: now,
    evidence,
    version: 1,
  };
}

/**
 * Recalculate trust profile with additional evidence
 */
export function recalculateProfile(
  existingProfile: TrustProfile,
  newEvidence: TrustEvidence[],
  options: CalculationOptions = {}
): TrustProfile {
  // Combine existing and new evidence
  const allEvidence = [...existingProfile.evidence, ...newEvidence];

  // Recalculate from scratch
  const newProfile = calculateTrustProfile(
    existingProfile.agentId,
    existingProfile.observationTier,
    allEvidence,
    {
      ...options,
      weights: options.weights ?? existingProfile.weights,
    }
  );

  return {
    ...newProfile,
    version: existingProfile.version + 1,
  };
}

/**
 * Apply time decay to a profile without adding new evidence
 */
export function applyDecay(
  profile: TrustProfile,
  options: CalculationOptions = {}
): TrustProfile {
  return calculateTrustProfile(
    profile.agentId,
    profile.observationTier,
    profile.evidence,
    {
      ...options,
      applyDecay: true,
      weights: profile.weights,
    }
  );
}

/**
 * Create evidence for a dimension
 */
export function createEvidence(
  dimension: keyof TrustDimensions,
  impact: number,
  source: string,
  metadata?: Record<string, unknown>
): TrustEvidence {
  return {
    evidenceId: uuidv4(),
    dimension,
    impact: Math.max(-100, Math.min(100, impact)),
    source,
    collectedAt: new Date(),
    metadata,
  };
}
