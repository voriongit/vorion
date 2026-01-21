/**
 * Encryption utilities for sensitive data at rest
 *
 * Uses AES-256-GCM for authenticated encryption with PBKDF2 key derivation.
 *
 * Security notes:
 * - Key derivation uses PBKDF2-SHA512 with 100,000+ iterations (OWASP recommended)
 * - NEVER falls back to JWT secret (would cause data loss on rotation)
 * - Supports versioned key derivation for future algorithm changes
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash, pbkdf2Sync } from 'node:crypto';
import { getConfig } from './config.js';
import { EncryptionError, ConfigurationError } from './errors.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits for AES-256

/**
 * Development-only fallback salt - NEVER use in production
 * This allows development to work without explicit config
 */
const DEV_FALLBACK_SALT = 'vorion-dev-salt-do-not-use-in-production';
const DEV_FALLBACK_KEY = 'vorion-dev-key-32-chars-minimum!!';

/**
 * Key derivation function versions:
 * - v1: SHA-256 (legacy, insecure - for migration only)
 * - v2: PBKDF2-SHA512 (current, secure)
 */
export type KdfVersion = 1 | 2;

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
  /** Envelope version for future algorithm changes */
  version: 1;
  /**
   * Key derivation version used to encrypt this data
   * - kdfVersion 1: SHA-256 (legacy)
   * - kdfVersion 2: PBKDF2-SHA512 (current)
   * If absent, assumes v1 for backward compatibility
   */
  kdfVersion?: KdfVersion;
}

/**
 * Marker interface to identify encrypted fields in JSON
 */
export interface EncryptedField {
  __encrypted: true;
  envelope: EncryptedEnvelope;
}

/**
 * Derive a 256-bit key using the specified KDF version
 *
 * @param kdfVersion - Which key derivation function to use (1=SHA-256 legacy, 2=PBKDF2)
 * @returns Derived 32-byte key suitable for AES-256
 * @throws Error if encryption key is not configured (no fallback to JWT secret)
 */
function deriveKey(kdfVersion: KdfVersion = 2): Buffer {
  const config = getConfig();
  const env = config.env;
  const isDevelopment = env === 'development';

  // Get encryption key - NEVER fall back to JWT secret
  let encryptionKey = config.encryption?.key;
  if (!encryptionKey) {
    if (isDevelopment) {
      // Development fallback - allows local dev without explicit config
      encryptionKey = DEV_FALLBACK_KEY;
    } else {
      throw new ConfigurationError(
        'VORION_ENCRYPTION_KEY must be configured. ' +
        'Unlike previous versions, encryption no longer falls back to JWT secret ' +
        'to prevent data loss when JWT secrets are rotated.',
        { requiredConfig: 'VORION_ENCRYPTION_KEY' }
      );
    }
  }

  if (kdfVersion === 1) {
    // Legacy SHA-256 derivation (insecure, for migration only)
    // WARNING: This should only be used to decrypt old data during migration
    return createHash('sha256').update(encryptionKey).digest();
  }

  // Version 2: PBKDF2-SHA512 (secure, current)
  let salt = config.encryption?.salt;
  if (!salt) {
    if (isDevelopment) {
      salt = DEV_FALLBACK_SALT;
    } else {
      throw new ConfigurationError(
        'VORION_ENCRYPTION_SALT must be configured for PBKDF2 key derivation. ' +
        'Generate with: openssl rand -base64 16',
        { requiredConfig: 'VORION_ENCRYPTION_SALT' }
      );
    }
  }

  const iterations = config.encryption?.pbkdf2Iterations ?? 100000;

  return pbkdf2Sync(
    encryptionKey,
    salt,
    iterations,
    KEY_LENGTH,
    'sha512'
  );
}

/**
 * Get the current KDF version from config
 */
function getCurrentKdfVersion(): KdfVersion {
  const config = getConfig();
  return (config.encryption?.kdfVersion ?? 2) as KdfVersion;
}

/**
 * Encrypt a value using AES-256-GCM with PBKDF2-derived key
 */
export function encrypt(plaintext: string): EncryptedEnvelope {
  const kdfVersion = getCurrentKdfVersion();
  const key = deriveKey(kdfVersion);
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
    kdfVersion,
  };
}

/**
 * Decrypt a value using AES-256-GCM
 *
 * Automatically detects and uses the correct KDF version from the envelope.
 * This ensures backward compatibility with data encrypted using the legacy SHA-256 method.
 */
export function decrypt(envelope: EncryptedEnvelope): string {
  if (envelope.version !== 1) {
    throw new EncryptionError(`Unsupported encryption version: ${String(envelope.version)}`, { version: envelope.version });
  }

  // Use the KDF version from the envelope, defaulting to v1 for backward compatibility
  // with data encrypted before kdfVersion was added to envelopes
  const kdfVersion: KdfVersion = envelope.kdfVersion ?? 1;
  const key = deriveKey(kdfVersion);
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
    throw new EncryptionError('Invalid encrypted field format', { hasEncryptedFlag: !!field.__encrypted, hasEnvelope: !!field.envelope });
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

// ============================================================================
// Migration Utilities
// ============================================================================

/**
 * Check if an envelope needs migration to the current KDF version
 *
 * @param envelope - The encrypted envelope to check
 * @returns true if the envelope uses an older KDF version than current config
 */
export function needsMigration(envelope: EncryptedEnvelope): boolean {
  const currentVersion = getCurrentKdfVersion();
  const envelopeVersion = envelope.kdfVersion ?? 1;
  return envelopeVersion < currentVersion;
}

/**
 * Migrate an encrypted envelope to the current KDF version
 *
 * This decrypts the data using its original KDF and re-encrypts with the current KDF.
 * Use this during a migration window to upgrade legacy encrypted data.
 *
 * @param envelope - The encrypted envelope to migrate
 * @returns New envelope encrypted with current KDF version
 * @throws EncryptionError if decryption or re-encryption fails
 */
export function migrateEnvelope(envelope: EncryptedEnvelope): EncryptedEnvelope {
  if (!needsMigration(envelope)) {
    return envelope; // Already at current version
  }

  // Decrypt with original KDF version (handled automatically by decrypt)
  const plaintext = decrypt(envelope);

  // Re-encrypt with current KDF version
  return encrypt(plaintext);
}

/**
 * Migrate an encrypted field to the current KDF version
 *
 * @param field - The encrypted field to migrate
 * @returns New field with envelope encrypted using current KDF version
 */
export function migrateEncryptedField(field: EncryptedField): EncryptedField {
  if (!needsMigration(field.envelope)) {
    return field;
  }

  return {
    __encrypted: true,
    envelope: migrateEnvelope(field.envelope),
  };
}

/**
 * Get the KDF version used in an envelope
 *
 * @param envelope - The envelope to check
 * @returns The KDF version (1 for legacy, 2 for PBKDF2)
 */
export function getEnvelopeKdfVersion(envelope: EncryptedEnvelope): KdfVersion {
  return envelope.kdfVersion ?? 1;
}
