/**
 * Trust Engine Bridge
 *
 * Integrates the atsf-core trust engine with AgentAnchor's governance system.
 * Provides bidirectional flow: governance decisions update trust, trust informs decisions.
 */

import {
  getTrustEngine,
  getAgentTrustScore,
  initializeAgentTrust,
  recordAgentSignal,
  hasAcceleratedDecay,
  hasAcceleratedRecovery,
  getTrustLevelName,
  AGENT_SIGNAL_TYPES,
} from '@/lib/trust/trust-engine-service'
import type { TrustRecord } from '@vorionsys/atsf-core/trust-engine'
import type { TrustLevel } from '@vorionsys/atsf-core/types'
import { TrustContext, TrustTier, RiskLevel, GovernanceDecision } from './types'

// =============================================================================
// Trust Engine to Governance Bridge
// =============================================================================

/**
 * Map atsf-core trust levels (0-5) to governance tiers
 */
const LEVEL_TO_TIER: Record<number, TrustTier> = {
  0: 'untrusted',    // Sandbox (0-99)
  1: 'provisional',  // Provisional (100-299)
  2: 'established',  // Standard (300-499)
  3: 'trusted',      // Trusted (500-699)
  4: 'verified',     // Certified (700-899)
  5: 'certified',    // Autonomous (900-1000)
}

/**
 * Get trust context from trust engine for an agent
 */
export async function getTrustContextFromEngine(agentId: string): Promise<TrustContext | null> {
  const record = await getAgentTrustScore(agentId)
  if (!record) return null

  return trustRecordToContext(record)
}

/**
 * Convert a TrustRecord to TrustContext
 */
export function trustRecordToContext(record: TrustRecord): TrustContext {
  return {
    score: record.score,
    tier: LEVEL_TO_TIER[record.level] || 'untrusted',
    lastActivity: new Date(record.lastCalculatedAt),
    decayApplied: false, // Trust engine handles decay internally
    effectiveScore: record.score, // Already calculated by engine
  }
}

/**
 * Ensure an agent exists in the trust engine, creating if needed
 */
export async function ensureAgentTrust(
  agentId: string,
  initialLevel: TrustLevel = 1
): Promise<TrustRecord> {
  let record = await getAgentTrustScore(agentId)
  if (!record) {
    record = await initializeAgentTrust(agentId, initialLevel)
  }
  return record
}

// =============================================================================
// Governance to Trust Engine Bridge (Recording Outcomes)
// =============================================================================

/**
 * Map governance decision outcomes to trust signal types
 */
interface GovernanceOutcome {
  agentId: string
  actionType: string
  riskLevel: RiskLevel
  decision: GovernanceDecision
  executionSuccess: boolean
  metadata?: Record<string, unknown>
}

/**
 * Record a governance outcome in the trust engine
 */
export async function recordGovernanceOutcome(outcome: GovernanceOutcome): Promise<void> {
  const { agentId, actionType, riskLevel, decision, executionSuccess, metadata = {} } = outcome

  // Calculate signal value based on outcome
  // Higher risk actions have more impact on trust
  const riskMultiplier: Record<RiskLevel, number> = {
    low: 0.7,
    medium: 0.8,
    high: 0.9,
    critical: 1.0,
  }

  const baseValue = executionSuccess ? 0.85 : 0.2
  const value = baseValue * riskMultiplier[riskLevel]

  // Determine signal type
  const signalType = executionSuccess
    ? AGENT_SIGNAL_TYPES.TASK_COMPLETED
    : AGENT_SIGNAL_TYPES.TASK_FAILED

  await recordAgentSignal(agentId, signalType, value, {
    ...metadata,
    actionType,
    riskLevel,
    decision: {
      allowed: decision.allowed,
      escalatedTo: decision.escalateTo,
      reason: decision.reason,
    },
  })
}

/**
 * Record a policy compliance signal
 */
export async function recordPolicyCompliance(
  agentId: string,
  complied: boolean,
  policyType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const signalType = complied
    ? AGENT_SIGNAL_TYPES.POLICY_FOLLOWED
    : AGENT_SIGNAL_TYPES.POLICY_VIOLATED

  const value = complied ? 0.9 : 0.15

  await recordAgentSignal(agentId, signalType, value, {
    ...metadata,
    policyType,
  })
}

/**
 * Record an escalation decision signal
 */
export async function recordEscalationDecision(
  agentId: string,
  wasAppropriate: boolean,
  escalationType: 'council' | 'human',
  metadata?: Record<string, unknown>
): Promise<void> {
  const value = wasAppropriate ? 0.85 : 0.3

  await recordAgentSignal(agentId, AGENT_SIGNAL_TYPES.ESCALATION_APPROPRIATE, value, {
    ...metadata,
    escalationType,
    wasAppropriate,
  })
}

/**
 * Record council/human decision signal
 */
export async function recordHumanDecision(
  agentId: string,
  approved: boolean,
  decisionType: 'council' | 'human',
  metadata?: Record<string, unknown>
): Promise<void> {
  // Council/human decisions have high impact
  const value = approved ? 0.9 : 0.2

  const signalType = approved
    ? AGENT_SIGNAL_TYPES.TASK_COMPLETED
    : AGENT_SIGNAL_TYPES.TASK_FAILED

  await recordAgentSignal(agentId, signalType, value, {
    ...metadata,
    decisionType,
    humanApproved: approved,
  })
}

// =============================================================================
// Trust Status Queries
// =============================================================================

/**
 * Get enhanced trust status including decay/recovery indicators
 */
