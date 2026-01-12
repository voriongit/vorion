/**
 * A3I Orchestrator - Unified authorization and execution flow
 *
 * The Orchestrator provides a high-level interface that combines:
 * - Authorization (via AuthorizationEngine)
 * - Execution (via ExecutionEngine)
 * - Trust management (via TrustProfileService)
 * - Audit logging (via ProofPlane integration)
 *
 * This is the primary entry point for processing agent intents.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Intent, Decision, TrustProfile, AuthorizationResponse } from '@orion/contracts';
import {
  AuthorizationEngine,
  type AuthorizationEngineConfig,
} from '../authorization/engine.js';
import {
  ExecutionEngine,
  type ExecutionEngineConfig,
  type ExecutionResult,
  type ActionExecutor,
} from '../execution/engine.js';
import {
  TrustProfileService,
  type ProfileServiceConfig,
} from '../trust/profile-service.js';
import { type HookManager } from '../hooks/index.js';

/**
 * Logger interface for orchestrator events
 * Can be implemented with ProofPlane or any other logging system
 */
export interface OrchestratorLogger {
  /** Log when an intent is received */
  logIntentReceived?(intent: Intent, correlationId: string): Promise<void>;
  /** Log when an authorization decision is made */
  logDecisionMade?(decision: Decision, intent: Intent, correlationId: string): Promise<void>;
  /** Log when execution starts */
  logExecutionStarted?(
    executionId: string,
    intent: Intent,
    decision: Decision,
    correlationId: string
  ): Promise<void>;
  /** Log when execution completes successfully */
  logExecutionCompleted?(
    executionId: string,
    intent: Intent,
    result: unknown,
    durationMs: number,
    correlationId: string
  ): Promise<void>;
  /** Log when execution fails */
  logExecutionFailed?(
    executionId: string,
    intent: Intent,
    error: Error,
    durationMs: number,
    retryable: boolean,
    correlationId: string
  ): Promise<void>;
}

/**
 * No-op logger for when logging is not needed
 */
export const noopOrchestratorLogger: OrchestratorLogger = {};

/**
 * Result of processing an intent through the orchestrator
 */
export interface OrchestratorResult<T = unknown> {
  /** Unique ID for this orchestration */
  orchestrationId: string;
  /** The original intent */
  intent: Intent;
  /** Authorization response */
  authorization: AuthorizationResponse;
  /** Execution result (only if authorized and executed) */
  execution?: ExecutionResult<T>;
  /** Agent's trust profile */
  profile?: TrustProfile;
  /** Overall success (authorized AND executed successfully) */
  success: boolean;
  /** Total processing time in ms */
  totalDurationMs: number;
  /** Breakdown of timing */
  timing: {
    authorizationMs: number;
    executionMs?: number;
    profileLookupMs: number;
  };
}

/**
 * Options for processing an intent
 */
export interface ProcessIntentOptions<TParams = unknown> {
  /** Custom executor for this intent */
  executor?: ActionExecutor<TParams>;
  /** Execution parameters */
  params?: TParams;
  /** Skip execution even if authorized */
  authorizeOnly?: boolean;
  /** Custom correlation ID */
  correlationId?: string;
}

/**
 * Configuration for the orchestrator
 */
export interface OrchestratorConfig {
  /** Authorization engine config */
  authorizationConfig?: AuthorizationEngineConfig;
  /** Execution engine config */
  executionConfig?: ExecutionEngineConfig;
  /** Profile service config */
  profileServiceConfig?: ProfileServiceConfig;
  /** Shared hook manager (used by all components) */
  hookManager?: HookManager;
  /** Pre-configured authorization engine */
  authorizationEngine?: AuthorizationEngine;
  /** Pre-configured execution engine */
  executionEngine?: ExecutionEngine;
  /** Pre-configured profile service */
  profileService?: TrustProfileService;
  /** Logger for audit trail (e.g., ProofPlane) */
  logger?: OrchestratorLogger;
  /** Enable logging (default: true if logger provided) */
  enableLogging?: boolean;
}

/**
 * A3I Orchestrator - Unified intent processing
 */
