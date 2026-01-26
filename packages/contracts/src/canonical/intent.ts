/**
 * @fileoverview Canonical Intent type definitions for the Vorion Platform.
 *
 * This file provides the authoritative definition for intents - requests from
 * agents to perform actions. It combines and reconciles the various Intent
 * definitions found across the codebase into a single canonical source.
 *
 * An Intent represents what an agent wants to do, including the action,
 * resources involved, classification metadata, and trust context.
 *
 * @module @orion/contracts/canonical/intent
 */

import { z } from 'zod';
import type { TrustBand } from './trust-band.js';
import { trustBandSchema } from './trust-band.js';
import { trustScoreValueSchema, type TrustScore } from './trust-score.js';
export type { TrustScore };

// Re-export enums from v2 to avoid duplication
export { ActionType, DataSensitivity, Reversibility } from '../v2/enums.js';
import { ActionType, DataSensitivity, Reversibility } from '../v2/enums.js';

/**
 * Intent lifecycle status.
 *
 * Tracks the intent through its complete lifecycle from submission
 * to completion or termination.
 *
 * @type {string}
 */
export type IntentStatus =
  /** Intent received, awaiting evaluation */
  | 'pending'
  /** Intent is being evaluated by trust/policy systems */
  | 'evaluating'
  /** Intent approved, awaiting execution */
  | 'approved'
  /** Intent denied by policy or trust requirements */
  | 'denied'
  /** Intent escalated for human review */
  | 'escalated'
  /** Intent is currently being executed */
  | 'executing'
  /** Intent execution completed successfully */
  | 'completed'
  /** Intent execution failed */
  | 'failed'
  /** Intent was cancelled before completion */
  | 'cancelled';

/**
 * All possible intent status values as an array.
 */
export const INTENT_STATUS_VALUES: readonly IntentStatus[] = [
  'pending',
  'evaluating',
  'approved',
  'denied',
  'escalated',
  'executing',
  'completed',
  'failed',
  'cancelled',
] as const;

/**
 * Terminal intent statuses (intent lifecycle has ended).
 */
export const TERMINAL_INTENT_STATUSES: readonly IntentStatus[] = [
  'denied',
  'completed',
  'failed',
  'cancelled',
] as const;

/**
 * Active intent statuses (intent is still in progress).
 */
export const ACTIVE_INTENT_STATUSES: readonly IntentStatus[] = [
  'pending',
  'evaluating',
  'approved',
  'escalated',
  'executing',
] as const;

// ============================================================================
// Context Interfaces
// ============================================================================

/**
 * Context information for intent evaluation.
 *
 * Provides additional context that policies and trust calculations
 * can use when evaluating whether to approve an intent.
 */
export interface IntentContext {
  /**
   * Domain of operation (e.g., 'healthcare', 'finance', 'hr').
   * Used for domain-specific policy application.
   */
  domain?: string;

  /**
   * Deployment environment.
   * Different policies may apply per environment.
   */
  environment?: 'production' | 'staging' | 'development' | 'test' | string;

  /**
   * User or entity on whose behalf the agent is acting.
   * Important for delegation and audit trails.
   */
  onBehalfOf?: string;

  /**
   * Session or conversation identifier.
   * Groups related intents together.
   */
  sessionId?: string;

  /**
   * Parent intent ID for chained operations.
   * Enables multi-step operation tracking.
   */
  parentIntentId?: string;

  /**
   * Priority level (0 = lowest, 10 = highest).
   * May affect queue ordering and resource allocation.
   */
  priority?: number;

  /**
   * Whether this intent handles Personally Identifiable Information.
   * Triggers additional privacy controls.
   */
  handlesPii?: boolean;

  /**
   * Whether this intent handles Protected Health Information.
   * Triggers HIPAA-related controls.
   */
  handlesPhi?: boolean;

  /**
   * Jurisdictions involved (e.g., 'EU', 'US-CA', 'APAC').
   * Affects applicable compliance rules.
   */
  jurisdictions?: string[];

  /**
   * Tags for categorization and filtering.
   */
  tags?: string[];

  /**
   * Custom metadata for domain-specific context.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Trust state snapshot at intent submission time.
 *
 * Captures the agent's trust profile when the intent was created,
 * providing context for decisions and audit.
 */
export interface TrustSnapshot {
  /** Trust score at submission (0-1000 scale) */
  score: TrustScore;

  /** Trust band at submission */
  band: TrustBand;

  /** Timestamp when snapshot was taken */
  capturedAt: Date;

