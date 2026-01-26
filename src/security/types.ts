/**
 * Security Hardening Types
 *
 * Type definitions for ACI security hardening controls including:
 * - DPoP (Demonstrating Proof-of-Possession)
 * - TEE (Trusted Execution Environment) binding
 * - Pairwise DID configuration
 * - Revocation SLA configuration
 * - Token lifetime configuration
 *
 * Based on ACI Security Hardening Specification v1.0.0
 *
 * @packageDocumentation
 */

/// <reference lib="dom" />

import { z } from 'zod';

// =============================================================================
// Trust Tier Types (aligned with ACI spec)
// =============================================================================

/**
 * Trust tiers as defined in ACI specification
 * Maps to security conformance levels:
 * - T0-T1: No minimum security (not recommended)
 * - T2: SH-1 (Basic) - DPoP, short-lived tokens
 * - T3: SH-2 (Standard) - SH-1 + pairwise DIDs, recursive revocation
 * - T4-T5: SH-3 (Hardened) - SH-2 + TEE binding, sync revocation checks
 */
export const TrustTier = {
  T0: 0,
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
  T5: 5,
} as const;

export type TrustTier = (typeof TrustTier)[keyof typeof TrustTier];

export const trustTierSchema = z.nativeEnum(TrustTier);

/**
 * Security conformance levels
 */
export const SecurityConformanceLevel = {
  NONE: 'none',
  SH1_BASIC: 'sh-1',
  SH2_STANDARD: 'sh-2',
  SH3_HARDENED: 'sh-3',
} as const;

export type SecurityConformanceLevel =
  (typeof SecurityConformanceLevel)[keyof typeof SecurityConformanceLevel];

export const securityConformanceLevelSchema = z.nativeEnum(SecurityConformanceLevel);

// =============================================================================
// DPoP (Demonstrating Proof-of-Possession) Types
// =============================================================================

/**
 * DPoP proof JWT payload structure per RFC 9449
 */
export interface DPoPProof {
  /** Unique token ID (MUST be unique, servers MUST reject replays) */
  jti: string;
  /** HTTP method (e.g., 'GET', 'POST') */
  htm: string;
  /** HTTP URI (the target endpoint) */
  htu: string;
  /** Issued at timestamp (Unix seconds) */
  iat: number;
  /** Access token hash (for bound tokens, sha256 of access token) */
  ath?: string;
}

export const dpopProofSchema = z.object({
  jti: z.string().min(1),
  htm: z.string().min(1),
  htu: z.string().url(),
  iat: z.number().int().positive(),
  ath: z.string().optional(),
});

/**
 * DPoP proof header structure
 */
export interface DPoPHeader {
  /** Type is always 'dpop+jwt' */
  typ: 'dpop+jwt';
  /** Algorithm (ES256 required, ES384/ES512 recommended) */
  alg: 'ES256' | 'ES384' | 'ES512';
  /** JWK public key */
  jwk: JsonWebKey;
}

export const dpopHeaderSchema = z.object({
  typ: z.literal('dpop+jwt'),
  alg: z.enum(['ES256', 'ES384', 'ES512']),
  jwk: z.record(z.unknown()),
});

/**
 * DPoP configuration
 */
export interface DPoPConfig {
  /** Which trust tiers require DPoP (default: T2+) */
  requiredForTiers: TrustTier[];
  /** Maximum proof age in seconds (default: 60) */
  maxProofAge: number;
  /** Whether nonce is required from server */
  nonceRequired: boolean;
  /** Maximum clock skew tolerance in seconds (default: 5) */
  clockSkewTolerance: number;
  /** Supported algorithms */
  allowedAlgorithms: ('ES256' | 'ES384' | 'ES512')[];
}

export const dpopConfigSchema = z.object({
  requiredForTiers: z.array(trustTierSchema),
  maxProofAge: z.number().int().positive().default(60),
  nonceRequired: z.boolean().default(false),
  clockSkewTolerance: z.number().int().nonnegative().default(5),
  allowedAlgorithms: z.array(z.enum(['ES256', 'ES384', 'ES512'])).default(['ES256']),
});

/**
 * DPoP verification result
 */
