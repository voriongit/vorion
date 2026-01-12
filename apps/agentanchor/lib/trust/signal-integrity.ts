/**
 * Signal Integrity Verification - Patent 1 Security Hardening
 *
 * Ensures trust score inputs are authentic and untampered:
 * - Signal authentication with component signatures
 * - Timestamp verification from trusted sources
 * - Source validation against component registry
 * - Integrity hashing for tamper detection
 * - Adversarial resistance mechanisms
 * - Cryptographic score binding
 */

import { createHash, createHmac, randomBytes } from 'crypto'

// =============================================================================
// Types
// =============================================================================

export interface TrustSignal {
  id: string
  type: TrustSignalType
  source: SignalSource
  value: number
  timestamp: VerifiedTimestamp
  context: Record<string, unknown>
  signature: string
  integrityHash: string
}

export type TrustSignalType =
  | 'action_outcome'
  | 'policy_compliance'
  | 'human_override'
  | 'resource_usage'
  | 'error_event'
  | 'council_decision'
  | 'user_feedback'
  | 'decay_event'

export interface SignalSource {
  componentId: string
  componentType: 'worker' | 'council' | 'observer' | 'academy' | 'human' | 'system'
  version: string
  publicKey?: string
}

export interface VerifiedTimestamp {
  iso: string
  unix: number
  source: 'system' | 'ntp' | 'tsa'
  verified: boolean
  drift?: number  // ms difference from trusted source
}

export interface SignalVerificationResult {
  valid: boolean
  checks: {
    signatureValid: boolean
    timestampValid: boolean
    sourceValid: boolean
    integrityValid: boolean
    notReplayed: boolean
  }
  errors: string[]
  warnings: string[]
}

export interface ScoreCertificate {
  agentId: string
  score: number
  previousScore: number
  timestamp: VerifiedTimestamp
  inputSignalHashes: string[]
  calculationParams: CalculationParams
  certificateHash: string
  signature: string
}

interface CalculationParams {
  weights: Record<TrustSignalType, number>
  decayApplied: boolean
  decayPercent: number
  velocityLimited: boolean
  outliersDampened: number
}

// =============================================================================
// Configuration
// =============================================================================

const SIGNAL_CONFIG = {
  // Timestamp validation
  maxTimestampDrift: 5000,      // 5 seconds max drift
  maxSignalAge: 300000,         // 5 minutes max age

  // Adversarial resistance
  velocityLimit: 50,            // Max score change per calculation
  velocityWindow: 3600000,      // 1 hour window for velocity
  outlierThreshold: 3,          // Z-score threshold for outlier dampening
  correlationWindow: 10,        // Signals to check for correlation

  // Replay protection
  nonceExpiry: 600000,          // 10 minute nonce expiry
}

// Component registry (in production, this would be in database)
const REGISTERED_COMPONENTS = new Map<string, SignalSource>([
  ['worker-runtime', { componentId: 'worker-runtime', componentType: 'worker', version: '1.0.0' }],
  ['council-service', { componentId: 'council-service', componentType: 'council', version: '1.0.0' }],
  ['observer-service', { componentId: 'observer-service', componentType: 'observer', version: '1.0.0' }],
  ['academy-service', { componentId: 'academy-service', componentType: 'academy', version: '1.0.0' }],
  ['human-interface', { componentId: 'human-interface', componentType: 'human', version: '1.0.0' }],
  ['system-scheduler', { componentId: 'system-scheduler', componentType: 'system', version: '1.0.0' }],
])

// =============================================================================
// Signal Creation
// =============================================================================

export class SignalFactory {
  private secretKey: string
  private usedNonces = new Set<string>()

  constructor(secretKey?: string) {
    this.secretKey = secretKey || process.env.SIGNAL_SECRET_KEY || randomBytes(32).toString('hex')
  }

