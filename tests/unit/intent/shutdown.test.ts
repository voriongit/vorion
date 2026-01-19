/**
 * Graceful Shutdown Module Tests
 *
 * Tests for the INTENT module's graceful shutdown functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  isServerShuttingDown,
  getActiveRequestCount,
  trackRequest,
  gracefulShutdown,
  registerShutdownHandlers,
  shutdownRequestHook,
  shutdownResponseHook,
  resetShutdownState,
} from '../../../src/intent/shutdown.js';

// Mock dependencies
vi.mock('../../../src/common/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../../src/common/db.js', () => ({
  closeDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/common/redis.js', () => ({
  closeRedis: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/intent/queues.js', () => ({
  shutdownWorkers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/intent/gdpr.js', () => ({
  shutdownGdprWorker: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/intent/scheduler.js', () => ({
  stopScheduler: vi.fn().mockResolvedValue(undefined),
}));

describe('Graceful Shutdown Module', () => {
  beforeEach(() => {
    // Reset state before each test
    resetShutdownState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    resetShutdownState();
  });

  describe('isServerShuttingDown', () => {
    it('should return false initially', () => {
      expect(isServerShuttingDown()).toBe(false);
    });
  });

  describe('getActiveRequestCount', () => {
    it('should return 0 initially', () => {
      expect(getActiveRequestCount()).toBe(0);
    });

    it('should increment when tracking requests', () => {
      trackRequest();
      expect(getActiveRequestCount()).toBe(1);

      trackRequest();
      expect(getActiveRequestCount()).toBe(2);
    });

    it('should decrement when cleanup is called', () => {
      const cleanup1 = trackRequest();
      const cleanup2 = trackRequest();
      expect(getActiveRequestCount()).toBe(2);

      cleanup1();
      expect(getActiveRequestCount()).toBe(1);

      cleanup2();
      expect(getActiveRequestCount()).toBe(0);
    });
  });

  describe('trackRequest', () => {
    it('should return a cleanup function', () => {
      const cleanup = trackRequest();
      expect(typeof cleanup).toBe('function');
    });

    it('should prevent double cleanup', () => {
      const cleanup = trackRequest();
      expect(getActiveRequestCount()).toBe(1);

      cleanup();
      expect(getActiveRequestCount()).toBe(0);

      // Calling cleanup again should not decrement below 0
      cleanup();
      expect(getActiveRequestCount()).toBe(0);
    });
  });

  describe('shutdownRequestHook', () => {
    it('should reject requests when shutting down', async () => {
      // Create mock request and reply
      const mockRequest = {
        url: '/api/test',
        method: 'GET',
      } as unknown as FastifyRequest;

      const mockReply = {
        status: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      // First, start a graceful shutdown
      const mockServer = {
        close: vi.fn().mockResolvedValue(undefined),
        server: { close: vi.fn() },
      } as unknown as FastifyInstance;

      // Start shutdown without awaiting (we just need to set the flag)
      const shutdownPromise = gracefulShutdown(mockServer, {
        timeoutMs: 100,
        skipDatabase: true,
        skipRedis: true,
        skipWorkers: true,
        skipScheduler: true,
      });

      // Now try to handle a request during shutdown
      await shutdownRequestHook(mockRequest, mockReply);

      // Should have responded with 503
      expect(mockReply.status).toHaveBeenCalledWith(503);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'SERVICE_UNAVAILABLE',
            message: expect.stringContaining('shutting down'),
          }),
          retryAfter: 5,
        })
      );

      // Wait for shutdown to complete
      await shutdownPromise;
    });

    it('should include Retry-After header in 503 response', async () => {
      const mockRequest = {
        url: '/api/test',
        method: 'GET',
      } as unknown as FastifyRequest;

      const mockReply = {
        status: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      // Start shutdown
      const mockServer = {
        close: vi.fn().mockResolvedValue(undefined),
        server: { close: vi.fn() },
      } as unknown as FastifyInstance;

      const shutdownPromise = gracefulShutdown(mockServer, {
        timeoutMs: 100,
        skipDatabase: true,
        skipRedis: true,
        skipWorkers: true,
        skipScheduler: true,
      });

      await shutdownRequestHook(mockRequest, mockReply);

      // Should include Retry-After header
      expect(mockReply.header).toHaveBeenCalledWith('Retry-After', '5');
      expect(mockReply.header).toHaveBeenCalledWith('Connection', 'close');

      await shutdownPromise;
    });

    it('should track requests when not shutting down', async () => {
      const mockRequest = {
        url: '/api/test',
        method: 'GET',
      } as unknown as FastifyRequest & { shutdownCleanup?: () => void };

      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      expect(getActiveRequestCount()).toBe(0);

      await shutdownRequestHook(mockRequest, mockReply);

      // Should have tracked the request
      expect(getActiveRequestCount()).toBe(1);

      // Should have stored cleanup function on request
      expect(mockRequest.shutdownCleanup).toBeDefined();
      expect(typeof mockRequest.shutdownCleanup).toBe('function');

      // Should NOT have called reply.status (no rejection)
      expect(mockReply.status).not.toHaveBeenCalled();
    });
  });

  describe('shutdownResponseHook', () => {
    it('should call cleanup function when present', async () => {
      const mockCleanup = vi.fn();
      const mockRequest = {
        shutdownCleanup: mockCleanup,
      } as unknown as FastifyRequest & { shutdownCleanup?: () => void };

      await shutdownResponseHook(mockRequest);

      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should handle missing cleanup function gracefully', async () => {
      const mockRequest = {} as unknown as FastifyRequest;

      // Should not throw
      await expect(shutdownResponseHook(mockRequest)).resolves.toBeUndefined();
    });
  });

  describe('gracefulShutdown', () => {
    it('should set shutting down state', async () => {
      const mockServer = {
        close: vi.fn().mockResolvedValue(undefined),
        server: { close: vi.fn() },
      } as unknown as FastifyInstance;

      expect(isServerShuttingDown()).toBe(false);

      const shutdownPromise = gracefulShutdown(mockServer, {
        timeoutMs: 100,
        skipDatabase: true,
        skipRedis: true,
        skipWorkers: true,
        skipScheduler: true,
      });

      expect(isServerShuttingDown()).toBe(true);

      await shutdownPromise;
    });

    it('should close the server', async () => {
      const mockServer = {
        close: vi.fn().mockResolvedValue(undefined),
        server: { close: vi.fn() },
      } as unknown as FastifyInstance;

      await gracefulShutdown(mockServer, {
        timeoutMs: 100,
        skipDatabase: true,
        skipRedis: true,
        skipWorkers: true,
        skipScheduler: true,
      });

      expect(mockServer.close).toHaveBeenCalled();
    });

    it('should prevent multiple simultaneous shutdowns', async () => {
      const mockServer = {
        close: vi.fn().mockResolvedValue(undefined),
        server: { close: vi.fn() },
      } as unknown as FastifyInstance;

      // Start first shutdown
      const shutdown1 = gracefulShutdown(mockServer, {
        timeoutMs: 100,
        skipDatabase: true,
        skipRedis: true,
        skipWorkers: true,
        skipScheduler: true,
      });

      // Start second shutdown
      const shutdown2 = gracefulShutdown(mockServer, {
        timeoutMs: 100,
        skipDatabase: true,
        skipRedis: true,
        skipWorkers: true,
        skipScheduler: true,
      });

      await Promise.all([shutdown1, shutdown2]);

      // Server close should only be called once
      expect(mockServer.close).toHaveBeenCalledTimes(1);
    });

    it('should wait for active requests to complete', async () => {
      const mockServer = {
        close: vi.fn().mockResolvedValue(undefined),
        server: { close: vi.fn() },
      } as unknown as FastifyInstance;

      // Start a request
      const cleanup = trackRequest();
      expect(getActiveRequestCount()).toBe(1);

      // Start shutdown with short timeout
      const shutdownPromise = gracefulShutdown(mockServer, {
        timeoutMs: 500,
        skipDatabase: true,
        skipRedis: true,
        skipWorkers: true,
        skipScheduler: true,
      });

      // Complete the request after a short delay
      setTimeout(() => {
        cleanup();
      }, 100);

      await shutdownPromise;

      // Request should have been completed
      expect(getActiveRequestCount()).toBe(0);
    });

    it('should force shutdown after timeout with active requests', async () => {
      const mockServer = {
        close: vi.fn().mockResolvedValue(undefined),
        server: { close: vi.fn() },
      } as unknown as FastifyInstance;

      // Start a request that never completes
      trackRequest();
      expect(getActiveRequestCount()).toBe(1);

      // Start shutdown with very short timeout
      await gracefulShutdown(mockServer, {
        timeoutMs: 100,
        skipDatabase: true,
        skipRedis: true,
        skipWorkers: true,
        skipScheduler: true,
      });

      // Should have timed out with request still active
      // Note: The request count remains 1 because we didn't clean it up
      expect(getActiveRequestCount()).toBe(1);
    });
  });

  describe('registerShutdownHandlers', () => {
    it('should register SIGTERM and SIGINT handlers', () => {
      const originalOn = process.on;
      const handlers: Record<string, Function> = {};

      // Mock process.on to capture registered handlers
      process.on = vi.fn((event: string, handler: Function) => {
        handlers[event] = handler;
        return process;
      }) as typeof process.on;

      try {
        const mockServer = {
          close: vi.fn().mockResolvedValue(undefined),
          server: { close: vi.fn() },
        } as unknown as FastifyInstance;

        registerShutdownHandlers(mockServer);

        expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
        expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
        expect(handlers['SIGTERM']).toBeDefined();
        expect(handlers['SIGINT']).toBeDefined();
      } finally {
        // Restore original process.on
        process.on = originalOn;
      }
    });
  });

  describe('resetShutdownState', () => {
    it('should reset all state', async () => {
      // Set up some state
      trackRequest();
      trackRequest();

      const mockServer = {
        close: vi.fn().mockResolvedValue(undefined),
        server: { close: vi.fn() },
      } as unknown as FastifyInstance;

      await gracefulShutdown(mockServer, {
        timeoutMs: 100,
        skipDatabase: true,
        skipRedis: true,
        skipWorkers: true,
        skipScheduler: true,
      });

      // State should be set
      expect(isServerShuttingDown()).toBe(true);

      // Reset
      resetShutdownState();

      // State should be cleared
      expect(isServerShuttingDown()).toBe(false);
      expect(getActiveRequestCount()).toBe(0);
    });
  });
});

describe('Integration: Shutdown with Request Tracking', () => {
  beforeEach(() => {
    resetShutdownState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetShutdownState();
  });

  it('should track multiple concurrent requests and wait for completion', async () => {
    const mockServer = {
      close: vi.fn().mockResolvedValue(undefined),
      server: { close: vi.fn() },
    } as unknown as FastifyInstance;

    // Simulate multiple concurrent requests
    const cleanups: Array<() => void> = [];
    for (let i = 0; i < 5; i++) {
      cleanups.push(trackRequest());
    }
    expect(getActiveRequestCount()).toBe(5);

    // Start shutdown
    const shutdownPromise = gracefulShutdown(mockServer, {
      timeoutMs: 1000,
      skipDatabase: true,
      skipRedis: true,
      skipWorkers: true,
      skipScheduler: true,
    });

    // Complete requests gradually
    for (let i = 0; i < cleanups.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      cleanups[i]!();
    }

    await shutdownPromise;

    expect(getActiveRequestCount()).toBe(0);
  });

  it('should reject new requests after shutdown starts', async () => {
    const mockServer = {
      close: vi.fn().mockResolvedValue(undefined),
      server: { close: vi.fn() },
    } as unknown as FastifyInstance;

    // Start shutdown
    const shutdownPromise = gracefulShutdown(mockServer, {
      timeoutMs: 500,
      skipDatabase: true,
      skipRedis: true,
      skipWorkers: true,
      skipScheduler: true,
    });

    // Try to make new requests during shutdown
    const mockRequest = {
      url: '/api/test',
      method: 'POST',
    } as unknown as FastifyRequest;

    const mockReply = {
      status: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as unknown as FastifyReply;

    await shutdownRequestHook(mockRequest, mockReply);

    // Should have rejected with 503
    expect(mockReply.status).toHaveBeenCalledWith(503);
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'SERVICE_UNAVAILABLE',
        }),
      })
    );

    await shutdownPromise;
  });
});

describe('Shutdown Response Format', () => {
  beforeEach(() => {
    resetShutdownState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetShutdownState();
  });

  it('should return structured error response during shutdown', async () => {
    const mockServer = {
      close: vi.fn().mockResolvedValue(undefined),
      server: { close: vi.fn() },
    } as unknown as FastifyInstance;

    const mockRequest = {
      url: '/api/test',
      method: 'GET',
    } as unknown as FastifyRequest;

    const mockReply = {
      status: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as unknown as FastifyReply;

    const shutdownPromise = gracefulShutdown(mockServer, {
      timeoutMs: 100,
      skipDatabase: true,
      skipRedis: true,
      skipWorkers: true,
      skipScheduler: true,
    });

    await shutdownRequestHook(mockRequest, mockReply);

    // Verify complete response structure
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'SERVICE_UNAVAILABLE',
          message: expect.any(String),
        }),
        retryAfter: expect.any(Number),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      })
    );

    await shutdownPromise;
  });

  it('should include timestamp in ISO format', async () => {
    const mockServer = {
      close: vi.fn().mockResolvedValue(undefined),
      server: { close: vi.fn() },
    } as unknown as FastifyInstance;

    const mockRequest = {
      url: '/api/test',
      method: 'GET',
    } as unknown as FastifyRequest;

    let capturedResponse: any;
    const mockReply = {
      status: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      send: vi.fn((body) => {
        capturedResponse = body;
        return mockReply;
      }),
    } as unknown as FastifyReply;

    const shutdownPromise = gracefulShutdown(mockServer, {
      timeoutMs: 100,
      skipDatabase: true,
      skipRedis: true,
      skipWorkers: true,
      skipScheduler: true,
    });

    await shutdownRequestHook(mockRequest, mockReply);

    expect(capturedResponse.timestamp).toBeDefined();
    expect(new Date(capturedResponse.timestamp).toISOString()).toBe(capturedResponse.timestamp);

    await shutdownPromise;
  });
});
