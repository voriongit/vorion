/**
 * Phase 6 SLA Monitoring & Reporting
 *
 * Track and report on Service Level Agreements and Objectives
 */

// =============================================================================
// Types
// =============================================================================

export interface SLODefinition {
  id: string;
  name: string;
  description: string;
  target: number; // 0-100 (percentage)
  window: SLOWindow;
  metric: SLOMetric;
  alertThresholds: {
    warning: number;
    critical: number;
  };
}

export interface SLOMetric {
  type: 'availability' | 'latency' | 'error_rate' | 'throughput' | 'custom';
  query?: string;
  threshold?: number;
  unit?: string;
}

export type SLOWindow = '1h' | '24h' | '7d' | '30d' | '90d';

export interface SLOStatus {
  slo: SLODefinition;
  current: number;
  target: number;
  budget: number;
  budgetRemaining: number;
  budgetConsumedPercent: number;
  status: 'healthy' | 'warning' | 'critical' | 'breached';
  trend: 'improving' | 'stable' | 'degrading';
  lastUpdated: Date;
}

export interface SLAReport {
  period: { start: Date; end: Date };
  slos: SLOStatus[];
  overallCompliance: number;
  incidents: IncidentSummary[];
  uptimePercent: number;
  generatedAt: Date;
}

export interface IncidentSummary {
  id: string;
  title: string;
  severity: 'critical' | 'major' | 'minor';
  duration: number; // minutes
  impactedSLOs: string[];
  startedAt: Date;
  resolvedAt?: Date;
}

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
}

// =============================================================================
// SLO Definitions
// =============================================================================

export const PHASE6_SLOS: SLODefinition[] = [
  {
    id: 'phase6-availability',
    name: 'Phase 6 API Availability',
    description: 'Percentage of successful API requests',
    target: 99.9,
    window: '30d',
    metric: { type: 'availability' },
    alertThresholds: { warning: 99.95, critical: 99.9 },
  },
  {
    id: 'phase6-latency-p95',
    name: 'API Latency (p95)',
    description: '95th percentile response time under 100ms',
    target: 99.0,
    window: '30d',
    metric: { type: 'latency', threshold: 100, unit: 'ms' },
    alertThresholds: { warning: 99.5, critical: 99.0 },
  },
  {
    id: 'phase6-latency-p99',
    name: 'API Latency (p99)',
    description: '99th percentile response time under 500ms',
    target: 99.0,
    window: '30d',
    metric: { type: 'latency', threshold: 500, unit: 'ms' },
    alertThresholds: { warning: 99.5, critical: 99.0 },
  },
  {
    id: 'phase6-error-rate',
    name: 'Error Rate',
    description: 'Percentage of requests without errors',
    target: 99.9,
    window: '30d',
    metric: { type: 'error_rate' },
    alertThresholds: { warning: 99.95, critical: 99.9 },
  },
  {
    id: 'phase6-role-gate-latency',
    name: 'Role Gate Evaluation Latency',
    description: 'Role gate evaluations complete within 50ms',
    target: 99.5,
    window: '7d',
    metric: { type: 'latency', threshold: 50, unit: 'ms' },
    alertThresholds: { warning: 99.7, critical: 99.5 },
  },
  {
    id: 'phase6-provenance-integrity',
    name: 'Provenance Integrity',
    description: 'Percentage of provenance records with valid signatures',
    target: 100.0,
    window: '30d',
    metric: { type: 'custom', query: 'provenance_valid_signatures_ratio' },
    alertThresholds: { warning: 100.0, critical: 99.99 },
  },
];

// =============================================================================
// Metrics Store (In-memory for demo, replace with Prometheus/TimescaleDB)
// =============================================================================

const metricsStore: Record<string, MetricDataPoint[]> = {};
const incidentsStore: IncidentSummary[] = [];

// Initialize metrics
function initializeMetrics(): void {
  for (const slo of PHASE6_SLOS) {
    metricsStore[slo.id] = [];
  }
}
initializeMetrics();

// =============================================================================
// Metric Recording
// =============================================================================

/**
 * Record a metric data point
 */
export function recordMetric(sloId: string, value: number): void {
  if (!metricsStore[sloId]) {
    metricsStore[sloId] = [];
  }

  metricsStore[sloId].push({
    timestamp: new Date(),
    value,
  });

  // Keep only last 30 days of data
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  metricsStore[sloId] = metricsStore[sloId].filter((p) => p.timestamp > cutoff);
}

