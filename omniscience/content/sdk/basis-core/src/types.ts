/**
 * @basis-protocol/core
 * Core types for the BASIS AI governance standard
 * 
 * BASIS = Behavioral AI Safety & Intelligence Standard
 */

// =============================================================================
// TRUST TYPES
// =============================================================================

/**
 * Trust tiers from 0 (Unverified) to 5 (Sovereign)
 * Each tier unlocks progressively more capabilities
 */
export type TrustTier = 
  | 'unverified'   // 0-99: Sandbox only
  | 'provisional'  // 100-299: Basic operations
  | 'certified'    // 300-499: Standard operations
  | 'trusted'      // 500-699: Extended operations
  | 'verified'     // 700-899: Privileged operations
  | 'sovereign';   // 900-1000: Full autonomy

/**
 * Trust score components that make up the composite score
 */
export interface TrustComponents {
  /** Compliance with governance rules (0-100, weight: 25%) */
  compliance: number;
  /** Performance metrics (0-100, weight: 20%) */
  performance: number;
  /** Community reputation signals (0-100, weight: 15%) */
  reputation: number;
  /** Staked collateral (0-100, weight: 15%) */
  stake: number;
  /** Historical behavior (0-100, weight: 15%) */
  history: number;
  /** Third-party verification (0-100, weight: 10%) */
  verification: number;
}

/**
 * Complete trust score with composite and breakdown
 */
export interface TrustScore {
  /** Composite score (0-1000) */
  composite: number;
  /** Derived trust tier */
  tier: TrustTier;
  /** Individual component scores */
  components: TrustComponents;
  /** When the score was last calculated */
  lastUpdated: Date;
  /** Score version for migrations */
  version: string;
}

/**
 * Trust score change event for history tracking
 */
export interface TrustScoreChange {
  /** Previous composite score */
  previousScore: number;
  /** New composite score */
  newScore: number;
  /** Reason for change */
  reason: string;
  /** Component that changed most */
  primaryFactor: keyof TrustComponents;
  /** Timestamp of change */
  timestamp: Date;
}

// =============================================================================
// CAPABILITY TYPES
// =============================================================================

/**
 * Capability categories following hierarchical taxonomy
 */
export type CapabilityCategory = 
  | 'data'
  | 'communication'
  | 'execution'
  | 'financial'
  | 'administrative';

/**
 * Standard capability identifiers
 */
export type Capability = 
  // Data capabilities
  | 'data/read_public'
  | 'data/read_user'
  | 'data/read_sensitive'
  | 'data/write'
  | 'data/delete'
  // Communication capabilities
  | 'communication/send_internal'
  | 'communication/send_external'
  | 'communication/broadcast'
  // Execution capabilities
  | 'execution/invoke_api'
  | 'execution/run_code'
  | 'execution/schedule'
  | 'execution/spawn_agent'
  // Financial capabilities
  | 'financial/read_balance'
  | 'financial/payment'
  | 'financial/transfer'
  // Administrative capabilities
  | 'administrative/manage_users'
  | 'administrative/manage_agents'
  | 'administrative/system_config'
  // Generic text generation (always allowed)
  | 'generate_text';

/**
 * Capability definition with metadata
 */
export interface CapabilityDefinition {
  /** Unique identifier */
  id: Capability;
  /** Human-readable name */
  name: string;
  /** Description of what this capability allows */
  description: string;
  /** Category for grouping */
  category: CapabilityCategory;
  /** Minimum trust score required */
  minTrustScore: number;
  /** Risk level of this capability */
  riskLevel: RiskLevel;
  /** Whether human approval is always required */
  requiresHumanApproval: boolean;
}

// =============================================================================
// RISK TYPES
// =============================================================================

/**
 * Risk classification levels per EU AI Act alignment
 */
export type RiskLevel = 
  | 'minimal'      // Tier 1: Auto-approve
  | 'limited'      // Tier 2: Policy check
  | 'significant'  // Tier 3: Enhanced review
  | 'high';        // Tier 4: Human required

/**
 * Risk assessment for an action
 */
export interface RiskAssessment {
  /** Overall risk level */
  level: RiskLevel;
  /** Numerical risk score (0-100) */
  score: number;
  /** Factors contributing to risk */
  factors: RiskFactor[];
  /** Recommended governance path */
  recommendedPath: GovernancePath;
}

/**
 * Individual risk factor
 */
