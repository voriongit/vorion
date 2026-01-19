/**
 * Typed Error Classes Tests
 */

import { describe, it, expect } from 'vitest';
import {
  VorionError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  ConfigurationError,
  EncryptionError,
  EscalationError,
  DatabaseError,
  ExternalServiceError,
  TimeoutError,
  isVorionError,
  wrapError,
} from '../../../src/common/errors.js';

describe('VorionError', () => {
  describe('Base VorionError', () => {
    it('should create a basic error with default values', () => {
      const error = new VorionError('Something went wrong');

      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('VorionError');
      expect(error.code).toBe('VORION_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.details).toBeUndefined();
      expect(error.stack).toBeDefined();
    });

    it('should create an error with details', () => {
      const error = new VorionError('Something went wrong', {
        userId: 'user-123',
        operation: 'create',
      });

      expect(error.details).toEqual({
        userId: 'user-123',
        operation: 'create',
      });
    });

    it('should serialize to JSON correctly', () => {
      const error = new VorionError('Test error', { field: 'value' });
      const json = error.toJSON();

      expect(json).toEqual({
        code: 'VORION_ERROR',
        message: 'Test error',
        details: { field: 'value' },
      });
    });

    it('should serialize without details if not provided', () => {
      const error = new VorionError('Test error');
      const json = error.toJSON();

      expect(json).toEqual({
        code: 'VORION_ERROR',
        message: 'Test error',
      });
    });

    it('should be an instance of Error', () => {
      const error = new VorionError('Test');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(VorionError);
    });
  });

  describe('ValidationError', () => {
    it('should have correct code and status', () => {
      const error = new ValidationError('Invalid input');

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ValidationError');
      expect(error).toBeInstanceOf(VorionError);
    });

    it('should include validation details', () => {
      const error = new ValidationError('Invalid email format', {
        field: 'email',
        value: 'not-an-email',
        constraint: 'email',
      });

      expect(error.details).toEqual({
        field: 'email',
        value: 'not-an-email',
        constraint: 'email',
      });
    });
  });

  describe('NotFoundError', () => {
    it('should have correct code and status', () => {
      const error = new NotFoundError('User not found');

      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
      expect(error).toBeInstanceOf(VorionError);
    });

    it('should include resource details', () => {
      const error = new NotFoundError('Intent not found', {
        resourceType: 'intent',
        resourceId: 'int-123',
      });

      expect(error.details).toEqual({
        resourceType: 'intent',
        resourceId: 'int-123',
      });
    });
  });

  describe('UnauthorizedError', () => {
    it('should have correct code and status', () => {
      const error = new UnauthorizedError('Invalid token');

      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('UnauthorizedError');
      expect(error).toBeInstanceOf(VorionError);
    });
  });

  describe('ForbiddenError', () => {
    it('should have correct code and status', () => {
      const error = new ForbiddenError('Access denied');

      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('ForbiddenError');
      expect(error).toBeInstanceOf(VorionError);
    });

    it('should include permission details', () => {
      const error = new ForbiddenError('Insufficient permissions', {
        requiredRole: 'admin',
        actualRoles: ['user'],
      });

      expect(error.details).toEqual({
        requiredRole: 'admin',
        actualRoles: ['user'],
      });
    });
  });

  describe('ConflictError', () => {
    it('should have correct code and status', () => {
      const error = new ConflictError('Resource already exists');

      expect(error.code).toBe('CONFLICT');
      expect(error.statusCode).toBe(409);
      expect(error.name).toBe('ConflictError');
      expect(error).toBeInstanceOf(VorionError);
    });
  });

  describe('RateLimitError', () => {
    it('should have correct code and status', () => {
      const error = new RateLimitError('Too many requests');

      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error.name).toBe('RateLimitError');
      expect(error).toBeInstanceOf(VorionError);
    });

    it('should include retryAfter', () => {
      const error = new RateLimitError('Rate limit exceeded', 60);

      expect(error.retryAfter).toBe(60);
    });

    it('should serialize retryAfter in toJSON', () => {
      const error = new RateLimitError('Rate limit exceeded', 30, {
        limit: 100,
        current: 100,
      });
      const json = error.toJSON();

      expect(json).toEqual({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        retryAfter: 30,
        details: { limit: 100, current: 100 },
      });
    });

    it('should not include retryAfter if not set', () => {
      const error = new RateLimitError('Rate limit exceeded');
      const json = error.toJSON();

      expect(json).not.toHaveProperty('retryAfter');
    });
  });

  describe('ConfigurationError', () => {
    it('should have correct code and status', () => {
      const error = new ConfigurationError('Missing required configuration');

      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('ConfigurationError');
      expect(error).toBeInstanceOf(VorionError);
    });

    it('should include configuration details', () => {
      const error = new ConfigurationError('Missing encryption key', {
        requiredConfig: 'VORION_ENCRYPTION_KEY',
      });

      expect(error.details).toEqual({
        requiredConfig: 'VORION_ENCRYPTION_KEY',
      });
    });
  });

  describe('EncryptionError', () => {
    it('should have correct code and status', () => {
      const error = new EncryptionError('Decryption failed');

      expect(error.code).toBe('ENCRYPTION_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('EncryptionError');
      expect(error).toBeInstanceOf(VorionError);
    });

    it('should include encryption context', () => {
      const error = new EncryptionError('Unsupported encryption version', {
        version: 2,
        supportedVersions: [1],
      });

      expect(error.details).toEqual({
        version: 2,
        supportedVersions: [1],
      });
    });
  });

  describe('EscalationError', () => {
    it('should have correct code and status', () => {
      const error = new EscalationError('Invalid escalation state');

      expect(error.code).toBe('ESCALATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('EscalationError');
      expect(error).toBeInstanceOf(VorionError);
    });

    it('should include escalation details', () => {
      const error = new EscalationError('Invalid ISO duration: invalid', {
        isoDuration: 'invalid',
      });

      expect(error.details).toEqual({
        isoDuration: 'invalid',
      });
    });
  });

  describe('DatabaseError', () => {
    it('should have correct code and status', () => {
      const error = new DatabaseError('Database connection failed');

      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('DatabaseError');
      expect(error).toBeInstanceOf(VorionError);
    });
  });

  describe('ExternalServiceError', () => {
    it('should have correct code and status', () => {
      const error = new ExternalServiceError('External API unavailable');

      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.statusCode).toBe(502);
      expect(error.name).toBe('ExternalServiceError');
      expect(error).toBeInstanceOf(VorionError);
    });
  });

  describe('TimeoutError', () => {
    it('should have correct code and status', () => {
      const error = new TimeoutError('Operation timed out');

      expect(error.code).toBe('TIMEOUT');
      expect(error.statusCode).toBe(504);
      expect(error.name).toBe('TimeoutError');
      expect(error).toBeInstanceOf(VorionError);
    });
  });

  describe('isVorionError', () => {
    it('should return true for VorionError instances', () => {
      expect(isVorionError(new VorionError('test'))).toBe(true);
      expect(isVorionError(new ValidationError('test'))).toBe(true);
      expect(isVorionError(new NotFoundError('test'))).toBe(true);
      expect(isVorionError(new RateLimitError('test'))).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      expect(isVorionError(new Error('test'))).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isVorionError(null)).toBe(false);
      expect(isVorionError(undefined)).toBe(false);
      expect(isVorionError('error string')).toBe(false);
      expect(isVorionError({ message: 'error object' })).toBe(false);
      expect(isVorionError(42)).toBe(false);
    });
  });

  describe('wrapError', () => {
    it('should return VorionError unchanged', () => {
      const original = new ValidationError('test');
      const wrapped = wrapError(original);

      expect(wrapped).toBe(original);
    });

    it('should wrap regular Error in VorionError', () => {
      const original = new Error('Original error');
      const wrapped = wrapError(original);

      expect(wrapped).toBeInstanceOf(VorionError);
      expect(wrapped.message).toBe('Original error');
      expect(wrapped.details).toEqual({ originalError: 'Error' });
    });

    it('should wrap non-Error values in VorionError', () => {
      const wrapped = wrapError('string error');

      expect(wrapped).toBeInstanceOf(VorionError);
      expect(wrapped.message).toBe('An unexpected error occurred');
      expect(wrapped.details).toEqual({ originalError: 'string error' });
    });

    it('should use custom fallback message', () => {
      const wrapped = wrapError(null, 'Custom fallback');

      expect(wrapped.message).toBe('Custom fallback');
    });
  });

  describe('Error inheritance chain', () => {
    it('should maintain proper prototype chain', () => {
      const error = new ValidationError('test');

      // Check prototype chain
      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(VorionError);
      expect(error).toBeInstanceOf(Error);

      // Verify property access
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    });

    it('should have stack trace', () => {
      const error = new EscalationError('test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('EscalationError');
    });
  });

  describe('Error usage in try/catch', () => {
    it('should be catchable as Error', () => {
      let caughtError: Error | undefined;

      try {
        throw new ValidationError('Test error');
      } catch (error) {
        if (error instanceof Error) {
          caughtError = error;
        }
      }

      expect(caughtError).toBeDefined();
      expect(caughtError?.message).toBe('Test error');
    });

    it('should be distinguishable from other VorionErrors', () => {
      const throwValidationError = () => {
        throw new ValidationError('Invalid input');
      };

      const throwNotFoundError = () => {
        throw new NotFoundError('Resource not found');
      };

      // Test type narrowing
      expect(() => throwValidationError()).toThrow(ValidationError);
      expect(() => throwNotFoundError()).toThrow(NotFoundError);

      // They should not match each other
      expect(() => throwValidationError()).not.toThrow(NotFoundError);
      expect(() => throwNotFoundError()).not.toThrow(ValidationError);
    });
  });
});
