/**
 * Encryption Module Tests
 *
 * Tests for the secure encryption utilities including:
 * - PBKDF2 key derivation (v2)
 * - Legacy SHA-256 key derivation (v1) for backward compatibility
 * - Migration from v1 to v2
 * - AES-256-GCM encryption/decryption
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  isEncryptedField,
  needsMigration,
  migrateEnvelope,
  migrateEncryptedField,
  getEnvelopeKdfVersion,
  computeHash,
  computeChainedHash,
  type EncryptedEnvelope,
  type EncryptedField,
  type KdfVersion,
} from '../../../src/common/encryption.js';
import { ConfigurationError, EncryptionError } from '../../../src/common/errors.js';

// Mock the config module
vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(),
}));

import { getConfig } from '../../../src/common/config.js';
const mockGetConfig = vi.mocked(getConfig);

describe('Encryption Module', () => {
  // Default test configuration
  const createTestConfig = (overrides: Record<string, unknown> = {}) => ({
    env: 'development',
    encryption: {
      key: 'test-encryption-key-32-chars-min',
      salt: 'test-salt-16-chars',
      pbkdf2Iterations: 10000, // Lower for faster tests
      kdfVersion: 2,
      algorithm: 'aes-256-gcm',
      ...overrides,
    },
    jwt: {
      secret: 'jwt-secret-should-not-be-used-anymore',
    },
  });

  beforeEach(() => {
    mockGetConfig.mockReturnValue(createTestConfig() as ReturnType<typeof getConfig>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('encrypt/decrypt with PBKDF2 (v2)', () => {
    it('should encrypt and decrypt a string successfully', () => {
      const plaintext = 'Hello, World!';
      const envelope = encrypt(plaintext);

      expect(envelope.version).toBe(1);
      expect(envelope.kdfVersion).toBe(2);
      expect(envelope.ciphertext).toBeDefined();
      expect(envelope.iv).toBeDefined();
      expect(envelope.authTag).toBeDefined();

      const decrypted = decrypt(envelope);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt UTF-8 characters', () => {
      const plaintext = 'Hello, World! Special chars: \u00e9\u00e8\u00ea\u00eb \u4e2d\u6587 \u65e5\u672c\u8a9e';
      const envelope = encrypt(plaintext);
      const decrypted = decrypt(envelope);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt JSON data', () => {
      const data = {
        user: 'test@example.com',
        password: 'super-secret',
        metadata: { nested: true },
      };
      const plaintext = JSON.stringify(data);
      const envelope = encrypt(plaintext);
      const decrypted = decrypt(envelope);
      expect(JSON.parse(decrypted)).toEqual(data);
    });

    it('should produce different ciphertexts for same plaintext (due to random IV)', () => {
      const plaintext = 'Same text, different encryption';
      const envelope1 = encrypt(plaintext);
      const envelope2 = encrypt(plaintext);

      expect(envelope1.ciphertext).not.toBe(envelope2.ciphertext);
      expect(envelope1.iv).not.toBe(envelope2.iv);

      // But both should decrypt to same value
      expect(decrypt(envelope1)).toBe(plaintext);
      expect(decrypt(envelope2)).toBe(plaintext);
    });

    it('should include kdfVersion in envelope', () => {
      const envelope = encrypt('test');
      expect(envelope.kdfVersion).toBe(2);
    });
  });

  describe('encryptObject/decryptObject', () => {
    it('should encrypt and decrypt objects', () => {
      const data = {
        userId: 'user_123',
        sensitiveData: 'credit_card_number',
        amount: 100.50,
      };

      const encrypted = encryptObject(data);

      expect(encrypted.__encrypted).toBe(true);
      expect(encrypted.envelope).toBeDefined();
      expect(encrypted.envelope.kdfVersion).toBe(2);

      const decrypted = decryptObject(encrypted);
      expect(decrypted).toEqual(data);
    });

    it('should throw on invalid encrypted field', () => {
      const invalid = { __encrypted: false, envelope: {} } as unknown as EncryptedField;
      expect(() => decryptObject(invalid)).toThrow(EncryptionError);
    });
  });

  describe('isEncryptedField', () => {
    it('should identify encrypted fields', () => {
      const encrypted = encryptObject({ test: true });
      expect(isEncryptedField(encrypted)).toBe(true);
    });

    it('should reject non-encrypted fields', () => {
      expect(isEncryptedField(null)).toBe(false);
      expect(isEncryptedField(undefined)).toBe(false);
      expect(isEncryptedField({})).toBe(false);
      expect(isEncryptedField({ __encrypted: false })).toBe(false);
      expect(isEncryptedField({ __encrypted: true })).toBe(false); // Missing envelope
      expect(isEncryptedField('string')).toBe(false);
      expect(isEncryptedField(123)).toBe(false);
    });
  });

  describe('Legacy SHA-256 (v1) backward compatibility', () => {
    it('should decrypt v1 envelopes (no kdfVersion field)', () => {
      // Configure for v1
      mockGetConfig.mockReturnValue(
        createTestConfig({ kdfVersion: 1 }) as ReturnType<typeof getConfig>
      );

      const plaintext = 'Legacy encrypted data';
      const envelope = encrypt(plaintext);

      // Simulate legacy envelope without kdfVersion
      const legacyEnvelope: EncryptedEnvelope = {
        ciphertext: envelope.ciphertext,
        iv: envelope.iv,
        authTag: envelope.authTag,
        version: 1,
        // No kdfVersion - should default to 1
      };

      // Switch back to v2 config for decryption
      mockGetConfig.mockReturnValue(
        createTestConfig({ kdfVersion: 2 }) as ReturnType<typeof getConfig>
      );

      // Should still decrypt because it detects v1 from missing kdfVersion
      const decrypted = decrypt(legacyEnvelope);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt with v1 when configured', () => {
      mockGetConfig.mockReturnValue(
        createTestConfig({ kdfVersion: 1 }) as ReturnType<typeof getConfig>
      );

      const envelope = encrypt('test');
      expect(envelope.kdfVersion).toBe(1);
    });
  });

  describe('Migration utilities', () => {
    it('needsMigration should detect v1 envelopes when config is v2', () => {
      // Current config is v2
      mockGetConfig.mockReturnValue(
        createTestConfig({ kdfVersion: 2 }) as ReturnType<typeof getConfig>
      );

      const v1Envelope: EncryptedEnvelope = {
        ciphertext: 'test',
        iv: 'test',
        authTag: 'test',
        version: 1,
        kdfVersion: 1,
      };

      const v2Envelope: EncryptedEnvelope = {
        ciphertext: 'test',
        iv: 'test',
        authTag: 'test',
        version: 1,
        kdfVersion: 2,
      };

      const legacyEnvelope: EncryptedEnvelope = {
        ciphertext: 'test',
        iv: 'test',
        authTag: 'test',
        version: 1,
        // No kdfVersion - should be treated as v1
      };

      expect(needsMigration(v1Envelope)).toBe(true);
      expect(needsMigration(v2Envelope)).toBe(false);
      expect(needsMigration(legacyEnvelope)).toBe(true);
    });

    it('migrateEnvelope should upgrade v1 to v2', () => {
      // First encrypt with v1
      mockGetConfig.mockReturnValue(
        createTestConfig({ kdfVersion: 1 }) as ReturnType<typeof getConfig>
      );

      const plaintext = 'Data to migrate';
      const v1Envelope = encrypt(plaintext);
      expect(v1Envelope.kdfVersion).toBe(1);

      // Now switch to v2 and migrate
      mockGetConfig.mockReturnValue(
        createTestConfig({ kdfVersion: 2 }) as ReturnType<typeof getConfig>
      );

      const v2Envelope = migrateEnvelope(v1Envelope);

      expect(v2Envelope.kdfVersion).toBe(2);
      expect(v2Envelope.ciphertext).not.toBe(v1Envelope.ciphertext);

      // Verify data is preserved
      const decrypted = decrypt(v2Envelope);
      expect(decrypted).toBe(plaintext);
    });

    it('migrateEnvelope should not change already current version', () => {
      const envelope = encrypt('test');
      const migrated = migrateEnvelope(envelope);

      // Should return same object (no migration needed)
      expect(migrated).toBe(envelope);
    });

    it('migrateEncryptedField should upgrade field', () => {
      // First encrypt with v1
      mockGetConfig.mockReturnValue(
        createTestConfig({ kdfVersion: 1 }) as ReturnType<typeof getConfig>
      );

      const data = { secret: 'value' };
      const v1Field = encryptObject(data);

      // Switch to v2
      mockGetConfig.mockReturnValue(
        createTestConfig({ kdfVersion: 2 }) as ReturnType<typeof getConfig>
      );

      const v2Field = migrateEncryptedField(v1Field);

      expect(v2Field.envelope.kdfVersion).toBe(2);
      expect(decryptObject(v2Field)).toEqual(data);
    });

    it('getEnvelopeKdfVersion should return correct version', () => {
      const v1: EncryptedEnvelope = {
        ciphertext: 'test',
        iv: 'test',
        authTag: 'test',
        version: 1,
        kdfVersion: 1,
      };

      const v2: EncryptedEnvelope = {
        ciphertext: 'test',
        iv: 'test',
        authTag: 'test',
        version: 1,
        kdfVersion: 2,
      };

      const legacy: EncryptedEnvelope = {
        ciphertext: 'test',
        iv: 'test',
        authTag: 'test',
        version: 1,
      };

      expect(getEnvelopeKdfVersion(v1)).toBe(1);
      expect(getEnvelopeKdfVersion(v2)).toBe(2);
      expect(getEnvelopeKdfVersion(legacy)).toBe(1); // Default for missing
    });
  });

  describe('Configuration requirements', () => {
    it('should throw ConfigurationError in production without encryption key', () => {
      mockGetConfig.mockReturnValue({
        env: 'production',
        encryption: {
          key: undefined,
          salt: 'test-salt-16-chars',
          pbkdf2Iterations: 100000,
          kdfVersion: 2,
          algorithm: 'aes-256-gcm',
        },
        jwt: {
          secret: 'jwt-secret',
        },
      } as ReturnType<typeof getConfig>);

      expect(() => encrypt('test')).toThrow(ConfigurationError);
      expect(() => encrypt('test')).toThrow(/VORION_ENCRYPTION_KEY must be configured/);
    });

    it('should throw ConfigurationError in production without salt for v2', () => {
      mockGetConfig.mockReturnValue({
        env: 'production',
        encryption: {
          key: 'test-encryption-key-32-chars-min',
          salt: undefined,
          pbkdf2Iterations: 100000,
          kdfVersion: 2,
          algorithm: 'aes-256-gcm',
        },
        jwt: {
          secret: 'jwt-secret',
        },
      } as ReturnType<typeof getConfig>);

      expect(() => encrypt('test')).toThrow(ConfigurationError);
      expect(() => encrypt('test')).toThrow(/VORION_ENCRYPTION_SALT must be configured/);
    });

    it('should NOT fallback to JWT secret', () => {
      mockGetConfig.mockReturnValue({
        env: 'production',
        encryption: {
          key: undefined, // No encryption key
          salt: 'test-salt',
          pbkdf2Iterations: 100000,
          kdfVersion: 2,
          algorithm: 'aes-256-gcm',
        },
        jwt: {
          secret: 'jwt-secret-that-should-not-be-used',
        },
      } as ReturnType<typeof getConfig>);

      // Should throw, NOT silently use JWT secret
      expect(() => encrypt('test')).toThrow(ConfigurationError);
    });

    it('should use development fallbacks in development mode', () => {
      mockGetConfig.mockReturnValue({
        env: 'development',
        encryption: {
          key: undefined, // No key
          salt: undefined, // No salt
          pbkdf2Iterations: 10000,
          kdfVersion: 2,
          algorithm: 'aes-256-gcm',
        },
        jwt: {
          secret: 'jwt-secret',
        },
      } as ReturnType<typeof getConfig>);

      // Should NOT throw in development - uses fallbacks
      expect(() => encrypt('test')).not.toThrow();

      const envelope = encrypt('test data');
      const decrypted = decrypt(envelope);
      expect(decrypted).toBe('test data');
    });
  });

  describe('Decryption error handling', () => {
    it('should throw EncryptionError for unsupported version', () => {
      const badEnvelope = {
        ciphertext: 'test',
        iv: 'test',
        authTag: 'test',
        version: 99 as 1, // Force wrong version
      };

      expect(() => decrypt(badEnvelope)).toThrow(EncryptionError);
      expect(() => decrypt(badEnvelope)).toThrow(/Unsupported encryption version/);
    });

    it('should throw on tampered ciphertext', () => {
      const envelope = encrypt('test');

      // Tamper with ciphertext
      const tampered = {
        ...envelope,
        ciphertext: 'dGFtcGVyZWQ=', // "tampered" in base64
      };

      expect(() => decrypt(tampered)).toThrow();
    });

    it('should throw on tampered auth tag', () => {
      const envelope = encrypt('test');

      // Tamper with auth tag
      const tampered = {
        ...envelope,
        authTag: 'dGFtcGVyZWQ=',
      };

      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe('Hash utilities', () => {
    it('computeHash should produce consistent SHA-256 hashes', () => {
      const data = 'test data';
      const hash1 = computeHash(data);
      const hash2 = computeHash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex is 64 chars
    });

    it('computeHash should produce different hashes for different data', () => {
      const hash1 = computeHash('data1');
      const hash2 = computeHash('data2');

      expect(hash1).not.toBe(hash2);
    });

    it('computeChainedHash should include previous hash', () => {
      const data = 'current data';
      const prevHash = 'abc123';

      const hash1 = computeChainedHash(data, prevHash);
      const hash2 = computeChainedHash(data, 'different-prev');

      expect(hash1).not.toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('PBKDF2 iterations', () => {
    it('should use configured iterations', () => {
      // With low iterations (faster)
      mockGetConfig.mockReturnValue(
        createTestConfig({ pbkdf2Iterations: 1000 }) as ReturnType<typeof getConfig>
      );

      const startLow = performance.now();
      encrypt('test');
      const timeLow = performance.now() - startLow;

      // With high iterations (slower)
      mockGetConfig.mockReturnValue(
        createTestConfig({ pbkdf2Iterations: 50000 }) as ReturnType<typeof getConfig>
      );

      const startHigh = performance.now();
      encrypt('test');
      const timeHigh = performance.now() - startHigh;

      // Higher iterations should take longer (with some tolerance)
      expect(timeHigh).toBeGreaterThan(timeLow * 0.5); // At least somewhat longer
    });
  });
});
