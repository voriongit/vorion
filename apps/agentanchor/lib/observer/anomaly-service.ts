/**
 * Anomaly Detection Service
 * Story 5-3: Anomaly Detection (FR90)
 *
 * Detects unusual patterns in agent behavior:
 * - Spike: >3x normal activity rate
 * - Error cluster: High error rate in short period
 * - Timing anomaly: Actions at unusual times
 * - Risk escalation: Sudden increase in risk levels
 */

import { createClient } from '@/lib/supabase/server'
import { logEvent } from './observer-service'

export type AnomalyType =
  | 'activity_spike'
  | 'error_cluster'
  | 'timing_anomaly'
  | 'risk_escalation'
  | 'trust_drop'
  | 'rapid_actions'

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical'

export interface Anomaly {
  id: string
  agent_id: string
  anomaly_type: AnomalyType
  severity: AnomalySeverity
  description: string
  details: Record<string, unknown>
  detected_at: string
  resolved_at?: string
  acknowledged_at?: string
  acknowledged_by?: string
}

export interface AnomalyDetectionResult {
  detected: boolean
  anomalies: Omit<Anomaly, 'id'>[]
}

// Detection thresholds
const THRESHOLDS = {
  // Activity spike: events per minute threshold
  activitySpikeMultiplier: 3,
  activityBaselineWindow: 60, // minutes to calculate baseline

  // Error cluster: errors in time window
  errorClusterThreshold: 5,
  errorClusterWindow: 5, // minutes

  // Risk escalation: high/critical events in window
  riskEscalationThreshold: 3,
  riskEscalationWindow: 10, // minutes

  // Trust drop: points drop threshold
  trustDropThreshold: 50,
  trustDropWindow: 24, // hours

  // Rapid actions: actions per minute
  rapidActionsThreshold: 10,
  rapidActionsWindow: 1, // minute
}

/**
 * Detect anomalies for an agent
 */
export async function detectAnomalies(
  agentId: string
): Promise<AnomalyDetectionResult> {
  const supabase = createClient()
  const anomalies: Omit<Anomaly, 'id'>[] = []
  const now = new Date()

  try {
    // Get recent events for this agent
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const { data: recentEvents } = await supabase
      .from('observer_events')
      .select('*')
      .eq('agent_id', agentId)
      .gte('timestamp', oneHourAgo.toISOString())
      .order('timestamp', { ascending: false })

    const events = recentEvents || []

    // 1. Check for activity spike
    const activityAnomaly = checkActivitySpike(events, agentId)
    if (activityAnomaly) anomalies.push(activityAnomaly)

    // 2. Check for error cluster
    const errorAnomaly = checkErrorCluster(events, agentId)
    if (errorAnomaly) anomalies.push(errorAnomaly)

    // 3. Check for risk escalation
    const riskAnomaly = checkRiskEscalation(events, agentId)
    if (riskAnomaly) anomalies.push(riskAnomaly)

    // 4. Check for rapid actions
    const rapidAnomaly = checkRapidActions(events, agentId)
    if (rapidAnomaly) anomalies.push(rapidAnomaly)

    // 5. Check for trust drop
    const trustAnomaly = await checkTrustDrop(agentId)
    if (trustAnomaly) anomalies.push(trustAnomaly)

    return {
      detected: anomalies.length > 0,
      anomalies,
    }
  } catch (error) {
    console.error('Anomaly detection error:', error)
    return { detected: false, anomalies: [] }
  }
}

function checkActivitySpike(
  events: any[],
  agentId: string
): Omit<Anomaly, 'id'> | null {
  if (events.length < 10) return null

  const now = new Date()
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  const recentCount = events.filter(
    e => new Date(e.timestamp) > fiveMinAgo
  ).length

  const hourlyCount = events.filter(
    e => new Date(e.timestamp) > oneHourAgo
  ).length

  const hourlyRate = hourlyCount / 12 // per 5-min period
  const spikeMultiplier = hourlyRate > 0 ? recentCount / hourlyRate : 0

  if (spikeMultiplier >= THRESHOLDS.activitySpikeMultiplier) {
    return {
      agent_id: agentId,
      anomaly_type: 'activity_spike',
      severity: spikeMultiplier > 5 ? 'high' : 'medium',
      description: `Activity spike detected: ${spikeMultiplier.toFixed(1)}x normal rate`,
      details: {
        recent_count: recentCount,
        normal_rate: hourlyRate,
        multiplier: spikeMultiplier,
      },
      detected_at: now.toISOString(),
    }
  }

  return null
}

