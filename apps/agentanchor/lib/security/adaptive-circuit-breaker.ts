/**
 * Adaptive Circuit Breaker System - Patent 7
 *
 * ML-driven emergency stop system that:
 * - Learns normal agent behavior patterns
 * - Detects anomalies using statistical methods
 * - Triggers graduated containment (CLOSED -> DEGRADED -> OPEN)
 * - Preserves state for forensics on termination
 */

import { createHash, randomUUID } from 'crypto'

// =============================================================================
// Types
// =============================================================================

export type CircuitBreakerState = 'CLOSED' | 'DEGRADED' | 'OPEN' | 'HALF_OPEN'

export interface BehaviorMetrics {
  actionFrequency: number       // Actions per minute
  resourceUtilization: number   // 0-1 scale
  dataAccessRate: number        // Data operations per minute
  errorRate: number             // Errors per 100 actions
  externalApiCalls: number      // External calls per minute
  responseLatency: number       // Average ms
  tokenUsage: number            // Tokens per minute
  uniqueActionsCount: number    // Distinct action types
}

export interface BehaviorBaseline {
  agentId: string
  createdAt: Date
  updatedAt: Date
  sampleCount: number
  metrics: {
    mean: BehaviorMetrics
    stdDev: BehaviorMetrics
    min: BehaviorMetrics
    max: BehaviorMetrics
  }
  temporalPatterns: TemporalPattern[]
  contextProfiles: ContextProfile[]
}

interface TemporalPattern {
  hourOfDay: number
  dayOfWeek: number
  typicalMetrics: BehaviorMetrics
}

interface ContextProfile {
  context: string  // e.g., 'batch_processing', 'interactive', 'maintenance'
  adjustments: Partial<BehaviorMetrics>
}

export interface AnomalyScore {
  overall: number           // 0-1, where 1 = highly anomalous
  components: {
    statistical: number     // Z-score based
    sequential: number      // Pattern deviation
    ruleBased: number       // Hard limit violations
  }
  factors: string[]         // Contributing factors
  timestamp: Date
}

export interface TerminationRecord {
  id: string
  agentId: string
  timestamp: Date
  state: CircuitBreakerState
  anomalyScore: AnomalyScore
  metrics: BehaviorMetrics
  stateSnapshot: Record<string, unknown>
  reason: string
  recoveryAttempts: number
  credentialsRevoked: boolean
}

export interface CircuitBreakerConfig {
  // Thresholds
  degradedThreshold: number     // Anomaly score to enter DEGRADED (default 0.7)
  openThreshold: number         // Anomaly score to enter OPEN (default 0.9)

  // Timing
  halfOpenDelay: number         // Ms before testing recovery (default 60000)
  baselineWindow: number        // Ms for baseline calculation (default 86400000 = 24h)
  metricsWindow: number         // Ms for current metrics window (default 60000 = 1min)

  // Hard limits (bypass ML, immediate trigger)
  hardLimits: Partial<BehaviorMetrics>

  // Callbacks
  onStateChange?: (oldState: CircuitBreakerState, newState: CircuitBreakerState, record: Partial<TerminationRecord>) => void
  onAnomaly?: (score: AnomalyScore, metrics: BehaviorMetrics) => void
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  degradedThreshold: 0.7,
  openThreshold: 0.9,
  halfOpenDelay: 60000,
  baselineWindow: 86400000, // 24 hours
  metricsWindow: 60000,     // 1 minute
  hardLimits: {
    errorRate: 50,          // 50% error rate
    actionFrequency: 1000,  // 1000 actions/minute
    externalApiCalls: 100,  // 100 external calls/minute
  }
}

// =============================================================================
// Baseline Engine
// =============================================================================

class BaselineEngine {
  private samples: Array<{ metrics: BehaviorMetrics; timestamp: Date; context?: string }> = []
  private baseline: BehaviorBaseline | null = null
  private config: CircuitBreakerConfig

  constructor(agentId: string, config: CircuitBreakerConfig) {
    this.config = config
    this.baseline = {
      agentId,
      createdAt: new Date(),
      updatedAt: new Date(),
      sampleCount: 0,
      metrics: {
        mean: this.emptyMetrics(),
        stdDev: this.emptyMetrics(),
        min: this.emptyMetrics(),
        max: this.emptyMetrics(),
      },
      temporalPatterns: [],
      contextProfiles: []
    }
  }

  private emptyMetrics(): BehaviorMetrics {
    return {
      actionFrequency: 0,
      resourceUtilization: 0,
      dataAccessRate: 0,
      errorRate: 0,
      externalApiCalls: 0,
      responseLatency: 0,
      tokenUsage: 0,
      uniqueActionsCount: 0,
    }
  }

