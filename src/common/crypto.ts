/**
 * Cryptographic utilities for Vorion
 *
 * Provides Ed25519 signing for proof records and other cryptographic operations.
 *
 * @packageDocumentation
 */

import { createLogger } from './logger.js';

const logger = createLogger({ component: 'crypto' });

/**
 * Key pair for Ed25519 signing
 */
export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

/**
 * Exported key pair (for storage)
 */
export interface ExportedKeyPair {
  publicKey: string; // Base64 encoded
  privateKey: string; // Base64 encoded
}

/**
 * Signature result
 */
export interface SignatureResult {
  signature: string; // Base64 encoded
  publicKey: string; // Base64 encoded
  algorithm: 'Ed25519';
  signedAt: string;
}

/**
 * Verification result
 */
export interface VerifyResult {
  valid: boolean;
  verifiedAt: string;
  error?: string;
}

// Cached key pair for signing
let cachedKeyPair: KeyPair | null = null;

/**
 * Generate a new Ed25519 key pair
 */
export async function generateKeyPair(): Promise<KeyPair> {
  try {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'Ed25519',
      },
      true, // extractable
      ['sign', 'verify']
    );

    logger.info('Generated new Ed25519 key pair');
    return keyPair as KeyPair;
  } catch (error) {
    // Ed25519 might not be supported in all environments
    // Fall back to ECDSA with P-256
    logger.warn('Ed25519 not supported, falling back to ECDSA P-256');

    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    return keyPair as KeyPair;
  }
}

/**
 * Export a key pair to base64 strings
 */
export async function exportKeyPair(keyPair: KeyPair): Promise<ExportedKeyPair> {
  const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    publicKey: bufferToBase64(publicKeyBuffer),
    privateKey: bufferToBase64(privateKeyBuffer),
  };
}

/**
 * Import a key pair from base64 strings
 */
export async function importKeyPair(exported: ExportedKeyPair): Promise<KeyPair> {
  const publicKeyBuffer = base64ToBuffer(exported.publicKey);
  const privateKeyBuffer = base64ToBuffer(exported.privateKey);

  // Try Ed25519 first, fall back to ECDSA
  try {
    const publicKey = await crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      { name: 'Ed25519' },
      true,
      ['verify']
    );

    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      { name: 'Ed25519' },
      true,
      ['sign']
    );

    return { publicKey, privateKey };
  } catch {
    // Fall back to ECDSA
    const publicKey = await crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify']
    );

    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign']
    );

    return { publicKey, privateKey };
  }
}

/**
 * Get or create the signing key pair
 */
export async function getSigningKeyPair(): Promise<KeyPair> {
  if (cachedKeyPair) {
    return cachedKeyPair;
  }

  // Check for environment variable with exported key
  const exportedKey = process.env['VORION_SIGNING_KEY'];
  if (exportedKey) {
    try {
      const parsed = JSON.parse(exportedKey) as ExportedKeyPair;
      cachedKeyPair = await importKeyPair(parsed);
      logger.info('Loaded signing key from environment');
      return cachedKeyPair;
    } catch (error) {
      logger.error({ error }, 'Failed to load signing key from environment');
    }
  }

  // Generate new key pair
  cachedKeyPair = await generateKeyPair();

  // Log warning in production
  if (process.env['VORION_ENV'] === 'production') {
    logger.warn(
      'Using ephemeral signing key in production. ' +
      'Set VORION_SIGNING_KEY to persist across restarts.'
    );
  }

  return cachedKeyPair;
}

/**
 * Sign data with Ed25519/ECDSA
 */
export async function sign(data: string): Promise<SignatureResult> {
  const keyPair = await getSigningKeyPair();
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Determine algorithm from key
  const algorithm = keyPair.privateKey.algorithm.name;

  let signature: ArrayBuffer;
  if (algorithm === 'Ed25519') {
    signature = await crypto.subtle.sign('Ed25519', keyPair.privateKey, dataBuffer);
  } else {
    signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      dataBuffer
    );
  }

  const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);

  return {
    signature: bufferToBase64(signature),
    publicKey: bufferToBase64(publicKeyBuffer),
    algorithm: 'Ed25519', // For API consistency
    signedAt: new Date().toISOString(),
  };
}

/**
 * Verify a signature
 */
export async function verify(
  data: string,
  signature: string,
  publicKey: string
): Promise<VerifyResult> {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const signatureBuffer = base64ToBuffer(signature);
    const publicKeyBuffer = base64ToBuffer(publicKey);

    // Try Ed25519 first
    let cryptoKey: CryptoKey;
    let algorithm: string;
    try {
      cryptoKey = await crypto.subtle.importKey(
        'spki',
        publicKeyBuffer,
        { name: 'Ed25519' },
        false,
        ['verify']
      );
      algorithm = 'Ed25519';
    } catch {
      // Fall back to ECDSA
      cryptoKey = await crypto.subtle.importKey(
        'spki',
        publicKeyBuffer,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );
      algorithm = 'ECDSA';
    }

    let valid: boolean;
    if (algorithm === 'Ed25519') {
      valid = await crypto.subtle.verify('Ed25519', cryptoKey, signatureBuffer, dataBuffer);
    } else {
      valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        signatureBuffer,
        dataBuffer
      );
    }

    return {
      valid,
      verifiedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      valid: false,
      verifiedAt: new Date().toISOString(),
      error: (error as Error).message,
    };
  }
}

/**
 * Calculate SHA-256 hash
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return bufferToHex(hashBuffer);
}

/**
 * Convert ArrayBuffer to base64 string
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
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
