/**
 * Output Contract Service (VorionResponse)
 *
 * Creates machine-readable, auditable, replayable output contracts
 * with confidence, assumptions, and invalidity conditions.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { ID } from '../common/types.js';
import type {
  VorionResponse,
  VorionErrorResponse,
  ResponseConfidence,
  Assumption,
  InvalidityCondition,
  GovernanceDecision,
  ResponseProvenance,
  ResponseTiming,
  ReplayInfo,
  ResponseMetadata,
  ProcessingStep,
  DataSource,
  ModelReference,
  ContractError,
  AttemptedAction,
  RemediationStep,
  AssumptionCategory,
  InvalidityCategory,
  ErrorCategory,
} from './types.js';

export * from './types.js';

const logger = createLogger({ component: 'contracts' });

/**
 * Builder for creating VorionResponse objects
 */
export class ResponseBuilder<T = unknown> {
  private requestId: ID;
  private startTime: number;
  private processingSteps: ProcessingStep[] = [];
  private dataSources: DataSource[] = [];
  private modelsUsed: ModelReference[] = [];
  private assumptions: Assumption[] = [];
  private invalidityConditions: InvalidityCondition[] = [];
  private confidenceComponents: Array<{ component: string; confidence: number; weight: number; explanation: string }> = [];
  private confidenceReducers: Array<{ factor: string; impact: number; explanation: string }> = [];
  private confidenceBoosters: Array<{ factor: string; impact: number; explanation: string }> = [];
  private stateSnapshot: Record<string, unknown> = {};
  private externalDeps: Array<{ name: string; type: 'api' | 'database' | 'service' | 'model'; version: string; stateAtRequest: Record<string, unknown> }> = [];
  private metadata: Partial<ResponseMetadata> = {};
  private governance?: GovernanceDecision;

  constructor(requestId: ID) {
    this.requestId = requestId;
    this.startTime = Date.now();
  }

  /**
   * Add a processing step
   */
  addProcessingStep(
    component: string,
    action: string,
    input: string,
    output: string,
    durationMs: number
  ): this {
    this.processingSteps.push({
      stepNumber: this.processingSteps.length + 1,
      component,
      action,
      input,
      output,
      durationMs,
    });
    return this;
  }

  /**
   * Add a data source
   */
  addDataSource(source: DataSource): this {
    this.dataSources.push(source);
    return this;
  }

  /**
   * Add a model reference
   */
  addModelUsed(model: ModelReference): this {
    this.modelsUsed.push(model);
    return this;
  }

  /**
   * Add an assumption
   */
  addAssumption(assumption: Omit<Assumption, 'id'>): this {
    this.assumptions.push({
      id: `assumption-${this.assumptions.length + 1}`,
      ...assumption,
    });
    return this;
  }

  /**
   * Add an invalidity condition
   */
  addInvalidityCondition(condition: Omit<InvalidityCondition, 'id'>): this {
    this.invalidityConditions.push({
      id: `invalidity-${this.invalidityConditions.length + 1}`,
      ...condition,
    });
    return this;
  }

  /**
   * Add a confidence component
   */
  addConfidenceComponent(
    component: string,
    confidence: number,
    weight: number,
    explanation: string
  ): this {
    this.confidenceComponents.push({ component, confidence, weight, explanation });
    return this;
  }

  /**
   * Add a confidence-reducing factor
   */
  addConfidenceReducer(factor: string, impact: number, explanation: string): this {
    this.confidenceReducers.push({ factor, impact, explanation });
    return this;
  }

  /**
   * Add a confidence-boosting factor
   */
  addConfidenceBooster(factor: string, impact: number, explanation: string): this {
    this.confidenceBoosters.push({ factor, impact, explanation });
    return this;
  }

  /**
   * Set governance decision
   */
  setGovernance(governance: GovernanceDecision): this {
    this.governance = governance;
    return this;
  }

  /**
   * Add state snapshot for replay
   */
  addStateSnapshot(key: string, value: unknown): this {
    this.stateSnapshot[key] = value;
    return this;
  }

  /**
   * Add external dependency for replay
   */
  addExternalDependency(
    name: string,
    type: 'api' | 'database' | 'service' | 'model',
    version: string,
    stateAtRequest: Record<string, unknown> = {}
  ): this {
    this.externalDeps.push({ name, type, version, stateAtRequest });
    return this;
  }

