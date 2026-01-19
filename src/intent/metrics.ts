/**
 * INTENT Metrics - Prometheus-compatible observability
 *
 * Provides comprehensive metrics for monitoring intent processing,
 * queue health, trust gate decisions, and system performance.
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import type { IntentStatus } from '../common/types.js';

// Create a dedicated registry for intent metrics
export const intentRegistry = new Registry();

// Collect default Node.js metrics (CPU, memory, event loop)
collectDefaultMetrics({ register: intentRegistry, prefix: 'vorion_' });

// ============================================================================
// Intent Lifecycle Metrics
// ============================================================================

/**
 * Total intents submitted, labeled by tenant, intent type, and outcome
 */
export const intentsSubmittedTotal = new Counter({
  name: 'vorion_intents_submitted_total',
  help: 'Total number of intents submitted',
  labelNames: ['tenant_id', 'intent_type', 'outcome'] as const,
  registers: [intentRegistry],
});

/**
 * Intent status transitions
 */
export const intentStatusTransitions = new Counter({
  name: 'vorion_intent_status_transitions_total',
  help: 'Total number of intent status transitions',
  labelNames: ['tenant_id', 'from_status', 'to_status'] as const,
  registers: [intentRegistry],
});

/**
 * Current intents by status (gauge)
 */
export const intentsCurrentByStatus = new Gauge({
  name: 'vorion_intents_current',
  help: 'Current number of intents by status',
  labelNames: ['tenant_id', 'status'] as const,
  registers: [intentRegistry],
});

/**
 * Intent processing duration (from submission to terminal state)
 */