  /** Profile version for optimistic concurrency */
  profileVersion?: number;
}

// ============================================================================
// Intent Interface
// ============================================================================

/**
 * Canonical Intent interface.
 *
 * Represents a complete intent record with all fields from across
 * the platform's various Intent definitions unified into a single
 * authoritative structure.
 *
 * @example
 * ```typescript
 * const intent: Intent = {
 *   intentId: 'int_abc123',
 *   tenantId: 'ten_xyz789',
 *   agentId: 'agt_def456',
 *   correlationId: 'corr_ghi012',
 *   action: 'Send quarterly report to stakeholders',
 *   actionType: ActionType.COMMUNICATE,
 *   resourceScope: ['reports:quarterly', 'email:external'],
 *   dataSensitivity: DataSensitivity.CONFIDENTIAL,
 *   reversibility: Reversibility.IRREVERSIBLE,
 *   context: {
 *     domain: 'finance',
 *     environment: 'production',
 *     handlesPii: true,
 *   },
 *   trustSnapshot: {
 *     score: createTrustScore(750),
 *     band: TrustBand.T4_TRUSTED,
 *     capturedAt: new Date(),
 *   },
 *   status: 'pending',
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export interface Intent {
  // ─────────────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Unique intent identifier (UUID format).
   * Primary key for the intent.
   */
  intentId: string;

  /**
   * Tenant/organization identifier.
   * Enables multi-tenant isolation.
   */
  tenantId: string;

  /**
   * Agent making the request.
   * References the agent's unique identifier.
   */
  agentId: string;

  /**
   * Correlation ID for end-to-end distributed tracing.
   * Links related events across services.
   */
  correlationId: string;

  // ─────────────────────────────────────────────────────────────────────────
  // Action Details
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Human-readable description of the intended action.
   * Should be clear and specific about what the agent wants to do.
   */
  action: string;

  /**
   * Category of action being performed.
   * Used for policy matching and risk assessment.
   */
  actionType: ActionType;

  /**
   * Resources this intent will access or modify.
   * Format: 'resource_type:resource_id' or URN patterns.
   *
   * @example ['database:users', 'api:payments/*', 'file:reports/q4.pdf']
   */
  resourceScope: string[];

  // ─────────────────────────────────────────────────────────────────────────
  // Classification
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Data sensitivity level involved in this action.
   * Determines required trust level and audit depth.
   */
  dataSensitivity: DataSensitivity;

  /**
   * Whether this action can be undone.
   * Affects approval requirements and safeguards.
   */
  reversibility: Reversibility;

  // ─────────────────────────────────────────────────────────────────────────
  // Context
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Additional context for policy evaluation.
   * Contains domain, environment, and other contextual information.
   */
  context: IntentContext;

  // ─────────────────────────────────────────────────────────────────────────
  // Trust State
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Trust profile snapshot at submission time.
   * Captures the agent's trust state when the intent was created.
   */
  trustSnapshot: TrustSnapshot;

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Current status in the intent lifecycle.
   */
  status: IntentStatus;

  /**
   * When the intent was created.
   */
  createdAt: Date;

  /**
   * When the intent was last updated.
   */
  updatedAt: Date;

  /**
   * When the intent expires (optional).
   * After this time, the intent should be auto-denied.
   */
  expiresAt?: Date;

  /**
   * Soft delete timestamp for GDPR compliance.
   * If set, the intent is considered deleted but retained for audit.
   */
  deletedAt?: Date;

  // ─────────────────────────────────────────────────────────────────────────
  // Termination Details (set when status is terminal)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Reason for cancellation (if status is 'cancelled').
   */
  cancellationReason?: string;

  /**
   * Reason for denial (if status is 'denied').
   */
  denialReason?: string;

  /**
   * Reason for failure (if status is 'failed').
   */
  failureReason?: string;

  // ─────────────────────────────────────────────────────────────────────────
  // Tracing
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Source system that generated this intent.
   * Useful for debugging and analytics.
   */
  source?: string;

  /**
   * Decision ID if a decision has been made.
   * Links to the authorization decision record.
   */
  decisionId?: string;

  /**
   * Execution ID if execution has started.
   * Links to the execution record.
   */
  executionId?: string;
}

/**
 * Summary view of an intent for listings and dashboards.
 */
export interface IntentSummary {
  intentId: string;
  tenantId: string;
  agentId: string;
  correlationId: string;
  action: string;
  actionType: ActionType;
  dataSensitivity: DataSensitivity;
  status: IntentStatus;
  trustBand: TrustBand;
  createdAt: Date;
}

/**
 * Request to create a new intent.
 *
 * Contains the minimum required fields plus optional overrides.
 */
export interface CreateIntentRequest {
  /** Agent making the request */
  agentId: string;

  /** Action description */
  action: string;

  /** Action category */
  actionType: ActionType;

  /** Resources to access/modify */
  resourceScope: string[];

  /** Data sensitivity level */
  dataSensitivity: DataSensitivity;

  /** Reversibility classification */
  reversibility: Reversibility;

  /** Optional correlation ID (generated if not provided) */
  correlationId?: string;

  /** Optional context */
  context?: Partial<IntentContext>;

  /** Optional expiration in milliseconds from creation */
  expiresInMs?: number;

