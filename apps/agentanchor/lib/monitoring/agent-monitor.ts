/**
 * Production Agent Monitoring Service
 * Monitors active agents for safety, performance, and trust issues
 */

import { createClient } from '@/lib/supabase/server'

// Alert severity levels
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

// Alert types
export type AlertType =
  | 'safety_violation'
  | 'ethics_violation'
  | 'performance_degradation'
  | 'trust_decay'
  | 'error_rate_spike'
  | 'latency_spike'
  | 'unusual_behavior'
  | 'council_rejection'

// Monitoring thresholds
export const MONITORING_THRESHOLDS = {
  // Error rate (percentage)
  errorRate: {
    info: 0.01,     // 1%
    low: 0.02,      // 2%
    medium: 0.05,   // 5%
    high: 0.10,     // 10%
    critical: 0.20  // 20%
  },

  // Latency (milliseconds)
  latency: {
    info: 1000,
    low: 2000,
    medium: 5000,
    high: 10000,
    critical: 30000
  },

  // Trust decay per day
  trustDecay: {
    info: 1,
    low: 3,
    medium: 5,
    high: 10,
    critical: 20
  },

  // Council rejection rate (percentage)
  councilRejection: {
    info: 0.10,     // 10%
    low: 0.20,      // 20%
    medium: 0.30,   // 30%
    high: 0.50,     // 50%
    critical: 0.70  // 70%
  },

  // Safety violations (count per day)
  safetyViolations: {
    info: 0,
    low: 0,
    medium: 0,
    high: 1,        // Any safety violation is at least high
    critical: 1
  }
}

// Auto-actions based on severity
export const AUTO_ACTIONS = {
  critical: ['suspend', 'notify_admin', 'log_audit'],
  high: ['rate_limit', 'notify_admin', 'log_audit'],
  medium: ['increase_monitoring', 'log_audit'],
  low: ['log_audit'],
  info: ['log_audit']
}

// Alert interface
export interface MonitoringAlert {
  agentId: string
  alertType: AlertType
  severity: AlertSeverity
  title: string
  description: string
  triggeredValue?: number
  thresholdValue?: number
  autoActionTaken?: string
  relatedEvents?: unknown[]
}

// Agent health snapshot
export interface AgentHealthSnapshot {
  agentId: string
  name: string
  status: 'healthy' | 'warning' | 'critical' | 'suspended'
  trustScore: number
  trustTrend: 'rising' | 'stable' | 'falling'
  lastExecution: string | null
  executionsToday: number
  errorRate: number
  avgLatencyMs: number
  openAlerts: number
  pipelineStage: string
}

/**
 * Agent Monitoring Service
 */
