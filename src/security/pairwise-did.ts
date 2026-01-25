/**
 * Pairwise DID Service
 *
 * Implements privacy-preserving pairwise (relationship-specific) DID generation
 * for ACI security hardening. Pairwise DIDs prevent correlation attacks where
 * services could collude to build profiles by tracking a single DID across services.
 *
 * Key features:
 * - HKDF-based deterministic DID derivation
 * - SHA-256 fallback derivation
 * - Secure salt generation
 * - Validation and verification
 * - Registry management for pairwise relationships
 *
 * Data classification requirements:
 * - Public: Pairwise not required
 * - Business: Pairwise recommended
 * - Personal: Pairwise required
 * - Sensitive: Pairwise required
 * - Regulated: Pairwise required + audit trail
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import { VorionError } from '../common/errors.js';
import { Counter, Histogram } from 'prom-client';
import { intentRegistry } from '../intent/metrics.js';
import {
  type PairwiseDIDConfig,
  type PairwiseDerivation,
  type DataClassification,
  type PairwiseDerivationAlgorithm,
  DataClassification as DataClassificationEnum,
  PairwiseDerivationAlgorithm as DerivationAlgorithmEnum,
  pairwiseDIDConfigSchema,
  pairwiseDerivationSchema,
} from './types.js';

const logger = createLogger({ component: 'security-pairwise-did' });

// =============================================================================
// Metrics
// =============================================================================

const pairwiseDidsGenerated = new Counter({
  name: 'vorion_security_pairwise_dids_generated_total',
  help: 'Total pairwise DIDs generated',
  labelNames: ['algorithm'] as const,
  registers: [intentRegistry],
});

const pairwiseDerivationDuration = new Histogram({
  name: 'vorion_security_pairwise_derivation_duration_seconds',
  help: 'Duration of pairwise DID derivation',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05],
  registers: [intentRegistry],
});

const pairwiseValidations = new Counter({
  name: 'vorion_security_pairwise_validations_total',
  help: 'Total pairwise DID validations',
  labelNames: ['result'] as const,
  registers: [intentRegistry],
});

// =============================================================================
// Errors
// =============================================================================

/**
 * Pairwise DID error
 */
export class PairwiseDIDError extends VorionError {
  override code = 'PAIRWISE_DID_ERROR';
  override statusCode = 400;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'PairwiseDIDError';
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * HKDF-Expand function
 * Implements RFC 5869 HKDF-Expand
 */
async function hkdfExpand(
  hashAlg: 'SHA-256' | 'SHA-384' | 'SHA-512',
  prk: ArrayBuffer,
  info: Uint8Array,
  length: number
): Promise<ArrayBuffer> {
  const hashLength = hashAlg === 'SHA-256' ? 32 : hashAlg === 'SHA-384' ? 48 : 64;
  const n = Math.ceil(length / hashLength);

  if (n > 255) {
    throw new PairwiseDIDError('HKDF output length too large');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HMAC', hash: hashAlg },
    false,
    ['sign']
  );

  let t = new Uint8Array(0);
  const okm = new Uint8Array(n * hashLength);

  for (let i = 1; i <= n; i++) {
    const input = new Uint8Array(t.length + info.length + 1);
    input.set(t);
    input.set(info, t.length);
    input[t.length + info.length] = i;

    const signed = await crypto.subtle.sign('HMAC', key, input);
    t = new Uint8Array(signed);
    okm.set(t, (i - 1) * hashLength);
  }

  return okm.buffer.slice(0, length);
}

/**
 * HKDF-Extract function
 * Implements RFC 5869 HKDF-Extract
 */
async function hkdfExtract(
  hashAlg: 'SHA-256' | 'SHA-384' | 'SHA-512',
  salt: Uint8Array,
  ikm: Uint8Array
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    salt.length > 0 ? salt : new Uint8Array(hashAlg === 'SHA-256' ? 32 : hashAlg === 'SHA-384' ? 48 : 64),
    { name: 'HMAC', hash: hashAlg },
    false,
    ['sign']
  );

