/**
 * Persistence Layer Types
 *
 * Defines interfaces for trust record storage backends.
 *
 * @packageDocumentation
 */

import type { ID } from '../common/types.js';
import type { TrustRecord } from '../trust-engine/index.js';

/**
 * Query options for listing trust records
 */
export interface TrustRecordQuery {
  /** Filter by minimum trust level */
  minLevel?: number;
  /** Filter by maximum trust level */
  maxLevel?: number;
  /** Filter by minimum score */
  minScore?: number;
  /** Filter by maximum score */
  maxScore?: number;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort by field */
  sortBy?: 'score' | 'level' | 'lastCalculatedAt';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Persistence provider interface
 */
export interface PersistenceProvider {
  /** Provider name for identification */
  readonly name: string;

  /**
   * Initialize the persistence backend
   */
  initialize(): Promise<void>;

  /**
   * Save a trust record
   */
  save(record: TrustRecord): Promise<void>;

  /**
   * Get a trust record by entity ID
   */
  get(entityId: ID): Promise<TrustRecord | undefined>;

  /**
   * Delete a trust record
   */
  delete(entityId: ID): Promise<boolean>;

  /**
   * List all entity IDs
   */
  listIds(): Promise<ID[]>;

  /**
   * Query trust records
   */
  query(options?: TrustRecordQuery): Promise<TrustRecord[]>;

  /**
   * Check if an entity exists
   */
  exists(entityId: ID): Promise<boolean>;

  /**
   * Get total count of records
   */
  count(): Promise<number>;

  /**
   * Clear all records
   */
  clear(): Promise<void>;

  /**
   * Close the persistence backend
   */
  close(): Promise<void>;
}

/**
 * Persistence configuration
 */
export interface PersistenceConfig {
  /** Provider type */
  type: 'memory' | 'file' | 'sqlite';
  /** File path for file/sqlite providers */
  path?: string;
  /** Auto-save interval in ms (0 = disabled) */
  autoSaveIntervalMs?: number;
}
