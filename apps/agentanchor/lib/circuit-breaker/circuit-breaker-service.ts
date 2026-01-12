/**
 * Circuit Breaker Service
 *
 * Story 16-1: Agent Pause/Resume
 * Story 16-2: Global Kill Switch (stub)
 * Story 16-3: Cascade Halt Protocol (stub)
 * Story 16-4: Kill Switch Truth Chain Records (stub)
 *
 * Council Priority #3 (39 points)
 */

import { createClient } from '@/lib/supabase/server';
import { createRecord as createTruthChainRecord } from '@/lib/truth-chain/truth-chain-service';
import {
  PauseReason,
  CircuitBreakerEvent,
  PauseAgentRequest,
  ResumeAgentRequest,
  PauseAgentResult,
  ResumeAgentResult,
  AgentPauseState,
  KillSwitchState,
  ActivateKillSwitchRequest,
  DeactivateKillSwitchRequest,
  AgentDependency,
} from './types';

// =============================================================================
// Circuit Breaker Service
// =============================================================================

export class CircuitBreakerService {

  // ===========================================================================
  // Agent Pause/Resume (Story 16-1)
  // ===========================================================================

  /**
   * Pause an agent with reason and optional expiry
   */
  static async pauseAgent(
    request: PauseAgentRequest,
    userId: string
  ): Promise<PauseAgentResult> {
    const supabase = await createClient();

    try {
      // Check if agent exists and user has permission
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id, name, user_id, is_paused')
        .eq('id', request.agentId)
        .single();

      if (agentError || !agent) {
        return { success: false, agentId: request.agentId, error: 'Agent not found' };
      }

      // For now, only owner can pause (will add admin check later)
      if (agent.user_id !== userId) {
        return { success: false, agentId: request.agentId, error: 'Not authorized to pause this agent' };
      }

      if (agent.is_paused) {
        return { success: false, agentId: request.agentId, error: 'Agent is already paused' };
      }

      // Update agent to paused state
      const { error: updateError } = await supabase
        .from('bots')
        .update({
          is_paused: true,
          pause_reason: request.reason,
          paused_at: new Date().toISOString(),
          paused_by: userId,
          pause_notes: request.notes || null,
          pause_expires_at: request.expiresAt?.toISOString() || null,
        })
        .eq('id', request.agentId);

      if (updateError) {
        console.error('Error pausing agent:', updateError);
        return { success: false, agentId: request.agentId, error: 'Failed to pause agent' };
      }

      // Create circuit breaker event
      const event = await this.createEvent({
        agentId: request.agentId,
        eventType: 'pause',
        reason: request.reason,
        notes: request.notes,
        triggeredBy: userId,
        triggeredBySystem: false,
      });

      // Record in truth chain
      await this.recordToTruthChain('pause', request.agentId, {
        reason: request.reason,
        notes: request.notes,
        pausedBy: userId,
      });

      // Handle cascade if requested
      let cascadedAgents: string[] = [];
      if (request.cascadeToDependent) {
        cascadedAgents = await this.cascadeHalt(request.agentId, userId);
      }

      return {
        success: true,
        agentId: request.agentId,
        event,
        cascadedAgents,
      };
    } catch (error) {
      console.error('Circuit breaker pause error:', error);
      return { success: false, agentId: request.agentId, error: 'Internal error' };
    }
  }

