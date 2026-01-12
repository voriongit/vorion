/**
 * Agent Consultation Service
 *
 * Manages agent-to-agent consultations with cryptographic audit trail.
 */

import { createClient } from '@/lib/supabase/server'
import { calculateConsensus } from './types'
import type {
  ConsultationRequest,
  ConsultationResponse,
  ConsultationStatus,
  ConsultationOutcome,
  ConsultationDecision,
  RiskLevel,
  ConsensusResult,
  SafetyGateResult,
  ConsultationContext,
  ConsultationMetrics
} from './types'

// ============================================================================
// Consultation Service
// ============================================================================

export class ConsultationService {
  private supabase: ReturnType<typeof createClient>

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase
  }

  // --------------------------------------------------------------------------
  // Create Consultation
  // --------------------------------------------------------------------------

  async createConsultation(
    requestingAgentId: string,
    actionDescription: string,
    consultedAgents: string[],
    options: {
      actionContext?: Record<string, unknown>
      riskLevel?: RiskLevel
      deadline?: Date
    } = {}
  ): Promise<ConsultationRequest> {
    const id = crypto.randomUUID()

    const { data, error } = await this.supabase
      .from('agent_consultations')
      .insert({
        id,
        requesting_agent_id: requestingAgentId,
        action_description: actionDescription,
        action_context: options.actionContext || {},
        risk_level: options.riskLevel || 'medium',
        consulted_agents: consultedAgents,
        deadline: options.deadline?.toISOString(),
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    // Create observer event for audit trail
    const observerEventId = await this.createObserverEvent(
      'consultation_requested',
      requestingAgentId,
      { consultationId: id, consultedAgents, riskLevel: options.riskLevel }
    )

    // Update consultation with observer event link
    await this.supabase
      .from('agent_consultations')
      .update({ observer_event_id: observerEventId })
      .eq('id', id)

    return this.mapToConsultation(data)
  }

  // --------------------------------------------------------------------------
  // Respond to Consultation
  // --------------------------------------------------------------------------

  async respond(
    consultationId: string,
    agentId: string,
    decision: ConsultationDecision,
    reasoning: string,
    options: {
      confidence?: number
      concerns?: string[]
      conditions?: string[]
    } = {}
  ): Promise<ConsultationResponse> {
    const id = crypto.randomUUID()

    const { data, error } = await this.supabase
      .from('agent_consultation_responses')
      .insert({
        id,
        consultation_id: consultationId,
        agent_id: agentId,
        decision,
        reasoning,
        confidence: options.confidence || 0.5,
        concerns: options.concerns || [],
        conditions: options.conditions || []
      })
      .select()
      .single()

    if (error) throw error

    // Check if all responses received (trigger in DB handles status update)
    await this.checkConsultationComplete(consultationId)

    return this.mapToResponse(data)
  }

  // --------------------------------------------------------------------------
  // Get Consultation Status
  // --------------------------------------------------------------------------

  async getConsultation(consultationId: string): Promise<ConsultationRequest | null> {
    const { data, error } = await this.supabase
      .from('agent_consultations')
      .select('*')
      .eq('id', consultationId)
      .single()

    if (error) return null
    return this.mapToConsultation(data)
  }

  async getResponses(consultationId: string): Promise<ConsultationResponse[]> {
    const { data, error } = await this.supabase
      .from('agent_consultation_responses')
      .select('*')
      .eq('consultation_id', consultationId)
      .order('responded_at', { ascending: true })

    if (error) throw error
    return data.map(this.mapToResponse)
  }

  async getConsensus(consultationId: string): Promise<ConsensusResult> {
    const responses = await this.getResponses(consultationId)
    return calculateConsensus(responses)
  }

  // --------------------------------------------------------------------------
  // Query Consultations
  // --------------------------------------------------------------------------

  async getConsultationsForAgent(
    agentId: string,
    options: { status?: ConsultationStatus; limit?: number } = {}
  ): Promise<ConsultationRequest[]> {
    let q = this.supabase
      .from('agent_consultations')
      .select('*')
      .or(`requesting_agent_id.eq.${agentId},consulted_agents.cs.{${agentId}}`)
      .order('created_at', { ascending: false })

    if (options.status) q = q.eq('status', options.status)
    if (options.limit) q = q.limit(options.limit)

    const { data, error } = await q

    if (error) throw error
    return data.map(this.mapToConsultation)
  }

  async getPendingConsultationsForAgent(agentId: string): Promise<ConsultationRequest[]> {
    // Get consultations where this agent needs to respond
    const { data, error } = await this.supabase
      .from('agent_consultations')
      .select(`
        *,
        agent_consultation_responses!left(agent_id)
      `)
      .contains('consulted_agents', [agentId])
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Filter to only those where this agent hasn't responded
    return data
      .filter(c => !c.agent_consultation_responses?.some((r: { agent_id: string }) => r.agent_id === agentId))
      .map(this.mapToConsultation)
  }

  // --------------------------------------------------------------------------
  // Safety Gates
  // --------------------------------------------------------------------------

  async runSafetyGates(
    consultationId: string,
    context: ConsultationContext
  ): Promise<{ passed: boolean; results: SafetyGateResult[] }> {
    const results: SafetyGateResult[] = []
    let allPassed = true

    // Gate 1: Hierarchy Check
    const hierarchyResult = await this.checkHierarchyGate(context)
    results.push(hierarchyResult)
    if (!hierarchyResult.passed && hierarchyResult.gateNumber === 1) allPassed = false

    // Gate 2: Trust Check
    const trustResult = await this.checkTrustGate(context)
    results.push(trustResult)
    if (!trustResult.passed) allPassed = false

    // Gate 3: Ethics Check
    const ethicsResult = await this.checkEthicsGate(context)
    results.push(ethicsResult)
    if (!ethicsResult.passed) allPassed = false

    // Gate 4: Resource Check (non-blocking)
    const resourceResult = await this.checkResourceGate(context)
    results.push(resourceResult)

    // Gate 5: Human Approval (for critical actions)
    if (context.action.riskLevel === 'critical') {
      const humanResult = await this.checkHumanApprovalGate(consultationId)
      results.push(humanResult)
      if (!humanResult.passed) allPassed = false
    }

    // Record results
    for (const result of results) {
      await this.supabase.from('safety_gate_results').insert({
        consultation_id: consultationId,
        gate_number: result.gateNumber,
        gate_name: result.gateName,
        passed: result.passed,
        blocked_reason: result.blockedReason,
        details: result.details
      })
    }

    return { passed: allPassed, results }
  }

  // --------------------------------------------------------------------------
  // Metrics
  // --------------------------------------------------------------------------

  async getMetrics(options: { days?: number } = {}): Promise<ConsultationMetrics> {
    const days = options.days || 30
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: consultations } = await this.supabase
      .from('agent_consultations')
      .select('*')
      .gte('created_at', since)

    const { data: responses } = await this.supabase
      .from('agent_consultation_responses')
      .select('*')
      .gte('responded_at', since)

    const { data: gates } = await this.supabase
      .from('safety_gate_results')
      .select('*')
      .gte('checked_at', since)

    const total = consultations?.length || 0
    const byOutcome: Record<ConsultationOutcome, number> = {
      proceed: 0,
      blocked: 0,
      proceed_with_caution: 0,
      escalate: 0
    }
    const byRiskLevel: Record<RiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    }

    consultations?.forEach(c => {
      if (c.outcome) byOutcome[c.outcome as ConsultationOutcome]++
      byRiskLevel[c.risk_level as RiskLevel]++
    })

    // Calculate average response time
    const responseTimes = responses?.map(r => {
      const consultation = consultations?.find(c => c.id === r.consultation_id)
      if (!consultation) return 0
      return new Date(r.responded_at).getTime() - new Date(consultation.created_at).getTime()
    }).filter(t => t > 0) || []

    const avgResponseTime = responseTimes.length
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0

    // Calculate consensus time
    const consensusTimes = consultations
      ?.filter(c => c.completed_at)
      .map(c => new Date(c.completed_at).getTime() - new Date(c.created_at).getTime())
      || []

    const avgConsensusTime = consensusTimes.length
      ? consensusTimes.reduce((a, b) => a + b, 0) / consensusTimes.length
      : 0

    // Top consulted agents
    const agentCounts: Record<string, number> = {}
    const vetoCounts: Record<string, number> = {}

    responses?.forEach(r => {
      agentCounts[r.agent_id] = (agentCounts[r.agent_id] || 0) + 1
      if (r.decision === 'veto') {
        vetoCounts[r.agent_id] = (vetoCounts[r.agent_id] || 0) + 1
      }
    })

    const topConsultedAgents = Object.entries(agentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([agentId, count]) => ({ agentId, count }))

    const topVetoingAgents = Object.entries(vetoCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([agentId, count]) => ({ agentId, count }))

    // Gate pass rates
    const gateStats: Record<string, { passed: number; total: number }> = {}
    gates?.forEach(g => {
      if (!gateStats[g.gate_name]) gateStats[g.gate_name] = { passed: 0, total: 0 }
      gateStats[g.gate_name].total++
      if (g.passed) gateStats[g.gate_name].passed++
    })

    const gatePassRates = Object.entries(gateStats).map(([gateName, stats]) => ({
      gateName,
      passRate: stats.total > 0 ? stats.passed / stats.total : 0
    }))

    return {
      totalConsultations: total,
      byOutcome,
      byRiskLevel,
      averageResponseTime: avgResponseTime,
      averageConsensusTime: avgConsensusTime,
      topConsultedAgents,
      topVetoingAgents,
      gatePassRates
    }
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private async checkConsultationComplete(consultationId: string): Promise<void> {
    const consultation = await this.getConsultation(consultationId)
    if (!consultation || consultation.status !== 'pending') return

    const responses = await this.getResponses(consultationId)
    if (responses.length >= consultation.consultedAgents.length) {
      const consensus = calculateConsensus(responses)

      await this.supabase
        .from('agent_consultations')
        .update({
          status: 'completed',
          outcome: consensus.outcome,
          final_reasoning: consensus.reasoning,
          completed_at: new Date().toISOString()
        })
        .eq('id', consultationId)

      // Create observer event
      await this.createObserverEvent(
        'consensus_reached',
        consultation.requestingAgentId,
        { consultationId, outcome: consensus.outcome, reasoning: consensus.reasoning }
      )
    }
  }

  private async createObserverEvent(
    eventType: string,
    agentId: string,
    data: Record<string, unknown>
  ): Promise<string> {
    const id = crypto.randomUUID()

    await this.supabase.from('observer_events').insert({
      id,
      event_type: eventType,
      actor_id: agentId,
      actor_type: 'agent',
      data,
      created_at: new Date().toISOString()
    })

    return id
  }

  private async checkHierarchyGate(context: ConsultationContext): Promise<SafetyGateResult> {
    // Check if agent's hierarchy level allows this action
    const minLevel = this.getMinLevelForScope(context.action.type)
    const agentLevel = this.getLevelNumber(context.requestingAgent.hierarchyLevel)

    const passed = agentLevel >= minLevel

    return {
      id: crypto.randomUUID(),
      gateNumber: 1,
      gateName: 'hierarchy_check',
      passed,
      blockedReason: passed ? undefined : `Requires hierarchy level ${minLevel}, agent is level ${agentLevel}`,
      details: { requiredLevel: minLevel, agentLevel },
      checkedAt: new Date()
    }
  }

  private async checkTrustGate(context: ConsultationContext): Promise<SafetyGateResult> {
    const minTrust: Record<RiskLevel, number> = {
      low: 0,
      medium: 200,
      high: 400,
      critical: 600
    }

    const required = minTrust[context.action.riskLevel]
    const passed = context.requestingAgent.trustScore >= required

    return {
      id: crypto.randomUUID(),
      gateNumber: 2,
      gateName: 'trust_check',
      passed,
      blockedReason: passed ? undefined : `Requires trust score ${required}, agent has ${context.requestingAgent.trustScore}`,
      details: { requiredTrust: required, agentTrust: context.requestingAgent.trustScore },
      checkedAt: new Date()
    }
  }

  private async checkEthicsGate(context: ConsultationContext): Promise<SafetyGateResult> {
    // Basic ethics check - could be expanded with actual ethics evaluation
    const ethicsKeywords = ['harm', 'illegal', 'unsafe', 'dangerous', 'malicious']
    const description = context.action.description.toLowerCase()
    const hasEthicsIssue = ethicsKeywords.some(k => description.includes(k))

    return {
      id: crypto.randomUUID(),
      gateNumber: 3,
      gateName: 'ethics_check',
      passed: !hasEthicsIssue,
      blockedReason: hasEthicsIssue ? 'Action description contains ethics-flagged keywords' : undefined,
      details: { checked: true },
      checkedAt: new Date()
    }
  }

  private async checkResourceGate(context: ConsultationContext): Promise<SafetyGateResult> {
    // Non-blocking resource check
    return {
      id: crypto.randomUUID(),
      gateNumber: 4,
      gateName: 'resource_check',
      passed: true, // Always passes for now
      details: { checked: true },
      checkedAt: new Date()
    }
  }

  private async checkHumanApprovalGate(consultationId: string): Promise<SafetyGateResult> {
    // Check if human approval exists
    const { data } = await this.supabase
      .from('agent_approvals')
      .select('*')
      .eq('consultation_id', consultationId)
      .eq('approved', true)
      .single()

    return {
      id: crypto.randomUUID(),
      gateNumber: 5,
      gateName: 'human_approval_check',
      passed: !!data,
      blockedReason: data ? undefined : 'Human approval required for critical actions',
      details: { hasApproval: !!data },
      checkedAt: new Date()
    }
  }

  private getMinLevelForScope(actionType: string): number {
    const scopeLevels: Record<string, number> = {
      task: 1,
      project: 3,
      portfolio: 5,
      strategic: 7,
      governance: 8
    }
    return scopeLevels[actionType] || 1
  }

  private getLevelNumber(level: string): number {
    const match = level.match(/L(\d)/)
    return match ? parseInt(match[1]) : 1
  }

  private mapToConsultation(data: Record<string, unknown>): ConsultationRequest {
    return {
      id: data.id as string,
      requestingAgentId: data.requesting_agent_id as string,
      actionDescription: data.action_description as string,
      actionContext: data.action_context as Record<string, unknown>,
      riskLevel: data.risk_level as RiskLevel,
      consultedAgents: data.consulted_agents as string[],
      deadline: data.deadline ? new Date(data.deadline as string) : undefined,
      status: data.status as ConsultationStatus,
      outcome: data.outcome as ConsultationOutcome | undefined,
      finalReasoning: data.final_reasoning as string | undefined,
      observerEventId: data.observer_event_id as string | undefined,
      merkleHash: data.merkle_hash as string | undefined,
      createdAt: new Date(data.created_at as string),
      completedAt: data.completed_at ? new Date(data.completed_at as string) : undefined
    }
  }

  private mapToResponse(data: Record<string, unknown>): ConsultationResponse {
    return {
      id: data.id as string,
      consultationId: data.consultation_id as string,
      agentId: data.agent_id as string,
      decision: data.decision as ConsultationDecision,
      reasoning: data.reasoning as string,
      confidence: data.confidence as number,
      concerns: data.concerns as string[] | undefined,
      conditions: data.conditions as string[] | undefined,
      respondedAt: new Date(data.responded_at as string)
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createConsultationService(supabase: ReturnType<typeof createClient>): ConsultationService {
  return new ConsultationService(supabase)
}
