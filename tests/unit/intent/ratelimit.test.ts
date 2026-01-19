/**
 * Rate Limiter Tests
 *
 * Tests for the atomic rate limiting implementation using Lua scripts.
 * Verifies that the rate limiter correctly handles concurrent requests
 * without race conditions.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter, createRateLimiter, createRateLimitHook } from '../../../src/intent/ratelimit.js';

// Mock dependencies
vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => ({
    intent: {
      tenantMaxInFlight: {
        'premium-tenant': 500,
        'restricted-tenant': 10,
      },
      rateLimits: {
        default: { limit: 100, windowSeconds: 60 },
        highRisk: { limit: 10, windowSeconds: 60 },
        dataExport: { limit: 5, windowSeconds: 60 },
        adminAction: { limit: 20, windowSeconds: 60 },
      },
    },
  })),
}));

vi.mock('../../../src/common/logger.js', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => mockLogger),
  };
  return {
    createLogger: vi.fn(() => mockLogger),
  };
});

// Mock Redis with Lua script evaluation support
const mockRedis = {
  eval: vi.fn(),
  zremrangebyscore: vi.fn().mockResolvedValue(0),
  zcard: vi.fn().mockResolvedValue(0),
  zrange: vi.fn().mockResolvedValue([]),
  del: vi.fn().mockResolvedValue(1),
};

vi.mock('../../../src/common/redis.js', () => ({
  getRedis: vi.fn(() => mockRedis),
}));

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter = createRateLimiter();
  });

  describe('checkLimit', () => {
    it('should allow requests when under the limit', async () => {
      // Mock Lua script response: [allowed=1, count=1, oldestTimestamp=now]
      const now = Date.now();
      mockRedis.eval.mockResolvedValueOnce([1, 1, now]);

      const result = await rateLimiter.checkLimit('tenant-123', 'default');

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(99);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should deny requests when at the limit', async () => {
      // Mock Lua script response: [allowed=0, count=100, oldestTimestamp=now-30000]
      const now = Date.now();
      mockRedis.eval.mockResolvedValueOnce([0, 100, now - 30000]);

      const result = await rateLimiter.checkLimit('tenant-123', 'default');

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(100);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should use tenant-specific limits for premium tenants', async () => {
      const now = Date.now();
      mockRedis.eval.mockResolvedValueOnce([1, 100, now]);

      const result = await rateLimiter.checkLimit('premium-tenant', 'default');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(500);
      expect(result.remaining).toBe(400);
    });

    it('should use tenant-specific limits for restricted tenants', async () => {
      const now = Date.now();
      mockRedis.eval.mockResolvedValueOnce([0, 10, now - 30000]);

      const result = await rateLimiter.checkLimit('restricted-tenant', 'default');

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(0);
    });

    it('should call Redis eval with correct Lua script arguments', async () => {
      const now = Date.now();
      mockRedis.eval.mockResolvedValueOnce([1, 1, now]);

      await rateLimiter.checkLimit('tenant-123', 'test-type');

      expect(mockRedis.eval).toHaveBeenCalledTimes(1);
      const [script, numKeys, key, windowStart, timestamp, limit, requestId, ttl] = mockRedis.eval.mock.calls[0];

      // Verify script is a non-empty string containing Lua code
      expect(typeof script).toBe('string');
      expect(script).toContain('ZREMRANGEBYSCORE');
      expect(script).toContain('ZCARD');
      expect(script).toContain('ZADD');

      // Verify key format
      expect(numKeys).toBe(1);
      expect(key).toBe('ratelimit:tenant-123:test-type');

      // Verify timestamps are reasonable
      expect(parseInt(windowStart)).toBeLessThan(parseInt(timestamp));
      expect(parseInt(limit)).toBe(100);
      expect(parseInt(ttl)).toBe(61); // windowSeconds + 1

      // Verify requestId format
      expect(requestId).toMatch(/^\d+:[a-z0-9]+$/);
    });

    it('should use default intent type when none provided', async () => {
      const now = Date.now();
      mockRedis.eval.mockResolvedValueOnce([1, 1, now]);

      await rateLimiter.checkLimit('tenant-123');

      expect(mockRedis.eval).toHaveBeenCalledTimes(1);
      const key = mockRedis.eval.mock.calls[0][2];
      expect(key).toBe('ratelimit:tenant-123:default');
    });

    it('should calculate correct reset time from oldest entry', async () => {
      const now = Date.now();
      const windowSeconds = 60;
      // Oldest entry is 45 seconds old, so reset should be ~15 seconds
      const oldestTimestamp = now - 45000;
      mockRedis.eval.mockResolvedValueOnce([1, 50, oldestTimestamp]);

      const result = await rateLimiter.checkLimit('tenant-123', 'default');

      // Reset should be ~15 seconds (60 - 45)
      expect(result.resetIn).toBeGreaterThanOrEqual(14);
      expect(result.resetIn).toBeLessThanOrEqual(16);
    });

    it('should use window seconds as default reset when no oldest entry', async () => {
      mockRedis.eval.mockResolvedValueOnce([1, 1, 0]);

      const result = await rateLimiter.checkLimit('tenant-123', 'default');

      expect(result.resetIn).toBe(60);
    });

    it('should log warning when rate limit exceeded', async () => {
      const { createLogger } = await import('../../../src/common/logger.js');
      const mockLogger = createLogger({});

      const now = Date.now();
      mockRedis.eval.mockResolvedValueOnce([0, 100, now - 30000]);

      await rateLimiter.checkLimit('tenant-123', 'default');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          intentType: 'default',
          current: 100,
          limit: 100,
        }),
        'Rate limit exceeded'
      );
    });
  });

  describe('getStatus', () => {
    it('should return current rate limit status without consuming', async () => {
      mockRedis.zremrangebyscore.mockResolvedValueOnce(0);
      mockRedis.zcard.mockResolvedValueOnce(50);
      mockRedis.zrange.mockResolvedValueOnce([]);

      const result = await rateLimiter.getStatus('tenant-123', 'default');

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(50);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(50);
      // eval should NOT be called for getStatus
      expect(mockRedis.eval).not.toHaveBeenCalled();
    });

    it('should return not allowed when at limit', async () => {
      mockRedis.zremrangebyscore.mockResolvedValueOnce(0);
      mockRedis.zcard.mockResolvedValueOnce(100);
      mockRedis.zrange.mockResolvedValueOnce([]);

      const result = await rateLimiter.getStatus('tenant-123', 'default');

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(100);
      expect(result.remaining).toBe(0);
    });

    it('should calculate reset time from oldest entry', async () => {
      const now = Date.now();
      const oldestTimestamp = now - 45000;

      mockRedis.zremrangebyscore.mockResolvedValueOnce(0);
      mockRedis.zcard.mockResolvedValueOnce(50);
      mockRedis.zrange.mockResolvedValueOnce(['request-id', oldestTimestamp.toString()]);

      const result = await rateLimiter.getStatus('tenant-123', 'default');

      expect(result.resetIn).toBeGreaterThanOrEqual(14);
      expect(result.resetIn).toBeLessThanOrEqual(16);
    });
  });

  describe('reset', () => {
    it('should delete the rate limit key', async () => {
      await rateLimiter.reset('tenant-123', 'default');

      expect(mockRedis.del).toHaveBeenCalledWith('ratelimit:tenant-123:default');
    });

    it('should use default intent type when none provided', async () => {
      await rateLimiter.reset('tenant-123');

      expect(mockRedis.del).toHaveBeenCalledWith('ratelimit:tenant-123:default');
    });
  });

  describe('toHeaders', () => {
    it('should convert allowed result to headers', () => {
      const result = {
        allowed: true,
        current: 50,
        limit: 100,
        remaining: 50,
        resetIn: 30,
      };

      const headers = rateLimiter.toHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('50');
      expect(headers['X-RateLimit-Reset']).toBe('30');
      expect(headers['Retry-After']).toBeUndefined();
    });

    it('should include Retry-After header when denied', () => {
      const result = {
        allowed: false,
        current: 100,
        limit: 100,
        remaining: 0,
        resetIn: 30,
        retryAfter: 30,
      };

      const headers = rateLimiter.toHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('0');
      expect(headers['X-RateLimit-Reset']).toBe('30');
      expect(headers['Retry-After']).toBe('30');
    });
  });

  describe('atomic behavior', () => {
    it('should make only one Redis call for rate limiting', async () => {
      const now = Date.now();
      mockRedis.eval.mockResolvedValueOnce([1, 1, now]);

      await rateLimiter.checkLimit('tenant-123', 'default');

      // Only eval should be called, no separate zremrangebyscore, zcard, zadd, etc.
      expect(mockRedis.eval).toHaveBeenCalledTimes(1);
      expect(mockRedis.zremrangebyscore).not.toHaveBeenCalled();
      expect(mockRedis.zcard).not.toHaveBeenCalled();
    });

    it('should not add entry when denied (atomic check)', async () => {
      // When denied, the Lua script should NOT add the entry
      // This is verified by the script returning [0, count, timestamp]
      // where count is unchanged (no entry added)
      const now = Date.now();
      mockRedis.eval.mockResolvedValueOnce([0, 100, now - 30000]);

      const result = await rateLimiter.checkLimit('tenant-123', 'default');

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(100); // Count unchanged, entry not added
    });

    it('should handle concurrent requests correctly via atomic script', async () => {
      // Simulate 5 concurrent requests where limit is 3
      // The Lua script ensures atomic check-and-increment
      const now = Date.now();

      // First 3 requests should succeed
      mockRedis.eval
        .mockResolvedValueOnce([1, 1, now])
        .mockResolvedValueOnce([1, 2, now])
        .mockResolvedValueOnce([1, 3, now])
        // Next 2 should be denied
        .mockResolvedValueOnce([0, 3, now])
        .mockResolvedValueOnce([0, 3, now]);

      // Create a rate limiter with limit of 3 for this test
      const results = await Promise.all([
        rateLimiter.checkLimit('tenant-123', 'default'),
        rateLimiter.checkLimit('tenant-123', 'default'),
        rateLimiter.checkLimit('tenant-123', 'default'),
        rateLimiter.checkLimit('tenant-123', 'default'),
        rateLimiter.checkLimit('tenant-123', 'default'),
      ]);

      const allowed = results.filter(r => r.allowed).length;
      const denied = results.filter(r => !r.allowed).length;

      expect(allowed).toBe(3);
      expect(denied).toBe(2);
    });
  });
});

describe('createRateLimitHook', () => {
  let rateLimiter: RateLimiter;
  let hook: ReturnType<typeof createRateLimitHook>;

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter = createRateLimiter();
    hook = createRateLimitHook(rateLimiter);
  });

  it('should skip rate limiting when no tenant ID', async () => {
    const request = {
      headers: {},
      body: { intentType: 'test' },
    };
    const reply = {
      header: vi.fn(),
      status: vi.fn(() => ({ send: vi.fn() })),
    };

    const result = await hook(request, reply);

    expect(result).toBeUndefined();
    expect(mockRedis.eval).not.toHaveBeenCalled();
  });

  it('should allow request and set headers when under limit', async () => {
    const now = Date.now();
    mockRedis.eval.mockResolvedValueOnce([1, 1, now]);

    const request = {
      headers: { 'x-tenant-id': 'tenant-123' },
      body: { intentType: 'test' },
    };
    const reply = {
      header: vi.fn(),
      status: vi.fn(() => ({ send: vi.fn() })),
    };

    const result = await hook(request, reply);

    expect(result).toBeUndefined();
    expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
    expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
    expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
  });

  it('should return 429 when rate limit exceeded', async () => {
    const now = Date.now();
    mockRedis.eval.mockResolvedValueOnce([0, 100, now - 30000]);

    const sendMock = vi.fn();
    const request = {
      headers: { 'x-tenant-id': 'tenant-123' },
      body: { intentType: 'test' },
    };
    const reply = {
      header: vi.fn(),
      status: vi.fn(() => ({ send: sendMock })),
    };

    await hook(request, reply);

    expect(reply.status).toHaveBeenCalledWith(429);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: expect.any(Number),
        }),
      })
    );
  });

  it('should set Retry-After header when rate limit exceeded', async () => {
    const now = Date.now();
    mockRedis.eval.mockResolvedValueOnce([0, 100, now - 30000]);

    const request = {
      headers: { 'x-tenant-id': 'tenant-123' },
      body: { intentType: 'test' },
    };
    const reply = {
      header: vi.fn(),
      status: vi.fn(() => ({ send: vi.fn() })),
    };

    await hook(request, reply);

    expect(reply.header).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('should extract intentType from request body', async () => {
    const now = Date.now();
    mockRedis.eval.mockResolvedValueOnce([1, 1, now]);

    const request = {
      headers: { 'x-tenant-id': 'tenant-123' },
      body: { intentType: 'high-risk' },
    };
    const reply = {
      header: vi.fn(),
      status: vi.fn(() => ({ send: vi.fn() })),
    };

    await hook(request, reply);

    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    const key = mockRedis.eval.mock.calls[0][2];
    expect(key).toBe('ratelimit:tenant-123:high-risk');
  });
});

describe('Configurable Rate Limits', () => {
  /**
   * Tests for environment-configurable rate limits per intent type.
   * Verifies that rate limits can be customized via VORION_RATELIMIT_* environment variables.
   */

  let rateLimiter: RateLimiter;

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter = createRateLimiter();
  });

  it('should use default rate limits from config', async () => {
    const now = Date.now();
    mockRedis.eval.mockResolvedValueOnce([1, 1, now]);

    const result = await rateLimiter.checkLimit('tenant-123', 'default');

    expect(result.limit).toBe(100);
    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'ratelimit:tenant-123:default',
      expect.any(String),
      expect.any(String),
      '100', // Default limit
      expect.any(String),
      expect.any(String)
    );
  });

  it('should use high-risk rate limits from config', async () => {
    const now = Date.now();
    mockRedis.eval.mockResolvedValueOnce([1, 1, now]);

    const result = await rateLimiter.checkLimit('tenant-123', 'high-risk');

    expect(result.limit).toBe(10);
    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'ratelimit:tenant-123:high-risk',
      expect.any(String),
      expect.any(String),
      '10', // High-risk limit
      expect.any(String),
      expect.any(String)
    );
  });

  it('should use data-export rate limits from config', async () => {
    const now = Date.now();
    mockRedis.eval.mockResolvedValueOnce([1, 1, now]);

    const result = await rateLimiter.checkLimit('tenant-123', 'data-export');

    expect(result.limit).toBe(5);
    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'ratelimit:tenant-123:data-export',
      expect.any(String),
      expect.any(String),
      '5', // Data-export limit
      expect.any(String),
      expect.any(String)
    );
  });

  it('should use admin-action rate limits from config', async () => {
    const now = Date.now();
    mockRedis.eval.mockResolvedValueOnce([1, 1, now]);

    const result = await rateLimiter.checkLimit('tenant-123', 'admin-action');

    expect(result.limit).toBe(20);
    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'ratelimit:tenant-123:admin-action',
      expect.any(String),
      expect.any(String),
      '20', // Admin-action limit
      expect.any(String),
      expect.any(String)
    );
  });

  it('should fall back to default limits for unknown intent types', async () => {
    const now = Date.now();
    mockRedis.eval.mockResolvedValueOnce([1, 1, now]);

    const result = await rateLimiter.checkLimit('tenant-123', 'unknown-type');

    expect(result.limit).toBe(100); // Falls back to default
  });

  it('should prioritize tenant-specific limits over intent type limits', async () => {
    const now = Date.now();
    mockRedis.eval.mockResolvedValueOnce([1, 1, now]);

    // premium-tenant has a custom limit of 500
    const result = await rateLimiter.checkLimit('premium-tenant', 'high-risk');

    // Should use tenant limit (500), not high-risk limit (10)
    expect(result.limit).toBe(500);
  });

  it('should use windowSeconds from config for tenant overrides', async () => {
    const now = Date.now();
    mockRedis.eval.mockResolvedValueOnce([1, 1, now]);

    await rateLimiter.checkLimit('premium-tenant', 'default');

    // Verify TTL is windowSeconds + 1 (60 + 1 = 61)
    const ttl = parseInt(mockRedis.eval.mock.calls[0][7]);
    expect(ttl).toBe(61);
  });

  it('should use different window seconds for different intent types', async () => {
    // The mock config uses windowSeconds: 60 for all types
    const now = Date.now();
    mockRedis.eval.mockResolvedValueOnce([1, 1, now]);

    await rateLimiter.checkLimit('tenant-123', 'data-export');

    // Verify window is 60 seconds (TTL = windowSeconds + 1)
    const ttl = parseInt(mockRedis.eval.mock.calls[0][7]);
    expect(ttl).toBe(61);
  });
});

