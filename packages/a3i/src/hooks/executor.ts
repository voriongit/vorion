/**
 * Hook Executor - Executes hooks in the proper order
 *
 * Handles timeout, error recovery, filtering, and abort logic.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  HookPhase,
  type HookDefinition,
  type HookResult,
  type HookContext,
  type HookExecutionSummary,
  type AnyHookContext,
} from './types.js';
import { type HookRegistry } from './registry.js';

/**
 * Options for hook execution
 */
export interface ExecuteHooksOptions {
  /** Whether to stop on first abort */
  stopOnAbort?: boolean;
  /** Whether to stop on first error (if continueOnError is false) */
  stopOnError?: boolean;
  /** Global timeout override (applied per hook) */
  timeoutMs?: number;
  /** Whether to run hooks in parallel (default: sequential) */
  parallel?: boolean;
}

/**
 * Default execution options
 */
const DEFAULT_OPTIONS: Required<ExecuteHooksOptions> = {
  stopOnAbort: true,
  stopOnError: true,
  timeoutMs: 5000,
  parallel: false,
};

/**
 * Create a success hook result
 */
export function successResult(
  durationMs: number,
  modified?: unknown
): HookResult {
  return {
    success: true,
    durationMs,
    modified,
  };
}

/**
 * Create an abort hook result
 */
export function abortResult(
  reason: string,
  durationMs: number
): HookResult {
  return {
    success: true,
    abort: true,
    abortReason: reason,
    durationMs,
  };
}

/**
 * Create an error hook result
 */
export function errorResult(
  error: Error,
  durationMs: number
): HookResult {
  return {
    success: false,
    error,
    durationMs,
  };
}

/**
 * Execute a single hook with timeout
 */
async function executeHookWithTimeout<T extends AnyHookContext>(
  hook: HookDefinition<T>,
  context: T,
  timeoutMs: number
): Promise<HookResult> {
  const startTime = Date.now();

  return new Promise<HookResult>((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve({
        success: false,
        error: new Error(`Hook '${hook.name}' timed out after ${timeoutMs}ms`),
        durationMs: Date.now() - startTime,
      });
    }, timeoutMs);

    Promise.resolve()
      .then(() => hook.handler(context))
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          durationMs: Date.now() - startTime,
        });
      });
  });
}

/**
 * HookExecutor - Executes hooks from a registry
 */
export class HookExecutor {
  private readonly registry: HookRegistry;

  constructor(registry: HookRegistry) {
    this.registry = registry;
  }

  /**
   * Execute all hooks for a phase
   */
  async execute<T extends AnyHookContext>(
    phase: HookPhase,
    context: Omit<T, keyof HookContext>,
    options: ExecuteHooksOptions = {}
  ): Promise<HookExecutionSummary> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();

    // Get enabled hooks for this phase
    const hooks = this.registry.getEnabledByPhase<T>(phase);

    // Build full context
    const fullContext: T = {
      executionId: uuidv4(),
      correlationId: (context as Record<string, unknown>).correlationId as string ?? uuidv4(),
      startedAt: new Date(),
      metadata: {},
      ...context,
    } as T;

    const results: HookExecutionSummary['results'] = [];
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    let aborted = false;
    let abortReason: string | undefined;

    if (opts.parallel) {
      // Execute hooks in parallel
      const promises = hooks.map(async (hook) => {
        // Check filter
        if (hook.filter && !hook.filter(fullContext)) {
          skipped++;
          return { hookId: hook.id, hookName: hook.name, skipped: true };
        }

        const timeout = opts.timeoutMs ?? hook.timeoutMs ?? 5000;
        const result = await executeHookWithTimeout(hook, fullContext, timeout);

        return { hookId: hook.id, hookName: hook.name, result };
      });

      const hookResults = await Promise.all(promises);

      for (const hr of hookResults) {
        if ('skipped' in hr && hr.skipped) {
          continue;
        }

        const { hookId, hookName, result } = hr as {
          hookId: string;
          hookName: string;
          result: HookResult;
        };

        results.push({ hookId, hookName, result });

        if (result.success) {
          succeeded++;
          if (result.abort && !aborted) {
            aborted = true;
            abortReason = result.abortReason;
          }
        } else {
          failed++;
        }
      }
    } else {
      // Execute hooks sequentially
      for (const hook of hooks) {
        // Check filter
        if (hook.filter && !hook.filter(fullContext)) {
          skipped++;
          continue;
        }

        const timeout = opts.timeoutMs ?? hook.timeoutMs ?? 5000;
        const result = await executeHookWithTimeout(hook, fullContext, timeout);

        results.push({
          hookId: hook.id,
          hookName: hook.name,
          result,
        });

        if (result.success) {
          succeeded++;

          if (result.abort) {
            aborted = true;
            abortReason = result.abortReason;

            if (opts.stopOnAbort) {
              break;
            }
          }
        } else {
          failed++;

          if (!hook.continueOnError && opts.stopOnError) {
            break;
          }
        }
      }
    }

    return {
      phase,
      hooksExecuted: succeeded + failed,
      succeeded,
      failed,
      skipped,
      aborted,
      abortReason,
      totalDurationMs: Date.now() - startTime,
      results,
    };
  }

  /**
   * Execute a specific hook by ID
   */
  async executeById<T extends AnyHookContext>(
    hookId: string,
    context: Omit<T, keyof HookContext>,
    timeoutMs?: number
  ): Promise<HookResult | null> {
    const hook = this.registry.get<T>(hookId);
    if (!hook || !hook.enabled) {
      return null;
    }

    const fullContext: T = {
      executionId: uuidv4(),
      correlationId: (context as Record<string, unknown>).correlationId as string ?? uuidv4(),
      startedAt: new Date(),
      metadata: {},
      ...context,
    } as T;

    // Check filter
    if (hook.filter && !hook.filter(fullContext)) {
      return null;
    }

    const timeout = timeoutMs ?? hook.timeoutMs ?? 5000;
    return executeHookWithTimeout(hook, fullContext, timeout);
  }

  /**
   * Get the registry
   */
  getRegistry(): HookRegistry {
    return this.registry;
  }
}

/**
 * Create a hook executor
 */
export function createHookExecutor(registry: HookRegistry): HookExecutor {
  return new HookExecutor(registry);
}
