/**
 * Cognigate - Constrained Execution Runtime
 *
 * Executes approved intents within defined constraints and resource limits.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { Intent, Decision, ID } from '../common/types.js';

const logger = createLogger({ component: 'cognigate' });

/**
 * Execution context for running an intent
 */
export interface ExecutionContext {
  intent: Intent;
  decision: Decision;
  resourceLimits: ResourceLimits;
}

/**
 * Resource limits for execution
 */
export interface ResourceLimits {
  maxMemoryMb: number;
  maxCpuPercent: number;
  timeoutMs: number;
  maxNetworkRequests?: number;
  maxFileSystemOps?: number;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  intentId: ID;
  success: boolean;
  outputs: Record<string, unknown>;
  resourceUsage: ResourceUsage;
  startedAt: string;
  completedAt: string;
  error?: string;
}

/**
 * Resource usage metrics
 */
export interface ResourceUsage {
  memoryPeakMb: number;
  cpuTimeMs: number;
  wallTimeMs: number;
  networkRequests: number;
  fileSystemOps: number;
}

/**
 * Execution handler function type
 */
export type ExecutionHandler = (
  intent: Intent,
  context: Record<string, unknown>
) => Promise<Record<string, unknown>>;

/**
 * Cognigate execution gateway
 */
export class CognigateGateway {
  private handlers: Map<string, ExecutionHandler> = new Map();
  private defaultLimits: ResourceLimits;

  constructor(defaultLimits?: Partial<ResourceLimits>) {
    this.defaultLimits = {
      maxMemoryMb: 512,
      maxCpuPercent: 50,
      timeoutMs: 300000,
      maxNetworkRequests: 100,
      maxFileSystemOps: 1000,
      ...defaultLimits,
    };
  }

  /**
   * Register an execution handler for an intent type
   */
  registerHandler(intentType: string, handler: ExecutionHandler): void {
    this.handlers.set(intentType, handler);
    logger.info({ intentType }, 'Handler registered');
  }

  /**
   * Execute an approved intent
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { intent, decision } = context;
    const startedAt = new Date().toISOString();

    // Verify decision allows execution
    if (decision.action !== 'allow') {
      logger.warn(
        { intentId: intent.id, action: decision.action },
        'Execution blocked by decision'
      );

      return {
        intentId: intent.id,
        success: false,
        outputs: {},
        resourceUsage: this.emptyUsage(),
        startedAt,
        completedAt: new Date().toISOString(),
        error: `Execution not allowed: ${decision.action}`,
      };
    }

    // Get handler
    const intentType = (intent.context['type'] as string) ?? 'default';
    const handler = this.handlers.get(intentType);

    if (!handler) {
      logger.warn({ intentId: intent.id, intentType }, 'No handler found');

      return {
        intentId: intent.id,
        success: false,
        outputs: {},
        resourceUsage: this.emptyUsage(),
        startedAt,
        completedAt: new Date().toISOString(),
        error: `No handler for intent type: ${intentType}`,
      };
    }

    // Execute with limits
    try {
      const limits = { ...this.defaultLimits, ...context.resourceLimits };
      const execStart = performance.now();

      // TODO: Implement actual resource limiting (sandboxing)
      const outputs = await Promise.race([
        handler(intent, intent.context),
        this.timeout(limits.timeoutMs),
      ]);

      const execEnd = performance.now();

      logger.info(
        { intentId: intent.id, durationMs: execEnd - execStart },
        'Execution completed'
      );

      return {
        intentId: intent.id,
        success: true,
        outputs: outputs,
        resourceUsage: {
          memoryPeakMb: 0, // TODO: Track actual usage
          cpuTimeMs: execEnd - execStart,
          wallTimeMs: execEnd - execStart,
          networkRequests: 0,
          fileSystemOps: 0,
        },
        startedAt,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { intentId: intent.id, error: errorMessage },
        'Execution failed'
      );

      return {
        intentId: intent.id,
        success: false,
        outputs: {},
        resourceUsage: this.emptyUsage(),
        startedAt,
        completedAt: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }

  /**
   * Create a timeout promise
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Execution timeout')), ms)
    );
  }

  /**
   * Create empty resource usage
   */
  private emptyUsage(): ResourceUsage {
    return {
      memoryPeakMb: 0,
      cpuTimeMs: 0,
      wallTimeMs: 0,
      networkRequests: 0,
      fileSystemOps: 0,
    };
  }

  /**
   * Terminate an execution (kill switch)
   */
  terminate(intentId: ID): void {
    // TODO: Implement actual termination
    logger.warn({ intentId }, 'Terminate requested');
  }
}

/**
 * Create a new Cognigate gateway instance
 */
export function createGateway(
  defaultLimits?: Partial<ResourceLimits>
): CognigateGateway {
  return new CognigateGateway(defaultLimits);
}