export class Orchestrator {
  private readonly authEngine: AuthorizationEngine;
  private readonly execEngine: ExecutionEngine;
  private readonly profileService: TrustProfileService;
  private readonly hookManager?: HookManager;
  private readonly logger?: OrchestratorLogger;
  private readonly enableLogging: boolean;

  constructor(config: OrchestratorConfig = {}) {
    this.hookManager = config.hookManager;
    this.logger = config.logger;
    this.enableLogging = config.enableLogging ?? (config.logger !== undefined);

    // Create or use provided profile service
    this.profileService = config.profileService ?? new TrustProfileService({
      ...config.profileServiceConfig,
      hookManager: config.hookManager,
    });

    // Create or use provided authorization engine
    this.authEngine = config.authorizationEngine ?? new AuthorizationEngine({
      ...config.authorizationConfig,
      profileService: this.profileService,
      hookManager: config.hookManager,
    });

    // Create or use provided execution engine
    this.execEngine = config.executionEngine ?? new ExecutionEngine({
      ...config.executionConfig,
      hookManager: config.hookManager,
    });
  }

  /**
   * Process an intent through authorization and execution
   *
   * This is the main entry point for the orchestrator.
   * It handles the complete lifecycle:
   * 1. Log intent received
   * 2. Look up agent's trust profile
   * 3. Authorize the intent
   * 4. Log decision made
   * 5. Execute if authorized (unless authorizeOnly is set)
   * 6. Log execution result
   * 7. Return unified result
   */
  async processIntent<TParams = unknown, TResult = unknown>(
    intent: Intent,
    options: ProcessIntentOptions<TParams> = {}
  ): Promise<OrchestratorResult<TResult>> {
    const orchestrationId = uuidv4();
    const correlationId = options.correlationId ?? intent.correlationId;
    const startTime = Date.now();
    const timing = {
      authorizationMs: 0,
      executionMs: undefined as number | undefined,
      profileLookupMs: 0,
    };

    // Log intent received
    await this.log('logIntentReceived', intent, correlationId);

    // Step 1: Get agent's trust profile
    const profileStart = Date.now();
    const profile = await this.profileService.get(intent.agentId);
    timing.profileLookupMs = Date.now() - profileStart;

    // Step 2: Authorize the intent
    const authStart = Date.now();
    const authorization = await this.authEngine.authorize({
      intent,
      policySetId: options.correlationId,
    });
    timing.authorizationMs = Date.now() - authStart;

    // Log decision made
    await this.log('logDecisionMade', authorization.decision, intent, correlationId);

    // If not permitted or authorize-only, return early
    if (!authorization.decision.permitted || options.authorizeOnly) {
      return {
        orchestrationId,
        intent,
        authorization,
        profile: profile ?? undefined,
        success: false,
        totalDurationMs: Date.now() - startTime,
        timing,
      };
    }

    // Log execution started
    const executionId = uuidv4();
    await this.log('logExecutionStarted', executionId, intent, authorization.decision, correlationId);

    // Step 3: Execute the intent
    const execStart = Date.now();
    const execution = await this.execEngine.execute<TParams, TResult>({
      intent,
      decision: authorization.decision,
      profile: profile!,
      executor: options.executor,
      params: options.params,
    });
    timing.executionMs = Date.now() - execStart;

    // Log execution result
    if (execution.success) {
      await this.log(
        'logExecutionCompleted',
        executionId,
        intent,
        execution.result,
        execution.durationMs,
        correlationId
      );
    } else {
      await this.log(
        'logExecutionFailed',
        executionId,
        intent,
        execution.error ?? new Error('Unknown error'),
        execution.durationMs,
        execution.retryable ?? false,
        correlationId
      );
    }

    return {
      orchestrationId,
      intent,
      authorization,
      execution,
      profile: profile ?? undefined,
      success: execution.success,
      totalDurationMs: Date.now() - startTime,
      timing,
    };
  }

  /**
   * Helper to call logger methods safely
   */
  private async log<K extends keyof OrchestratorLogger>(
    method: K,
    ...args: Parameters<NonNullable<OrchestratorLogger[K]>>
  ): Promise<void> {
    if (!this.enableLogging || !this.logger) return;
    const fn = this.logger[method];
    if (typeof fn === 'function') {
      try {
        await (fn as (...a: unknown[]) => Promise<void>).apply(this.logger, args);
      } catch (error) {
        // Log errors should not break the orchestration flow
        console.error(`[Orchestrator] Logger error in ${method}:`, error);
      }
    }
  }

