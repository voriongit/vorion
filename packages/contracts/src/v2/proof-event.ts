/**
 * Proof Event types - immutable audit trail entries
 */

import type { ProofEventType } from './enums.js';

/**
 * Proof event - an immutable record in the audit trail
 *
 * Events form a hash chain for tamper detection.
 * Once created, events cannot be modified or deleted.
 */
export interface ProofEvent {
  /** Unique event identifier */
  eventId: string;

  /** Type of event */
  eventType: ProofEventType;

  /** Correlation ID for end-to-end tracing */
  correlationId: string;

  /** Agent involved (if applicable) */
  agentId?: string;

  /** Event payload (type varies by eventType) */
  payload: ProofEventPayload;

  /** Hash of the previous event in chain */
  previousHash: string | null;

  /** SHA-256 hash of this event */
  eventHash: string;

  /** When the event occurred */
  occurredAt: Date;

  /** When the event was recorded (may differ from occurred) */
  recordedAt: Date;

  /** Who/what signed this event */
  signedBy?: string;

  /** Digital signature */
  signature?: string;
}

/**
 * Union type for event payloads based on event type
 */
export type ProofEventPayload =
  | IntentReceivedPayload
  | DecisionMadePayload
  | TrustDeltaPayload
  | ExecutionStartedPayload
  | ExecutionCompletedPayload
  | ExecutionFailedPayload
  | IncidentDetectedPayload
  | RollbackInitiatedPayload
  | ComponentRegisteredPayload
  | ComponentUpdatedPayload
  | GenericPayload;

/** Intent received payload */
export interface IntentReceivedPayload {
  type: 'intent_received';
  intentId: string;
  action: string;
  actionType: string;
  resourceScope: string[];
}

/** Decision made payload */
export interface DecisionMadePayload {
  type: 'decision_made';
  decisionId: string;
  intentId: string;
  permitted: boolean;
  trustBand: string;
  trustScore: number;
  reasoning: string[];
}

/** Trust delta payload */
export interface TrustDeltaPayload {
  type: 'trust_delta';
  deltaId: string;
  previousScore: number;
  newScore: number;
  previousBand: string;
  newBand: string;
  reason: string;
}

/** Execution started payload */
export interface ExecutionStartedPayload {
  type: 'execution_started';
  executionId: string;
  actionId: string;
  decisionId: string;
  adapterId: string;
}

/** Execution completed payload */
export interface ExecutionCompletedPayload {
  type: 'execution_completed';
  executionId: string;
  actionId: string;
  status: 'success' | 'partial';
  durationMs: number;
  outputHash: string;
}

/** Execution failed payload */
export interface ExecutionFailedPayload {
  type: 'execution_failed';
  executionId: string;
  actionId: string;
  error: string;
  durationMs: number;
  retryable: boolean;
}

/** Incident detected payload */
export interface IncidentDetectedPayload {
  type: 'incident_detected';
  incidentId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedResources: string[];
}

/** Rollback initiated payload */
export interface RollbackInitiatedPayload {
  type: 'rollback_initiated';
  rollbackId: string;
  executionId: string;
  reason: string;
  initiatedBy: string;
}

/** Component registered payload */
export interface ComponentRegisteredPayload {
  type: 'component_registered';
  componentId: string;
  componentType: string;
  name: string;
  version: string;
}

/** Component updated payload */
export interface ComponentUpdatedPayload {
  type: 'component_updated';
  componentId: string;
  changes: string[];
  previousVersion?: string;
  newVersion?: string;
}

/** Generic payload for extensibility */
export interface GenericPayload {
  type: string;
  [key: string]: unknown;
}

/**
 * Filter for querying proof events
 */
export interface ProofEventFilter {
  correlationId?: string;
  agentId?: string;
  eventTypes?: ProofEventType[];
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Result of chain verification
 */
export interface ChainVerificationResult {
  valid: boolean;
  verifiedEvents: number;
  firstEventId: string;
  lastEventId: string;
  brokenAt?: string; // Event ID where chain broke
  error?: string;
}

/**
 * Request to log a new proof event
 */
export interface LogProofEventRequest {
  eventType: ProofEventType;
  correlationId: string;
  agentId?: string;
  payload: ProofEventPayload;
  occurredAt?: Date;
  signedBy?: string;
}

/**
 * Proof event summary for listings
 */
export interface ProofEventSummary {
  eventId: string;
  eventType: ProofEventType;
  correlationId: string;
  agentId?: string;
  occurredAt: Date;
  recordedAt: Date;
}
