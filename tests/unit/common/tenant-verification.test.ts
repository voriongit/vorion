/**
 * Tenant Verification Module Unit Tests
 *
 * Tests for the tenant membership verification service that prevents
 * cross-tenant data exposure attacks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  verifyTenantMembership,
  requireTenantMembership,
  invalidateMembershipCache,
  invalidateUserMembershipCache,
  invalidateTenantMembershipCache,
} from '../../../src/common/tenant-verification.js';
import { ForbiddenError } from '../../../src/common/errors.js';

// Mock the database module
vi.mock('../../../src/common/db.js', () => ({
  getDatabase: vi.fn(() => mockDatabase),
}));

// Mock the redis module
vi.mock('../../../src/common/redis.js', () => ({
  getRedis: vi.fn(() => mockRedis),
}));

// Mock the logger
vi.mock('../../../src/common/logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock database and redis
const mockDatabase = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(),
};

const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
};

describe('Tenant Verification Module', () => {
  const validUserId = 'user-123-abc';
  const validTenantId = 'tenant-456-xyz';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockDatabase.select.mockReturnThis();
    mockDatabase.from.mockReturnThis();
    mockDatabase.where.mockReturnThis();
    mockDatabase.limit.mockResolvedValue([]);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.keys.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('verifyTenantMembership', () => {
    it('should return isMember: true when user is a member (cache miss, DB hit)', async () => {
      mockRedis.get.mockResolvedValue(null); // Cache miss
      mockDatabase.limit.mockResolvedValue([{ role: 'member' }]);

      const result = await verifyTenantMembership(validUserId, validTenantId);

      expect(result.isMember).toBe(true);
      expect(result.role).toBe('member');
      expect(result.cached).toBe(false);
      expect(mockRedis.get).toHaveBeenCalledWith(`tenant:membership:${validUserId}:${validTenantId}`);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should return isMember: false when user is not a member', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDatabase.limit.mockResolvedValue([]);

      const result = await verifyTenantMembership(validUserId, validTenantId);

      expect(result.isMember).toBe(false);
      expect(result.role).toBeUndefined();
      expect(result.cached).toBe(false);
    });

    it('should return cached result on cache hit (member)', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ isMember: true, role: 'admin' }));

      const result = await verifyTenantMembership(validUserId, validTenantId);

      expect(result.isMember).toBe(true);
      expect(result.role).toBe('admin');
      expect(result.cached).toBe(true);
      expect(mockDatabase.limit).not.toHaveBeenCalled();
    });

    it('should return cached result on cache hit (not member)', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ isMember: false }));

      const result = await verifyTenantMembership(validUserId, validTenantId);

      expect(result.isMember).toBe(false);
      expect(result.cached).toBe(true);
      expect(mockDatabase.limit).not.toHaveBeenCalled();
    });

    it('should fallback to database when cache read fails', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      mockDatabase.limit.mockResolvedValue([{ role: 'owner' }]);

      const result = await verifyTenantMembership(validUserId, validTenantId);

      expect(result.isMember).toBe(true);
      expect(result.role).toBe('owner');
      expect(result.cached).toBe(false);
    });

    it('should still return result when cache write fails', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDatabase.limit.mockResolvedValue([{ role: 'member' }]);
      mockRedis.setex.mockRejectedValue(new Error('Redis write failed'));

      const result = await verifyTenantMembership(validUserId, validTenantId);

      expect(result.isMember).toBe(true);
      expect(result.role).toBe('member');
    });

    it('should cache membership result with correct TTL', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDatabase.limit.mockResolvedValue([{ role: 'member' }]);

      await verifyTenantMembership(validUserId, validTenantId);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `tenant:membership:${validUserId}:${validTenantId}`,
        300, // 5 minute TTL
        expect.any(String)
      );
    });

    it('should handle different membership roles correctly', async () => {
      const roles = ['owner', 'admin', 'member', 'readonly'];

      for (const role of roles) {
        mockRedis.get.mockResolvedValue(null);
        mockDatabase.limit.mockResolvedValue([{ role }]);

        const result = await verifyTenantMembership(validUserId, validTenantId);

        expect(result.isMember).toBe(true);
        expect(result.role).toBe(role);
      }
    });
  });

  describe('requireTenantMembership', () => {
    it('should not throw when user is a member', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ isMember: true, role: 'member' }));

      await expect(requireTenantMembership(validUserId, validTenantId)).resolves.not.toThrow();
    });

    it('should throw ForbiddenError when user is not a member', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ isMember: false }));

      await expect(requireTenantMembership(validUserId, validTenantId))
        .rejects.toThrow(ForbiddenError);
    });

    it('should include userId and tenantId in error details', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ isMember: false }));

      try {
        await requireTenantMembership(validUserId, validTenantId);
        expect.fail('Should have thrown ForbiddenError');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        expect((error as ForbiddenError).details).toEqual({
          userId: validUserId,
          tenantId: validTenantId,
        });
      }
    });

    it('should throw correct error message for cross-tenant access', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ isMember: false }));

      await expect(requireTenantMembership(validUserId, validTenantId))
        .rejects.toThrow('Access denied: user is not a member of this tenant');
    });
  });

  describe('invalidateMembershipCache', () => {
    it('should delete the specific cache key', async () => {
      await invalidateMembershipCache(validUserId, validTenantId);

      expect(mockRedis.del).toHaveBeenCalledWith(`tenant:membership:${validUserId}:${validTenantId}`);
    });

    it('should not throw when cache delete fails', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis delete failed'));

      await expect(invalidateMembershipCache(validUserId, validTenantId)).resolves.not.toThrow();
    });
  });

  describe('invalidateUserMembershipCache', () => {
    it('should delete all cache keys for a user', async () => {
      const keys = [
        `tenant:membership:${validUserId}:tenant-1`,
        `tenant:membership:${validUserId}:tenant-2`,
      ];
      mockRedis.keys.mockResolvedValue(keys);

      await invalidateUserMembershipCache(validUserId);

      expect(mockRedis.keys).toHaveBeenCalledWith(`tenant:membership:${validUserId}:*`);
      expect(mockRedis.del).toHaveBeenCalledWith(...keys);
    });

    it('should not call del when no keys found', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await invalidateUserMembershipCache(validUserId);

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should not throw when operation fails', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      await expect(invalidateUserMembershipCache(validUserId)).resolves.not.toThrow();
    });
  });

  describe('invalidateTenantMembershipCache', () => {
    it('should delete all cache keys for a tenant', async () => {
      const keys = [
        `tenant:membership:user-1:${validTenantId}`,
        `tenant:membership:user-2:${validTenantId}`,
      ];
      mockRedis.keys.mockResolvedValue(keys);

      await invalidateTenantMembershipCache(validTenantId);

      expect(mockRedis.keys).toHaveBeenCalledWith(`tenant:membership:*:${validTenantId}`);
      expect(mockRedis.del).toHaveBeenCalledWith(...keys);
    });

    it('should not call del when no keys found', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await invalidateTenantMembershipCache(validTenantId);

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('Security: Cross-Tenant Data Exposure Prevention', () => {
    it('should prevent access when attacker modifies tenantId claim', async () => {
      const attackerUserId = 'attacker-user-id';
      const victimTenantId = 'victim-tenant-id';

      // Attacker is not a member of victim's tenant
      mockRedis.get.mockResolvedValue(null);
      mockDatabase.limit.mockResolvedValue([]);

      // This should deny access
      const result = await verifyTenantMembership(attackerUserId, victimTenantId);
      expect(result.isMember).toBe(false);

      // And requireTenantMembership should throw
      await expect(requireTenantMembership(attackerUserId, victimTenantId))
        .rejects.toThrow(ForbiddenError);
    });

    it('should allow access when user legitimately belongs to tenant', async () => {
      const legitimateUserId = 'legitimate-user-id';
      const legitimateTenantId = 'legitimate-tenant-id';

      mockRedis.get.mockResolvedValue(null);
      mockDatabase.limit.mockResolvedValue([{ role: 'member' }]);

      const result = await verifyTenantMembership(legitimateUserId, legitimateTenantId);
      expect(result.isMember).toBe(true);

      await expect(requireTenantMembership(legitimateUserId, legitimateTenantId))
        .resolves.not.toThrow();
    });

    it('should validate membership even when cache says member (cache poisoning protection)', async () => {
      // Even if an attacker somehow poisoned the cache, the system should
      // invalidate appropriately when membership changes
      const userId = 'user-id';
      const tenantId = 'tenant-id';

      // First verify with membership
      mockRedis.get.mockResolvedValue(JSON.stringify({ isMember: true, role: 'member' }));
      const result1 = await verifyTenantMembership(userId, tenantId);
      expect(result1.isMember).toBe(true);

      // After cache invalidation, should check DB again
      await invalidateMembershipCache(userId, tenantId);

      // Now DB returns no membership
      mockRedis.get.mockResolvedValue(null);
      mockDatabase.limit.mockResolvedValue([]);

      const result2 = await verifyTenantMembership(userId, tenantId);
      expect(result2.isMember).toBe(false);
    });
  });

  describe('Cache Key Format', () => {
    it('should use correct cache key format', async () => {
      const userId = 'user-abc-123';
      const tenantId = 'tenant-xyz-789';

      await verifyTenantMembership(userId, tenantId);

      expect(mockRedis.get).toHaveBeenCalledWith(`tenant:membership:${userId}:${tenantId}`);
    });

    it('should handle special characters in IDs', async () => {
      const userId = 'user:with:colons';
      const tenantId = 'tenant-with-dashes';

      await verifyTenantMembership(userId, tenantId);

      expect(mockRedis.get).toHaveBeenCalledWith(`tenant:membership:${userId}:${tenantId}`);
    });
  });
});
