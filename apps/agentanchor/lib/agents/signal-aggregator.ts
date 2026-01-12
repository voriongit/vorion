/**
 * Signal Aggregator
 * Reduces noise by grouping similar signals into summaries
 *
 * Instead of 100 individual "trust_changed" signals, agents receive:
 * "5 peers had trust changes in the last hour (net: +45 points)"
 */

import { createClient } from '@/lib/supabase/server'
import { Signal, SignalType, SignalCategory, SignalPriority } from './agent-signals'

// ============================================
// AGGREGATION TYPES
// ============================================

export type AggregationWindow = 'minute' | 'hour' | 'day'

export interface AggregationRule {
  id: string
  name: string
  signalTypes: SignalType[]
  category: SignalCategory
  window: AggregationWindow
  minCount: number  // Aggregate only if count >= this
  summarizer: (signals: Signal[]) => AggregatedSignal
}

export interface AggregatedSignal {
  type: SignalType
  category: SignalCategory
  priority: SignalPriority
  summary: string
  data: {
    count: number
    windowStart: string
    windowEnd: string
    breakdown: Record<string, unknown>
  }
  originalSignalIds: string[]
  affectedEntities: Array<{ type: string; id: string; name?: string }>
}

// ============================================
// AGGREGATION RULES
// ============================================