  /** Optional source identifier */
  source?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid IntentStatus.
 *
 * @param value - Value to check
 * @returns True if value is a valid IntentStatus
 */
export function isIntentStatus(value: unknown): value is IntentStatus {
  return typeof value === 'string' && INTENT_STATUS_VALUES.includes(value as IntentStatus);
}

/**
 * Type guard to check if an IntentStatus is terminal.
 *
 * @param status - Status to check
 * @returns True if status is a terminal state
 */
export function isTerminalStatus(status: IntentStatus): boolean {
  return TERMINAL_INTENT_STATUSES.includes(status);
}

/**
 * Type guard to check if an IntentStatus is active.
 *
 * @param status - Status to check
 * @returns True if status is an active state
 */
export function isActiveStatus(status: IntentStatus): boolean {
  return ACTIVE_INTENT_STATUSES.includes(status);
}

// Note: isActionType, isDataSensitivity, and isReversibility type guards
// are exported from canonical/validation.ts to avoid duplication

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Zod schema for ActionType enum.
 */
export const actionTypeSchema = z.nativeEnum(ActionType, {
  errorMap: () => ({ message: 'Invalid action type' }),
});

/**
 * Zod schema for DataSensitivity enum.
 */
export const dataSensitivitySchema = z.nativeEnum(DataSensitivity, {
  errorMap: () => ({ message: 'Invalid data sensitivity level' }),
});

/**
 * Zod schema for Reversibility enum.
 */
export const reversibilitySchema = z.nativeEnum(Reversibility, {
  errorMap: () => ({ message: 'Invalid reversibility value' }),
});

/**
 * Zod schema for IntentStatus.
 */
export const intentStatusSchema = z.enum([
  'pending',
  'evaluating',
  'approved',
  'denied',
  'escalated',
  'executing',
  'completed',
  'failed',
  'cancelled',
], {
  errorMap: () => ({ message: 'Invalid intent status' }),
});

/**
 * Zod schema for IntentContext.
 */
export const intentContextSchema = z.object({
  domain: z.string().optional(),
  environment: z.string().optional(),
  onBehalfOf: z.string().optional(),
  sessionId: z.string().optional(),
  parentIntentId: z.string().uuid().optional(),
  priority: z.number().int().min(0).max(10).optional(),
  handlesPii: z.boolean().optional(),
  handlesPhi: z.boolean().optional(),
  jurisdictions: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

/**
 * Zod schema for TrustSnapshot.
 */
export const trustSnapshotSchema = z.object({
  score: trustScoreValueSchema,
  band: trustBandSchema,
  capturedAt: z.coerce.date(),
  profileVersion: z.number().int().positive().optional(),
});

/**
 * Zod schema for Intent validation.
 */
export const intentSchema = z.object({
  intentId: z.string().uuid(),
  tenantId: z.string().min(1),
  agentId: z.string().min(1),
  correlationId: z.string().uuid(),
  action: z.string().min(1).max(1000),
  actionType: actionTypeSchema,
  resourceScope: z.array(z.string().min(1)).min(1),
  dataSensitivity: dataSensitivitySchema,
  reversibility: reversibilitySchema,
  context: intentContextSchema,
  trustSnapshot: trustSnapshotSchema,
  status: intentStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  expiresAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional(),
  cancellationReason: z.string().optional(),
  denialReason: z.string().optional(),
  failureReason: z.string().optional(),
  source: z.string().optional(),
  decisionId: z.string().uuid().optional(),
  executionId: z.string().uuid().optional(),
});

/**
 * Zod schema for IntentSummary.
 */
export const intentSummarySchema = z.object({
  intentId: z.string().uuid(),
  tenantId: z.string().min(1),
  agentId: z.string().min(1),
  correlationId: z.string().uuid(),
  action: z.string(),
  actionType: actionTypeSchema,
  dataSensitivity: dataSensitivitySchema,
  status: intentStatusSchema,
  trustBand: trustBandSchema,
  createdAt: z.coerce.date(),
});

/**
 * Zod schema for CreateIntentRequest validation.
 */
export const createIntentRequestSchema = z.object({
  agentId: z.string().min(1),
  action: z.string().min(1).max(1000),
  actionType: actionTypeSchema,
  resourceScope: z.array(z.string().min(1)).min(1),
  dataSensitivity: dataSensitivitySchema,
  reversibility: reversibilitySchema,
  correlationId: z.string().uuid().optional(),
  context: intentContextSchema.partial().optional(),
  expiresInMs: z.number().int().positive().optional(),
  source: z.string().optional(),
});

// ============================================================================
// Type Inference
// ============================================================================

/**
 * Inferred Intent type from Zod schema.
 */
export type IntentInput = z.input<typeof intentSchema>;

/**
 * Inferred IntentContext type from Zod schema.
 */
export type IntentContextInput = z.input<typeof intentContextSchema>;

/**
 * Inferred CreateIntentRequest type from Zod schema.
 */
export type CreateIntentRequestInput = z.input<typeof createIntentRequestSchema>;
