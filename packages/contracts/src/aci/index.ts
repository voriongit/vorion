/**
 * @fileoverview ACI Types Module
 *
 * Comprehensive type definitions and utilities for the Agent Classification
 * Identifier (ACI) specification, integrated with the Vorion Platform.
 *
 * This module provides:
 * - ACI string parsing and generation
 * - Domain codes and bitmask operations
 * - Capability levels (L0-L5)
 * - Certification tiers (external attestation)
 * - Runtime tiers (deployment autonomy)
 * - Attestation types and verification
 * - Agent identity types
 * - JWT claims for OIDC integration
 * - Effective permission calculation
 * - Cross-system mappings
 *
 * @example
 * ```typescript
 * import {
 *   parseACI,
 *   generateACI,
 *   CapabilityLevel,
 *   CertificationTier,
 *   RuntimeTier,
 *   calculateEffectivePermission,
 * } from '@vorion/contracts/aci';
 *
 * // Parse an ACI string
 * const parsed = parseACI('a3i.acme-corp.invoice-bot:ABF-L3@1.0.0');
 *
 * // Generate an ACI string (trust is NOT embedded - computed at runtime)
 * const aci = generateACI({
 *   registry: 'a3i',
 *   organization: 'acme-corp',
 *   agentClass: 'invoice-bot',
 *   domains: ['A', 'B', 'F'],
 *   level: CapabilityLevel.L3_EXECUTE,
 *   version: '1.0.0',
 * });
 * // Result: 'a3i.acme-corp.invoice-bot:ABF-L3@1.0.0'
 *
 * // Calculate effective permission
 * const permission = calculateEffectivePermission({
 *   certificationTier: CertificationTier.T3_CERTIFIED,
 *   competenceLevel: CapabilityLevel.L4_AUTONOMOUS,
 *   runtimeTier: RuntimeTier.T3_TRUSTED,
 *   observabilityCeiling: 4,
 *   contextPolicyCeiling: 3,
 * });
 * ```
 *
 * @module @vorion/contracts/aci
 * @packageDocumentation
 */

// ============================================================================
// Domain Codes and Bitmask
// ============================================================================

export {
  // Types
  type DomainCode,
  type DomainDefinition,
  // Constants
  DOMAIN_CODES,
  CAPABILITY_DOMAINS,
  DOMAIN_NAMES,
  ALL_DOMAINS_BITMASK,
  // Functions
  encodeDomains,
  decodeDomains,
  parseDomainString,
  formatDomainString,
  hasDomains,
  satisfiesDomainRequirements,
  intersectDomains,
  unionDomains,
  differenceDomains,
  getDomainDefinition,
  getDomainName,
  getDomainBit,
  countDomains,
  isDomainCode,
  isDomainCodeArray,
  // Zod Schemas
  domainCodeSchema,
  domainDefinitionSchema,
  domainCodeArraySchema,
  domainBitmaskSchema,
  domainStringSchema,
} from './domains.js';

// ============================================================================
// Skill Codes and Bitmask
// ============================================================================

export {
  // Types
  type SkillCode,
  type SkillCategory,
  type SkillDefinition,
  // Constants
  SKILL_CODES,
  SKILL_DEFINITIONS,
  SKILL_NAMES,
  ALL_SKILLS_BITMASK,
  SKILLS_BY_CATEGORY,
  LEGACY_ID_TO_SKILL,
  // Functions
  encodeSkills,
  decodeSkills,
  parseSkillString,
  formatSkillString,
  hasSkills,
  satisfiesSkillRequirements,
  intersectSkills,
  unionSkills,
  differenceSkills,
  getSkillDefinition,
  getSkillName,
  getSkillBit,
  getSkillCategory,
  getSkillsInCategory,
  countSkills,
  isSkillCode,
  isSkillCodeArray,
  legacyIdToSkillCode,
  legacyIdsToSkillCodes,
  // Zod Schemas
  skillCodeSchema,
  skillDefinitionSchema,
  skillCodeArraySchema,
  skillBitmaskSchema,
  skillStringSchema,
} from './skills.js';

// ============================================================================
// Capability Levels (L0-L5)
// ============================================================================

