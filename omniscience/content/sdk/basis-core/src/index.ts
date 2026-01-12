/**
 * @basis-protocol/core
 * Core types, constants, and utilities for the BASIS AI governance standard
 * 
 * BASIS = Behavioral AI Safety & Intelligence Standard
 * 
 * @packageDocumentation
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Utilities
export * from './utils';

// Re-export commonly used items at top level for convenience
export {
  getTierFromScore,
  calculateCompositeScore,
  createTrustScore,
  hasCapability,
  getAvailableCapabilities,
  getGovernancePath,
  shouldAutoApprove,
  requiresHumanReview,
  getTierEmoji,
  getTierDisplayName,
  formatTrustScore,
} from './utils';

export {
  BASIS_VERSION,
  TRUST_SCORE_MAX,
  TRUST_TIER_THRESHOLDS,
  CAPABILITY_DEFINITIONS,
  DEFAULT_CHAIN,
} from './constants';
