/**
 * Agent Consultation Types
 *
 * Agent-to-agent consultation system merged with AgentAnchor's
 * cryptographic audit trail (Observer events + Merkle hash chain)
 */

// ============================================================================
// Consultation Core Types
// ============================================================================

export type ConsultationStatus = 'pending' | 'in_progress' | 'completed' | 'expired' | 'cancelled'
export type ConsultationOutcome = 'proceed' | 'blocked' | 'proceed_with_caution' | 'escalate'
export type ConsultationDecision = 'approve' | 'concern' | 'veto'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface ConsultationRequest {
  id: string
  requestingAgentId: string
  actionDescription: string
  actionContext: Record<string, unknown>
  riskLevel: RiskLevel
  consultedAgents: string[]
  deadline?: Date
  status: ConsultationStatus
  outcome?: ConsultationOutcome
  finalReasoning?: string

  // Audit trail linkage
  observerEventId?: string
  merkleHash?: string

  createdAt: Date
  completedAt?: Date
}

export interface ConsultationResponse {
  id: string
  consultationId: string
  agentId: string
  decision: ConsultationDecision
  reasoning: string
  confidence: number // 0-1
  concerns?: string[]
  conditions?: string[] // Conditions for approval
  respondedAt: Date
}

// ============================================================================
// Safety Gates
// ============================================================================

export interface SafetyGateResult {
  id: string
  consultationId?: string
  actionId?: string
  gateNumber: number
  gateName: string
  passed: boolean
  blockedReason?: string
  details: Record<string, unknown>
  checkedAt: Date
}

export interface SafetyGateConfig {
  gateNumber: number
  name: string
  description: string
  check: (context: ConsultationContext) => Promise<SafetyGateCheckResult>
  required: boolean
  blocksOnFail: boolean
}

export interface SafetyGateCheckResult {
  passed: boolean
  reason?: string
  details?: Record<string, unknown>
}

export interface ConsultationContext {
  requestingAgent: {
    id: string
    name: string
    hierarchyLevel: string
    trustScore: number
  }
  action: {
    description: string
    type: string
    riskLevel: RiskLevel
    affectedResources?: string[]
  }
  history?: {
    previousConsultations: number
    previousApprovals: number
    previousVetoes: number
  }
}

// ============================================================================
// Consensus Calculation
// ============================================================================

export interface ConsensusResult {
  outcome: ConsultationOutcome
  totalResponses: number
  approvals: number
  concerns: number
  vetoes: number
  averageConfidence: number
  reasoning: string
}

export function calculateConsensus(responses: ConsultationResponse[]): ConsensusResult {
  const approvals = responses.filter(r => r.decision === 'approve').length
  const concerns = responses.filter(r => r.decision === 'concern').length
  const vetoes = responses.filter(r => r.decision === 'veto').length
  const total = responses.length

  const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / total || 0

  let outcome: ConsultationOutcome
  let reasoning: string

  if (vetoes > 0) {
    outcome = 'blocked'
    reasoning = `Action blocked: ${vetoes} veto(es) received`
  } else if (concerns > approvals) {
    outcome = 'proceed_with_caution'
    reasoning = `Proceed with caution: ${concerns} concerns vs ${approvals} approvals`
  } else if (approvals >= total * 0.5) {
    outcome = 'proceed'
    reasoning = `Approved: ${approvals}/${total} agents approved`
  } else {
    outcome = 'escalate'
    reasoning = `Insufficient consensus: requires escalation`
  }

  return {
    outcome,
    totalResponses: total,
    approvals,
    concerns,
    vetoes,
    averageConfidence: avgConfidence,
    reasoning
  }
}

// ============================================================================
// Consultation Events (for Observer integration)
// ============================================================================

export type ConsultationEventType =
  | 'consultation_requested'
  | 'response_received'
  | 'consensus_reached'
  | 'action_approved'
  | 'action_blocked'
  | 'action_escalated'
  | 'gate_passed'
  | 'gate_blocked'

export interface ConsultationEvent {
  type: ConsultationEventType
  consultationId: string
  agentId?: string
  data: Record<string, unknown>
  timestamp: Date
}

// ============================================================================
// Default Safety Gates
// ============================================================================

export const DEFAULT_SAFETY_GATES: Omit<SafetyGateConfig, 'check'>[] = [
  {
    gateNumber: 1,
    name: 'hierarchy_check',
    description: 'Verify requesting agent has authority for this action',
    required: true,
    blocksOnFail: true
  },
  {
    gateNumber: 2,
    name: 'trust_check',
    description: 'Verify agent trust score meets minimum for action risk level',
    required: true,
    blocksOnFail: true
  },
  {
    gateNumber: 3,
    name: 'ethics_check',
    description: 'Verify action complies with ethics framework',
    required: true,
    blocksOnFail: true
  },
  {
    gateNumber: 4,
    name: 'resource_check',
    description: 'Verify action does not exceed resource limits',
    required: false,
    blocksOnFail: false
  },
  {
    gateNumber: 5,
    name: 'human_approval_check',
    description: 'Verify human approval obtained for high-risk actions',
    required: true,
    blocksOnFail: true
  }
]

// ============================================================================
// Consultation Metrics
// ============================================================================

export interface ConsultationMetrics {
  totalConsultations: number
  byOutcome: Record<ConsultationOutcome, number>
  byRiskLevel: Record<RiskLevel, number>
  averageResponseTime: number // ms
  averageConsensusTime: number // ms
  topConsultedAgents: Array<{ agentId: string; count: number }>
  topVetoingAgents: Array<{ agentId: string; count: number }>
  gatePassRates: Array<{ gateName: string; passRate: number }>
}
