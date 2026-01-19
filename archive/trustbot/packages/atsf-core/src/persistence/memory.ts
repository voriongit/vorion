/**
 * In-Memory Persistence Provider
 *
 * Fast, non-persistent storage for testing and development.
 *
 * @packageDocumentation
 */

import type { ID } from '../common/types.js';
import type { TrustRecord } from '../trust-engine/index.js';
import type { PersistenceProvider, TrustRecordQuery } from './types.js';

/**
 * In-memory persistence provider
 */
export class MemoryPersistenceProvider implements PersistenceProvider {
  readonly name = 'memory';
  private records: Map<ID, TrustRecord> = new Map();

  async initialize(): Promise<void> {
    // No initialization needed for memory provider
  }

  async save(record: TrustRecord): Promise<void> {
    // Deep clone to prevent external mutations
    this.records.set(record.entityId, JSON.parse(JSON.stringify(record)));
  }

  async get(entityId: ID): Promise<TrustRecord | undefined> {
    const record = this.records.get(entityId);
    if (!record) return undefined;
    // Return a copy to prevent external mutations
    return JSON.parse(JSON.stringify(record));
  }

  async delete(entityId: ID): Promise<boolean> {
    return this.records.delete(entityId);
  }

  async listIds(): Promise<ID[]> {
    return Array.from(this.records.keys());
  }

  async query(options: TrustRecordQuery = {}): Promise<TrustRecord[]> {
    let results = Array.from(this.records.values());

    // Apply filters
    if (options.minLevel !== undefined) {
      results = results.filter((r) => r.level >= options.minLevel!);
    }
    if (options.maxLevel !== undefined) {
      results = results.filter((r) => r.level <= options.maxLevel!);
    }
    if (options.minScore !== undefined) {
      results = results.filter((r) => r.score >= options.minScore!);
    }
    if (options.maxScore !== undefined) {
      results = results.filter((r) => r.score <= options.maxScore!);
    }

    // Apply sorting
    const sortBy = options.sortBy ?? 'score';
    const sortOrder = options.sortOrder ?? 'desc';
    results.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'score') {
        comparison = a.score - b.score;
      } else if (sortBy === 'level') {
        comparison = a.level - b.level;
      } else if (sortBy === 'lastCalculatedAt') {
        comparison = new Date(a.lastCalculatedAt).getTime() - new Date(b.lastCalculatedAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? results.length;
    results = results.slice(offset, offset + limit);

    // Return copies
    return results.map((r) => JSON.parse(JSON.stringify(r)));
  }

  async exists(entityId: ID): Promise<boolean> {
    return this.records.has(entityId);
  }

  async count(): Promise<number> {
    return this.records.size;
  }

  async clear(): Promise<void> {
    this.records.clear();
  }

  async close(): Promise<void> {
    // No cleanup needed for memory provider
  }
}

/**
 * Create a new memory persistence provider
 */
export function createMemoryProvider(): MemoryPersistenceProvider {
  return new MemoryPersistenceProvider();
}
