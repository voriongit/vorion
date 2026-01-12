/**
 * Hook Manager - High-level API for the hook system
 *
 * Provides a unified interface for registering and executing hooks.
 */

import {
  HookPhase,
  HookPriority,
  type HookHandler,
  type HookExecutionSummary,
  type PreAuthorizeContext,
  type PostAuthorizeContext,
  type PreExecuteContext,
  type PostExecuteContext,
  type ExecutionFailedContext,
  type TrustChangeContext,
  type TrustViolationContext,
  type EventEmittedContext,
  type AnyHookContext,
  type HookDefinition,
} from './types.js';
import {
  HookRegistry,
  createHookRegistry,
  type RegisterHookOptions,
} from './registry.js';
import {
  HookExecutor,
  createHookExecutor,
  type ExecuteHooksOptions,
  successResult,
  abortResult,
  errorResult,
} from './executor.js';

/**
 * Configuration for the hook manager
 */
export interface HookManagerConfig {
  /** Custom registry (creates new if not provided) */
  registry?: HookRegistry;
  /** Default execution options */
  defaultExecutionOptions?: ExecuteHooksOptions;
  /** Enable hook execution logging */
  enableLogging?: boolean;
}

/**
 * Simplified hook registration options
 */
export interface SimpleHookOptions {
  /** Hook priority */
  priority?: HookPriority;
  /** Timeout in ms */
  timeoutMs?: number;
  /** Continue on error */
  continueOnError?: boolean;
  /** Whether enabled */
  enabled?: boolean;
}

/**
 * HookManager - High-level hook management API
 */
export class HookManager {
  private readonly registry: HookRegistry;
  private readonly executor: HookExecutor;
  private readonly config: Required<HookManagerConfig>;

  constructor(config: HookManagerConfig = {}) {
    this.registry = config.registry ?? createHookRegistry();
    this.executor = createHookExecutor(this.registry);
    this.config = {
      registry: this.registry,
      defaultExecutionOptions: config.defaultExecutionOptions ?? {},
      enableLogging: config.enableLogging ?? false,
    };
  }

  // ============================================================
  // Hook Registration - Type-safe methods for each phase
  // ============================================================

  /**
   * Register a pre-authorize hook
   */
  onPreAuthorize(
    name: string,
    handler: HookHandler<PreAuthorizeContext>,
    options?: SimpleHookOptions
  ): HookDefinition<PreAuthorizeContext> {
    return this.registry.register({
      name,
      phase: HookPhase.PRE_AUTHORIZE,
      handler,
      ...options,
    });
  }

  /**
   * Register a post-authorize hook
   */
  onPostAuthorize(
    name: string,
    handler: HookHandler<PostAuthorizeContext>,
    options?: SimpleHookOptions
  ): HookDefinition<PostAuthorizeContext> {
    return this.registry.register({
      name,
      phase: HookPhase.POST_AUTHORIZE,
      handler,
      ...options,
    });
  }

  /**
   * Register a pre-execute hook
   */
  onPreExecute(
    name: string,
    handler: HookHandler<PreExecuteContext>,
    options?: SimpleHookOptions
  ): HookDefinition<PreExecuteContext> {
    return this.registry.register({
      name,
      phase: HookPhase.PRE_EXECUTE,
      handler,
      ...options,
    });
  }

  /**
   * Register a post-execute hook
   */
  onPostExecute(
    name: string,
    handler: HookHandler<PostExecuteContext>,
    options?: SimpleHookOptions
  ): HookDefinition<PostExecuteContext> {
    return this.registry.register({
      name,
      phase: HookPhase.POST_EXECUTE,
      handler,
      ...options,
    });
  }

  /**
   * Register an execution-failed hook
   */
  onExecutionFailed(
    name: string,
    handler: HookHandler<ExecutionFailedContext>,
    options?: SimpleHookOptions
  ): HookDefinition<ExecutionFailedContext> {
    return this.registry.register({
      name,
      phase: HookPhase.EXECUTION_FAILED,
      handler,
      ...options,
    });
  }

  /**
   * Register a trust-change hook
   */
  onTrustChange(
    name: string,
    handler: HookHandler<TrustChangeContext>,
    options?: SimpleHookOptions
  ): HookDefinition<TrustChangeContext> {
    return this.registry.register({
      name,
      phase: HookPhase.TRUST_CHANGE,
      handler,
      ...options,
    });
  }

  /**
   * Register a trust-violation hook
   */
  onTrustViolation(
    name: string,
    handler: HookHandler<TrustViolationContext>,
    options?: SimpleHookOptions
  ): HookDefinition<TrustViolationContext> {
    return this.registry.register({
      name,
      phase: HookPhase.TRUST_VIOLATION,
      handler,
      ...options,
    });
  }

  /**
   * Register an event-emitted hook
   */
  onEventEmitted(
    name: string,
    handler: HookHandler<EventEmittedContext>,
    options?: SimpleHookOptions
  ): HookDefinition<EventEmittedContext> {
    return this.registry.register({
      name,
      phase: HookPhase.EVENT_EMITTED,
      handler,
      ...options,
    });
  }

  /**
   * Register a hook with full options
   */
  register<T extends AnyHookContext>(
    options: RegisterHookOptions<T>
  ): HookDefinition<T> {
    return this.registry.register(options);
  }

  // ============================================================
  // Hook Execution
  // ============================================================