/**
 * Record availability metric (success/failure)
 */
export function recordAvailability(success: boolean): void {
  recordMetric('phase6-availability', success ? 100 : 0);
}

/**
 * Record latency metric
 */
export function recordLatency(latencyMs: number): void {
  recordMetric('phase6-latency-p95', latencyMs <= 100 ? 100 : 0);
  recordMetric('phase6-latency-p99', latencyMs <= 500 ? 100 : 0);
}

/**
 * Record error
 */
export function recordError(isError: boolean): void {
  recordMetric('phase6-error-rate', isError ? 0 : 100);
}

/**
 * Record role gate latency
 */
export function recordRoleGateLatency(latencyMs: number): void {
  recordMetric('phase6-role-gate-latency', latencyMs <= 50 ? 100 : 0);
}

/**
 * Record provenance integrity
 */
export function recordProvenanceIntegrity(valid: boolean): void {
  recordMetric('phase6-provenance-integrity', valid ? 100 : 0);
}

// =============================================================================
// SLO Calculation
// =============================================================================

/**
 * Calculate SLO status for a given definition
 */
export function calculateSLOStatus(slo: SLODefinition): SLOStatus {
  const metrics = metricsStore[slo.id] || [];
  const windowMs = parseWindow(slo.window);
  const cutoff = new Date(Date.now() - windowMs);

  const windowMetrics = metrics.filter((m) => m.timestamp > cutoff);

  // Calculate current value (average)
  const current = windowMetrics.length > 0
    ? windowMetrics.reduce((sum, m) => sum + m.value, 0) / windowMetrics.length
    : 100;

  // Calculate error budget
  const budget = 100 - slo.target;
  const consumed = 100 - current;
  const budgetRemaining = Math.max(0, budget - consumed);
  const budgetConsumedPercent = budget > 0 ? (consumed / budget) * 100 : 0;

  // Determine status
  let status: SLOStatus['status'];
  if (current >= slo.target) {
    status = current >= slo.alertThresholds.warning ? 'healthy' : 'warning';
  } else if (current >= slo.alertThresholds.critical) {
    status = 'critical';
  } else {
    status = 'breached';
  }

  // Calculate trend (compare last 25% of window to previous 25%)
  const trend = calculateTrend(windowMetrics);

  return {
    slo,
    current: Math.round(current * 1000) / 1000,
    target: slo.target,
    budget,
    budgetRemaining: Math.round(budgetRemaining * 1000) / 1000,
    budgetConsumedPercent: Math.round(budgetConsumedPercent * 10) / 10,
    status,
    trend,
    lastUpdated: new Date(),
  };
}

/**
 * Get all SLO statuses
 */
export function getAllSLOStatuses(): SLOStatus[] {
  return PHASE6_SLOS.map(calculateSLOStatus);
}

/**
 * Get SLOs by status
 */
export function getSLOsByStatus(status: SLOStatus['status']): SLOStatus[] {
  return getAllSLOStatuses().filter((s) => s.status === status);
}

// =============================================================================
// Incident Management
// =============================================================================

/**
 * Record an incident
 */
export function recordIncident(incident: Omit<IncidentSummary, 'id'>): IncidentSummary {
  const newIncident: IncidentSummary = {
    ...incident,
    id: `INC-${Date.now()}`,
  };

  incidentsStore.push(newIncident);
  return newIncident;
}

/**
 * Resolve an incident
 */
