/**
 * Tests for Standardized API Response Envelope
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  cursorPaginatedResponse,
  createdResponse,
  acceptedResponse,
  errorResponseFromVorionError,
  errorResponseFromError,
  getHttpStatusFromError,
  getHttpStatusFromCode,
  isSuccessResponse,
  isErrorResponse,
  HttpStatus,
  type ApiResponse,
} from '../../../src/intent/response.js';
import {
  VorionError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  TimeoutError,
} from '../../../src/common/errors.js';

// Mock dependencies
vi.mock('../../../src/common/trace.js', () => ({
  getTraceContext: vi.fn(() => ({ traceId: 'mock-trace-id-123' })),
}));

vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => ({
    env: 'development',
  })),
}));

describe('API Response Envelope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successResponse', () => {
    it('should create a basic success response', () => {
      const data = { id: '123', name: 'Test' };
      const response = successResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.error).toBeUndefined();
      expect(response.meta).toBeDefined();
      expect(response.meta?.requestId).toBeDefined();
      expect(response.meta?.timestamp).toBeDefined();
    });

    it('should include custom request ID', () => {
      const data = { id: '123' };
      const response = successResponse(data, { requestId: 'custom-req-id' });

      expect(response.meta?.requestId).toBe('custom-req-id');
    });

    it('should handle null data', () => {
      const response = successResponse(null);

      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
    });

    it('should handle array data', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const response = successResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
    });

    it('should handle primitive data', () => {
      const response = successResponse(42);

      expect(response.success).toBe(true);
      expect(response.data).toBe(42);
    });
  });

  describe('errorResponse', () => {
    it('should create a basic error response', () => {
      const response = errorResponse('TEST_ERROR', 'Test error message');

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('TEST_ERROR');
      expect(response.error?.message).toBe('Test error message');
      expect(response.error?.traceId).toBe('mock-trace-id-123');
      expect(response.data).toBeUndefined();
    });

    it('should include error details in development', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const response = errorResponse('VALIDATION_ERROR', 'Invalid input', details);

      expect(response.error?.details).toEqual(details);
    });

    it('should include custom request ID', () => {
      const response = errorResponse('ERROR', 'Message', undefined, 'req-123');

      expect(response.meta?.requestId).toBe('req-123');
    });
  });

  describe('paginatedResponse', () => {
    it('should create paginated response with correct pagination info', () => {
      const items = [{ id: '1' }, { id: '2' }];
      const response = paginatedResponse(items, {
        page: 1,
        pageSize: 10,
        totalItems: 25,
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(items);
      expect(response.meta?.pagination).toBeDefined();
      expect(response.meta?.pagination?.page).toBe(1);
      expect(response.meta?.pagination?.pageSize).toBe(10);
      expect(response.meta?.pagination?.totalItems).toBe(25);
      expect(response.meta?.pagination?.totalPages).toBe(3);
    });

    it('should calculate total pages correctly', () => {
      const items: unknown[] = [];
      const response = paginatedResponse(items, {
        page: 1,
        pageSize: 10,
        totalItems: 0,
      });

      expect(response.meta?.pagination?.totalPages).toBe(0);
    });

    it('should handle partial last page', () => {
      const items = [{ id: '1' }];
      const response = paginatedResponse(items, {
        page: 3,
        pageSize: 10,
        totalItems: 21,
      });

      expect(response.meta?.pagination?.totalPages).toBe(3);
    });
  });

  describe('cursorPaginatedResponse', () => {
    it('should create cursor-paginated response', () => {
      const items = [{ id: '1' }, { id: '2' }];
      const response = cursorPaginatedResponse(items, {
        nextCursor: 'cursor-abc',
        hasMore: true,
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(items);
      expect(response.meta?.cursor).toBeDefined();
      expect(response.meta?.cursor?.nextCursor).toBe('cursor-abc');
      expect(response.meta?.cursor?.hasMore).toBe(true);
      expect(response.meta?.cursor?.count).toBe(2);
    });

    it('should handle no more results', () => {
      const items = [{ id: '1' }];
      const response = cursorPaginatedResponse(items, {
        hasMore: false,
      });

      expect(response.meta?.cursor?.hasMore).toBe(false);
      expect(response.meta?.cursor?.nextCursor).toBeUndefined();
    });

    it('should include both cursors when available', () => {
      const items = [{ id: '1' }];
      const response = cursorPaginatedResponse(items, {
        nextCursor: 'next-123',
        prevCursor: 'prev-456',
        hasMore: true,
      });

      expect(response.meta?.cursor?.nextCursor).toBe('next-123');
      expect(response.meta?.cursor?.prevCursor).toBe('prev-456');
    });
  });

  describe('createdResponse', () => {
    it('should create a response for created resources', () => {
      const data = { id: 'new-123', name: 'New Resource' };
      const response = createdResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
    });
  });

  describe('acceptedResponse', () => {
    it('should create a response for accepted async operations', () => {
      const data = { jobId: 'job-123' };
      const response = acceptedResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
    });

    it('should work without data', () => {
      const response = acceptedResponse();

      expect(response.success).toBe(true);
      expect(response.data).toBeUndefined();
    });
  });

  describe('getHttpStatusFromError', () => {
    it('should return correct status for ValidationError', () => {
      const error = new ValidationError('Invalid input');
      expect(getHttpStatusFromError(error)).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should return correct status for NotFoundError', () => {
      const error = new NotFoundError('Resource not found');
      expect(getHttpStatusFromError(error)).toBe(HttpStatus.NOT_FOUND);
    });

    it('should return correct status for UnauthorizedError', () => {
      const error = new UnauthorizedError('Not authenticated');
      expect(getHttpStatusFromError(error)).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should return correct status for ForbiddenError', () => {
      const error = new ForbiddenError('Access denied');
      expect(getHttpStatusFromError(error)).toBe(HttpStatus.FORBIDDEN);
    });

    it('should return correct status for ConflictError', () => {
      const error = new ConflictError('Resource conflict');
      expect(getHttpStatusFromError(error)).toBe(HttpStatus.CONFLICT);
    });

    it('should return correct status for RateLimitError', () => {
      const error = new RateLimitError('Too many requests');
      expect(getHttpStatusFromError(error)).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('should return correct status for DatabaseError', () => {
      const error = new DatabaseError('Database failed');
      expect(getHttpStatusFromError(error)).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should return correct status for ExternalServiceError', () => {
      const error = new ExternalServiceError('Service unavailable');
      expect(getHttpStatusFromError(error)).toBe(HttpStatus.BAD_GATEWAY);
    });

    it('should return correct status for TimeoutError', () => {
      const error = new TimeoutError('Request timed out');
      expect(getHttpStatusFromError(error)).toBe(HttpStatus.GATEWAY_TIMEOUT);
    });

    it('should return 500 for generic VorionError', () => {
      const error = new VorionError('Generic error');
      expect(getHttpStatusFromError(error)).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('getHttpStatusFromCode', () => {
    it('should map validation error codes to 400', () => {
      expect(getHttpStatusFromCode('VALIDATION_ERROR')).toBe(HttpStatus.BAD_REQUEST);
      expect(getHttpStatusFromCode('INVALID_INPUT')).toBe(HttpStatus.BAD_REQUEST);
      expect(getHttpStatusFromCode('INVALID_STATE')).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should map auth error codes to 401', () => {
      expect(getHttpStatusFromCode('UNAUTHORIZED')).toBe(HttpStatus.UNAUTHORIZED);
      expect(getHttpStatusFromCode('TOKEN_INVALID')).toBe(HttpStatus.UNAUTHORIZED);
      expect(getHttpStatusFromCode('TOKEN_REVOKED')).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should map forbidden error codes to 403', () => {
      expect(getHttpStatusFromCode('FORBIDDEN')).toBe(HttpStatus.FORBIDDEN);
      expect(getHttpStatusFromCode('TRUST_INSUFFICIENT')).toBe(HttpStatus.FORBIDDEN);
    });

    it('should map not found error codes to 404', () => {
      expect(getHttpStatusFromCode('NOT_FOUND')).toBe(HttpStatus.NOT_FOUND);
      expect(getHttpStatusFromCode('INTENT_NOT_FOUND')).toBe(HttpStatus.NOT_FOUND);
      expect(getHttpStatusFromCode('ESCALATION_NOT_FOUND')).toBe(HttpStatus.NOT_FOUND);
    });

    it('should map conflict error codes to 409', () => {
      expect(getHttpStatusFromCode('CONFLICT')).toBe(HttpStatus.CONFLICT);
      expect(getHttpStatusFromCode('INTENT_LOCKED')).toBe(HttpStatus.CONFLICT);
    });

    it('should map rate limit error codes to 429', () => {
      expect(getHttpStatusFromCode('RATE_LIMIT_EXCEEDED')).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(getHttpStatusFromCode('INTENT_RATE_LIMIT')).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('should return 500 for unknown codes', () => {
      expect(getHttpStatusFromCode('UNKNOWN_ERROR')).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('errorResponseFromVorionError', () => {
    it('should create error response from VorionError', () => {
      const error = new ValidationError('Invalid email format', { field: 'email' });
      const response = errorResponseFromVorionError(error);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('VALIDATION_ERROR');
      expect(response.error?.message).toBe('Invalid email format');
      expect(response.error?.traceId).toBe('mock-trace-id-123');
    });

    it('should include custom request ID', () => {
      const error = new NotFoundError('Not found');
      const response = errorResponseFromVorionError(error, 'req-abc');

      expect(response.meta?.requestId).toBe('req-abc');
    });
  });

  describe('errorResponseFromError', () => {
    it('should handle VorionError', () => {
      const error = new NotFoundError('Resource not found');
      const result = errorResponseFromError(error);

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('NOT_FOUND');
      expect(result.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('should handle standard Error', () => {
      const error = new Error('Something went wrong');
      const result = errorResponseFromError(error);

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('INTERNAL_ERROR');
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should handle non-Error objects', () => {
      const result = errorResponseFromError('string error');

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('INTERNAL_ERROR');
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should include custom request ID', () => {
      const error = new Error('Error');
      const result = errorResponseFromError(error, 'req-xyz');

      expect(result.response.meta?.requestId).toBe('req-xyz');
    });
  });

  describe('isSuccessResponse', () => {
    it('should return true for success responses', () => {
      const response = successResponse({ id: '123' });
      expect(isSuccessResponse(response)).toBe(true);
    });

    it('should return false for error responses', () => {
      const response = errorResponse('ERROR', 'Message');
      expect(isSuccessResponse(response)).toBe(false);
    });

    it('should return false for responses without data', () => {
      const response: ApiResponse<unknown> = {
        success: true,
        meta: { requestId: '123', timestamp: new Date().toISOString() },
      };
      expect(isSuccessResponse(response)).toBe(false);
    });
  });

  describe('isErrorResponse', () => {
    it('should return true for error responses', () => {
      const response = errorResponse('ERROR', 'Message');
      expect(isErrorResponse(response)).toBe(true);
    });

    it('should return false for success responses', () => {
      const response = successResponse({ id: '123' });
      expect(isErrorResponse(response)).toBe(false);
    });

    it('should return false for responses without error object', () => {
      const response: ApiResponse<unknown> = {
        success: false,
        meta: { requestId: '123', timestamp: new Date().toISOString() },
      };
      expect(isErrorResponse(response)).toBe(false);
    });
  });

  describe('HttpStatus constants', () => {
    it('should have correct success status codes', () => {
      expect(HttpStatus.OK).toBe(200);
      expect(HttpStatus.CREATED).toBe(201);
      expect(HttpStatus.ACCEPTED).toBe(202);
      expect(HttpStatus.NO_CONTENT).toBe(204);
    });

    it('should have correct client error status codes', () => {
      expect(HttpStatus.BAD_REQUEST).toBe(400);
      expect(HttpStatus.UNAUTHORIZED).toBe(401);
      expect(HttpStatus.FORBIDDEN).toBe(403);
      expect(HttpStatus.NOT_FOUND).toBe(404);
      expect(HttpStatus.CONFLICT).toBe(409);
      expect(HttpStatus.TOO_MANY_REQUESTS).toBe(429);
    });

    it('should have correct server error status codes', () => {
      expect(HttpStatus.INTERNAL_SERVER_ERROR).toBe(500);
      expect(HttpStatus.BAD_GATEWAY).toBe(502);
      expect(HttpStatus.SERVICE_UNAVAILABLE).toBe(503);
      expect(HttpStatus.GATEWAY_TIMEOUT).toBe(504);
    });
  });
});

describe('Production mode error handling', () => {
  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Override config mock for production mode
    const configModule = await import('../../../src/common/config.js');
    const { getConfig } = vi.mocked(configModule);
    getConfig.mockReturnValue({
      env: 'production',
    } as ReturnType<typeof getConfig>);
  });

  afterEach(async () => {
    // Restore development mode
    const configModule = await import('../../../src/common/config.js');
    const { getConfig } = vi.mocked(configModule);
    getConfig.mockReturnValue({
      env: 'development',
    } as ReturnType<typeof getConfig>);
  });

  it('should not include error details in production', async () => {
    // Re-import to get fresh instance with production config
    const { errorResponse: prodErrorResponse } = await import('../../../src/intent/response.js');

    const details = { sensitiveInfo: 'should not be exposed' };
    const response = prodErrorResponse('ERROR', 'Message', details);

    expect(response.error?.details).toBeUndefined();
  });
});
