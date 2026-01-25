/**
 * DPoP (Demonstrating Proof-of-Possession) Service
 *
 * Implements sender-constrained tokens per RFC 9449 for ACI security hardening.
 * DPoP binds access tokens to a proof-of-possession key, preventing token theft
 * and replay attacks.
 *
 * Key features:
 * - DPoP proof generation with ES256/ES384/ES512
 * - Proof verification with replay prevention
 * - Access token binding validation
 * - JTI uniqueness enforcement
 *
 * @packageDocumentation
 */

/// <reference lib="dom" />

import { createLogger } from '../common/logger.js';
import { VorionError } from '../common/errors.js';
import { Counter, Histogram } from 'prom-client';
import { intentRegistry } from '../intent/metrics.js';
import {
  type DPoPConfig,
  type DPoPProof,
  type DPoPVerificationResult,
  type JTICache,
  type TrustTier,
  dpopConfigSchema,
  dpopProofSchema,
} from './types.js';

const logger = createLogger({ component: 'security-dpop' });

// =============================================================================
// Metrics
// =============================================================================

const dpopProofsGenerated = new Counter({
  name: 'vorion_security_dpop_proofs_generated_total',
  help: 'Total DPoP proofs generated',
  registers: [intentRegistry],
});

const dpopVerifications = new Counter({
  name: 'vorion_security_dpop_verifications_total',
  help: 'Total DPoP proof verifications',
  labelNames: ['result'] as const, // success, invalid, expired, replay
  registers: [intentRegistry],
});

const dpopVerificationDuration = new Histogram({
  name: 'vorion_security_dpop_verification_duration_seconds',
  help: 'Duration of DPoP proof verification',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
  registers: [intentRegistry],
});

// =============================================================================
// Errors
// =============================================================================

/**
 * DPoP-specific error
 */
export class DPoPError extends VorionError {
  override code = 'DPOP_ERROR';
  override statusCode = 401;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'DPoPError';
  }
}

// =============================================================================
// In-Memory JTI Cache (for development/single-instance)
// =============================================================================

/**
 * Simple in-memory JTI cache implementation
 * For production, use Redis-backed implementation
 */
class InMemoryJTICache implements JTICache {
  private cache = new Map<string, number>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async store(jti: string, expiresAt: Date): Promise<void> {
    this.cache.set(jti, expiresAt.getTime());
  }

