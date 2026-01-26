/**
 * Phase 6 Trust Engine Load Tests
 *
 * k6 load testing script for ACI Trust Engine performance validation.
 *
 * Run with: k6 run tests/load/phase6-load-test.js
 *
 * Environment variables:
 *   - BASE_URL: API base URL (default: http://localhost:3000)
 *   - API_KEY: API authentication key
 *   - VUS: Virtual users (default: 10)
 *   - DURATION: Test duration (default: 30s)
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const API_KEY = __ENV.API_KEY || ''

export const options = {
  scenarios: {
    // Smoke test: minimal load
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      startTime: '0s',
      tags: { scenario: 'smoke' },
    },
    // Load test: normal expected load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 0 },
      ],
      startTime: '30s',
      tags: { scenario: 'load' },
    },
    // Stress test: beyond normal capacity
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      startTime: '2m30s',
      tags: { scenario: 'stress' },
    },
    // Spike test: sudden traffic surge
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '10s', target: 0 },
      ],
      startTime: '6m',
      tags: { scenario: 'spike' },
    },
  },
  thresholds: {
    // 95% of requests should be below 500ms
    http_req_duration: ['p(95)<500'],
    // Error rate should be below 1%
    http_req_failed: ['rate<0.01'],
    // Role gate evaluations should be fast
    role_gate_duration: ['p(95)<100'],
    // Stats endpoint should be fast (cached)
    stats_duration: ['p(95)<50'],
  },
}

// =============================================================================
// CUSTOM METRICS
// =============================================================================

const roleGateDuration = new Trend('role_gate_duration')
const roleGateErrors = new Rate('role_gate_errors')
const roleGateDecisions = new Counter('role_gate_decisions')

const statsDuration = new Trend('stats_duration')
const ceilingDuration = new Trend('ceiling_duration')
const provenanceDuration = new Trend('provenance_duration')

// =============================================================================
// HELPERS
// =============================================================================

const headers = {
  'Content-Type': 'application/json',
  ...(API_KEY && { Authorization: `Bearer ${API_KEY}` }),
}

function randomAgentId() {
  return `agent-${Math.random().toString(36).substring(2, 10)}`
}

function randomScore() {
  return Math.floor(Math.random() * 1001)
}

function randomTier() {
  const score = randomScore()
  if (score < 100) return 'T0'
  if (score < 300) return 'T1'
  if (score < 500) return 'T2'
  if (score < 700) return 'T3'
  if (score < 900) return 'T4'
  return 'T5'
}

function randomRole() {
  const roles = ['R_L0', 'R_L1', 'R_L2', 'R_L3', 'R_L4', 'R_L5', 'R_L6', 'R_L7', 'R_L8']
  return roles[Math.floor(Math.random() * roles.length)]
}

// =============================================================================
// TEST SCENARIOS
// =============================================================================

export default function () {
  group('Stats Endpoint', () => {
    const start = Date.now()
    const res = http.get(`${BASE_URL}/api/phase6/stats`, { headers })
    statsDuration.add(Date.now() - start)

    check(res, {
      'stats: status 200': (r) => r.status === 200,
      'stats: has context stats': (r) => {
        const body = JSON.parse(r.body)
        return body.contextStats !== undefined
      },
    })
  })

  sleep(0.1)

  group('Role Gate Evaluation', () => {
    const agentId = randomAgentId()
    const score = randomScore()
    const tier = randomTier()
    const role = randomRole()

    const payload = JSON.stringify({
      agentId,
      requestedRole: role,
      currentTier: tier,
      currentScore: score,
    })

    const start = Date.now()
    const res = http.post(`${BASE_URL}/api/phase6/role-gates`, payload, { headers })
    const duration = Date.now() - start

    roleGateDuration.add(duration)

    const success = check(res, {
      'role-gate: status 200': (r) => r.status === 200,
      'role-gate: has decision': (r) => {
        try {
          const body = JSON.parse(r.body)
          return ['ALLOW', 'DENY', 'ESCALATE'].includes(body.decision)
        } catch {
          return false
        }
      },
    })

    if (!success) {
      roleGateErrors.add(1)
    } else {
      roleGateErrors.add(0)
      try {
        const body = JSON.parse(res.body)
        roleGateDecisions.add(1, { decision: body.decision })
      } catch {
        // Ignore parse errors
      }
    }
  })

  sleep(0.1)

  group('Ceiling Check', () => {
    const agentId = randomAgentId()
    const score = randomScore()

    const payload = JSON.stringify({
      agentId,
      currentScore: score,
    })

    const start = Date.now()
    const res = http.post(`${BASE_URL}/api/phase6/ceiling`, payload, { headers })
    ceilingDuration.add(Date.now() - start)

    check(res, {
      'ceiling: status 200': (r) => r.status === 200,
      'ceiling: has effective score': (r) => {
        try {
          const body = JSON.parse(r.body)
          return typeof body.effectiveScore === 'number'
        } catch {
          return false
        }
      },
    })
  })

  sleep(0.1)

  group('Provenance Query', () => {
    const agentId = randomAgentId()

    const start = Date.now()
    const res = http.get(`${BASE_URL}/api/phase6/provenance?agentId=${agentId}`, { headers })
    provenanceDuration.add(Date.now() - start)

    check(res, {
      'provenance: status 200 or 404': (r) => r.status === 200 || r.status === 404,
    })
  })

  sleep(0.1)

  group('Alerts Query', () => {
    const res = http.get(`${BASE_URL}/api/phase6/alerts?status=ACTIVE&limit=10`, { headers })

    check(res, {
      'alerts: status 200': (r) => r.status === 200,
      'alerts: returns array': (r) => {
        try {
          const body = JSON.parse(r.body)
          return Array.isArray(body.alerts)
        } catch {
          return false
        }
      },
    })
  })

  sleep(0.5)
}

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export function setup() {
  console.log(`Starting load test against ${BASE_URL}`)

  // Warm up the cache
  http.get(`${BASE_URL}/api/phase6/stats`, { headers })

  return { startTime: Date.now() }
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000
  console.log(`Load test completed in ${duration.toFixed(2)}s`)
}

// =============================================================================
// SUMMARY HANDLER
// =============================================================================

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
    'tests/load/results/summary.json': JSON.stringify(data, null, 2),
    'tests/load/results/summary.html': htmlReport(data),
  }
}

function textSummary(data, options) {
  const lines = [
    '\n' + '='.repeat(60),
    'PHASE 6 TRUST ENGINE LOAD TEST RESULTS',
    '='.repeat(60),
    '',
    `Total Requests: ${data.metrics.http_reqs.values.count}`,
    `Failed Requests: ${data.metrics.http_req_failed.values.passes}`,
    `Error Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`,
    '',
    'LATENCY (p95):',
    `  All requests: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`,
    `  Role gates: ${data.metrics.role_gate_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms`,
    `  Stats: ${data.metrics.stats_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms`,
    `  Ceiling: ${data.metrics.ceiling_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms`,
    '',
    'THRESHOLDS:',
  ]

  for (const [name, threshold] of Object.entries(data.thresholds || {})) {
    const status = threshold.ok ? 'PASS' : 'FAIL'
    lines.push(`  ${name}: ${status}`)
  }

  lines.push('')
  lines.push('='.repeat(60))

  return lines.join('\n')
}

function htmlReport(data) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Phase 6 Load Test Results</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4f46e5; color: white; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .pass { color: #16a34a; font-weight: bold; }
    .fail { color: #dc2626; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Phase 6 Trust Engine Load Test Results</h1>
  <p>Generated: ${new Date().toISOString()}</p>

  <h2>Summary</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total Requests</td><td>${data.metrics.http_reqs.values.count}</td></tr>
    <tr><td>Failed Requests</td><td>${data.metrics.http_req_failed.values.passes}</td></tr>
    <tr><td>Error Rate</td><td>${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%</td></tr>
    <tr><td>Avg Response Time</td><td>${data.metrics.http_req_duration.values.avg.toFixed(2)}ms</td></tr>
    <tr><td>p95 Response Time</td><td>${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms</td></tr>
  </table>

  <h2>Thresholds</h2>
  <table>
    <tr><th>Threshold</th><th>Status</th></tr>
    ${Object.entries(data.thresholds || {}).map(([name, t]) =>
      `<tr><td>${name}</td><td class="${t.ok ? 'pass' : 'fail'}">${t.ok ? 'PASS' : 'FAIL'}</td></tr>`
    ).join('\n')}
  </table>
</body>
</html>`
}
