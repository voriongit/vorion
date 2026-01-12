/**
 * Execution Engine - Executes authorized intents with hook integration
 *
 * The ExecutionEngine handles the actual execution of authorized intents,
 * with pre/post execution hooks for extensibility and monitoring.
 *
 * Execution flow:
 * 1. Validate the decision is still valid (not expired)
 * 2. Execute PRE_EXECUTE hooks (can abort)
 * 3. Execute the action via the registered executor
 * 4. Execute POST_EXECUTE hooks on success
 * 5. Execute EXECUTION_FAILED hooks on failure
 */

import { v4 as uuidv4 } from 'uuid';
import type { Intent, Decision, TrustProfile } from '@orion/contracts';
import {
  type HookManager,
  type HookExecutionSummary,
} from '../hooks/index.js';

/**
 * Executor function type - implements the actual action execution
 */
export type ActionExecutor<TParams = unknown, TResult = unknown> = (
  intent: Intent,
  decision: Decision,
  params?: TParams
) => Promise<TResult>;

/**
 * Execution result
 */
export interface ExecutionResult<T = unknown> {
  /** Whether execution was successful */
  success: boolean;
  /** The result of execution (if successful) */
  result?: T;
  /** Error (if failed) */
  error?: Error;
  /** Execution duration in ms */
  durationMs: number;
  /** Whether the operation was aborted by a hook */
  aborted: boolean;
  /** Abort reason (if aborted) */
  abortReason?: string;
  /** Execution ID for tracing */
  executionId: string;
  /** Whether the error is retryable */
  retryable?: boolean;
}

/**
 * Execution request
 */
export interface ExecuteRequest<TParams = unknown> {
  /** The authorization decision */
  decision: Decision;
  /** The original intent */
  intent: Intent;
  /** The agent's trust profile */
  profile: TrustProfile;
  /** Custom execution parameters */
  params?: TParams;
  /** Optional executor override (uses default if not provided) */
  executor?: ActionExecutor<TParams>;
}

/**
 * Configuration for the execution engine
 */
export interface ExecutionEngineConfig {
  /** Hook manager for extensibility */
  hookManager?: HookManager;
  /** Enable hooks (default: true if hookManager provided) */
  enableHooks?: boolean;
  /** Default executor for actions */
  defaultExecutor?: ActionExecutor;
  /** Default timeout for execution in ms */
  defaultTimeoutMs?: number;
  /** Whether to allow execution of expired decisions */
  allowExpiredDecisions?: boolean;
}

/**
 * Determines if an error is retryable
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const retryablePatterns = [
    'timeout',
    'network',
    'connection',
    'temporarily unavailable',
    'rate limit',
    'too many requests',
    'service unavailable',
    'gateway',
    'econnreset',
    'econnrefused',
    'etimedout',
  ];
  return retryablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * ExecutionEngine - Executes authorized intents with hook integration
 */
export class ExecutionEngine {
  private readonly hookManager?: HookManager;
  private readonly config: Required<Omit<ExecutionEngineConfig, 'hookManager'>>;
  private readonly executors: Map<string, ActionExecutor> = new Map();

  constructor(config: ExecutionEngineConfig = {}) {
    this.hookManager = config.hookManager;
    this.config = {
      enableHooks: config.enableHooks ?? (config.hookManager !== undefined),
      defaultExecutor: config.defaultExecutor ?? this.noopExecutor,
      defaultTimeoutMs: config.defaultTimeoutMs ?? 30000,
      allowExpiredDecisions: config.allowExpiredDecisions ?? false,
    };
  }

  /**
   * Default no-op executor
   */
  private noopExecutor: ActionExecutor = async () => {
    return { executed: true };
  };

  /**
   * Register an executor for a specific action type
   */
  registerExecutor(actionType: string, executor: ActionExecutor): void {
    this.executors.set(actionType, executor);
  }

  /**
   * Unregister an executor
   */
  unregisterExecutor(actionType: string): boolean {
    return this.executors.delete(actionType);
  }

