/**
 * Provenance Tracking Types
 *
 * Core types for tracking entity provenance - who created what, when, and how it changed.
 * Supports SOC2 compliance and audit requirements.
 *
 * @packageDocumentation
 */

import type { ID, Timestamp } from '../types.js';

/**
 * Actor types for provenance tracking
 */
export type ActorType = 'user' | 'system' | 'agent';

/**
 * Actor who performed an action
 */
export interface Actor {
  /** Unique actor identifier */
  id: ID;
  /** Type of actor */
  type: ActorType;
  /** Additional actor metadata */
  metadata: Record<string, unknown>;
}

/**
 * Provenance record for tracking entity changes
 */
export interface ProvenanceRecord {
  /** Unique record identifier */
  id: ID;
  /** Entity identifier being tracked */
  entityId: ID;
  /** Entity type (e.g., 'intent', 'policy', 'agent') */
  entityType: string;
  /** Action performed (e.g., 'create', 'update', 'delete') */
  action: string;
  /** Data snapshot at time of action */
  data: Record<string, unknown>;
  /** Actor who performed the action */
  actor: Actor;
  /** Hash of this record's content */
  hash: string;
  /** Hash of previous record in chain (empty for first record) */
  previousHash: string;
  /** Chain position (1-indexed) */
  chainPosition: number;
  /** Tenant identifier for multi-tenancy */
  tenantId: ID;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Record creation timestamp */
  createdAt: Timestamp;
}

/**
 * Input for creating a provenance record
 */
export interface CreateProvenanceRecord {
  entityId: ID;
  entityType: string;
  action: string;
  data: Record<string, unknown>;
  actor: Actor;
  tenantId: ID;
  metadata?: Record<string, unknown>;
}

/**
 * Query filters for provenance records
 */
export interface ProvenanceQueryFilters {
  /** Filter by entity ID */
  entityId?: ID;
  /** Filter by entity type */
  entityType?: string;
  /** Filter by actor ID */
  actorId?: ID;
  /** Filter by actor type */
  actorType?: ActorType;
  /** Filter by action */
  action?: string;
  /** Filter by tenant */
  tenantId?: ID;
  /** Filter by time range start */
  from?: Date;
  /** Filter by time range end */
  to?: Date;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  /** Number of records to return */
  limit?: number;
  /** Number of records to skip */
  offset?: number;
}

/**
 * Paginated query result
 */
export interface PaginatedResult<T> {
  /** Result items */
  items: T[];
  /** Total count of matching records */
  total: number;
  /** Whether more records exist */
  hasMore: boolean;
  /** Current offset */
  offset: number;
  /** Current limit */
  limit: number;
}

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'csv';

/**
 * Chain verification result
 */
export interface ChainVerificationResult {
  /** Whether the chain is valid */
  valid: boolean;
  /** Number of records verified */
  recordsVerified: number;
  /** Position of first invalid record (if any) */
  invalidAtPosition?: number;
  /** Error message if verification failed */
  error?: string;
  /** Verification timestamp */
  verifiedAt: Timestamp;
}

/**
 * Tamper detection result
 */
export interface TamperDetectionResult {
  /** Whether tampering was detected */
  tampered: boolean;
  /** Details about detected tampering */
  details?: {
    position: number;
    expectedHash: string;
    actualHash: string;
    reason: string;
  }[];
  /** Detection timestamp */
  detectedAt: Timestamp;
}
