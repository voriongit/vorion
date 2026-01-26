/**
 * SQLite Persistence Provider
 *
 * Lightweight, file-based SQL database for production persistence.
 * Uses better-sqlite3 for synchronous, high-performance operations.
 *
 * @packageDocumentation
 */

import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { ID } from '../common/types.js';
import type { TrustRecord } from '../trust-engine/index.js';
import type { PersistenceProvider, TrustRecordQuery } from './types.js';
import { createLogger } from '../common/logger.js';

const logger = createLogger({ component: 'persistence-sqlite' });

/**
 * SQLite database interface (better-sqlite3 compatible)
 */
export interface SQLiteDatabase {
  prepare(sql: string): SQLiteStatement;
  exec(sql: string): void;
  close(): void;
  pragma(pragma: string): unknown;
}

/**
 * SQLite statement interface
 */
export interface SQLiteStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

/**
 * SQLite database constructor type
 */
export type SQLiteDatabaseConstructor = new (path: string, options?: { readonly?: boolean }) => SQLiteDatabase;

/**
 * SQLite persistence provider configuration
 */
export interface SQLitePersistenceConfig {
  /** Path to the SQLite database file */
  path: string;
  /** Database constructor (better-sqlite3) - required as peer dependency */
  Database: SQLiteDatabaseConstructor;
  /** Table name for trust records */
  tableName?: string;
  /** Enable WAL mode for better concurrent performance */
  walMode?: boolean;
}

/**
 * SQLite row format for trust records
 */
interface TrustRecordRow {
  entity_id: string;
  score: number;
  level: number;
  components: string;
  signals: string;
  last_calculated_at: string;
  history: string;
  recent_failures: string;
  recent_successes: string;
  peak_score: number;
  consecutive_successes: number;
  created_at: string;
  updated_at: string;
}

/**
 * SQLite-based persistence provider
 *
 * Provides durable, ACID-compliant storage for trust records with:
 * - Automatic schema migrations
 * - Indexed queries for fast lookups
 * - WAL mode for concurrent read/write access
 * - Automatic JSON serialization of complex fields
 */
export class SQLitePersistenceProvider implements PersistenceProvider {
  readonly name = 'sqlite';
  private db: SQLiteDatabase | null = null;
  private config: Required<Omit<SQLitePersistenceConfig, 'Database'>> & { Database: SQLiteDatabaseConstructor };
  private initialized = false;

  constructor(config: SQLitePersistenceConfig) {
    this.config = {
      tableName: 'trust_records',
      walMode: true,
      ...config,
    };
  }

