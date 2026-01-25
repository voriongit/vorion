/**
 * Phase 6: Trust Engine Hardening - Type Definitions
 * 
 * Core types for all 5 architecture decisions:
 * Q1: Ceiling Enforcement (Kernel-level)
 * Q2: Context Policy (Immutable at instantiation)
 * Q3: Role Gates (Dual-layer)
 * Q4: Weight Presets (Hybrid spec + deltas)
 * Q5: Creation Modifiers (Instantiation time)
 */

// ============================================================================
// Q1: CEILING ENFORCEMENT
// ============================================================================

/**
 * Trust event with dual logging (raw + clamped scores)
 * Enforces ceiling at kernel level, but logs both values for analytics
 */
export interface TrustEvent {
  agentId: string;
  timestamp: number;
  
  // Kernel computes raw score (may exceed 1000)
  rawScore: number;
  
  // Clamped to [0, 1000] for policy layer
  score: number;
  
  // Indicates if ceiling was applied
  ceilingApplied: boolean;
  
  // Original metrics used for computation
  metrics: TrustMetrics;
  
  // Audit trail
  computedBy: string;
  layer: 'kernel';
}

export interface TrustMetrics {
  successRatio: number;        // [0, 1] fraction of decisions that succeeded
  authorizationHistory: {
    attempted: number;
    allowed: number;
  };
  cascadingFailures: number;  // Count of downstream failures
  executionEfficiency: number; // [0, 1] resource efficiency
  behaviorStability: number;   // [0, 1] pattern consistency
  domainReputation: number;    // [0, 1] peer trust
}

// ============================================================================
// Q2: CONTEXT POLICY (Immutable at Instantiation)
// ============================================================================

export type ContextType = 'local' | 'enterprise' | 'sovereign';

/**
 * Agent context is immutable from instantiation
 * Cannot be changed after agent creation
 */
export interface AgentContextPolicy {
  readonly context: ContextType;
  readonly createdAt: number;
  readonly createdBy: string;
}

export const CONTEXT_CEILINGS: Record<ContextType, number> = {
  local: 700,        // T0-T4 max
  enterprise: 900,   // T0-T5 max
  sovereign: 1000,   // Full autonomy
};

// ============================================================================
// Q3: ROLE GATES (Dual-Layer)
// ============================================================================

export type RoleLevel = 'R-L0' | 'R-L1' | 'R-L2' | 'R-L3' | 'R-L4' | 'R-L5' | 'R-L6' | 'R-L7' | 'R-L8';
export type TrustTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

/**
 * Role+tier matrix: which combinations are valid?
 * Layer 0 (Kernel): Validates existence
 * Layer 4 (BASIS): Enforces policy
 */
export const ROLE_GATE_MATRIX: Record<RoleLevel, Record<TrustTier, boolean>> = {
  'R-L0': { T0: true, T1: false, T2: false, T3: false, T4: false, T5: false },
  'R-L1': { T0: true, T1: true, T2: false, T3: false, T4: false, T5: false },
  'R-L2': { T0: true, T1: true, T2: true, T3: false, T4: false, T5: false },
  'R-L3': { T0: true, T1: true, T2: true, T3: true, T4: false, T5: false },
  'R-L4': { T0: true, T1: true, T2: true, T3: true, T4: true, T5: false },
  'R-L5': { T0: true, T1: true, T2: true, T3: true, T4: true, T5: true },
  'R-L6': { T0: true, T1: true, T2: true, T3: true, T4: true, T5: true },
  'R-L7': { T0: true, T1: true, T2: true, T3: true, T4: true, T5: true },
  'R-L8': { T0: true, T1: true, T2: true, T3: true, T4: true, T5: true },
};

export interface RoleGateValidation {
  role: RoleLevel;
  tier: TrustTier;
  isValid: boolean;
  validatedAt: number;
  validationLayer: 'kernel' | 'basis';
}

// ============================================================================
// Q4: WEIGHT PRESETS (Hybrid: Spec + Deltas)
// ============================================================================

