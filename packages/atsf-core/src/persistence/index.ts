/**
 * Persistence Layer
 *
 * Pluggable storage backends for trust records.
 *
 * @packageDocumentation
 */

export * from './types.js';
export * from './memory.js';
export * from './file.js';
export * from './supabase.js';
export * from './sqlite.js';

import type { PersistenceProvider, PersistenceConfig } from './types.js';
import { MemoryPersistenceProvider } from './memory.js';
import { FilePersistenceProvider } from './file.js';
import { SupabasePersistenceProvider, type DatabaseClient } from './supabase.js';
import { SQLitePersistenceProvider, type SQLiteDatabaseConstructor } from './sqlite.js';

/**
 * Extended persistence configuration with SQLite support
 */
export interface ExtendedPersistenceConfig extends PersistenceConfig {
  /** SQLite Database constructor (better-sqlite3) - required for sqlite type */
  sqliteDatabase?: SQLiteDatabaseConstructor;
}

/**
 * Create a persistence provider based on configuration
 */
export function createPersistenceProvider(config: ExtendedPersistenceConfig): PersistenceProvider {
  switch (config.type) {
    case 'memory':
      return new MemoryPersistenceProvider();

    case 'file':
      if (!config.path) {
        throw new Error('File persistence requires a path');
      }
      return new FilePersistenceProvider({
        path: config.path,
        autoSaveIntervalMs: config.autoSaveIntervalMs,
      });

    case 'supabase':
      if (!config.client) {
        throw new Error('Supabase persistence requires a client');
      }
      return new SupabasePersistenceProvider({
        client: config.client as DatabaseClient,
        tableName: config.tableName,
      });

    case 'sqlite':
      if (!config.path) {
        throw new Error('SQLite persistence requires a path');
      }
      if (!config.sqliteDatabase) {
        throw new Error(
          'SQLite persistence requires a Database constructor. ' +
          'Install better-sqlite3 and pass it as sqliteDatabase: ' +
          'import Database from "better-sqlite3"; createPersistenceProvider({ type: "sqlite", path: "./data.db", sqliteDatabase: Database })'
        );
      }
      return new SQLitePersistenceProvider({
        path: config.path,
        Database: config.sqliteDatabase,
        tableName: config.tableName,
      });

    default:
      throw new Error(`Unknown persistence type: ${config.type}`);
  }
}