export interface DPoPVerificationResult {
  /** Whether verification succeeded */
  valid: boolean;
  /** JWK thumbprint of the proof key */
  keyThumbprint?: string;
  /** Error reason if verification failed */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?: 'INVALID_SIGNATURE' | 'EXPIRED' | 'REPLAY' | 'METHOD_MISMATCH' | 'URI_MISMATCH' | 'INVALID_FORMAT';
  /** Verified at timestamp */
  verifiedAt: string;
}

export const dpopVerificationResultSchema = z.object({
  valid: z.boolean(),
  keyThumbprint: z.string().optional(),
  error: z.string().optional(),
  errorCode: z.enum(['INVALID_SIGNATURE', 'EXPIRED', 'REPLAY', 'METHOD_MISMATCH', 'URI_MISMATCH', 'INVALID_FORMAT']).optional(),
  verifiedAt: z.string().datetime(),
});

// =============================================================================
// TEE (Trusted Execution Environment) Types
// =============================================================================

/**
 * Supported TEE platforms
 */
export const TEEPlatform = {
  SGX: 'sgx',
  NITRO: 'nitro',
  SEV: 'sev',
  TRUSTZONE: 'trustzone',
  SECURE_ENCLAVE: 'secure-enclave',
} as const;

export type TEEPlatform = (typeof TEEPlatform)[keyof typeof TEEPlatform];

export const teePlatformSchema = z.nativeEnum(TEEPlatform);

/**
 * TEE attestation document
 */
export interface TEEAttestation {
  /** TEE platform type */
  platform: TEEPlatform;
  /** Hash of running code (measurement) */
  measurementHash: string;
  /** Attestation timestamp */
  timestamp: Date;
  /** Enclave identifier */
  enclaveId: string;
  /** Platform Configuration Registers (for SGX/Nitro) */
  pcrs?: Record<string, string>;
  /** Attestation document signature */
  signature?: string;
  /** Certificate chain for verification */
  certificateChain?: string[];
  /** Attestation service endpoint */
  attestationEndpoint?: string;
  /** Validity period end */
  validUntil?: Date;
}

export const teeAttestationSchema = z.object({
  platform: teePlatformSchema,
  measurementHash: z.string().min(1),
  timestamp: z.coerce.date(),
  enclaveId: z.string().min(1),
  pcrs: z.record(z.string()).optional(),
  signature: z.string().optional(),
  certificateChain: z.array(z.string()).optional(),
  attestationEndpoint: z.string().url().optional(),
  validUntil: z.coerce.date().optional(),
});

/**
 * TEE key binding - binds a DID key to an enclave
 */
export interface TEEKeyBinding {
  /** DID verification method ID */
  didKeyId: string;
  /** Enclave key identifier */
  enclaveKeyId: string;
  /** Cryptographic binding proof */
  bindingProof: string;
  /** When the binding was created */
  boundAt: Date;
  /** Binding validity period */
  validUntil?: Date;
}

export const teeKeyBindingSchema = z.object({
  didKeyId: z.string().min(1),
  enclaveKeyId: z.string().min(1),
  bindingProof: z.string().min(1),
  boundAt: z.coerce.date(),
  validUntil: z.coerce.date().optional(),
});

/**
 * TEE configuration
 */
export interface TEEConfig {
  /** Which trust tiers require TEE (default: T4+) */
  requiredForTiers: TrustTier[];
  /** Allowed TEE platforms */
  allowedPlatforms: TEEPlatform[];
  /** Maximum attestation age before re-attestation required (seconds) */
  maxAttestationAge: number;
  /** Expected code measurements for verification */
  expectedMeasurements?: Record<string, string>;
  /** Attestation verification endpoint */
  attestationVerificationEndpoint?: string;
}

export const teeConfigSchema = z.object({
  requiredForTiers: z.array(trustTierSchema).default([TrustTier.T4, TrustTier.T5]),
  allowedPlatforms: z.array(teePlatformSchema).default([TEEPlatform.SGX, TEEPlatform.NITRO]),
  maxAttestationAge: z.number().int().positive().default(86400), // 24 hours
  expectedMeasurements: z.record(z.string()).optional(),
  attestationVerificationEndpoint: z.string().url().optional(),
});

/**
 * TEE verification result
 */
