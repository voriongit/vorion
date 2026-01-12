/**
 * Decision Builder - Construct authorization decisions
 *
 * Provides utilities for creating Decision objects with proper
 * validation and structure.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TrustBand,
  DenialReason,
  type Decision,
  type DecisionConstraints,
  type Intent,
  type TrustProfile,
} from '@vorion/contracts';

/**
 * Options for building a decision
 */
export interface DecisionBuildOptions {
  /** Override decision ID */
  decisionId?: string;
  /** Policy set that was used */
  policySetId?: string;
  /** Decision validity duration in ms (default: 5 minutes) */
  validityDurationMs?: number;
  /** Current time for calculation */
  now?: Date;
}

/**
 * Result of a permit decision
 */
export interface PermitResult {
  type: 'permit';
  reasoning: string[];
  constraints: DecisionConstraints;
}

/**
 * Result of a deny decision
 */
export interface DenyResult {
  type: 'deny';
  reason: DenialReason;
  reasoning: string[];
  remediations?: string[];
}

/**
 * Union type for authorization results
 */
export type AuthorizationResult = PermitResult | DenyResult;

/**
 * Build a permit decision
 */
export function buildPermitDecision(
  intent: Intent,
  profile: TrustProfile,
  constraints: DecisionConstraints,
  reasoning: string[],
  options: DecisionBuildOptions = {}
): Decision {
  const now = options.now ?? new Date();
  const validityDurationMs = options.validityDurationMs ?? 5 * 60 * 1000; // 5 minutes

  return {
    decisionId: options.decisionId ?? uuidv4(),
    intentId: intent.intentId,
    agentId: intent.agentId,
    correlationId: intent.correlationId,
    permitted: true,
    constraints,
    trustBand: profile.band,
    trustScore: profile.adjustedScore,
    policySetId: options.policySetId,
    reasoning,
    decidedAt: now,
    expiresAt: new Date(now.getTime() + validityDurationMs),
    latencyMs: 0, // Will be set by engine
    version: 1,
  };
}

/**
 * Build a deny decision
 */
export function buildDenyDecision(
  intent: Intent,
  profile: TrustProfile | null,
  _reason: DenialReason, // Reserved for future denialReason field in Decision
  reasoning: string[],
  options: DecisionBuildOptions = {}
): Decision {
  const now = options.now ?? new Date();
  const validityDurationMs = options.validityDurationMs ?? 5 * 60 * 1000;

  return {
    decisionId: options.decisionId ?? uuidv4(),
    intentId: intent.intentId,
    agentId: intent.agentId,
    correlationId: intent.correlationId,
    permitted: false,
    constraints: undefined,
    trustBand: profile?.band ?? TrustBand.T0_UNTRUSTED,
    trustScore: profile?.adjustedScore ?? 0,
    policySetId: options.policySetId,
    reasoning,
    decidedAt: now,
    expiresAt: new Date(now.getTime() + validityDurationMs),
    latencyMs: 0, // Will be set by engine
    version: 1,
  };
}

/**
 * Get remediation suggestions for a denial reason
 */
export function getRemediations(reason: DenialReason, _context?: Record<string, unknown>): string[] {
  switch (reason) {
    case DenialReason.INSUFFICIENT_TRUST:
      return [
        'Increase trust score through positive behavioral evidence',
        'Request human supervision for this action',
        'Use a higher observation tier (e.g., WHITE_BOX) if available',
      ];
    case DenialReason.POLICY_VIOLATION:
      return [
        'Review the policy requirements for this action type',
        'Request policy exception through governance channel',
      ];
    case DenialReason.RESOURCE_RESTRICTED:
      return [
        'Request access to the required resources',
        'Use alternative resources that are permitted',
      ];
    case DenialReason.DATA_SENSITIVITY_EXCEEDED:
      return [
        'Reduce data sensitivity requirements',
        'Request elevated data access permissions',
        'Use anonymized or redacted data instead',
      ];
    case DenialReason.RATE_LIMIT_EXCEEDED:
      return [
        'Wait for the rate limit window to reset',
        'Reduce request frequency',
        'Request higher rate limits through governance',
      ];
    case DenialReason.CONTEXT_MISMATCH:
      return [
        'Verify the execution context is appropriate',
        'Switch to the correct environment',
        'Update intent context to match actual conditions',
      ];
    case DenialReason.EXPIRED_INTENT:
      return [
        'Create a new intent with updated expiration',
        'Submit intents more promptly',
      ];
    case DenialReason.SYSTEM_ERROR:
      return [
        'Retry the request',
        'Contact system administrators if the issue persists',
      ];
    default:
      return ['Contact support for assistance'];
  }
}