export {
  // Types/Enums
  CapabilityLevel,
  type CapabilityLevelConfig,
  // Constants
  CAPABILITY_LEVELS,
  CAPABILITY_LEVEL_NAMES,
  CAPABILITY_LEVEL_CODES,
  CAPABILITY_LEVEL_DESCRIPTIONS,
  CAPABILITY_LEVEL_ABILITIES,
  CAPABILITY_LEVEL_CONFIGS,
  // Functions
  isLevelHigher,
  meetsLevel,
  compareLevels,
  minLevel,
  maxLevel,
  clampLevel,
  getLevelConfig,
  getLevelName,
  getLevelCode,
  getLevelDescription,
  hasAbility,
  requiresApproval,
  canOperateAutonomously,
  parseLevel,
  tryParseLevel,
  isCapabilityLevel,
  // Zod Schemas
  capabilityLevelSchema,
  capabilityLevelConfigSchema,
  levelStringSchema,
} from './levels.js';

// ============================================================================
// Certification and Runtime Tiers (T0-T5)
// ============================================================================

export {
  // Types/Enums
  CertificationTier,
  RuntimeTier,
  type CertificationTierConfig,
  type RuntimeTierConfig,
  // Constants
  CERTIFICATION_TIERS,
  RUNTIME_TIERS,
  CERTIFICATION_TIER_NAMES,
  RUNTIME_TIER_NAMES,
  CERTIFICATION_TIER_DESCRIPTIONS,
  RUNTIME_TIER_DESCRIPTIONS,
  CERTIFICATION_TIER_SCORES,
  RUNTIME_TIER_SCORES,
  CERTIFICATION_TIER_CONFIGS,
  RUNTIME_TIER_CONFIGS,
  // Functions
  isCertificationTierHigher,
  meetsCertificationTier,
  compareCertificationTiers,
  isRuntimeTierHigher,
  meetsRuntimeTier,
  compareRuntimeTiers,
  scoreToCertificationTier,
  scoreToRuntimeTier,
  certificationTierToScore,
  runtimeTierToScore,
  getCertificationTierMinScore,
  getCertificationTierMaxScore,
  getRuntimeTierMinScore,
  getRuntimeTierMaxScore,
  getCertificationTierConfig,
  getRuntimeTierConfig,
  getCertificationTierName,
  getRuntimeTierName,
  getCertificationTierDescription,
  getRuntimeTierDescription,
  parseCertificationTier,
  parseRuntimeTier,
  isCertificationTier,
  isRuntimeTier,
  // Zod Schemas
  certificationTierSchema,
  runtimeTierSchema,
  certificationTierConfigSchema,
  runtimeTierConfigSchema,
  tierStringSchema,
  certificationTierStringSchema,
  runtimeTierStringSchema,
} from './tiers.js';

// ============================================================================
// ACI String Parser and Generator
// ============================================================================

export {
  // Types
  type ParsedACI,
  type ACIIdentity,
  type ACIParseErrorCode,
  type GenerateACIOptions,
  type ACIValidationError,
  type ACIValidationWarning,
  type ACIValidationResult,
  // Constants
  ACI_REGEX,
  ACI_PARTIAL_REGEX,
  ACI_LEGACY_REGEX,
  // Classes
  ACIParseError,
  // Functions
  parseACI,
  parseLegacyACI,
  tryParseACI,
  safeParseACI,
  generateACI,
  generateACIString,
  validateACI,
  isValidACI,
  isACIString,
  updateACI,
  addACIExtensions,
  removeACIExtensions,
  incrementACIVersion,
  getACIIdentity,
  // Zod Schemas
  parsedACISchema,
  aciStringSchema,
  aciSchema,
  generateACIOptionsSchema,
  aciValidationErrorSchema,
  aciValidationWarningSchema,
  aciValidationResultSchema,
} from './aci-string.js';

// ============================================================================
// Attestation Types
// ============================================================================

export {
  // Types
  type AttestationScope,
  type AttestationStatus,
  type AttestationEvidence,
  type AttestationProof,
  type Attestation,
  type AttestationVerificationResult,
  type AttestationVerificationError,
  type AttestationVerificationErrorCode,
  type AttestationVerificationWarning,
  type CreateAttestationOptions,
  // Constants
  ATTESTATION_SCOPES,
  ATTESTATION_SCOPE_DESCRIPTIONS,
  // Functions
  createAttestation,
  verifyAttestation,
  isAttestationValid,
  getAttestationRemainingValidity,
  attestationCoversDomain,
  isAttestationScope,
  isAttestationStatus,
  // Zod Schemas
  attestationScopeSchema,
  attestationStatusSchema,
  attestationEvidenceSchema,
  attestationProofSchema,
  attestationSchema,
  attestationVerificationErrorSchema,
  attestationVerificationWarningSchema,
  attestationVerificationResultSchema,
} from './attestation.js';