  /**
   * Create a verified trust signal
   */
  createSignal(
    type: TrustSignalType,
    source: SignalSource,
    value: number,
    context: Record<string, unknown> = {}
  ): TrustSignal {
    const id = `sig_${randomBytes(16).toString('hex')}`
    const timestamp = this.createVerifiedTimestamp()

    const payload = {
      id,
      type,
      source: source.componentId,
      value,
      timestamp: timestamp.iso,
      context
    }

    const integrityHash = this.hashPayload(payload)
    const signature = this.signPayload(payload)

    return {
      id,
      type,
      source,
      value,
      timestamp,
      context,
      signature,
      integrityHash
    }
  }

  private createVerifiedTimestamp(): VerifiedTimestamp {
    const now = new Date()
    return {
      iso: now.toISOString(),
      unix: Math.floor(now.getTime() / 1000),
      source: 'system',
      verified: true,
      drift: 0
    }
  }

  private hashPayload(payload: unknown): string {
    const json = JSON.stringify(payload, Object.keys(payload as object).sort())
    return createHash('sha256').update(json).digest('hex')
  }

  private signPayload(payload: unknown): string {
    const json = JSON.stringify(payload, Object.keys(payload as object).sort())
    return createHmac('sha256', this.secretKey).update(json).digest('hex')
  }
}

// =============================================================================
// Signal Verification
// =============================================================================

export class SignalVerifier {
  private secretKey: string
  private recentNonces = new Map<string, number>()

  constructor(secretKey?: string) {
    this.secretKey = secretKey || process.env.SIGNAL_SECRET_KEY || ''
  }

  /**
   * Verify a trust signal's authenticity and integrity
   */
  verify(signal: TrustSignal): SignalVerificationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const checks = {
      signatureValid: false,
      timestampValid: false,
      sourceValid: false,
      integrityValid: false,
      notReplayed: false
    }

    // 1. Verify signature
    checks.signatureValid = this.verifySignature(signal)
    if (!checks.signatureValid) {
      errors.push('Signal signature verification failed')
    }

    // 2. Verify timestamp
    const timestampResult = this.verifyTimestamp(signal.timestamp)
    checks.timestampValid = timestampResult.valid
    if (!timestampResult.valid) {
      errors.push(timestampResult.error || 'Timestamp verification failed')
    }
    if (timestampResult.warning) {
      warnings.push(timestampResult.warning)
    }

    // 3. Verify source
    checks.sourceValid = this.verifySource(signal.source)
    if (!checks.sourceValid) {
      errors.push(`Unknown signal source: ${signal.source.componentId}`)
    }

    // 4. Verify integrity hash
    checks.integrityValid = this.verifyIntegrity(signal)
    if (!checks.integrityValid) {
      errors.push('Signal integrity hash mismatch - possible tampering')
    }

    // 5. Check for replay
    checks.notReplayed = this.checkReplay(signal.id)
    if (!checks.notReplayed) {
      errors.push('Signal replay detected - duplicate signal ID')
    }

