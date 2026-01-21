/**
 * ENFORCE Module Type Definitions
 *
 * Comprehensive types for the enforcement decision engine, including
 * decision records, constraint evaluation, caching, metrics, and audit.
 *
 * @packageDocumentation
 */

import type {
  ID,
  Timestamp,
  ControlAction,
  TrustLevel,
  TrustScore,
  EntityType,
  Intent,
} from '../common/types.js';
import type { PolicyEvaluationResult } from '../policy/types.js';
import type { EvaluationResult } from '../basis/types.js';

// =============================================================================
// CONSTRAINT TYPES
// =============================================================================

/**
 * Types of constraints that can be evaluated
 */
export const CONSTRAINT_TYPES = [
  'trust_level',
  'policy_rule',
  'rate_limit',
  'time_window',
  'geo_restriction',
  'custom',
] as const;

export type ConstraintType = (typeof CONSTRAINT_TYPES)[number];

// =============================================================================
// CONTEXT TYPES
// =============================================================================

/**
 * Entity context for enforcement decisions
 */
export interface EntityContext {
  /** Unique entity identifier */
  id: ID;
  /** Type of entity (agent, user, service, system) */
  type: EntityType;
  /** Current trust score (0-1000) */
  trustScore: TrustScore;
  /** Current trust level (L0-L4) */
  trustLevel: TrustLevel;
  /** Additional entity attributes */
  attributes: Record<string, unknown>;
}

/**
 * Environment context for enforcement decisions
 */
export interface EnvironmentContext {
  /** Current timestamp in ISO 8601 format */
  timestamp: Timestamp;
  /** Timezone for time-based evaluations */
  timezone: string;
  /** Unique request identifier */
  requestId: ID;
  /** Client IP address */
  clientIp?: string;
  /** Client user agent string */
  userAgent?: string;
}

/**
 * Trust record snapshot at decision time
 */
export interface TrustRecord {
  /** Entity ID the trust record belongs to */
  entityId: ID;
  /** Trust score at evaluation time */
  score: TrustScore;
  /** Trust level at evaluation time */
  level: TrustLevel;
  /** Timestamp when trust was last computed */
  computedAt: Timestamp;
  /** Components that make up the trust score */
  components?: {
    behavioral: number;
    compliance: number;
    identity: number;
    context: number;
  };
}

/**
 * Extended context for making enforcement decisions
 *
 * Combines intent, entity, environment, and policy evaluation data
 * to provide complete context for the decision engine.
 */
export interface EnforcementContext {
  /** The intent being evaluated */
  intent: Intent;
  /** Entity making the request */
  entity: EntityContext;
  /** Environmental context */
  environment: EnvironmentContext;
  /** Result of policy evaluation from the policy engine */
  policyEvaluation: PolicyEvaluationResult;
  /** Optional trust record snapshot */
  trustRecord?: TrustRecord;
  /** Additional metadata for the enforcement context */
  metadata: Record<string, unknown>;
  /** Result of BASIS rule evaluation */
  evaluation: EvaluationResult;
  /** Trust score at evaluation time */
  trustScore: TrustScore;
  /** Trust level at evaluation time */
  trustLevel: TrustLevel;
}

// =============================================================================
// CONSTRAINT EVALUATION
// =============================================================================

/**
 * Result of evaluating an individual constraint
 */
export interface ConstraintResult {
  /** Unique constraint identifier */
  constraintId: string;
  /** Type of constraint evaluated */
  constraintType?: ConstraintType;
  /** Human-readable name for the constraint */
  constraintName?: string;
  /** Whether the constraint passed */
  passed: boolean;
  /** Resulting action from this constraint */
  action: ControlAction;
  /** Human-readable reason for the result */
  reason?: string;
  /** Additional details about the evaluation */
  details?: Record<string, unknown>;
  /** Time taken to evaluate this constraint in milliseconds */
  durationMs: number;
  /** Timestamp when constraint was evaluated */
  evaluatedAt?: Timestamp;
}

// =============================================================================
// ENFORCEMENT DECISION
// =============================================================================

/**
 * Complete enforcement decision record
 *
 * Represents the full decision made by the enforcement engine,
 * including all evaluated policies, constraints, and metadata.
 */
export interface EnforcementDecision {
  /** Unique decision identifier (UUID) */
  id: ID;
  /** ID of the intent this decision is for */
  intentId: ID;
  /** Tenant this decision belongs to */
  tenantId: ID;
  /** Final action to be taken */
  action: ControlAction;
  /** Human-readable reason for the decision */
  reason: string;
  /** Confidence score for this decision (0-1) */
  confidence: number;
  /** All policy evaluations that were performed */
  policiesEvaluated: PolicyEvaluationResult[];
  /** The policy that determined the final decision (if any) */
  appliedPolicy?: PolicyEvaluationResult;
  /** Results of individual constraint evaluations */
  constraints: ConstraintResult[];
  /** Trust score at decision time */
  trustScore: TrustScore;
  /** Trust level at decision time */
  trustLevel: TrustLevel;
  /** Timestamp when the decision was made */
  decidedAt: Timestamp;
  /** Total time taken to make the decision in milliseconds */
  durationMs: number;
  /** Whether this decision was served from cache */
  cached: boolean;
  /** Distributed tracing trace ID */
  traceId?: string;
  /** Distributed tracing span ID */
  spanId?: string;
}

