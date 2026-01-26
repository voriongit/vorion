/**
 * Phase 6 Prometheus Metrics API
 *
 * Exposes metrics for monitoring Phase 6 Trust Engine performance.
 * Compatible with Prometheus scraping.
 */

import { NextRequest, NextResponse } from 'next/server'

// =============================================================================
// TYPES
// =============================================================================

interface MetricValue {
  value: number
  labels?: Record<string, string>
}

interface Metric {
  name: string
  help: string
  type: 'counter' | 'gauge' | 'histogram' | 'summary'
  values: MetricValue[]
}

// =============================================================================
// IN-MEMORY METRICS (use Redis/Prometheus pushgateway in production)
// =============================================================================

const counters: Map<string, Map<string, number>> = new Map()
const gauges: Map<string, Map<string, number>> = new Map()
const histogramBuckets: Map<string, Map<string, number[]>> = new Map()

// Initialize default metrics
function initializeMetrics() {
  // Counters
  counters.set('phase6_role_gate_evaluations_total', new Map())
  counters.set('phase6_ceiling_events_total', new Map())
  counters.set('phase6_gaming_alerts_total', new Map())
  counters.set('phase6_provenance_records_total', new Map())
  counters.set('phase6_context_operations_total', new Map())

  // Gauges
  gauges.set('phase6_agents_by_tier', new Map())
  gauges.set('phase6_active_operations', new Map())
  gauges.set('phase6_active_alerts', new Map())
  gauges.set('phase6_compliance_status', new Map())

  // Histograms
  histogramBuckets.set('phase6_role_gate_duration_seconds', new Map())
  histogramBuckets.set('phase6_ceiling_check_duration_seconds', new Map())
}

// Initialize on module load
initializeMetrics()

// =============================================================================
// METRIC RECORDING FUNCTIONS (export for use by other services)
// =============================================================================

export function incrementCounter(
  name: string,
  labels: Record<string, string> = {},
  value: number = 1
): void {
  const counter = counters.get(name)
  if (!counter) return

  const labelKey = labelsToKey(labels)
  const current = counter.get(labelKey) || 0
  counter.set(labelKey, current + value)
}

export function setGauge(
  name: string,
  value: number,
  labels: Record<string, string> = {}
): void {
  const gauge = gauges.get(name)
  if (!gauge) return

  const labelKey = labelsToKey(labels)
  gauge.set(labelKey, value)
}

export function observeHistogram(
  name: string,
  value: number,
  labels: Record<string, string> = {}
): void {
  const histogram = histogramBuckets.get(name)
  if (!histogram) return

  const labelKey = labelsToKey(labels)
  const values = histogram.get(labelKey) || []
  values.push(value)
  histogram.set(labelKey, values)
}

function labelsToKey(labels: Record<string, string>): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',')
}

function keyToLabels(key: string): Record<string, string> {
  if (!key) return {}
  const labels: Record<string, string> = {}
  const matches = key.matchAll(/(\w+)="([^"]+)"/g)
  for (const match of matches) {
    labels[match[1]] = match[2]
  }
  return labels
}

// =============================================================================
// METRICS FORMATTING
// =============================================================================

