/**
 * Deployment Context
 *
 * Context dimension sets policy constraints per deployment environment.
 * Different deployment contexts have different risk profiles and
 * regulatory requirements that limit maximum trust levels.
 *
 * The context ceiling is a deployment-specific policy that cannot be
 * exceeded regardless of certification or behavioral trust.
 *
 * @packageDocumentation
 */

import type { TrustScore } from '../common/types.js';
import { createLogger } from '../common/logger.js';
import { z } from 'zod';

const logger = createLogger({ component: 'deployment-context' });

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Runtime tier type (T0-T5)
 */
export type RuntimeTier = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Deployment Context Enum
 *
 * Defines the deployment environments with their trust policy constraints.
 */
export enum DeploymentContext {
  /**
   * C_LOCAL: Developer machine
   * - Personal development environment
   * - No policy restrictions
   * - Maximum trust: T5 (no limit)
   */
  C_LOCAL = 'local',

  /**
   * C_TEAM: Team environment
   * - Shared team development/staging
   * - Standard security policies
   * - Maximum trust: T4
   */
  C_TEAM = 'team',

  /**
   * C_ENTERPRISE: Enterprise SaaS
   * - Production enterprise deployment
   * - Corporate security policies
   * - Maximum trust: T4
   */
  C_ENTERPRISE = 'enterprise',

  /**
   * C_REGULATED: Regulated industry
   * - Financial, healthcare, etc.
   * - Strict compliance requirements
   * - Maximum trust: T3 (without human approval)
   * - Requires human-in-the-loop for higher actions
   */
  C_REGULATED = 'regulated',

  /**
   * C_SOVEREIGN: Government/defense
   * - Government or military deployments
   * - Highest security requirements
   * - Maximum trust: T4 (with hardware attestation)
   * - Requires attestation for trusted operations
   */
  C_SOVEREIGN = 'sovereign',
}

/**
 * Context ceiling configuration
 */
export interface ContextCeiling {
  /** Maximum tier allowed in this context */
  maxTier: RuntimeTier;
  /** Maximum score allowed */
  maxScore: number;
  /** Whether human approval is required for actions above base tier */
  requiresHuman?: boolean;
  /** Tier at which human approval becomes required */
  humanRequiredAboveTier?: RuntimeTier;
  /** Whether hardware attestation is required */
  requiresAttestation?: boolean;
  /** Human-readable description */
  description: string;
}

/**
 * Context policy evaluation result
 */
