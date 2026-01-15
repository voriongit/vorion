/**
 * File-based Persistence Provider
 *
 * JSON file storage for simple persistence needs.
 *
 * @packageDocumentation
 */

import { readFile, writeFile, mkdir, unlink, access } from 'fs/promises';
import { dirname } from 'path';
import type { ID } from '../common/types.js';
import type { TrustRecord } from '../trust-engine/index.js';
import type { PersistenceProvider, TrustRecordQuery } from './types.js';
import { createLogger } from '../common/logger.js';

const logger = createLogger({ component: 'persistence-file' });

/**
 * File storage format
 */
interface FileStorage {
  version: number;
  updatedAt: string;
  records: Record<ID, TrustRecord>;
}

/**
 * File-based persistence provider configuration
 */
export interface FilePersistenceConfig {
  /** Path to the JSON file */
  path: string;
  /** Auto-save interval in ms (0 = save on every write) */
  autoSaveIntervalMs?: number;
  /** Pretty print JSON output */
  prettyPrint?: boolean;
}

/**
 * File-based persistence provider
 */
export class FilePersistenceProvider implements PersistenceProvider {
  readonly name = 'file';
  private records: Map<ID, TrustRecord> = new Map();
  private config: FilePersistenceConfig;
  private dirty = false;
  private saveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: FilePersistenceConfig) {
    this.config = {
      autoSaveIntervalMs: 0,
      prettyPrint: true,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    // Ensure directory exists
    const dir = dirname(this.config.path);
    await mkdir(dir, { recursive: true });

    // Load existing data if file exists
    try {
      await access(this.config.path);
      const content = await readFile(this.config.path, 'utf-8');
      const storage: FileStorage = JSON.parse(content);

      // Load records into memory
      for (const [id, record] of Object.entries(storage.records)) {
        this.records.set(id, record);
      }

      logger.info({ path: this.config.path, count: this.records.size }, 'Loaded trust records from file');
    } catch {
      // File doesn't exist, start fresh
      logger.info({ path: this.config.path }, 'Creating new trust records file');
    }

    // Set up auto-save if configured
    if (this.config.autoSaveIntervalMs && this.config.autoSaveIntervalMs > 0) {
      this.saveTimer = setInterval(() => {
        if (this.dirty) {
          this.flush().catch((err) => {
            logger.error({ err }, 'Auto-save failed');
          });
        }
      }, this.config.autoSaveIntervalMs);
    }
  }

  async save(record: TrustRecord): Promise<void> {
    this.records.set(record.entityId, JSON.parse(JSON.stringify(record)));
    this.dirty = true;

    // Immediate save if no auto-save interval
    if (!this.config.autoSaveIntervalMs) {
      await this.flush();
    }
  }

  async get(entityId: ID): Promise<TrustRecord | undefined> {
    const record = this.records.get(entityId);
    if (!record) return undefined;
    return JSON.parse(JSON.stringify(record));
  }

  async delete(entityId: ID): Promise<boolean> {
    const deleted = this.records.delete(entityId);
    if (deleted) {
      this.dirty = true;
      if (!this.config.autoSaveIntervalMs) {
        await this.flush();
      }
    }
    return deleted;
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
    this.dirty = true;
    await this.flush();
  }

  async close(): Promise<void> {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.dirty) {
      await this.flush();
    }
  }

  /**
   * Flush records to disk
   */
  async flush(): Promise<void> {
    const storage: FileStorage = {
      version: 1,
      updatedAt: new Date().toISOString(),
      records: Object.fromEntries(this.records),
    };

    const content = this.config.prettyPrint
      ? JSON.stringify(storage, null, 2)
      : JSON.stringify(storage);

    await writeFile(this.config.path, content, 'utf-8');
    this.dirty = false;

    logger.debug({ path: this.config.path, count: this.records.size }, 'Flushed trust records to file');
  }

  /**
   * Delete the storage file
   */
  async deleteFile(): Promise<void> {
    try {
      await unlink(this.config.path);
    } catch {
      // File may not exist
    }
  }
}

/**
 * Create a new file persistence provider
 */
export function createFileProvider(config: FilePersistenceConfig): FilePersistenceProvider {
  return new FilePersistenceProvider(config);
}
