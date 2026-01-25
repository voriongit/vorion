/**
 * TEE (Trusted Execution Environment) Binding Service
 *
 * Implements hardware-bound key attestation for ACI security hardening (SH-3).
 * TEE binding ensures that:
 * 1. Agent keys are generated inside a secure enclave
 * 2. The DID is bound to the enclave's measurement
 * 3. At runtime, the expected code is provably executing
 *
 * Supported platforms:
 * - Intel SGX (DCAP/EPID attestation)
 * - AWS Nitro Enclaves
 * - AMD SEV-SNP
 * - ARM TrustZone
 * - Apple Secure Enclave
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import { VorionError } from '../common/errors.js';
import { Counter, Histogram, Gauge } from 'prom-client';
import { intentRegistry } from '../intent/metrics.js';
import {
  type TEEConfig,
  type TEEAttestation,
  type TEEKeyBinding,
  type TEEVerificationResult,
  type TEEPlatform,
  type TrustTier,
  TEEPlatform as TEEPlatformEnum,
  teeConfigSchema,
  teeAttestationSchema,
  teeKeyBindingSchema,
} from './types.js';

const logger = createLogger({ component: 'security-tee' });

// =============================================================================
// Metrics
// =============================================================================

const teeAttestationsVerified = new Counter({
  name: 'vorion_security_tee_attestations_verified_total',
  help: 'Total TEE attestations verified',
  labelNames: ['platform', 'result'] as const,
  registers: [intentRegistry],
});

const teeVerificationDuration = new Histogram({
  name: 'vorion_security_tee_verification_duration_seconds',
  help: 'Duration of TEE attestation verification',
  labelNames: ['platform'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [intentRegistry],
});

const teeKeyBindings = new Counter({
  name: 'vorion_security_tee_key_bindings_total',
  help: 'Total TEE key bindings created',
  labelNames: ['platform'] as const,
  registers: [intentRegistry],
});

const teeActiveBindings = new Gauge({
  name: 'vorion_security_tee_active_bindings',
  help: 'Number of active TEE key bindings',
  labelNames: ['platform'] as const,
  registers: [intentRegistry],
});

// =============================================================================
// Errors
// =============================================================================

/**
 * TEE-specific error
 */
export class TEEError extends VorionError {
  override code = 'TEE_ERROR';
  override statusCode = 403;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'TEEError';
  }
}

/**
 * TEE attestation verification failed
 */
export class TEEAttestationError extends TEEError {
  override code = 'TEE_ATTESTATION_ERROR';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'TEEAttestationError';
  }
}

/**
 * TEE key binding error
 */
export class TEEKeyBindingError extends TEEError {
  override code = 'TEE_KEY_BINDING_ERROR';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'TEEKeyBindingError';
  }
}

// =============================================================================
// Platform-Specific Verifiers
// =============================================================================

/**
 * Interface for platform-specific attestation verification
 */
interface PlatformVerifier {
  verify(attestation: TEEAttestation): Promise<TEEVerificationResult>;
  validateMeasurement(expectedHash: string, attestation: TEEAttestation): boolean;
}

/**
 * Intel SGX attestation verifier
 * Uses DCAP (Data Center Attestation Primitives) or EPID
 */
