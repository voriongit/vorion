/**
 * A3I-OS Decision Logger
 *
 * Enhanced decision logging per A3I-OS v2.0 specification.
 * Extends the existing audit-logger.ts with A3I-OS decision format.
 *
 * Every decision is:
 * - Logged with full reasoning chain
 * - Cryptographically linked to previous decisions
 * - Immutable (append-only)
 * - Queryable for transparency reports
 */

import { createId } from '@paralleldrive/cuid2'
import CryptoJS from 'crypto-js'
import type { HierarchyLevel } from './capability-boundaries'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Decision types per A3I-OS spec
 */
export type DecisionType =
  | 'action'           // Agent took an action
  | 'recommendation'   // Agent made a recommendation
  | 'escalation'       // Agent escalated to human/council
  | 'handoff'          // Agent handed off to another agent
  | 'refusal'          // Agent refused to act

/**
 * Decision outcome states
 */
export type DecisionOutcome =
  | 'pending'    // Not yet executed
  | 'success'    // Completed successfully
  | 'failure'    // Failed to complete
  | 'partial'    // Partially completed
  | 'cancelled'  // Cancelled by human or system

/**
 * A3I-OS Decision Log - 12 required fields per spec
 */
export interface A3IDecisionLog {
  // Required identifiers
  id: string
  timestamp: string // ISO8601
  agentId: string
  agentLevel: HierarchyLevel
  sessionId: string

  // Decision classification
  decisionType: DecisionType

  // What informed this decision
  inputsConsidered: string[]

  // Alternatives evaluated (with rejection reasons)
  alternativesEvaluated: Array<{
    option: string
    rejectedReason: string
  }>

  // Explanation
  rationale: string

  // Confidence and uncertainty
  confidenceScore: number // 0.0 - 1.0
  uncertaintyFactors: string[]

  // Human override status
  humanOverrideAvailable: boolean

  // Outcome (updated after execution)
  outcome: DecisionOutcome
  outcomeDetails?: string

  // Immutable hash chain
  previousHash: string
  currentHash: string

  // Metadata
  metadata?: Record<string, unknown>
}

/**
 * Reasoning transparency per A3I-OS spec
 */
export interface ReasoningTransparency {
  // What action was taken/recommended
  actionDescription: string

  // Why this specific action (not just what)
  whyThisAction: string

  // Quantified uncertainty
  confidencePercentage: number // 0-100
  uncertaintySources: string[]

  // Stated assumptions
  assumptions: string[]

  // Trade-offs articulated
  tradeOffs: Array<{
    optionA: string
    optionB: string
    chose: 'a' | 'b'
    reason: string
  }>

  // Limitations acknowledged
  limitations: string[]
}

/**
 * Decision query options
 */
export interface DecisionQueryOptions {
  sessionId?: string
  from?: Date
  to?: Date
  decisionType?: DecisionType
  outcome?: DecisionOutcome
  limit?: number
  offset?: number
}

/**
 * Chain verification result
 */
export interface ChainVerificationResult {
  valid: boolean
  brokenAt?: string
  totalDecisions: number
  verifiedDecisions: number
  error?: string
}

// =============================================================================
// DECISION LOGGER CLASS
// =============================================================================

export class A3IDecisionLogger {
  private decisions: Map<string, A3IDecisionLog[]> = new Map()
  private lastHashes: Map<string, string> = new Map()

  /**
   * Generate SHA-256 hash for a decision
   */
  private generateHash(decision: Omit<A3IDecisionLog, 'currentHash'>): string {
    const dataString = JSON.stringify({
      id: decision.id,
      timestamp: decision.timestamp,
      agentId: decision.agentId,
      agentLevel: decision.agentLevel,
      sessionId: decision.sessionId,
      decisionType: decision.decisionType,
      inputsConsidered: decision.inputsConsidered,
      alternativesEvaluated: decision.alternativesEvaluated,
      rationale: decision.rationale,
      confidenceScore: decision.confidenceScore,
      previousHash: decision.previousHash,
    })

    return CryptoJS.SHA256(dataString).toString()
  }

  /**
   * Get the last hash for an agent's decision chain
   */
  private getLastHash(agentId: string): string {
    return this.lastHashes.get(agentId) || 'GENESIS'
  }