// =============================================================================
// ESCALATION CONFIGURATION
// =============================================================================

/**
 * Priority levels for escalation rules
 */
export const ESCALATION_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type EscalationPriority = (typeof ESCALATION_PRIORITIES)[number];

/**
 * Types of conditions that can trigger escalation
 */
export const ESCALATION_CONDITION_TYPES = [
  'trust_below',
  'action_type',
  'policy_match',
  'custom',
] as const;
export type EscalationConditionType = (typeof ESCALATION_CONDITION_TYPES)[number];

/**
 * Condition that triggers an escalation
 */
export interface EscalationCondition {
  /** Type of condition */
  type: EscalationConditionType;
  /** Value to compare against (interpretation depends on type) */
  value: unknown;
}

/**
 * Rule defining when and how to escalate a decision
 */
export interface EscalationRule {
  /** Unique rule identifier */
  id?: string;
  /** Human-readable rule name */
  name?: string;
  /** Condition that triggers this escalation (string for simple, object for complex) */
  condition: EscalationCondition | string;
  /** Target to escalate to (group, user, or service) */
  escalateTo: string;
  /** Timeout duration in ISO 8601 duration format */
  timeout: string;
  /** Priority level of this escalation */
  priority?: EscalationPriority;
  /** Whether justification is required for resolution */
  requireJustification?: boolean;
  /** Whether to automatically deny if escalation times out */
  autoDenyOnTimeout?: boolean;
}

// =============================================================================
// ENFORCEMENT POLICY CONFIGURATION
// =============================================================================

/**
 * Configuration for enforcement behavior
 *
 * Defines how the enforcement engine should behave, including
 * default actions, trust requirements, and escalation rules.
 */
export interface EnforcementPolicy {
  /** Default action when no policies match */
  defaultAction: ControlAction;
  /** Minimum trust level required (optional) */
  requireMinTrustLevel?: TrustLevel;
  /** Whether a policy must match for approval */
  requirePolicyMatch?: boolean;
  /** Rules for escalating decisions */
  escalationRules?: EscalationRule[];
  /** Time-to-live for cached decisions in milliseconds */
  decisionCacheTtl?: number;
  /** Whether to enable audit logging */
  enableAudit?: boolean;
  /** Whether to enable metrics collection */
  enableMetrics?: boolean;
}

/**
 * Configuration for the enforcement service
 */
export interface EnforcementConfig {
  /** The enforcement policy to apply */
  policy?: EnforcementPolicy;
  /** Whether audit logging is enabled */
  auditEnabled?: boolean;
  /** TTL for cached decisions in milliseconds */
  cacheTtlMs?: number;
  /** Maximum number of entries in the decision cache */
  maxCacheSize?: number;
  /** Circuit breaker configuration */
  circuitBreaker?: {
    /** Number of failures before opening the circuit */
    failureThreshold?: number;
    /** Time to wait before attempting to close the circuit (ms) */
    resetTimeoutMs?: number;
    /** Number of attempts in half-open state */
    halfOpenMaxAttempts?: number;
    /** Window for monitoring failures (ms) */
    monitorWindowMs?: number;
  };
}

// =============================================================================
// CACHING
// =============================================================================

/**
 * Key used to cache decisions
 */
export interface DecisionCacheKey {
  /** Tenant ID */
  tenantId: ID;
  /** Intent ID */
  intentId: ID;
  /** Entity ID */
  entityId: ID;
  /** Intent type for cache partitioning */
  intentType: string;
  /** Trust level at cache time */
  trustLevel: TrustLevel;
  /** Hash of the intent context for cache invalidation */
  contextHash: string;
}

/**
 * Cached decision entry with ISO timestamp strings
 */
export interface DecisionCacheEntry {
  /** The cached decision */
  decision: EnforcementDecision;
  /** When this entry was cached (ISO timestamp or Unix ms) */
  cachedAt: Timestamp | number;
  /** When this entry expires (ISO timestamp or Unix ms) */
  expiresAt: Timestamp | number;
  /** Number of times this cache entry has been hit */
  hitCount?: number;
}

/**
 * Internal cache entry with numeric timestamps for LRU eviction
 *
 * Uses millisecond timestamps instead of ISO strings for efficient
 * comparison operations in the cache implementation.
 */
export interface CacheEntry {
  /** The cached enforcement decision */
  decision: EnforcementDecision;
  /** Unix timestamp when the entry expires (milliseconds) */
  expiresAt: number;
  /** Number of times this entry has been accessed */
  accessCount: number;
  /** Unix timestamp of the last access (milliseconds) */
  lastAccessedAt: number;
}

/**
 * Configuration options for the decision cache
 */
