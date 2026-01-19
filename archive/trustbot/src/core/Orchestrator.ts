/**
 * Aurais Infrastructure - Orchestrator
 * 
 * Coordinates all services for the bot-builds-bot earned trust system.
 * Manages the tick loop, event dispatch, and service integration.
 */

import {
  AgentId,
  TrustState,
  TrustTier,
  AgentIdentity,
  AgentStatus,
  TaskDefinition,
  TaskResult,
  TaskStatus,
  ObserverEvent,
  ObserverEventType,
  AuditBatch,
  TickNumber,
  Timestamp,
} from '../types/core.js';
import { CapabilityResolver, capabilityResolver } from './CapabilityResolver.js';
import { TimeService, timeService } from './TimeService.js';
import { MemoryService, memoryService } from './MemoryService.js';
import { MessageBusService, messageBusService } from './MessageBusService.js';
import { AgentFactoryService, agentFactoryService } from './AgentFactoryService.js';

// ============================================================================
// ORCHESTRATOR CONFIGURATION
// ============================================================================

export interface OrchestratorConfig {
  tickIntervalMs: number;             // Real-time interval between ticks
  batchSizeThreshold: number;         // Events before Merkle batch
  batchTimeThreshold: number;         // Ticks before forced batch
  maxConcurrentAgents: number;
  enableAuditLogging: boolean;
  blockchainAnchorEnabled: boolean;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  tickIntervalMs: 100,
  batchSizeThreshold: 100,
  batchTimeThreshold: 1000,
  maxConcurrentAgents: 1000,
  enableAuditLogging: true,
  blockchainAnchorEnabled: false,
};

// ============================================================================
// OBSERVER (Event Collection & Audit)
// ============================================================================

export class Observer {
  private eventBuffer: ObserverEvent[] = [];
  private batches: AuditBatch[] = [];
  private lastBatchTick: TickNumber = 0;

  constructor(
    private batchSizeThreshold: number,
    private batchTimeThreshold: number,
    private onBatchReady?: (batch: AuditBatch) => void
  ) { }

  record(event: ObserverEvent): void {
    // Compute hash
    event.hash = this.computeHash(event);
    this.eventBuffer.push(event);
  }

  checkBatch(currentTick: TickNumber): AuditBatch | null {
    const shouldBatch =
      this.eventBuffer.length >= this.batchSizeThreshold ||
      (currentTick - this.lastBatchTick) >= this.batchTimeThreshold;

    if (!shouldBatch || this.eventBuffer.length === 0) {
      return null;
    }

    return this.createBatch(currentTick);
  }

  forceBatch(currentTick: TickNumber): AuditBatch | null {
    if (this.eventBuffer.length === 0) {
      return null;
    }
    return this.createBatch(currentTick);
  }

  private createBatch(currentTick: TickNumber): AuditBatch {
    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    const batch: AuditBatch = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTick: this.lastBatchTick,
      endTick: currentTick,
      eventCount: events.length,
      merkleRoot: this.computeMerkleRoot(events),
    };

    this.lastBatchTick = currentTick;
    this.batches.push(batch);

    if (this.onBatchReady) {
      this.onBatchReady(batch);
    }

