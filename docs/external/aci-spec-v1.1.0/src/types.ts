/**
 * Agent Classification Identifier (ACI) - Core Types
 * 
 * @packageDocumentation
 * @module @agentanchor/aci-spec
 * @license Apache-2.0
 */

// =============================================================================
// CAPABILITY DOMAINS
// =============================================================================

/**
 * Domain codes representing capability areas
 */
export type DomainCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'S';

/**
 * Domain definitions with descriptions and bitmask values
 */
export const CAPABILITY_DOMAINS: Record<DomainCode, { name: string; bit: number; description: string }> = {
  A: { name: 'Administration', bit: 0x001, description: 'System administration, user management' },
  B: { name: 'Business', bit: 0x002, description: 'Business logic, workflows, approvals' },
  C: { name: 'Communications', bit: 0x004, description: 'Email, messaging, notifications' },
  D: { name: 'Data', bit: 0x008, description: 'Data processing, analytics, reporting' },
  E: { name: 'External', bit: 0x010, description: 'Third-party integrations, APIs' },
  F: { name: 'Finance', bit: 0x020, description: 'Financial operations, payments, accounting' },
  G: { name: 'Governance', bit: 0x040, description: 'Policy, compliance, oversight' },
  H: { name: 'Hospitality', bit: 0x080, description: 'Venue, events, catering management' },
  I: { name: 'Infrastructure', bit: 0x100, description: 'Compute, storage, networking' },
  S: { name: 'Security', bit: 0x200, description: 'Authentication, authorization, audit' },
};

/**
 * Human-readable domain names
 */
export const DOMAIN_NAMES: Record<DomainCode, string> = {
  A: 'Administration',
  B: 'Business',
  C: 'Communications',
  D: 'Data',
  E: 'External',
  F: 'Finance',
  G: 'Governance',
  H: 'Hospitality',
  I: 'Infrastructure',
  S: 'Security',
};

// =============================================================================
// CAPABILITY LEVELS
// =============================================================================

/**
 * Autonomy levels defining what an agent can do
 */
export enum CapabilityLevel {
  /** Read-only, monitoring */
  L0_OBSERVE = 0,
  /** Can suggest, recommend */
  L1_ADVISE = 1,
  /** Can prepare, stage changes */
  L2_DRAFT = 2,
  /** Can execute with human approval */
  L3_EXECUTE = 3,
  /** Self-directed within bounds */
  L4_AUTONOMOUS = 4,
  /** Full autonomy (rare, highest certification) */
  L5_SOVEREIGN = 5,
}

/**
 * Human-readable level names
 */
export const CAPABILITY_LEVEL_NAMES: Record<CapabilityLevel, string> = {
  [CapabilityLevel.L0_OBSERVE]: 'Observe',
  [CapabilityLevel.L1_ADVISE]: 'Advise',
  [CapabilityLevel.L2_DRAFT]: 'Draft',
  [CapabilityLevel.L3_EXECUTE]: 'Execute',
  [CapabilityLevel.L4_AUTONOMOUS]: 'Autonomous',
  [CapabilityLevel.L5_SOVEREIGN]: 'Sovereign',
};

// =============================================================================
// TRUST TIERS
// =============================================================================

/**
 * Trust tiers indicating verification level
 */
export enum TrustTier {
  /** No external verification */
  T0_UNVERIFIED = 0,
  /** Organization identity verified */
  T1_REGISTERED = 1,
  /** Passed automated capability tests */
  T2_TESTED = 2,
  /** Independent audit completed */
  T3_CERTIFIED = 3,
  /** Continuous behavioral monitoring */
  T4_VERIFIED = 4,
  /** Highest assurance level */
  T5_SOVEREIGN = 5,
}

/**
 * Human-readable trust tier names
 */
export const TRUST_TIER_NAMES: Record<TrustTier, string> = {
  [TrustTier.T0_UNVERIFIED]: 'Unverified',
  [TrustTier.T1_REGISTERED]: 'Registered',
  [TrustTier.T2_TESTED]: 'Tested',
  [TrustTier.T3_CERTIFIED]: 'Certified',
  [TrustTier.T4_VERIFIED]: 'Verified',
  [TrustTier.T5_SOVEREIGN]: 'Sovereign',
};

