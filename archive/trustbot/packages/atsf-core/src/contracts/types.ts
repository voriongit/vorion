/**
 * Output Contract Types (VorionResponse)
 *
 * Machine-readable, auditable, replayable output contracts
 * with confidence scores, assumptions, and invalidity conditions.
 *
 * @packageDocumentation
 */

import type { ID, Timestamp, ControlAction, TrustLevel } from '../common/types.js';

/**
 * Standard Vorion response contract
 */
export interface VorionResponse<T = unknown> {
  /** Response identifier */
  responseId: ID;

  /** Request that generated this response */
  requestId: ID;

  /** Whether the operation succeeded */
  success: boolean;

  /** The actual response payload */
  payload: T;

  /** Confidence in this response (0-1) */
  confidence: ResponseConfidence;

  /** Assumptions made to generate this response */
  assumptions: Assumption[];

  /** Conditions that would invalidate this response */
  invalidityConditions: InvalidityCondition[];

  /** Governance decision applied */
  governance: GovernanceDecision;

  /** Provenance tracking */
  provenance: ResponseProvenance;

  /** Timing information */
  timing: ResponseTiming;

  /** Replay information for reproducibility */
  replay: ReplayInfo;

  /** Response metadata */
  metadata: ResponseMetadata;
}

/**
 * Vorion error response
 */
export interface VorionErrorResponse {
  /** Response identifier */
  responseId: ID;

  /** Request that generated this error */
  requestId: ID;

  /** Always false for errors */
  success: false;

  /** Error details */
  error: ContractError;

  /** Governance decision that led to error (if applicable) */
  governance?: GovernanceDecision;

  /** What was attempted before failure */
  attempted: AttemptedAction[];

  /** Suggested remediation steps */
  remediation: RemediationStep[];

  /** Timing information */
  timing: ResponseTiming;

  /** Response metadata */
  metadata: ResponseMetadata;
}

/**
 * Confidence information for a response
 */
export interface ResponseConfidence {
  /** Overall confidence score (0-1) */
  overall: number;

  /** Confidence breakdown by component */
  breakdown: ConfidenceComponent[];

  /** Factors that reduced confidence */
  reducingFactors: ConfidenceFactor[];

  /** Factors that increased confidence */
  boostingFactors: ConfidenceFactor[];

  /** Confidence calibration source */
  calibration: 'historical' | 'model' | 'heuristic' | 'expert';
}

/**
 * Component contributing to confidence
 */
export interface ConfidenceComponent {
  component: string;
  confidence: number;
  weight: number;
  explanation: string;
}

/**
 * Factor affecting confidence
 */
export interface ConfidenceFactor {
  factor: string;
  impact: number;
  explanation: string;
}

/**
 * An assumption made during processing
 */
export interface Assumption {
  /** Assumption identifier */
  id: string;

  /** What was assumed */
  assumption: string;

  /** Category of assumption */
  category: AssumptionCategory;

  /** How critical is this assumption */
  criticality: 'low' | 'medium' | 'high' | 'critical';

  /** Confidence that assumption holds (0-1) */
  confidence: number;

  /** What happens if assumption is wrong */
  fallbackBehavior: string;

  /** Evidence supporting the assumption */
  supportingEvidence: string[];

  /** How to verify the assumption */
  verification?: string;
}

/**
 * Categories of assumptions
 */
export type AssumptionCategory =
  | 'input_validity'      // Assuming input is valid/correct
  | 'context_stability'   // Assuming context won't change
  | 'resource_availability' // Assuming resources are available
  | 'permission_granted'  // Assuming permissions exist
  | 'data_freshness'      // Assuming data is current
  | 'model_accuracy'      // Assuming model predictions are accurate
  | 'external_service'    // Assuming external services work
  | 'user_intent';        // Assuming we understood user intent

/**
 * A condition that would invalidate the response
 */
export interface InvalidityCondition {
  /** Condition identifier */
  id: string;

  /** What would make response invalid */
  condition: string;

  /** Category of invalidation */
  category: InvalidityCategory;

  /** Severity if condition occurs */
  severity: 'minor' | 'moderate' | 'major' | 'complete';

  /** How to detect if condition occurs */
  detection: string;

  /** Recommended action if condition occurs */
  recommendedAction: string;

  /** Time sensitivity (if applicable) */
  timeLimit?: number;
}

/**
 * Categories of invalidity
 */
export type InvalidityCategory =
  | 'temporal'            // Time-based expiration
  | 'state_change'        // System state changed
  | 'data_update'         // Underlying data changed
  | 'permission_revoked'  // Permissions changed
  | 'context_shift'       // Context no longer applies
  | 'external_factor'     // External conditions changed
  | 'security_event';     // Security-related invalidation

/**
 * Governance decision applied to request
 */
export interface GovernanceDecision {
  /** Decision identifier */
  decisionId: ID;

  /** Action taken */
  action: ControlAction;

  /** Trust level of requester */
  trustLevel: TrustLevel;

  /** Rules that were applied */
  rulesApplied: AppliedRule[];

  /** Any modifications made to the request */
  modifications: RequestModification[];

  /** Constraints applied to the response */
  constraints: ResponseConstraint[];

  /** Human approvals obtained (if any) */
  approvals: Approval[];
}

