/**
 * @fileoverview ACI Certification Tiers and Vorion Runtime Tiers
 *
 * Defines two distinct tier systems:
 *
 * 1. **CertificationTier (T0-T5)**: External attestation status from ACI spec.
 *    Represents the level of external verification and certification an agent
 *    has received from certification authorities.
 *
 * 2. **RuntimeTier (T0-T5)**: Vorion deployment-specific autonomy levels.
 *    Represents the operational autonomy granted to an agent in a specific
 *    Vorion deployment context.
 *
 * These two systems are conceptually different but can be mapped to each other
 * for interoperability.
 *
 * @module @vorion/contracts/aci/tiers
 */

import { z } from 'zod';

// ============================================================================
// ACI Certification Tiers
// ============================================================================

/**
 * ACI Certification Tiers representing external attestation status.
 *
 * These tiers indicate the level of external verification and certification
 * an agent has received from certification authorities:
 *
 * - T0: No external verification
 * - T1: Organization identity verified
 * - T2: Automated capability tests passed
 * - T3: Third-party audit completed
 * - T4: Continuous behavioral monitoring active
 * - T5: Highest assurance level (sovereign)
 */
export enum CertificationTier {
  /** No external verification - unverified agent */
  T0_UNVERIFIED = 0,
  /** Identity verified - organization has been registered */
  T1_REGISTERED = 1,
  /** Capability tested - passed automated capability tests */
  T2_TESTED = 2,
  /** Certified - independent third-party audit completed */
  T3_CERTIFIED = 3,
  /** Verified - continuous behavioral monitoring active */
  T4_VERIFIED = 4,
  /** Sovereign - highest assurance level with full certification */
  T5_SOVEREIGN = 5,
}

/**
 * Array of all certification tiers in ascending order.
 */
export const CERTIFICATION_TIERS = [
  CertificationTier.T0_UNVERIFIED,
  CertificationTier.T1_REGISTERED,
  CertificationTier.T2_TESTED,
  CertificationTier.T3_CERTIFIED,
  CertificationTier.T4_VERIFIED,
  CertificationTier.T5_SOVEREIGN,
] as const;

/**
 * Zod schema for CertificationTier enum validation.
 */
export const certificationTierSchema = z.nativeEnum(CertificationTier, {
  errorMap: () => ({ message: 'Invalid certification tier. Must be T0-T5 (0-5).' }),
});

/**
 * Human-readable names for certification tiers.
 */
export const CERTIFICATION_TIER_NAMES: Readonly<Record<CertificationTier, string>> = {
  [CertificationTier.T0_UNVERIFIED]: 'Unverified',
  [CertificationTier.T1_REGISTERED]: 'Registered',
  [CertificationTier.T2_TESTED]: 'Tested',
  [CertificationTier.T3_CERTIFIED]: 'Certified',
  [CertificationTier.T4_VERIFIED]: 'Verified',
  [CertificationTier.T5_SOVEREIGN]: 'Sovereign',
} as const;

/**
 * Detailed descriptions for certification tiers.
 */
export const CERTIFICATION_TIER_DESCRIPTIONS: Readonly<Record<CertificationTier, string>> = {
  [CertificationTier.T0_UNVERIFIED]:
    'No external verification. Agent identity and capabilities are unverified.',
  [CertificationTier.T1_REGISTERED]:
    'Organization identity has been verified. Basic registration with a certification authority.',
  [CertificationTier.T2_TESTED]:
    'Passed automated capability tests. Demonstrated basic competence in declared domains.',
  [CertificationTier.T3_CERTIFIED]:
    'Independent third-party audit completed. Verified compliance with standards.',
  [CertificationTier.T4_VERIFIED]:
    'Continuous behavioral monitoring active. Ongoing verification of safe operation.',
  [CertificationTier.T5_SOVEREIGN]:
    'Highest assurance level. Full certification with continuous monitoring and sovereign authority.',
} as const;

/**
 * Trust score ranges for certification tiers (ACI spec scale: 0-1000).
 */
