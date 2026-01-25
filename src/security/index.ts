/**
 * Security Hardening Module
 *
 * Comprehensive security controls for ACI specification compliance.
 * Implements critical security hardening requirements including:
 *
 * - DPoP (Demonstrating Proof-of-Possession) - RFC 9449
 * - TEE (Trusted Execution Environment) binding
 * - Pairwise DID generation for privacy
 * - Revocation management with SLA enforcement
 * - Token lifetime validation
 * - Token introspection (RFC 7662)
 *
 * Security Conformance Levels:
 * - SH-1 (Basic): DPoP required, short-lived tokens (T2)
 * - SH-2 (Standard): SH-1 + pairwise DIDs, recursive revocation (T3)
 * - SH-3 (Hardened): SH-2 + TEE binding, sync revocation checks (T4-T5)
 *
 * @packageDocumentation
 * @module security
 */

// =============================================================================
// Types
// =============================================================================

export {
  // Trust Tier
  TrustTier,
  trustTierSchema,

  // Security Conformance
  SecurityConformanceLevel,
  securityConformanceLevelSchema,

  // DPoP Types
  type DPoPProof,
  type DPoPHeader,
  type DPoPConfig,
  type DPoPVerificationResult,
  dpopProofSchema,
  dpopHeaderSchema,
  dpopConfigSchema,
  dpopVerificationResultSchema,

  // TEE Types
  TEEPlatform,
  type TEEAttestation,
  type TEEKeyBinding,
  type TEEConfig,
  type TEEVerificationResult,
  teePlatformSchema,
  teeAttestationSchema,
  teeKeyBindingSchema,
  teeConfigSchema,
  teeVerificationResultSchema,

  // Pairwise DID Types
  DataClassification,
  PairwiseDerivationAlgorithm,
  type PairwiseDIDConfig,
  type PairwiseDerivation,
  dataClassificationSchema,
  pairwiseDerivationAlgorithmSchema,
  pairwiseDIDConfigSchema,
  pairwiseDerivationSchema,

  // Revocation Types
  RevocationStatusEnum,
  type RevocationSLA,
  type RevocationPropagationPolicy,
  type RevocationPropagation,
  type RevocationResult,
  type RevocationStatus,
  type RevocationEvent,
  DEFAULT_REVOCATION_SLAS,
  revocationSLASchema,
  revocationPropagationPolicySchema,
  revocationPropagationSchema,
  revocationResultSchema,
  revocationStatusSchema,
  revocationEventSchema,

  // Token Lifetime Types
  type TokenLifetimeConfig,
  DEFAULT_TOKEN_LIFETIME_CONFIG,
  tokenLifetimeConfigSchema,

  // Introspection Types
  type IntrospectionResult,
  introspectionResultSchema,

  // Security Context Types
  type AgentIdentity,
  type ActionRequest,
  type SecurityContext,
  type SecurityValidationResult,
  type SecurityValidationError,
  type PreRequestResult,
  type HighValueCheckResult,
  type SecurityRequirements,
  type IncomingRequest,
  type JTICache,
  type SecurityPluginOptions,
  agentIdentitySchema,
  actionRequestSchema,
  securityContextSchema,
  securityValidationResultSchema,
  securityValidationErrorSchema,
  preRequestResultSchema,
  highValueCheckResultSchema,
  securityRequirementsSchema,
  incomingRequestSchema,
  securityPluginOptionsSchema,

  // Utility Functions
  getSecurityRequirementsForTier,
} from './types.js';

// =============================================================================
// DPoP Service
// =============================================================================

export {
  DPoPService,
  DPoPError,
  createDPoPService,
} from './dpop.js';

// =============================================================================
// TEE Service
// =============================================================================

export {
  TEEBindingService,
  TEEError,
  TEEAttestationError,
  TEEKeyBindingError,
  createTEEBindingService,
} from './tee.js';

// =============================================================================
// Pairwise DID Service
// =============================================================================

export {
  PairwiseDIDService,
  PairwiseDIDError,
  createPairwiseDIDService,
} from './pairwise-did.js';

// =============================================================================
// Revocation Service
// =============================================================================

export {
  RevocationService,
  RevocationError,
  AgentRevokedError,
  createRevocationService,
  type RevocationEventCallback,
  type DelegationRegistry,
  type TokenService,
  type WebhookService,
} from './revocation.js';

// =============================================================================
// Token Lifetime Service
// =============================================================================

export {
  TokenLifetimeService,
  TokenLifetimeError,
  TokenExpiredError,
  TokenTTLTooLongError,
  createTokenLifetimeService,
  type TokenType,
  type JWTPayload,
  type TokenLifetimeValidationResult,
  HIGH_VALUE_OPERATIONS,
  type HighValueOperation,
} from './token-lifetime.js';

// =============================================================================
// Token Introspection Service
// =============================================================================

export {
  TokenIntrospectionService,
  IntrospectionError,
  TokenInactiveError,
  createTokenIntrospectionService,
  createMockIntrospectionService,
  type IntrospectionServiceOptions,
} from './introspection.js';

// =============================================================================
// Security Service (Main Coordinator)
// =============================================================================

export {
  SecurityService,
  SecurityValidationError as SecurityServiceValidationError,
  createSecurityService,
} from './security-service.js';

// =============================================================================
// Fastify Middleware
// =============================================================================

export {
  // Middleware factories
  dpopMiddleware,
  introspectionMiddleware,
  revocationMiddleware,
  securityContextMiddleware,
  markHighValueOperation,
  requireTier,
  requireDPoP,

  // Fastify plugin
  securityHardeningPlugin,

  // Types
  type FastifyMiddleware,
  type SecurityRequestContext,
} from './middleware.js';
