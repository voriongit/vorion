// Escalation Service
// Manages human escalation queue for critical Council decisions

import { createClient } from '@/lib/supabase/server'
import { RiskLevel, CouncilDecision, ValidatorVote } from './types'
import { createPrecedent } from './precedent-service'

export type EscalationStatus = 'pending' | 'approved' | 'denied' | 'modified' | 'timeout' | 'cancelled'
export type EscalationPriority = 'low' | 'normal' | 'high' | 'critical'
export type HumanDecision = 'approve' | 'deny' | 'modify'

export interface Escalation {
  id: string
  request_id: string
  decision_id?: string
  agent_id: string
  action_type: string
  action_details: string
  risk_level: RiskLevel
  council_reasoning: string
  council_votes: ValidatorVote[]
  status: EscalationStatus
  priority: EscalationPriority
  assigned_to?: string
  assigned_at?: string
  human_decision?: HumanDecision
  human_reasoning?: string
  modification_details?: string
  responded_by?: string
  responded_at?: string
  timeout_at: string
  timeout_action: 'approve' | 'deny'
  created_at: string
  updated_at: string
}

export interface CreateEscalationInput {
  requestId: string
  decisionId?: string
  agentId: string
  actionType: string
  actionDetails: string
  riskLevel: RiskLevel
  councilReasoning: string
  councilVotes: ValidatorVote[]
  priority?: EscalationPriority
  timeoutMinutes?: number
  timeoutAction?: 'approve' | 'deny'
}

export interface EscalationResponse {
  decision: HumanDecision
  reasoning: string
  modificationDetails?: string
}

// Default timeout in minutes based on priority
const TIMEOUT_DEFAULTS: Record<EscalationPriority, number> = {
  low: 1440,      // 24 hours
  normal: 480,    // 8 hours
  high: 120,      // 2 hours
  critical: 30,   // 30 minutes
}

/**
 * Create an escalation in the human queue
 */
export async function createEscalation(input: CreateEscalationInput): Promise<Escalation | null> {
  const supabase = createClient()

  // Calculate priority based on risk level if not specified
  const priority = input.priority || determinePriority(input.riskLevel)

  // Calculate timeout
  const timeoutMinutes = input.timeoutMinutes || TIMEOUT_DEFAULTS[priority]
  const timeoutAt = new Date(Date.now() + timeoutMinutes * 60 * 1000)

  const { data, error } = await supabase
    .from('escalation_queue')
    .insert({
      request_id: input.requestId,
      decision_id: input.decisionId,
      agent_id: input.agentId,
      action_type: input.actionType,
      action_details: input.actionDetails,
      risk_level: input.riskLevel,
      council_reasoning: input.councilReasoning,
      council_votes: input.councilVotes,
      status: 'pending',
      priority,
      timeout_at: timeoutAt.toISOString(),
      timeout_action: input.timeoutAction || 'deny',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating escalation:', error)
    return null
  }

  // Log the creation
  await logEscalationAction(data.id, 'create', {
    priority,
    timeoutAt: timeoutAt.toISOString(),
  })

  return data as Escalation
}

/**
 * Get pending escalations
 */
export async function getPendingEscalations(
  options?: {
    assignedTo?: string
    agentId?: string
    priority?: EscalationPriority
    limit?: number
  }
): Promise<Escalation[]> {
  const supabase = createClient()

  let query = supabase
    .from('escalation_queue')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: true }) // critical first
    .order('created_at', { ascending: true }) // oldest first

  if (options?.assignedTo) {
    query = query.eq('assigned_to', options.assignedTo)
  }
  if (options?.agentId) {
    query = query.eq('agent_id', options.agentId)
  }
  if (options?.priority) {
    query = query.eq('priority', options.priority)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching pending escalations:', error)
    return []
  }

  return data as Escalation[]
}

/**
 * Get escalation by ID
 */
export async function getEscalationById(id: string): Promise<Escalation | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('escalation_queue')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching escalation:', error)
    return null
  }

  return data as Escalation
}

/**
 * Assign escalation to a human overseer
 */
export async function assignEscalation(
  escalationId: string,
  assigneeId: string
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('escalation_queue')
    .update({
      assigned_to: assigneeId,
      assigned_at: new Date().toISOString(),
    })
    .eq('id', escalationId)
    .eq('status', 'pending')

  if (error) {
    console.error('Error assigning escalation:', error)
    return false
  }

  await logEscalationAction(escalationId, 'assign', { assigneeId })
  return true
}

/**
 * Respond to an escalation
 */