export const CERTIFICATION_TIER_SCORES: Readonly<Record<CertificationTier, { min: number; max: number }>> = {
  [CertificationTier.T0_UNVERIFIED]: { min: 0, max: 99 },
  [CertificationTier.T1_REGISTERED]: { min: 100, max: 299 },
  [CertificationTier.T2_TESTED]: { min: 300, max: 499 },
  [CertificationTier.T3_CERTIFIED]: { min: 500, max: 699 },
  [CertificationTier.T4_VERIFIED]: { min: 700, max: 899 },
  [CertificationTier.T5_SOVEREIGN]: { min: 900, max: 1000 },
} as const;

// ============================================================================
// Vorion Runtime Tiers
// ============================================================================

/**
 * Vorion Runtime Tiers representing deployment-specific autonomy.
 *
 * These tiers indicate the operational autonomy granted to an agent
 * in a specific Vorion deployment context:
 *
 * - T0: Sandbox - No autonomy, isolated testing
 * - T1: Supervised - Human approves all actions
 * - T2: Constrained - Guardrails and limits active
 * - T3: Trusted - Standard operations permitted
 * - T4: Autonomous - Independent operation
 * - T5: Sovereign - Mission-critical, full authority
 */
export enum RuntimeTier {
  /** Sandbox - No autonomy, isolated testing environment */
  T0_SANDBOX = 0,
  /** Supervised - Human must approve all actions */
  T1_SUPERVISED = 1,
  /** Constrained - Guardrails and operational limits active */
  T2_CONSTRAINED = 2,
  /** Trusted - Standard operations without approval */
  T3_TRUSTED = 3,
  /** Autonomous - Independent operation within broad bounds */
  T4_AUTONOMOUS = 4,
  /** Sovereign - Mission-critical with full authority */
  T5_SOVEREIGN = 5,
}

/**
 * Array of all runtime tiers in ascending order.
 */
export const RUNTIME_TIERS = [
  RuntimeTier.T0_SANDBOX,
  RuntimeTier.T1_SUPERVISED,
  RuntimeTier.T2_CONSTRAINED,
  RuntimeTier.T3_TRUSTED,
  RuntimeTier.T4_AUTONOMOUS,
  RuntimeTier.T5_SOVEREIGN,
] as const;

/**
 * Zod schema for RuntimeTier enum validation.
 */
export const runtimeTierSchema = z.nativeEnum(RuntimeTier, {
  errorMap: () => ({ message: 'Invalid runtime tier. Must be T0-T5 (0-5).' }),
});

/**
 * Human-readable names for runtime tiers.
 */
export const RUNTIME_TIER_NAMES: Readonly<Record<RuntimeTier, string>> = {
  [RuntimeTier.T0_SANDBOX]: 'Sandbox',
  [RuntimeTier.T1_SUPERVISED]: 'Supervised',
  [RuntimeTier.T2_CONSTRAINED]: 'Constrained',
  [RuntimeTier.T3_TRUSTED]: 'Trusted',
  [RuntimeTier.T4_AUTONOMOUS]: 'Autonomous',
  [RuntimeTier.T5_SOVEREIGN]: 'Sovereign',
} as const;

/**
 * Detailed descriptions for runtime tiers.
 */
export const RUNTIME_TIER_DESCRIPTIONS: Readonly<Record<RuntimeTier, string>> = {
  [RuntimeTier.T0_SANDBOX]:
    'Isolated sandbox environment. No external access, all actions are simulated.',
  [RuntimeTier.T1_SUPERVISED]:
    'Full human supervision. Every action requires explicit approval before execution.',
  [RuntimeTier.T2_CONSTRAINED]:
    'Operational guardrails active. Actions limited by strict policy constraints.',
  [RuntimeTier.T3_TRUSTED]:
    'Standard operational trust. Can perform routine operations without individual approval.',
  [RuntimeTier.T4_AUTONOMOUS]:
    'Autonomous operation. Independent decision-making within organizational bounds.',
  [RuntimeTier.T5_SOVEREIGN]:
    'Full sovereignty. Mission-critical authority with minimal oversight requirements.',
} as const;

/**
 * Trust score ranges for runtime tiers (Vorion scale: 0-1000).
 */
