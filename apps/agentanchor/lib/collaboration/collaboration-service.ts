/**
 * Agent Collaboration Service
 *
 * Manages agent-to-agent collaboration, task routing, and consensus.
 * Implements the BAI Operational Philosophy for collaborative excellence.
 */

import { createClient } from '@/lib/supabase/server';
import {
  AgentCollaboration,
  CollaborationOutcome,
  AgentConsensus,
  ConsensusVote,
  ProactiveAction,
  ExcellenceCycle,
  AgentTask,
  CreateCollaborationRequest,
  SubmitOutcomeRequest,
  CreateConsensusRequest,
  SubmitVoteRequest,
  CreateProactiveActionRequest,
  QueueTaskRequest,
  StartCycleRequest,
  AdvanceCycleRequest,
  CollaborationMode,
  ExcellencePhase,
  VoteChoice,
} from './types';

// Phase progression order
const PHASE_ORDER: ExcellencePhase[] = [
  'FIND', 'FIX', 'IMPLEMENT', 'CHANGE', 'ITERATE', 'SUCCEED'
];

export class CollaborationService {
  // ============================================================================
  // COLLABORATIONS
  // ============================================================================

  /**
   * Create a new agent collaboration
   */
  static async createCollaboration(
    request: CreateCollaborationRequest
  ): Promise<{ collaboration: AgentCollaboration | null; error: string | null }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('agent_collaborations')
      .insert({
        initiator_id: request.initiatorId,
        target_id: request.targetId,
        participants: request.participants || [],
        mode: request.mode,
        task_type: request.taskType,
        task_description: request.taskDescription,
        context: request.context || {},
        urgency: request.urgency || 'medium',
        expected_outcome: request.expectedOutcome,
        deadline: request.deadline?.toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return { collaboration: null, error: error.message };
    }

    return { collaboration: this.mapCollaboration(data), error: null };
  }

  /**
   * Start a collaboration (change status to active)
   */
  static async startCollaboration(
    collaborationId: string
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('agent_collaborations')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', collaborationId)
      .eq('status', 'pending');

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  }

  /**
   * Complete a collaboration with final outcome
   */
  static async completeCollaboration(
    collaborationId: string,
    finalOutcome: string,
    successRate?: number
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('agent_collaborations')
      .update({
        status: 'completed',
        final_outcome: finalOutcome,
        success_rate: successRate,
        completed_at: new Date().toISOString(),
      })
      .eq('id', collaborationId)
      .in('status', ['pending', 'active']);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  }

  /**
   * Submit an outcome/contribution to a collaboration
   */
  static async submitOutcome(
    request: SubmitOutcomeRequest
  ): Promise<{ outcome: CollaborationOutcome | null; error: string | null }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('collaboration_outcomes')
      .upsert({
        collaboration_id: request.collaborationId,
        agent_id: request.agentId,
        contribution: request.contribution,
        confidence: request.confidence,
        action_items: request.actionItems || [],
        time_spent_ms: request.timeSpentMs,
        tokens_used: request.tokensUsed,
      }, {
        onConflict: 'collaboration_id,agent_id',
      })
      .select()
      .single();

    if (error) {
      return { outcome: null, error: error.message };
    }

