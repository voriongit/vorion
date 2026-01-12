/**
 * Trust Ceilings - Score limits based on observation tier
 *
 * Key insight: Cannot fully trust what you cannot inspect.
 * API-accessed proprietary models are capped at 60% max trust.
 */

import { ObservationTier, OBSERVATION_CEILINGS } from '@orion/contracts';

export { OBSERVATION_CEILINGS };

/**
 * Apply trust ceiling based on observation tier
 *
 * @param score - The raw trust score (0-100)
 * @param tier - The observation tier
 * @returns The adjusted score after applying ceiling
 */
export function applyCeiling(score: number, tier: ObservationTier): number {
  const ceiling = OBSERVATION_CEILINGS[tier];
  return Math.min(score, ceiling);
}

/**
 * Calculate how much trust is being lost to the ceiling
 */
export function getCeilingLoss(score: number, tier: ObservationTier): number {
  const ceiling = OBSERVATION_CEILINGS[tier];
  return Math.max(0, score - ceiling);
}

/**
 * Check if a score is at the ceiling
 */
export function isAtCeiling(score: number, tier: ObservationTier): boolean {
  const ceiling = OBSERVATION_CEILINGS[tier];
  return score >= ceiling;
}

/**
 * Get the room for improvement (how much higher can trust go)
 */
export function getRoomForImprovement(
  currentScore: number,
  tier: ObservationTier
): number {
  const ceiling = OBSERVATION_CEILINGS[tier];
  return Math.max(0, ceiling - currentScore);
}

/**
 * Calculate what tier would be needed to achieve a target score
 */
export function requiredTierForScore(
  targetScore: number
): ObservationTier | null {
  if (targetScore <= OBSERVATION_CEILINGS[ObservationTier.BLACK_BOX]) {
    return ObservationTier.BLACK_BOX;
  }
  if (targetScore <= OBSERVATION_CEILINGS[ObservationTier.GRAY_BOX]) {
    return ObservationTier.GRAY_BOX;
  }
  if (targetScore <= OBSERVATION_CEILINGS[ObservationTier.WHITE_BOX]) {
    return ObservationTier.WHITE_BOX;
  }
  if (targetScore <= OBSERVATION_CEILINGS[ObservationTier.ATTESTED_BOX]) {
    return ObservationTier.ATTESTED_BOX;
  }
  if (targetScore <= OBSERVATION_CEILINGS[ObservationTier.VERIFIED_BOX]) {
    return ObservationTier.VERIFIED_BOX;
  }
  return null; // Score is impossible to achieve
}

/**
 * Ceiling impact analysis
 */
export interface CeilingAnalysis {
  /** Original score before ceiling */
  originalScore: number;
  /** Score after ceiling applied */
  adjustedScore: number;
  /** Trust points lost to ceiling */
  ceilingLoss: number;
  /** Is the score currently at the ceiling? */
  atCeiling: boolean;
  /** Room for improvement within current tier */
  improvementRoom: number;
  /** Would a tier upgrade unlock more trust? */
  tierUpgradeWouldHelp: boolean;
  /** Next tier that would unlock more trust */
  nextUnlockingTier: ObservationTier | null;
}

/**
 * Analyze the impact of trust ceiling on a score
 */
export function analyzeCeilingImpact(
  score: number,
  tier: ObservationTier
): CeilingAnalysis {
  const ceiling = OBSERVATION_CEILINGS[tier];
  const adjustedScore = Math.min(score, ceiling);
  const ceilingLoss = Math.max(0, score - ceiling);
  const atCeiling = score >= ceiling;
  const improvementRoom = Math.max(0, ceiling - score);

  // Check if upgrading tier would help
  let tierUpgradeWouldHelp = false;
  let nextUnlockingTier: ObservationTier | null = null;

  if (atCeiling && tier !== ObservationTier.VERIFIED_BOX) {
    tierUpgradeWouldHelp = true;

    // Find the next tier that would increase the ceiling
    const tiers = [
      ObservationTier.BLACK_BOX,
      ObservationTier.GRAY_BOX,
      ObservationTier.WHITE_BOX,
      ObservationTier.ATTESTED_BOX,
      ObservationTier.VERIFIED_BOX,
    ];
    const currentIndex = tiers.indexOf(tier);

    for (let i = currentIndex + 1; i < tiers.length; i++) {
      const nextTier = tiers[i]!;
      if (OBSERVATION_CEILINGS[nextTier] > ceiling) {
        nextUnlockingTier = nextTier;
        break;
      }
    }
  }

  return {
    originalScore: score,
    adjustedScore,
    ceilingLoss,
    atCeiling,
    improvementRoom,
    tierUpgradeWouldHelp,
    nextUnlockingTier,
  };
}

/**
 * Format ceiling information for display
 */
export function formatCeilingInfo(tier: ObservationTier): string {
  const ceiling = OBSERVATION_CEILINGS[tier];
  return `${tier} (max ${ceiling}%)`;
}
