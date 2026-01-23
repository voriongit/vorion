/**
 * COGNIGATE Metrics - Prometheus-compatible observability
 *
 * Provides comprehensive metrics for monitoring constrained executions,
 * resource usage, handler health, sandbox violations, bulkhead management,
 * caching, state machine transitions, escalations, and more.
 *
 * All metrics are registered with a dedicated Prometheus registry and
 * prefixed with `vorion_cognigate_` for namespace isolation.
 *
 * @packageDocumentation
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// =============================================================================
// REGISTRY
// =============================================================================

/**
 * Dedicated Prometheus registry for Cognigate metrics
 *
 * Separated from other modules to allow independent scraping
 * and prevent metric name collisions.
 */
export const cognigateRegistry = new Registry();

/** Collect default Node.js metrics with cognigate prefix */
collectDefaultMetrics({ register: cognigateRegistry, prefix: 'vorion_cognigate_' });

// =============================================================================
// EXECUTION METRICS
// =============================================================================

/**
 * Total executions completed (by status, handler, and cache state)
 */
export const cognigateExecutionsTotal = new Counter({
  name: 'vorion_cognigate_executions_total',
  help: 'Total executions completed by the Cognigate runtime',
  labelNames: ['status', 'handler', 'cached'] as const,
  registers: [cognigateRegistry],
});

/**
 * Execution duration in seconds
 *
 * Tracks the full wall-clock time of execution from start to completion.
 * Buckets are optimized for typical execution durations.
 */
export const cognigateExecutionDuration = new Histogram({
  name: 'vorion_cognigate_execution_duration_seconds',
  help: 'Execution duration in seconds',
  labelNames: ['handler', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300],
  registers: [cognigateRegistry],
});

/**
 * Currently active (running) executions
 */
export const cognigateExecutionsActive = new Gauge({
  name: 'vorion_cognigate_executions_active',
  help: 'Number of currently active executions',
  labelNames: ['handler'] as const,
  registers: [cognigateRegistry],
});

/**
 * Currently queued executions waiting for capacity
 */
export const cognigateExecutionsQueued = new Gauge({
  name: 'vorion_cognigate_executions_queued',
  help: 'Number of executions waiting in queue',
  labelNames: ['handler'] as const,
  registers: [cognigateRegistry],
});

/**
 * Total execution retries by handler and attempt number
 */
export const cognigateExecutionRetriesTotal = new Counter({
  name: 'vorion_cognigate_execution_retries_total',
  help: 'Total execution retry attempts',
  labelNames: ['handler', 'attempt'] as const,
  registers: [cognigateRegistry],
});

// =============================================================================
// RESOURCE METRICS
// =============================================================================

/**
 * Memory usage distribution in megabytes
 */
export const cognigateResourceMemoryMb = new Histogram({
  name: 'vorion_cognigate_resource_memory_mb',
  help: 'Peak memory usage per execution in megabytes',
  labelNames: ['handler'] as const,
  buckets: [0, 64, 128, 256, 512, 1024, 2048],
  registers: [cognigateRegistry],
});

/**
 * CPU time usage distribution in milliseconds
 */
export const cognigateResourceCpuMs = new Histogram({
  name: 'vorion_cognigate_resource_cpu_ms',
  help: 'CPU time per execution in milliseconds',
  labelNames: ['handler'] as const,
  buckets: [1, 5, 10, 50, 100, 500, 1000, 5000, 10000, 30000],
  registers: [cognigateRegistry],
});

/**
 * Total network requests made during executions
 */
export const cognigateResourceNetworkRequestsTotal = new Counter({
  name: 'vorion_cognigate_resource_network_requests_total',
  help: 'Total network requests made during executions',
  labelNames: ['handler'] as const,
  registers: [cognigateRegistry],
});

/**
 * Total network bytes transferred during executions
 */
