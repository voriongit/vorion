/**
 * Trust-Aware LangChain Executor
 *
 * Wraps LangChain agents with trust-based access control.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { TrustLevel } from '../common/types.js';
import { TrustInsufficientError } from '../common/types.js';
import type { TrustEngine, TrustRecord } from '../trust-engine/index.js';
import { TRUST_LEVEL_NAMES } from '../trust-engine/index.js';
import { TrustCallbackHandler, createTrustCallback } from './callback.js';
import type {
  TrustAwareAgentConfig,
  TrustCheckResult,
  TrustedExecutionResult,
} from './types.js';

const logger = createLogger({ component: 'langchain-executor' });

/**
 * Trust-aware agent executor
 *
 * Provides trust-gated execution for LangChain agents.
 */
export class TrustAwareExecutor {
  private trustEngine: TrustEngine;
  private callback: TrustCallbackHandler;
  private config: TrustAwareAgentConfig;

  constructor(trustEngine: TrustEngine, config: TrustAwareAgentConfig) {
    this.trustEngine = trustEngine;
    this.config = config;
    this.callback = createTrustCallback(trustEngine, config);
  }

  /**
   * Get the callback handler for use with LangChain
   */
  get callbackHandler(): TrustCallbackHandler {
    return this.callback;
  }

  /**
   * Get the agent ID
   */
  get agentId(): string {
    return this.config.agentId;
  }

  /**
   * Initialize the executor
   */
  async initialize(): Promise<void> {
    await this.callback.initialize();
  }

  /**
   * Check if the agent has sufficient trust to execute
   */
  async checkTrust(requiredLevel?: TrustLevel): Promise<TrustCheckResult> {
    const minLevel = requiredLevel ?? this.config.minTrustLevel ?? 1;
    const record = await this.trustEngine.getScore(this.config.agentId);

    if (!record) {
      return {
        allowed: false,
        agentId: this.config.agentId,
        currentLevel: 0,
        currentScore: 0,
        requiredLevel: minLevel,
        reason: 'Agent not initialized in trust engine',
      };
    }

    const allowed = record.level >= minLevel;

    return {
      allowed,
      agentId: this.config.agentId,
      currentLevel: record.level,
      currentScore: record.score,
      requiredLevel: minLevel,
      reason: allowed
        ? `Trust level ${TRUST_LEVEL_NAMES[record.level]} meets requirement`
        : `Trust level ${TRUST_LEVEL_NAMES[record.level]} below required ${TRUST_LEVEL_NAMES[minLevel]}`,
    };
  }

  /**
   * Execute a function with trust gating
   *
   * @param fn - The function to execute (typically agent.invoke)
   * @param requiredLevel - Override minimum trust level for this execution
   * @throws TrustInsufficientError if trust is too low
   */
  async execute<T>(
    fn: () => Promise<T>,
    requiredLevel?: TrustLevel
  ): Promise<TrustedExecutionResult<T>> {
    // Check trust before execution
    const trustCheck = await this.checkTrust(requiredLevel);

    if (!trustCheck.allowed) {
      logger.warn(
        {
          agentId: this.config.agentId,
          currentLevel: trustCheck.currentLevel,
          requiredLevel: trustCheck.requiredLevel,
        },
        'Execution blocked due to insufficient trust'
      );

      throw new TrustInsufficientError(
        trustCheck.requiredLevel,
        trustCheck.currentLevel
      );
    }

    const initialSignals = this.callback.signalsRecorded;

    try {
      // Execute the function
      const result = await fn();

      // Get final trust state
      const finalRecord = await this.trustEngine.getScore(this.config.agentId);

      logger.info(
        {
          agentId: this.config.agentId,
          signalsRecorded: this.callback.signalsRecorded - initialSignals,
          finalScore: finalRecord?.score,
        },
        'Trusted execution completed'
      );

      return {
        result,
        trustCheck,
        signalsRecorded: this.callback.signalsRecorded - initialSignals,
        finalScore: finalRecord?.score ?? 0,
        finalLevel: finalRecord?.level ?? 0,
      };
    } catch (error) {
      // Record failure signal
      if (this.config.recordErrors !== false) {
        await this.trustEngine.recordSignal({
          id: crypto.randomUUID(),
          entityId: this.config.agentId,
          type: 'behavioral.execution_failure',
          value: 0.1,
          source: 'langchain-executor',
          timestamp: new Date().toISOString(),
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }

      throw error;
    }
  }

  /**
   * Get current trust record for the agent
   */
  async getTrustRecord(): Promise<TrustRecord | undefined> {
    return this.trustEngine.getScore(this.config.agentId);
  }

  /**
   * Manually record a positive signal
   */
  async recordSuccess(type: string, value = 0.8): Promise<void> {
    await this.trustEngine.recordSignal({
      id: crypto.randomUUID(),
      entityId: this.config.agentId,
      type: `behavioral.${type}`,
      value,
      source: 'manual',
      timestamp: new Date().toISOString(),
      metadata: {},
    });
  }

  /**
   * Manually record a negative signal
   */
  async recordFailure(type: string, value = 0.1): Promise<void> {
    await this.trustEngine.recordSignal({
      id: crypto.randomUUID(),
      entityId: this.config.agentId,
      type: `behavioral.${type}`,
      value,
      source: 'manual',
      timestamp: new Date().toISOString(),
      metadata: {},
    });
  }
}

/**
 * Create a trust-aware executor
 */
export function createTrustAwareExecutor(
  trustEngine: TrustEngine,
  config: TrustAwareAgentConfig
): TrustAwareExecutor {
  return new TrustAwareExecutor(trustEngine, config);
}
