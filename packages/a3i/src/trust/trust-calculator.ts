/**
 * TrustCalculator Class - Core trust scoring engine
 *
 * Provides a stateful calculator for computing and managing
 * trust scores with proper evidence handling and decay.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  TrustProfile,
  TrustDimensions,
  TrustWeights,
  TrustEvidence,
  ObservationTier,
  BandingConfig,
} from '@vorion/contracts';
import {
  DEFAULT_TRUST_WEIGHTS,
  DEFAULT_BANDING_CONFIG,
  OBSERVATION_CEILINGS,
} from '@vorion/contracts';
import { createDimensions, INITIAL_DIMENSIONS, clampScore } from './dimensions.js';
import { normalizeWeights } from './weights.js';
import { getBand } from '../banding/bands.js';
import { HysteresisCalculator } from '../banding/hysteresis.js';

/**
 * Configuration for the TrustCalculator
 */
export interface TrustCalculatorConfig {
  /** Default weights to use */
  defaultWeights?: TrustWeights;
  /** Banding configuration */
  bandingConfig?: Partial<BandingConfig>;
  /** Enable time decay */
  enableDecay?: boolean;
  /** Decay rate per day (0.0 to 1.0) */
  decayRate?: number;
  /** Maximum age of evidence in days before it's ignored */
  maxEvidenceAgeDays?: number;
}

/**
 * Options for a single calculation
 */
export interface CalculateOptions {
  /** Override weights for this calculation */
  weights?: Partial<TrustWeights>;
  /** Override decay setting for this calculation */
  applyDecay?: boolean;
  /** Current time (for testing) */
  now?: Date;
}

/**
 * Result of evidence aggregation
 */
export interface AggregationResult {
  dimensions: TrustDimensions;
  validEvidenceCount: number;
  expiredEvidenceCount: number;
  oldestEvidence: Date | null;
  newestEvidence: Date | null;
}

/**
 * TrustCalculator - Main trust scoring engine
 */
export class TrustCalculator {
  private readonly config: Required<TrustCalculatorConfig>;
  private readonly hysteresisCalculator: HysteresisCalculator;

  constructor(config: TrustCalculatorConfig = {}) {
    this.config = {
      defaultWeights: config.defaultWeights ?? DEFAULT_TRUST_WEIGHTS,
      bandingConfig: { ...DEFAULT_BANDING_CONFIG, ...config.bandingConfig },
      enableDecay: config.enableDecay ?? true,
      decayRate: config.decayRate ?? DEFAULT_BANDING_CONFIG.decayRate,
      maxEvidenceAgeDays: config.maxEvidenceAgeDays ?? 365,
    };

    this.hysteresisCalculator = new HysteresisCalculator(this.config.bandingConfig);
  }