  /**
   * Execute an authorized intent
   */
  async execute<TParams = unknown, TResult = unknown>(
    request: ExecuteRequest<TParams>
  ): Promise<ExecutionResult<TResult>> {
    const executionId = uuidv4();
    const startTime = Date.now();
    const { decision, intent, profile, params } = request;

    // Check if decision permits the action
    if (!decision.permitted) {
      return {
        success: false,
        error: new Error('Decision does not permit execution'),
        durationMs: Date.now() - startTime,
        aborted: false,
        executionId,
        retryable: false,
      };
    }

    // Check if decision has expired
    if (!this.config.allowExpiredDecisions && decision.expiresAt < new Date()) {
      return {
        success: false,
        error: new Error('Decision has expired'),
        durationMs: Date.now() - startTime,
        aborted: false,
        executionId,
        retryable: false,
      };
    }

    // Execute pre-execute hooks
    if (this.config.enableHooks && this.hookManager) {
      const preExecuteResult = await this.executePreHooks(
        executionId,
        decision,
        intent,
        profile,
        params
      );

      if (preExecuteResult.aborted) {
        return {
          success: false,
          durationMs: Date.now() - startTime,
          aborted: true,
          abortReason: preExecuteResult.abortReason,
          executionId,
          retryable: false,
        };
      }
    }

    // Get the executor
    const executor =
      request.executor ??
      this.executors.get(intent.actionType) ??
      this.config.defaultExecutor;

    // Execute the action
    try {
      const result = await this.executeWithTimeout(
        executor,
        intent,
        decision,
        params as TParams
      );

      const durationMs = Date.now() - startTime;

      // Execute post-execute hooks
      if (this.config.enableHooks && this.hookManager) {
        await this.executePostHooks(
          executionId,
          decision,
          intent,
          result,
          durationMs
        );
      }

      return {
        success: true,
        result: result as TResult,
        durationMs,
        aborted: false,
        executionId,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      const retryable = isRetryableError(err);

      // Execute execution-failed hooks
      if (this.config.enableHooks && this.hookManager) {
        await this.executeFailedHooks(
          executionId,
          decision,
          intent,
          err,
          durationMs,
          retryable
        );
      }

      return {
        success: false,
        error: err,
        durationMs,
        aborted: false,
        executionId,
        retryable,
      };
    }
  }

  /**
   * Execute action with timeout
   */
  private async executeWithTimeout<TParams, TResult>(
    executor: ActionExecutor<TParams, TResult>,
    intent: Intent,
    decision: Decision,
    params?: TParams
  ): Promise<TResult> {
    const timeoutMs =
      decision.constraints?.maxExecutionTimeMs ?? this.config.defaultTimeoutMs;

    return new Promise<TResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      executor(intent, decision, params)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Execute pre-execute hooks
   */
  private async executePreHooks(
    _executionId: string,
    decision: Decision,
    intent: Intent,
    profile: TrustProfile,
    params?: unknown
  ): Promise<HookExecutionSummary> {
    return this.hookManager!.executePreExecute({
      correlationId: intent.correlationId,
      decision,
      intent,
      profile,
      params: params as Record<string, unknown>,
    });
  }

  /**
   * Execute post-execute hooks
   */
  private async executePostHooks(
    _executionId: string,
    decision: Decision,
    intent: Intent,
    result: unknown,
    durationMs: number
  ): Promise<HookExecutionSummary> {
    return this.hookManager!.executePostExecute({
      correlationId: intent.correlationId,
      decision,
      intent,
      result,
      durationMs,
    });
  }

  /**
   * Execute execution-failed hooks
   */
  private async executeFailedHooks(
    _executionId: string,
    decision: Decision,
    intent: Intent,
    error: Error,
    durationMs: number,
    retryable: boolean
  ): Promise<HookExecutionSummary> {
    return this.hookManager!.executeExecutionFailed({
      correlationId: intent.correlationId,
      decision,
      intent,
      error,
      durationMs,
      retryable,
    });
  }

  /**
   * Get the hook manager
   */
  getHookManager(): HookManager | undefined {
    return this.hookManager;
  }
}

/**
 * Create an execution engine
 */
export function createExecutionEngine(
  config?: ExecutionEngineConfig
): ExecutionEngine {
  return new ExecutionEngine(config);
}