export class AgentMonitor {
  /**
   * Check an agent against all monitoring thresholds
   */
  static async checkAgent(agentId: string): Promise<MonitoringAlert[]> {
    const alerts: MonitoringAlert[] = []

    const supabase = await createClient()

    // Get agent info
    const { data: agent } = await supabase
      .from('bots')
      .select('id, name, trust_score, pipeline_stage, status')
      .eq('id', agentId)
      .single()

    if (!agent) return alerts

    // Get recent metrics (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    // Check error rate
    const { data: executions } = await supabase
      .from('bot_decisions')
      .select('approved, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', oneHourAgo)

    if (executions && executions.length > 0) {
      const totalExecutions = executions.length
      const failedExecutions = executions.filter(e => !e.approved).length
      const errorRate = failedExecutions / totalExecutions

      const severity = this.getSeverityForValue(errorRate, 'errorRate')
      if (severity !== 'info') {
        alerts.push({
          agentId,
          alertType: 'error_rate_spike',
          severity,
          title: `Error rate spike: ${Math.round(errorRate * 100)}%`,
          description: `Agent ${agent.name} has ${Math.round(errorRate * 100)}% error rate in the last hour`,
          triggeredValue: errorRate,
          thresholdValue: MONITORING_THRESHOLDS.errorRate[severity]
        })
      }
    }

    // Check trust decay
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: trustHistory } = await supabase
      .from('trust_history')
      .select('old_score, new_score, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: true })

    if (trustHistory && trustHistory.length > 0) {
      const startScore = trustHistory[0].old_score
      const endScore = trustHistory[trustHistory.length - 1].new_score
      const decay = startScore - endScore

      if (decay > 0) {
        const severity = this.getSeverityForValue(decay, 'trustDecay')
        if (severity !== 'info') {
          alerts.push({
            agentId,
            alertType: 'trust_decay',
            severity,
            title: `Trust decay: -${decay} points`,
            description: `Agent ${agent.name} lost ${decay} trust points in the last 24 hours`,
            triggeredValue: decay,
            thresholdValue: MONITORING_THRESHOLDS.trustDecay[severity]
          })
        }
      }
    }

    // Check for safety violations
    const { data: safetyViolations, count: violationCount } = await supabase
      .from('bot_audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('event_type', 'safety_violation')
      .gte('created_at', oneDayAgo)

    if (violationCount && violationCount > 0) {
      alerts.push({
        agentId,
        alertType: 'safety_violation',
        severity: 'critical',
        title: `Safety violations detected: ${violationCount}`,
        description: `Agent ${agent.name} triggered ${violationCount} safety violation(s) in the last 24 hours`,
        triggeredValue: violationCount,
        autoActionTaken: 'suspend'
      })
    }

    // Check council rejection rate
    const { data: councilDecisions } = await supabase
      .from('bot_decisions')
      .select('approved, risk_level')
      .eq('agent_id', agentId)
      .gte('risk_level', 2) // Only count council-reviewed decisions
      .gte('created_at', oneDayAgo)

    if (councilDecisions && councilDecisions.length >= 5) {
      const rejections = councilDecisions.filter(d => !d.approved).length
      const rejectionRate = rejections / councilDecisions.length

      const severity = this.getSeverityForValue(rejectionRate, 'councilRejection')
      if (severity !== 'info') {
        alerts.push({
          agentId,
          alertType: 'council_rejection',
          severity,
          title: `High council rejection rate: ${Math.round(rejectionRate * 100)}%`,
          description: `Agent ${agent.name} was rejected by the Council ${rejections}/${councilDecisions.length} times`,
          triggeredValue: rejectionRate,
          thresholdValue: MONITORING_THRESHOLDS.councilRejection[severity]
        })
      }
    }

    return alerts
  }

  /**
   * Get severity level for a value against thresholds
   */
  static getSeverityForValue(
    value: number,
    thresholdType: keyof typeof MONITORING_THRESHOLDS
  ): AlertSeverity {
    const thresholds = MONITORING_THRESHOLDS[thresholdType]

    if (value >= thresholds.critical) return 'critical'
    if (value >= thresholds.high) return 'high'
    if (value >= thresholds.medium) return 'medium'
    if (value >= thresholds.low) return 'low'
    return 'info'
  }

  /**
   * Create alert in database
   */
  static async createAlert(alert: MonitoringAlert): Promise<void> {
    const supabase = await createClient()

    await supabase.from('agent_monitoring_alerts').insert({
      agent_id: alert.agentId,
      alert_type: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      triggered_value: alert.triggeredValue,
      threshold_value: alert.thresholdValue,
      auto_action_taken: alert.autoActionTaken,
      related_events: alert.relatedEvents || [],
      status: 'open',
      triggered_at: new Date().toISOString()
    })

    // Execute auto-actions
    const actions = AUTO_ACTIONS[alert.severity]

    for (const action of actions) {
      if (action === 'suspend' && alert.severity === 'critical') {
        await this.suspendAgent(alert.agentId, alert.title)
      }

      if (action === 'rate_limit') {
        await this.rateLimitAgent(alert.agentId)
      }

      if (action === 'log_audit') {
        await supabase.from('bot_audit_log').insert({
          agent_id: alert.agentId,
          event_type: 'monitoring_alert',
          event_data: {
            alertType: alert.alertType,
            severity: alert.severity,
            title: alert.title
          },
          created_at: new Date().toISOString()
        })
      }
    }
  }

  /**
   * Suspend an agent (move to suspended stage)
   */
  static async suspendAgent(agentId: string, reason: string): Promise<void> {
    const supabase = await createClient()

    await supabase
      .from('bots')
      .update({
        pipeline_stage: 'suspended',
        status: 'suspended',
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId)

    await supabase.from('agent_pipeline_history').insert({
      agent_id: agentId,
      stage: 'suspended',
      entered_at: new Date().toISOString(),
      gate_results: {},
      metadata: { reason, automated: true }
    })
  }

  /**
   * Rate limit an agent
   */
  static async rateLimitAgent(agentId: string): Promise<void> {
    const supabase = await createClient()

    // Set rate limit in agent metadata
    const { data: agent } = await supabase
      .from('bots')
      .select('metadata')
      .eq('id', agentId)
      .single()

    const metadata = agent?.metadata || {}
    metadata.rateLimit = {
      enabled: true,
      maxRequestsPerMinute: 10,
      setAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    }

    await supabase
      .from('bots')
      .update({ metadata })
      .eq('id', agentId)
  }

  /**
   * Get health snapshot for an agent
   */
  static async getHealthSnapshot(agentId: string): Promise<AgentHealthSnapshot | null> {
    const supabase = await createClient()

    const { data: agent } = await supabase
      .from('bots')
      .select('id, name, trust_score, pipeline_stage, status, updated_at')
      .eq('id', agentId)
      .single()

    if (!agent) return null

    // Get today's execution stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: executions } = await supabase
      .from('bot_decisions')
      .select('approved, latency_ms, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', today.toISOString())

    const executionsToday = executions?.length || 0
    const failedToday = executions?.filter(e => !e.approved).length || 0
    const errorRate = executionsToday > 0 ? failedToday / executionsToday : 0

    const latencies = executions?.map(e => e.latency_ms).filter(Boolean) || []
    const avgLatencyMs = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0

    // Get open alerts
    const { count: openAlerts } = await supabase
      .from('agent_monitoring_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .in('status', ['open', 'acknowledged', 'investigating'])

    // Get trust trend (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: trustHistory } = await supabase
      .from('trust_history')
      .select('new_score')
      .eq('agent_id', agentId)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: true })

    let trustTrend: 'rising' | 'stable' | 'falling' = 'stable'
    if (trustHistory && trustHistory.length >= 2) {
      const firstScore = trustHistory[0].new_score
      const lastScore = trustHistory[trustHistory.length - 1].new_score
      const diff = lastScore - firstScore
      if (diff > 10) trustTrend = 'rising'
      else if (diff < -10) trustTrend = 'falling'
    }

    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical' | 'suspended' = 'healthy'
    if (agent.status === 'suspended' || agent.pipeline_stage === 'suspended') {
      status = 'suspended'
    } else if ((openAlerts || 0) > 0 || errorRate > 0.1) {
      status = errorRate > 0.2 ? 'critical' : 'warning'
    }

    return {
      agentId: agent.id,
      name: agent.name,
      status,
      trustScore: agent.trust_score || 0,
      trustTrend,
      lastExecution: executions?.[0]?.created_at || null,
      executionsToday,
      errorRate,
      avgLatencyMs: Math.round(avgLatencyMs),
      openAlerts: openAlerts || 0,
      pipelineStage: agent.pipeline_stage || 'draft'
    }
  }

  /**
   * Get all active agent health snapshots
   */
  static async getAllActiveAgentHealth(): Promise<AgentHealthSnapshot[]> {
    const supabase = await createClient()

    const { data: agents } = await supabase
      .from('bots')
      .select('id')
      .eq('pipeline_stage', 'active')

    if (!agents) return []

    const snapshots: AgentHealthSnapshot[] = []

    for (const agent of agents) {
      const snapshot = await this.getHealthSnapshot(agent.id)
      if (snapshot) snapshots.push(snapshot)
    }

    return snapshots
  }

  /**
   * Run monitoring checks for all active agents
   */
  static async runMonitoringCycle(): Promise<{
    agentsChecked: number
    alertsCreated: number
    agentsSuspended: number
  }> {
    const supabase = await createClient()

    const { data: activeAgents } = await supabase
      .from('bots')
      .select('id')
      .eq('pipeline_stage', 'active')

    if (!activeAgents) {
      return { agentsChecked: 0, alertsCreated: 0, agentsSuspended: 0 }
    }

    let alertsCreated = 0
    let agentsSuspended = 0

    for (const agent of activeAgents) {
      const alerts = await this.checkAgent(agent.id)

      for (const alert of alerts) {
        await this.createAlert(alert)
        alertsCreated++

        if (alert.severity === 'critical' && alert.autoActionTaken === 'suspend') {
          agentsSuspended++
        }
      }
    }

    // Log monitoring cycle
    await supabase.from('bot_audit_log').insert({
      event_type: 'monitoring_cycle',
      event_data: {
        agentsChecked: activeAgents.length,
        alertsCreated,
        agentsSuspended,
        completedAt: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    })

    return {
      agentsChecked: activeAgents.length,
      alertsCreated,
      agentsSuspended
    }
  }
}

export default AgentMonitor