export interface ContextPolicyResult {
  /** Whether the action is allowed under context policy */
  allowed: boolean;
  /** Effective maximum tier after policy */
  maxTier: RuntimeTier;
  /** Maximum score after policy */
  maxScore: number;
  /** Whether human approval is needed */
  humanApprovalRequired: boolean;
  /** Whether attestation is needed */
  attestationRequired: boolean;
  /** Reason for any restrictions */
  reason?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Context ceiling definitions
 *
 * Maps each deployment context to its trust policy constraints.
 */
export const CONTEXT_CEILINGS: Record<DeploymentContext, ContextCeiling> = {
  [DeploymentContext.C_LOCAL]: {
    maxTier: 5,
    maxScore: 1000,
    description: 'Local development - no restrictions',
  },
  [DeploymentContext.C_TEAM]: {
    maxTier: 4,
    maxScore: 899,
    description: 'Team environment - autonomous operations allowed',
  },
  [DeploymentContext.C_ENTERPRISE]: {
    maxTier: 4,
    maxScore: 899,
    description: 'Enterprise SaaS - standard corporate policies',
  },
  [DeploymentContext.C_REGULATED]: {
    maxTier: 3,
    maxScore: 799,
    requiresHuman: true,
    humanRequiredAboveTier: 3,
    description: 'Regulated industry - human approval for autonomous actions',
  },
  [DeploymentContext.C_SOVEREIGN]: {
    maxTier: 4,
    maxScore: 899,
    requiresAttestation: true,
    description: 'Sovereign - hardware attestation required for trust',
  },
};

/**
 * Context names for display
 */
export const CONTEXT_NAMES: Record<DeploymentContext, string> = {
  [DeploymentContext.C_LOCAL]: 'Local Development',
  [DeploymentContext.C_TEAM]: 'Team Environment',
  [DeploymentContext.C_ENTERPRISE]: 'Enterprise',
  [DeploymentContext.C_REGULATED]: 'Regulated Industry',
  [DeploymentContext.C_SOVEREIGN]: 'Sovereign/Government',
};

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Schema for DeploymentContext validation
 */
export const DeploymentContextSchema = z.nativeEnum(DeploymentContext);

/**
 * Schema for context configuration
 */
export const ContextConfigSchema = z.object({
  context: DeploymentContextSchema,
  customMaxTier: z.number().int().min(0).max(5).optional(),
  customMaxScore: z.number().int().min(0).max(1000).optional(),
  humanApprovalEnabled: z.boolean().optional(),
  attestationEnabled: z.boolean().optional(),
});

export type ContextConfig = z.infer<typeof ContextConfigSchema>;

// ============================================================================
// Functions
// ============================================================================

/**
 * Get the trust ceiling for a deployment context
 *
 * @param context - The deployment context
 * @returns The maximum runtime tier allowed
 */
export function getContextCeiling(context: DeploymentContext): RuntimeTier {
  return CONTEXT_CEILINGS[context].maxTier;
}

/**
 * Get the maximum score for a deployment context
 *
 * @param context - The deployment context
 * @returns The maximum trust score allowed
 */
export function getContextMaxScore(context: DeploymentContext): number {
  return CONTEXT_CEILINGS[context].maxScore;
}

/**
 * Apply context ceiling to a trust score
 *
 * @param score - The trust score to check
 * @param context - The deployment context
 * @returns The score, capped at the context ceiling
 */
export function applyContextCeiling(
  score: TrustScore,
  context: DeploymentContext
): TrustScore {
  const ceiling = CONTEXT_CEILINGS[context];
  const result = Math.min(score, ceiling.maxScore);

  if (result < score) {
    logger.debug(
      {
        originalScore: score,
        cappedScore: result,
        context: CONTEXT_NAMES[context],
        maxScore: ceiling.maxScore,
      },
      'Applied context ceiling to trust score'
    );
  }

  return result as TrustScore;
}

/**
 * Check if human approval is required for an action
 *
 * @param context - The deployment context
 * @param requestedTier - The trust tier being requested
 * @returns True if human approval is required
 */
export function requiresHumanApproval(
  context: DeploymentContext,
  requestedTier: RuntimeTier
): boolean {
  const ceiling = CONTEXT_CEILINGS[context];

  if (!ceiling.requiresHuman) {
    return false;
  }

  const threshold = ceiling.humanRequiredAboveTier ?? ceiling.maxTier;
  return requestedTier > threshold;
}

/**
 * Check if attestation is required for an action
 *
 * @param context - The deployment context
 * @returns True if hardware attestation is required
 */
export function requiresAttestation(context: DeploymentContext): boolean {
  return CONTEXT_CEILINGS[context].requiresAttestation ?? false;
}

/**
 * Evaluate context policy for a requested action
 *
 * @param context - The deployment context
 * @param requestedTier - The trust tier being requested
 * @param hasHumanApproval - Whether human approval has been obtained
 * @param hasAttestation - Whether hardware attestation is present
 * @returns Policy evaluation result
 */
export function evaluateContextPolicy(
  context: DeploymentContext,
  requestedTier: RuntimeTier,
  hasHumanApproval: boolean = false,
  hasAttestation: boolean = false
): ContextPolicyResult {
  const ceiling = CONTEXT_CEILINGS[context];
  let effectiveMaxTier = ceiling.maxTier;
  let effectiveMaxScore = ceiling.maxScore;
  const reasons: string[] = [];

  // Check attestation requirement
  if (ceiling.requiresAttestation && !hasAttestation) {
    // Without attestation in sovereign context, limit trust significantly
    effectiveMaxTier = Math.min(effectiveMaxTier, 2) as RuntimeTier;
    effectiveMaxScore = Math.min(effectiveMaxScore, 599);
    reasons.push('Attestation required for higher trust in sovereign context');
  }

  // Check human approval requirement
  const needsHuman = requiresHumanApproval(context, requestedTier);
  if (needsHuman && !hasHumanApproval) {
    // Without human approval in regulated context, limit to threshold
    const threshold = ceiling.humanRequiredAboveTier ?? ceiling.maxTier;
    effectiveMaxTier = Math.min(effectiveMaxTier, threshold) as RuntimeTier;
    effectiveMaxScore = Math.min(effectiveMaxScore, tierToMaxScore(threshold));
    reasons.push('Human approval required for autonomous actions in regulated context');
  }

  const allowed = requestedTier <= effectiveMaxTier;

  logger.debug(
    {
      context: CONTEXT_NAMES[context],
      requestedTier,
      effectiveMaxTier,
      allowed,
      hasHumanApproval,
      hasAttestation,
    },
    'Evaluated context policy'
  );

  return {
    allowed,
    maxTier: effectiveMaxTier,
    maxScore: effectiveMaxScore,
    humanApprovalRequired: needsHuman && !hasHumanApproval,
    attestationRequired: (ceiling.requiresAttestation ?? false) && !hasAttestation,
    reason: reasons.length > 0 ? reasons.join('; ') : undefined,
  };
}

/**
 * Convert tier to maximum score for that tier
 *
 * @param tier - Runtime tier
 * @returns Maximum score for the tier
 */
function tierToMaxScore(tier: RuntimeTier): number {
  const tierMaxScores: Record<RuntimeTier, number> = {
    0: 199,
    1: 399,
    2: 599,
    3: 799,
    4: 899,
    5: 1000,
  };
  return tierMaxScores[tier];
}

/**
 * Get human-readable description of context constraints
 *
 * @param context - The deployment context
 * @returns Description of the policy implications
 */
export function describeContextConstraints(context: DeploymentContext): string {
  const ceiling = CONTEXT_CEILINGS[context];
  const name = CONTEXT_NAMES[context];
  let description = `${name}: ${ceiling.description} (max T${ceiling.maxTier})`;

  if (ceiling.requiresHuman) {
    description += ` [Human approval required above T${ceiling.humanRequiredAboveTier ?? ceiling.maxTier}]`;
  }
  if (ceiling.requiresAttestation) {
    description += ' [Hardware attestation required]';
  }

  return description;
}

/**
 * Determine deployment context from environment
 *
 * Analyzes environment variables and configuration to determine
 * the appropriate deployment context.
 *
 * @returns The detected deployment context
 */
export function detectDeploymentContext(): DeploymentContext {
  const env = process.env['VORION_DEPLOYMENT_CONTEXT'];
  if (env && Object.values(DeploymentContext).includes(env as DeploymentContext)) {
    return env as DeploymentContext;
  }

  // Infer from NODE_ENV and other indicators
  const nodeEnv = process.env['NODE_ENV'];
  const isRegulated = process.env['VORION_REGULATED'] === 'true';
  const isSovereign = process.env['VORION_SOVEREIGN'] === 'true';

  if (isSovereign) {
    return DeploymentContext.C_SOVEREIGN;
  }
  if (isRegulated) {
    return DeploymentContext.C_REGULATED;
  }
  if (nodeEnv === 'production') {
    return DeploymentContext.C_ENTERPRISE;
  }
  if (nodeEnv === 'staging' || nodeEnv === 'test') {
    return DeploymentContext.C_TEAM;
  }

  return DeploymentContext.C_LOCAL;
}
