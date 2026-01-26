/**
 * Trust-Aware LangChain Executor
 *
 * Wraps LangChain agents with trust-based access control and robust error handling.
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
  ClassifiedLLMError,
  LLMErrorType,
  LLMRetryConfig,
  TrustAwareAgentConfigWithRetry,
} from './types.js';

const logger = createLogger({ component: 'langchain-executor' });

/**
 * Default retryable error types
 */
const DEFAULT_RETRYABLE_ERRORS: LLMErrorType[] = [
  'rate_limit',
  'timeout',
  'network',
  'server_error',
  'model_unavailable',
];

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<Omit<LLMRetryConfig, 'onRetry'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: DEFAULT_RETRYABLE_ERRORS,
};

/**
 * Classify an error into a known LLM error type
 */
export function classifyLLMError(error: Error): ClassifiedLLMError {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Rate limit errors
  if (
    message.includes('rate limit') ||
    message.includes('rate_limit') ||
    message.includes('too many requests') ||
    message.includes('429')
  ) {
    // Try to extract retry-after header
    const retryMatch = message.match(/retry after (\d+)/i);
    const retryAfterMs = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : undefined;

    return {
      type: 'rate_limit',
      message: 'API rate limit exceeded',
      originalError: error,
      retryable: true,
      retryAfterMs,
      metadata: { originalMessage: error.message },
    };
  }

  // Context length errors
  if (
    message.includes('context length') ||
    message.includes('maximum context') ||
    message.includes('too long') ||
    message.includes('token limit') ||
    message.includes('max_tokens')
  ) {
    return {
      type: 'context_length',
      message: 'Input or output exceeds maximum context length',
      originalError: error,
      retryable: false,
      metadata: { originalMessage: error.message },
    };
  }

  // Authentication errors
  if (
    message.includes('unauthorized') ||
    message.includes('invalid api key') ||
    message.includes('authentication') ||
    message.includes('401') ||
    message.includes('403')
  ) {
    return {
      type: 'authentication',
      message: 'API authentication failed',
      originalError: error,
      retryable: false,
      metadata: { originalMessage: error.message },
    };
  }

  // Model unavailable
  if (
    message.includes('model not found') ||
    message.includes('model_not_available') ||
    message.includes('overloaded') ||
    message.includes('capacity')
  ) {
    return {
      type: 'model_unavailable',
      message: 'Model is unavailable or overloaded',
      originalError: error,
      retryable: true,
      metadata: { originalMessage: error.message },
    };
  }

  // Content filter errors
  if (
    message.includes('content filter') ||
    message.includes('content_policy') ||
    message.includes('safety') ||
    message.includes('blocked')
  ) {
    return {
      type: 'content_filter',
      message: 'Content blocked by safety filters',
      originalError: error,
      retryable: false,
      metadata: { originalMessage: error.message },
    };
  }

  // Timeout errors
  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    name.includes('timeout') ||
    message.includes('econnreset')
  ) {
    return {
      type: 'timeout',
      message: 'Request timed out',
      originalError: error,
      retryable: true,
      metadata: { originalMessage: error.message },
    };
  }

  // Network errors
  if (
    message.includes('network') ||
    message.includes('enotfound') ||
    message.includes('econnrefused') ||
    message.includes('socket') ||
    name.includes('fetch')
  ) {
    return {
      type: 'network',
      message: 'Network connectivity error',
      originalError: error,
      retryable: true,
      metadata: { originalMessage: error.message },
    };
  }

  // Invalid request errors
  if (
    message.includes('invalid') ||
    message.includes('bad request') ||
    message.includes('400')
  ) {
    return {
      type: 'invalid_request',
      message: 'Invalid request format',
      originalError: error,
      retryable: false,
      metadata: { originalMessage: error.message },
    };
  }

  // Server errors
  if (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('internal server error') ||
    message.includes('service unavailable')
  ) {
    return {
      type: 'server_error',
      message: 'Provider server error',
      originalError: error,
      retryable: true,
      metadata: { originalMessage: error.message },
    };
  }

  // Unknown error
  return {
    type: 'unknown',
    message: error.message,
    originalError: error,
    retryable: false,
    metadata: { originalMessage: error.message, errorName: error.name },
  };
}

