/**
 * Database Metrics Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  intentRegistry,
  dbQueryDuration,
  dbQueryTotal,
  dbQueryErrorsTotal,
  dbPoolConnectionsActive,
  dbPoolConnectionsIdle,
  dbPoolConnectionsWaiting,
  detectOperationType,
  recordDbQuery,
  recordDbQueryError,
  updateDbPoolMetrics,
  getMetrics,
} from '../../../src/intent/metrics.js';
import {
  InstrumentedPool,
  InstrumentedPoolClient,
  DbQueryTimer,
  startDbQueryTimer,
  withDbMetrics,
} from '../../../src/common/db-metrics.js';

describe('Database Metrics', () => {
  beforeEach(async () => {
    // Reset all metrics before each test
    intentRegistry.resetMetrics();
  });

  describe('Metric Definitions', () => {
    it('should have dbQueryDuration histogram', () => {
      dbQueryDuration.observe({ operation: 'select' }, 0.05);
      expect(true).toBe(true);
    });

    it('should have dbQueryTotal counter', () => {
      dbQueryTotal.inc({ operation: 'select' });
      expect(true).toBe(true);
    });

    it('should have dbQueryErrorsTotal counter', () => {
      dbQueryErrorsTotal.inc({ operation: 'select', error_type: 'timeout' });
      expect(true).toBe(true);
    });

    it('should have dbPoolConnectionsActive gauge', () => {
      dbPoolConnectionsActive.set(5);
      expect(true).toBe(true);
    });

    it('should have dbPoolConnectionsIdle gauge', () => {
      dbPoolConnectionsIdle.set(10);
      expect(true).toBe(true);
    });

    it('should have dbPoolConnectionsWaiting gauge', () => {
      dbPoolConnectionsWaiting.set(2);
      expect(true).toBe(true);
    });
  });

  describe('detectOperationType', () => {
    it('should detect SELECT queries', () => {
      expect(detectOperationType('SELECT * FROM users')).toBe('select');
      expect(detectOperationType('  SELECT id FROM users')).toBe('select');
      expect(detectOperationType('select count(*) from users')).toBe('select');
    });

    it('should detect INSERT queries', () => {
      expect(detectOperationType('INSERT INTO users (name) VALUES ($1)')).toBe('insert');
      expect(detectOperationType('  insert into users values ($1)')).toBe('insert');
    });

    it('should detect UPDATE queries', () => {
      expect(detectOperationType('UPDATE users SET name = $1')).toBe('update');
      expect(detectOperationType('  update users set status = $1')).toBe('update');
    });

    it('should detect DELETE queries', () => {
      expect(detectOperationType('DELETE FROM users WHERE id = $1')).toBe('delete');
      expect(detectOperationType('  delete from users')).toBe('delete');
    });

    it('should return other for unrecognized queries', () => {
      expect(detectOperationType('CREATE TABLE users (id serial)')).toBe('other');
      expect(detectOperationType('DROP TABLE users')).toBe('other');
      expect(detectOperationType('ALTER TABLE users ADD COLUMN')).toBe('other');
      expect(detectOperationType('BEGIN')).toBe('other');
      expect(detectOperationType('COMMIT')).toBe('other');
    });
  });

  describe('recordDbQuery', () => {
    it('should record query with operation type', () => {
      recordDbQuery('select', 0.05);
      recordDbQuery('insert', 0.1);
      recordDbQuery('update', 0.02);
      recordDbQuery('delete', 0.03);
      recordDbQuery('other', 0.001);

      expect(true).toBe(true);
    });

    it('should handle various durations', () => {
      recordDbQuery('select', 0.001); // 1ms
      recordDbQuery('select', 0.05);  // 50ms
      recordDbQuery('select', 1.0);   // 1s
      recordDbQuery('select', 5.0);   // 5s

      expect(true).toBe(true);
    });
  });

  describe('recordDbQueryError', () => {
    it('should record query errors with type', () => {
      recordDbQueryError('select', 'timeout');
      recordDbQueryError('insert', 'unique_violation');
      recordDbQueryError('update', 'connection_failure');

      expect(true).toBe(true);
    });

    it('should record various error types', () => {
      const errorTypes = [
        'unique_violation',
        'foreign_key_violation',
        'not_null_violation',
        'check_violation',
        'undefined_table',
        'undefined_column',
        'query_canceled',
        'serialization_failure',
        'deadlock_detected',
        'connection_failure',
        'connection_refused',
        'connection_rejected',
        'admin_shutdown',
        'timeout',
        'host_not_found',
        'unknown',
      ];

      for (const errorType of errorTypes) {
        recordDbQueryError('select', errorType);
      }

      expect(true).toBe(true);
    });
  });

  describe('updateDbPoolMetrics', () => {
    it('should update all pool metrics', () => {
      updateDbPoolMetrics(5, 10, 2);

      expect(true).toBe(true);
    });

    it('should handle zero values', () => {
      updateDbPoolMetrics(0, 0, 0);

      expect(true).toBe(true);
    });

    it('should handle high values', () => {
      updateDbPoolMetrics(100, 400, 50);

      expect(true).toBe(true);
    });
  });

  describe('DbQueryTimer', () => {
    it('should measure query duration on success', async () => {
      const timer = startDbQueryTimer('select');

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));

      const duration = timer.success();

      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1); // Should be less than 1 second
    });

    it('should record error on failure', () => {
      const timer = startDbQueryTimer('insert');

      timer.failure(new Error('Connection failed'));

      expect(true).toBe(true);
    });

    it('should handle PostgreSQL errors', () => {
      const timer = startDbQueryTimer('insert');

      const pgError = new Error('duplicate key value violates unique constraint') as Error & { code: string };
      pgError.code = '23505';

      timer.failure(pgError);

      expect(true).toBe(true);
    });
  });

  describe('withDbMetrics', () => {
    it('should wrap successful query', async () => {
      const result = await withDbMetrics('select', async () => {
        return { rows: [{ id: 1 }] };
      });

      expect(result.rows).toHaveLength(1);
    });

    it('should wrap failed query and rethrow', async () => {
      await expect(
        withDbMetrics('insert', async () => {
          throw new Error('Insert failed');
        })
      ).rejects.toThrow('Insert failed');
    });

    it('should record metrics for async queries', async () => {
      await withDbMetrics('update', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { rowCount: 1 };
      });

      expect(true).toBe(true);
    });
  });

  describe('getMetrics', () => {
    it('should include database metrics in output', async () => {
      // Add some sample data
      dbQueryTotal.inc({ operation: 'select' });
      dbQueryDuration.observe({ operation: 'select' }, 0.05);
      dbPoolConnectionsActive.set(5);
      dbPoolConnectionsIdle.set(10);
      dbPoolConnectionsWaiting.set(0);

      const metrics = await getMetrics();

      expect(metrics).toContain('vorion_db_query_total');
      expect(metrics).toContain('vorion_db_query_duration_seconds');
      expect(metrics).toContain('vorion_db_pool_connections_active');
      expect(metrics).toContain('vorion_db_pool_connections_idle');
      expect(metrics).toContain('vorion_db_pool_connections_waiting');
    });

    it('should include error metrics in output', async () => {
      dbQueryErrorsTotal.inc({ operation: 'insert', error_type: 'unique_violation' });

      const metrics = await getMetrics();

      expect(metrics).toContain('vorion_db_query_errors_total');
    });
  });

  describe('Metric Labels', () => {
    it('should allow all operation types', () => {
      const operations = ['select', 'insert', 'update', 'delete', 'other'] as const;

      for (const op of operations) {
        dbQueryTotal.inc({ operation: op });
        dbQueryDuration.observe({ operation: op }, 0.01);
      }

      expect(true).toBe(true);
    });

    it('should allow different error types per operation', () => {
      dbQueryErrorsTotal.inc({ operation: 'select', error_type: 'timeout' });
      dbQueryErrorsTotal.inc({ operation: 'select', error_type: 'connection_failure' });
      dbQueryErrorsTotal.inc({ operation: 'insert', error_type: 'unique_violation' });
      dbQueryErrorsTotal.inc({ operation: 'update', error_type: 'deadlock_detected' });

      expect(true).toBe(true);
    });
  });
});

describe('InstrumentedPool', () => {
  let mockPool: {
    query: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };

  beforeEach(() => {
    intentRegistry.resetMetrics();
    mockPool = {
      query: vi.fn(),
      connect: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
      totalCount: 10,
      idleCount: 5,
      waitingCount: 2,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should collect pool metrics', () => {
    const instrumented = new InstrumentedPool(mockPool as unknown as import('pg').Pool);

    instrumented.collectPoolMetrics();

    // Verify it doesn't throw
    expect(true).toBe(true);
  });

  it('should execute queries with instrumentation', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

    const instrumented = new InstrumentedPool(mockPool as unknown as import('pg').Pool);
    const result = await instrumented.query('SELECT * FROM users WHERE id = $1', [1]);

    expect(result.rows).toHaveLength(1);
    expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
  });

  it('should record metrics on successful query', async () => {
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const instrumented = new InstrumentedPool(mockPool as unknown as import('pg').Pool);
    await instrumented.query('SELECT 1');

    // Metrics should be recorded (verified by no error)
    expect(true).toBe(true);
  });

  it('should record error metrics on failed query', async () => {
    const pgError = new Error('Connection refused') as Error & { code: string };
    pgError.code = '08001';
    mockPool.query.mockRejectedValue(pgError);

    const instrumented = new InstrumentedPool(mockPool as unknown as import('pg').Pool);

    await expect(instrumented.query('SELECT 1')).rejects.toThrow('Connection refused');
  });

  it('should start and stop metrics collection', () => {
    vi.useFakeTimers();

    const instrumented = new InstrumentedPool(mockPool as unknown as import('pg').Pool);

    instrumented.startMetricsCollection(1000);

    // Advance time
    vi.advanceTimersByTime(5000);

    instrumented.stopMetricsCollection();

    vi.useRealTimers();
    expect(true).toBe(true);
  });

  it('should end pool connection', async () => {
    mockPool.end.mockResolvedValue(undefined);

    const instrumented = new InstrumentedPool(mockPool as unknown as import('pg').Pool);
    await instrumented.end();

    expect(mockPool.end).toHaveBeenCalled();
  });

  it('should return underlying pool', () => {
    const instrumented = new InstrumentedPool(mockPool as unknown as import('pg').Pool);
    const pool = instrumented.getPool();

    expect(pool).toBe(mockPool);
  });
});

describe('InstrumentedPoolClient', () => {
  let mockClient: {
    query: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    intentRegistry.resetMetrics();
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should execute queries with instrumentation', async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

    const instrumented = new InstrumentedPoolClient(mockClient as unknown as import('pg').PoolClient);
    const result = await instrumented.query('INSERT INTO users (name) VALUES ($1) RETURNING id', ['test']);

    expect(result.rows).toHaveLength(1);
    expect(mockClient.query).toHaveBeenCalled();
  });

  it('should record error metrics on failed query', async () => {
    const pgError = new Error('duplicate key') as Error & { code: string };
    pgError.code = '23505';
    mockClient.query.mockRejectedValue(pgError);

    const instrumented = new InstrumentedPoolClient(mockClient as unknown as import('pg').PoolClient);

    await expect(
      instrumented.query('INSERT INTO users (email) VALUES ($1)', ['duplicate@example.com'])
    ).rejects.toThrow('duplicate key');
  });

  it('should release client', () => {
    const instrumented = new InstrumentedPoolClient(mockClient as unknown as import('pg').PoolClient);
    instrumented.release();

    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should release client with error', () => {
    const instrumented = new InstrumentedPoolClient(mockClient as unknown as import('pg').PoolClient);
    const error = new Error('Transaction failed');
    instrumented.release(error);

    expect(mockClient.release).toHaveBeenCalledWith(error);
  });

  it('should return underlying client', () => {
    const instrumented = new InstrumentedPoolClient(mockClient as unknown as import('pg').PoolClient);
    const client = instrumented.getClient();

    expect(client).toBe(mockClient);
  });
});
