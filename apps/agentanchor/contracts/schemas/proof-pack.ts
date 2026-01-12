/**
 * Proof Pack Schema
 *
 * Defines cryptographically verifiable audit bundles.
 * Per spec Section IV.6 (Durable Audit & Proof Plane):
 *
 * Requirements:
 * - Append-only audit storage
 * - Hash-chained integrity
 * - Tamper-evident design
 * - Immutable timestamps
 * - Correlation IDs across lifecycle
 *
 * Proof Packs:
 * - Exportable bundles
 * - Cryptographically verifiable
 * - Redacted where required
 * - Suitable for audits and regulators
 */

import { z } from 'zod';
import {
  UUIDSchema,
  TimestampSchema,
  SemVerSchema,
  HashSchema,
  ActorSchema,
  CorrelationIdSchema,
} from './common.js';
import { IntentPackageSchema } from './intent-package.js';
import { PolicySetSchema } from './policy-set.js';
import { AuthorizationDecisionSchema } from './authorization-decision.js';
import { ExecutionTraceSchema } from './execution-event.js';

// ============================================================================
// AUDIT RECORD
// ============================================================================

/** Type of audit record */
export const AuditRecordTypeSchema = z.enum([
  'INTENT_RECEIVED',
  'INTENT_VALIDATED',
  'POLICY_EVALUATED',
  'AUTHORIZATION_DECIDED',
  'EXECUTION_STARTED',
  'EXECUTION_EVENT',
  'EXECUTION_COMPLETED',
  'VIOLATION_DETECTED',
  'ESCALATION_CREATED',
  'HUMAN_APPROVAL',
  'TRUST_SIGNAL_EMITTED',
  'PROOF_PACK_GENERATED',
]);

/** Single audit record in the chain */
export const AuditRecordSchema = z.object({
  /** Record identifier */
  id: UUIDSchema,
  /** Sequence number in chain */
  sequenceNumber: z.number().int().nonnegative(),
  /** Record type */
  type: AuditRecordTypeSchema,
  /** Correlation ID */
  correlationId: CorrelationIdSchema,
  /** Record timestamp (immutable) */
  timestamp: TimestampSchema,
  /** Actor who triggered this record */
  actor: ActorSchema,
  /** Record content (may be redacted) */
  content: z.record(z.unknown()),
  /** Content hash (before redaction) */
  contentHash: HashSchema,
  /** Previous record hash */
  previousHash: HashSchema,
  /** This record's hash */
  recordHash: HashSchema,
  /** Was content redacted? */
  isRedacted: z.boolean().default(false),
  /** Redacted fields */
  redactedFields: z.array(z.string()).optional(),
});

// ============================================================================
// MERKLE PROOF
// ============================================================================

/** Merkle tree node for verification */
export const MerkleNodeSchema = z.object({
  /** Node hash */
  hash: HashSchema,
  /** Position in tree */
  position: z.enum(['LEFT', 'RIGHT']),
});

/** Merkle proof for a specific record */
export const MerkleProofSchema = z.object({
  /** Record ID being proven */
  recordId: UUIDSchema,
  /** Record hash */
  recordHash: HashSchema,
  /** Path to root */
  path: z.array(MerkleNodeSchema),
  /** Merkle root */
  root: HashSchema,
  /** Tree height */
  treeHeight: z.number().int().positive(),
});

// ============================================================================
// CHAIN VERIFICATION
// ============================================================================

/** Result of chain verification */
export const ChainVerificationResultSchema = z.object({
  /** Is the chain valid? */
  isValid: z.boolean(),
  /** First valid sequence number */
  firstSequence: z.number().int().nonnegative(),
  /** Last valid sequence number */
  lastSequence: z.number().int().nonnegative(),
  /** Total records verified */
  recordCount: z.number().int().nonnegative(),
  /** Broken links found */
  brokenLinks: z.array(z.object({
    sequenceNumber: z.number().int(),
    expectedHash: HashSchema,
    actualHash: HashSchema,
  })).optional(),
  /** Verification timestamp */
  verifiedAt: TimestampSchema,
  /** Verifier identity */
  verifiedBy: z.string(),
});

// ============================================================================
// PROOF PACK (Main Schema)
// ============================================================================

/** Redaction policy for the proof pack */
export const RedactionPolicySchema = z.object({
  /** Redaction level */
  level: z.enum([
    'NONE',           // No redaction
    'MINIMAL',        // Only secrets/PII
    'STANDARD',       // Secrets, PII, internal IDs
    'EXTENSIVE',      // Most data redacted
    'MAXIMUM',        // Only structure preserved
  ]),
  /** Specific fields to redact */
  redactFields: z.array(z.string()).optional(),
  /** Specific fields to preserve */
  preserveFields: z.array(z.string()).optional(),
  /** Redaction pattern (regex) */
  redactPatterns: z.array(z.string()).optional(),
});

/** Proof pack export format */
export const ExportFormatSchema = z.enum([
  'JSON',           // Standard JSON
  'JSON_LD',        // JSON-LD (linked data)
  'CBOR',           // Compact binary
  'PROTOBUF',       // Protocol Buffers
]);

/**
 * ProofPack is an exportable, cryptographically verifiable audit bundle.
 * Suitable for compliance audits, regulatory submission, and dispute resolution.
 */
