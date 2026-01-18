/**
 * Encryption utilities for sensitive data at rest
 *
 * Uses AES-256-GCM for authenticated encryption.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { getConfig } from './config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypted data envelope containing all components needed for decryption
 */
export interface EncryptedEnvelope {
  /** Encrypted data as base64 */
  ciphertext: string;
  /** Initialization vector as base64 */
  iv: string;
  /** Authentication tag as base64 */
  authTag: string;
  /** Version for future algorithm changes */
  version: 1;
}

/**
 * Marker interface to identify encrypted fields in JSON
 */
export interface EncryptedField {
  __encrypted: true;
  envelope: EncryptedEnvelope;
}

/**
 * Derive a 256-bit key from the configured secret
 */
function deriveKey(): Buffer {
  const config = getConfig();
  const secret = config.encryption?.key ?? config.jwt.secret;
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a value using AES-256-GCM
 */
export function encrypt(plaintext: string): EncryptedEnvelope {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    version: 1,
  };
}

/**
 * Decrypt a value using AES-256-GCM
 */
export function decrypt(envelope: EncryptedEnvelope): string {
  if (envelope.version !== 1) {
    throw new Error(`Unsupported encryption version: ${envelope.version}`);
  }

  const key = deriveKey();
  const iv = Buffer.from(envelope.iv, 'base64');
  const authTag = Buffer.from(envelope.authTag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Encrypt a JSON object, returning an encrypted field marker
 */
export function encryptObject(data: Record<string, unknown>): EncryptedField {
  const plaintext = JSON.stringify(data);
  return {
    __encrypted: true,
    envelope: encrypt(plaintext),
  };
}

/**
 * Decrypt an encrypted field marker back to a JSON object
 */
export function decryptObject(field: EncryptedField): Record<string, unknown> {
  if (!field.__encrypted || !field.envelope) {
    throw new Error('Invalid encrypted field format');
  }
  const plaintext = decrypt(field.envelope);
  return JSON.parse(plaintext) as Record<string, unknown>;
}

/**
 * Check if a value is an encrypted field
 */
export function isEncryptedField(value: unknown): value is EncryptedField {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__encrypted' in value &&
    (value as EncryptedField).__encrypted === true &&
    'envelope' in value
  );
}

/**
 * Compute SHA-256 hash for tamper detection
 */
export function computeHash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Compute chained hash (includes previous hash for chain integrity)
 */
export function computeChainedHash(data: string, previousHash: string): string {
  return createHash('sha256')
    .update(previousHash)
    .update(data)
    .digest('hex');
}