function checkErrorCluster(
  events: any[],
  agentId: string
): Omit<Anomaly, 'id'> | null {
  const now = new Date()
  const windowStart = new Date(
    now.getTime() - THRESHOLDS.errorClusterWindow * 60 * 1000
  )

  const recentErrors = events.filter(
    e =>
      new Date(e.timestamp) > windowStart &&
      (e.risk_level === 'high' || e.risk_level === 'critical' ||
       e.event_type.includes('error') || e.event_type.includes('failure'))
  )

  if (recentErrors.length >= THRESHOLDS.errorClusterThreshold) {
    return {
      agent_id: agentId,
      anomaly_type: 'error_cluster',
      severity: recentErrors.length > 10 ? 'critical' : 'high',
      description: `Error cluster detected: ${recentErrors.length} errors in ${THRESHOLDS.errorClusterWindow} minutes`,
      details: {
        error_count: recentErrors.length,
        window_minutes: THRESHOLDS.errorClusterWindow,
        error_types: [...new Set(recentErrors.map(e => e.event_type))],
      },
      detected_at: now.toISOString(),
    }
  }

  return null
}

function checkRiskEscalation(
  events: any[],
  agentId: string
): Omit<Anomaly, 'id'> | null {
  const now = new Date()
  const windowStart = new Date(
    now.getTime() - THRESHOLDS.riskEscalationWindow * 60 * 1000
  )

  const highRiskEvents = events.filter(
    e =>
      new Date(e.timestamp) > windowStart &&
      (e.risk_level === 'high' || e.risk_level === 'critical')
  )

  if (highRiskEvents.length >= THRESHOLDS.riskEscalationThreshold) {
    return {
      agent_id: agentId,
      anomaly_type: 'risk_escalation',
      severity: highRiskEvents.some(e => e.risk_level === 'critical')
        ? 'critical'
        : 'high',
      description: `Risk escalation: ${highRiskEvents.length} high/critical events in ${THRESHOLDS.riskEscalationWindow} minutes`,
      details: {
        high_risk_count: highRiskEvents.length,
        window_minutes: THRESHOLDS.riskEscalationWindow,
        event_types: [...new Set(highRiskEvents.map(e => e.event_type))],
      },
      detected_at: now.toISOString(),
    }
  }

  return null
}

function checkRapidActions(
  events: any[],
  agentId: string
): Omit<Anomaly, 'id'> | null {
  const now = new Date()
  const oneMinAgo = new Date(now.getTime() - 60 * 1000)

  const recentActions = events.filter(
    e => new Date(e.timestamp) > oneMinAgo
  )

  if (recentActions.length >= THRESHOLDS.rapidActionsThreshold) {
    return {
      agent_id: agentId,
      anomaly_type: 'rapid_actions',
      severity: recentActions.length > 20 ? 'high' : 'medium',
      description: `Rapid actions detected: ${recentActions.length} actions in 1 minute`,
      details: {
        action_count: recentActions.length,
        actions_per_minute: recentActions.length,
      },
      detected_at: now.toISOString(),
    }
  }

  return null
}

