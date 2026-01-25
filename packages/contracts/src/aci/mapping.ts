/**
 * @fileoverview Cross-System Mappings
 *
 * Provides mapping functions between different tier systems, domain namespaces,
 * and trust representations. These mappings enable interoperability between
 * the ACI specification and Vorion runtime systems.
 *
 * Key mappings:
 * - CertificationTier <-> RuntimeTier
 * - ACI Domains <-> Vorion Namespaces
 * - TrustBand <-> CertificationTier/RuntimeTier
 *
 * @module @vorion/contracts/aci/mapping
 */

import { z } from 'zod';
import {
  type DomainCode,
  domainCodeSchema,
} from './domains.js';
import { CapabilityLevel } from './levels.js';
import {
  CertificationTier,
  RuntimeTier,
  certificationTierSchema,
  runtimeTierSchema,
  CERTIFICATION_TIER_SCORES,
  RUNTIME_TIER_SCORES,
  scoreToCertificationTier,
  scoreToRuntimeTier,
} from './tiers.js';

// ============================================================================
// Tier Mappings
// ============================================================================

/**
 * Maps a CertificationTier to the corresponding RuntimeTier.
 *
 * This is a direct 1:1 mapping since both use T0-T5 scale, but with
 * different semantic meanings:
 * - CertificationTier: External attestation status
 * - RuntimeTier: Deployment autonomy level
 *
 * @param certificationTier - ACI certification tier
 * @returns Corresponding Vorion runtime tier
 *
 * @example
 * ```typescript
 * certificationTierToRuntimeTier(CertificationTier.T3_CERTIFIED);
 * // RuntimeTier.T3_TRUSTED
 * ```
 */
export function certificationTierToRuntimeTier(
  certificationTier: CertificationTier
): RuntimeTier {
  // Direct mapping based on numeric value
  return certificationTier as unknown as RuntimeTier;
}

/**
 * Maps a RuntimeTier to the corresponding CertificationTier.
 *
 * @param runtimeTier - Vorion runtime tier
 * @returns Corresponding ACI certification tier
 *
 * @example
 * ```typescript
 * runtimeTierToCertificationTier(RuntimeTier.T3_TRUSTED);
 * // CertificationTier.T3_CERTIFIED
 * ```
 */
export function runtimeTierToCertificationTier(
  runtimeTier: RuntimeTier
): CertificationTier {
  return runtimeTier as unknown as CertificationTier;
}

/**
 * Mapping configuration for certification to runtime tier.
 */
export const CERTIFICATION_TO_RUNTIME_TIER_MAP: Readonly<
  Record<CertificationTier, RuntimeTier>
> = {
  [CertificationTier.T0_UNVERIFIED]: RuntimeTier.T0_SANDBOX,
  [CertificationTier.T1_REGISTERED]: RuntimeTier.T1_SUPERVISED,
  [CertificationTier.T2_TESTED]: RuntimeTier.T2_CONSTRAINED,
  [CertificationTier.T3_CERTIFIED]: RuntimeTier.T3_TRUSTED,
  [CertificationTier.T4_VERIFIED]: RuntimeTier.T4_AUTONOMOUS,
  [CertificationTier.T5_SOVEREIGN]: RuntimeTier.T5_SOVEREIGN,
} as const;

/**
 * Mapping configuration for runtime to certification tier.
 */
export const RUNTIME_TO_CERTIFICATION_TIER_MAP: Readonly<
  Record<RuntimeTier, CertificationTier>
> = {
  [RuntimeTier.T0_SANDBOX]: CertificationTier.T0_UNVERIFIED,
  [RuntimeTier.T1_SUPERVISED]: CertificationTier.T1_REGISTERED,
  [RuntimeTier.T2_CONSTRAINED]: CertificationTier.T2_TESTED,
  [RuntimeTier.T3_TRUSTED]: CertificationTier.T3_CERTIFIED,
  [RuntimeTier.T4_AUTONOMOUS]: CertificationTier.T4_VERIFIED,
  [RuntimeTier.T5_SOVEREIGN]: CertificationTier.T5_SOVEREIGN,
} as const;

