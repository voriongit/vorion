/**
 * Pusher Event Definitions
 *
 * Type-safe event definitions for AgentAnchor realtime features.
 */

import type { ObserverEvent } from '@/lib/db/schema/observer'
import type { TrustHistory } from '@/lib/db/schema/agents'
import type { CouncilDecision } from '@/lib/db/schema/council'

// ============================================
// Channel Names
// ============================================

export const CHANNELS = {
  // Public channels
  OBSERVER_FEED: 'observer-feed',
  COUNCIL_FEED: 'council-feed',

  // Private channels (require auth)
  userChannel: (userId: string) => `private-user-${userId}`,
  agentChannel: (agentId: string) => `private-agent-${agentId}`,

  // Presence channels (require auth, track who's online)
  COUNCIL_PRESENCE: 'presence-council',
} as const

// ============================================
// Event Names
// ============================================

export const EVENTS = {
  // Observer events
  NEW_OBSERVER_EVENT: 'new-event',
  ANOMALY_DETECTED: 'anomaly-detected',

  // Trust events
  TRUST_CHANGE: 'trust-change',
  TRUST_TIER_CHANGE: 'trust-tier-change',

  // Council events
  DECISION_PENDING: 'decision-pending',
  DECISION_MADE: 'decision-made',
  ESCALATION_REQUIRED: 'escalation-required',

  // Agent events
  AGENT_STATUS_CHANGE: 'agent-status-change',
  AGENT_GRADUATED: 'agent-graduated',

  // User notifications
  NOTIFICATION: 'notification',

  // System events
  SYSTEM_ALERT: 'system-alert',
} as const

// ============================================
// Event Payloads
// ============================================

// Observer events
export interface ObserverEventPayload {
  event: Pick<ObserverEvent, 'id' | 'eventType' | 'category' | 'severity' | 'title' | 'description' | 'createdAt'>
  agentId?: string
  agentName?: string
}

export interface AnomalyDetectedPayload {
  eventId: string
  agentId: string
  agentName: string
  anomalyScore: number
  description: string
  timestamp: string
}

// Trust events
export interface TrustChangePayload {
  agentId: string
  agentName: string
  previousScore: number
  newScore: number
  change: number
  source: TrustHistory['source']
  reason?: string
}

export interface TrustTierChangePayload {
  agentId: string
  agentName: string
  previousTier: string
  newTier: string
  trustScore: number
}

// Council events
export interface CouncilDecisionPayload {
  decision: Pick<CouncilDecision, 'id' | 'decisionType' | 'status' | 'riskLevel' | 'reasoning'>
  agentId: string
  agentName: string
}

export interface EscalationPayload {
  decisionId: string
  agentId: string
  agentName: string
  riskLevel: number
  reason: string
  requiredBy: string
}

// Agent events
export interface AgentStatusChangePayload {
  agentId: string
  agentName: string
  previousStatus: string
  newStatus: string
  reason?: string
}

// User notifications
export interface NotificationPayload {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  actionUrl?: string
  timestamp: string
}

// System alerts
export interface SystemAlertPayload {
  level: 'info' | 'warning' | 'critical'
  title: string
  message: string
  timestamp: string
}

// ============================================
// Helper Types
// ============================================

export type ChannelName = typeof CHANNELS[keyof typeof CHANNELS] | ReturnType<typeof CHANNELS.userChannel | typeof CHANNELS.agentChannel>
export type EventName = typeof EVENTS[keyof typeof EVENTS]

// Event map for type-safe subscriptions
export interface EventPayloadMap {
  [EVENTS.NEW_OBSERVER_EVENT]: ObserverEventPayload
  [EVENTS.ANOMALY_DETECTED]: AnomalyDetectedPayload
  [EVENTS.TRUST_CHANGE]: TrustChangePayload
  [EVENTS.TRUST_TIER_CHANGE]: TrustTierChangePayload
  [EVENTS.DECISION_PENDING]: CouncilDecisionPayload
  [EVENTS.DECISION_MADE]: CouncilDecisionPayload
  [EVENTS.ESCALATION_REQUIRED]: EscalationPayload
  [EVENTS.AGENT_STATUS_CHANGE]: AgentStatusChangePayload
  [EVENTS.AGENT_GRADUATED]: AgentStatusChangePayload
  [EVENTS.NOTIFICATION]: NotificationPayload
  [EVENTS.SYSTEM_ALERT]: SystemAlertPayload
}
