/**
 * @fileoverview Canonical TrustSignal type definitions for the Vorion Platform.
 *
 * This file provides the authoritative definition for trust signals - events
 * or observations that affect an agent's trust score. It resolves the field
 * optionality conflicts found across packages into a single consistent structure.
 *
 * Trust signals are the atomic inputs to the trust calculation system. They
 * capture behavioral observations, compliance events, credential verifications,
 * and other factors that influence trust.
 *
 * @module @orion/contracts/canonical/trust-signal
 */

import { z } from 'zod';
import type { TrustScore } from './trust-score.js';
import { trustScoreSchema } from './trust-score.js';

// ============================================================================
// Enums and Constants
// ============================================================================

/**
 * Types of trust signals that can be recorded.
 *
 * Each type represents a different category of trust-relevant information.
 *
 * @enum {string}
 */
export enum SignalType {
  /** Agent successfully completed an action */
  ACTION_SUCCESS = 'action_success',
  /** Agent failed to complete an action */
  ACTION_FAILURE = 'action_failure',
  /** Agent complied with a policy requirement */
  COMPLIANCE_MET = 'compliance_met',
  /** Agent violated a policy requirement */
  COMPLIANCE_VIOLATION = 'compliance_violation',
  /** Agent's credential was verified */
  CREDENTIAL_VERIFIED = 'credential_verified',
  /** Agent's credential expired or was revoked */
  CREDENTIAL_EXPIRED = 'credential_expired',
  /** Agent exhibited anomalous behavior */
  ANOMALY_DETECTED = 'anomaly_detected',
  /** Manual trust adjustment by administrator */
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  /** Trust decay due to inactivity */
  DECAY = 'decay',
  /** Initial trust assignment for new agent */
  INITIAL_TRUST = 'initial_trust',
  /** Trust transfer from another system */
  TRUST_TRANSFER = 'trust_transfer',
  /** Agent passed a canary probe test */
  CANARY_PASSED = 'canary_passed',
  /** Agent failed a canary probe test */
  CANARY_FAILED = 'canary_failed',
  /** Third-party attestation received */
  ATTESTATION = 'attestation',
  /** Peer review or endorsement */
  PEER_ENDORSEMENT = 'peer_endorsement',
  /** Outcome reversal (provisional success became failure) */
  OUTCOME_REVERSAL = 'outcome_reversal',
}

/**
 * Signal polarity - whether the signal is positive or negative for trust.
 */
export type SignalPolarity = 'positive' | 'negative' | 'neutral';

/**
 * Mapping of signal types to their default polarity.
 */
export const SIGNAL_TYPE_POLARITY: Readonly<Record<SignalType, SignalPolarity>> = {
  [SignalType.ACTION_SUCCESS]: 'positive',
  [SignalType.ACTION_FAILURE]: 'negative',
  [SignalType.COMPLIANCE_MET]: 'positive',
  [SignalType.COMPLIANCE_VIOLATION]: 'negative',
  [SignalType.CREDENTIAL_VERIFIED]: 'positive',
  [SignalType.CREDENTIAL_EXPIRED]: 'negative',
  [SignalType.ANOMALY_DETECTED]: 'negative',
  [SignalType.MANUAL_ADJUSTMENT]: 'neutral',
  [SignalType.DECAY]: 'negative',
  [SignalType.INITIAL_TRUST]: 'neutral',
  [SignalType.TRUST_TRANSFER]: 'neutral',
  [SignalType.CANARY_PASSED]: 'positive',
  [SignalType.CANARY_FAILED]: 'negative',
  [SignalType.ATTESTATION]: 'positive',
  [SignalType.PEER_ENDORSEMENT]: 'positive',
  [SignalType.OUTCOME_REVERSAL]: 'negative',
} as const;

/**
 * Sources from which trust signals can originate.
 *
 * Defines the system or mechanism that generated the signal.
 */
export type SignalSource =
  /** A3I authorization system */
  | 'a3i'
  /** ERA execution system */
  | 'era'
  /** Agent Trust Scoring Framework */
  | 'atsf'
  /** Canary probe system */
  | 'canary'
  /** Human administrator */
  | 'admin'
  /** External attestation service */
  | 'external'
  /** Automated compliance checker */
  | 'compliance'
  /** Anomaly detection system */
  | 'anomaly'
  /** Peer agent */
  | 'peer'
  /** System scheduler (for decay) */
  | 'scheduler'
  /** Unknown or unspecified source */
  | 'unknown';