  /**
   * Resume a paused agent
   */
  static async resumeAgent(
    request: ResumeAgentRequest,
    userId: string
  ): Promise<ResumeAgentResult> {
    const supabase = await createClient();

    try {
      // Check if agent exists and user has permission
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id, name, user_id, is_paused, pause_reason')
        .eq('id', request.agentId)
        .single();

      if (agentError || !agent) {
        return { success: false, agentId: request.agentId, error: 'Agent not found' };
      }

      // For now, only owner can resume (will add admin check later)
      if (agent.user_id !== userId) {
        return { success: false, agentId: request.agentId, error: 'Not authorized to resume this agent' };
      }

      if (!agent.is_paused) {
        return { success: false, agentId: request.agentId, error: 'Agent is not paused' };
      }

      // Check if pause reason prevents resume (e.g., investigation)
      if (agent.pause_reason === 'investigation') {
        return {
          success: false,
          agentId: request.agentId,
          error: 'Agent is under investigation and cannot be resumed without admin approval'
        };
      }

      // Update agent to active state
      const { error: updateError } = await supabase
        .from('bots')
        .update({
          is_paused: false,
          pause_reason: null,
          paused_at: null,
          paused_by: null,
          pause_notes: null,
          pause_expires_at: null,
        })
        .eq('id', request.agentId);

      if (updateError) {
        console.error('Error resuming agent:', updateError);
        return { success: false, agentId: request.agentId, error: 'Failed to resume agent' };
      }

      // Create circuit breaker event
      const event = await this.createEvent({
        agentId: request.agentId,
        eventType: 'resume',
        notes: request.notes,
        triggeredBy: userId,
        triggeredBySystem: false,
      });

      // Record in truth chain
      await this.recordToTruthChain('resume', request.agentId, {
        notes: request.notes,
        resumedBy: userId,
      });

      return {
        success: true,
        agentId: request.agentId,
        event,
      };
    } catch (error) {
      console.error('Circuit breaker resume error:', error);
      return { success: false, agentId: request.agentId, error: 'Internal error' };
    }
  }