  /**
   * Authorize an intent without executing
   */
  async authorize(intent: Intent): Promise<AuthorizationResponse> {
    return this.authEngine.authorize({ intent });
  }

  /**
   * Execute a pre-authorized intent
   */
  async execute<TParams = unknown, TResult = unknown>(
    intent: Intent,
    decision: Decision,
    profile: TrustProfile,
    options: { executor?: ActionExecutor<TParams>; params?: TParams } = {}
  ): Promise<ExecutionResult<TResult>> {
    return this.execEngine.execute<TParams, TResult>({
      intent,
      decision,
      profile,
      executor: options.executor,
      params: options.params,
    });
  }

  /**
   * Register an executor for an action type
   */
  registerExecutor(actionType: string, executor: ActionExecutor): void {
    this.execEngine.registerExecutor(actionType, executor);
  }

  /**
   * Unregister an executor
   */
  unregisterExecutor(actionType: string): boolean {
    return this.execEngine.unregisterExecutor(actionType);
  }

  /**
   * Get the authorization engine
   */
  getAuthorizationEngine(): AuthorizationEngine {
    return this.authEngine;
  }

  /**
   * Get the execution engine
   */
  getExecutionEngine(): ExecutionEngine {
    return this.execEngine;
  }

  /**
   * Get the profile service
   */
  getProfileService(): TrustProfileService {
    return this.profileService;
  }

  /**
   * Get the hook manager
   */
  getHookManager(): HookManager | undefined {
    return this.hookManager;
  }

  /**
   * Get the logger
   */
  getLogger(): OrchestratorLogger | undefined {
    return this.logger;
  }

  /**
   * Check if logging is enabled
   */
  isLoggingEnabled(): boolean {
    return this.enableLogging;
  }
}

/**
 * Create an orchestrator with default configuration
 */
export function createOrchestrator(config?: OrchestratorConfig): Orchestrator {
  return new Orchestrator(config);
}

/**
 * Builder for creating a configured orchestrator
 */
export class OrchestratorBuilder {
  private config: OrchestratorConfig = {};

  /**
   * Set the hook manager
   */
  withHookManager(hookManager: HookManager): this {
    this.config.hookManager = hookManager;
    return this;
  }

  /**
   * Set the profile service
   */
  withProfileService(profileService: TrustProfileService): this {
    this.config.profileService = profileService;
    return this;
  }

  /**
   * Set profile service config
   */
  withProfileServiceConfig(config: ProfileServiceConfig): this {
    this.config.profileServiceConfig = config;
    return this;
  }

  /**
   * Set authorization engine config
   */
  withAuthorizationConfig(config: AuthorizationEngineConfig): this {
    this.config.authorizationConfig = config;
    return this;
  }

  /**
   * Set execution engine config
   */
  withExecutionConfig(config: ExecutionEngineConfig): this {
    this.config.executionConfig = config;
    return this;
  }

  /**
   * Use a pre-configured authorization engine
   */
  withAuthorizationEngine(engine: AuthorizationEngine): this {
    this.config.authorizationEngine = engine;
    return this;
  }

  /**
   * Use a pre-configured execution engine
   */
  withExecutionEngine(engine: ExecutionEngine): this {
    this.config.executionEngine = engine;
    return this;
  }

  /**
   * Set the logger (e.g., ProofPlane adapter)
   */
  withLogger(logger: OrchestratorLogger): this {
    this.config.logger = logger;
    return this;
  }

  /**
   * Enable or disable logging
   */
  withLogging(enabled: boolean): this {
    this.config.enableLogging = enabled;
    return this;
  }

  /**
   * Build the orchestrator
   */
  build(): Orchestrator {
    return new Orchestrator(this.config);
  }
}

/**
 * Create an orchestrator builder
 */
export function orchestratorBuilder(): OrchestratorBuilder {
  return new OrchestratorBuilder();
}