export interface TEEVerificationResult {
  /** Whether verification succeeded */
  valid: boolean;
  /** Verification error reason */
  reason?: string;
  /** Platform that was verified */
  platform?: TEEPlatform;
  /** Verified measurement hash */
  measurementHash?: string;
  /** Verification timestamp */
  verifiedAt: string;
  /** Whether production-grade verification was used */
  productionVerified?: boolean;
}

export const teeVerificationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  platform: teePlatformSchema.optional(),
  measurementHash: z.string().optional(),
  verifiedAt: z.string().datetime(),
  productionVerified: z.boolean().optional(),
});

// =============================================================================
// Pairwise DID Types
// =============================================================================

/**
 * Data types that may require pairwise DIDs
 */
export const DataClassification = {
  PUBLIC: 'public',
  BUSINESS: 'business',
  PERSONAL: 'personal',
  SENSITIVE: 'sensitive',
  REGULATED: 'regulated',
} as const;

export type DataClassification = (typeof DataClassification)[keyof typeof DataClassification];

export const dataClassificationSchema = z.nativeEnum(DataClassification);

/**
 * Pairwise DID derivation algorithm
 */
export const PairwiseDerivationAlgorithm = {
  SHA256: 'sha256',
  HKDF: 'hkdf',
} as const;

export type PairwiseDerivationAlgorithm =
  (typeof PairwiseDerivationAlgorithm)[keyof typeof PairwiseDerivationAlgorithm];

export const pairwiseDerivationAlgorithmSchema = z.nativeEnum(PairwiseDerivationAlgorithm);

/**
 * Pairwise DID configuration
 */
export interface PairwiseDIDConfig {
  /** Data types that require pairwise DIDs */
  requiredForDataTypes: DataClassification[];
  /** Derivation algorithm */
  derivationAlgorithm: PairwiseDerivationAlgorithm;
  /** Salt length in bytes */
  saltLength: number;
  /** Info string for HKDF derivation */
  hkdfInfo?: string;
}

export const pairwiseDIDConfigSchema = z.object({
  requiredForDataTypes: z.array(dataClassificationSchema).default([
    DataClassification.PERSONAL,
    DataClassification.SENSITIVE,
    DataClassification.REGULATED,
  ]),
  derivationAlgorithm: pairwiseDerivationAlgorithmSchema.default(PairwiseDerivationAlgorithm.HKDF),
  saltLength: z.number().int().min(16).default(32),
  hkdfInfo: z.string().default('aci-pairwise-did-v1'),
});

/**
 * Pairwise DID derivation record
 */
export interface PairwiseDerivation {
  /** Agent's root/master DID */
  masterDid: string;
  /** Relying party's DID */
  relyingPartyDid: string;
  /** Random salt for this relationship */
  contextSalt: string;
  /** Derived pairwise DID */
  derivedDid: string;
  /** When the derivation was created */
  createdAt: Date;
}

export const pairwiseDerivationSchema = z.object({
  masterDid: z.string().min(1),
  relyingPartyDid: z.string().min(1),
  contextSalt: z.string().min(1),
  derivedDid: z.string().min(1),
  createdAt: z.coerce.date(),
});

// =============================================================================
// Revocation Types
// =============================================================================

/**
 * Revocation SLA configuration per trust tier
 */
export interface RevocationSLA {
  /** Trust tier this SLA applies to */
  tier: TrustTier;
  /** Maximum propagation latency in milliseconds */
  maxPropagationLatencyMs: number;
  /** Whether synchronous check is required */
  syncCheckRequired: boolean;
  /** Whether token introspection is required */
  introspectionRequired: boolean;
}

export const revocationSLASchema = z.object({
  tier: trustTierSchema,
  maxPropagationLatencyMs: z.number().int().positive(),
  syncCheckRequired: z.boolean(),
  introspectionRequired: z.boolean(),
});

/**
 * Default revocation SLAs per ACI spec
 */
export const DEFAULT_REVOCATION_SLAS: RevocationSLA[] = [
  { tier: TrustTier.T0, maxPropagationLatencyMs: 60000, syncCheckRequired: false, introspectionRequired: false },
  { tier: TrustTier.T1, maxPropagationLatencyMs: 60000, syncCheckRequired: false, introspectionRequired: false },
  { tier: TrustTier.T2, maxPropagationLatencyMs: 30000, syncCheckRequired: false, introspectionRequired: false },
  { tier: TrustTier.T3, maxPropagationLatencyMs: 10000, syncCheckRequired: false, introspectionRequired: false },
  { tier: TrustTier.T4, maxPropagationLatencyMs: 1000, syncCheckRequired: true, introspectionRequired: true },
  { tier: TrustTier.T5, maxPropagationLatencyMs: 1000, syncCheckRequired: true, introspectionRequired: true },
];

