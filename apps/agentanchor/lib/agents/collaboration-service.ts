/**
 * Agent Collaboration Service
 *
 * Enables agents to work together proactively:
 * - Route tasks to best-suited agents
 * - Coordinate parallel work
 * - Build consensus across multiple agents
 * - Track collaboration outcomes
 */

import { createClient } from '@/lib/supabase/server'
import type {
  CollaborationRequest,
  CollaborationResponse,
  CollaborationMode,
  ActionItem,
  ProactiveAction,
  ProactiveBehavior,
} from './operating-principles'

// =============================================================================
// TYPES
// =============================================================================

export interface Collaboration {
  id: string
  mode: CollaborationMode
  initiatorId: string
  participants: string[]
  task: {
    type: string
    description: string
    context: Record<string, unknown>
  }
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'
  outcomes: CollaborationOutcome[]
  createdAt: Date
  completedAt?: Date
}

export interface CollaborationOutcome {
  agentId: string
  contribution: string
  confidence: number
  actionItems: ActionItem[]
  timestamp: Date
}

export interface AgentAvailability {
  agentId: string
  available: boolean
  currentTasks: number
  maxTasks: number
  specializations: string[]
  trustScore: number
  responseTime: number // avg ms
}

// =============================================================================
// COLLABORATION SERVICE
// =============================================================================

