/**
 * Typed Security Layer Pipeline
 *
 * Implements the security pipeline that orchestrates L0-L46 security layers
 * with proper execution order, failure handling, and result aggregation.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { ID, ControlAction } from '../common/types.js';
import type {
  SecurityLayer,
  SecurityLayerConfig,
  LayerInput,
  LayerExecutionResult,
  LayerError,
  LayerFinding,
  LayerModification,
  LayerTiming,
  PipelineResult,
  PipelineConfig,
  PipelineEvent,
  PipelineEventListener,
  FailMode,
  LayerTier,
  ThreatClass,
  LayerHealthStatus,
  ValidationResult,
} from './types.js';

export * from './types.js';

const logger = createLogger({ component: 'security-layers' });

/**
 * Default pipeline configuration
 */
const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  maxTotalTimeMs: 5000,
  stopOnFirstFailure: false,
  minConfidenceThreshold: 0.5,
  enableParallelExecution: true,
};

/**
 * Abstract base class for security layers
 */
export abstract class BaseSecurityLayer implements SecurityLayer {
  protected config: SecurityLayerConfig;

  constructor(config: SecurityLayerConfig) {
    this.config = config;
  }

  getConfig(): SecurityLayerConfig {
    return this.config;
  }

  abstract execute(input: LayerInput): Promise<LayerExecutionResult>;

  validateInput(input: LayerInput): ValidationResult {
    const errors: Array<{ field: string; rule: string; message: string; value?: unknown }> = [];

    if (!input.requestId) {
      errors.push({ field: 'requestId', rule: 'required', message: 'Request ID is required' });
    }
    if (!input.entityId) {
      errors.push({ field: 'entityId', rule: 'required', message: 'Entity ID is required' });
    }
    if (!input.payload) {
      errors.push({ field: 'payload', rule: 'required', message: 'Payload is required' });
    }

    return { valid: errors.length === 0, errors };
  }

  async healthCheck(): Promise<LayerHealthStatus> {
    return {
      healthy: true,
      lastCheck: new Date().toISOString(),
      issues: [],
      metrics: {
        requestsProcessed: 0,
        averageLatencyMs: 0,
        errorRate: 0,
      },
    };
  }

  async reset(): Promise<void> {
    // Default implementation - override in subclasses if needed
  }

  /**
   * Helper to create a successful result
   */
  protected createSuccessResult(
    action: ControlAction,
    confidence: number,
    findings: LayerFinding[] = [],
    modifications: LayerModification[] = [],
    timing: LayerTiming
  ): LayerExecutionResult {
    return {
      layerId: this.config.layerId,
      layerName: this.config.name,
      passed: true,
      action,
      confidence,
      riskLevel: this.determineRiskLevel(findings),
      findings,
      modifications,
      timing,
    };
  }

  /**
   * Helper to create a failure result
   */
  protected createFailureResult(
    action: ControlAction,
    confidence: number,
    findings: LayerFinding[],
    timing: LayerTiming,
    error?: LayerError
  ): LayerExecutionResult {
    return {
      layerId: this.config.layerId,
      layerName: this.config.name,
      passed: false,
      action,
      confidence,
      riskLevel: this.determineRiskLevel(findings),
      findings,
      modifications: [],
      timing,
      error,
    };
  }

  /**
   * Determine risk level from findings
   */
  private determineRiskLevel(findings: LayerFinding[]): 'low' | 'medium' | 'high' | 'critical' {
    if (findings.some((f) => f.severity === 'critical')) return 'critical';
    if (findings.some((f) => f.severity === 'high')) return 'high';
    if (findings.some((f) => f.severity === 'medium')) return 'medium';
    return 'low';
  }
}

/**
 * Security Pipeline - orchestrates execution of all security layers
 */
