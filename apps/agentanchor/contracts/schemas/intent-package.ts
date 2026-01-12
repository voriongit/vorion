/**
 * Intent Package Schema
 *
 * Defines the structure of intent received from AURYN or other strategic planners.
 * This is the PRIMARY INPUT to Agent Anchor.
 *
 * Per spec Section III.1:
 * - Treated as UNTRUSTED by default
 * - Must pass schema validation
 * - Agent Anchor does NOT modify intent goals
 */

import { z } from 'zod';
import {
  UUIDSchema,
  TimestampSchema,
  ActorSchema,
  RiskLevelSchema,
  SemVerSchema,
  CorrelationIdSchema,
} from './common.js';

// ============================================================================
// INTENT TYPES
// ============================================================================

/** Classification of intent type */
export const IntentTypeSchema = z.enum([
  'EXECUTE',       // Execute an action
  'QUERY',         // Read/retrieve information
  'MODIFY',        // Modify existing resource
  'CREATE',        // Create new resource
  'DELETE',        // Remove resource
  'TRANSFER',      // Move/transfer resource
  'APPROVE',       // Approval workflow
  'ESCALATE',      // Escalation request
]);

/** Intent status in lifecycle */
export const IntentStatusSchema = z.enum([
  'DRAFT',         // Being composed
  'SUBMITTED',     // Submitted for authorization
  'VALIDATING',    // Schema/policy validation in progress
  'AUTHORIZED',    // Approved for execution
  'EXECUTING',     // Currently executing
  'COMPLETED',     // Successfully completed
  'FAILED',        // Execution failed
  'REJECTED',      // Authorization denied
  'CANCELLED',     // Cancelled by user/system
  'EXPIRED',       // TTL exceeded
]);

// ============================================================================
// INTENT TARGET
// ============================================================================