export interface DecisionCacheOptions {
  /** Time-to-live in milliseconds (default: 60000 - 1 minute) */
  ttlMs?: number;
  /** Maximum number of entries in the local cache (default: 10000) */
  maxSize?: number;
  /** Prefix for Redis keys (default: 'enforce:decision:') */
  redisPrefix?: string;
}

// =============================================================================
// METRICS
// =============================================================================

/**
 * Enforcement metrics for monitoring and observability
 */
export interface EnforcementMetrics {
  /** Total number of decisions made */
  totalDecisions: number;
  /** Breakdown of decisions by action type */
  decisionsByAction: Record<ControlAction, number>;
  /** Breakdown of decisions by trust level */
  decisionsByTrustLevel: Record<TrustLevel, number>;
  /** Average decision duration in milliseconds */
  averageDurationMs: number;
  /** 95th percentile decision duration in milliseconds */
  p95DurationMs: number;
  /** 99th percentile decision duration in milliseconds */
  p99DurationMs: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
  /** Number of cache hits */
  cacheHits: number;
  /** Number of cache misses */
  cacheMisses: number;
  /** Number of escalations triggered */
  escalationsTriggered: number;
  /** Breakdown of escalations by priority */
  escalationsByPriority: Record<EscalationPriority, number>;
  /** Number of policy evaluation errors */
  policyErrors: number;
  /** Number of constraint evaluation errors */
  constraintErrors: number;
  /** Timestamp when metrics were last reset */
  resetAt: Timestamp;
  /** Timestamp when metrics were last updated */
  updatedAt: Timestamp;
}

// =============================================================================
// AUDIT
// =============================================================================

/**
 * Audit severity levels
 */
export const AUDIT_SEVERITIES = ['info', 'warning', 'error', 'critical'] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

/**
 * Audit outcomes
 */
export const AUDIT_OUTCOMES = ['success', 'failure', 'partial'] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

/**
 * Audit log entry for enforcement decisions
 *
 * Provides a complete audit trail of enforcement decisions
 * for compliance and debugging purposes.
 */
export interface EnforcementAuditEntry {
  /** Unique audit entry identifier */
  id: ID;
  /** Tenant this entry belongs to */
  tenantId: ID;
  /** ID of the decision being audited */
  decisionId: ID;
  /** ID of the intent */
  intentId: ID;
  /** ID of the entity that requested the action */
  entityId: ID;
  /** Type of entity */
  entityType: EntityType;
  /** Final action taken */
  action: ControlAction;
  /** Outcome of the enforcement */
  outcome: AuditOutcome;
  /** Severity level of this audit entry */
  severity: AuditSeverity;
  /** Reason for the decision */
  reason: string;
  /** Policies that were evaluated */
  policiesEvaluated: string[];
  /** Policy that was applied (if any) */
  appliedPolicyId?: ID;
  /** Constraints that were evaluated */
  constraintsEvaluated: string[];
  /** Trust score at decision time */
  trustScore: TrustScore;
  /** Trust level at decision time */
  trustLevel: TrustLevel;
  /** Decision duration in milliseconds */
  durationMs: number;
  /** Whether the decision was cached */
  cached: boolean;
  /** Client IP address */
  clientIp?: string;
  /** Client user agent */
  userAgent?: string;
  /** Request ID for correlation */
  requestId: ID;
  /** Distributed tracing trace ID */
  traceId?: string;
  /** Distributed tracing span ID */
  spanId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** When the event occurred */
  eventTime: Timestamp;
  /** When the record was written */
  recordedAt: Timestamp;
}

// =============================================================================
// INPUT/OUTPUT DTOs
// =============================================================================

/**
 * Input for creating an enforcement decision
 */
export interface CreateDecisionInput {
  /** Intent to evaluate */
  intent: Intent;
  /** Entity context */
  entity: EntityContext;
  /** Environment context */
  environment: EnvironmentContext;
  /** Optional policy evaluation override */
  policyEvaluation?: PolicyEvaluationResult;
  /** Optional trust record */
  trustRecord?: TrustRecord;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for decision queries
 */
export interface DecisionQueryOptions {
  /** Filter by tenant ID */
  tenantId: ID;
  /** Filter by intent ID */
  intentId?: ID;
  /** Filter by entity ID */
  entityId?: ID;
  /** Filter by action */
  action?: ControlAction;
  /** Filter by trust level */
  trustLevel?: TrustLevel;
  /** Filter by cached status */
  cached?: boolean;
  /** Start of time range */
  fromDate?: Timestamp;
  /** End of time range */
  toDate?: Timestamp;
  /** Maximum results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Batch decision result
 */
export interface BatchDecisionResult {
  /** Total decisions processed */
  total: number;
  /** Number of successful decisions */
  successful: number;
  /** Number of failed decisions */
  failed: number;
  /** Individual decision results */
  decisions: EnforcementDecision[];
  /** Errors encountered */
  errors: Array<{
    intentId: ID;
    error: string;
  }>;
  /** Total processing time in milliseconds */
  totalDurationMs: number;
}