/**
 * Trust tier to score range mapping
 */
export const TRUST_TIER_SCORES: Record<TrustTier, { min: number; max: number }> = {
  [TrustTier.T0_UNVERIFIED]: { min: 0, max: 99 },
  [TrustTier.T1_REGISTERED]: { min: 100, max: 299 },
  [TrustTier.T2_TESTED]: { min: 300, max: 499 },
  [TrustTier.T3_CERTIFIED]: { min: 500, max: 699 },
  [TrustTier.T4_VERIFIED]: { min: 700, max: 899 },
  [TrustTier.T5_SOVEREIGN]: { min: 900, max: 1000 },
};

// =============================================================================
// ACI TYPES
// =============================================================================

/**
 * Parsed ACI string components
 */
export interface ParsedACI {
  /** Full ACI string */
  aci: string;
  /** Certifying registry (e.g., 'a3i') */
  registry: string;
  /** Operating organization */
  organization: string;
  /** Agent classification */
  agentClass: string;
  /** Capability domains */
  domains: DomainCode[];
  /** Domain bitmask for efficient queries */
  domainsBitmask: number;
  /** Autonomy level */
  level: CapabilityLevel;
  /** Trust tier */
  trustTier: TrustTier;
  /** Semantic version */
  version: string;
}

/**
 * Capability vector for queries and comparisons
 */
export interface CapabilityVector {
  /** Required domains */
  domains: DomainCode[];
  /** Domain bitmask */
  domainsBitmask?: number;
  /** Minimum level required */
  level: CapabilityLevel;
  /** Minimum trust tier required */
  trustTier: TrustTier;
  /** Optional skill tags */
  skills?: string[];
}

/**
 * Attestation from a certification authority
 */
export interface Attestation {
  /** Attestation ID */
  id: string;
  /** Issuer DID */
  issuer: string;
  /** Subject DID */
  subject: string;
  /** Scope of attestation */
  scope: AttestationScope;
  /** Attested trust tier */
  trustTier: TrustTier;
  /** Issue timestamp */
  issuedAt: Date;
  /** Expiration timestamp */
  expiresAt: Date;
  /** Evidence URLs */
  evidence?: {
    testResults?: string;
    auditReport?: string;
    [key: string]: string | undefined;
  };
  /** Cryptographic proof */
  proof?: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    jws: string;
  };
}

/**
 * Attestation scope types
 */
export type AttestationScope = 
  | 'full'           // Full capability attestation
  | 'domain'         // Single domain attestation
  | 'level'          // Level-only attestation
  | 'training'       // Training data attestation
  | 'security';      // Security audit attestation

/**
 * Full agent identity with all components
 */
export interface AgentIdentity {
  /** Full ACI string */
  aci: string;
  /** Agent DID */
  did: string;
  /** Parsed capabilities */
  capabilities: CapabilityVector;
  /** Active attestations */
  attestations: Attestation[];
  /** Service endpoint URL */
  serviceEndpoint?: string;
  /** Agent metadata */
  metadata?: AgentMetadata;
  /** Creation timestamp */
  created: Date;
  /** Last update timestamp */
  updated: Date;
}

/**
 * Agent metadata
 */
