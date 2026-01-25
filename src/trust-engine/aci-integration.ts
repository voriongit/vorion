/**
 * ACI Integration for Trust Engine
 *
 * Bridges ACI certification layer with Vorion runtime layer.
 * Implements the dual-layer trust model where:
 * - Certification Layer: Portable attestations (ACI) that travel with agents
 * - Runtime Layer: Deployment-specific trust enforcement (Vorion)
 *
 * @packageDocumentation
 */

import {
  ParsedACI,
  CertificationTier,
  RuntimeTier,
  CapabilityLevel,
  parseACI,
  calculateEffectivePermission,
} from '../../packages/contracts/src/aci/index.js';
import type { TrustLevel, TrustScore, ID } from '../common/types.js';
import { createLogger } from '../common/logger.js';
import { z } from 'zod';

const logger = createLogger({ component: 'aci-integration' });

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert CertificationTier to RuntimeTier
 * Both use 0-5 values, so we can safely convert via unknown
 */
function certificationToRuntimeTier(certTier: CertificationTier): RuntimeTier {
  return certTier as unknown as RuntimeTier;
}

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Attestation record from ACI certification
 */
export interface Attestation {
  /** Unique attestation identifier */
  id: string;
  /** Subject entity (agent) this attestation is for */
  subject: ID;
  /** Issuing authority (e.g., auditor, certifier) */
  issuer: string;
  /** Certified trust tier (T0-T5) */
  trustTier: CertificationTier;
  /** Scope of the attestation (domains, capabilities) */
  scope: string[];
  /** When the attestation was issued */
  issuedAt: Date;
  /** When the attestation expires */
  expiresAt: Date;
  /** Supporting evidence references */
  evidence: string[];
}

/**
 * ACI Trust Context
 * Combines certification and runtime trust information
 */
export interface ACITrustContext {
  // ACI Certification (portable)
  /** Parsed ACI string */
  aci: ParsedACI;
  /** Certification tier from ACI (T0-T5) */
  certificationTier: CertificationTier;
  /** Competence/capability level from ACI */
  competenceLevel: CapabilityLevel;
  /** Domains the agent is certified for */
  certifiedDomains: string[];

  // Vorion Runtime (deployment-specific)
  /** Current runtime trust tier based on behavioral signals */
  runtimeTier: RuntimeTier;
  /** Current runtime trust score (0-1000) */
  runtimeScore: TrustScore;

  // Ceilings (limits on effective trust)
  /** Max tier based on observability class */
  observabilityCeiling: RuntimeTier;
  /** Max tier based on deployment context policy */
  contextPolicyCeiling: RuntimeTier;

  // Effective (computed minimum of all factors)
  /** Effective tier after applying all ceilings */
  effectiveTier: RuntimeTier;
  /** Effective score after applying all ceilings */
  effectiveScore: TrustScore;
}

/**
 * Result of effective permission calculation
 */
export interface EffectivePermission {
  /** Effective trust tier */
  tier: RuntimeTier;
  /** Effective trust score */
  score: TrustScore;
  /** Certified domains */
  domains: string[];
  /** Capability level */
  level: CapabilityLevel;
  /** Reason why the ceiling was applied (if any) */
  ceilingReason?: string;
}

/**
 * Trust signal derived from an attestation
 */