/**
 * Revocation propagation policy
 */
export interface RevocationPropagationPolicy {
  /** Whether to terminate descendant delegations */
  terminateDescendants: boolean;
  /** Grace period before termination (milliseconds) */
  gracePeriodMs: number;
  /** Whether to notify webhooks */
  notifyWebhooks: boolean;
}

export const revocationPropagationPolicySchema = z.object({
  terminateDescendants: z.boolean().default(true),
  gracePeriodMs: z.number().int().nonnegative().default(0),
  notifyWebhooks: z.boolean().default(true),
});

/**
 * Revocation request
 */
export interface RevocationPropagation {
  /** DID of agent to revoke */
  revokedDid: string;
  /** Reason for revocation */
  reason: string;
  /** Propagation policy */
  propagationPolicy: RevocationPropagationPolicy;
}

export const revocationPropagationSchema = z.object({
  revokedDid: z.string().min(1),
  reason: z.string().min(1),
  propagationPolicy: revocationPropagationPolicySchema,
});

/**
 * Revocation result
 */
export interface RevocationResult {
  /** Unique revocation ID */
  revocationId: string;
  /** DID that was revoked */
  revokedDid: string;
  /** DIDs of descendants that were also revoked */
  descendantsRevoked: string[];
  /** Number of tokens invalidated */
  tokensInvalidated: number;
  /** Whether propagation completed successfully */
  propagationComplete: boolean;
  /** Revocation timestamp */
  timestamp: Date;
}

export const revocationResultSchema = z.object({
  revocationId: z.string().uuid(),
  revokedDid: z.string().min(1),
  descendantsRevoked: z.array(z.string()),
  tokensInvalidated: z.number().int().nonnegative(),
  propagationComplete: z.boolean(),
  timestamp: z.coerce.date(),
});

/**
 * Revocation status
 */
export const RevocationStatusEnum = {
  ACTIVE: 'active',
  REVOKED: 'revoked',
  PENDING: 'pending',
} as const;

export type RevocationStatusEnum = (typeof RevocationStatusEnum)[keyof typeof RevocationStatusEnum];

export const revocationStatusEnumSchema = z.nativeEnum(RevocationStatusEnum);

/**
 * Revocation status response
 */
export interface RevocationStatus {
  /** DID being checked */
  did: string;
  /** Current status */
  status: RevocationStatusEnum;
  /** Revocation timestamp if revoked */
  revokedAt?: Date;
  /** Revocation reason if revoked */
  reason?: string;
  /** Whether this is from cache or sync check */
  fromCache: boolean;
  /** Cache age in milliseconds */
  cacheAgeMs?: number;
}

export const revocationStatusSchema = z.object({
  did: z.string().min(1),
  status: revocationStatusEnumSchema,
  revokedAt: z.coerce.date().optional(),
  reason: z.string().optional(),
  fromCache: z.boolean(),
  cacheAgeMs: z.number().int().nonnegative().optional(),
});

/**
 * Revocation event for webhooks/subscriptions
 */
