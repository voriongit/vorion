/**
 * Escalation Service Tests
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

vi.mock('../../../src/intent/metrics.js', () => ({
  escalationsCreated: { inc: vi.fn() },
  escalationResolutions: { inc: vi.fn() },
  escalationPendingDuration: { observe: vi.fn() },
  escalationsPending: { inc: vi.fn(), dec: vi.fn() },
}));

describe('EscalationService', () => {
  let service: EscalationService;

  beforeEach(() => {
    vi.clearAllMocks();
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

    it('should store metadata when provided', async () => {
      const options: CreateEscalationOptions = {
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: 'Manual review required',
        reasonCategory: 'manual_review',
        escalatedTo: 'ops-team',
        metadata: { urgency: 'high', context: 'data-export' },
      };

      const escalation = await service.create(options);

      expect(escalation.metadata).toEqual({ urgency: 'high', context: 'data-export' });
    });

    it('should store escalation in Redis with TTL', async () => {
      const options: CreateEscalationOptions = {
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: 'Test reason',
        reasonCategory: 'manual_review',
        escalatedTo: 'test-team',
      };

      await service.create(options);

      expect(mockRedis.set).toHaveBeenCalled();
      // Should be called with EX and a TTL value
      const setCall = mockRedis.set.mock.calls[0];
      expect(setCall[2]).toBe('EX');
      expect(typeof setCall[3]).toBe('number');
    });

    it('should add to pending set and timeout schedule', async () => {
      const options: CreateEscalationOptions = {
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: 'Test reason',
        reasonCategory: 'manual_review',
        escalatedTo: 'test-team',
      };

      await service.create(options);

      expect(mockRedis.sadd).toHaveBeenCalledWith(
        expect.stringContaining('pending:tenant-456'),
        expect.any(String)
      );
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        expect.stringContaining('timeouts'),
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe('get', () => {
    it('should return null when escalation not found', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should return escalation when found', async () => {
      const storedEscalation: EscalationRecord = {
        id: 'esc-123',
        intentId: 'intent-456',
        tenantId: 'tenant-789',
        reason: 'Test reason',
        reasonCategory: 'manual_review',
        escalatedTo: 'test-team',
        status: 'pending',
        timeout: 'PT1H',
        timeoutAt: new Date().toISOString(),
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(storedEscalation));

      const result = await service.get('esc-123');

      expect(result).toEqual(storedEscalation);
    });
  });

  describe('approve', () => {
    const pendingEscalation: EscalationRecord = {
      id: 'esc-123',
      intentId: 'intent-456',
      tenantId: 'tenant-789',
      reason: 'Test reason',
      reasonCategory: 'manual_review',
      escalatedTo: 'test-team',
      status: 'pending',
      timeout: 'PT1H',
      timeoutAt: new Date().toISOString(),
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should approve a pending escalation', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(pendingEscalation));

      const result = await service.approve('esc-123', {
        resolvedBy: 'admin-user',
        notes: 'Approved after review',
      });

      expect(result).toBeDefined();
      expect(result?.status).toBe('approved');
      expect(result?.resolution?.resolvedBy).toBe('admin-user');
      expect(result?.resolution?.notes).toBe('Approved after review');
    });

    it('should return null for nonexistent escalation', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await service.approve('nonexistent', {
        resolvedBy: 'admin-user',
      });

      expect(result).toBeNull();
    });

    it('should return existing escalation if already resolved', async () => {
      const resolvedEscalation = { ...pendingEscalation, status: 'approved' as const };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(resolvedEscalation));

      const result = await service.approve('esc-123', {
        resolvedBy: 'admin-user',
      });

      expect(result?.status).toBe('approved');
    });

    it('should remove from pending set and timeout schedule', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(pendingEscalation));

      await service.approve('esc-123', { resolvedBy: 'admin-user' });

      expect(mockRedis.srem).toHaveBeenCalledWith(
        expect.stringContaining('pending:tenant-789'),
        'esc-123'
      );
      expect(mockRedis.zrem).toHaveBeenCalledWith(
        expect.stringContaining('timeouts'),
        'esc-123'
      );
    });
  });

  describe('reject', () => {
    const pendingEscalation: EscalationRecord = {
      id: 'esc-123',
      intentId: 'intent-456',
      tenantId: 'tenant-789',
      reason: 'Test reason',
      reasonCategory: 'high_risk',
      escalatedTo: 'security-team',
      status: 'pending',
      timeout: 'PT1H',
      timeoutAt: new Date().toISOString(),
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should reject a pending escalation', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(pendingEscalation));

      const result = await service.reject('esc-123', {
        resolvedBy: 'security-admin',
        notes: 'Risk too high, operation denied',
      });

      expect(result).toBeDefined();
      expect(result?.status).toBe('rejected');
      expect(result?.resolution?.resolvedBy).toBe('security-admin');
      expect(result?.resolution?.notes).toBe('Risk too high, operation denied');
    });
  });

  describe('listPending', () => {
    it('should return empty array when no pending escalations', async () => {
      mockRedis.smembers.mockResolvedValueOnce([]);

      const result = await service.listPending('tenant-123');

      expect(result).toEqual([]);
    });

    it('should return pending escalations sorted by creation time', async () => {
      const older: EscalationRecord = {
        id: 'esc-1',
        intentId: 'intent-1',
        tenantId: 'tenant-123',
        reason: 'First',
        reasonCategory: 'manual_review',
        escalatedTo: 'team',
        status: 'pending',
        timeout: 'PT1H',
        timeoutAt: new Date().toISOString(),
        metadata: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const newer: EscalationRecord = {
        id: 'esc-2',
        intentId: 'intent-2',
        tenantId: 'tenant-123',
        reason: 'Second',
        reasonCategory: 'manual_review',
        escalatedTo: 'team',
        status: 'pending',
        timeout: 'PT1H',
        timeoutAt: new Date().toISOString(),
        metadata: {},
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockRedis.smembers.mockResolvedValueOnce(['esc-2', 'esc-1']);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(newer))
        .mockResolvedValueOnce(JSON.stringify(older));

      const result = await service.listPending('tenant-123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('esc-1');
      expect(result[1].id).toBe('esc-2');
    });

    it('should filter out already resolved escalations', async () => {
      const pending: EscalationRecord = {
        id: 'esc-1',
        intentId: 'intent-1',
        tenantId: 'tenant-123',
        reason: 'Pending',
        reasonCategory: 'manual_review',
        escalatedTo: 'team',
        status: 'pending',
        timeout: 'PT1H',
        timeoutAt: new Date().toISOString(),
        metadata: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const resolved: EscalationRecord = {
        ...pending,
        id: 'esc-2',
        status: 'approved',
      };

      mockRedis.smembers.mockResolvedValueOnce(['esc-1', 'esc-2']);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(pending))
        .mockResolvedValueOnce(JSON.stringify(resolved));

      const result = await service.listPending('tenant-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('esc-1');
    });
  });

  describe('processTimeouts', () => {
    const pendingEscalation: EscalationRecord = {
      id: 'esc-timeout',
      intentId: 'intent-timeout',
      tenantId: 'tenant-timeout',
      reason: 'Timeout test',
      reasonCategory: 'manual_review',
      escalatedTo: 'team',
      status: 'pending',
      timeout: 'PT1H',
      timeoutAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      metadata: {},
      createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
    };

    it('should process timed out escalations', async () => {
      mockRedis.zrangebyscore.mockResolvedValueOnce(['esc-timeout']);
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(pendingEscalation));

      const processed = await service.processTimeouts();

      expect(processed).toBe(1);
      expect(mockRedis.zrem).toHaveBeenCalledWith(
        expect.stringContaining('timeouts'),
        'esc-timeout'
      );
    });

    it('should not count already resolved escalations', async () => {
      const resolved = { ...pendingEscalation, status: 'approved' as const };
      mockRedis.zrangebyscore.mockResolvedValueOnce(['esc-timeout']);
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(resolved));

      const processed = await service.processTimeouts();

      expect(processed).toBe(0);
    });

    it('should return 0 when no timeouts', async () => {
      mockRedis.zrangebyscore.mockResolvedValueOnce([]);

      const processed = await service.processTimeouts();

      expect(processed).toBe(0);
    });
  });

  describe('getByIntentId', () => {
    it('should return most recent escalation for intent', async () => {
      const escalation: EscalationRecord = {
        id: 'esc-latest',
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        reason: 'Latest',
        reasonCategory: 'manual_review',
        escalatedTo: 'team',
        status: 'pending',
        timeout: 'PT1H',
        timeoutAt: new Date().toISOString(),
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedis.lrange.mockResolvedValueOnce(['esc-latest']);
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(escalation));

      const result = await service.getByIntentId('intent-123');

      expect(result).toEqual(escalation);
    });

    it('should return null when no escalations for intent', async () => {
      mockRedis.lrange.mockResolvedValueOnce([]);

      const result = await service.getByIntentId('intent-noesc');

      expect(result).toBeNull();
    });
  });

  describe('hasPendingEscalation', () => {
    it('should return true when pending escalation exists', async () => {
      const pending: EscalationRecord = {
        id: 'esc-1',
        intentId: 'intent-1',
        tenantId: 'tenant-1',
        reason: 'Pending',
        reasonCategory: 'manual_review',
        escalatedTo: 'team',
        status: 'pending',
        timeout: 'PT1H',
        timeoutAt: new Date().toISOString(),
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedis.lrange.mockResolvedValueOnce(['esc-1']);
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(pending));

      const result = await service.hasPendingEscalation('intent-1');

      expect(result).toBe(true);
    });

    it('should return false when escalation is resolved', async () => {
      const resolved: EscalationRecord = {
        id: 'esc-1',
        intentId: 'intent-1',
        tenantId: 'tenant-1',
        reason: 'Resolved',
        reasonCategory: 'manual_review',
        escalatedTo: 'team',
        status: 'approved',
        timeout: 'PT1H',
        timeoutAt: new Date().toISOString(),
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedis.lrange.mockResolvedValueOnce(['esc-1']);
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(resolved));

      const result = await service.hasPendingEscalation('intent-1');

      expect(result).toBe(false);
    });

    it('should return false when no escalations exist', async () => {
      mockRedis.lrange.mockResolvedValueOnce([]);

      const result = await service.hasPendingEscalation('intent-noesc');

      expect(result).toBe(false);
    });
  });

  describe('getHistory', () => {
    it('should return all escalations for an intent', async () => {
      const first: EscalationRecord = {
        id: 'esc-1',
        intentId: 'intent-1',
        tenantId: 'tenant-1',
        reason: 'First escalation',
        reasonCategory: 'trust_insufficient',
        escalatedTo: 'team',
        status: 'rejected',
        timeout: 'PT1H',
        timeoutAt: new Date().toISOString(),
        metadata: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T01:00:00Z',
      };

      const second: EscalationRecord = {
        id: 'esc-2',
        intentId: 'intent-1',
        tenantId: 'tenant-1',
        reason: 'Second escalation after trust increase',
        reasonCategory: 'manual_review',
        escalatedTo: 'team',
        status: 'approved',
        timeout: 'PT1H',
        timeoutAt: new Date().toISOString(),
        metadata: {},
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T01:00:00Z',
      };

      mockRedis.lrange.mockResolvedValueOnce(['esc-1', 'esc-2']);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(first))
        .mockResolvedValueOnce(JSON.stringify(second));

      const result = await service.getHistory('intent-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('esc-1');
      expect(result[1].id).toBe('esc-2');
    });
  });
});

describe('ISO Duration Parsing', () => {
  let service: EscalationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EscalationService();
  });

  it('should handle hour durations (PT1H)', async () => {
    const options: CreateEscalationOptions = {
      intentId: 'intent-1',
      tenantId: 'tenant-1',
      reason: 'Test',
      reasonCategory: 'manual_review',
      escalatedTo: 'team',
      timeout: 'PT1H',
    };

    const escalation = await service.create(options);
    const timeoutAt = new Date(escalation.timeoutAt);
    const now = new Date();

    // Should be approximately 1 hour from now
    const diffHours = (timeoutAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBeGreaterThan(0.9);
    expect(diffHours).toBeLessThan(1.1);
  });

  it('should handle minute durations (PT30M)', async () => {
    const options: CreateEscalationOptions = {
      intentId: 'intent-1',
      tenantId: 'tenant-1',
      reason: 'Test',
      reasonCategory: 'manual_review',
      escalatedTo: 'team',
      timeout: 'PT30M',
    };

    const escalation = await service.create(options);
    const timeoutAt = new Date(escalation.timeoutAt);
    const now = new Date();

    // Should be approximately 30 minutes from now
    const diffMinutes = (timeoutAt.getTime() - now.getTime()) / (1000 * 60);
    expect(diffMinutes).toBeGreaterThan(29);
    expect(diffMinutes).toBeLessThan(31);
  });

  it('should handle day durations (P1D)', async () => {
    const options: CreateEscalationOptions = {
      intentId: 'intent-1',
      tenantId: 'tenant-1',
      reason: 'Test',
      reasonCategory: 'manual_review',
      escalatedTo: 'team',
      timeout: 'P1D',
    };

    const escalation = await service.create(options);
    const timeoutAt = new Date(escalation.timeoutAt);
    const now = new Date();

    // Should be approximately 1 day from now
    const diffDays = (timeoutAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(0.9);
    expect(diffDays).toBeLessThan(1.1);
  });

  it('should handle combined durations (P1DT2H30M)', async () => {
    const options: CreateEscalationOptions = {
      intentId: 'intent-1',
      tenantId: 'tenant-1',
      reason: 'Test',
      reasonCategory: 'manual_review',
      escalatedTo: 'team',
      timeout: 'P1DT2H30M',
    };

    const escalation = await service.create(options);
    const timeoutAt = new Date(escalation.timeoutAt);
    const now = new Date();

    // Should be approximately 1 day + 2 hours + 30 minutes from now
    const diffMinutes = (timeoutAt.getTime() - now.getTime()) / (1000 * 60);
    const expectedMinutes = 24 * 60 + 2 * 60 + 30; // 1590 minutes
    expect(diffMinutes).toBeGreaterThan(expectedMinutes - 5);
    expect(diffMinutes).toBeLessThan(expectedMinutes + 5);
  });
});