// ============================================================================
// Agent Identity Types
// ============================================================================

export {
  // Types
  type CapabilityVector,
  type AgentMetadata,
  type VerificationMethod,
  type ServiceEndpoint,
  type AgentIdentity,
  type AgentIdentitySummary,
  type AgentRegistrationOptions,
  type AgentMatchCriteria,
  // Functions
  createAgentIdentity,
  toAgentIdentitySummary,
  matchesAgentCriteria,
  capabilityVectorSatisfies,
  isCapabilityVector,
  isAgentIdentity,
  isAgentIdentitySummary,
  // Zod Schemas
  capabilityVectorSchema,
  agentMetadataSchema,
  verificationMethodSchema,
  serviceEndpointSchema,
  agentIdentitySchema,
  agentIdentitySummarySchema,
  agentRegistrationOptionsSchema,
  agentMatchCriteriaSchema,
} from './identity.js';

// ============================================================================
// JWT Claims (OpenID Connect)
// ============================================================================

export {
  // Types
  type StandardJWTClaims,
  type ACIJWTClaims,
  type ACIAttestationClaim,
  type ACIConstraintsClaim,
  type JWTClaimsValidationError,
  type JWTClaimsErrorCode,
  type JWTClaimsValidationResult,
  type GenerateJWTClaimsOptions,
  // Functions
  generateJWTClaims,
  generateMinimalJWTClaims,
  validateJWTClaims,
  extractCapabilityFromClaims,
  extractIdentityFromClaims,
  claimsHaveDomain,
  claimsMeetRequirements,
  // Zod Schemas
  standardJWTClaimsSchema,
  aciAttestationClaimSchema,
  aciConstraintsClaimSchema,
  aciJWTClaimsSchema,
  jwtClaimsValidationOptionsSchema,
  jwtClaimsValidationErrorSchema,
  jwtClaimsValidationResultSchema,
} from './jwt-claims.js';

// ============================================================================
// Effective Permission Calculation
// ============================================================================

export {
  // Types
  type EffectivePermissionContext,
  type EffectivePermission,
  type ConstrainingFactor,
  type PermissionCeilings,
  type PermissionCheckResult,
  // Functions
  calculateEffectivePermission,
  permissionAllowsLevel,
  contextAllowsLevel,
  checkPermission,
  modifyContextCeiling,
  calculateRequiredChanges,
  createDefaultContext,
  createMaxPermissionContext,
  isEffectivePermissionContext,
  isEffectivePermission,
  // Zod Schemas
  effectivePermissionContextSchema,
  constrainingFactorSchema,
  permissionCeilingsSchema,
  effectivePermissionSchema,
  permissionCheckResultSchema,
} from './effective-permission.js';

// ============================================================================
// Cross-System Mappings
// ============================================================================

export {
  // Types
  type VorionNamespace,
  type BidirectionalMap,
  TrustBand,
  // Constants
  VORION_NAMESPACES,
  DOMAIN_TO_NAMESPACE_MAP,
  NAMESPACE_TO_DOMAIN_MAP,
  CERTIFICATION_TO_RUNTIME_TIER_MAP,
  RUNTIME_TO_CERTIFICATION_TIER_MAP,
  domainNamespaceMap,
  certificationRuntimeMap,
  // Functions
  certificationTierToRuntimeTier,
  runtimeTierToCertificationTier,
  trustBandToCertificationTier,
  trustBandToRuntimeTier,
  certificationTierToTrustBand,
  runtimeTierToTrustBand,
  scoreToBothTiers,
  normalizeScoreBetweenScales,
  aciDomainToVorionNamespace,
  vorionNamespaceToAciDomain,
  aciDomainsToVorionNamespaces,
  vorionNamespacesToAciDomains,
  capabilityLevelToAutonomyDescription,
  capabilityLevelToMinRuntimeTier,
  createBidirectionalMap,
  isVorionNamespace,
  isTrustBand,
  // Zod Schemas
  trustBandSchema,
  vorionNamespaceSchema,
  tierMappingResultSchema,
  domainMappingResultSchema,
} from './mapping.js';
