/**
 * Q4: Weight Presets - Delta Weights
 * Axiom-specific customization weights that override canonical defaults
 *
 * Architecture:
 * - Deltas are applied as offsets to canonical weights
 * - Enable domain-specific tuning without modifying standards
 * - Tracked for audit and compliance
 * - Can be per-domain, per-tenant, or per-agent
 */

import { CANONICAL_TRUST_WEIGHTS, TOTAL_TRUST_WEIGHT } from './canonical.js';

/**
 * Direction of weight adjustment
 */
export type WeightAdjustmentDirection = 'increase' | 'decrease';

/**
 * Weight delta specification
 */
export interface WeightDelta {
  metric: keyof typeof CANONICAL_TRUST_WEIGHTS;
  adjustment: number; // +/- points to add/subtract
  reason: string;
  appliedAt: Date;
  appliedBy: string; // User or system ID
  domain?: string; // Optional domain scope
  expiresAt?: Date; // Optional expiration
}

/**
 * Tracking info for merged weights
 */
export interface WeightMergeRecord {
  agentId?: string;
  domain?: string;
  canonicalWeights: Record<string, number>;
  deltaWeights: WeightDelta[];
  mergedWeights: Record<string, number>;
  mergedAt: Date;
  reason: string;
}

/**
 * Common delta presets for Axiom domains
 */
export const AXIOM_DELTA_PRESETS = {
  /**
   * Healthcare domain: Emphasize safety, cascade prevention
   * - Increase cascade prevention (+50 points)
   * - Increase behavior stability (+30 points)
   * - Decrease execution efficiency (-20 points, cost acceptable for safety)
   */
  healthcare: [
    {
      metric: 'cascadePrevention' as const,
      adjustment: 50,
      reason: 'Healthcare domain requires maximum cascade prevention',
    },
    {
      metric: 'behaviorStability' as const,
      adjustment: 30,
      reason: 'Healthcare requires consistent, predictable behavior',
    },
    {
      metric: 'executionEfficiency' as const,
      adjustment: -20,
      reason: 'Healthcare prioritizes safety over resource efficiency',
    },
  ],

  /**
   * Finance domain: Emphasize authorization, success ratio
   * - Increase success ratio (+40 points)
   * - Increase authorization history (+30 points)
   * - Decrease behavior stability (-10 points, market conditions vary)
   */
  finance: [
    {
      metric: 'successRatio' as const,
      adjustment: 40,
      reason: 'Finance requires high success rate for transaction safety',
    },
    {
      metric: 'authorizationHistory' as const,
      adjustment: 30,
      reason: 'Finance requires strict authorization compliance',
    },
    {
      metric: 'behaviorStability' as const,
      adjustment: -10,
      reason: 'Finance agents adapt to market conditions',
    },
  ],

  /**
   * Manufacturing domain: Emphasize execution efficiency, cascade prevention
   * - Increase execution efficiency (+50 points)
   * - Increase cascade prevention (+20 points)
   * - Decrease behavior stability (-15 points, production varies)
   */
  manufacturing: [
    {
      metric: 'executionEfficiency' as const,
      adjustment: 50,
      reason: 'Manufacturing optimizes for throughput and resource utilization',
    },
    {
      metric: 'cascadePrevention' as const,
      adjustment: 20,
      reason: 'Manufacturing prevents production line cascades',
    },
    {
      metric: 'behaviorStability' as const,
      adjustment: -15,
      reason: 'Manufacturing behavior adapts to production parameters',
    },
  ],

  /**
   * Research domain: Emphasize behavior stability, success ratio
   * - Increase behavior stability (+40 points)
   * - Increase success ratio (+20 points)
   * - Decrease authorization history (-15 points, requires more autonomy for exploration)
   */
  research: [
    {
      metric: 'behaviorStability' as const,
      adjustment: 40,
      reason: 'Research requires reproducible, consistent behavior',
    },
    {
      metric: 'successRatio' as const,
      adjustment: 20,
      reason: 'Research emphasizes successful experiments',
    },
    {
      metric: 'authorizationHistory' as const,
      adjustment: -15,
      reason: 'Research agents need autonomy for exploratory work',
    },
  ],
} as const;

/**
 * Apply a delta to canonical weights
 */
export function applyDelta(
  canonicalWeights: Record<string, number>,
  delta: WeightDelta
): Record<string, number> {
  // Check expiration
  if (delta.expiresAt && new Date() > delta.expiresAt) {
    return canonicalWeights; // Don't apply expired delta
  }

  const adjusted = { ...canonicalWeights };
  const currentValue = adjusted[delta.metric];

  // Apply adjustment with bounds checking
  const newValue = Math.max(0, Math.min(1000, currentValue + delta.adjustment));
  adjusted[delta.metric] = newValue;

  return adjusted;
}

/**
 * Apply multiple deltas to canonical weights
 */
export function applyDeltas(
  canonicalWeights: Record<string, number>,
  deltas: WeightDelta[]
): Record<string, number> {
  return deltas.reduce((weights, delta) => applyDelta(weights, delta), canonicalWeights);
}

/**
 * Validate that delta adjustments don't create invalid weights
 */
export function validateDeltaAdjustments(
  canonicalWeights: Record<string, number>,
  deltas: WeightDelta[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check total weight doesn't exceed limit
  let totalAdjustment = 0;
  for (const delta of deltas) {
    totalAdjustment += delta.adjustment;
  }

  if (totalAdjustment < -1000) {
    errors.push('Total delta adjustments cannot reduce weights below 0');
  }
  if (totalAdjustment > 1000) {
    errors.push('Total delta adjustments cannot exceed 1000 additional points');
  }

  // Check individual metrics stay in valid range
  const adjusted = applyDeltas(canonicalWeights, deltas);
  for (const [metric, value] of Object.entries(adjusted)) {
    if (value < 0) {
      errors.push(`Metric ${metric} cannot have negative weight`);
    }
    if (value > 1000) {
      errors.push(`Metric ${metric} cannot exceed 1000 points`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get delta adjustments for a specific domain
 */
export function getDeltasForDomain(domain: string): WeightDelta[] {
  const preset = AXIOM_DELTA_PRESETS[domain as keyof typeof AXIOM_DELTA_PRESETS];
  if (!preset) {
    return [];
  }

  return preset.map((delta) => ({
    ...delta,
    appliedAt: new Date(),
    appliedBy: 'system',
    domain,
  }));
}

/**
 * Track weight merge operation
 */
export function recordWeightMerge(record: WeightMergeRecord): WeightMergeRecord {
  return {
    ...record,
    mergedAt: new Date(),
  };
}
