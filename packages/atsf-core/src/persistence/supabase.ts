/**
 * Supabase/PostgreSQL Persistence Provider
 *
 * Database-backed storage for trust records using Supabase or any PostgreSQL client.
 *
 * @packageDocumentation
 */

import type { ID } from '../common/types.js';
import type { TrustRecord } from '../trust-engine/index.js';
import type { PersistenceProvider, TrustRecordQuery } from './types.js';
import { createLogger } from '../common/logger.js';

const logger = createLogger({ component: 'persistence-supabase' });

/**
 * Generic database client interface
 * Compatible with Supabase client, Drizzle, or raw pg
 */
export interface DatabaseClient {
  from(table: string): DatabaseQueryBuilder;
}

/**
 * Query builder interface matching Supabase's API
 */
export interface DatabaseQueryBuilder {
  select(columns?: string): DatabaseQueryBuilder;
  insert(data: Record<string, unknown> | Record<string, unknown>[]): DatabaseQueryBuilder;
  update(data: Record<string, unknown>): DatabaseQueryBuilder;
  upsert(data: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }): DatabaseQueryBuilder;
  delete(): DatabaseQueryBuilder;
  eq(column: string, value: unknown): DatabaseQueryBuilder;
  gte(column: string, value: unknown): DatabaseQueryBuilder;
  lte(column: string, value: unknown): DatabaseQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): DatabaseQueryBuilder;
  range(from: number, to: number): DatabaseQueryBuilder;
  single(): DatabaseQueryBuilder;
  then<T>(resolve: (result: DatabaseResult<T>) => void, reject?: (error: Error) => void): Promise<DatabaseResult<T>>;
}

/**
 * Database result interface
 */
export interface DatabaseResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number;
}

/**
 * Supabase persistence provider configuration
 */
export interface SupabasePersistenceConfig {
  /** Supabase client or compatible database client */
  client: DatabaseClient;
  /** Table name for trust records (default: 'trust_scores') */
  tableName?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Database row format for trust records
 */
interface TrustRecordRow {
  entity_id: string;
  score: number;
  level: number;
  components: Record<string, unknown>;
  signals: unknown[];
  last_calculated_at: string;
  history: unknown[];
  recent_failures: string[];
  recent_successes: string[];
  peak_score: number;
  consecutive_successes: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown; // Index signature for compatibility
}

/**
 * Supabase/PostgreSQL persistence provider
 */
export class SupabasePersistenceProvider implements PersistenceProvider {
  readonly name = 'supabase';
  private client: DatabaseClient;
  private tableName: string;
  private debug: boolean;

  constructor(config: SupabasePersistenceConfig) {
    this.client = config.client;
    this.tableName = config.tableName ?? 'trust_scores';
    this.debug = config.debug ?? false;
  }

  async initialize(): Promise<void> {
    // Verify connection by attempting a simple query
    try {
      const result = await this.client
        .from(this.tableName)
        .select('entity_id')
        .range(0, 0);

      if (result.error) {
        // Table might not exist, log warning but don't fail
        logger.warn(
          { table: this.tableName, error: result.error.message },
          'Trust scores table may not exist. Run migrations to create it.'
        );
      } else {
        logger.info({ table: this.tableName }, 'Supabase persistence initialized');
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to verify Supabase connection');
    }
  }

  async save(record: TrustRecord): Promise<void> {
    const row = this.recordToRow(record) as Record<string, unknown>;

    const result = await this.client
      .from(this.tableName)
      .upsert(row, { onConflict: 'entity_id' });

    if (result.error) {
      logger.error({ error: result.error, entityId: record.entityId }, 'Failed to save trust record');
      throw new Error(`Failed to save trust record: ${result.error.message}`);
    }

    if (this.debug) {
      logger.debug({ entityId: record.entityId, score: record.score }, 'Saved trust record');
    }
  }

  async get(entityId: ID): Promise<TrustRecord | undefined> {
    const result = await this.client
      .from(this.tableName)
      .select('*')
      .eq('entity_id', entityId)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') {
        // No rows found
        return undefined;
      }
      logger.error({ error: result.error, entityId }, 'Failed to get trust record');
      throw new Error(`Failed to get trust record: ${result.error.message}`);
    }

    if (!result.data) {
      return undefined;
    }

    return this.rowToRecord(result.data as unknown as TrustRecordRow);
  }

  async delete(entityId: ID): Promise<boolean> {
    const result = await this.client
      .from(this.tableName)
      .delete()
      .eq('entity_id', entityId);

    if (result.error) {
      logger.error({ error: result.error, entityId }, 'Failed to delete trust record');
      throw new Error(`Failed to delete trust record: ${result.error.message}`);
    }

    return true;
  }

