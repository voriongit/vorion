/**
 * Policy Endpoint Authorization Integration Tests
 *
 * Tests role-based authorization for all policy CRUD endpoints.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createSigner } from 'fast-jwt';

// Mock dependencies before importing modules that use them
vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => ({
    env: 'test',
    jwt: { secret: 'test-secret-key-for-testing-12345', requireJti: false },
    api: {
      port: 3000,
      host: '0.0.0.0',
      basePath: '/api/v1',
      rateLimit: 1000,
    },
    health: {
      checkTimeoutMs: 5000,
      readyTimeoutMs: 10000,
      livenessTimeoutMs: 1000,
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
    eval: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
  };
  return {
    getRedis: vi.fn(() => mockRedis),
    checkRedisHealth: vi.fn().mockResolvedValue({ healthy: true, latencyMs: 1 }),
  };
});

vi.mock('../../../src/common/db.js', () => {
  const mockDb = {
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([]),
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    }),
  };
  return {
    checkDatabaseHealth: () => Promise.resolve({ healthy: true, latencyMs: 1 }),
    getDatabase: () => mockDb,
  };
});

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
  retryDeadLetterJob: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../src/intent/repository.js', () => ({
  IntentRepository: vi.fn().mockImplementation(() => ({
    createIntent: vi.fn(),
    createIntentWithEvent: vi.fn(),
    findById: vi.fn().mockResolvedValue(null),
    findByDedupeHash: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn(),
    cancelIntent: vi.fn(),
    softDelete: vi.fn(),
    listIntents: vi.fn().mockResolvedValue([]),
    recordEvent: vi.fn(),
    getRecentEvents: vi.fn().mockResolvedValue([]),
    recordEvaluation: vi.fn(),
    listEvaluations: vi.fn().mockResolvedValue([]),
    countActiveIntents: vi.fn().mockResolvedValue(0),
    updateTrustMetadata: vi.fn(),
    verifyEventChain: vi.fn().mockResolvedValue({ valid: true }),
  })),
}));

// Mock policy data store
const mockPolicyData = new Map<string, any>();

vi.mock('../../../src/policy/service.js', () => ({
  createPolicyService: vi.fn(() => ({
    create: vi.fn(async (tenantId: string, data: any) => {
      const policy = {
        id: crypto.randomUUID(),
        tenantId,
        name: data.name,
        description: data.description,
        namespace: data.namespace ?? 'default',
        definition: data.definition,
        status: 'draft',
        version: 1,
        createdBy: data.createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockPolicyData.set(policy.id, policy);
      return policy;
    }),
    findById: vi.fn(async (id: string, tenantId: string) => {
      const policy = mockPolicyData.get(id);
      if (policy && policy.tenantId === tenantId) {
        return policy;
      }
      return null;
    }),
    list: vi.fn(async (options: any) => {
      return Array.from(mockPolicyData.values()).filter(
        (p) => p.tenantId === options.tenantId
      );
    }),
    update: vi.fn(async (id: string, tenantId: string, data: any) => {
      const policy = mockPolicyData.get(id);
      if (policy && policy.tenantId === tenantId) {
        Object.assign(policy, data, {
          version: policy.version + 1,
          updatedAt: new Date().toISOString(),
        });
        return policy;
      }
      return null;
    }),
    publish: vi.fn(async (id: string, tenantId: string) => {
      const policy = mockPolicyData.get(id);
      if (policy && policy.tenantId === tenantId) {
        policy.status = 'active';
        policy.updatedAt = new Date().toISOString();
        return policy;
      }
      return null;
    }),
    deprecate: vi.fn(async (id: string, tenantId: string) => {
      const policy = mockPolicyData.get(id);
      if (policy && policy.tenantId === tenantId) {
        policy.status = 'deprecated';
        policy.updatedAt = new Date().toISOString();
        return policy;
      }
      return null;
    }),
    archive: vi.fn(async (id: string, tenantId: string) => {
      const policy = mockPolicyData.get(id);
      if (policy && policy.tenantId === tenantId) {
        policy.status = 'archived';
        policy.updatedAt = new Date().toISOString();
        return policy;
      }
      return null;
    }),
    delete: vi.fn(async (id: string, tenantId: string) => {
      const policy = mockPolicyData.get(id);
      if (policy && policy.tenantId === tenantId) {
        mockPolicyData.delete(id);
        return true;
      }
      return false;
    }),
  })),
  PolicyValidationError: class PolicyValidationError extends Error {
    errors: any[];
    constructor(message: string, errors: any[] = []) {
      super(message);
      this.errors = errors;
    }
  },
}));

vi.mock('../../../src/policy/loader.js', () => ({
  getPolicyLoader: vi.fn(() => ({
    loadPolicies: vi.fn().mockResolvedValue([]),
    invalidateCache: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock tenant verification to allow all test users
// In production, this verifies user actually belongs to tenant
vi.mock('../../../src/common/tenant-verification.js', () => ({
  verifyTenantMembership: vi.fn().mockResolvedValue({ isMember: true, role: 'member', cached: false }),
  requireTenantMembership: vi.fn().mockResolvedValue(undefined),
  invalidateMembershipCache: vi.fn().mockResolvedValue(undefined),
  invalidateUserMembershipCache: vi.fn().mockResolvedValue(undefined),
  invalidateTenantMembershipCache: vi.fn().mockResolvedValue(undefined),
}));

import { createServer } from '../../../src/api/server.js';

const JWT_SECRET = 'test-secret-key-for-testing-12345';
const signToken = createSigner({ key: JWT_SECRET, expiresIn: 3600000 });

describe('Policy Endpoint Authorization Tests', () => {
  let server: FastifyInstance;
  const testTenantId = 'test-tenant-123';

  function createAuthToken(
    tenantId: string,
    sub = 'test-user',
    roles: string[] = []
  ): string {
    return signToken({ tenantId, sub, roles });
  }

  const validPolicyBody = {
    name: 'Test Policy',
    description: 'A test policy',
    namespace: 'test',
    definition: {
      version: '1.0' as const,
      rules: [
        {
          id: 'rule-1',
          name: 'Test Rule',
          priority: 1,
          enabled: true,
          when: { field: 'intentType', operator: 'equals', value: 'test' },
          then: { action: 'allow' as const },
        },
      ],
      defaultAction: 'deny' as const,
    },
  };

  beforeAll(async () => {
    server = await createServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    mockPolicyData.clear();
    vi.clearAllMocks();
  });

  describe('GET /api/v1/policies (List Policies)', () => {
    it('should allow access with admin role', async () => {
      const token = createAuthToken(testTenantId, 'admin-user', ['admin']);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should allow access with tenant:admin role', async () => {
      const token = createAuthToken(testTenantId, 'tenant-admin', ['tenant:admin']);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should allow access with policy:admin role', async () => {
      const token = createAuthToken(testTenantId, 'policy-admin', ['policy:admin']);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should allow access with policy_reader role', async () => {
      const token = createAuthToken(testTenantId, 'reader-user', ['policy_reader']);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should allow access with policy_writer role', async () => {
      const token = createAuthToken(testTenantId, 'writer-user', ['policy_writer']);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should deny access with no roles', async () => {
      const token = createAuthToken(testTenantId, 'no-role-user', []);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should deny access with unrelated roles', async () => {
      const token = createAuthToken(testTenantId, 'viewer', ['viewer', 'user']);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 401 without authorization header', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/policies',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/policies/:id (Get Policy by ID)', () => {
    it('should allow access with policy_reader role', async () => {
      // First create a policy as admin
      const adminToken = createAuthToken(testTenantId, 'admin', ['admin']);
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Then read it as policy_reader
      const readerToken = createAuthToken(testTenantId, 'reader', ['policy_reader']);
      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/policies/${policy.id}`,
        headers: { authorization: `Bearer ${readerToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should deny access with no policy roles', async () => {
      const token = createAuthToken(testTenantId, 'user', ['user']);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/policies/some-uuid',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/policies (Create Policy)', () => {
    it('should allow access with admin role', async () => {
      const token = createAuthToken(testTenantId, 'admin-user', ['admin']);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.name).toBe(validPolicyBody.name);
    });

    it('should allow access with policy_writer role', async () => {
      const token = createAuthToken(testTenantId, 'writer-user', ['policy_writer']);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });

      expect(response.statusCode).toBe(201);
    });

    it('should deny access with policy_reader role only', async () => {
      const token = createAuthToken(testTenantId, 'reader-user', ['policy_reader']);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should deny access with no roles', async () => {
      const token = createAuthToken(testTenantId, 'no-role-user', []);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('PUT /api/v1/policies/:id (Update Policy)', () => {
    it('should allow access with admin role', async () => {
      const token = createAuthToken(testTenantId, 'admin-user', ['admin']);

      // Create policy first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Update policy
      const response = await server.inject({
        method: 'PUT',
        url: `/api/v1/policies/${policy.id}`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: { description: 'Updated description' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should allow access with policy_writer role', async () => {
      const adminToken = createAuthToken(testTenantId, 'admin', ['admin']);
      const writerToken = createAuthToken(testTenantId, 'writer', ['policy_writer']);

      // Create policy as admin
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Update as writer
      const response = await server.inject({
        method: 'PUT',
        url: `/api/v1/policies/${policy.id}`,
        headers: {
          authorization: `Bearer ${writerToken}`,
          'content-type': 'application/json',
        },
        payload: { description: 'Writer updated' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should deny access with policy_reader role', async () => {
      const adminToken = createAuthToken(testTenantId, 'admin', ['admin']);
      const readerToken = createAuthToken(testTenantId, 'reader', ['policy_reader']);

      // Create policy as admin
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Try to update as reader
      const response = await server.inject({
        method: 'PUT',
        url: `/api/v1/policies/${policy.id}`,
        headers: {
          authorization: `Bearer ${readerToken}`,
          'content-type': 'application/json',
        },
        payload: { description: 'Should fail' },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/v1/policies/:id (Delete Policy)', () => {
    it('should allow access with admin role', async () => {
      const token = createAuthToken(testTenantId, 'admin-user', ['admin']);

      // Create policy
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Delete policy
      const response = await server.inject({
        method: 'DELETE',
        url: `/api/v1/policies/${policy.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should allow access with tenant:admin role', async () => {
      const adminToken = createAuthToken(testTenantId, 'admin', ['admin']);
      const tenantAdminToken = createAuthToken(testTenantId, 'tenant-admin', ['tenant:admin']);

      // Create policy as admin
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Delete as tenant:admin
      const response = await server.inject({
        method: 'DELETE',
        url: `/api/v1/policies/${policy.id}`,
        headers: { authorization: `Bearer ${tenantAdminToken}` },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should allow access with policy:admin role', async () => {
      const adminToken = createAuthToken(testTenantId, 'admin', ['admin']);
      const policyAdminToken = createAuthToken(testTenantId, 'policy-admin', ['policy:admin']);

      // Create policy as admin
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Delete as policy:admin
      const response = await server.inject({
        method: 'DELETE',
        url: `/api/v1/policies/${policy.id}`,
        headers: { authorization: `Bearer ${policyAdminToken}` },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should deny access with policy_writer role', async () => {
      const adminToken = createAuthToken(testTenantId, 'admin', ['admin']);
      const writerToken = createAuthToken(testTenantId, 'writer', ['policy_writer']);

      // Create policy as admin
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Try to delete as writer
      const response = await server.inject({
        method: 'DELETE',
        url: `/api/v1/policies/${policy.id}`,
        headers: { authorization: `Bearer ${writerToken}` },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should deny access with policy_reader role', async () => {
      const adminToken = createAuthToken(testTenantId, 'admin', ['admin']);
      const readerToken = createAuthToken(testTenantId, 'reader', ['policy_reader']);

      // Create policy as admin
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Try to delete as reader
      const response = await server.inject({
        method: 'DELETE',
        url: `/api/v1/policies/${policy.id}`,
        headers: { authorization: `Bearer ${readerToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/policies/:id/publish (Publish Policy)', () => {
    it('should allow access with policy_writer role', async () => {
      const adminToken = createAuthToken(testTenantId, 'admin', ['admin']);
      const writerToken = createAuthToken(testTenantId, 'writer', ['policy_writer']);

      // Create policy as admin
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Publish as writer
      const response = await server.inject({
        method: 'POST',
        url: `/api/v1/policies/${policy.id}/publish`,
        headers: { authorization: `Bearer ${writerToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should deny access with policy_reader role', async () => {
      const adminToken = createAuthToken(testTenantId, 'admin', ['admin']);
      const readerToken = createAuthToken(testTenantId, 'reader', ['policy_reader']);

      // Create policy as admin
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Try to publish as reader
      const response = await server.inject({
        method: 'POST',
        url: `/api/v1/policies/${policy.id}/publish`,
        headers: { authorization: `Bearer ${readerToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/policies/:id/deprecate (Deprecate Policy)', () => {
    it('should allow access with admin role', async () => {
      const token = createAuthToken(testTenantId, 'admin', ['admin']);

      // Create and publish policy
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Deprecate
      const response = await server.inject({
        method: 'POST',
        url: `/api/v1/policies/${policy.id}/deprecate`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should deny access with policy_reader role', async () => {
      const adminToken = createAuthToken(testTenantId, 'admin', ['admin']);
      const readerToken = createAuthToken(testTenantId, 'reader', ['policy_reader']);

      // Create policy as admin
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Try to deprecate as reader
      const response = await server.inject({
        method: 'POST',
        url: `/api/v1/policies/${policy.id}/deprecate`,
        headers: { authorization: `Bearer ${readerToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/policies/:id/archive (Archive Policy)', () => {
    it('should allow access with policy_writer role', async () => {
      const adminToken = createAuthToken(testTenantId, 'admin', ['admin']);
      const writerToken = createAuthToken(testTenantId, 'writer', ['policy_writer']);

      // Create policy as admin
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Archive as writer
      const response = await server.inject({
        method: 'POST',
        url: `/api/v1/policies/${policy.id}/archive`,
        headers: { authorization: `Bearer ${writerToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should deny access with policy_reader role', async () => {
      const adminToken = createAuthToken(testTenantId, 'admin', ['admin']);
      const readerToken = createAuthToken(testTenantId, 'reader', ['policy_reader']);

      // Create policy as admin
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      const policy = JSON.parse(createResponse.payload);

      // Try to archive as reader
      const response = await server.inject({
        method: 'POST',
        url: `/api/v1/policies/${policy.id}/archive`,
        headers: { authorization: `Bearer ${readerToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Combined role scenarios', () => {
    it('should work with multiple roles', async () => {
      const token = createAuthToken(testTenantId, 'multi-role-user', [
        'user',
        'policy_reader',
        'policy_writer',
      ]);

      // Should be able to read
      const readResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(readResponse.statusCode).toBe(200);

      // Should be able to create
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      expect(createResponse.statusCode).toBe(201);

      const policy = JSON.parse(createResponse.payload);

      // Should NOT be able to delete (needs admin)
      const deleteResponse = await server.inject({
        method: 'DELETE',
        url: `/api/v1/policies/${policy.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(deleteResponse.statusCode).toBe(403);
    });

    it('should correctly handle role with colon prefix', async () => {
      const token = createAuthToken(testTenantId, 'policy-admin', ['policy:admin']);

      // policy:admin should have full access
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: validPolicyBody,
      });
      expect(createResponse.statusCode).toBe(201);

      const policy = JSON.parse(createResponse.payload);

      const deleteResponse = await server.inject({
        method: 'DELETE',
        url: `/api/v1/policies/${policy.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(deleteResponse.statusCode).toBe(204);
    });
  });
});
