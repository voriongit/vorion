/**
 * Tests for Response Middleware - Request ID Handling
 *
 * Validates:
 * - Request ID is returned in response headers
 * - Request ID is included in response body (meta.requestId)
 * - Incoming request ID from client is preserved
 * - New request ID is generated when none provided
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  registerResponseMiddleware,
  sendSuccess,
  sendError,
  REQUEST_ID_HEADER,
  type ResponseContext,
} from '../../../src/intent/response-middleware.js';
import { HttpStatus } from '../../../src/intent/response.js';

// Mock dependencies
vi.mock('../../../src/common/trace.js', () => ({
  getTraceContext: vi.fn(() => null),
}));

vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => ({
    env: 'test',
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

describe('Response Middleware - Request ID Handling', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = Fastify();
    registerResponseMiddleware(server);
  });

  describe('REQUEST_ID_HEADER constant', () => {
    it('should be X-Request-ID', () => {
      expect(REQUEST_ID_HEADER).toBe('X-Request-ID');
    });
  });

  describe('Request ID in Response Headers', () => {
    it('should return X-Request-ID header in response when none provided', async () => {
      server.get('/test', async (request, reply) => {
        return sendSuccess(reply, { message: 'test' }, HttpStatus.OK, request);
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers[REQUEST_ID_HEADER.toLowerCase()]).toBeDefined();
      expect(typeof response.headers[REQUEST_ID_HEADER.toLowerCase()]).toBe('string');
      // Should be a valid UUID format
      const requestId = response.headers[REQUEST_ID_HEADER.toLowerCase()];
      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should preserve incoming X-Request-ID header', async () => {
      const clientRequestId = 'client-request-id-12345';

      server.get('/test', async (request, reply) => {
        return sendSuccess(reply, { message: 'test' }, HttpStatus.OK, request);
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
        headers: {
          [REQUEST_ID_HEADER.toLowerCase()]: clientRequestId,
        },
      });

      expect(response.headers[REQUEST_ID_HEADER.toLowerCase()]).toBe(clientRequestId);
    });
  });

  describe('Request ID in Response Body', () => {
    it('should include requestId in success response meta', async () => {
      server.get('/test', async (request, reply) => {
        return sendSuccess(reply, { message: 'test' }, HttpStatus.OK, request);
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.meta).toBeDefined();
      expect(body.meta.requestId).toBeDefined();
      expect(typeof body.meta.requestId).toBe('string');
    });

    it('should include requestId in error response meta', async () => {
      server.get('/test-error', async (request, reply) => {
        return sendError(
          reply,
          'TEST_ERROR',
          'Test error message',
          HttpStatus.BAD_REQUEST,
          undefined,
          request
        );
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test-error',
      });

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.meta).toBeDefined();
      expect(body.meta.requestId).toBeDefined();
      expect(typeof body.meta.requestId).toBe('string');
    });

    it('should match requestId in header and body', async () => {
      server.get('/test', async (request, reply) => {
        return sendSuccess(reply, { message: 'test' }, HttpStatus.OK, request);
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      const body = JSON.parse(response.body);
      const headerRequestId = response.headers[REQUEST_ID_HEADER.toLowerCase()];

      expect(body.meta.requestId).toBe(headerRequestId);
    });

    it('should preserve client requestId in both header and body', async () => {
      const clientRequestId = 'my-custom-request-id';

      server.get('/test', async (request, reply) => {
        return sendSuccess(reply, { message: 'test' }, HttpStatus.OK, request);
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
        headers: {
          [REQUEST_ID_HEADER.toLowerCase()]: clientRequestId,
        },
      });

      const body = JSON.parse(response.body);

      expect(response.headers[REQUEST_ID_HEADER.toLowerCase()]).toBe(clientRequestId);
      expect(body.meta.requestId).toBe(clientRequestId);
    });
  });

  describe('Response Context', () => {
    it('should store requestId in responseContext', async () => {
      let capturedRequestId: string | undefined;

      server.get('/test', async (request, reply) => {
        capturedRequestId = request.responseContext?.requestId;
        return sendSuccess(reply, { message: 'test' }, HttpStatus.OK, request);
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      const body = JSON.parse(response.body);
      expect(capturedRequestId).toBeDefined();
      expect(capturedRequestId).toBe(body.meta.requestId);
    });

    it('should include timestamp in meta', async () => {
      server.get('/test', async (request, reply) => {
        return sendSuccess(reply, { message: 'test' }, HttpStatus.OK, request);
      });

      await server.ready();

      const beforeRequest = new Date().toISOString();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      const afterRequest = new Date().toISOString();
      const body = JSON.parse(response.body);

      expect(body.meta.timestamp).toBeDefined();
      // Timestamp should be between before and after
      expect(body.meta.timestamp >= beforeRequest).toBe(true);
      expect(body.meta.timestamp <= afterRequest).toBe(true);
    });
  });

  describe('Auto-wrap responses option', () => {
    it('should auto-wrap responses when wrapAllResponses is true', async () => {
      const wrapServer = Fastify();
      registerResponseMiddleware(wrapServer, { wrapAllResponses: true });

      wrapServer.get('/test', async () => {
        return { message: 'unwrapped response' };
      });

      await wrapServer.ready();

      const response = await wrapServer.inject({
        method: 'GET',
        url: '/test',
      });

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ message: 'unwrapped response' });
      expect(body.meta).toBeDefined();
      expect(body.meta.requestId).toBeDefined();
    });

    it('should not double-wrap already wrapped responses', async () => {
      const wrapServer = Fastify();
      registerResponseMiddleware(wrapServer, { wrapAllResponses: true });

      wrapServer.get('/test', async (request, reply) => {
        return sendSuccess(reply, { message: 'already wrapped' }, HttpStatus.OK, request);
      });

      await wrapServer.ready();

      const response = await wrapServer.inject({
        method: 'GET',
        url: '/test',
      });

      const body = JSON.parse(response.body);
      // Should not have nested success/data structure
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ message: 'already wrapped' });
      expect(body.data.success).toBeUndefined();
    });
  });
});
