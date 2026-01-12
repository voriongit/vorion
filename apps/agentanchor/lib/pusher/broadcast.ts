/**
 * Pusher Broadcast Helpers
 *
 * Convenient functions for broadcasting common events.
 */

import { triggerEvent } from './server'
import {
  CHANNELS,
  EVENTS,
  type ObserverEventPayload,
  type TrustChangePayload,
  type TrustTierChangePayload,
  type CouncilDecisionPayload,
  type NotificationPayload,
  type AgentStatusChangePayload,
  type AnomalyDetectedPayload,
} from './events'

/**
 * Broadcast a new observer event to the public feed
 */
export async function broadcastObserverEvent(payload: ObserverEventPayload): Promise<void> {
  await triggerEvent(CHANNELS.OBSERVER_FEED, EVENTS.NEW_OBSERVER_EVENT, payload)
}

/**
 * Broadcast an anomaly detection alert
 */
export async function broadcastAnomalyDetected(payload: AnomalyDetectedPayload): Promise<void> {
  await triggerEvent(CHANNELS.OBSERVER_FEED, EVENTS.ANOMALY_DETECTED, payload)
}

/**
 * Broadcast a trust score change to relevant channels
 */
export async function broadcastTrustChange(
  payload: TrustChangePayload,
  ownerId?: string
): Promise<void> {
  // Broadcast to observer feed (public)
  await triggerEvent(CHANNELS.OBSERVER_FEED, EVENTS.TRUST_CHANGE, payload)

  // Also notify the owner
  if (ownerId) {
    await triggerEvent(
      CHANNELS.userChannel(ownerId),
      EVENTS.TRUST_CHANGE,
      payload
    )
  }
}

/**
 * Broadcast a trust tier change
 */
export async function broadcastTrustTierChange(
  payload: TrustTierChangePayload,
  ownerId?: string
): Promise<void> {
  await triggerEvent(CHANNELS.OBSERVER_FEED, EVENTS.TRUST_TIER_CHANGE, payload)

  if (ownerId) {
    await triggerEvent(
      CHANNELS.userChannel(ownerId),
      EVENTS.TRUST_TIER_CHANGE,
      payload
    )
  }
}

/**
 * Broadcast a council decision
 */
export async function broadcastCouncilDecision(
  payload: CouncilDecisionPayload,
  isPending: boolean = false
): Promise<void> {
  const event = isPending ? EVENTS.DECISION_PENDING : EVENTS.DECISION_MADE
  await triggerEvent(CHANNELS.COUNCIL_FEED, event, payload)
}

/**
 * Broadcast an agent status change
 */
export async function broadcastAgentStatusChange(
  payload: AgentStatusChangePayload,
  ownerId?: string
): Promise<void> {
  await triggerEvent(CHANNELS.OBSERVER_FEED, EVENTS.AGENT_STATUS_CHANGE, payload)

  if (ownerId) {
    await triggerEvent(
      CHANNELS.userChannel(ownerId),
      EVENTS.AGENT_STATUS_CHANGE,
      payload
    )
  }
}

/**
 * Send a notification to a specific user
 */
export async function sendUserNotification(
  userId: string,
  notification: Omit<NotificationPayload, 'id' | 'timestamp'>
): Promise<void> {
  const payload: NotificationPayload = {
    ...notification,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }

  await triggerEvent(CHANNELS.userChannel(userId), EVENTS.NOTIFICATION, payload)
}

/**
 * Send a notification about a specific agent to its channel
 */
export async function sendAgentNotification(
  agentId: string,
  notification: Omit<NotificationPayload, 'id' | 'timestamp'>
): Promise<void> {
  const payload: NotificationPayload = {
    ...notification,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }

  await triggerEvent(CHANNELS.agentChannel(agentId), EVENTS.NOTIFICATION, payload)
}