  /**
   * Get pause state for an agent
   */
  static async getAgentPauseState(agentId: string): Promise<AgentPauseState | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('agents')
      .select('id, is_paused, pause_reason, paused_at, paused_by, pause_notes, pause_expires_at')
      .eq('id', agentId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      agentId: data.id,
      isPaused: data.is_paused || false,
      pauseReason: data.pause_reason,
      pausedAt: data.paused_at ? new Date(data.paused_at) : undefined,
      pausedBy: data.paused_by,
      pauseNotes: data.pause_notes,
      pauseExpiresAt: data.pause_expires_at ? new Date(data.pause_expires_at) : undefined,
    };
  }

  /**
   * Get all paused agents for a user
   */
  static async getPausedAgents(userId: string): Promise<AgentPauseState[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('agents')
      .select('id, is_paused, pause_reason, paused_at, paused_by, pause_notes, pause_expires_at')
      .eq('user_id', userId)
      .eq('is_paused', true);

    if (error || !data) {
      return [];
    }

    return data.map(d => ({
      agentId: d.id,
      isPaused: d.is_paused || false,
      pauseReason: d.pause_reason,
      pausedAt: d.paused_at ? new Date(d.paused_at) : undefined,
      pausedBy: d.paused_by,
      pauseNotes: d.pause_notes,
      pauseExpiresAt: d.pause_expires_at ? new Date(d.pause_expires_at) : undefined,
    }));
  }

  // ===========================================================================
  // Cascade Halt (Story 16-3) - Stub
  // ===========================================================================

  /**
   * Cascade halt to all dependent agents
   */
  static async cascadeHalt(agentId: string, userId: string): Promise<string[]> {
    const supabase = await createClient();
    const cascadedAgents: string[] = [];

    // Get all agents that depend on this agent
    const { data: dependents } = await supabase
      .from('agent_dependencies')
      .select('agent_id')
      .eq('depends_on_agent_id', agentId);

    if (!dependents || dependents.length === 0) {
      return cascadedAgents;
    }

    for (const dep of dependents) {
      // Pause each dependent agent
      const result = await this.pauseAgent({
        agentId: dep.agent_id,
        reason: 'cascade_halt',
        notes: `Cascaded from paused agent ${agentId}`,
        cascadeToDependent: true, // Recursive cascade
      }, userId);

      if (result.success) {
        cascadedAgents.push(dep.agent_id);
        if (result.cascadedAgents) {
          cascadedAgents.push(...result.cascadedAgents);
        }
      }
    }

    return cascadedAgents;
  }

  // ===========================================================================
  // Global Kill Switch (Story 16-2)
  // ===========================================================================

  /**
   * Activate global kill switch
   * Pauses all agents matching the scope
   */
  static async activateKillSwitch(
    request: ActivateKillSwitchRequest,
    userId: string
  ): Promise<{ success: boolean; state?: KillSwitchState; affectedCount?: number; error?: string }> {
    const supabase = await createClient();

    try {
      // Check if already active
      const existingState = await this.getKillSwitchState();
      if (existingState?.isActive) {
        return { success: false, error: 'Kill switch is already active' };
      }

      const scope = request.scope || 'all';

      // Create kill switch record
      const { data: killSwitch, error: insertError } = await supabase
        .from('global_kill_switch')
        .insert({
          is_active: true,
          activated_at: new Date().toISOString(),
          activated_by: userId,
          reason: request.reason,
          scope,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error activating kill switch:', insertError);
        return { success: false, error: 'Failed to activate kill switch' };
      }

      // Build query for agents to pause
      let query = supabase
        .from('bots')
        .update({
          is_paused: true,
          pause_reason: 'emergency_stop',
          paused_at: new Date().toISOString(),
          paused_by: userId,
          pause_notes: `Emergency stop: ${request.reason}`,
        })
        .eq('is_paused', false); // Only pause non-paused agents

      // Apply scope filter
      if (scope !== 'all') {
        if (scope.startsWith('tier:')) {
          const tier = scope.replace('tier:', '');
          query = query.eq('trust_tier', tier);
        } else if (scope.startsWith('specialization:')) {
          const spec = scope.replace('specialization:', '');
          query = query.eq('specialization', spec);
        }
      }

      const { data: updated, error: updateError } = await query.select('id');

      if (updateError) {
        console.error('Error pausing agents:', updateError);
        // Kill switch activated but agents not paused - log warning
      }

      const affectedCount = updated?.length || 0;

      // Record in truth chain
      await this.recordToTruthChain('emergency_stop_activated', 'global', {
        reason: request.reason,
        scope,
        activatedBy: userId,
        affectedAgents: affectedCount,
      });

      const state: KillSwitchState = {
        id: killSwitch.id,
        isActive: true,
        activatedAt: new Date(killSwitch.activated_at),
        activatedBy: killSwitch.activated_by,
        reason: killSwitch.reason,
        scope: killSwitch.scope,
      };

      return { success: true, state, affectedCount };
    } catch (error) {
      console.error('Kill switch activation error:', error);
      return { success: false, error: 'Internal error during kill switch activation' };
    }
  }

  /**
   * Deactivate global kill switch
   * Does NOT automatically resume agents (manual resume required)
   */
  static async deactivateKillSwitch(
    request: DeactivateKillSwitchRequest,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    try {
      const existingState = await this.getKillSwitchState();
      if (!existingState?.isActive) {
        return { success: false, error: 'Kill switch is not active' };
      }

      // Update kill switch record
      const { error: updateError } = await supabase
        .from('global_kill_switch')
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
          deactivated_by: userId,
        })
        .eq('id', existingState.id);

      if (updateError) {
        console.error('Error deactivating kill switch:', updateError);
        return { success: false, error: 'Failed to deactivate kill switch' };
      }

      // Record in truth chain
      await this.recordToTruthChain('emergency_stop_deactivated', 'global', {
        notes: request.notes,
        deactivatedBy: userId,
        originalReason: existingState.reason,
      });

      return { success: true };
    } catch (error) {
      console.error('Kill switch deactivation error:', error);
      return { success: false, error: 'Internal error during kill switch deactivation' };
    }
  }

  /**
   * Get current kill switch state
   */
  static async getKillSwitchState(): Promise<KillSwitchState | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('global_kill_switch')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      isActive: data.is_active,
      activatedAt: data.activated_at ? new Date(data.activated_at) : undefined,
      activatedBy: data.activated_by,
      reason: data.reason,
      scope: data.scope,
      deactivatedAt: data.deactivated_at ? new Date(data.deactivated_at) : undefined,
      deactivatedBy: data.deactivated_by,
    };
  }

  /**
   * Check if kill switch blocks an agent operation
   */
  static async isBlockedByKillSwitch(agentId: string): Promise<{ blocked: boolean; reason?: string }> {
    const state = await this.getKillSwitchState();
    if (!state?.isActive) {
      return { blocked: false };
    }

    // All agents blocked
    if (state.scope === 'all') {
      return { blocked: true, reason: state.reason };
    }

    // Check scope-specific blocking
    const supabase = await createClient();
    const { data: agent } = await supabase
      .from('agents')
      .select('trust_tier, specialization')
      .eq('id', agentId)
      .single();

    if (!agent) {
      return { blocked: false };
    }

    if (state.scope.startsWith('tier:')) {
      const tier = state.scope.replace('tier:', '');
      if (agent.trust_tier === tier) {
        return { blocked: true, reason: state.reason };
      }
    } else if (state.scope.startsWith('specialization:')) {
      const spec = state.scope.replace('specialization:', '');
      if (agent.specialization === spec) {
        return { blocked: true, reason: state.reason };
      }
    }

    return { blocked: false };
  }

  // ===========================================================================
  // Event Management
  // ===========================================================================

  /**
   * Create a circuit breaker event
   */
  private static async createEvent(params: {
    agentId: string;
    eventType: 'pause' | 'resume' | 'cascade_halt' | 'emergency_stop' | 'auto_resume';
    reason?: PauseReason;
    notes?: string;
    triggeredBy?: string;
    triggeredBySystem?: boolean;
    parentAgentId?: string;
  }): Promise<CircuitBreakerEvent | undefined> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('circuit_breaker_events')
      .insert({
        agent_id: params.agentId,
        event_type: params.eventType,
        reason: params.reason,
        notes: params.notes,
        triggered_by: params.triggeredBy,
        triggered_by_system: params.triggeredBySystem || false,
        parent_agent_id: params.parentAgentId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating circuit breaker event:', error);
      return undefined;
    }

    return {
      id: data.id,
      agentId: data.agent_id,
      eventType: data.event_type,
      reason: data.reason,
      notes: data.notes,
      triggeredBy: data.triggered_by,
      triggeredBySystem: data.triggered_by_system,
      parentAgentId: data.parent_agent_id,
      truthChainHash: data.truth_chain_hash,
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Get circuit breaker events for an agent
   */
  static async getEvents(agentId: string, limit = 50): Promise<CircuitBreakerEvent[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('circuit_breaker_events')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(d => ({
      id: d.id,
      agentId: d.agent_id,
      eventType: d.event_type,
      reason: d.reason,
      notes: d.notes,
      triggeredBy: d.triggered_by,
      triggeredBySystem: d.triggered_by_system,
      parentAgentId: d.parent_agent_id,
      truthChainHash: d.truth_chain_hash,
      createdAt: new Date(d.created_at),
    }));
  }

  // ===========================================================================
  // Truth Chain Integration (Story 16-4)
  // ===========================================================================

  /**
   * Record circuit breaker action to truth chain
   */
  private static async recordToTruthChain(
    action: string,
    agentId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      await createTruthChainRecord({
        record_type: 'circuit_breaker',
        agent_id: agentId,
        data: { action, ...data },
      });
    } catch (error) {
      // Log but don't fail the operation
      console.error('Failed to record to truth chain:', error);
    }
  }

  // ===========================================================================
  // Auto-Resume (Cron Job)
  // ===========================================================================

  /**
   * Process agents with expired pauses (for cron job)
   */
  static async processExpiredPauses(): Promise<{ processed: number; errors: number }> {
    const supabase = await createClient();
    let processed = 0;
    let errors = 0;

    // Get all agents with expired pauses
    const { data: expiredAgents, error } = await supabase
      .from('agents')
      .select('id, user_id')
      .eq('is_paused', true)
      .lt('pause_expires_at', new Date().toISOString());

    if (error || !expiredAgents) {
      return { processed: 0, errors: 1 };
    }

    for (const agent of expiredAgents) {
      try {
        // Auto-resume the agent
        const { error: updateError } = await supabase
          .from('bots')
          .update({
            is_paused: false,
            pause_reason: null,
            paused_at: null,
            paused_by: null,
            pause_notes: null,
            pause_expires_at: null,
          })
          .eq('id', agent.id);

        if (updateError) {
          errors++;
          continue;
        }

        // Create auto-resume event
        await this.createEvent({
          agentId: agent.id,
          eventType: 'auto_resume',
          notes: 'Automatically resumed after pause expiry',
          triggeredBySystem: true,
        });

        // Record in truth chain
        await this.recordToTruthChain('auto_resume', agent.id, {
          reason: 'pause_expired',
        });

        processed++;
      } catch (e) {
        console.error(`Error auto-resuming agent ${agent.id}:`, e);
        errors++;
      }
    }

    return { processed, errors };
  }
}

export default CircuitBreakerService;
