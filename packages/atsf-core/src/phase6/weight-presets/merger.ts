/**
 * Q4: Weight Presets - Weight Merger
 * Combines canonical ACI weights with Axiom deltas to produce final trust weights
 *
 * Architecture:
 * - Deterministic merge process
 * - Audit trail of all weight decisions
 * - Supports multiple merge strategies
 * - Version tracking
 */

import {
  CANONICAL_TRUST_WEIGHTS,
  TOTAL_TRUST_WEIGHT,
  getCanonicalWeightMetrics,
} from './canonical.js';
import { applyDeltas, validateDeltaAdjustments, type WeightDelta } from './deltas.js';

/**
 * Merge strategy determines how weights are combined
 */
export type MergeStrategy = 'canonical' | 'deltaOverride' | 'blended';

/**
 * Final merged weights result
 */
export interface MergedTrustWeights {
  successRatio: number;
  authorizationHistory: number;
  cascadePrevention: number;
  executionEfficiency: number;
  behaviorStability: number;
}

/**
 * Weight computation audit record
 */
export interface WeightComputationAudit {
  timestamp: Date;
  agentId?: string;
  domain?: string;
  strategy: MergeStrategy;
  canonicalWeights: MergedTrustWeights;
  appliedDeltas: WeightDelta[];
  finalWeights: MergedTrustWeights;
  totalWeight: number;
  valid: boolean;
}

/**
 * Merge canonical weights with delta adjustments
 */
export function mergeWeights(
  deltas: WeightDelta[] = [],
  strategy: MergeStrategy = 'deltaOverride'
): MergedTrustWeights {
  const canonical = CANONICAL_TRUST_WEIGHTS;

  switch (strategy) {
    case 'canonical':
      // Ignore deltas, return canonical
      return { ...canonical };

    case 'deltaOverride':
      // Apply deltas directly as overrides
      {
        const adjusted = { ...canonical };
        for (const delta of deltas) {
          // Check expiration
          if (delta.expiresAt && new Date() > delta.expiresAt) {
            continue;
          }
          const metric = delta.metric as keyof MergedTrustWeights;
          adjusted[metric] = Math.max(0, adjusted[metric] + delta.adjustment);
        }
        return adjusted;
      }

    case 'blended':
      // Blend canonical and deltas proportionally
      {
        const adjusted = { ...canonical };
        const validDeltas = deltas.filter((d) => !d.expiresAt || new Date() <= d.expiresAt);

        if (validDeltas.length === 0) {
          return adjusted;
        }

        // Average the adjustments across all deltas
        const deltaMap: Record<string, number[]> = {};
        for (const delta of validDeltas) {
          const metric = delta.metric as keyof MergedTrustWeights;
          if (!deltaMap[metric]) {
            deltaMap[metric] = [];
          }
          deltaMap[metric].push(delta.adjustment);
        }

        // Apply averaged adjustments
        for (const [metric, adjustments] of Object.entries(deltaMap)) {
          const avgAdjustment = adjustments.reduce((a, b) => a + b, 0) / adjustments.length;
          adjusted[metric as keyof MergedTrustWeights] = Math.max(
            0,
            adjusted[metric as keyof MergedTrustWeights] + avgAdjustment
          );
        }

        return adjusted;
      }

    default:
      throw new Error(`Unknown merge strategy: ${strategy}`);
  }
}

/**
 * Merge weights and validate the result
 */
export function mergeAndValidateWeights(
  deltas: WeightDelta[] = [],
  strategy: MergeStrategy = 'deltaOverride'
): {
  weights: MergedTrustWeights;
  valid: boolean;
  errors: string[];
} {
  // Validate deltas first
  const canonicalRecord = CANONICAL_TRUST_WEIGHTS as Record<string, number>;
  const validation = validateDeltaAdjustments(canonicalRecord, deltas);

  if (!validation.valid) {
    return {
      weights: { ...CANONICAL_TRUST_WEIGHTS },
      valid: false,
      errors: validation.errors,
    };
  }

  // Merge weights
  const weights = mergeWeights(deltas, strategy);

  // Perform post-merge validation
  const errors: string[] = [];

  // Check all metrics are non-negative
  for (const [metric, value] of Object.entries(weights)) {
    if (value < 0) {
      errors.push(`${metric} is negative: ${value}`);
    }
  }

  return {
    weights,
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create an audit record for weight computation
 */
export function createWeightAuditRecord(
  canonicalWeights: MergedTrustWeights,
  appliedDeltas: WeightDelta[],
  finalWeights: MergedTrustWeights,
  strategy: MergeStrategy = 'deltaOverride',
  agentId?: string,
  domain?: string
): WeightComputationAudit {
  const totalWeight = Object.values(finalWeights).reduce((sum, w) => sum + w, 0);

  return {
    timestamp: new Date(),
    agentId,
    domain,
    strategy,
    canonicalWeights,
    appliedDeltas,
    finalWeights,
    totalWeight,
    valid: totalWeight >= 900 && totalWeight <= 1100, // Allow 10% variance
  };
}

/**
 * Compare canonical vs. merged weights to show impact of deltas
 */
export function compareWeights(
  finalWeights: MergedTrustWeights,
  canonicalWeights: MergedTrustWeights = CANONICAL_TRUST_WEIGHTS
): Record<string, { canonical: number; final: number; delta: number; percentChange: number }> {
  const comparison: Record<
    string,
    { canonical: number; final: number; delta: number; percentChange: number }
  > = {};

  for (const metric of Object.keys(canonicalWeights)) {
    const key = metric as keyof MergedTrustWeights;
    const can = canonicalWeights[key];
    const fin = finalWeights[key];
    const delta = fin - can;
    const percentChange = can !== 0 ? (delta / can) * 100 : 0;

    comparison[metric] = {
      canonical: can,
      final: fin,
      delta,
      percentChange,
    };
  }

  return comparison;
}

/**
 * Format weights for display
 */
export function formatWeightsForDisplay(weights: MergedTrustWeights): string {
  const metrics = getCanonicalWeightMetrics();
  const lines = ['Trust Weight Distribution:', ''];

  for (const metric of metrics) {
    const value = weights[metric.name.toLowerCase().replace(/ /g, '') as keyof MergedTrustWeights];
    if (value !== undefined) {
      const percentage = ((value / TOTAL_TRUST_WEIGHT) * 100).toFixed(1);
      lines.push(`${metric.name.padEnd(25)} ${value.toString().padEnd(4)} pts (${percentage}%)`);
    }
  }

  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  lines.push('');
  lines.push(`Total: ${total} points`);

  return lines.join('\n');
}

/**
 * Compute agent's final trust score using merged weights
 */
export function computeTrustScore(
  weights: MergedTrustWeights,
  metrics: {
    successRatio: number; // 0-1
    authorizationHistory: number; // 0-1
    cascadePrevention: number; // 0-1
    executionEfficiency: number; // 0-1
    behaviorStability: number; // 0-1
  }
): number {
  const score =
    metrics.successRatio * weights.successRatio +
    metrics.authorizationHistory * weights.authorizationHistory +
    metrics.cascadePrevention * weights.cascadePrevention +
    metrics.executionEfficiency * weights.executionEfficiency +
    metrics.behaviorStability * weights.behaviorStability;

  // Clamp to 0-1000
  return Math.max(0, Math.min(1000, Math.round(score)));
}
