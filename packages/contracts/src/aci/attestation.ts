/**
 * @fileoverview ACI Attestation Types
 *
 * Defines types for attestations - cryptographic proofs issued by certification
 * authorities that verify agent capabilities, identity, or compliance.
 *
 * Attestations are the foundation of trust in the ACI system, providing
 * verifiable evidence that an agent has been certified at a particular level.
 *
 * @module @vorion/contracts/aci/attestation
 */

import { z } from 'zod';
import { CertificationTier, certificationTierSchema } from './tiers.js';
import { type DomainCode, domainCodeSchema } from './domains.js';

// ============================================================================
// Attestation Scope
// ============================================================================

/**
 * Scope types for attestations.
 *
 * Defines what aspect of an agent is being attested:
 * - full: Complete capability attestation
 * - domain: Single domain attestation
 * - level: Level-only attestation
 * - training: Training data/methodology attestation
 * - security: Security audit attestation
 * - compliance: Regulatory compliance attestation
 * - identity: Identity verification attestation
 */
export type AttestationScope =
  | 'full'
  | 'domain'
  | 'level'
  | 'training'
  | 'security'
  | 'compliance'
  | 'identity';

/**
 * Array of all attestation scopes.
 */
export const ATTESTATION_SCOPES: readonly AttestationScope[] = [
  'full',
  'domain',
  'level',
  'training',
  'security',
  'compliance',
  'identity',
] as const;

/**
 * Zod schema for AttestationScope validation.
 */
export const attestationScopeSchema = z.enum(
  ['full', 'domain', 'level', 'training', 'security', 'compliance', 'identity'],
  { errorMap: () => ({ message: 'Invalid attestation scope' }) }
);

/**
 * Descriptions for attestation scopes.
 */
export const ATTESTATION_SCOPE_DESCRIPTIONS: Readonly<Record<AttestationScope, string>> = {
  full: 'Complete capability attestation covering all aspects of agent certification',
  domain: 'Attestation for a specific capability domain',
  level: 'Attestation for a specific autonomy level',
  training: 'Attestation for training data quality and methodology',
  security: 'Security audit attestation',
  compliance: 'Regulatory compliance attestation',
  identity: 'Identity verification attestation',
} as const;

// ============================================================================
// Attestation Status
// ============================================================================

/**
 * Status of an attestation.
 */
export type AttestationStatus =
  | 'active'      // Currently valid
  | 'expired'     // Past expiration date
  | 'revoked'     // Explicitly revoked
  | 'suspended'   // Temporarily suspended
  | 'pending';    // Awaiting validation

/**
 * Zod schema for AttestationStatus validation.
 */
export const attestationStatusSchema = z.enum(
  ['active', 'expired', 'revoked', 'suspended', 'pending'],
  { errorMap: () => ({ message: 'Invalid attestation status' }) }
);

// ============================================================================
// Attestation Evidence
// ============================================================================

/**
 * Evidence supporting an attestation.
 */
export interface AttestationEvidence {
  /** URL to test results */
  testResults?: string;
  /** URL to audit report */
  auditReport?: string;
  /** URL to training data verification */
  trainingVerification?: string;
  /** URL to compliance documentation */
  complianceDocumentation?: string;
  /** Additional evidence URLs */
  [key: string]: string | undefined;
}

/**
 * Zod schema for AttestationEvidence validation.
 */
export const attestationEvidenceSchema = z.object({
  testResults: z.string().url().optional(),
  auditReport: z.string().url().optional(),
  trainingVerification: z.string().url().optional(),
  complianceDocumentation: z.string().url().optional(),
}).catchall(z.string().url().optional());

// ============================================================================
// Cryptographic Proof
// ============================================================================

/**
 * Cryptographic proof for an attestation.
 *
 * Follows W3C Verifiable Credentials proof format.
 */
export interface AttestationProof {
  /** Proof type (e.g., 'Ed25519Signature2020', 'JsonWebSignature2020') */
  type: string;
  /** When the proof was created (ISO 8601) */
  created: string;
  /** DID URL of the verification method */
  verificationMethod: string;
  /** Purpose of the proof (e.g., 'assertionMethod') */
  proofPurpose: string;
  /** JSON Web Signature */
  jws: string;
  /** Optional nonce for replay protection */
  nonce?: string;
  /** Optional challenge for interactive proofs */
  challenge?: string;
  /** Optional domain binding */
  domain?: string;
}

/**
 * Zod schema for AttestationProof validation.
 */
export const attestationProofSchema = z.object({
  type: z.string().min(1),
  created: z.string().datetime(),
  verificationMethod: z.string().min(1),
  proofPurpose: z.string().min(1),
  jws: z.string().min(1),
  nonce: z.string().optional(),
  challenge: z.string().optional(),
  domain: z.string().optional(),
});