// ============================================================================
// TrustBand Mappings (Integration with Vorion canonical types)
// ============================================================================

/**
 * TrustBand values from Vorion canonical types.
 * Replicated here to avoid circular dependencies.
 */
export enum TrustBand {
  T0_UNTRUSTED = 0,
  T1_OBSERVED = 1,
  T2_LIMITED = 2,
  T3_STANDARD = 3,
  T4_TRUSTED = 4,
  T5_CERTIFIED = 5,
}

/**
 * Zod schema for TrustBand validation.
 */
export const trustBandSchema = z.nativeEnum(TrustBand, {
  errorMap: () => ({ message: 'Invalid trust band. Must be T0-T5 (0-5).' }),
});

/**
 * Maps a TrustBand to a CertificationTier.
 *
 * @param trustBand - Vorion trust band
 * @returns Corresponding ACI certification tier
 *
 * @example
 * ```typescript
 * trustBandToCertificationTier(TrustBand.T3_STANDARD);
 * // CertificationTier.T3_CERTIFIED
 * ```
 */
export function trustBandToCertificationTier(trustBand: TrustBand): CertificationTier {
  return trustBand as unknown as CertificationTier;
}

/**
 * Maps a TrustBand to a RuntimeTier.
 *
 * @param trustBand - Vorion trust band
 * @returns Corresponding Vorion runtime tier
 *
 * @example
 * ```typescript
 * trustBandToRuntimeTier(TrustBand.T3_STANDARD);
 * // RuntimeTier.T3_TRUSTED
 * ```
 */
export function trustBandToRuntimeTier(trustBand: TrustBand): RuntimeTier {
  return trustBand as unknown as RuntimeTier;
}

/**
 * Maps a CertificationTier to a TrustBand.
 *
 * @param certificationTier - ACI certification tier
 * @returns Corresponding Vorion trust band
 */
export function certificationTierToTrustBand(
  certificationTier: CertificationTier
): TrustBand {
  return certificationTier as unknown as TrustBand;
}

/**
 * Maps a RuntimeTier to a TrustBand.
 *
 * @param runtimeTier - Vorion runtime tier
 * @returns Corresponding Vorion trust band
 */
export function runtimeTierToTrustBand(runtimeTier: RuntimeTier): TrustBand {
  return runtimeTier as unknown as TrustBand;
}

// ============================================================================
// Trust Score Mappings
// ============================================================================

/**
 * Converts a trust score to both certification and runtime tiers.
 *
 * Note: CertificationTier and RuntimeTier use different score ranges,
 * so the same score may map to different tiers.
 *
 * @param score - Trust score (0-1000)
 * @returns Both certification and runtime tiers
 *
 * @example
 * ```typescript
 * scoreToBothTiers(550);
 * // { certificationTier: T3_CERTIFIED, runtimeTier: T3_TRUSTED }
 * ```
 */
export function scoreToBothTiers(score: number): {
  certificationTier: CertificationTier;
  runtimeTier: RuntimeTier;
} {
  return {
    certificationTier: scoreToCertificationTier(score),
    runtimeTier: scoreToRuntimeTier(score),
  };
}

/**
 * Normalizes a score between ACI and Vorion scales.
 *
 * ACI uses 0-1000 with boundaries at 100, 300, 500, 700, 900
 * Vorion uses 0-1000 with boundaries at 166, 333, 500, 666, 833
 *
 * @param score - Trust score
 * @param fromScale - Source scale ('aci' | 'vorion')
 * @param toScale - Target scale ('aci' | 'vorion')
 * @returns Normalized score in target scale
 */