export interface TrustWeights {
  observabilityWeight: number;  // [0, 1]
  capabilityWeight: number;     // [0, 1]
  behaviorWeight: number;       // [0, 1]
  contextWeight: number;        // [0, 1]
}

export const CANONICAL_TRUST_PRESETS: Record<string, TrustWeights> = {
  high_confidence: {
    observabilityWeight: 0.30,
    capabilityWeight: 0.25,
    behaviorWeight: 0.30,
    contextWeight: 0.15,
  },
  governance_focus: {
    observabilityWeight: 0.40,
    capabilityWeight: 0.10,
    behaviorWeight: 0.30,
    contextWeight: 0.20,
  },
  capability_focus: {
    observabilityWeight: 0.20,
    capabilityWeight: 0.40,
    behaviorWeight: 0.25,
    contextWeight: 0.15,
  },
};

export type PresetDelta = Partial<TrustWeights>;

export interface PresetAudit {
  presetName: string;
  canonicalSource: '@vorionsys/aci-spec';
  deltas: Record<keyof TrustWeights, { from: number; to: number } | null>;
  appliedAt: number;
}

// ============================================================================
// Q5: CREATION MODIFIERS (Instantiation Time)
// ============================================================================

export type CreationType = 'fresh' | 'cloned' | 'evolved' | 'promoted' | 'imported';

export interface AgentCreationInfo {
  readonly type: CreationType;
  readonly parentId?: string;
  readonly createdAt: number;
  readonly creationHash: string; // Cryptographic proof
}

export const CREATION_TYPE_MODIFIERS: Record<CreationType, number> = {
  fresh: 0,        // T3 baseline
  cloned: -50,     // Inherit parent risk
  evolved: 25,     // Improvement from parent
  promoted: 50,    // Explicit elevation
  imported: -100,  // External, unvetted
};

export interface CreationModifierApplication {
  baselineScore: number;
  creationType: CreationType;
  modifier: number;
  finalScore: number;
  appliedAt: number;
}

export interface AgentMigrationEvent {
  type: 'agent_migration';
  sourceAgentId: string;
  targetAgentId: string;
  creationTypeChanged: {
    from: CreationType;
    to: CreationType;
  };
  reason: string;
  timestamp: number;
  migratedBy: string;
}

// ============================================================================
// EFFICIENCY METRIC (6th Trust Dimension)
// ============================================================================

export interface TrustEfficiencyMetric {
  successRatio: number;              // [0, 1] Success rate
  failureRatio: number;              // [0, 1] Failure rate
  authorizedDomainAttempts: number;  // Count of valid attempts
  cascadingFailures: number;         // Count of downstream failures prevented
  circuitBreakerTrips: number;       // Times circuit breaker was triggered
  scheduleOptimality: number;        // [0, 1] Peak load contribution
}

export function computeEfficiencyMetric(
  events: TrustEvent[],
  agentId: string
): TrustEfficiencyMetric {
  // Implementation in efficiency-metrics.ts
  throw new Error('Not implemented');
}

// ============================================================================
// VALIDATION & ERRORS
// ============================================================================

export class Phase6ValidationError extends Error {
  constructor(
    public decision: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5',
    message: string
  ) {
    super(`[${decision}] ${message}`);
    this.name = 'Phase6ValidationError';
  }
}

export function validateTrustScore(score: number): boolean {
  return score >= 0 && score <= 1000;
}

export function validateContextType(context: unknown): context is ContextType {
  return context === 'local' || context === 'enterprise' || context === 'sovereign';
}

export function validateCreationType(type: unknown): type is CreationType {
  return ['fresh', 'cloned', 'evolved', 'promoted', 'imported'].includes(String(type));
}

export function validateWeights(weights: TrustWeights): boolean {
  const sum = weights.observabilityWeight + weights.capabilityWeight + 
              weights.behaviorWeight + weights.contextWeight;
  return sum > 0.99 && sum < 1.01; // Allow floating point error
}
