/**
 * Typed Security Layer Interface
 *
 * Formalizes the L0-L46 security layers with explicit input/output contracts,
 * failure semantics, and threat classifications.
 *
 * @packageDocumentation
 */

import type { ID, ControlAction, TrustLevel, Timestamp } from '../common/types.js';

/**
 * Threat classes that security layers can address
 */
export type ThreatClass =
  | 'prompt_injection'
  | 'privilege_escalation'
  | 'resource_abuse'
  | 'data_exfiltration'
  | 'unauthorized_action'
  | 'trust_manipulation'
  | 'denial_of_service'
  | 'replay_attack'
  | 'side_channel'
  | 'supply_chain'
  | 'goal_misalignment'
  | 'deceptive_output'
  | 'capability_abuse'
  | 'audit_evasion';

/**
 * How a layer should behave on failure
 */
export type FailMode = 'block' | 'degrade' | 'escalate' | 'warn' | 'log_only';

/**
 * Security layer tiers (grouped by defense depth)
 */
export type LayerTier =
  | 'input_validation'    // L0-L5: Input sanitization
  | 'intent_analysis'     // L6-L15: Intent parsing and risk assessment
  | 'trust_evaluation'    // L16-L25: Trust scoring and capability checks
  | 'policy_enforcement'  // L26-L35: Rule evaluation and decision
  | 'output_validation'   // L36-L42: Response sanitization
  | 'audit_compliance';   // L43-L46: Proof generation and compliance

/**
 * Schema definition for layer inputs/outputs
 */
export interface LayerSchema {
  /** Schema identifier */
  schemaId: string;
  /** JSON Schema or TypeScript type reference */
  definition: string;
  /** Required fields */
  required: string[];
  /** Optional fields */
  optional: string[];
  /** Validation rules */
  validations: SchemaValidation[];
}

/**
 * Individual validation rule
 */
export interface SchemaValidation {
  field: string;
  rule: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  constraint: string | number | boolean | Record<string, unknown>;
  errorMessage: string;
}

/**
 * Configuration for a security layer
 */
export interface SecurityLayerConfig {
  /** Unique layer identifier (0-46) */
  layerId: number;
  /** Human-readable name */
  name: string;
  /** Description of what this layer does */
  description: string;
  /** Layer tier for grouping */
  tier: LayerTier;
  /** Primary threat class this layer addresses */
  primaryThreat: ThreatClass;
  /** Additional threat classes addressed */
  secondaryThreats: ThreatClass[];
  /** Input schema */
  inputSchema: LayerSchema;
  /** Output schema */
  outputSchema: LayerSchema;
  /** Behavior on failure */
  failMode: FailMode;
  /** Whether this layer is required (cannot be skipped) */
  required: boolean;
  /** Maximum execution time in ms */
  timeoutMs: number;
  /** Whether layer can be executed in parallel with others */
  parallelizable: boolean;
  /** Layers that must run before this one */
  dependencies: number[];
}

/**
 * Input to a security layer
 */
export interface LayerInput {
  /** Unique request ID for tracing */
  requestId: ID;
  /** Entity making the request */
  entityId: ID;
  /** Entity's current trust level */
  trustLevel: TrustLevel;
  /** The intent or action being evaluated */
  payload: Record<string, unknown>;
  /** Results from previous layers */
  priorResults: LayerExecutionResult[];
  /** Metadata for the request */
  metadata: LayerMetadata;
}

/**
 * Metadata attached to layer inputs
 */
export interface LayerMetadata {
  /** When the request was initiated */
  requestTimestamp: Timestamp;
  /** Source of the request */
  source: string;
  /** Session or conversation ID */
  sessionId?: ID;
  /** Additional context */
  context: Record<string, unknown>;
}

/**
 * Result from executing a security layer
 */
export interface LayerExecutionResult {
  /** Layer that produced this result */
  layerId: number;
  /** Layer name */
  layerName: string;
  /** Whether the layer passed */
  passed: boolean;
  /** Recommended action based on layer evaluation */
  action: ControlAction;
  /** Confidence in this result (0-1) */
  confidence: number;
  /** Risk level determined by this layer */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Detailed findings */
  findings: LayerFinding[];
  /** Any modifications to the input/intent */
  modifications: LayerModification[];
  /** Execution timing */
  timing: LayerTiming;
  /** Error if layer failed */
  error?: LayerError;
}

/**
 * A finding from a security layer
 */
export interface LayerFinding {
  /** Finding type */
  type: 'threat_detected' | 'anomaly' | 'policy_violation' | 'warning' | 'info';
  /** Severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Finding code for programmatic handling */
  code: string;
  /** Human-readable description */
  description: string;
  /** Evidence supporting this finding */
  evidence: string[];
  /** Recommended remediation */
  remediation?: string;
}

