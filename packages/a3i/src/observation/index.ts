/**
 * A3I Observation Module
 *
 * Observation tiers, trust ceilings, and attestation
 * for determining maximum trustworthiness based on
 * what can actually be inspected.
 */

// Tiers
export {
  ObservationTier,
  OBSERVATION_CEILINGS,
  ModelAccessType,
  ComponentType,
  MODEL_ACCESS_TIERS,
  getObservationTierForAccess,
  getTrustCeiling,
  allowsFullTrust,
  isHardwareAttested,
  canInspectSource,
  getTierDescription,
  compareTiers,
  getLowestTier,
  TIER_DESCRIPTIONS,
} from './tiers.js';

// Ceilings
export {
  applyCeiling,
  getCeilingLoss,
  isAtCeiling,
  getRoomForImprovement,
  requiredTierForScore,
  analyzeCeilingImpact,
  formatCeilingInfo,
  type CeilingAnalysis,
} from './ceilings.js';

// Attestation
export {
  AttestationType,
  HARDWARE_ATTESTATION_TYPES,
  getObservationTierForAttestation,
  createAttestationEvidence,
  isHardwareBacked,
  verifyAttestation,
  computeHash,
  type AttestationEvidence,
  type AttestationVerificationResult,
} from './attestation.js';
