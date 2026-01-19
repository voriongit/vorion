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
