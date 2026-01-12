/**
 * Agent Signal System
 * Enables agents to subscribe to, receive, and respond to system events
 *
 * Key capabilities:
 * 1. Event Subscriptions - Agents can subscribe to specific event types
 * 2. Event Replay - Catch up on missed events when reconnecting
 * 3. Signal Aggregation - Reduce noise by grouping similar events
 * 4. Context Feed - Curated stream of relevant information
 * 5. Callbacks/Triggers - Events can invoke agent actions
 */

import { createClient } from '@/lib/supabase/server'

// ============================================
// SIGNAL TYPES
// ============================================

export type SignalCategory =
  | 'self'           // Events about this agent
  | 'peer'           // Events about peer agents (same level/domain)
  | 'hierarchy'      // Events about agents above/below in hierarchy
  | 'council'        // Council decisions and governance
  | 'trust'          // Trust score changes
  | 'academy'        // Training and certification events
  | 'marketplace'    // Marketplace activity
  | 'system'         // System-wide events
  | 'safety'         // Safety and security alerts

export type SignalPriority = 'critical' | 'high' | 'normal' | 'low' | 'background'

export type SignalType =
  // Self signals
  | 'trust_changed'
  | 'feedback_received'
  | 'task_assigned'
  | 'task_completed'
  | 'error_occurred'
  | 'council_review'
  | 'stage_transition'

  // Peer signals
  | 'peer_graduated'
  | 'peer_suspended'
  | 'peer_trust_change'

  // Council signals
  | 'council_decision'
  | 'precedent_set'
  | 'policy_update'

  // System signals
  | 'system_alert'
  | 'maintenance_scheduled'
  | 'rate_limit_approaching'

  // Safety signals
  | 'safety_violation_detected'
  | 'anomaly_detected'
  | 'security_event'

// Signal payload
export interface Signal {
  id: string
  type: SignalType
  category: SignalCategory
  priority: SignalPriority
  timestamp: string
  sequence: number

  // Who/what is this about
  subject: {
    type: 'agent' | 'user' | 'system' | 'council'
    id: string
    name?: string
  }

  // What happened
  data: Record<string, unknown>
  summary: string

  // For aggregated signals
  aggregation?: {
    count: number
    firstOccurrence: string
    lastOccurrence: string
    affectedEntities: string[]
  }

  // Response options
  actionRequired: boolean
  suggestedActions?: string[]
  expiresAt?: string
}

// Agent subscription preferences
export interface AgentSubscription {
  agentId: string
  enabled: boolean

  // What categories to receive
  categories: {
    [K in SignalCategory]: {
      enabled: boolean
      minPriority: SignalPriority
      realtime: boolean  // Push immediately vs batch
    }
  }

  // Custom filters
  filters: {
    // Only receive signals about specific agents
    watchedAgents?: string[]
    // Only receive signals from specific domains
    domains?: string[]
    // Hierarchy level filter (e.g., "L0-L3" for listeners/executors)
    hierarchyLevels?: string[]
  }

  // Delivery preferences
  delivery: {
    realtime: boolean      // Pusher channel
    webhook?: string       // HTTP callback URL
    batchInterval?: number // Minutes between batch deliveries
  }

  // Rate limiting
  rateLimit: {
    maxPerMinute: number
    maxPerHour: number
  }
}

// Default subscription for new agents
export const DEFAULT_SUBSCRIPTION: Omit<AgentSubscription, 'agentId'> = {
  enabled: true,
  categories: {
    self: { enabled: true, minPriority: 'low', realtime: true },
    peer: { enabled: true, minPriority: 'normal', realtime: false },
    hierarchy: { enabled: true, minPriority: 'high', realtime: true },
    council: { enabled: true, minPriority: 'normal', realtime: true },
    trust: { enabled: true, minPriority: 'normal', realtime: true },
    academy: { enabled: true, minPriority: 'normal', realtime: false },
    marketplace: { enabled: false, minPriority: 'high', realtime: false },
    system: { enabled: true, minPriority: 'high', realtime: true },
    safety: { enabled: true, minPriority: 'low', realtime: true } // All safety signals
  },
  filters: {},
  delivery: {
    realtime: true,
    batchInterval: 15
  },
  rateLimit: {
    maxPerMinute: 60,
    maxPerHour: 500
  }
}

// ============================================
// SIGNAL SERVICE
// ============================================

export class AgentSignalService {

