/**
 * LangChain Adapter Types
 *
 * Type definitions for LangChain integration.
 *
 * @packageDocumentation
 */

import type { TrustLevel } from '../common/types.js';

/**
 * Trust-aware agent configuration
 */
export interface TrustAwareAgentConfig {
  /** Unique agent identifier */
  agentId: string;
  /** Initial trust level for new agents */
  initialTrustLevel?: TrustLevel;
  /** Minimum trust level required for execution */
  minTrustLevel?: TrustLevel;
  /** Whether to record tool usage as behavioral signals */
  recordToolUsage?: boolean;
  /** Whether to record LLM calls as behavioral signals */
  recordLlmCalls?: boolean;
  /** Whether to record errors as failure signals */
  recordErrors?: boolean;
  /** Custom signal weights */
  signalWeights?: {
    toolSuccess?: number;
    toolFailure?: number;
    llmSuccess?: number;
    llmFailure?: number;
    chainSuccess?: number;
    chainFailure?: number;
  };
}

/**
 * Trust callback event types
 */
export type TrustCallbackEvent =
  | 'tool_start'
  | 'tool_end'
  | 'tool_error'
  | 'llm_start'
  | 'llm_end'
  | 'llm_error'
  | 'chain_start'
  | 'chain_end'
  | 'chain_error'
  | 'agent_action'
  | 'agent_finish';

/**
 * Trust signal source
 */
export interface TrustSignalSource {
  event: TrustCallbackEvent;
  toolName?: string;
  modelName?: string;
  chainType?: string;
  duration?: number;
  tokenCount?: number;
  error?: Error;
}

/**
 * Trust check result
 */
export interface TrustCheckResult {
  allowed: boolean;
  agentId: string;
  currentLevel: TrustLevel;
  currentScore: number;
  requiredLevel: TrustLevel;
  reason: string;
}

/**
 * Agent execution result with trust context
 */
export interface TrustedExecutionResult<T = unknown> {
  result: T;
  trustCheck: TrustCheckResult;
  signalsRecorded: number;
  finalScore: number;
  finalLevel: TrustLevel;
}

/**
 * LLM error classification for better error handling
 */
export type LLMErrorType =
  | 'rate_limit'        // API rate limit exceeded
  | 'context_length'    // Input/output too long
  | 'authentication'    // API key invalid or expired
  | 'model_unavailable' // Model not available or overloaded
  | 'content_filter'    // Content blocked by safety filters
  | 'timeout'           // Request timed out
  | 'network'           // Network connectivity issues
  | 'invalid_request'   // Malformed request
  | 'server_error'      // Provider server error (5xx)
  | 'unknown';          // Unclassified error

/**
 * Classified LLM error with metadata
 */
export interface ClassifiedLLMError {
  type: LLMErrorType;
  message: string;
  originalError: Error;
  retryable: boolean;
  retryAfterMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Retry configuration for LLM calls
 */
export interface LLMRetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay between retries in ms (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Error types that should trigger retry (default: rate_limit, timeout, network, server_error) */
  retryableErrors?: LLMErrorType[];
  /** Callback when retry is attempted */
  onRetry?: (error: ClassifiedLLMError, attempt: number, delayMs: number) => void;
}

/**
 * Extended trust-aware agent configuration with error handling
 */
export interface TrustAwareAgentConfigWithRetry extends TrustAwareAgentConfig {
  /** LLM retry configuration */
  retryConfig?: LLMRetryConfig;
  /** Custom error classifier */
  errorClassifier?: (error: Error) => ClassifiedLLMError;
}
