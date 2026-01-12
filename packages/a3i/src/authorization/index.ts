/**
 * A3I Authorization Module
 *
 * Core authorization functionality including the authorization engine,
 * constraint generation, and decision building.
 */

// Constraints
export {
  generateConstraints,
  constraintsPermit,
  mergeConstraints,
  BAND_CONSTRAINT_PRESETS,
  DEFAULT_APPROVAL_POLICIES,
  type ConstraintPreset,
  type ApprovalPolicy,
  type ConstraintGenerationOptions,
} from './constraints.js';

// Decision building
export {
  buildPermitDecision,
  buildDenyDecision,
  getRemediations,
  determineDenialReason,
  summarizeDecision,
  isDecisionValid,
  DecisionBuilder,
  type DecisionBuildOptions,
  type PermitResult,
  type DenyResult,
  type AuthorizationResult,
} from './decision.js';

// Authorization Engine
export {
  AuthorizationEngine,
  createAuthorizationEngine,
  ACTION_TYPE_REQUIREMENTS,
  DATA_SENSITIVITY_REQUIREMENTS,
  REVERSIBILITY_ADJUSTMENTS,
  noopProofLogger,
  type AuthorizationEngineConfig,
  type AuthorizeRequest,
  type ProofPlaneLogger,
} from './engine.js';