  /**
   * Calculate a new trust profile from evidence
   */
  calculate(
    agentId: string,
    observationTier: ObservationTier,
    evidence: TrustEvidence[],
    options: CalculateOptions = {}
  ): TrustProfile {
    const now = options.now ?? new Date();
    const weights = this.resolveWeights(options.weights);
    const applyDecay = options.applyDecay ?? this.config.enableDecay;

    // Aggregate evidence into dimensions
    const aggregation = this.aggregateEvidence(evidence, now, applyDecay);
    const dimensions = aggregation.dimensions;

    // Calculate composite score
    const compositeScore = this.computeCompositeScore(dimensions, weights);

    // Apply observation ceiling
    const adjustedScore = this.applyCeiling(compositeScore, observationTier);

    // Determine trust band
    const band = getBand(adjustedScore, this.config.bandingConfig.thresholds);

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
   * Recalculate an existing profile with new evidence
   */
  recalculate(
    existingProfile: TrustProfile,
    newEvidence: TrustEvidence[],
    options: CalculateOptions = {}
  ): TrustProfile {
    const now = options.now ?? new Date();
    const weights = this.resolveWeights(options.weights) ?? existingProfile.weights;
    const applyDecay = options.applyDecay ?? this.config.enableDecay;

    // Combine all evidence
    const allEvidence = [...existingProfile.evidence, ...newEvidence];

    // Aggregate with decay
    const aggregation = this.aggregateEvidence(allEvidence, now, applyDecay);

    // Calculate new composite score
    const compositeScore = this.computeCompositeScore(aggregation.dimensions, weights);

    // Apply observation ceiling
    const adjustedScore = this.applyCeiling(compositeScore, existingProfile.observationTier);

    // Calculate new band with hysteresis
    const band = this.hysteresisCalculator.calculateBandWithHysteresis(
      existingProfile.band,
      adjustedScore
    );

    return {
      profileId: uuidv4(),
      agentId: existingProfile.agentId,
      dimensions: aggregation.dimensions,
      weights,
      compositeScore,
      observationTier: existingProfile.observationTier,
      adjustedScore,
      band,
      calculatedAt: now,
      evidence: allEvidence,
      version: existingProfile.version + 1,
    };
  }

  /**
   * Apply time decay to a profile without new evidence
   */
  applyDecay(
    profile: TrustProfile,
    options: { now?: Date } = {}
  ): TrustProfile {
    const now = options.now ?? new Date();

    // Re-aggregate with decay
    const aggregation = this.aggregateEvidence(profile.evidence, now, true);

    // Recalculate scores
    const compositeScore = this.computeCompositeScore(aggregation.dimensions, profile.weights);
    const adjustedScore = this.applyCeiling(compositeScore, profile.observationTier);

    // Apply hysteresis for band changes
    const band = this.hysteresisCalculator.calculateBandWithHysteresis(
      profile.band,
      adjustedScore
    );

    return {
      ...profile,
      profileId: uuidv4(),
      dimensions: aggregation.dimensions,
      compositeScore,
      adjustedScore,
      band,
      calculatedAt: now,
      version: profile.version + 1,
    };
  }

  /**
   * Compute the weighted composite score from dimensions
   */
  computeCompositeScore(
    dimensions: TrustDimensions,
    weights: TrustWeights = this.config.defaultWeights
  ): number {
    // Validate dimensions
    this.validateDimensions(dimensions);

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
  applyCeiling(score: number, tier: ObservationTier): number {
    const ceiling = OBSERVATION_CEILINGS[tier];
    return Math.min(score, ceiling);
  }

  /**
   * Aggregate evidence into dimension scores
   */
  aggregateEvidence(
    evidence: TrustEvidence[],
    now: Date = new Date(),
    applyDecay: boolean = true
  ): AggregationResult {
    const dimensionImpacts: Record<keyof TrustDimensions, number[]> = {
      CT: [],
      BT: [],
      GT: [],
      XT: [],
      AC: [],
    };

    let validCount = 0;
    let expiredCount = 0;
    let oldestEvidence: Date | null = null;
    let newestEvidence: Date | null = null;

    const maxAge = this.config.maxEvidenceAgeDays * 24 * 60 * 60 * 1000;

    for (const ev of evidence) {
      // Skip expired evidence
      if (ev.expiresAt && ev.expiresAt < now) {
        expiredCount++;
        continue;
      }

      // Skip evidence older than max age
      const age = now.getTime() - ev.collectedAt.getTime();
      if (age > maxAge) {
        expiredCount++;
        continue;
      }

      // Calculate impact with optional decay
      let impact = ev.impact;
      if (applyDecay) {
        const daysSinceCollection = age / (1000 * 60 * 60 * 24);
        const decayFactor = Math.pow(1 - this.config.decayRate, daysSinceCollection);
        impact = ev.impact * decayFactor;
      }

      dimensionImpacts[ev.dimension].push(impact);
      validCount++;

      // Track date range
      if (!oldestEvidence || ev.collectedAt < oldestEvidence) {
        oldestEvidence = ev.collectedAt;
      }
      if (!newestEvidence || ev.collectedAt > newestEvidence) {
        newestEvidence = ev.collectedAt;
      }
    }

    // Calculate final dimensions from impacts
    const dimensions = this.computeDimensionsFromImpacts(dimensionImpacts);

    return {
      dimensions,
      validEvidenceCount: validCount,
      expiredEvidenceCount: expiredCount,
      oldestEvidence,
      newestEvidence,
    };
  }

  /**
   * Compute dimension scores from impact arrays
   */
  private computeDimensionsFromImpacts(
    impacts: Record<keyof TrustDimensions, number[]>
  ): TrustDimensions {
    const dimensions: TrustDimensions = { ...INITIAL_DIMENSIONS };

    for (const dim of Object.keys(dimensions) as (keyof TrustDimensions)[]) {
      const dimImpacts = impacts[dim];
      if (dimImpacts.length > 0) {
        // Use average of impacts
        const avgImpact = dimImpacts.reduce((a, b) => a + b, 0) / dimImpacts.length;
        dimensions[dim] = clampScore(INITIAL_DIMENSIONS[dim] + avgImpact);
      }
    }

    return createDimensions(dimensions);
  }

  /**
   * Validate dimension values
   */
  private validateDimensions(dimensions: TrustDimensions): void {
    for (const [key, value] of Object.entries(dimensions)) {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new Error(`Invalid dimension value for ${key}: ${value}`);
      }
      if (value < 0 || value > 100) {
        throw new Error(`Dimension ${key} out of range: ${value}`);
      }
    }
  }

  /**
   * Resolve weights from options or defaults
   */
  private resolveWeights(overrides?: Partial<TrustWeights>): TrustWeights {
    if (!overrides) {
      return this.config.defaultWeights;
    }

    const merged = {
      ...this.config.defaultWeights,
      ...overrides,
    };

    return normalizeWeights(merged);
  }

  /**
   * Get the calculator configuration
   */
  getConfig(): Readonly<Required<TrustCalculatorConfig>> {
    return { ...this.config };
  }

  /**
   * Get the hysteresis calculator
   */
  getHysteresisCalculator(): HysteresisCalculator {
    return this.hysteresisCalculator;
  }
}

/**
 * Create a TrustCalculator with default configuration
 */
export function createTrustCalculator(
  config?: TrustCalculatorConfig
): TrustCalculator {
  return new TrustCalculator(config);
}