export const intentProcessingDuration = new Histogram({
  name: 'vorion_intent_processing_duration_seconds',
  help: 'Time from intent submission to terminal state',
  labelNames: ['tenant_id', 'intent_type', 'final_status'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [intentRegistry],
});

// ============================================================================
// Trust Gate Metrics
// ============================================================================

/**
 * Trust gate evaluations
 */
export const trustGateEvaluations = new Counter({
  name: 'vorion_trust_gate_evaluations_total',
  help: 'Total trust gate evaluations',
  labelNames: ['tenant_id', 'intent_type', 'result'] as const, // result: passed, rejected, bypassed
  registers: [intentRegistry],
});

/**
 * Trust level distribution at submission
 */
export const trustLevelAtSubmission = new Histogram({
  name: 'vorion_trust_level_at_submission',
  help: 'Distribution of trust levels at intent submission',
  labelNames: ['tenant_id', 'intent_type'] as const,
  buckets: [0, 1, 2, 3, 4],
  registers: [intentRegistry],
});

// ============================================================================
// Queue Metrics
// ============================================================================

/**
 * Queue depth (waiting jobs)
 */
export const queueDepth = new Gauge({
  name: 'vorion_queue_depth',
  help: 'Number of jobs waiting in queue',
  labelNames: ['queue_name'] as const,
  registers: [intentRegistry],
});

/**
 * Queue active jobs
 */
export const queueActiveJobs = new Gauge({
  name: 'vorion_queue_active_jobs',
  help: 'Number of jobs currently being processed',
  labelNames: ['queue_name'] as const,
  registers: [intentRegistry],
});

/**
 * Jobs processed total
 */
export const jobsProcessedTotal = new Counter({
  name: 'vorion_jobs_processed_total',
  help: 'Total jobs processed by queue workers',
  labelNames: ['queue_name', 'result'] as const, // result: success, failure, retry
  registers: [intentRegistry],
});

/**
 * Job processing duration
 */
export const jobProcessingDuration = new Histogram({
  name: 'vorion_job_processing_duration_seconds',
  help: 'Time to process a single job',
  labelNames: ['queue_name'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [intentRegistry],
});

/**
 * Dead letter queue size
 */
export const dlqSize = new Gauge({
  name: 'vorion_dlq_size',
  help: 'Number of jobs in dead letter queue',
  registers: [intentRegistry],
});

// ============================================================================
// Escalation Metrics
// ============================================================================

/**
 * Escalations created
 */
export const escalationsCreated = new Counter({
  name: 'vorion_escalations_created_total',
  help: 'Total escalations created',
  labelNames: ['tenant_id', 'intent_type', 'reason_category'] as const,
  registers: [intentRegistry],
});

/**
 * Escalation resolutions
 */
export const escalationResolutions = new Counter({
  name: 'vorion_escalation_resolutions_total',
  help: 'Total escalation resolutions',
  labelNames: ['tenant_id', 'resolution'] as const, // resolution: approved, rejected, timeout
  registers: [intentRegistry],
});

/**
 * Escalation pending duration
 */
export const escalationPendingDuration = new Histogram({
  name: 'vorion_escalation_pending_duration_seconds',
  help: 'Time escalations remain pending before resolution',
  labelNames: ['tenant_id', 'resolution'] as const,
  buckets: [60, 300, 600, 1800, 3600, 7200, 14400, 28800, 86400],
  registers: [intentRegistry],
});

/**
 * Current pending escalations
 */
export const escalationsPending = new Gauge({
  name: 'vorion_escalations_pending',
  help: 'Current number of pending escalations',
  labelNames: ['tenant_id'] as const,
  registers: [intentRegistry],
});

// ============================================================================
// Encryption Metrics
// ============================================================================

/**
 * Encryption operations
 */
export const encryptionOperations = new Counter({
  name: 'vorion_encryption_operations_total',
  help: 'Total encryption/decryption operations',
  labelNames: ['operation'] as const, // operation: encrypt, decrypt
  registers: [intentRegistry],
});

/**
 * Encryption duration
 */
export const encryptionDuration = new Histogram({
  name: 'vorion_encryption_duration_seconds',
  help: 'Time for encryption/decryption operations',
  labelNames: ['operation'] as const,
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [intentRegistry],
});

// ============================================================================
// Policy Evaluation Metrics
// ============================================================================

/**
 * Policy evaluations total
 */
export const policyEvaluationsTotal = new Counter({
  name: 'vorion_policy_evaluations_total',
  help: 'Total policy evaluations',
  labelNames: ['tenant_id', 'namespace', 'result'] as const, // result: allow, deny, escalate
  registers: [intentRegistry],
});

/**
 * Policy evaluation duration
 */
export const policyEvaluationDuration = new Histogram({
  name: 'vorion_policy_evaluation_duration_seconds',
  help: 'Time to evaluate policies',
  labelNames: ['tenant_id', 'namespace'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [intentRegistry],
});

/**
 * Policies matched per evaluation
 */
export const policiesMatchedPerEvaluation = new Histogram({
  name: 'vorion_policies_matched_per_evaluation',
  help: 'Number of policies that matched per evaluation',
  labelNames: ['tenant_id', 'namespace'] as const,
  buckets: [0, 1, 2, 3, 5, 10, 20],
  registers: [intentRegistry],
});

/**
 * Policy overrides (policy action differed from rule action)
 */
export const policyOverridesTotal = new Counter({
  name: 'vorion_policy_overrides_total',
  help: 'Total times policy evaluation overrode rule decision',
  labelNames: ['tenant_id', 'rule_action', 'policy_action'] as const,
  registers: [intentRegistry],
});

/**
 * Policies loaded from cache vs database
 */
export const policyLoadSource = new Counter({
  name: 'vorion_policy_load_source_total',
  help: 'Policy load source (local cache, redis, database)',
  labelNames: ['source'] as const, // source: local, redis, database
  registers: [intentRegistry],
});

// ============================================================================
// Database Metrics
// ============================================================================

/**
 * Database query duration (histogram)
 */
export const dbQueryDuration = new Histogram({
  name: 'vorion_db_query_duration_seconds',
  help: 'Database query execution time in seconds',
  labelNames: ['operation'] as const, // operation: select, insert, update, delete, other
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [intentRegistry],
});

/**
 * Total database queries by operation type
 */
export const dbQueryTotal = new Counter({
  name: 'vorion_db_query_total',
  help: 'Total number of database queries by operation type',
  labelNames: ['operation'] as const, // operation: select, insert, update, delete, other
  registers: [intentRegistry],
});

/**
 * Total failed database queries
 */
export const dbQueryErrorsTotal = new Counter({
  name: 'vorion_db_query_errors_total',
  help: 'Total number of failed database queries',
  labelNames: ['operation', 'error_type'] as const,
  registers: [intentRegistry],
});

/**
 * Current active database connections
 */
export const dbPoolConnectionsActive = new Gauge({
  name: 'vorion_db_pool_connections_active',
  help: 'Current number of active database connections',
  registers: [intentRegistry],
});

/**
 * Current idle database connections
 */
export const dbPoolConnectionsIdle = new Gauge({
  name: 'vorion_db_pool_connections_idle',
  help: 'Current number of idle database connections',
  registers: [intentRegistry],
});

/**
 * Clients waiting for a connection
 */
export const dbPoolConnectionsWaiting = new Gauge({
  name: 'vorion_db_pool_connections_waiting',
  help: 'Number of clients waiting for a database connection',
  registers: [intentRegistry],
});

// ============================================================================
// Error Metrics
// ============================================================================

/**
 * Errors by type
 */
export const errorsTotal = new Counter({
  name: 'vorion_intent_errors_total',
  help: 'Total errors in intent processing',
  labelNames: ['error_code', 'component'] as const,
  registers: [intentRegistry],
});

// ============================================================================
// Cleanup Metrics
// ============================================================================

/**
 * Cleanup job runs
 */
export const cleanupJobRuns = new Counter({
  name: 'vorion_cleanup_job_runs_total',
  help: 'Total cleanup job executions',
  labelNames: ['result'] as const, // result: success, failure
  registers: [intentRegistry],
});

/**
 * Records cleaned up
 */
export const recordsCleanedUp = new Counter({
  name: 'vorion_records_cleaned_up_total',
  help: 'Total records cleaned up',
  labelNames: ['type'] as const, // type: events, intents
  registers: [intentRegistry],
});

// ============================================================================
// Scheduler Leadership Metrics
// ============================================================================

/**
 * Leader elections total (counts each time an instance becomes leader)
 */
export const schedulerLeaderElectionsTotal = new Counter({
  name: 'vorion_scheduler_leader_elections_total',
  help: 'Total number of scheduler leadership acquisitions',
  registers: [intentRegistry],
});

/**
 * Is this instance the scheduler leader (1 if leader, 0 if not)
 */
export const schedulerIsLeader = new Gauge({
  name: 'vorion_scheduler_is_leader',
  help: 'Whether this instance is the scheduler leader (1=leader, 0=not leader)',
  registers: [intentRegistry],
});

// ============================================================================
// Token Revocation Metrics
// ============================================================================

/**
 * Tokens revoked total, labeled by revocation type
 */
export const tokensRevokedTotal = new Counter({
  name: 'vorion_tokens_revoked_total',
  help: 'Total number of tokens revoked',
  labelNames: ['type'] as const, // type: single, user_all
  registers: [intentRegistry],
});

/**
 * Token revocation check results
 */
export const tokenRevocationChecks = new Counter({
  name: 'vorion_token_revocation_checks_total',
  help: 'Total token revocation checks performed',
  labelNames: ['result'] as const, // result: valid, revoked, missing_jti
  registers: [intentRegistry],
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Record an intent submission with all relevant labels
 */
export function recordIntentSubmission(
  tenantId: string,
  intentType: string | null | undefined,
  outcome: 'success' | 'duplicate' | 'rejected' | 'error',
  trustLevel?: number
): void {
  intentsSubmittedTotal.inc({
    tenant_id: tenantId,
    intent_type: intentType ?? 'default',
    outcome,
  });

  if (trustLevel !== undefined) {
    trustLevelAtSubmission.observe(
      { tenant_id: tenantId, intent_type: intentType ?? 'default' },
      trustLevel
    );
  }
}

/**
 * Record a trust gate evaluation
 */
export function recordTrustGateEvaluation(
  tenantId: string,
  intentType: string | null | undefined,
  result: 'passed' | 'rejected' | 'bypassed'
): void {
  trustGateEvaluations.inc({
    tenant_id: tenantId,
    intent_type: intentType ?? 'default',
    result,
  });
}

/**
 * Record a status transition
 */
export function recordStatusTransition(
  tenantId: string,
  fromStatus: IntentStatus | 'new',
  toStatus: IntentStatus
): void {
  intentStatusTransitions.inc({
    tenant_id: tenantId,
    from_status: fromStatus,
    to_status: toStatus,
  });
}

/**
 * Record job processing result
 */
export function recordJobResult(
  queueName: string,
  result: 'success' | 'failure' | 'retry',
  durationSeconds: number
): void {
  jobsProcessedTotal.inc({ queue_name: queueName, result });
  jobProcessingDuration.observe({ queue_name: queueName }, durationSeconds);
}

/**
 * Update queue gauges
 */
export function updateQueueGauges(
  queueName: string,
  waiting: number,
  active: number
): void {
  queueDepth.set({ queue_name: queueName }, waiting);
  queueActiveJobs.set({ queue_name: queueName }, active);
}

/**
 * Record an error
 */
export function recordError(errorCode: string, component: string): void {
  errorsTotal.inc({ error_code: errorCode, component });
}

/**
 * Record policy evaluation metrics
 */
export function recordPolicyEvaluation(
  tenantId: string,
  namespace: string,
  result: 'allow' | 'deny' | 'escalate',
  durationSeconds: number,
  matchedCount: number
): void {
  policyEvaluationsTotal.inc({ tenant_id: tenantId, namespace, result });
  policyEvaluationDuration.observe({ tenant_id: tenantId, namespace }, durationSeconds);
  policiesMatchedPerEvaluation.observe({ tenant_id: tenantId, namespace }, matchedCount);
}

/**
 * Record policy override
 */
export function recordPolicyOverride(
  tenantId: string,
  ruleAction: string,
  policyAction: string
): void {
  policyOverridesTotal.inc({ tenant_id: tenantId, rule_action: ruleAction, policy_action: policyAction });
}

// ============================================================================
// Database Metrics Helper Functions
// ============================================================================

/**
 * Database operation types for labeling queries
 */
export type DbOperationType = 'select' | 'insert' | 'update' | 'delete' | 'other';

/**
 * Detect operation type from SQL query string
 */
export function detectOperationType(sql: string): DbOperationType {
  const trimmed = sql.trim().toLowerCase();
  if (trimmed.startsWith('select')) return 'select';
  if (trimmed.startsWith('insert')) return 'insert';
  if (trimmed.startsWith('update')) return 'update';
  if (trimmed.startsWith('delete')) return 'delete';
  return 'other';
}

/**
 * Record a successful database query with timing
 */
export function recordDbQuery(operation: DbOperationType, durationSeconds: number): void {
  dbQueryTotal.inc({ operation });
  dbQueryDuration.observe({ operation }, durationSeconds);
}

/**
 * Record a failed database query
 */
export function recordDbQueryError(operation: DbOperationType, errorType: string): void {
  dbQueryErrorsTotal.inc({ operation, error_type: errorType });
}

/**
 * Update database pool connection gauges
 */
export function updateDbPoolMetrics(
  active: number,
  idle: number,
  waiting: number
): void {
  dbPoolConnectionsActive.set(active);
  dbPoolConnectionsIdle.set(idle);
  dbPoolConnectionsWaiting.set(waiting);
}

/**
 * Get all metrics as Prometheus text format
 */
export async function getMetrics(): Promise<string> {
  return intentRegistry.metrics();
}

/**
 * Get metrics content type
 */
export function getMetricsContentType(): string {
  return intentRegistry.contentType;
}