  /**
   * Get or create subscription for an agent
   */
  static async getSubscription(agentId: string): Promise<AgentSubscription> {
    const supabase = await createClient()

    const { data } = await supabase
      .from('agent_signal_subscriptions')
      .select('*')
      .eq('agent_id', agentId)
      .single()

    if (data) {
      return {
        agentId: data.agent_id,
        enabled: data.enabled,
        categories: data.categories,
        filters: data.filters || {},
        delivery: data.delivery,
        rateLimit: data.rate_limit
      }
    }

    // Create default subscription
    const subscription: AgentSubscription = {
      agentId,
      ...DEFAULT_SUBSCRIPTION
    }

    await supabase.from('agent_signal_subscriptions').insert({
      agent_id: agentId,
      enabled: subscription.enabled,
      categories: subscription.categories,
      filters: subscription.filters,
      delivery: subscription.delivery,
      rate_limit: subscription.rateLimit,
      created_at: new Date().toISOString()
    })

    return subscription
  }

  /**
   * Update subscription preferences
   */
  static async updateSubscription(
    agentId: string,
    updates: Partial<AgentSubscription>
  ): Promise<void> {
    const supabase = await createClient()

    await supabase
      .from('agent_signal_subscriptions')
      .update({
        enabled: updates.enabled,
        categories: updates.categories,
        filters: updates.filters,
        delivery: updates.delivery,
        rate_limit: updates.rateLimit,
        updated_at: new Date().toISOString()
      })
      .eq('agent_id', agentId)
  }

  /**
   * Emit a signal to relevant subscribers
   */
  static async emit(signal: Omit<Signal, 'id' | 'sequence'>): Promise<string> {
    const supabase = await createClient()

    // Generate signal ID and sequence
    const signalId = crypto.randomUUID()
    const { data: sequenceData } = await supabase.rpc('next_signal_sequence')
    const sequence = sequenceData || Date.now()

    const fullSignal: Signal = {
      ...signal,
      id: signalId,
      sequence
    }

    // Store signal
    await supabase.from('agent_signals').insert({
      id: signalId,
      type: signal.type,
      category: signal.category,
      priority: signal.priority,
      timestamp: signal.timestamp,
      sequence,
      subject_type: signal.subject.type,
      subject_id: signal.subject.id,
      subject_name: signal.subject.name,
      data: signal.data,
      summary: signal.summary,
      aggregation: signal.aggregation,
      action_required: signal.actionRequired,
      suggested_actions: signal.suggestedActions,
      expires_at: signal.expiresAt
    })

    // Find subscribers and deliver
    await this.deliverToSubscribers(fullSignal)

    return signalId
  }

  /**
   * Deliver signal to all matching subscribers
   */
  private static async deliverToSubscribers(signal: Signal): Promise<void> {
    const supabase = await createClient()

    // Get all enabled subscriptions for this category
    const { data: subscriptions } = await supabase
      .from('agent_signal_subscriptions')
      .select('agent_id, categories, filters, delivery, rate_limit')
      .eq('enabled', true)

    if (!subscriptions) return

    const priorityOrder: SignalPriority[] = ['critical', 'high', 'normal', 'low', 'background']

    for (const sub of subscriptions) {
      const categoryConfig = sub.categories?.[signal.category]
      if (!categoryConfig?.enabled) continue

      // Check priority threshold
      const signalPriorityIndex = priorityOrder.indexOf(signal.priority)
      const minPriorityIndex = priorityOrder.indexOf(categoryConfig.minPriority)
      if (signalPriorityIndex > minPriorityIndex) continue

      // Check filters
      if (!this.matchesFilters(signal, sub.filters, sub.agent_id)) continue

      // Check rate limit
      const withinLimit = await this.checkRateLimit(sub.agent_id, sub.rate_limit)
      if (!withinLimit) continue

      // Deliver
      if (categoryConfig.realtime && sub.delivery?.realtime) {
        await this.deliverRealtime(sub.agent_id, signal)
      } else {
        await this.queueForBatch(sub.agent_id, signal)
      }
    }
  }

  /**
   * Check if signal matches subscription filters
   */
  private static matchesFilters(
    signal: Signal,
    filters: AgentSubscription['filters'],
    subscriberAgentId: string
  ): boolean {
    // Self category always matches self
    if (signal.category === 'self' && signal.subject.id === subscriberAgentId) {
      return true
    }

    // Check watched agents filter
    if (filters.watchedAgents?.length) {
      if (!filters.watchedAgents.includes(signal.subject.id)) {
        return false
      }
    }

    // Check domain filter
    if (filters.domains?.length) {
      const signalDomain = signal.data?.domain as string | undefined
      if (signalDomain && !filters.domains.includes(signalDomain)) {
        return false
      }
    }

    return true
  }

