/**
 * Agent Callback System
 * Enables agents to register callbacks that are triggered by system events
 *
 * This allows agents to:
 * 1. React to events automatically
 * 2. Chain actions based on triggers
 * 3. Learn from system feedback
 */

import { createClient } from '@/lib/supabase/server'
import { Signal, SignalType, SignalCategory } from './agent-signals'

// ============================================
// CALLBACK TYPES
// ============================================

export type CallbackType =
  | 'webhook'          // HTTP POST to external URL
  | 'internal_action'  // Trigger internal agent action
  | 'log_only'         // Just record the trigger
  | 'escalate'         // Escalate to human/council

export type CallbackCondition = {
  field: string           // e.g., "data.change", "priority"
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'matches'
  value: string | number | boolean
}

export interface AgentCallback {
  id: string
  agentId: string
  name: string
  description?: string
  enabled: boolean

  // Trigger conditions
  trigger: {
    signalTypes: SignalType[]
    categories?: SignalCategory[]
    conditions?: CallbackCondition[]
    minPriority?: string
  }

  // What to do when triggered
  action: {
    type: CallbackType
    config: {
      // For webhook
      url?: string
      headers?: Record<string, string>
      retries?: number

      // For internal_action
      actionType?: string
      actionParams?: Record<string, unknown>

      // For escalate
      escalateTo?: 'council' | 'human' | 'supervisor'
      reason?: string
    }
  }

  // Rate limiting
  rateLimit?: {
    maxPerHour: number
    cooldownMinutes: number
  }

  // Metadata
  createdAt: string
  updatedAt: string
  lastTriggeredAt?: string
  triggerCount: number
}

// Callback execution result
export interface CallbackResult {
  callbackId: string
  signalId: string
  success: boolean
  executedAt: string
  duration: number
  response?: unknown
  error?: string
}

// ============================================
// CALLBACK SERVICE
// ============================================

export class AgentCallbackService {

  /**
   * Register a new callback for an agent
   */
  static async register(
    agentId: string,
    callback: Omit<AgentCallback, 'id' | 'agentId' | 'createdAt' | 'updatedAt' | 'triggerCount'>
  ): Promise<string> {
    const supabase = await createClient()
    const callbackId = crypto.randomUUID()

    await supabase.from('agent_callbacks').insert({
      id: callbackId,
      agent_id: agentId,
      name: callback.name,
      description: callback.description,
      enabled: callback.enabled,
      trigger_config: callback.trigger,
      action_config: callback.action,
      rate_limit: callback.rateLimit,
      trigger_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    return callbackId
  }

  /**
   * Get all callbacks for an agent
   */
  static async getCallbacks(agentId: string): Promise<AgentCallback[]> {
    const supabase = await createClient()

    const { data } = await supabase
      .from('agent_callbacks')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })

    return (data || []).map(c => ({
      id: c.id,
      agentId: c.agent_id,
      name: c.name,
      description: c.description,
      enabled: c.enabled,
      trigger: c.trigger_config,
      action: c.action_config,
      rateLimit: c.rate_limit,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      lastTriggeredAt: c.last_triggered_at,
      triggerCount: c.trigger_count
    }))
  }

  /**
   * Update a callback
   */
  static async update(
    callbackId: string,
    updates: Partial<AgentCallback>
  ): Promise<void> {
    const supabase = await createClient()

    await supabase.from('agent_callbacks').update({
      name: updates.name,
      description: updates.description,
      enabled: updates.enabled,
      trigger_config: updates.trigger,
      action_config: updates.action,
      rate_limit: updates.rateLimit,
      updated_at: new Date().toISOString()
    }).eq('id', callbackId)
  }

  /**
   * Delete a callback
   */
  static async delete(callbackId: string): Promise<void> {
    const supabase = await createClient()
    await supabase.from('agent_callbacks').delete().eq('id', callbackId)
  }