  /**
   * Execute pre-authorize hooks
   */
  async executePreAuthorize(
    context: Omit<PreAuthorizeContext, 'executionId' | 'startedAt' | 'metadata'>,
    options?: ExecuteHooksOptions
  ): Promise<HookExecutionSummary> {
    return this.execute(HookPhase.PRE_AUTHORIZE, context, options);
  }

  /**
   * Execute post-authorize hooks
   */
  async executePostAuthorize(
    context: Omit<PostAuthorizeContext, 'executionId' | 'startedAt' | 'metadata'>,
    options?: ExecuteHooksOptions
  ): Promise<HookExecutionSummary> {
    return this.execute(HookPhase.POST_AUTHORIZE, context, options);
  }

  /**
   * Execute pre-execute hooks
   */
  async executePreExecute(
    context: Omit<PreExecuteContext, 'executionId' | 'startedAt' | 'metadata'>,
    options?: ExecuteHooksOptions
  ): Promise<HookExecutionSummary> {
    return this.execute(HookPhase.PRE_EXECUTE, context, options);
  }

  /**
   * Execute post-execute hooks
   */
  async executePostExecute(
    context: Omit<PostExecuteContext, 'executionId' | 'startedAt' | 'metadata'>,
    options?: ExecuteHooksOptions
  ): Promise<HookExecutionSummary> {
    return this.execute(HookPhase.POST_EXECUTE, context, options);
  }

  /**
   * Execute execution-failed hooks
   */
  async executeExecutionFailed(
    context: Omit<ExecutionFailedContext, 'executionId' | 'startedAt' | 'metadata'>,
    options?: ExecuteHooksOptions
  ): Promise<HookExecutionSummary> {
    return this.execute(HookPhase.EXECUTION_FAILED, context, options);
  }

  /**
   * Execute trust-change hooks
   */
  async executeTrustChange(
    context: Omit<TrustChangeContext, 'executionId' | 'startedAt' | 'metadata'>,
    options?: ExecuteHooksOptions
  ): Promise<HookExecutionSummary> {
    return this.execute(HookPhase.TRUST_CHANGE, context, options);
  }

  /**
   * Execute trust-violation hooks
   */
  async executeTrustViolation(
    context: Omit<TrustViolationContext, 'executionId' | 'startedAt' | 'metadata'>,
    options?: ExecuteHooksOptions
  ): Promise<HookExecutionSummary> {
    return this.execute(HookPhase.TRUST_VIOLATION, context, options);
  }

  /**
   * Execute event-emitted hooks
   */
  async executeEventEmitted(
    context: Omit<EventEmittedContext, 'executionId' | 'startedAt' | 'metadata'>,
    options?: ExecuteHooksOptions
  ): Promise<HookExecutionSummary> {
    return this.execute(HookPhase.EVENT_EMITTED, context, options);
  }

  /**
   * Execute hooks for a phase
   */
  async execute(
    phase: HookPhase,
    context: Record<string, unknown>,
    options?: ExecuteHooksOptions
  ): Promise<HookExecutionSummary> {
    const mergedOptions = { ...this.config.defaultExecutionOptions, ...options };
    const summary = await this.executor.execute(phase, context, mergedOptions);

    if (this.config.enableLogging) {
      this.logSummary(summary);
    }

    return summary;
  }

  // ============================================================
  // Hook Management
  // ============================================================

  /**
   * Unregister a hook
   */
  unregister(hookId: string): boolean {
    return this.registry.unregister(hookId);
  }

  /**
   * Enable a hook
   */
  enable(hookId: string): boolean {
    return this.registry.enable(hookId);
  }

  /**
   * Disable a hook
   */
  disable(hookId: string): boolean {
    return this.registry.disable(hookId);
  }

  /**
   * Get a hook by ID
   */
  getHook<T extends AnyHookContext>(hookId: string): HookDefinition<T> | undefined {
    return this.registry.get<T>(hookId);
  }

  /**
   * Get all hooks for a phase
   */
  getHooksForPhase<T extends AnyHookContext>(phase: HookPhase): HookDefinition<T>[] {
    return this.registry.getByPhase<T>(phase);
  }

  /**
   * Get hook statistics
   */
  getStats(): ReturnType<HookRegistry['getStats']> {
    return this.registry.getStats();
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.registry.clear();
  }

  /**
   * Get the underlying registry
   */
  getRegistry(): HookRegistry {
    return this.registry;
  }

  /**
   * Get the underlying executor
   */
  getExecutor(): HookExecutor {
    return this.executor;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private logSummary(summary: HookExecutionSummary): void {
    const status = summary.aborted ? 'ABORTED' : summary.failed > 0 ? 'FAILED' : 'OK';
    console.log(
      `[Hooks] ${summary.phase}: ${status} - ` +
      `${summary.succeeded}/${summary.hooksExecuted} succeeded ` +
      `(${summary.totalDurationMs}ms)`
    );

    if (summary.aborted && summary.abortReason) {
      console.log(`[Hooks] Abort reason: ${summary.abortReason}`);
    }

    for (const result of summary.results) {
      if (!result.result.success) {
        console.log(`[Hooks] ${result.hookName} failed: ${result.result.error?.message}`);
      }
    }
  }
}

/**
 * Create a hook manager
 */
export function createHookManager(config?: HookManagerConfig): HookManager {
  return new HookManager(config);
}

// Re-export utility functions
export { successResult, abortResult, errorResult };
