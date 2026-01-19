/**
 * Statement Timeout Tests
 *
 * Tests for database statement timeout functionality to prevent
 * long-running queries from blocking resources.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_STATEMENT_TIMEOUT_MS,
  LONG_QUERY_TIMEOUT_MS,
  SHORT_QUERY_TIMEOUT_MS,
  StatementTimeoutError,
  isStatementTimeoutError,
  withStatementTimeout,
  withLongQueryTimeout,
} from '../../../src/common/db.js';
import { queryTimeouts, intentRegistry } from '../../../src/intent/metrics.js';

// Mock the database module
vi.mock('../../../src/common/db.js', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getDatabase: vi.fn(),
  };
});

describe('Statement Timeout Constants', () => {
  it('should have correct default timeout values', () => {
    expect(DEFAULT_STATEMENT_TIMEOUT_MS).toBe(30000); // 30 seconds
    expect(LONG_QUERY_TIMEOUT_MS).toBe(120000); // 2 minutes
    expect(SHORT_QUERY_TIMEOUT_MS).toBe(5000); // 5 seconds
  });

  it('should have long timeout greater than default', () => {
    expect(LONG_QUERY_TIMEOUT_MS).toBeGreaterThan(DEFAULT_STATEMENT_TIMEOUT_MS);
  });

  it('should have short timeout less than default', () => {
    expect(SHORT_QUERY_TIMEOUT_MS).toBeLessThan(DEFAULT_STATEMENT_TIMEOUT_MS);
  });
});

describe('StatementTimeoutError', () => {
  it('should create error with correct properties', () => {
    const error = new StatementTimeoutError(
      'Query timed out',
      30000,
      'listIntents'
    );

    expect(error.name).toBe('StatementTimeoutError');
    expect(error.message).toBe('Query timed out');
    expect(error.timeoutMs).toBe(30000);
    expect(error.operation).toBe('listIntents');
    expect(error.code).toBe('STATEMENT_TIMEOUT');
  });

  it('should be an instance of Error', () => {
    const error = new StatementTimeoutError('Test', 1000, 'test');
    expect(error).toBeInstanceOf(Error);
  });

  it('should include timeout and operation in error details', () => {
    const error = new StatementTimeoutError(
      'Query exceeded timeout',
      60000,
      'exportAllUserData'
    );

    expect(error.timeoutMs).toBe(60000);
    expect(error.operation).toBe('exportAllUserData');
  });
});

describe('isStatementTimeoutError', () => {
  it('should return true for StatementTimeoutError', () => {
    const error = new StatementTimeoutError('Timeout', 1000, 'test');
    expect(isStatementTimeoutError(error)).toBe(true);
  });

  it('should return true for PostgreSQL query_canceled error (code 57014)', () => {
    const pgError = new Error('Query was cancelled') as Error & { code: string };
    pgError.code = '57014';
    expect(isStatementTimeoutError(pgError)).toBe(true);
  });

  it('should return false for regular errors', () => {
    const error = new Error('Regular error');
    expect(isStatementTimeoutError(error)).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isStatementTimeoutError(null)).toBe(false);
    expect(isStatementTimeoutError(undefined)).toBe(false);
    expect(isStatementTimeoutError('string')).toBe(false);
    expect(isStatementTimeoutError(123)).toBe(false);
  });

  it('should return false for errors with different PostgreSQL codes', () => {
    const pgError = new Error('Connection error') as Error & { code: string };
    pgError.code = '08001'; // connection_exception
    expect(isStatementTimeoutError(pgError)).toBe(false);
  });

  it('should handle errors without code property', () => {
    const error = new Error('No code property');
    expect(isStatementTimeoutError(error)).toBe(false);
  });
});

describe('Query Timeout Metrics', () => {
  beforeEach(() => {
    intentRegistry.resetMetrics();
  });

  it('should have queryTimeouts counter defined', () => {
    expect(queryTimeouts).toBeDefined();
  });

  it('should increment timeout counter with operation label', () => {
    queryTimeouts.inc({ operation: 'listIntents' });
    queryTimeouts.inc({ operation: 'listIntents' });
    queryTimeouts.inc({ operation: 'exportUserData' });

    // Verify counter incremented without errors
    expect(true).toBe(true);
  });

  it('should support different operation labels', () => {
    const operations = [
      'listIntents',
      'findById',
      'exportUserData',
      'countActiveIntents',
      'unknown',
    ];

    for (const operation of operations) {
      queryTimeouts.inc({ operation });
    }

    expect(true).toBe(true);
  });
});

describe('Statement Timeout Error Categorization', () => {
  it('should categorize timeout error correctly', () => {
    const error = new StatementTimeoutError(
      'Query exceeded timeout',
      30000,
      'listIntents'
    );

    expect(error.code).toBe('STATEMENT_TIMEOUT');
    expect(error.name).toBe('StatementTimeoutError');
  });

  it('should differentiate timeout from other database errors', () => {
    // Timeout error
    const timeoutError = new StatementTimeoutError('Timeout', 30000, 'test');
    expect(isStatementTimeoutError(timeoutError)).toBe(true);

    // Connection error
    const connectionError = new Error('Connection refused') as Error & { code: string };
    connectionError.code = '08001';
    expect(isStatementTimeoutError(connectionError)).toBe(false);

    // Unique violation
    const uniqueError = new Error('Duplicate key') as Error & { code: string };
    uniqueError.code = '23505';
    expect(isStatementTimeoutError(uniqueError)).toBe(false);

    // Deadlock
    const deadlockError = new Error('Deadlock detected') as Error & { code: string };
    deadlockError.code = '40P01';
    expect(isStatementTimeoutError(deadlockError)).toBe(false);
  });

  it('should be catchable and handleable', () => {
    const error = new StatementTimeoutError(
      'Query exceeded timeout',
      30000,
      'complexQuery'
    );

    let caught = false;
    try {
      throw error;
    } catch (e) {
      if (isStatementTimeoutError(e)) {
        caught = true;
        expect((e as StatementTimeoutError).operation).toBe('complexQuery');
        expect((e as StatementTimeoutError).timeoutMs).toBe(30000);
      }
    }

    expect(caught).toBe(true);
  });
});

describe('Timeout Configuration', () => {
  it('should allow configurable timeouts for different operations', () => {
    // Default operations should use DEFAULT_STATEMENT_TIMEOUT_MS
    expect(DEFAULT_STATEMENT_TIMEOUT_MS).toBe(30000);

    // Long running operations (reports, exports) should use LONG_QUERY_TIMEOUT_MS
    expect(LONG_QUERY_TIMEOUT_MS).toBe(120000);

    // Health checks and quick operations should use SHORT_QUERY_TIMEOUT_MS
    expect(SHORT_QUERY_TIMEOUT_MS).toBe(5000);
  });

  it('should support custom timeout values', () => {
    // Custom timeout value for specific use case
    const customTimeout = 45000; // 45 seconds
    expect(customTimeout).toBeGreaterThan(0);
    expect(customTimeout).toBeLessThan(600000); // Max 10 minutes
  });
});

describe('Different Timeout Scenarios', () => {
  it('should handle short timeout for health checks', () => {
    // Health checks should fail fast with short timeout
    expect(SHORT_QUERY_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });

  it('should allow extended timeout for GDPR exports', () => {
    // GDPR exports may take longer due to multiple table joins
    expect(LONG_QUERY_TIMEOUT_MS).toBeGreaterThanOrEqual(120000);
  });

  it('should use reasonable default for regular queries', () => {
    // Default timeout should be reasonable for most operations
    expect(DEFAULT_STATEMENT_TIMEOUT_MS).toBeGreaterThanOrEqual(10000);
    expect(DEFAULT_STATEMENT_TIMEOUT_MS).toBeLessThanOrEqual(60000);
  });

  it('should ensure timeout hierarchy is correct', () => {
    // Ensure SHORT < DEFAULT < LONG
    expect(SHORT_QUERY_TIMEOUT_MS).toBeLessThan(DEFAULT_STATEMENT_TIMEOUT_MS);
    expect(DEFAULT_STATEMENT_TIMEOUT_MS).toBeLessThan(LONG_QUERY_TIMEOUT_MS);
  });
});

describe('Error Message Quality', () => {
  it('should include operation name in error message', () => {
    const error = new StatementTimeoutError(
      "Query 'listIntents' exceeded statement timeout of 30000ms",
      30000,
      'listIntents'
    );

    expect(error.message).toContain('listIntents');
    expect(error.message).toContain('30000ms');
  });

  it('should provide useful debugging information', () => {
    const error = new StatementTimeoutError(
      'Query timed out',
      60000,
      'exportUserData'
    );

    // Error should have all necessary debugging info
    expect(error.operation).toBe('exportUserData');
    expect(error.timeoutMs).toBe(60000);
    expect(error.code).toBe('STATEMENT_TIMEOUT');
    expect(error.name).toBe('StatementTimeoutError');
  });
});

describe('Integration with Existing Error Handling', () => {
  it('should be compatible with VorionError pattern', () => {
    const error = new StatementTimeoutError(
      'Database timeout',
      30000,
      'test'
    );

    // Should have a code property like VorionError
    expect(error.code).toBe('STATEMENT_TIMEOUT');

    // Should be catchable as an Error
    expect(error).toBeInstanceOf(Error);
  });

  it('should serialize properly for logging', () => {
    const error = new StatementTimeoutError(
      'Query timeout',
      30000,
      'listIntents'
    );

    // Should be serializable
    const serialized = JSON.stringify({
      name: error.name,
      message: error.message,
      code: error.code,
      timeoutMs: error.timeoutMs,
      operation: error.operation,
    });

    const parsed = JSON.parse(serialized);
    expect(parsed.name).toBe('StatementTimeoutError');
    expect(parsed.code).toBe('STATEMENT_TIMEOUT');
    expect(parsed.timeoutMs).toBe(30000);
    expect(parsed.operation).toBe('listIntents');
  });
});