  /**
   * Log a decision in A3I-OS format
   * Automatically chains with previous decision hash
   */
  async logDecision(
    decision: Omit<A3IDecisionLog, 'id' | 'timestamp' | 'previousHash' | 'currentHash'>
  ): Promise<A3IDecisionLog> {
    const id = createId()
    const timestamp = new Date().toISOString()
    const previousHash = this.getLastHash(decision.agentId)

    const fullDecision: Omit<A3IDecisionLog, 'currentHash'> = {
      ...decision,
      id,
      timestamp,
      previousHash,
    }

    const currentHash = this.generateHash(fullDecision)

    const finalDecision: A3IDecisionLog = {
      ...fullDecision,
      currentHash,
    }

    // Store in memory (in production, this would go to database)
    const agentDecisions = this.decisions.get(decision.agentId) || []
    agentDecisions.push(finalDecision)
    this.decisions.set(decision.agentId, agentDecisions)

    // Update last hash
    this.lastHashes.set(decision.agentId, currentHash)

    return finalDecision
  }

  /**
   * Update outcome after execution
   */
  async updateDecisionOutcome(
    decisionId: string,
    outcome: DecisionOutcome,
    details?: string
  ): Promise<boolean> {
    // Find and update the decision
    for (const [, decisions] of this.decisions) {
      const decision = decisions.find(d => d.id === decisionId)
      if (decision) {
        decision.outcome = outcome
        decision.outcomeDetails = details
        return true
      }
    }
    return false
  }

  /**
   * Query decision chain for an agent
   */
  async getDecisionChain(
    agentId: string,
    options?: DecisionQueryOptions
  ): Promise<A3IDecisionLog[]> {
    let decisions = this.decisions.get(agentId) || []

    // Apply filters
    if (options?.sessionId) {
      decisions = decisions.filter(d => d.sessionId === options.sessionId)
    }

    if (options?.from) {
      decisions = decisions.filter(d => new Date(d.timestamp) >= options.from!)
    }

    if (options?.to) {
      decisions = decisions.filter(d => new Date(d.timestamp) <= options.to!)
    }

    if (options?.decisionType) {
      decisions = decisions.filter(d => d.decisionType === options.decisionType)
    }

    if (options?.outcome) {
      decisions = decisions.filter(d => d.outcome === options.outcome)
    }

    // Apply pagination
    if (options?.offset) {
      decisions = decisions.slice(options.offset)
    }

    if (options?.limit) {
      decisions = decisions.slice(0, options.limit)
    }

    return decisions
  }

  /**
   * Verify chain integrity
   */
  async verifyChainIntegrity(
    agentId: string,
    from?: Date,
    to?: Date
  ): Promise<ChainVerificationResult> {
    let decisions = this.decisions.get(agentId) || []

    if (decisions.length === 0) {
      return {
        valid: true,
        totalDecisions: 0,
        verifiedDecisions: 0,
      }
    }

    // Filter by date range if provided
    if (from) {
      decisions = decisions.filter(d => new Date(d.timestamp) >= from)
    }
    if (to) {
      decisions = decisions.filter(d => new Date(d.timestamp) <= to)
    }

    // Sort by timestamp
    decisions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Verify each decision
    let expectedPreviousHash = 'GENESIS'
    let verifiedCount = 0

    for (const decision of decisions) {
      // Check previous hash matches
      if (decision.previousHash !== expectedPreviousHash && decision.previousHash !== 'GENESIS') {
        return {
          valid: false,
          brokenAt: decision.id,
          totalDecisions: decisions.length,
          verifiedDecisions: verifiedCount,
          error: `Chain broken at decision ${decision.id}: expected previous hash ${expectedPreviousHash}, got ${decision.previousHash}`,
        }
      }

      // Verify current hash
      const { currentHash, ...rest } = decision
      const calculatedHash = this.generateHash(rest as Omit<A3IDecisionLog, 'currentHash'>)

      if (calculatedHash !== currentHash) {
        return {
          valid: false,
          brokenAt: decision.id,
          totalDecisions: decisions.length,
          verifiedDecisions: verifiedCount,
          error: `Hash mismatch at decision ${decision.id}: calculated ${calculatedHash}, stored ${currentHash}`,
        }
      }

      expectedPreviousHash = currentHash
      verifiedCount++
    }

    return {
      valid: true,
      totalDecisions: decisions.length,
      verifiedDecisions: verifiedCount,
    }
  }

  /**
   * Get decision by ID
   */
  async getDecision(decisionId: string): Promise<A3IDecisionLog | null> {
    for (const [, decisions] of this.decisions) {
      const decision = decisions.find(d => d.id === decisionId)
      if (decision) {
        return decision
      }
    }
    return null
  }

