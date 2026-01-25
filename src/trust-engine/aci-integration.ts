/**
 * ACI Integration for Trust Engine
 *
 * Bridges ACI identity layer with Vorion runtime trust enforcement.
 *
 * **CRITICAL DESIGN PRINCIPLE:**
 * The ACI is an IMMUTABLE identifier. Trust is NOT embedded in the ACI.
 * Trust is computed at RUNTIME from:
 * 1. Attestations (external certifications linked to the ACI identity)
 * 2. Behavioral signals (runtime observations)
 * 3. Deployment context policies
 *
 * This separation ensures:
 * - ACI remains stable (like a passport number)
 * - Trust can evolve independently
 * - Same agent can have different trust in different deployments
 *
 * @packageDocumentation
 */

import {
  ParsedACI,
  CertificationTier,
  RuntimeTier,
  CapabilityLevel,
  parseACI,
  getACIIdentity,
  type ACIIdentity,
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

/**
 * Default certification tier when no attestation exists
 */
const DEFAULT_CERTIFICATION_TIER: CertificationTier = 0; // T0: Unverified

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
 *
 * Combines identity (from ACI) with trust (from attestations + runtime).
 *
 * IMPORTANT: The certificationTier comes from ATTESTATIONS, not the ACI itself.
 * The ACI is just an identifier; trust is computed at runtime.
 */
export interface ACITrustContext {
  // ACI Identity (immutable)
  /** Parsed ACI string (identifier only, no trust info) */
  aci: ParsedACI;
  /** Unique identity portion: registry.organization.agentClass */
  identity: ACIIdentity;
  /** Competence/capability level from ACI */
  competenceLevel: CapabilityLevel;
  /** Domains the agent operates in (from ACI) */
  operationalDomains: string[];

  // Certification (from attestations, NOT from ACI)
  /** Certification tier from attestations (T0-T5) - defaults to T0 if no attestation */
  certificationTier: CertificationTier;
  /** Whether a valid attestation exists for this agent */
  hasValidAttestation: boolean;
  /** Attestation expiry (if any) */
  attestationExpiresAt?: Date;

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
  const certTierAsRuntime = certificationToRuntimeTier(ctx.certificationTier);

  if (effectiveTier === certTierAsRuntime) {
    if (!ctx.hasValidAttestation) {
      return 'Limited by lack of attestation (default T0)';
    }
    return 'Limited by attestation certification tier';
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
 * 1. Certification tier (from attestations, NOT the ACI itself)
 * 2. Competence ceiling (what the agent's capability allows)
 * 3. Runtime tier (what behavioral signals indicate)
 * 4. Observability ceiling (what we can verify)
 * 5. Context policy ceiling (what the deployment allows)
 *
 * IMPORTANT: Trust is computed at runtime, not encoded in the ACI.
 *
 * @param ctx - ACI Trust Context with all trust dimensions
 * @returns Effective permission with tier, score, and ceiling reason
 */
export function calculateEffectiveFromACI(ctx: ACITrustContext): EffectivePermission {
  const effectiveTier = Math.min(
    certificationToRuntimeTier(ctx.certificationTier),
    competenceLevelToCeiling(ctx.competenceLevel),
    ctx.runtimeTier,
    ctx.observabilityCeiling,
    ctx.contextPolicyCeiling
  ) as RuntimeTier;

  logger.debug(
    {
      identity: ctx.identity,
      certificationTier: ctx.certificationTier,
      hasValidAttestation: ctx.hasValidAttestation,
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
    domains: [...ctx.operationalDomains],
    level: ctx.competenceLevel,
    ceilingReason: determineCeilingReason(ctx, effectiveTier),
  };
}

/**
 * Create an ACI Trust Context from a parsed ACI and attestation lookup.
 *
 * @param parsedACI - The parsed ACI (identity only, no trust)
 * @param attestation - Optional attestation for this agent
 * @param runtimeScore - Current runtime trust score
 * @param observabilityCeiling - Ceiling from observability class
 * @param contextCeiling - Ceiling from deployment context
 * @returns Complete ACI Trust Context
 */
export function createACITrustContext(
  parsedACI: ParsedACI,
  attestation: Attestation | null,
  runtimeScore: TrustScore,
  observabilityCeiling: RuntimeTier,
  contextCeiling: RuntimeTier
): ACITrustContext {
  const identity = getACIIdentity(parsedACI);

  // Certification tier comes from attestation, NOT the ACI
  const certificationTier = attestation?.trustTier ?? DEFAULT_CERTIFICATION_TIER;
  const hasValidAttestation = attestation !== null && attestation.expiresAt > new Date();

  const runtimeTier = scoreToTier(runtimeScore);

  // Calculate effective values
  const effectiveTier = Math.min(
    certificationToRuntimeTier(certificationTier),
    competenceLevelToCeiling(parsedACI.level),
    runtimeTier,
    observabilityCeiling,
    contextCeiling
  ) as RuntimeTier;

  const effectiveScore = calculateEffectiveScoreFromFactors(
    runtimeScore,
    certificationTier,
    observabilityCeiling,
    contextCeiling
  );

  return {
    aci: parsedACI,
    identity,
    competenceLevel: parsedACI.level,
    operationalDomains: [...parsedACI.domains],
    certificationTier,
    hasValidAttestation,
    attestationExpiresAt: attestation?.expiresAt,
    runtimeTier,
    runtimeScore,
    observabilityCeiling,
    contextPolicyCeiling: contextCeiling,
    effectiveTier,
    effectiveScore,
  };
}

/**
 * Calculate effective score from multiple factors.
 */
function calculateEffectiveScoreFromFactors(
  runtimeScore: TrustScore,
  certificationTier: CertificationTier,
  observabilityCeiling: RuntimeTier,
  contextCeiling: RuntimeTier
): TrustScore {
  // Apply floor from certification
  let score = applyACIFloor(runtimeScore, certificationTier);

  // Apply ceiling from certification
  score = enforceACICeiling(score, certificationTier);

  // Apply observability ceiling
  const observabilityMax = TIER_TO_MAX_SCORE[observabilityCeiling];
  score = Math.min(score, observabilityMax);

  // Apply context policy ceiling
  const contextMax = TIER_TO_MAX_SCORE[contextCeiling];
  score = Math.min(score, contextMax);

  return score as TrustScore;
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
 * IMPORTANT: certificationTier now comes from attestations, NOT the ACI.
 *
 * @param certificationTier - Tier from attestation (or DEFAULT_CERTIFICATION_TIER if none)
 * @param competenceLevel - Agent's capability level from ACI
 * @param runtimeTier - Current runtime tier from behavioral scoring
 * @param observabilityCeiling - Ceiling from observability class
 * @param contextCeiling - Ceiling from deployment context
 * @returns Effective tier after all ceilings applied
 */
export function calculateEffectiveTier(
  certificationTier: CertificationTier,
  competenceLevel: CapabilityLevel,
  runtimeTier: RuntimeTier,
  observabilityCeiling: RuntimeTier,
  contextCeiling: RuntimeTier
): RuntimeTier {
  return Math.min(
    certificationToRuntimeTier(certificationTier),
    competenceLevelToCeiling(competenceLevel),
    runtimeTier,
    observabilityCeiling,
    contextCeiling
  ) as RuntimeTier;
}

/**
 * Calculate effective score combining multiple factors
 *
 * IMPORTANT: certificationTier now comes from attestations, NOT the ACI.
 *
 * @param certificationTier - Tier from attestation (or DEFAULT_CERTIFICATION_TIER if none)
 * @param runtimeScore - Current runtime score from behavioral scoring
 * @param observabilityCeiling - Ceiling from observability class
 * @param contextCeiling - Ceiling from deployment context
 * @returns Effective score after all ceilings and floors applied
 */
export function calculateEffectiveScore(
  certificationTier: CertificationTier,
  runtimeScore: TrustScore,
  observabilityCeiling: RuntimeTier,
  contextCeiling: RuntimeTier
): TrustScore {
  // Apply floor from certification (attestation-based)
  let score = applyACIFloor(runtimeScore, certificationTier);

  // Apply ceiling from certification (attestation-based)
  score = enforceACICeiling(score, certificationTier);

  // Apply observability ceiling
  const observabilityMax = TIER_TO_MAX_SCORE[observabilityCeiling];
  score = Math.min(score, observabilityMax);

  // Apply context policy ceiling
  const contextMax = TIER_TO_MAX_SCORE[contextCeiling];
  score = Math.min(score, contextMax);

  return score as TrustScore;
}

/**
 * Look up the certification tier for an ACI identity from attestations.
 *
 * @param identity - The ACI identity to look up
 * @param attestations - List of known attestations
 * @returns The highest valid certification tier, or DEFAULT_CERTIFICATION_TIER
 */
export function lookupCertificationTier(
  identity: ACIIdentity,
  attestations: Attestation[]
): CertificationTier {
  const now = new Date();

  // Find valid attestations for this identity
  const validAttestations = attestations.filter(
    (a) => a.subject === identity && a.expiresAt > now
  );

  if (validAttestations.length === 0) {
    logger.debug({ identity }, 'No valid attestations found, using default tier');
    return DEFAULT_CERTIFICATION_TIER;
  }

  // Return highest tier among valid attestations
  const maxTier = Math.max(...validAttestations.map((a) => a.trustTier)) as CertificationTier;

  logger.debug(
    { identity, attestationCount: validAttestations.length, maxTier },
    'Found valid attestations for identity'
  );

  return maxTier;
}
