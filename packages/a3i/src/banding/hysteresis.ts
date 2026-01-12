/**
 * Hysteresis - Preventing trust band oscillation
 *
 * Hysteresis creates a buffer zone between band boundaries
 * to prevent rapid switching between bands when scores
 * hover near thresholds.
 */

import { TrustBand, type BandingConfig, DEFAULT_BANDING_CONFIG } from '@orion/contracts';
import { getBand, getBandRange, getNextBand, getPreviousBand } from './bands.js';

export { DEFAULT_BANDING_CONFIG };

/**
 * Band transition history entry
 */
export interface BandHistoryEntry {
  band: TrustBand;
  score: number;
  timestamp: Date;
}

/**
 * Hysteresis calculator for band transitions
 */
export class HysteresisCalculator {
  private config: BandingConfig;

  constructor(config: Partial<BandingConfig> = {}) {
    this.config = { ...DEFAULT_BANDING_CONFIG, ...config };
  }

  /**
   * Calculate the effective band considering hysteresis
   *
   * @param currentBand - The agent's current band
   * @param newScore - The newly calculated score
   * @returns The effective band after hysteresis
   */
  calculateBandWithHysteresis(
    currentBand: TrustBand,
    newScore: number
  ): TrustBand {
    const rawBand = getBand(newScore, this.config.thresholds);

    // If raw band equals current, no transition needed
    if (rawBand === currentBand) {
      return currentBand;
    }

    const currentRange = getBandRange(currentBand, this.config.thresholds);
    const hysteresis = this.config.hysteresis;

    // For promotion (higher band): score must exceed threshold + hysteresis
    if (rawBand > currentBand) {
      const promotionThreshold = currentRange.max + hysteresis;
      if (newScore >= promotionThreshold) {
        // Allow promotion
        return rawBand;
      }
      // Stay at current band (within hysteresis zone)
      return currentBand;
    }

    // For demotion (lower band): score must fall below threshold - hysteresis
    if (rawBand < currentBand) {
      const demotionThreshold = currentRange.min - hysteresis;
      if (newScore <= demotionThreshold) {
        // Allow demotion
        return rawBand;
      }
      // Stay at current band (within hysteresis zone)
      return currentBand;
    }

    return currentBand;
  }

  /**
   * Check if promotion is allowed based on time at current band
   */
  canPromoteByTime(
    history: BandHistoryEntry[],
    targetBand: TrustBand
  ): { allowed: boolean; daysAtCurrentBand: number; daysRequired: number } {
    if (history.length === 0) {
      return {
        allowed: false,
        daysAtCurrentBand: 0,
        daysRequired: this.config.promotionDelay,
      };
    }

    const currentBand = history[history.length - 1]!.band;

    // Can only promote one level at a time
    const nextBand = getNextBand(currentBand);
    if (nextBand !== targetBand) {
      return {
        allowed: false,
        daysAtCurrentBand: 0,
        daysRequired: this.config.promotionDelay,
      };
    }

    // Find how long agent has been at current band
    const now = new Date();
    let daysAtCurrentBand = 0;

    // Work backwards through history
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i]!;
      if (entry.band !== currentBand) {
        break;
      }
      daysAtCurrentBand =
        (now.getTime() - entry.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    }

    return {
      allowed: daysAtCurrentBand >= this.config.promotionDelay,
      daysAtCurrentBand: Math.floor(daysAtCurrentBand),
      daysRequired: this.config.promotionDelay,
    };
  }

  /**
   * Demotion is always immediate (no delay)
   */
  canDemote(currentBand: TrustBand, targetBand: TrustBand): boolean {
    return targetBand < currentBand;
  }

  /**
   * Get the minimum score needed to promote from current band
   */
  getPromotionThreshold(currentBand: TrustBand): number | null {
    const nextBand = getNextBand(currentBand);
    if (nextBand === null) return null;

    const currentRange = getBandRange(currentBand, this.config.thresholds);
    return currentRange.max + this.config.hysteresis;
  }

  /**
   * Get the maximum score before demotion from current band
   */
  getDemotionThreshold(currentBand: TrustBand): number | null {
    const prevBand = getPreviousBand(currentBand);
    if (prevBand === null) return null;

    const currentRange = getBandRange(currentBand, this.config.thresholds);
    return currentRange.min - this.config.hysteresis;
  }

  /**
   * Get the distance to the next band transition
   */
  getDistanceToTransition(
    currentBand: TrustBand,
    currentScore: number
  ): { toPromotion: number | null; toDemotion: number | null } {
    const promotionThreshold = this.getPromotionThreshold(currentBand);
    const demotionThreshold = this.getDemotionThreshold(currentBand);

    return {
      toPromotion:
        promotionThreshold !== null
          ? Math.max(0, promotionThreshold - currentScore)
          : null,
      toDemotion:
        demotionThreshold !== null
          ? Math.max(0, currentScore - demotionThreshold)
          : null,
    };
  }
}

/**
 * Create a default hysteresis calculator
 */
export function createHysteresisCalculator(
  config?: Partial<BandingConfig>
): HysteresisCalculator {
  return new HysteresisCalculator(config);
}
