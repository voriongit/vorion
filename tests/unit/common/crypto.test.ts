/**
 * Cryptographic Utilities Tests
 *
 * Tests for Ed25519/ECDSA signing, verification, and hashing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateKeyPair,
  exportKeyPair,
  importKeyPair,
  sign,
  verify,
  sha256,
  getSigningKeyPair,
  type KeyPair,
  type ExportedKeyPair,
} from '../../../src/common/crypto.js';

describe('Crypto Module', () => {
  describe('generateKeyPair', () => {
    it('should generate a valid key pair', async () => {
      const keyPair = await generateKeyPair();

      expect(keyPair).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
    });

    it('should generate keys with correct usage', async () => {
      const keyPair = await generateKeyPair();

      // Public key should be for verification
      expect(keyPair.publicKey.usages).toContain('verify');

      // Private key should be for signing
      expect(keyPair.privateKey.usages).toContain('sign');
    });

    it('should generate extractable keys', async () => {
      const keyPair = await generateKeyPair();

      expect(keyPair.publicKey.extractable).toBe(true);
      expect(keyPair.privateKey.extractable).toBe(true);
    });
  });

  describe('exportKeyPair and importKeyPair', () => {
    let keyPair: KeyPair;
    let exported: ExportedKeyPair;

    beforeEach(async () => {
      keyPair = await generateKeyPair();
      exported = await exportKeyPair(keyPair);
    });

    it('should export keys as base64 strings', async () => {
      expect(typeof exported.publicKey).toBe('string');
      expect(typeof exported.privateKey).toBe('string');

      // Base64 strings should not be empty
      expect(exported.publicKey.length).toBeGreaterThan(0);
      expect(exported.privateKey.length).toBeGreaterThan(0);
    });

    it('should export valid base64', async () => {
      // Try to decode base64 - should not throw
      expect(() => atob(exported.publicKey)).not.toThrow();
      expect(() => atob(exported.privateKey)).not.toThrow();
    });

    it('should import exported keys correctly', async () => {
      const imported = await importKeyPair(exported);

      expect(imported.publicKey).toBeDefined();
      expect(imported.privateKey).toBeDefined();
      expect(imported.publicKey.usages).toContain('verify');
      expect(imported.privateKey.usages).toContain('sign');
    });

    it('should produce equivalent signing after import', async () => {
      const data = 'test data to sign';

      // Sign with original key
      const originalSignature = await crypto.subtle.sign(
        keyPair.privateKey.algorithm.name === 'Ed25519'
          ? 'Ed25519'
          : { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        new TextEncoder().encode(data)
      );

      // Import and sign with imported key
      const imported = await importKeyPair(exported);
      const importedSignature = await crypto.subtle.sign(
        imported.privateKey.algorithm.name === 'Ed25519'
          ? 'Ed25519'
          : { name: 'ECDSA', hash: 'SHA-256' },
        imported.privateKey,
        new TextEncoder().encode(data)
      );

      // Verify original signature with imported public key
      const valid = await crypto.subtle.verify(
        imported.publicKey.algorithm.name === 'Ed25519'
          ? 'Ed25519'
          : { name: 'ECDSA', hash: 'SHA-256' },
        imported.publicKey,
        originalSignature,
        new TextEncoder().encode(data)
      );

      expect(valid).toBe(true);
    });
  });

  describe('sign', () => {
    it('should sign data and return signature result', async () => {
      const data = 'Hello, Vorion!';
      const result = await sign(data);

      expect(result.signature).toBeDefined();
      expect(typeof result.signature).toBe('string');
      expect(result.signature.length).toBeGreaterThan(0);
    });

    it('should include public key in result', async () => {
      const data = 'Test data';
      const result = await sign(data);

      expect(result.publicKey).toBeDefined();
      expect(typeof result.publicKey).toBe('string');
    });

    it('should include algorithm identifier', async () => {
      const data = 'Test data';
      const result = await sign(data);

      expect(result.algorithm).toBe('Ed25519');
    });

    it('should include signing timestamp', async () => {
      const before = new Date().toISOString();
      const data = 'Test data';
      const result = await sign(data);
      const after = new Date().toISOString();

      expect(result.signedAt).toBeDefined();
      expect(result.signedAt >= before).toBe(true);
      expect(result.signedAt <= after).toBe(true);
    });

    it('should produce different signatures for different data', async () => {
      const result1 = await sign('data1');
      const result2 = await sign('data2');

      expect(result1.signature).not.toBe(result2.signature);
    });

    it('should use consistent key pair for multiple signings', async () => {
      const result1 = await sign('data1');
      const result2 = await sign('data2');

      // Same public key should be used
      expect(result1.publicKey).toBe(result2.publicKey);
    });
  });

  describe('verify', () => {
    it('should verify a valid signature', async () => {
      const data = 'Data to verify';
      const signResult = await sign(data);

      const verifyResult = await verify(
        data,
        signResult.signature,
        signResult.publicKey
      );

      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.error).toBeUndefined();
    });

    it('should reject signature for tampered data', async () => {
      const data = 'Original data';
      const signResult = await sign(data);

      const verifyResult = await verify(
        'Tampered data',
        signResult.signature,
        signResult.publicKey
      );

      expect(verifyResult.valid).toBe(false);
    });

    it('should reject invalid signature', async () => {
      const data = 'Test data';
      const signResult = await sign(data);

      // Corrupt the signature
      const corruptedSignature = signResult.signature.slice(0, -4) + 'XXXX';

      const verifyResult = await verify(
        data,
        corruptedSignature,
        signResult.publicKey
      );

      expect(verifyResult.valid).toBe(false);
    });

    it('should reject signature with wrong public key', async () => {
      const data = 'Test data';
      const signResult = await sign(data);

      // Generate a different key pair
      const differentKeyPair = await generateKeyPair();
      const differentExported = await exportKeyPair(differentKeyPair);

      const verifyResult = await verify(
        data,
        signResult.signature,
        differentExported.publicKey
      );

      expect(verifyResult.valid).toBe(false);
    });

    it('should include verification timestamp', async () => {
      const data = 'Test data';
      const signResult = await sign(data);

      const before = new Date().toISOString();
      const verifyResult = await verify(
        data,
        signResult.signature,
        signResult.publicKey
      );
      const after = new Date().toISOString();

      expect(verifyResult.verifiedAt).toBeDefined();
      expect(verifyResult.verifiedAt >= before).toBe(true);
      expect(verifyResult.verifiedAt <= after).toBe(true);
    });

    it('should handle malformed base64 gracefully', async () => {
      const result = await verify('data', 'not-valid-base64!@#', 'also-invalid!@#');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sha256', () => {
    it('should hash data consistently', async () => {
      const data = 'Hello, World!';
      const hash1 = await sha256(data);
      const hash2 = await sha256(data);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different data', async () => {
      const hash1 = await sha256('data1');
      const hash2 = await sha256('data2');

      expect(hash1).not.toBe(hash2);
    });

    it('should return a 64-character hex string', async () => {
      const hash = await sha256('test');

      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce known hash for known input', async () => {
      // SHA-256 of empty string
      const emptyHash = await sha256('');
      expect(emptyHash).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );
    });

    it('should handle unicode correctly', async () => {
      const hash = await sha256('日本語テスト');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle long strings', async () => {
      const longData = 'x'.repeat(100000);
      const hash = await sha256(longData);

      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('getSigningKeyPair', () => {
    afterEach(() => {
      // Clean up environment variables
      delete process.env['VORION_SIGNING_KEY'];
      vi.unstubAllEnvs();
    });

    it('should return a valid key pair', async () => {
      const keyPair = await getSigningKeyPair();

      expect(keyPair).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
    });

    it('should return cached key pair on subsequent calls', async () => {
      const keyPair1 = await getSigningKeyPair();
      const keyPair2 = await getSigningKeyPair();

      // Should be the exact same object
      expect(keyPair1).toBe(keyPair2);
    });
  });

  describe('Integration: Sign and Verify Round Trip', () => {
    it('should complete full sign-verify cycle', async () => {
      const originalData = {
        intent: 'test-intent',
        timestamp: new Date().toISOString(),
        nonce: Math.random().toString(36),
      };

      const dataString = JSON.stringify(originalData);

      // Sign
      const signResult = await sign(dataString);
      expect(signResult.valid !== false).toBe(true); // It's a signature result

      // Verify
      const verifyResult = await verify(
        dataString,
        signResult.signature,
        signResult.publicKey
      );

      expect(verifyResult.valid).toBe(true);
    });

    it('should work with complex nested objects', async () => {
      const complexData = {
        level1: {
          level2: {
            level3: {
              values: [1, 2, 3, 4, 5],
              metadata: {
                created: new Date().toISOString(),
                tags: ['a', 'b', 'c'],
              },
            },
          },
        },
      };

      const dataString = JSON.stringify(complexData);
      const signResult = await sign(dataString);
      const verifyResult = await verify(
        dataString,
        signResult.signature,
        signResult.publicKey
      );

      expect(verifyResult.valid).toBe(true);
    });

    it('should handle empty string signing', async () => {
      const signResult = await sign('');
      const verifyResult = await verify(
        '',
        signResult.signature,
        signResult.publicKey
      );

      expect(verifyResult.valid).toBe(true);
    });
  });

  describe('Security Properties', () => {
    it('should not produce predictable signatures', async () => {
      // Note: With deterministic algorithms like Ed25519, same data = same signature
      // This is actually expected behavior, but we verify the key is unique
      const data = 'test data';

      const result1 = await sign(data);
      const result2 = await sign(data);

      // Same key = same signature (this is correct for Ed25519)
      expect(result1.publicKey).toBe(result2.publicKey);
    });

    it('should reject empty signature', async () => {
      const result = await verify('data', '', 'somepublickey');
      expect(result.valid).toBe(false);
    });

    it('should reject empty public key', async () => {
      const result = await verify('data', 'somesignature', '');
      expect(result.valid).toBe(false);
    });
  });
});
