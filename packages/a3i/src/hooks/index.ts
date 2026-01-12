/**
 * Hooks module - Extensibility system for ORION platform
 *
 * @example
 * ```typescript
 * import { createHookManager, HookPhase, HookPriority } from '@orion/a3i/hooks';
 *
 * const hooks = createHookManager();
 *
 * // Register a pre-authorize hook
 * hooks.onPreAuthorize('audit-logger', async (ctx) => {
 *   console.log(`Authorizing intent ${ctx.intent.intentId}`);
 *   return { success: true, durationMs: 0 };
 * }, { priority: HookPriority.MONITOR });
 *
 * // Register a hook that can abort
 * hooks.onPreAuthorize('rate-limiter', async (ctx) => {
 *   if (isRateLimited(ctx.intent.agentId)) {
 *     return {
 *       success: true,
 *       abort: true,
 *       abortReason: 'Rate limit exceeded',
 *       durationMs: 1,
 *     };
 *   }
 *   return { success: true, durationMs: 1 };
 * }, { priority: HookPriority.HIGH });
 *
 * // Execute hooks
 * const summary = await hooks.executePreAuthorize({
 *   correlationId: 'xxx',
 *   intent: myIntent,
 *   profile: agentProfile,
 * });
 *
 * if (summary.aborted) {
 *   console.log(`Authorization aborted: ${summary.abortReason}`);
 * }
 * ```
 */

// Types
export {
  HookPhase,
  HookPriority,
  type HookResult,
  type HookContext,
  type PreAuthorizeContext,
  type PostAuthorizeContext,
  type PreExecuteContext,
  type PostExecuteContext,
  type ExecutionFailedContext,
  type TrustChangeContext,
  type TrustViolationContext,
  type EventEmittedContext,
  type AnyHookContext,
  type HookHandler,
  type HookDefinition,
  type HookExecutionSummary,
} from './types.js';

// Registry
export {
  HookRegistry,
  createHookRegistry,
  getGlobalHookRegistry,
  resetGlobalHookRegistry,
  HookRegistryError,
  HookRegistryErrorCode,
  type RegisterHookOptions,
} from './registry.js';

// Executor
export {
  HookExecutor,
  createHookExecutor,
  type ExecuteHooksOptions,
} from './executor.js';

// Manager
export {
  HookManager,
  createHookManager,
  successResult,
  abortResult,
  errorResult,
  type HookManagerConfig,
  type SimpleHookOptions,
} from './manager.js';
