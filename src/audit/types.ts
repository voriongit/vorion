/**
 * Audit Engine Type Definitions
 *
 * Defines audit events, records, and related types for comprehensive
 * audit logging with chain integrity.
 *
 * @packageDocumentation
 */

import type { ID, Timestamp } from '../common/types.js';

// =============================================================================
// AUDIT SEVERITY & OUTCOME
// =============================================================================

export const AUDIT_SEVERITIES = ['info', 'warning', 'error', 'critical'] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export const AUDIT_OUTCOMES = ['success', 'failure', 'partial'] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

// =============================================================================
// AUDIT EVENT CATEGORIES
// =============================================================================

export const AUDIT_CATEGORIES = [
  'intent',
  'policy',
  'escalation',
  'authentication',
  'authorization',
  'data',
  'system',
  'admin',
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

// =============================================================================
// AUDIT EVENT TYPES
// =============================================================================

export const AUDIT_EVENT_TYPES = {
  // Intent lifecycle
  'intent.created': { category: 'intent', severity: 'info' },
  'intent.submitted': { category: 'intent', severity: 'info' },
  'intent.evaluation.started': { category: 'intent', severity: 'info' },
  'intent.evaluation.completed': { category: 'intent', severity: 'info' },
  'intent.approved': { category: 'intent', severity: 'info' },
  'intent.denied': { category: 'intent', severity: 'warning' },
  'intent.escalated': { category: 'intent', severity: 'warning' },
  'intent.execution.started': { category: 'intent', severity: 'info' },
  'intent.completed': { category: 'intent', severity: 'info' },
  'intent.failed': { category: 'intent', severity: 'error' },
  'intent.cancelled': { category: 'intent', severity: 'warning' },
  'intent.status.changed': { category: 'intent', severity: 'info' },
  'intent.replayed': { category: 'intent', severity: 'info' },
  'intent.deleted': { category: 'intent', severity: 'warning' },

  // Policy events
  'policy.created': { category: 'policy', severity: 'info' },
  'policy.updated': { category: 'policy', severity: 'info' },
  'policy.published': { category: 'policy', severity: 'info' },
  'policy.deprecated': { category: 'policy', severity: 'warning' },
  'policy.archived': { category: 'policy', severity: 'warning' },
  'policy.evaluation.started': { category: 'policy', severity: 'info' },
  'policy.evaluation.completed': { category: 'policy', severity: 'info' },
  'policy.violation': { category: 'policy', severity: 'warning' },

  // Escalation events
  'escalation.created': { category: 'escalation', severity: 'warning' },
  'escalation.acknowledged': { category: 'escalation', severity: 'info' },
  'escalation.approved': { category: 'escalation', severity: 'info' },
  'escalation.rejected': { category: 'escalation', severity: 'warning' },
  'escalation.timeout': { category: 'escalation', severity: 'error' },
  'escalation.cancelled': { category: 'escalation', severity: 'warning' },
  'escalation.sla.breached': { category: 'escalation', severity: 'critical' },

  // Authentication events
  'auth.login': { category: 'authentication', severity: 'info' },
  'auth.logout': { category: 'authentication', severity: 'info' },
  'auth.failed': { category: 'authentication', severity: 'warning' },
  'auth.token.issued': { category: 'authentication', severity: 'info' },
  'auth.token.revoked': { category: 'authentication', severity: 'info' },
  'auth.token.expired': { category: 'authentication', severity: 'info' },

  // Authorization events
  'authz.denied': { category: 'authorization', severity: 'warning' },
  'authz.granted': { category: 'authorization', severity: 'info' },
  'authz.elevated': { category: 'authorization', severity: 'warning' },

  // Data events
  'data.read': { category: 'data', severity: 'info' },
  'data.created': { category: 'data', severity: 'info' },
  'data.updated': { category: 'data', severity: 'info' },
  'data.deleted': { category: 'data', severity: 'warning' },
  'data.exported': { category: 'data', severity: 'warning' },

  // System events
  'system.startup': { category: 'system', severity: 'info' },
  'system.shutdown': { category: 'system', severity: 'info' },
  'system.error': { category: 'system', severity: 'error' },
  'system.warning': { category: 'system', severity: 'warning' },
  'system.config.changed': { category: 'system', severity: 'info' },

  // Admin events
  'admin.user.created': { category: 'admin', severity: 'info' },
  'admin.user.updated': { category: 'admin', severity: 'info' },
  'admin.user.deleted': { category: 'admin', severity: 'warning' },
  'admin.permission.granted': { category: 'admin', severity: 'info' },
  'admin.permission.revoked': { category: 'admin', severity: 'warning' },
} as const;

export type AuditEventType = keyof typeof AUDIT_EVENT_TYPES;

// =============================================================================
// ACTOR TYPES
// =============================================================================

export const ACTOR_TYPES = ['user', 'agent', 'service', 'system'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

// =============================================================================
// TARGET TYPES
// =============================================================================

export const TARGET_TYPES = [
  'intent',
  'policy',
  'escalation',
  'entity',
  'tenant',
  'user',
  'system',
] as const;

export type TargetType = (typeof TARGET_TYPES)[number];

// =============================================================================
// AUDIT RECORD
// =============================================================================

/**
 * Actor information
 */
export interface AuditActor {
  type: ActorType;
  id: ID;
  name?: string;
  ip?: string;
}

/**
 * Target of the audited action
 */
export interface AuditTarget {
  type: TargetType;
  id: ID;
  name?: string;
}

/**
 * State change tracking
 */
export interface AuditStateChange {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  diff?: Record<string, unknown>;
}

/**
 * Complete audit record as stored in database
 */
export interface AuditRecord {
  id: ID;
  tenantId: ID;

  // Event identification
  eventType: string;
  eventCategory: AuditCategory;
  severity: AuditSeverity;

  // Actor
  actor: AuditActor;

  // Target
  target: AuditTarget;

  // Context
  requestId: ID;
  traceId?: string | null;
  spanId?: string | null;

  // Event details
  action: string;
  outcome: AuditOutcome;
  reason?: string | null;

  // State tracking
  stateChange?: AuditStateChange | null;

  // Additional data
  metadata?: Record<string, unknown> | null;
  tags?: string[] | null;

  // Chain integrity
  sequenceNumber: number;
  previousHash?: string | null;
  recordHash: string;

  // Timestamps
  eventTime: Timestamp;
  recordedAt: Timestamp;

  // Archive status
  archived: boolean;
  archivedAt?: Timestamp | null;
}

// =============================================================================
// CREATE AUDIT RECORD INPUT
// =============================================================================

/**
 * Input for creating an audit record
 */
export interface CreateAuditRecordInput {
  tenantId: ID;
  eventType: string;
  actor: AuditActor;
  target: AuditTarget;
  action: string;
  outcome: AuditOutcome;
  reason?: string;
  stateChange?: AuditStateChange;
  metadata?: Record<string, unknown>;
  tags?: string[];
  // Optional context (auto-populated from trace context if available)
  requestId?: ID;
  traceId?: string;
  spanId?: string;
  eventTime?: Timestamp;
}

// =============================================================================
// QUERY FILTERS
// =============================================================================

export interface AuditQueryFilters {
  tenantId: ID;
  eventType?: string;
  eventCategory?: AuditCategory;
  severity?: AuditSeverity;
  actorId?: ID;
  actorType?: ActorType;
  targetId?: ID;
  targetType?: TargetType;
  outcome?: AuditOutcome;
  requestId?: ID;
  traceId?: string;
  tags?: string[];
  startTime?: Timestamp;
  endTime?: Timestamp;
  limit?: number;
  offset?: number;
  orderBy?: 'eventTime' | 'recordedAt';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Paginated audit query result
 */
export interface AuditQueryResult {
  records: AuditRecord[];
  total: number;
  hasMore: boolean;
}

// =============================================================================
// CHAIN INTEGRITY
// =============================================================================

/**
 * Result of chain integrity verification
 */
export interface ChainIntegrityResult {
  valid: boolean;
  recordsChecked: number;
  firstRecord?: ID;
  lastRecord?: ID;
  brokenAt?: ID;
  error?: string;
}

// =============================================================================
// AUDIT RETENTION & ARCHIVAL
// =============================================================================

/**
 * Result of audit archive operation
 */
export interface AuditArchiveResult {
  recordsArchived: number;
  durationMs: number;
  oldestArchivedDate?: Timestamp;
  newestArchivedDate?: Timestamp;
}

/**
 * Result of audit purge operation
 */
export interface AuditPurgeResult {
  recordsPurged: number;
  durationMs: number;
  oldestPurgedDate?: Timestamp;
  newestPurgedDate?: Timestamp;
}

/**
 * Combined result of audit cleanup operation
 */
export interface AuditCleanupResult {
  archived: AuditArchiveResult;
  purged: AuditPurgeResult;
  totalDurationMs: number;
  errors: string[];
}
