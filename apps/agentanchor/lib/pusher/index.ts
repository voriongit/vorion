/**
 * Pusher Module Index
 *
 * Central export for all Pusher-related functionality.
 */

// Server-side exports (use in API routes only)
export {
  getPusherServer,
  isPusherConfigured,
  triggerEvent,
  triggerBatch,
} from './server'

// Event definitions
export {
  CHANNELS,
  EVENTS,
  type ObserverEventPayload,
  type AnomalyDetectedPayload,
  type TrustChangePayload,
  type TrustTierChangePayload,
  type CouncilDecisionPayload,
  type EscalationPayload,
  type AgentStatusChangePayload,
  type NotificationPayload,
  type SystemAlertPayload,
  type EventPayloadMap,
} from './events'

// Broadcast helpers (server-side)
export {
  broadcastObserverEvent,
  broadcastAnomalyDetected,
  broadcastTrustChange,
  broadcastTrustTierChange,
  broadcastCouncilDecision,
  broadcastAgentStatusChange,
  sendUserNotification,
  sendAgentNotification,
} from './broadcast'

// Note: Client exports are in ./client.ts and should be imported directly
// to enable tree-shaking and avoid including server code in client bundles
