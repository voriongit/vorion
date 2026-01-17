/**
 * Cognigate - Constrained Execution Runtime
 *
 * Executes approved intents within defined constraints and resource limits.
 * Uses Node.js worker threads for actual sandboxing with memory limits.
 *
 * @packageDocumentation
 */

import { Worker, isMainThread } from 'node:worker_threads';
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
 * Active execution tracking for termination
 */
interface ActiveExecution {
  worker: Worker | null;
  abortController: AbortController;
  startTime: number;
}

/**
 * Cognigate execution gateway
 */
export class CognigateGateway {
  private handlers: Map<string, ExecutionHandler> = new Map();
  private activeExecutions: Map<ID, ActiveExecution> = new Map();
  private defaultLimits: ResourceLimits;
  private useSandbox: boolean;

  constructor(defaultLimits?: Partial<ResourceLimits>, options?: { useSandbox?: boolean }) {
    this.defaultLimits = {
      maxMemoryMb: 512,
      maxCpuPercent: 50,
      timeoutMs: 300000,
      maxNetworkRequests: 100,
      maxFileSystemOps: 1000,
      ...defaultLimits,
    };
    // Enable sandbox by default in production, can be disabled for testing
    this.useSandbox = options?.useSandbox ?? true;
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
    const limits = { ...this.defaultLimits, ...context.resourceLimits };
    const abortController = new AbortController();

    // Track this execution for potential termination
    this.activeExecutions.set(intent.id, {
      worker: null,
      abortController,
      startTime: performance.now(),
    });

    try {
      const execStart = performance.now();
      let outputs: Record<string, unknown>;
      let resourceUsage: ResourceUsage;

      if (this.useSandbox && isMainThread) {
        // Execute in sandboxed worker thread with memory limits
        const result = await this.executeInSandbox(
          handler,
          intent,
          limits,
          abortController.signal
        );
        outputs = result.outputs;
        resourceUsage = result.resourceUsage;
      } else {
        // Direct execution (for testing or when already in worker)
        outputs = await Promise.race([
          handler(intent, intent.context),
          this.timeout(limits.timeoutMs, abortController.signal),
        ]) as Record<string, unknown>;

        const execEnd = performance.now();
        resourceUsage = {
          memoryPeakMb: this.getMemoryUsageMb(),
          cpuTimeMs: execEnd - execStart,
          wallTimeMs: execEnd - execStart,
          networkRequests: 0,
          fileSystemOps: 0,
        };
      }

      const execEnd = performance.now();

      logger.info(
        { intentId: intent.id, durationMs: execEnd - execStart, memoryMb: resourceUsage.memoryPeakMb },
        'Execution completed'
      );

      return {
        intentId: intent.id,
        success: true,
        outputs,
        resourceUsage,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      const isTimeout = errorMessage === 'Execution timeout';
      const isTerminated = errorMessage === 'Execution terminated';
      const isMemoryLimit = errorMessage.includes('memory limit');

      logger.error(
        { intentId: intent.id, error: errorMessage, isTimeout, isTerminated, isMemoryLimit },
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
    } finally {
      // Clean up tracking
      this.activeExecutions.delete(intent.id);
    }
  }

  /**
   * Execute handler in sandboxed worker thread with resource limits
   */
  private async executeInSandbox(
    handler: ExecutionHandler,
    intent: Intent,
    limits: ResourceLimits,
    signal: AbortSignal
  ): Promise<{ outputs: Record<string, unknown>; resourceUsage: ResourceUsage }> {
    return new Promise((resolve, reject) => {
      const execStart = performance.now();

      // Serialize the handler - note: only works with simple handlers
      // For complex handlers, they should be registered by name and looked up
      const handlerCode = handler.toString();

      // Create worker with memory limits
      const worker = new Worker(
        new URL('data:text/javascript,' + encodeURIComponent(`
          import { parentPort, workerData } from 'node:worker_threads';

          const { handlerCode, intent, context } = workerData;

          // Reconstruct handler (limited to simple functions)
          const handler = eval('(' + handlerCode + ')');

          // Track memory before execution
          const memBefore = process.memoryUsage();

          try {
            const result = await handler(intent, context);
            const memAfter = process.memoryUsage();

            parentPort.postMessage({
              success: true,
              outputs: result,
              memoryUsed: Math.max(0, (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024)
            });
          } catch (error) {
            parentPort.postMessage({
              success: false,
              error: error.message || 'Unknown error'
            });
          }
        `)),
        {
          workerData: {
            handlerCode,
            intent,
            context: intent.context,
          },
          resourceLimits: {
            maxOldGenerationSizeMb: limits.maxMemoryMb,
            maxYoungGenerationSizeMb: Math.floor(limits.maxMemoryMb / 4),
            stackSizeMb: 4,
          },
        }
      );

      // Track worker for termination
      const execution = this.activeExecutions.get(intent.id);
      if (execution) {
        execution.worker = worker;
      }

      // Handle abort signal
      const abortHandler = () => {
        worker.terminate();
        reject(new Error('Execution terminated'));
      };
      signal.addEventListener('abort', abortHandler, { once: true });

      // Set timeout
      const timeoutId = setTimeout(() => {
        worker.terminate();
        reject(new Error('Execution timeout'));
      }, limits.timeoutMs);

      // Handle worker messages
      worker.on('message', (msg) => {
        clearTimeout(timeoutId);
        signal.removeEventListener('abort', abortHandler);

        const execEnd = performance.now();

        if (msg.success) {
          resolve({
            outputs: msg.outputs,
            resourceUsage: {
              memoryPeakMb: msg.memoryUsed || 0,
              cpuTimeMs: execEnd - execStart,
              wallTimeMs: execEnd - execStart,
              networkRequests: 0,
              fileSystemOps: 0,
            },
          });
        } else {
          reject(new Error(msg.error));
        }
      });

      // Handle worker errors (including memory limit exceeded)
      worker.on('error', (error) => {
        clearTimeout(timeoutId);
        signal.removeEventListener('abort', abortHandler);
        reject(new Error(error.message || 'Worker error'));
      });

      // Handle worker exit
      worker.on('exit', (code) => {
        if (code !== 0) {
          clearTimeout(timeoutId);
          signal.removeEventListener('abort', abortHandler);
          reject(new Error(`Worker exited with code ${code} (may have exceeded memory limit)`));
        }
      });
    });
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsageMb(): number {
    const usage = process.memoryUsage();
    return Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100;
  }

  /**
   * Create a timeout promise that respects abort signal
   */
  private timeout(ms: number, signal?: AbortSignal): Promise<never> {
    return new Promise((_, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Execution timeout')), ms);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Execution terminated'));
        }, { once: true });
      }
    });
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
   * Immediately stops execution of the specified intent
   */
  async terminate(intentId: ID): Promise<boolean> {
    const execution = this.activeExecutions.get(intentId);

    if (!execution) {
      logger.warn({ intentId }, 'Terminate requested but no active execution found');
      return false;
    }

    logger.warn({ intentId, runningFor: performance.now() - execution.startTime }, 'Terminating execution');

    // Abort via signal (for direct execution)
    execution.abortController.abort();

    // Terminate worker if running in sandbox
    if (execution.worker) {
      await execution.worker.terminate();
    }

    // Clean up
    this.activeExecutions.delete(intentId);

    logger.info({ intentId }, 'Execution terminated successfully');
    return true;
  }

  /**
   * Get list of active execution IDs
   */
  getActiveExecutions(): ID[] {
    return Array.from(this.activeExecutions.keys());
  }

  /**
   * Check if an execution is currently running
   */
  isExecuting(intentId: ID): boolean {
    return this.activeExecutions.has(intentId);
  }
}

/**
 * Gateway options
 */
export interface GatewayOptions {
  /** Enable sandboxed execution via worker threads (default: true) */
  useSandbox?: boolean;
}

/**
 * Create a new Cognigate gateway instance
 */
export function createGateway(
  defaultLimits?: Partial<ResourceLimits>,
  options?: GatewayOptions
): CognigateGateway {
  return new CognigateGateway(defaultLimits, options);
}
