/**
 * @fileoverview Trust Configuration Presets for Vorion Native Agents
 * @module vorion/cognigate/trust-presets
 * 
 * This configuration defines trust scoring presets used when bootstrap
 * agents graduate to Vorion-Native mode. Based on ACI spec canonical
 * presets with Axiom-specific deltas (per Q4 decision).
 */

import type {
  TrustConfig,
  TrustPreset,
  WeightConfig,
  RoleGate,
  CapabilityGate,
  CreationType,
} from '@vorion/cognigate';

// =============================================================================
// ACI CANONICAL PRESETS (from @vorionsys/aci-spec)
// =============================================================================

/**
 * Canonical weight presets from ACI specification.
 * These are immutable reference values - do not modify.
 */
export const ACI_CANONICAL_PRESETS: Record<string, WeightConfig> = {
  /**
   * Default balanced preset
   * Use for general-purpose agents with no specific bias
   */
  default: {
    observability: 0.25,
    capability: 0.25,
    behavior: 0.25,
    context: 0.25,
  },
  
  /**
   * High confidence preset
   * Use for agents that need to build trust quickly through observable behavior
   */
  high_confidence: {
    observability: 0.30,
    capability: 0.25,
    behavior: 0.30,
    context: 0.15,
  },
  
  /**
   * Governance focus preset
   * Use for agents in regulatory or compliance-heavy environments
   */
  governance_focus: {
    observability: 0.30,
    capability: 0.20,
    behavior: 0.35,
    context: 0.15,
  },
  
  /**
   * Capability focus preset
   * Use for specialized agents where skill demonstration is primary
   */
  capability_focus: {
    observability: 0.20,
    capability: 0.40,
    behavior: 0.25,
    context: 0.15,
  },
  
  /**
   * Context-sensitive preset
   * Use for agents operating across multiple deployment contexts
   */
  context_sensitive: {
    observability: 0.20,
    capability: 0.20,
    behavior: 0.25,
    context: 0.35,
  },
};

// =============================================================================
// AXIOM DELTAS (Vorion-specific customizations)
// =============================================================================

/**
 * Axiom-specific deltas applied to canonical presets.
 * These override specific weights while maintaining ACI compatibility.
 */
export const AXIOM_DELTAS: Record<string, Partial<WeightConfig>> = {
  /**
   * Sentinel agents need higher observability for security decisions
   */
  sentinel_override: {
    observability: 0.35, // +0.05 from governance_focus
  },
  
  /**
   * Builder agents need proven capability
   */
  builder_override: {
    capability: 0.30, // +0.05 from high_confidence
  },
  
  /**
   * Architect agents need behavior history for decision quality
   */
  architect_override: {
    behavior: 0.35, // +0.05 from governance_focus
  },
};

/**
 * Merge canonical preset with Axiom delta
 */
export function createAxiomPreset(
  canonicalName: keyof typeof ACI_CANONICAL_PRESETS,
  deltaName?: keyof typeof AXIOM_DELTAS
): WeightConfig {
  const canonical = ACI_CANONICAL_PRESETS[canonicalName];
  if (!deltaName) return { ...canonical };
  
  const delta = AXIOM_DELTAS[deltaName];
  return { ...canonical, ...delta };
}

// =============================================================================
// CREATION TYPE MODIFIERS (per Q5 decision - Instantiation Time)
// =============================================================================

/**
 * Trust score modifiers applied at agent instantiation based on creation type.
 * These are immutable facts about agent origin.
 */
export const CREATION_MODIFIERS: Record<CreationType, number> = {
  fresh: 0,       // New agent, baseline trust
  cloned: -50,    // Inherited from parent, slight risk
  evolved: 25,    // Improved from parent, slight bonus
  promoted: 50,   // Explicitly elevated by governance
  imported: -100, // External, unvetted, maximum caution
};

// =============================================================================
// ROLE GATES (per Q3 decision - Dual Layer enforcement)
// =============================================================================

/**
 * Role definitions for bootstrap agents.
 * R-L levels indicate increasing authority/access.
 */