/**
 * A rule that was applied
 */
export interface AppliedRule {
  ruleId: ID;
  ruleName: string;
  effect: string;
  reason: string;
}

/**
 * Modification made to original request
 */
export interface RequestModification {
  field: string;
  originalValue: unknown;
  modifiedValue: unknown;
  reason: string;
}

/**
 * Constraint applied to response
 */
export interface ResponseConstraint {
  type: 'scope_limit' | 'rate_limit' | 'data_filter' | 'output_redact' | 'capability_restrict';
  target: string;
  constraint: string;
  reason: string;
}

/**
 * Human approval obtained
 */
export interface Approval {
  approver: string;
  role: string;
  timestamp: Timestamp;
  scope: string;
  expiresAt?: Timestamp;
}

/**
 * Provenance information for the response
 */
export interface ResponseProvenance {
  /** Chain of processing steps */
  processingChain: ProcessingStep[];

  /** Data sources used */
  dataSources: DataSource[];

  /** Models/algorithms used */
  modelsUsed: ModelReference[];

  /** Hash of inputs for verification */
  inputHash: string;

  /** Hash of outputs for verification */
  outputHash: string;

  /** Full provenance record ID */
  provenanceRecordId?: ID;
}

/**
 * A step in the processing chain
 */
export interface ProcessingStep {
  stepNumber: number;
  component: string;
  action: string;
  input: string;
  output: string;
  durationMs: number;
}

/**
 * A data source used
 */
export interface DataSource {
  sourceId: string;
  sourceName: string;
  sourceType: 'database' | 'api' | 'cache' | 'model' | 'user_input' | 'system';
  dataTimestamp: Timestamp;
  confidence: number;
}

/**
 * Reference to a model/algorithm used
 */
export interface ModelReference {
  modelId: string;
  modelName: string;
  version: string;
  purpose: string;
}

/**
 * Timing information
 */
export interface ResponseTiming {
  /** When request was received */
  requestedAt: Timestamp;

  /** When processing started */
  processingStartedAt: Timestamp;

  /** When response was generated */
  respondedAt: Timestamp;

  /** Total duration in ms */
  totalDurationMs: number;

  /** Time spent in each phase */
  phases: {
    parsing: number;
    governance: number;
    processing: number;
    validation: number;
    serialization: number;
  };
}

/**
 * Information for replaying the request
 */
export interface ReplayInfo {
  /** Whether this response can be replayed */
  replayable: boolean;

  /** Deterministic seed (if applicable) */
  seed?: string;

  /** Snapshot of relevant state */
  stateSnapshot: Record<string, unknown>;

  /** External dependencies that must match */
  externalDependencies: ExternalDependency[];

  /** Instructions for replay */
  replayInstructions: string;
}

/**
 * External dependency for replay
 */
export interface ExternalDependency {
  name: string;
  type: 'api' | 'database' | 'service' | 'model';
  version: string;
  stateAtRequest: Record<string, unknown>;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  /** API version */
  apiVersion: string;

  /** Engine version */
  engineVersion: string;

  /** Request correlation ID */
  correlationId: ID;

  /** Session ID (if applicable) */
  sessionId?: ID;

  /** Tags for categorization */
  tags: string[];

  /** Custom metadata */
  custom: Record<string, unknown>;
}

/**
 * Vorion error details
 */
export interface ContractError {
  /** Error code */
  code: string;

  /** Error message */
  message: string;

  /** Error category */
  category: ErrorCategory;

  /** Is this error retryable */
  retryable: boolean;

  /** Retry delay suggestion (ms) */
  retryAfterMs?: number;

  /** Detailed error context */
  context: Record<string, unknown>;

  /** Stack trace (only in development) */
  stack?: string;

  /** Nested errors */
  causes?: ContractError[];
}

/**
 * Error categories
 */
export type ErrorCategory =
  | 'validation'        // Input validation failed
  | 'authorization'     // Permission denied
  | 'governance'        // Governance decision blocked
  | 'resource'          // Resource unavailable
  | 'external'          // External service failure
  | 'internal'          // Internal system error
  | 'timeout'           // Operation timed out
  | 'rate_limit'        // Rate limit exceeded
  | 'containment';      // Containment restriction

/**
 * Action that was attempted before failure
 */
export interface AttemptedAction {
  action: string;
  result: 'success' | 'partial' | 'failed';
  details: string;
}

/**
 * Step for remediation
 */
export interface RemediationStep {
  step: number;
  action: string;
  description: string;
  automated: boolean;
}

/**
 * Request to create a VorionResponse
 */
export interface CreateResponseRequest<T = unknown> {
  requestId: ID;
  payload: T;
  confidence?: Partial<ResponseConfidence>;
  assumptions?: Assumption[];
  invalidityConditions?: InvalidityCondition[];
  governance?: GovernanceDecision;
  metadata?: Partial<ResponseMetadata>;
}

/**
 * Request to create a VorionErrorResponse
 */
export interface CreateErrorRequest {
  requestId: ID;
  error: Omit<ContractError, 'retryAfterMs'> & { retryAfterMs?: number };
  governance?: GovernanceDecision;
  attempted?: AttemptedAction[];
  remediation?: RemediationStep[];
  metadata?: Partial<ResponseMetadata>;
}
