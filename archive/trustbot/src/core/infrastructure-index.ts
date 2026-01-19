/**
 * Aurais Infrastructure
 * 
 * Complete earned-trust system for bot-builds-bot architectures.
 * 
 * @example
 * ```typescript
 * import { createOrchestrator, TrustTier } from 'aurais-infra';
 * 
 * // Initialize the system
 * const orchestrator = createOrchestrator({
 *   tickIntervalMs: 100,
 *   enableAuditLogging: true,
 * });
 * 
 * // Create a root agent (ELITE tier)
 * const root = orchestrator.createRootAgent({
 *   name: 'Overseer',
 *   purpose: 'System orchestration and agent management',
 *   modelProvider: 'anthropic',
 *   modelId: 'claude-sonnet-4-20250514',
 * });
 * 
 * // Spawn a worker agent (starts at UNTRUSTED, enters Academy)
 * const result = orchestrator.spawnAgent(root.id, {
 *   name: 'DataProcessor',
 *   purpose: 'Process incoming data streams',
 *   basePersona: 'Methodical data analyst',
 *   modelConfig: {
 *     provider: 'anthropic',
 *     modelId: 'claude-sonnet-4-20250514',
 *   },
 *   initialPrompt: 'You are a data processing agent...',
 * }, 'Need worker for data pipeline');
 * 
 * // Start the tick loop
 * orchestrator.start();
 * ```
 */

// Core Types
export * from '../types/core.js';

// Services
export { CapabilityResolver, capabilityResolver } from './CapabilityResolver.js';
export { TimeService, timeService } from './TimeService.js';
export { MemoryService, memoryService } from './MemoryService.js';
export { MessageBusService, messageBusService, MESSAGE_SCHEMAS } from './MessageBusService.js';
export { AgentFactoryService, agentFactoryService, STANDARD_CURRICULUM } from './AgentFactoryService.js';
export { Orchestrator, Observer, TaskRouter, createOrchestrator } from './Orchestrator.js';

// Re-export key enums for convenience
export { TrustTier, TrustEventType, AgentStatus, TaskStatus } from '../types/core.js';