export const ROLE_DEFINITIONS: Record<string, RoleGate> = {
  'R-L1': {
    name: 'Observer',
    description: 'Read-only access, no modifications',
    allowedTiers: ['T1', 'T2', 'T3', 'T4', 'T5'],
    capabilities: ['read'],
  },
  'R-L2': {
    name: 'Chronicler',
    description: 'Documentation and logging',
    allowedTiers: ['T2', 'T3', 'T4', 'T5'],
    capabilities: ['read', 'write:docs', 'write:logs'],
  },
  'R-L3': {
    name: 'Contributor',
    description: 'Code and artifact creation',
    allowedTiers: ['T3', 'T4', 'T5'],
    capabilities: ['read', 'write:code', 'write:tests', 'execute:local'],
  },
  'R-L4': {
    name: 'Validator',
    description: 'Review and approval authority',
    allowedTiers: ['T4', 'T5'],
    capabilities: ['read', 'review', 'approve', 'block'],
  },
  'R-L5': {
    name: 'Operator',
    description: 'Deployment and infrastructure',
    allowedTiers: ['T5'],
    capabilities: ['read', 'deploy', 'configure', 'execute:production'],
  },
};

// =============================================================================
// TRUST TIER DEFINITIONS
// =============================================================================

/**
 * Trust tier boundaries and descriptions.
 * Based on Q1 decision - scores clamped to [0, 1000] at kernel level.
 */
export const TRUST_TIERS = {
  T0: { min: 0, max: 99, name: 'Quarantined', description: 'No autonomous operation' },
  T1: { min: 100, max: 299, name: 'Restricted', description: 'Minimal capabilities' },
  T2: { min: 300, max: 499, name: 'Monitored', description: 'Supervised operation' },
  T3: { min: 500, max: 699, name: 'Verified', description: 'Standard operation' },
  T4: { min: 700, max: 899, name: 'Trusted', description: 'Elevated privileges' },
  T5: { min: 900, max: 1000, name: 'Sovereign', description: 'Maximum autonomy' },
} as const;

/**
 * Baseline trust score for new agents (T3 midpoint)
 */
export const T3_BASELINE = 500;

// =============================================================================
// BOOTSTRAP AGENT TRUST CONFIGURATIONS
// =============================================================================

/**
 * Trust configuration for Architect agent when graduated to Native mode
 */
export const architectTrustConfig: TrustConfig = {
  agentId: 'vorion.native.architect',
  
  creation: {
    type: 'cloned',
    parentId: 'vorion.bootstrap.architect',
    modifier: CREATION_MODIFIERS.cloned,
  },
  
  initialScore: T3_BASELINE + CREATION_MODIFIERS.cloned, // 450
  targetTier: 'T3',
  
  context: 'enterprise', // Immutable per Q2
  
  roleGates: {
    role: 'R-L3',
    allowedTiers: ['T3', 'T4', 'T5'],
  },
  
  weights: createAxiomPreset('governance_focus', 'architect_override'),
  
  capabilities: {
    'architecture.review': { minTier: 'T3', rateLimit: 100 },
    'architecture.propose': { minTier: 'T3', rateLimit: 50 },
    'architecture.approve': { minTier: 'T4', rateLimit: 20 },
  },
};

/**
 * Trust configuration for Scribe agent when graduated to Native mode
 */
export const scribeTrustConfig: TrustConfig = {
  agentId: 'vorion.native.scribe',
  
  creation: {
    type: 'cloned',
    parentId: 'vorion.bootstrap.scribe',
    modifier: CREATION_MODIFIERS.cloned,
  },
  
  initialScore: T3_BASELINE + CREATION_MODIFIERS.cloned, // 450
  targetTier: 'T3',
  
  context: 'enterprise',
  
  roleGates: {
    role: 'R-L2',
    allowedTiers: ['T2', 'T3', 'T4', 'T5'],
  },
  
  weights: createAxiomPreset('high_confidence'),
  
  capabilities: {
    'docs.create': { minTier: 'T2', rateLimit: 200 },
    'docs.update': { minTier: 'T2', rateLimit: 500 },
    'changelog.update': { minTier: 'T3', rateLimit: 50 },
    'spec.create': { minTier: 'T3', rateLimit: 30 },
  },
};