export interface RevocationEvent {
  /** Event type */
  type: 'agent.revoked' | 'delegation.terminated' | 'token.invalidated';
  /** Revocation ID */
  revocationId: string;
  /** Affected DID */
  did: string;
  /** Revocation reason */
  reason: string;
  /** Event timestamp */
  timestamp: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export const revocationEventSchema = z.object({
  type: z.enum(['agent.revoked', 'delegation.terminated', 'token.invalidated']),
  revocationId: z.string().uuid(),
  did: z.string().min(1),
  reason: z.string().min(1),
  timestamp: z.coerce.date(),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// Token Lifetime Types
// =============================================================================

/**
 * Token lifetime configuration per ACI spec
 */
export interface TokenLifetimeConfig {
  /** Access token maximum TTL in seconds (default: 300 = 5 min) */
  accessTokenMaxTTL: number;
  /** Refresh token maximum TTL in seconds (default: 86400 = 24 hr) */
  refreshTokenMaxTTL: number;
  /** ID token maximum TTL in seconds (default: 300 = 5 min) */
  idTokenMaxTTL: number;
  /** TTL for high-value operations L3+ (default: 60 = 1 min) */
  highValueOperationTTL: number;
  /** Threshold for proactive refresh (percentage of TTL remaining) */
  refreshThreshold: number;
}

export const tokenLifetimeConfigSchema = z.object({
  accessTokenMaxTTL: z.number().int().positive().default(300),
  refreshTokenMaxTTL: z.number().int().positive().default(86400),
  idTokenMaxTTL: z.number().int().positive().default(300),
  highValueOperationTTL: z.number().int().positive().default(60),
  refreshThreshold: z.number().min(0).max(1).default(0.2), // Refresh when 20% TTL remaining
});

/**
 * Default token lifetime configuration
 */
export const DEFAULT_TOKEN_LIFETIME_CONFIG: TokenLifetimeConfig = {
  accessTokenMaxTTL: 300, // 5 minutes
  refreshTokenMaxTTL: 86400, // 24 hours
  idTokenMaxTTL: 300, // 5 minutes
  highValueOperationTTL: 60, // 1 minute
  refreshThreshold: 0.2,
};

// =============================================================================
// Token Introspection Types
// =============================================================================

/**
 * Token introspection result per RFC 7662
 */
export interface IntrospectionResult {
  /** Whether the token is active */
  active: boolean;
  /** Token scope */
  scope?: string;
  /** Client ID */
  clientId?: string;
  /** Username (subject) */
  username?: string;
  /** Token type */
  tokenType?: string;
  /** Expiration timestamp */
  exp?: number;
  /** Issued at timestamp */
  iat?: number;
  /** Not before timestamp */
  nbf?: number;
  /** Subject identifier */
  sub?: string;
  /** Audience */
  aud?: string | string[];
  /** Issuer */
  iss?: string;
  /** JWT ID */
  jti?: string;
  /** DPoP key confirmation */
  cnf?: {
    jkt?: string; // JWK thumbprint
  };
  /** Introspection timestamp */
  introspectedAt: string;
  /** Whether result is from cache */
  fromCache: boolean;
}

export const introspectionResultSchema = z.object({
  active: z.boolean(),
  scope: z.string().optional(),
  clientId: z.string().optional(),
  username: z.string().optional(),
  tokenType: z.string().optional(),
  exp: z.number().int().optional(),
  iat: z.number().int().optional(),
  nbf: z.number().int().optional(),
  sub: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  iss: z.string().optional(),
  jti: z.string().optional(),
  cnf: z.object({ jkt: z.string().optional() }).optional(),
  introspectedAt: z.string().datetime(),
  fromCache: z.boolean(),
});

// =============================================================================
// Security Context Types
// =============================================================================

/**
 * Agent identity for security context
 */
export interface AgentIdentity {
  /** Agent DID */
  did: string;
  /** Trust tier */
  trustTier: TrustTier;
  /** Capability level (L0-L5) */
  capabilityLevel: number;
  /** DID document */
  didDocument?: unknown;
  /** TEE binding if present */
  teeBinding?: TEEKeyBinding;
  /** Attestation chain */
  attestationChain?: unknown[];
}

export const agentIdentitySchema = z.object({
  did: z.string().min(1),
  trustTier: trustTierSchema,
  capabilityLevel: z.number().int().min(0).max(5),
  didDocument: z.unknown().optional(),
  teeBinding: teeKeyBindingSchema.optional(),
  attestationChain: z.array(z.unknown()).optional(),
});

/**
 * Action request for security evaluation
 */
export interface ActionRequest {
  /** Request ID */
  requestId: string;
  /** HTTP method */
  method: string;
  /** Request URI */
  uri: string;
  /** Action type/name */
  actionType: string;
  /** Action level (L0-L5) */
  actionLevel: number;
  /** Domain codes */
  domains?: string[];
  /** Whether this is a high-value operation */
  isHighValue?: boolean;
  /** Data classification */
  dataClassification?: DataClassification;
}

export const actionRequestSchema = z.object({
  requestId: z.string().min(1),
  method: z.string().min(1),
  uri: z.string().min(1),
  actionType: z.string().min(1),
  actionLevel: z.number().int().min(0).max(5),
  domains: z.array(z.string()).optional(),
  isHighValue: z.boolean().optional(),
  dataClassification: dataClassificationSchema.optional(),
});

/**
 * Security context for validation
 */
export interface SecurityContext {
  /** Agent identity */
  agent: AgentIdentity;
  /** Current action request */
  request: ActionRequest;
  /** Access token */
  accessToken: string;
  /** DPoP proof if present */
  dpopProof?: string;
  /** DPoP public key */
  dpopKey?: JsonWebKey;
  /** TEE attestation if present */
  teeAttestation?: TEEAttestation;
  /** Pairwise DID if used */
  pairwiseDid?: string;
}

export const securityContextSchema = z.object({
  agent: agentIdentitySchema,
  request: actionRequestSchema,
  accessToken: z.string().min(1),
  dpopProof: z.string().optional(),
  dpopKey: z.record(z.unknown()).optional(),
  teeAttestation: teeAttestationSchema.optional(),
  pairwiseDid: z.string().optional(),
});

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: SecurityValidationError[];
  /** Applied security level */
  securityLevel: SecurityConformanceLevel;
  /** Warnings (non-fatal) */
  warnings: string[];
  /** Validation timestamp */
  validatedAt: string;
}

export interface SecurityValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Component that failed */
  component: 'dpop' | 'tee' | 'pairwise' | 'revocation' | 'token' | 'introspection';
}

export const securityValidationErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  component: z.enum(['dpop', 'tee', 'pairwise', 'revocation', 'token', 'introspection']),
});