export interface AgentMetadata {
  /** Human-readable description */
  description?: string;
  /** Agent version */
  version?: string;
  /** Contact information */
  contact?: string;
  /** Documentation URL */
  documentation?: string;
  /** Custom properties */
  [key: string]: string | undefined;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * ACI validation result
 */
export interface ValidationResult {
  /** Whether the ACI is valid */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
  /** Parsed ACI if valid */
  parsed?: ParsedACI;
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Path to error (if applicable) */
  path?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Path to warning (if applicable) */
  path?: string;
}

// =============================================================================
// PARSING & VALIDATION FUNCTIONS
// =============================================================================

/**
 * ACI format regex
 */
export const ACI_REGEX = /^([a-z0-9]+)\.([a-z0-9-]+)\.([a-z0-9-]+):([A-Z]+)-L([0-5])-T([0-5])@(\d+\.\d+\.\d+)$/;

/**
 * Parse error for invalid ACI strings
 */
export class ACIParseError extends Error {
  constructor(message: string, public readonly aci: string) {
    super(message);
    this.name = 'ACIParseError';
  }
}

/**
 * Parse an ACI string into components
 * @throws ACIParseError if the ACI is invalid
 */
export function parseACI(aci: string): ParsedACI {
  const match = aci.match(ACI_REGEX);
  if (!match) {
    throw new ACIParseError(`Invalid ACI format: ${aci}`, aci);
  }

  const [, registry, organization, agentClass, domainsStr, levelStr, trustStr, version] = match;
  
  const domains = domainsStr.split('') as DomainCode[];
  const invalidDomains = domains.filter(d => !CAPABILITY_DOMAINS[d]);
  if (invalidDomains.length > 0) {
    throw new ACIParseError(`Invalid domain codes: ${invalidDomains.join(', ')}`, aci);
  }

  const domainsBitmask = domains.reduce((mask, d) => mask | CAPABILITY_DOMAINS[d].bit, 0);

  return {
    aci,
    registry,
    organization,
    agentClass,
    domains,
    domainsBitmask,
    level: parseInt(levelStr, 10) as CapabilityLevel,
    trustTier: parseInt(trustStr, 10) as TrustTier,
    version,
  };
}

/**
 * Generate an ACI string from components
 */
export function generateACI(
  registry: string,
  organization: string,
  agentClass: string,
  domains: DomainCode[],
  level: CapabilityLevel,
  trustTier: TrustTier,
  version: string
): string {
  const domainsStr = [...new Set(domains)].sort().join('');
  return `${registry}.${organization}.${agentClass}:${domainsStr}-L${level}-T${trustTier}@${version}`;
}

/**
 * Validate an ACI string
 */
export function validateACI(aci: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    const parsed = parseACI(aci);

    // Check for common issues
    if (parsed.domains.length === 0) {
      errors.push({ code: 'NO_DOMAINS', message: 'ACI must have at least one domain' });
    }

    if (parsed.level === CapabilityLevel.L5_SOVEREIGN && parsed.trustTier < TrustTier.T4_VERIFIED) {
      warnings.push({ 
        code: 'L5_LOW_TRUST', 
        message: 'L5 (Sovereign) agents typically require T4+ trust tier' 
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      parsed: errors.length === 0 ? parsed : undefined,
    };
  } catch (e) {
    if (e instanceof ACIParseError) {
      errors.push({ code: 'INVALID_FORMAT', message: e.message });
    } else {
      errors.push({ code: 'UNKNOWN_ERROR', message: String(e) });
    }
    return { valid: false, errors, warnings };
  }
}

// =============================================================================
// CAPABILITY HELPERS
// =============================================================================

/**
 * Check if an agent has all required domains
 */
export function hasDomains(agent: ParsedACI | CapabilityVector, required: DomainCode[]): boolean {
  const agentDomains = new Set(agent.domains);
  return required.every(d => agentDomains.has(d));
}

/**
 * Check if an agent meets minimum level
 */
export function meetsLevel(agent: ParsedACI | CapabilityVector, minLevel: CapabilityLevel): boolean {
  return agent.level >= minLevel;
}

/**
 * Check if an agent meets minimum trust tier
 */
export function meetsTrust(agent: ParsedACI | CapabilityVector, minTrust: TrustTier): boolean {
  return agent.trustTier >= minTrust;
}

/**
 * Check if an agent satisfies all requirements
 */
export function satisfiesRequirements(
  agent: ParsedACI | CapabilityVector,
  requirements: {
    domains?: DomainCode[];
    minLevel?: CapabilityLevel;
    minTrust?: TrustTier;
  }
): boolean {
  if (requirements.domains && !hasDomains(agent, requirements.domains)) {
    return false;
  }
  if (requirements.minLevel !== undefined && !meetsLevel(agent, requirements.minLevel)) {
    return false;
  }
  if (requirements.minTrust !== undefined && !meetsTrust(agent, requirements.minTrust)) {
    return false;
  }
  return true;
}

/**
 * Encode domains to bitmask
 */
export function encodeDomains(domains: DomainCode[]): number {
  return domains.reduce((mask, d) => mask | CAPABILITY_DOMAINS[d].bit, 0);
}

/**
 * Decode bitmask to domains
 */
export function decodeDomains(bitmask: number): DomainCode[] {
  return (Object.keys(CAPABILITY_DOMAINS) as DomainCode[])
    .filter(d => (bitmask & CAPABILITY_DOMAINS[d].bit) !== 0);
}

// =============================================================================
// JWT CLAIMS
// =============================================================================

/**
 * ACI claims for JWT tokens
 */
export interface ACIJWTClaims {
  /** Full ACI string */
  aci: string;
  /** Domain bitmask */
  aci_domains: number;
  /** Domain codes array */
  aci_domains_list: DomainCode[];
  /** Capability level */
  aci_level: CapabilityLevel;
  /** Trust tier */
  aci_trust: TrustTier;
  /** Registry */
  aci_registry: string;
  /** Organization */
  aci_org: string;
  /** Agent class */
  aci_class: string;
  /** Version */
  aci_version: string;
  /** Agent DID */
  aci_did?: string;
  /** Attestations */
  aci_attestations?: Array<{
    iss: string;
    scope: string;
    iat: number;
    exp: number;
    evidence?: string;
  }>;
}

/**
 * Generate JWT claims from parsed ACI
 */
export function generateJWTClaims(parsed: ParsedACI, did?: string): ACIJWTClaims {
  return {
    aci: parsed.aci,
    aci_domains: parsed.domainsBitmask,
    aci_domains_list: parsed.domains,
    aci_level: parsed.level,
    aci_trust: parsed.trustTier,
    aci_registry: parsed.registry,
    aci_org: parsed.organization,
    aci_class: parsed.agentClass,
    aci_version: parsed.version,
    aci_did: did,
  };
}

// =============================================================================
// SEMANTIC GOVERNANCE TYPES
// =============================================================================

/**
 * Instruction integrity configuration
 */
export interface InstructionIntegrity {
  /** SHA-256 hashes of allowed system prompts */
  allowedInstructionHashes: string[];
  /** Instruction templates with parameter schemas */
  instructionTemplates: InstructionTemplate[];
  /** Allowed instruction sources */
  instructionSource: {
    allowedSources: string[];
    requireSignature: boolean;
  };
}

/**
 * Instruction template definition
 */
export interface InstructionTemplate {
  /** Template identifier */
  id: string;
  /** Hash of the template */
  hash: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for allowed parameters */
  parameterSchema: object;
}

/**
 * Output schema binding configuration
 */
export interface OutputBinding {
  /** Allowed output schemas */
  allowedSchemas: OutputSchema[];
  /** Prohibited patterns (e.g., PII, credentials) */
  prohibitedPatterns: ProhibitedPattern[];
  /** Allowed external endpoints */
  allowedExternalEndpoints: string[];
  /** Blocked external endpoints */
  blockedExternalEndpoints: string[];
}

/**
 * Output schema definition
 */
export interface OutputSchema {
  /** Schema identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for output validation */
  jsonSchema: object;
}

/**
 * Prohibited pattern definition
 */
export interface ProhibitedPattern {
  /** Pattern type */
  type: 'regex' | 'keyword' | 'semantic';
  /** Pattern value */
  pattern: string;
  /** Human-readable description */
  description: string;
}

/**
 * Inference scope levels
 */
export enum InferenceLevel {
  /** No inference; raw data passthrough only */
  NONE = 0,
  /** Aggregates, counts, averages */
  STATISTICAL = 1,
  /** Named entity extraction */
  ENTITY = 2,
  /** Relationship inference */
  RELATIONAL = 3,
  /** Pattern prediction */
  PREDICTIVE = 4,
  /** Full inference capability */
  UNRESTRICTED = 5,
}

/**
 * Inference scope configuration
 */
export interface InferenceScope {
  /** Global inference level limit */
  globalLevel: InferenceLevel;
  /** Domain-specific overrides */
  domainOverrides: DomainInferenceOverride[];
  /** How to handle derived knowledge */
  derivedKnowledgeHandling: {
    retention: 'none' | 'session' | 'persistent';
    allowedRecipients: string[];
    crossContextSharing: boolean;
  };
  /** PII inference controls */
  piiInference: {
    allowed: boolean;
    handling: 'block' | 'redact' | 'hash';
  };
}

/**
 * Domain-specific inference override
 */
export interface DomainInferenceOverride {
  /** Domain code */
  domain: DomainCode;
  /** Override level */
  level: InferenceLevel;
  /** Reason for override */
  reason: string;
}

/**
 * Context provider authentication requirements
 */
export interface ContextAuthenticationRequirements {
  /** Whether authentication is required */
  required: boolean;
  /** Minimum trust tier for providers */
  minTrustTier: TrustTier;
  /** Required domains for providers */
  requiredDomains?: DomainCode[];
  /** Allowed provider DIDs */
  allowedProviders: string[];
  /** Blocked provider DIDs */
  blockedProviders: string[];
  /** Content integrity requirements */
  contentIntegrity: {
    signatureRequired: boolean;
    maxAge: number;
    allowedFormats: string[];
  };
}

/**
 * Dual-channel authorization configuration
 */
export interface DualChannelConfig {
  /** Whether dual-channel is enforced */
  enforced: boolean;
  /** Control plane sources */
  controlPlaneSources: string[];
  /** How to treat data plane content */
  dataPlaneTreatment: 'block' | 'sanitize' | 'warn';
}

/**
 * Complete semantic governance credential
 */
export interface SemanticGovernanceCredential {
  /** Agent DID */
  id: string;
  /** Full ACI string */
  aci: string;
  /** Instruction integrity rules */
  instructionIntegrity: InstructionIntegrity;
  /** Output binding rules */
  outputBinding: OutputBinding;
  /** Inference scope rules */
  inferenceScope: InferenceScope;
  /** Context authentication rules */
  contextAuthentication: ContextAuthenticationRequirements;
  /** Dual-channel configuration */
  dualChannel: DualChannelConfig;
}

/**
 * Message channel classification
 */
export type MessageChannel = 'control' | 'data';

/**
 * Injection scan result
 */
export interface InjectionScanResult {
  /** Whether injection patterns were detected */
  detected: boolean;
  /** Detected patterns */
  patterns: string[];
  /** Severity level */
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Instruction validation result
 */
export interface InstructionValidationResult {
  /** Whether instruction is valid */
  valid: boolean;
  /** Validation method used */
  method?: 'exact-match' | 'template-match' | 'signed-source';
  /** Template ID if template-matched */
  templateId?: string;
  /** Reason for rejection */
  reason?: string;
  /** Hash of the instruction */
  instructionHash?: string;
}

/**
 * Output validation result
 */
export interface OutputValidationResult {
  /** Whether output is valid */
  valid: boolean;
  /** Whether output was modified */
  modified?: boolean;
  /** Modified output (if applicable) */
  output?: unknown;
  /** Reason for rejection */
  reason?: string;
}

/**
 * Inference validation result
 */
export interface InferenceValidationResult {
  /** Whether inference is valid */
  valid: boolean;
  /** Reason for rejection */
  reason?: string;
  /** Required level */
  requiredLevel?: InferenceLevel;
  /** Agent's level */
  agentLevel?: InferenceLevel;
}

/**
 * Context validation result
 */
export interface ContextValidationResult {
  /** Whether context is valid */
  valid: boolean;
  /** Reason for rejection */
  reason?: string;
  /** Injection scan results */
  injectionScan?: InjectionScanResult;
}