  /**
   * Initialize the SQLite database
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Ensure directory exists
      const dir = dirname(this.config.path);
      await mkdir(dir, { recursive: true });

      // Create database connection
      this.db = new this.config.Database(this.config.path);

      // Enable WAL mode for better concurrent performance
      if (this.config.walMode) {
        this.db.pragma('journal_mode = WAL');
      }

      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');

      // Create table if not exists
      this.createSchema();

      this.initialized = true;
      logger.info({ path: this.config.path, table: this.config.tableName }, 'SQLite persistence initialized');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, path: this.config.path }, 'Failed to initialize SQLite persistence');
      throw new Error(`SQLite initialization failed: ${message}`);
    }
  }

  /**
   * Create the database schema
   */
  private createSchema(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const tableName = this.config.tableName;

    // Create main table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        entity_id TEXT PRIMARY KEY,
        score INTEGER NOT NULL,
        level INTEGER NOT NULL,
        components TEXT NOT NULL,
        signals TEXT NOT NULL,
        last_calculated_at TEXT NOT NULL,
        history TEXT NOT NULL,
        recent_failures TEXT NOT NULL,
        recent_successes TEXT NOT NULL,
        peak_score INTEGER NOT NULL,
        consecutive_successes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Create indexes for common queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_score ON ${tableName}(score);
      CREATE INDEX IF NOT EXISTS idx_${tableName}_level ON ${tableName}(level);
      CREATE INDEX IF NOT EXISTS idx_${tableName}_last_calculated ON ${tableName}(last_calculated_at);
    `);

    logger.debug({ table: tableName }, 'SQLite schema created');
  }

  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.db || !this.initialized) {
      throw new Error('SQLite persistence not initialized. Call initialize() first.');
    }
  }

  /**
   * Convert a TrustRecord to a database row
   */
  private recordToRow(record: TrustRecord): Omit<TrustRecordRow, 'created_at' | 'updated_at'> {
    return {
      entity_id: record.entityId,
      score: record.score,
      level: record.level,
      components: JSON.stringify(record.components),
      signals: JSON.stringify(record.signals),
      last_calculated_at: record.lastCalculatedAt,
      history: JSON.stringify(record.history),
      recent_failures: JSON.stringify(record.recentFailures),
      recent_successes: JSON.stringify(record.recentSuccesses),
      peak_score: record.peakScore,
      consecutive_successes: record.consecutiveSuccesses,
    };
  }

  /**
   * Convert a database row to a TrustRecord
   */
  private rowToRecord(row: TrustRecordRow): TrustRecord {
    return {
      entityId: row.entity_id,
      score: row.score,
      level: row.level as 0 | 1 | 2 | 3 | 4 | 5,
      components: JSON.parse(row.components),
      signals: JSON.parse(row.signals),
      lastCalculatedAt: row.last_calculated_at,
      history: JSON.parse(row.history),
      recentFailures: JSON.parse(row.recent_failures),
      recentSuccesses: JSON.parse(row.recent_successes),
      peakScore: row.peak_score,
      consecutiveSuccesses: row.consecutive_successes,
    };
  }

  /**
   * Save a trust record (upsert)
   */
  async save(record: TrustRecord): Promise<void> {
    this.ensureInitialized();

    const row = this.recordToRow(record);
    const tableName = this.config.tableName;

    try {
      const stmt = this.db!.prepare(`
        INSERT INTO ${tableName} (
          entity_id, score, level, components, signals,
          last_calculated_at, history, recent_failures, recent_successes,
          peak_score, consecutive_successes, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(entity_id) DO UPDATE SET
          score = excluded.score,
          level = excluded.level,
          components = excluded.components,
          signals = excluded.signals,
          last_calculated_at = excluded.last_calculated_at,
          history = excluded.history,
          recent_failures = excluded.recent_failures,
          recent_successes = excluded.recent_successes,
          peak_score = excluded.peak_score,
          consecutive_successes = excluded.consecutive_successes,
          updated_at = datetime('now')
      `);

      stmt.run(
        row.entity_id,
        row.score,
        row.level,
        row.components,
        row.signals,
        row.last_calculated_at,
        row.history,
        row.recent_failures,
        row.recent_successes,
        row.peak_score,
        row.consecutive_successes
      );

      logger.debug({ entityId: record.entityId }, 'Trust record saved to SQLite');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, entityId: record.entityId }, 'Failed to save trust record');
      throw new Error(`Failed to save trust record: ${message}`);
    }
  }

  /**
   * Get a trust record by entity ID
   */
  async get(entityId: ID): Promise<TrustRecord | undefined> {
    this.ensureInitialized();

    try {
      const stmt = this.db!.prepare(
        `SELECT * FROM ${this.config.tableName} WHERE entity_id = ?`
      );
      const row = stmt.get(entityId) as TrustRecordRow | undefined;

      if (!row) {
        return undefined;
      }

      return this.rowToRecord(row);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, entityId }, 'Failed to get trust record');
      throw new Error(`Failed to get trust record: ${message}`);
    }
  }

  /**
   * Delete a trust record
   */
  async delete(entityId: ID): Promise<boolean> {
    this.ensureInitialized();

    try {
      const stmt = this.db!.prepare(
        `DELETE FROM ${this.config.tableName} WHERE entity_id = ?`
      );
      const result = stmt.run(entityId);

      const deleted = result.changes > 0;
      if (deleted) {
        logger.debug({ entityId }, 'Trust record deleted from SQLite');
      }

      return deleted;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, entityId }, 'Failed to delete trust record');
      throw new Error(`Failed to delete trust record: ${message}`);
    }
  }

  /**
   * List all entity IDs
   */
  async listIds(): Promise<ID[]> {
    this.ensureInitialized();

    try {
      const stmt = this.db!.prepare(
        `SELECT entity_id FROM ${this.config.tableName}`
      );
      const rows = stmt.all() as { entity_id: string }[];

      return rows.map((row) => row.entity_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, 'Failed to list entity IDs');
      throw new Error(`Failed to list entity IDs: ${message}`);
    }
  }

  /**
   * Query trust records with filtering, sorting, and pagination
   */
  async query(options: TrustRecordQuery = {}): Promise<TrustRecord[]> {
    this.ensureInitialized();

    try {
      const conditions: string[] = [];
      const params: unknown[] = [];

      // Build WHERE conditions
      if (options.minLevel !== undefined) {
        conditions.push('level >= ?');
        params.push(options.minLevel);
      }
      if (options.maxLevel !== undefined) {
        conditions.push('level <= ?');
        params.push(options.maxLevel);
      }
      if (options.minScore !== undefined) {
        conditions.push('score >= ?');
        params.push(options.minScore);
      }
      if (options.maxScore !== undefined) {
        conditions.push('score <= ?');
        params.push(options.maxScore);
      }

      // Build query
      let query = `SELECT * FROM ${this.config.tableName}`;
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      // Add sorting
      const sortBy = options.sortBy ?? 'score';
      const sortOrder = options.sortOrder ?? 'desc';
      const sortColumn = sortBy === 'lastCalculatedAt' ? 'last_calculated_at' : sortBy;
      query += ` ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;

      // Add pagination
      if (options.limit !== undefined) {
        query += ` LIMIT ?`;
        params.push(options.limit);
      }
      if (options.offset !== undefined) {
        query += ` OFFSET ?`;
        params.push(options.offset);
      }

      const stmt = this.db!.prepare(query);
      const rows = stmt.all(...params) as TrustRecordRow[];

      return rows.map((row) => this.rowToRecord(row));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, options }, 'Failed to query trust records');
      throw new Error(`Failed to query trust records: ${message}`);
    }
  }

  /**
   * Check if an entity exists
   */
  async exists(entityId: ID): Promise<boolean> {
    this.ensureInitialized();

    try {
      const stmt = this.db!.prepare(
        `SELECT 1 FROM ${this.config.tableName} WHERE entity_id = ? LIMIT 1`
      );
      const result = stmt.get(entityId);

      return result !== undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, entityId }, 'Failed to check entity existence');
      throw new Error(`Failed to check entity existence: ${message}`);
    }
  }

  /**
   * Get total count of records
   */
  async count(): Promise<number> {
    this.ensureInitialized();

    try {
      const stmt = this.db!.prepare(
        `SELECT COUNT(*) as count FROM ${this.config.tableName}`
      );
      const result = stmt.get() as { count: number };

      return result.count;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, 'Failed to count records');
      throw new Error(`Failed to count records: ${message}`);
    }
  }

  /**
   * Clear all records
   */
  async clear(): Promise<void> {
    this.ensureInitialized();

    try {
      this.db!.exec(`DELETE FROM ${this.config.tableName}`);
      logger.info({ table: this.config.tableName }, 'All trust records cleared');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, 'Failed to clear records');
      throw new Error(`Failed to clear records: ${message}`);
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
        this.initialized = false;
        logger.info({ path: this.config.path }, 'SQLite connection closed');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, 'Failed to close SQLite connection');
        throw new Error(`Failed to close SQLite connection: ${message}`);
      }
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    recordCount: number;
    fileSizeBytes: number | null;
    walMode: boolean;
  }> {
    this.ensureInitialized();

    const recordCount = await this.count();
    const journalMode = this.db!.pragma('journal_mode') as { journal_mode: string }[];

    return {
      recordCount,
      fileSizeBytes: null, // Would need fs.stat to get this
      walMode: journalMode[0]?.journal_mode === 'wal',
    };
  }
}

/**
 * Create a new SQLite persistence provider
 */
export function createSQLiteProvider(config: SQLitePersistenceConfig): SQLitePersistenceProvider {
  return new SQLitePersistenceProvider(config);
}