export interface EnhancedTrustStatus {
  agentId: string
  score: number
  level: number
  levelName: string
  tier: TrustTier
  components: {
    behavioral: number
    compliance: number
    identity: number
    context: number
  }
  peakScore: number
  consecutiveSuccesses: number
  acceleratedDecayActive: boolean
  acceleratedRecoveryActive: boolean
  recentFailures: number
  recentSuccesses: number
  lastCalculatedAt: string
}

/**
 * Get enhanced trust status for an agent
 */
export async function getEnhancedTrustStatus(agentId: string): Promise<EnhancedTrustStatus | null> {
  const record = await getAgentTrustScore(agentId)
  if (!record) return null

  const acceleratedDecay = await hasAcceleratedDecay(agentId)
  const acceleratedRecovery = await hasAcceleratedRecovery(agentId)

  return {
    agentId: record.entityId,
    score: record.score,
    level: record.level,
    levelName: getTrustLevelName(record.level),
    tier: LEVEL_TO_TIER[record.level] || 'untrusted',
    components: record.components,
    peakScore: record.peakScore,
    consecutiveSuccesses: record.consecutiveSuccesses,
    acceleratedDecayActive: acceleratedDecay,
    acceleratedRecoveryActive: acceleratedRecovery,
    recentFailures: record.recentFailures.length,
    recentSuccesses: record.recentSuccesses.length,
    lastCalculatedAt: record.lastCalculatedAt,
  }
}

/**
 * Check if agent meets minimum trust for action
 */
export async function checkTrustThreshold(
  agentId: string,
  requiredLevel: TrustLevel
): Promise<{ meets: boolean; currentLevel: number; gap: number }> {
  const record = await getAgentTrustScore(agentId)
  if (!record) {
    return { meets: false, currentLevel: 0, gap: requiredLevel }
  }

  return {
    meets: record.level >= requiredLevel,
    currentLevel: record.level,
    gap: Math.max(0, requiredLevel - record.level),
  }
}

// =============================================================================
// Matrix Router Integration
// =============================================================================

/**
 * Determine routing path based on trust engine data
 */
export type RoutingPath = 'green' | 'yellow' | 'red'

export interface TrustBasedRouting {
  path: RoutingPath
  agentId: string
  trustScore: number
  trustLevel: number
  trustTier: TrustTier
  autoApprove: boolean
  requiresCouncil: boolean
  requiresHuman: boolean
  reasoning: string[]
}

/**
 * Get routing decision based on trust engine data
 */
export async function getTrustBasedRouting(
  agentId: string,
  riskLevel: RiskLevel
): Promise<TrustBasedRouting> {
  const record = await ensureAgentTrust(agentId)
  const trustScore = record.score
  const trustLevel = record.level
  const trustTier = LEVEL_TO_TIER[trustLevel] || 'untrusted'

  const reasoning: string[] = []
  let path: RoutingPath
  let autoApprove = false
  let requiresCouncil = false
  let requiresHuman = false

  // Critical risk always requires human review
  if (riskLevel === 'critical') {
    path = 'red'
    requiresHuman = true
    reasoning.push('Critical risk actions always require human review')
  }
  // GREEN path: High trust (>=800) + low/medium risk
  else if (trustScore >= 800 && (riskLevel === 'low' || riskLevel === 'medium')) {
    path = 'green'
    autoApprove = true
    reasoning.push(`High trust score (${trustScore}) allows auto-approval`)
    reasoning.push(`${riskLevel} risk within autonomous bounds`)
  }
  // GREEN path: Certified (>=900) + high risk
  else if (trustScore >= 900 && riskLevel === 'high') {
    path = 'green'
    autoApprove = true
    reasoning.push(`Certified agent (${trustScore}) has high-risk autonomy`)
  }
  // YELLOW path: Medium trust (400-799) + medium/high risk
  else if (trustScore >= 400 && trustScore < 800) {
    path = 'yellow'
    if (riskLevel === 'high') {
      requiresCouncil = true
      reasoning.push('High risk requires council validation')
    }
    reasoning.push(`Trust score (${trustScore}) requires policy check`)
  }
  // RED path: Low trust or high risk without certification
  else {
    path = 'red'
    if (riskLevel === 'high') {
      requiresCouncil = true
      reasoning.push('High risk with insufficient trust requires council')
    } else if (trustScore < 200) {
      requiresHuman = true
      reasoning.push(`Untrusted agent (${trustScore}) requires human review`)
    } else {
      requiresCouncil = true
      reasoning.push('Low trust requires council oversight')
    }
  }

  return {
    path,
    agentId,
    trustScore,
    trustLevel,
    trustTier,
    autoApprove,
    requiresCouncil,
    requiresHuman,
    reasoning,
  }
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Get trust status for multiple agents
 */
export async function getBatchTrustStatus(
  agentIds: string[]
): Promise<Map<string, EnhancedTrustStatus>> {
  const results = new Map<string, EnhancedTrustStatus>()

  await Promise.all(
    agentIds.map(async (agentId) => {
      const status = await getEnhancedTrustStatus(agentId)
      if (status) {
        results.set(agentId, status)
      }
    })
  )

  return results
}

/**
 * Get all agents in the trust engine
 */
export async function getAllAgentTrustStatus(): Promise<EnhancedTrustStatus[]> {
  const engine = await getTrustEngine()
  const entityIds = engine.getEntityIds()

  const statuses = await Promise.all(
    entityIds.map((id) => getEnhancedTrustStatus(id))
  )

  return statuses.filter((s): s is EnhancedTrustStatus => s !== null)
}