export class CollaborationService {
  /**
   * Request collaboration from another agent
   */
  async requestCollaboration(
    request: CollaborationRequest
  ): Promise<CollaborationResponse> {
    const supabase = createClient()

    // If no target specified, find best agent for task
    let targetAgent: string | undefined = request.targetAgentId
    if (!targetAgent) {
      targetAgent = await this.findBestAgentForTask(request.taskType, request.context) ?? undefined
    }

    if (!targetAgent) {
      return {
        accepted: false,
        agentId: '',
        reason: 'No suitable agent found for task type: ' + request.taskType,
        alternativeAgents: await this.getSuggestedAgents(request.taskType),
      }
    }

    // Check agent availability
    const availability = await this.getAgentAvailability(targetAgent)
    if (!availability.available) {
      return {
        accepted: false,
        agentId: targetAgent,
        reason: 'Agent currently at capacity',
        alternativeAgents: await this.getSuggestedAgents(request.taskType),
      }
    }

    // Create collaboration record
    const { data: collab, error } = await supabase
      .from('agent_collaborations')
      .insert({
        initiator_id: request.requesterId,
        target_id: targetAgent,
        mode: 'DELEGATE',
        task_type: request.taskType,
        context: request.context,
        urgency: request.urgency,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create collaboration:', error)
      return {
        accepted: false,
        agentId: targetAgent,
        reason: 'Failed to initiate collaboration',
      }
    }

    // Notify target agent (via signals system)
    await this.notifyAgent(targetAgent, {
      type: 'COLLABORATION_REQUEST',
      collaborationId: collab.id,
      from: request.requesterId,
      taskType: request.taskType,
      urgency: request.urgency,
    })

    return {
      accepted: true,
      agentId: targetAgent,
      estimatedCompletion: this.estimateCompletion(request.urgency),
    }
  }

  /**
   * Find the best agent for a given task
   */
  async findBestAgentForTask(
    taskType: string,
    context: Record<string, unknown>
  ): Promise<string | null> {
    const supabase = createClient()

    // Map task types to specializations
    const specializationMap: Record<string, string[]> = {
      'code-review': ['development', 'quality', 'security'],
      'data-analysis': ['data-ai', 'analytics', 'research'],
      'customer-support': ['customer_service', 'communication'],
      'security-audit': ['security', 'compliance', 'governance'],
      'content-creation': ['creative', 'communication', 'growth'],
      'system-monitoring': ['operations', 'platform', 'technology'],
      'ethics-review': ['governance', 'safety-ethics', 'legal'],
      'training': ['education', 'mentorship', 'academy'],
    }

    const targetSpecs = specializationMap[taskType] || ['general']

    // Query for available agents with matching specialization
    const { data: agents } = await supabase
      .from('bots')
      .select('id, name, specialization, trust_score, metadata')
      .eq('status', 'active')
      .in('specialization', targetSpecs)
      .gte('trust_score', 200) // Min trust to collaborate
      .order('trust_score', { ascending: false })
      .limit(5)

    if (!agents || agents.length === 0) {
      return null
    }

    // Score agents based on fit
    const scored = agents.map(agent => {
      let score = agent.trust_score

      // Bonus for exact specialization match
      if (agent.specialization === targetSpecs[0]) {
        score += 100
      }

      // Bonus for higher hierarchy level (if available)
      const level = agent.metadata?.hierarchyLevel
      if (level) {
        const levelNum = parseInt(level.replace('L', ''))
        score += levelNum * 10
      }

      return { id: agent.id, score }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.id || null
  }

  /**
   * Get agent availability
   */
  async getAgentAvailability(agentId: string): Promise<AgentAvailability> {
    const supabase = createClient()

    const { data: agent } = await supabase
      .from('bots')
      .select('id, specialization, trust_score, metadata')
      .eq('id', agentId)
      .single()

    if (!agent) {
      return {
        agentId,
        available: false,
        currentTasks: 0,
        maxTasks: 0,
        specializations: [],
        trustScore: 0,
        responseTime: 0,
      }
    }

    // Check current task load
    const { count: activeTasks } = await supabase
      .from('agent_collaborations')
      .select('*', { count: 'exact', head: true })
      .eq('target_id', agentId)
      .eq('status', 'active')

    // Determine max tasks based on hierarchy level
    const level = agent.metadata?.hierarchyLevel || 'L1'
    const maxTasksByLevel: Record<string, number> = {
      L0: 1, L1: 3, L2: 5, L3: 7, L4: 10, L5: 12, L6: 15, L7: 18, L8: 20,
    }
    const maxTasks = maxTasksByLevel[level] || 3

    return {
      agentId,
      available: (activeTasks || 0) < maxTasks,
      currentTasks: activeTasks || 0,
      maxTasks,
      specializations: [agent.specialization].filter(Boolean),
      trustScore: agent.trust_score,
      responseTime: 500, // Default, could track actual
    }
  }

  /**
   * Get suggested agents for a task type
   */
  async getSuggestedAgents(taskType: string): Promise<string[]> {
    const supabase = createClient()

    const { data: agents } = await supabase
      .from('bots')
      .select('id')
      .eq('status', 'active')
      .gte('trust_score', 200)
      .order('trust_score', { ascending: false })
      .limit(3)

    return agents?.map(a => a.id) || []
  }

  /**
   * Start a parallel collaboration (multiple agents work simultaneously)
   */
  async startParallelCollaboration(
    initiatorId: string,
    participantIds: string[],
    task: { type: string; description: string; context: Record<string, unknown> }
  ): Promise<Collaboration> {
    const supabase = createClient()

    const { data: collab, error } = await supabase
      .from('agent_collaborations')
      .insert({
        initiator_id: initiatorId,
        participants: participantIds,
        mode: 'PARALLEL',
        task_type: task.type,
        task_description: task.description,
        context: task.context,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      throw new Error('Failed to start parallel collaboration: ' + error.message)
    }

    // Notify all participants
    await Promise.all(
      participantIds.map(pid =>
        this.notifyAgent(pid, {
          type: 'PARALLEL_COLLABORATION_START',
          collaborationId: collab.id,
          from: initiatorId,
          participants: participantIds,
          task,
        })
      )
    )

    return {
      id: collab.id,
      mode: 'PARALLEL',
      initiatorId,
      participants: participantIds,
      task,
      status: 'active',
      outcomes: [],
      createdAt: new Date(collab.created_at),
    }
  }

  /**
   * Build consensus across multiple agents
   */
  async buildConsensus(
    initiatorId: string,
    question: string,
    participantIds: string[],
    requiredAgreement: number = 0.66 // 66% must agree
  ): Promise<{
    consensus: boolean
    result?: string
    votes: Array<{ agentId: string; vote: string; confidence: number }>
  }> {
    const supabase = createClient()

    // Create consensus request
    const { data: consensus, error } = await supabase
      .from('agent_consensus')
      .insert({
        initiator_id: initiatorId,
        question,
        participants: participantIds,
        required_agreement: requiredAgreement,
        status: 'voting',
      })
      .select()
      .single()

    if (error) {
      throw new Error('Failed to start consensus: ' + error.message)
    }

    // In real implementation, this would be async with callbacks
    // For now, simulate immediate consensus
    const mockVotes = participantIds.map(pid => ({
      agentId: pid,
      vote: 'approve', // Would come from actual agent responses
      confidence: 0.8 + Math.random() * 0.2,
    }))

    const approvals = mockVotes.filter(v => v.vote === 'approve').length
    const consensusReached = approvals / participantIds.length >= requiredAgreement

    return {
      consensus: consensusReached,
      result: consensusReached ? 'approved' : 'rejected',
      votes: mockVotes,
    }
  }

  /**
   * Submit collaboration outcome
   */
  async submitOutcome(
    collaborationId: string,
    agentId: string,
    outcome: {
      contribution: string
      confidence: number
      actionItems: ActionItem[]
    }
  ): Promise<void> {
    const supabase = createClient()

    await supabase.from('collaboration_outcomes').insert({
      collaboration_id: collaborationId,
      agent_id: agentId,
      contribution: outcome.contribution,
      confidence: outcome.confidence,
      action_items: outcome.actionItems,
    })

    // Check if all participants have submitted
    const { data: collab } = await supabase
      .from('agent_collaborations')
      .select('participants, mode')
      .eq('id', collaborationId)
      .single()

    if (collab) {
      const { count: outcomeCount } = await supabase
        .from('collaboration_outcomes')
        .select('*', { count: 'exact', head: true })
        .eq('collaboration_id', collaborationId)

      if (outcomeCount === collab.participants?.length) {
        // All participants submitted, mark complete
        await supabase
          .from('agent_collaborations')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', collaborationId)
      }
    }
  }

  /**
   * Notify an agent (integrate with signals system)
   */
  private async notifyAgent(
    agentId: string,
    notification: {
      type: string
      collaborationId: string
      from: string
      [key: string]: unknown
    }
  ): Promise<void> {
    // Would integrate with agent-signals.ts
    console.log(`[Collaboration] Notifying agent ${agentId}:`, notification.type)
  }

  /**
   * Estimate completion time based on urgency
   */
  private estimateCompletion(urgency: string): Date {
    const now = new Date()
    const hoursMap: Record<string, number> = {
      critical: 1,
      high: 4,
      medium: 24,
      low: 72,
    }
    const hours = hoursMap[urgency] || 24
    return new Date(now.getTime() + hours * 60 * 60 * 1000)
  }
}

// =============================================================================
// PROACTIVE TASK ROUTING
// =============================================================================

export class ProactiveRouter {
  private collaborationService = new CollaborationService()

  /**
   * Analyze a situation and route to appropriate action/agent
   */
  async analyzeAndRoute(
    analysis: {
      subject: string
      findings: string[]
      suggestedActions: ActionItem[]
    },
    initiatorId: string
  ): Promise<ProactiveAction[]> {
    const actions: ProactiveAction[] = []

    for (const actionItem of analysis.suggestedActions) {
      // Determine best behavior based on action type
      const behavior = this.mapActionToBehavior(actionItem.type)

      // Find best agent if delegation is needed
      let delegateTo: string | undefined
      let collaborateWith: string[] | undefined

      if (behavior === 'DELEGATE') {
        delegateTo = await this.collaborationService.findBestAgentForTask(
          actionItem.type,
          { actionItem }
        ) || undefined
      } else if (behavior === 'COLLABORATE') {
        collaborateWith = await this.collaborationService.getSuggestedAgents(
          actionItem.type
        )
      }

      actions.push({
        behavior,
        trigger: analysis.subject,
        analysis: analysis.findings.join('; '),
        recommendation: actionItem.description,
        actionSteps: actionItem.steps,
        delegateTo,
        collaborateWith,
        priority: actionItem.priority,
        confidence: 0.85, // Could be calculated
      })
    }

    return actions
  }

  /**
   * Map action type to proactive behavior
   */
  private mapActionToBehavior(actionType: ActionItem['type']): ProactiveBehavior {
    const mapping: Record<ActionItem['type'], ProactiveBehavior> = {
      fix: 'DELEGATE',
      implement: 'COLLABORATE',
      change: 'SUGGEST',
      investigate: 'ANALYZE',
      monitor: 'MONITOR',
      escalate: 'ESCALATE',
    }
    return mapping[actionType] || 'ANALYZE'
  }

  /**
   * Execute a proactive action
   */
  async executeAction(action: ProactiveAction, initiatorId: string): Promise<void> {
    switch (action.behavior) {
      case 'DELEGATE':
        if (action.delegateTo) {
          await this.collaborationService.requestCollaboration({
            requesterId: initiatorId,
            targetAgentId: action.delegateTo,
            taskType: action.actionSteps[0] || 'general',
            context: { action },
            urgency: action.priority,
            expectedOutcome: action.recommendation,
          })
        }
        break

      case 'COLLABORATE':
        if (action.collaborateWith?.length) {
          await this.collaborationService.startParallelCollaboration(
            initiatorId,
            action.collaborateWith,
            {
              type: 'collaborative_action',
              description: action.recommendation,
              context: { action },
            }
          )
        }
        break

      case 'ESCALATE':
        // Route to council or human review
        console.log('[Proactive] Escalating:', action.recommendation)
        break

      default:
        // Log for monitoring
        console.log(`[Proactive] ${action.behavior}:`, action.recommendation)
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const collaborationService = new CollaborationService()
export const proactiveRouter = new ProactiveRouter()