  /**
   * Get decision statistics for an agent
   */
  async getDecisionStats(
    agentId: string,
    from?: Date,
    to?: Date
  ): Promise<{
    total: number
    byType: Record<DecisionType, number>
    byOutcome: Record<DecisionOutcome, number>
    averageConfidence: number
    lowConfidenceCount: number
  }> {
    let decisions = this.decisions.get(agentId) || []

    if (from) {
      decisions = decisions.filter(d => new Date(d.timestamp) >= from)
    }
    if (to) {
      decisions = decisions.filter(d => new Date(d.timestamp) <= to)
    }

    const byType: Record<DecisionType, number> = {
      action: 0,
      recommendation: 0,
      escalation: 0,
      handoff: 0,
      refusal: 0,
    }

    const byOutcome: Record<DecisionOutcome, number> = {
      pending: 0,
      success: 0,
      failure: 0,
      partial: 0,
      cancelled: 0,
    }

    let totalConfidence = 0
    let lowConfidenceCount = 0

    for (const decision of decisions) {
      byType[decision.decisionType]++
      byOutcome[decision.outcome]++
      totalConfidence += decision.confidenceScore
      if (decision.confidenceScore < 0.7) {
        lowConfidenceCount++
      }
    }

    return {
      total: decisions.length,
      byType,
      byOutcome,
      averageConfidence: decisions.length > 0 ? totalConfidence / decisions.length : 0,
      lowConfidenceCount,
    }
  }
}

// =============================================================================
// REASONING TRANSPARENCY HELPERS
// =============================================================================

/**
 * Format decision for user display
 */
export function formatDecisionForUser(
  decision: A3IDecisionLog,
  transparency: ReasoningTransparency
): string {
  const parts: string[] = []

  // What and why
  parts.push(`I am ${transparency.actionDescription} because ${transparency.whyThisAction}.`)

  // Assumptions
  if (transparency.assumptions.length > 0) {
    parts.push(`This assumes: ${transparency.assumptions.join(', ')}.`)
  }

  // Confidence
  parts.push(`Confidence: ${transparency.confidencePercentage}%.`)

  // Uncertainty
  if (transparency.uncertaintySources.length > 0) {
    parts.push(`Uncertainty about: ${transparency.uncertaintySources.join(', ')}.`)
  }

  // Alternatives
  if (decision.alternativesEvaluated.length > 0) {
    const alternatives = decision.alternativesEvaluated
      .map(a => `${a.option} (rejected because ${a.rejectedReason})`)
      .join(', ')
    parts.push(`Alternatives considered: ${alternatives}.`)
  }

  // Trade-offs
  if (transparency.tradeOffs.length > 0) {
    const tradeOffStr = transparency.tradeOffs
      .map(t => `chose ${t.chose === 'a' ? t.optionA : t.optionB} over ${t.chose === 'a' ? t.optionB : t.optionA} because ${t.reason}`)
      .join('; ')
    parts.push(`Trade-offs: ${tradeOffStr}.`)
  }

  // Limitations
  if (transparency.limitations.length > 0) {
    parts.push(`Limitations: ${transparency.limitations.join(', ')}.`)
  }

  return parts.join('\n')
}

/**
 * Create a reasoning transparency object from decision context
 */
export function createReasoningTransparency(
  action: string,
  why: string,
  options: {
    confidence?: number
    uncertaintySources?: string[]
    assumptions?: string[]
    tradeOffs?: ReasoningTransparency['tradeOffs']
    limitations?: string[]
  } = {}
): ReasoningTransparency {
  return {
    actionDescription: action,
    whyThisAction: why,
    confidencePercentage: Math.round((options.confidence ?? 1) * 100),
    uncertaintySources: options.uncertaintySources ?? [],
    assumptions: options.assumptions ?? [],
    tradeOffs: options.tradeOffs ?? [],
    limitations: options.limitations ?? [],
  }
}

/**
 * Create a A3I-OS decision log entry
 */
export function createDecisionLog(
  agentId: string,
  agentLevel: HierarchyLevel,
  sessionId: string,
  decisionType: DecisionType,
  options: {
    inputsConsidered?: string[]
    alternativesEvaluated?: A3IDecisionLog['alternativesEvaluated']
    rationale: string
    confidenceScore?: number
    uncertaintyFactors?: string[]
    humanOverrideAvailable?: boolean
    metadata?: Record<string, unknown>
  }
): Omit<A3IDecisionLog, 'id' | 'timestamp' | 'previousHash' | 'currentHash'> {
  return {
    agentId,
    agentLevel,
    sessionId,
    decisionType,
    inputsConsidered: options.inputsConsidered ?? [],
    alternativesEvaluated: options.alternativesEvaluated ?? [],
    rationale: options.rationale,
    confidenceScore: options.confidenceScore ?? 1.0,
    uncertaintyFactors: options.uncertaintyFactors ?? [],
    humanOverrideAvailable: options.humanOverrideAvailable ?? true,
    outcome: 'pending',
    metadata: options.metadata,
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const a3iDecisionLogger = new A3IDecisionLogger()

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  A3IDecisionLogger,
  a3iDecisionLogger,
  formatDecisionForUser,
  createReasoningTransparency,
  createDecisionLog,
}
