/**
 * Q4: Weight Presets
 * Hybrid weight system: canonical ACI weights + Axiom domain deltas
 */

export {
  WEIGHT_SUCCESS_RATIO,
  WEIGHT_AUTHORIZATION_HISTORY,
  WEIGHT_CASCADE_PREVENTION,
  WEIGHT_EXECUTION_EFFICIENCY,
  WEIGHT_BEHAVIOR_STABILITY,
  CANONICAL_TRUST_WEIGHTS,
  TOTAL_TRUST_WEIGHT,
  validateCanonicalWeights,
  getNormalizedWeight,
  getCanonicalWeightMetrics,
  type CanonicalWeightMetric,
} from './canonical.js';

export {
  AXIOM_DELTA_PRESETS,
  applyDelta,
  applyDeltas,
  validateDeltaAdjustments,
  getDeltasForDomain,
  recordWeightMerge,
  type WeightDelta,
  type WeightAdjustmentDirection,
  type WeightMergeRecord,
} from './deltas.js';

export {
  mergeWeights,
  mergeAndValidateWeights,
  createWeightAuditRecord,
  compareWeights,
  formatWeightsForDisplay,
  computeTrustScore,
  type MergeStrategy,
  type MergedTrustWeights,
  type WeightComputationAudit,
} from './merger.js';