export interface RiskFactor {
  /** Factor identifier */
  id: string;
  /** Factor name */
  name: string;
  /** Contribution to overall risk (0-1) */
  weight: number;
  /** Current value */
  value: number;
  /** Explanation */
  description: string;
}

/**
 * Governance routing path
 */
export type GovernancePath = 
  | 'auto_approve'    // Green: Immediate execution
  | 'policy_check'    // Yellow: Automated policy evaluation
  | 'enhanced_review' // Orange: Additional validation
  | 'human_required'; // Red: Human-in-the-loop

// =============================================================================
// GOVERNANCE TYPES
// =============================================================================

/**
 * Governance decision outcomes
 */
export type GovernanceDecision = 
  | 'ALLOW'     // Action permitted
  | 'DENY'      // Action blocked
  | 'ESCALATE'  // Requires higher authority
  | 'DEGRADE';  // Partial execution allowed

/**
 * Complete governance result
 */
export interface GovernanceResult {
  /** The decision made */
  decision: GovernanceDecision;
  /** Human-readable reason */
  reason: string;
  /** Agent's trust score at decision time */
  trustScore: number;
  /** Capabilities that were evaluated */
  capabilitiesEvaluated: Capability[];
  /** Capabilities that were granted */
  capabilitiesGranted: Capability[];
  /** Capabilities that were denied */
  capabilitiesDenied: Capability[];
  /** Risk assessment */
  risk: RiskAssessment;
  /** Proof record ID for audit */
  proofId?: string;
  /** Blockchain anchor transaction hash */
  chainAnchor?: string;
  /** Timestamp of decision */
  timestamp: Date;
  /** Processing time in ms */
  latencyMs: number;
}

/**
 * Governance request input
 */
export interface GovernanceRequest {
  /** Agent requesting action */
  agentId: string;
  /** Action being requested */
  action: string;
  /** Action payload */
  payload: Record<string, unknown>;
  /** Request context */
  context: GovernanceContext;
  /** Optional idempotency key */
  idempotencyKey?: string;
}

/**
 * Context for governance decisions
 */
