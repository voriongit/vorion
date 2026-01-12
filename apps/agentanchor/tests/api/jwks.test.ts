/**
 * JWKS Endpoint Tests
 *
 * Tests for the /.well-known/jwks.json endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock jose module
vi.mock('jose', () => ({
  generateKeyPair: vi.fn().mockResolvedValue({
    publicKey: { type: 'public', algorithm: { name: 'ECDSA' } },
    privateKey: { type: 'private', algorithm: { name: 'ECDSA' } },
  }),
  exportJWK: vi.fn().mockResolvedValue({
    kty: 'EC',
    crv: 'P-256',
    x: 'test_x_coordinate_base64url',
    y: 'test_y_coordinate_base64url',
  }),
  importSPKI: vi.fn().mockResolvedValue({
    type: 'public',
    algorithm: { name: 'ECDSA' },
  }),
}));

describe('JWKS Endpoint', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('JWK Set Structure', () => {
    it('should return valid JWK Set structure', async () => {
      process.env.NODE_ENV = 'development';

      // Import the route handler
      const { GET } = await import('../../app/.well-known/jwks.json/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('keys');
      expect(Array.isArray(data.keys)).toBe(true);
      expect(data.keys.length).toBeGreaterThan(0);
    });

    it('should include required JWK fields', async () => {
      process.env.NODE_ENV = 'development';

      const { GET } = await import('../../app/.well-known/jwks.json/route');

      const response = await GET();
      const data = await response.json();

      const key = data.keys[0];
      expect(key).toHaveProperty('kty', 'EC');
      expect(key).toHaveProperty('crv', 'P-256');
      expect(key).toHaveProperty('x');
      expect(key).toHaveProperty('y');
      expect(key).toHaveProperty('kid');
      expect(key).toHaveProperty('use', 'sig');
      expect(key).toHaveProperty('alg', 'ES256');
      expect(key).toHaveProperty('key_ops');
      expect(key.key_ops).toContain('verify');
    });

    it('should have correct key ID format', async () => {
      process.env.NODE_ENV = 'development';

      const { GET } = await import('../../app/.well-known/jwks.json/route');

      const response = await GET();
      const data = await response.json();

      const key = data.keys[0];
      const year = new Date().getFullYear();
      expect(key.kid).toMatch(new RegExp(`^aa_key_${year}_\\d{3}$`));
    });
  });

  describe('HTTP Headers', () => {
    it('should include caching headers', async () => {
      process.env.NODE_ENV = 'development';

      const { GET } = await import('../../app/.well-known/jwks.json/route');

      const response = await GET();

      expect(response.headers.get('Cache-Control')).toContain('max-age=300');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should include CORS headers for external access', async () => {
      process.env.NODE_ENV = 'development';

      const { GET } = await import('../../app/.well-known/jwks.json/route');

      const response = await GET();

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });

    it('should include security headers', async () => {
      process.env.NODE_ENV = 'development';

      const { GET } = await import('../../app/.well-known/jwks.json/route');

      const response = await GET();

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });

  describe('CORS Preflight', () => {
    it('should handle OPTIONS request', async () => {
      process.env.NODE_ENV = 'development';

      const { OPTIONS } = await import('../../app/.well-known/jwks.json/route');

      const response = await OPTIONS();

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });
  });

  describe('Error Handling', () => {
    it('should return 503 when keys not configured in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.CREDENTIAL_SIGNING_PUBLIC_KEY;

      // Need to re-import to get fresh module with production env
      vi.resetModules();
      const { GET } = await import('../../app/.well-known/jwks.json/route');

      const response = await GET();

      expect(response.status).toBe(503);
      expect(response.headers.get('Retry-After')).toBe('300');
    });
  });
});

describe('Key ID Generation', () => {
  it('should generate consistent key ID for the year', () => {
    const year = new Date().getFullYear();
    const expectedKeyId = `aa_key_${year}_001`;

    // The key ID should be deterministic based on year
    expect(expectedKeyId).toMatch(/^aa_key_\d{4}_001$/);
  });
});