export function resolveIncident(id: string): IncidentSummary | null {
  const incident = incidentsStore.find((i) => i.id === id);
  if (!incident) return null;

  incident.resolvedAt = new Date();
  incident.duration = Math.round(
    (incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 60000
  );

  return incident;
}

/**
 * Get active incidents
 */
export function getActiveIncidents(): IncidentSummary[] {
  return incidentsStore.filter((i) => !i.resolvedAt);
}

/**
 * Get incidents in period
 */
export function getIncidentsInPeriod(start: Date, end: Date): IncidentSummary[] {
  return incidentsStore.filter(
    (i) => i.startedAt >= start && i.startedAt <= end
  );
}

// =============================================================================
// Reports
// =============================================================================

/**
 * Generate SLA report for a period
 */
export function generateSLAReport(periodDays: number = 30): SLAReport {
  const end = new Date();
  const start = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const slos = getAllSLOStatuses();
  const incidents = getIncidentsInPeriod(start, end);

  // Calculate overall compliance
  const overallCompliance = slos.length > 0
    ? slos.filter((s) => s.current >= s.target).length / slos.length * 100
    : 100;

  // Calculate uptime (based on availability SLO)
  const availabilitySLO = slos.find((s) => s.slo.id === 'phase6-availability');
  const uptimePercent = availabilitySLO?.current || 100;

  return {
    period: { start, end },
    slos,
    overallCompliance: Math.round(overallCompliance * 10) / 10,
    incidents,
    uptimePercent: Math.round(uptimePercent * 1000) / 1000,
    generatedAt: new Date(),
  };
}

/**
 * Export report as JSON
 */
export function exportReportJSON(report: SLAReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Export report as Markdown
 */
export function exportReportMarkdown(report: SLAReport): string {
  const lines: string[] = [
    '# SLA Report',
    '',
    `**Period:** ${report.period.start.toISOString().split('T')[0]} to ${report.period.end.toISOString().split('T')[0]}`,
    `**Generated:** ${report.generatedAt.toISOString()}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Overall Compliance | ${report.overallCompliance}% |`,
    `| Uptime | ${report.uptimePercent}% |`,
    `| Active Incidents | ${report.incidents.filter((i) => !i.resolvedAt).length} |`,
    `| Total Incidents | ${report.incidents.length} |`,
    '',
    '## SLO Status',
    '',
    '| SLO | Target | Current | Status | Budget Remaining |',
    '|-----|--------|---------|--------|------------------|',
  ];

  for (const slo of report.slos) {
    const statusEmoji = {
      healthy: '✅',
      warning: '⚠️',
      critical: '🔴',
      breached: '❌',
    }[slo.status];

    lines.push(
      `| ${slo.slo.name} | ${slo.target}% | ${slo.current}% | ${statusEmoji} ${slo.status} | ${slo.budgetRemaining}% |`
    );
  }

  if (report.incidents.length > 0) {
    lines.push('', '## Incidents', '');
    lines.push('| ID | Severity | Title | Duration | Status |');
    lines.push('|----|----------|-------|----------|--------|');

    for (const incident of report.incidents) {
      const status = incident.resolvedAt ? 'Resolved' : 'Active';
      lines.push(
        `| ${incident.id} | ${incident.severity} | ${incident.title} | ${incident.duration || '-'} min | ${status} |`
      );
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Helper Functions
// =============================================================================

function parseWindow(window: SLOWindow): number {
  const windows: Record<SLOWindow, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
  };
  return windows[window];
}

function calculateTrend(metrics: MetricDataPoint[]): SLOStatus['trend'] {
  if (metrics.length < 10) return 'stable';

  const quarterLength = Math.floor(metrics.length / 4);
  const recent = metrics.slice(-quarterLength);
  const previous = metrics.slice(-quarterLength * 2, -quarterLength);

  if (recent.length === 0 || previous.length === 0) return 'stable';

  const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
  const previousAvg = previous.reduce((sum, m) => sum + m.value, 0) / previous.length;

  const diff = recentAvg - previousAvg;

  if (diff > 0.5) return 'improving';
  if (diff < -0.5) return 'degrading';
  return 'stable';
}

// =============================================================================
// Exports
// =============================================================================

export const slaMonitor = {
  record: {
    metric: recordMetric,
    availability: recordAvailability,
    latency: recordLatency,
    error: recordError,
    roleGateLatency: recordRoleGateLatency,
    provenanceIntegrity: recordProvenanceIntegrity,
  },
  incident: {
    record: recordIncident,
    resolve: resolveIncident,
    getActive: getActiveIncidents,
    getInPeriod: getIncidentsInPeriod,
  },
  slo: {
    calculate: calculateSLOStatus,
    getAll: getAllSLOStatuses,
    getByStatus: getSLOsByStatus,
    definitions: PHASE6_SLOS,
  },
  report: {
    generate: generateSLAReport,
    exportJSON: exportReportJSON,
    exportMarkdown: exportReportMarkdown,
  },
};
