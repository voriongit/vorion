/**
 * Intent Tracing Tests
 *
 * Tests for the new trace spans added to the intent processing pipeline.
 * These tests verify that spans are created with correct attributes for:
 * - Deduplication checks
 * - Lock acquisition
 * - Encryption/decryption operations
 * - Policy evaluation
 * - Webhook delivery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trace, SpanKind, SpanStatusCode, type Span, type Tracer } from '@opentelemetry/api';

// Mock OpenTelemetry
const mockSpan = {
  setAttribute: vi.fn(),
  setAttributes: vi.fn(),
  setStatus: vi.fn(),
  recordException: vi.fn(),
  end: vi.fn(),
  addEvent: vi.fn(),
};

const mockTracer = {
  startActiveSpan: vi.fn((name, options, fn) => {
    // Support both sync and async callbacks
    const result = fn(mockSpan);
    if (result instanceof Promise) {
      return result;
    }
    return result;
  }),
};

vi.mock('@opentelemetry/api', async () => {
  const actual = await vi.importActual('@opentelemetry/api');
  return {
    ...actual,
    trace: {
      getTracer: vi.fn(() => mockTracer),
    },
  };
});

// Import after mocking
import {
  traceDedupeCheck,
  traceLockAcquire,
  traceEncrypt,
  traceEncryptSync,
  traceDecrypt,
  traceDecryptSync,
  tracePolicyEvaluate,
  traceWebhookDeliver,
  recordDedupeResult,
  recordLockResult,
  recordPolicyEvaluationResult,
  recordWebhookResult,
  AdditionalAttributes,
  IntentAttributes,
} from '../../../src/intent/tracing.js';

describe('Intent Tracing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('traceDedupeCheck', () => {
    it('should create a span with correct attributes', async () => {
      const result = await traceDedupeCheck(
        'tenant-123',
        'entity-456',
        'hash-789',
        async (span) => {
          return 'test-result';
        }
      );

      expect(result).toBe('test-result');
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'intent.dedupe.check',
        expect.objectContaining({
          kind: SpanKind.INTERNAL,
          attributes: {
            [IntentAttributes.TENANT_ID]: 'tenant-123',
            [IntentAttributes.ENTITY_ID]: 'entity-456',
            [AdditionalAttributes.DEDUPE_HASH]: 'hash-789',
          },
        }),
        expect.any(Function)
      );
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should record error status on exception', async () => {
      const error = new Error('Dedupe check failed');

      await expect(
        traceDedupeCheck('tenant-123', 'entity-456', 'hash-789', async () => {
          throw error;
        })
      ).rejects.toThrow('Dedupe check failed');

      expect(mockSpan.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          code: SpanStatusCode.ERROR,
          message: 'Dedupe check failed',
        })
      );
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe('recordDedupeResult', () => {
    it('should set dedupe.found attribute to true when found', () => {
      recordDedupeResult(mockSpan as unknown as Span, true);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        AdditionalAttributes.DEDUPE_FOUND,
        true
      );
    });

    it('should set dedupe.found attribute to false when not found', () => {
      recordDedupeResult(mockSpan as unknown as Span, false);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        AdditionalAttributes.DEDUPE_FOUND,
        false
      );
    });
  });

  describe('traceLockAcquire', () => {
    it('should create a span with correct attributes', async () => {
      const result = await traceLockAcquire(
        'tenant-123',
        'lock:intent:dedupe:tenant-123:hash',
        async (span) => {
          return { acquired: true };
        }
      );

      expect(result).toEqual({ acquired: true });
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'intent.lock.acquire',
        expect.objectContaining({
          kind: SpanKind.INTERNAL,
          attributes: {
            [IntentAttributes.TENANT_ID]: 'tenant-123',
            [AdditionalAttributes.LOCK_KEY]: 'lock:intent:dedupe:tenant-123:hash',
          },
        }),
        expect.any(Function)
      );
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should record error status on exception', async () => {
      const error = new Error('Lock acquisition timeout');

      await expect(
        traceLockAcquire('tenant-123', 'lock-key', async () => {
          throw error;
        })
      ).rejects.toThrow('Lock acquisition timeout');

      expect(mockSpan.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          code: SpanStatusCode.ERROR,
          message: 'Lock acquisition timeout',
        })
      );
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
    });
  });

  describe('recordLockResult', () => {
    it('should set lock.acquired and lock.timeout_ms attributes', () => {
      recordLockResult(mockSpan as unknown as Span, true, 5000);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        AdditionalAttributes.LOCK_ACQUIRED,
        true
      );
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        AdditionalAttributes.LOCK_TIMEOUT_MS,
        5000
      );
    });

    it('should only set lock.acquired when timeout is not provided', () => {
      vi.clearAllMocks();
      recordLockResult(mockSpan as unknown as Span, false);
      expect(mockSpan.setAttribute).toHaveBeenCalledTimes(1);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        AdditionalAttributes.LOCK_ACQUIRED,
        false
      );
    });
  });

  describe('traceEncryptSync', () => {
    it('should create a span with correct attributes for sync encryption', () => {
      const result = traceEncryptSync(1024, (span) => {
        return { encrypted: 'data' };
      });

      expect(result).toEqual({ encrypted: 'data' });
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'intent.encrypt',
        expect.objectContaining({
          kind: SpanKind.INTERNAL,
          attributes: {
            [AdditionalAttributes.CRYPTO_OPERATION]: 'encrypt',
            [AdditionalAttributes.CRYPTO_SIZE_BYTES]: 1024,
          },
        }),
        expect.any(Function)
      );
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        AdditionalAttributes.CRYPTO_SUCCESS,
        true
      );
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should record crypto.success=false on error', () => {
      expect(() =>
        traceEncryptSync(1024, () => {
          throw new Error('Encryption failed');
        })
      ).toThrow('Encryption failed');

      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        AdditionalAttributes.CRYPTO_SUCCESS,
        false
      );
      expect(mockSpan.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          code: SpanStatusCode.ERROR,
        })
      );
    });
  });

  describe('traceDecryptSync', () => {
    it('should create a span with correct attributes for sync decryption', () => {
      const result = traceDecryptSync(2048, (span) => {
        return { decrypted: 'data' };
      });

      expect(result).toEqual({ decrypted: 'data' });
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'intent.decrypt',
        expect.objectContaining({
          kind: SpanKind.INTERNAL,
          attributes: {
            [AdditionalAttributes.CRYPTO_OPERATION]: 'decrypt',
            [AdditionalAttributes.CRYPTO_SIZE_BYTES]: 2048,
          },
        }),
        expect.any(Function)
      );
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        AdditionalAttributes.CRYPTO_SUCCESS,
        true
      );
    });

    it('should record crypto.success=false on error', () => {
      expect(() =>
        traceDecryptSync(2048, () => {
          throw new Error('Decryption failed');
        })
      ).toThrow('Decryption failed');

      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        AdditionalAttributes.CRYPTO_SUCCESS,
        false
      );
    });
  });

  describe('traceEncrypt (async)', () => {
    it('should create a span with correct attributes for async encryption', async () => {
      const result = await traceEncrypt(4096, async (span) => {
        return { encrypted: 'async-data' };
      });

      expect(result).toEqual({ encrypted: 'async-data' });
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'intent.encrypt',
        expect.objectContaining({
          kind: SpanKind.INTERNAL,
          attributes: {
            [AdditionalAttributes.CRYPTO_OPERATION]: 'encrypt',
            [AdditionalAttributes.CRYPTO_SIZE_BYTES]: 4096,
          },
        }),
        expect.any(Function)
      );
    });
  });

  describe('traceDecrypt (async)', () => {
    it('should create a span with correct attributes for async decryption', async () => {
      const result = await traceDecrypt(8192, async (span) => {
        return { decrypted: 'async-data' };
      });

      expect(result).toEqual({ decrypted: 'async-data' });
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'intent.decrypt',
        expect.objectContaining({
          kind: SpanKind.INTERNAL,
          attributes: {
            [AdditionalAttributes.CRYPTO_OPERATION]: 'decrypt',
            [AdditionalAttributes.CRYPTO_SIZE_BYTES]: 8192,
          },
        }),
        expect.any(Function)
      );
    });
  });

  describe('tracePolicyEvaluate', () => {
    it('should create a span with correct attributes', async () => {
      const result = await tracePolicyEvaluate(
        'intent-123',
        'tenant-456',
        'production',
        async (span) => {
          return { finalAction: 'allow' };
        }
      );

      expect(result).toEqual({ finalAction: 'allow' });
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'policy.evaluate',
        expect.objectContaining({
          kind: SpanKind.INTERNAL,
          attributes: {
            [IntentAttributes.INTENT_ID]: 'intent-123',
            [IntentAttributes.TENANT_ID]: 'tenant-456',
            [AdditionalAttributes.POLICY_NAMESPACE]: 'production',
          },
        }),
        expect.any(Function)
      );
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should record error status when policy evaluation fails', async () => {
      const error = new Error('Policy engine unavailable');

      await expect(
        tracePolicyEvaluate('intent-123', 'tenant-456', 'production', async () => {
          throw error;
        })
      ).rejects.toThrow('Policy engine unavailable');

      expect(mockSpan.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          code: SpanStatusCode.ERROR,
          message: 'Policy engine unavailable',
        })
      );
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
    });
  });

  describe('recordPolicyEvaluationResult', () => {
    it('should set all policy evaluation attributes', () => {
      recordPolicyEvaluationResult(mockSpan as unknown as Span, 5, 3, 'allow');
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        [AdditionalAttributes.POLICY_COUNT]: 5,
        [AdditionalAttributes.POLICY_MATCHED_COUNT]: 3,
        [AdditionalAttributes.POLICY_FINAL_ACTION]: 'allow',
      });
    });
  });

  describe('traceWebhookDeliver', () => {
    it('should create a span with correct attributes and redacted URL', async () => {
      const result = await traceWebhookDeliver(
        'webhook-123',
        'https://example.com/webhooks/intent?token=secret',
        'intent.approved',
        async (span) => {
          return { success: true, statusCode: 200 };
        }
      );

      expect(result).toEqual({ success: true, statusCode: 200 });
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'webhook.deliver',
        expect.objectContaining({
          kind: SpanKind.CLIENT,
          attributes: {
            [AdditionalAttributes.WEBHOOK_ID]: 'webhook-123',
            [AdditionalAttributes.WEBHOOK_URL_REDACTED]: 'https://example.com/***',
            [AdditionalAttributes.WEBHOOK_EVENT_TYPE]: 'intent.approved',
          },
        }),
        expect.any(Function)
      );
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should handle invalid URL gracefully', async () => {
      await traceWebhookDeliver(
        'webhook-123',
        'not-a-valid-url',
        'intent.approved',
        async (span) => {
          return { success: false };
        }
      );

      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'webhook.deliver',
        expect.objectContaining({
          attributes: expect.objectContaining({
            [AdditionalAttributes.WEBHOOK_URL_REDACTED]: '[invalid-url]',
          }),
        }),
        expect.any(Function)
      );
    });

    it('should record error status on delivery failure', async () => {
      const error = new Error('Connection refused');

      await expect(
        traceWebhookDeliver('webhook-123', 'https://example.com/webhook', 'intent.approved', async () => {
          throw error;
        })
      ).rejects.toThrow('Connection refused');

      expect(mockSpan.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          code: SpanStatusCode.ERROR,
          message: 'Connection refused',
        })
      );
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
    });
  });

  describe('recordWebhookResult', () => {
    it('should set webhook.success and webhook.status_code attributes', () => {
      recordWebhookResult(mockSpan as unknown as Span, true, 200);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        AdditionalAttributes.WEBHOOK_SUCCESS,
        true
      );
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        AdditionalAttributes.WEBHOOK_STATUS_CODE,
        200
      );
    });

    it('should only set webhook.success when status code is not provided', () => {
      vi.clearAllMocks();
      recordWebhookResult(mockSpan as unknown as Span, false);
      expect(mockSpan.setAttribute).toHaveBeenCalledTimes(1);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        AdditionalAttributes.WEBHOOK_SUCCESS,
        false
      );
    });
  });

  describe('AdditionalAttributes', () => {
    it('should have all required attribute constants', () => {
      // Deduplication attributes
      expect(AdditionalAttributes.DEDUPE_HASH).toBe('dedupe.hash');
      expect(AdditionalAttributes.DEDUPE_FOUND).toBe('dedupe.found');

      // Lock attributes
      expect(AdditionalAttributes.LOCK_KEY).toBe('lock.key');
      expect(AdditionalAttributes.LOCK_ACQUIRED).toBe('lock.acquired');
      expect(AdditionalAttributes.LOCK_TIMEOUT_MS).toBe('lock.timeout_ms');

      // Crypto attributes
      expect(AdditionalAttributes.CRYPTO_OPERATION).toBe('crypto.operation');
      expect(AdditionalAttributes.CRYPTO_SIZE_BYTES).toBe('crypto.size_bytes');
      expect(AdditionalAttributes.CRYPTO_SUCCESS).toBe('crypto.success');

      // Policy attributes
      expect(AdditionalAttributes.POLICY_COUNT).toBe('policy.count');
      expect(AdditionalAttributes.POLICY_MATCHED_COUNT).toBe('policy.matched_count');
      expect(AdditionalAttributes.POLICY_NAMESPACE).toBe('policy.namespace');
      expect(AdditionalAttributes.POLICY_FINAL_ACTION).toBe('policy.final_action');

      // Webhook attributes
      expect(AdditionalAttributes.WEBHOOK_ID).toBe('webhook.id');
      expect(AdditionalAttributes.WEBHOOK_URL_REDACTED).toBe('webhook.url_redacted');
      expect(AdditionalAttributes.WEBHOOK_STATUS_CODE).toBe('webhook.status_code');
      expect(AdditionalAttributes.WEBHOOK_SUCCESS).toBe('webhook.success');
      expect(AdditionalAttributes.WEBHOOK_EVENT_TYPE).toBe('webhook.event_type');
    });
  });
});