async function checkTrustDrop(
  agentId: string
): Promise<Omit<Anomaly, 'id'> | null> {
  const supabase = createClient()
  const now = new Date()
  const windowStart = new Date(
    now.getTime() - THRESHOLDS.trustDropWindow * 60 * 60 * 1000
  )

  const { data: trustHistory } = await supabase
    .from('trust_history')
    .select('score, previous_score, change_amount, recorded_at')
    .eq('agent_id', agentId)
    .gte('recorded_at', windowStart.toISOString())
    .order('recorded_at', { ascending: true })

  if (!trustHistory || trustHistory.length === 0) return null

  // Calculate total drop
  const totalDrop = trustHistory
    .filter(h => h.change_amount < 0)
    .reduce((sum, h) => sum + Math.abs(h.change_amount), 0)

  if (totalDrop >= THRESHOLDS.trustDropThreshold) {
    return {
      agent_id: agentId,
      anomaly_type: 'trust_drop',
      severity: totalDrop > 100 ? 'critical' : totalDrop > 75 ? 'high' : 'medium',
      description: `Significant trust drop: -${totalDrop} points in ${THRESHOLDS.trustDropWindow} hours`,
      details: {
        total_drop: totalDrop,
        window_hours: THRESHOLDS.trustDropWindow,
        negative_events: trustHistory.filter(h => h.change_amount < 0).length,
      },
      detected_at: now.toISOString(),
    }
  }

  return null
}

/**
 * Store detected anomaly in database
 */
export async function storeAnomaly(
  anomaly: Omit<Anomaly, 'id'>
): Promise<Anomaly | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('observer_anomalies')
    .insert(anomaly)
    .select()
    .single()

  if (error) {
    console.error('Failed to store anomaly:', error)
    return null
  }

  // Log to Observer
  await logEvent({
    source: 'system',
    event_type: 'agent_action', // Using existing type
    risk_level: anomaly.severity === 'critical' ? 'critical' :
               anomaly.severity === 'high' ? 'high' : 'medium',
    agent_id: anomaly.agent_id,
    data: {
      anomaly_type: anomaly.anomaly_type,
      description: anomaly.description,
      severity: anomaly.severity,
    },
  })

  return data as Anomaly
}

/**
 * Get anomalies for an agent
 */
export async function getAnomalies(
  agentId?: string,
  options: {
    includeResolved?: boolean
    severity?: AnomalySeverity
    limit?: number
    offset?: number
  } = {}
): Promise<{ anomalies: Anomaly[]; total: number }> {
  const supabase = createClient()

  let query = supabase
    .from('observer_anomalies')
    .select('*', { count: 'exact' })

  if (agentId) {
    query = query.eq('agent_id', agentId)
  }

  if (!options.includeResolved) {
    query = query.is('resolved_at', null)
  }

  if (options.severity) {
    query = query.eq('severity', options.severity)
  }

  query = query
    .order('detected_at', { ascending: false })
    .range(
      options.offset || 0,
      (options.offset || 0) + (options.limit || 50) - 1
    )

  const { data, error, count } = await query

  if (error) {
    console.error('Failed to get anomalies:', error)
    return { anomalies: [], total: 0 }
  }

  return {
    anomalies: (data || []) as Anomaly[],
    total: count || 0,
  }
}

/**
 * Acknowledge an anomaly
 */
export async function acknowledgeAnomaly(
  anomalyId: string,
  userId: string
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('observer_anomalies')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
    })
    .eq('id', anomalyId)

  return !error
}

/**
 * Resolve an anomaly
 */
export async function resolveAnomaly(
  anomalyId: string,
  resolution?: string
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('observer_anomalies')
    .update({
      resolved_at: new Date().toISOString(),
      details: resolution ? { resolution } : undefined,
    })
    .eq('id', anomalyId)

  return !error
}

/**
 * Run anomaly detection for all active agents
 */
export async function runAnomalyDetectionBatch(): Promise<{
  agentsChecked: number
  anomaliesDetected: number
  anomalies: Anomaly[]
}> {
  const supabase = createClient()

  const { data: agents } = await supabase
    .from('bots')
    .select('id')
    .eq('status', 'active')

  if (!agents || agents.length === 0) {
    return { agentsChecked: 0, anomaliesDetected: 0, anomalies: [] }
  }

  const storedAnomalies: Anomaly[] = []

  for (const agent of agents) {
    const result = await detectAnomalies(agent.id)

    for (const anomaly of result.anomalies) {
      const stored = await storeAnomaly(anomaly)
      if (stored) {
        storedAnomalies.push(stored)
      }
    }
  }

  return {
    agentsChecked: agents.length,
    anomaliesDetected: storedAnomalies.length,
    anomalies: storedAnomalies,
  }
}
