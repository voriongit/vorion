/**
 * @fileoverview Effective Permission Calculation
 *
 * Provides types and functions for calculating effective permissions based on
 * multiple inputs including certification tier, competence level, runtime tier,
 * observability ceiling, and context policy ceiling.
 *
 * The effective permission is the minimum of all applicable ceilings, ensuring
 * that agents can never exceed the most restrictive constraint in any dimension.
 *
 * @module @vorion/contracts/aci/effective-permission
 */

import { z } from 'zod';
import { CapabilityLevel, capabilityLevelSchema } from './levels.js';
import {
  CertificationTier,
  certificationTierSchema,
  RuntimeTier,
  runtimeTierSchema,
  CERTIFICATION_TIER_CONFIGS,
} from './tiers.js';

// ============================================================================
// Effective Permission Context
// ============================================================================

/**
 * Context for calculating effective permissions.
 *
 * This combines all factors that influence what an agent is permitted to do:
 * - certificationTier: External attestation status
 * - competenceLevel: Agent's declared capability level
 * - runtimeTier: Deployment-specific autonomy level
 * - observabilityCeiling: Maximum level based on observability requirements
 * - contextPolicyCeiling: Maximum level based on current context policy
 */
export interface EffectivePermissionContext {
  /** ACI certification tier (external attestation status) */
  certificationTier: CertificationTier;
  /** Agent's competence/capability level */
  competenceLevel: CapabilityLevel;
  /** Vorion runtime tier (deployment autonomy) */
  runtimeTier: RuntimeTier;
  /** Maximum level based on observability requirements (0-5) */
  observabilityCeiling: number;
  /** Maximum level based on context policy (0-5) */
  contextPolicyCeiling: number;
}

/**
 * Zod schema for EffectivePermissionContext.
 */
export const effectivePermissionContextSchema = z.object({
  certificationTier: certificationTierSchema,
  competenceLevel: capabilityLevelSchema,
  runtimeTier: runtimeTierSchema,
  observabilityCeiling: z.number().int().min(0).max(5),
  contextPolicyCeiling: z.number().int().min(0).max(5),
});

// ============================================================================
// Effective Permission Result
// ============================================================================

/**
 * Result of effective permission calculation.
 */
export interface EffectivePermission {
  /** The effective permission level (minimum of all ceilings) */
  level: CapabilityLevel;
  /** Whether the effective level was constrained */
  constrained: boolean;
  /** The factor that caused the constraint (if constrained) */
  constrainingFactor?: ConstrainingFactor;
  /** Details about each ceiling that was applied */
  ceilings: PermissionCeilings;
  /** Recommendations for increasing effective permission */
  recommendations?: string[];
}

/**
 * Factors that can constrain effective permission.
 */
export type ConstrainingFactor =
  | 'certification_tier'
  | 'competence_level'
  | 'runtime_tier'
  | 'observability_ceiling'
  | 'context_policy_ceiling'
  | 'multiple';

/**
 * Individual ceiling values applied to permission calculation.
 */
export interface PermissionCeilings {
  /** Ceiling from certification tier */
  certificationCeiling: CapabilityLevel;
  /** Ceiling from competence level */
  competenceCeiling: CapabilityLevel;
  /** Ceiling from runtime tier */
  runtimeCeiling: CapabilityLevel;
  /** Ceiling from observability requirements */
  observabilityCeiling: CapabilityLevel;
  /** Ceiling from context policy */
  contextPolicyCeiling: CapabilityLevel;
}

/**
 * Zod schema for ConstrainingFactor.
 */
export const constrainingFactorSchema = z.enum([
  'certification_tier',
  'competence_level',
  'runtime_tier',
  'observability_ceiling',
  'context_policy_ceiling',
  'multiple',
]);

/**
 * Zod schema for PermissionCeilings.
 */
export const permissionCeilingsSchema = z.object({
  certificationCeiling: capabilityLevelSchema,
  competenceCeiling: capabilityLevelSchema,
  runtimeCeiling: capabilityLevelSchema,
  observabilityCeiling: capabilityLevelSchema,
  contextPolicyCeiling: capabilityLevelSchema,
});