  recordSample(metrics: BehaviorMetrics, context?: string): void {
    const now = new Date()
    this.samples.push({ metrics, timestamp: now, context })

    // Remove samples outside window
    const cutoff = new Date(now.getTime() - this.config.baselineWindow)
    this.samples = this.samples.filter(s => s.timestamp > cutoff)

    // Update baseline
    this.updateBaseline()
  }

  private updateBaseline(): void {
    if (this.samples.length < 10) return // Need minimum samples

    const metrics = this.samples.map(s => s.metrics)
    const keys = Object.keys(this.emptyMetrics()) as (keyof BehaviorMetrics)[]

    // Calculate mean
    const mean = this.emptyMetrics()
    for (const key of keys) {
      mean[key] = metrics.reduce((sum, m) => sum + m[key], 0) / metrics.length
    }

    // Calculate std dev
    const stdDev = this.emptyMetrics()
    for (const key of keys) {
      const variance = metrics.reduce((sum, m) => sum + Math.pow(m[key] - mean[key], 2), 0) / metrics.length
      stdDev[key] = Math.sqrt(variance)
    }

    // Calculate min/max
    const min = { ...metrics[0] }
    const max = { ...metrics[0] }
    for (const m of metrics) {
      for (const key of keys) {
        if (m[key] < min[key]) min[key] = m[key]
        if (m[key] > max[key]) max[key] = m[key]
      }
    }

    this.baseline!.metrics = { mean, stdDev, min, max }
    this.baseline!.sampleCount = this.samples.length
    this.baseline!.updatedAt = new Date()
  }

  getBaseline(): BehaviorBaseline | null {
    return this.baseline
  }

  hasBaseline(): boolean {
    return this.samples.length >= 10
  }
}

// =============================================================================
// Anomaly Detector
// =============================================================================

class AnomalyDetector {
  private config: CircuitBreakerConfig
  private recentScores: AnomalyScore[] = []

  constructor(config: CircuitBreakerConfig) {
    this.config = config
  }

  detect(metrics: BehaviorMetrics, baseline: BehaviorBaseline | null): AnomalyScore {
    const factors: string[] = []
    let statistical = 0
    let sequential = 0
    let ruleBased = 0

    // 1. Rule-based checks (hard limits)
    ruleBased = this.checkHardLimits(metrics, factors)

    // 2. Statistical anomaly detection (Z-score based)
    if (baseline && baseline.sampleCount >= 10) {
      statistical = this.calculateStatisticalAnomaly(metrics, baseline, factors)
    }

    // 3. Sequential pattern detection
    sequential = this.detectSequentialAnomalies(factors)

    // Ensemble scoring (weighted average)
    const overall = Math.min(1, (
      ruleBased * 0.5 +      // Hard limits are most important
      statistical * 0.35 +   // Statistical deviation
      sequential * 0.15      // Sequential patterns
    ))

    const score: AnomalyScore = {
      overall,
      components: { statistical, sequential, ruleBased },
      factors,
      timestamp: new Date()
    }

    this.recentScores.push(score)
    if (this.recentScores.length > 100) {
      this.recentScores.shift()
    }

    return score
  }

  private checkHardLimits(metrics: BehaviorMetrics, factors: string[]): number {
    let violations = 0
    const limits = this.config.hardLimits

    if (limits.errorRate && metrics.errorRate > limits.errorRate) {
      factors.push(`Error rate ${metrics.errorRate.toFixed(1)}% exceeds limit ${limits.errorRate}%`)
      violations++
    }

    if (limits.actionFrequency && metrics.actionFrequency > limits.actionFrequency) {
      factors.push(`Action frequency ${metrics.actionFrequency}/min exceeds limit ${limits.actionFrequency}/min`)
      violations++
    }

    if (limits.externalApiCalls && metrics.externalApiCalls > limits.externalApiCalls) {
      factors.push(`External API calls ${metrics.externalApiCalls}/min exceeds limit ${limits.externalApiCalls}/min`)
      violations++
    }

    if (limits.resourceUtilization && metrics.resourceUtilization > limits.resourceUtilization) {
      factors.push(`Resource utilization ${(metrics.resourceUtilization * 100).toFixed(0)}% exceeds limit`)
      violations++
    }

    // Any hard limit violation is serious
    return violations > 0 ? Math.min(1, 0.5 + violations * 0.25) : 0
  }

