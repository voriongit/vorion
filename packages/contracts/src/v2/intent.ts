/**
 * Intent types - represents what an agent wants to do
 */

import type { ActionType, DataSensitivity, Reversibility } from './enums.js';

/**
 * Intent - a request from an agent to perform an action
 *
 * Intents are immutable once created. They flow through A3I
 * for authorization before being executed by ERA.
 */
export interface Intent {
  /** Unique intent identifier (UUID) */
  intentId: string;

  /** Agent making the request */
  agentId: string;

  /** Correlation ID for end-to-end tracing */
  correlationId: string;

  /** Human-readable description of the action */
  action: string;

  /** Category of action being performed */
  actionType: ActionType;

  /** Resources this intent will access or modify */
  resourceScope: string[];

  /** Classification of data sensitivity involved */
  dataSensitivity: DataSensitivity;

  /** Can this action be undone? */
  reversibility: Reversibility;

  /** Additional context for policy evaluation */
  context: IntentContext;

  /** When the intent was created */
  createdAt: Date;

  /** Optional: Intent expires after this time */
  expiresAt?: Date;

  /** Optional: Source system that generated this intent */
  source?: string;
}

/**
 * Context information for intent evaluation
 */
export interface IntentContext {
  /** Domain of operation (healthcare, finance, etc.) */
  domain?: string;

  /** Environment (production, staging, development) */
  environment?: string;

  /** User on whose behalf agent is acting */
  onBehalfOf?: string;

  /** Session or conversation identifier */
  sessionId?: string;

  /** Previous intent in chain (for multi-step operations) */
  parentIntentId?: string;

  /** Priority level (0=lowest, 10=highest) */
  priority?: number;

  /** Whether this involves PII */
  handlesPii?: boolean;

  /** Whether this involves PHI (health information) */
  handlesPhi?: boolean;

  /** Jurisdiction(s) involved (EU, US-CA, etc.) */
  jurisdictions?: string[];

  /** Any additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Summary view of an intent for listings
 */
export interface IntentSummary {
  intentId: string;
  agentId: string;
  correlationId: string;
  action: string;
  actionType: ActionType;
  dataSensitivity: DataSensitivity;
  createdAt: Date;
}

/**
 * Request to create a new intent
 */
export interface CreateIntentRequest {
  agentId: string;
  correlationId?: string;
  action: string;
  actionType: ActionType;
  resourceScope: string[];
  dataSensitivity: DataSensitivity;
  reversibility: Reversibility;
  context?: Partial<IntentContext>;
  expiresIn?: number; // milliseconds
  source?: string;
}