export const RUNTIME_TIER_SCORES: Readonly<Record<RuntimeTier, { min: number; max: number }>> = {
  [RuntimeTier.T0_SANDBOX]: { min: 0, max: 166 },
  [RuntimeTier.T1_SUPERVISED]: { min: 167, max: 332 },
  [RuntimeTier.T2_CONSTRAINED]: { min: 333, max: 499 },
  [RuntimeTier.T3_TRUSTED]: { min: 500, max: 665 },
  [RuntimeTier.T4_AUTONOMOUS]: { min: 666, max: 832 },
  [RuntimeTier.T5_SOVEREIGN]: { min: 833, max: 1000 },
} as const;

// ============================================================================
// Tier Configuration Types
// ============================================================================

/**
 * Configuration for a certification tier.
 */
export interface CertificationTierConfig {
  /** The certification tier */
  readonly tier: CertificationTier;
  /** Short code (T0-T5) */
  readonly code: string;
  /** Human-readable name */
  readonly name: string;
  /** Detailed description */
  readonly description: string;
  /** Trust score range */
  readonly scoreRange: { min: number; max: number };
  /** Required attestation types */
  readonly requiredAttestations: readonly string[];
  /** Maximum capability level allowed */
  readonly maxCapabilityLevel: number;
}

/**
 * Configuration for all certification tiers.
 */
export const CERTIFICATION_TIER_CONFIGS: Readonly<Record<CertificationTier, CertificationTierConfig>> = {
  [CertificationTier.T0_UNVERIFIED]: {
    tier: CertificationTier.T0_UNVERIFIED,
    code: 'T0',
    name: 'Unverified',
    description: CERTIFICATION_TIER_DESCRIPTIONS[CertificationTier.T0_UNVERIFIED],
    scoreRange: CERTIFICATION_TIER_SCORES[CertificationTier.T0_UNVERIFIED],
    requiredAttestations: [],
    maxCapabilityLevel: 1,
  },
  [CertificationTier.T1_REGISTERED]: {
    tier: CertificationTier.T1_REGISTERED,
    code: 'T1',
    name: 'Registered',
    description: CERTIFICATION_TIER_DESCRIPTIONS[CertificationTier.T1_REGISTERED],
    scoreRange: CERTIFICATION_TIER_SCORES[CertificationTier.T1_REGISTERED],
    requiredAttestations: ['identity'],
    maxCapabilityLevel: 2,
  },
  [CertificationTier.T2_TESTED]: {
    tier: CertificationTier.T2_TESTED,
    code: 'T2',
    name: 'Tested',
    description: CERTIFICATION_TIER_DESCRIPTIONS[CertificationTier.T2_TESTED],
    scoreRange: CERTIFICATION_TIER_SCORES[CertificationTier.T2_TESTED],
    requiredAttestations: ['identity', 'capability_test'],
    maxCapabilityLevel: 3,
  },
  [CertificationTier.T3_CERTIFIED]: {
    tier: CertificationTier.T3_CERTIFIED,
    code: 'T3',
    name: 'Certified',
    description: CERTIFICATION_TIER_DESCRIPTIONS[CertificationTier.T3_CERTIFIED],
    scoreRange: CERTIFICATION_TIER_SCORES[CertificationTier.T3_CERTIFIED],
    requiredAttestations: ['identity', 'capability_test', 'third_party_audit'],
    maxCapabilityLevel: 4,
  },
  [CertificationTier.T4_VERIFIED]: {
    tier: CertificationTier.T4_VERIFIED,
    code: 'T4',
    name: 'Verified',
    description: CERTIFICATION_TIER_DESCRIPTIONS[CertificationTier.T4_VERIFIED],
    scoreRange: CERTIFICATION_TIER_SCORES[CertificationTier.T4_VERIFIED],
    requiredAttestations: ['identity', 'capability_test', 'third_party_audit', 'continuous_monitoring'],
    maxCapabilityLevel: 5,
  },
  [CertificationTier.T5_SOVEREIGN]: {
    tier: CertificationTier.T5_SOVEREIGN,
    code: 'T5',
    name: 'Sovereign',
    description: CERTIFICATION_TIER_DESCRIPTIONS[CertificationTier.T5_SOVEREIGN],
    scoreRange: CERTIFICATION_TIER_SCORES[CertificationTier.T5_SOVEREIGN],
    requiredAttestations: ['identity', 'capability_test', 'third_party_audit', 'continuous_monitoring', 'sovereign_certification'],
    maxCapabilityLevel: 5,
  },
} as const;