export const AGGREGATION_RULES: AggregationRule[] = [
  // Peer trust changes
  {
    id: 'peer-trust-batch',
    name: 'Peer Trust Changes',
    signalTypes: ['peer_trust_change'],
    category: 'peer',
    window: 'hour',
    minCount: 3,
    summarizer: (signals) => {
      const changes = signals.map(s => s.data.change as number || 0)
      const netChange = changes.reduce((a, b) => a + b, 0)
      const positive = changes.filter(c => c > 0).length
      const negative = changes.filter(c => c < 0).length

      return {
        type: 'peer_trust_change',
        category: 'peer',
        priority: Math.abs(netChange) > 50 ? 'high' : 'normal',
        summary: `${signals.length} peers had trust changes (net: ${netChange >= 0 ? '+' : ''}${netChange})`,
        data: {
          count: signals.length,
          windowStart: signals[0].timestamp,
          windowEnd: signals[signals.length - 1].timestamp,
          breakdown: { netChange, positive, negative }
        },
        originalSignalIds: signals.map(s => s.id),
        affectedEntities: signals.map(s => s.subject)
      }
    }
  },

  // Peer graduations
  {
    id: 'peer-graduations-batch',
    name: 'Peer Graduations',
    signalTypes: ['peer_graduated'],
    category: 'peer',
    window: 'day',
    minCount: 2,
    summarizer: (signals) => ({
      type: 'peer_graduated',
      category: 'peer',
      priority: 'normal',
      summary: `${signals.length} peers graduated today`,
      data: {
        count: signals.length,
        windowStart: signals[0].timestamp,
        windowEnd: signals[signals.length - 1].timestamp,
        breakdown: {}
      },
      originalSignalIds: signals.map(s => s.id),
      affectedEntities: signals.map(s => s.subject)
    })
  },

  // Council decisions
  {
    id: 'council-decisions-batch',
    name: 'Council Activity',
    signalTypes: ['council_decision'],
    category: 'council',
    window: 'hour',
    minCount: 5,
    summarizer: (signals) => {
      const approved = signals.filter(s => s.data.outcome === 'approved').length
      const rejected = signals.filter(s => s.data.outcome === 'rejected').length

      return {
        type: 'council_decision',
        category: 'council',
        priority: rejected > approved ? 'high' : 'normal',
        summary: `Council reviewed ${signals.length} actions (${approved} approved, ${rejected} rejected)`,
        data: {
          count: signals.length,
          windowStart: signals[0].timestamp,
          windowEnd: signals[signals.length - 1].timestamp,
          breakdown: { approved, rejected }
        },
        originalSignalIds: signals.map(s => s.id),
        affectedEntities: signals.map(s => s.subject)
      }
    }
  },

  // System alerts
  {
    id: 'system-alerts-batch',
    name: 'System Alerts',
    signalTypes: ['system_alert'],
    category: 'system',
    window: 'hour',
    minCount: 3,
    summarizer: (signals) => {
      const byType = signals.reduce((acc, s) => {
        const alertType = s.data.alertType as string || 'unknown'
        acc[alertType] = (acc[alertType] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const hasCritical = signals.some(s => s.priority === 'critical')

      return {
        type: 'system_alert',
        category: 'system',
        priority: hasCritical ? 'critical' : 'high',
        summary: `${signals.length} system alerts in the last hour`,
        data: {
          count: signals.length,
          windowStart: signals[0].timestamp,
          windowEnd: signals[signals.length - 1].timestamp,
          breakdown: { byType }
        },
        originalSignalIds: signals.map(s => s.id),
        affectedEntities: []
      }
    }
  }
]

// ============================================
// AGGREGATOR SERVICE
// ============================================

export class SignalAggregator {

  /**
   * Process pending signals and create aggregations
   */
  static async aggregate(): Promise<AggregatedSignal[]> {
    const aggregations: AggregatedSignal[] = []

    for (const rule of AGGREGATION_RULES) {
      const signals = await this.getSignalsForRule(rule)

      if (signals.length >= rule.minCount) {
        const aggregated = rule.summarizer(signals)
        aggregations.push(aggregated)

        // Mark signals as aggregated
        await this.markAggregated(signals.map(s => s.id), rule.id)
      }
    }

    return aggregations
  }

  /**
   * Get signals matching an aggregation rule
   */
  private static async getSignalsForRule(rule: AggregationRule): Promise<Signal[]> {
    const supabase = await createClient()

    const windowMs = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000
    }

    const since = new Date(Date.now() - windowMs[rule.window]).toISOString()

    const { data } = await supabase
      .from('agent_signals')
      .select('*')
      .in('type', rule.signalTypes)
      .eq('category', rule.category)
      .gte('timestamp', since)
      .is('aggregated_into', null)
      .order('timestamp', { ascending: true })

    return (data || []).map(s => ({
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
      actionRequired: s.action_required
    })) as Signal[]
  }

  /**
   * Mark signals as aggregated
   */
  private static async markAggregated(signalIds: string[], ruleId: string): Promise<void> {
    const supabase = await createClient()

    await supabase
      .from('agent_signals')
      .update({ aggregated_into: ruleId })
      .in('id', signalIds)
  }

  /**
   * Get aggregated feed for an agent
   * Returns both aggregated summaries and non-aggregated critical signals
   */
  static async getAggregatedFeed(
    agentId: string,
    windowHours: number = 24
  ): Promise<{
    aggregations: AggregatedSignal[]
    critical: Signal[]  // Never aggregate critical signals
    self: Signal[]      // Never aggregate self signals
  }> {
    const supabase = await createClient()
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

    // Get critical signals (never aggregate)
    const { data: criticalData } = await supabase
      .from('agent_signals')
      .select('*')
      .eq('priority', 'critical')
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(50)

    // Get self signals (never aggregate)
    const { data: selfData } = await supabase
      .from('agent_signals')
      .select('*')
      .eq('category', 'self')
      .eq('subject_id', agentId)
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(50)

    const mapSignal = (s: Record<string, unknown>): Signal => ({
      id: s.id as string,
      type: s.type as SignalType,
      category: s.category as SignalCategory,
      priority: s.priority as SignalPriority,
      timestamp: s.timestamp as string,
      sequence: s.sequence as number,
      subject: {
        type: s.subject_type as string,
        id: s.subject_id as string,
        name: s.subject_name as string | undefined
      } as Signal['subject'],
      data: s.data as Record<string, unknown>,
      summary: s.summary as string,
      actionRequired: s.action_required as boolean,
      suggestedActions: s.suggested_actions as string[] | undefined,
      expiresAt: s.expires_at as string | undefined
    })

    // Run aggregation for other signals
    const aggregations = await this.aggregate()

    return {
      aggregations,
      critical: (criticalData || []).map(mapSignal),
      self: (selfData || []).map(mapSignal)
    }
  }

  /**
   * Create a digest email/notification from aggregated signals
   */
  static async createDigest(
    agentId: string,
    period: 'hourly' | 'daily'
  ): Promise<{
    subject: string
    summary: string
    sections: Array<{ title: string; content: string; count: number }>
  }> {
    const windowHours = period === 'hourly' ? 1 : 24
    const feed = await this.getAggregatedFeed(agentId, windowHours)

    const sections: Array<{ title: string; content: string; count: number }> = []

    // Critical alerts section
    if (feed.critical.length > 0) {
      sections.push({
        title: '🚨 Critical Alerts',
        content: feed.critical.map(s => `- ${s.summary}`).join('\n'),
        count: feed.critical.length
      })
    }

    // Self signals section
    if (feed.self.length > 0) {
      sections.push({
        title: '📊 Your Activity',
        content: feed.self.slice(0, 5).map(s => `- ${s.summary}`).join('\n'),
        count: feed.self.length
      })
    }

    // Aggregations section
    for (const agg of feed.aggregations) {
      sections.push({
        title: `${getCategoryEmoji(agg.category)} ${agg.summary}`,
        content: `Affected: ${agg.affectedEntities.slice(0, 3).map(e => e.name || e.id).join(', ')}${agg.affectedEntities.length > 3 ? ` and ${agg.affectedEntities.length - 3} more` : ''}`,
        count: agg.data.count
      })
    }

    const totalEvents = feed.critical.length + feed.self.length +
      feed.aggregations.reduce((sum, a) => sum + a.data.count, 0)

    return {
      subject: `${period === 'hourly' ? 'Hourly' : 'Daily'} Digest: ${totalEvents} events`,
      summary: `${feed.critical.length} critical alerts, ${feed.self.length} personal events, ${feed.aggregations.length} grouped updates`,
      sections
    }
  }
}

// Helper function for category emojis
function getCategoryEmoji(category: SignalCategory): string {
  const emojis: Record<SignalCategory, string> = {
    self: '📊',
    peer: '👥',
    hierarchy: '📈',
    council: '⚖️',
    trust: '🏆',
    academy: '🎓',
    marketplace: '🛒',
    system: '⚙️',
    safety: '🛡️'
  }
  return emojis[category] || '📌'
}

export default SignalAggregator
