/**
 * ACI Security Module
 * 
 * Provides security primitives and extension protocol types for Layer 4 implementations.
 * 
 * @packageDocumentation
 * @module @agentanchor/aci-spec/security
 * @license Apache-2.0
 */

import type { 
  ParsedACI, 
  AgentIdentity, 
  CapabilityVector, 
  Attestation,
  TrustTier 
} from '../types';

// =============================================================================
// EXTENSION PROTOCOL TYPES
// =============================================================================

/**
 * ACI Extension Protocol
 * Implement this interface to create a Layer 4 extension
 */
export interface ACIExtension {
  /** Unique extension identifier (e.g., "aci-ext-governance-v1") */
  extensionId: string;
  
  /** Human-readable name */
  name: string;
  
  /** Semantic version */
  version: string;
  
  /** Extension shortcode for ACI strings (e.g., "gov") */
  shortcode: string;
  
  /** Publisher DID */
  publisher: string;
  
  /** Extension description */
  description: string;
  
  /** Required ACI core version */
  requiredACIVersion: string;
  
  /** Lifecycle hooks */
  hooks?: {
    onLoad?: () => Promise<void>;
    onUnload?: () => Promise<void>;
  };
  
  /** Capability hooks */
  capability?: {
    preCheck?: (agent: AgentIdentity, request: CapabilityRequest) => Promise<PreCheckResult>;
    postGrant?: (agent: AgentIdentity, grant: CapabilityGrant) => Promise<CapabilityGrant>;
    onExpiry?: (agent: AgentIdentity, grant: CapabilityGrant) => Promise<ExpiryDecision>;
  };
  
  /** Action hooks */
  action?: {
    preAction?: (agent: AgentIdentity, action: ActionRequest) => Promise<PreActionResult>;
    postAction?: (agent: AgentIdentity, action: ActionRecord) => Promise<void>;
    onFailure?: (agent: AgentIdentity, action: ActionRecord, error: Error) => Promise<FailureResponse>;
  };
  
  /** Monitoring hooks */
  monitoring?: {
    verifyBehavior?: (agent: AgentIdentity, metrics: BehaviorMetrics) => Promise<BehaviorVerificationResult>;
    collectMetrics?: (agent: AgentIdentity) => Promise<MetricsReport>;
    onAnomaly?: (agent: AgentIdentity, anomaly: AnomalyReport) => Promise<AnomalyResponse>;
  };
  
  /** Trust hooks */
  trust?: {
    onRevocation?: (revocation: RevocationEvent) => Promise<void>;
    adjustTrust?: (agent: AgentIdentity, adjustment: TrustAdjustment) => Promise<TrustAdjustmentResult>;
    verifyAttestation?: (attestation: Attestation) => Promise<AttestationVerificationResult>;
  };
  
  /** Optional policy engine */
  policy?: {
    evaluate: (context: PolicyContext) => Promise<PolicyDecision>;
    loadPolicy?: (source: PolicySource) => Promise<void>;
  };
}

// =============================================================================
// CAPABILITY TYPES
// =============================================================================

export interface CapabilityRequest {
  /** Requested domains */
  domains: string[];
  /** Requested level */
  level: number;
  /** Request context */
  context: RequestContext;
  /** Time-to-live in seconds */
  ttl?: number;
}

export interface CapabilityGrant {
  /** Grant ID */
  id: string;
  /** Granted ACI */
  aci: string;
  /** Granted domains (bitmask) */
  domains: number;
  /** Granted level */
  level: number;
  /** Issued timestamp */
  issuedAt: Date;
  /** Expiry timestamp */
  expiresAt: Date;
  /** Additional constraints */
  constraints?: Constraint[];
  /** JWT token */
  token?: string;
}

