/**
 * LangChain Trust Callback Handler
 *
 * Records agent behavior as trust signals during LangChain execution.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { TrustSignal } from '../common/types.js';
import type { TrustEngine } from '../trust-engine/index.js';
import type { TrustAwareAgentConfig, TrustSignalSource } from './types.js';

const logger = createLogger({ component: 'langchain-callback' });

/**
 * Default signal weights
 */
const DEFAULT_WEIGHTS = {
  toolSuccess: 0.8,
  toolFailure: 0.1,
  llmSuccess: 0.7,
  llmFailure: 0.2,
  chainSuccess: 0.9,
  chainFailure: 0.1,
};

/**
 * LangChain callback handler interface (compatible with @langchain/core)
 *
 * This handler can be used with any LangChain executor to record
 * agent behavior as trust signals.
 */
export class TrustCallbackHandler {
  private trustEngine: TrustEngine;
  private config: Required<TrustAwareAgentConfig>;
  private signalCount = 0;
  private startTimes: Map<string, number> = new Map();

  constructor(trustEngine: TrustEngine, config: TrustAwareAgentConfig) {
    this.trustEngine = trustEngine;
    this.config = {
      agentId: config.agentId,
      initialTrustLevel: config.initialTrustLevel ?? 1,
      minTrustLevel: config.minTrustLevel ?? 1,
      recordToolUsage: config.recordToolUsage ?? true,
      recordLlmCalls: config.recordLlmCalls ?? true,
      recordErrors: config.recordErrors ?? true,
      signalWeights: {
        ...DEFAULT_WEIGHTS,
        ...config.signalWeights,
      },
    };
  }

  /**
   * Get the agent ID
   */
  get agentId(): string {
    return this.config.agentId;
  }

  /**
   * Get the number of signals recorded
   */
  get signalsRecorded(): number {
    return this.signalCount;
  }

  /**
   * Initialize the agent in the trust engine if not exists
   */
  async initialize(): Promise<void> {
    const existing = await this.trustEngine.getScore(this.config.agentId);
    if (!existing) {
      await this.trustEngine.initializeEntity(
        this.config.agentId,
        this.config.initialTrustLevel
      );
      logger.info({ agentId: this.config.agentId }, 'Initialized trust for agent');
    }
  }

  /**
   * Record a trust signal
   */
  private async recordSignal(source: TrustSignalSource): Promise<void> {
    const weights = this.config.signalWeights;
    let value: number;
    let signalType: string;

    switch (source.event) {
      case 'tool_end':
        value = weights.toolSuccess ?? DEFAULT_WEIGHTS.toolSuccess;
        signalType = `behavioral.tool_success.${source.toolName ?? 'unknown'}`;
        break;
      case 'tool_error':
        value = weights.toolFailure ?? DEFAULT_WEIGHTS.toolFailure;
        signalType = `behavioral.tool_failure.${source.toolName ?? 'unknown'}`;
        break;
      case 'llm_end':
        value = weights.llmSuccess ?? DEFAULT_WEIGHTS.llmSuccess;
        signalType = `behavioral.llm_success.${source.modelName ?? 'unknown'}`;
        break;
      case 'llm_error':
        value = weights.llmFailure ?? DEFAULT_WEIGHTS.llmFailure;
        signalType = `behavioral.llm_failure.${source.modelName ?? 'unknown'}`;
        break;
      case 'chain_end':
      case 'agent_finish':
        value = weights.chainSuccess ?? DEFAULT_WEIGHTS.chainSuccess;
        signalType = `behavioral.chain_success.${source.chainType ?? 'agent'}`;
        break;
      case 'chain_error':
        value = weights.chainFailure ?? DEFAULT_WEIGHTS.chainFailure;
        signalType = `behavioral.chain_failure.${source.chainType ?? 'agent'}`;
        break;
      default:
        return; // Don't record start events as signals
    }

    const signal: TrustSignal = {
      id: crypto.randomUUID(),
      entityId: this.config.agentId,
      type: signalType,
      value,
      source: 'langchain',
      timestamp: new Date().toISOString(),
      metadata: {
        event: source.event,
        toolName: source.toolName,
        modelName: source.modelName,
        chainType: source.chainType,
        duration: source.duration,
        tokenCount: source.tokenCount,
        error: source.error?.message,
      },
    };

    await this.trustEngine.recordSignal(signal);
    this.signalCount++;

    logger.debug({ signal }, 'Recorded trust signal from LangChain');
  }

