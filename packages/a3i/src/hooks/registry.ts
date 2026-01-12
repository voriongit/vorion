/**
 * Hook Registry - Central registry for hook management
 *
 * Manages registration, retrieval, and lifecycle of hooks.
 */

import {
  HookPhase,
  HookPriority,
  type HookDefinition,
  type HookHandler,
  type AnyHookContext,
} from './types.js';

/**
 * Options for registering a hook
 */
export interface RegisterHookOptions<T extends AnyHookContext = AnyHookContext> {
  /** Unique hook ID (auto-generated if not provided) */
  id?: string;
  /** Hook name */
  name: string;
  /** Hook phase */
  phase: HookPhase;
  /** The handler function */
  handler: HookHandler<T>;
  /** Execution priority (default: NORMAL) */
  priority?: HookPriority;
  /** Whether enabled (default: true) */
  enabled?: boolean;
  /** Timeout in ms (default: 5000) */
  timeoutMs?: number;
  /** Continue on error (default: false) */
  continueOnError?: boolean;
  /** Filter function */
  filter?: (context: T) => boolean;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Hook registry error
 */
export class HookRegistryError extends Error {
  constructor(
    message: string,
    public readonly code: HookRegistryErrorCode,
    public readonly hookId?: string
  ) {
    super(message);
    this.name = 'HookRegistryError';
  }
}

/**
 * Error codes for hook registry
 */
export enum HookRegistryErrorCode {
  DUPLICATE_HOOK = 'DUPLICATE_HOOK',
  HOOK_NOT_FOUND = 'HOOK_NOT_FOUND',
  INVALID_HOOK = 'INVALID_HOOK',
}

/**
 * Counter for generating unique hook IDs
 */
let hookIdCounter = 0;

/**
 * Generate a unique hook ID
 */
function generateHookId(phase: HookPhase): string {
  hookIdCounter++;
  return `${phase}-${hookIdCounter}-${Date.now().toString(36)}`;
}

/**
 * HookRegistry - Manages hook registration and retrieval
 */
export class HookRegistry {
  private hooks: Map<string, HookDefinition> = new Map();
  private hooksByPhase: Map<HookPhase, Set<string>> = new Map();

  constructor() {
    // Initialize phase sets
    for (const phase of Object.values(HookPhase)) {
      this.hooksByPhase.set(phase, new Set());
    }
  }

  /**
   * Register a new hook
   */
  register<T extends AnyHookContext>(
    options: RegisterHookOptions<T>
  ): HookDefinition<T> {
    const id = options.id ?? generateHookId(options.phase);

    if (this.hooks.has(id)) {
      throw new HookRegistryError(
        `Hook with ID '${id}' already exists`,
        HookRegistryErrorCode.DUPLICATE_HOOK,
        id
      );
    }

    const hook: HookDefinition<T> = {
      id,
      name: options.name,
      phase: options.phase,
      priority: options.priority ?? HookPriority.NORMAL,
      handler: options.handler,
      enabled: options.enabled ?? true,
      timeoutMs: options.timeoutMs ?? 5000,
      continueOnError: options.continueOnError ?? false,
      filter: options.filter,
      metadata: options.metadata,
    };

    this.hooks.set(id, hook as HookDefinition);
    this.hooksByPhase.get(options.phase)!.add(id);

    return hook;
  }

  /**
   * Unregister a hook
   */
  unregister(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) {
      return false;
    }

    this.hooks.delete(hookId);
    this.hooksByPhase.get(hook.phase)!.delete(hookId);

    return true;
  }

  /**
   * Get a hook by ID
   */
  get<T extends AnyHookContext>(hookId: string): HookDefinition<T> | undefined {
    return this.hooks.get(hookId) as HookDefinition<T> | undefined;
  }

  /**
   * Get all hooks for a phase, sorted by priority
   */
  getByPhase<T extends AnyHookContext>(phase: HookPhase): HookDefinition<T>[] {
    const hookIds = this.hooksByPhase.get(phase) ?? new Set();
    const hooks: HookDefinition<T>[] = [];

    for (const id of hookIds) {
      const hook = this.hooks.get(id);
      if (hook) {
        hooks.push(hook as HookDefinition<T>);
      }
    }

    // Sort by priority (lower number = higher priority)
    return hooks.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get enabled hooks for a phase, sorted by priority
   */
  getEnabledByPhase<T extends AnyHookContext>(phase: HookPhase): HookDefinition<T>[] {
    return this.getByPhase<T>(phase).filter(h => h.enabled);
  }

  /**
   * Enable a hook
   */
  enable(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) {
      return false;
    }
    hook.enabled = true;
    return true;
  }

  /**
   * Disable a hook
   */
  disable(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) {
      return false;
    }
    hook.enabled = false;
    return true;
  }

  /**
   * Check if a hook exists
   */
  has(hookId: string): boolean {
    return this.hooks.has(hookId);
  }

  /**
   * Get the count of hooks
   */
  count(phase?: HookPhase): number {
    if (phase) {
      return this.hooksByPhase.get(phase)?.size ?? 0;
    }
    return this.hooks.size;
  }

  /**
   * Get all hook IDs
   */
  getIds(): string[] {
    return Array.from(this.hooks.keys());
  }

  /**
   * Get all hooks
   */
  getAll(): HookDefinition[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks.clear();
    for (const phase of Object.values(HookPhase)) {
      this.hooksByPhase.set(phase, new Set());
    }
  }

  /**
   * Clear hooks for a specific phase
   */
  clearPhase(phase: HookPhase): void {
    const hookIds = this.hooksByPhase.get(phase) ?? new Set();
    for (const id of hookIds) {
      this.hooks.delete(id);
    }
    this.hooksByPhase.set(phase, new Set());
  }

  /**
   * Get statistics about registered hooks
   */
  getStats(): {
    totalHooks: number;
    enabledHooks: number;
    disabledHooks: number;
    byPhase: Record<string, number>;
    byPriority: Record<string, number>;
  } {
    const byPhase: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let enabledCount = 0;
    let disabledCount = 0;

    for (const [phase, ids] of this.hooksByPhase) {
      byPhase[phase] = ids.size;
    }

    for (const hook of this.hooks.values()) {
      if (hook.enabled) {
        enabledCount++;
      } else {
        disabledCount++;
      }

      const priorityName = HookPriority[hook.priority] ?? String(hook.priority);
      byPriority[priorityName] = (byPriority[priorityName] ?? 0) + 1;
    }

    return {
      totalHooks: this.hooks.size,
      enabledHooks: enabledCount,
      disabledHooks: disabledCount,
      byPhase,
      byPriority,
    };
  }
}

/**
 * Create a new hook registry
 */
export function createHookRegistry(): HookRegistry {
  return new HookRegistry();
}

/**
 * Global hook registry singleton
 */
let globalRegistry: HookRegistry | null = null;

/**
 * Get or create the global hook registry
 */
export function getGlobalHookRegistry(): HookRegistry {
  if (!globalRegistry) {
    globalRegistry = createHookRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global hook registry (for testing)
 */
export function resetGlobalHookRegistry(): void {
  globalRegistry = null;
}