/**
 * Zod schema for EffectivePermission.
 */
export const effectivePermissionSchema = z.object({
  level: capabilityLevelSchema,
  constrained: z.boolean(),
  constrainingFactor: constrainingFactorSchema.optional(),
  ceilings: permissionCeilingsSchema,
  recommendations: z.array(z.string()).optional(),
});

// ============================================================================
// Permission Calculation
// ============================================================================

/**
 * Maps certification tier to maximum capability level.
 */
function certificationTierToCeiling(tier: CertificationTier): CapabilityLevel {
  return CERTIFICATION_TIER_CONFIGS[tier].maxCapabilityLevel as CapabilityLevel;
}

/**
 * Maps runtime tier to maximum capability level.
 */
function runtimeTierToCeiling(tier: RuntimeTier): CapabilityLevel {
  // Runtime tier mapping to capability levels:
  // T0 (Sandbox) -> L0 (Observe only)
  // T1 (Supervised) -> L1 (Advise only)
  // T2 (Constrained) -> L2 (Draft)
  // T3 (Trusted) -> L3 (Execute)
  // T4 (Autonomous) -> L4 (Autonomous)
  // T5 (Sovereign) -> L5 (Sovereign)
  return tier as unknown as CapabilityLevel;
}

/**
 * Calculates the effective permission from the context.
 *
 * The effective permission is the minimum of all applicable ceilings:
 * - Certification tier ceiling
 * - Competence level (agent's declared capability)
 * - Runtime tier ceiling
 * - Observability ceiling
 * - Context policy ceiling
 *
 * @param ctx - Permission context
 * @returns Effective permission result
 *
 * @example
 * ```typescript
 * const result = calculateEffectivePermission({
 *   certificationTier: CertificationTier.T3_CERTIFIED,
 *   competenceLevel: CapabilityLevel.L4_AUTONOMOUS,
 *   runtimeTier: RuntimeTier.T3_TRUSTED,
 *   observabilityCeiling: 4,
 *   contextPolicyCeiling: 3,
 * });
 * // result.level === CapabilityLevel.L3_EXECUTE
 * // result.constrained === true
 * // result.constrainingFactor === 'context_policy_ceiling'
 * ```
 */
