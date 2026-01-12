/**
 * Observer Types - Event logging and audit trail
 * Story 5-1: Observer Event Logging (FR82-FR86)
 */

// Event sources
export type EventSource =
  | 'agent'
  | 'council'
  | 'academy'
  | 'marketplace'
  | 'user'
  | 'system'
  | 'cron'

// Event types
export type EventType =
  // Agent events
  | 'agent_created'
  | 'agent_updated'
  | 'agent_action'
  | 'agent_graduated'
  | 'agent_archived'
  | 'agent_probation_started'
  | 'agent_probation_ended'
  // Council events
  | 'council_request'
  | 'council_vote'
  | 'council_decision'
  | 'council_precedent_created'
  // Academy events
  | 'academy_enrolled'
  | 'academy_progress'
  | 'academy_module_completed'
  | 'academy_examination'
  // Trust events
  | 'trust_change'
  | 'trust_decay'
  | 'tier_change'
  // User events
  | 'user_feedback'
  | 'escalation_created'
  | 'escalation_resolved'
  | 'human_override'
  // System events
  | 'system_startup'
  | 'system_maintenance'
  | 'decay_batch'

// Risk levels for events
export type EventRiskLevel = 'info' | 'low' | 'medium' | 'high' | 'critical'

// Observer event structure
export interface ObserverEvent {
  id: string
  sequence: number
  source: EventSource
  event_type: EventType
  risk_level: EventRiskLevel
  agent_id?: string
  user_id?: string
  data: Record<string, unknown>
  timestamp: string
  previous_hash: string
  hash: string
  signature: string
}

// Event input for logging
export interface EventInput {
  source: EventSource
  event_type: EventType
  risk_level?: EventRiskLevel
  agent_id?: string
  user_id?: string
  data: Record<string, unknown>
}

// Event query options
export interface EventQueryOptions {
  agent_id?: string
  user_id?: string
  event_type?: EventType
  source?: EventSource
  risk_level?: EventRiskLevel
  from_timestamp?: string
  to_timestamp?: string
  limit?: number
  offset?: number
}

// Event feed response
export interface EventFeedResponse {
  events: ObserverEvent[]
  total: number
  limit: number
  offset: number
  has_more: boolean
  latest_sequence: number
}

// Export options
export interface ExportOptions {
  format: 'json' | 'csv'
  from_timestamp?: string
  to_timestamp?: string
  agent_id?: string
  include_signatures: boolean
}