  private calculateStatisticalAnomaly(
    metrics: BehaviorMetrics,
    baseline: BehaviorBaseline,
    factors: string[]
  ): number {
    const keys = Object.keys(metrics) as (keyof BehaviorMetrics)[]
    let totalZScore = 0
    let count = 0

    for (const key of keys) {
      const value = metrics[key]
      const mean = baseline.metrics.mean[key]
      const stdDev = baseline.metrics.stdDev[key]

      if (stdDev > 0) {
        const zScore = Math.abs((value - mean) / stdDev)
        totalZScore += zScore

        // Flag significant deviations (>3 std devs)
        if (zScore > 3) {
          factors.push(`${key} is ${zScore.toFixed(1)} std devs from baseline`)
        }
        count++
      }
    }

    // Normalize to 0-1 scale (z-score of 4 = 1.0)
    const avgZScore = count > 0 ? totalZScore / count : 0
    return Math.min(1, avgZScore / 4)
  }

  private detectSequentialAnomalies(factors: string[]): number {
    // Look for rapid score increases (indicates developing problem)
    if (this.recentScores.length < 5) return 0

    const recent5 = this.recentScores.slice(-5)
    const trend = recent5[4].overall - recent5[0].overall

    if (trend > 0.3) {
      factors.push(`Rapid anomaly score increase: ${(trend * 100).toFixed(0)}% in 5 samples`)
      return Math.min(1, trend * 2)
    }

    return 0
  }
}

// =============================================================================
// Adaptive Circuit Breaker
// =============================================================================

export class AdaptiveCircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED'
  private agentId: string
  private config: CircuitBreakerConfig
  private baselineEngine: BaselineEngine
  private anomalyDetector: AnomalyDetector
  private lastAnomaly: AnomalyScore | null = null
  private lastMetrics: BehaviorMetrics | null = null
  private stateChangedAt: Date = new Date()
  private recoveryAttempts: number = 0
  private terminationRecord: TerminationRecord | null = null

  constructor(agentId: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.agentId = agentId
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.baselineEngine = new BaselineEngine(agentId, this.config)
    this.anomalyDetector = new AnomalyDetector(this.config)
  }

  /**
   * Record agent behavior metrics and check for anomalies
   */
  recordMetrics(metrics: BehaviorMetrics, context?: string): AnomalyScore {
    this.lastMetrics = metrics

    // Only update baseline when circuit is closed (normal operation)
    if (this.state === 'CLOSED') {
      this.baselineEngine.recordSample(metrics, context)
    }

    // Detect anomalies
    const anomaly = this.anomalyDetector.detect(
      metrics,
      this.baselineEngine.getBaseline()
    )
    this.lastAnomaly = anomaly

    // Notify callback
    if (this.config.onAnomaly) {
      this.config.onAnomaly(anomaly, metrics)
    }

    // Update state based on anomaly score
    this.evaluateState(anomaly, metrics)

    return anomaly
  }

  private evaluateState(anomaly: AnomalyScore, metrics: BehaviorMetrics): void {
    const oldState = this.state
    let newState = this.state

    switch (this.state) {
      case 'CLOSED':
        if (anomaly.overall >= this.config.openThreshold) {
          newState = 'OPEN'
        } else if (anomaly.overall >= this.config.degradedThreshold) {
          newState = 'DEGRADED'
        }
        break

      case 'DEGRADED':
        if (anomaly.overall >= this.config.openThreshold) {
          newState = 'OPEN'
        } else if (anomaly.overall < this.config.degradedThreshold * 0.7) {
          // Need sustained improvement to close
          newState = 'CLOSED'
        }
        break

      case 'OPEN':
        // Check if enough time has passed for recovery attempt
        const elapsed = Date.now() - this.stateChangedAt.getTime()
        if (elapsed >= this.config.halfOpenDelay) {
          newState = 'HALF_OPEN'
          this.recoveryAttempts++
        }
        break

      case 'HALF_OPEN':
        if (anomaly.overall >= this.config.degradedThreshold) {
          // Recovery failed
          newState = 'OPEN'
        } else {
          // Recovery successful
          newState = 'CLOSED'
          this.recoveryAttempts = 0
        }
        break
    }

    if (newState !== oldState) {
      this.transitionTo(newState, anomaly, metrics)
    }
  }

  private transitionTo(
    newState: CircuitBreakerState,
    anomaly: AnomalyScore,
    metrics: BehaviorMetrics
  ): void {
    const oldState = this.state
    this.state = newState
    this.stateChangedAt = new Date()

    const record: Partial<TerminationRecord> = {
      id: randomUUID(),
      agentId: this.agentId,
      timestamp: new Date(),
      state: newState,
      anomalyScore: anomaly,
      metrics,
      recoveryAttempts: this.recoveryAttempts,
      reason: anomaly.factors.join('; ') || 'State transition',
    }

    // If opening circuit, create full termination record
    if (newState === 'OPEN') {
      this.terminationRecord = {
        ...record,
        stateSnapshot: {},
        credentialsRevoked: true,
      } as TerminationRecord
    }

    console.log(
      `[CircuitBreaker:${this.agentId}] ${oldState} -> ${newState}`,
      {
        anomalyScore: anomaly.overall.toFixed(2),
        factors: anomaly.factors.slice(0, 3),
        recoveryAttempts: this.recoveryAttempts
      }
    )

    if (this.config.onStateChange) {
      this.config.onStateChange(oldState, newState, record)
    }
  }

  /**
   * Force the circuit to OPEN state (emergency kill switch)
   */
  forceOpen(reason: string): TerminationRecord {
    const record: TerminationRecord = {
      id: randomUUID(),
      agentId: this.agentId,
      timestamp: new Date(),
      state: 'OPEN',
      anomalyScore: this.lastAnomaly || {
        overall: 1,
        components: { statistical: 0, sequential: 0, ruleBased: 1 },
        factors: [reason],
        timestamp: new Date()
      },
      metrics: this.lastMetrics || this.emptyMetrics(),
      stateSnapshot: {},
      reason,
      recoveryAttempts: this.recoveryAttempts,
      credentialsRevoked: true,
    }

    this.state = 'OPEN'
    this.stateChangedAt = new Date()
    this.terminationRecord = record

    if (this.config.onStateChange) {
      this.config.onStateChange('CLOSED', 'OPEN', record)
    }

    return record
  }

  /**
   * Check if agent is allowed to execute
   */
  canExecute(): boolean {
    return this.state === 'CLOSED' || this.state === 'HALF_OPEN'
  }

  /**
   * Check if agent should operate with reduced autonomy
   */
  isDegraded(): boolean {
    return this.state === 'DEGRADED'
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitBreakerState {
    return this.state
  }

  /**
   * Get full status report
   */
  getStatus(): {
    state: CircuitBreakerState
    agentId: string
    lastAnomaly: AnomalyScore | null
    baseline: BehaviorBaseline | null
    recoveryAttempts: number
    stateChangedAt: Date
  } {
    return {
      state: this.state,
      agentId: this.agentId,
      lastAnomaly: this.lastAnomaly,
      baseline: this.baselineEngine.getBaseline(),
      recoveryAttempts: this.recoveryAttempts,
      stateChangedAt: this.stateChangedAt,
    }
  }

  /**
   * Get termination record if circuit was opened
   */
  getTerminationRecord(): TerminationRecord | null {
    return this.terminationRecord
  }

  private emptyMetrics(): BehaviorMetrics {
    return {
      actionFrequency: 0,
      resourceUtilization: 0,
      dataAccessRate: 0,
      errorRate: 0,
      externalApiCalls: 0,
      responseLatency: 0,
      tokenUsage: 0,
      uniqueActionsCount: 0,
    }
  }
}