export function normalizeScoreBetweenScales(
  score: number,
  fromScale: 'aci' | 'vorion',
  toScale: 'aci' | 'vorion'
): number {
  if (fromScale === toScale) {
    return score;
  }

  // Determine the tier in the source scale
  const sourceTier = fromScale === 'aci'
    ? scoreToCertificationTier(score)
    : scoreToRuntimeTier(score);

  // Get the source tier's score range
  const sourceRange = fromScale === 'aci'
    ? CERTIFICATION_TIER_SCORES[sourceTier as CertificationTier]
    : RUNTIME_TIER_SCORES[sourceTier as RuntimeTier];

  // Calculate position within source tier (0-1)
  const positionInTier = sourceRange.max === sourceRange.min
    ? 0.5
    : (score - sourceRange.min) / (sourceRange.max - sourceRange.min);

  // Get the target tier's score range (same tier index, different scale)
  const targetRange = toScale === 'aci'
    ? CERTIFICATION_TIER_SCORES[sourceTier as CertificationTier]
    : RUNTIME_TIER_SCORES[sourceTier as RuntimeTier];

  // Map to target scale
  return Math.round(
    targetRange.min + positionInTier * (targetRange.max - targetRange.min)
  );
}

// ============================================================================
// Domain to Namespace Mappings
// ============================================================================

/**
 * Vorion namespace strings corresponding to ACI domains.
 */
export type VorionNamespace =
  | 'admin'
  | 'business'
  | 'communications'
  | 'data'
  | 'external'
  | 'finance'
  | 'governance'
  | 'hospitality'
  | 'infrastructure'
  | 'security';

/**
 * Array of all Vorion namespaces.
 */
export const VORION_NAMESPACES: readonly VorionNamespace[] = [
  'admin',
  'business',
  'communications',
  'data',
  'external',
  'finance',
  'governance',
  'hospitality',
  'infrastructure',
  'security',
] as const;

/**
 * Zod schema for VorionNamespace validation.
 */
export const vorionNamespaceSchema = z.enum([
  'admin',
  'business',
  'communications',
  'data',
  'external',
  'finance',
  'governance',
  'hospitality',
  'infrastructure',
  'security',
]);

/**
 * Mapping from ACI domain codes to Vorion namespaces.
 */
export const DOMAIN_TO_NAMESPACE_MAP: Readonly<Record<DomainCode, VorionNamespace>> = {
  A: 'admin',
  B: 'business',
  C: 'communications',
  D: 'data',
  E: 'external',
  F: 'finance',
  G: 'governance',
  H: 'hospitality',
  I: 'infrastructure',
  S: 'security',
} as const;

/**
 * Mapping from Vorion namespaces to ACI domain codes.
 */
export const NAMESPACE_TO_DOMAIN_MAP: Readonly<Record<VorionNamespace, DomainCode>> = {
  admin: 'A',
  business: 'B',
  communications: 'C',
  data: 'D',
  external: 'E',
  finance: 'F',
  governance: 'G',
  hospitality: 'H',
  infrastructure: 'I',
  security: 'S',
} as const;

/**
 * Maps an ACI domain code to a Vorion namespace.
 *
 * @param domain - ACI domain code
 * @returns Vorion namespace
 *
 * @example
 * ```typescript
 * aciDomainToVorionNamespace('F');  // 'finance'
 * aciDomainToVorionNamespace('S');  // 'security'
 * ```
 */
export function aciDomainToVorionNamespace(domain: DomainCode): VorionNamespace {
  return DOMAIN_TO_NAMESPACE_MAP[domain];
}

/**
 * Maps a Vorion namespace to an ACI domain code.
 *
 * @param namespace - Vorion namespace
 * @returns ACI domain code
 *
 * @example
 * ```typescript
 * vorionNamespaceToAciDomain('finance');  // 'F'
 * vorionNamespaceToAciDomain('security'); // 'S'
 * ```
 */
export function vorionNamespaceToAciDomain(namespace: VorionNamespace): DomainCode {
  return NAMESPACE_TO_DOMAIN_MAP[namespace];
}

/**
 * Maps an array of ACI domains to Vorion namespaces.
 *
 * @param domains - Array of ACI domain codes
 * @returns Array of Vorion namespaces
 */