  return crypto.subtle.sign('HMAC', key, ikm);
}

/**
 * Full HKDF function
 */
async function hkdf(
  hashAlg: 'SHA-256' | 'SHA-384' | 'SHA-512',
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<ArrayBuffer> {
  const prk = await hkdfExtract(hashAlg, salt, ikm);
  return hkdfExpand(hashAlg, prk, info, length);
}

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate cryptographically secure random bytes
 */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Encode bytes as base58 (Bitcoin-style)
 */
function base58Encode(bytes: Uint8Array): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  // Convert bytes to a big integer
  let num = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    num = num * BigInt(256) + BigInt(bytes[i]!);
  }

  // Convert to base58
  let result = '';
  while (num > 0) {
    result = ALPHABET[Number(num % BigInt(58))] + result;
    num = num / BigInt(58);
  }

  // Add leading zeros
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      result = '1' + result;
    } else {
      break;
    }
  }

  return result || '1';
}

/**
 * Create a did:key from a public key
 * Uses Ed25519 key type with multicodec prefix 0xed01
 */
function createDidKey(publicKeyBytes: Uint8Array): string {
  // Multicodec prefix for Ed25519 public key: 0xed01
  const multicodecPrefix = new Uint8Array([0xed, 0x01]);
  const prefixedKey = new Uint8Array(multicodecPrefix.length + publicKeyBytes.length);
  prefixedKey.set(multicodecPrefix);
  prefixedKey.set(publicKeyBytes, multicodecPrefix.length);

  // Multibase prefix 'z' for base58btc
  return `did:key:z${base58Encode(prefixedKey)}`;
}

// =============================================================================
// Pairwise DID Service
// =============================================================================

/**
 * Pairwise DID Service for privacy-preserving identity management
 *
 * @example
 * ```typescript
 * const pairwise = new PairwiseDIDService({
 *   requiredForDataTypes: ['personal', 'sensitive', 'regulated'],
 *   derivationAlgorithm: 'hkdf',
 *   saltLength: 32,
 * });
 *
 * // Derive a pairwise DID
 * const pairwiseDid = await pairwise.derivePairwiseDID(
 *   'did:aci:a3i:vorion:agent-master',
 *   'did:web:api.example.com'
 * );
 *
 * // Validate a pairwise DID
 * const isValid = await pairwise.validatePairwiseDID(
 *   pairwiseDid,
 *   'did:aci:a3i:vorion:agent-master',
 *   'did:web:api.example.com',
 *   salt
 * );
 * ```
 */
export class PairwiseDIDService {
  private config: PairwiseDIDConfig;
  private registry: Map<string, PairwiseDerivation>; // masterDid:rpDid -> derivation

  /**
   * Create a new pairwise DID service
   *
   * @param config - Pairwise DID configuration
   */
  constructor(config: Partial<PairwiseDIDConfig>) {
    const defaultConfig: PairwiseDIDConfig = {
      requiredForDataTypes: [
        DataClassificationEnum.PERSONAL,
        DataClassificationEnum.SENSITIVE,
        DataClassificationEnum.REGULATED,
      ],
      derivationAlgorithm: DerivationAlgorithmEnum.HKDF,
      saltLength: 32,
      hkdfInfo: 'aci-pairwise-did-v1',
    };
    this.config = { ...defaultConfig, ...pairwiseDIDConfigSchema.parse(config) };
    this.registry = new Map();

    logger.info(
      {
        requiredForDataTypes: this.config.requiredForDataTypes,
        derivationAlgorithm: this.config.derivationAlgorithm,
        saltLength: this.config.saltLength,
      },
      'Pairwise DID service initialized'
    );
  }

