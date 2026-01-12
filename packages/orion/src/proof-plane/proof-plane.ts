/**
 * Proof Plane - High-level interface for the ORION audit system
 *
 * The Proof Plane provides a unified API for:
 * - Emitting proof events
 * - Querying the event trail
 * - Verifying chain integrity
 * - Subscribing to events
 * - Hook integration for EVENT_EMITTED notifications
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ProofEventType,
  TrustBand,
  type ProofEvent,
  type ProofEventFilter,
  type ProofEventPayload,
  type Intent,
  type Decision,
  type TrustProfile,
  type IntentReceivedPayload,
  type DecisionMadePayload,
  type TrustDeltaPayload,
  type ExecutionStartedPayload,
  type ExecutionCompletedPayload,
  type ExecutionFailedPayload,
} from '@vorion/contracts';
import {
  type ProofEventStore,
  type EventQueryOptions,
  type EventQueryResult,
  type EventStats,
} from '../events/event-store.js';
import { createInMemoryEventStore } from '../events/memory-store.js';
import {
  type ProofEventEmitter,
  type EmitResult,
  type EventListener,
  createEventEmitter,
} from '../events/event-emitter.js';
import {
  type ChainVerificationResult,
  verifyChainWithDetails,
} from '../events/hash-chain.js';

/**
 * Hook manager interface for event notifications
 * (Implemented by @orion/a3i HookManager)
 */
export interface EventHookManager {
  executeEventEmitted(context: {
    correlationId: string;
    event: ProofEvent;
  }): Promise<{ aborted: boolean }>;
}

/**
 * Configuration for the Proof Plane
 */
export interface ProofPlaneConfig {
  /** Custom event store (defaults to in-memory) */
  store?: ProofEventStore;
  /** Service identifier for signing events */
  signedBy?: string;
  /** Enable event listeners */
  enableListeners?: boolean;
  /** Hook manager for EVENT_EMITTED notifications */
  hookManager?: EventHookManager;
  /** Enable hooks (default: true if hookManager provided) */
  enableHooks?: boolean;
}

/**
 * Proof Plane - The ORION audit trail system
 */
export class ProofPlane {
  private readonly store: ProofEventStore;
  private readonly emitter: ProofEventEmitter;
  private readonly signedBy: string;
  private readonly hookManager?: EventHookManager;
  private readonly enableHooks: boolean;

  constructor(config: ProofPlaneConfig = {}) {
    this.store = config.store ?? createInMemoryEventStore();
    this.signedBy = config.signedBy ?? 'orion-proof-plane';
    this.hookManager = config.hookManager;
    this.enableHooks = config.enableHooks ?? (config.hookManager !== undefined);
    this.emitter = createEventEmitter({
      store: this.store,
      signedBy: this.signedBy,
      enableSignatures: false, // TODO: Implement
    });

    // Set up hook listener if hooks are enabled
    if (this.enableHooks && this.hookManager) {
      this.setupHookListener();
    }
  }

  /**
   * Set up internal listener for hook notifications
   */
  private setupHookListener(): void {
    this.emitter.addListener((event) => {
      // Fire hook asynchronously (don't block event emission)
      this.fireEventEmittedHook(event).catch((error) => {
        console.error('[ProofPlane] Failed to fire EVENT_EMITTED hook:', error);
      });
    });
  }

  /**
   * Fire the EVENT_EMITTED hook
   */
  private async fireEventEmittedHook(event: ProofEvent): Promise<void> {
    if (!this.hookManager) return;

    await this.hookManager.executeEventEmitted({
      correlationId: event.correlationId,
      event,
    });
  }

  // ============================================================
  // Event Emission - Type-safe helpers for common events
  // ============================================================

  /**
   * Log an intent received event
   */
  async logIntentReceived(
    intent: Intent,
    correlationId?: string
  ): Promise<EmitResult> {
    const payload: IntentReceivedPayload = {
      type: 'intent_received',
      intentId: intent.intentId,
      action: intent.action,
      actionType: intent.actionType,
      resourceScope: intent.resourceScope,
    };

    return this.emitter.emitTyped(
      ProofEventType.INTENT_RECEIVED,
      correlationId ?? intent.correlationId,
      payload,
      intent.agentId
    );
  }

  /**
   * Log an authorization decision event
   */
  async logDecisionMade(
    decision: Decision,
    correlationId?: string
  ): Promise<EmitResult> {
    const payload: DecisionMadePayload = {
      type: 'decision_made',
      decisionId: decision.decisionId,
      intentId: decision.intentId,
      permitted: decision.permitted,
      trustBand: TrustBand[decision.trustBand],
      trustScore: decision.trustScore,
      reasoning: decision.reasoning,
    };

    return this.emitter.emitTyped(
      ProofEventType.DECISION_MADE,
      correlationId ?? decision.correlationId,
      payload,
      decision.agentId
    );
  }

  /**
   * Log a trust score change event
   */
  async logTrustDelta(
    agentId: string,
    previousProfile: TrustProfile,
    newProfile: TrustProfile,
    reason: string,
    correlationId?: string
  ): Promise<EmitResult> {
    const payload: TrustDeltaPayload = {
      type: 'trust_delta',
      deltaId: uuidv4(),
      previousScore: previousProfile.adjustedScore,
      newScore: newProfile.adjustedScore,
      previousBand: TrustBand[previousProfile.band],
      newBand: TrustBand[newProfile.band],
      reason,
    };

    return this.emitter.emitTyped(
      ProofEventType.TRUST_DELTA,
      correlationId ?? uuidv4(),
      payload,
      agentId
    );
  }