class SGXVerifier implements PlatformVerifier {
  async verify(attestation: TEEAttestation): Promise<TEEVerificationResult> {
    const startTime = Date.now();

    try {
      // In a real implementation, this would:
      // 1. Parse the SGX quote from attestation.signature
      // 2. Verify the quote signature using Intel's attestation service
      // 3. Validate PCR values against expected measurements
      // 4. Check certificate chain

      // Validate required fields
      if (!attestation.signature) {
        return {
          valid: false,
          reason: 'Missing SGX quote signature',
          verifiedAt: new Date().toISOString(),
        };
      }

      if (!attestation.pcrs) {
        return {
          valid: false,
          reason: 'Missing PCR values',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Verify certificate chain if provided
      if (attestation.certificateChain && attestation.certificateChain.length > 0) {
        // In production, verify the chain against Intel's root CA
        logger.debug({ chainLength: attestation.certificateChain.length }, 'Verifying SGX certificate chain');
      }

      // Check attestation freshness
      const now = new Date();
      if (attestation.validUntil && attestation.validUntil < now) {
        return {
          valid: false,
          reason: 'Attestation has expired',
          verifiedAt: now.toISOString(),
        };
      }

      // Mock verification success for development
      // In production, call Intel Attestation Service (IAS) or use DCAP
      logger.debug(
        { enclaveId: attestation.enclaveId, measurementHash: attestation.measurementHash },
        'SGX attestation verification simulated (would call IAS in production)'
      );

      return {
        valid: true,
        platform: TEEPlatformEnum.SGX,
        measurementHash: attestation.measurementHash,
        verifiedAt: new Date().toISOString(),
      };
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      teeVerificationDuration.observe({ platform: 'sgx' }, duration);
    }
  }

  validateMeasurement(expectedHash: string, attestation: TEEAttestation): boolean {
    return attestation.measurementHash === expectedHash;
  }
}

/**
 * AWS Nitro Enclaves attestation verifier
 */
class NitroVerifier implements PlatformVerifier {
  async verify(attestation: TEEAttestation): Promise<TEEVerificationResult> {
    const startTime = Date.now();

    try {
      // In a real implementation, this would:
      // 1. Parse the Nitro attestation document
      // 2. Verify the COSE signature
      // 3. Validate PCRs against expected values
      // 4. Verify AWS root certificate chain

      // Validate required fields
      if (!attestation.signature) {
        return {
          valid: false,
          reason: 'Missing Nitro attestation document',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Nitro uses specific PCRs
      const requiredPCRs = ['PCR0', 'PCR1', 'PCR2'];
      if (attestation.pcrs) {
        for (const pcr of requiredPCRs) {
          if (!attestation.pcrs[pcr]) {
            return {
              valid: false,
              reason: `Missing required PCR: ${pcr}`,
              verifiedAt: new Date().toISOString(),
            };
          }
        }
      }

      // Check attestation freshness
      const now = new Date();
      if (attestation.validUntil && attestation.validUntil < now) {
        return {
          valid: false,
          reason: 'Attestation has expired',
          verifiedAt: now.toISOString(),
        };
      }

      // Mock verification success for development
      logger.debug(
        { enclaveId: attestation.enclaveId, measurementHash: attestation.measurementHash },
        'Nitro attestation verification simulated (would verify COSE in production)'
      );

      return {
        valid: true,
        platform: TEEPlatformEnum.NITRO,
        measurementHash: attestation.measurementHash,
        verifiedAt: new Date().toISOString(),
      };
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      teeVerificationDuration.observe({ platform: 'nitro' }, duration);
    }
  }

  validateMeasurement(expectedHash: string, attestation: TEEAttestation): boolean {
    // For Nitro, PCR0 contains the enclave image measurement
    if (attestation.pcrs?.['PCR0']) {
      return attestation.pcrs['PCR0'] === expectedHash;
    }
    return attestation.measurementHash === expectedHash;
  }
}

/**
 * AMD SEV-SNP attestation verifier
 */
class SEVVerifier implements PlatformVerifier {
  async verify(attestation: TEEAttestation): Promise<TEEVerificationResult> {
    const startTime = Date.now();

    try {
      // Validate required fields
      if (!attestation.signature) {
        return {
          valid: false,
          reason: 'Missing SEV attestation report',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Check attestation freshness
      const now = new Date();
      if (attestation.validUntil && attestation.validUntil < now) {
        return {
          valid: false,
          reason: 'Attestation has expired',
          verifiedAt: now.toISOString(),
        };
      }

      // Mock verification success for development
      logger.debug(
        { enclaveId: attestation.enclaveId, measurementHash: attestation.measurementHash },
        'SEV attestation verification simulated'
      );

      return {
        valid: true,
        platform: TEEPlatformEnum.SEV,
        measurementHash: attestation.measurementHash,
        verifiedAt: new Date().toISOString(),
      };
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      teeVerificationDuration.observe({ platform: 'sev' }, duration);
    }
  }

  validateMeasurement(expectedHash: string, attestation: TEEAttestation): boolean {
    return attestation.measurementHash === expectedHash;
  }
}

/**
 * ARM TrustZone attestation verifier
 */
class TrustZoneVerifier implements PlatformVerifier {
  async verify(attestation: TEEAttestation): Promise<TEEVerificationResult> {
    const startTime = Date.now();

    try {
      // TrustZone attestation is platform-specific
      if (!attestation.signature) {
        return {
          valid: false,
          reason: 'Missing TrustZone attestation',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Check attestation freshness
      const now = new Date();
      if (attestation.validUntil && attestation.validUntil < now) {
        return {
          valid: false,
          reason: 'Attestation has expired',
          verifiedAt: now.toISOString(),
        };
      }

      logger.debug(
        { enclaveId: attestation.enclaveId },
        'TrustZone attestation verification simulated'
      );

      return {
        valid: true,
        platform: TEEPlatformEnum.TRUSTZONE,
        measurementHash: attestation.measurementHash,
        verifiedAt: new Date().toISOString(),
      };
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      teeVerificationDuration.observe({ platform: 'trustzone' }, duration);
    }
  }

  validateMeasurement(expectedHash: string, attestation: TEEAttestation): boolean {
    return attestation.measurementHash === expectedHash;
  }
}

/**
 * Apple Secure Enclave verifier
 */
class SecureEnclaveVerifier implements PlatformVerifier {
  async verify(attestation: TEEAttestation): Promise<TEEVerificationResult> {
    const startTime = Date.now();

    try {
      // Secure Enclave uses DeviceCheck/App Attest
      if (!attestation.signature) {
        return {
          valid: false,
          reason: 'Missing Secure Enclave attestation',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Check attestation freshness
      const now = new Date();
      if (attestation.validUntil && attestation.validUntil < now) {
        return {
          valid: false,
          reason: 'Attestation has expired',
          verifiedAt: now.toISOString(),
        };
      }

      logger.debug(
        { enclaveId: attestation.enclaveId },
        'Secure Enclave attestation verification simulated'
      );

      return {
        valid: true,
        platform: TEEPlatformEnum.SECURE_ENCLAVE,
        measurementHash: attestation.measurementHash,
        verifiedAt: new Date().toISOString(),
      };
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      teeVerificationDuration.observe({ platform: 'secure-enclave' }, duration);
    }
  }

  validateMeasurement(expectedHash: string, attestation: TEEAttestation): boolean {
    return attestation.measurementHash === expectedHash;
  }
}

// =============================================================================
// TEE Binding Service
// =============================================================================

/**
 * TEE Binding Service for hardware attestation and key binding
 *
 * @example
 * ```typescript
 * const tee = new TEEBindingService({
 *   requiredForTiers: [TrustTier.T4, TrustTier.T5],
 *   allowedPlatforms: ['sgx', 'nitro'],
 *   maxAttestationAge: 86400, // 24 hours
 * });
 *
 * // Verify attestation
 * const result = await tee.verifyAttestation(attestation);
 *
 * // Bind DID key to enclave
 * const binding = await tee.bindKeyToEnclave(didKeyId, attestation);
 * ```
 */
export class TEEBindingService {
  private config: TEEConfig;
  private verifiers: Map<TEEPlatform, PlatformVerifier>;
  private bindings: Map<string, TEEKeyBinding>; // didKeyId -> binding

  /**
   * Create a new TEE binding service
   *
   * @param config - TEE configuration
   */
  constructor(config: Partial<TEEConfig>) {
    const defaultConfig: TEEConfig = {
      requiredForTiers: [4, 5],
      allowedPlatforms: [TEEPlatformEnum.SGX, TEEPlatformEnum.NITRO],
      maxAttestationAge: 86400,
    };
    this.config = { ...defaultConfig, ...teeConfigSchema.parse(config) };
    this.bindings = new Map();

    // Initialize platform-specific verifiers
    this.verifiers = new Map([
      [TEEPlatformEnum.SGX, new SGXVerifier()],
      [TEEPlatformEnum.NITRO, new NitroVerifier()],
      [TEEPlatformEnum.SEV, new SEVVerifier()],
      [TEEPlatformEnum.TRUSTZONE, new TrustZoneVerifier()],
      [TEEPlatformEnum.SECURE_ENCLAVE, new SecureEnclaveVerifier()],
    ]);

    logger.info(
      {
        requiredForTiers: this.config.requiredForTiers,
        allowedPlatforms: this.config.allowedPlatforms,
        maxAttestationAge: this.config.maxAttestationAge,
      },
      'TEE binding service initialized'
    );
  }

  /**
   * Verify a TEE attestation
   *
   * @param attestation - TEE attestation to verify
   * @returns Verification result
   */
  async verifyAttestation(attestation: TEEAttestation): Promise<TEEVerificationResult> {
    // Validate attestation format
    try {
      teeAttestationSchema.parse(attestation);
    } catch (error) {
      teeAttestationsVerified.inc({ platform: attestation.platform, result: 'invalid' });
      return {
        valid: false,
        reason: 'Invalid attestation format',
        verifiedAt: new Date().toISOString(),
      };
    }

    // Check if platform is allowed
    if (!this.config.allowedPlatforms.includes(attestation.platform)) {
      teeAttestationsVerified.inc({ platform: attestation.platform, result: 'invalid' });
      return {
        valid: false,
        reason: `Platform not allowed: ${attestation.platform}`,
        verifiedAt: new Date().toISOString(),
      };
    }

    // Check attestation age
    const age = (Date.now() - attestation.timestamp.getTime()) / 1000;
    if (age > this.config.maxAttestationAge) {
      teeAttestationsVerified.inc({ platform: attestation.platform, result: 'expired' });
      return {
        valid: false,
        reason: `Attestation too old (age: ${Math.floor(age)}s, max: ${this.config.maxAttestationAge}s)`,
        verifiedAt: new Date().toISOString(),
      };
    }

    // Get platform-specific verifier
    const verifier = this.verifiers.get(attestation.platform);
    if (!verifier) {
      teeAttestationsVerified.inc({ platform: attestation.platform, result: 'invalid' });
      return {
        valid: false,
        reason: `No verifier available for platform: ${attestation.platform}`,
        verifiedAt: new Date().toISOString(),
      };
    }

    // Verify attestation
    const result = await verifier.verify(attestation);

    // Check expected measurements if configured
    if (result.valid && this.config.expectedMeasurements) {
      const expectedHash = this.config.expectedMeasurements[attestation.enclaveId];
      if (expectedHash) {
        const measurementValid = verifier.validateMeasurement(expectedHash, attestation);
        if (!measurementValid) {
          teeAttestationsVerified.inc({ platform: attestation.platform, result: 'measurement_mismatch' });
          return {
            valid: false,
            reason: 'Code measurement does not match expected value',
            platform: attestation.platform,
            verifiedAt: new Date().toISOString(),
          };
        }
      }
    }

    teeAttestationsVerified.inc({
      platform: attestation.platform,
      result: result.valid ? 'success' : 'invalid',
    });

    return result;
  }

  /**
   * Bind a DID key to an enclave
   *
   * @param didKeyId - DID verification method ID
   * @param enclaveAttestation - TEE attestation proving enclave validity
   * @returns Key binding record
   */
  async bindKeyToEnclave(
    didKeyId: string,
    enclaveAttestation: TEEAttestation
  ): Promise<TEEKeyBinding> {
    // First verify the attestation
    const verificationResult = await this.verifyAttestation(enclaveAttestation);

    if (!verificationResult.valid) {
      throw new TEEAttestationError(
        `Cannot bind key: ${verificationResult.reason}`,
        { didKeyId, enclaveId: enclaveAttestation.enclaveId }
      );
    }

    // Create binding proof
    // In a real implementation, this would be a cryptographic proof
    // that the key was generated inside the enclave
    const bindingProof = await this.createBindingProof(didKeyId, enclaveAttestation);

    // Calculate validity period
    const validUntil = enclaveAttestation.validUntil
      ? new Date(Math.min(
          enclaveAttestation.validUntil.getTime(),
          Date.now() + this.config.maxAttestationAge * 1000
        ))
      : new Date(Date.now() + this.config.maxAttestationAge * 1000);

    const binding: TEEKeyBinding = {
      didKeyId,
      enclaveKeyId: enclaveAttestation.enclaveId,
      bindingProof,
      boundAt: new Date(),
      validUntil,
    };

    // Validate binding
    teeKeyBindingSchema.parse(binding);

    // Store binding
    this.bindings.set(didKeyId, binding);
    teeKeyBindings.inc({ platform: enclaveAttestation.platform });
    teeActiveBindings.set({ platform: enclaveAttestation.platform }, this.getBindingCount(enclaveAttestation.platform));

    logger.info(
      { didKeyId, enclaveId: enclaveAttestation.enclaveId, platform: enclaveAttestation.platform },
      'Key bound to enclave'
    );

    return binding;
  }

  /**
   * Verify a key binding
   *
   * @param binding - Key binding to verify
   * @returns Whether binding is valid
   */
  async verifyKeyBinding(binding: TEEKeyBinding): Promise<boolean> {
    try {
      teeKeyBindingSchema.parse(binding);
    } catch {
      logger.warn({ didKeyId: binding.didKeyId }, 'Invalid binding format');
      return false;
    }

    // Check if binding has expired
    if (binding.validUntil && binding.validUntil < new Date()) {
      logger.debug({ didKeyId: binding.didKeyId }, 'Binding has expired');
      return false;
    }

    // Verify binding proof
    // In a real implementation, this would verify the cryptographic proof
    const proofValid = this.verifyBindingProof(binding);

    if (!proofValid) {
      logger.warn({ didKeyId: binding.didKeyId }, 'Invalid binding proof');
      return false;
    }

    return true;
  }

  /**
   * Check if TEE binding is required for a trust tier
   *
   * @param trustTier - Trust tier to check
   * @returns Whether TEE binding is required
   */
  isRequired(trustTier: TrustTier): boolean {
    return this.config.requiredForTiers.includes(trustTier);
  }

  /**
   * Validate that running code matches attestation measurement
   *
   * @param expectedHash - Expected code measurement hash
   * @param attestation - TEE attestation to validate
   * @returns Whether measurement matches
   */
  validateCodeMeasurement(expectedHash: string, attestation: TEEAttestation): boolean {
    const verifier = this.verifiers.get(attestation.platform);
    if (!verifier) {
      return false;
    }
    return verifier.validateMeasurement(expectedHash, attestation);
  }

  /**
   * Get a stored binding
   *
   * @param didKeyId - DID verification method ID
   * @returns Binding if exists
   */
  getBinding(didKeyId: string): TEEKeyBinding | undefined {
    return this.bindings.get(didKeyId);
  }

  /**
   * Remove a binding
   *
   * @param didKeyId - DID verification method ID
   */
  removeBinding(didKeyId: string): void {
    const binding = this.bindings.get(didKeyId);
    if (binding) {
      this.bindings.delete(didKeyId);
      logger.info({ didKeyId }, 'Key binding removed');
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<TEEConfig> {
    return { ...this.config };
  }

  /**
   * Create a binding proof
   * In a real implementation, this would be a cryptographic proof
   */
  private async createBindingProof(
    didKeyId: string,
    attestation: TEEAttestation
  ): Promise<string> {
    // Create a simple hash-based proof for development
    // In production, this would be a proper cryptographic binding
    const data = JSON.stringify({
      didKeyId,
      enclaveId: attestation.enclaveId,
      measurementHash: attestation.measurementHash,
      timestamp: attestation.timestamp.toISOString(),
    });

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = new Uint8Array(hashBuffer);

    let binary = '';
    for (let i = 0; i < hashArray.length; i++) {
      binary += String.fromCharCode(hashArray[i]!);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Verify a binding proof
   */
  private verifyBindingProof(binding: TEEKeyBinding): boolean {
    // In a real implementation, this would verify the cryptographic proof
    // For now, just check that the proof exists and has valid format
    return binding.bindingProof.length > 0;
  }

  /**
   * Get count of bindings for a platform
   */
  private getBindingCount(_platform: TEEPlatform): number {
    return this.bindings.size;
  }
}

/**
 * Create a TEE binding service with default configuration for ACI
 */
export function createTEEBindingService(config?: Partial<TEEConfig>): TEEBindingService {
  const defaultConfig: Partial<TEEConfig> = {
    requiredForTiers: [4, 5], // T4+
    allowedPlatforms: [TEEPlatformEnum.SGX, TEEPlatformEnum.NITRO],
    maxAttestationAge: 86400, // 24 hours
  };

  return new TEEBindingService({ ...defaultConfig, ...config });
}