    return { outcome: this.mapOutcome(data), error: null };
  }

  /**
   * Get a collaboration by ID
   */
  static async getCollaboration(
    collaborationId: string
  ): Promise<{ collaboration: AgentCollaboration | null; error: string | null }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('agent_collaborations')
      .select('*')
      .eq('id', collaborationId)
      .single();

    if (error) {
      return { collaboration: null, error: error.message };
    }

    return { collaboration: this.mapCollaboration(data), error: null };
  }

  /**
   * Get collaborations for an agent
   */
  static async getAgentCollaborations(
    agentId: string,
    options?: { status?: string; limit?: number }
  ): Promise<{ collaborations: AgentCollaboration[]; error: string | null }> {
    const supabase = await createClient();

    let query = supabase
      .from('agent_collaborations')
      .select('*')
      .or(`initiator_id.eq.${agentId},target_id.eq.${agentId}`)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return { collaborations: [], error: error.message };
    }

    return { collaborations: (data || []).map(this.mapCollaboration), error: null };
  }

  // ============================================================================
  // CONSENSUS
  // ============================================================================

  /**
   * Create a new consensus request
   */
  static async createConsensus(
    request: CreateConsensusRequest
  ): Promise<{ consensus: AgentConsensus | null; error: string | null }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('agent_consensus')
      .insert({
        initiator_id: request.initiatorId,
        question: request.question,
        context: request.context || {},
        participants: request.participants,
        required_agreement: request.requiredAgreement || 0.66,
        deadline: request.deadline?.toISOString(),
        status: 'voting',
      })
      .select()
      .single();

    if (error) {
      return { consensus: null, error: error.message };
    }

    return { consensus: this.mapConsensus(data), error: null };
  }

  /**
   * Submit a vote to a consensus
   */
  static async submitVote(
    request: SubmitVoteRequest
  ): Promise<{ vote: ConsensusVote | null; consensusResolved: boolean; error: string | null }> {
    const supabase = await createClient();

    // Insert the vote
    const { data: voteData, error: voteError } = await supabase
      .from('consensus_votes')
      .upsert({
        consensus_id: request.consensusId,
        agent_id: request.agentId,
        vote: request.vote,
        reasoning: request.reasoning,
        confidence: request.confidence,
      }, {
        onConflict: 'consensus_id,agent_id',
      })
      .select()
      .single();

    if (voteError) {
      return { vote: null, consensusResolved: false, error: voteError.message };
    }

    // Check if consensus is reached
    const resolved = await this.checkConsensusResolution(request.consensusId);

    return { vote: this.mapVote(voteData), consensusResolved: resolved, error: null };
  }

  /**
   * Check and resolve consensus if all votes are in
   */
  private static async checkConsensusResolution(
    consensusId: string
  ): Promise<boolean> {
    const supabase = await createClient();

    // Get consensus details
    const { data: consensus } = await supabase
      .from('agent_consensus')
      .select('*')
      .eq('id', consensusId)
      .single();

    if (!consensus || consensus.status !== 'voting') {
      return false;
    }

    // Get all votes
    const { data: votes } = await supabase
      .from('consensus_votes')
      .select('*')
      .eq('consensus_id', consensusId);

    if (!votes || votes.length < consensus.participants.length) {
      return false; // Not all participants voted yet
    }

    // Calculate agreement
    const approveVotes = votes.filter((v: any) => v.vote === 'approve').length;
    const rejectVotes = votes.filter((v: any) => v.vote === 'reject').length;
    const totalVotes = votes.filter((v: any) => v.vote !== 'abstain').length;

    const agreementRate = totalVotes > 0 ? approveVotes / totalVotes : 0;
    const consensusReached = agreementRate >= consensus.required_agreement;

    // Update consensus status
    await supabase
      .from('agent_consensus')
      .update({
        status: consensusReached ? 'consensus_reached' : 'no_consensus',
        final_decision: consensusReached ? 'approved' : 'rejected',
        agreement_rate: agreementRate,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', consensusId);

    return true;
  }

  /**
   * Get a consensus by ID with votes
   */
  static async getConsensus(
    consensusId: string
  ): Promise<{ consensus: AgentConsensus | null; votes: ConsensusVote[]; error: string | null }> {
    const supabase = await createClient();

    const [consensusResult, votesResult] = await Promise.all([
      supabase.from('agent_consensus').select('*').eq('id', consensusId).single(),
      supabase.from('consensus_votes').select('*').eq('consensus_id', consensusId),
    ]);

    if (consensusResult.error) {
      return { consensus: null, votes: [], error: consensusResult.error.message };
    }

    return {
      consensus: this.mapConsensus(consensusResult.data),
      votes: (votesResult.data || []).map(this.mapVote),
      error: null,
    };
  }

  // ============================================================================
  // PROACTIVE ACTIONS
  // ============================================================================

  /**
   * Log a proactive action
   */
  static async createProactiveAction(
    request: CreateProactiveActionRequest
  ): Promise<{ action: ProactiveAction | null; error: string | null }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('proactive_actions')
      .insert({
        agent_id: request.agentId,
        behavior: request.behavior,
        trigger_event: request.triggerEvent,
        analysis: request.analysis,
        recommendation: request.recommendation,
        action_steps: request.actionSteps || [],
        delegated_to: request.delegatedTo,
        collaborated_with: request.collaboratedWith || [],
        priority: request.priority || 'medium',
        confidence: request.confidence,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return { action: null, error: error.message };
    }

    return { action: this.mapProactiveAction(data), error: null };
  }

  /**
   * Execute a proactive action
   */
  static async executeProactiveAction(
    actionId: string
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('proactive_actions')
      .update({
        status: 'in_progress',
        executed_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .eq('status', 'pending');

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  }

  /**
   * Complete a proactive action
   */
  static async completeProactiveAction(
    actionId: string,
    outcome: string,
    success: boolean
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('proactive_actions')
      .update({
        status: success ? 'completed' : 'failed',
        outcome,
        success,
        completed_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .in('status', ['pending', 'in_progress']);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  }

  /**
   * Get proactive actions for an agent
   */
  static async getAgentProactiveActions(
    agentId: string,
    options?: { behavior?: string; status?: string; limit?: number }
  ): Promise<{ actions: ProactiveAction[]; error: string | null }> {
    const supabase = await createClient();

    let query = supabase
      .from('proactive_actions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (options?.behavior) {
      query = query.eq('behavior', options.behavior);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return { actions: [], error: error.message };
    }

    return { actions: (data || []).map(this.mapProactiveAction), error: null };
  }

  // ============================================================================
  // TASK QUEUE
  // ============================================================================

  /**
   * Queue a task for an agent
   */
  static async queueTask(
    request: QueueTaskRequest
  ): Promise<{ task: AgentTask | null; error: string | null }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('agent_task_queue')
      .insert({
        agent_id: request.agentId,
        task_type: request.taskType,
        description: request.description,
        context: request.context || {},
        priority: request.priority ?? 50,
        urgency: request.urgency || 'medium',
        scheduled_for: request.scheduledFor?.toISOString(),
        deadline: request.deadline?.toISOString(),
        source: request.source || 'system',
        source_id: request.sourceId,
        status: 'queued',
      })
      .select()
      .single();

    if (error) {
      return { task: null, error: error.message };
    }

    return { task: this.mapTask(data), error: null };
  }

  /**
   * Get next task for an agent (uses database function)
   */
  static async getNextTask(
    agentId: string
  ): Promise<{ task: AgentTask | null; error: string | null }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .rpc('get_next_task', { p_agent_id: agentId });

    if (error) {
      return { task: null, error: error.message };
    }

    if (!data || data.length === 0) {
      return { task: null, error: null };
    }

    // Get full task details
    const { data: taskData, error: taskError } = await supabase
      .from('agent_task_queue')
      .select('*')
      .eq('id', data[0].task_id)
      .single();

    if (taskError) {
      return { task: null, error: taskError.message };
    }

    return { task: this.mapTask(taskData), error: null };
  }

  /**
   * Assign a task to an agent
   */
  static async assignTask(
    taskId: string,
    agentId: string
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .rpc('assign_task', { p_task_id: taskId, p_agent_id: agentId });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data === true, error: null };
  }

  /**
   * Complete a task
   */
  static async completeTask(
    taskId: string,
    result?: Record<string, unknown>,
    success: boolean = true
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .rpc('complete_task', {
        p_task_id: taskId,
        p_result: result || null,
        p_success: success,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data === true, error: null };
  }

  /**
   * Get task queue for an agent
   */
  static async getTaskQueue(
    agentId: string,
    options?: { status?: string; limit?: number }
  ): Promise<{ tasks: AgentTask[]; error: string | null }> {
    const supabase = await createClient();

    let query = supabase
      .from('agent_task_queue')
      .select('*')
      .eq('agent_id', agentId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return { tasks: [], error: error.message };
    }

    return { tasks: (data || []).map(this.mapTask), error: null };
  }

  // ============================================================================
  // EXCELLENCE CYCLES
  // ============================================================================

  /**
   * Start a new excellence cycle
   */
  static async startCycle(
    request: StartCycleRequest
  ): Promise<{ cycle: ExcellenceCycle | null; error: string | null }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('excellence_cycles')
      .insert({
        agent_id: request.agentId,
        phase: 'FIND',
        input: request.input || {},
        output: {},
        status: 'active',
        next_phase: 'FIX',
      })
      .select()
      .single();

    if (error) {
      return { cycle: null, error: error.message };
    }

    return { cycle: this.mapCycle(data), error: null };
  }

  /**
   * Advance to next phase in excellence cycle
   */
  static async advanceCycle(
    request: AdvanceCycleRequest
  ): Promise<{ cycle: ExcellenceCycle | null; error: string | null }> {
    const supabase = await createClient();

    // Get current cycle
    const { data: current } = await supabase
      .from('excellence_cycles')
      .select('*')
      .eq('id', request.cycleId)
      .eq('status', 'active')
      .single();

    if (!current) {
      return { cycle: null, error: 'Cycle not found or not active' };
    }

    const currentPhaseIndex = PHASE_ORDER.indexOf(current.phase);
    const nextPhase = PHASE_ORDER[currentPhaseIndex + 1];
    const isComplete = !nextPhase || current.phase === 'SUCCEED';

    // Build metrics update
    const metricsUpdate: Record<string, unknown> = {};
    if (request.metrics) {
      if (request.metrics.itemsFound !== undefined) {
        metricsUpdate.items_found = (current.items_found || 0) + request.metrics.itemsFound;
      }
      if (request.metrics.issuesFixed !== undefined) {
        metricsUpdate.issues_fixed = (current.issues_fixed || 0) + request.metrics.issuesFixed;
      }
      if (request.metrics.featuresImplemented !== undefined) {
        metricsUpdate.features_implemented = (current.features_implemented || 0) + request.metrics.featuresImplemented;
      }
      if (request.metrics.changesApplied !== undefined) {
        metricsUpdate.changes_applied = (current.changes_applied || 0) + request.metrics.changesApplied;
      }
      if (request.metrics.iterationsCompleted !== undefined) {
        metricsUpdate.iterations_completed = (current.iterations_completed || 0) + request.metrics.iterationsCompleted;
      }
    }

    // Update cycle
    const { data, error } = await supabase
      .from('excellence_cycles')
      .update({
        phase: isComplete ? 'SUCCEED' : nextPhase,
        output: request.output || current.output,
        status: isComplete ? 'completed' : 'active',
        next_phase: isComplete ? null : PHASE_ORDER[currentPhaseIndex + 2] || null,
        completed_at: isComplete ? new Date().toISOString() : null,
        ...metricsUpdate,
      })
      .eq('id', request.cycleId)
      .select()
      .single();

    if (error) {
      return { cycle: null, error: error.message };
    }

    return { cycle: this.mapCycle(data), error: null };
  }

  /**
   * Get active cycle for an agent
   */
  static async getActiveCycle(
    agentId: string
  ): Promise<{ cycle: ExcellenceCycle | null; error: string | null }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('excellence_cycles')
      .select('*')
      .eq('agent_id', agentId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return { cycle: null, error: error.message };
    }

    return { cycle: data ? this.mapCycle(data) : null, error: null };
  }

  /**
   * Get cycle history for an agent
   */
  static async getCycleHistory(
    agentId: string,
    limit: number = 10
  ): Promise<{ cycles: ExcellenceCycle[]; error: string | null }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('excellence_cycles')
      .select('*')
      .eq('agent_id', agentId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { cycles: [], error: error.message };
    }

    return { cycles: (data || []).map(this.mapCycle), error: null };
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private static mapCollaboration(data: any): AgentCollaboration {
    return {
      id: data.id,
      initiatorId: data.initiator_id,
      targetId: data.target_id,
      participants: data.participants || [],
      mode: data.mode,
      taskType: data.task_type,
      taskDescription: data.task_description,
      context: data.context || {},
      urgency: data.urgency,
      expectedOutcome: data.expected_outcome,
      status: data.status,
      finalOutcome: data.final_outcome,
      successRate: data.success_rate,
      createdAt: new Date(data.created_at),
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
    };
  }

  private static mapOutcome(data: any): CollaborationOutcome {
    return {
      id: data.id,
      collaborationId: data.collaboration_id,
      agentId: data.agent_id,
      contribution: data.contribution,
      confidence: data.confidence,
      actionItems: data.action_items || [],
      timeSpentMs: data.time_spent_ms,
      tokensUsed: data.tokens_used,
      submittedAt: new Date(data.submitted_at),
    };
  }

  private static mapConsensus(data: any): AgentConsensus {
    return {
      id: data.id,
      initiatorId: data.initiator_id,
      question: data.question,
      context: data.context || {},
      participants: data.participants || [],
      requiredAgreement: data.required_agreement,
      status: data.status,
      finalDecision: data.final_decision,
      agreementRate: data.agreement_rate,
      createdAt: new Date(data.created_at),
      deadline: data.deadline ? new Date(data.deadline) : undefined,
      resolvedAt: data.resolved_at ? new Date(data.resolved_at) : undefined,
    };
  }

  private static mapVote(data: any): ConsensusVote {
    return {
      id: data.id,
      consensusId: data.consensus_id,
      agentId: data.agent_id,
      vote: data.vote,
      reasoning: data.reasoning,
      confidence: data.confidence,
      votedAt: new Date(data.voted_at),
    };
  }

  private static mapProactiveAction(data: any): ProactiveAction {
    return {
      id: data.id,
      agentId: data.agent_id,
      behavior: data.behavior,
      triggerEvent: data.trigger_event,
      analysis: data.analysis,
      recommendation: data.recommendation,
      actionSteps: data.action_steps || [],
      delegatedTo: data.delegated_to,
      collaboratedWith: data.collaborated_with || [],
      priority: data.priority,
      confidence: data.confidence,
      status: data.status,
      outcome: data.outcome,
      success: data.success,
      createdAt: new Date(data.created_at),
      executedAt: data.executed_at ? new Date(data.executed_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    };
  }

  private static mapTask(data: any): AgentTask {
    return {
      id: data.id,
      agentId: data.agent_id,
      taskType: data.task_type,
      description: data.description,
      context: data.context || {},
      priority: data.priority,
      urgency: data.urgency,
      scheduledFor: data.scheduled_for ? new Date(data.scheduled_for) : undefined,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
      source: data.source,
      sourceId: data.source_id,
      status: data.status,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      result: data.result,
      error: data.error,
      createdAt: new Date(data.created_at),
    };
  }

  private static mapCycle(data: any): ExcellenceCycle {
    return {
      id: data.id,
      agentId: data.agent_id,
      phase: data.phase,
      input: data.input || {},
      output: data.output || {},
      itemsFound: data.items_found || 0,
      issuesFixed: data.issues_fixed || 0,
      featuresImplemented: data.features_implemented || 0,
      changesApplied: data.changes_applied || 0,
      iterationsCompleted: data.iterations_completed || 0,
      successRate: data.success_rate,
      status: data.status,
      startedAt: new Date(data.started_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      nextPhase: data.next_phase,
    };
  }
}

export default CollaborationService;
