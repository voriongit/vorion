/**
 * ENFORCE Metrics - Prometheus-compatible observability
 *
 * Provides comprehensive metrics for monitoring enforcement decisions,
 * escalations, constraint evaluations, and caching performance.
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// Create a dedicated registry for enforce metrics
export const enforceRegistry = new Registry();

// ============================================================================
// Decision Metrics (Counters)
// ============================================================================

/**
 * Total decisions made by the enforcement module
 */
export const enforceDecisionsTotal = new Counter({
  name: 'vorion_enforce_decisions_total',
  help: 'Total enforcement decisions made',
  labelNames: ['tenant_id', 'action', 'cached'] as const,
  registers: [enforceRegistry],
});

/**
 * Total escalations triggered
 */
export const enforceEscalationsTotal = new Counter({
  name: 'vorion_enforce_escalations_total',
  help: 'Total escalations triggered by enforcement',
  labelNames: ['tenant_id', 'rule_id', 'priority'] as const,
  registers: [enforceRegistry],
});

/**
 * Total constraint evaluations
 */
export const enforceConstraintEvaluationsTotal = new Counter({
  name: 'vorion_enforce_constraint_evaluations_total',
  help: 'Total constraint evaluations performed',
  labelNames: ['tenant_id', 'constraint_type', 'passed'] as const,
  registers: [enforceRegistry],
});

/**
 * Decision cache hits
 */
export const enforceCacheHitsTotal = new Counter({
  name: 'vorion_enforce_cache_hits_total',
  help: 'Total decision cache hits',
  labelNames: ['tenant_id'] as const,
  registers: [enforceRegistry],
});

/**
 * Decision cache misses
 */
export const enforceCacheMissesTotal = new Counter({
  name: 'vorion_enforce_cache_misses_total',
  help: 'Total decision cache misses',
  labelNames: ['tenant_id'] as const,
  registers: [enforceRegistry],
});

// ============================================================================
// Latency Metrics (Histograms)
// ============================================================================

/**
 * Decision latency histogram
 */
export const enforceDecisionDuration = new Histogram({
  name: 'vorion_enforce_decision_duration_seconds',
  help: 'Time to make enforcement decisions',
  labelNames: ['tenant_id', 'action'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [enforceRegistry],
});

/**
 * Per-constraint evaluation duration histogram
 */
export const enforceConstraintDuration = new Histogram({
  name: 'vorion_enforce_constraint_duration_seconds',
  help: 'Time to evaluate individual constraints',
  labelNames: ['constraint_type'] as const,
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
  registers: [enforceRegistry],
});

// ============================================================================
// State Metrics (Gauges)
// ============================================================================

/**
 * Currently active escalations gauge
 */
export const enforceActiveEscalations = new Gauge({
  name: 'vorion_enforce_active_escalations',
  help: 'Number of currently active escalations',
  labelNames: ['tenant_id', 'priority'] as const,
  registers: [enforceRegistry],
});

/**
 * Current decision cache size gauge
 */
export const enforceCacheSize = new Gauge({
  name: 'vorion_enforce_cache_size',
  help: 'Current size of the decision cache',
  labelNames: ['tenant_id'] as const,
  registers: [enforceRegistry],
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Record an enforcement decision with timing
 *
 * @param tenantId - Tenant identifier
 * @param action - Decision action (allow, deny, escalate)
 * @param cached - Whether result was from cache
 * @param durationMs - Decision duration in milliseconds
 */
export function recordDecision(
  tenantId: string,
  action: string,
  cached: boolean,
  durationMs: number
): void {
  const cachedLabel = cached ? 'true' : 'false';

  enforceDecisionsTotal.inc({
    tenant_id: tenantId,
    action,
    cached: cachedLabel,
  });

  enforceDecisionDuration.observe(
    { tenant_id: tenantId, action },
    durationMs / 1000 // Convert to seconds
  );
}

/**
 * Record an escalation event
 *
 * @param tenantId - Tenant identifier
 * @param ruleId - Rule that triggered the escalation
 * @param priority - Escalation priority level
 */
export function recordEscalation(
  tenantId: string,
  ruleId: string,
  priority: string
): void {
  enforceEscalationsTotal.inc({
    tenant_id: tenantId,
    rule_id: ruleId,
    priority,
  });
}

/**
 * Record a constraint evaluation with timing
 *
 * @param tenantId - Tenant identifier
 * @param constraintType - Type of constraint evaluated
 * @param passed - Whether the constraint passed
 * @param durationMs - Evaluation duration in milliseconds
 */
export function recordConstraintEvaluation(
  tenantId: string,
  constraintType: string,
  passed: boolean,
  durationMs: number
): void {
  const passedLabel = passed ? 'true' : 'false';

  enforceConstraintEvaluationsTotal.inc({
    tenant_id: tenantId,
    constraint_type: constraintType,
    passed: passedLabel,
  });

  enforceConstraintDuration.observe(
    { constraint_type: constraintType },
    durationMs / 1000 // Convert to seconds
  );
}

/**
 * Record a cache hit for decision cache
 *
 * @param tenantId - Tenant identifier
 */
export function recordCacheHit(tenantId: string): void {
  enforceCacheHitsTotal.inc({ tenant_id: tenantId });
}

/**
 * Record a cache miss for decision cache
 *
 * @param tenantId - Tenant identifier
 */
export function recordCacheMiss(tenantId: string): void {
  enforceCacheMissesTotal.inc({ tenant_id: tenantId });
}

/**
 * Set the count of active escalations for a tenant and priority
 *
 * @param tenantId - Tenant identifier
 * @param priority - Escalation priority level
 * @param count - Number of active escalations
 */
export function setActiveEscalations(
  tenantId: string,
  priority: string,
  count: number
): void {
  enforceActiveEscalations.set(
    { tenant_id: tenantId, priority },
    count
  );
}

/**
 * Set the current cache size for a tenant
 *
 * @param tenantId - Tenant identifier
 * @param size - Current cache size
 */
export function setCacheSize(tenantId: string, size: number): void {
  enforceCacheSize.set({ tenant_id: tenantId }, size);
}

// ============================================================================
// Registry Access Functions
// ============================================================================

/**
 * Get all metrics as Prometheus text format
 */
export async function getMetrics(): Promise<string> {
  return enforceRegistry.metrics();
}

/**
 * Get metrics content type
 */
export function getMetricsContentType(): string {
  return enforceRegistry.contentType;
}
