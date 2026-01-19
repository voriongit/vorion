/**
 * Escalation Service Tests
 *
 * Tests for PostgreSQL-backed escalation service with Redis caching.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EscalationService, type EscalationRecord, type CreateEscalationOptions } from '../../../src/intent/escalation.js';

// Mock dependencies
vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => ({
    intent: {
      escalationTimeout: 'PT1H',
      escalationDefaultRecipient: 'governance-team',
    },
  })),
}));

const mockRedis = {
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(1),
  sadd: vi.fn().mockResolvedValue(1),
  srem: vi.fn().mockResolvedValue(1),
  smembers: vi.fn().mockResolvedValue([]),
  rpush: vi.fn().mockResolvedValue(1),
  lrange: vi.fn().mockResolvedValue([]),
  zadd: vi.fn().mockResolvedValue(1),
  zrem: vi.fn().mockResolvedValue(1),
  zrangebyscore: vi.fn().mockResolvedValue([]),
  ttl: vi.fn().mockResolvedValue(3600),
};

vi.mock('../../../src/common/redis.js', () => ({
  getRedis: vi.fn(() => mockRedis),
}));

// Mock database with escalation store
let mockEscalationStore: Map<string, any>;
const mockDb = {
  insert: vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation((data) => {
      mockEscalationStore.set(data.id, {
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
      });
      return {
        returning: vi.fn().mockResolvedValue([mockEscalationStore.get(data.id)]),
      };
    }),
  })),
  select: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation((condition) => {
        // Return all escalations that match - simplified mock
        const results = Array.from(mockEscalationStore.values());
        return {
          orderBy: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue(results.slice(0, 1)),
          })),
          limit: vi.fn().mockResolvedValue(results.slice(0, 1)),
        };
      }),
    })),
  })),
  update: vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation((updates) => ({
      where: vi.fn().mockImplementation(() => ({
        returning: vi.fn().mockImplementation(async () => {
          // Get first escalation and update it
          const first = Array.from(mockEscalationStore.values())[0];
          if (first) {
            const updated = { ...first, ...updates, updatedAt: new Date() };
            mockEscalationStore.set(first.id, updated);
            return [updated];
          }
          return [];
        }),
      })),
    })),
  })),
};

vi.mock('../../../src/common/db.js', () => ({
  getDatabase: vi.fn(() => mockDb),
}));

vi.mock('../../../src/intent/metrics.js', () => ({
  escalationsCreated: { inc: vi.fn() },
  escalationResolutions: { inc: vi.fn() },
  escalationPendingDuration: { observe: vi.fn() },
  escalationsPending: { inc: vi.fn(), dec: vi.fn() },
  updateSlaBreachRate: vi.fn(),
  updateEscalationApprovalRate: vi.fn(),
}));

describe('EscalationService', () => {
  let service: EscalationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEscalationStore = new Map();
    service = new EscalationService();
  });

  describe('create', () => {
    it('should create an escalation with default timeout', async () => {
      const options: CreateEscalationOptions = {
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: 'Trust level insufficient',
        reasonCategory: 'trust_insufficient',
        escalatedTo: 'governance-team',
      };

      const escalation = await service.create(options);

      expect(escalation.id).toBeDefined();
      expect(escalation.intentId).toBe('intent-123');
      expect(escalation.tenantId).toBe('tenant-456');
      expect(escalation.reason).toBe('Trust level insufficient');
      expect(escalation.reasonCategory).toBe('trust_insufficient');
      expect(escalation.status).toBe('pending');
      expect(escalation.timeout).toBe('PT1H');
      expect(escalation.timeoutAt).toBeDefined();
      expect(escalation.slaBreached).toBe(false);
    });

    it('should create an escalation with custom timeout', async () => {
      const options: CreateEscalationOptions = {
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: 'High risk operation',
        reasonCategory: 'high_risk',
        escalatedTo: 'security-team',
        timeout: 'PT30M',
      };

      const escalation = await service.create(options);

      expect(escalation.timeout).toBe('PT30M');
    });

    it('should include escalatedBy when provided', async () => {
      const options: CreateEscalationOptions = {
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: 'Policy violation detected',
        reasonCategory: 'policy_violation',
        escalatedTo: 'compliance-team',
        escalatedBy: 'system-evaluator',
      };

      const escalation = await service.create(options);

      expect(escalation.escalatedBy).toBe('system-evaluator');
    });

    it('should store context and metadata', async () => {
      const options: CreateEscalationOptions = {
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: 'Manual review required',
        reasonCategory: 'manual_review',
        escalatedTo: 'review-team',
        context: { originalGoal: 'Delete user data' },
        metadata: { intentType: 'data-deletion', priority: 9 },
      };

      const escalation = await service.create(options);

      expect(escalation.context).toEqual({ originalGoal: 'Delete user data' });
      expect(escalation.metadata).toEqual({ intentType: 'data-deletion', priority: 9 });
    });

    it('should update Redis indexes', async () => {
      const options: CreateEscalationOptions = {
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: 'Test',
        reasonCategory: 'trust_insufficient',
        escalatedTo: 'governance-team',
      };

      await service.create(options);

      // Verify Redis operations
      expect(mockRedis.sadd).toHaveBeenCalled();
      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.rpush).toHaveBeenCalled();
    });
  });

  describe('timeout calculations', () => {
    it('should parse PT1H correctly', async () => {
      const options: CreateEscalationOptions = {
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: 'Test',
        reasonCategory: 'trust_insufficient',
        escalatedTo: 'team',
        timeout: 'PT1H',
      };

      const escalation = await service.create(options);
      const timeoutDate = new Date(escalation.timeoutAt);
      const now = new Date();
      const diffMs = timeoutDate.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      expect(diffHours).toBeGreaterThan(0.9);
      expect(diffHours).toBeLessThan(1.1);
    });

    it('should parse PT30M correctly', async () => {
      const options: CreateEscalationOptions = {
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: 'Test',
        reasonCategory: 'trust_insufficient',
        escalatedTo: 'team',
        timeout: 'PT30M',
      };

      const escalation = await service.create(options);
      const timeoutDate = new Date(escalation.timeoutAt);
      const now = new Date();
      const diffMs = timeoutDate.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      expect(diffMinutes).toBeGreaterThan(28);
      expect(diffMinutes).toBeLessThan(32);
    });

    it('should parse P1D correctly', async () => {
      const options: CreateEscalationOptions = {
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: 'Test',
        reasonCategory: 'trust_insufficient',
        escalatedTo: 'team',
        timeout: 'P1D',
      };

      const escalation = await service.create(options);
      const timeoutDate = new Date(escalation.timeoutAt);
      const now = new Date();
      const diffMs = timeoutDate.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeGreaterThan(0.9);
      expect(diffDays).toBeLessThan(1.1);
    });

    it('should throw on invalid duration', async () => {
      const options: CreateEscalationOptions = {
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: 'Test',
        reasonCategory: 'trust_insufficient',
        escalatedTo: 'team',
        timeout: 'invalid',
      };

      await expect(service.create(options)).rejects.toThrow('Invalid ISO duration');
    });
  });

  describe('reasonCategory', () => {
    it.each([
      'trust_insufficient',
      'high_risk',
      'policy_violation',
      'manual_review',
      'constraint_escalate',
    ] as const)('should accept %s category', async (category) => {
      const options: CreateEscalationOptions = {
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: `Test ${category}`,
        reasonCategory: category,
        escalatedTo: 'team',
      };

      const escalation = await service.create(options);
      expect(escalation.reasonCategory).toBe(category);
    });
  });

  describe('EscalationStatus types', () => {
    it('should have pending as initial status', async () => {
      const options: CreateEscalationOptions = {
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: 'Test',
        reasonCategory: 'trust_insufficient',
        escalatedTo: 'team',
      };

      const escalation = await service.create(options);
      expect(escalation.status).toBe('pending');
    });
  });

  describe('hasPendingEscalation', () => {
    it('should return false when no escalation exists', async () => {
      const hasPending = await service.hasPendingEscalation('non-existent-intent');
      expect(hasPending).toBe(false);
    });
  });
});

describe('EscalationRecord type', () => {
  it('should have required fields', () => {
    const record: EscalationRecord = {
      id: 'esc-123',
      intentId: 'intent-123',
      tenantId: 'tenant-456',
      reason: 'Test reason',
      reasonCategory: 'trust_insufficient',
      escalatedTo: 'governance-team',
      status: 'pending',
      timeout: 'PT1H',
      timeoutAt: new Date().toISOString(),
      slaBreached: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(record.id).toBe('esc-123');
    expect(record.slaBreached).toBe(false);
  });

  it('should allow optional fields', () => {
    const record: EscalationRecord = {
      id: 'esc-123',
      intentId: 'intent-123',
      tenantId: 'tenant-456',
      reason: 'Test reason',
      reasonCategory: 'high_risk',
      escalatedTo: 'security-team',
      escalatedBy: 'system',
      status: 'approved',
      timeout: 'PT1H',
      timeoutAt: new Date().toISOString(),
      acknowledgedAt: new Date().toISOString(),
      slaBreached: false,
      resolution: {
        resolvedBy: 'admin',
        resolvedAt: new Date().toISOString(),
        notes: 'Approved after review',
      },
      context: { key: 'value' },
      metadata: { extra: 'data' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(record.escalatedBy).toBe('system');
    expect(record.resolution?.resolvedBy).toBe('admin');
    expect(record.acknowledgedAt).toBeDefined();
  });
});