/**
 * A modification made by a security layer
 */
export interface LayerModification {
  /** What was modified */
  target: string;
  /** Type of modification */
  type: 'sanitize' | 'redact' | 'transform' | 'restrict' | 'annotate';
  /** Original value (may be redacted for sensitive data) */
  originalValue?: unknown;
  /** New value after modification */
  newValue: unknown;
  /** Reason for modification */
  reason: string;
}

/**
 * Timing information for layer execution
 */
export interface LayerTiming {
  /** When execution started */
  startedAt: Timestamp;
  /** When execution completed */
  completedAt: Timestamp;
  /** Total duration in ms */
  durationMs: number;
  /** Time spent waiting for dependencies */
  waitTimeMs: number;
  /** Time spent in actual processing */
  processingTimeMs: number;
}

/**
 * Error from a layer execution
 */
export interface LayerError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Whether this error is retryable */
  retryable: boolean;
  /** Stack trace (only in development) */
  stack?: string;
  /** Original error if this is a wrapper */
  cause?: unknown;
}

/**
 * Interface that all security layers must implement
 */
export interface SecurityLayer {
  /** Get layer configuration */
  getConfig(): SecurityLayerConfig;

  /**
   * Execute the layer's security check
   * @param input - The input to evaluate
   * @returns The layer's execution result
   */
  execute(input: LayerInput): Promise<LayerExecutionResult>;

  /**
   * Validate input against the layer's input schema
   * @param input - The input to validate
   * @returns Validation result with any errors
   */
  validateInput(input: LayerInput): ValidationResult;

  /**
   * Check if the layer is healthy and can process requests
   * @returns Health status
   */
  healthCheck(): Promise<LayerHealthStatus>;

  /**
   * Reset any stateful components of the layer
   */
  reset(): Promise<void>;
}

/**
 * Result of input validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * A validation error
 */
export interface ValidationError {
  field: string;
  rule: string;
  message: string;
  value?: unknown;
}

/**
 * Health status of a layer
 */
export interface LayerHealthStatus {
  healthy: boolean;
  lastCheck: Timestamp;
  issues: string[];
  metrics: {
    requestsProcessed: number;
    averageLatencyMs: number;
    errorRate: number;
  };
}

/**
 * Result from executing the full security pipeline
 */
export interface PipelineResult {
  /** Unique ID for this pipeline execution */
  executionId: ID;
  /** Overall decision */
  decision: ControlAction;
  /** Confidence in the decision (0-1) */
  confidence: number;
  /** Overall risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Results from each layer */
  layerResults: LayerExecutionResult[];
  /** Layers that passed */
  layersPassed: number[];
  /** Layers that failed */
  layersFailed: number[];
  /** Layers that were skipped */
  layersSkipped: number[];
  /** Total execution time */
  totalDurationMs: number;
  /** Any modifications made to the original request */
  modifications: LayerModification[];
  /** Aggregated findings */
  findings: LayerFinding[];
  /** Explanation of the decision */
  explanation: string;
  /** When pipeline execution completed */
  completedAt: Timestamp;
}

/**
 * Configuration for the security pipeline
 */
export interface PipelineConfig {
  /** Which layers to run (defaults to all) */
  enabledLayers?: number[];
  /** Layers to skip */
  disabledLayers?: number[];
  /** Maximum total execution time */
  maxTotalTimeMs: number;
  /** Whether to stop on first failure */
  stopOnFirstFailure: boolean;
  /** Minimum confidence threshold to pass */
  minConfidenceThreshold: number;
  /** Whether to run parallelizable layers in parallel */
  enableParallelExecution: boolean;
  /** Custom fail mode overrides */
  failModeOverrides?: Record<number, FailMode>;
}

/**
 * Events emitted during pipeline execution
 */
export type PipelineEvent =
  | { type: 'pipeline_started'; executionId: ID; timestamp: Timestamp }
  | { type: 'layer_started'; layerId: number; timestamp: Timestamp }
  | { type: 'layer_completed'; layerId: number; result: LayerExecutionResult; timestamp: Timestamp }
  | { type: 'layer_failed'; layerId: number; error: LayerError; timestamp: Timestamp }
  | { type: 'layer_skipped'; layerId: number; reason: string; timestamp: Timestamp }
  | { type: 'pipeline_completed'; result: PipelineResult; timestamp: Timestamp };

/**
 * Listener for pipeline events
 */
export type PipelineEventListener = (event: PipelineEvent) => void;