export const securityValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(securityValidationErrorSchema),
  securityLevel: securityConformanceLevelSchema,
  warnings: z.array(z.string()),
  validatedAt: z.string().datetime(),
});

/**
 * Pre-request security check result
 */
export interface PreRequestResult {
  /** Whether request can proceed */
  allow: boolean;
  /** Required actions before proceeding */
  requiredActions?: ('dpop' | 'tee_attestation' | 'pairwise_did' | 'introspection')[];
  /** Security requirements for this request */
  requirements: SecurityRequirements;
  /** Denial reason if not allowed */
  denyReason?: string;
}

export const preRequestResultSchema = z.object({
  allow: z.boolean(),
  requiredActions: z.array(z.enum(['dpop', 'tee_attestation', 'pairwise_did', 'introspection'])).optional(),
  requirements: z.lazy(() => securityRequirementsSchema),
  denyReason: z.string().optional(),
});

/**
 * High-value operation check result
 */
export interface HighValueCheckResult {
  /** Whether operation can proceed */
  allow: boolean;
  /** Whether introspection was performed */
  introspectionPerformed: boolean;
  /** Whether revocation was checked synchronously */
  syncRevocationCheck: boolean;
  /** Token remaining TTL in seconds */
  tokenTTLRemaining?: number;
  /** Denial reason if not allowed */
  denyReason?: string;
}

export const highValueCheckResultSchema = z.object({
  allow: z.boolean(),
  introspectionPerformed: z.boolean(),
  syncRevocationCheck: z.boolean(),
  tokenTTLRemaining: z.number().int().optional(),
  denyReason: z.string().optional(),
});

/**
 * Security requirements for a trust tier
 */
export interface SecurityRequirements {
  /** Trust tier */
  tier: TrustTier;
  /** Required conformance level */
  conformanceLevel: SecurityConformanceLevel;
  /** Whether DPoP is required */
  dpopRequired: boolean;
  /** Whether TEE binding is required */
  teeRequired: boolean;
  /** Whether pairwise DIDs are required */
  pairwiseRequired: boolean;
  /** Whether sync revocation check is required */
  syncRevocationRequired: boolean;
  /** Maximum token TTL */
  maxTokenTTL: number;
  /** Maximum delegation chain depth */
  maxChainDepth: number;
}

export const securityRequirementsSchema = z.object({
  tier: trustTierSchema,
  conformanceLevel: securityConformanceLevelSchema,
  dpopRequired: z.boolean(),
  teeRequired: z.boolean(),
  pairwiseRequired: z.boolean(),
  syncRevocationRequired: z.boolean(),
  maxTokenTTL: z.number().int().positive(),
  maxChainDepth: z.number().int().min(0),
});