  /**
   * Check rate limit for subscriber
   */
  private static async checkRateLimit(
    agentId: string,
    rateLimit: AgentSubscription['rateLimit']
  ): Promise<boolean> {
    const supabase = await createClient()

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { count: minuteCount } = await supabase
      .from('agent_signal_deliveries')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .gte('delivered_at', oneMinuteAgo)

    if ((minuteCount || 0) >= rateLimit.maxPerMinute) return false

    const { count: hourCount } = await supabase
      .from('agent_signal_deliveries')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .gte('delivered_at', oneHourAgo)

    if ((hourCount || 0) >= rateLimit.maxPerHour) return false

    return true
  }

  /**
   * Deliver signal in realtime via Pusher
   */
  private static async deliverRealtime(agentId: string, signal: Signal): Promise<void> {
    const supabase = await createClient()

    // Record delivery
    await supabase.from('agent_signal_deliveries').insert({
      agent_id: agentId,
      signal_id: signal.id,
      channel: 'realtime',
      delivered_at: new Date().toISOString()
    })

    // Trigger Pusher event (if configured)
    // This would use the existing Pusher infrastructure
    try {
      const { triggerEvent } = await import('@/lib/pusher/server')
      await triggerEvent(`private-agent-${agentId}`, 'signal', signal)
    } catch {
      // Pusher not configured, skip
    }
  }

  /**
   * Queue signal for batch delivery
   */
  private static async queueForBatch(agentId: string, signal: Signal): Promise<void> {
    const supabase = await createClient()

    await supabase.from('agent_signal_queue').insert({
      agent_id: agentId,
      signal_id: signal.id,
      queued_at: new Date().toISOString()
    })
  }

  /**
   * Get signals for an agent (replay/catchup)
   */
  static async getSignals(
    agentId: string,
    options: {
      sinceSequence?: number
      sinceTimestamp?: string
      categories?: SignalCategory[]
      minPriority?: SignalPriority
      limit?: number
      includeExpired?: boolean
    } = {}
  ): Promise<Signal[]> {
    const supabase = await createClient()
    const subscription = await this.getSubscription(agentId)

    let query = supabase
      .from('agent_signals')
      .select('*')
      .order('sequence', { ascending: true })
      .limit(options.limit || 100)

    if (options.sinceSequence) {
      query = query.gt('sequence', options.sinceSequence)
    }

    if (options.sinceTimestamp) {
      query = query.gt('timestamp', options.sinceTimestamp)
    }

    if (options.categories?.length) {
      query = query.in('category', options.categories)
    }

    if (!options.includeExpired) {
      query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    }

    const { data: signals } = await query

    if (!signals) return []

    // Filter by subscription preferences and transform
    const priorityOrder: SignalPriority[] = ['critical', 'high', 'normal', 'low', 'background']
    const minPriorityIndex = options.minPriority
      ? priorityOrder.indexOf(options.minPriority)
      : 4

    return signals
      .filter(s => {
        const priorityIndex = priorityOrder.indexOf(s.priority)
        if (priorityIndex > minPriorityIndex) return false

        const categoryConfig = subscription.categories[s.category as SignalCategory]
        if (!categoryConfig?.enabled) return false

        return this.matchesFilters(
          s as unknown as Signal,
          subscription.filters,
          agentId
        )
      })
      .map(s => ({
        id: s.id,
        type: s.type,
        category: s.category,
        priority: s.priority,
        timestamp: s.timestamp,
        sequence: s.sequence,
        subject: {
          type: s.subject_type,
          id: s.subject_id,
          name: s.subject_name
        },
        data: s.data,
        summary: s.summary,
        aggregation: s.aggregation,
        actionRequired: s.action_required,
        suggestedActions: s.suggested_actions,
        expiresAt: s.expires_at
      })) as Signal[]
  }

  /**
   * Get context feed for an agent
   * Returns curated signals based on agent's current situation
   */
  static async getContextFeed(
    agentId: string,
    windowHours: number = 24
  ): Promise<{
    self: Signal[]
    peers: Signal[]
    council: Signal[]
    system: Signal[]
    actionRequired: Signal[]
  }> {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

    const allSignals = await this.getSignals(agentId, {
      sinceTimestamp: since,
      limit: 500
    })

    return {
      self: allSignals.filter(s => s.category === 'self'),
      peers: allSignals.filter(s => s.category === 'peer'),
      council: allSignals.filter(s => s.category === 'council'),
      system: allSignals.filter(s => s.category === 'system' || s.category === 'safety'),
      actionRequired: allSignals.filter(s => s.actionRequired)
    }
  }