/**
 * Configuration for a runtime tier.
 */
export interface RuntimeTierConfig {
  /** The runtime tier */
  readonly tier: RuntimeTier;
  /** Short code (T0-T5) */
  readonly code: string;
  /** Human-readable name */
  readonly name: string;
  /** Detailed description */
  readonly description: string;
  /** Trust score range */
  readonly scoreRange: { min: number; max: number };
  /** Whether human approval is required for actions */
  readonly requiresApproval: boolean;
  /** Whether operations are constrained by guardrails */
  readonly hasGuardrails: boolean;
  /** Whether autonomous operation is permitted */
  readonly allowsAutonomy: boolean;
}

/**
 * Configuration for all runtime tiers.
 */
export const RUNTIME_TIER_CONFIGS: Readonly<Record<RuntimeTier, RuntimeTierConfig>> = {
  [RuntimeTier.T0_SANDBOX]: {
    tier: RuntimeTier.T0_SANDBOX,
    code: 'T0',
    name: 'Sandbox',
    description: RUNTIME_TIER_DESCRIPTIONS[RuntimeTier.T0_SANDBOX],
    scoreRange: RUNTIME_TIER_SCORES[RuntimeTier.T0_SANDBOX],
    requiresApproval: false, // No approval needed - everything is isolated
    hasGuardrails: true,
    allowsAutonomy: false,
  },
  [RuntimeTier.T1_SUPERVISED]: {
    tier: RuntimeTier.T1_SUPERVISED,
    code: 'T1',
    name: 'Supervised',
    description: RUNTIME_TIER_DESCRIPTIONS[RuntimeTier.T1_SUPERVISED],
    scoreRange: RUNTIME_TIER_SCORES[RuntimeTier.T1_SUPERVISED],
    requiresApproval: true,
    hasGuardrails: true,
    allowsAutonomy: false,
  },
  [RuntimeTier.T2_CONSTRAINED]: {
    tier: RuntimeTier.T2_CONSTRAINED,
    code: 'T2',
    name: 'Constrained',
    description: RUNTIME_TIER_DESCRIPTIONS[RuntimeTier.T2_CONSTRAINED],
    scoreRange: RUNTIME_TIER_SCORES[RuntimeTier.T2_CONSTRAINED],
    requiresApproval: false,
    hasGuardrails: true,
    allowsAutonomy: false,
  },
  [RuntimeTier.T3_TRUSTED]: {
    tier: RuntimeTier.T3_TRUSTED,
    code: 'T3',
    name: 'Trusted',
    description: RUNTIME_TIER_DESCRIPTIONS[RuntimeTier.T3_TRUSTED],
    scoreRange: RUNTIME_TIER_SCORES[RuntimeTier.T3_TRUSTED],
    requiresApproval: false,
    hasGuardrails: false,
    allowsAutonomy: false,
  },
  [RuntimeTier.T4_AUTONOMOUS]: {
    tier: RuntimeTier.T4_AUTONOMOUS,
    code: 'T4',
    name: 'Autonomous',
    description: RUNTIME_TIER_DESCRIPTIONS[RuntimeTier.T4_AUTONOMOUS],
    scoreRange: RUNTIME_TIER_SCORES[RuntimeTier.T4_AUTONOMOUS],
    requiresApproval: false,
    hasGuardrails: false,
    allowsAutonomy: true,
  },
  [RuntimeTier.T5_SOVEREIGN]: {
    tier: RuntimeTier.T5_SOVEREIGN,
    code: 'T5',
    name: 'Sovereign',
    description: RUNTIME_TIER_DESCRIPTIONS[RuntimeTier.T5_SOVEREIGN],
    scoreRange: RUNTIME_TIER_SCORES[RuntimeTier.T5_SOVEREIGN],
    requiresApproval: false,
    hasGuardrails: false,
    allowsAutonomy: true,
  },
} as const;

// ============================================================================
// Tier Comparison Helpers
// ============================================================================

/**
 * Checks if one certification tier is higher than another.
 */
export function isCertificationTierHigher(tier: CertificationTier, other: CertificationTier): boolean {
  return tier > other;
}