// ============================================================================
// Attestation Interface
// ============================================================================

/**
 * Attestation from a certification authority.
 *
 * Represents a verifiable claim about an agent's capabilities, identity,
 * or compliance status issued by a trusted certification authority.
 */
export interface Attestation {
  /** Unique attestation identifier */
  id: string;
  /** DID of the issuing certification authority */
  issuer: string;
  /** DID of the attested agent */
  subject: string;
  /** Scope of the attestation */
  scope: AttestationScope;
  /** Attested certification tier */
  certificationTier: CertificationTier;
  /** Specific domains covered (for domain scope) */
  domains?: readonly DomainCode[];
  /** When the attestation was issued */
  issuedAt: Date;
  /** When the attestation expires */
  expiresAt: Date;
  /** Current status */
  status: AttestationStatus;
  /** Evidence supporting the attestation */
  evidence?: AttestationEvidence;
  /** Cryptographic proof */
  proof?: AttestationProof;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for Attestation validation.
 */
export const attestationSchema = z.object({
  id: z.string().min(1),
  issuer: z.string().min(1),
  subject: z.string().min(1),
  scope: attestationScopeSchema,
  certificationTier: certificationTierSchema,
  domains: z.array(domainCodeSchema).optional(),
  issuedAt: z.date(),
  expiresAt: z.date(),
  status: attestationStatusSchema,
  evidence: attestationEvidenceSchema.optional(),
  proof: attestationProofSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Attestation Verification
// ============================================================================

/**
 * Result of attestation verification.
 */
export interface AttestationVerificationResult {
  /** Whether the attestation is valid */
  valid: boolean;
  /** Verification errors */
  errors: AttestationVerificationError[];
  /** Verification warnings */
  warnings: AttestationVerificationWarning[];
  /** Verified attestation data (if valid) */
  attestation?: Attestation;
  /** Verification timestamp */
  verifiedAt: Date;
  /** Verification method used */
  verificationMethod?: string;
}

/**
 * Attestation verification error.
 */
export interface AttestationVerificationError {
  /** Error code */
  code: AttestationVerificationErrorCode;
  /** Human-readable message */
  message: string;
}

/**
 * Error codes for attestation verification.
 */
export type AttestationVerificationErrorCode =
  | 'INVALID_SIGNATURE'
  | 'EXPIRED'
  | 'REVOKED'
  | 'SUSPENDED'
  | 'ISSUER_NOT_TRUSTED'
  | 'SUBJECT_MISMATCH'
  | 'INVALID_FORMAT'
  | 'PROOF_MISSING'
  | 'VERIFICATION_FAILED';

/**
 * Attestation verification warning.
 */
export interface AttestationVerificationWarning {
  /** Warning code */
  code: string;
  /** Human-readable message */
  message: string;
}

/**
 * Zod schema for AttestationVerificationError.
 */
export const attestationVerificationErrorSchema = z.object({
  code: z.enum([
    'INVALID_SIGNATURE',
    'EXPIRED',
    'REVOKED',
    'SUSPENDED',
    'ISSUER_NOT_TRUSTED',
    'SUBJECT_MISMATCH',
    'INVALID_FORMAT',
    'PROOF_MISSING',
    'VERIFICATION_FAILED',
  ]),
  message: z.string(),
});

/**
 * Zod schema for AttestationVerificationWarning.
 */
export const attestationVerificationWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
});

/**
 * Zod schema for AttestationVerificationResult.
 */
export const attestationVerificationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(attestationVerificationErrorSchema),
  warnings: z.array(attestationVerificationWarningSchema),
  attestation: attestationSchema.optional(),
  verifiedAt: z.date(),
  verificationMethod: z.string().optional(),
});

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Options for creating an attestation.
 */
export interface CreateAttestationOptions {
  /** Unique identifier (auto-generated if not provided) */
  id?: string;
  /** DID of the issuing certification authority */
  issuer: string;
  /** DID of the attested agent */
  subject: string;
  /** Scope of the attestation */
  scope: AttestationScope;
  /** Attested certification tier */
  certificationTier: CertificationTier;
  /** Specific domains covered (for domain scope) */
  domains?: readonly DomainCode[];
  /** Validity duration in milliseconds */
  validityMs?: number;
  /** Evidence supporting the attestation */
  evidence?: AttestationEvidence;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Creates a new attestation.
 *
 * @param options - Attestation creation options
 * @returns New attestation (without proof - must be signed separately)
 *
 * @example
 * ```typescript
 * const attestation = createAttestation({
 *   issuer: 'did:web:certifier.example.com',
 *   subject: 'did:web:agent.acme.com',
 *   scope: 'full',
 *   certificationTier: CertificationTier.T3_CERTIFIED,
 *   validityMs: 365 * 24 * 60 * 60 * 1000, // 1 year
 * });
 * ```
 */
export function createAttestation(options: CreateAttestationOptions): Attestation {
  const now = new Date();
  const validityMs = options.validityMs ?? 365 * 24 * 60 * 60 * 1000; // Default: 1 year

  return {
    id: options.id ?? `urn:uuid:${crypto.randomUUID()}`,
    issuer: options.issuer,
    subject: options.subject,
    scope: options.scope,
    certificationTier: options.certificationTier,
    domains: options.domains,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + validityMs),
    status: 'active',
    evidence: options.evidence,
    metadata: options.metadata,
  };
}

