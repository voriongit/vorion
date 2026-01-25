/**
 * API Middleware Tests
 *
 * Tests for API hardening middleware:
 * - Validation middleware
 * - Rate limiting middleware
 * - Security headers middleware
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { z } from 'zod';

// Mock dependencies before importing modules
vi.mock('../../../src/common/trace.js', () => ({
  getTraceContext: vi.fn(() => ({ traceId: 'test-trace-id', spanId: 'test-span-id' })),
  createTraceContext: vi.fn(() => ({ traceId: 'new-trace-id', spanId: 'new-span-id', traceparent: '00-new-trace-id-new-span-id-01' })),
}));

vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => ({
    env: 'test',
    api: { rateLimit: 100 },
  })),
}));

vi.mock('../../../src/common/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: vi.fn(() => ({
      startActiveSpan: vi.fn((name, options, fn) => fn({
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      })),
    })),
    getActiveSpan: vi.fn(() => null),
  },
  SpanStatusCode: { OK: 1, ERROR: 2 },
  SpanKind: { INTERNAL: 0 },
  context: { active: vi.fn() },
}));

// Import after mocks
import {
  validateBody,
  validateQuery,
  validateParams,
  validateRequest,
} from '../../../src/api/middleware/validation.js';

import {
  rateLimit,
  rateLimitPerTenant,
  getRateLimitStore,
  resetRateLimitStore,
} from '../../../src/api/middleware/rateLimit.js';

import {
  securityHeaders,
  requestIdInjection,
  requestLogging,
  maskSensitiveData,
} from '../../../src/api/middleware/security.js';

import {
  ApiError,
  ValidationError,
  NotFoundError,
  AuthError,
  RateLimitError,
  ForbiddenError,
  ConflictError,
  createErrorHandler,
  createErrorResponse,
  ErrorCode,
  isApiError,
} from '../../../src/api/errors.js';

describe('Validation Middleware', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = Fastify();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('validateBody', () => {
    it('should validate request body successfully', async () => {
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      });

      server.post('/test', {
        preHandler: validateBody(schema),
      }, async (request) => {
        return { data: request.body };
      });

      await server.ready();

      const response = await server.inject({
        method: 'POST',
        url: '/test',
        payload: { name: 'Test User', email: 'test@example.com' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe('Test User');
      expect(body.data.email).toBe('test@example.com');
    });

    it('should reject invalid request body', async () => {
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      });

      server.post('/test', {
        preHandler: validateBody(schema),
      }, async () => {
        return { success: true };
      });

      await server.ready();

      const response = await server.inject({
        method: 'POST',
        url: '/test',
        payload: { name: '', email: 'invalid-email' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details.errors).toBeDefined();
      expect(body.error.details.errors.length).toBeGreaterThan(0);
    });

    it('should reject missing request body', async () => {
      const schema = z.object({
        name: z.string(),
      });

      server.post('/test', {
        preHandler: validateBody(schema),
      }, async () => {
        return { success: true };
      });

      await server.ready();

      const response = await server.inject({
        method: 'POST',
        url: '/test',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should detect injection patterns when enabled', async () => {
      const schema = z.object({
        query: z.string(),
      });

      server.post('/test', {
        preHandler: validateBody(schema, { checkInjection: true }),
      }, async () => {
        return { success: true };
      });

      await server.ready();

      const response = await server.inject({
        method: 'POST',
        url: '/test',
        payload: { query: "SELECT * FROM users WHERE id = '1'; DROP TABLE users;" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should sanitize input strings', async () => {
      const schema = z.object({
        text: z.string(),
      });

      server.post('/test', {
        preHandler: validateBody(schema, { sanitize: true }),
      }, async (request) => {
        return { data: request.body };
      });

      await server.ready();

      const response = await server.inject({
        method: 'POST',
        url: '/test',
        payload: { text: '  trimmed  ' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.text).toBe('trimmed');
    });
  });

  describe('validateQuery', () => {
    it('should validate query parameters successfully', async () => {
      const schema = z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      });

      server.get('/test', {
        preHandler: validateQuery(schema),
      }, async (request) => {
        return { query: request.query };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test?page=2&limit=50',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.query.page).toBe(2);
      expect(body.query.limit).toBe(50);
    });

    it('should apply default values for missing query params', async () => {
      const schema = z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      });

      server.get('/test', {
        preHandler: validateQuery(schema),
      }, async (request) => {
        return { query: request.query };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.query.page).toBe(1);
      expect(body.query.limit).toBe(20);
    });

    it('should reject invalid query parameters', async () => {
      const schema = z.object({
        page: z.coerce.number().int().min(1),
      });

      server.get('/test', {
        preHandler: validateQuery(schema),
      }, async () => {
        return { success: true };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test?page=invalid',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('validateParams', () => {
    it('should validate path parameters successfully', async () => {
      const schema = z.object({
        id: z.string().uuid(),
      });

      server.get('/users/:id', {
        preHandler: validateParams(schema),
      }, async (request) => {
        return { params: request.params };
      });

      await server.ready();

      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const response = await server.inject({
        method: 'GET',
        url: `/users/${uuid}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.params.id).toBe(uuid);
    });

    it('should reject invalid path parameters', async () => {
      const schema = z.object({
        id: z.string().uuid(),
      });

      server.get('/users/:id', {
        preHandler: validateParams(schema),
      }, async () => {
        return { success: true };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/users/not-a-uuid',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('validateRequest', () => {
    it('should validate params, query, and body together', async () => {
      const schemas = {
        params: z.object({ id: z.string().uuid() }),
        query: z.object({ include: z.string().optional() }),
        body: z.object({ name: z.string() }),
      };

      server.put('/users/:id', {
        preHandler: validateRequest(schemas),
      }, async (request) => {
        return {
          params: request.params,
          query: request.query,
          body: request.body,
        };
      });

      await server.ready();

      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const response = await server.inject({
        method: 'PUT',
        url: `/users/${uuid}?include=details`,
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.params.id).toBe(uuid);
      expect(body.query.include).toBe('details');
      expect(body.body.name).toBe('Updated Name');
    });
  });
});

describe('Rate Limiting Middleware', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    resetRateLimitStore();
    server = Fastify();
  });

  afterEach(async () => {
    await server.close();
    resetRateLimitStore();
  });

  describe('rateLimit', () => {
    it('should allow requests within limit', async () => {
      server.get('/test', {
        preHandler: rateLimit({ limit: 5, windowSeconds: 60 }),
      }, async () => {
        return { success: true };
      });

      await server.ready();

      for (let i = 0; i < 5; i++) {
        const response = await server.inject({
          method: 'GET',
          url: '/test',
        });
        expect(response.statusCode).toBe(200);
      }
    });

    it('should block requests exceeding limit', async () => {
      server.get('/test', {
        preHandler: rateLimit({ limit: 3, windowSeconds: 60 }),
      }, async () => {
        return { success: true };
      });

      await server.ready();

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const response = await server.inject({
          method: 'GET',
          url: '/test',
        });
        expect(response.statusCode).toBe(200);
      }

      // 4th request should be rate limited
      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error.retryAfter).toBeDefined();
    });

    it('should set rate limit headers', async () => {
      server.get('/test', {
        preHandler: rateLimit({ limit: 10, windowSeconds: 60 }),
      }, async () => {
        return { success: true };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should skip rate limiting when skip function returns true', async () => {
      server.get('/test', {
        preHandler: rateLimit({
          limit: 1,
          windowSeconds: 60,
          skip: () => true,
        }),
      }, async () => {
        return { success: true };
      });

      await server.ready();

      // Both requests should succeed because skip returns true
      for (let i = 0; i < 5; i++) {
        const response = await server.inject({
          method: 'GET',
          url: '/test',
        });
        expect(response.statusCode).toBe(200);
      }
    });
  });

  describe('rateLimitPerTenant', () => {
    it('should apply per-tenant rate limits', async () => {
      // Mock authentication
      server.decorateRequest('user', null);
      server.addHook('preHandler', async (request) => {
        const tenantId = request.headers['x-tenant-id'] as string;
        if (tenantId) {
          (request as FastifyRequest & { user: { tenantId: string } }).user = { tenantId };
        }
      });

      server.get('/test', {
        preHandler: rateLimitPerTenant({ limit: 2, windowSeconds: 60 }),
      }, async () => {
        return { success: true };
      });

      await server.ready();

      // Tenant A: 2 requests allowed
      for (let i = 0; i < 2; i++) {
        const response = await server.inject({
          method: 'GET',
          url: '/test',
          headers: { 'x-tenant-id': 'tenant-a' },
        });
        expect(response.statusCode).toBe(200);
      }

      // Tenant A: 3rd request blocked
      const responseA = await server.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-tenant-id': 'tenant-a' },
      });
      expect(responseA.statusCode).toBe(429);

      // Tenant B: Should still be allowed (separate limit)
      const responseB = await server.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-tenant-id': 'tenant-b' },
      });
      expect(responseB.statusCode).toBe(200);
    });

    it('should apply tenant-specific overrides', async () => {
      server.decorateRequest('user', null);
      server.addHook('preHandler', async (request) => {
        const tenantId = request.headers['x-tenant-id'] as string;
        if (tenantId) {
          (request as FastifyRequest & { user: { tenantId: string } }).user = { tenantId };
        }
      });

      server.get('/test', {
        preHandler: rateLimitPerTenant({
          limit: 2,
          windowSeconds: 60,
          tenantOverrides: {
            'premium-tenant': { limit: 10 },
          },
        }),
      }, async () => {
        return { success: true };
      });

      await server.ready();

      // Premium tenant gets higher limit
      for (let i = 0; i < 10; i++) {
        const response = await server.inject({
          method: 'GET',
          url: '/test',
          headers: { 'x-tenant-id': 'premium-tenant' },
        });
        expect(response.statusCode).toBe(200);
      }

      // 11th request blocked
      const response = await server.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-tenant-id': 'premium-tenant' },
      });
      expect(response.statusCode).toBe(429);
    });
  });
});

describe('Security Middleware', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = Fastify();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('securityHeaders', () => {
    it('should set default security headers', async () => {
      server.addHook('onRequest', securityHeaders());

      server.get('/test', async () => {
        return { success: true };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBeDefined();
    });

    it('should allow custom security headers', async () => {
      server.addHook('onRequest', securityHeaders({
        frameOptions: 'SAMEORIGIN',
        customHeaders: {
          'X-Custom-Header': 'custom-value',
        },
      }));

      server.get('/test', async () => {
        return { success: true };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['x-custom-header']).toBe('custom-value');
    });
  });

  describe('requestIdInjection', () => {
    it('should generate request ID when not provided', async () => {
      server.addHook('onRequest', requestIdInjection());

      server.get('/test', async (request) => {
        return { requestId: request.id };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers['x-request-id']).toBeDefined();
      expect(typeof response.headers['x-request-id']).toBe('string');

      const body = JSON.parse(response.body);
      expect(body.requestId).toBe(response.headers['x-request-id']);
    });

    it('should preserve incoming request ID', async () => {
      server.addHook('onRequest', requestIdInjection());

      server.get('/test', async (request) => {
        return { requestId: request.id };
      });

      await server.ready();

      const customRequestId = 'custom-request-123';
      const response = await server.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-request-id': customRequestId },
      });

      expect(response.headers['x-request-id']).toBe(customRequestId);

      const body = JSON.parse(response.body);
      expect(body.requestId).toBe(customRequestId);
    });

    it('should add trace ID header', async () => {
      server.addHook('onRequest', requestIdInjection());

      server.get('/test', async () => {
        return { success: true };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers['x-trace-id']).toBeDefined();
    });
  });

  describe('requestLogging', () => {
    it('should create logging hooks', () => {
      const hooks = requestLogging();

      expect(hooks.onRequest).toBeDefined();
      expect(hooks.onResponse).toBeDefined();
      expect(typeof hooks.onRequest).toBe('function');
      expect(typeof hooks.onResponse).toBe('function');
    });

    it('should exclude health endpoints by default', async () => {
      const hooks = requestLogging({
        excludePaths: ['/health'],
      });

      server.addHook('onRequest', hooks.onRequest);
      server.addHook('onResponse', hooks.onResponse);

      server.get('/health', async () => {
        return { status: 'ok' };
      });

      server.get('/api/data', async () => {
        return { data: 'test' };
      });

      await server.ready();

      // Health endpoint should be excluded
      const healthResponse = await server.inject({
        method: 'GET',
        url: '/health',
      });
      expect(healthResponse.statusCode).toBe(200);

      // Regular endpoint should be logged
      const apiResponse = await server.inject({
        method: 'GET',
        url: '/api/data',
      });
      expect(apiResponse.statusCode).toBe(200);
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask sensitive fields', () => {
      const data = {
        username: 'testuser',
        password: 'secret123',
        apiKey: 'key-123',
        nested: {
          token: 'bearer-token',
          safe: 'visible',
        },
      };

      const masked = maskSensitiveData(data) as Record<string, unknown>;

      expect(masked.username).toBe('testuser');
      expect(masked.password).toBe('[REDACTED]');
      expect(masked.apiKey).toBe('[REDACTED]');
      expect((masked.nested as Record<string, unknown>).token).toBe('[REDACTED]');
      expect((masked.nested as Record<string, unknown>).safe).toBe('visible');
    });

    it('should handle arrays', () => {
      const data = {
        users: [
          { name: 'User 1', password: 'pass1' },
          { name: 'User 2', password: 'pass2' },
        ],
      };

      const masked = maskSensitiveData(data) as { users: Array<{ name: string; password: string }> };

      expect(masked.users[0].name).toBe('User 1');
      expect(masked.users[0].password).toBe('[REDACTED]');
      expect(masked.users[1].name).toBe('User 2');
      expect(masked.users[1].password).toBe('[REDACTED]');
    });

    it('should handle null and undefined', () => {
      expect(maskSensitiveData(null)).toBeNull();
      expect(maskSensitiveData(undefined)).toBeUndefined();
    });

    it('should handle deep nesting with max depth', () => {
      let deep: Record<string, unknown> = { value: 'test' };
      for (let i = 0; i < 15; i++) {
        deep = { nested: deep };
      }

      const masked = maskSensitiveData(deep, undefined, 10) as Record<string, unknown>;
      // Should not throw and should handle max depth
      expect(masked).toBeDefined();
    });
  });
});

describe('Error Handling', () => {
  describe('Error Classes', () => {
    it('should create ApiError with correct properties', () => {
      const error = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Test error',
        { field: 'test' }
      );

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'test' });
    });

    it('should create ValidationError', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ValidationError');
    });

    it('should create NotFoundError', () => {
      const error = new NotFoundError('User');

      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
    });

    it('should create AuthError variants', () => {
      expect(AuthError.tokenInvalid().code).toBe(ErrorCode.TOKEN_INVALID);
      expect(AuthError.tokenExpired().code).toBe(ErrorCode.TOKEN_EXPIRED);
      expect(AuthError.tokenRevoked().code).toBe(ErrorCode.TOKEN_REVOKED);
      expect(AuthError.missingAuth().code).toBe(ErrorCode.MISSING_AUTH);
    });

    it('should create RateLimitError with retryAfter', () => {
      const error = new RateLimitError('Too many requests', 30);

      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(30);
    });

    it('should create ForbiddenError variants', () => {
      const permError = ForbiddenError.insufficientPermissions('admin:write');
      expect(permError.code).toBe(ErrorCode.FORBIDDEN);
      expect(permError.details?.requiredPermission).toBe('admin:write');

      const tenantError = ForbiddenError.tenantMismatch();
      expect(tenantError.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('should create ConflictError', () => {
      const error = ConflictError.invalidState('pending', ['approved', 'rejected']);

      expect(error.code).toBe(ErrorCode.CONFLICT);
      expect(error.statusCode).toBe(409);
      expect(error.details?.currentState).toBe('pending');
      expect(error.details?.allowedStates).toEqual(['approved', 'rejected']);
    });
  });

  describe('Error Serialization', () => {
    it('should serialize ApiError to VorionErrorResponse', () => {
      const error = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Test error',
        { field: 'test' }
      );

      const response = error.toResponse('req-123');

      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(response.error.message).toBe('Test error');
      expect(response.error.details).toEqual({ field: 'test' });
      expect(response.meta.requestId).toBe('req-123');
      expect(response.meta.timestamp).toBeDefined();
    });

    it('should omit details in production mode', () => {
      const error = new ApiError(
        ErrorCode.INTERNAL_ERROR,
        'Internal error',
        { sensitive: 'data' }
      );

      const response = error.toResponse('req-123', false);

      expect(response.error.details).toBeUndefined();
    });
  });

  describe('createErrorResponse', () => {
    it('should handle ApiError', () => {
      const error = new NotFoundError('User');
      const { response, statusCode } = createErrorResponse(error, 'req-123');

      expect(statusCode).toBe(404);
      expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('should handle ZodError', () => {
      const schema = z.object({ name: z.string() });
      const result = schema.safeParse({ name: 123 });

      if (!result.success) {
        const { response, statusCode } = createErrorResponse(result.error, 'req-123');

        expect(statusCode).toBe(400);
        expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it('should handle generic Error', () => {
      const error = new Error('Something went wrong');
      const { response, statusCode } = createErrorResponse(error, 'req-123', true);

      expect(statusCode).toBe(500);
      expect(response.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(response.error.message).toBe('An unexpected error occurred');
    });

    it('should include trace ID when available', () => {
      const error = new NotFoundError('User');
      const { response } = createErrorResponse(error, 'req-123');

      expect(response.trace?.traceId).toBe('test-trace-id');
    });
  });

  describe('isApiError', () => {
    it('should return true for ApiError instances', () => {
      expect(isApiError(new ApiError(ErrorCode.NOT_FOUND, 'Not found'))).toBe(true);
      expect(isApiError(new NotFoundError('User'))).toBe(true);
      expect(isApiError(new ValidationError('Invalid'))).toBe(true);
    });

    it('should return false for non-ApiError', () => {
      expect(isApiError(new Error('Generic'))).toBe(false);
      expect(isApiError({ code: 'ERROR' })).toBe(false);
      expect(isApiError(null)).toBe(false);
    });
  });

  describe('Error Handler Middleware', () => {
    let server: FastifyInstance;

    beforeEach(async () => {
      server = Fastify();
      server.setErrorHandler(createErrorHandler());
    });

    afterEach(async () => {
      await server.close();
    });

    it('should handle thrown ApiError', async () => {
      server.get('/test', async () => {
        throw new NotFoundError('Resource');
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('should handle thrown generic Error', async () => {
      server.get('/test', async () => {
        throw new Error('Unexpected error');
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    });

    it('should add Retry-After header for rate limit errors', async () => {
      server.get('/test', async () => {
        throw new RateLimitError('Rate limit exceeded', 60);
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers['retry-after']).toBe('60');
    });
  });
});
