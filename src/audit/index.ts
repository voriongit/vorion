/**
 * Audit Engine
 *
 * Provides comprehensive audit logging with chain integrity for compliance
 * and forensic analysis.
 *
 * @packageDocumentation
 */

// Types
export type {
  AuditSeverity,
  AuditOutcome,
  AuditCategory,
  AuditEventType,
  ActorType,
  TargetType,
  AuditActor,
  AuditTarget,
  AuditStateChange,
  AuditRecord,
  CreateAuditRecordInput,
  AuditQueryFilters,
  AuditQueryResult,
  ChainIntegrityResult,
  // Retention types
  AuditArchiveResult,
  AuditPurgeResult,
  AuditCleanupResult,
} from './types.js';

export {
  AUDIT_SEVERITIES,
  AUDIT_OUTCOMES,
  AUDIT_CATEGORIES,
  AUDIT_EVENT_TYPES,
  ACTOR_TYPES,
  TARGET_TYPES,
} from './types.js';

// Service
export {
  AuditService,
  AuditHelper,
  createAuditService,
  createAuditHelper,
} from './service.js';
