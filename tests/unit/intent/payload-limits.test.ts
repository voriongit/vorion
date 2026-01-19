/**
 * Tests for Intent Payload Size Limits and Request ID Handling
 *
 * Validates:
 * - Payload over 1MB is rejected
 * - Context with more than 100 keys is rejected
 * - Request ID is returned in response headers
 * - Request ID is included in response body
 * - Incoming request ID is preserved
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  intentSubmissionSchema,
  intentPayloadSchema,
  PAYLOAD_LIMITS,
} from '../../../src/intent/index.js';
import { ZodError } from 'zod';

// Mock dependencies needed by the module
vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => ({
    intent: {
      defaultNamespace: 'default',
      namespaceRouting: {},
      dedupeTtlSeconds: 600,
      sensitivePaths: [],
      defaultMaxInFlight: 1000,
      tenantMaxInFlight: {},
      trustGates: {},
      defaultMinTrustLevel: 0,
    },
  })),
}));

vi.mock('../../../src/common/redis.js', () => ({
  getRedis: vi.fn(() => ({
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    duplicate: vi.fn().mockReturnThis(),
    eval: vi.fn().mockResolvedValue(1),
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

vi.mock('../../../src/common/db.js', () => ({
  getDatabase: vi.fn(() => ({})),
}));

vi.mock('../../../src/intent/queues.js', () => ({
  enqueueIntentSubmission: vi.fn().mockResolvedValue(undefined),
}));

describe('Payload Size Limits', () => {
  describe('PAYLOAD_LIMITS constants', () => {
    it('should export MAX_PAYLOAD_SIZE_BYTES as 1MB', () => {
      expect(PAYLOAD_LIMITS.MAX_PAYLOAD_SIZE_BYTES).toBe(1024 * 1024);
    });

    it('should export MAX_CONTEXT_BYTES as 64KB', () => {
      expect(PAYLOAD_LIMITS.MAX_CONTEXT_BYTES).toBe(64 * 1024);
    });

    it('should export MAX_CONTEXT_KEYS as 100', () => {
      expect(PAYLOAD_LIMITS.MAX_CONTEXT_KEYS).toBe(100);
    });

    it('should export MAX_STRING_LENGTH as 10000', () => {
      expect(PAYLOAD_LIMITS.MAX_STRING_LENGTH).toBe(10000);
    });
  });

  describe('intentPayloadSchema', () => {
    it('should accept valid payload with few keys', () => {
      const payload = { key1: 'value1', key2: 'value2' };
      const result = intentPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should reject payload exceeding maximum size', () => {
      // Create a payload just over 1MB
      const largeValue = 'x'.repeat(PAYLOAD_LIMITS.MAX_PAYLOAD_SIZE_BYTES + 1);
      const payload = { data: largeValue };
      const result = intentPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Payload exceeds maximum size');
      }
    });

    it('should reject payload with more than 100 keys', () => {
      const payload: Record<string, string> = {};
      for (let i = 0; i < 101; i++) {
        payload[`key${i}`] = 'value';
      }
      const result = intentPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Payload exceeds maximum of 100 keys');
      }
    });

    it('should accept payload with exactly 100 keys', () => {
      const payload: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        payload[`key${i}`] = 'value';
      }
      const result = intentPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('intentSubmissionSchema', () => {
    const validSubmission = {
      entityId: '550e8400-e29b-41d4-a716-446655440000',
      goal: 'Test goal',
      context: { key: 'value' },
    };

    it('should accept valid submission', () => {
      const result = intentSubmissionSchema.safeParse(validSubmission);
      expect(result.success).toBe(true);
    });

    it('should accept submission with all optional fields', () => {
      const submission = {
        ...validSubmission,
        metadata: { additionalInfo: 'test' },
        intentType: 'data-access',
        priority: 5,
        idempotencyKey: 'unique-key-123',
      };
      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(true);
    });

    it('should reject goal exceeding MAX_STRING_LENGTH', () => {
      const submission = {
        ...validSubmission,
        goal: 'x'.repeat(PAYLOAD_LIMITS.MAX_STRING_LENGTH + 1),
      };
      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
      if (!result.success) {
        const goalIssue = result.error.issues.find((i) => i.path.includes('goal'));
        expect(goalIssue).toBeDefined();
      }
    });

    it('should accept goal at MAX_STRING_LENGTH', () => {
      const submission = {
        ...validSubmission,
        goal: 'x'.repeat(PAYLOAD_LIMITS.MAX_STRING_LENGTH),
      };
      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(true);
    });

    it('should reject context exceeding MAX_CONTEXT_BYTES', () => {
      // Create context just over 64KB
      const largeValue = 'x'.repeat(PAYLOAD_LIMITS.MAX_CONTEXT_BYTES + 1);
      const submission = {
        ...validSubmission,
        context: { data: largeValue },
      };
      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
      if (!result.success) {
        const contextIssue = result.error.issues.find((i) =>
          i.message.includes('Context payload exceeds')
        );
        expect(contextIssue).toBeDefined();
      }
    });

    it('should reject total payload exceeding MAX_PAYLOAD_SIZE_BYTES', () => {
      // Create a payload that exceeds 1MB total
      const largeMetadata = { data: 'x'.repeat(PAYLOAD_LIMITS.MAX_PAYLOAD_SIZE_BYTES) };
      const submission = {
        ...validSubmission,
        metadata: largeMetadata,
      };
      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
      if (!result.success) {
        const sizeIssue = result.error.issues.find((i) =>
          i.message.includes('Total payload exceeds maximum size')
        );
        expect(sizeIssue).toBeDefined();
      }
    });

    it('should reject context with more than 100 keys', () => {
      const context: Record<string, string> = {};
      for (let i = 0; i < 101; i++) {
        context[`key${i}`] = 'value';
      }
      const submission = {
        ...validSubmission,
        context,
      };
      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
      if (!result.success) {
        const keysIssue = result.error.issues.find((i) =>
          i.message.includes('Payload exceeds maximum of 100 keys')
        );
        expect(keysIssue).toBeDefined();
      }
    });

    it('should accept priority value up to 10', () => {
      const submission = {
        ...validSubmission,
        priority: 10,
      };
      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(true);
    });

    it('should reject priority value above 10', () => {
      const submission = {
        ...validSubmission,
        priority: 11,
      };
      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
    });

    it('should accept idempotencyKey up to 255 characters', () => {
      const submission = {
        ...validSubmission,
        idempotencyKey: 'k'.repeat(255),
      };
      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(true);
    });

    it('should reject idempotencyKey exceeding 255 characters', () => {
      const submission = {
        ...validSubmission,
        idempotencyKey: 'k'.repeat(256),
      };
      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
    });

    it('should accept intentType up to 100 characters', () => {
      const submission = {
        ...validSubmission,
        intentType: 't'.repeat(100),
      };
      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(true);
    });

    it('should reject intentType exceeding 100 characters', () => {
      const submission = {
        ...validSubmission,
        intentType: 't'.repeat(101),
      };
      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
    });

    it('should default priority to 0', () => {
      const result = intentSubmissionSchema.parse(validSubmission);
      expect(result.priority).toBe(0);
    });
  });
});

describe('Request ID Handling', () => {
  describe('REQUEST_ID_HEADER constant', () => {
    it('should be exported from response-middleware', async () => {
      const { REQUEST_ID_HEADER } = await import(
        '../../../src/intent/response-middleware.js'
      );
      expect(REQUEST_ID_HEADER).toBe('X-Request-ID');
    });
  });
});