export interface GovernanceContext {
  /** User ID if user-initiated */
  userId?: string;
  /** Organization ID */
  organizationId?: string;
  /** Session ID */
  sessionId?: string;
  /** IP address */
  ipAddress?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// AGENT TYPES
// =============================================================================

/**
 * Agent states
 */
export type AgentStatus = 
  | 'active'
  | 'paused'
  | 'suspended'
  | 'terminated';

/**
 * Agent definition
 */
export interface Agent {
  /** Unique agent identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Agent description */
  description?: string;
  /** Semantic version */
  version: string;
  /** Current status */
  status: AgentStatus;
  /** Trust score */
  trustScore: TrustScore;
  /** Declared capabilities */
  capabilities: Capability[];
  /** Agent manifest */
  manifest: AgentManifest;
  /** Owner organization */
  organizationId: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Agent manifest (declaration of intent)
 */
export interface AgentManifest {
  /** BASIS version this agent targets */
  basisVersion: string;
  /** Capabilities declaration */
  capabilities: {
    /** Capabilities the agent declares it needs */
    declared: Capability[];
    /** Optional justification */
    justification?: string;
  };
  /** Governance configuration */
  governance: {
    /** Endpoint for escalation callbacks */
    escalationEndpoint?: string;
    /** Endpoint for audit queries */
    auditEndpoint?: string;
    /** Custom policy overrides */
    policyOverrides?: Record<string, unknown>;
  };
  /** Model information */
  model?: {
    /** Model provider */
    provider: string;
    /** Model identifier */
    modelId: string;
    /** Model version */
    version?: string;
  };
}

// =============================================================================
// AUDIT TYPES
// =============================================================================

/**
 * Audit event types
 */
export type AuditEventType = 
  | 'AGENT_REGISTERED'
  | 'AGENT_UPDATED'
  | 'AGENT_PAUSED'
  | 'AGENT_RESUMED'
  | 'AGENT_TERMINATED'
  | 'ACTION_REQUESTED'
  | 'ACTION_ALLOWED'
  | 'ACTION_DENIED'
  | 'ACTION_ESCALATED'
  | 'TRUST_UPDATED'
  | 'POLICY_CHANGED'
  | 'HUMAN_OVERRIDE'
  | 'CHAIN_ANCHORED';

/**
 * Audit record for immutable logging
 */
export interface AuditRecord {
  /** Unique record ID */
  id: string;
  /** Event type */
  eventType: AuditEventType;
  /** Agent involved */
  agentId: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event details */
  details: Record<string, unknown>;
  /** Hash of this record */
  hash: string;
  /** Hash of previous record (chain) */
  previousHash: string;
  /** Signature for verification */
  signature?: string;
  /** Blockchain anchor if anchored */
  chainAnchor?: ChainAnchor;
}

/**
 * Blockchain anchor reference
 */
export interface ChainAnchor {
  /** Chain identifier (e.g., 'polygon', 'ethereum') */
  chain: string;
  /** Transaction hash */
  txHash: string;
  /** Block number */
  blockNumber: number;
  /** Timestamp of anchoring */
  anchoredAt: Date;
  /** Merkle proof if batched */
  merkleProof?: string[];
}

// =============================================================================
// CERTIFICATION TYPES
// =============================================================================

/**
 * Certification levels
 */
export type CertificationLevel = 
  | 'bronze'    // Basic compliance
  | 'silver'    // Standard compliance
  | 'gold'      // Enhanced compliance
  | 'platinum'; // Full compliance + audit

/**
 * Certification status
 */
export type CertificationStatus = 
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'revoked';

/**
 * Agent certification
 */
export interface Certification {
  /** Certification ID */
  id: string;
  /** Agent being certified */
  agentId: string;
  /** Certification level */
  level: CertificationLevel;
  /** Current status */
  status: CertificationStatus;
  /** Issue date */
  issuedAt?: Date;
  /** Expiration date */
  expiresAt?: Date;
  /** Last audit date */
  lastAuditAt?: Date;
  /** Compliance test results */
  testResults?: ComplianceTestResult[];
  /** Stake amount (in ANCR tokens) */
  stakeAmount?: number;
}

/**
 * Compliance test result
 */
export interface ComplianceTestResult {
  /** Test category */
  category: 'intent' | 'enforce' | 'proof' | 'chain';
  /** Tests passed */
  passed: number;
  /** Tests failed */
  failed: number;
  /** Total tests */
  total: number;
  /** Pass percentage */
  percentage: number;
  /** Individual test results */
  details?: TestDetail[];
}

/**
 * Individual test detail
 */
export interface TestDetail {
  /** Test ID */
  id: string;
  /** Test name */
  name: string;
  /** Passed or failed */
  passed: boolean;
  /** Error message if failed */
  error?: string;
  /** Duration in ms */
  durationMs: number;
}

// =============================================================================
// POLICY TYPES
// =============================================================================

/**
 * Policy condition operators
 */
export type PolicyOperator = 
  | 'eq'   // equals
  | 'neq'  // not equals
  | 'gt'   // greater than
  | 'gte'  // greater than or equal
  | 'lt'   // less than
  | 'lte'  // less than or equal
  | 'in'   // in array
  | 'nin'  // not in array
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'matches'; // regex

/**
 * Policy condition
 */
export interface PolicyCondition {
  /** Field to evaluate */
  field: string;
  /** Operator */
  operator: PolicyOperator;
  /** Value to compare against */
  value: unknown;
}

/**
 * Policy rule
 */
export interface PolicyRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description?: string;
  /** Conditions (all must match) */
  conditions: PolicyCondition[];
  /** Action if conditions match */
  action: GovernanceDecision;
  /** Priority (higher = evaluated first) */
  priority: number;
  /** Whether rule is enabled */
  enabled: boolean;
}

/**
 * Complete policy document
 */
export interface Policy {
  /** Policy ID */
  id: string;
  /** Policy version */
  version: string;
  /** Policy name */
  name: string;
  /** Policy description */
  description?: string;
  /** Rules in this policy */
  rules: PolicyRule[];
  /** Default action if no rules match */
  defaultAction: GovernanceDecision;
  /** Organization this policy belongs to */
  organizationId?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * BASIS error codes
 */
export type BasisErrorCode = 
  | 'AGENT_NOT_FOUND'
  | 'INSUFFICIENT_TRUST'
  | 'CAPABILITY_DENIED'
  | 'POLICY_VIOLATION'
  | 'RATE_LIMITED'
  | 'INVALID_REQUEST'
  | 'CHAIN_ERROR'
  | 'INTERNAL_ERROR';

/**
 * BASIS error
 */
export class BasisError extends Error {
  constructor(
    public code: BasisErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BasisError';
  }
}