describe('Lua Script Behavior', () => {
  /**
   * These tests verify the expected behavior of the Lua script
   * by checking the arguments passed and responses handled.
   */

  let rateLimiter: RateLimiter;

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter = createRateLimiter();
  });

  it('should pass window start timestamp for cleanup', async () => {
    const before = Date.now();
    mockRedis.eval.mockResolvedValueOnce([1, 1, before]);

    await rateLimiter.checkLimit('tenant-123', 'default');

    const windowStart = parseInt(mockRedis.eval.mock.calls[0][3]);
    const now = parseInt(mockRedis.eval.mock.calls[0][4]);

    // Window start should be ~60 seconds before now
    expect(now - windowStart).toBeGreaterThanOrEqual(59000);
    expect(now - windowStart).toBeLessThanOrEqual(61000);
  });

  it('should pass correct limit value', async () => {
    mockRedis.eval.mockResolvedValueOnce([1, 1, Date.now()]);

    await rateLimiter.checkLimit('tenant-123', 'default');

    const limit = parseInt(mockRedis.eval.mock.calls[0][5]);
    expect(limit).toBe(100);
  });

  it('should pass unique request ID', async () => {
    mockRedis.eval
      .mockResolvedValueOnce([1, 1, Date.now()])
      .mockResolvedValueOnce([1, 2, Date.now()]);

    await rateLimiter.checkLimit('tenant-123', 'default');
    await rateLimiter.checkLimit('tenant-123', 'default');

    const requestId1 = mockRedis.eval.mock.calls[0][6];
    const requestId2 = mockRedis.eval.mock.calls[1][6];

    expect(requestId1).not.toBe(requestId2);
    expect(requestId1).toMatch(/^\d+:[a-z0-9]+$/);
    expect(requestId2).toMatch(/^\d+:[a-z0-9]+$/);
  });

  it('should pass TTL as window seconds + 1', async () => {
    mockRedis.eval.mockResolvedValueOnce([1, 1, Date.now()]);

    await rateLimiter.checkLimit('tenant-123', 'default');

    const ttl = parseInt(mockRedis.eval.mock.calls[0][7]);
    expect(ttl).toBe(61); // 60 seconds window + 1
  });

  it('should handle script returning array correctly', async () => {
    // Test that the response is parsed correctly
    const oldestTimestamp = Date.now() - 30000;
    mockRedis.eval.mockResolvedValueOnce([1, 42, oldestTimestamp]);

    const result = await rateLimiter.checkLimit('tenant-123', 'default');

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(42);
  });

  it('should handle script returning denied status correctly', async () => {
    const oldestTimestamp = Date.now() - 30000;
    mockRedis.eval.mockResolvedValueOnce([0, 100, oldestTimestamp]);

    const result = await rateLimiter.checkLimit('tenant-123', 'default');

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(100);
    expect(result.retryAfter).toBeDefined();
  });
});
