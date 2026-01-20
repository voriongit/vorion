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

/**
 * Trust drift at decision time - measures difference between intake snapshot and live score
 * Positive values indicate trust degradation (live < snapshot)
 * Negative values indicate trust improvement (live > snapshot)
 */
export const trustDriftAtDecision = new Histogram({
  name: 'vorion_trust_drift_at_decision',
  help: 'Trust score drift between intake snapshot and decision-time live score (positive = degradation)',
  labelNames: ['tenant_id', 'intent_type'] as const,
  buckets: [-100, -50, -20, -10, 0, 10, 20, 50, 100, 200, 500],
  registers: [intentRegistry],
});

/**
 * Trust degradation events - counts significant trust drops at decision time
 */
export const trustDegradationEventsTotal = new Counter({
  name: 'vorion_trust_degradation_events_total',
  help: 'Total trust degradation events detected at decision time',
  labelNames: ['tenant_id', 'intent_type', 'severity'] as const, // severity: minor, moderate, severe
  registers: [intentRegistry],
});

/**
 * Trust level changes between intake and decision
 */
export const trustLevelChangeAtDecision = new Counter({
  name: 'vorion_trust_level_change_at_decision_total',
  help: 'Trust level changes detected between intake snapshot and decision time',
  labelNames: ['tenant_id', 'intent_type', 'direction'] as const, // direction: improved, degraded, unchanged
  registers: [intentRegistry],
});

/**
 * Decision-time trust fetch latency
 */
