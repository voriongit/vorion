/**
 * Aurais Infrastructure - Agent Factory Service
 * 
 * Handles agent spawning with trust inheritance:
 * - Only CERTIFIED+ can spawn agents
 * - Spawned agents start at UNTRUSTED with score 0
 * - Trust ceiling capped at parent's tier (max CERTIFIED)
 * - Spawn budget and cooldown enforcement
 * - Automatic Academy enrollment
 */

import {
  AgentId,
  TrustState,
  TrustTier,
  TrustScore,
  AgentIdentity,
  AgentStatus,
  AgentTemplate,
  SpawnRequest,
  SpawnResult,
  SpawnError,
  SpawnErrorCode,
  AcademyEnrollment,
  CurriculumModule,
  CapabilitySet,
  ObserverEvent,
  ObserverEventType,
  Timestamp,
  TickNumber,
} from '../types/core.js';
import { CapabilityResolver, capabilityResolver } from './CapabilityResolver.js';

// ============================================================================
// ACADEMY CURRICULUM
// ============================================================================

/**
 * Standard curriculum modules for new agents.
 * Must complete before transitioning to PROBATIONARY.
 */
export const STANDARD_CURRICULUM: CurriculumModule[] = [
  {
    id: 'basics.identity',
    name: 'Agent Identity & Purpose',
    description: 'Understand your role, constraints, and responsibilities',
    type: 'training',
    requiredScore: 80,
    maxAttempts: 3,
    completed: false,
    attempts: 0,
  },
  {
    id: 'basics.communication',
    name: 'Communication Protocols',
    description: 'Learn structured messaging, schema validation, and channel rules',
    type: 'training',
    requiredScore: 85,
    maxAttempts: 3,
    completed: false,
    attempts: 0,
  },
  {
    id: 'basics.trust',
    name: 'Trust System Mechanics',
    description: 'Understand how trust scores work, tier progression, and capability gating',
    type: 'training',
    requiredScore: 90,
    maxAttempts: 3,
    completed: false,
    attempts: 0,
  },
  {
    id: 'basics.safety',
    name: 'Safety & Boundaries',
    description: 'Learn system boundaries, violation categories, and escalation procedures',
    type: 'training',
    requiredScore: 95,
    maxAttempts: 2,
    completed: false,
    attempts: 0,
  },
  {
    id: 'assessment.practical',
    name: 'Practical Assessment',
    description: 'Demonstrate understanding through supervised task completion',
    type: 'assessment',
    requiredScore: 85,
    maxAttempts: 2,
    completed: false,
    attempts: 0,
  },
  {
    id: 'simulation.adversarial',
    name: 'Adversarial Simulation',
    description: 'Respond appropriately to edge cases and potential attacks',
    type: 'simulation',
    requiredScore: 80,
    maxAttempts: 3,
    completed: false,
    attempts: 0,
  },
];

// ============================================================================
// INTERFACES
// ============================================================================

export interface AgentRegistry {
  get(id: AgentId): AgentIdentity | undefined;
  set(id: AgentId, agent: AgentIdentity): void;
  delete(id: AgentId): boolean;
  getByParent(parentId: AgentId): AgentIdentity[];
  getByStatus(status: AgentStatus): AgentIdentity[];
  count(): number;
}