  /**
   * Derive a pairwise DID for a relying party relationship
   *
   * The derivation is deterministic given the same inputs:
   * - Master DID
   * - Relying party DID
   * - Salt (generated per relationship)
   *
   * @param masterDID - Agent's root/master DID
   * @param relyingPartyDID - Service's DID
   * @param salt - Optional salt (generated if not provided)
   * @returns Pairwise DID string
   */
  async derivePairwiseDID(
    masterDID: string,
    relyingPartyDID: string,
    salt?: string
  ): Promise<string> {
    const startTime = Date.now();

    try {
      // Check if we already have a derivation for this relationship
      const cacheKey = `${masterDID}:${relyingPartyDID}`;
      const existing = this.registry.get(cacheKey);
      if (existing) {
        logger.debug(
          { masterDID, relyingPartyDID, derivedDid: existing.derivedDid },
          'Returning cached pairwise DID'
        );
        return existing.derivedDid;
      }

      // Generate salt if not provided
      const contextSalt = salt ?? this.generateSalt();
      const saltBytes = new TextEncoder().encode(contextSalt);

      // Derive the pairwise DID
      let derivedKey: ArrayBuffer;

      if (this.config.derivationAlgorithm === DerivationAlgorithmEnum.HKDF) {
        // HKDF derivation
        const ikm = new TextEncoder().encode(`${masterDID}:${relyingPartyDID}`);
        const info = new TextEncoder().encode(this.config.hkdfInfo ?? 'aci-pairwise-did-v1');
        derivedKey = await hkdf('SHA-256', ikm, saltBytes, info, 32);
      } else {
        // SHA-256 derivation
        const data = `${masterDID}:${relyingPartyDID}:${contextSalt}`;
        derivedKey = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
      }

      // Create did:key from derived bytes
      const derivedDid = createDidKey(new Uint8Array(derivedKey));

      // Store the derivation
      const derivation: PairwiseDerivation = {
        masterDid: masterDID,
        relyingPartyDid: relyingPartyDID,
        contextSalt,
        derivedDid,
        createdAt: new Date(),
      };

      pairwiseDerivationSchema.parse(derivation);
      this.registry.set(cacheKey, derivation);

      pairwiseDidsGenerated.inc({ algorithm: this.config.derivationAlgorithm });

      logger.info(
        { masterDID, relyingPartyDID, derivedDid },
        'Pairwise DID derived'
      );

      return derivedDid;
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      pairwiseDerivationDuration.observe(duration);
    }
  }

  /**
   * Check if pairwise DID is required for a data type
   *
   * @param dataType - Data classification
   * @returns Whether pairwise DID is required
   */
  isRequired(dataType: DataClassification): boolean {
    return this.config.requiredForDataTypes.includes(dataType);
  }

  /**
   * Validate a pairwise DID
   *
   * Re-derives the DID using the provided parameters and compares
   * with the given pairwise DID.
   *
   * @param pairwiseDID - Pairwise DID to validate
   * @param masterDID - Agent's root/master DID
   * @param relyingPartyDID - Service's DID
   * @param salt - Salt used in derivation
   * @returns Whether the pairwise DID is valid
   */
  async validatePairwiseDID(
    pairwiseDID: string,
    masterDID: string,
    relyingPartyDID: string,
    salt: string
  ): Promise<boolean> {
    try {
      // Re-derive the DID
      const saltBytes = new TextEncoder().encode(salt);
      let derivedKey: ArrayBuffer;

      if (this.config.derivationAlgorithm === DerivationAlgorithmEnum.HKDF) {
        const ikm = new TextEncoder().encode(`${masterDID}:${relyingPartyDID}`);
        const info = new TextEncoder().encode(this.config.hkdfInfo ?? 'aci-pairwise-did-v1');
        derivedKey = await hkdf('SHA-256', ikm, saltBytes, info, 32);
      } else {
        const data = `${masterDID}:${relyingPartyDID}:${salt}`;
        derivedKey = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
      }

      const expectedDid = createDidKey(new Uint8Array(derivedKey));
      const valid = pairwiseDID === expectedDid;

      pairwiseValidations.inc({ result: valid ? 'success' : 'invalid' });

      if (!valid) {
        logger.debug(
          { pairwiseDID, expectedDid, masterDID, relyingPartyDID },
          'Pairwise DID validation failed'
        );
      }

      return valid;
    } catch (error) {
      pairwiseValidations.inc({ result: 'error' });
      logger.error({ error, pairwiseDID }, 'Error validating pairwise DID');
      return false;
    }
  }