/**
 * Calculate delay for retry with exponential backoff
 */
function calculateRetryDelay(
  attempt: number,
  config: Required<Omit<LLMRetryConfig, 'onRetry'>>,
  classifiedError?: ClassifiedLLMError
): number {
  // Use retry-after if provided by the error
  if (classifiedError?.retryAfterMs) {
    return Math.min(classifiedError.retryAfterMs, config.maxDelayMs);
  }

  // Exponential backoff with jitter
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Trust-aware agent executor
 *
 * Provides trust-gated execution for LangChain agents with robust error handling.
 */
export class TrustAwareExecutor {
  private trustEngine: TrustEngine;
  private callback: TrustCallbackHandler;
  private config: TrustAwareAgentConfigWithRetry;
  private retryConfig: Required<Omit<LLMRetryConfig, 'onRetry'>> & { onRetry?: LLMRetryConfig['onRetry'] };
  private errorClassifier: (error: Error) => ClassifiedLLMError;

  constructor(trustEngine: TrustEngine, config: TrustAwareAgentConfigWithRetry) {
    this.trustEngine = trustEngine;
    this.config = config;
    this.callback = createTrustCallback(trustEngine, config);

    // Set up retry configuration
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...config.retryConfig,
    };

    // Set up error classifier
    this.errorClassifier = config.errorClassifier ?? classifyLLMError;
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
   * Execute a function with trust gating and automatic retry
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

    // Execute with retry logic
    const result = await this.executeWithRetry(fn);

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
  }

  /**
   * Execute a function with automatic retry for transient errors
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: ClassifiedLLMError | undefined;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const classifiedError = this.errorClassifier(
          error instanceof Error ? error : new Error(String(error))
        );
        lastError = classifiedError;

        // Log the error with classification
        logger.warn(
          {
            agentId: this.config.agentId,
            attempt,
            maxAttempts: this.retryConfig.maxRetries + 1,
            errorType: classifiedError.type,
            retryable: classifiedError.retryable,
            message: classifiedError.message,
          },
          'Execution attempt failed'
        );

        // Check if we should retry
        const isRetryableType = this.retryConfig.retryableErrors.includes(classifiedError.type);
        const hasRetriesLeft = attempt <= this.retryConfig.maxRetries;
        const shouldRetry = classifiedError.retryable && isRetryableType && hasRetriesLeft;

        if (!shouldRetry) {
          // Record failure signal with classification
          await this.recordClassifiedFailure(classifiedError);
          throw classifiedError.originalError;
        }

        // Calculate delay and wait
        const delayMs = calculateRetryDelay(attempt, this.retryConfig, classifiedError);

        logger.info(
          {
            agentId: this.config.agentId,
            attempt,
            delayMs,
            errorType: classifiedError.type,
          },
          'Retrying after delay'
        );

        // Call retry callback if configured
        if (this.retryConfig.onRetry) {
          try {
            this.retryConfig.onRetry(classifiedError, attempt, delayMs);
          } catch (callbackError) {
            logger.warn({ callbackError }, 'Error in onRetry callback');
          }
        }

        await sleep(delayMs);
      }
    }

    // Should never reach here, but just in case
    if (lastError) {
      await this.recordClassifiedFailure(lastError);
      throw lastError.originalError;
    }

    throw new Error('Execution failed with no error captured');
  }

  /**
   * Record a classified failure signal
   */
  private async recordClassifiedFailure(classifiedError: ClassifiedLLMError): Promise<void> {
    if (this.config.recordErrors === false) {
      return;
    }

    // Determine signal value based on error type
    // Non-retryable errors have lower trust impact (not the agent's fault)
    const signalValue = classifiedError.retryable ? 0.1 : 0.2;

    await this.trustEngine.recordSignal({
      id: crypto.randomUUID(),
      entityId: this.config.agentId,
      type: `behavioral.execution_failure.${classifiedError.type}`,
      value: signalValue,
      source: 'langchain-executor',
      timestamp: new Date().toISOString(),
      metadata: {
        errorType: classifiedError.type,
        errorMessage: classifiedError.message,
        retryable: classifiedError.retryable,
        ...classifiedError.metadata,
      },
    });
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
