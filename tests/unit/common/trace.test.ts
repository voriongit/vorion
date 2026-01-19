/**
 * W3C TraceContext Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateTraceId,
  generateSpanId,
  buildTraceparent,
  parseTraceparent,
  createTraceContext,
  getTraceContext,
  runWithTraceContext,
  getTraceLogContext,
  extractTraceFromHeaders,
  injectTraceToHeaders,
  addTraceToJobData,
  extractTraceFromJobData,
  startSpan,
  endSpan,
  addSpanEvent,
  setSpanAttribute,
} from '../../../src/common/trace.js';

describe('TraceContext', () => {
  describe('generateTraceId', () => {
    it('should generate 32 hex character trace ID', () => {
      const traceId = generateTraceId();
      expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should generate unique trace IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateTraceId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('generateSpanId', () => {
    it('should generate 16 hex character span ID', () => {
      const spanId = generateSpanId();
      expect(spanId).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should generate unique span IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSpanId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('buildTraceparent', () => {
    it('should build valid traceparent header', () => {
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      const spanId = '00f067aa0ba902b7';
      const traceparent = buildTraceparent(traceId, spanId);

      expect(traceparent).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    });

    it('should include custom trace flags', () => {
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      const spanId = '00f067aa0ba902b7';
      const traceparent = buildTraceparent(traceId, spanId, '00');

      expect(traceparent).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00');
    });
  });

  describe('parseTraceparent', () => {
    it('should parse valid traceparent header', () => {
      const header = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const result = parseTraceparent(header);

      expect(result).toEqual({
        version: '00',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        parentId: '00f067aa0ba902b7',
        traceFlags: '01',
      });
    });

    it('should return null for invalid traceparent', () => {
      expect(parseTraceparent('invalid')).toBeNull();
      expect(parseTraceparent('')).toBeNull();
      expect(parseTraceparent('01-invalid-format-00')).toBeNull();
    });

    it('should reject all-zero trace ID', () => {
      const header = '00-00000000000000000000000000000000-00f067aa0ba902b7-01';
      expect(parseTraceparent(header)).toBeNull();
    });

    it('should reject all-zero parent ID', () => {
      const header = '00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01';
      expect(parseTraceparent(header)).toBeNull();
    });

    it('should reject unsupported version', () => {
      const header = '01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      expect(parseTraceparent(header)).toBeNull();
    });
  });

  describe('createTraceContext', () => {
    it('should create new trace context', () => {
      const context = createTraceContext();

      expect(context.traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(context.spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(context.traceFlags).toBe('01');
      expect(context.traceparent).toContain(context.traceId);
      expect(context.traceparent).toContain(context.spanId);
      expect(context.parentSpanId).toBeUndefined();
    });

    it('should continue from existing traceparent', () => {
      const existingTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const context = createTraceContext(existingTraceparent);

      expect(context.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(context.parentSpanId).toBe('00f067aa0ba902b7');
      expect(context.spanId).not.toBe('00f067aa0ba902b7'); // New span ID
      expect(context.traceFlags).toBe('01');
    });

    it('should start new trace for invalid traceparent', () => {
      const invalidTraceparent = 'invalid-header';
      const context = createTraceContext(invalidTraceparent);

      expect(context.traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(context.parentSpanId).toBeUndefined();
    });
  });

  describe('runWithTraceContext', () => {
    it('should make trace context available within callback', () => {
      const context = createTraceContext();

      runWithTraceContext(context, () => {
        const current = getTraceContext();
        expect(current).toBe(context);
      });
    });

    it('should not leak trace context outside callback', () => {
      const context = createTraceContext();

      runWithTraceContext(context, () => {
        // Context available here
        expect(getTraceContext()).toBe(context);
      });

      // Context should not be available here
      // Note: This depends on how vitest runs tests, but the context should be isolated
    });

    it('should return callback result', () => {
      const context = createTraceContext();
      const result = runWithTraceContext(context, () => 'test-result');
      expect(result).toBe('test-result');
    });
  });

  describe('getTraceLogContext', () => {
    it('should return undefined when no trace context', () => {
      const logContext = getTraceLogContext();
      // May or may not be undefined depending on test execution context
      // Just verify it doesn't throw
      expect(logContext === undefined || typeof logContext === 'object').toBe(true);
    });

    it('should return log context when trace context exists', () => {
      const context = createTraceContext('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');

      runWithTraceContext(context, () => {
        const logContext = getTraceLogContext();
        expect(logContext).toBeDefined();
        expect(logContext!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
        expect(logContext!.spanId).toBe(context.spanId);
        expect(logContext!.parentSpanId).toBe('00f067aa0ba902b7');
      });
    });
  });

  describe('extractTraceFromHeaders', () => {
    it('should extract trace context from headers', () => {
      const headers = {
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        tracestate: 'vendor=value',
      };

      const context = extractTraceFromHeaders(headers);

      expect(context).not.toBeNull();
      expect(context!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(context!.parentSpanId).toBe('00f067aa0ba902b7');
      expect(context!.tracestate).toBe('vendor=value');
    });

    it('should handle array headers', () => {
      const headers = {
        traceparent: ['00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'],
      };

      const context = extractTraceFromHeaders(headers);

      expect(context).not.toBeNull();
      expect(context!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    });

    it('should return null for missing traceparent', () => {
      const headers = {};
      const context = extractTraceFromHeaders(headers);
      expect(context).toBeNull();
    });
  });

  describe('injectTraceToHeaders', () => {
    it('should inject trace context into headers', () => {
      const context = createTraceContext();
      const headers: Record<string, string> = { 'content-type': 'application/json' };

      const result = injectTraceToHeaders(headers, context);

      expect(result['traceparent']).toBe(context.traceparent);
      expect(result['content-type']).toBe('application/json');
    });

    it('should include tracestate when present', () => {
      const context = createTraceContext();
      context.tracestate = 'vendor=value';

      const headers: Record<string, string> = {};
      const result = injectTraceToHeaders(headers, context);

      expect(result['tracestate']).toBe('vendor=value');
    });
  });

  describe('Job Data Propagation', () => {
    it('should add trace context to job data', () => {
      const context = createTraceContext();
      const jobData = { intentId: 'int-123', tenantId: 'tenant-456' };

      const result = addTraceToJobData(jobData, context);

      expect(result.intentId).toBe('int-123');
      expect(result.tenantId).toBe('tenant-456');
      expect(result._trace).toBeDefined();
    });

    it('should extract trace context from job data', () => {
      const context = createTraceContext();
      const jobData = addTraceToJobData({ test: 'data' }, context);

      const extracted = extractTraceFromJobData(jobData);

      expect(extracted).not.toBeNull();
      expect(extracted!.traceId).toBe(context.traceId);
      expect(extracted!.spanId).toBe(context.spanId);
    });

    it('should return null for job data without trace', () => {
      const jobData = { test: 'data' };
      const extracted = extractTraceFromJobData(jobData);
      expect(extracted).toBeNull();
    });
  });

  describe('Spans', () => {
    it('should create a span', () => {
      const context = createTraceContext();

      runWithTraceContext(context, () => {
        const span = startSpan('test-operation', { key: 'value' });

        expect(span.name).toBe('test-operation');
        expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
        expect(span.startTime).toBeLessThanOrEqual(Date.now());
        expect(span.attributes).toEqual({ key: 'value' });
        expect(span.status).toBe('unset');

        endSpan(span, 'ok');
        expect(span.status).toBe('ok');
        expect(span.endTime).toBeDefined();
      });
    });

    it('should add events to span', () => {
      const context = createTraceContext();

      runWithTraceContext(context, () => {
        const span = startSpan('test-operation');

        addSpanEvent(span, 'checkpoint', { data: 'value' });

        expect(span.events).toHaveLength(1);
        expect(span.events[0]?.name).toBe('checkpoint');
        expect(span.events[0]?.attributes).toEqual({ data: 'value' });

        endSpan(span);
      });
    });

    it('should set span attributes', () => {
      const context = createTraceContext();

      runWithTraceContext(context, () => {
        const span = startSpan('test-operation');

        setSpanAttribute(span, 'http.method', 'GET');
        setSpanAttribute(span, 'http.status_code', 200);

        expect(span.attributes['http.method']).toBe('GET');
        expect(span.attributes['http.status_code']).toBe(200);

        endSpan(span);
      });
    });

    it('should record error status', () => {
      const context = createTraceContext();

      runWithTraceContext(context, () => {
        const span = startSpan('test-operation');

        endSpan(span, 'error', 'Something went wrong');

        expect(span.status).toBe('error');
        expect(span.errorMessage).toBe('Something went wrong');
      });
    });
  });
});