export interface RequestContext {
  /** Request source */
  source: string;
  /** Request purpose */
  purpose?: string;
  /** Target resource */
  resource?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface Constraint {
  /** Constraint type */
  type: 'rate_limit' | 'time_window' | 'resource' | 'approval' | 'custom';
  /** Constraint parameters */
  params: Record<string, unknown>;
}

// =============================================================================
// ACTION TYPES
// =============================================================================

export interface ActionRequest {
  /** Action type */
  type: string;
  /** Action target */
  target: ActionTarget;
  /** Action parameters */
  params: Record<string, unknown>;
  /** Request context */
  context: RequestContext;
}

export interface ActionTarget {
  /** Target type */
  type: string;
  /** Target identifier */
  id: string;
  /** Target metadata */
  metadata?: Record<string, unknown>;
}

export interface ActionRecord extends ActionRequest {
  /** Action ID */
  id: string;
  /** Execution start time */
  startedAt: Date;
  /** Execution end time */
  completedAt?: Date;
  /** Action result */
  result?: ActionResult;
  /** Error if failed */
  error?: Error;
}

export interface ActionResult {
  /** Success status */
  success: boolean;
  /** Result data */
  data?: unknown;
  /** Side effects */
  sideEffects?: SideEffect[];
}

export interface SideEffect {
  /** Effect type */
  type: string;
  /** Effect target */
  target: string;
  /** Effect description */
  description: string;
}

// =============================================================================
// HOOK RESULT TYPES
// =============================================================================

export interface PreCheckResult {
  /** Whether to allow the capability request */
  allow: boolean;
  /** Reason for decision */
  reason?: string;
  /** Additional constraints to apply */
  constraints?: Constraint[];
}

export interface PreActionResult {
  /** Whether to proceed with action */
  proceed: boolean;
  /** Reason for decision */
  reason?: string;
  /** Modifications to apply */
  modifications?: ActionModification[];
  /** Required approvals */
  requiredApprovals?: ApprovalRequirement[];
}

export interface ActionModification {
  /** Field to modify */
  field: string;
  /** Original value */
  original: unknown;
  /** Modified value */
  modified: unknown;
  /** Modification reason */
  reason: string;
}

export interface ApprovalRequirement {
  /** Approver type */
  type: 'human' | 'system' | 'manager';
  /** Approver identifier */
  approver?: string;
  /** Approval timeout */
  timeout?: number;
}

export interface ExpiryDecision {
  /** Action to take */
  action: 'renew' | 'expire' | 'revoke';
  /** New TTL if renewing */
  newTtl?: number;
  /** Reason */
  reason?: string;
}

export interface FailureResponse {
  /** Whether to retry */
  retry: boolean;
  /** Retry delay in ms */
  retryDelay?: number;
  /** Maximum retries */
  maxRetries?: number;
  /** Fallback action */
  fallback?: ActionRequest;
}

// =============================================================================
// MONITORING TYPES
// =============================================================================

export interface BehaviorMetrics {
  /** Observation window start */
  windowStart: Date;
  /** Observation window end */
  windowEnd: Date;
  /** Request count */
  requestCount: number;
  /** Error count */
  errorCount: number;
  /** Average response time (ms) */
  avgResponseTime: number;
  /** P99 response time (ms) */
  p99ResponseTime: number;
  /** Actions by type */
  actionsByType: Record<string, number>;
  /** Domains accessed */
  domainsAccessed: number[];
  /** Max level used */
  maxLevelUsed: number;
  /** Custom metrics */
  custom?: Record<string, number>;
}

export interface BehaviorVerificationResult {
  /** Whether behavior is within certified bounds */
  inBounds: boolean;
  /** Drift score (0-100, higher = more drift) */
  driftScore: number;
  /** Categories of drift */
  driftCategories: string[];
  /** Recommendation */
  recommendation: 'continue' | 'warn' | 'suspend' | 'revoke';
  /** Details */
  details?: string;
}

export interface MetricsReport {
  /** Report timestamp */
  timestamp: Date;
  /** Agent ACI */
  aci: string;
  /** Metrics */
  metrics: BehaviorMetrics;
  /** Health status */
  health: 'healthy' | 'degraded' | 'unhealthy';
}

export interface AnomalyReport {
  /** Anomaly ID */
  id: string;
  /** Detection timestamp */
  detectedAt: Date;
  /** Anomaly type */
  type: 'behavior' | 'security' | 'performance' | 'compliance';
  /** Severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Description */
  description: string;
  /** Evidence */
  evidence: Record<string, unknown>;
}

export interface AnomalyResponse {
  /** Action taken */
  action: 'ignore' | 'log' | 'alert' | 'suspend' | 'revoke';
  /** Notification sent */
  notified?: string[];
  /** Escalation */
  escalated?: boolean;
}

// =============================================================================
// TRUST TYPES
// =============================================================================

export interface RevocationEvent {
  /** Revocation ID */
  id: string;
  /** Revoked agent DID */
  agentDid: string;
  /** Revoked ACI */
  aci: string;
  /** Revocation timestamp */
  revokedAt: Date;
  /** Revocation reason */
  reason: string;
  /** Revocation scope */
  scope: 'full' | 'attestation' | 'capability';
  /** Affected attestation IDs */
  attestationIds?: string[];
}

export interface TrustAdjustment {
  /** Adjustment type */
  type: 'increment' | 'decrement' | 'set';
  /** Adjustment amount (for increment/decrement) */
  amount?: number;
  /** Target value (for set) */
  value?: number;
  /** Adjustment reason */
  reason: string;
  /** Evidence */
  evidence?: string;
}

export interface TrustAdjustmentResult {
  /** Previous score */
  previousScore: number;
  /** New score */
  newScore: number;
  /** Previous tier */
  previousTier: TrustTier;
  /** New tier */
  newTier: TrustTier;
  /** Whether tier changed */
  tierChanged: boolean;
}

export interface AttestationVerificationResult {
  /** Whether attestation is valid */
  valid: boolean;
  /** Verification errors */
  errors: string[];
  /** Verification warnings */
  warnings: string[];
  /** Issuer verified */
  issuerVerified: boolean;
  /** Signature verified */
  signatureVerified: boolean;
  /** Not expired */
  notExpired: boolean;
  /** Not revoked */
  notRevoked: boolean;
}

// =============================================================================
// POLICY TYPES
// =============================================================================

export interface PolicyContext {
  /** Agent identity */
  agent: AgentIdentity;
  /** Action being evaluated */
  action?: ActionRequest;
  /** Capability being requested */
  capability?: CapabilityRequest;
  /** Environment context */
  environment: EnvironmentContext;
  /** Request timestamp */
  timestamp: Date;
}

export interface EnvironmentContext {
  /** Request source IP */
  sourceIp?: string;
  /** Request geo location */
  geoLocation?: string;
  /** Time of day */
  timeOfDay: string;
  /** Day of week */
  dayOfWeek: string;
  /** Is business hours */
  isBusinessHours: boolean;
  /** Custom context */
  custom?: Record<string, unknown>;
}

export interface PolicyDecision {
  /** Decision */
  decision: 'allow' | 'deny' | 'require_approval';
  /** Reasons for decision */
  reasons: string[];
  /** Evidence */
  evidence?: PolicyEvidence[];
  /** Obligations (actions that must be taken) */
  obligations?: PolicyObligation[];
}

export interface PolicyEvidence {
  /** Policy that matched */
  policyId: string;
  /** Rule that matched */
  ruleId: string;
  /** Match details */
  details: string;
}

export interface PolicyObligation {
  /** Obligation type */
  type: 'log' | 'notify' | 'audit' | 'custom';
  /** Obligation parameters */
  params: Record<string, unknown>;
}

export interface PolicySource {
  /** Source type */
  type: 'file' | 'url' | 'inline';
  /** Source location */
  location: string;
  /** Policy format */
  format: 'rego' | 'json' | 'yaml';
}

// =============================================================================
// SECURITY UTILITIES
// =============================================================================

/**
 * Parse extension suffix from ACI string
 */
export function parseExtensions(aci: string): { core: string; extensions: string[] } {
  const [core, extSuffix] = aci.split('#');
  const extensions = extSuffix ? extSuffix.split(',').map(e => e.trim()) : [];
  return { core, extensions };
}

/**
 * Add extension to ACI string
 */
export function addExtension(aci: string, extension: string): string {
  const { core, extensions } = parseExtensions(aci);
  if (!extensions.includes(extension)) {
    extensions.push(extension);
  }
  return extensions.length > 0 ? `${core}#${extensions.join(',')}` : core;
}

/**
 * Remove extension from ACI string
 */
export function removeExtension(aci: string, extension: string): string {
  const { core, extensions } = parseExtensions(aci);
  const filtered = extensions.filter(e => e !== extension);
  return filtered.length > 0 ? `${core}#${filtered.join(',')}` : core;
}

/**
 * Check if ACI has extension
 */
export function hasExtension(aci: string, extension: string): boolean {
  const { extensions } = parseExtensions(aci);
  return extensions.includes(extension);
}

/**
 * Validate extension ID format
 */
export function isValidExtensionId(id: string): boolean {
  return /^aci-ext-[a-z]+-v\d+$/.test(id);
}

/**
 * Validate extension shortcode format
 */
export function isValidShortcode(shortcode: string): boolean {
  return /^[a-z]{1,10}$/.test(shortcode);
}

/**
 * Convert trust score to tier
 */
export function scoreToTier(score: number): TrustTier {
  if (score >= 900) return 5;
  if (score >= 700) return 4;
  if (score >= 500) return 3;
  if (score >= 300) return 2;
  if (score >= 100) return 1;
  return 0;
}

/**
 * Get minimum score for tier
 */
export function tierMinScore(tier: TrustTier): number {
  const mins: Record<TrustTier, number> = {
    0: 0,
    1: 100,
    2: 300,
    3: 500,
    4: 700,
    5: 900,
  };
  return mins[tier];
}

// =============================================================================
// EXTENSION REGISTRY HELPERS
// =============================================================================

/**
 * Extension registration request
 */
export interface ExtensionRegistration {
  extensionId: string;
  name: string;
  version: string;
  shortcode: string;
  publisher: string;
  description: string;
  requiredACIVersion: string;
  documentation?: string;
  schema?: string;
  hooks: string[];
}

/**
 * Registered extension info
 */
export interface RegisteredExtension {
  extensionId: string;
  shortcode: string;
  publisher: string;
  verified: boolean;
  downloads: number;
  rating: number;
  latestVersion: string;
}

// Export everything
export {
  ACIExtension as Extension,
  PreCheckResult,
  PreActionResult,
  BehaviorVerificationResult,
  PolicyDecision,
};
