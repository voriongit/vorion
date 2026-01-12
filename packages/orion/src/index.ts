/**
 * ORION Package - Proof Plane for AI Agent Operations
 *
 * The ORION proof plane provides an immutable audit trail for all
 * AI agent operations, enabling compliance, debugging, and trust verification.
 *
 * Key components:
 * - ProofPlane: High-level API for the audit system
 * - ProofEventStore: Abstract storage interface
 * - ProofEventEmitter: Event creation with hash chaining
 *
 * @example
 * ```typescript
 * import { createProofPlane } from '@orion/orion';
 *
 * const proofPlane = createProofPlane({ signedBy: 'my-service' });
 *
 * // Log events
 * await proofPlane.logIntentReceived(intent);
 * await proofPlane.logDecisionMade(decision);
 *
 * // Query events
 * const trace = await proofPlane.getTrace(correlationId);
 *
 * // Verify chain integrity
 * const verification = await proofPlane.verifyChain();
 * ```
 */

// Main exports
export {
  ProofPlane,
  createProofPlane,
  type ProofPlaneConfig,
} from './proof-plane/proof-plane.js';

export {
  ProofPlaneLoggerImpl,
  createProofPlaneLogger,
  noopProofPlaneLogger,
  type ProofPlaneLogger,
  type ProofPlaneLoggerConfig,
} from './proof-plane/logger.js';

// Event store exports
export {
  type ProofEventStore,
  type EventQueryOptions,
  type EventQueryResult,
  type EventStats,
  EventStoreError,
  EventStoreErrorCode,
} from './events/event-store.js';

export {
  InMemoryEventStore,
  createInMemoryEventStore,
} from './events/memory-store.js';

// Event emitter exports
export {
  ProofEventEmitter,
  createEventEmitter,
  type EventEmitterConfig,
  type EventListener,
  type EmitResult,
  type BatchEmitOptions,
  type BatchEmitResult,
} from './events/event-emitter.js';

// Hash chain exports
export {
  sha256,
  computeEventHash,
  verifyEventHash,
  verifyChainLink,
  verifyChain,
  verifyChainWithDetails,
  getGenesisHash,
  type ChainVerificationResult,
} from './events/hash-chain.js';
