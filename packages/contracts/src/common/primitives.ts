/**
 * ORION Common Primitives
 *
 * Foundational types used across all contract versions.
 */

import { z } from 'zod';

// ============================================================================
// IDENTIFIERS
// ============================================================================

export const UUIDSchema = z.string().uuid();
export const SemVerSchema = z.string().regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
export const TimestampSchema = z.string().datetime();
export const HashSchema = z.string().regex(/^[a-f0-9]{64}$/i);
export const CorrelationIdSchema = z.string().min(1).max(128);

// ============================================================================
// ACTORS
// ============================================================================

export const ActorTypeSchema = z.enum(['HUMAN', 'AGENT', 'SYSTEM', 'EXTERNAL']);

export const ActorSchema = z.object({
  type: ActorTypeSchema,
  id: z.string().min(1),
  name: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// TRUST BANDS (ORION ATP)
// ============================================================================

export const TrustBandSchema = z.enum(['T0', 'T1', 'T2', 'T3', 'T4', 'T5']);

export const TrustBandDescriptions = {
  T0: 'Deny execution',
  T1: 'HITL mandatory; no irreversible actions',
  T2: 'Constrained autonomy; reversible only; strict allowlists',
  T3: 'Supervised autonomy; rollback required',
  T4: 'Broad autonomy; continuous monitoring',
  T5: 'Mission-critical; strongest proof; strict GT/AC requirements',
} as const;

// ============================================================================
// AUTONOMY
// ============================================================================

export const AutonomyLevelSchema = z.enum([
  'NONE',        // T0: No execution
  'HITL',        // T1: Human-in-the-loop mandatory
  'CONSTRAINED', // T2: Limited actions
  'SUPERVISED',  // T3: Monitored execution
  'BROAD',       // T4: Expanded capabilities
  'FULL',        // T5: Full autonomy with proof
]);

// ============================================================================
// DECISIONS
// ============================================================================

export const DecisionOutcomeSchema = z.enum([
  'PERMIT',
  'DENY',
  'ESCALATE',
  'PENDING',
]);

export const ExecutionOutcomeSchema = z.enum([
  'SUCCESS',
  'FAILURE',
  'ERROR',
  'TIMEOUT',
  'CANCELLED',
  'BLOCKED',
]);

// ============================================================================
// SEVERITY & RISK
// ============================================================================

export const SeveritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
export const RiskLevelSchema = z.enum(['EXTREME', 'HIGH', 'MEDIUM', 'LOW', 'NEGLIGIBLE']);

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
export type TrustBand = z.infer<typeof TrustBandSchema>;
export type AutonomyLevel = z.infer<typeof AutonomyLevelSchema>;
export type DecisionOutcome = z.infer<typeof DecisionOutcomeSchema>;
export type ExecutionOutcome = z.infer<typeof ExecutionOutcomeSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
