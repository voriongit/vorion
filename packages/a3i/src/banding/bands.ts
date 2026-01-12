/**
 * Trust Banding - T0 to T5 trust bands with autonomy levels
 *
 * Trust bands map score ranges to autonomy levels:
 * - T0 (0-20): Untrusted - No autonomy, full human oversight
 * - T1 (21-40): Supervised - Human approval for all actions
 * - T2 (41-55): Constrained - Limited autonomy with guardrails
 * - T3 (56-70): Trusted - Standard autonomy with monitoring
 * - T4 (71-85): Autonomous - High autonomy for routine tasks
 * - T5 (86-100): Mission Critical - Full autonomy for critical systems
 */

import { TrustBand, type BandThresholds, DEFAULT_BAND_THRESHOLDS } from '@vorion/contracts';

export { TrustBand, DEFAULT_BAND_THRESHOLDS };

/**
 * Get the trust band for a given score
 */
export function getBand(
  score: number,
  thresholds: BandThresholds = DEFAULT_BAND_THRESHOLDS
): TrustBand {
  if (score <= thresholds.T0.max) return TrustBand.T0_UNTRUSTED;
  if (score <= thresholds.T1.max) return TrustBand.T1_SUPERVISED;
  if (score <= thresholds.T2.max) return TrustBand.T2_CONSTRAINED;
  if (score <= thresholds.T3.max) return TrustBand.T3_TRUSTED;
  if (score <= thresholds.T4.max) return TrustBand.T4_AUTONOMOUS;
  return TrustBand.T5_MISSION_CRITICAL;
}

/**
 * Get the score range for a band
 */
export function getBandRange(
  band: TrustBand,
  thresholds: BandThresholds = DEFAULT_BAND_THRESHOLDS
): { min: number; max: number } {
  switch (band) {
    case TrustBand.T0_UNTRUSTED:
      return thresholds.T0;
    case TrustBand.T1_SUPERVISED:
      return thresholds.T1;
    case TrustBand.T2_CONSTRAINED:
      return thresholds.T2;
    case TrustBand.T3_TRUSTED:
      return thresholds.T3;
    case TrustBand.T4_AUTONOMOUS:
      return thresholds.T4;
    case TrustBand.T5_MISSION_CRITICAL:
      return thresholds.T5;
    default:
      return thresholds.T0;
  }
}

/**
 * Get band name (human readable)
 */
export function getBandName(band: TrustBand): string {
  switch (band) {
    case TrustBand.T0_UNTRUSTED:
      return 'Untrusted';
    case TrustBand.T1_SUPERVISED:
      return 'Supervised';
    case TrustBand.T2_CONSTRAINED:
      return 'Constrained';
    case TrustBand.T3_TRUSTED:
      return 'Trusted';
    case TrustBand.T4_AUTONOMOUS:
      return 'Autonomous';
    case TrustBand.T5_MISSION_CRITICAL:
      return 'Mission Critical';
    default:
      return 'Unknown';
  }
}

/**
 * Check if a band can be promoted to another
 */
export function canPromote(from: TrustBand, to: TrustBand): boolean {
  // Can only promote one level at a time
  return to === from + 1;
}

/**
 * Check if one band is higher than another
 */
export function isHigherBand(a: TrustBand, b: TrustBand): boolean {
  return a > b;
}

/**
 * Get the next band up (for promotion)
 */
export function getNextBand(band: TrustBand): TrustBand | null {
  if (band >= TrustBand.T5_MISSION_CRITICAL) return null;
  return (band + 1) as TrustBand;
}

/**
 * Get the previous band (for demotion)
 */
export function getPreviousBand(band: TrustBand): TrustBand | null {
  if (band <= TrustBand.T0_UNTRUSTED) return null;
  return (band - 1) as TrustBand;
}

/**
 * Band descriptions for documentation/UI
 */
export const BAND_DESCRIPTIONS: Record<TrustBand, {
  name: string;
  description: string;
  autonomyLevel: string;
  typicalCapabilities: string[];
}> = {
  [TrustBand.T0_UNTRUSTED]: {
    name: 'T0 - Untrusted',
    description: 'No established trust. Agent requires full human oversight.',
    autonomyLevel: 'None',
    typicalCapabilities: [
      'Read-only data access',
      'Query execution with review',
      'Informational responses only',
    ],
  },
  [TrustBand.T1_SUPERVISED]: {
    name: 'T1 - Supervised',
    description: 'Minimal trust. All actions require human approval.',
    autonomyLevel: 'Minimal',
    typicalCapabilities: [
      'Prepare actions for review',
      'Suggest changes',
      'Execute approved read operations',
    ],
  },
  [TrustBand.T2_CONSTRAINED]: {
    name: 'T2 - Constrained',
    description: 'Limited trust. Actions constrained by strict guardrails.',
    autonomyLevel: 'Limited',
    typicalCapabilities: [
      'Execute low-risk operations',
      'Write to non-critical systems',
      'Automated responses within templates',
    ],
  },
  [TrustBand.T3_TRUSTED]: {
    name: 'T3 - Trusted',
    description: 'Standard trust. Agent operates with monitoring.',
    autonomyLevel: 'Standard',
    typicalCapabilities: [
      'Execute routine operations',
      'Make decisions within policy',
      'Access internal data',
    ],
  },
  [TrustBand.T4_AUTONOMOUS]: {
    name: 'T4 - Autonomous',
    description: 'High trust. Agent operates independently for routine tasks.',
    autonomyLevel: 'High',
    typicalCapabilities: [
      'Execute complex workflows',
      'Access sensitive data',
      'Make autonomous decisions',
    ],
  },
  [TrustBand.T5_MISSION_CRITICAL]: {
    name: 'T5 - Mission Critical',
    description: 'Maximum trust. Agent handles critical systems.',
    autonomyLevel: 'Full',
    typicalCapabilities: [
      'Full system access',
      'Critical decision making',
      'Autonomous operation',
    ],
  },
};
