/**
 * Common Types & Primitives
 *
 * Foundational types used across all Agent Anchor contracts.
 * These are the atomic building blocks of the trust validation system.
 */

import { z } from 'zod';

// ============================================================================
// IDENTIFIERS
// ============================================================================

/** UUID v4 format */
export const UUIDSchema = z.string().uuid();

/** Semantic version (e.g., "1.0.0") */
export const SemVerSchema = z.string().regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/);

/** ISO 8601 timestamp */
export const TimestampSchema = z.string().datetime();

/** SHA-256 hash (64 hex chars) */
export const HashSchema = z.string().regex(/^[a-f0-9]{64}$/i);

/** Correlation ID for tracing across systems */
export const CorrelationIdSchema = z.string().min(1).max(128);

// ============================================================================
// ACTOR TYPES
// ============================================================================

/** Who or what is performing an action */
export const ActorTypeSchema = z.enum([
  'HUMAN',           // Human user
  'AGENT',           // AI agent
  'SYSTEM',          // System/automated process
  'EXTERNAL',        // External system/API
]);

export const ActorSchema = z.object({
  type: ActorTypeSchema,
  id: z.string().min(1),
  name: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// AUTONOMY LEVELS (per spec Section IV.4)
// ============================================================================

/**
 * Autonomy levels control execution freedom.
 * Higher levels = more autonomous execution.
 */
export const AutonomyLevelSchema = z.enum([
  'LEVEL_0',  // No execution (analysis only)
  'LEVEL_1',  // Human-in-the-loop required for every action
  'LEVEL_2',  // Limited autonomous execution (pre-approved actions only)
  'LEVEL_3',  // Scoped autonomous execution (within defined boundaries)
  'LEVEL_4',  // Full autonomous execution (rare, high-trust scenarios)
]);

export const AutonomyLevelNumeric = {
  LEVEL_0: 0,
  LEVEL_1: 1,
  LEVEL_2: 2,
  LEVEL_3: 3,
  LEVEL_4: 4,
} as const;

// ============================================================================
// DECISION OUTCOMES
// ============================================================================

/** Authorization decision outcome */
export const DecisionOutcomeSchema = z.enum([
  'APPROVED',    // Action is permitted
  'MODIFIED',    // Action permitted with constraints
  'REJECTED',    // Action is denied
  'ESCALATED',   // Requires human review
  'PENDING',     // Awaiting additional input
]);

/** Execution outcome */
export const ExecutionOutcomeSchema = z.enum([
  'SUCCESS',     // Completed successfully
  'FAILURE',     // Failed (recoverable)
  'ERROR',       // Error (may need intervention)
  'TIMEOUT',     // Timed out
  'CANCELLED',   // Cancelled by user/system
  'BLOCKED',     // Blocked by policy
]);

// ============================================================================
// SEVERITY & RISK
// ============================================================================

export const SeveritySchema = z.enum([
  'CRITICAL',    // Immediate action required
  'HIGH',        // Urgent attention needed
  'MEDIUM',      // Should be addressed soon
  'LOW',         // Minor concern
  'INFO',        // Informational only
]);

export const RiskLevelSchema = z.enum([
  'EXTREME',     // Potentially catastrophic
  'HIGH',        // Significant negative impact
  'MEDIUM',      // Moderate impact
  'LOW',         // Minimal impact
  'NEGLIGIBLE',  // No meaningful impact
]);

// ============================================================================
// SCOPE & BOUNDARIES
// ============================================================================

/** Defines boundaries for execution */
export const ScopeSchema = z.object({
  /** Allowed resource types */
  allowedResources: z.array(z.string()).optional(),
  /** Denied resource types */
  deniedResources: z.array(z.string()).optional(),
  /** Allowed actions/operations */
  allowedActions: z.array(z.string()).optional(),
  /** Denied actions/operations */
  deniedActions: z.array(z.string()).optional(),
  /** Maximum execution time (ms) */
  maxDurationMs: z.number().int().positive().optional(),
  /** Maximum cost/budget */
  maxBudget: z.number().nonnegative().optional(),
  /** Budget currency/unit */
  budgetUnit: z.string().optional(),
  /** Rate limit (requests per window) */
  rateLimit: z.object({
    requests: z.number().int().positive(),
    windowMs: z.number().int().positive(),
  }).optional(),
});

// ============================================================================
// PROVENANCE & VERSIONING
// ============================================================================

/** Tracks origin and lineage of data */
export const ProvenanceSchema = z.object({
  /** Original source system */
  source: z.string(),
  /** When this was created */
  createdAt: TimestampSchema,
  /** Who/what created this */
  createdBy: ActorSchema,
  /** Schema version used */
  schemaVersion: SemVerSchema,
  /** Parent record ID (for lineage) */
  parentId: UUIDSchema.optional(),
  /** Chain of custody IDs */
  lineage: z.array(UUIDSchema).optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UUID = z.infer<typeof UUIDSchema>;
export type SemVer = z.infer<typeof SemVerSchema>;
export type Timestamp = z.infer<typeof TimestampSchema>;
export type Hash = z.infer<typeof HashSchema>;
export type CorrelationId = z.infer<typeof CorrelationIdSchema>;
export type ActorType = z.infer<typeof ActorTypeSchema>;
export type Actor = z.infer<typeof ActorSchema>;
export type AutonomyLevel = z.infer<typeof AutonomyLevelSchema>;
export type DecisionOutcome = z.infer<typeof DecisionOutcomeSchema>;
export type ExecutionOutcome = z.infer<typeof ExecutionOutcomeSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type Scope = z.infer<typeof ScopeSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