/**
 * Determine the denial reason based on evaluation context
 */
export function determineDenialReason(
  profile: TrustProfile | null,
  _intent: Intent, // Reserved for future intent-specific denial logic
  minRequiredBand: TrustBand,
  checks: {
    intentExpired?: boolean;
    rateLimitExceeded?: boolean;
    resourceRestricted?: boolean;
    policyViolation?: boolean;
    contextMismatch?: boolean;
  }
): DenialReason {
  if (checks.intentExpired) {
    return DenialReason.EXPIRED_INTENT;
  }
  if (checks.rateLimitExceeded) {
    return DenialReason.RATE_LIMIT_EXCEEDED;
  }
  if (checks.resourceRestricted) {
    return DenialReason.RESOURCE_RESTRICTED;
  }
  if (checks.contextMismatch) {
    return DenialReason.CONTEXT_MISMATCH;
  }
  if (checks.policyViolation) {
    return DenialReason.POLICY_VIOLATION;
  }
  if (!profile || profile.band < minRequiredBand) {
    return DenialReason.INSUFFICIENT_TRUST;
  }
  return DenialReason.POLICY_VIOLATION;
}

/**
 * Create decision summary for logging
 */
export function summarizeDecision(decision: Decision): string {
  const action = decision.permitted ? 'PERMITTED' : 'DENIED';
  const band = TrustBand[decision.trustBand];
  return `[${decision.decisionId}] ${action} for agent ${decision.agentId} (${band}, score=${decision.trustScore}) - ${decision.reasoning[0] ?? 'No reason'}`;
}

/**
 * Check if a decision is still valid
 */
export function isDecisionValid(decision: Decision, now: Date = new Date()): boolean {
  return now < decision.expiresAt;
}

/**
 * Decision builder class for fluent API
 */
export class DecisionBuilder {
  private intent: Intent;
  private profile: TrustProfile | null = null;
  private permitted: boolean = false;
  private constraints: DecisionConstraints | undefined;
  private reasoning: string[] = [];
  private denialReason: DenialReason | undefined;
  private options: DecisionBuildOptions = {};

  constructor(intent: Intent) {
    this.intent = intent;
  }

  withProfile(profile: TrustProfile): this {
    this.profile = profile;
    return this;
  }

  permit(): this {
    this.permitted = true;
    return this;
  }

  deny(reason: DenialReason): this {
    this.permitted = false;
    this.denialReason = reason;
    return this;
  }

  withConstraints(constraints: DecisionConstraints): this {
    this.constraints = constraints;
    return this;
  }

  addReasoning(...reasons: string[]): this {
    this.reasoning.push(...reasons);
    return this;
  }

  withOptions(options: DecisionBuildOptions): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  build(): Decision {
    if (this.permitted && this.profile && this.constraints) {
      return buildPermitDecision(
        this.intent,
        this.profile,
        this.constraints,
        this.reasoning,
        this.options
      );
    } else {
      return buildDenyDecision(
        this.intent,
        this.profile,
        this.denialReason ?? DenialReason.POLICY_VIOLATION,
        this.reasoning,
        this.options
      );
    }
  }

  /**
   * Static factory for creating builders
   */
  static for(intent: Intent): DecisionBuilder {
    return new DecisionBuilder(intent);
  }
}