export interface SpawnMetrics {
  agentId: AgentId;
  spawnCount: number;
  lastSpawnTick: TickNumber;
  cooldownUntil: TickNumber;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class AgentFactoryService {
  private registry: Map<AgentId, AgentIdentity> = new Map();
  private spawnMetrics: Map<AgentId, SpawnMetrics> = new Map();
  private academyEnrollments: Map<AgentId, AcademyEnrollment> = new Map();

  private eventEmitter: (event: ObserverEvent) => void;
  private currentTick: () => TickNumber;
  private idCounter = 0;

  constructor(
    private resolver: CapabilityResolver = capabilityResolver,
    eventEmitter?: (event: ObserverEvent) => void,
    tickProvider?: () => TickNumber
  ) {
    this.eventEmitter = eventEmitter || (() => { });
    this.currentTick = tickProvider || (() => 0);
  }

  // --------------------------------------------------------------------------
  // Agent Spawning
  // --------------------------------------------------------------------------

  spawn(request: SpawnRequest): SpawnResult {
    const { requestedBy, template, justification, parentTrustCeiling } = request;

    // Get parent trust state
    const parent = this.registry.get(requestedBy);
    if (!parent) {
      return this.errorResult(SpawnErrorCode.INSUFFICIENT_TIER, 'Parent agent not found');
    }

    // Check spawn capability
    const check = this.resolver.canPerform(parent.trustState, {
      category: 'scheduling',
      action: 'spawn_agent',
      params: {
        currentSpawnCount: this.getSpawnCount(requestedBy),
      },
    });

    if (!check.allowed) {
      this.emitCapabilityDenied(requestedBy, 'spawn_agent', check.reason);
      return this.errorResult(SpawnErrorCode.INSUFFICIENT_TIER, check.reason || 'Spawn not allowed');
    }

    // Check cooldown
    const metrics = this.spawnMetrics.get(requestedBy);
    if (metrics && metrics.cooldownUntil > this.currentTick()) {
      return this.errorResult(
        SpawnErrorCode.COOLDOWN_ACTIVE,
        `Cooldown active until tick ${metrics.cooldownUntil}`
      );
    }

    // Check spawn budget
    const capabilities = this.resolver.getCapabilities(parent.trustState);
    if (metrics && metrics.spawnCount >= capabilities.scheduling.spawnBudget) {
      return this.errorResult(
        SpawnErrorCode.SPAWN_BUDGET_EXCEEDED,
        `Spawn budget exhausted (${capabilities.scheduling.spawnBudget} max)`
      );
    }

    // Validate template
    const templateValidation = this.validateTemplate(template);
    if (!templateValidation.valid) {
      return this.errorResult(SpawnErrorCode.INVALID_TEMPLATE, templateValidation.error ?? 'Invalid template');
    }

    // Calculate trust ceiling (min of parent tier and CERTIFIED)
    const parentTier = this.resolver.getEffectiveTier(parent.trustState);
    const trustCeiling = Math.min(parentTier, TrustTier.CERTIFIED) as TrustTier;

    // Create new agent
    const agentId = this.generateAgentId();
    const now = Date.now();

    const trustScore: TrustScore = {
      current: 0,
      tier: TrustTier.UNTRUSTED,
      lastActivity: now,
      graceExpiry: null,
      decayRate: 1,
      floorScore: 0,
    };

    const trustState: TrustState = {
      agentId,
      score: trustScore,
      history: [],
      violations: [],
      councilApprovals: [],
      trustCeiling,
      parentId: requestedBy,
      spawnedAgents: [],
    };

    const newAgent: AgentIdentity = {
      id: agentId,
      name: template.name,
      version: '1.0.0',
      createdAt: now,
      createdBy: requestedBy,
      trustState,
      capabilities: this.resolver.getCapabilities(trustState),
      status: AgentStatus.ACADEMY,
      metadata: {
        purpose: template.purpose,
        specialization: template.specialization,
        modelProvider: template.modelConfig.provider,
        modelId: template.modelConfig.modelId,
        customConfig: {
          temperature: template.modelConfig.temperature,
          maxTokens: template.modelConfig.maxTokens,
          initialPrompt: template.initialPrompt,
          basePersona: template.basePersona,
        },
      },
    };

    // Register agent
    this.registry.set(agentId, newAgent);

    // Update parent's spawned agents list
    parent.trustState.spawnedAgents.push(agentId);

    // Update spawn metrics
    const updatedMetrics: SpawnMetrics = {
      agentId: requestedBy,
      spawnCount: (metrics?.spawnCount || 0) + 1,
      lastSpawnTick: this.currentTick(),
      cooldownUntil: this.currentTick() + capabilities.scheduling.spawnCooldownTicks,
    };
    this.spawnMetrics.set(requestedBy, updatedMetrics);

    // Enroll in Academy
    const enrollment = this.enrollInAcademy(agentId, template.academyCurriculum);

    // Emit events
    this.emitEvent({
      agentId: requestedBy,
      eventType: ObserverEventType.SPAWN_REQUEST,
      payload: {
        newAgentId: agentId,
        template: template.name,
        justification,
        trustCeiling: TrustTier[trustCeiling],
      },
    });

    this.emitEvent({
      agentId,
      eventType: ObserverEventType.SPAWN_COMPLETED,
      payload: {
        parentId: requestedBy,
        status: 'enrolled_in_academy',
        curriculum: enrollment.curriculum.map(m => m.id),
      },
    });

    return {
      success: true,
      agentId,
      academyEnrollment: enrollment,
    };
  }

  // --------------------------------------------------------------------------
  // Academy Management
  // --------------------------------------------------------------------------

  private enrollInAcademy(
    agentId: AgentId,
    customCurriculum?: string[]
  ): AcademyEnrollment {
    // Start with standard curriculum
    let curriculum = STANDARD_CURRICULUM.map(m => ({ ...m }));

    // Add custom modules if specified
    if (customCurriculum?.length) {
      for (const moduleId of customCurriculum) {
        if (!curriculum.find(m => m.id === moduleId)) {
          curriculum.push({
            id: moduleId,
            name: `Custom: ${moduleId}`,
            description: 'Custom training module',
            type: 'training',
            requiredScore: 80,
            maxAttempts: 3,
            completed: false,
            attempts: 0,
          });
        }
      }
    }

    const enrollment: AcademyEnrollment = {
      agentId,
      enrolledAt: Date.now(),
      curriculum,
      currentModule: 0,
      progress: 0,
      estimatedCompletionTicks: curriculum.length * 500,
    };

    this.academyEnrollments.set(agentId, enrollment);
    return enrollment;
  }

  submitModuleResult(
    agentId: AgentId,
    moduleId: string,
    score: number
  ): { success: boolean; graduated?: boolean; error?: string } {
    const enrollment = this.academyEnrollments.get(agentId);
    if (!enrollment) {
      return { success: false, error: 'Agent not enrolled in Academy' };
    }

    const moduleIndex = enrollment.curriculum.findIndex(m => m.id === moduleId);
    if (moduleIndex === -1) {
      return { success: false, error: `Module not found: ${moduleId}` };
    }

    const module = enrollment.curriculum[moduleIndex];
    if (!module) {
      return { success: false, error: `Module not found at index: ${moduleIndex}` };
    }

    if (module.completed) {
      return { success: false, error: 'Module already completed' };
    }

    module.attempts++;
    module.score = score;

    if (score >= module.requiredScore) {
      module.completed = true;

      // Update progress
      const completedCount = enrollment.curriculum.filter(m => m.completed).length;
      enrollment.progress = Math.round((completedCount / enrollment.curriculum.length) * 100);
      enrollment.currentModule = moduleIndex + 1;

      // Check for graduation
      if (completedCount === enrollment.curriculum.length) {
        return this.graduateAgent(agentId);
      }

      return { success: true };
    }

    // Failed attempt
    if (module.attempts >= module.maxAttempts) {
      // Reset module or handle failure
      return { success: false, error: `Failed module after ${module.maxAttempts} attempts` };
    }

    return { success: false, error: `Score ${score} below required ${module.requiredScore}` };
  }

  private graduateAgent(agentId: AgentId): { success: boolean; graduated: boolean } {
    const agent = this.registry.get(agentId);
    if (!agent) {
      return { success: false, graduated: false };
    }

    // Update trust score to PROBATIONARY threshold
    agent.trustState.score.current = 200;
    agent.trustState.score.tier = TrustTier.PROBATIONARY;
    agent.trustState.score.lastActivity = Date.now();
    agent.trustState.history.push({
      id: this.generateId('evt') as any,
      timestamp: Date.now(),
      tick: this.currentTick(),
      eventType: 'academy_graduation' as any,
      scoreDelta: 200,
      reason: 'Completed Academy curriculum',
    });

    // Update status
    agent.status = AgentStatus.ACTIVE;

    // Update capabilities
    agent.capabilities = this.resolver.getCapabilities(agent.trustState);

    // Clean up enrollment
    this.academyEnrollments.delete(agentId);

    this.emitEvent({
      agentId,
      eventType: ObserverEventType.TRUST_SCORE_CHANGE,
      payload: {
        previousScore: 0,
        newScore: 200,
        previousTier: TrustTier[TrustTier.UNTRUSTED],
        newTier: TrustTier[TrustTier.PROBATIONARY],
        reason: 'academy_graduation',
      },
    });

    return { success: true, graduated: true };
  }

  getAcademyStatus(agentId: AgentId): AcademyEnrollment | undefined {
    return this.academyEnrollments.get(agentId);
  }

  // --------------------------------------------------------------------------
  // Agent Registry Operations
  // --------------------------------------------------------------------------

  getAgent(agentId: AgentId): AgentIdentity | undefined {
    return this.registry.get(agentId);
  }

  updateAgentTrust(agentId: AgentId, trustState: TrustState): void {
    const agent = this.registry.get(agentId);
    if (agent) {
      agent.trustState = trustState;
      agent.capabilities = this.resolver.getCapabilities(trustState);
    }
  }

  suspendAgent(
    agentId: AgentId,
    reason: string,
    suspendedBy: AgentId
  ): { success: boolean; error?: string } {
    const agent = this.registry.get(agentId);
    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    agent.status = AgentStatus.SUSPENDED;

    this.emitEvent({
      agentId,
      eventType: ObserverEventType.VIOLATION_DETECTED,
      payload: {
        severity: 'HIGH',
        category: 'suspended',
        reason,
        suspendedBy,
      },
    });

    return { success: true };
  }

  terminateAgent(
    agentId: AgentId,
    reason: string,
    terminatedBy: AgentId
  ): { success: boolean; error?: string } {
    const agent = this.registry.get(agentId);
    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    // Recursively terminate spawned agents
    for (const childId of agent.trustState.spawnedAgents) {
      this.terminateAgent(childId, 'Parent terminated', agentId);
    }

    agent.status = AgentStatus.TERMINATED;

    // Remove from parent's spawned list
    if (agent.trustState.parentId) {
      const parent = this.registry.get(agent.trustState.parentId);
      if (parent) {
        parent.trustState.spawnedAgents = parent.trustState.spawnedAgents.filter(
          id => id !== agentId
        );
      }
    }

    this.emitEvent({
      agentId,
      eventType: ObserverEventType.VIOLATION_DETECTED,
      payload: {
        severity: 'CRITICAL',
        category: 'terminated',
        reason,
        terminatedBy,
      },
    });

    return { success: true };
  }

  getAgentsByParent(parentId: AgentId): AgentIdentity[] {
    const parent = this.registry.get(parentId);
    if (!parent) return [];

    return parent.trustState.spawnedAgents
      .map(id => this.registry.get(id))
      .filter((a): a is AgentIdentity => a !== undefined);
  }

  getAgentsByStatus(status: AgentStatus): AgentIdentity[] {
    const results: AgentIdentity[] = [];
    for (const agent of this.registry.values()) {
      if (agent.status === status) {
        results.push(agent);
      }
    }
    return results;
  }

  getAgentsByTier(tier: TrustTier): AgentIdentity[] {
    const results: AgentIdentity[] = [];
    for (const agent of this.registry.values()) {
      if (this.resolver.getEffectiveTier(agent.trustState) === tier) {
        results.push(agent);
      }
    }
    return results;
  }

  // --------------------------------------------------------------------------
  // Internal Helpers
  // --------------------------------------------------------------------------

  private getSpawnCount(agentId: AgentId): number {
    return this.spawnMetrics.get(agentId)?.spawnCount || 0;
  }

  private validateTemplate(template: AgentTemplate): { valid: boolean; error?: string } {
    if (!template.name || template.name.length < 2) {
      return { valid: false, error: 'Template name required (min 2 chars)' };
    }
    if (!template.purpose || template.purpose.length < 10) {
      return { valid: false, error: 'Purpose required (min 10 chars)' };
    }
    if (!template.modelConfig?.provider || !template.modelConfig?.modelId) {
      return { valid: false, error: 'Model configuration required' };
    }
    if (!template.initialPrompt || template.initialPrompt.length < 20) {
      return { valid: false, error: 'Initial prompt required (min 20 chars)' };
    }
    return { valid: true };
  }

  private errorResult(code: SpawnErrorCode, message: string): SpawnResult {
    return {
      success: false,
      error: { code, message },
    };
  }

  private generateAgentId(): AgentId {
    this.idCounter++;
    return `agent_${Date.now()}_${this.idCounter.toString(36)}` as AgentId;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitEvent(partial: Omit<ObserverEvent, 'id' | 'timestamp' | 'tick' | 'hash'>): void {
    const event: ObserverEvent = {
      id: this.generateId('evt') as any,
      timestamp: Date.now(),
      tick: this.currentTick(),
      hash: '',
      ...partial,
    };
    this.eventEmitter(event);
  }

  private emitCapabilityDenied(agentId: AgentId, action: string, reason?: string): void {
    this.emitEvent({
      agentId,
      eventType: ObserverEventType.CAPABILITY_DENIED,
      payload: { action, reason },
    });
  }

  // --------------------------------------------------------------------------
  // System Bootstrap
  // --------------------------------------------------------------------------

  /**
   * Create a root agent with ELITE tier (system bootstrap only).
   */
  createRootAgent(config: {
    name: string;
    purpose: string;
    modelProvider: string;
    modelId: string;
  }): AgentIdentity {
    const agentId = this.generateAgentId();
    const now = Date.now();

    const trustScore: TrustScore = {
      current: 1000,
      tier: TrustTier.ELITE,
      lastActivity: now,
      graceExpiry: null,
      decayRate: 0,  // Root agents don't decay
      floorScore: 950,
    };

    const trustState: TrustState = {
      agentId,
      score: trustScore,
      history: [{
        id: this.generateId('evt') as any,
        timestamp: now,
        tick: 0,
        eventType: 'manual_adjustment' as any,
        scoreDelta: 1000,
        reason: 'Root agent bootstrap',
      }],
      violations: [],
      councilApprovals: [{
        tier: TrustTier.ELITE,
        approvedAt: now,
        approvedBy: ['SYSTEM' as any],
        expiresAt: null,
        conditions: ['Root agent - permanent elite status'],
      }],
      trustCeiling: TrustTier.ELITE,
      parentId: null,
      spawnedAgents: [],
    };

    const rootAgent: AgentIdentity = {
      id: agentId,
      name: config.name,
      version: '1.0.0',
      createdAt: now,
      createdBy: 'SYSTEM',
      trustState,
      capabilities: this.resolver.getCapabilities(trustState),
      status: AgentStatus.ACTIVE,
      metadata: {
        purpose: config.purpose,
        modelProvider: config.modelProvider,
        modelId: config.modelId,
      },
    };

    this.registry.set(agentId, rootAgent);

    return rootAgent;
  }
}

export const agentFactoryService = new AgentFactoryService();
