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

import type { PersistenceProvider, PersistenceConfig } from './types.js';
import { MemoryPersistenceProvider } from './memory.js';
import { FilePersistenceProvider } from './file.js';

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

    case 'sqlite':
      throw new Error('SQLite persistence not yet implemented. Use file or memory.');

    default:
      throw new Error(`Unknown persistence type: ${config.type}`);
  }
}