export function calculateEffectivePermission(
  ctx: EffectivePermissionContext
): EffectivePermission {
  // Calculate individual ceilings
  const certificationCeiling = certificationTierToCeiling(ctx.certificationTier);
  const competenceCeiling = ctx.competenceLevel;
  const runtimeCeiling = runtimeTierToCeiling(ctx.runtimeTier);
  const observabilityCeiling = Math.min(5, Math.max(0, ctx.observabilityCeiling)) as CapabilityLevel;
  const contextPolicyCeiling = Math.min(5, Math.max(0, ctx.contextPolicyCeiling)) as CapabilityLevel;

  const ceilings: PermissionCeilings = {
    certificationCeiling,
    competenceCeiling,
    runtimeCeiling,
    observabilityCeiling,
    contextPolicyCeiling,
  };

  // Find the minimum ceiling
  const allCeilings = [
    { factor: 'certification_tier' as const, level: certificationCeiling },
    { factor: 'competence_level' as const, level: competenceCeiling },
    { factor: 'runtime_tier' as const, level: runtimeCeiling },
    { factor: 'observability_ceiling' as const, level: observabilityCeiling },
    { factor: 'context_policy_ceiling' as const, level: contextPolicyCeiling },
  ];

  const minCeilingLevel = Math.min(...allCeilings.map((c) => c.level)) as CapabilityLevel;
  const constrainingFactors = allCeilings.filter((c) => c.level === minCeilingLevel);

  // Determine if constrained and by what
  const maxPossibleLevel = Math.max(
    certificationCeiling,
    competenceCeiling,
    runtimeCeiling,
    observabilityCeiling,
    contextPolicyCeiling
  );
  const constrained = minCeilingLevel < maxPossibleLevel;

  let constrainingFactor: ConstrainingFactor | undefined;
  if (constrained) {
    constrainingFactor = constrainingFactors.length > 1
      ? 'multiple'
      : constrainingFactors[0]!.factor;
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (constrained) {
    for (const cf of constrainingFactors) {
      switch (cf.factor) {
        case 'certification_tier':
          recommendations.push(
            `Increase certification tier from ${ctx.certificationTier} to unlock higher capability levels`
          );
          break;
        case 'runtime_tier':
          recommendations.push(
            `Request higher runtime tier from T${ctx.runtimeTier} to enable more autonomy`
          );
          break;
        case 'observability_ceiling':
          recommendations.push(
            'Improve observability instrumentation to raise the observability ceiling'
          );
          break;
        case 'context_policy_ceiling':
          recommendations.push(
            'Request policy exception or operate in a context with higher policy ceiling'
          );
          break;
        case 'competence_level':
          recommendations.push(
            'This is the declared competence level of the agent'
          );
          break;
      }
    }
  }

  return {
    level: minCeilingLevel,
    constrained,
    constrainingFactor,
    ceilings,
    recommendations: recommendations.length > 0 ? recommendations : undefined,
  };
}

// ============================================================================
// Permission Checking
// ============================================================================

/**
 * Checks if an effective permission allows a specific capability level.
 *
 * @param permission - Effective permission
 * @param requiredLevel - Required capability level
 * @returns True if the permission allows the required level
 */
export function permissionAllowsLevel(
  permission: EffectivePermission,
  requiredLevel: CapabilityLevel
): boolean {
  return permission.level >= requiredLevel;
}

/**
 * Checks if a context allows a specific capability level.
 *
 * @param ctx - Permission context
 * @param requiredLevel - Required capability level
 * @returns True if the context allows the required level
 */
export function contextAllowsLevel(
  ctx: EffectivePermissionContext,
  requiredLevel: CapabilityLevel
): boolean {
  const permission = calculateEffectivePermission(ctx);
  return permissionAllowsLevel(permission, requiredLevel);
}

/**
 * Result of a permission check with detailed information.
 */
export interface PermissionCheckResult {
  /** Whether the requested level is allowed */
  allowed: boolean;
  /** The effective permission level */
  effectiveLevel: CapabilityLevel;
  /** The requested level */
  requestedLevel: CapabilityLevel;
  /** Gap between requested and effective (0 if allowed) */
  levelGap: number;
  /** Full effective permission details */
  permission: EffectivePermission;
}

/**
 * Performs a detailed permission check.
 *
 * @param ctx - Permission context
 * @param requiredLevel - Required capability level
 * @returns Detailed permission check result
 */
export function checkPermission(
  ctx: EffectivePermissionContext,
  requiredLevel: CapabilityLevel
): PermissionCheckResult {
  const permission = calculateEffectivePermission(ctx);

  return {
    allowed: permission.level >= requiredLevel,
    effectiveLevel: permission.level,
    requestedLevel: requiredLevel,
    levelGap: Math.max(0, requiredLevel - permission.level),
    permission,
  };
}

/**
 * Zod schema for PermissionCheckResult.
 */
export const permissionCheckResultSchema = z.object({
  allowed: z.boolean(),
  effectiveLevel: capabilityLevelSchema,
  requestedLevel: capabilityLevelSchema,
  levelGap: z.number().int().min(0),
  permission: effectivePermissionSchema,
});

// ============================================================================
// Permission Modification
// ============================================================================

/**
 * Creates a new context with a modified ceiling.
 *
 * @param ctx - Original context
 * @param factor - Factor to modify
 * @param newValue - New value for the factor
 * @returns New context with modified value
 */
export function modifyContextCeiling(
  ctx: EffectivePermissionContext,
  factor: Exclude<ConstrainingFactor, 'multiple'>,
  newValue: number
): EffectivePermissionContext {
  const newCtx = { ...ctx };

  switch (factor) {
    case 'certification_tier':
      newCtx.certificationTier = Math.min(5, Math.max(0, newValue)) as CertificationTier;
      break;
    case 'competence_level':
      newCtx.competenceLevel = Math.min(5, Math.max(0, newValue)) as CapabilityLevel;
      break;
    case 'runtime_tier':
      newCtx.runtimeTier = Math.min(5, Math.max(0, newValue)) as RuntimeTier;
      break;
    case 'observability_ceiling':
      newCtx.observabilityCeiling = Math.min(5, Math.max(0, newValue));
      break;
    case 'context_policy_ceiling':
      newCtx.contextPolicyCeiling = Math.min(5, Math.max(0, newValue));
      break;
  }

  return newCtx;
}

/**
 * Calculates what context changes would be needed to achieve a target level.
 *
 * @param ctx - Current context
 * @param targetLevel - Desired capability level
 * @returns Map of factors to required values
 */
export function calculateRequiredChanges(
  ctx: EffectivePermissionContext,
  targetLevel: CapabilityLevel
): Map<Exclude<ConstrainingFactor, 'multiple'>, number> {
  const changes = new Map<Exclude<ConstrainingFactor, 'multiple'>, number>();
  const permission = calculateEffectivePermission(ctx);

  if (permission.level >= targetLevel) {
    return changes; // No changes needed
  }

  // Check each factor and determine if it needs to increase
  const certificationCeiling = permission.ceilings.certificationCeiling;
  if (certificationCeiling < targetLevel) {
    // Need higher certification tier
    for (let tier = ctx.certificationTier + 1; tier <= 5; tier++) {
      if (certificationTierToCeiling(tier as CertificationTier) >= targetLevel) {
        changes.set('certification_tier', tier);
        break;
      }
    }
  }

  if (permission.ceilings.competenceCeiling < targetLevel) {
    changes.set('competence_level', targetLevel);
  }

  if (permission.ceilings.runtimeCeiling < targetLevel) {
    changes.set('runtime_tier', targetLevel);
  }

  if (permission.ceilings.observabilityCeiling < targetLevel) {
    changes.set('observability_ceiling', targetLevel);
  }

  if (permission.ceilings.contextPolicyCeiling < targetLevel) {
    changes.set('context_policy_ceiling', targetLevel);
  }

  return changes;
}

// ============================================================================
// Default Context
// ============================================================================

/**
 * Creates a default permission context.
 *
 * @param overrides - Optional overrides
 * @returns Default context with any overrides applied
 */
export function createDefaultContext(
  overrides?: Partial<EffectivePermissionContext>
): EffectivePermissionContext {
  return {
    certificationTier: CertificationTier.T0_UNVERIFIED,
    competenceLevel: CapabilityLevel.L0_OBSERVE,
    runtimeTier: RuntimeTier.T0_SANDBOX,
    observabilityCeiling: 5,
    contextPolicyCeiling: 5,
    ...overrides,
  };
}

/**
 * Creates a maximally permissive context.
 *
 * @returns Context with all ceilings at maximum
 */
export function createMaxPermissionContext(): EffectivePermissionContext {
  return {
    certificationTier: CertificationTier.T5_SOVEREIGN,
    competenceLevel: CapabilityLevel.L5_SOVEREIGN,
    runtimeTier: RuntimeTier.T5_SOVEREIGN,
    observabilityCeiling: 5,
    contextPolicyCeiling: 5,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for EffectivePermissionContext.
 */
export function isEffectivePermissionContext(
  value: unknown
): value is EffectivePermissionContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    'certificationTier' in value &&
    'competenceLevel' in value &&
    'runtimeTier' in value &&
    'observabilityCeiling' in value &&
    'contextPolicyCeiling' in value
  );
}

/**
 * Type guard for EffectivePermission.
 */
export function isEffectivePermission(value: unknown): value is EffectivePermission {
  return (
    typeof value === 'object' &&
    value !== null &&
    'level' in value &&
    'constrained' in value &&
    'ceilings' in value
  );
}