  async exists(jti: string): Promise<boolean> {
    const expiry = this.cache.get(jti);
    if (expiry === undefined) {
      return false;
    }
    // Check if expired
    if (Date.now() > expiry) {
      this.cache.delete(jti);
      return false;
    }
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [jti, expiry] of entries) {
      if (now > expiry) {
        this.cache.delete(jti);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a random JTI (JWT ID)
 */
function generateJti(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Calculate JWK thumbprint per RFC 7638
 */
async function calculateJwkThumbprint(jwk: JsonWebKey): Promise<string> {
  // For EC keys, use required members: crv, kty, x, y
  const canonicalJwk: Record<string, unknown> = {
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y,
  };

  // Sort keys lexicographically and create canonical JSON
  const sortedKeys = Object.keys(canonicalJwk).sort();
  const canonical = '{' + sortedKeys.map((k) => `"${k}":"${canonicalJwk[k]}"`).join(',') + '}';

  // SHA-256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Base64url encode
  const hashArray = new Uint8Array(hashBuffer);
  let binary = '';
  for (let i = 0; i < hashArray.length; i++) {
    binary += String.fromCharCode(hashArray[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Calculate access token hash (ath claim)
 */
async function calculateAccessTokenHash(accessToken: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(accessToken);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  let binary = '';
  for (let i = 0; i < hashArray.length; i++) {
    binary += String.fromCharCode(hashArray[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64url encode
 */
function base64urlEncode(data: string | ArrayBuffer): string {
  let binary: string;
  if (typeof data === 'string') {
    binary = data;
  } else {
    const bytes = new Uint8Array(data);
    binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64url decode
 */
function base64urlDecode(str: string): string {
  // Add padding
  const padding = (4 - (str.length % 4)) % 4;
  const padded = str + '='.repeat(padding);
  // Replace URL-safe chars
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
}

/**
 * Get algorithm name for Web Crypto
 */
function getAlgorithmParams(alg: string): EcdsaParams {
  switch (alg) {
    case 'ES256':
      return { name: 'ECDSA', hash: 'SHA-256' };
    case 'ES384':
      return { name: 'ECDSA', hash: 'SHA-384' };
    case 'ES512':
      return { name: 'ECDSA', hash: 'SHA-512' };
    default:
      throw new DPoPError(`Unsupported algorithm: ${alg}`);
  }
}

/**
 * Get curve name for algorithm
 */
function getCurveForAlg(alg: string): string {
  switch (alg) {
    case 'ES256':
      return 'P-256';
    case 'ES384':
      return 'P-384';
    case 'ES512':
      return 'P-521';
    default:
      throw new DPoPError(`Unsupported algorithm: ${alg}`);
  }
}

// =============================================================================
// DPoP Service
// =============================================================================

/**
 * DPoP Service for generating and verifying DPoP proofs
 *
 * @example
 * ```typescript
 * const dpop = new DPoPService({
 *   requiredForTiers: [TrustTier.T2, TrustTier.T3, TrustTier.T4, TrustTier.T5],
 *   maxProofAge: 60,
 *   nonceRequired: false,
 *   clockSkewTolerance: 5,
 *   allowedAlgorithms: ['ES256'],
 * });
 *
 * // Generate a proof
 * const proof = await dpop.generateProof(privateKey, 'POST', 'https://api.example.com/token');
 *
 * // Verify a proof
 * const result = await dpop.verifyProof(proof, publicKey, 'POST', 'https://api.example.com/token');
 * ```
 */
export class DPoPService {
  private config: DPoPConfig;
  private jtiCache: JTICache;

  /**
   * Create a new DPoP service
   *
   * @param config - DPoP configuration
   * @param jtiCache - JTI cache for replay prevention (defaults to in-memory)
   */
  constructor(config: Partial<DPoPConfig>, jtiCache?: JTICache) {
    const defaultConfig: DPoPConfig = {
      requiredForTiers: [2, 3, 4, 5],
      maxProofAge: 60,
      nonceRequired: false,
      clockSkewTolerance: 5,
      allowedAlgorithms: ['ES256'],
    };
    this.config = { ...defaultConfig, ...dpopConfigSchema.parse(config) };
    this.jtiCache = jtiCache ?? new InMemoryJTICache();

    logger.info(
      {
        requiredForTiers: this.config.requiredForTiers,
        maxProofAge: this.config.maxProofAge,
        allowedAlgorithms: this.config.allowedAlgorithms,
      },
      'DPoP service initialized'
    );
  }

  /**
   * Generate a DPoP proof JWT
   *
   * @param privateKey - ECDSA private key for signing
   * @param method - HTTP method (e.g., 'GET', 'POST')
   * @param uri - Target URI
   * @param accessTokenHash - SHA-256 hash of access token (for bound tokens)
   * @param algorithm - Signing algorithm (default: ES256)
   * @returns Signed DPoP proof JWT
   */
  async generateProof(
    privateKey: CryptoKey,
    method: string,
    uri: string,
    accessTokenHash?: string,
    algorithm: 'ES256' | 'ES384' | 'ES512' = 'ES256'
  ): Promise<string> {
    // Export public key for JWK header
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', privateKey);
    // Remove private key component for the header
    delete publicKeyJwk.d;

    // Create header
    const header = {
      typ: 'dpop+jwt',
      alg: algorithm,
      jwk: publicKeyJwk,
    };

    // Create payload
    const payload: DPoPProof = {
      jti: generateJti(),
      htm: method.toUpperCase(),
      htu: uri,
      iat: Math.floor(Date.now() / 1000),
    };

    if (accessTokenHash) {
      payload.ath = accessTokenHash;
    }

    // Encode header and payload
    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(payload));
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    // Sign
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      getAlgorithmParams(algorithm),
      privateKey,
      encoder.encode(dataToSign)
    );

    const encodedSignature = base64urlEncode(signature);

    dpopProofsGenerated.inc();
    logger.debug({ method, uri, jti: payload.jti }, 'DPoP proof generated');

    return `${dataToSign}.${encodedSignature}`;
  }

  /**
   * Verify a DPoP proof JWT
   *
   * @param proof - DPoP proof JWT string
   * @param expectedMethod - Expected HTTP method
   * @param expectedUri - Expected target URI
   * @param expectedAth - Expected access token hash (for bound tokens)
   * @returns Verification result
   */
  async verifyProof(
    proof: string,
    expectedMethod: string,
    expectedUri: string,
    expectedAth?: string
  ): Promise<DPoPVerificationResult> {
    const startTime = Date.now();

    try {
      // Split JWT
      const parts = proof.split('.');
      if (parts.length !== 3) {
        dpopVerifications.inc({ result: 'invalid' });
        return {
          valid: false,
          error: 'Invalid DPoP proof format',
          errorCode: 'INVALID_FORMAT',
          verifiedAt: new Date().toISOString(),
        };
      }

      const [headerB64, payloadB64, signatureB64] = parts;

      // Decode header
      let header: { typ?: string; alg?: string; jwk?: JsonWebKey };
      try {
        header = JSON.parse(base64urlDecode(headerB64!));
      } catch {
        dpopVerifications.inc({ result: 'invalid' });
        return {
          valid: false,
          error: 'Invalid header encoding',
          errorCode: 'INVALID_FORMAT',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Validate header
      if (header.typ !== 'dpop+jwt') {
        dpopVerifications.inc({ result: 'invalid' });
        return {
          valid: false,
          error: 'Invalid typ claim, expected dpop+jwt',
          errorCode: 'INVALID_FORMAT',
          verifiedAt: new Date().toISOString(),
        };
      }

      if (!header.alg || !this.config.allowedAlgorithms.includes(header.alg as 'ES256' | 'ES384' | 'ES512')) {
        dpopVerifications.inc({ result: 'invalid' });
        return {
          valid: false,
          error: `Unsupported algorithm: ${header.alg}`,
          errorCode: 'INVALID_FORMAT',
          verifiedAt: new Date().toISOString(),
        };
      }

      if (!header.jwk) {
        dpopVerifications.inc({ result: 'invalid' });
        return {
          valid: false,
          error: 'Missing jwk in header',
          errorCode: 'INVALID_FORMAT',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Decode payload
      let payload: DPoPProof;
      try {
        payload = JSON.parse(base64urlDecode(payloadB64!));
        dpopProofSchema.parse(payload);
      } catch {
        dpopVerifications.inc({ result: 'invalid' });
        return {
          valid: false,
          error: 'Invalid payload',
          errorCode: 'INVALID_FORMAT',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Check JTI replay
      const jtiExists = await this.jtiCache.exists(payload.jti);
      if (jtiExists) {
        dpopVerifications.inc({ result: 'replay' });
        logger.warn({ jti: payload.jti }, 'DPoP proof replay detected');
        return {
          valid: false,
          error: 'DPoP proof replay detected',
          errorCode: 'REPLAY',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      const age = now - payload.iat;
      if (age > this.config.maxProofAge + this.config.clockSkewTolerance) {
        dpopVerifications.inc({ result: 'expired' });
        return {
          valid: false,
          error: `DPoP proof expired (age: ${age}s, max: ${this.config.maxProofAge}s)`,
          errorCode: 'EXPIRED',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Check future proof (with clock skew tolerance)
      if (payload.iat > now + this.config.clockSkewTolerance) {
        dpopVerifications.inc({ result: 'invalid' });
        return {
          valid: false,
          error: 'DPoP proof issued in the future',
          errorCode: 'INVALID_FORMAT',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Check method
      if (payload.htm.toUpperCase() !== expectedMethod.toUpperCase()) {
        dpopVerifications.inc({ result: 'invalid' });
        return {
          valid: false,
          error: `Method mismatch: expected ${expectedMethod}, got ${payload.htm}`,
          errorCode: 'METHOD_MISMATCH',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Check URI
      if (payload.htu !== expectedUri) {
        dpopVerifications.inc({ result: 'invalid' });
        return {
          valid: false,
          error: `URI mismatch: expected ${expectedUri}, got ${payload.htu}`,
          errorCode: 'URI_MISMATCH',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Check access token hash if provided
      if (expectedAth && payload.ath !== expectedAth) {
        dpopVerifications.inc({ result: 'invalid' });
        return {
          valid: false,
          error: 'Access token hash mismatch',
          errorCode: 'INVALID_FORMAT',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Import public key
      const curve = getCurveForAlg(header.alg);
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        header.jwk,
        { name: 'ECDSA', namedCurve: curve },
        true,
        ['verify']
      );

      // Verify signature
      const encoder = new TextEncoder();
      const dataToVerify = `${headerB64}.${payloadB64}`;

      // Decode signature
      const signaturePadded = signatureB64 + '='.repeat((4 - (signatureB64!.length % 4)) % 4);
      const signatureBase64 = signaturePadded.replace(/-/g, '+').replace(/_/g, '/');
      const signatureBinary = atob(signatureBase64);
      const signatureBytes = new Uint8Array(signatureBinary.length);
      for (let i = 0; i < signatureBinary.length; i++) {
        signatureBytes[i] = signatureBinary.charCodeAt(i);
      }

      const valid = await crypto.subtle.verify(
        getAlgorithmParams(header.alg),
        publicKey,
        signatureBytes,
        encoder.encode(dataToVerify)
      );

      if (!valid) {
        dpopVerifications.inc({ result: 'invalid' });
        return {
          valid: false,
          error: 'Invalid signature',
          errorCode: 'INVALID_SIGNATURE',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Store JTI to prevent replay
      const expiresAt = new Date((payload.iat + this.config.maxProofAge) * 1000);
      await this.jtiCache.store(payload.jti, expiresAt);

      // Calculate key thumbprint
      const keyThumbprint = await calculateJwkThumbprint(header.jwk);

      dpopVerifications.inc({ result: 'success' });
      logger.debug({ jti: payload.jti, keyThumbprint }, 'DPoP proof verified');

      return {
        valid: true,
        keyThumbprint,
        verifiedAt: new Date().toISOString(),
      };
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      dpopVerificationDuration.observe(duration);
    }
  }

  /**
   * Check if DPoP is required for a given trust tier
   *
   * @param trustTier - Trust tier to check
   * @returns Whether DPoP is required
   */
  isRequired(trustTier: TrustTier): boolean {
    return this.config.requiredForTiers.includes(trustTier);
  }

  /**
   * Validate that an access token is properly bound to a DPoP key
   *
   * @param accessToken - The access token
   * @param dpopProof - The DPoP proof
   * @param expectedMethod - Expected HTTP method
   * @param expectedUri - Expected target URI
   * @param tokenCnf - The cnf claim from the access token (containing jkt)
   * @returns Whether the token is properly bound
   */
  async validateBoundToken(
    accessToken: string,
    dpopProof: string,
    expectedMethod: string,
    expectedUri: string,
    tokenCnf?: { jkt?: string }
  ): Promise<boolean> {
    // First verify the proof
    const expectedAth = await calculateAccessTokenHash(accessToken);
    const result = await this.verifyProof(dpopProof, expectedMethod, expectedUri, expectedAth);

    if (!result.valid) {
      logger.debug({ error: result.error }, 'DPoP proof verification failed');
      return false;
    }

    // If token has cnf.jkt, verify it matches the proof key
    if (tokenCnf?.jkt) {
      if (result.keyThumbprint !== tokenCnf.jkt) {
        logger.warn(
          { expected: tokenCnf.jkt, actual: result.keyThumbprint },
          'DPoP key thumbprint mismatch'
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Generate an access token hash for the ath claim
   *
   * @param accessToken - Access token to hash
   * @returns Base64url-encoded SHA-256 hash
   */
  async generateAccessTokenHash(accessToken: string): Promise<string> {
    return calculateAccessTokenHash(accessToken);
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<DPoPConfig> {
    return { ...this.config };
  }
}

/**
 * Create a DPoP service with default configuration for ACI
 */
export function createDPoPService(
  config?: Partial<DPoPConfig>,
  jtiCache?: JTICache
): DPoPService {
  const defaultConfig: Partial<DPoPConfig> = {
    requiredForTiers: [2, 3, 4, 5], // T2+
    maxProofAge: 60,
    nonceRequired: false,
    clockSkewTolerance: 5,
    allowedAlgorithms: ['ES256'],
  };

  return new DPoPService({ ...defaultConfig, ...config }, jtiCache);
}
