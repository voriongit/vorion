/**
 * Phase 6: Trust Engine Hardening
 *
 * Implements 5 architecture decisions for production-grade trust management:
 *
 * Q1: Ceiling Enforcement (Hybrid Dual-Layer + Regulatory Observability)
 * - Kernel layer: Structure validation (cannot bypass)
 * - Policy layer: Authorization via governance rules
 * - Regulatory layer: Gaming detection and compliance audit
 *
 * Q2: Hierarchical Context (4-Tier with Tiered Immutability)
 * - Deployment: IMMUTABLE (set at deployment time)
 * - Organizational: LOCKED POST-STARTUP (configurable, then frozen)
 * - Agent: FROZEN AT CREATION (set when agent instantiated)
 * - Operation: EPHEMERAL (per-request, auto-expires)
 *
 * Q3: Stratified Role Gates (3-Layer Enforcement)
 * - Kernel: Pre-computed matrix validation
 * - Policy: Authorization via policy-as-code
 * - BASIS/ENFORCE: Runtime context with dual-control override
 *
 * Q4: Federated Weight Presets (3-Tier with Derivation Chains)
 * - ACI Canonical: Immutable, spec-defined
 * - Vorion Reference: Platform defaults
 * - Axiom Deployment: Org-specific derivations
 *
 * Q5: Provenance Capture + Policy Interpretation
 * - AgentProvenance: IMMUTABLE origin record
 * - CreationModifierPolicy: MUTABLE interpretation rules
 * - ModifierEvaluationRecord: Audit trail
 *
 * Critical Path: Q2 → Q4 → Q5 → Q1 → Q3
 *
 * @packageDocumentation
 */

// =============================================================================
// TYPES
// =============================================================================

export * from './types.js';

// =============================================================================
// Q2: HIERARCHICAL CONTEXT
// =============================================================================

export {
  // Creation functions
  createDeploymentContext,
  createOrganizationalContext,
  createAgentContext,
  createOperationContext,

  // Builders
  OrganizationalContextBuilder,

  // Verification
  verifyDeploymentContext,
  verifyOrganizationalContext,
  verifyAgentContext,
  validateContextChain,

  // Utilities
  getAgentContextCeiling,
  isOperationExpired,
  getOperationCeiling,

  // Service
  ContextService,
  createContextService,

  // Input types
  type CreateDeploymentContextInput,
  type CreateOrganizationalContextInput,
  type CreateAgentContextInput,
  type CreateOperationContextInput,
} from './context.js';

// =============================================================================
// Q4: FEDERATED WEIGHT PRESETS
// =============================================================================

export {
  // ACI Canonical
  getACIPreset,
  getAllACIPresets,
  verifyACIPreset,

  // Derivation
  derivePreset,
  createVorionPreset,
  createAxiomPreset,

  // Lineage
  buildPresetLineage,
  verifyPresetLineage,
  markLineageVerified,

  // Weight utilities
  normalizeWeights,
  validateWeights,
  calculateWeightsDelta,
  applyWeightsDelta,

  // Service
  PresetService,
  createPresetService,
  initializeVorionPresets,

  // Input types
  type DerivePresetInput,
} from './presets.js';

// =============================================================================
// Q5: PROVENANCE + POLICY MODIFIERS
// =============================================================================

export {
  // Provenance
  createProvenance,
  verifyProvenance,

  // Modifier policies
  createModifierPolicy,
  updateModifierPolicy,
  DEFAULT_CREATION_MODIFIERS,

  // Evaluation
  evaluateModifier,

  // Service
  ProvenanceService,
  createProvenanceService,
  initializeDefaultPolicies,

  // Input types
  type CreateProvenanceInput,
  type CreateModifierPolicyInput,
  type ModifierEvaluationContext,
} from './provenance.js';

// =============================================================================
// Q1: CEILING ENFORCEMENT
// =============================================================================

export {
  // Ceiling calculation
  calculateEffectiveCeiling,

  // Layer enforcement
  enforceKernelCeiling,
  enforcePolicyCeiling,

  // Gaming detection
  detectGamingIndicators,
  getRetentionRequirements,
  GAMING_DETECTION_THRESHOLDS,

  // Event creation
  createTrustComputationEvent,
  createRegulatoryAuditEntry,

  // Service
  CeilingEnforcementService,
  createCeilingEnforcementService,

  // Types
  type CeilingContext,
  type KernelValidationResult,
  type PolicyContext,
  type PolicyValidationResult,
} from './ceiling.js';

// =============================================================================
// Q3: STRATIFIED ROLE GATES
// =============================================================================

export {
  // Matrix access
  getRoleGateMatrix,
  getMinimumTierForRole,

  // Layer evaluation
  evaluateKernelLayer,
  evaluatePolicyLayer,
  evaluateBasisLayer,

  // Full evaluation
  evaluateRoleGate,

  // Default policy
  createDefaultRoleGatePolicy,

  // Service
  RoleGateService,
  createRoleGateService,

  // Types
  type KernelLayerResult,
  type PolicyLayerResult,
  type BasisLayerResult,
  type PolicyEvaluationContext,
  type BasisLayerContext,
  type OverrideRequest,
} from './role-gates.js';

// =============================================================================
// CONVENIENCE FACTORY
// =============================================================================

import { ContextService, createContextService } from './context.js';
import { PresetService, createPresetService, initializeVorionPresets } from './presets.js';
import { ProvenanceService, createProvenanceService, initializeDefaultPolicies } from './provenance.js';
import { CeilingEnforcementService, createCeilingEnforcementService } from './ceiling.js';
import { RoleGateService, createRoleGateService } from './role-gates.js';
import { RegulatoryFramework } from './types.js';

/**
 * Phase 6 Trust Engine - unified access to all services
 */
export interface Phase6TrustEngine {
  context: ContextService;
  presets: PresetService;
  provenance: ProvenanceService;
  ceiling: CeilingEnforcementService;
  roleGates: RoleGateService;
}

/**
 * Configuration for Phase 6 Trust Engine
 */
export interface Phase6Config {
  regulatoryFramework?: RegulatoryFramework;
  initializeDefaults?: boolean;
}

/**
 * Create a fully initialized Phase 6 Trust Engine
 */
export async function createPhase6TrustEngine(
  config: Phase6Config = {}
): Promise<Phase6TrustEngine> {
  const {
    regulatoryFramework = RegulatoryFramework.NONE,
    initializeDefaults = true,
  } = config;

  // Create services
  const context = createContextService();
  const presets = createPresetService();
  const provenance = createProvenanceService();
  const ceiling = createCeilingEnforcementService(regulatoryFramework);
  const roleGates = createRoleGateService();

  // Initialize defaults if requested
  if (initializeDefaults) {
    await initializeVorionPresets(presets);
    await initializeDefaultPolicies(provenance);
    await roleGates.initialize('system');
  }

  return {
    context,
    presets,
    provenance,
    ceiling,
    roleGates,
  };
}

/**
 * Phase 6 version information
 */
export const PHASE6_VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
  label: 'phase6-trust-engine',
  decisions: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
};