  /**
   * Set metadata
   */
  setMetadata(metadata: Partial<ResponseMetadata>): this {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  /**
   * Build the final response
   */
  async build(payload: T, success: boolean = true): Promise<VorionResponse<T>> {
    const now = new Date().toISOString();
    const totalDurationMs = Date.now() - this.startTime;

    // Calculate confidence
    const confidence = this.calculateConfidence();

    // Calculate hashes
    const inputHash = await this.calculateHash(JSON.stringify({ requestId: this.requestId }));
    const outputHash = await this.calculateHash(JSON.stringify(payload));

    // Build provenance
    const provenance: ResponseProvenance = {
      processingChain: this.processingSteps,
      dataSources: this.dataSources,
      modelsUsed: this.modelsUsed,
      inputHash,
      outputHash,
    };

    // Build timing
    const timing: ResponseTiming = {
      requestedAt: new Date(this.startTime).toISOString(),
      processingStartedAt: new Date(this.startTime).toISOString(),
      respondedAt: now,
      totalDurationMs,
      phases: this.calculatePhases(totalDurationMs),
    };

    // Build replay info
    const replay: ReplayInfo = {
      replayable: this.isReplayable(),
      seed: crypto.randomUUID(),
      stateSnapshot: this.stateSnapshot,
      externalDependencies: this.externalDeps,
      replayInstructions: this.generateReplayInstructions(),
    };

    // Build metadata
    const metadata: ResponseMetadata = {
      apiVersion: '1.0.0',
      engineVersion: '1.0.0',
      correlationId: this.requestId,
      tags: [],
      custom: {},
      ...this.metadata,
    };

    const response: VorionResponse<T> = {
      responseId: crypto.randomUUID(),
      requestId: this.requestId,
      success,
      payload,
      confidence,
      assumptions: this.assumptions,
      invalidityConditions: this.invalidityConditions,
      governance: this.governance ?? this.createDefaultGovernance(),
      provenance,
      timing,
      replay,
      metadata,
    };

    logger.debug(
      {
        responseId: response.responseId,
        requestId: this.requestId,
        success,
        confidence: confidence.overall,
        assumptionCount: this.assumptions.length,
        invalidityCount: this.invalidityConditions.length,
      },
      'Response built'
    );

    return response;
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(): ResponseConfidence {
    // Calculate weighted average of components
    let totalWeight = 0;
    let weightedSum = 0;

    for (const component of this.confidenceComponents) {
      totalWeight += component.weight;
      weightedSum += component.confidence * component.weight;
    }

    let baseConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

    // Apply reducers
    for (const reducer of this.confidenceReducers) {
      baseConfidence -= reducer.impact;
    }

    // Apply boosters
    for (const booster of this.confidenceBoosters) {
      baseConfidence += booster.impact;
    }

    // Clamp to 0-1
    const overall = Math.max(0, Math.min(1, baseConfidence));

    return {
      overall,
      breakdown: this.confidenceComponents,
      reducingFactors: this.confidenceReducers,
      boostingFactors: this.confidenceBoosters,
      calibration: 'heuristic',
    };
  }

  /**
   * Calculate phase timings (simplified distribution)
   */
  private calculatePhases(totalMs: number): ResponseTiming['phases'] {
    // Approximate distribution
    return {
      parsing: Math.round(totalMs * 0.05),
      governance: Math.round(totalMs * 0.15),
      processing: Math.round(totalMs * 0.65),
      validation: Math.round(totalMs * 0.1),
      serialization: Math.round(totalMs * 0.05),
    };
  }

  /**
   * Check if response is replayable
   */
  private isReplayable(): boolean {
    // Non-deterministic operations make replay harder
    const hasNonDeterministic = this.modelsUsed.some(
      (m) => m.purpose.includes('random') || m.purpose.includes('sample')
    );
    return !hasNonDeterministic;
  }

  /**
   * Generate replay instructions
   */
  private generateReplayInstructions(): string {
    const steps: string[] = [
      '1. Restore state snapshot to matching values',
      '2. Ensure external dependencies are at specified versions',
    ];

    if (this.externalDeps.length > 0) {
      steps.push('3. Mock external services to return captured states');
    }

    steps.push(`${this.externalDeps.length > 0 ? '4' : '3'}. Replay request with original requestId`);

    return steps.join('\n');
  }

  /**
   * Create default governance decision
   */
  private createDefaultGovernance(): GovernanceDecision {
    return {
      decisionId: crypto.randomUUID(),
      action: 'allow',
      trustLevel: 2,
      rulesApplied: [],
      modifications: [],
      constraints: [],
      approvals: [],
    };
  }

  /**
   * Calculate SHA-256 hash
   */
  private async calculateHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * Builder for creating VorionErrorResponse objects
 */
export class ErrorResponseBuilder {
  private requestId: ID;
  private startTime: number;
  private attempted: AttemptedAction[] = [];
  private remediation: RemediationStep[] = [];
  private metadata: Partial<ResponseMetadata> = {};
  private governance?: GovernanceDecision;

  constructor(requestId: ID) {
    this.requestId = requestId;
    this.startTime = Date.now();
  }

  /**
   * Add an attempted action
   */
  addAttempted(action: string, result: 'success' | 'partial' | 'failed', details: string): this {
    this.attempted.push({ action, result, details });
    return this;
  }

  /**
   * Add a remediation step
   */
  addRemediation(action: string, description: string, automated: boolean = false): this {
    this.remediation.push({
      step: this.remediation.length + 1,
      action,
      description,
      automated,
    });
    return this;
  }

  /**
   * Set governance decision
   */
  setGovernance(governance: GovernanceDecision): this {
    this.governance = governance;
    return this;
  }

  /**
   * Set metadata
   */
  setMetadata(metadata: Partial<ResponseMetadata>): this {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  /**
   * Build the error response
   */
  build(error: ContractError): VorionErrorResponse {
    const now = new Date().toISOString();
    const totalDurationMs = Date.now() - this.startTime;

    const timing: ResponseTiming = {
      requestedAt: new Date(this.startTime).toISOString(),
      processingStartedAt: new Date(this.startTime).toISOString(),
      respondedAt: now,
      totalDurationMs,
      phases: {
        parsing: Math.round(totalDurationMs * 0.1),
        governance: Math.round(totalDurationMs * 0.2),
        processing: Math.round(totalDurationMs * 0.5),
        validation: Math.round(totalDurationMs * 0.1),
        serialization: Math.round(totalDurationMs * 0.1),
      },
    };

    const metadata: ResponseMetadata = {
      apiVersion: '1.0.0',
      engineVersion: '1.0.0',
      correlationId: this.requestId,
      tags: ['error'],
      custom: {},
      ...this.metadata,
    };

    const response: VorionErrorResponse = {
      responseId: crypto.randomUUID(),
      requestId: this.requestId,
      success: false,
      error,
      governance: this.governance,
      attempted: this.attempted,
      remediation: this.remediation,
      timing,
      metadata,
    };

    logger.debug(
      {
        responseId: response.responseId,
        requestId: this.requestId,
        errorCode: error.code,
        errorCategory: error.category,
        retryable: error.retryable,
      },
      'Error response built'
    );

    return response;
  }
}

/**
 * Contract Service for managing VorionResponse creation and validation
 */
export class ContractService {
  private responseCache: Map<ID, VorionResponse> = new Map();
  private errorCache: Map<ID, VorionErrorResponse> = new Map();

  /**
   * Create a response builder
   */
  createResponseBuilder<T = unknown>(requestId: ID): ResponseBuilder<T> {
    return new ResponseBuilder<T>(requestId);
  }

  /**
   * Create an error response builder
   */
  createErrorBuilder(requestId: ID): ErrorResponseBuilder {
    return new ErrorResponseBuilder(requestId);
  }

  /**
   * Validate a VorionResponse
   */
  validateResponse<T>(response: VorionResponse<T>): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check required fields
    if (!response.responseId) issues.push('Missing responseId');
    if (!response.requestId) issues.push('Missing requestId');
    if (response.success === undefined) issues.push('Missing success flag');
    if (!response.confidence) issues.push('Missing confidence');
    if (!response.governance) issues.push('Missing governance');
    if (!response.timing) issues.push('Missing timing');

    // Validate confidence
    if (response.confidence) {
      if (response.confidence.overall < 0 || response.confidence.overall > 1) {
        issues.push('Confidence overall must be between 0 and 1');
      }
    }

    // Validate timing
    if (response.timing) {
      if (response.timing.totalDurationMs < 0) {
        issues.push('Total duration cannot be negative');
      }
    }

    // Validate assumptions
    for (const assumption of response.assumptions) {
      if (assumption.confidence < 0 || assumption.confidence > 1) {
        issues.push(`Assumption ${assumption.id} has invalid confidence`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Check if response is still valid (invalidity conditions not met)
   */
  checkValidity<T>(response: VorionResponse<T>): {
    valid: boolean;
    invalidatedBy: InvalidityCondition[];
  } {
    const invalidatedBy: InvalidityCondition[] = [];
    const now = Date.now();

    for (const condition of response.invalidityConditions) {
      // Check time-based conditions
      if (condition.category === 'temporal' && condition.timeLimit) {
        const responseTime = new Date(response.timing.respondedAt).getTime();
        if (now - responseTime > condition.timeLimit) {
          invalidatedBy.push(condition);
        }
      }
      // Other condition types would be checked against current state
    }

    return {
      valid: invalidatedBy.length === 0,
      invalidatedBy,
    };
  }

  /**
   * Store response for later retrieval
   */
  storeResponse<T>(response: VorionResponse<T>): void {
    this.responseCache.set(response.responseId, response as VorionResponse);
    logger.debug({ responseId: response.responseId }, 'Response stored');
  }

  /**
   * Store error response
   */
  storeErrorResponse(response: VorionErrorResponse): void {
    this.errorCache.set(response.responseId, response);
    logger.debug({ responseId: response.responseId }, 'Error response stored');
  }

  /**
   * Retrieve a stored response
   */
  getResponse(responseId: ID): VorionResponse | undefined {
    return this.responseCache.get(responseId);
  }

  /**
   * Retrieve a stored error response
   */
  getErrorResponse(responseId: ID): VorionErrorResponse | undefined {
    return this.errorCache.get(responseId);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalResponses: number;
    totalErrors: number;
    averageConfidence: number;
    averageDurationMs: number;
  } {
    const responses = Array.from(this.responseCache.values());
    const errors = Array.from(this.errorCache.values());

    let totalConfidence = 0;
    let totalDuration = 0;

    for (const response of responses) {
      totalConfidence += response.confidence.overall;
      totalDuration += response.timing.totalDurationMs;
    }

    for (const error of errors) {
      totalDuration += error.timing.totalDurationMs;
    }

    const totalCount = responses.length + errors.length;

    return {
      totalResponses: responses.length,
      totalErrors: errors.length,
      averageConfidence: responses.length > 0 ? totalConfidence / responses.length : 0,
      averageDurationMs: totalCount > 0 ? totalDuration / totalCount : 0,
    };
  }
}

/**
 * Create a new contract service
 */
export function createContractService(): ContractService {
  return new ContractService();
}

/**
 * Helper to create a standard assumption
 */
export function createAssumption(
  assumption: string,
  category: AssumptionCategory,
  criticality: Assumption['criticality'],
  confidence: number,
  fallbackBehavior: string,
  supportingEvidence: string[] = []
): Omit<Assumption, 'id'> {
  return {
    assumption,
    category,
    criticality,
    confidence,
    fallbackBehavior,
    supportingEvidence,
  };
}

/**
 * Helper to create an invalidity condition
 */
export function createInvalidityCondition(
  condition: string,
  category: InvalidityCategory,
  severity: InvalidityCondition['severity'],
  detection: string,
  recommendedAction: string,
  timeLimit?: number
): Omit<InvalidityCondition, 'id'> {
  return {
    condition,
    category,
    severity,
    detection,
    recommendedAction,
    timeLimit,
  };
}

/**
 * Helper to create a ContractError
 */
export function createContractError(
  code: string,
  message: string,
  category: ErrorCategory,
  retryable: boolean,
  context: Record<string, unknown> = {},
  retryAfterMs?: number
): ContractError {
  return {
    code,
    message,
    category,
    retryable,
    context,
    retryAfterMs,
  };
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Validation errors (V1xxx)
  INVALID_INPUT: 'V1001',
  MISSING_REQUIRED_FIELD: 'V1002',
  INVALID_FORMAT: 'V1003',

  // Authorization errors (A2xxx)
  UNAUTHORIZED: 'A2001',
  FORBIDDEN: 'A2002',
  TRUST_INSUFFICIENT: 'A2003',

  // Governance errors (G3xxx)
  GOVERNANCE_DENIED: 'G3001',
  GOVERNANCE_ESCALATED: 'G3002',
  CONTAINMENT_BLOCKED: 'G3003',

  // Resource errors (R4xxx)
  NOT_FOUND: 'R4001',
  CONFLICT: 'R4002',
  RESOURCE_EXHAUSTED: 'R4003',

  // External errors (E5xxx)
  EXTERNAL_SERVICE_ERROR: 'E5001',
  EXTERNAL_TIMEOUT: 'E5002',
  EXTERNAL_UNAVAILABLE: 'E5003',

  // Internal errors (I6xxx)
  INTERNAL_ERROR: 'I6001',
  NOT_IMPLEMENTED: 'I6002',
  CIRCUIT_BREAKER_OPEN: 'I6003',

  // Timeout errors (T7xxx)
  REQUEST_TIMEOUT: 'T7001',
  PROCESSING_TIMEOUT: 'T7002',

  // Rate limit errors (L8xxx)
  RATE_LIMITED: 'L8001',
  QUOTA_EXCEEDED: 'L8002',
} as const;