export async function respondToEscalation(
  escalationId: string,
  responderId: string,
  response: EscalationResponse
): Promise<{ success: boolean; escalation?: Escalation; precedentId?: string }> {
  const supabase = createClient()

  // Get the escalation
  const escalation = await getEscalationById(escalationId)
  if (!escalation) {
    return { success: false }
  }

  if (escalation.status !== 'pending') {
    return { success: false }
  }

  // Map decision to status
  const statusMap: Record<HumanDecision, EscalationStatus> = {
    approve: 'approved',
    deny: 'denied',
    modify: 'modified',
  }

  const { data, error } = await supabase
    .from('escalation_queue')
    .update({
      status: statusMap[response.decision],
      human_decision: response.decision,
      human_reasoning: response.reasoning,
      modification_details: response.modificationDetails,
      responded_by: responderId,
      responded_at: new Date().toISOString(),
    })
    .eq('id', escalationId)
    .select()
    .single()

  if (error) {
    console.error('Error responding to escalation:', error)
    return { success: false }
  }

  // Log the response
  await logEscalationAction(escalationId, 'respond', {
    decision: response.decision,
    hasModification: !!response.modificationDetails,
  })

  // Create precedent for significant decisions
  let precedentId: string | undefined
  if (escalation.risk_level >= 3) {
    const outcomeMap: Record<HumanDecision, 'approved' | 'denied' | 'escalated'> = {
      approve: 'approved',
      deny: 'denied',
      modify: 'approved', // Modified is still an approval with changes
    }

    const precedent = await createPrecedent({
      title: `Human Override: ${escalation.action_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
      summary: `Human override ${response.decision}: ${escalation.action_details.substring(0, 200)}`,
      actionType: escalation.action_type,
      riskLevel: escalation.risk_level,
      outcome: outcomeMap[response.decision],
      reasoning: response.reasoning,
      tags: ['human-override', escalation.action_type.replace(/_/g, '-')],
      category: 'human-oversight',
      contextSummary: escalation.action_details,
      requestId: escalation.request_id,
    })

    precedentId = precedent?.id
  }

  return {
    success: true,
    escalation: data as Escalation,
    precedentId,
  }
}

/**
 * Cancel a pending escalation
 */
export async function cancelEscalation(
  escalationId: string,
  reason: string
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('escalation_queue')
    .update({
      status: 'cancelled',
      human_reasoning: reason,
    })
    .eq('id', escalationId)
    .eq('status', 'pending')

  if (error) {
    console.error('Error cancelling escalation:', error)
    return false
  }

  await logEscalationAction(escalationId, 'cancel', { reason })
  return true
}

/**
 * Get escalation history
 */
export async function getEscalationHistory(
  options?: {
    agentId?: string
    status?: EscalationStatus
    limit?: number
  }
): Promise<Escalation[]> {
  const supabase = createClient()

  let query = supabase
    .from('escalation_queue')
    .select('*')
    .order('created_at', { ascending: false })

  if (options?.agentId) {
    query = query.eq('agent_id', options.agentId)
  }
  if (options?.status) {
    query = query.eq('status', options.status)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching escalation history:', error)
    return []
  }

  return data as Escalation[]
}

/**
 * Get escalation statistics
 */
export async function getEscalationStats(): Promise<{
  pending: number
  approved: number
  denied: number
  modified: number
  timeout: number
  avgResponseTimeMinutes: number
}> {
  const supabase = createClient()

  // Get counts by status
  const { data: statusCounts, error: countError } = await supabase
    .from('escalation_queue')
    .select('status')

  if (countError) {
    console.error('Error fetching escalation stats:', countError)
    return {
      pending: 0,
      approved: 0,
      denied: 0,
      modified: 0,
      timeout: 0,
      avgResponseTimeMinutes: 0,
    }
  }

  const counts: Record<string, number> = {
    pending: 0,
    approved: 0,
    denied: 0,
    modified: 0,
    timeout: 0,
  }

  for (const item of statusCounts || []) {
    const status = item.status as string
    if (status in counts) {
      counts[status]++
    }
  }

  // Calculate average response time for resolved escalations
  const { data: resolved } = await supabase
    .from('escalation_queue')
    .select('created_at, responded_at')
    .not('responded_at', 'is', null)
    .limit(100)

  let avgResponseTimeMinutes = 0
  if (resolved && resolved.length > 0) {
    const totalMinutes = resolved.reduce((sum, item) => {
      const created = new Date(item.created_at).getTime()
      const responded = new Date(item.responded_at).getTime()
      return sum + (responded - created) / 60000
    }, 0)
    avgResponseTimeMinutes = Math.round(totalMinutes / resolved.length)
  }

  return {
    pending: counts.pending,
    approved: counts.approved,
    denied: counts.denied,
    modified: counts.modified,
    timeout: counts.timeout,
    avgResponseTimeMinutes,
  }
}

// Helper functions

function determinePriority(riskLevel: RiskLevel): EscalationPriority {
  if (riskLevel === 4) return 'critical'
  if (riskLevel === 3) return 'high'
  return 'normal'
}

async function logEscalationAction(
  escalationId: string,
  action: string,
  details: Record<string, any>
): Promise<void> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('escalation_responses')
    .insert({
      escalation_id: escalationId,
      action,
      actor_id: user.id,
      details,
    })
}
