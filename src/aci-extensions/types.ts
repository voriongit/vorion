/**
 * ACI Extension Protocol Types
 *
 * Provides comprehensive type definitions for the Layer 4 Runtime Assurance
 * extension system. This module defines the core extension interface and all
 * supporting types for capability, action, monitoring, trust, and policy hooks.
 *
 * @packageDocumentation
 * @module @vorion/aci-extensions/types
 * @license Apache-2.0
 */

import { z } from 'zod';
import type { TrustLevel, TrustScore, ID } from '../common/types.js';

// =============================================================================
// TRUST TIER (from ACI spec)
// =============================================================================

/**
 * Trust tier values (0-5)
 * Maps to canonical TrustBand definitions
 */
export type TrustTier = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Zod schema for TrustTier validation
 */
export const TrustTierSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

// =============================================================================
// AGENT IDENTITY
// =============================================================================

/**
 * Agent identity information for extension hooks
 */
export interface AgentIdentity {
  /** Agent's DID (Decentralized Identifier) */
  did: string;
  /** Agent's ACI string (with optional extensions) */
  aci: string;
  /** Publisher organization */
  publisher: string;
  /** Agent name */
  name: string;
  /** Current trust tier */
  trustTier: TrustTier;
  /** Current trust score (0-1000) */
  trustScore: TrustScore;
  /** Capability domains (bitmask) */
  domains: number;
  /** Capability level */
  level: number;
  /** Agent version */
  version: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for AgentIdentity validation
 */
export const AgentIdentitySchema = z.object({
  did: z.string().min(1),
  aci: z.string().min(1),
  publisher: z.string().min(1),
  name: z.string().min(1),
  trustTier: TrustTierSchema,
  trustScore: z.number().min(0).max(1000),
  domains: z.number().int().min(0),
  level: z.number().int().min(0).max(5),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// ATTESTATION
// =============================================================================

/**
 * Attestation record for verifying agent certification
 */
export interface Attestation {
  /** Attestation ID */
  id: string;
  /** Agent DID this attestation is for */
  agentDid: string;
  /** Issuer DID */
  issuerDid: string;
  /** Attestation type */
  type: 'certification' | 'capability' | 'trust' | 'compliance';
  /** Claims in the attestation */
  claims: Record<string, unknown>;
  /** Issuance timestamp */
  issuedAt: Date;
  /** Expiry timestamp */
  expiresAt: Date;
  /** Cryptographic signature */
  signature: string;
  /** Signature algorithm */
  signatureAlgorithm: string;
  /** Whether attestation has been revoked */
  revoked: boolean;
  /** Revocation timestamp if revoked */
  revokedAt?: Date;
}

/**
 * Zod schema for Attestation validation
 */
export const AttestationSchema = z.object({
  id: z.string().uuid(),
  agentDid: z.string().min(1),
  issuerDid: z.string().min(1),
  type: z.enum(['certification', 'capability', 'trust', 'compliance']),
  claims: z.record(z.unknown()),
  issuedAt: z.date(),
  expiresAt: z.date(),
  signature: z.string().min(1),
  signatureAlgorithm: z.string().min(1),
  revoked: z.boolean(),
  revokedAt: z.date().optional(),
});

// =============================================================================
// CAPABILITY TYPES
// =============================================================================

/**
 * Request context for capability and action requests
 */
export interface RequestContext {
  /** Request source identifier */
  source: string;
  /** Request purpose description */
  purpose?: string;
  /** Target resource identifier */
  resource?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for RequestContext validation
 */
export const RequestContextSchema = z.object({
  source: z.string().min(1),
  purpose: z.string().optional(),
  resource: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Constraint that can be applied to capabilities or actions
 */
export interface Constraint {
  /** Constraint type */
  type: 'rate_limit' | 'time_window' | 'resource' | 'approval' | 'custom';
  /** Constraint parameters */
  params: Record<string, unknown>;
}

/**
 * Zod schema for Constraint validation
 */
export const ConstraintSchema = z.object({
  type: z.enum(['rate_limit', 'time_window', 'resource', 'approval', 'custom']),
  params: z.record(z.unknown()),
});

/**
 * Capability request from an agent
 */
export interface CapabilityRequest {
  /** Requested domains (string identifiers) */
  domains: string[];
  /** Requested capability level */
  level: number;
  /** Request context */
  context: RequestContext;
  /** Time-to-live in seconds */
  ttl?: number;
}

/**
 * Zod schema for CapabilityRequest validation
 */
export const CapabilityRequestSchema = z.object({
  domains: z.array(z.string().min(1)),
  level: z.number().int().min(0).max(5),
  context: RequestContextSchema,
  ttl: z.number().int().positive().optional(),
});

/**
 * Capability grant issued to an agent
 */
export interface CapabilityGrant {
  /** Grant ID */
  id: string;
  /** Granted ACI string */
  aci: string;
  /** Granted domains (bitmask) */
  domains: number;
  /** Granted level */
  level: number;
  /** Issuance timestamp */
  issuedAt: Date;
  /** Expiry timestamp */
  expiresAt: Date;
  /** Additional constraints */
  constraints?: Constraint[];
  /** JWT token representing the grant */
  token?: string;
}

/**
 * Zod schema for CapabilityGrant validation
 */
export const CapabilityGrantSchema = z.object({
  id: z.string().uuid(),
  aci: z.string().min(1),
  domains: z.number().int().min(0),
  level: z.number().int().min(0).max(5),
  issuedAt: z.date(),
  expiresAt: z.date(),
  constraints: z.array(ConstraintSchema).optional(),
  token: z.string().optional(),
});

// =============================================================================
// ACTION TYPES
// =============================================================================

/**
 * Target of an action
 */
export interface ActionTarget {
  /** Target type (e.g., 'resource', 'agent', 'service') */
  type: string;
  /** Target identifier */
  id: string;
  /** Target metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for ActionTarget validation
 */
export const ActionTargetSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Action request from an agent
 */
export interface ActionRequest {
  /** Action type identifier */
  type: string;
  /** Action target */
  target: ActionTarget;
  /** Action parameters */
  params: Record<string, unknown>;
  /** Request context */
  context: RequestContext;
}

/**
 * Zod schema for ActionRequest validation
 */
export const ActionRequestSchema = z.object({
  type: z.string().min(1),
  target: ActionTargetSchema,
  params: z.record(z.unknown()),
  context: RequestContextSchema,
});

/**
 * Side effect of an action
 */
export interface SideEffect {
  /** Effect type */
  type: string;
  /** Effect target */
  target: string;
  /** Effect description */
  description: string;
}

/**
 * Zod schema for SideEffect validation
 */
export const SideEffectSchema = z.object({
  type: z.string().min(1),
  target: z.string().min(1),
  description: z.string().min(1),
});

/**
 * Result of an action execution
 */
export interface ActionResult {
  /** Whether action succeeded */
  success: boolean;
  /** Result data */
  data?: unknown;
  /** Side effects produced */
  sideEffects?: SideEffect[];
}

/**
 * Zod schema for ActionResult validation
 */
export const ActionResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  sideEffects: z.array(SideEffectSchema).optional(),
});

/**
 * Record of an executed action
 */
export interface ActionRecord extends ActionRequest {
  /** Action record ID */
  id: string;
  /** Execution start timestamp */
  startedAt: Date;
  /** Execution completion timestamp */
  completedAt?: Date;
  /** Action result */
  result?: ActionResult;
  /** Error if action failed */
  error?: Error;
}

/**
 * Zod schema for ActionRecord validation
 */
export const ActionRecordSchema = ActionRequestSchema.extend({
  id: z.string().uuid(),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  result: ActionResultSchema.optional(),
  error: z.instanceof(Error).optional(),
});

// =============================================================================
// HOOK RESULT TYPES
// =============================================================================

/**
 * Result of a capability pre-check hook
 */
export interface PreCheckResult {
  /** Whether to allow the capability request */
  allow: boolean;
  /** Reason for decision */
  reason?: string;
  /** Additional constraints to apply if allowed */
  constraints?: Constraint[];
}

/**
 * Zod schema for PreCheckResult validation
 */
export const PreCheckResultSchema = z.object({
  allow: z.boolean(),
  reason: z.string().optional(),
  constraints: z.array(ConstraintSchema).optional(),
});

/**
 * Modification to apply to an action
 */
export interface ActionModification {
  /** Field being modified */
  field: string;
  /** Original value */
  original: unknown;
  /** Modified value */
  modified: unknown;
  /** Reason for modification */
  reason: string;
}

/**
 * Zod schema for ActionModification validation
 */
export const ActionModificationSchema = z.object({
  field: z.string().min(1),
  original: z.unknown(),
  modified: z.unknown(),
  reason: z.string().min(1),
});

/**
 * Approval requirement for an action
 */
export interface ApprovalRequirement {
  /** Type of approver needed */
  type: 'human' | 'system' | 'manager';
  /** Specific approver identifier */
  approver?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Zod schema for ApprovalRequirement validation
 */
export const ApprovalRequirementSchema = z.object({
  type: z.enum(['human', 'system', 'manager']),
  approver: z.string().optional(),
  timeout: z.number().int().positive().optional(),
});

/**
 * Result of a pre-action hook
 */
export interface PreActionResult {
  /** Whether to proceed with the action */
  proceed: boolean;
  /** Reason for decision */
  reason?: string;
  /** Modifications to apply to the action */
  modifications?: ActionModification[];
  /** Required approvals before proceeding */
  requiredApprovals?: ApprovalRequirement[];
}

/**
 * Zod schema for PreActionResult validation
 */
export const PreActionResultSchema = z.object({
  proceed: z.boolean(),
  reason: z.string().optional(),
  modifications: z.array(ActionModificationSchema).optional(),
  requiredApprovals: z.array(ApprovalRequirementSchema).optional(),
});

/**
 * Decision on capability expiry
 */
export interface ExpiryDecision {
  /** Action to take on expiry */
  action: 'renew' | 'expire' | 'revoke';
  /** New TTL in seconds if renewing */
  newTtl?: number;
  /** Reason for decision */
  reason?: string;
}

/**
 * Zod schema for ExpiryDecision validation
 */
export const ExpiryDecisionSchema = z.object({
  action: z.enum(['renew', 'expire', 'revoke']),
  newTtl: z.number().int().positive().optional(),
  reason: z.string().optional(),
});

/**
 * Response to an action failure
 */
export interface FailureResponse {
  /** Whether to retry the action */
  retry: boolean;
  /** Delay before retry in milliseconds */
  retryDelay?: number;
  /** Maximum number of retries */
  maxRetries?: number;
  /** Fallback action to execute instead */
  fallback?: ActionRequest;
}

/**
 * Zod schema for FailureResponse validation
 */
export const FailureResponseSchema = z.object({
  retry: z.boolean(),
  retryDelay: z.number().int().positive().optional(),
  maxRetries: z.number().int().positive().optional(),
  fallback: ActionRequestSchema.optional(),
});

// =============================================================================
// MONITORING TYPES
// =============================================================================

/**
 * Behavioral metrics collected for an agent
 */
export interface BehaviorMetrics {
  /** Observation window start */
  windowStart: Date;
  /** Observation window end */
  windowEnd: Date;
  /** Total request count in window */
  requestCount: number;
  /** Error count in window */
  errorCount: number;
  /** Average response time in milliseconds */
  avgResponseTime: number;
  /** P99 response time in milliseconds */
  p99ResponseTime: number;
  /** Actions grouped by type */
  actionsByType: Record<string, number>;
  /** Domains accessed (bitmask values) */
  domainsAccessed: number[];
  /** Maximum capability level used */
  maxLevelUsed: number;
  /** Custom metrics */
  custom?: Record<string, number>;
}

/**
 * Zod schema for BehaviorMetrics validation
 */
export const BehaviorMetricsSchema = z.object({
  windowStart: z.date(),
  windowEnd: z.date(),
  requestCount: z.number().int().min(0),
  errorCount: z.number().int().min(0),
  avgResponseTime: z.number().min(0),
  p99ResponseTime: z.number().min(0),
  actionsByType: z.record(z.number().int().min(0)),
  domainsAccessed: z.array(z.number().int().min(0)),
  maxLevelUsed: z.number().int().min(0).max(5),
  custom: z.record(z.number()).optional(),
});

/**
 * Result of behavioral verification
 */
export interface BehaviorVerificationResult {
  /** Whether behavior is within certified bounds */
  inBounds: boolean;
  /** Drift score (0-100, higher means more drift) */
  driftScore: number;
  /** Categories of detected drift */
  driftCategories: string[];
  /** Recommended action */
  recommendation: 'continue' | 'warn' | 'suspend' | 'revoke';
  /** Additional details */
  details?: string;
}

/**
 * Zod schema for BehaviorVerificationResult validation
 */
export const BehaviorVerificationResultSchema = z.object({
  inBounds: z.boolean(),
  driftScore: z.number().min(0).max(100),
  driftCategories: z.array(z.string()),
  recommendation: z.enum(['continue', 'warn', 'suspend', 'revoke']),
  details: z.string().optional(),
});

/**
 * Metrics report from an agent
 */
export interface MetricsReport {
  /** Report timestamp */
  timestamp: Date;
  /** Agent ACI string */
  aci: string;
  /** Collected metrics */
  metrics: BehaviorMetrics;
  /** Overall health status */
  health: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * Zod schema for MetricsReport validation
 */
export const MetricsReportSchema = z.object({
  timestamp: z.date(),
  aci: z.string().min(1),
  metrics: BehaviorMetricsSchema,
  health: z.enum(['healthy', 'degraded', 'unhealthy']),
});

/**
 * Report of an anomaly detected in agent behavior
 */
export interface AnomalyReport {
  /** Anomaly ID */
  id: string;
  /** Detection timestamp */
  detectedAt: Date;
  /** Anomaly type */
  type: 'behavior' | 'security' | 'performance' | 'compliance';
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Human-readable description */
  description: string;
  /** Evidence supporting the anomaly detection */
  evidence: Record<string, unknown>;
}

/**
 * Zod schema for AnomalyReport validation
 */
export const AnomalyReportSchema = z.object({
  id: z.string().uuid(),
  detectedAt: z.date(),
  type: z.enum(['behavior', 'security', 'performance', 'compliance']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(1),
  evidence: z.record(z.unknown()),
});

/**
 * Response to an anomaly
 */
export interface AnomalyResponse {
  /** Action taken in response to anomaly */
  action: 'ignore' | 'log' | 'alert' | 'suspend' | 'revoke';
  /** Parties notified */
  notified?: string[];
  /** Whether the anomaly was escalated */
  escalated?: boolean;
}

/**
 * Zod schema for AnomalyResponse validation
 */
export const AnomalyResponseSchema = z.object({
  action: z.enum(['ignore', 'log', 'alert', 'suspend', 'revoke']),
  notified: z.array(z.string()).optional(),
  escalated: z.boolean().optional(),
});

// =============================================================================
// TRUST TYPES
// =============================================================================

/**
 * Revocation event for an agent or capability
 */
export interface RevocationEvent {
  /** Revocation ID */
  id: string;
  /** Revoked agent DID */
  agentDid: string;
  /** Revoked ACI string */
  aci: string;
  /** Revocation timestamp */
  revokedAt: Date;
  /** Reason for revocation */
  reason: string;
  /** Scope of revocation */
  scope: 'full' | 'attestation' | 'capability';
  /** Affected attestation IDs */
  attestationIds?: string[];
}

/**
 * Zod schema for RevocationEvent validation
 */
export const RevocationEventSchema = z.object({
  id: z.string().uuid(),
  agentDid: z.string().min(1),
  aci: z.string().min(1),
  revokedAt: z.date(),
  reason: z.string().min(1),
  scope: z.enum(['full', 'attestation', 'capability']),
  attestationIds: z.array(z.string().uuid()).optional(),
});

/**
 * Trust adjustment request
 */
export interface TrustAdjustment {
  /** Type of adjustment */
  type: 'increment' | 'decrement' | 'set';
  /** Amount for increment/decrement */
  amount?: number;
  /** Target value for set */
  value?: number;
  /** Reason for adjustment */
  reason: string;
  /** Evidence supporting adjustment */
  evidence?: string;
}

/**
 * Zod schema for TrustAdjustment validation
 */
export const TrustAdjustmentSchema = z.object({
  type: z.enum(['increment', 'decrement', 'set']),
  amount: z.number().optional(),
  value: z.number().min(0).max(1000).optional(),
  reason: z.string().min(1),
  evidence: z.string().optional(),
});

/**
 * Result of a trust adjustment
 */
export interface TrustAdjustmentResult {
  /** Previous trust score */
  previousScore: number;
  /** New trust score */
  newScore: number;
  /** Previous trust tier */
  previousTier: TrustTier;
  /** New trust tier */
  newTier: TrustTier;
  /** Whether tier changed */
  tierChanged: boolean;
}

/**
 * Zod schema for TrustAdjustmentResult validation
 */
export const TrustAdjustmentResultSchema = z.object({
  previousScore: z.number().min(0).max(1000),
  newScore: z.number().min(0).max(1000),
  previousTier: TrustTierSchema,
  newTier: TrustTierSchema,
  tierChanged: z.boolean(),
});

/**
 * Result of attestation verification
 */
export interface AttestationVerificationResult {
  /** Whether attestation is valid */
  valid: boolean;
  /** Verification errors */
  errors: string[];
  /** Verification warnings */
  warnings: string[];
  /** Whether issuer was verified */
  issuerVerified: boolean;
  /** Whether signature was verified */
  signatureVerified: boolean;
  /** Whether attestation is not expired */
  notExpired: boolean;
  /** Whether attestation is not revoked */
  notRevoked: boolean;
}

/**
 * Zod schema for AttestationVerificationResult validation
 */
export const AttestationVerificationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  issuerVerified: z.boolean(),
  signatureVerified: z.boolean(),
  notExpired: z.boolean(),
  notRevoked: z.boolean(),
});

// =============================================================================
// POLICY TYPES
// =============================================================================

/**
 * Environment context for policy evaluation
 */
export interface EnvironmentContext {
  /** Source IP address */
  sourceIp?: string;
  /** Geographic location */
  geoLocation?: string;
  /** Time of day (HH:MM format) */
  timeOfDay: string;
  /** Day of week */
  dayOfWeek: string;
  /** Whether request is during business hours */
  isBusinessHours: boolean;
  /** Custom context values */
  custom?: Record<string, unknown>;
}

/**
 * Zod schema for EnvironmentContext validation
 */
export const EnvironmentContextSchema = z.object({
  sourceIp: z.string().ip().optional(),
  geoLocation: z.string().optional(),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/),
  dayOfWeek: z.string(),
  isBusinessHours: z.boolean(),
  custom: z.record(z.unknown()).optional(),
});

/**
 * Context for policy evaluation
 */
export interface PolicyContext {
  /** Agent identity */
  agent: AgentIdentity;
  /** Action being evaluated (if action-based) */
  action?: ActionRequest;
  /** Capability being requested (if capability-based) */
  capability?: CapabilityRequest;
  /** Environment context */
  environment: EnvironmentContext;
  /** Request timestamp */
  timestamp: Date;
}

/**
 * Zod schema for PolicyContext validation
 */
export const PolicyContextSchema = z.object({
  agent: AgentIdentitySchema,
  action: ActionRequestSchema.optional(),
  capability: CapabilityRequestSchema.optional(),
  environment: EnvironmentContextSchema,
  timestamp: z.date(),
});

/**
 * Evidence from a policy match
 */
export interface PolicyEvidence {
  /** ID of the policy that matched */
  policyId: string;
  /** ID of the rule that matched */
  ruleId: string;
  /** Match details */
  details: string;
}

/**
 * Zod schema for PolicyEvidence validation
 */
export const PolicyEvidenceSchema = z.object({
  policyId: z.string().min(1),
  ruleId: z.string().min(1),
  details: z.string().min(1),
});

/**
 * Obligation that must be fulfilled as part of policy decision
 */
export interface PolicyObligation {
  /** Obligation type */
  type: 'log' | 'notify' | 'audit' | 'custom';
  /** Obligation parameters */
  params: Record<string, unknown>;
}

/**
 * Zod schema for PolicyObligation validation
 */
export const PolicyObligationSchema = z.object({
  type: z.enum(['log', 'notify', 'audit', 'custom']),
  params: z.record(z.unknown()),
});

/**
 * Decision from policy evaluation
 */
export interface PolicyDecision {
  /** Decision outcome */
  decision: 'allow' | 'deny' | 'require_approval';
  /** Reasons for the decision */
  reasons: string[];
  /** Evidence supporting the decision */
  evidence?: PolicyEvidence[];
  /** Obligations that must be fulfilled */
  obligations?: PolicyObligation[];
}

/**
 * Zod schema for PolicyDecision validation
 */
export const PolicyDecisionSchema = z.object({
  decision: z.enum(['allow', 'deny', 'require_approval']),
  reasons: z.array(z.string()),
  evidence: z.array(PolicyEvidenceSchema).optional(),
  obligations: z.array(PolicyObligationSchema).optional(),
});

/**
 * Source for loading policy definitions
 */
export interface PolicySource {
  /** Source type */
  type: 'file' | 'url' | 'inline';
  /** Source location or content */
  location: string;
  /** Policy format */
  format: 'rego' | 'json' | 'yaml';
}

/**
 * Zod schema for PolicySource validation
 */
export const PolicySourceSchema = z.object({
  type: z.enum(['file', 'url', 'inline']),
  location: z.string().min(1),
  format: z.enum(['rego', 'json', 'yaml']),
});

// =============================================================================
// EXTENSION INTERFACE
// =============================================================================

/**
 * Lifecycle hooks for extension load/unload
 */
export interface LifecycleHooks {
  /** Called when extension is loaded */
  onLoad?: () => Promise<void>;
  /** Called when extension is unloaded */
  onUnload?: () => Promise<void>;
}

/**
 * Capability-related hooks
 */
export interface CapabilityHooks {
  /** Called before capability check */
  preCheck?: (agent: AgentIdentity, request: CapabilityRequest) => Promise<PreCheckResult>;
  /** Called after capability is granted */
  postGrant?: (agent: AgentIdentity, grant: CapabilityGrant) => Promise<CapabilityGrant>;
  /** Called when capability is about to expire */
  onExpiry?: (agent: AgentIdentity, grant: CapabilityGrant) => Promise<ExpiryDecision>;
}

/**
 * Action-related hooks
 */
export interface ActionHooks {
  /** Called before action execution */
  preAction?: (agent: AgentIdentity, action: ActionRequest) => Promise<PreActionResult>;
  /** Called after action execution */
  postAction?: (agent: AgentIdentity, action: ActionRecord) => Promise<void>;
  /** Called on action failure */
  onFailure?: (agent: AgentIdentity, action: ActionRecord, error: Error) => Promise<FailureResponse>;
}

/**
 * Monitoring-related hooks
 */
export interface MonitoringHooks {
  /** Verify agent behavior against baseline */
  verifyBehavior?: (agent: AgentIdentity, metrics: BehaviorMetrics) => Promise<BehaviorVerificationResult>;
  /** Collect metrics from agent */
  collectMetrics?: (agent: AgentIdentity) => Promise<MetricsReport>;
  /** Handle detected anomaly */
  onAnomaly?: (agent: AgentIdentity, anomaly: AnomalyReport) => Promise<AnomalyResponse>;
}

/**
 * Trust-related hooks
 */
export interface TrustHooks {
  /** Handle revocation event */
  onRevocation?: (revocation: RevocationEvent) => Promise<void>;
  /** Adjust trust score */
  adjustTrust?: (agent: AgentIdentity, adjustment: TrustAdjustment) => Promise<TrustAdjustmentResult>;
  /** Verify attestation */
  verifyAttestation?: (attestation: Attestation) => Promise<AttestationVerificationResult>;
}

/**
 * Policy engine interface
 */
export interface PolicyEngine {
  /** Evaluate policy for context */
  evaluate: (context: PolicyContext) => Promise<PolicyDecision>;
  /** Load policy from source */
  loadPolicy?: (source: PolicySource) => Promise<void>;
}

/**
 * ACI Extension Protocol Interface
 *
 * Implement this interface to create a Layer 4 extension that provides
 * runtime assurance capabilities such as governance, monitoring, and
 * policy enforcement.
 */
export interface ACIExtension {
  /** Unique extension identifier (format: aci-ext-{name}-v{version}) */
  extensionId: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** Short code for ACI strings (e.g., "gov", "audit") */
  shortcode: string;
  /** Publisher DID */
  publisher: string;
  /** Extension description */
  description: string;
  /** Required ACI core version (semver range) */
  requiredACIVersion: string;

  /** Lifecycle hooks */
  hooks?: LifecycleHooks;

  /** Capability hooks */
  capability?: CapabilityHooks;

  /** Action hooks */
  action?: ActionHooks;

  /** Monitoring hooks */
  monitoring?: MonitoringHooks;

  /** Trust hooks */
  trust?: TrustHooks;

  /** Policy engine (optional) */
  policy?: PolicyEngine;
}

/**
 * Zod schema for ACIExtension validation (metadata only)
 */
export const ACIExtensionMetadataSchema = z.object({
  extensionId: z.string().regex(/^aci-ext-[a-z]+-v\d+$/),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  shortcode: z.string().regex(/^[a-z]{1,10}$/),
  publisher: z.string().min(1),
  description: z.string().min(1),
  requiredACIVersion: z.string().min(1),
});

// =============================================================================
// AGGREGATED RESULT TYPES (for executor)
// =============================================================================

/**
 * Aggregated result from multiple pre-check hooks
 */
export interface AggregatedPreCheckResult {
  /** Whether all extensions allowed the request */
  allow: boolean;
  /** Results from each extension */
  results: Array<{
    extensionId: string;
    result: PreCheckResult;
  }>;
  /** Combined constraints from all extensions */
  constraints: Constraint[];
  /** First denial reason if denied */
  denialReason?: string;
  /** Extension that denied if denied */
  deniedBy?: string;
}

/**
 * Aggregated result from multiple pre-action hooks
 */
export interface AggregatedPreActionResult {
  /** Whether all extensions allow proceeding */
  proceed: boolean;
  /** Results from each extension */
  results: Array<{
    extensionId: string;
    result: PreActionResult;
  }>;
  /** Combined modifications from all extensions */
  modifications: ActionModification[];
  /** Combined approval requirements */
  requiredApprovals: ApprovalRequirement[];
  /** First blocking reason if blocked */
  blockingReason?: string;
  /** Extension that blocked if blocked */
  blockedBy?: string;
}

/**
 * Aggregated result from multiple failure handlers
 */
export interface AggregatedFailureResponse {
  /** Whether any extension suggests retry */
  retry: boolean;
  /** Shortest suggested retry delay */
  retryDelay?: number;
  /** Minimum of max retries suggestions */
  maxRetries?: number;
  /** First suggested fallback */
  fallback?: ActionRequest;
  /** Results from each extension */
  results: Array<{
    extensionId: string;
    result: FailureResponse;
  }>;
}

/**
 * Aggregated result from multiple behavior verification hooks
 */
export interface AggregatedBehaviorResult {
  /** Whether any extension found behavior out of bounds */
  inBounds: boolean;
  /** Maximum drift score across extensions */
  maxDriftScore: number;
  /** Combined drift categories */
  driftCategories: string[];
  /** Most severe recommendation */
  recommendation: 'continue' | 'warn' | 'suspend' | 'revoke';
  /** Results from each extension */
  results: Array<{
    extensionId: string;
    result: BehaviorVerificationResult;
  }>;
}

/**
 * Aggregated metrics from multiple extensions
 */
export interface AggregatedMetricsReport {
  /** Collection timestamp */
  timestamp: Date;
  /** Reports from each extension */
  reports: Array<{
    extensionId: string;
    report: MetricsReport;
  }>;
  /** Overall health (worst of all extensions) */
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * Aggregated anomaly response from multiple extensions
 */
export interface AggregatedAnomalyResponse {
  /** Most severe action taken */
  action: 'ignore' | 'log' | 'alert' | 'suspend' | 'revoke';
  /** All parties notified */
  notified: string[];
  /** Whether any extension escalated */
  escalated: boolean;
  /** Results from each extension */
  results: Array<{
    extensionId: string;
    result: AnomalyResponse;
  }>;
}

/**
 * Aggregated trust adjustment result
 */
export interface AggregatedTrustResult {
  /** Final trust score after all adjustments */
  finalScore: number;
  /** Final trust tier */
  finalTier: TrustTier;
  /** Whether tier changed from any adjustment */
  tierChanged: boolean;
  /** Results from each extension */
  results: Array<{
    extensionId: string;
    result: TrustAdjustmentResult;
  }>;
}

/**
 * Aggregated policy decision from multiple extensions
 */
export interface AggregatedPolicyDecision {
  /** Final decision (deny wins, then require_approval, then allow) */
  decision: 'allow' | 'deny' | 'require_approval';
  /** Combined reasons from all extensions */
  reasons: string[];
  /** Combined evidence from all extensions */
  evidence: PolicyEvidence[];
  /** Combined obligations from all extensions */
  obligations: PolicyObligation[];
  /** Results from each extension */
  results: Array<{
    extensionId: string;
    result: PolicyDecision;
  }>;
}

// =============================================================================
// REGISTRY TYPES
// =============================================================================

/**
 * Information about a registered extension
 */
export interface ExtensionInfo {
  /** Extension ID */
  extensionId: string;
  /** Extension name */
  name: string;
  /** Extension version */
  version: string;
  /** Extension shortcode */
  shortcode: string;
  /** Publisher DID */
  publisher: string;
  /** Extension description */
  description: string;
  /** When the extension was registered */
  registeredAt: Date;
  /** Whether the extension is currently loaded */
  loaded: boolean;
  /** Available hooks */
  hooks: string[];
}

/**
 * Result of extension validation
 */
export interface ValidationResult {
  /** Whether extension is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Zod schema for ValidationResult
 */
export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

// =============================================================================
// SERVICE TYPES
// =============================================================================

/**
 * Configuration for the extension service
 */
export interface ExtensionServiceConfig {
  /** Default timeout for hook execution (ms) */
  defaultTimeout?: number;
  /** Whether to fail fast on first hook error */
  failFast?: boolean;
  /** Whether to log hook execution */
  logExecution?: boolean;
  /** Maximum concurrent hook executions */
  maxConcurrency?: number;
}

/**
 * Zod schema for ExtensionServiceConfig
 */
export const ExtensionServiceConfigSchema = z.object({
  defaultTimeout: z.number().int().positive().optional(),
  failFast: z.boolean().optional(),
  logExecution: z.boolean().optional(),
  maxConcurrency: z.number().int().positive().optional(),
});

// =============================================================================
// EXTENSION HOOK TIMEOUTS (from spec)
// =============================================================================

/**
 * Default timeouts for different hook types (in milliseconds)
 */
export const HOOK_TIMEOUTS = {
  preCheck: { default: 100, max: 500 },
  postGrant: { default: 100, max: 500 },
  onExpiry: { default: 100, max: 500 },
  preAction: { default: 200, max: 1000 },
  postAction: { default: 500, max: 2000 },
  onFailure: { default: 200, max: 1000 },
  verifyBehavior: { default: 5000, max: 30000 },
  collectMetrics: { default: 5000, max: 30000 },
  onAnomaly: { default: 1000, max: 5000 },
  onRevocation: { default: 500, max: 2000 },
  adjustTrust: { default: 200, max: 1000 },
  verifyAttestation: { default: 500, max: 2000 },
  evaluate: { default: 500, max: 2000 },
} as const;

/**
 * Hook timeout type
 */
export type HookTimeout = keyof typeof HOOK_TIMEOUTS;
