/**
 * File-based Persistence Provider
 *
 * JSON file storage for simple persistence needs with robust error handling.
 *
 * @packageDocumentation
 */

import { readFile, writeFile, mkdir, unlink, access, rename, copyFile } from 'fs/promises';
import { dirname, join } from 'path';
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
 * Auto-save error event
 */
export interface AutoSaveErrorEvent {
  error: Error;
  attemptNumber: number;
  willRetry: boolean;
  nextRetryMs?: number;
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
  /** Maximum retry attempts for auto-save failures (default: 3) */
  maxRetryAttempts?: number;
  /** Base retry delay in ms (default: 1000) */
  retryDelayMs?: number;
  /** Enable backup before write (default: true) */
  enableBackup?: boolean;
  /** Callback for auto-save errors */
  onAutoSaveError?: (event: AutoSaveErrorEvent) => void;
}

/**
 * File-based persistence provider with robust error handling
 */
export class FilePersistenceProvider implements PersistenceProvider {
  readonly name = 'file';
  private records: Map<ID, TrustRecord> = new Map();
  private config: Required<Omit<FilePersistenceConfig, 'onAutoSaveError'>> & { onAutoSaveError?: FilePersistenceConfig['onAutoSaveError'] };
  private dirty = false;
  private saveTimer: ReturnType<typeof setInterval> | null = null;
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;

  constructor(config: FilePersistenceConfig) {
    this.config = {
      autoSaveIntervalMs: 0,
      prettyPrint: true,
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      enableBackup: true,
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
    } catch (error) {
      // Check if it's a parse error vs file not existing
      if (error instanceof SyntaxError) {
        logger.warn({ path: this.config.path, error: error.message }, 'Corrupted file detected, attempting recovery from backup');
        await this.recoverFromBackup();
      } else {
        // File doesn't exist, start fresh
        logger.info({ path: this.config.path }, 'Creating new trust records file');
      }
    }

    // Set up auto-save if configured
    if (this.config.autoSaveIntervalMs && this.config.autoSaveIntervalMs > 0) {
      this.saveTimer = setInterval(() => {
        if (this.dirty && !this.isFlushing) {
          this.flushWithRetry().catch((err) => {
            logger.error({ err }, 'Auto-save exhausted all retry attempts');
          });
        }
      }, this.config.autoSaveIntervalMs);
    }
  }

  /**
   * Attempt to recover data from backup file
   */
  private async recoverFromBackup(): Promise<void> {
    const backupPath = `${this.config.path}.backup`;
    try {
      await access(backupPath);
      const content = await readFile(backupPath, 'utf-8');
      const storage: FileStorage = JSON.parse(content);

      for (const [id, record] of Object.entries(storage.records)) {
        this.records.set(id, record);
      }

      logger.info({ path: backupPath, count: this.records.size }, 'Recovered trust records from backup');

      // Restore main file from backup
      await copyFile(backupPath, this.config.path);
    } catch {
      logger.warn({ backupPath }, 'No valid backup found, starting fresh');
    }
  }

  /**
   * Create a backup of the current file before writing
   */
  private async createBackup(): Promise<void> {
    if (!this.config.enableBackup) return;

    try {
      await access(this.config.path);
      const backupPath = `${this.config.path}.backup`;
      await copyFile(this.config.path, backupPath);
      logger.debug({ path: this.config.path, backupPath }, 'Created backup before write');
    } catch {
      // Original file doesn't exist, no backup needed
    }
  }

  /**
   * Flush with retry logic for resilience
   */
  private async flushWithRetry(): Promise<void> {
    this.isFlushing = true;

    try {
      await this.flush();
      this.retryCount = 0; // Reset on success
    } catch (error) {
      this.retryCount++;
      const willRetry = this.retryCount < this.config.maxRetryAttempts;
      const nextRetryMs = willRetry ? this.config.retryDelayMs * Math.pow(2, this.retryCount - 1) : undefined;

      const errorEvent: AutoSaveErrorEvent = {
        error: error instanceof Error ? error : new Error(String(error)),
        attemptNumber: this.retryCount,
        willRetry,
        nextRetryMs,
      };

      // Notify error handler if configured
      if (this.config.onAutoSaveError) {
        try {
          this.config.onAutoSaveError(errorEvent);
        } catch (handlerError) {
          logger.warn({ handlerError }, 'Error in onAutoSaveError callback');
        }
      }

      logger.warn(
        {
          attempt: this.retryCount,
          maxAttempts: this.config.maxRetryAttempts,
          willRetry,
          nextRetryMs,
          error: errorEvent.error.message,
        },
        'Auto-save failed'
      );

      if (willRetry) {
        // Schedule retry with exponential backoff
        this.retryTimer = setTimeout(() => {
          this.flushWithRetry().catch((err) => {
            logger.error({ err }, 'Retry flush failed');
          });
        }, nextRetryMs);
      } else {
        // Exhausted all retries
        this.retryCount = 0;
        throw error;
      }
    } finally {
      this.isFlushing = false;
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
    // Clear auto-save timer
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }

    // Clear any pending retry timer
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    // Final flush if dirty
    if (this.dirty) {
      await this.flush();
    }
  }

  /**
   * Flush records to disk with atomic write
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

    // Create backup before writing
    await this.createBackup();

    // Write to temp file first, then rename for atomicity
    const tempPath = `${this.config.path}.tmp`;
    await writeFile(tempPath, content, 'utf-8');

    try {
      await rename(tempPath, this.config.path);
    } catch (renameError) {
      // Fallback to direct write if rename fails (e.g., cross-device)
      await writeFile(this.config.path, content, 'utf-8');
      // Clean up temp file
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }

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