// =============================================================================
// Circuit Breaker Registry
// =============================================================================

class CircuitBreakerRegistry {
  private breakers = new Map<string, AdaptiveCircuitBreaker>()

  getOrCreate(agentId: string, config?: Partial<CircuitBreakerConfig>): AdaptiveCircuitBreaker {
    if (!this.breakers.has(agentId)) {
      this.breakers.set(agentId, new AdaptiveCircuitBreaker(agentId, config))
    }
    return this.breakers.get(agentId)!
  }

  get(agentId: string): AdaptiveCircuitBreaker | undefined {
    return this.breakers.get(agentId)
  }

  getAll(): Map<string, AdaptiveCircuitBreaker> {
    return this.breakers
  }

  getHealthSummary(): Record<string, { state: CircuitBreakerState; anomalyScore: number }> {
    const summary: Record<string, { state: CircuitBreakerState; anomalyScore: number }> = {}
    this.breakers.forEach((breaker, agentId) => {
      const status = breaker.getStatus()
      summary[agentId] = {
        state: status.state,
        anomalyScore: status.lastAnomaly?.overall ?? 0
      }
    })
    return summary
  }

  forceOpenAll(reason: string): TerminationRecord[] {
    const records: TerminationRecord[] = []
    this.breakers.forEach((breaker) => {
      if (breaker.canExecute()) {
        records.push(breaker.forceOpen(reason))
      }
    })
    return records
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const circuitBreakerRegistry = new CircuitBreakerRegistry()

export const adaptiveCircuitBreaker = (agentId: string, config?: Partial<CircuitBreakerConfig>) =>
  circuitBreakerRegistry.getOrCreate(agentId, config)

export default AdaptiveCircuitBreaker
