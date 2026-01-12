/**
 * Orchestrator Module - Unified authorization and execution
 *
 * @packageDocumentation
 */

export {
  Orchestrator,
  createOrchestrator,
  OrchestratorBuilder,
  orchestratorBuilder,
  noopOrchestratorLogger,
  type OrchestratorConfig,
  type OrchestratorResult,
  type ProcessIntentOptions,
  type OrchestratorLogger,
} from './orchestrator.js';

export {
  ProofPlaneAdapter,
  createProofPlaneAdapter,
  type ProofPlaneInterface,
  type ProofPlaneAdapterConfig,
} from './proof-plane-adapter.js';
