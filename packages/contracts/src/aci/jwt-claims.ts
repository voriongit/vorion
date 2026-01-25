/**
 * @fileoverview ACI JWT Claims for OpenID Connect
 *
 * Defines JWT claim structures for ACI-aware authentication and authorization.
 * These claims extend standard OIDC claims with ACI-specific information,
 * enabling capability-based access control in JWT tokens.
 *
 * @module @vorion/contracts/aci/jwt-claims
 */

import { z } from 'zod';
import { type DomainCode, domainCodeArraySchema } from './domains.js';
import { CapabilityLevel, capabilityLevelSchema } from './levels.js';
import { CertificationTier, certificationTierSchema, RuntimeTier, runtimeTierSchema } from './tiers.js';
import { type ParsedACI } from './aci-string.js';

// ============================================================================
// Standard JWT Claims
// ============================================================================

/**
 * Standard JWT claims (RFC 7519).
 */
export interface StandardJWTClaims {
  /** Issuer */
  iss?: string;
  /** Subject */
  sub?: string;
  /** Audience */
  aud?: string | string[];
  /** Expiration time (Unix timestamp) */
  exp?: number;
  /** Not before (Unix timestamp) */
  nbf?: number;
  /** Issued at (Unix timestamp) */
  iat?: number;
  /** JWT ID */
  jti?: string;
}

/**
 * Zod schema for StandardJWTClaims.
 */
export const standardJWTClaimsSchema = z.object({
  iss: z.string().optional(),
  sub: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  exp: z.number().int().positive().optional(),
  nbf: z.number().int().positive().optional(),
  iat: z.number().int().positive().optional(),
  jti: z.string().optional(),
});

// ============================================================================
// ACI JWT Claims
// ============================================================================

/**
 * ACI-specific JWT claims.
 *
 * These claims encode agent capabilities in JWT tokens for use in
 * authentication and authorization flows.
 *
 * NOTE: `aci_trust` is OPTIONAL because trust tier is NOT embedded in the ACI.
 * Trust comes from attestations at runtime. If attestations are included,
 * the highest valid attestation tier should be used for `aci_trust`.
 */
export interface ACIJWTClaims extends StandardJWTClaims {
  /** Full ACI string (immutable identifier, no trust info) */
  aci: string;
  /** Domain bitmask for efficient validation */
  aci_domains: number;
  /** Domain codes array for readability */
  aci_domains_list: DomainCode[];
  /** Capability level */
  aci_level: CapabilityLevel;
  /**
   * Certification tier from attestations (OPTIONAL).
   * This is NOT from the ACI itself - it comes from valid attestations.
   * Defaults to T0 if no attestations exist.
   */
  aci_trust?: CertificationTier;
  /** Registry */
  aci_registry: string;
  /** Organization */
  aci_org: string;
  /** Agent class */
  aci_class: string;
  /** ACI version */
  aci_version: string;
  /** Agent DID (optional) */
  aci_did?: string;
  /** Runtime tier in current context (optional) */
  aci_runtime_tier?: RuntimeTier;
  /** Attestation summaries - source of aci_trust value */
  aci_attestations?: ACIAttestationClaim[];
  /** Effective permission ceiling (optional) */
  aci_permission_ceiling?: number;
  /** Session-specific constraints (optional) */
  aci_constraints?: ACIConstraintsClaim;
}

/**
 * Attestation claim for JWT.
 */
/**
 * Attestation claim for JWT.
 * Attestations are the SOURCE of trust tier, not the ACI.
 */
export interface ACIAttestationClaim {
  /** Issuer DID */
  iss: string;
  /** Certified trust tier from this attestation */
  tier: CertificationTier;
  /** Attestation scope (domains covered) */
  scope: string;
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Expiration (Unix timestamp) */
  exp: number;
  /** Evidence URL (optional) */
  evidence?: string;
}

/**
 * Constraints claim for session-specific limitations.
 */
export interface ACIConstraintsClaim {
  /** Maximum operations allowed in this session */
  max_operations?: number;
  /** Allowed resource patterns */
  allowed_resources?: string[];
  /** Blocked resource patterns */
  blocked_resources?: string[];
  /** Time window end (Unix timestamp) */
  valid_until?: number;
  /** Required human approval for actions */
  requires_approval?: boolean;
  /** Custom constraints */
  custom?: Record<string, unknown>;
}