    return {
      valid: errors.length === 0,
      checks,
      errors,
      warnings
    }
  }

  private verifySignature(signal: TrustSignal): boolean {
    const payload = {
      id: signal.id,
      type: signal.type,
      source: signal.source.componentId,
      value: signal.value,
      timestamp: signal.timestamp.iso,
      context: signal.context
    }
    const json = JSON.stringify(payload, Object.keys(payload).sort())
    const expected = createHmac('sha256', this.secretKey).update(json).digest('hex')
    return signal.signature === expected
  }

  private verifyTimestamp(timestamp: VerifiedTimestamp): { valid: boolean; error?: string; warning?: string } {
    const now = Date.now()
    const signalTime = timestamp.unix * 1000

    // Check for future timestamps
    if (signalTime > now + SIGNAL_CONFIG.maxTimestampDrift) {
      return { valid: false, error: 'Signal timestamp is in the future' }
    }

    // Check for stale signals
    if (now - signalTime > SIGNAL_CONFIG.maxSignalAge) {
      return { valid: false, error: 'Signal is too old' }
    }

    // Check drift
    if (timestamp.drift && Math.abs(timestamp.drift) > SIGNAL_CONFIG.maxTimestampDrift) {
      return { valid: true, warning: `High timestamp drift: ${timestamp.drift}ms` }
    }

    return { valid: true }
  }

  private verifySource(source: SignalSource): boolean {
    const registered = REGISTERED_COMPONENTS.get(source.componentId)
    return registered !== undefined && registered.componentType === source.componentType
  }

  private verifyIntegrity(signal: TrustSignal): boolean {
    const payload = {
      id: signal.id,
      type: signal.type,
      source: signal.source.componentId,
      value: signal.value,
      timestamp: signal.timestamp.iso,
      context: signal.context
    }
    const json = JSON.stringify(payload, Object.keys(payload).sort())
    const computed = createHash('sha256').update(json).digest('hex')
    return signal.integrityHash === computed
  }

  private checkReplay(signalId: string): boolean {
    const now = Date.now()

    // Clean expired nonces
    for (const [id, timestamp] of this.recentNonces) {
      if (now - timestamp > SIGNAL_CONFIG.nonceExpiry) {
        this.recentNonces.delete(id)
      }
    }

    // Check if we've seen this signal
    if (this.recentNonces.has(signalId)) {
      return false
    }

    this.recentNonces.set(signalId, now)
    return true
  }
}

// =============================================================================
// Adversarial Resistance
// =============================================================================

export class AdversarialResistance {
  private scoreHistory: Array<{ score: number; timestamp: number }> = []
  private signalHistory: Array<{ type: TrustSignalType; value: number; timestamp: number }> = []

  /**
   * Apply velocity limiting to score changes
   */
  applyVelocityLimit(currentScore: number, proposedScore: number): {
    limitedScore: number
    wasLimited: boolean
  } {
    const change = proposedScore - currentScore
    const absChange = Math.abs(change)

    if (absChange <= SIGNAL_CONFIG.velocityLimit) {
      return { limitedScore: proposedScore, wasLimited: false }
    }

    // Limit the change
    const limitedChange = Math.sign(change) * SIGNAL_CONFIG.velocityLimit
    return {
      limitedScore: currentScore + limitedChange,
      wasLimited: true
    }
  }

  /**
   * Dampen outlier signal values
   */
  dampenOutliers(signals: TrustSignal[]): {
    dampened: TrustSignal[]
    outlierCount: number
  } {
    if (signals.length < 3) {
      return { dampened: signals, outlierCount: 0 }
    }

    // Calculate mean and std dev of values
    const values = signals.map(s => s.value)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)

    if (stdDev === 0) {
      return { dampened: signals, outlierCount: 0 }
    }

    let outlierCount = 0
    const dampened = signals.map(signal => {
      const zScore = Math.abs((signal.value - mean) / stdDev)

      if (zScore > SIGNAL_CONFIG.outlierThreshold) {
        outlierCount++
        // Dampen to threshold boundary
        const dampenedValue = mean + Math.sign(signal.value - mean) * SIGNAL_CONFIG.outlierThreshold * stdDev
        return { ...signal, value: dampenedValue }
      }

      return signal
    })