/**
 * Checks if a certification tier meets a minimum requirement.
 */
export function meetsCertificationTier(tier: CertificationTier, minTier: CertificationTier): boolean {
  return tier >= minTier;
}

/**
 * Compares two certification tiers.
 */
export function compareCertificationTiers(a: CertificationTier, b: CertificationTier): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Checks if one runtime tier is higher than another.
 */
export function isRuntimeTierHigher(tier: RuntimeTier, other: RuntimeTier): boolean {
  return tier > other;
}

/**
 * Checks if a runtime tier meets a minimum requirement.
 */
export function meetsRuntimeTier(tier: RuntimeTier, minTier: RuntimeTier): boolean {
  return tier >= minTier;
}

/**
 * Compares two runtime tiers.
 */
export function compareRuntimeTiers(a: RuntimeTier, b: RuntimeTier): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ============================================================================
// Score Conversion
// ============================================================================

/**
 * Converts a trust score to a certification tier using ACI scale (0-1000).
 *
 * @param score - Trust score on 0-1000 scale
 * @returns Corresponding CertificationTier
 */
export function scoreToCertificationTier(score: number): CertificationTier {
  if (score < 0 || score > 1000) {
    throw new Error(`Trust score must be between 0 and 1000, got ${score}`);
  }

  if (score < 100) return CertificationTier.T0_UNVERIFIED;
  if (score < 300) return CertificationTier.T1_REGISTERED;
  if (score < 500) return CertificationTier.T2_TESTED;
  if (score < 700) return CertificationTier.T3_CERTIFIED;
  if (score < 900) return CertificationTier.T4_VERIFIED;
  return CertificationTier.T5_SOVEREIGN;
}

/**
 * Converts a trust score to a runtime tier using Vorion scale (0-1000).
 *
 * @param score - Trust score on 0-1000 scale
 * @returns Corresponding RuntimeTier
 */
export function scoreToRuntimeTier(score: number): RuntimeTier {
  if (score < 0 || score > 1000) {
    throw new Error(`Trust score must be between 0 and 1000, got ${score}`);
  }

  if (score <= 166) return RuntimeTier.T0_SANDBOX;
  if (score <= 332) return RuntimeTier.T1_SUPERVISED;
  if (score <= 499) return RuntimeTier.T2_CONSTRAINED;
  if (score <= 665) return RuntimeTier.T3_TRUSTED;
  if (score <= 832) return RuntimeTier.T4_AUTONOMOUS;
  return RuntimeTier.T5_SOVEREIGN;
}

/**
 * Gets the midpoint score for a certification tier.
 *
 * @param tier - The certification tier
 * @returns Midpoint score for the tier
 */
export function certificationTierToScore(tier: CertificationTier): number {
  const range = CERTIFICATION_TIER_SCORES[tier];
  return Math.round((range.min + range.max) / 2);
}

/**
 * Gets the midpoint score for a runtime tier.
 *
 * @param tier - The runtime tier
 * @returns Midpoint score for the tier
 */
export function runtimeTierToScore(tier: RuntimeTier): number {
  const range = RUNTIME_TIER_SCORES[tier];
  return Math.round((range.min + range.max) / 2);
}

/**
 * Gets the minimum score for a certification tier.
 */
export function getCertificationTierMinScore(tier: CertificationTier): number {
  return CERTIFICATION_TIER_SCORES[tier].min;
}

/**
 * Gets the maximum score for a certification tier.
 */
export function getCertificationTierMaxScore(tier: CertificationTier): number {
  return CERTIFICATION_TIER_SCORES[tier].max;
}

/**
 * Gets the minimum score for a runtime tier.
 */
export function getRuntimeTierMinScore(tier: RuntimeTier): number {
  return RUNTIME_TIER_SCORES[tier].min;
}

/**
 * Gets the maximum score for a runtime tier.
 */
export function getRuntimeTierMaxScore(tier: RuntimeTier): number {
  return RUNTIME_TIER_SCORES[tier].max;
}

// ============================================================================
// Tier Information Helpers
// ============================================================================

/**
 * Gets the configuration for a certification tier.
 */
export function getCertificationTierConfig(tier: CertificationTier): CertificationTierConfig {
  return CERTIFICATION_TIER_CONFIGS[tier];
}