/**
 * Zod schema for ACIAttestationClaim.
 */
export const aciAttestationClaimSchema = z.object({
  iss: z.string().min(1),
  tier: certificationTierSchema,
  scope: z.string().min(1),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
  evidence: z.string().url().optional(),
});

/**
 * Zod schema for ACIConstraintsClaim.
 */
export const aciConstraintsClaimSchema = z.object({
  max_operations: z.number().int().positive().optional(),
  allowed_resources: z.array(z.string()).optional(),
  blocked_resources: z.array(z.string()).optional(),
  valid_until: z.number().int().positive().optional(),
  requires_approval: z.boolean().optional(),
  custom: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for ACIJWTClaims validation.
 */
export const aciJWTClaimsSchema = standardJWTClaimsSchema.extend({
  aci: z.string().min(1),
  aci_domains: z.number().int().min(0),
  aci_domains_list: domainCodeArraySchema,
  aci_level: capabilityLevelSchema,
  // aci_trust is optional - comes from attestations, not the ACI itself
  aci_trust: certificationTierSchema.optional(),
  aci_registry: z.string().min(1),
  aci_org: z.string().min(1),
  aci_class: z.string().min(1),
  aci_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  aci_did: z.string().optional(),
  aci_runtime_tier: runtimeTierSchema.optional(),
  aci_attestations: z.array(aciAttestationClaimSchema).optional(),
  aci_permission_ceiling: z.number().int().min(0).max(5).optional(),
  aci_constraints: aciConstraintsClaimSchema.optional(),
});

// ============================================================================
// JWT Claims Generation
// ============================================================================

/**
 * Options for generating JWT claims.
 */
export interface GenerateJWTClaimsOptions {
  /** Parsed ACI */
  parsed: ParsedACI;
  /** Agent DID (optional) */
  did?: string;
  /** Issuer (optional) */
  issuer?: string;
  /** Audience (optional) */
  audience?: string | string[];
  /** Validity duration in seconds (default: 1 hour) */
  validitySeconds?: number;
  /** Runtime tier (optional) */
  runtimeTier?: RuntimeTier;
  /** Attestation claims (optional) */
  attestations?: ACIAttestationClaim[];
  /** Permission ceiling (optional) */
  permissionCeiling?: number;
  /** Constraints (optional) */
  constraints?: ACIConstraintsClaim;
}

/**
 * Generates JWT claims from a parsed ACI.
 *
 * @param options - Generation options
 * @returns ACI JWT claims
 *
 * @example
 * ```typescript
 * const claims = generateJWTClaims({
 *   parsed: parseACI('a3i.acme-corp.invoice-bot:ABF-L3@1.0.0'),
 *   did: 'did:web:agent.acme.com',
 *   issuer: 'did:web:auth.acme.com',
 *   validitySeconds: 3600,
 * });
 * ```
 */
export function generateJWTClaims(options: GenerateJWTClaimsOptions): ACIJWTClaims {
  const {
    parsed,
    did,
    issuer,
    audience,
    validitySeconds = 3600,
    runtimeTier,
    attestations,
    permissionCeiling,
    constraints,
  } = options;

  const now = Math.floor(Date.now() / 1000);

  return {
    // Standard claims
    iss: issuer,
    sub: did ?? parsed.aci,
    aud: audience,
    iat: now,
    nbf: now,
    exp: now + validitySeconds,
    jti: crypto.randomUUID(),

    // ACI claims (identity only - trust comes from attestations)
    aci: parsed.aci,
    aci_domains: parsed.domainsBitmask,
    aci_domains_list: [...parsed.domains],
    aci_level: parsed.level,
    // NOTE: aci_trust is derived from attestations, not the ACI
    // Compute highest valid attestation tier if attestations provided
    aci_trust: attestations && attestations.length > 0
      ? (Math.max(...attestations.map((a) => a.tier)) as CertificationTier)
      : undefined,
    aci_registry: parsed.registry,
    aci_org: parsed.organization,
    aci_class: parsed.agentClass,
    aci_version: parsed.version,
    aci_did: did,
    aci_runtime_tier: runtimeTier,
    aci_attestations: attestations,
    aci_permission_ceiling: permissionCeiling,
    aci_constraints: constraints,
  };
}

/**
 * Generates minimal JWT claims from a parsed ACI.
 *
 * NOTE: aci_trust is NOT included because trust comes from attestations,
 * not the ACI itself. Use generateJWTClaims with attestations for full claims.
 *
 * @param parsed - Parsed ACI
 * @param did - Optional agent DID
 * @returns Minimal ACI JWT claims (without trust tier)
 */
export function generateMinimalJWTClaims(parsed: ParsedACI, did?: string): ACIJWTClaims {
  const now = Math.floor(Date.now() / 1000);

  return {
    iat: now,
    aci: parsed.aci,
    aci_domains: parsed.domainsBitmask,
    aci_domains_list: [...parsed.domains],
    aci_level: parsed.level,
    // aci_trust intentionally omitted - comes from attestations at runtime
    aci_registry: parsed.registry,
    aci_org: parsed.organization,
    aci_class: parsed.agentClass,
    aci_version: parsed.version,
    aci_did: did,
  };
}

// ============================================================================
// JWT Claims Validation
// ============================================================================

/**
 * Validation error for JWT claims.
 */
export interface JWTClaimsValidationError {
  /** Error code */
  code: JWTClaimsErrorCode;
  /** Human-readable message */
  message: string;
  /** Claim path (if applicable) */
  path?: string;
}

/**
 * Error codes for JWT claims validation.
 */
export type JWTClaimsErrorCode =
  | 'MISSING_ACI'
  | 'INVALID_ACI'
  | 'EXPIRED'
  | 'NOT_YET_VALID'
  | 'INVALID_DOMAINS'
  | 'INVALID_LEVEL'
  | 'INVALID_TIER'
  | 'DOMAINS_MISMATCH'
  | 'INVALID_FORMAT';

/**
 * Result of JWT claims validation.
 */
export interface JWTClaimsValidationResult {
  /** Whether the claims are valid */
  valid: boolean;
  /** Validation errors */
  errors: JWTClaimsValidationError[];
  /** Validated claims (if valid) */
  claims?: ACIJWTClaims;
}

/**
 * Validates ACI JWT claims.
 *
 * @param claims - Claims to validate
 * @param options - Validation options
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateJWTClaims(claims, {
 *   checkExpiry: true,
 *   validateDomainsMismatch: true,
 * });
 * ```
 */
export function validateJWTClaims(
  claims: unknown,
  options: {
    checkExpiry?: boolean;
    validateDomainsMismatch?: boolean;
  } = {}
): JWTClaimsValidationResult {
  const errors: JWTClaimsValidationError[] = [];
  const { checkExpiry = true, validateDomainsMismatch = true } = options;

  // Parse with Zod
  const parseResult = aciJWTClaimsSchema.safeParse(claims);

  if (!parseResult.success) {
    return {
      valid: false,
      errors: parseResult.error.issues.map((issue) => ({
        code: 'INVALID_FORMAT' as const,
        message: issue.message,
        path: issue.path.join('.'),
      })),
    };
  }

  const parsed = parseResult.data;
  const now = Math.floor(Date.now() / 1000);

  // Check expiry
  if (checkExpiry) {
    if (parsed.exp && parsed.exp < now) {
      errors.push({
        code: 'EXPIRED',
        message: `Token expired at ${new Date(parsed.exp * 1000).toISOString()}`,
      });
    }

    if (parsed.nbf && parsed.nbf > now) {
      errors.push({
        code: 'NOT_YET_VALID',
        message: `Token not valid until ${new Date(parsed.nbf * 1000).toISOString()}`,
      });
    }
  }

  // Validate domains bitmask matches domains list
  if (validateDomainsMismatch) {
    const expectedBitmask = parsed.aci_domains_list.reduce((mask, code) => {
      const bits: Record<DomainCode, number> = {
        A: 0x001, B: 0x002, C: 0x004, D: 0x008, E: 0x010,
        F: 0x020, G: 0x040, H: 0x080, I: 0x100, S: 0x200,
      };
      return mask | bits[code];
    }, 0);

    if (expectedBitmask !== parsed.aci_domains) {
      errors.push({
        code: 'DOMAINS_MISMATCH',
        message: `Domain bitmask ${parsed.aci_domains} does not match domains list (expected ${expectedBitmask})`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    claims: errors.length === 0 ? parsed : undefined,
  };
}

// ============================================================================
// JWT Claims Extraction
// ============================================================================

/**
 * Extracts capability information from JWT claims.
 *
 * NOTE: certificationTier is optional because it comes from attestations,
 * not the ACI. If no attestations are present, it will be undefined.
 *
 * @param claims - ACI JWT claims
 * @returns Capability information
 */
export function extractCapabilityFromClaims(claims: ACIJWTClaims): {
  domains: DomainCode[];
  domainsBitmask: number;
  level: CapabilityLevel;
  certificationTier?: CertificationTier;
  runtimeTier?: RuntimeTier;
} {
  return {
    domains: claims.aci_domains_list,
    domainsBitmask: claims.aci_domains,
    level: claims.aci_level,
    certificationTier: claims.aci_trust, // Optional - from attestations
    runtimeTier: claims.aci_runtime_tier,
  };
}

/**
 * Extracts identity information from JWT claims.
 *
 * @param claims - ACI JWT claims
 * @returns Identity information
 */
export function extractIdentityFromClaims(claims: ACIJWTClaims): {
  aci: string;
  did?: string;
  registry: string;
  organization: string;
  agentClass: string;
  version: string;
} {
  return {
    aci: claims.aci,
    did: claims.aci_did,
    registry: claims.aci_registry,
    organization: claims.aci_org,
    agentClass: claims.aci_class,
    version: claims.aci_version,
  };
}

/**
 * Checks if claims have specific domain capability.
 *
 * @param claims - ACI JWT claims
 * @param domain - Domain to check
 * @returns True if the domain is present
 */
export function claimsHaveDomain(claims: ACIJWTClaims, domain: DomainCode): boolean {
  const bits: Record<DomainCode, number> = {
    A: 0x001, B: 0x002, C: 0x004, D: 0x008, E: 0x010,
    F: 0x020, G: 0x040, H: 0x080, I: 0x100, S: 0x200,
  };
  return (claims.aci_domains & bits[domain]) !== 0;
}

/**
 * Checks if claims meet minimum capability requirements.
 *
 * @param claims - ACI JWT claims
 * @param requirements - Minimum requirements
 * @returns True if requirements are met
 */
export function claimsMeetRequirements(
  claims: ACIJWTClaims,
  requirements: {
    domains?: DomainCode[];
    minLevel?: CapabilityLevel;
    minCertificationTier?: CertificationTier;
    minRuntimeTier?: RuntimeTier;
  }
): boolean {
  // Check domains
  if (requirements.domains) {
    for (const domain of requirements.domains) {
      if (!claimsHaveDomain(claims, domain)) {
        return false;
      }
    }
  }

  // Check level
  if (requirements.minLevel !== undefined && claims.aci_level < requirements.minLevel) {
    return false;
  }

  // Check certification tier (comes from attestations, may be undefined)
  if (requirements.minCertificationTier !== undefined) {
    // If no attestation-based trust, treat as T0 (unverified)
    const effectiveTrust = claims.aci_trust ?? CertificationTier.T0_UNVERIFIED;
    if (effectiveTrust < requirements.minCertificationTier) {
      return false;
    }
  }

  // Check runtime tier
  if (
    requirements.minRuntimeTier !== undefined &&
    claims.aci_runtime_tier !== undefined &&
    claims.aci_runtime_tier < requirements.minRuntimeTier
  ) {
    return false;
  }

  return true;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Zod schema for JWT claims validation options.
 */
export const jwtClaimsValidationOptionsSchema = z.object({
  checkExpiry: z.boolean().optional(),
  validateDomainsMismatch: z.boolean().optional(),
});

/**
 * Zod schema for JWTClaimsValidationError.
 */
export const jwtClaimsValidationErrorSchema = z.object({
  code: z.enum([
    'MISSING_ACI',
    'INVALID_ACI',
    'EXPIRED',
    'NOT_YET_VALID',
    'INVALID_DOMAINS',
    'INVALID_LEVEL',
    'INVALID_TIER',
    'DOMAINS_MISMATCH',
    'INVALID_FORMAT',
  ]),
  message: z.string(),
  path: z.string().optional(),
});

/**
 * Zod schema for JWTClaimsValidationResult.
 */
export const jwtClaimsValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(jwtClaimsValidationErrorSchema),
  claims: aciJWTClaimsSchema.optional(),
});
