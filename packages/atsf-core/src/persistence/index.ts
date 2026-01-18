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

import type { PersistenceProvider, PersistenceConfig } from './types.js';
import { MemoryPersistenceProvider } from './memory.js';
import { FilePersistenceProvider } from './file.js';
import { SupabasePersistenceProvider, type DatabaseClient } from './supabase.js';

/**
 * Create a persistence provider based on configuration
 */
export function createPersistenceProvider(config: PersistenceConfig): PersistenceProvider {
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
      throw new Error('SQLite persistence not yet implemented. Use file or memory.');

    default:
      throw new Error(`Unknown persistence type: ${config.type}`);
  }
}
