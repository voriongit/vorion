/**
 * A3I Trust Module
 *
 * Core trust scoring functionality including dimensions,
 * weights, and calculation.
 */

// Dimensions
export {
  INITIAL_DIMENSIONS,
  MIN_DIMENSION_SCORE,
  MAX_DIMENSION_SCORE,
  createDimensions,
  clampScore,
  validateDimensions,
  isValidDimensions,
  getMinDimension,
  getMaxDimension,
  getDimensionDelta,
  adjustDimensions,
  DIMENSION_DESCRIPTIONS,
} from './dimensions.js';

// Weights
export {
  DEFAULT_TRUST_WEIGHTS,
  createWeights,
  normalizeWeights,
  validateWeights,
  isValidWeights,
  weightsAreSummedCorrectly,
  WEIGHT_PRESETS,
  getWeightPreset,
  listWeightPresets,
} from './weights.js';

// Legacy calculator functions (for backwards compatibility)
export {
  type CalculationOptions,
  calculateCompositeScore,
  applyObservationCeiling,
  aggregateEvidence,
  calculateTrustProfile,
  recalculateProfile,
  applyDecay,
  createEvidence,
} from './calculator.js';

// TrustCalculator class (recommended)
export {
  TrustCalculator,
  createTrustCalculator,
  type TrustCalculatorConfig,
  type CalculateOptions,
  type AggregationResult,
} from './trust-calculator.js';

// Profile Store
export {
  type TrustProfileStore,
  type ProfileQueryOptions,
  type ProfileQueryFilter,
  type ProfileQueryResult,
  type ProfileHistoryEntry,
  InMemoryProfileStore,
  createInMemoryStore,
} from './profile-store.js';

// Profile Service
export {
  TrustProfileService,
  createProfileService,
  type ProfileServiceConfig,
  type CreateProfileOptions,
  type UpdateProfileOptions,
  type ProfileOperationResult,
} from './profile-service.js';

// Trust Dynamics (ATSF v2.0)
export {
  TrustDynamicsEngine,
  createTrustDynamicsEngine,
  type TrustUpdateResult,
  type TrustUpdateOptions,
} from './trust-dynamics.js';