  async listIds(): Promise<ID[]> {
    const result = await this.client
      .from(this.tableName)
      .select('entity_id');

    if (result.error) {
      logger.error({ error: result.error }, 'Failed to list entity IDs');
      throw new Error(`Failed to list entity IDs: ${result.error.message}`);
    }

    const data = result.data as Array<{ entity_id: string }> | null;
    return data?.map((row) => row.entity_id) ?? [];
  }

  async query(options: TrustRecordQuery = {}): Promise<TrustRecord[]> {
    let query = this.client.from(this.tableName).select('*');

    // Apply filters
    if (options.minLevel !== undefined) {
      query = query.gte('level', options.minLevel);
    }
    if (options.maxLevel !== undefined) {
      query = query.lte('level', options.maxLevel);
    }
    if (options.minScore !== undefined) {
      query = query.gte('score', options.minScore);
    }
    if (options.maxScore !== undefined) {
      query = query.lte('score', options.maxScore);
    }

    // Apply sorting
    const sortBy = options.sortBy ?? 'score';
    const sortOrder = options.sortOrder ?? 'desc';
    const columnMap: Record<string, string> = {
      score: 'score',
      level: 'level',
      lastCalculatedAt: 'last_calculated_at',
    };
    query = query.order(columnMap[sortBy] ?? 'score', { ascending: sortOrder === 'asc' });

    // Apply pagination
    if (options.limit !== undefined || options.offset !== undefined) {
      const offset = options.offset ?? 0;
      const limit = options.limit ?? 100;
      query = query.range(offset, offset + limit - 1);
    }

    const result = await query;

    if (result.error) {
      logger.error({ error: result.error }, 'Failed to query trust records');
      throw new Error(`Failed to query trust records: ${result.error.message}`);
    }

    const rows = result.data as TrustRecordRow[] | null;
    return rows?.map((row) => this.rowToRecord(row)) ?? [];
  }

  async exists(entityId: ID): Promise<boolean> {
    const result = await this.client
      .from(this.tableName)
      .select('entity_id')
      .eq('entity_id', entityId)
      .single();

    return !result.error && result.data !== null;
  }

  async count(): Promise<number> {
    const result = await this.client
      .from(this.tableName)
      .select('entity_id');

    if (result.error) {
      logger.error({ error: result.error }, 'Failed to count trust records');
      throw new Error(`Failed to count trust records: ${result.error.message}`);
    }

    const data = result.data as unknown[] | null;
    return data?.length ?? 0;
  }

  async clear(): Promise<void> {
    // Delete all records - be careful with this!
    const result = await this.client
      .from(this.tableName)
      .delete()
      .gte('score', 0); // This matches all records

    if (result.error) {
      logger.error({ error: result.error }, 'Failed to clear trust records');
      throw new Error(`Failed to clear trust records: ${result.error.message}`);
    }

    logger.info({ table: this.tableName }, 'Cleared all trust records');
  }

  async close(): Promise<void> {
    // Supabase client doesn't need explicit closing
    logger.info('Supabase persistence closed');
  }

  /**
   * Convert a TrustRecord to a database row
   */
  private recordToRow(record: TrustRecord): TrustRecordRow {
    return {
      entity_id: record.entityId,
      score: record.score,
      level: record.level,
      components: { ...record.components },
      signals: record.signals,
      last_calculated_at: record.lastCalculatedAt,
      history: record.history,
      recent_failures: record.recentFailures,
      recent_successes: record.recentSuccesses ?? [],
      peak_score: record.peakScore ?? record.score,
      consecutive_successes: record.consecutiveSuccesses ?? 0,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Convert a database row to a TrustRecord
   */
  private rowToRecord(row: TrustRecordRow): TrustRecord {
    const components = row.components as Record<string, number>;
    return {
      entityId: row.entity_id,
      score: row.score,
      level: row.level as 0 | 1 | 2 | 3 | 4 | 5,
      components: {
        behavioral: components.behavioral ?? 0.5,
        compliance: components.compliance ?? 0.5,
        identity: components.identity ?? 0.5,
        context: components.context ?? 0.5,
      },
      signals: row.signals as TrustRecord['signals'],
      lastCalculatedAt: row.last_calculated_at,
      history: row.history as TrustRecord['history'],
      recentFailures: row.recent_failures ?? [],
      recentSuccesses: row.recent_successes ?? [],
      peakScore: row.peak_score ?? row.score,
      consecutiveSuccesses: row.consecutive_successes ?? 0,
    };
  }
}

/**
 * Create a new Supabase persistence provider
 */
export function createSupabaseProvider(config: SupabasePersistenceConfig): SupabasePersistenceProvider {
  return new SupabasePersistenceProvider(config);
}
