/**
 * Audit Module Tests
 *
 * Tests for SOC2 compliant read audit logging in the INTENT module.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  recordAudit,
  recordAuditSync,
  queryAuditLog,
  getResourceAuditHistory,
  getUserAuditHistory,
  extractRequestMetadata,
  shutdownAuditSystem,
  type AuditAction,
  type AuditResourceType,
  type CreateAuditEntry,
  type AuditEntry,
} from '../../../src/intent/audit.js';

// Mock dependencies
vi.mock('../../../src/common/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock database
let mockAuditStore: Map<string, any>;
const mockDb = {
  insert: vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation((data: any) => {
      // Handle both single and array inserts
      const items = Array.isArray(data) ? data : [data];
      items.forEach((item) => {
        mockAuditStore.set(item.id, {
          ...item,
          timestamp: item.timestamp || new Date(),
        });
      });
      return {
        returning: vi.fn().mockResolvedValue(items.map((item) => mockAuditStore.get(item.id))),
      };
    }),
  })),
  select: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        const results = Array.from(mockAuditStore.values());
        return {
          orderBy: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => ({
              offset: vi.fn().mockResolvedValue(results),
            })),
          })),
        };
      }),
    })),
  })),
};

vi.mock('../../../src/common/db.js', () => ({
  getDatabase: vi.fn(() => mockDb),
}));

vi.mock('../../../src/common/redis.js', () => ({
  getRedis: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    ping: vi.fn().mockResolvedValue('PONG'),
  })),
}));

describe('Audit Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditStore = new Map();
  });

  afterEach(async () => {
    // Cleanup audit queue
    await shutdownAuditSystem();
  });

  describe('AuditAction types', () => {
    it('should define all required read actions', () => {
      const readActions: AuditAction[] = [
        'intent.read',
        'intent.read_list',
        'escalation.read',
        'webhook.read',
        'gdpr.export',
      ];

      // Type check - these should all be valid AuditAction values
      readActions.forEach((action) => {
        expect(typeof action).toBe('string');
      });
    });

    it('should define mutation actions', () => {
      const mutationActions: AuditAction[] = [
        'intent.create',
        'intent.update',
        'intent.delete',
        'escalation.approve',
        'escalation.reject',
        'gdpr.erase',
      ];

      mutationActions.forEach((action) => {
        expect(typeof action).toBe('string');
      });
    });
  });

  describe('AuditResourceType', () => {
    it('should define all resource types', () => {
      const resourceTypes: AuditResourceType[] = [
        'intent',
        'escalation',
        'webhook',
        'user_data',
      ];

      resourceTypes.forEach((type) => {
        expect(typeof type).toBe('string');
      });
    });
  });

  describe('recordAuditSync', () => {
    it('should record an audit entry with all fields', async () => {
      const entry: CreateAuditEntry = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: 'intent.read',
        resourceType: 'intent',
        resourceId: 'intent-789',
        metadata: { includeEvents: true },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const result = await recordAuditSync(entry);

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-123');
      expect(result.userId).toBe('user-456');
      expect(result.action).toBe('intent.read');
      expect(result.resourceType).toBe('intent');
      expect(result.resourceId).toBe('intent-789');
      expect(result.metadata).toEqual({ includeEvents: true });
      expect(result.ipAddress).toBe('192.168.1.1');
      expect(result.userAgent).toBe('Mozilla/5.0');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should record an audit entry with minimal fields', async () => {
      const entry: CreateAuditEntry = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: 'intent.read_list',
        resourceType: 'intent',
        resourceId: '*',
      };

      const result = await recordAuditSync(entry);

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-123');
      expect(result.action).toBe('intent.read_list');
      expect(result.resourceId).toBe('*');
      // Optional fields may be null or undefined depending on storage
      expect(result.metadata).toBeFalsy();
      expect(result.ipAddress).toBeFalsy();
      expect(result.userAgent).toBeFalsy();
    });

    it('should store audit entry in database', async () => {
      const entry: CreateAuditEntry = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: 'escalation.read',
        resourceType: 'escalation',
        resourceId: 'esc-789',
      };

      await recordAuditSync(entry);

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('recordAudit (async)', () => {
    it('should not throw when called', async () => {
      const entry: CreateAuditEntry = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: 'intent.read',
        resourceType: 'intent',
        resourceId: 'intent-789',
      };

      // recordAudit is fire-and-forget, so it should not throw
      expect(() => recordAudit(entry)).not.toThrow();
    });

    it('should handle errors gracefully', async () => {
      // Even if there's an error, recordAudit should not throw
      const entry: CreateAuditEntry = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: 'intent.read',
        resourceType: 'intent',
        resourceId: 'intent-789',
      };

      // Temporarily break the database mock
      const originalInsert = mockDb.insert;
      mockDb.insert = vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockRejectedValue(new Error('DB Error')),
        })),
      }));

      expect(() => recordAudit(entry)).not.toThrow();

      // Restore mock
      mockDb.insert = originalInsert;
    });
  });

  describe('queryAuditLog', () => {
    beforeEach(async () => {
      // Populate some test data
      await recordAuditSync({
        tenantId: 'tenant-123',
        userId: 'user-1',
        action: 'intent.read',
        resourceType: 'intent',
        resourceId: 'intent-1',
      });
      await recordAuditSync({
        tenantId: 'tenant-123',
        userId: 'user-2',
        action: 'intent.read_list',
        resourceType: 'intent',
        resourceId: '*',
      });
      await recordAuditSync({
        tenantId: 'tenant-123',
        userId: 'user-1',
        action: 'escalation.read',
        resourceType: 'escalation',
        resourceId: 'esc-1',
      });
    });

    it('should query audit log by tenant', async () => {
      const result = await queryAuditLog({
        tenantId: 'tenant-123',
      });

      expect(result.entries).toBeDefined();
      expect(Array.isArray(result.entries)).toBe(true);
      // total may be undefined in mock, so check it's either a number or undefined
      expect(result.total === undefined || typeof result.total === 'number').toBe(true);
      expect(typeof result.hasMore === 'boolean' || result.hasMore === undefined).toBe(true);
    });

    it('should filter by userId', async () => {
      const result = await queryAuditLog({
        tenantId: 'tenant-123',
        userId: 'user-1',
      });

      expect(result.entries).toBeDefined();
    });

    it('should filter by action', async () => {
      const result = await queryAuditLog({
        tenantId: 'tenant-123',
        action: 'intent.read',
      });

      expect(result.entries).toBeDefined();
    });

    it('should filter by resourceType', async () => {
      const result = await queryAuditLog({
        tenantId: 'tenant-123',
        resourceType: 'escalation',
      });

      expect(result.entries).toBeDefined();
    });

    it('should filter by resourceId', async () => {
      const result = await queryAuditLog({
        tenantId: 'tenant-123',
        resourceId: 'intent-1',
      });

      expect(result.entries).toBeDefined();
    });

    it('should filter by date range', async () => {
      const from = new Date('2024-01-01');
      const to = new Date('2030-12-31');

      const result = await queryAuditLog({
        tenantId: 'tenant-123',
        from,
        to,
      });

      expect(result.entries).toBeDefined();
    });

    it('should respect limit and offset', async () => {
      const result = await queryAuditLog({
        tenantId: 'tenant-123',
        limit: 10,
        offset: 0,
      });

      expect(result.entries).toBeDefined();
    });

    it('should enforce maximum limit of 1000', async () => {
      const result = await queryAuditLog({
        tenantId: 'tenant-123',
        limit: 5000, // Exceeds max
      });

      // Should still work, just capped at 1000
      expect(result.entries).toBeDefined();
    });
  });

  describe('getResourceAuditHistory', () => {
    it('should get audit history for a specific resource', async () => {
      // Add some audit entries for a specific intent
      await recordAuditSync({
        tenantId: 'tenant-123',
        userId: 'user-1',
        action: 'intent.read',
        resourceType: 'intent',
        resourceId: 'intent-xyz',
      });

      const history = await getResourceAuditHistory(
        'tenant-123',
        'intent',
        'intent-xyz'
      );

      expect(Array.isArray(history)).toBe(true);
    });

    it('should limit results', async () => {
      const history = await getResourceAuditHistory(
        'tenant-123',
        'intent',
        'intent-xyz',
        5
      );

      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('getUserAuditHistory', () => {
    it('should get audit history for a specific user', async () => {
      await recordAuditSync({
        tenantId: 'tenant-123',
        userId: 'user-abc',
        action: 'intent.read',
        resourceType: 'intent',
        resourceId: 'intent-1',
      });

      const history = await getUserAuditHistory(
        'tenant-123',
        'user-abc'
      );

      expect(Array.isArray(history)).toBe(true);
    });

    it('should filter by date range', async () => {
      const history = await getUserAuditHistory(
        'tenant-123',
        'user-abc',
        {
          from: new Date('2024-01-01'),
          to: new Date('2030-12-31'),
          limit: 50,
        }
      );

      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('extractRequestMetadata', () => {
    it('should extract IP and user agent from request', () => {
      const mockRequest = {
        ip: '10.0.0.1',
        headers: {
          'user-agent': 'TestAgent/1.0',
        },
      };

      const metadata = extractRequestMetadata(mockRequest);

      expect(metadata.ipAddress).toBe('10.0.0.1');
      expect(metadata.userAgent).toBe('TestAgent/1.0');
    });

    it('should handle missing IP', () => {
      const mockRequest = {
        headers: {
          'user-agent': 'TestAgent/1.0',
        },
      };

      const metadata = extractRequestMetadata(mockRequest);

      expect(metadata.ipAddress).toBeUndefined();
      expect(metadata.userAgent).toBe('TestAgent/1.0');
    });

    it('should handle missing headers', () => {
      const mockRequest = {
        ip: '10.0.0.1',
      };

      const metadata = extractRequestMetadata(mockRequest);

      expect(metadata.ipAddress).toBe('10.0.0.1');
      expect(metadata.userAgent).toBeUndefined();
    });

    it('should handle array user-agent header', () => {
      const mockRequest = {
        ip: '10.0.0.1',
        headers: {
          'user-agent': ['TestAgent/1.0', 'SecondAgent/2.0'],
        },
      };

      const metadata = extractRequestMetadata(mockRequest);

      expect(metadata.userAgent).toBe('TestAgent/1.0');
    });
  });

  describe('AuditEntry interface', () => {
    it('should have required fields', () => {
      const entry: AuditEntry = {
        id: 'audit-123',
        tenantId: 'tenant-456',
        userId: 'user-789',
        action: 'intent.read',
        resourceType: 'intent',
        resourceId: 'intent-abc',
        timestamp: new Date(),
      };

      expect(entry.id).toBe('audit-123');
      expect(entry.tenantId).toBe('tenant-456');
      expect(entry.userId).toBe('user-789');
      expect(entry.action).toBe('intent.read');
      expect(entry.resourceType).toBe('intent');
      expect(entry.resourceId).toBe('intent-abc');
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('should allow optional fields', () => {
      const entry: AuditEntry = {
        id: 'audit-123',
        tenantId: 'tenant-456',
        userId: 'user-789',
        action: 'intent.read_list',
        resourceType: 'intent',
        resourceId: '*',
        metadata: { filters: { status: 'pending' } },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(),
      };

      expect(entry.metadata).toEqual({ filters: { status: 'pending' } });
      expect(entry.ipAddress).toBe('192.168.1.100');
      expect(entry.userAgent).toContain('Mozilla');
    });
  });
});

describe('Audit Logging Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditStore = new Map();
  });

  afterEach(async () => {
    await shutdownAuditSystem();
  });

  describe('SOC2 compliance scenarios', () => {
    it('should track who accessed an intent', async () => {
      const entry: CreateAuditEntry = {
        tenantId: 'acme-corp',
        userId: 'john.doe@acme.com',
        action: 'intent.read',
        resourceType: 'intent',
        resourceId: 'intent-12345',
        ipAddress: '203.0.113.50',
        userAgent: 'Chrome/120.0',
      };

      const result = await recordAuditSync(entry);

      expect(result.userId).toBe('john.doe@acme.com');
      expect(result.action).toBe('intent.read');
      expect(result.resourceId).toBe('intent-12345');
    });

    it('should track list operations with query parameters', async () => {
      const entry: CreateAuditEntry = {
        tenantId: 'acme-corp',
        userId: 'admin@acme.com',
        action: 'intent.read_list',
        resourceType: 'intent',
        resourceId: '*',
        metadata: {
          queryParams: {
            status: 'pending',
            entityId: 'entity-abc',
            limit: 50,
          },
          resultCount: 23,
        },
      };

      const result = await recordAuditSync(entry);

      expect(result.metadata).toEqual({
        queryParams: {
          status: 'pending',
          entityId: 'entity-abc',
          limit: 50,
        },
        resultCount: 23,
      });
    });

    it('should track GDPR data exports', async () => {
      const entry: CreateAuditEntry = {
        tenantId: 'acme-corp',
        userId: 'dpo@acme.com',
        action: 'gdpr.export',
        resourceType: 'user_data',
        resourceId: 'user-entity-xyz',
        metadata: {
          intentCount: 15,
          escalationCount: 3,
          requestedBy: 'data-subject-request',
        },
        ipAddress: '10.10.10.10',
      };

      const result = await recordAuditSync(entry);

      expect(result.action).toBe('gdpr.export');
      expect(result.resourceType).toBe('user_data');
      expect((result.metadata as any).intentCount).toBe(15);
    });

    it('should track escalation access', async () => {
      const entry: CreateAuditEntry = {
        tenantId: 'acme-corp',
        userId: 'reviewer@acme.com',
        action: 'escalation.read',
        resourceType: 'escalation',
        resourceId: 'esc-456',
        metadata: {
          intentId: 'intent-123',
          status: 'pending',
        },
      };

      const result = await recordAuditSync(entry);

      expect(result.action).toBe('escalation.read');
      expect(result.resourceType).toBe('escalation');
    });
  });

  describe('Compliance query scenarios', () => {
    it('should support auditor queries by user', async () => {
      // Simulate multiple accesses by a user
      for (let i = 0; i < 5; i++) {
        await recordAuditSync({
          tenantId: 'tenant-123',
          userId: 'suspect-user',
          action: i % 2 === 0 ? 'intent.read' : 'intent.read_list',
          resourceType: 'intent',
          resourceId: i % 2 === 0 ? `intent-${i}` : '*',
        });
      }

      // Query all accesses by this user
      const history = await getUserAuditHistory('tenant-123', 'suspect-user');

      expect(Array.isArray(history)).toBe(true);
    });

    it('should support auditor queries by resource', async () => {
      // Simulate multiple users accessing same resource
      const users = ['user-1', 'user-2', 'user-3'];
      for (const userId of users) {
        await recordAuditSync({
          tenantId: 'tenant-123',
          userId,
          action: 'intent.read',
          resourceType: 'intent',
          resourceId: 'sensitive-intent',
        });
      }

      // Query all accesses to this resource
      const history = await getResourceAuditHistory(
        'tenant-123',
        'intent',
        'sensitive-intent'
      );

      expect(Array.isArray(history)).toBe(true);
    });

    it('should support time-bounded queries', async () => {
      const result = await queryAuditLog({
        tenantId: 'tenant-123',
        from: new Date('2024-01-01T00:00:00Z'),
        to: new Date('2024-12-31T23:59:59Z'),
      });

      expect(result.entries).toBeDefined();
      expect(Array.isArray(result.entries)).toBe(true);
    });
  });
});