/**
 * Trust configuration for Sentinel agent when graduated to Native mode
 * NOTE: Sentinel requires T4 to operate (elevated trust requirement)
 */
export const sentinelTrustConfig: TrustConfig = {
  agentId: 'vorion.native.sentinel',
  
  creation: {
    type: 'cloned',
    parentId: 'vorion.bootstrap.sentinel',
    modifier: CREATION_MODIFIERS.cloned,
  },
  
  initialScore: T3_BASELINE + CREATION_MODIFIERS.cloned, // 450
  targetTier: 'T4', // Must earn T4 before full operation
  
  context: 'enterprise',
  
  roleGates: {
    role: 'R-L4',
    allowedTiers: ['T4', 'T5'], // Strict requirement
  },
  
  weights: createAxiomPreset('governance_focus', 'sentinel_override'),
  
  capabilities: {
    'review.read': { minTier: 'T3', rateLimit: 500 },
    'review.comment': { minTier: 'T3', rateLimit: 200 },
    'review.approve': { minTier: 'T4', rateLimit: 50 },
    'review.block': { minTier: 'T4', rateLimit: 20 },
    'security.scan': { minTier: 'T4', rateLimit: 100 },
    'security.alert': { minTier: 'T4', rateLimit: 10 },
  },
};

/**
 * Trust configuration for Builder agent when graduated to Native mode
 */
export const builderTrustConfig: TrustConfig = {
  agentId: 'vorion.native.builder',
  
  creation: {
    type: 'cloned',
    parentId: 'vorion.bootstrap.builder',
    modifier: CREATION_MODIFIERS.cloned,
  },
  
  initialScore: T3_BASELINE + CREATION_MODIFIERS.cloned, // 450
  targetTier: 'T3',
  
  context: 'enterprise',
  
  roleGates: {
    role: 'R-L3',
    allowedTiers: ['T3', 'T4', 'T5'],
  },
  
  weights: createAxiomPreset('high_confidence', 'builder_override'),
  
  capabilities: {
    'code.read': { minTier: 'T2', rateLimit: 1000 },
    'code.write': { minTier: 'T3', rateLimit: 500 },
    'code.test': { minTier: 'T2', rateLimit: 500 },
    'git.branch': { minTier: 'T3', rateLimit: 50 },
    'git.commit': { minTier: 'T3', rateLimit: 200 },
    'git.push': { minTier: 'T3', rateLimit: 50 },
    'pr.create': { minTier: 'T3', rateLimit: 20 },
  },
};

/**
 * Trust configuration for Tester agent when graduated to Native mode
 */
export const testerTrustConfig: TrustConfig = {
  agentId: 'vorion.native.tester',
  
  creation: {
    type: 'cloned',
    parentId: 'vorion.bootstrap.tester',
    modifier: CREATION_MODIFIERS.cloned,
  },
  
  initialScore: T3_BASELINE + CREATION_MODIFIERS.cloned, // 450
  targetTier: 'T3',
  
  context: 'enterprise',
  
  roleGates: {
    role: 'R-L2',
    allowedTiers: ['T2', 'T3', 'T4', 'T5'],
  },
  
  weights: createAxiomPreset('high_confidence'),
  
  capabilities: {
    'test.read': { minTier: 'T2', rateLimit: 1000 },
    'test.write': { minTier: 'T3', rateLimit: 500 },
    'test.execute': { minTier: 'T2', rateLimit: 200 },
    'coverage.report': { minTier: 'T2', rateLimit: 100 },
  },
};

// =============================================================================
// EXPORT ALL CONFIGURATIONS
// =============================================================================

export const bootstrapAgentTrustConfigs = {
  architect: architectTrustConfig,
  scribe: scribeTrustConfig,
  sentinel: sentinelTrustConfig,
  builder: builderTrustConfig,
  tester: testerTrustConfig,
};

export default bootstrapAgentTrustConfigs;