export const decisionTimeTrustFetchDuration = new Histogram({
  name: 'vorion_decision_time_trust_fetch_duration_seconds',
  help: 'Time to fetch live trust score at decision time',
  labelNames: ['tenant_id', 'source'] as const, // source: cache, engine
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
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
 * Total database query timeouts (statement_timeout exceeded)
 */
export const queryTimeouts = new Counter({
  name: 'vorion_db_query_timeouts_total',
  help: 'Number of database query timeouts (statement_timeout exceeded)',
  labelNames: ['operation'] as const,
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
// Lock Contention Metrics
// ============================================================================

/**
 * Lock contention events during deduplication
 */
export const deduplicateLockContentionTotal = new Counter({
  name: 'vorion_deduplicate_lock_contention_total',
  help: 'Total lock contention events during intent deduplication',
  labelNames: ['tenant_id', 'outcome'] as const, // outcome: acquired, timeout, conflict
  registers: [intentRegistry],
});

// ============================================================================
// Trust Gate Bypass Metrics
// ============================================================================

/**
 * Trust gate bypass events (when bypassTrustGate is used)
 */
export const trustGateBypassesTotal = new Counter({
  name: 'vorion_trust_gate_bypasses_total',
  help: 'Total trust gate bypass events',
  labelNames: ['tenant_id', 'intent_type'] as const,
  registers: [intentRegistry],
});

// ============================================================================
// Deduplication Metrics
// ============================================================================

/**
 * Intent deduplication attempts
 */
export const intentDeduplicationsTotal = new Counter({
  name: 'vorion_intent_deduplications_total',
  help: 'Total intent deduplication attempts',
  labelNames: ['tenant_id', 'outcome'] as const, // outcome: new, duplicate, race_resolved
  registers: [intentRegistry],
});

// ============================================================================
// Policy Cache Metrics
// ============================================================================

/**
 * Policy cache hits
 */
export const policyCacheHitsTotal = new Counter({
  name: 'vorion_policy_cache_hits_total',
  help: 'Total policy cache hits',
  labelNames: ['tenant_id', 'namespace'] as const,
  registers: [intentRegistry],
});

/**
 * Policy cache misses
 */
export const policyCacheMissesTotal = new Counter({
  name: 'vorion_policy_cache_misses_total',
  help: 'Total policy cache misses',
  labelNames: ['tenant_id', 'namespace'] as const,
  registers: [intentRegistry],
});

// ============================================================================
// SLA Metrics
// ============================================================================

/**
 * Escalation SLA breach rate gauge (0-1 representing percentage)
 */
export const escalationSlaBreachRateGauge = new Gauge({
  name: 'vorion_escalation_sla_breach_rate',
  help: 'Current SLA breach rate for escalations (0-1)',
  labelNames: ['tenant_id'] as const,
  registers: [intentRegistry],
});

// ============================================================================
// Intent Context Metrics
// ============================================================================

/**
 * Intent context size in bytes (histogram)
 */
export const intentContextSizeBytes = new Histogram({
  name: 'vorion_intent_context_size_bytes',
  help: 'Size of intent context payload in bytes',
  labelNames: ['tenant_id', 'intent_type'] as const,
  buckets: [256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536],
  registers: [intentRegistry],
});

// ============================================================================
// Webhook Metrics
// ============================================================================

/**
 * Webhook delivery success counter
 */
export const webhookDeliverySuccessTotal = new Counter({
  name: 'vorion_webhook_delivery_success_total',
  help: 'Total successful webhook deliveries',
  labelNames: ['tenant_id', 'event_type'] as const,
  registers: [intentRegistry],
});

/**
 * Webhook delivery failure counter
 */
export const webhookDeliveryFailureTotal = new Counter({
  name: 'vorion_webhook_delivery_failure_total',
  help: 'Total failed webhook deliveries',
  labelNames: ['tenant_id', 'event_type'] as const,
  registers: [intentRegistry],
});

/**
 * Current circuit breaker state per webhook (0=closed, 1=open, 2=half_open)
 */
export const webhookCircuitBreakerState = new Gauge({
  name: 'vorion_webhook_circuit_breaker_state',
  help: 'Current circuit breaker state (0=closed, 1=open, 2=half_open)',
  labelNames: ['tenant_id', 'webhook_id'] as const,
  registers: [intentRegistry],
});

/**
 * Total number of circuit breaker trips (circuit opening)
 */
export const webhookCircuitBreakerTripsTotal = new Counter({
  name: 'vorion_webhook_circuit_breaker_trips_total',
  help: 'Total number of times circuit breaker has tripped (opened)',
  labelNames: ['tenant_id', 'webhook_id'] as const,
  registers: [intentRegistry],
});

/**
 * Webhook deliveries skipped due to open circuit
 */
export const webhookDeliveriesSkippedTotal = new Counter({
  name: 'vorion_webhook_deliveries_skipped_total',
  help: 'Total webhook deliveries skipped due to open circuit breaker',
  labelNames: ['tenant_id', 'webhook_id'] as const,
  registers: [intentRegistry],
});

/**
 * Circuit breaker state transitions
 */
export const webhookCircuitBreakerTransitions = new Counter({
  name: 'vorion_webhook_circuit_breaker_transitions_total',
  help: 'Total circuit breaker state transitions',
  labelNames: ['tenant_id', 'webhook_id', 'from_state', 'to_state'] as const,
  registers: [intentRegistry],
});

// ============================================================================
// Escalation Approval Rate Metrics
// ============================================================================

/**
 * Escalation approval rate gauge (0-1 representing percentage of approvals)
 */
export const escalationApprovalRateGauge = new Gauge({
  name: 'vorion_escalation_approval_rate',
  help: 'Current approval rate for escalations (0-1)',
  labelNames: ['tenant_id'] as const,
  registers: [intentRegistry],
});

// ============================================================================
// Circuit Breaker Metrics (Generic)
// ============================================================================

/**
 * Circuit breaker state changes (generic, for any circuit breaker)
 */
export const circuitBreakerStateChanges = new Counter({
  name: 'vorion_circuit_breaker_state_changes_total',
  help: 'Total circuit breaker state transitions',
  labelNames: ['name', 'from_state', 'to_state'] as const,
  registers: [intentRegistry],
});

/**
 * Current circuit breaker state (gauge: 0=CLOSED, 1=HALF_OPEN, 2=OPEN)
 */
export const circuitBreakerState = new Gauge({
  name: 'vorion_circuit_breaker_state',
  help: 'Current circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
  labelNames: ['name'] as const,
  registers: [intentRegistry],
});

/**
 * Circuit breaker executions
 */
export const circuitBreakerExecutions = new Counter({
  name: 'vorion_circuit_breaker_executions_total',
  help: 'Total circuit breaker executions',
  labelNames: ['name', 'result'] as const, // result: success, failure, rejected
  registers: [intentRegistry],
});

/**
 * Circuit breaker failure count (gauge for current failure count)
 */
export const circuitBreakerFailures = new Gauge({
  name: 'vorion_circuit_breaker_failures',
  help: 'Current failure count for circuit breaker',
  labelNames: ['name'] as const,
  registers: [intentRegistry],
});

// ============================================================================
// Per-Service Circuit Breaker Metrics
// ============================================================================

/**
 * Per-service circuit breaker state gauge (0=CLOSED, 1=HALF_OPEN, 2=OPEN)
 * Uses 'service' label for service-specific identification
 */
export const serviceCircuitBreakerState = new Gauge({
  name: 'vorion_service_circuit_breaker_state',
  help: 'Current circuit breaker state per service (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
  labelNames: ['service'] as const,
  registers: [intentRegistry],
});

/**
 * Per-service circuit breaker failures total
 */
export const serviceCircuitBreakerFailuresTotal = new Counter({
  name: 'vorion_service_circuit_breaker_failures_total',
  help: 'Total failures recorded by circuit breaker per service',
  labelNames: ['service'] as const,
  registers: [intentRegistry],
});

/**
 * Per-service circuit breaker successes total
 */
export const serviceCircuitBreakerSuccessesTotal = new Counter({
  name: 'vorion_service_circuit_breaker_successes_total',
  help: 'Total successful executions through circuit breaker per service',
  labelNames: ['service'] as const,
  registers: [intentRegistry],
});

/**
 * Per-service circuit breaker trips (circuit opening)
 */
export const serviceCircuitBreakerTripsTotal = new Counter({
  name: 'vorion_service_circuit_breaker_trips_total',
  help: 'Total number of times circuit breaker has tripped (opened) per service',
  labelNames: ['service'] as const,
  registers: [intentRegistry],
});

/**
 * Per-service circuit breaker recovery (circuit closing after half-open)
 */
export const serviceCircuitBreakerRecoveriesTotal = new Counter({
  name: 'vorion_service_circuit_breaker_recoveries_total',
  help: 'Total number of times circuit breaker has recovered (closed from half-open) per service',
  labelNames: ['service'] as const,
  registers: [intentRegistry],
});

/**
 * Per-service circuit breaker half-open attempts
 */
export const serviceCircuitBreakerHalfOpenAttempts = new Gauge({
  name: 'vorion_service_circuit_breaker_half_open_attempts',
  help: 'Current number of half-open attempts per service',
  labelNames: ['service'] as const,
  registers: [intentRegistry],
});

// ============================================================================
// Cognigate Execution Metrics
// ============================================================================

/**
 * Execution attempts total
 */
export const executionsTotal = new Counter({
  name: 'vorion_executions_total',
  help: 'Total execution attempts through Cognigate',
  labelNames: ['tenant_id', 'intent_type', 'result'] as const, // result: success, failure, blocked, timeout
  registers: [intentRegistry],
});

/**
 * Execution duration histogram
 */
export const executionDuration = new Histogram({
  name: 'vorion_execution_duration_seconds',
  help: 'Time to execute intents through Cognigate',
  labelNames: ['tenant_id', 'intent_type'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [intentRegistry],
});

/**
 * Execution resource usage - memory peak
 */
export const executionMemoryPeak = new Histogram({
  name: 'vorion_execution_memory_peak_mb',
  help: 'Peak memory usage during execution in MB',
  labelNames: ['tenant_id', 'intent_type'] as const,
  buckets: [16, 32, 64, 128, 256, 512, 1024, 2048],
  registers: [intentRegistry],
});

/**
 * Current executions in progress (gauge)
 */
export const executionsInProgress = new Gauge({
  name: 'vorion_executions_in_progress',
  help: 'Number of executions currently in progress',
  labelNames: ['tenant_id'] as const,
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
// Batch Operation Metrics
// ============================================================================

/**
 * Batch operations total
 */
export const batchOperationsTotal = new Counter({
  name: 'vorion_batch_operations_total',
  help: 'Total batch operations',
  labelNames: ['tenant_id', 'operation', 'result'] as const, // operation: submit, result: success, partial, failure
  registers: [intentRegistry],
});

/**
 * Batch operation size (number of items)
 */
export const batchOperationSize = new Histogram({
  name: 'vorion_batch_operation_size',
  help: 'Number of items in batch operations',
  labelNames: ['tenant_id', 'operation'] as const,
  buckets: [1, 5, 10, 20, 50, 100],
  registers: [intentRegistry],
});

/**
 * Batch operation duration
 */
export const batchOperationDuration = new Histogram({
  name: 'vorion_batch_operation_duration_seconds',
  help: 'Duration of batch operations',
  labelNames: ['tenant_id', 'operation'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [intentRegistry],
});

/**
 * Batch operation items per second
 */
export const batchOperationThroughput = new Histogram({
  name: 'vorion_batch_operation_throughput',
  help: 'Items processed per second in batch operations',
  labelNames: ['tenant_id', 'operation'] as const,
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
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
 * Severity thresholds for trust degradation (in score points)
 */
const TRUST_DEGRADATION_THRESHOLDS = {
  minor: 20, // 20-49 point drop
  moderate: 50, // 50-99 point drop
  severe: 100, // 100+ point drop
};

/**
 * Record trust drift metrics at decision time
 *
 * @param tenantId - Tenant identifier
 * @param intentType - Type of intent
 * @param snapshotScore - Trust score captured at intake
 * @param liveScore - Trust score fetched at decision time
 * @param snapshotLevel - Trust level at intake
 * @param liveLevel - Trust level at decision time
 */
export function recordTrustDrift(
  tenantId: string,
  intentType: string | null | undefined,
  snapshotScore: number,
  liveScore: number,
  snapshotLevel: number,
  liveLevel: number
): void {
  const drift = snapshotScore - liveScore; // positive = degradation
  const type = intentType ?? 'default';

  // Record the drift histogram
  trustDriftAtDecision.observe(
    { tenant_id: tenantId, intent_type: type },
    drift
  );

  // Record level change direction
  let direction: 'improved' | 'degraded' | 'unchanged';
  if (liveLevel > snapshotLevel) {
    direction = 'improved';
  } else if (liveLevel < snapshotLevel) {
    direction = 'degraded';
  } else {
    direction = 'unchanged';
  }
  trustLevelChangeAtDecision.inc({
    tenant_id: tenantId,
    intent_type: type,
    direction,
  });

  // Record degradation event if significant
  if (drift >= TRUST_DEGRADATION_THRESHOLDS.severe) {
    trustDegradationEventsTotal.inc({
      tenant_id: tenantId,
      intent_type: type,
      severity: 'severe',
    });
  } else if (drift >= TRUST_DEGRADATION_THRESHOLDS.moderate) {
    trustDegradationEventsTotal.inc({
      tenant_id: tenantId,
      intent_type: type,
      severity: 'moderate',
    });
  } else if (drift >= TRUST_DEGRADATION_THRESHOLDS.minor) {
    trustDegradationEventsTotal.inc({
      tenant_id: tenantId,
      intent_type: type,
      severity: 'minor',
    });
  }
}

/**
 * Record decision-time trust fetch duration
 */
export function recordDecisionTimeTrustFetch(
  tenantId: string,
  source: 'cache' | 'engine',
  durationSeconds: number
): void {
  decisionTimeTrustFetchDuration.observe(
    { tenant_id: tenantId, source },
    durationSeconds
  );
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
 * Record a database query timeout (statement_timeout exceeded)
 */
export function recordQueryTimeout(operation: string): void {
  queryTimeouts.inc({ operation });
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

// ============================================================================
// New Observability Metrics Helper Functions
// ============================================================================

/**
 * Record lock contention during deduplication
 */
export function recordLockContention(
  tenantId: string,
  outcome: 'acquired' | 'timeout' | 'conflict'
): void {
  deduplicateLockContentionTotal.inc({ tenant_id: tenantId, outcome });
}

/**
 * Record trust gate bypass
 */
export function recordTrustGateBypass(
  tenantId: string,
  intentType: string | null | undefined
): void {
  trustGateBypassesTotal.inc({
    tenant_id: tenantId,
    intent_type: intentType ?? 'default',
  });
}

/**
 * Record deduplication attempt
 */
export function recordDeduplication(
  tenantId: string,
  outcome: 'new' | 'duplicate' | 'race_resolved'
): void {
  intentDeduplicationsTotal.inc({ tenant_id: tenantId, outcome });
}

/**
 * Record policy cache hit
 */
export function recordPolicyCacheHit(tenantId: string, namespace: string): void {
  policyCacheHitsTotal.inc({ tenant_id: tenantId, namespace });
}

/**
 * Record policy cache miss
 */
export function recordPolicyCacheMiss(tenantId: string, namespace: string): void {
  policyCacheMissesTotal.inc({ tenant_id: tenantId, namespace });
}

/**
 * Update SLA breach rate gauge
 */
export function updateSlaBreachRate(tenantId: string, breachRate: number): void {
  escalationSlaBreachRateGauge.set({ tenant_id: tenantId }, breachRate);
}

/**
 * Record intent context size
 */
export function recordIntentContextSize(
  tenantId: string,
  intentType: string | null | undefined,
  sizeBytes: number
): void {
  intentContextSizeBytes.observe(
    { tenant_id: tenantId, intent_type: intentType ?? 'default' },
    sizeBytes
  );
}

/**
 * Record webhook delivery result
 */
export function recordWebhookDelivery(
  tenantId: string,
  eventType: string,
  success: boolean
): void {
  if (success) {
    webhookDeliverySuccessTotal.inc({ tenant_id: tenantId, event_type: eventType });
  } else {
    webhookDeliveryFailureTotal.inc({ tenant_id: tenantId, event_type: eventType });
  }
}

/**
 * Update escalation approval rate gauge
 */
export function updateEscalationApprovalRate(tenantId: string, approvalRate: number): void {
  escalationApprovalRateGauge.set({ tenant_id: tenantId }, approvalRate);
}

// ============================================================================
// Circuit Breaker Metrics Helper Functions
// ============================================================================

/**
 * Circuit breaker state numeric values for gauge
 */
export type CircuitBreakerStateType = 'CLOSED' | 'HALF_OPEN' | 'OPEN';

const CIRCUIT_STATE_VALUES: Record<CircuitBreakerStateType, number> = {
  CLOSED: 0,
  HALF_OPEN: 1,
  OPEN: 2,
};

/**
 * Record circuit breaker state change
 */
export function recordCircuitBreakerStateChange(
  name: string,
  fromState: CircuitBreakerStateType,
  toState: CircuitBreakerStateType
): void {
  circuitBreakerStateChanges.inc({
    name,
    from_state: fromState,
    to_state: toState,
  });
  circuitBreakerState.set({ name }, CIRCUIT_STATE_VALUES[toState]);
}

/**
 * Update circuit breaker state gauge
 */
export function updateCircuitBreakerState(
  name: string,
  state: CircuitBreakerStateType
): void {
  circuitBreakerState.set({ name }, CIRCUIT_STATE_VALUES[state]);
}

/**
 * Record circuit breaker execution result
 */
export function recordCircuitBreakerExecution(
  name: string,
  result: 'success' | 'failure' | 'rejected'
): void {
  circuitBreakerExecutions.inc({ name, result });
}

/**
 * Update circuit breaker failure count gauge
 */
export function updateCircuitBreakerFailures(name: string, failureCount: number): void {
  circuitBreakerFailures.set({ name }, failureCount);
}

// ============================================================================
// Per-Service Circuit Breaker Metrics Helper Functions
// ============================================================================

/**
 * Update per-service circuit breaker state gauge
 * This is the primary metric for monitoring circuit breaker state per service
 */
export function updateServiceCircuitBreakerState(
  service: string,
  state: CircuitBreakerStateType
): void {
  serviceCircuitBreakerState.set({ service }, CIRCUIT_STATE_VALUES[state]);
}

/**
 * Record a failure for a service's circuit breaker
 */
export function recordServiceCircuitBreakerFailure(service: string): void {
  serviceCircuitBreakerFailuresTotal.inc({ service });
}

/**
 * Record a success for a service's circuit breaker
 */
export function recordServiceCircuitBreakerSuccess(service: string): void {
  serviceCircuitBreakerSuccessesTotal.inc({ service });
}

/**
 * Record a circuit breaker trip (circuit opening) for a service
 */
export function recordServiceCircuitBreakerTrip(service: string): void {
  serviceCircuitBreakerTripsTotal.inc({ service });
}

/**
 * Record a circuit breaker recovery (circuit closing from half-open) for a service
 */
export function recordServiceCircuitBreakerRecovery(service: string): void {
  serviceCircuitBreakerRecoveriesTotal.inc({ service });
}

/**
 * Update the current half-open attempts gauge for a service
 */
export function updateServiceCircuitBreakerHalfOpenAttempts(
  service: string,
  attempts: number
): void {
  serviceCircuitBreakerHalfOpenAttempts.set({ service }, attempts);
}

/**
 * Record a complete circuit breaker state change for a service
 * This is a convenience function that updates multiple metrics at once
 */
export function recordServiceCircuitBreakerStateChange(
  service: string,
  fromState: CircuitBreakerStateType,
  toState: CircuitBreakerStateType
): void {
  // Update the state gauge
  updateServiceCircuitBreakerState(service, toState);

  // Also update the generic circuit breaker metrics for backward compatibility
  circuitBreakerStateChanges.inc({
    name: service,
    from_state: fromState,
    to_state: toState,
  });
  circuitBreakerState.set({ name: service }, CIRCUIT_STATE_VALUES[toState]);

  // Record specific events
  if (toState === 'OPEN') {
    recordServiceCircuitBreakerTrip(service);
  } else if (fromState === 'HALF_OPEN' && toState === 'CLOSED') {
    recordServiceCircuitBreakerRecovery(service);
  }
}

// ============================================================================
// Batch Operation Metrics Helper Functions
// ============================================================================

/**
 * Record a batch operation with timing and throughput metrics
 */
export function recordBatchOperation(
  tenantId: string,
  operation: 'submit' | 'validate' | 'enqueue',
  result: 'success' | 'partial' | 'failure',
  itemCount: number,
  durationSeconds: number
): void {
  batchOperationsTotal.inc({
    tenant_id: tenantId,
    operation,
    result,
  });

  batchOperationSize.observe(
    { tenant_id: tenantId, operation },
    itemCount
  );

  batchOperationDuration.observe(
    { tenant_id: tenantId, operation },
    durationSeconds
  );

  // Calculate and record throughput (items per second)
  if (durationSeconds > 0) {
    const throughput = itemCount / durationSeconds;
    batchOperationThroughput.observe(
      { tenant_id: tenantId, operation },
      throughput
    );
  }
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

// ============================================================================
// Execution Metrics Helper Functions
// ============================================================================

/**
 * Record execution attempt result
 */
export function recordExecution(
  tenantId: string,
  intentType: string | null | undefined,
  result: 'success' | 'failure' | 'blocked' | 'timeout',
  durationSeconds: number,
  memoryPeakMb?: number
): void {
  executionsTotal.inc({
    tenant_id: tenantId,
    intent_type: intentType ?? 'default',
    result,
  });
  executionDuration.observe(
    { tenant_id: tenantId, intent_type: intentType ?? 'default' },
    durationSeconds
  );
  if (memoryPeakMb !== undefined && memoryPeakMb > 0) {
    executionMemoryPeak.observe(
      { tenant_id: tenantId, intent_type: intentType ?? 'default' },
      memoryPeakMb
    );
  }
}

/**
 * Update executions in progress gauge
 */
export function updateExecutionsInProgress(tenantId: string, delta: number): void {
  executionsInProgress.inc({ tenant_id: tenantId }, delta);
}
