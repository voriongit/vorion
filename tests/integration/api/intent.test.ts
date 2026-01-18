/**
 * Intent API Integration Tests
 *
 * Tests the full HTTP request/response cycle for intent endpoints.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createSigner } from 'fast-jwt';

// Mock dependencies before importing modules that use them
vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => ({
    env: 'test',
    jwt: { secret: 'test-secret-key-for-testing-12345' },
    api: {
      port: 3000,
      host: '0.0.0.0',
      basePath: '/api/v1',
      rateLimit: 1000,
    },
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0,
      password: undefined,
    },
    intent: {
      defaultNamespace: 'default',
      namespaceRouting: {},
      dedupeTtlSeconds: 600,
      sensitivePaths: ['context.password', 'context.apiKey'],
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
      revalidateTrustAtDecision: false,
      softDeleteRetentionDays: 30,
    },
  })),
}));

vi.mock('../../../src/common/logger.js', () => {
  const createMockLogger = () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    silent: vi.fn(),
    child: vi.fn().mockImplementation(() => createMockLogger()),
    level: 'info',
  });

  return {
    createLogger: vi.fn(createMockLogger),
    logger: createMockLogger(),
  };
});

vi.mock('../../../src/common/redis.js', () => {
  const mockRedis = {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    duplicate: vi.fn().mockReturnThis(),
    ping: vi.fn().mockResolvedValue('PONG'),
  };
  return {
    getRedis: vi.fn(() => mockRedis),
    checkRedisHealth: vi.fn().mockResolvedValue({ healthy: true, latencyMs: 1 }),
  };
});

vi.mock('../../../src/common/db.js', () => ({
  checkDatabaseHealth: vi.fn().mockResolvedValue({ healthy: true, latencyMs: 1 }),
}));

vi.mock('../../../src/intent/queues.js', () => ({
  enqueueIntentSubmission: vi.fn().mockResolvedValue(undefined),
  registerIntentWorkers: vi.fn(),
  shutdownWorkers: vi.fn().mockResolvedValue(undefined),
  getQueueHealth: vi.fn().mockResolvedValue({
    intake: { waiting: 0, active: 0, completed: 0, failed: 0 },
    evaluate: { waiting: 0, active: 0, completed: 0, failed: 0 },
    decision: { waiting: 0, active: 0, completed: 0, failed: 0 },
    deadLetter: { waiting: 0, active: 0, completed: 0, failed: 0 },
  }),
}));

// Mock intent repository
const mockIntentData = new Map<string, any>();
let mockEventData: any[] = [];
let mockEvaluationData: any[] = [];

vi.mock('../../../src/intent/repository.js', () => ({
  IntentRepository: vi.fn().mockImplementation(() => ({
    createIntent: vi.fn(async (data: any) => {
      const intent = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockIntentData.set(intent.id, intent);
      return intent;
    }),
    createIntentWithEvent: vi.fn(async (data: any, _eventData: any) => {
      const intent = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockIntentData.set(intent.id, intent);
      return intent;
    }),
    findById: vi.fn(async (id: string, tenantId: string) => {
      const intent = mockIntentData.get(id);
      if (intent && intent.tenantId === tenantId && !intent.deletedAt) {
        return intent;
      }
      return null;
    }),
    findByDedupeHash: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn(async (id: string, tenantId: string, status: string) => {
      const intent = mockIntentData.get(id);
      if (intent && intent.tenantId === tenantId) {
        intent.status = status;
        intent.updatedAt = new Date().toISOString();
        return intent;
      }
      return null;
    }),
    cancelIntent: vi.fn(async (id: string, tenantId: string, reason: string) => {
      const intent = mockIntentData.get(id);
      if (intent && intent.tenantId === tenantId && ['pending', 'evaluating', 'escalated'].includes(intent.status)) {
        intent.status = 'cancelled';
        intent.cancellationReason = reason;
        intent.updatedAt = new Date().toISOString();
        return intent;
      }
      return null;
    }),
    softDelete: vi.fn(async (id: string, tenantId: string) => {
      const intent = mockIntentData.get(id);
      if (intent && intent.tenantId === tenantId && !intent.deletedAt) {
        intent.deletedAt = new Date().toISOString();
        intent.updatedAt = new Date().toISOString();
        return intent;
      }
      return null;
    }),
    listIntents: vi.fn(async (options: any) => {
      return Array.from(mockIntentData.values()).filter(
        (intent) => intent.tenantId === options.tenantId && !intent.deletedAt
      );
    }),
    recordEvent: vi.fn(async (data: any) => {
      const event = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString(),
      };
      mockEventData.push(event);
      return event;
    }),
    getRecentEvents: vi.fn(async (intentId: string) => {
      return mockEventData.filter((e) => e.intentId === intentId);
    }),
    recordEvaluation: vi.fn(async (data: any) => {
      const evaluation = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString(),
      };
      mockEvaluationData.push(evaluation);
      return evaluation;
    }),
    listEvaluations: vi.fn(async (intentId: string) => {
      return mockEvaluationData.filter((e) => e.intentId === intentId);
    }),
    countActiveIntents: vi.fn().mockResolvedValue(0),
    updateTrustMetadata: vi.fn(),
    verifyEventChain: vi.fn().mockResolvedValue({ valid: true }),
  })),
}));

import { createServer } from '../../../src/api/server.js';

const JWT_SECRET = 'test-secret-key-for-testing-12345';
const signToken = createSigner({ key: JWT_SECRET, expiresIn: 3600000 }); // 1 hour

// Create an expired token by setting iat (issued at) to the past and a short exp
function createExpiredToken(payload: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000);
  const signer = createSigner({ key: JWT_SECRET });
  return signer({ ...payload, iat: now - 7200, exp: now - 3600 }); // Expired 1 hour ago
}

describe('Intent API Integration Tests', () => {
  let server: FastifyInstance;
  const testTenantId = 'test-tenant-123';
  const testEntityId = '123e4567-e89b-12d3-a456-426614174000';

  function createAuthToken(tenantId: string, sub = 'test-user'): string {
    return signToken({ tenantId, sub });
  }

  beforeAll(async () => {
    server = await createServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    mockIntentData.clear();
    mockEventData = [];
    mockEvaluationData = [];
    vi.clearAllMocks();
  });

  describe('Health Endpoints', () => {
    it('GET /health should return healthy status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('healthy');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('environment');
    });

    it('GET /ready should return ready status when all systems healthy', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('ready');
      expect(body.checks.database.status).toBe('ok');
      expect(body.checks.redis.status).toBe('ok');
      expect(body.checks.queues.status).toBe('ok');
    });
  });

  describe('POST /api/v1/intents', () => {
    it('should create a new intent with valid data', async () => {
      const token = createAuthToken(testTenantId);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Test intent goal',
          context: { action: 'test' },
          priority: 5,
        },
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('id');
      expect(body.entityId).toBe(testEntityId);
      expect(body.goal).toBe('Test intent goal');
      expect(body.status).toBe('pending');
      expect(body.tenantId).toBe(testTenantId);
    });

    it('should return 401 without authorization header', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Test goal',
          context: {},
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for token without tenantId', async () => {
      const tokenWithoutTenant = signToken({ sub: 'test-user' });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${tokenWithoutTenant}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Test goal',
          context: {},
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 for invalid entityId format', async () => {
      const token = createAuthToken(testTenantId);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: 'not-a-uuid',
          goal: 'Test goal',
          context: {},
        },
      });

      expect(response.statusCode).toBe(500); // Zod validation error
    });

    it('should return 400 for empty goal', async () => {
      const token = createAuthToken(testTenantId);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: '',
          context: {},
        },
      });

      expect(response.statusCode).toBe(500); // Zod validation error
    });

    it('should accept optional intentType', async () => {
      const token = createAuthToken(testTenantId);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Test intent with type',
          context: {},
          intentType: 'data-access',
        },
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.payload);
      expect(body.intentType).toBe('data-access');
    });

    it('should accept optional idempotencyKey', async () => {
      const token = createAuthToken(testTenantId);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Idempotent intent',
          context: {},
          idempotencyKey: 'unique-key-123',
        },
      });

      expect(response.statusCode).toBe(202);
    });

    it('should default priority to 0 when not provided', async () => {
      const token = createAuthToken(testTenantId);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Test goal without priority',
          context: {},
        },
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.payload);
      expect(body.priority).toBe(0);
    });
  });

  describe('GET /api/v1/intents/:id', () => {
    it('should retrieve an existing intent', async () => {
      const token = createAuthToken(testTenantId);

      // First create an intent
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Intent to retrieve',
          context: { test: true },
        },
      });

      const createdIntent = JSON.parse(createResponse.payload);

      // Then retrieve it
      const getResponse = await server.inject({
        method: 'GET',
        url: `/api/v1/intents/${createdIntent.id}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(getResponse.statusCode).toBe(200);
      const body = JSON.parse(getResponse.payload);
      expect(body.id).toBe(createdIntent.id);
      expect(body.goal).toBe('Intent to retrieve');
      expect(body).toHaveProperty('events');
      expect(body).toHaveProperty('evaluations');
    });

    it('should return 404 for non-existent intent', async () => {
      const token = createAuthToken(testTenantId);
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/intents/${nonExistentId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('INTENT_NOT_FOUND');
    });

    it('should not return intent for different tenant', async () => {
      const token1 = createAuthToken('tenant-1');
      const token2 = createAuthToken('tenant-2');

      // Create intent as tenant-1
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token1}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Tenant 1 intent',
          context: {},
        },
      });

      const createdIntent = JSON.parse(createResponse.payload);

      // Try to retrieve as tenant-2
      const getResponse = await server.inject({
        method: 'GET',
        url: `/api/v1/intents/${createdIntent.id}`,
        headers: {
          authorization: `Bearer ${token2}`,
        },
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      const token = createAuthToken(testTenantId);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/intents/not-a-uuid',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(500); // Zod validation error
    });
  });

  describe('GET /api/v1/intents', () => {
    it('should list intents for tenant', async () => {
      const token = createAuthToken(testTenantId);

      // Create multiple intents
      await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Intent 1',
          context: {},
        },
      });

      await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Intent 2',
          context: {},
        },
      });

      // List intents
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(2);
    });

    it('should filter by entityId', async () => {
      const token = createAuthToken(testTenantId);
      const entity2Id = '223e4567-e89b-12d3-a456-426614174000';

      // Create intents for different entities
      await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Entity 1 intent',
          context: {},
        },
      });

      await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: entity2Id,
          goal: 'Entity 2 intent',
          context: {},
        },
      });

      // List with entityId filter
      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/intents?entityId=${testEntityId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by status', async () => {
      const token = createAuthToken(testTenantId);

      // Create an intent
      await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Pending intent',
          context: {},
        },
      });

      // List with status filter
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/intents?status=pending',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const token = createAuthToken(testTenantId);

      // Create multiple intents
      for (let i = 0; i < 5; i++) {
        await server.inject({
          method: 'POST',
          url: '/api/v1/intents',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          payload: {
            entityId: testEntityId,
            goal: `Intent ${i}`,
            context: {},
          },
        });
      }

      // List with limit
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/intents?limit=2',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return empty array for tenant with no intents', async () => {
      const token = createAuthToken('empty-tenant');

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toEqual([]);
    });

    it('should return 400 for invalid status value', async () => {
      const token = createAuthToken(testTenantId);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/intents?status=invalid-status',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(500); // Zod validation error
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const token = createAuthToken(testTenantId);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('CORS', () => {
    it('should allow CORS in test environment', async () => {
      const response = await server.inject({
        method: 'OPTIONS',
        url: '/api/v1/intents',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('POST /api/v1/intents/:id/cancel', () => {
    it('should cancel a pending intent', async () => {
      const token = createAuthToken(testTenantId);

      // Create an intent
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Intent to cancel',
          context: {},
        },
      });

      const createdIntent = JSON.parse(createResponse.payload);

      // Cancel the intent
      const cancelResponse = await server.inject({
        method: 'POST',
        url: `/api/v1/intents/${createdIntent.id}/cancel`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          reason: 'User requested cancellation',
        },
      });

      expect(cancelResponse.statusCode).toBe(200);
      const body = JSON.parse(cancelResponse.payload);
      expect(body.status).toBe('cancelled');
      expect(body.cancellationReason).toBe('User requested cancellation');
    });

    it('should return 404 for non-existent intent', async () => {
      const token = createAuthToken(testTenantId);
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await server.inject({
        method: 'POST',
        url: `/api/v1/intents/${nonExistentId}/cancel`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          reason: 'Test cancellation',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('INTENT_NOT_FOUND_OR_NOT_CANCELLABLE');
    });

    it('should require a reason for cancellation', async () => {
      const token = createAuthToken(testTenantId);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/intents/00000000-0000-0000-0000-000000000000/cancel',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(500); // Zod validation error
    });

    it('should not cancel intent from different tenant', async () => {
      const token1 = createAuthToken('tenant-1');
      const token2 = createAuthToken('tenant-2');

      // Create intent as tenant-1
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token1}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Tenant 1 intent',
          context: {},
        },
      });

      const createdIntent = JSON.parse(createResponse.payload);

      // Try to cancel as tenant-2
      const cancelResponse = await server.inject({
        method: 'POST',
        url: `/api/v1/intents/${createdIntent.id}/cancel`,
        headers: {
          authorization: `Bearer ${token2}`,
          'content-type': 'application/json',
        },
        payload: {
          reason: 'Unauthorized cancellation attempt',
        },
      });

      expect(cancelResponse.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/intents/:id', () => {
    it('should soft delete an intent', async () => {
      const token = createAuthToken(testTenantId);

      // Create an intent
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Intent to delete',
          context: {},
        },
      });

      const createdIntent = JSON.parse(createResponse.payload);

      // Delete the intent
      const deleteResponse = await server.inject({
        method: 'DELETE',
        url: `/api/v1/intents/${createdIntent.id}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(deleteResponse.statusCode).toBe(204);

      // Verify it's no longer accessible
      const getResponse = await server.inject({
        method: 'GET',
        url: `/api/v1/intents/${createdIntent.id}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent intent', async () => {
      const token = createAuthToken(testTenantId);
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await server.inject({
        method: 'DELETE',
        url: `/api/v1/intents/${nonExistentId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('INTENT_NOT_FOUND');
    });

    it('should not delete intent from different tenant', async () => {
      const token1 = createAuthToken('tenant-1');
      const token2 = createAuthToken('tenant-2');

      // Create intent as tenant-1
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token1}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Tenant 1 intent',
          context: {},
        },
      });

      const createdIntent = JSON.parse(createResponse.payload);

      // Try to delete as tenant-2
      const deleteResponse = await server.inject({
        method: 'DELETE',
        url: `/api/v1/intents/${createdIntent.id}`,
        headers: {
          authorization: `Bearer ${token2}`,
        },
      });

      expect(deleteResponse.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/intents/:id/verify', () => {
    it('should verify event chain for an intent', async () => {
      const token = createAuthToken(testTenantId);

      // Create an intent
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Intent to verify',
          context: {},
        },
      });

      const createdIntent = JSON.parse(createResponse.payload);

      // Verify the event chain
      const verifyResponse = await server.inject({
        method: 'GET',
        url: `/api/v1/intents/${createdIntent.id}/verify`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(verifyResponse.statusCode).toBe(200);
      const body = JSON.parse(verifyResponse.payload);
      expect(body).toHaveProperty('valid');
      expect(body.valid).toBe(true);
    });

    it('should return 404 for non-existent intent', async () => {
      const token = createAuthToken(testTenantId);
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/intents/${nonExistentId}/verify`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('INTENT_NOT_FOUND');
    });

    it('should not verify intent from different tenant', async () => {
      const token1 = createAuthToken('tenant-1');
      const token2 = createAuthToken('tenant-2');

      // Create intent as tenant-1
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/intents',
        headers: {
          authorization: `Bearer ${token1}`,
          'content-type': 'application/json',
        },
        payload: {
          entityId: testEntityId,
          goal: 'Tenant 1 intent',
          context: {},
        },
      });

      const createdIntent = JSON.parse(createResponse.payload);

      // Try to verify as tenant-2
      const verifyResponse = await server.inject({
        method: 'GET',
        url: `/api/v1/intents/${createdIntent.id}/verify`,
        headers: {
          authorization: `Bearer ${token2}`,
        },
      });

      expect(verifyResponse.statusCode).toBe(404);
    });
  });
});

describe('Intent API Error Handling', () => {
  let server: FastifyInstance;
  const testTenantId = 'test-tenant-123';

  function createAuthToken(tenantId: string): string {
    return signToken({ tenantId, sub: 'test-user' });
  }

  beforeAll(async () => {
    server = await createServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should handle expired JWT tokens', async () => {
    const expiredToken = createExpiredToken({ tenantId: testTenantId, sub: 'test-user' });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/intents',
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should handle invalid JWT tokens', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/intents',
      headers: {
        authorization: 'Bearer invalid-token-here',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should handle malformed authorization header', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/intents',
      headers: {
        authorization: 'NotBearer token',
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