  /**
   * Start tracking execution time
   */
  private startTimer(runId: string): void {
    this.startTimes.set(runId, Date.now());
  }

  /**
   * Get elapsed time and clear timer
   */
  private endTimer(runId: string): number {
    const startTime = this.startTimes.get(runId);
    this.startTimes.delete(runId);
    return startTime ? Date.now() - startTime : 0;
  }

  // ============================================
  // LangChain Callback Interface Methods
  // ============================================

  /**
   * Called when a tool starts
   */
  async handleToolStart(
    tool: { name: string },
    _input: string,
    runId: string
  ): Promise<void> {
    if (!this.config.recordToolUsage) return;
    this.startTimer(runId);
    logger.debug({ toolName: tool.name, runId }, 'Tool started');
  }

  /**
   * Called when a tool ends successfully
   */
  async handleToolEnd(_output: string, runId: string): Promise<void> {
    if (!this.config.recordToolUsage) return;
    const duration = this.endTimer(runId);
    await this.recordSignal({
      event: 'tool_end',
      duration,
    });
  }

  /**
   * Called when a tool errors
   */
  async handleToolError(error: Error, runId: string): Promise<void> {
    if (!this.config.recordErrors) return;
    const duration = this.endTimer(runId);
    await this.recordSignal({
      event: 'tool_error',
      duration,
      error,
    });
  }

  /**
   * Called when an LLM starts
   */
  async handleLLMStart(
    llm: { name: string },
    _prompts: string[],
    runId: string
  ): Promise<void> {
    if (!this.config.recordLlmCalls) return;
    this.startTimer(runId);
    logger.debug({ modelName: llm.name, runId }, 'LLM started');
  }

  /**
   * Called when an LLM ends successfully
   */
  async handleLLMEnd(
    output: { generations: unknown[][]; llmOutput?: { tokenUsage?: { totalTokens?: number } } },
    runId: string
  ): Promise<void> {
    if (!this.config.recordLlmCalls) return;
    const duration = this.endTimer(runId);
    await this.recordSignal({
      event: 'llm_end',
      duration,
      tokenCount: output.llmOutput?.tokenUsage?.totalTokens,
    });
  }

  /**
   * Called when an LLM errors
   */
  async handleLLMError(error: Error, runId: string): Promise<void> {
    if (!this.config.recordErrors) return;
    const duration = this.endTimer(runId);
    await this.recordSignal({
      event: 'llm_error',
      duration,
      error,
    });
  }

  /**
   * Called when a chain starts
   */
  async handleChainStart(
    chain: { name: string },
    _inputs: Record<string, unknown>,
    runId: string
  ): Promise<void> {
    this.startTimer(runId);
    logger.debug({ chainType: chain.name, runId }, 'Chain started');
  }

  /**
   * Called when a chain ends successfully
   */
  async handleChainEnd(
    _outputs: Record<string, unknown>,
    runId: string
  ): Promise<void> {
    const duration = this.endTimer(runId);
    await this.recordSignal({
      event: 'chain_end',
      duration,
    });
  }

  /**
   * Called when a chain errors
   */
  async handleChainError(error: Error, runId: string): Promise<void> {
    if (!this.config.recordErrors) return;
    const duration = this.endTimer(runId);
    await this.recordSignal({
      event: 'chain_error',
      duration,
      error,
    });
  }

  /**
   * Called when an agent takes an action
   */
  async handleAgentAction(
    action: { tool: string; toolInput: string; log: string },
    runId: string
  ): Promise<void> {
    logger.debug({ tool: action.tool, runId }, 'Agent action');
  }

  /**
   * Called when an agent finishes
   */
  async handleAgentEnd(
    _finish: { returnValues: Record<string, unknown>; log: string },
    _runId: string
  ): Promise<void> {
    await this.recordSignal({
      event: 'agent_finish',
      chainType: 'agent',
    });
  }
}

/**
 * Create a trust callback handler
 */
export function createTrustCallback(
  trustEngine: TrustEngine,
  config: TrustAwareAgentConfig
): TrustCallbackHandler {
  return new TrustCallbackHandler(trustEngine, config);
}
