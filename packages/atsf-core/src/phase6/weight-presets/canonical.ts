/**
 * Q4: Weight Presets - Canonical Trust Weights
 * ACI specification canonical trust scoring weights
 *
 * The canonical weights define the baseline trust computation formula:
 * - Base weights from ACI spec (standardized across implementations)
 * - Immutable reference values
 * - Used as foundation for delta application
 *
 * Trust Score Computation:
 * score = (successRatio × 400) +
 *         (authorizationHistory × 200) +
 *         (cascadePreventionScore × 150) +
 *         (executionEfficiency × 150) +
 *         (behaviorStability × 100)
 *
 * Total weight: 1000 points
 */

/**
 * Success Ratio Weight (0-400 points)
 * Measures the fraction of decisions that succeeded without error
 * Formula: successCount / totalDecisions
 * Weight: 40% of total score
 */
export const WEIGHT_SUCCESS_RATIO = 400;

/**
 * Authorization History Weight (0-200 points)
 * Measures alignment between attempted and authorized actions
 * Penalizes agents that frequently attempt unauthorized actions
 * Formula: (authorizedCount / attemptedCount) × WEIGHT_AUTHORIZATION_HISTORY
 * Weight: 20% of total score
 */
export const WEIGHT_AUTHORIZATION_HISTORY = 200;

/**
 * Cascade Prevention Score Weight (0-150 points)
 * Measures how well an agent's errors are contained
 * Penalizes agents whose failures cause downstream cascades
 * Formula: 1 - (cascadeFailures / totalFailures) × WEIGHT_CASCADE_PREVENTION
 * Weight: 15% of total score
 */
export const WEIGHT_CASCADE_PREVENTION = 150;

/**
 * Execution Efficiency Weight (0-150 points)
 * Measures resource consumption vs. business value delivered
 * Penalizes agents that waste computational resources
 * Formula: (businessValuePerResource) / (maxValuePerResource) × WEIGHT_EXECUTION_EFFICIENCY
 * Weight: 15% of total score
 */
export const WEIGHT_EXECUTION_EFFICIENCY = 150;

/**
 * Behavior Stability Weight (0-100 points)
 * Measures consistency of agent behavior over time
 * Detects pattern drift which could indicate compromise
 * Formula: 1 - (patternDriftDistance) × WEIGHT_BEHAVIOR_STABILITY
 * Weight: 10% of total score
 */
export const WEIGHT_BEHAVIOR_STABILITY = 100;

/**
 * Canonical weights aggregated
 */
export const CANONICAL_TRUST_WEIGHTS = {
  successRatio: WEIGHT_SUCCESS_RATIO,
  authorizationHistory: WEIGHT_AUTHORIZATION_HISTORY,
  cascadePrevention: WEIGHT_CASCADE_PREVENTION,
  executionEfficiency: WEIGHT_EXECUTION_EFFICIENCY,
  behaviorStability: WEIGHT_BEHAVIOR_STABILITY,
} as const;

/**
 * Total weight sum (should always be 1000)
 */
export const TOTAL_TRUST_WEIGHT = Object.values(CANONICAL_TRUST_WEIGHTS).reduce(
  (sum, weight) => sum + weight,
  0
);

/**
 * Validate that canonical weights sum to 1000
 */
export function validateCanonicalWeights(): boolean {
  return TOTAL_TRUST_WEIGHT === 1000;
}

/**
 * Get normalized weight (0-1) for a metric
 */
export function getNormalizedWeight(metric: keyof typeof CANONICAL_TRUST_WEIGHTS): number {
  const weight = CANONICAL_TRUST_WEIGHTS[metric];
  return weight / TOTAL_TRUST_WEIGHT;
}

/**
 * Canonical weight reference with descriptions
 */
export interface CanonicalWeightMetric {
  name: string;
  weight: number;
  percentage: number;
  description: string;
}

/**
 * Get all canonical weight metrics with descriptions
 */
export function getCanonicalWeightMetrics(): CanonicalWeightMetric[] {
  return [
    {
      name: 'Success Ratio',
      weight: WEIGHT_SUCCESS_RATIO,
      percentage: (WEIGHT_SUCCESS_RATIO / TOTAL_TRUST_WEIGHT) * 100,
      description: 'Fraction of decisions that succeeded without error',
    },
    {
      name: 'Authorization History',
      weight: WEIGHT_AUTHORIZATION_HISTORY,
      percentage: (WEIGHT_AUTHORIZATION_HISTORY / TOTAL_TRUST_WEIGHT) * 100,
      description: 'Alignment between attempted and authorized actions',
    },
    {
      name: 'Cascade Prevention',
      weight: WEIGHT_CASCADE_PREVENTION,
      percentage: (WEIGHT_CASCADE_PREVENTION / TOTAL_TRUST_WEIGHT) * 100,
      description: 'How well agent errors are contained and prevented from cascading',
    },
    {
      name: 'Execution Efficiency',
      weight: WEIGHT_EXECUTION_EFFICIENCY,
      percentage: (WEIGHT_EXECUTION_EFFICIENCY / TOTAL_TRUST_WEIGHT) * 100,
      description: 'Resource consumption vs. business value delivered',
    },
    {
      name: 'Behavior Stability',
      weight: WEIGHT_BEHAVIOR_STABILITY,
      percentage: (WEIGHT_BEHAVIOR_STABILITY / TOTAL_TRUST_WEIGHT) * 100,
      description: 'Consistency of agent behavior over time (detects drift)',
    },
  ];
}
