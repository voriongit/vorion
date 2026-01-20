/**
 * ORION v2 Evidence Schema (ERPL)
 *
 * Defines evidence collection and preservation per ERPL spec.
 * Supports forensic completeness requirements.
 */

import { z } from 'zod';
import {
  UUIDSchema,
  TimestampSchema,
  SemVerSchema,
  HashSchema,
  CorrelationIdSchema,
  SeveritySchema,
} from '../common/primitives.js';

// ============================================================================
// EVIDENCE TYPES
// ============================================================================

export const EvidenceTypeSchema = z.enum([
  'INTENT_SUBMISSION',
  'AUTHORIZATION_DECISION',
  'EXECUTION_START',
  'EXECUTION_STEP',
  'EXECUTION_COMPLETE',
  'TOOL_INVOCATION',
  'TOOL_RESPONSE',
  'TRUST_COMPUTATION',
  'TRUST_DELTA',
  'POLICY_EVALUATION',
  'CONSTRAINT_APPLICATION',
  'ESCALATION_REQUEST',
  'ESCALATION_RESPONSE',
  'VIOLATION_DETECTED',
  'INCIDENT_REPORT',
  'HUMAN_INTERVENTION',
  'SYSTEM_EVENT',
  'AUDIT_CHECKPOINT',
]);

export const EvidenceClassificationSchema = z.enum([
  'ROUTINE',
  'SIGNIFICANT',
  'COMPLIANCE_RELEVANT',
  'SECURITY_RELEVANT',
  'INCIDENT_RELATED',
  'LEGAL_HOLD',
]);

// ============================================================================
// EVIDENCE ITEM
// ============================================================================

export const EvidenceItemSchema = z.object({
  // Identity
  id: UUIDSchema,
  schemaVersion: SemVerSchema.default('2.0.0'),
  correlationId: CorrelationIdSchema,

  // Classification
  type: EvidenceTypeSchema,
  classification: EvidenceClassificationSchema,
  severity: SeveritySchema.optional(),

  // Reference
  sourceSystem: z.string().min(1),
  sourceComponent: z.string().optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: UUIDSchema.optional(),
  parentEvidenceId: UUIDSchema.optional(),

  // Content
  summary: z.string().min(1),
  details: z.record(z.unknown()).optional(),
  rawPayload: z.string().optional(), // Base64 encoded

  // Actor
  actorType: z.enum(['HUMAN', 'AGENT', 'SYSTEM', 'EXTERNAL']),
  actorId: z.string().min(1),
  actorName: z.string().optional(),

  // Trust Context
  trustBandAtTime: z.enum(['T0', 'T1', 'T2', 'T3', 'T4', 'T5']).optional(),
  trustProfileId: UUIDSchema.optional(),

  // Timing
  timestamp: TimestampSchema,
  receivedAt: TimestampSchema.optional(),
  sequenceNumber: z.number().int().nonnegative().optional(),

  // Integrity
  contentHash: HashSchema,
  previousHash: HashSchema.optional(),
  signature: z.string().optional(),
});

// ============================================================================
// EVIDENCE PACK (Grouped evidence for a correlation)
// ============================================================================

export const EvidencePackSchema = z.object({
  // Identity
  id: UUIDSchema,
  schemaVersion: SemVerSchema.default('2.0.0'),
  correlationId: CorrelationIdSchema,

  // Content
  items: z.array(EvidenceItemSchema),
  itemCount: z.number().int().nonnegative(),

  // Summary
  startTime: TimestampSchema,
  endTime: TimestampSchema.optional(),
  outcome: z.enum(['SUCCESS', 'FAILURE', 'ERROR', 'TIMEOUT', 'CANCELLED', 'BLOCKED', 'IN_PROGRESS']),

  // Classification
  highestSeverity: SeveritySchema.optional(),
  classifications: z.array(EvidenceClassificationSchema),
  hasViolations: z.boolean().default(false),
  hasIncidents: z.boolean().default(false),

  // References
  intentId: UUIDSchema.optional(),
  decisionId: UUIDSchema.optional(),
  trustProfileId: UUIDSchema.optional(),

  // Timing
  createdAt: TimestampSchema,
  lastUpdated: TimestampSchema,

  // Integrity
  packHash: HashSchema,
  merkleRoot: HashSchema.optional(),
});

// ============================================================================
// PROOF EVENT (Cryptographic proof generation)
// ============================================================================

export const ProofEventSchema = z.object({
  // Identity
  id: UUIDSchema,
  schemaVersion: SemVerSchema.default('2.0.0'),
  correlationId: CorrelationIdSchema,

  // Type
  proofType: z.enum([
    'DECISION_PROOF',
    'EXECUTION_PROOF',
    'TRUST_COMPUTATION_PROOF',
    'POLICY_EVALUATION_PROOF',
    'COMPLIANCE_ATTESTATION',
    'INCIDENT_PROOF',
    'AUDIT_PROOF',
  ]),

  // References
  evidencePackId: UUIDSchema,
  evidenceItemIds: z.array(UUIDSchema),

  // Proof Content
  claim: z.string().min(1),
  proofData: z.object({
    algorithm: z.string(),
    publicKey: z.string().optional(),
    signature: z.string(),
    timestamp: TimestampSchema,
    nonce: z.string().optional(),
  }),

  // Verification
  verifiable: z.boolean().default(true),
  verificationEndpoint: z.string().url().optional(),

  // Chain
  previousProofId: UUIDSchema.optional(),
  previousProofHash: HashSchema.optional(),
  chainPosition: z.number().int().nonnegative().optional(),

  // Timing
  generatedAt: TimestampSchema,
  expiresAt: TimestampSchema.optional(),

  // Integrity
  proofHash: HashSchema,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;
export type EvidenceClassification = z.infer<typeof EvidenceClassificationSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type EvidencePack = z.infer<typeof EvidencePackSchema>;
export type ProofEvent = z.infer<typeof ProofEventSchema>;
