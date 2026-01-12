/**
 * Event Emitter - Creates and chains proof events
 *
 * Handles the creation of properly hashed and chained proof events,
 * ensuring immutability and tamper detection.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ProofEvent,
  ProofEventPayload,
  ProofEventType,
  LogProofEventRequest,
} from '@vorion/contracts';
import { type ProofEventStore, EventStoreError, EventStoreErrorCode } from './event-store.js';
import { computeEventHash, getGenesisHash } from './hash-chain.js';

/**
 * Configuration for the event emitter
 */
export interface EventEmitterConfig {
  /** Event store to use */
  store: ProofEventStore;
  /** Signer identifier (e.g., service name) */
  signedBy?: string;
  /** Enable signature generation */
  enableSignatures?: boolean;
  /** Event listeners for real-time notifications */
  listeners?: EventListener[];
}

/**
 * Event listener callback
 */
export type EventListener = (event: ProofEvent) => void | Promise<void>;

/**
 * Result of emitting an event
 */
export interface EmitResult {
  /** The created event */
  event: ProofEvent;
  /** Whether this is the first event in the chain */
  isGenesis: boolean;
  /** Previous event hash (null for genesis) */
  previousHash: string | null;
}

/**
 * Batch emit options
 */
export interface BatchEmitOptions {
  /** Whether to stop on first error */
  stopOnError?: boolean;
  /** Correlation ID to use for all events */
  correlationId?: string;
}

/**
 * Result of batch emit
 */
export interface BatchEmitResult {
  /** Successfully created events */
  events: ProofEvent[];
  /** Errors encountered */
  errors: Array<{ index: number; error: Error }>;
  /** Whether all events were created successfully */
  success: boolean;
}

/**
 * ProofEventEmitter - Creates properly hashed and chained events
 */
export class ProofEventEmitter {
  private readonly store: ProofEventStore;
  private readonly signedBy?: string;
  // Reserved for future signature implementation
  // private readonly enableSignatures: boolean;
  private readonly listeners: EventListener[];
  private emitLock: Promise<void> = Promise.resolve();

  constructor(config: EventEmitterConfig) {
    this.store = config.store;
    this.signedBy = config.signedBy;
    // this.enableSignatures = config.enableSignatures ?? false; // Reserved for future use
    this.listeners = config.listeners ?? [];
  }

  /**
   * Emit a new proof event
   *
   * Events are serialized to ensure proper chaining.
   */
  async emit(request: LogProofEventRequest): Promise<EmitResult> {
    // Serialize event creation to ensure proper chaining
    return this.serializedEmit(request);
  }

  /**
   * Emit an event with specific type helper
   */
  async emitTyped<T extends ProofEventPayload>(
    eventType: ProofEventType,
    correlationId: string,
    payload: T,
    agentId?: string
  ): Promise<EmitResult> {
    return this.emit({
      eventType,
      correlationId,
      payload,
      agentId,
      occurredAt: new Date(),
      signedBy: this.signedBy,
    });
  }

  /**
   * Emit multiple events in a batch
   */
  async emitBatch(
    requests: LogProofEventRequest[],
    options?: BatchEmitOptions
  ): Promise<BatchEmitResult> {
    const events: ProofEvent[] = [];
    const errors: Array<{ index: number; error: Error }> = [];

    for (let i = 0; i < requests.length; i++) {
      try {
        const request = {
          ...requests[i],
          correlationId: options?.correlationId ?? requests[i].correlationId,
        };
        const result = await this.emit(request);
        events.push(result.event);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ index: i, error: err });
        if (options?.stopOnError) {
          break;
        }
      }
    }

    return {
      events,
      errors,
      success: errors.length === 0,
    };
  }

  /**
   * Add an event listener
   */
  addListener(listener: EventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove an event listener
   */
  removeListener(listener: EventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Get the underlying store
   */
  getStore(): ProofEventStore {
    return this.store;
  }

  // Private methods

  private async serializedEmit(request: LogProofEventRequest): Promise<EmitResult> {
    // Wait for any pending emit to complete
    const previousLock = this.emitLock;
    let resolve: () => void;
    this.emitLock = new Promise(r => { resolve = r; });

    try {
      await previousLock;
      return await this.createAndStoreEvent(request);
    } finally {
      resolve!();
    }
  }

  private async createAndStoreEvent(request: LogProofEventRequest): Promise<EmitResult> {
    const now = new Date();
    const eventId = uuidv4();

    // Get previous hash for chaining
    const previousHash = await this.store.getLatestHash() ?? getGenesisHash();
    const isGenesis = previousHash === null;

    // Build event without hash
    const eventWithoutHash: Omit<ProofEvent, 'eventHash' | 'recordedAt'> = {
      eventId,
      eventType: request.eventType,
      correlationId: request.correlationId,
      agentId: request.agentId,
      payload: request.payload,
      previousHash,
      occurredAt: request.occurredAt ?? now,
      signedBy: request.signedBy ?? this.signedBy,
      signature: undefined, // TODO: Implement signatures
    };

    // Compute hash
    const eventHash = await computeEventHash(eventWithoutHash);

    // Create complete event
    const event: ProofEvent = {
      ...eventWithoutHash,
      eventHash,
      recordedAt: now,
    };

    // Validate the event
    this.validateEvent(event);

    // Store the event
    const storedEvent = await this.store.append(event);

    // Notify listeners
    await this.notifyListeners(storedEvent);

    return {
      event: storedEvent,
      isGenesis,
      previousHash,
    };
  }

  private validateEvent(event: ProofEvent): void {
    if (!event.eventId) {
      throw new EventStoreError(
        'Event ID is required',
        EventStoreErrorCode.INVALID_EVENT
      );
    }
    if (!event.eventType) {
      throw new EventStoreError(
        'Event type is required',
        EventStoreErrorCode.INVALID_EVENT
      );
    }
    if (!event.correlationId) {
      throw new EventStoreError(
        'Correlation ID is required',
        EventStoreErrorCode.INVALID_EVENT
      );
    }
    if (!event.payload) {
      throw new EventStoreError(
        'Event payload is required',
        EventStoreErrorCode.INVALID_EVENT
      );
    }
  }

  private async notifyListeners(event: ProofEvent): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener(event);
      } catch (error) {
        // Log but don't throw - listeners shouldn't block event creation
        console.error('Event listener error:', error);
      }
    }
  }
}

/**
 * Create a proof event emitter
 */
export function createEventEmitter(config: EventEmitterConfig): ProofEventEmitter {
  return new ProofEventEmitter(config);
}