  /**
   * Acknowledge a signal (mark as seen/handled)
   */
  static async acknowledge(
    agentId: string,
    signalId: string,
    response?: {
      action: string
      outcome?: string
      data?: Record<string, unknown>
    }
  ): Promise<void> {
    const supabase = await createClient()

    await supabase.from('agent_signal_acknowledgments').insert({
      agent_id: agentId,
      signal_id: signalId,
      acknowledged_at: new Date().toISOString(),
      action_taken: response?.action,
      outcome: response?.outcome,
      response_data: response?.data
    })
  }

  /**
   * Get unacknowledged signals requiring action
   */
  static async getPendingActions(agentId: string): Promise<Signal[]> {
    const supabase = await createClient()

    const { data: acknowledged } = await supabase
      .from('agent_signal_acknowledgments')
      .select('signal_id')
      .eq('agent_id', agentId)

    const acknowledgedIds = (acknowledged || []).map(a => a.signal_id)

    const allSignals = await this.getSignals(agentId, {
      limit: 100
    })

    return allSignals.filter(s =>
      s.actionRequired &&
      !acknowledgedIds.includes(s.id) &&
      (!s.expiresAt || new Date(s.expiresAt) > new Date())
    )
  }
}

// ============================================
// CONVENIENCE EMITTERS
// ============================================

export async function emitTrustChange(
  agentId: string,
  agentName: string,
  oldScore: number,
  newScore: number,
  reason: string
): Promise<string> {
  const change = newScore - oldScore
  const priority: SignalPriority =
    Math.abs(change) >= 50 ? 'critical' :
    Math.abs(change) >= 20 ? 'high' :
    Math.abs(change) >= 5 ? 'normal' : 'low'

  return AgentSignalService.emit({
    type: 'trust_changed',
    category: 'self',
    priority,
    timestamp: new Date().toISOString(),
    subject: { type: 'agent', id: agentId, name: agentName },
    data: { oldScore, newScore, change, reason },
    summary: `Trust ${change >= 0 ? 'increased' : 'decreased'} by ${Math.abs(change)} points: ${reason}`,
    actionRequired: change < -20 // Significant drop requires attention
  })
}

export async function emitCouncilDecision(
  decision: {
    id: string
    agentId: string
    agentName: string
    action: string
    outcome: 'approved' | 'rejected' | 'escalated'
    votes: Record<string, boolean>
    reasoning: string
  }
): Promise<string> {
  return AgentSignalService.emit({
    type: 'council_decision',
    category: 'council',
    priority: decision.outcome === 'rejected' ? 'high' : 'normal',
    timestamp: new Date().toISOString(),
    subject: { type: 'agent', id: decision.agentId, name: decision.agentName },
    data: decision,
    summary: `Council ${decision.outcome} action "${decision.action}": ${decision.reasoning}`,
    actionRequired: decision.outcome === 'rejected',
    suggestedActions: decision.outcome === 'rejected'
      ? ['Review rejection reasoning', 'Modify approach', 'Request appeal']
      : undefined
  })
}

export async function emitSafetyAlert(
  agentId: string,
  agentName: string,
  alertType: string,
  details: Record<string, unknown>
): Promise<string> {
  return AgentSignalService.emit({
    type: 'safety_violation_detected',
    category: 'safety',
    priority: 'critical',
    timestamp: new Date().toISOString(),
    subject: { type: 'agent', id: agentId, name: agentName },
    data: { alertType, ...details },
    summary: `Safety alert: ${alertType}`,
    actionRequired: true,
    suggestedActions: ['Suspend activity', 'Review logs', 'Await human review']
  })
}

export async function emitPeerEvent(
  sourceAgentId: string,
  sourceAgentName: string,
  eventType: 'peer_graduated' | 'peer_suspended' | 'peer_trust_change',
  details: Record<string, unknown>
): Promise<string> {
  return AgentSignalService.emit({
    type: eventType,
    category: 'peer',
    priority: 'normal',
    timestamp: new Date().toISOString(),
    subject: { type: 'agent', id: sourceAgentId, name: sourceAgentName },
    data: details,
    summary: `Peer ${sourceAgentName}: ${eventType.replace('peer_', '')}`,
    actionRequired: false
  })
}

export async function emitSystemAlert(
  alertType: string,
  message: string,
  priority: SignalPriority = 'high',
  actionRequired: boolean = false
): Promise<string> {
  return AgentSignalService.emit({
    type: 'system_alert',
    category: 'system',
    priority,
    timestamp: new Date().toISOString(),
    subject: { type: 'system', id: 'system', name: 'AgentAnchor' },
    data: { alertType },
    summary: message,
    actionRequired
  })
}

export default AgentSignalService