export const cognigateResourceNetworkBytesTotal = new Counter({
  name: 'vorion_cognigate_resource_network_bytes_total',
  help: 'Total network bytes transferred during executions',
  labelNames: ['direction', 'handler'] as const,
  registers: [cognigateRegistry],
});

/**
 * Total filesystem operations during executions
 */
export const cognigateResourceFilesystemOpsTotal = new Counter({
  name: 'vorion_cognigate_resource_filesystem_ops_total',
  help: 'Total filesystem operations during executions',
  labelNames: ['type', 'handler'] as const,
  registers: [cognigateRegistry],
});

/**
 * Total resource constraint violations detected
 */
export const cognigateResourceViolationsTotal = new Counter({
  name: 'vorion_cognigate_resource_violations_total',
  help: 'Total resource constraint violations',
  labelNames: ['type', 'action'] as const,
  registers: [cognigateRegistry],
});

/**
 * Current resource utilization (0-1) by resource type
 */
export const cognigateResourceUtilization = new Gauge({
  name: 'vorion_cognigate_resource_utilization',
  help: 'Current resource utilization ratio (0-1)',
  labelNames: ['resource_type'] as const,
  registers: [cognigateRegistry],
});

// =============================================================================
// HANDLER METRICS
// =============================================================================

/**
 * Total handler registrations
 */
export const cognigateHandlerRegistrationsTotal = new Counter({
  name: 'vorion_cognigate_handler_registrations_total',
  help: 'Total handler registrations',
  labelNames: ['handler'] as const,
  registers: [cognigateRegistry],
});

/**
 * Total handler unregistrations
 */
export const cognigateHandlerUnregistrationsTotal = new Counter({
  name: 'vorion_cognigate_handler_unregistrations_total',
  help: 'Total handler unregistrations',
  labelNames: ['handler'] as const,
  registers: [cognigateRegistry],
});

/**
 * Currently active (registered) handlers
 */
export const cognigateHandlersActive = new Gauge({
  name: 'vorion_cognigate_handlers_active',
  help: 'Number of currently active handlers',
  registers: [cognigateRegistry],
});

/**
 * Total handler executions by handler name and status
 */
export const cognigateHandlerExecutionsTotal = new Counter({
  name: 'vorion_cognigate_handler_executions_total',
  help: 'Total handler executions',
  labelNames: ['handler', 'status'] as const,
  registers: [cognigateRegistry],
});

/**
 * Handler execution duration in seconds
 */