  /**
   * Generate a cryptographically secure salt
   *
   * @returns Base64-encoded salt
   */
  generateSalt(): string {
    const bytes = randomBytes(this.config.saltLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Get a stored derivation for a relationship
   *
   * @param masterDID - Agent's root/master DID
   * @param relyingPartyDID - Service's DID
   * @returns Derivation record if exists
   */
  getDerivation(masterDID: string, relyingPartyDID: string): PairwiseDerivation | undefined {
    const cacheKey = `${masterDID}:${relyingPartyDID}`;
    return this.registry.get(cacheKey);
  }

  /**
   * Store a derivation (e.g., loaded from database)
   *
   * @param derivation - Derivation record to store
   */
  storeDerivation(derivation: PairwiseDerivation): void {
    pairwiseDerivationSchema.parse(derivation);
    const cacheKey = `${derivation.masterDid}:${derivation.relyingPartyDid}`;
    this.registry.set(cacheKey, derivation);
  }

  /**
   * List all derivations for a master DID
   *
   * @param masterDID - Agent's root/master DID
   * @returns List of derivations
   */
  listDerivations(masterDID: string): PairwiseDerivation[] {
    const derivations: PairwiseDerivation[] = [];
    const allDerivations = Array.from(this.registry.values());
    for (const derivation of allDerivations) {
      if (derivation.masterDid === masterDID) {
        derivations.push(derivation);
      }
    }
    return derivations;
  }

  /**
   * Revoke a pairwise relationship
   *
   * @param masterDID - Agent's root/master DID
   * @param relyingPartyDID - Service's DID
   * @returns Whether revocation was successful
   */
  revokeRelationship(masterDID: string, relyingPartyDID: string): boolean {
    const cacheKey = `${masterDID}:${relyingPartyDID}`;
    const existed = this.registry.has(cacheKey);
    this.registry.delete(cacheKey);

    if (existed) {
      logger.info({ masterDID, relyingPartyDID }, 'Pairwise relationship revoked');
    }

    return existed;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<PairwiseDIDConfig> {
    return { ...this.config };
  }

  /**
   * Check if a data type should use pairwise DID based on classification
   *
   * @param dataType - Data classification string
   * @returns Whether pairwise is required and the classification
   */
  getRequirement(dataType: string): { required: boolean; classification: DataClassification | null } {
    const normalizedType = dataType.toLowerCase();

    // Map common data type strings to classifications
    const classificationMap: Record<string, DataClassification> = {
      public: DataClassificationEnum.PUBLIC,
      business: DataClassificationEnum.BUSINESS,
      personal: DataClassificationEnum.PERSONAL,
      pii: DataClassificationEnum.PERSONAL,
      sensitive: DataClassificationEnum.SENSITIVE,
      financial: DataClassificationEnum.SENSITIVE,
      health: DataClassificationEnum.SENSITIVE,
      phi: DataClassificationEnum.SENSITIVE,
      regulated: DataClassificationEnum.REGULATED,
      gdpr: DataClassificationEnum.REGULATED,
      hipaa: DataClassificationEnum.REGULATED,
    };

    const classification = classificationMap[normalizedType] ?? null;

    if (classification === null) {
      return { required: false, classification: null };
    }

    return {
      required: this.config.requiredForDataTypes.includes(classification),
      classification,
    };
  }
}

/**
 * Create a pairwise DID service with default configuration for ACI
 */
export function createPairwiseDIDService(
  config?: Partial<PairwiseDIDConfig>
): PairwiseDIDService {
  const defaultConfig: Partial<PairwiseDIDConfig> = {
    requiredForDataTypes: [
      DataClassificationEnum.PERSONAL,
      DataClassificationEnum.SENSITIVE,
      DataClassificationEnum.REGULATED,
    ],
    derivationAlgorithm: DerivationAlgorithmEnum.HKDF,
    saltLength: 32,
    hkdfInfo: 'aci-pairwise-did-v1',
  };

  return new PairwiseDIDService({ ...defaultConfig, ...config });
}
