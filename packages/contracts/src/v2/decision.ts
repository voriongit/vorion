/**
 * Decision types - the result of authorizing an intent
 */

import type { ApprovalType, TrustBand } from './enums.js';

/**
 * Rate limit constraint
 */
export interface RateLimit {
  /** What is being limited (requests, tokens, etc.) */
  resource: string;
  /** Maximum allowed */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

/**
 * Approval requirement for permitted actions
 */
export interface ApprovalRequirement {
  /** Type of approval needed */
  type: ApprovalType;
  /** Who needs to approve (role, user, system) */
  approver: string;
  /** Time limit to get approval (ms) */
  timeoutMs?: number;
  /** Reason this approval is required */
  reason: string;
}

/**
 * Constraints applied to permitted actions
 */
export interface DecisionConstraints {
  /** Required approvals before execution */
  requiredApprovals: ApprovalRequirement[];

  /** Tools/capabilities the agent can use */
  allowedTools: string[];

  /** Data scopes the agent can access */
  dataScopes: string[];

  /** Rate limits to enforce */
  rateLimits: RateLimit[];

  /** Must action be reversible? */
  reversibilityRequired: boolean;

  /** Maximum execution time in ms */
  maxExecutionTimeMs?: number;

  /** Maximum retry attempts */
  maxRetries?: number;

  /** Resource quotas */
  resourceQuotas?: Record<string, number>;
}

/**
 * Decision - the authorization result for an intent
 */
export interface Decision {
  /** Unique decision identifier */
  decisionId: string;

  /** Intent this decision is for */
  intentId: string;

  /** Agent who made the request */
  agentId: string;

  /** Correlation ID for tracing */
  correlationId: string;

  /** The verdict: can the agent proceed? */
  permitted: boolean;

  /** If permitted, what constraints apply */
  constraints?: DecisionConstraints;

  /** Agent's trust band at decision time */
  trustBand: TrustBand;

  /** Agent's trust score at decision time */
  trustScore: number;

  /** Policy set used for this decision */
  policySetId?: string;

  /** Human-readable reasoning for the decision */
  reasoning: string[];

  /** When decision was made */
  decidedAt: Date;

  /** Decision is only valid until this time */
  expiresAt: Date;

  /** Time taken to make decision (ms) */
  latencyMs: number;

  /** Version for audit */
  version: number;
}

/**
 * Summary view of a decision
 */
export interface DecisionSummary {
  decisionId: string;
  intentId: string;
  agentId: string;
  correlationId: string;
  permitted: boolean;
  trustBand: TrustBand;
  decidedAt: Date;
}

/**
 * Request to authorize an intent
 * (Intent itself is the request body)
 */
export interface AuthorizationRequest {
  /** The intent to authorize */
  intent: {
    agentId: string;
    action: string;
    actionType: string;
    resourceScope: string[];
    dataSensitivity: string;
    reversibility: string;
    context?: Record<string, unknown>;
  };

  /** Optional: Override default policy set */
  policySetId?: string;

  /** Optional: Request specific constraints */
  requestedConstraints?: Partial<DecisionConstraints>;
}

/**
 * Response from authorization
 */
export interface AuthorizationResponse {
  decision: Decision;

  /** If denied, what would need to change to permit */
  remediations?: string[];
}

/**
 * Denial reasons enum for structured denials
 */
export enum DenialReason {
  INSUFFICIENT_TRUST = 'insufficient_trust',
  POLICY_VIOLATION = 'policy_violation',
  RESOURCE_RESTRICTED = 'resource_restricted',
  DATA_SENSITIVITY_EXCEEDED = 'data_sensitivity_exceeded',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CONTEXT_MISMATCH = 'context_mismatch',
  EXPIRED_INTENT = 'expired_intent',
  SYSTEM_ERROR = 'system_error',
}
