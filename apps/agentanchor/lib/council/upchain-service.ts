// Upchain Decision Service
// Manages the full lifecycle of upchain requests from agents

import { createClient } from '@/lib/supabase/server'
import { evaluateRequest, UpchainRequest, CouncilDecision, RiskLevel } from './index'
import { assessRisk, canAutoApprove, getRequiredApproval } from './risk-assessment'

export interface UpchainSubmission {
  agentId: string
  actionType: string
  actionDetails: string
  context?: Record<string, any>
  justification: string
  riskFactors?: {
    affectsMultipleUsers?: boolean
    involvesPersonalData?: boolean
    hasFinancialImpact?: boolean
    isIrreversible?: boolean
    involvesExternalSystem?: boolean
    modifiesPermissions?: boolean
  }
}

export interface UpchainResult {
  requestId: string
  status: 'auto_approved' | 'approved' | 'denied' | 'pending' | 'escalated'
  riskLevel: RiskLevel
  riskReasoning: string
  decision?: CouncilDecision
  canProceed: boolean
  message: string
  requiresHuman?: boolean
}

/**
 * Submit an action for upchain approval
 */
export async function submitUpchainRequest(
  submission: UpchainSubmission,
  agentTrustTier: string = 'untrusted'
): Promise<UpchainResult> {
  // 1. Assess risk
  const riskAssessment = assessRisk(
    submission.actionType,
    submission.actionDetails,
    submission.context || {},
    submission.riskFactors || {}
  )

  const { riskLevel, reasoning: riskReasoning } = riskAssessment

  // 2. Check if auto-approval is possible based on trust tier
  const autoApprovalCheck = canAutoApprove(riskLevel, agentTrustTier)

  if (autoApprovalCheck.canAutoApprove) {
    // Auto-approve and log
    const requestId = crypto.randomUUID()

    return {
      requestId,
      status: 'auto_approved',
      riskLevel,
      riskReasoning,
      canProceed: true,
      message: `Action auto-approved. ${autoApprovalCheck.reason}`,
    }
  }

  // 3. Build upchain request for Council evaluation
  const request: UpchainRequest = {
    id: crypto.randomUUID(),
    agentId: submission.agentId,
    actionType: submission.actionType,
    actionDetails: submission.actionDetails,
    context: submission.context || {},
    justification: submission.justification,
    riskLevel,
    requestedAt: new Date().toISOString(),
  }

  // 4. Submit to Council
  const decision = await evaluateRequest(request)

  // 5. Process decision
  const approvalInfo = getRequiredApproval(riskLevel)

  if (decision.outcome === 'approved') {
    return {
      requestId: request.id,
      status: 'approved',
      riskLevel,
      riskReasoning,
      decision,
      canProceed: true,
      message: `Action approved by Council. ${decision.finalReasoning}`,
    }
  }

  if (decision.outcome === 'denied') {
    return {
      requestId: request.id,
      status: 'denied',
      riskLevel,
      riskReasoning,
      decision,
      canProceed: false,
      message: `Action denied by Council. ${decision.finalReasoning}`,
    }
  }

  if (decision.outcome === 'escalated') {
    return {
      requestId: request.id,
      status: 'escalated',
      riskLevel,
      riskReasoning,
      decision,
      canProceed: false,
      requiresHuman: true,
      message: `Action escalated to human review. ${decision.finalReasoning}`,
    }
  }

  // Pending (shouldn't normally happen with current implementation)
  return {
    requestId: request.id,
    status: 'pending',
    riskLevel,
    riskReasoning,
    decision,
    canProceed: false,
    message: 'Action pending Council decision',
  }
}

/**
 * Get pending upchain requests for an agent
 */
export async function getPendingRequests(agentId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('bot_decisions')
    .select('*')
    .eq('bot_id', agentId)
    .is('user_response', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error fetching pending requests:', error)
    return []
  }

  return data || []
}

/**
 * Get decision history for an agent
 */
export async function getDecisionHistory(
  agentId: string,
  limit: number = 50
) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('bot_decisions')
    .select('*')
    .eq('bot_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching decision history:', error)
    return []
  }

  return data || []
}

/**
 * Record human response to a decision
 */
export async function recordHumanResponse(
  decisionId: string,
  response: 'approved' | 'rejected' | 'modified',
  modificationDetails?: string
) {
  const supabase = createClient()

  const { error } = await supabase
    .from('bot_decisions')
    .update({
      user_response: response,
      modification_details: modificationDetails,
    })
    .eq('id', decisionId)

  if (error) {
    console.error('Error recording human response:', error)
    throw new Error('Failed to record response')
  }

  return { success: true }
}