    return batch;
  }

  private computeHash(event: ObserverEvent): string {
    // Simplified hash - in production would use crypto
    const data = JSON.stringify({
      id: event.id,
      timestamp: event.timestamp,
      tick: event.tick,
      agentId: event.agentId,
      eventType: event.eventType,
      payload: event.payload,
    });

    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  private computeMerkleRoot(events: ObserverEvent[]): string {
    if (events.length === 0) return '0'.repeat(64);

    let hashes = events.map(e => e.hash);

    while (hashes.length > 1) {
      const newLevel: string[] = [];
      for (let i = 0; i < hashes.length; i += 2) {
        const left = hashes[i] ?? '';
        const right = hashes[i + 1] ?? left;
        newLevel.push(this.hashPair(left, right));
      }
      hashes = newLevel;
    }

    return hashes[0] ?? '';
  }

  private hashPair(left: string, right: string): string {
    const combined = left + right;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  getBatches(): AuditBatch[] {
    return [...this.batches];
  }

  getEventCount(): number {
    return this.eventBuffer.length;
  }
}

// ============================================================================
// TASK ROUTER
// ============================================================================

interface QueuedTask {
  task: TaskDefinition;
  assignedTo?: AgentId;
  status: TaskStatus;
  result?: TaskResult;
}

export class TaskRouter {
  private taskQueues: Map<string, QueuedTask[]> = new Map();
  private activeTasks: Map<string, QueuedTask> = new Map();

  constructor() {
    // Initialize queues
    this.taskQueues.set('training', []);
    this.taskQueues.set('general', []);
    this.taskQueues.set('priority', []);
    this.taskQueues.set('administrative', []);
  }

  enqueue(task: TaskDefinition, queue: string): void {
    const queuedTask: QueuedTask = {
      task,
      status: TaskStatus.PENDING,
    };

    const targetQueue = this.taskQueues.get(queue);
    if (targetQueue) {
      targetQueue.push(queuedTask);
    }
  }

  claim(
    agentId: AgentId,
    capabilities: { queueAccess: string[]; maxConcurrentTasks: number }
  ): TaskDefinition | null {
    // Count active tasks for this agent
    const activeCount = Array.from(this.activeTasks.values())
      .filter(t => t.assignedTo === agentId).length;

    if (activeCount >= capabilities.maxConcurrentTasks) {
      return null;
    }

    // Try queues in order of agent's access
    for (const queueName of capabilities.queueAccess) {
      const queue = this.taskQueues.get(queueName);
      if (!queue || queue.length === 0) continue;

      // Find first unclaimed task
      const taskIndex = queue.findIndex(t => t.status === TaskStatus.PENDING);
      if (taskIndex === -1) continue;

      const queuedTask = queue[taskIndex];
      if (!queuedTask) continue;

      queuedTask.status = TaskStatus.CLAIMED;
      queuedTask.assignedTo = agentId;

      // Move to active
      queue.splice(taskIndex, 1);
      this.activeTasks.set(queuedTask.task.id, queuedTask);

      return queuedTask.task;
    }

    return null;
  }

  complete(taskId: string, result: TaskResult): void {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.status = result.status;
      task.result = result;
      this.activeTasks.delete(taskId);
    }
  }

  getQueueStats(): Record<string, { pending: number; active: number }> {
    const stats: Record<string, { pending: number; active: number }> = {};

    for (const [name, queue] of this.taskQueues.entries()) {
      stats[name] = {
        pending: queue.filter(t => t.status === TaskStatus.PENDING).length,
        active: Array.from(this.activeTasks.values())
          .filter(t => t.task.constraints.requiredTier <= this.queueTier(name)).length,
      };
    }

    return stats;
  }

  private queueTier(queueName: string): TrustTier {
    const mapping: Record<string, TrustTier> = {
      training: TrustTier.PROBATIONARY,
      general: TrustTier.TRUSTED,
      priority: TrustTier.VERIFIED,
      administrative: TrustTier.ELITE,
    };
    return mapping[queueName] || TrustTier.UNTRUSTED;
  }
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

export class Orchestrator {
  private config: OrchestratorConfig;
  private observer: Observer;
  private taskRouter: TaskRouter;

  private timeService: TimeService;
  private memoryService: MemoryService;
  private messageBus: MessageBusService;
  private agentFactory: AgentFactoryService;
  private resolver: CapabilityResolver;

  private running = false;
  private tickInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize observer
    this.observer = new Observer(
      this.config.batchSizeThreshold,
      this.config.batchTimeThreshold,
      (batch) => this.onAuditBatch(batch)
    );

    // Initialize services with shared event emitter
    const eventEmitter = (event: ObserverEvent) => {
      if (this.config.enableAuditLogging) {
        this.observer.record(event);
      }
    };

    const tickProvider = () => this.getCurrentTick();

    this.resolver = capabilityResolver;
    this.timeService = new TimeService(this.resolver, eventEmitter);
    this.memoryService = new MemoryService(this.resolver, eventEmitter, tickProvider);
    this.messageBus = new MessageBusService(this.resolver, eventEmitter, tickProvider);
    this.agentFactory = new AgentFactoryService(this.resolver, eventEmitter, tickProvider);

    this.taskRouter = new TaskRouter();
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  start(): void {
    if (this.running) return;

    this.running = true;
    this.tickInterval = setInterval(
      () => this.tick(),
      this.config.tickIntervalMs
    );

    console.log(`Orchestrator started (tick interval: ${this.config.tickIntervalMs}ms)`);
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    // Force final audit batch
    this.observer.forceBatch(this.getCurrentTick());

    console.log('Orchestrator stopped');
  }

  private tick(): void {
    const tick = this.timeService.tick();

    // Process message bus
    this.messageBus.processTick();

    // Check for audit batch
    this.observer.checkBatch(tick);

    // Process due scheduled work
    const dueWork = this.timeService.getDueWork();
    for (const work of dueWork) {
      this.taskRouter.enqueue(work.task, 'general');
      this.timeService.completeWork(work.id);
    }
  }

  getCurrentTick(): TickNumber {
    return this.timeService.getCurrentTick();
  }

  // --------------------------------------------------------------------------
  // Agent Management
  // --------------------------------------------------------------------------

  createRootAgent(config: {
    name: string;
    purpose: string;
    modelProvider: string;
    modelId: string;
  }): AgentIdentity {
    const agent = this.agentFactory.createRootAgent(config);
    this.messageBus.registerAgent(agent.id, agent.trustState);
    return agent;
  }

  spawnAgent(
    parentId: AgentId,
    template: {
      name: string;
      purpose: string;
      specialization?: string;
      basePersona: string;
      modelConfig: {
        provider: string;
        modelId: string;
        temperature?: number;
        maxTokens?: number;
      };
      initialPrompt: string;
      academyCurriculum?: string[];
    },
    justification: string
  ) {
    const parent = this.agentFactory.getAgent(parentId);
    if (!parent) {
      return { success: false, error: 'Parent agent not found' };
    }

    const result = this.agentFactory.spawn({
      requestedBy: parentId,
      template: {
        ...template,
        academyCurriculum: template.academyCurriculum || [],
      },
      justification,
      parentTrustCeiling: parent.trustState.trustCeiling,
      requestedCapabilities: {},
    });

    if (result.success && result.agentId) {
      const newAgent = this.agentFactory.getAgent(result.agentId);
      if (newAgent) {
        this.messageBus.registerAgent(result.agentId, newAgent.trustState);
      }
    }

    return result;
  }

  getAgent(agentId: AgentId): AgentIdentity | undefined {
    return this.agentFactory.getAgent(agentId);
  }

  // --------------------------------------------------------------------------
  // Task Management
  // --------------------------------------------------------------------------

  submitTask(task: TaskDefinition, queue = 'general'): void {
    this.taskRouter.enqueue(task, queue);
  }

  claimTask(agentId: AgentId): TaskDefinition | null {
    const agent = this.agentFactory.getAgent(agentId);
    if (!agent) return null;

    const capabilities = this.resolver.getCapabilities(agent.trustState);
    return this.taskRouter.claim(agentId, {
      queueAccess: capabilities.scheduling.queueAccess.filter(q => q !== 'none'),
      maxConcurrentTasks: capabilities.scheduling.maxConcurrentTasks,
    });
  }

  completeTask(agentId: AgentId, result: TaskResult): void {
    this.taskRouter.complete(result.taskId, result);

    // Update trust score based on result
    this.updateTrustFromTask(agentId, result);

    // Clear ephemeral memory
    this.memoryService.clearEphemeral(agentId, result.taskId);
  }

  private updateTrustFromTask(agentId: AgentId, result: TaskResult): void {
    const agent = this.agentFactory.getAgent(agentId);
    if (!agent) return;

    let scoreDelta = 0;
    switch (result.status) {
      case TaskStatus.COMPLETED:
        scoreDelta = result.validationResult?.score
          ? Math.round(result.validationResult.score / 10)
          : 5;
        break;
      case TaskStatus.FAILED:
        scoreDelta = -10;
        break;
      case TaskStatus.TIMEOUT:
        scoreDelta = -15;
        break;
    }

    const newScore = Math.max(0, Math.min(1000, agent.trustState.score.current + scoreDelta));
    agent.trustState.score.current = newScore;
    agent.trustState.score.lastActivity = Date.now();

    // Recalculate tier
    const newTier = this.resolver.getEffectiveTier(agent.trustState);
    agent.trustState.score.tier = newTier;

    // Update capabilities
    agent.capabilities = this.resolver.getCapabilities(agent.trustState);

    // Update message bus registration
    this.messageBus.updateAgentTrust(agentId, agent.trustState);
  }

  // --------------------------------------------------------------------------
  // Service Access
  // --------------------------------------------------------------------------

  getTimeService(): TimeService {
    return this.timeService;
  }

  getMemoryService(): MemoryService {
    return this.memoryService;
  }

  getMessageBus(): MessageBusService {
    return this.messageBus;
  }

  getAgentFactory(): AgentFactoryService {
    return this.agentFactory;
  }

  getTaskRouter(): TaskRouter {
    return this.taskRouter;
  }

  getObserver(): Observer {
    return this.observer;
  }

  // --------------------------------------------------------------------------
  // Audit & Monitoring
  // --------------------------------------------------------------------------

  private onAuditBatch(batch: AuditBatch): void {
    console.log(`Audit batch created: ${batch.id} (${batch.eventCount} events)`);

    if (this.config.blockchainAnchorEnabled) {
      this.anchorToBlockchain(batch);
    }
  }

  private async anchorToBlockchain(batch: AuditBatch): Promise<void> {
    // In production, this would call your Polygon contract
    console.log(`Anchoring batch ${batch.id} to blockchain...`);
    batch.anchoredAt = Date.now();
    // batch.chainTxHash = '0x...';
    // batch.chainBlockNumber = ...;
  }

  getSystemStatus(): {
    tick: TickNumber;
    agents: { total: number; byTier: Record<string, number>; byStatus: Record<string, number> };
    tasks: Record<string, { pending: number; active: number }>;
    audit: { pendingEvents: number; batches: number };
  } {
    const agents = {
      total: 0,
      byTier: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    };

    for (const tier of Object.values(TrustTier)) {
      if (typeof tier === 'number') {
        const count = this.agentFactory.getAgentsByTier(tier).length;
        agents.byTier[TrustTier[tier]] = count;
        agents.total += count;
      }
    }

    for (const status of Object.values(AgentStatus)) {
      agents.byStatus[status] = this.agentFactory.getAgentsByStatus(status as AgentStatus).length;
    }

    return {
      tick: this.getCurrentTick(),
      agents,
      tasks: this.taskRouter.getQueueStats(),
      audit: {
        pendingEvents: this.observer.getEventCount(),
        batches: this.observer.getBatches().length,
      },
    };
  }
}

// Export factory function
export function createOrchestrator(config?: Partial<OrchestratorConfig>): Orchestrator {
  return new Orchestrator(config);
}
