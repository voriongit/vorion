import { describe, it, expect } from 'vitest';
import {
  createSuccessResponse,
  createErrorResponse,
  isErrorResponse,
  type VorionResponse,
  type VorionErrorResponse,
} from '../../../src/common/contracts/output.js';

describe('Output Contracts', () => {
  describe('createSuccessResponse', () => {
    it('should create a valid success response', () => {
      const response = createSuccessResponse({ id: '123' }, 'req-001');

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: '123' });
      expect(response.meta.requestId).toBe('req-001');
      expect(response.meta.timestamp).toBeDefined();
    });

    it('should include optional trace', () => {
      const trace = { traceId: 'trace-001', intent: 'EVALUATE' };
      const response = createSuccessResponse({ id: '123' }, 'req-001', { trace });

      expect(response.trace).toEqual(trace);
    });

    it('should include optional evidence', () => {
      const evidence = [{ type: 'input' as const, pointer: '/data', summary: 'User input' }];
      const response = createSuccessResponse({ id: '123' }, 'req-001', { evidence });

      expect(response.evidence).toEqual(evidence);
    });

    it('should include pagination meta', () => {
      const pagination = { hasMore: true, cursor: 'abc123', count: 50 };
      const response = createSuccessResponse([1, 2, 3], 'req-001', { pagination });

      expect(response.meta.pagination).toEqual(pagination);
    });
  });

  describe('createErrorResponse', () => {
    it('should create a valid error response', () => {
      const response = createErrorResponse('VALIDATION_ERROR', 'Invalid input', 'req-002');

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.message).toBe('Invalid input');
      expect(response.meta.requestId).toBe('req-002');
    });

    it('should include optional details', () => {
      const response = createErrorResponse('VALIDATION_ERROR', 'Invalid', 'req-002', {
        details: { field: 'email', issue: 'format' },
      });

      expect(response.error.details).toEqual({ field: 'email', issue: 'format' });
    });

    it('should include retryAfter for rate limits', () => {
      const response = createErrorResponse('RATE_LIMIT', 'Too many requests', 'req-002', {
        retryAfter: 60,
      });

      expect(response.error.retryAfter).toBe(60);
    });
  });

  describe('isErrorResponse', () => {
    it('should return true for error responses', () => {
      const error = createErrorResponse('ERROR', 'message', 'req');
      expect(isErrorResponse(error)).toBe(true);
    });

    it('should return false for success responses', () => {
      const success = createSuccessResponse({}, 'req');
      expect(isErrorResponse(success)).toBe(false);
    });
  });

  describe('Type guards', () => {
    it('VorionResponse should have required fields', () => {
      const response: VorionResponse<{ id: string }> = {
        success: true,
        data: { id: '123' },
        meta: { requestId: 'req', timestamp: '2024-01-01T00:00:00Z' },
      };
      expect(response.success).toBe(true);
    });

    it('VorionErrorResponse should have required fields', () => {
      const response: VorionErrorResponse = {
        success: false,
        error: { code: 'ERR', message: 'msg' },
        meta: { requestId: 'req', timestamp: '2024-01-01T00:00:00Z' },
      };
      expect(response.success).toBe(false);
    });
  });
});