function formatPrometheusMetrics(): string {
  const lines: string[] = []

  // Counters
  for (const [name, values] of counters) {
    lines.push(`# HELP ${name} Phase 6 ${name.replace('phase6_', '').replace(/_/g, ' ')}`)
    lines.push(`# TYPE ${name} counter`)

    for (const [labelKey, value] of values) {
      const labelStr = labelKey ? `{${labelKey}}` : ''
      lines.push(`${name}${labelStr} ${value}`)
    }
    lines.push('')
  }

  // Gauges
  for (const [name, values] of gauges) {
    lines.push(`# HELP ${name} Phase 6 ${name.replace('phase6_', '').replace(/_/g, ' ')}`)
    lines.push(`# TYPE ${name} gauge`)

    for (const [labelKey, value] of values) {
      const labelStr = labelKey ? `{${labelKey}}` : ''
      lines.push(`${name}${labelStr} ${value}`)
    }
    lines.push('')
  }

  // Histograms (simplified - in production use proper histogram buckets)
  const buckets = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]

  for (const [name, values] of histogramBuckets) {
    lines.push(`# HELP ${name} Phase 6 ${name.replace('phase6_', '').replace(/_/g, ' ')}`)
    lines.push(`# TYPE ${name} histogram`)

    for (const [labelKey, observations] of values) {
      if (observations.length === 0) continue

      const labelBase = labelKey ? `${labelKey},` : ''

      // Bucket counts
      for (const bucket of buckets) {
        const count = observations.filter(v => v <= bucket).length
        lines.push(`${name}_bucket{${labelBase}le="${bucket}"} ${count}`)
      }
      lines.push(`${name}_bucket{${labelBase}le="+Inf"} ${observations.length}`)

      // Sum and count
      const sum = observations.reduce((a, b) => a + b, 0)
      lines.push(`${name}_sum{${labelKey}} ${sum}`)
      lines.push(`${name}_count{${labelKey}} ${observations.length}`)
    }
    lines.push('')
  }

  // Add process metrics
  lines.push('# HELP process_uptime_seconds Process uptime in seconds')
  lines.push('# TYPE process_uptime_seconds gauge')
  lines.push(`process_uptime_seconds ${process.uptime()}`)
  lines.push('')

  lines.push('# HELP nodejs_heap_size_used_bytes Node.js heap used')
  lines.push('# TYPE nodejs_heap_size_used_bytes gauge')
  lines.push(`nodejs_heap_size_used_bytes ${process.memoryUsage().heapUsed}`)
  lines.push('')

  return lines.join('\n')
}

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * GET /api/phase6/metrics
 * Prometheus metrics endpoint
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'prometheus'

  if (format === 'json') {
    // JSON format for debugging
    const metrics = {
      counters: Object.fromEntries(
        Array.from(counters.entries()).map(([name, values]) => [
          name,
          Object.fromEntries(values),
        ])
      ),
      gauges: Object.fromEntries(
        Array.from(gauges.entries()).map(([name, values]) => [
          name,
          Object.fromEntries(values),
        ])
      ),
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(metrics)
  }

  // Prometheus format (default)
  const metricsText = formatPrometheusMetrics()

  return new Response(metricsText, {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    },
  })
}

/**
 * POST /api/phase6/metrics
 * Record a metric (internal use)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, name, value, labels } = body

    switch (type) {
      case 'counter':
        incrementCounter(name, labels, value)
        break
      case 'gauge':
        setGauge(name, value, labels)
        break
      case 'histogram':
        observeHistogram(name, value, labels)
        break
      default:
        return NextResponse.json(
          { error: `Invalid metric type: ${type}` },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

// =============================================================================
// PREDEFINED METRIC HELPERS
// =============================================================================

/**
 * Record a role gate evaluation
 */
export function recordRoleGateEvaluation(
  decision: 'ALLOW' | 'DENY' | 'ESCALATE',
  durationMs: number,
  tier: string,
  role: string
): void {
  incrementCounter('phase6_role_gate_evaluations_total', { decision, tier, role })
  observeHistogram('phase6_role_gate_duration_seconds', durationMs / 1000, { tier })
}

/**
 * Record a ceiling event
 */
export function recordCeilingEvent(
  status: 'COMPLIANT' | 'WARNING' | 'VIOLATION',
  framework: string,
  ceilingApplied: boolean
): void {
  incrementCounter('phase6_ceiling_events_total', {
    status,
    framework,
    ceiling_applied: String(ceilingApplied),
  })
}

/**
 * Record a gaming alert
 */
export function recordGamingAlert(
  alertType: string,
  severity: string
): void {
  incrementCounter('phase6_gaming_alerts_total', { type: alertType, severity })
}

/**
 * Update agent tier distribution
 */
export function updateTierDistribution(
  tierCounts: Record<string, number>
): void {
  for (const [tier, count] of Object.entries(tierCounts)) {
    setGauge('phase6_agents_by_tier', count, { tier })
  }
}

/**
 * Update active operations count
 */
export function updateActiveOperations(count: number): void {
  setGauge('phase6_active_operations', count)
}

/**
 * Update active alerts count
 */
export function updateActiveAlerts(count: number): void {
  setGauge('phase6_active_alerts', count)
}