/**
 * Gets the configuration for a runtime tier.
 */
export function getRuntimeTierConfig(tier: RuntimeTier): RuntimeTierConfig {
  return RUNTIME_TIER_CONFIGS[tier];
}

/**
 * Gets the name of a certification tier.
 */
export function getCertificationTierName(tier: CertificationTier): string {
  return CERTIFICATION_TIER_NAMES[tier];
}

/**
 * Gets the name of a runtime tier.
 */
export function getRuntimeTierName(tier: RuntimeTier): string {
  return RUNTIME_TIER_NAMES[tier];
}

/**
 * Gets the description of a certification tier.
 */
export function getCertificationTierDescription(tier: CertificationTier): string {
  return CERTIFICATION_TIER_DESCRIPTIONS[tier];
}

/**
 * Gets the description of a runtime tier.
 */
export function getRuntimeTierDescription(tier: RuntimeTier): string {
  return RUNTIME_TIER_DESCRIPTIONS[tier];
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Parses a tier string (e.g., "T3" or "3") to a CertificationTier.
 *
 * @param tierStr - Tier string to parse
 * @returns Parsed CertificationTier
 * @throws Error if the string is not a valid tier
 */
export function parseCertificationTier(tierStr: string): CertificationTier {
  const normalized = tierStr.toUpperCase().replace(/^T/, '');
  const tier = parseInt(normalized, 10);

  if (isNaN(tier) || tier < 0 || tier > 5) {
    throw new Error(`Invalid certification tier: ${tierStr}. Must be T0-T5 or 0-5.`);
  }

  return tier as CertificationTier;
}

/**
 * Parses a tier string (e.g., "T3" or "3") to a RuntimeTier.
 *
 * @param tierStr - Tier string to parse
 * @returns Parsed RuntimeTier
 * @throws Error if the string is not a valid tier
 */
export function parseRuntimeTier(tierStr: string): RuntimeTier {
  const normalized = tierStr.toUpperCase().replace(/^T/, '');
  const tier = parseInt(normalized, 10);

  if (isNaN(tier) || tier < 0 || tier > 5) {
    throw new Error(`Invalid runtime tier: ${tierStr}. Must be T0-T5 or 0-5.`);
  }

  return tier as RuntimeTier;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid CertificationTier.
 */
export function isCertificationTier(value: unknown): value is CertificationTier {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 5
  );
}

/**
 * Type guard to check if a value is a valid RuntimeTier.
 */
export function isRuntimeTier(value: unknown): value is RuntimeTier {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 5
  );
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Zod schema for certification tier configuration.
 */
export const certificationTierConfigSchema = z.object({
  tier: certificationTierSchema,
  code: z.string().regex(/^T[0-5]$/),
  name: z.string().min(1),
  description: z.string().min(1),
  scoreRange: z.object({
    min: z.number().int().min(0).max(1000),
    max: z.number().int().min(0).max(1000),
  }),
  requiredAttestations: z.array(z.string()).readonly(),
  maxCapabilityLevel: z.number().int().min(0).max(5),
});

/**
 * Zod schema for runtime tier configuration.
 */
export const runtimeTierConfigSchema = z.object({
  tier: runtimeTierSchema,
  code: z.string().regex(/^T[0-5]$/),
  name: z.string().min(1),
  description: z.string().min(1),
  scoreRange: z.object({
    min: z.number().int().min(0).max(1000),
    max: z.number().int().min(0).max(1000),
  }),
  requiresApproval: z.boolean(),
  hasGuardrails: z.boolean(),
  allowsAutonomy: z.boolean(),
});

/**
 * Zod schema for parsing tier strings.
 */
export const tierStringSchema = z
  .string()
  .regex(/^[Tt]?[0-5]$/, 'Tier must be T0-T5 or 0-5');

/**
 * Zod schema for parsing and transforming to CertificationTier.
 */
export const certificationTierStringSchema = tierStringSchema.transform((str) =>
  parseCertificationTier(str)
);

/**
 * Zod schema for parsing and transforming to RuntimeTier.
 */
export const runtimeTierStringSchema = tierStringSchema.transform((str) =>
  parseRuntimeTier(str)
);