/** What the intent is targeting */
export const IntentTargetSchema = z.object({
  /** Target type (e.g., 'TOOL', 'AGENT', 'RESOURCE', 'API') */
  type: z.string().min(1),
  /** Target identifier */
  id: z.string().min(1),
  /** Target name (human-readable) */
  name: z.string().optional(),
  /** Target version (if applicable) */
  version: z.string().optional(),
  /** Target-specific metadata */
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// INTENT PARAMETERS
// ============================================================================

/** Parameters for the intent execution */
export const IntentParametersSchema = z.object({
  /** Named parameters */
  params: z.record(z.unknown()).optional(),
  /** Input data/payload */
  input: z.unknown().optional(),
  /** Expected output schema (JSON Schema) */
  expectedOutputSchema: z.record(z.unknown()).optional(),
  /** Execution hints (non-binding) */
  hints: z.record(z.unknown()).optional(),
});

// ============================================================================
// INTENT CONSTRAINTS (from originator)
// ============================================================================

/** Constraints specified by the intent originator */
export const IntentConstraintsSchema = z.object({
  /** Maximum execution time (ms) */
  maxDurationMs: z.number().int().positive().optional(),
  /** Maximum retries on failure */
  maxRetries: z.number().int().nonnegative().optional(),
  /** Maximum cost/budget for this intent */
  maxBudget: z.number().nonnegative().optional(),
  /** Budget unit (e.g., 'USD', 'tokens', 'credits') */
  budgetUnit: z.string().optional(),
  /** Required autonomy level (minimum) */
  requiredAutonomyLevel: z.number().int().min(0).max(4).optional(),
  /** Require human approval */
  requireHumanApproval: z.boolean().optional(),
  /** Allow tool X, deny tool Y */
  toolAllowlist: z.array(z.string()).optional(),
  toolDenylist: z.array(z.string()).optional(),
  /** Reversibility requirement */
  mustBeReversible: z.boolean().optional(),
  /** Idempotency requirement */
  mustBeIdempotent: z.boolean().optional(),
});

// ============================================================================
// INTENT CONTEXT
// ============================================================================

/** Contextual information for the intent */
export const IntentContextSchema = z.object({
  /** Correlation ID for tracing */
  correlationId: CorrelationIdSchema,
  /** Parent intent ID (for nested/chained intents) */
  parentIntentId: UUIDSchema.optional(),
  /** Session ID */
  sessionId: z.string().optional(),
  /** Conversation/thread ID */
  conversationId: z.string().optional(),
  /** Jurisdiction (e.g., 'US', 'EU', 'GLOBAL') */
  jurisdiction: z.string().optional(),
  /** Organization ID */
  organizationId: z.string().optional(),
  /** Environment (e.g., 'production', 'staging', 'development') */
  environment: z.string().optional(),
  /** Additional context metadata */
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// INTENT PACKAGE (Main Schema)
// ============================================================================

/**
 * IntentPackage is the canonical input to Agent Anchor.
 * It represents structured intent from AURYN or other planners.
 */
export const IntentPackageSchema = z.object({
  // ─── Identity ───────────────────────────────────────────────────────────────
  /** Unique identifier for this intent */
  id: UUIDSchema,
  /** Schema version */
  schemaVersion: SemVerSchema.default('1.0.0'),

  // ─── Classification ─────────────────────────────────────────────────────────
  /** Type of intent */
  type: IntentTypeSchema,
  /** Current status */
  status: IntentStatusSchema.default('SUBMITTED'),
  /** Priority (1-10, higher = more urgent) */
  priority: z.number().int().min(1).max(10).default(5),
  /** Assessed risk level */
  riskLevel: RiskLevelSchema.optional(),

  // ─── Origin ─────────────────────────────────────────────────────────────────
  /** Who/what originated this intent */
  originator: ActorSchema,
  /** Source system (e.g., 'AURYN', 'API', 'CLI') */
  sourceSystem: z.string().min(1),
  /** When this intent was created */
  createdAt: TimestampSchema,
  /** When this intent expires (TTL) */
  expiresAt: TimestampSchema.optional(),

  // ─── Intent Details ─────────────────────────────────────────────────────────
  /** Human-readable description of intent */
  description: z.string().min(1).max(2000),
  /** What this intent is targeting */
  target: IntentTargetSchema,
  /** Parameters for execution */
  parameters: IntentParametersSchema.optional(),
  /** Constraints from originator */
  constraints: IntentConstraintsSchema.optional(),

  // ─── Context ────────────────────────────────────────────────────────────────
  /** Execution context */
  context: IntentContextSchema,

  // ─── Validation ─────────────────────────────────────────────────────────────
  /** Hash of intent content (for integrity) */
  contentHash: z.string().optional(),
  /** Signature from originator (if signed) */
  signature: z.string().optional(),
  /** Signature algorithm used */
  signatureAlgorithm: z.string().optional(),

  // ─── Policy Attachment (added by Agent Anchor) ──────────────────────────────
  /** Policy IDs that apply to this intent (attached during validation) */
  applicablePolicyIds: z.array(UUIDSchema).optional(),
});

// ============================================================================
// INTENT VALIDATION RESULT
// ============================================================================

/** Result of intent validation */
export const IntentValidationResultSchema = z.object({
  /** Intent ID */
  intentId: UUIDSchema,
  /** Is the intent valid? */
  isValid: z.boolean(),
  /** Validation errors (if any) */
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    path: z.string().optional(),
    severity: z.enum(['ERROR', 'WARNING']),
  })).optional(),
  /** Policies that apply to this intent */
  applicablePolicies: z.array(z.object({
    policyId: UUIDSchema,
    policyName: z.string(),
    policyVersion: SemVerSchema,
  })).optional(),
  /** Validation timestamp */
  validatedAt: TimestampSchema,
  /** Validator identity */
  validatedBy: z.string(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type IntentType = z.infer<typeof IntentTypeSchema>;
export type IntentStatus = z.infer<typeof IntentStatusSchema>;
export type IntentTarget = z.infer<typeof IntentTargetSchema>;
export type IntentParameters = z.infer<typeof IntentParametersSchema>;
export type IntentConstraints = z.infer<typeof IntentConstraintsSchema>;
export type IntentContext = z.infer<typeof IntentContextSchema>;
export type IntentPackage = z.infer<typeof IntentPackageSchema>;
export type IntentValidationResult = z.infer<typeof IntentValidationResultSchema>;