export function aciDomainsToVorionNamespaces(
  domains: readonly DomainCode[]
): VorionNamespace[] {
  return domains.map(aciDomainToVorionNamespace);
}

/**
 * Maps an array of Vorion namespaces to ACI domains.
 *
 * @param namespaces - Array of Vorion namespaces
 * @returns Array of ACI domain codes
 */
export function vorionNamespacesToAciDomains(
  namespaces: readonly VorionNamespace[]
): DomainCode[] {
  return namespaces.map(vorionNamespaceToAciDomain);
}

// ============================================================================
// Capability Level Mappings
// ============================================================================

/**
 * Maps a capability level to a human-readable autonomy description.
 *
 * @param level - Capability level
 * @returns Autonomy description
 */
export function capabilityLevelToAutonomyDescription(level: CapabilityLevel): string {
  const descriptions: Record<CapabilityLevel, string> = {
    [CapabilityLevel.L0_OBSERVE]: 'Read-only, no autonomy',
    [CapabilityLevel.L1_ADVISE]: 'Advisory only, cannot act',
    [CapabilityLevel.L2_DRAFT]: 'Can draft, requires approval',
    [CapabilityLevel.L3_EXECUTE]: 'Can execute with approval',
    [CapabilityLevel.L4_AUTONOMOUS]: 'Autonomous within bounds',
    [CapabilityLevel.L5_SOVEREIGN]: 'Full autonomy',
  };
  return descriptions[level];
}

/**
 * Maps a capability level to a maximum allowed runtime tier.
 *
 * Higher capability levels require higher runtime tiers to operate.
 *
 * @param level - Capability level
 * @returns Minimum runtime tier required
 */
export function capabilityLevelToMinRuntimeTier(level: CapabilityLevel): RuntimeTier {
  return level as unknown as RuntimeTier;
}

// ============================================================================
// Bidirectional Mapping Helper
// ============================================================================

/**
 * A bidirectional mapping between two types.
 */
export interface BidirectionalMap<A, B> {
  forward: (a: A) => B;
  reverse: (b: B) => A;
  forwardMap: Readonly<Record<string, B>>;
  reverseMap: Readonly<Record<string, A>>;
}

/**
 * Creates a bidirectional mapping.
 *
 * @param mapping - Object mapping A values to B values
 * @returns Bidirectional map with forward and reverse functions
 */
export function createBidirectionalMap<A extends string | number, B extends string | number>(
  mapping: Record<A, B>
): BidirectionalMap<A, B> {
  const reverseMapping = {} as Record<B, A>;

  for (const [key, value] of Object.entries(mapping)) {
    reverseMapping[value as B] = key as unknown as A;
  }

  return {
    forward: (a: A) => mapping[a],
    reverse: (b: B) => reverseMapping[b],
    forwardMap: mapping as Readonly<Record<string, B>>,
    reverseMap: reverseMapping as Readonly<Record<string, A>>,
  };
}

/**
 * Pre-built bidirectional map for domain <-> namespace.
 */
export const domainNamespaceMap = createBidirectionalMap(DOMAIN_TO_NAMESPACE_MAP);

/**
 * Pre-built bidirectional map for certification <-> runtime tier.
 */
export const certificationRuntimeMap = createBidirectionalMap(
  CERTIFICATION_TO_RUNTIME_TIER_MAP
);

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Zod schema for tier mapping result.
 */
export const tierMappingResultSchema = z.object({
  certificationTier: certificationTierSchema,
  runtimeTier: runtimeTierSchema,
});

/**
 * Zod schema for domain mapping result.
 */
export const domainMappingResultSchema = z.object({
  domain: domainCodeSchema,
  namespace: vorionNamespaceSchema,
});

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for VorionNamespace.
 */
export function isVorionNamespace(value: unknown): value is VorionNamespace {
  return (
    typeof value === 'string' &&
    VORION_NAMESPACES.includes(value as VorionNamespace)
  );
}

/**
 * Type guard for TrustBand.
 */
export function isTrustBand(value: unknown): value is TrustBand {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 5
  );
}