/**
 * Get security requirements for a trust tier
 */
export function getSecurityRequirementsForTier(tier: TrustTier): SecurityRequirements {
  switch (tier) {
    case TrustTier.T0:
    case TrustTier.T1:
      return {
        tier,
        conformanceLevel: SecurityConformanceLevel.NONE,
        dpopRequired: false,
        teeRequired: false,
        pairwiseRequired: false,
        syncRevocationRequired: false,
        maxTokenTTL: 3600, // 1 hour
        maxChainDepth: 1, // No delegation
      };
    case TrustTier.T2:
      return {
        tier,
        conformanceLevel: SecurityConformanceLevel.SH1_BASIC,
        dpopRequired: true,
        teeRequired: false,
        pairwiseRequired: false,
        syncRevocationRequired: false,
        maxTokenTTL: 300, // 5 minutes
        maxChainDepth: 2,
      };
    case TrustTier.T3:
      return {
        tier,
        conformanceLevel: SecurityConformanceLevel.SH2_STANDARD,
        dpopRequired: true,
        teeRequired: false,
        pairwiseRequired: true,
        syncRevocationRequired: false,
        maxTokenTTL: 300, // 5 minutes
        maxChainDepth: 3,
      };
    case TrustTier.T4:
    case TrustTier.T5:
      return {
        tier,
        conformanceLevel: SecurityConformanceLevel.SH3_HARDENED,
        dpopRequired: true,
        teeRequired: true,
        pairwiseRequired: true,
        syncRevocationRequired: true,
        maxTokenTTL: 300, // 5 minutes
        maxChainDepth: tier === TrustTier.T4 ? 5 : 5,
      };
    default:
      throw new Error(`Unknown trust tier: ${tier}`);
  }
}

// =============================================================================
// Incoming Request Types
// =============================================================================

/**
 * Incoming request structure for middleware
 */
export interface IncomingRequest {
  /** Request ID */
  requestId: string;
  /** HTTP method */
  method: string;
  /** Request URI */
  uri: string;
  /** Authorization header */
  authorization?: string;
  /** DPoP header */
  dpop?: string;
  /** Additional headers */
  headers: Record<string, string | string[] | undefined>;
}

export const incomingRequestSchema = z.object({
  requestId: z.string().min(1),
  method: z.string().min(1),
  uri: z.string().min(1),
  authorization: z.string().optional(),
  dpop: z.string().optional(),
  headers: z.record(z.union([z.string(), z.array(z.string()), z.undefined()])),
});

// =============================================================================
// JTI Cache Interface
// =============================================================================

/**
 * JTI cache interface for DPoP replay prevention
 */
export interface JTICache {
  /** Store JTI with expiration */
  store(jti: string, expiresAt: Date): Promise<void>;
  /** Check if JTI has been seen */
  exists(jti: string): Promise<boolean>;
}

// =============================================================================
// Middleware Plugin Options
// =============================================================================

/**
 * Security plugin options for Fastify
 */
export interface SecurityPluginOptions {
  /** DPoP configuration */
  dpop?: Partial<DPoPConfig>;
  /** TEE configuration */
  tee?: Partial<TEEConfig>;
  /** Pairwise DID configuration */
  pairwiseDid?: Partial<PairwiseDIDConfig>;
  /** Revocation SLA overrides */
  revocationSLAs?: RevocationSLA[];
  /** Token lifetime configuration */
  tokenLifetime?: Partial<TokenLifetimeConfig>;
  /** Token introspection endpoint */
  introspectionEndpoint?: string;
  /** Skip security checks for certain paths */
  skipPaths?: string[];
  /** Enable metrics collection */
  enableMetrics?: boolean;
}

export const securityPluginOptionsSchema = z.object({
  dpop: dpopConfigSchema.partial().optional(),
  tee: teeConfigSchema.partial().optional(),
  pairwiseDid: pairwiseDIDConfigSchema.partial().optional(),
  revocationSLAs: z.array(revocationSLASchema).optional(),
  tokenLifetime: tokenLifetimeConfigSchema.partial().optional(),
  introspectionEndpoint: z.string().url().optional(),
  skipPaths: z.array(z.string()).optional(),
  enableMetrics: z.boolean().optional(),
});