/**
 * All valid signal sources as an array.
 */
export const SIGNAL_SOURCES: readonly SignalSource[] = [
  'a3i',
  'era',
  'atsf',
  'canary',
  'admin',
  'external',
  'compliance',
  'anomaly',
  'peer',
  'scheduler',
  'unknown',
] as const;

/**
 * Trust dimensions that signals can affect.
 *
 * Maps to the 5-dimension trust model from ATSF.
 */
export type TrustDimension =
  /** Capability Trust - Does the agent have the skills? */
  | 'capability'
  /** Behavioral Trust - Has the agent acted reliably? */
  | 'behavioral'
  /** Governance Trust - Is the agent properly governed? */
  | 'governance'
  /** Contextual Trust - Is this the right context? */
  | 'contextual'
  /** Assurance Confidence - How confident are we? */
  | 'assurance';

/**
 * All trust dimensions as an array.
 */
export const TRUST_DIMENSIONS: readonly TrustDimension[] = [
  'capability',
  'behavioral',
  'governance',
  'contextual',
  'assurance',
] as const;

// ============================================================================
// Signal Impact Configuration
// ============================================================================

/**
 * Configuration for how a signal impacts trust scores.
 */
export interface SignalImpact {
  /**
   * Base impact value.
   * Positive values increase trust, negative decrease.
   * Range: -1000 to +1000 (relative to trust score scale)
   */
  baseImpact: number;

  /**
   * Which trust dimensions this signal affects.
   * If not specified, affects all dimensions equally.
   */
  dimensions?: TrustDimension[];

  /**
   * Optional multiplier based on magnitude.
   * Applied as: finalImpact = baseImpact * magnitudeMultiplier
   */
  magnitudeMultiplier?: number;

  /**
   * Confidence in this signal's accuracy (0-1).
   * Lower confidence may reduce the effective impact.
   */
  confidence?: number;
}

// ============================================================================
// TrustSignal Interface
// ============================================================================

/**
 * Canonical TrustSignal interface.
 *
 * Represents a trust-relevant event or observation about an agent.
 * All fields that could be either required or optional across packages
 * are standardized as optional with explicit undefined handling.
 *
 * @example
 * ```typescript
 * const signal: TrustSignal = {
 *   signalId: 'sig_abc123',
 *   agentId: 'agt_xyz789',
 *   tenantId: 'ten_def456',
 *   type: SignalType.ACTION_SUCCESS,
 *   source: 'era',
 *   timestamp: new Date(),
 *   impact: {
 *     baseImpact: 5,
 *     dimensions: ['behavioral', 'capability'],
 *     confidence: 0.95,
 *   },
 *   description: 'Successfully completed file upload task',
 * };
 * ```
 */
export interface TrustSignal {
  // ─────────────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Unique signal identifier.
   */
  signalId: string;

  /**
   * Agent this signal is about.
   */
  agentId: string;

  /**
   * Tenant/organization identifier.
   */
  tenantId: string;

  // ─────────────────────────────────────────────────────────────────────────
  // Signal Classification
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Type of signal.
   */
  type: SignalType;

  /**
   * Source system that generated this signal.
   */
  source: SignalSource;

  /**
   * When this signal was recorded.
   */
  timestamp: Date;

  // ─────────────────────────────────────────────────────────────────────────
  // Impact Configuration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * How this signal affects trust scores.
   */
  impact: SignalImpact;

  // ─────────────────────────────────────────────────────────────────────────
  // Context (all optional with explicit handling)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Human-readable description of the signal.
   */
  description?: string;

  /**
   * Weight/importance of this signal (0-1).
   * Affects how much influence this signal has relative to others.
   * Default: 1.0 (full weight)
   */
  weight?: number;

  /**
   * Related intent ID (if signal resulted from intent processing).
   */
  intentId?: string;

  /**
   * Related action/execution ID.
   */
  actionId?: string;

  /**
   * Correlation ID for distributed tracing.
   */
  correlationId?: string;

  /**
   * When this signal expires and should no longer affect calculations.
   */
  expiresAt?: Date;

  /**
   * Additional contextual metadata.
   * Use for domain-specific data that doesn't fit standard fields.
   */
  metadata?: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────────────────
  // Processing State
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Whether this signal has been processed into a trust delta.
   */
  processed?: boolean;

  /**
   * When this signal was processed.
   */
  processedAt?: Date;