  /**
   * Log execution started event
   */
  async logExecutionStarted(
    executionId: string,
    actionId: string,
    decisionId: string,
    adapterId: string,
    agentId: string,
    correlationId: string
  ): Promise<EmitResult> {
    const payload: ExecutionStartedPayload = {
      type: 'execution_started',
      executionId,
      actionId,
      decisionId,
      adapterId,
    };

    return this.emitter.emitTyped(
      ProofEventType.EXECUTION_STARTED,
      correlationId,
      payload,
      agentId
    );
  }

  /**
   * Log execution completed event
   */
  async logExecutionCompleted(
    executionId: string,
    actionId: string,
    durationMs: number,
    outputHash: string,
    agentId: string,
    correlationId: string,
    status: 'success' | 'partial' = 'success'
  ): Promise<EmitResult> {
    const payload: ExecutionCompletedPayload = {
      type: 'execution_completed',
      executionId,
      actionId,
      status,
      durationMs,
      outputHash,
    };

    return this.emitter.emitTyped(
      ProofEventType.EXECUTION_COMPLETED,
      correlationId,
      payload,
      agentId
    );
  }

  /**
   * Log execution failed event
   */
  async logExecutionFailed(
    executionId: string,
    actionId: string,
    error: string,
    durationMs: number,
    retryable: boolean,
    agentId: string,
    correlationId: string
  ): Promise<EmitResult> {
    const payload: ExecutionFailedPayload = {
      type: 'execution_failed',
      executionId,
      actionId,
      error,
      durationMs,
      retryable,
    };

    return this.emitter.emitTyped(
      ProofEventType.EXECUTION_FAILED,
      correlationId,
      payload,
      agentId
    );
  }

  /**
   * Log a generic proof event
   */
  async logEvent(
    eventType: ProofEventType,
    correlationId: string,
    payload: ProofEventPayload,
    agentId?: string
  ): Promise<EmitResult> {
    return this.emitter.emitTyped(eventType, correlationId, payload, agentId);
  }

  // ============================================================
  // Event Queries
  // ============================================================

  /**
   * Get an event by ID
   */
  async getEvent(eventId: string): Promise<ProofEvent | null> {
    return this.store.get(eventId);
  }

  /**
   * Get the latest event
   */
  async getLatestEvent(): Promise<ProofEvent | null> {
    return this.store.getLatest();
  }

  /**
   * Query events with filters
   */
  async queryEvents(
    filter?: ProofEventFilter,
    options?: EventQueryOptions
  ): Promise<EventQueryResult> {
    return this.store.query(filter, options);
  }

  /**
   * Get all events for a correlation ID (trace a request)
   */
  async getTrace(correlationId: string): Promise<ProofEvent[]> {
    return this.store.getByCorrelationId(correlationId, { order: 'asc' });
  }

  /**
   * Get all events for an agent
   */
  async getAgentHistory(agentId: string, options?: EventQueryOptions): Promise<ProofEvent[]> {
    return this.store.getByAgentId(agentId, options);
  }

  /**
   * Get events by type
   */
  async getEventsByType(
    eventType: ProofEventType,
    options?: EventQueryOptions
  ): Promise<ProofEvent[]> {
    return this.store.getByType(eventType, options);
  }

  /**
   * Get event statistics
   */
  async getStats(): Promise<EventStats> {
    return this.store.getStats();
  }

  /**
   * Get event count
   */
  async getEventCount(filter?: ProofEventFilter): Promise<number> {
    return this.store.count(filter);
  }

  // ============================================================
  // Chain Verification
  // ============================================================

  /**
   * Verify the entire event chain
   */
  async verifyChain(fromEventId?: string, limit?: number): Promise<ChainVerificationResult> {
    const events = await this.store.getChain(fromEventId, limit);
    return verifyChainWithDetails(events);
  }

  /**
   * Verify chain integrity for a specific correlation ID
   */
  async verifyCorrelationChain(correlationId: string): Promise<ChainVerificationResult> {
    const events = await this.store.getByCorrelationId(correlationId, { order: 'asc' });
    return verifyChainWithDetails(events);
  }

  // ============================================================
  // Subscriptions
  // ============================================================

  /**
   * Subscribe to new events
   */
  subscribe(listener: EventListener): () => void {
    this.emitter.addListener(listener);
    return () => this.emitter.removeListener(listener);
  }

  /**
   * Subscribe to events of a specific type
   */
  subscribeToType(eventType: ProofEventType, listener: EventListener): () => void {
    const filteredListener: EventListener = (event) => {
      if (event.eventType === eventType) {
        return listener(event);
      }
    };
    this.emitter.addListener(filteredListener);
    return () => this.emitter.removeListener(filteredListener);
  }

  // ============================================================
  // Utilities
  // ============================================================

  /**
   * Get the underlying event store
   */
  getStore(): ProofEventStore {
    return this.store;
  }

  /**
   * Get the event emitter
   */
  getEmitter(): ProofEventEmitter {
    return this.emitter;
  }

  /**
   * Get the hook manager
   */
  getHookManager(): EventHookManager | undefined {
    return this.hookManager;
  }

  /**
   * Check if hooks are enabled
   */
  isHooksEnabled(): boolean {
    return this.enableHooks;
  }

  /**
   * Clear all events (for testing only)
   */
  async clear(): Promise<void> {
    await this.store.clear();
  }
}

/**
 * Create a Proof Plane instance
 */
export function createProofPlane(config?: ProofPlaneConfig): ProofPlane {
  return new ProofPlane(config);
}
