/**
 * ProofPlane Adapter - Implements OrchestratorLogger for ProofPlane
 *
 * This adapter bridges the Orchestrator with ORION's ProofPlane,
 * logging all orchestration events to the immutable audit trail.
 */

import { createHash } from 'crypto';
import type { Intent, Decision, ProofEvent } from '@orion/contracts';
import type { OrchestratorLogger } from './orchestrator.js';

/**
 * Minimal ProofPlane interface for the adapter
 * (Matches @orion/orion ProofPlane API)
 */
export interface ProofPlaneInterface {
  logIntentReceived(intent: Intent, correlationId?: string): Promise<{ event: ProofEvent }>;
  logDecisionMade(decision: Decision, correlationId?: string): Promise<{ event: ProofEvent }>;
  logExecutionStarted(
    executionId: string,
    actionId: string,
    decisionId: string,
    adapterId: string,
    agentId: string,
    correlationId: string
  ): Promise<{ event: ProofEvent }>;
  logExecutionCompleted(
    executionId: string,
    actionId: string,
    durationMs: number,
    outputHash: string,
    agentId: string,
    correlationId: string,
    status?: 'success' | 'partial'
  ): Promise<{ event: ProofEvent }>;
  logExecutionFailed(
    executionId: string,
    actionId: string,
    error: string,
    durationMs: number,
    retryable: boolean,
    agentId: string,
    correlationId: string
  ): Promise<{ event: ProofEvent }>;
}

/**
 * Configuration for the ProofPlane adapter
 */
export interface ProofPlaneAdapterConfig {
  /** The ProofPlane instance */
  proofPlane: ProofPlaneInterface;
  /** Adapter identifier for execution events */
  adapterId?: string;
  /** Log intent received events (default: true) */
  logIntentReceived?: boolean;
  /** Log decision made events (default: true) */
  logDecisionMade?: boolean;
  /** Log execution events (default: true) */
  logExecutionEvents?: boolean;
}

/**
 * Hash a result for the audit trail
 */
function hashResult(result: unknown): string {
  const str = JSON.stringify(result ?? null);
  return createHash('sha256').update(str).digest('hex').substring(0, 16);
}

/**
 * ProofPlane adapter implementing OrchestratorLogger
 */
export class ProofPlaneAdapter implements OrchestratorLogger {
  private readonly proofPlane: ProofPlaneInterface;
  private readonly adapterId: string;
  private readonly logIntentReceivedEnabled: boolean;
  private readonly logDecisionMadeEnabled: boolean;
  private readonly logExecutionEventsEnabled: boolean;

  constructor(config: ProofPlaneAdapterConfig) {
    this.proofPlane = config.proofPlane;
    this.adapterId = config.adapterId ?? 'a3i-orchestrator';
    this.logIntentReceivedEnabled = config.logIntentReceived ?? true;
    this.logDecisionMadeEnabled = config.logDecisionMade ?? true;
    this.logExecutionEventsEnabled = config.logExecutionEvents ?? true;
  }

  /**
   * Log intent received
   */
  async logIntentReceived(intent: Intent, correlationId: string): Promise<void> {
    if (!this.logIntentReceivedEnabled) return;
    await this.proofPlane.logIntentReceived(intent, correlationId);
  }

  /**
   * Log decision made
   */
  async logDecisionMade(
    decision: Decision,
    _intent: Intent,
    correlationId: string
  ): Promise<void> {
    if (!this.logDecisionMadeEnabled) return;
    await this.proofPlane.logDecisionMade(decision, correlationId);
  }

  /**
   * Log execution started
   */
  async logExecutionStarted(
    executionId: string,
    intent: Intent,
    decision: Decision,
    correlationId: string
  ): Promise<void> {
    if (!this.logExecutionEventsEnabled) return;
    await this.proofPlane.logExecutionStarted(
      executionId,
      intent.intentId,
      decision.decisionId,
      this.adapterId,
      intent.agentId,
      correlationId
    );
  }

  /**
   * Log execution completed
   */
  async logExecutionCompleted(
    executionId: string,
    intent: Intent,
    result: unknown,
    durationMs: number,
    correlationId: string
  ): Promise<void> {
    if (!this.logExecutionEventsEnabled) return;
    await this.proofPlane.logExecutionCompleted(
      executionId,
      intent.intentId,
      durationMs,
      hashResult(result),
      intent.agentId,
      correlationId,
      'success'
    );
  }

  /**
   * Log execution failed
   */
  async logExecutionFailed(
    executionId: string,
    intent: Intent,
    error: Error,
    durationMs: number,
    retryable: boolean,
    correlationId: string
  ): Promise<void> {
    if (!this.logExecutionEventsEnabled) return;
    await this.proofPlane.logExecutionFailed(
      executionId,
      intent.intentId,
      error.message,
      durationMs,
      retryable,
      intent.agentId,
      correlationId
    );
  }
}

/**
 * Create a ProofPlane adapter
 */
export function createProofPlaneAdapter(
  config: ProofPlaneAdapterConfig
): ProofPlaneAdapter {
  return new ProofPlaneAdapter(config);
}