export const ProofPackSchema = z.object({
  // ─── Identity ───────────────────────────────────────────────────────────────
  /** Unique identifier */
  id: UUIDSchema,
  /** Schema version */
  schemaVersion: SemVerSchema.default('1.0.0'),
  /** Proof pack version */
  version: z.number().int().positive().default(1),

  // ─── Scope ──────────────────────────────────────────────────────────────────
  /** Correlation ID(s) included */
  correlationIds: z.array(CorrelationIdSchema).min(1),
  /** Intent ID(s) covered */
  intentIds: z.array(UUIDSchema),
  /** Time range covered */
  timeRange: z.object({
    from: TimestampSchema,
    to: TimestampSchema,
  }),

  // ─── Contents ───────────────────────────────────────────────────────────────
  /** Intent packages (may be redacted) */
  intents: z.array(IntentPackageSchema).optional(),
  /** Policies that were applied */
  policies: z.array(PolicySetSchema).optional(),
  /** Authorization decisions */
  decisions: z.array(AuthorizationDecisionSchema).optional(),
  /** Execution traces */
  traces: z.array(ExecutionTraceSchema).optional(),
  /** Audit records (the chain) */
  auditRecords: z.array(AuditRecordSchema),

  // ─── Cryptographic Integrity ────────────────────────────────────────────────
  /** Merkle root of audit records */
  merkleRoot: HashSchema,
  /** Chain verification result */
  chainVerification: ChainVerificationResultSchema,
  /** Merkle proofs for key records */
  merkleProofs: z.array(MerkleProofSchema).optional(),
  /** Pack content hash */
  contentHash: HashSchema,

  // ─── Signatures ─────────────────────────────────────────────────────────────
  /** Digital signature of content hash */
  signature: z.string().optional(),
  /** Signature algorithm */
  signatureAlgorithm: z.string().optional(),
  /** Signer identity */
  signedBy: z.string().optional(),
  /** Signature timestamp */
  signedAt: TimestampSchema.optional(),
  /** Certificate chain (for verification) */
  certificateChain: z.array(z.string()).optional(),

  // ─── Redaction ──────────────────────────────────────────────────────────────
  /** Redaction policy applied */
  redactionPolicy: RedactionPolicySchema,
  /** Is this pack redacted? */
  isRedacted: z.boolean(),
  /** Redaction summary */
  redactionSummary: z.object({
    totalFields: z.number().int().nonnegative(),
    redactedFields: z.number().int().nonnegative(),
    redactionRatio: z.number().min(0).max(1),
  }).optional(),

  // ─── Metadata ───────────────────────────────────────────────────────────────
  /** Purpose of this proof pack */
  purpose: z.enum([
    'AUDIT',          // Internal/external audit
    'COMPLIANCE',     // Regulatory compliance
    'DISPUTE',        // Dispute resolution
    'INVESTIGATION',  // Security investigation
    'ARCHIVAL',       // Long-term archival
    'EXPORT',         // Data export request
  ]),
  /** Requestor of the proof pack */
  requestedBy: ActorSchema,
  /** Generation timestamp */
  generatedAt: TimestampSchema,
  /** Generator system */
  generatedBy: z.string(),
  /** Export format */
  format: ExportFormatSchema.default('JSON'),
  /** Custom metadata */
  metadata: z.record(z.unknown()).optional(),

  // ─── Validity ───────────────────────────────────────────────────────────────
  /** Valid from timestamp */
  validFrom: TimestampSchema,
  /** Valid until timestamp (optional expiry) */
  validUntil: TimestampSchema.optional(),
  /** Retention requirement */
  retentionPeriod: z.string().optional(),
});

// ============================================================================
// PROOF PACK REQUEST
// ============================================================================

/** Request to generate a proof pack */
export const ProofPackRequestSchema = z.object({
  /** Request ID */
  id: UUIDSchema,
  /** Requestor */
  requestedBy: ActorSchema,
  /** Purpose */
  purpose: z.enum(['AUDIT', 'COMPLIANCE', 'DISPUTE', 'INVESTIGATION', 'ARCHIVAL', 'EXPORT']),
  /** Correlation IDs to include */
  correlationIds: z.array(CorrelationIdSchema).optional(),
  /** Intent IDs to include */
  intentIds: z.array(UUIDSchema).optional(),
  /** Time range */
  timeRange: z.object({
    from: TimestampSchema,
    to: TimestampSchema,
  }).optional(),
  /** Redaction policy */
  redactionPolicy: RedactionPolicySchema.optional(),
  /** Include intents? */
  includeIntents: z.boolean().default(true),
  /** Include policies? */
  includePolicies: z.boolean().default(false),
  /** Include decisions? */
  includeDecisions: z.boolean().default(true),
  /** Include traces? */
  includeTraces: z.boolean().default(true),
  /** Include Merkle proofs? */
  includeMerkleProofs: z.boolean().default(false),
  /** Sign the pack? */
  sign: z.boolean().default(true),
  /** Export format */
  format: ExportFormatSchema.default('JSON'),
  /** Request timestamp */
  requestedAt: TimestampSchema,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AuditRecordType = z.infer<typeof AuditRecordTypeSchema>;
export type AuditRecord = z.infer<typeof AuditRecordSchema>;
export type MerkleNode = z.infer<typeof MerkleNodeSchema>;
export type MerkleProof = z.infer<typeof MerkleProofSchema>;
export type ChainVerificationResult = z.infer<typeof ChainVerificationResultSchema>;
export type RedactionPolicy = z.infer<typeof RedactionPolicySchema>;
export type ExportFormat = z.infer<typeof ExportFormatSchema>;
export type ProofPack = z.infer<typeof ProofPackSchema>;
export type ProofPackRequest = z.infer<typeof ProofPackRequestSchema>;