/**
 * Verifies an attestation (basic validation without cryptographic verification).
 *
 * This function performs structural and temporal validation. Cryptographic
 * verification of the proof requires additional libraries and is not
 * performed here.
 *
 * @param attestation - The attestation to verify
 * @param expectedSubject - Optional expected subject DID
 * @param trustedIssuers - Optional list of trusted issuer DIDs
 * @returns Verification result
 */
export function verifyAttestation(
  attestation: Attestation,
  expectedSubject?: string,
  trustedIssuers?: readonly string[]
): AttestationVerificationResult {
  const errors: AttestationVerificationError[] = [];
  const warnings: AttestationVerificationWarning[] = [];
  const now = new Date();

  // Check expiration
  if (attestation.expiresAt < now) {
    errors.push({
      code: 'EXPIRED',
      message: `Attestation expired on ${attestation.expiresAt.toISOString()}`,
    });
  }

  // Check status
  if (attestation.status === 'revoked') {
    errors.push({
      code: 'REVOKED',
      message: 'Attestation has been revoked',
    });
  } else if (attestation.status === 'suspended') {
    errors.push({
      code: 'SUSPENDED',
      message: 'Attestation is currently suspended',
    });
  } else if (attestation.status === 'pending') {
    warnings.push({
      code: 'PENDING',
      message: 'Attestation is still pending validation',
    });
  }

  // Check subject match
  if (expectedSubject && attestation.subject !== expectedSubject) {
    errors.push({
      code: 'SUBJECT_MISMATCH',
      message: `Attestation subject ${attestation.subject} does not match expected ${expectedSubject}`,
    });
  }

  // Check trusted issuer
  if (trustedIssuers && !trustedIssuers.includes(attestation.issuer)) {
    errors.push({
      code: 'ISSUER_NOT_TRUSTED',
      message: `Issuer ${attestation.issuer} is not in the trusted issuers list`,
    });
  }

  // Check proof presence
  if (!attestation.proof) {
    warnings.push({
      code: 'NO_PROOF',
      message: 'Attestation does not include cryptographic proof',
    });
  }

  // Check for near expiration
  const daysUntilExpiry = (attestation.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  if (daysUntilExpiry > 0 && daysUntilExpiry < 30) {
    warnings.push({
      code: 'EXPIRING_SOON',
      message: `Attestation expires in ${Math.ceil(daysUntilExpiry)} days`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    attestation: errors.length === 0 ? attestation : undefined,
    verifiedAt: now,
  };
}

// ============================================================================
// Attestation Helpers
// ============================================================================

/**
 * Checks if an attestation is currently valid.
 *
 * @param attestation - The attestation to check
 * @returns True if the attestation is valid
 */
export function isAttestationValid(attestation: Attestation): boolean {
  const now = new Date();
  return (
    attestation.status === 'active' &&
    attestation.issuedAt <= now &&
    attestation.expiresAt > now
  );
}

/**
 * Gets the remaining validity duration of an attestation.
 *
 * @param attestation - The attestation to check
 * @returns Remaining validity in milliseconds (negative if expired)
 */
export function getAttestationRemainingValidity(attestation: Attestation): number {
  return attestation.expiresAt.getTime() - Date.now();
}

/**
 * Checks if an attestation covers a specific domain.
 *
 * @param attestation - The attestation to check
 * @param domain - The domain to check for
 * @returns True if the attestation covers the domain
 */
export function attestationCoversDomain(
  attestation: Attestation,
  domain: DomainCode
): boolean {
  // Full scope covers all domains
  if (attestation.scope === 'full') {
    return true;
  }

  // Domain scope must include the specific domain
  if (attestation.scope === 'domain' && attestation.domains) {
    return attestation.domains.includes(domain);
  }

  return false;
}

/**
 * Type guard to check if a value is a valid AttestationScope.
 */
export function isAttestationScope(value: unknown): value is AttestationScope {
  return typeof value === 'string' && ATTESTATION_SCOPES.includes(value as AttestationScope);
}

/**
 * Type guard to check if a value is a valid AttestationStatus.
 */
export function isAttestationStatus(value: unknown): value is AttestationStatus {
  return (
    typeof value === 'string' &&
    ['active', 'expired', 'revoked', 'suspended', 'pending'].includes(value)
  );
}