export interface TrustSignal {
  /** Unique signal identifier */
  id: string;
  /** Entity this signal is for */
  entityId: ID;
  /** Signal type */
  type: string;
  /** Signal value (impact on trust) */
  value: number;
  /** Weight multiplier */
  weight: number;
  /** Source of the signal */
  source: string;
  /** When this signal was created */
  timestamp: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Result of a permission check
 */
export interface PermissionCheckResult {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Effective trust tier */
  effectiveTier: RuntimeTier;
  /** Effective trust score */
  effectiveScore: TrustScore;
  /** Reason for denial (if not allowed) */
  reason?: string;
  /** Explanation of which ceiling limited the permission */
  ceilingReason?: string;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Schema for Attestation validation
 */
export const AttestationSchema = z.object({
  id: z.string().uuid(),
  subject: z.string(),
  issuer: z.string(),
  trustTier: z.number().int().min(0).max(5) as z.ZodType<CertificationTier>,
  scope: z.array(z.string()),
  issuedAt: z.date(),
  expiresAt: z.date(),
  evidence: z.array(z.string()),
});

// ============================================================================
// Tier/Score Conversion Utilities
// ============================================================================

/**
 * Tier to minimum score mapping (aligned with TRUST_THRESHOLDS)
 */
const TIER_TO_MIN_SCORE: Record<RuntimeTier, TrustScore> = {
  0: 0,
  1: 200,
  2: 400,
  3: 600,
  4: 800,
  5: 900,
};

/**
 * Tier to maximum score mapping
 */
const TIER_TO_MAX_SCORE: Record<RuntimeTier, TrustScore> = {
  0: 199,
  1: 399,
  2: 599,
  3: 799,
  4: 899,
  5: 1000,
};

/**
 * Convert certification tier to minimum trust score
 *
 * @param tier - Certification tier (T0-T5)
 * @returns Minimum trust score for that tier
 */
export function certificationTierToMinScore(tier: CertificationTier): TrustScore {
  return TIER_TO_MIN_SCORE[certificationToRuntimeTier(tier)] ?? 0;
}

/**
 * Convert certification tier to maximum trust score
 *
 * @param tier - Certification tier (T0-T5)
 * @returns Maximum trust score for that tier
 */
export function certificationTierToMaxScore(tier: CertificationTier): TrustScore {
  return TIER_TO_MAX_SCORE[certificationToRuntimeTier(tier)] ?? 1000;
}

/**
 * Convert certification tier to a representative trust score
 *
 * @param tier - Certification tier (T0-T5)
 * @returns Representative trust score for attestation signals
 */
export function certificationTierToScore(tier: CertificationTier): number {
  // Return midpoint of tier range for attestation signals
  const runtimeTier = certificationToRuntimeTier(tier);
  const min = TIER_TO_MIN_SCORE[runtimeTier] ?? 0;
  const max = TIER_TO_MAX_SCORE[runtimeTier] ?? 199;
  return Math.floor((min + max) / 2);
}

/**
 * Convert trust score to runtime tier
 *
 * @param score - Trust score (0-1000)
 * @returns Runtime tier (T0-T5)
 */
export function scoreToTier(score: TrustScore): RuntimeTier {
  if (score >= 900) return 5;
  if (score >= 800) return 4;
  if (score >= 600) return 3;
  if (score >= 400) return 2;
  if (score >= 200) return 1;
  return 0;
}

/**
 * Get minimum score for a given tier
 *
 * @param tier - Runtime tier (T0-T5)
 * @returns Minimum score for that tier
 */
export function tierToMinScore(tier: RuntimeTier): TrustScore {
  return TIER_TO_MIN_SCORE[tier] ?? 0;
}

/**
 * Convert competence level to ceiling tier
 * Higher competence allows higher trust ceiling
 *
 * @param level - Capability/competence level
 * @returns Maximum allowed tier based on competence
 */
export function competenceLevelToCeiling(level: CapabilityLevel): RuntimeTier {
  // Map capability levels to tier ceilings
  // This assumes CapabilityLevel is numeric (0-5) or can be converted
  if (typeof level === 'number') {
    return Math.min(5, level) as RuntimeTier;
  }
  // If it's a string enum, map accordingly
  const levelMap: Record<string, RuntimeTier> = {
    none: 0,
    basic: 1,
    intermediate: 2,
    advanced: 3,
    expert: 4,
    master: 5,
  };
  return levelMap[String(level).toLowerCase()] ?? 2;
}

// ============================================================================
// Core ACI Integration Functions
// ============================================================================

/**
 * Determine which factor is limiting the effective tier
 *
 * @param ctx - ACI Trust Context
 * @param effectiveTier - The computed effective tier
 * @returns Human-readable explanation of the ceiling reason
 */
export function determineCeilingReason(
  ctx: ACITrustContext,
  effectiveTier: RuntimeTier
): string | undefined {
  if (effectiveTier === certificationToRuntimeTier(ctx.certificationTier)) {
    return 'Limited by ACI certification tier';
  }
  if (effectiveTier === competenceLevelToCeiling(ctx.competenceLevel)) {
    return 'Limited by competence level';
  }
  if (effectiveTier === ctx.runtimeTier) {
    return 'Limited by runtime behavioral trust';
  }
  if (effectiveTier === ctx.observabilityCeiling) {
    return 'Limited by observability class';
  }
  if (effectiveTier === ctx.contextPolicyCeiling) {
    return 'Limited by deployment context policy';
  }
  return undefined;
}

/**
 * Calculate effective permission from ACI context
 *
 * The effective tier is the minimum of:
 * 1. Certification tier (what the agent is certified for)
 * 2. Competence ceiling (what the agent's capability allows)
 * 3. Runtime tier (what behavioral signals indicate)
 * 4. Observability ceiling (what we can verify)
 * 5. Context policy ceiling (what the deployment allows)
 *
 * @param ctx - ACI Trust Context with all trust dimensions
 * @returns Effective permission with tier, score, and ceiling reason
 */
export function calculateEffectiveFromACI(ctx: ACITrustContext): EffectivePermission {
  const effectiveTier = Math.min(
    ctx.certificationTier,
    competenceLevelToCeiling(ctx.competenceLevel),
    ctx.runtimeTier,
    ctx.observabilityCeiling,
    ctx.contextPolicyCeiling
  ) as RuntimeTier;

  logger.debug(
    {
      certificationTier: ctx.certificationTier,
      competenceCeiling: competenceLevelToCeiling(ctx.competenceLevel),
      runtimeTier: ctx.runtimeTier,
      observabilityCeiling: ctx.observabilityCeiling,
      contextPolicyCeiling: ctx.contextPolicyCeiling,
      effectiveTier,
    },
    'Calculated effective tier from ACI context'
  );

  return {
    tier: effectiveTier,
    score: tierToMinScore(effectiveTier),
    domains: ctx.certifiedDomains,
    level: ctx.competenceLevel,
    ceilingReason: determineCeilingReason(ctx, effectiveTier),
  };
}

/**
 * Convert ACI attestation to Vorion trust signal
 *
 * Attestations become trust signals that feed into the runtime trust calculation.
 * This bridges the certification layer with the runtime layer.
 *
 * @param attestation - ACI Attestation record
 * @returns Trust signal for the trust engine
 */
export function attestationToTrustSignal(attestation: Attestation): TrustSignal {
  return {
    id: crypto.randomUUID(),
    entityId: attestation.subject,
    type: 'ATTESTATION',
    value: certificationTierToScore(attestation.trustTier),
    weight: 1.0,
    source: attestation.issuer,
    timestamp: attestation.issuedAt.toISOString(),
    metadata: {
      scope: attestation.scope,
      expiresAt: attestation.expiresAt.toISOString(),
      evidence: attestation.evidence,
      attestationId: attestation.id,
    },
  };
}

/**
 * Apply ACI floor to runtime trust
 *
 * An agent with T3 certification starts at minimum T3 score.
 * The certification tier provides a "floor" - the agent cannot
 * have a lower trust score than their certification warrants.
 *
 * @param runtimeScore - Current runtime trust score
 * @param certificationTier - Agent's certified tier from ACI
 * @returns Score with floor applied (at least the certification minimum)
 */
export function applyACIFloor(
  runtimeScore: TrustScore,
  certificationTier: CertificationTier
): TrustScore {
  const floorScore = certificationTierToMinScore(certificationTier);
  const result = Math.max(runtimeScore, floorScore);

  if (result > runtimeScore) {
    logger.debug(
      { runtimeScore, floorScore, result, certificationTier },
      'Applied ACI floor to runtime score'
    );
  }

  return result as TrustScore;
}

/**
 * Enforce ACI ceiling on runtime trust
 *
 * Runtime cannot exceed what the agent is certified for.
 * No matter how good the behavioral signals, trust is capped
 * at the certification tier maximum.
 *
 * @param runtimeScore - Current runtime trust score
 * @param certificationTier - Agent's certified tier from ACI
 * @returns Score with ceiling enforced (at most the certification maximum)
 */
export function enforceACICeiling(
  runtimeScore: TrustScore,
  certificationTier: CertificationTier
): TrustScore {
  const ceilingScore = certificationTierToMaxScore(certificationTier);
  const result = Math.min(runtimeScore, ceilingScore);

  if (result < runtimeScore) {
    logger.debug(
      { runtimeScore, ceilingScore, result, certificationTier },
      'Enforced ACI ceiling on runtime score'
    );
  }

  return result as TrustScore;
}

/**
 * Calculate effective tier combining multiple factors
 *
 * @param parsedACI - Parsed ACI data
 * @param runtimeTier - Current runtime tier
 * @param observabilityCeiling - Ceiling from observability class
 * @param contextCeiling - Ceiling from deployment context
 * @returns Effective tier after all ceilings applied
 */
export function calculateEffectiveTier(
  parsedACI: ParsedACI,
  runtimeTier: RuntimeTier,
  observabilityCeiling: RuntimeTier,
  contextCeiling: RuntimeTier
): RuntimeTier {
  return Math.min(
    certificationToRuntimeTier(parsedACI.certificationTier),
    runtimeTier,
    observabilityCeiling,
    contextCeiling
  ) as RuntimeTier;
}

/**
 * Calculate effective score combining multiple factors
 *
 * @param parsedACI - Parsed ACI data
 * @param runtimeScore - Current runtime score
 * @param observabilityCeiling - Ceiling from observability class
 * @param contextCeiling - Ceiling from deployment context
 * @returns Effective score after all ceilings and floors applied
 */
export function calculateEffectiveScore(
  parsedACI: ParsedACI,
  runtimeScore: TrustScore,
  observabilityCeiling: RuntimeTier,
  contextCeiling: RuntimeTier
): TrustScore {
  // Apply floor from certification
  let score = applyACIFloor(runtimeScore, parsedACI.certificationTier);

  // Apply ceiling from certification
  score = enforceACICeiling(score, parsedACI.certificationTier);

  // Apply observability ceiling
  const observabilityMax = TIER_TO_MAX_SCORE[observabilityCeiling];
  score = Math.min(score, observabilityMax);

  // Apply context policy ceiling
  const contextMax = TIER_TO_MAX_SCORE[contextCeiling];
  score = Math.min(score, contextMax);

  return score as TrustScore;
}
