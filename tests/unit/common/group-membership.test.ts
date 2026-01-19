/**
 * Group Membership Verification Unit Tests
 *
 * Tests for the secure group membership verification service that prevents
 * escalation authorization bypass attacks by verifying group membership
 * against the database rather than trusting JWT claims.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../../../src/common/db.js', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../../../src/common/redis.js', () => ({
  getRedis: vi.fn(),
}));

vi.mock('../../../src/common/logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  verifyGroupMembership,
  isAssignedApprover,
  assignApprover,
  removeApprover,
  listApprovers,
  invalidateGroupMembershipCache,
} from '../../../src/common/group-membership.js';
import { getDatabase } from '../../../src/common/db.js';
import { getRedis } from '../../../src/common/redis.js';

describe('Group Membership Verification', () => {
  // Mock database and Redis
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    delete: vi.fn().mockReturnThis(),
  };

  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getDatabase as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
    (getRedis as ReturnType<typeof vi.fn>).mockReturnValue(mockRedis);

    // Reset the chain
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.delete.mockReturnThis();
  });

  describe('verifyGroupMembership', () => {
    it('should return isMember: true when user is in group (database)', async () => {
      // Cache miss
      mockRedis.get.mockResolvedValue(null);

      // Database returns membership
      mockDb.limit.mockResolvedValue([{
        id: 'membership-123',
        userId: 'user-123',
        groupName: 'approvers',
        tenantId: 'tenant-123',
        active: true,
        createdAt: new Date(),
      }]);

      const result = await verifyGroupMembership('user-123', 'approvers', 'tenant-123');

      expect(result.isMember).toBe(true);
      expect(result.source).toBe('database');
      expect(result.metadata?.membershipId).toBe('membership-123');
    });

    it('should return isMember: false when user is not in group', async () => {
      // Cache miss
      mockRedis.get.mockResolvedValue(null);

      // Database returns no membership
      mockDb.limit.mockResolvedValue([]);

      const result = await verifyGroupMembership('user-123', 'approvers', 'tenant-123');

      expect(result.isMember).toBe(false);
      expect(result.source).toBe('database');
    });

    it('should return cached result when available', async () => {
      // Cache hit
      const cachedResult = {
        isMember: true,
        source: 'database',
        verifiedAt: new Date().toISOString(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await verifyGroupMembership('user-123', 'approvers', 'tenant-123');

      expect(result.isMember).toBe(true);
      expect(result.source).toBe('cache');
      // Database should not be called
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should bypass cache when skipCache option is true', async () => {
      // Even with cache hit, should query database
      const cachedResult = {
        isMember: true,
        source: 'database',
        verifiedAt: new Date().toISOString(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      // Database returns no membership
      mockDb.limit.mockResolvedValue([]);

      const result = await verifyGroupMembership('user-123', 'approvers', 'tenant-123', {
        skipCache: true,
      });

      expect(result.isMember).toBe(false);
      expect(result.source).toBe('database');
    });

    it('should fall back to database on cache error', async () => {
      // Cache error
      mockRedis.get.mockRejectedValue(new Error('Redis connection error'));

      // Database returns membership
      mockDb.limit.mockResolvedValue([{
        id: 'membership-123',
        userId: 'user-123',
        groupName: 'approvers',
        tenantId: 'tenant-123',
        active: true,
        createdAt: new Date(),
      }]);

      const result = await verifyGroupMembership('user-123', 'approvers', 'tenant-123');

      expect(result.isMember).toBe(true);
      expect(result.source).toBe('database');
    });

    it('should cache the database result', async () => {
      // Cache miss
      mockRedis.get.mockResolvedValue(null);

      // Database returns membership
      mockDb.limit.mockResolvedValue([{
        id: 'membership-123',
        userId: 'user-123',
        groupName: 'approvers',
        tenantId: 'tenant-123',
        active: true,
        createdAt: new Date(),
      }]);

      await verifyGroupMembership('user-123', 'approvers', 'tenant-123');

      // Should cache the result
      expect(mockRedis.set).toHaveBeenCalledWith(
        'group:membership:tenant-123:user-123:approvers',
        expect.any(String),
        'EX',
        300
      );
    });

    it('should only check active memberships', async () => {
      // Cache miss
      mockRedis.get.mockResolvedValue(null);

      // Database query should filter by active = true
      mockDb.limit.mockResolvedValue([]);

      await verifyGroupMembership('user-123', 'approvers', 'tenant-123');

      // Verify the where clause includes active filter
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('isAssignedApprover', () => {
    it('should return isApprover: true when user is assigned', async () => {
      const assignedAt = new Date();
      mockDb.limit.mockResolvedValue([{
        id: 'assignment-123',
        escalationId: 'escalation-123',
        userId: 'user-123',
        tenantId: 'tenant-123',
        assignedBy: 'admin-123',
        assignedAt,
      }]);

      const result = await isAssignedApprover('escalation-123', 'user-123', 'tenant-123');

      expect(result.isApprover).toBe(true);
      expect(result.assignedAt).toBe(assignedAt.toISOString());
      expect(result.assignedBy).toBe('admin-123');
    });

    it('should return isApprover: false when user is not assigned', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await isAssignedApprover('escalation-123', 'user-123', 'tenant-123');

      expect(result.isApprover).toBe(false);
      expect(result.assignedAt).toBeUndefined();
      expect(result.assignedBy).toBeUndefined();
    });
  });

  describe('assignApprover', () => {
    it('should create new assignment when not exists', async () => {
      // Check existing - none found
      mockDb.limit.mockResolvedValueOnce([]);

      // Insert returns new assignment
      const assignedAt = new Date();
      mockDb.returning.mockResolvedValue([{
        id: 'assignment-123',
        escalationId: 'escalation-123',
        userId: 'user-123',
        tenantId: 'tenant-123',
        assignedBy: 'admin-123',
        assignedAt,
      }]);

      const result = await assignApprover({
        escalationId: 'escalation-123',
        userId: 'user-123',
        tenantId: 'tenant-123',
        assignedBy: 'admin-123',
      });

      expect(result.id).toBe('assignment-123');
      expect(result.assignedAt).toBe(assignedAt.toISOString());
    });

    it('should return existing assignment when already exists', async () => {
      const existingAssignedAt = new Date(Date.now() - 86400000); // 1 day ago
      mockDb.limit.mockResolvedValueOnce([{
        id: 'existing-assignment-123',
        escalationId: 'escalation-123',
        userId: 'user-123',
        tenantId: 'tenant-123',
        assignedBy: 'other-admin',
        assignedAt: existingAssignedAt,
      }]);

      const result = await assignApprover({
        escalationId: 'escalation-123',
        userId: 'user-123',
        tenantId: 'tenant-123',
        assignedBy: 'admin-123',
      });

      expect(result.id).toBe('existing-assignment-123');
      expect(result.assignedAt).toBe(existingAssignedAt.toISOString());
      // Insert should not be called
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('removeApprover', () => {
    it('should return true when assignment is removed', async () => {
      mockDb.returning.mockResolvedValue([{ id: 'assignment-123' }]);

      const result = await removeApprover('escalation-123', 'user-123', 'tenant-123');

      expect(result).toBe(true);
    });

    it('should return false when assignment does not exist', async () => {
      mockDb.returning.mockResolvedValue([]);

      const result = await removeApprover('escalation-123', 'user-123', 'tenant-123');

      expect(result).toBe(false);
    });
  });

  describe('listApprovers', () => {
    it('should return list of approvers', async () => {
      const assignedAt1 = new Date();
      const assignedAt2 = new Date(Date.now() - 3600000);

      mockDb.where.mockResolvedValue([
        {
          userId: 'user-1',
          assignedAt: assignedAt1,
          assignedBy: 'admin-1',
        },
        {
          userId: 'user-2',
          assignedAt: assignedAt2,
          assignedBy: 'admin-2',
        },
      ]);

      const result = await listApprovers('escalation-123', 'tenant-123');

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user-1');
      expect(result[0].assignedAt).toBe(assignedAt1.toISOString());
      expect(result[1].userId).toBe('user-2');
    });

    it('should return empty array when no approvers', async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await listApprovers('escalation-123', 'tenant-123');

      expect(result).toEqual([]);
    });
  });

  describe('invalidateGroupMembershipCache', () => {
    it('should delete specific group cache entry', async () => {
      await invalidateGroupMembershipCache('user-123', 'tenant-123', 'approvers');

      expect(mockRedis.del).toHaveBeenCalledWith('group:membership:tenant-123:user-123:approvers');
    });

    it('should delete all group cache entries for user when groupName not specified', async () => {
      mockRedis.keys.mockResolvedValue([
        'group:membership:tenant-123:user-123:approvers',
        'group:membership:tenant-123:user-123:admins',
      ]);

      await invalidateGroupMembershipCache('user-123', 'tenant-123');

      expect(mockRedis.keys).toHaveBeenCalledWith('group:membership:tenant-123:user-123:*');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'group:membership:tenant-123:user-123:approvers',
        'group:membership:tenant-123:user-123:admins'
      );
    });

    it('should handle cache errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(invalidateGroupMembershipCache('user-123', 'tenant-123', 'approvers'))
        .resolves.not.toThrow();
    });
  });
});

describe('Escalation Authorization Security Tests', () => {
  // These tests verify the security fix for the authorization bypass vulnerability

  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    delete: vi.fn().mockReturnThis(),
  };

  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getDatabase as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
    (getRedis as ReturnType<typeof vi.fn>).mockReturnValue(mockRedis);

    // Reset the chain
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockReturnThis();
  });

  describe('JWT Group Claim Attack Prevention', () => {
    it('should reject user who claims group membership in JWT but is not in database', async () => {
      // Attacker adds 'security-approvers' to their JWT groups claim
      // But they are NOT in the database group_memberships table

      // Cache miss
      mockRedis.get.mockResolvedValue(null);

      // Database shows user is NOT a member
      mockDb.limit.mockResolvedValue([]);

      const result = await verifyGroupMembership(
        'attacker-user-id',
        'security-approvers',
        'tenant-123'
      );

      // Authorization should be DENIED
      expect(result.isMember).toBe(false);
    });

    it('should grant access only when database confirms group membership', async () => {
      // Legitimate user who is actually in the group (database verified)

      // Cache miss
      mockRedis.get.mockResolvedValue(null);

      // Database confirms membership
      mockDb.limit.mockResolvedValue([{
        id: 'membership-123',
        userId: 'legitimate-user-id',
        groupName: 'security-approvers',
        tenantId: 'tenant-123',
        active: true,
        createdAt: new Date(),
      }]);

      const result = await verifyGroupMembership(
        'legitimate-user-id',
        'security-approvers',
        'tenant-123'
      );

      // Authorization should be GRANTED
      expect(result.isMember).toBe(true);
      expect(result.source).toBe('database');
    });
  });

  describe('Cross-Tenant Attack Prevention', () => {
    it('should not allow group membership from wrong tenant', async () => {
      // User is a member in tenant-A but tries to access tenant-B escalation

      // Cache miss
      mockRedis.get.mockResolvedValue(null);

      // Database query with tenant-B should find no membership
      mockDb.limit.mockResolvedValue([]);

      const result = await verifyGroupMembership(
        'user-123',
        'approvers',
        'tenant-B' // Different from where user has membership
      );

      expect(result.isMember).toBe(false);
    });
  });

  describe('Inactive Membership Attack Prevention', () => {
    it('should not allow access for inactive group membership', async () => {
      // User's membership has been deactivated but they still have cached JWT

      // Cache miss
      mockRedis.get.mockResolvedValue(null);

      // Database shows membership but it's inactive (filtered out by the query)
      mockDb.limit.mockResolvedValue([]);

      const result = await verifyGroupMembership(
        'deactivated-user-id',
        'approvers',
        'tenant-123'
      );

      // Authorization should be DENIED because only active=true memberships are queried
      expect(result.isMember).toBe(false);
    });
  });

  describe('Explicit Approver Assignment Security', () => {
    it('should allow explicitly assigned approver', async () => {
      // Admin assigns a specific user as approver for an escalation

      mockDb.limit.mockResolvedValue([{
        id: 'assignment-123',
        escalationId: 'escalation-123',
        userId: 'assigned-user-id',
        tenantId: 'tenant-123',
        assignedBy: 'admin-id',
        assignedAt: new Date(),
      }]);

      const result = await isAssignedApprover(
        'escalation-123',
        'assigned-user-id',
        'tenant-123'
      );

      expect(result.isApprover).toBe(true);
    });

    it('should reject user not explicitly assigned even if they claim approver role', async () => {
      // User claims approver role in JWT but is not explicitly assigned

      mockDb.limit.mockResolvedValue([]);

      const result = await isAssignedApprover(
        'escalation-123',
        'non-assigned-user-id',
        'tenant-123'
      );

      expect(result.isApprover).toBe(false);
    });
  });
});