export const cognigateHandlerDuration = new Histogram({
  name: 'vorion_cognigate_handler_duration_seconds',
  help: 'Handler execution duration in seconds',
  labelNames: ['handler'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [cognigateRegistry],
});

/**
 * Total handler health checks performed
 */
export const cognigateHandlerHealthChecksTotal = new Counter({
  name: 'vorion_cognigate_handler_health_checks_total',
  help: 'Total handler health checks',
  labelNames: ['handler', 'result'] as const,
  registers: [cognigateRegistry],
});

/**
 * Current handler health status (1=healthy, 0=unhealthy)
 */
export const cognigateHandlerHealthStatus = new Gauge({
  name: 'vorion_cognigate_handler_health_status',
  help: 'Current handler health status (1=healthy, 0=unhealthy)',
  labelNames: ['handler'] as const,
  registers: [cognigateRegistry],
});

// =============================================================================
// SANDBOX METRICS
// =============================================================================

/**
 * Total sandbox violations by type
 */
export const cognigateSandboxViolationsTotal = new Counter({
  name: 'vorion_cognigate_sandbox_violations_total',
  help: 'Total sandbox security violations',
  labelNames: ['type'] as const,
  registers: [cognigateRegistry],
});

/**
 * Total network connections blocked by sandbox
 */
export const cognigateSandboxNetworkBlockedTotal = new Counter({
  name: 'vorion_cognigate_sandbox_network_blocked_total',
  help: 'Total network connections blocked by sandbox',
  labelNames: ['host'] as const,
  registers: [cognigateRegistry],
});

/**
 * Total module imports blocked by sandbox
 */
export const cognigateSandboxModuleBlockedTotal = new Counter({
  name: 'vorion_cognigate_sandbox_module_blocked_total',
  help: 'Total module imports blocked by sandbox',
  labelNames: ['module'] as const,
  registers: [cognigateRegistry],
});

// =============================================================================
// BULKHEAD METRICS
// =============================================================================

/**
 * Currently active executions within bulkhead scope
 */
export const cognigateBulkheadActive = new Gauge({
  name: 'vorion_cognigate_bulkhead_active',
  help: 'Number of active executions within bulkhead',
  labelNames: ['scope'] as const,
  registers: [cognigateRegistry],
});

/**
 * Currently queued executions waiting for bulkhead capacity
 */
export const cognigateBulkheadQueued = new Gauge({
  name: 'vorion_cognigate_bulkhead_queued',
  help: 'Number of queued executions waiting for bulkhead capacity',
  labelNames: ['scope'] as const,
  registers: [cognigateRegistry],
});

/**
 * Total executions rejected by bulkhead
 */
export const cognigateBulkheadRejectedTotal = new Counter({
  name: 'vorion_cognigate_bulkhead_rejected_total',
  help: 'Total executions rejected by bulkhead limits',
  labelNames: ['scope', 'reason'] as const,
  registers: [cognigateRegistry],
});

/**
 * Wait duration before entering bulkhead
 */
export const cognigateBulkheadWaitDuration = new Histogram({
  name: 'vorion_cognigate_bulkhead_wait_duration_seconds',
  help: 'Time spent waiting for bulkhead capacity',
  labelNames: ['scope'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [cognigateRegistry],
});

// =============================================================================
// CACHE METRICS
// =============================================================================

/**
 * Total cache hits
 */
export const cognigateCacheHitsTotal = new Counter({
  name: 'vorion_cognigate_cache_hits_total',
  help: 'Total execution cache hits',
  registers: [cognigateRegistry],
});

/**
 * Total cache misses
 */
export const cognigateCacheMissesTotal = new Counter({
  name: 'vorion_cognigate_cache_misses_total',
  help: 'Total execution cache misses',
  registers: [cognigateRegistry],
});

/**
 * Current cache size
 */
export const cognigateCacheSize = new Gauge({
  name: 'vorion_cognigate_cache_size',
  help: 'Current number of entries in execution cache',
  registers: [cognigateRegistry],
});

/**
 * Total cache evictions
 */
export const cognigateCacheEvictionsTotal = new Counter({
  name: 'vorion_cognigate_cache_evictions_total',
  help: 'Total cache evictions (LRU or TTL)',
  registers: [cognigateRegistry],
});

// =============================================================================
// STATE MACHINE METRICS
// =============================================================================

/**
 * Total state transitions by from/to state
 */
export const cognigateStateTransitionsTotal = new Counter({
  name: 'vorion_cognigate_state_transitions_total',
  help: 'Total execution state transitions',
  labelNames: ['from', 'to'] as const,
  registers: [cognigateRegistry],
});

/**
 * Duration spent in each state before transitioning
 */
export const cognigateStateDuration = new Histogram({
  name: 'vorion_cognigate_state_duration_seconds',
  help: 'Duration spent in each execution state',
  labelNames: ['state'] as const,
  buckets: [0.01, 0.1, 1, 5, 10, 30, 60, 120, 300, 600],
  registers: [cognigateRegistry],
});

// =============================================================================
// ESCALATION METRICS
// =============================================================================

/**
 * Total escalations created by priority
 */
export const cognigateEscalationsCreatedTotal = new Counter({
  name: 'vorion_cognigate_escalations_created_total',
  help: 'Total escalations created',
  labelNames: ['priority'] as const,
  registers: [cognigateRegistry],
});

/**
 * Total escalations resolved by resolution type
 */
export const cognigateEscalationsResolvedTotal = new Counter({
  name: 'vorion_cognigate_escalations_resolved_total',
  help: 'Total escalations resolved',
  labelNames: ['resolution'] as const,
  registers: [cognigateRegistry],
});

/**
 * Current pending escalations
 */
export const cognigateEscalationsPending = new Gauge({
  name: 'vorion_cognigate_escalations_pending',
  help: 'Current number of pending escalations',
  registers: [cognigateRegistry],
});

/**
 * Escalation resolution duration
 */
export const cognigateEscalationDuration = new Histogram({
  name: 'vorion_cognigate_escalation_duration_seconds',
  help: 'Time from escalation creation to resolution',
  labelNames: ['priority'] as const,
  buckets: [60, 300, 600, 1800, 3600, 7200, 14400, 28800, 86400],
  registers: [cognigateRegistry],
});

// =============================================================================
// CIRCUIT BREAKER METRICS
// =============================================================================

/**
 * Current circuit breaker state (0=closed, 1=half_open, 2=open)
 */
export const cognigateCircuitBreakerState = new Gauge({
  name: 'vorion_cognigate_circuit_breaker_state',
  help: 'Current circuit breaker state (0=closed, 1=half_open, 2=open)',
  labelNames: ['name'] as const,
  registers: [cognigateRegistry],
});

/**
 * Total circuit breaker state changes
 */
export const cognigateCircuitBreakerStateChangesTotal = new Counter({
  name: 'vorion_cognigate_circuit_breaker_state_changes_total',
  help: 'Total circuit breaker state transitions',
  labelNames: ['name', 'from', 'to'] as const,
  registers: [cognigateRegistry],
});

// =============================================================================
// QUEUE METRICS
// =============================================================================

/**
 * Current queue depth (waiting jobs)
 */
export const cognigateQueueDepth = new Gauge({
  name: 'vorion_cognigate_queue_depth',
  help: 'Number of jobs waiting in the execution queue',
  registers: [cognigateRegistry],
});

/**
 * Current active jobs being processed
 */
export const cognigateQueueActiveJobs = new Gauge({
  name: 'vorion_cognigate_queue_active_jobs',
  help: 'Number of jobs currently being processed',
  registers: [cognigateRegistry],
});

/**
 * Total jobs processed by result
 */
export const cognigateJobsProcessedTotal = new Counter({
  name: 'vorion_cognigate_jobs_processed_total',
  help: 'Total jobs processed by the execution queue',
  labelNames: ['result'] as const,
  registers: [cognigateRegistry],
});

/**
 * Job processing duration
 */
export const cognigateJobProcessingDuration = new Histogram({
  name: 'vorion_cognigate_job_processing_duration_seconds',
  help: 'Time to process a single execution job',
  labelNames: ['handler'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [cognigateRegistry],
});

// =============================================================================
// DATABASE METRICS
// =============================================================================

/**
 * Database query duration
 */
export const cognigateDbQueryDuration = new Histogram({
  name: 'vorion_cognigate_db_query_duration_seconds',
  help: 'Database query execution time',
  labelNames: ['operation'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [cognigateRegistry],
});

/**
 * Total database queries by operation type
 */
export const cognigateDbQueryTotal = new Counter({
  name: 'vorion_cognigate_db_query_total',
  help: 'Total database queries',
  labelNames: ['operation'] as const,
  registers: [cognigateRegistry],
});

/**
 * Total database query errors
 */
export const cognigateDbQueryErrorsTotal = new Counter({
  name: 'vorion_cognigate_db_query_errors_total',
  help: 'Total database query errors',
  labelNames: ['operation', 'error_type'] as const,
  registers: [cognigateRegistry],
});

// =============================================================================
// WEBHOOK METRICS
// =============================================================================

/**
 * Total successful webhook deliveries
 */
export const cognigateWebhookDeliverySuccessTotal = new Counter({
  name: 'vorion_cognigate_webhook_delivery_success_total',
  help: 'Total successful webhook deliveries',
  labelNames: ['event_type'] as const,
  registers: [cognigateRegistry],
});

/**
 * Total failed webhook deliveries
 */
export const cognigateWebhookDeliveryFailureTotal = new Counter({
  name: 'vorion_cognigate_webhook_delivery_failure_total',
  help: 'Total failed webhook deliveries',
  labelNames: ['event_type', 'error_type'] as const,
  registers: [cognigateRegistry],
});

/**
 * Webhook delivery duration
 */
export const cognigateWebhookDeliveryDuration = new Histogram({
  name: 'vorion_cognigate_webhook_delivery_duration_seconds',
  help: 'Webhook delivery duration in seconds',
  labelNames: ['event_type'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [cognigateRegistry],
});

// =============================================================================
// GDPR METRICS
// =============================================================================

/**
 * Total GDPR export requests
 */
export const cognigateGdprExportRequestsTotal = new Counter({
  name: 'vorion_cognigate_gdpr_export_requests_total',
  help: 'Total GDPR data export requests',
  labelNames: ['status'] as const,
  registers: [cognigateRegistry],
});

/**
 * Total GDPR erasure requests
 */
export const cognigateGdprErasureRequestsTotal = new Counter({
  name: 'vorion_cognigate_gdpr_erasure_requests_total',
  help: 'Total GDPR data erasure requests',
  labelNames: ['type'] as const,
  registers: [cognigateRegistry],
});

// =============================================================================
// ERROR METRICS
// =============================================================================

/**
 * Total errors by error code and component
 */
export const cognigateErrorsTotal = new Counter({
  name: 'vorion_cognigate_errors_total',
  help: 'Total errors in Cognigate processing',
  labelNames: ['code', 'component'] as const,
  registers: [cognigateRegistry],
});

// =============================================================================
// HELPER FUNCTIONS - EXECUTION
// =============================================================================

/**
 * Record a completed execution with all relevant metrics
 *
 * @param handler - Handler name that processed the execution
 * @param status - Final execution status
 * @param durationMs - Execution duration in milliseconds
 * @param cached - Whether the result was served from cache
 */
export function recordExecution(
  handler: string,
  status: string,
  durationMs: number,
  cached: boolean = false
): void {
  cognigateExecutionsTotal.inc({
    status,
    handler,
    cached: cached ? 'true' : 'false',
  });

  cognigateExecutionDuration.observe(
    { handler, status },
    durationMs / 1000
  );
}

/**
 * Record an execution retry attempt
 *
 * @param handler - Handler name
 * @param attempt - Retry attempt number
 */
export function recordRetry(handler: string, attempt: number): void {
  cognigateExecutionRetriesTotal.inc({
    handler,
    attempt: String(attempt),
  });
}

/**
 * Update active execution count
 *
 * @param handler - Handler name
 * @param delta - Amount to change (positive = increment, negative = decrement)
 */
export function updateActiveExecutions(handler: string, delta: number): void {
  if (delta > 0) {
    cognigateExecutionsActive.inc({ handler }, delta);
  } else {
    cognigateExecutionsActive.dec({ handler }, Math.abs(delta));
  }
}

/**
 * Update queued execution count
 *
 * @param handler - Handler name
 * @param count - Current queue depth for this handler
 */
export function setQueuedExecutions(handler: string, count: number): void {
  cognigateExecutionsQueued.set({ handler }, count);
}

// =============================================================================
// HELPER FUNCTIONS - RESOURCES
// =============================================================================

/**
 * Record resource usage from an execution
 *
 * @param handler - Handler name
 * @param usage - Resource usage metrics
 */
export function recordResourceUsage(
  handler: string,
  usage: {
    memoryPeakMb: number;
    cpuTimeMs: number;
    networkRequests: number;
    networkBytesIn?: number;
    networkBytesOut?: number;
    fileSystemReads?: number;
    fileSystemWrites?: number;
  }
): void {
  cognigateResourceMemoryMb.observe({ handler }, usage.memoryPeakMb);
  cognigateResourceCpuMs.observe({ handler }, usage.cpuTimeMs);

  if (usage.networkRequests > 0) {
    cognigateResourceNetworkRequestsTotal.inc({ handler }, usage.networkRequests);
  }

  if (usage.networkBytesIn) {
    cognigateResourceNetworkBytesTotal.inc(
      { direction: 'in', handler },
      usage.networkBytesIn
    );
  }

  if (usage.networkBytesOut) {
    cognigateResourceNetworkBytesTotal.inc(
      { direction: 'out', handler },
      usage.networkBytesOut
    );
  }

  if (usage.fileSystemReads) {
    cognigateResourceFilesystemOpsTotal.inc(
      { type: 'read', handler },
      usage.fileSystemReads
    );
  }

  if (usage.fileSystemWrites) {
    cognigateResourceFilesystemOpsTotal.inc(
      { type: 'write', handler },
      usage.fileSystemWrites
    );
  }
}

/**
 * Record a resource constraint violation
 *
 * @param type - Violation type (e.g., 'memory_exceeded', 'cpu_exceeded', 'timeout')
 * @param action - Action taken (e.g., 'terminated', 'throttled', 'warned')
 */
export function recordViolation(type: string, action: string): void {
  cognigateResourceViolationsTotal.inc({ type, action });
}

/**
 * Set current resource utilization
 *
 * @param resourceType - Type of resource (e.g., 'memory', 'cpu', 'network')
 * @param utilization - Current utilization ratio (0-1)
 */
export function setResourceUtilization(resourceType: string, utilization: number): void {
  cognigateResourceUtilization.set({ resource_type: resourceType }, utilization);
}

// =============================================================================
// HELPER FUNCTIONS - HANDLERS
// =============================================================================

/**
 * Record a handler registration
 *
 * @param handler - Handler name
 */
export function recordHandlerRegistration(handler: string): void {
  cognigateHandlerRegistrationsTotal.inc({ handler });
  cognigateHandlersActive.inc();
}

/**
 * Record a handler unregistration
 *
 * @param handler - Handler name
 */
export function recordHandlerUnregistration(handler: string): void {
  cognigateHandlerUnregistrationsTotal.inc({ handler });
  cognigateHandlersActive.dec();
}

/**
 * Record a handler execution
 *
 * @param handler - Handler name
 * @param status - Execution status
 * @param durationMs - Duration in milliseconds
 */
export function recordHandlerExecution(
  handler: string,
  status: string,
  durationMs: number
): void {
  cognigateHandlerExecutionsTotal.inc({ handler, status });
  cognigateHandlerDuration.observe({ handler }, durationMs / 1000);
}

/**
 * Record a handler health check result
 *
 * @param handler - Handler name
 * @param healthy - Whether the handler is healthy
 */
export function recordHandlerHealthCheck(handler: string, healthy: boolean): void {
  const result = healthy ? 'healthy' : 'unhealthy';
  cognigateHandlerHealthChecksTotal.inc({ handler, result });
  cognigateHandlerHealthStatus.set({ handler }, healthy ? 1 : 0);
}

// =============================================================================
// HELPER FUNCTIONS - SANDBOX
// =============================================================================

/**
 * Record a sandbox security violation
 *
 * @param type - Violation type (e.g., 'network_access', 'module_import', 'fs_access')
 */
export function recordSandboxViolation(type: string): void {
  cognigateSandboxViolationsTotal.inc({ type });
}

/**
 * Record a blocked network connection
 *
 * @param host - The blocked host
 */
export function recordNetworkBlocked(host: string): void {
  cognigateSandboxNetworkBlockedTotal.inc({ host });
}

/**
 * Record a blocked module import
 *
 * @param moduleName - The blocked module name
 */
export function recordModuleBlocked(moduleName: string): void {
  cognigateSandboxModuleBlockedTotal.inc({ module: moduleName });
}

// =============================================================================
// HELPER FUNCTIONS - BULKHEAD
// =============================================================================

/**
 * Update bulkhead gauges
 *
 * @param scope - Bulkhead scope (global/tenant/handler)
 * @param active - Number of active executions
 * @param queued - Number of queued executions
 */
export function updateBulkhead(scope: string, active: number, queued: number): void {
  cognigateBulkheadActive.set({ scope }, active);
  cognigateBulkheadQueued.set({ scope }, queued);
}

/**
 * Record a bulkhead rejection
 *
 * @param scope - Bulkhead scope
 * @param reason - Rejection reason (e.g., 'capacity_full', 'queue_full')
 */
export function recordBulkheadRejection(scope: string, reason: string): void {
  cognigateBulkheadRejectedTotal.inc({ scope, reason });
}

/**
 * Record bulkhead wait duration
 *
 * @param scope - Bulkhead scope
 * @param durationMs - Wait duration in milliseconds
 */
export function recordBulkheadWait(scope: string, durationMs: number): void {
  cognigateBulkheadWaitDuration.observe({ scope }, durationMs / 1000);
}

// =============================================================================
// HELPER FUNCTIONS - CACHE
// =============================================================================

/**
 * Record a cache hit
 */
export function recordCacheHit(): void {
  cognigateCacheHitsTotal.inc();
}

/**
 * Record a cache miss
 */
export function recordCacheMiss(): void {
  cognigateCacheMissesTotal.inc();
}

/**
 * Set the current cache size
 *
 * @param size - Number of entries in the cache
 */
export function setCacheSize(size: number): void {
  cognigateCacheSize.set(size);
}

/**
 * Record a cache eviction
 */
export function recordCacheEviction(): void {
  cognigateCacheEvictionsTotal.inc();
}

// =============================================================================
// HELPER FUNCTIONS - STATE MACHINE
// =============================================================================

/**
 * Record a state transition
 *
 * @param fromState - Previous state
 * @param toState - New state
 */
export function recordStateTransition(fromState: string, toState: string): void {
  cognigateStateTransitionsTotal.inc({ from: fromState, to: toState });
}

/**
 * Record the duration spent in a state
 *
 * @param state - The state that was exited
 * @param durationMs - Duration in the state in milliseconds
 */
export function recordStateDuration(state: string, durationMs: number): void {
  cognigateStateDuration.observe({ state }, durationMs / 1000);
}

// =============================================================================
// HELPER FUNCTIONS - ESCALATIONS
// =============================================================================

/**
 * Record a new escalation
 *
 * @param priority - Escalation priority
 */
export function recordEscalationCreated(priority: string): void {
  cognigateEscalationsCreatedTotal.inc({ priority });
  cognigateEscalationsPending.inc();
}

/**
 * Record an escalation resolution
 *
 * @param resolution - Resolution action taken
 * @param priority - Original priority
 * @param durationMs - Time from creation to resolution in milliseconds
 */
export function recordEscalationResolved(
  resolution: string,
  priority: string,
  durationMs: number
): void {
  cognigateEscalationsResolvedTotal.inc({ resolution });
  cognigateEscalationsPending.dec();
  cognigateEscalationDuration.observe({ priority }, durationMs / 1000);
}

/**
 * Set the current pending escalation count
 *
 * @param count - Number of pending escalations
 */
export function setPendingEscalations(count: number): void {
  cognigateEscalationsPending.set(count);
}

// =============================================================================
// HELPER FUNCTIONS - CIRCUIT BREAKER
// =============================================================================

/**
 * Circuit breaker state numeric values
 */
type CircuitBreakerStateType = 'closed' | 'half_open' | 'open';

const CIRCUIT_STATE_VALUES: Record<CircuitBreakerStateType, number> = {
  closed: 0,
  half_open: 1,
  open: 2,
};

/**
 * Record a circuit breaker state change
 *
 * @param name - Circuit breaker name
 * @param fromState - Previous state
 * @param toState - New state
 */
export function recordCircuitBreakerStateChange(
  name: string,
  fromState: CircuitBreakerStateType,
  toState: CircuitBreakerStateType
): void {
  cognigateCircuitBreakerStateChangesTotal.inc({ name, from: fromState, to: toState });
  cognigateCircuitBreakerState.set({ name }, CIRCUIT_STATE_VALUES[toState]);
}

// =============================================================================
// HELPER FUNCTIONS - QUEUE
// =============================================================================

/**
 * Update queue gauges
 *
 * @param depth - Number of waiting jobs
 * @param active - Number of active jobs
 */
export function updateQueueGauges(depth: number, active: number): void {
  cognigateQueueDepth.set(depth);
  cognigateQueueActiveJobs.set(active);
}

/**
 * Record a processed job
 *
 * @param result - Job result ('success' | 'failure' | 'retry')
 * @param handler - Handler name
 * @param durationMs - Processing duration in milliseconds
 */
export function recordJobProcessed(
  result: string,
  handler: string,
  durationMs: number
): void {
  cognigateJobsProcessedTotal.inc({ result });
  cognigateJobProcessingDuration.observe({ handler }, durationMs / 1000);
}

// =============================================================================
// HELPER FUNCTIONS - DATABASE
// =============================================================================

/**
 * Record a database query
 *
 * @param operation - Query operation type (select, insert, update, delete)
 * @param durationMs - Query duration in milliseconds
 */
export function recordDbQuery(operation: string, durationMs: number): void {
  cognigateDbQueryTotal.inc({ operation });
  cognigateDbQueryDuration.observe({ operation }, durationMs / 1000);
}

/**
 * Record a database query error
 *
 * @param operation - Query operation type
 * @param errorType - Type of error
 */
export function recordDbQueryError(operation: string, errorType: string): void {
  cognigateDbQueryErrorsTotal.inc({ operation, error_type: errorType });
}

// =============================================================================
// HELPER FUNCTIONS - WEBHOOKS
// =============================================================================

/**
 * Record a webhook delivery result
 *
 * @param eventType - Event type being delivered
 * @param success - Whether delivery was successful
 * @param durationMs - Delivery duration in milliseconds
 * @param errorType - Error type if delivery failed
 */
export function recordWebhookDelivery(
  eventType: string,
  success: boolean,
  durationMs: number,
  errorType?: string
): void {
  if (success) {
    cognigateWebhookDeliverySuccessTotal.inc({ event_type: eventType });
  } else {
    cognigateWebhookDeliveryFailureTotal.inc({
      event_type: eventType,
      error_type: errorType ?? 'unknown',
    });
  }

  cognigateWebhookDeliveryDuration.observe(
    { event_type: eventType },
    durationMs / 1000
  );
}

// =============================================================================
// HELPER FUNCTIONS - GDPR
// =============================================================================

/**
 * Record a GDPR export request
 *
 * @param status - Request status ('pending' | 'completed' | 'failed')
 */
export function recordGdprExport(status: string): void {
  cognigateGdprExportRequestsTotal.inc({ status });
}

/**
 * Record a GDPR erasure request
 *
 * @param type - Erasure type ('soft' | 'hard')
 */
export function recordGdprErasure(type: string): void {
  cognigateGdprErasureRequestsTotal.inc({ type });
}

// =============================================================================
// HELPER FUNCTIONS - ERRORS
// =============================================================================

/**
 * Record an error
 *
 * @param code - Error code
 * @param component - Component where the error occurred
 */
export function recordError(code: string, component: string): void {
  cognigateErrorsTotal.inc({ code, component });
}

// =============================================================================
// REGISTRY ACCESS FUNCTIONS
// =============================================================================

/**
 * Get all metrics as Prometheus text format
 */
export async function getMetrics(): Promise<string> {
  return cognigateRegistry.metrics();
}

/**
 * Get the Prometheus content type header value
 */
export function getMetricsContentType(): string {
  return cognigateRegistry.contentType;
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics(): void {
  cognigateRegistry.resetMetrics();
}