  /**
   * ID of the trust delta created from this signal.
   */
  deltaId?: string;
}

/**
 * Summary view of a trust signal for listings.
 */
export interface TrustSignalSummary {
  signalId: string;
  agentId: string;
  type: SignalType;
  source: SignalSource;
  timestamp: Date;
  impactValue: number;
  description?: string;
}

/**
 * Request to create a new trust signal.
 */
export interface CreateTrustSignalRequest {
  agentId: string;
  type: SignalType;
  source: SignalSource;
  impact: SignalImpact;
  description?: string;
  weight?: number;
  intentId?: string;
  actionId?: string;
  correlationId?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated trust signals for a time period.
 */
export interface SignalAggregation {
  /** Agent ID */
  agentId: string;
  /** Aggregation period start */
  periodStart: Date;
  /** Aggregation period end */
  periodEnd: Date;
  /** Total number of signals */
  signalCount: number;
  /** Count by signal type */
  byType: Partial<Record<SignalType, number>>;
  /** Count by source */
  bySource: Partial<Record<SignalSource, number>>;
  /** Net impact (sum of all impacts) */
  netImpact: number;
  /** Positive impact total */
  positiveImpact: number;
  /** Negative impact total */
  negativeImpact: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Gets the default polarity for a signal type.
 *
 * @param type - Signal type
 * @returns Polarity of the signal type
 */
export function getSignalPolarity(type: SignalType): SignalPolarity {
  return SIGNAL_TYPE_POLARITY[type];
}

/**
 * Checks if a signal type is positive for trust.
 *
 * @param type - Signal type
 * @returns True if the signal type is positive
 */
export function isPositiveSignal(type: SignalType): boolean {
  return SIGNAL_TYPE_POLARITY[type] === 'positive';
}

/**
 * Checks if a signal type is negative for trust.
 *
 * @param type - Signal type
 * @returns True if the signal type is negative
 */
export function isNegativeSignal(type: SignalType): boolean {
  return SIGNAL_TYPE_POLARITY[type] === 'negative';
}

/**
 * Calculates the effective impact of a signal.
 *
 * Applies weight, confidence, and magnitude multiplier to base impact.
 *
 * @param signal - Trust signal
 * @returns Calculated effective impact value
 */
export function calculateEffectiveImpact(signal: TrustSignal): number {
  const { impact, weight = 1.0 } = signal;
  const { baseImpact, magnitudeMultiplier = 1.0, confidence = 1.0 } = impact;

  return baseImpact * weight * magnitudeMultiplier * confidence;
}

/**
 * Checks if a signal has expired.
 *
 * @param signal - Trust signal to check
 * @param now - Current time (defaults to now)
 * @returns True if signal has expired
 */
export function isSignalExpired(signal: TrustSignal, now: Date = new Date()): boolean {
  if (!signal.expiresAt) return false;
  return signal.expiresAt < now;
}

/**
 * Filters expired signals from an array.
 *
 * @param signals - Array of signals to filter
 * @param now - Current time (defaults to now)
 * @returns Array of non-expired signals
 */
export function filterExpiredSignals(signals: TrustSignal[], now: Date = new Date()): TrustSignal[] {
  return signals.filter((s) => !isSignalExpired(s, now));
}

/**
 * Aggregates signals for a time period.
 *
 * @param signals - Array of signals to aggregate
 * @param agentId - Agent ID
 * @param periodStart - Period start time
 * @param periodEnd - Period end time
 * @returns Aggregated signal statistics
 */
export function aggregateSignals(
  signals: TrustSignal[],
  agentId: string,
  periodStart: Date,
  periodEnd: Date
): SignalAggregation {
  const periodSignals = signals.filter(
    (s) =>
      s.agentId === agentId &&
      s.timestamp >= periodStart &&
      s.timestamp <= periodEnd
  );

  const byType: Partial<Record<SignalType, number>> = {};
  const bySource: Partial<Record<SignalSource, number>> = {};
  let netImpact = 0;
  let positiveImpact = 0;
  let negativeImpact = 0;

  for (const signal of periodSignals) {
    byType[signal.type] = (byType[signal.type] || 0) + 1;
    bySource[signal.source] = (bySource[signal.source] || 0) + 1;

    const impact = calculateEffectiveImpact(signal);
    netImpact += impact;
    if (impact > 0) positiveImpact += impact;
    if (impact < 0) negativeImpact += impact;
  }

  return {
    agentId,
    periodStart,
    periodEnd,
    signalCount: periodSignals.length,
    byType,
    bySource,
    netImpact,
    positiveImpact,
    negativeImpact,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid SignalType.
 *
 * @param value - Value to check
 * @returns True if value is a valid SignalType
 */
export function isSignalType(value: unknown): value is SignalType {
  return Object.values(SignalType).includes(value as SignalType);
}

/**
 * Type guard to check if a value is a valid SignalSource.
 *
 * @param value - Value to check
 * @returns True if value is a valid SignalSource
 */
export function isSignalSource(value: unknown): value is SignalSource {
  return SIGNAL_SOURCES.includes(value as SignalSource);
}

/**
 * Type guard to check if a value is a valid TrustDimension.
 *
 * @param value - Value to check
 * @returns True if value is a valid TrustDimension
 */
export function isTrustDimension(value: unknown): value is TrustDimension {
  return TRUST_DIMENSIONS.includes(value as TrustDimension);
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Zod schema for SignalType enum.
 */
export const signalTypeSchema = z.nativeEnum(SignalType, {
  errorMap: () => ({ message: 'Invalid signal type' }),
});

/**
 * Zod schema for SignalSource.
 */
export const signalSourceSchema = z.enum([
  'a3i',
  'era',
  'atsf',
  'canary',
  'admin',
  'external',
  'compliance',
  'anomaly',
  'peer',
  'scheduler',
  'unknown',
], {
  errorMap: () => ({ message: 'Invalid signal source' }),
});

/**
 * Zod schema for TrustDimension.
 */
export const trustDimensionSchema = z.enum([
  'capability',
  'behavioral',
  'governance',
  'contextual',
  'assurance',
], {
  errorMap: () => ({ message: 'Invalid trust dimension' }),
});

/**
 * Zod schema for SignalImpact.
 */
export const signalImpactSchema = z.object({
  baseImpact: z.number().min(-1000).max(1000),
  dimensions: z.array(trustDimensionSchema).optional(),
  magnitudeMultiplier: z.number().positive().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Zod schema for TrustSignal.
 */
export const trustSignalSchema = z.object({
  signalId: z.string().uuid(),
  agentId: z.string().min(1),
  tenantId: z.string().min(1),
  type: signalTypeSchema,
  source: signalSourceSchema,
  timestamp: z.coerce.date(),
  impact: signalImpactSchema,
  description: z.string().optional(),
  weight: z.number().min(0).max(1).optional(),
  intentId: z.string().uuid().optional(),
  actionId: z.string().uuid().optional(),
  correlationId: z.string().uuid().optional(),
  expiresAt: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
  processed: z.boolean().optional(),
  processedAt: z.coerce.date().optional(),
  deltaId: z.string().uuid().optional(),
});

/**
 * Zod schema for TrustSignalSummary.
 */
export const trustSignalSummarySchema = z.object({
  signalId: z.string().uuid(),
  agentId: z.string().min(1),
  type: signalTypeSchema,
  source: signalSourceSchema,
  timestamp: z.coerce.date(),
  impactValue: z.number(),
  description: z.string().optional(),
});

/**
 * Zod schema for CreateTrustSignalRequest.
 */
export const createTrustSignalRequestSchema = z.object({
  agentId: z.string().min(1),
  type: signalTypeSchema,
  source: signalSourceSchema,
  impact: signalImpactSchema,
  description: z.string().optional(),
  weight: z.number().min(0).max(1).optional(),
  intentId: z.string().uuid().optional(),
  actionId: z.string().uuid().optional(),
  correlationId: z.string().uuid().optional(),
  expiresAt: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for SignalAggregation.
 */
export const signalAggregationSchema = z.object({
  agentId: z.string().min(1),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  signalCount: z.number().int().min(0),
  byType: z.record(signalTypeSchema, z.number().int().min(0)),
  bySource: z.record(signalSourceSchema, z.number().int().min(0)),
  netImpact: z.number(),
  positiveImpact: z.number().min(0),
  negativeImpact: z.number().max(0),
});

// ============================================================================
// Type Inference
// ============================================================================

/**
 * Inferred TrustSignal type from Zod schema.
 */
export type TrustSignalInput = z.input<typeof trustSignalSchema>;

/**
 * Inferred CreateTrustSignalRequest type from Zod schema.
 */
export type CreateTrustSignalRequestInput = z.input<typeof createTrustSignalRequestSchema>;