  /**
   * Process a signal and execute matching callbacks
   */
  static async processSignal(signal: Signal): Promise<CallbackResult[]> {
    const supabase = await createClient()
    const results: CallbackResult[] = []

    // Get all enabled callbacks that might match
    const { data: callbacks } = await supabase
      .from('agent_callbacks')
      .select('*')
      .eq('enabled', true)

    if (!callbacks) return results

    for (const callback of callbacks) {
      const cb = {
        id: callback.id,
        agentId: callback.agent_id,
        trigger: callback.trigger_config,
        action: callback.action_config,
        rateLimit: callback.rate_limit,
        lastTriggeredAt: callback.last_triggered_at
      }

      // Check if callback matches this signal
      if (!this.matchesTrigger(signal, cb.trigger)) continue

      // Check rate limit
      if (!await this.checkRateLimit(cb)) continue

      // Execute callback
      const result = await this.executeCallback(cb, signal)
      results.push(result)

      // Update callback stats
      await supabase.from('agent_callbacks').update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: callback.trigger_count + 1
      }).eq('id', callback.id)

      // Record execution
      await supabase.from('agent_callback_executions').insert({
        callback_id: callback.id,
        signal_id: signal.id,
        agent_id: callback.agent_id,
        success: result.success,
        executed_at: result.executedAt,
        duration_ms: result.duration,
        response: result.response,
        error: result.error
      })
    }

    return results
  }

  /**
   * Check if a signal matches callback trigger conditions
   */
  private static matchesTrigger(
    signal: Signal,
    trigger: AgentCallback['trigger']
  ): boolean {
    // Check signal type
    if (!trigger.signalTypes.includes(signal.type)) return false

    // Check category if specified
    if (trigger.categories?.length && !trigger.categories.includes(signal.category)) {
      return false
    }

    // Check priority if specified
    if (trigger.minPriority) {
      const priorityOrder = ['critical', 'high', 'normal', 'low', 'background']
      const signalIndex = priorityOrder.indexOf(signal.priority)
      const minIndex = priorityOrder.indexOf(trigger.minPriority)
      if (signalIndex > minIndex) return false
    }

    // Check custom conditions
    if (trigger.conditions) {
      for (const condition of trigger.conditions) {
        if (!this.evaluateCondition(signal, condition)) return false
      }
    }

    return true
  }

  /**
   * Evaluate a single condition against a signal
   */
  private static evaluateCondition(
    signal: Signal,
    condition: CallbackCondition
  ): boolean {
    // Get value from signal using dot notation
    const value = condition.field.split('.').reduce((obj: unknown, key) => {
      if (obj && typeof obj === 'object') {
        return (obj as Record<string, unknown>)[key]
      }
      return undefined
    }, signal as unknown)

    switch (condition.operator) {
      case 'eq':
        return value === condition.value
      case 'neq':
        return value !== condition.value
      case 'gt':
        return typeof value === 'number' && value > (condition.value as number)
      case 'lt':
        return typeof value === 'number' && value < (condition.value as number)
      case 'gte':
        return typeof value === 'number' && value >= (condition.value as number)
      case 'lte':
        return typeof value === 'number' && value <= (condition.value as number)
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value as string)
      case 'matches':
        return typeof value === 'string' && new RegExp(condition.value as string).test(value)
      default:
        return false
    }
  }

  /**
   * Check if callback is within rate limits
   */
  private static async checkRateLimit(callback: {
    id: string
    rateLimit?: AgentCallback['rateLimit']
    lastTriggeredAt?: string
  }): Promise<boolean> {
    if (!callback.rateLimit) return true

    const supabase = await createClient()

    // Check cooldown
    if (callback.lastTriggeredAt && callback.rateLimit.cooldownMinutes) {
      const cooldownEnd = new Date(callback.lastTriggeredAt)
      cooldownEnd.setMinutes(cooldownEnd.getMinutes() + callback.rateLimit.cooldownMinutes)
      if (new Date() < cooldownEnd) return false
    }

    // Check hourly limit
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('agent_callback_executions')
      .select('*', { count: 'exact', head: true })
      .eq('callback_id', callback.id)
      .gte('executed_at', oneHourAgo)

    if ((count || 0) >= callback.rateLimit.maxPerHour) return false

    return true
  }

  /**
   * Execute a callback action
   */
  private static async executeCallback(
    callback: { id: string; agentId: string; action: AgentCallback['action'] },
    signal: Signal
  ): Promise<CallbackResult> {
    const startTime = Date.now()

    try {
      let response: unknown

      switch (callback.action.type) {
        case 'webhook':
          response = await this.executeWebhook(callback.action.config, signal)
          break

        case 'internal_action':
          response = await this.executeInternalAction(
            callback.agentId,
            callback.action.config,
            signal
          )
          break

        case 'escalate':
          response = await this.executeEscalation(
            callback.agentId,
            callback.action.config,
            signal
          )
          break

        case 'log_only':
          response = { logged: true, signalId: signal.id }
          break
      }

      return {
        callbackId: callback.id,
        signalId: signal.id,
        success: true,
        executedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
        response
      }
    } catch (error) {
      return {
        callbackId: callback.id,
        signalId: signal.id,
        success: false,
        executedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Execute webhook callback
   */
  private static async executeWebhook(
    config: AgentCallback['action']['config'],
    signal: Signal
  ): Promise<unknown> {
    if (!config.url) throw new Error('Webhook URL not configured')

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify({
        signal,
        timestamp: new Date().toISOString()
      })
    })

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
    }

    return await response.json().catch(() => ({ status: response.status }))
  }

  /**
   * Execute internal action
   */
  private static async executeInternalAction(
    agentId: string,
    config: AgentCallback['action']['config'],
    signal: Signal
  ): Promise<unknown> {
    const supabase = await createClient()

    // Record the triggered action for the agent to process
    await supabase.from('agent_triggered_actions').insert({
      agent_id: agentId,
      action_type: config.actionType,
      action_params: config.actionParams,
      trigger_signal_id: signal.id,
      status: 'pending',
      created_at: new Date().toISOString()
    })

    return { actionType: config.actionType, status: 'queued' }
  }

  /**
   * Execute escalation
   */
  private static async executeEscalation(
    agentId: string,
    config: AgentCallback['action']['config'],
    signal: Signal
  ): Promise<unknown> {
    const supabase = await createClient()

    // Create escalation record
    const { data } = await supabase.from('escalations').insert({
      agent_id: agentId,
      escalate_to: config.escalateTo,
      reason: config.reason || signal.summary,
      trigger_signal_id: signal.id,
      status: 'pending',
      created_at: new Date().toISOString()
    }).select('id').single()

    return { escalationId: data?.id, escalateTo: config.escalateTo }
  }
}

