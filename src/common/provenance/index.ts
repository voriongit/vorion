/**
 * Provenance Tracking Module
 *
 * Complete provenance tracking for SOC2 compliance and audit requirements.
 * Tracks who created what, when, and how it changed with tamper-proof hash chains.
 *
 * @packageDocumentation
 */

// Types
export * from './types.js';

// Tracker
export { ProvenanceTracker, createProvenanceTracker } from './tracker.js';

// Chain
export { ProvenanceChain, createProvenanceChain } from './chain.js';

// Storage
export {
  type ProvenanceStorage,
  InMemoryProvenanceStorage,
  PostgresProvenanceStorage,
  createInMemoryStorage,
  createPostgresStorage,
  provenanceRecords,
} from './storage.js';

// Query
export { ProvenanceQueryBuilder, createQueryBuilder } from './query.js';
