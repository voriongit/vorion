/**
 * ORION v2 Retention Schema (ERPL)
 *
 * Defines retention policies and legal holds per ERPL spec.
 * WORM compliance, legal holds, cryptographic sealing.
 */

import { z } from 'zod';
import {
  UUIDSchema,
  TimestampSchema,
  SemVerSchema,
  HashSchema,
} from '../common/primitives.js';
import { EvidenceClassificationSchema } from './evidence.js';

// ============================================================================
// RETENTION POLICY
// ============================================================================

export const RetentionPolicySchema = z.object({
  // Identity
  id: UUIDSchema,
  schemaVersion: SemVerSchema.default('2.0.0'),
  version: SemVerSchema,

  // Metadata
  name: z.string().min(1),
  description: z.string().optional(),

  // Applicability
  appliesToClassifications: z.array(EvidenceClassificationSchema),
  appliesToSources: z.array(z.string()).optional(),
  appliesToJurisdictions: z.array(z.string()).optional(),

  // Retention Rules
  defaultRetentionDays: z.number().int().positive(),
  maxRetentionDays: z.number().int().positive().optional(),
  minRetentionDays: z.number().int().positive().optional(),

  // WORM Configuration
  wormEnabled: z.boolean().default(true),
  immutablePeriodDays: z.number().int().nonnegative().optional(),

  // Deletion Rules
  deletionMethod: z.enum(['SOFT_DELETE', 'HARD_DELETE', 'CRYPTO_SHRED']),
  deletionApprovalRequired: z.boolean().default(true),
  deletionApproverRoles: z.array(z.string()).optional(),

  // Legal Hold Override
  legalHoldOverridesRetention: z.boolean().default(true),

  // Lifecycle
  status: z.enum(['DRAFT', 'ACTIVE', 'DEPRECATED']),
  effectiveFrom: TimestampSchema,
  effectiveUntil: TimestampSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  approvedBy: z.string().optional(),
  approvedAt: TimestampSchema.optional(),
});

// ============================================================================
// LEGAL HOLD
// ============================================================================

export const LegalHoldSchema = z.object({
  // Identity
  id: UUIDSchema,
  schemaVersion: SemVerSchema.default('2.0.0'),

  // Metadata
  name: z.string().min(1),
  description: z.string().optional(),
  matterReference: z.string().optional(), // Legal case reference

  // Scope
  scope: z.object({
    correlationIds: z.array(z.string()).optional(),
    evidencePackIds: z.array(UUIDSchema).optional(),
    actorIds: z.array(z.string()).optional(),
    dateRangeStart: TimestampSchema.optional(),
    dateRangeEnd: TimestampSchema.optional(),
    classifications: z.array(EvidenceClassificationSchema).optional(),
    customQuery: z.string().optional(),
  }),

  // Hold Configuration
  preserveAllVersions: z.boolean().default(true),
  preventModification: z.boolean().default(true),
  preventDeletion: z.boolean().default(true),

  // Notification
  notifyCustodians: z.boolean().default(true),
  custodianEmails: z.array(z.string().email()).optional(),

  // Lifecycle
  status: z.enum(['PENDING', 'ACTIVE', 'RELEASED', 'EXPIRED']),
  createdAt: TimestampSchema,
  createdBy: z.string().min(1),
  activatedAt: TimestampSchema.optional(),
  releasedAt: TimestampSchema.optional(),
  releasedBy: z.string().optional(),
  releaseReason: z.string().optional(),
  expiresAt: TimestampSchema.optional(),

  // Audit
  holdHash: HashSchema.optional(),
});

// ============================================================================
// SEAL EVENT (Cryptographic sealing)
// ============================================================================

export const SealEventSchema = z.object({
  // Identity
  id: UUIDSchema,
  schemaVersion: SemVerSchema.default('2.0.0'),

  // Seal Type
  sealType: z.enum([
    'EVIDENCE_SEAL',
    'PACK_SEAL',
    'PERIOD_SEAL',
    'COMPLIANCE_SEAL',
    'AUDIT_SEAL',
    'INCIDENT_SEAL',
  ]),

  // References
  sealedEntityType: z.string().min(1),
  sealedEntityIds: z.array(UUIDSchema),
  evidencePackId: UUIDSchema.optional(),

  // Seal Content
  sealedContentHash: HashSchema,
  merkleRoot: HashSchema.optional(),
  itemCount: z.number().int().nonnegative(),
  periodStart: TimestampSchema.optional(),
  periodEnd: TimestampSchema.optional(),

  // Cryptographic Proof
  algorithm: z.enum(['SHA256', 'SHA384', 'SHA512', 'BLAKE3']),
  signature: z.string(),
  publicKeyId: z.string(),
  timestampAuthority: z.string().optional(),
  timestampToken: z.string().optional(),

  // Chain
  previousSealId: UUIDSchema.optional(),
  previousSealHash: HashSchema.optional(),
  chainPosition: z.number().int().nonnegative().optional(),

  // Verification
  verificationUrl: z.string().url().optional(),
  verificationInstructions: z.string().optional(),

  // Timing
  sealedAt: TimestampSchema,
  sealedBy: z.string().min(1),

  // Integrity
  sealHash: HashSchema,
});

// ============================================================================
// RETENTION SCHEDULE (Applied retention)
// ============================================================================

export const RetentionScheduleSchema = z.object({
  // Identity
  id: UUIDSchema,
  schemaVersion: SemVerSchema.default('2.0.0'),

  // Reference
  evidencePackId: UUIDSchema,
  retentionPolicyId: UUIDSchema,
  legalHoldIds: z.array(UUIDSchema).optional(),

  // Schedule
  retainUntil: TimestampSchema,
  originalRetainUntil: TimestampSchema,
  extensionReason: z.string().optional(),
  extendedBy: z.string().optional(),
  extendedAt: TimestampSchema.optional(),

  // Status
  status: z.enum(['ACTIVE', 'EXTENDED', 'UNDER_HOLD', 'PENDING_DELETION', 'DELETED']),
  underLegalHold: z.boolean().default(false),

  // Deletion Tracking
  markedForDeletionAt: TimestampSchema.optional(),
  deletionApprovedBy: z.string().optional(),
  deletionApprovedAt: TimestampSchema.optional(),
  deletedAt: TimestampSchema.optional(),
  deletionCertificate: HashSchema.optional(),

  // Timing
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;
export type LegalHold = z.infer<typeof LegalHoldSchema>;
export type SealEvent = z.infer<typeof SealEventSchema>;
export type RetentionSchedule = z.infer<typeof RetentionScheduleSchema>;
