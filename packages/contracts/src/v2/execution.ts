/**
 * Execution types - for ERA (Execution Runtime Architecture)
 */

/**
 * Action to be executed
 */
export interface Action {
  /** Unique action identifier */
  actionId: string;
  /** Decision that authorized this action */
  decisionId: string;
  /** Correlation ID for tracing */
  correlationId: string;

  /** Type of action (maps to adapter) */
  type: string;
  /** Action parameters */
  parameters: Record<string, unknown>;

  /** Constraints from authorization decision */
  constraints: ActionConstraints;
}

/**
 * Constraints applied to action execution
 */
export interface ActionConstraints {
  /** Tools allowed for this action */
  allowedTools: string[];
  /** Data scopes accessible */
  dataScopes: string[];
  /** Maximum execution time */
  maxExecutionTimeMs: number;
  /** Maximum retries */
  maxRetries: number;
  /** Must be reversible */
  reversibilityRequired: boolean;
}

/**
 * Execution context passed to adapters
 */
export interface ExecutionContext {
  /** Execution ID */
  executionId: string;
  /** Action being executed */
  action: Action;
  /** Current retry attempt (0-based) */
  attemptNumber: number;
  /** Deadline for execution */
  deadline: Date;
  /** Metadata to include in audit */
  auditMetadata: Record<string, unknown>;
}

/**
 * Validation result before execution
 */
export interface ValidationResult {
  /** Is the action valid? */
  valid: boolean;
  /** Validation errors if invalid */
  errors: ValidationError[];
  /** Warnings (non-blocking) */
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

/**
 * Execution result from adapter
 */
export interface ExecutionResult {
  /** Unique execution ID */
  executionId: string;
  /** Action that was executed */
  actionId: string;
  /** Execution status */
  status: 'success' | 'failure' | 'partial';

  /** Output data */
  output: Record<string, unknown>;
  /** Errors if any */
  errors?: ExecutionError[];

  /** Timing */
  startedAt: Date;
  completedAt: Date;
  durationMs: number;

  /** Can this be rolled back? */
  rollbackable: boolean;
  /** Data needed for rollback */
  rollbackData?: Record<string, unknown>;
}

export interface ExecutionError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

/**
 * Redacted result for audit (sensitive data removed)
 */
export interface RedactedResult {
  executionId: string;
  actionId: string;
  status: string;
  outputKeys: string[];
  errorCodes?: string[];
  durationMs: number;
  redactedFields: string[];
}

/**
 * Execution digest for proof plane
 */
export interface ExecutionDigest {
  /** Execution ID */
  executionId: string;
  /** Action ID */
  actionId: string;
  /** Correlation ID */
  correlationId: string;

  /** Final status */
  status: string;
  /** SHA-256 hash of output */
  outputHash: string;
  /** Duration in milliseconds */
  durationMs: number;

  /** When digest was created */
  timestamp: Date;
}

/**
 * Rollback result
 */
export interface RollbackResult {
  /** Rollback ID */
  rollbackId: string;
  /** Original execution ID */
  executionId: string;
  /** Was rollback successful? */
  success: boolean;
  /** Rollback status details */
  status: 'completed' | 'partial' | 'failed';
  /** Error if failed */
  error?: string;
  /** When rollback completed */
  completedAt: Date;
}

/**
 * Tool adapter metadata
 */
export interface ToolAdapterMetadata {
  /** Adapter ID */
  adapterId: string;
  /** Adapter name */
  name: string;
  /** Version */
  version: string;
  /** Supported action types */
  capabilities: string[];
  /** Is adapter healthy? */
  healthy: boolean;
  /** Last health check */
  lastHealthCheck: Date;
}

/**
 * Request to execute an action
 */
export interface ExecuteActionRequest {
  /** The authorized decision */
  decisionId: string;
  /** Action type */
  type: string;
  /** Action parameters */
  parameters: Record<string, unknown>;
  /** Optional: specific adapter to use */
  adapterId?: string;
}

/**
 * Request to rollback an execution
 */
export interface RollbackRequest {
  /** Execution to rollback */
  executionId: string;
  /** Reason for rollback */
  reason: string;
  /** Who initiated the rollback */
  initiatedBy: string;
}
