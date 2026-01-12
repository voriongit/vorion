/**
 * Attestation - Cryptographic proof of agent integrity
 *
 * For ATTESTED_BOX tier, we need hardware-backed proofs
 * that the agent code and configuration match expected values.
 */

import { v4 as uuidv4 } from 'uuid';
import { ObservationTier } from '@vorion/contracts';

/**
 * Types of cryptographic attestation
 */
export enum AttestationType {
  /** No attestation */
  NONE = 'none',
  /** Software-only hash verification */
  SOFTWARE_HASH = 'software_hash',
  /** TPM-backed attestation */
  TPM_QUOTE = 'tpm_quote',
  /** Intel SGX enclave quote */
  SGX_QUOTE = 'sgx_quote',
  /** AMD SEV-SNP report */
  SEV_SNP_REPORT = 'sev_snp',
  /** Intel TDX quote */
  TDX_QUOTE = 'tdx_quote',
  /** NVIDIA Confidential Computing (H100) */
  NVIDIA_CC = 'nvidia_cc',
}

/**
 * Hardware attestation types
 */
export const HARDWARE_ATTESTATION_TYPES = new Set([
  AttestationType.TPM_QUOTE,
  AttestationType.SGX_QUOTE,
  AttestationType.SEV_SNP_REPORT,
  AttestationType.TDX_QUOTE,
  AttestationType.NVIDIA_CC,
]);

/**
 * Map attestation type to observation tier
 */
export function getObservationTierForAttestation(
  type: AttestationType
): ObservationTier {
  if (HARDWARE_ATTESTATION_TYPES.has(type)) {
    return ObservationTier.ATTESTED_BOX;
  }
  if (type === AttestationType.SOFTWARE_HASH) {
    return ObservationTier.WHITE_BOX;
  }
  return ObservationTier.BLACK_BOX;
}

/**
 * Attestation evidence
 */
export interface AttestationEvidence {
  /** Unique attestation ID */
  attestationId: string;
  /** Type of attestation */
  attestationType: AttestationType;
  /** When attestation was created */
  timestamp: Date;

  // What is being attested
  /** SHA-256 hash of orchestration code */
  codeHash: string;
  /** SHA-256 hash of model weights (if accessible) */
  weightsHash?: string;
  /** SHA-256 hash of configuration */
  configHash: string;

  // Hardware attestation (if available)
  /** Raw attestation quote from TEE */
  platformQuote?: string; // Base64 encoded
  /** PCR/RTMR measurement values */
  measurementRegisters?: Record<string, string>;

  // Verification chain
  /** Certificate chain for verification */
  certificateChain: string[];
  /** Who verified this attestation */
  verifiedBy?: string;
  /** When verification occurred */
  verificationTimestamp?: Date;

  // Golden image comparison
  /** Expected hash of code */
  goldenImageHash?: string;
  /** Does current hash match golden image? */
  matchesGoldenImage?: boolean;
}

/**
 * Verification result
 */
export interface AttestationVerificationResult {
  /** Is the attestation valid? */
  valid: boolean;
  /** Is it hardware-backed? */
  hardwareBacked: boolean;
  /** Does it match the golden image? */
  matchesGoldenImage: boolean;
  /** Resulting observation tier */
  observationTier: ObservationTier;
  /** Any issues found */
  issues: string[];
  /** Verification timestamp */
  verifiedAt: Date;
}

/**
 * Create attestation evidence
 */
export function createAttestationEvidence(
  options: Omit<AttestationEvidence, 'attestationId' | 'timestamp'>
): AttestationEvidence {
  return {
    attestationId: uuidv4(),
    timestamp: new Date(),
    ...options,
  };
}

/**
 * Check if attestation is hardware-backed
 */
export function isHardwareBacked(attestation: AttestationEvidence): boolean {
  return HARDWARE_ATTESTATION_TYPES.has(attestation.attestationType);
}

/**
 * Verify attestation evidence
 *
 * Note: This is a simplified verification. Real implementation
 * would verify cryptographic signatures against TEE manufacturer roots.
 */
export function verifyAttestation(
  attestation: AttestationEvidence
): AttestationVerificationResult {
  const issues: string[] = [];

  // Check attestation type
  const hardwareBacked = isHardwareBacked(attestation);
  if (!hardwareBacked && attestation.attestationType !== AttestationType.SOFTWARE_HASH) {
    issues.push('No valid attestation type');
  }

  // Check required hashes
  if (!attestation.codeHash) {
    issues.push('Missing code hash');
  }
  if (!attestation.configHash) {
    issues.push('Missing config hash');
  }

  // Check hardware-specific requirements
  if (hardwareBacked && !attestation.platformQuote) {
    issues.push('Hardware attestation requires platform quote');
  }

  // Check golden image
  const matchesGoldenImage = attestation.matchesGoldenImage ?? false;
  if (attestation.goldenImageHash && !matchesGoldenImage) {
    issues.push('Code hash does not match golden image');
  }

  // Check certificate chain
  if (hardwareBacked && attestation.certificateChain.length === 0) {
    issues.push('Hardware attestation requires certificate chain');
  }

  const valid = issues.length === 0;
  const observationTier = valid
    ? getObservationTierForAttestation(attestation.attestationType)
    : ObservationTier.BLACK_BOX;

  return {
    valid,
    hardwareBacked,
    matchesGoldenImage,
    observationTier,
    issues,
    verifiedAt: new Date(),
  };
}

/**
 * Compute SHA-256 hash (placeholder - would use crypto in real impl)
 */
export function computeHash(data: string): string {
  // In real implementation, use crypto.subtle.digest or crypto.createHash
  // This is a placeholder that would need proper crypto implementation
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}