export class SecurityPipeline {
  private layers: Map<number, SecurityLayer> = new Map();
  private config: PipelineConfig;
  private listeners: PipelineEventListener[] = [];

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
  }

  /**
   * Register a security layer
   */
  registerLayer(layer: SecurityLayer): void {
    const layerConfig = layer.getConfig();
    this.layers.set(layerConfig.layerId, layer);
    logger.debug({ layerId: layerConfig.layerId, name: layerConfig.name }, 'Layer registered');
  }

  /**
   * Remove a security layer
   */
  unregisterLayer(layerId: number): void {
    this.layers.delete(layerId);
    logger.debug({ layerId }, 'Layer unregistered');
  }

  /**
   * Get a registered layer
   */
  getLayer(layerId: number): SecurityLayer | undefined {
    return this.layers.get(layerId);
  }

  /**
   * Get all registered layers
   */
  getAllLayers(): SecurityLayer[] {
    return Array.from(this.layers.values());
  }

  /**
   * Add an event listener
   */
  addEventListener(listener: PipelineEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove an event listener
   */
  removeEventListener(listener: PipelineEventListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: PipelineEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error({ error }, 'Error in pipeline event listener');
      }
    }
  }

  /**
   * Execute the security pipeline
   */
  async execute(input: LayerInput): Promise<PipelineResult> {
    const executionId = crypto.randomUUID();
    const startTime = Date.now();
    const now = new Date().toISOString();

    this.emit({ type: 'pipeline_started', executionId, timestamp: now });

    const layerResults: LayerExecutionResult[] = [];
    const layersPassed: number[] = [];
    const layersFailed: number[] = [];
    const layersSkipped: number[] = [];
    const allModifications: LayerModification[] = [];
    const allFindings: LayerFinding[] = [];

    // Get layers to execute in order
    const layersToExecute = this.getExecutionOrder();

    // Track which layers have completed (for dependency resolution)
    const completedLayers = new Set<number>();

    for (const layer of layersToExecute) {
      const layerConfig = layer.getConfig();
      const layerId = layerConfig.layerId;

      // Check if layer should be skipped
      if (this.shouldSkipLayer(layerId)) {
        layersSkipped.push(layerId);
        this.emit({
          type: 'layer_skipped',
          layerId,
          reason: 'disabled',
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      // Check dependencies
      const missingDeps = layerConfig.dependencies.filter((dep) => !completedLayers.has(dep));
      if (missingDeps.length > 0) {
        layersSkipped.push(layerId);
        this.emit({
          type: 'layer_skipped',
          layerId,
          reason: `missing dependencies: ${missingDeps.join(', ')}`,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed >= this.config.maxTotalTimeMs) {
        layersSkipped.push(layerId);
        this.emit({
          type: 'layer_skipped',
          layerId,
          reason: 'timeout',
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      // Execute layer
      this.emit({ type: 'layer_started', layerId, timestamp: new Date().toISOString() });

      try {
        const layerInput: LayerInput = {
          ...input,
          priorResults: layerResults,
        };

        const result = await this.executeWithTimeout(layer, layerInput, layerConfig.timeoutMs);

        layerResults.push(result);
        allModifications.push(...result.modifications);
        allFindings.push(...result.findings);

        if (result.passed) {
          layersPassed.push(layerId);
        } else {
          layersFailed.push(layerId);
        }

        completedLayers.add(layerId);

        this.emit({
          type: 'layer_completed',
          layerId,
          result,
          timestamp: new Date().toISOString(),
        });

        // Check if we should stop
        if (!result.passed && this.config.stopOnFirstFailure && layerConfig.required) {
          logger.info({ layerId }, 'Stopping pipeline due to required layer failure');
          break;
        }
      } catch (error) {
        const layerError = this.createLayerError(error);

        this.emit({
          type: 'layer_failed',
          layerId,
          error: layerError,
          timestamp: new Date().toISOString(),
        });

        // Handle based on fail mode
        const failMode = this.getFailMode(layerId, layerConfig.failMode);
        const failResult = this.handleLayerFailure(layer, failMode, layerError, startTime);

        layerResults.push(failResult);
        layersFailed.push(layerId);

        if (failMode === 'block' && layerConfig.required) {
          break;
        }
      }
    }

    // Aggregate results
    const pipelineResult = this.aggregateResults(
      executionId,
      layerResults,
      layersPassed,
      layersFailed,
      layersSkipped,
      allModifications,
      allFindings,
      startTime
    );

    this.emit({
      type: 'pipeline_completed',
      result: pipelineResult,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      {
        executionId,
        decision: pipelineResult.decision,
        confidence: pipelineResult.confidence,
        layersPassed: layersPassed.length,
        layersFailed: layersFailed.length,
        layersSkipped: layersSkipped.length,
        durationMs: pipelineResult.totalDurationMs,
      },
      'Pipeline execution completed'
    );

    return pipelineResult;
  }

  /**
   * Get layers in execution order (respecting dependencies)
   */
  private getExecutionOrder(): SecurityLayer[] {
    const layers = Array.from(this.layers.values());
    const sorted: SecurityLayer[] = [];
    const visited = new Set<number>();
    const visiting = new Set<number>();

    const visit = (layer: SecurityLayer) => {
      const config = layer.getConfig();
      if (visited.has(config.layerId)) return;
      if (visiting.has(config.layerId)) {
        throw new Error(`Circular dependency detected at layer ${config.layerId}`);
      }

      visiting.add(config.layerId);

      for (const depId of config.dependencies) {
        const depLayer = this.layers.get(depId);
        if (depLayer) {
          visit(depLayer);
        }
      }

      visiting.delete(config.layerId);
      visited.add(config.layerId);
      sorted.push(layer);
    };

    // Sort by layer ID first, then apply topological sort
    layers.sort((a, b) => a.getConfig().layerId - b.getConfig().layerId);

    for (const layer of layers) {
      visit(layer);
    }

    return sorted;
  }

  /**
   * Check if a layer should be skipped
   */
  private shouldSkipLayer(layerId: number): boolean {
    if (this.config.disabledLayers?.includes(layerId)) {
      return true;
    }
    if (this.config.enabledLayers && !this.config.enabledLayers.includes(layerId)) {
      return true;
    }
    return false;
  }

  /**
   * Get the fail mode for a layer
   */
  private getFailMode(layerId: number, defaultMode: FailMode): FailMode {
    return this.config.failModeOverrides?.[layerId] ?? defaultMode;
  }

  /**
   * Execute a layer with timeout
   */
  private async executeWithTimeout(
    layer: SecurityLayer,
    input: LayerInput,
    timeoutMs: number
  ): Promise<LayerExecutionResult> {
    return Promise.race([
      layer.execute(input),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Layer execution timeout')), timeoutMs);
      }),
    ]);
  }

  /**
   * Create a LayerError from an unknown error
   */
  private createLayerError(error: unknown): LayerError {
    if (error instanceof Error) {
      return {
        code: 'LAYER_ERROR',
        message: error.message,
        retryable: error.message.includes('timeout'),
        stack: error.stack,
        cause: error.cause,
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      retryable: false,
    };
  }

  /**
   * Handle a layer failure based on fail mode
   */
  private handleLayerFailure(
    layer: SecurityLayer,
    failMode: FailMode,
    error: LayerError,
    _pipelineStartTime: number
  ): LayerExecutionResult {
    const config = layer.getConfig();
    const now = new Date().toISOString();
    const timing: LayerTiming = {
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      waitTimeMs: 0,
      processingTimeMs: 0,
    };

    const action: ControlAction =
      failMode === 'block'
        ? 'deny'
        : failMode === 'escalate'
          ? 'escalate'
          : failMode === 'degrade'
            ? 'limit'
            : 'monitor';

    return {
      layerId: config.layerId,
      layerName: config.name,
      passed: failMode === 'log_only' || failMode === 'warn',
      action,
      confidence: 0,
      riskLevel: failMode === 'block' ? 'critical' : 'high',
      findings: [
        {
          type: 'warning',
          severity: failMode === 'block' ? 'critical' : 'high',
          code: `LAYER_${config.layerId}_FAILURE`,
          description: `Layer ${config.name} failed: ${error.message}`,
          evidence: [error.stack ?? error.message],
          remediation: error.retryable ? 'Retry the operation' : undefined,
        },
      ],
      modifications: [],
      timing,
      error,
    };
  }

  /**
   * Aggregate results from all layers
   */
  private aggregateResults(
    executionId: ID,
    layerResults: LayerExecutionResult[],
    layersPassed: number[],
    layersFailed: number[],
    layersSkipped: number[],
    modifications: LayerModification[],
    findings: LayerFinding[],
    startTime: number
  ): PipelineResult {
    const totalDurationMs = Date.now() - startTime;
    const now = new Date().toISOString();

    // Determine overall decision
    const { decision, confidence, explanation } = this.determineDecision(layerResults);

    // Determine overall risk level
    const riskLevel = this.determineOverallRiskLevel(findings);

    return {
      executionId,
      decision,
      confidence,
      riskLevel,
      layerResults,
      layersPassed,
      layersFailed,
      layersSkipped,
      totalDurationMs,
      modifications,
      findings,
      explanation,
      completedAt: now,
    };
  }

  /**
   * Determine the overall decision from layer results
   */
  private determineDecision(results: LayerExecutionResult[]): {
    decision: ControlAction;
    confidence: number;
    explanation: string;
  } {
    if (results.length === 0) {
      return {
        decision: 'deny',
        confidence: 0,
        explanation: 'No security layers executed - defaulting to deny',
      };
    }

    // Priority order for actions (most restrictive first)
    const actionPriority: ControlAction[] = ['terminate', 'deny', 'escalate', 'limit', 'monitor', 'allow'];

    let finalAction: ControlAction = 'allow';
    let totalConfidence = 0;
    let decisionReasons: string[] = [];

    for (const result of results) {
      totalConfidence += result.confidence;

      // Take the most restrictive action
      if (actionPriority.indexOf(result.action) < actionPriority.indexOf(finalAction)) {
        finalAction = result.action;
        decisionReasons.push(`Layer ${result.layerName}: ${result.action}`);
      }
    }

    // Average confidence, weighted by result
    const avgConfidence = totalConfidence / results.length;

    // Check minimum confidence threshold
    if (avgConfidence < this.config.minConfidenceThreshold && finalAction === 'allow') {
      finalAction = 'escalate';
      decisionReasons.push(`Low confidence (${avgConfidence.toFixed(2)}) requires escalation`);
    }

    return {
      decision: finalAction,
      confidence: avgConfidence,
      explanation: decisionReasons.join('; ') || 'All layers passed',
    };
  }

  /**
   * Determine overall risk level from findings
   */
  private determineOverallRiskLevel(findings: LayerFinding[]): 'low' | 'medium' | 'high' | 'critical' {
    if (findings.some((f) => f.severity === 'critical')) return 'critical';
    if (findings.some((f) => f.severity === 'high')) return 'high';
    if (findings.some((f) => f.severity === 'medium')) return 'medium';
    return 'low';
  }

  /**
   * Get pipeline health status
   */
  async getHealth(): Promise<{
    healthy: boolean;
    layers: Array<{ layerId: number; name: string; healthy: boolean; issues: string[] }>;
  }> {
    const layerHealth: Array<{ layerId: number; name: string; healthy: boolean; issues: string[] }> = [];

    for (const layer of this.layers.values()) {
      const config = layer.getConfig();
      try {
        const health = await layer.healthCheck();
        layerHealth.push({
          layerId: config.layerId,
          name: config.name,
          healthy: health.healthy,
          issues: health.issues,
        });
      } catch (error) {
        layerHealth.push({
          layerId: config.layerId,
          name: config.name,
          healthy: false,
          issues: [error instanceof Error ? error.message : 'Unknown error'],
        });
      }
    }

    return {
      healthy: layerHealth.every((l) => l.healthy),
      layers: layerHealth,
    };
  }

  /**
   * Reset all layers
   */
  async reset(): Promise<void> {
    for (const layer of this.layers.values()) {
      await layer.reset();
    }
  }
}

/**
 * Create a new security pipeline
 */
export function createSecurityPipeline(config?: Partial<PipelineConfig>): SecurityPipeline {
  return new SecurityPipeline(config);
}

/**
 * Helper to create layer configuration
 */
export function createLayerConfig(
  layerId: number,
  name: string,
  options: {
    description: string;
    tier: LayerTier;
    primaryThreat: ThreatClass;
    secondaryThreats?: ThreatClass[];
    failMode?: FailMode;
    required?: boolean;
    timeoutMs?: number;
    parallelizable?: boolean;
    dependencies?: number[];
  }
): SecurityLayerConfig {
  return {
    layerId,
    name,
    description: options.description,
    tier: options.tier,
    primaryThreat: options.primaryThreat,
    secondaryThreats: options.secondaryThreats ?? [],
    inputSchema: {
      schemaId: `layer-${layerId}-input`,
      definition: 'LayerInput',
      required: ['requestId', 'entityId', 'payload'],
      optional: ['metadata', 'priorResults'],
      validations: [],
    },
    outputSchema: {
      schemaId: `layer-${layerId}-output`,
      definition: 'LayerExecutionResult',
      required: ['layerId', 'passed', 'action', 'confidence'],
      optional: ['findings', 'modifications', 'error'],
      validations: [],
    },
    failMode: options.failMode ?? 'block',
    required: options.required ?? false,
    timeoutMs: options.timeoutMs ?? 1000,
    parallelizable: options.parallelizable ?? false,
    dependencies: options.dependencies ?? [],
  };
}
