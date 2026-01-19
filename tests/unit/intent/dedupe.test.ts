/**
 * Deduplication Hash Security Tests
 *
 * Tests for the HMAC-based deduplication to prevent hash prediction attacks.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createHmac, createHash } from 'node:crypto';

// Store original Date.now for restoration
const originalDateNow = Date.now;

// Configuration mock with dedupeSecret support
const createMockConfig = (overrides: Record<string, unknown> = {}) => ({
  intent: {
    defaultNamespace: 'default',
    namespaceRouting: {},
    dedupeTtlSeconds: 600,
    dedupeSecret: 'test-secret-key-that-is-at-least-32-chars-long',
    dedupeTimestampWindowSeconds: 300,
    sensitivePaths: [],
    defaultMaxInFlight: 1000,
    tenantMaxInFlight: {},
    queueConcurrency: 5,
    jobTimeoutMs: 30000,
    maxRetries: 3,
    retryBackoffMs: 1000,
    eventRetentionDays: 90,
    encryptContext: false,
    trustGates: {},
    defaultMinTrustLevel: 0,
    revalidateTrustAtDecision: true,
    softDeleteRetentionDays: 30,
    ...overrides,
  },
});

// Mock dependencies
vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => createMockConfig()),
}));

vi.mock('../../../src/common/redis.js', () => {
  const mockRedis = {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    duplicate: vi.fn().mockReturnThis(),
    eval: vi.fn().mockResolvedValue(1),
  };
  return {
    getRedis: vi.fn(() => mockRedis),
  };
});

vi.mock('../../../src/common/lock.js', () => ({
  getLockService: vi.fn(() => ({
    acquire: vi.fn().mockResolvedValue({
      acquired: true,
      lock: { release: vi.fn().mockResolvedValue(undefined) },
    }),
  })),
}));

vi.mock('../../../src/intent/queues.js', () => ({
  enqueueIntentSubmission: vi.fn().mockResolvedValue(undefined),
}));

// Mock database for ConsentService
vi.mock('../../../src/common/db.js', () => ({
  getDatabase: vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  })),
  checkDatabaseHealth: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../../../src/intent/metrics.js', () => ({
  recordIntentSubmission: vi.fn(),
  recordTrustGateEvaluation: vi.fn(),
  recordStatusTransition: vi.fn(),
  recordError: vi.fn(),
  recordLockContention: vi.fn(),
  recordTrustGateBypass: vi.fn(),
  recordDeduplication: vi.fn(),
  recordIntentContextSize: vi.fn(),
}));

vi.mock('../../../src/common/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock repository
const mockRepository = {
  createIntent: vi.fn(),
  createIntentWithEvent: vi.fn(),
  findById: vi.fn(),
  findByDedupeHash: vi.fn(),
  updateStatus: vi.fn(),
  listIntents: vi.fn(),
  recordEvent: vi.fn(),
  getRecentEvents: vi.fn(),
  recordEvaluation: vi.fn(),
  listEvaluations: vi.fn(),
  countActiveIntents: vi.fn().mockResolvedValue(0),
  updateTrustMetadata: vi.fn(),
  cancelIntent: vi.fn(),
  softDelete: vi.fn(),
  verifyEventChain: vi.fn(),
};

describe('HMAC Deduplication Security', () => {
  let IntentService: typeof import('../../../src/intent/index.js').IntentService;
  let getConfigMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-import to get fresh module with updated mocks
    const configModule = await import('../../../src/common/config.js');
    getConfigMock = configModule.getConfig as ReturnType<typeof vi.fn>;

    const intentModule = await import('../../../src/intent/index.js');
    IntentService = intentModule.IntentService;
  });

  afterEach(() => {
    // Restore Date.now
    Date.now = originalDateNow;
  });

  describe('computeDedupeHash with HMAC', () => {
    it('should produce HMAC-based hash when secret is configured', async () => {
      const secret = 'test-secret-key-that-is-at-least-32-chars-long';
      getConfigMock.mockReturnValue(createMockConfig({ dedupeSecret: secret }));

      const service = new IntentService(mockRepository as any);
      const payload = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: { key: 'value' },
        priority: 0,
      };

      // Mock Date.now to get predictable timestamp bucket
      const fixedTime = 1700000000000; // Nov 14, 2023
      Date.now = vi.fn(() => fixedTime);

      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_123',
        tenantId: 'tenant_1',
        entityId: payload.entityId,
        goal: payload.goal,
        status: 'pending',
        priority: 0,
        context: payload.context,
        metadata: {},
        trustSnapshot: null,
        intentType: null,
        dedupeHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      await service.submit(payload, { tenantId: 'tenant_1' });

      // Verify findByDedupeHash was called with an HMAC hash
      expect(mockRepository.findByDedupeHash).toHaveBeenCalled();
      const calledHash = mockRepository.findByDedupeHash.mock.calls[0][0];

      // Verify the hash is 64 hex characters (SHA-256 output)
      expect(calledHash).toMatch(/^[a-f0-9]{64}$/);

      // Compute expected HMAC to verify
      const windowSeconds = 300;
      const timestampBucket = Math.floor(fixedTime / 1000 / windowSeconds);
      const dataComponents = [
        'tenant_1',
        payload.entityId,
        payload.goal,
        JSON.stringify(payload.context),
        '',
        '',
        timestampBucket.toString(),
      ];
      const data = dataComponents.join('|');
      const expectedHmac = createHmac('sha256', secret).update(data).digest('hex');

      expect(calledHash).toBe(expectedHmac);
    });

    it('should produce different hashes for different secrets', async () => {
      const payload = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: {},
        priority: 0,
      };

      const fixedTime = 1700000000000;
      Date.now = vi.fn(() => fixedTime);

      // First submission with secret1
      const secret1 = 'secret-one-that-is-definitely-at-least-32-chars';
      getConfigMock.mockReturnValue(createMockConfig({ dedupeSecret: secret1 }));

      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_1',
        tenantId: 'tenant_1',
        entityId: payload.entityId,
        goal: payload.goal,
        status: 'pending',
        priority: 0,
        context: {},
        metadata: {},
        trustSnapshot: null,
        intentType: null,
        dedupeHash: 'hash1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const service1 = new IntentService(mockRepository as any);
      await service1.submit(payload, { tenantId: 'tenant_1' });
      const hash1 = mockRepository.findByDedupeHash.mock.calls[0][0];

      // Reset and use different secret
      vi.clearAllMocks();
      vi.resetModules();

      const secret2 = 'secret-two-that-is-definitely-at-least-32-chars';
      getConfigMock.mockReturnValue(createMockConfig({ dedupeSecret: secret2 }));

      const intentModule2 = await import('../../../src/intent/index.js');
      const IntentService2 = intentModule2.IntentService;

      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_2',
        tenantId: 'tenant_1',
        entityId: payload.entityId,
        goal: payload.goal,
        status: 'pending',
        priority: 0,
        context: {},
        metadata: {},
        trustSnapshot: null,
        intentType: null,
        dedupeHash: 'hash2',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const service2 = new IntentService2(mockRepository as any);
      await service2.submit(payload, { tenantId: 'tenant_1' });
      const hash2 = mockRepository.findByDedupeHash.mock.calls[0][0];

      // Hashes should be different with different secrets
      expect(hash1).not.toBe(hash2);
    });

    it('should include timestamp bucket in hash computation', async () => {
      const secret = 'test-secret-key-that-is-at-least-32-chars-long';
      const windowSeconds = 300; // 5 minutes
      getConfigMock.mockReturnValue(createMockConfig({
        dedupeSecret: secret,
        dedupeTimestampWindowSeconds: windowSeconds,
      }));

      const payload = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: {},
        priority: 0,
      };

      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_123',
        tenantId: 'tenant_1',
        entityId: payload.entityId,
        goal: payload.goal,
        status: 'pending',
        priority: 0,
        context: {},
        metadata: {},
        trustSnapshot: null,
        intentType: null,
        dedupeHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      // First request at time T
      const time1 = 1700000000000;
      Date.now = vi.fn(() => time1);

      const service1 = new IntentService(mockRepository as any);
      await service1.submit(payload, { tenantId: 'tenant_1' });
      const hash1 = mockRepository.findByDedupeHash.mock.calls[0][0];

      vi.clearAllMocks();

      // Second request at time T + 6 minutes (different bucket)
      const time2 = time1 + (6 * 60 * 1000); // 6 minutes later
      Date.now = vi.fn(() => time2);

      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_124',
        tenantId: 'tenant_1',
        entityId: payload.entityId,
        goal: payload.goal,
        status: 'pending',
        priority: 0,
        context: {},
        metadata: {},
        trustSnapshot: null,
        intentType: null,
        dedupeHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const service2 = new IntentService(mockRepository as any);
      await service2.submit(payload, { tenantId: 'tenant_1' });
      const hash2 = mockRepository.findByDedupeHash.mock.calls[0][0];

      // Hashes should be different due to different timestamp buckets
      expect(hash1).not.toBe(hash2);
    });

    it('should produce same hash within same timestamp bucket', async () => {
      const secret = 'test-secret-key-that-is-at-least-32-chars-long';
      const windowSeconds = 300; // 5 minutes
      const mockConfig = createMockConfig({
        dedupeSecret: secret,
        dedupeTimestampWindowSeconds: windowSeconds,
      });
      getConfigMock.mockReturnValue(mockConfig);

      const payload = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: {},
        priority: 0,
      };

      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_123',
        tenantId: 'tenant_1',
        entityId: payload.entityId,
        goal: payload.goal,
        status: 'pending',
        priority: 0,
        context: {},
        metadata: {},
        trustSnapshot: null,
        intentType: null,
        dedupeHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      // First request at time T
      const time1 = 1700000000000;
      Date.now = vi.fn(() => time1);

      const service1 = new IntentService(mockRepository as any);
      await service1.submit(payload, { tenantId: 'tenant_1' });
      const hash1 = mockRepository.findByDedupeHash.mock.calls[0][0];

      // Clear repository mocks but preserve config mock
      mockRepository.findByDedupeHash.mockClear();
      mockRepository.createIntentWithEvent.mockClear();
      mockRepository.countActiveIntents.mockClear();

      // Restore config mock (in case it was affected)
      getConfigMock.mockReturnValue(mockConfig);

      // Second request at time T + 1 minute (same bucket - bucket has ~100 seconds remaining)
      const time2 = time1 + (60 * 1000); // 1 minute later (within same bucket)
      Date.now = vi.fn(() => time2);

      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_124',
        tenantId: 'tenant_1',
        entityId: payload.entityId,
        goal: payload.goal,
        status: 'pending',
        priority: 0,
        context: {},
        metadata: {},
        trustSnapshot: null,
        intentType: null,
        dedupeHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      // Use the SAME service instance to ensure consistent config
      await service1.submit(payload, { tenantId: 'tenant_1' });
      const hash2 = mockRepository.findByDedupeHash.mock.calls[0][0];

      // Hashes should be the same within the same timestamp bucket
      expect(hash1).toBe(hash2);
    });

    it('should fall back to SHA-256 when no secret is configured (development)', async () => {
      getConfigMock.mockReturnValue(createMockConfig({ dedupeSecret: undefined }));

      const payload = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: { key: 'value' },
        priority: 0,
      };

      const fixedTime = 1700000000000;
      Date.now = vi.fn(() => fixedTime);

      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_123',
        tenantId: 'tenant_1',
        entityId: payload.entityId,
        goal: payload.goal,
        status: 'pending',
        priority: 0,
        context: payload.context,
        metadata: {},
        trustSnapshot: null,
        intentType: null,
        dedupeHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const service = new IntentService(mockRepository as any);
      await service.submit(payload, { tenantId: 'tenant_1' });

      const calledHash = mockRepository.findByDedupeHash.mock.calls[0][0];

      // Should still be a valid 64-char hex hash (SHA-256)
      expect(calledHash).toMatch(/^[a-f0-9]{64}$/);

      // Compute expected SHA-256 (no HMAC)
      const windowSeconds = 300;
      const timestampBucket = Math.floor(fixedTime / 1000 / windowSeconds);
      const dataComponents = [
        'tenant_1',
        payload.entityId,
        payload.goal,
        JSON.stringify(payload.context),
        '',
        '',
        timestampBucket.toString(),
      ];
      const data = dataComponents.join('|');
      const expectedHash = createHash('sha256').update(data).digest('hex');

      expect(calledHash).toBe(expectedHash);
    });

    it('should prevent external hash prediction with HMAC', async () => {
      const secret = 'test-secret-key-that-is-at-least-32-chars-long';
      getConfigMock.mockReturnValue(createMockConfig({ dedupeSecret: secret }));

      const payload = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: {},
        priority: 0,
      };

      const fixedTime = 1700000000000;
      Date.now = vi.fn(() => fixedTime);

      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_123',
        tenantId: 'tenant_1',
        entityId: payload.entityId,
        goal: payload.goal,
        status: 'pending',
        priority: 0,
        context: {},
        metadata: {},
        trustSnapshot: null,
        intentType: null,
        dedupeHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const service = new IntentService(mockRepository as any);
      await service.submit(payload, { tenantId: 'tenant_1' });

      const actualHash = mockRepository.findByDedupeHash.mock.calls[0][0];

      // An attacker trying to predict the hash without the secret would compute:
      const windowSeconds = 300;
      const timestampBucket = Math.floor(fixedTime / 1000 / windowSeconds);
      const dataComponents = [
        'tenant_1',
        payload.entityId,
        payload.goal,
        JSON.stringify(payload.context),
        '',
        '',
        timestampBucket.toString(),
      ];
      const data = dataComponents.join('|');

      // Attacker's hash (plain SHA-256, no secret)
      const attackerHash = createHash('sha256').update(data).digest('hex');

      // The actual HMAC hash should NOT match the attacker's prediction
      expect(actualHash).not.toBe(attackerHash);
    });

    it('should include all payload components in hash', async () => {
      const secret = 'test-secret-key-that-is-at-least-32-chars-long';
      getConfigMock.mockReturnValue(createMockConfig({ dedupeSecret: secret }));

      const fixedTime = 1700000000000;
      Date.now = vi.fn(() => fixedTime);

      const basePayload = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: {},
        priority: 0,
      };

      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_123',
        tenantId: 'tenant_1',
        entityId: basePayload.entityId,
        goal: basePayload.goal,
        status: 'pending',
        priority: 0,
        context: {},
        metadata: {},
        trustSnapshot: null,
        intentType: null,
        dedupeHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      // Collect hashes for different variations
      const hashes: string[] = [];

      // Base payload
      const service = new IntentService(mockRepository as any);
      await service.submit(basePayload, { tenantId: 'tenant_1' });
      hashes.push(mockRepository.findByDedupeHash.mock.calls[0][0]);

      // Different goal
      vi.clearAllMocks();
      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_124',
        tenantId: 'tenant_1',
        entityId: basePayload.entityId,
        goal: 'Different goal',
        status: 'pending',
        priority: 0,
        context: {},
        metadata: {},
        trustSnapshot: null,
        intentType: null,
        dedupeHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      await service.submit({ ...basePayload, goal: 'Different goal' }, { tenantId: 'tenant_1' });
      hashes.push(mockRepository.findByDedupeHash.mock.calls[0][0]);

      // Different context
      vi.clearAllMocks();
      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_125',
        tenantId: 'tenant_1',
        entityId: basePayload.entityId,
        goal: basePayload.goal,
        status: 'pending',
        priority: 0,
        context: { different: true },
        metadata: {},
        trustSnapshot: null,
        intentType: null,
        dedupeHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      await service.submit({ ...basePayload, context: { different: true } }, { tenantId: 'tenant_1' });
      hashes.push(mockRepository.findByDedupeHash.mock.calls[0][0]);

      // Different intentType
      vi.clearAllMocks();
      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_126',
        tenantId: 'tenant_1',
        entityId: basePayload.entityId,
        goal: basePayload.goal,
        status: 'pending',
        priority: 0,
        context: {},
        metadata: {},
        trustSnapshot: null,
        intentType: 'special-type',
        dedupeHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      await service.submit({ ...basePayload, intentType: 'special-type' }, { tenantId: 'tenant_1' });
      hashes.push(mockRepository.findByDedupeHash.mock.calls[0][0]);

      // All hashes should be unique
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(hashes.length);
    });

    it('should include idempotencyKey in hash when provided', async () => {
      const secret = 'test-secret-key-that-is-at-least-32-chars-long';
      getConfigMock.mockReturnValue(createMockConfig({ dedupeSecret: secret }));

      const fixedTime = 1700000000000;
      Date.now = vi.fn(() => fixedTime);

      const payload1 = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: {},
        priority: 0,
        idempotencyKey: 'key-1',
      };

      const payload2 = {
        ...payload1,
        idempotencyKey: 'key-2',
      };

      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_123',
        tenantId: 'tenant_1',
        entityId: payload1.entityId,
        goal: payload1.goal,
        status: 'pending',
        priority: 0,
        context: {},
        metadata: {},
        trustSnapshot: null,
        intentType: null,
        dedupeHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const service = new IntentService(mockRepository as any);
      await service.submit(payload1, { tenantId: 'tenant_1' });
      const hash1 = mockRepository.findByDedupeHash.mock.calls[0][0];

      vi.clearAllMocks();
      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.createIntentWithEvent.mockResolvedValue({
        id: 'int_124',
        tenantId: 'tenant_1',
        entityId: payload2.entityId,
        goal: payload2.goal,
        status: 'pending',
        priority: 0,
        context: {},
        metadata: {},
        trustSnapshot: null,
        intentType: null,
        dedupeHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      await service.submit(payload2, { tenantId: 'tenant_1' });
      const hash2 = mockRepository.findByDedupeHash.mock.calls[0][0];

      // Different idempotency keys should produce different hashes
      expect(hash1).not.toBe(hash2);
    });
  });
});