// ============================================
// PRE-BUILT CALLBACK TEMPLATES
// ============================================

export const CALLBACK_TEMPLATES = {
  // Pause on safety violation
  safetyPause: {
    name: 'Safety Violation Pause',
    description: 'Pause agent activity when safety violation detected',
    trigger: {
      signalTypes: ['safety_violation_detected'] as SignalType[],
      categories: ['safety'] as SignalCategory[]
    },
    action: {
      type: 'internal_action' as CallbackType,
      config: {
        actionType: 'pause_activity',
        actionParams: { reason: 'safety_violation' }
      }
    }
  },

  // Escalate on trust drop
  trustDropEscalate: {
    name: 'Trust Drop Escalation',
    description: 'Escalate to council when trust drops significantly',
    trigger: {
      signalTypes: ['trust_changed'] as SignalType[],
      conditions: [
        { field: 'data.change', operator: 'lt' as const, value: -20 }
      ]
    },
    action: {
      type: 'escalate' as CallbackType,
      config: {
        escalateTo: 'council',
        reason: 'Significant trust score drop'
      }
    }
  },

  // Log all council decisions
  councilDecisionLog: {
    name: 'Council Decision Logger',
    description: 'Log all council decisions for analysis',
    trigger: {
      signalTypes: ['council_decision'] as SignalType[],
      categories: ['council'] as SignalCategory[]
    },
    action: {
      type: 'log_only' as CallbackType,
      config: {}
    }
  },

  // Notify on peer graduation
  peerGraduationWebhook: {
    name: 'Peer Graduation Notification',
    description: 'Send webhook when a peer agent graduates',
    trigger: {
      signalTypes: ['peer_graduated'] as SignalType[],
      categories: ['peer'] as SignalCategory[]
    },
    action: {
      type: 'webhook' as CallbackType,
      config: {
        url: '', // To be configured
        retries: 3
      }
    }
  }
}

export default AgentCallbackService
