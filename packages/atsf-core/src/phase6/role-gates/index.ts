/**
 * Q3: Role Gates
 * Dual-layer validation: kernel fast-path + BASIS policy engine
 */

export {
  AgentRole,
  TrustTier,
  ROLE_GATE_MATRIX,
  validateRoleAndTier,
  isValidRole,
  isValidTier,
  getMaxTierForRole,
  getMinRoleForTier,
  RoleGateValidationError,
} from './kernel.js';

export {
  BasisPolicyEngine,
  type PolicyRule,
  type PolicyException,
  type PolicyDecision,
  type PolicyAuditEntry,
} from './policy.js';