    return { dampened, outlierCount }
  }

  /**
   * Validate cross-signal correlation
   */
  validateCorrelation(signals: TrustSignal[]): {
    valid: boolean
    anomalies: string[]
  } {
    const anomalies: string[] = []

    // Group signals by type
    const byType = new Map<TrustSignalType, TrustSignal[]>()
    for (const signal of signals) {
      const existing = byType.get(signal.type) || []
      existing.push(signal)
      byType.set(signal.type, existing)
    }

    // Check for impossible combinations
    const actionOutcomes = byType.get('action_outcome') || []
    const errorEvents = byType.get('error_event') || []

    // If many errors but high success in action outcomes, that's suspicious
    if (errorEvents.length > 5 && actionOutcomes.length > 0) {
      const avgActionValue = actionOutcomes.reduce((s, a) => s + a.value, 0) / actionOutcomes.length
      if (avgActionValue > 0.8) {
        anomalies.push('High action success rate despite many errors - possible signal manipulation')
      }
    }

    // Check for rapid positive signals (gaming)
    const recentPositive = signals.filter(s => s.value > 0)
    if (recentPositive.length > 10) {
      const timeSpan = Math.max(...recentPositive.map(s => s.timestamp.unix)) -
                       Math.min(...recentPositive.map(s => s.timestamp.unix))
      if (timeSpan < 60) { // 10+ positive signals in under a minute
        anomalies.push('Unusually rapid positive signals - possible gaming attempt')
      }
    }

    return {
      valid: anomalies.length === 0,
      anomalies
    }
  }

  /**
   * Record score for velocity tracking
   */
  recordScore(score: number): void {
    const now = Date.now()
    this.scoreHistory.push({ score, timestamp: now })

    // Keep only recent history
    const cutoff = now - SIGNAL_CONFIG.velocityWindow
    this.scoreHistory = this.scoreHistory.filter(h => h.timestamp > cutoff)
  }
}

// =============================================================================
// Score Certificate Generation
// =============================================================================

export class ScoreCertificateGenerator {
  private secretKey: string

  constructor(secretKey?: string) {
    this.secretKey = secretKey || process.env.SCORE_CERT_KEY || randomBytes(32).toString('hex')
  }

  /**
   * Generate a cryptographically-bound score certificate
   */
  generate(
    agentId: string,
    score: number,
    previousScore: number,
    inputSignals: TrustSignal[],
    params: CalculationParams
  ): ScoreCertificate {
    const timestamp: VerifiedTimestamp = {
      iso: new Date().toISOString(),
      unix: Math.floor(Date.now() / 1000),
      source: 'system',
      verified: true
    }

    const inputSignalHashes = inputSignals.map(s => s.integrityHash)

    const payload = {
      agentId,
      score,
      previousScore,
      timestamp: timestamp.iso,
      inputSignalHashes,
      calculationParams: params
    }

    const certificateHash = createHash('sha256')
      .update(JSON.stringify(payload, Object.keys(payload).sort()))
      .digest('hex')

    const signature = createHmac('sha256', this.secretKey)
      .update(certificateHash)
      .digest('hex')

    return {
      agentId,
      score,
      previousScore,
      timestamp,
      inputSignalHashes,
      calculationParams: params,
      certificateHash,
      signature
    }
  }

  /**
   * Verify a score certificate
   */
  verify(certificate: ScoreCertificate): boolean {
    const payload = {
      agentId: certificate.agentId,
      score: certificate.score,
      previousScore: certificate.previousScore,
      timestamp: certificate.timestamp.iso,
      inputSignalHashes: certificate.inputSignalHashes,
      calculationParams: certificate.calculationParams
    }

    const expectedHash = createHash('sha256')
      .update(JSON.stringify(payload, Object.keys(payload).sort()))
      .digest('hex')

    if (expectedHash !== certificate.certificateHash) {
      return false
    }

    const expectedSig = createHmac('sha256', this.secretKey)
      .update(certificate.certificateHash)
      .digest('hex')

    return expectedSig === certificate.signature
  }
}

// =============================================================================
// Exports
// =============================================================================

export const signalFactory = new SignalFactory()
export const signalVerifier = new SignalVerifier()
export const adversarialResistance = new AdversarialResistance()
export const scoreCertificateGenerator = new ScoreCertificateGenerator()

export default {
  SignalFactory,
  SignalVerifier,
  AdversarialResistance,
  ScoreCertificateGenerator,
  signalFactory,
  signalVerifier,
  adversarialResistance,
  scoreCertificateGenerator
}
