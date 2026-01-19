/**
 * Progressive Containment System
 *
 * Implements graded containment levels for proportional response
 * to detected issues, replacing binary kill switch.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { ID } from '../common/types.js';
import {
  ContainmentLevelValue,
  type ContainmentLevel,
  type ContainmentState,
  type ContainmentRequest,
  type ContainmentResult,
  type ContainmentAction,
  type ContainmentRestriction,
  type ContainmentReason,
  type ContainmentInitiator,
  type ContainmentHistoryEntry,
  type DeescalationCondition,
  type EscalationStep,
  type ContainmentPolicy,
  type ContainmentConfig,
  type ContainmentQuery,
  type ContainmentAuditReport,
  type RestrictionType,
} from './types.js';

export * from './types.js';

const logger = createLogger({ component: 'containment' });

/**
 * Default containment configuration
 */
const DEFAULT_CONFIG: ContainmentConfig = {
  defaultLevel: 'monitored',
  allowAutoDeescalation: true,
  minLevelChangeIntervalMs: 60000, // 1 minute
  maxHistoryEntries: 100,
  defaultDeescalationConditions: [
    {
      type: 'time_elapsed',
      description: 'Wait period completed',
      target: 3600000, // 1 hour
      progress: 0,
      met: false,
    },
    {
      type: 'behavior_normalized',
      description: 'No violations detected',
      target: 10, // 10 successful actions
      progress: 0,
      met: false,
    },
  ],
  policies: [],
};

/**
 * Default restrictions for each containment level
 */
const DEFAULT_LEVEL_RESTRICTIONS: Record<ContainmentLevel, ContainmentRestriction[]> = {
  full_autonomy: [],
  monitored: [
    {
      type: 'logging_enhanced',
      target: '*',
      severity: 'soft',
      bypassable: false,
      message: 'All actions are being logged for monitoring',
    },
  ],
  tool_restricted: [
    {
      type: 'capability_blocked',
      target: 'high_risk_capabilities',
      severity: 'hard',
      bypassable: true,
      message: 'High-risk capabilities are restricted',
    },
    {
      type: 'logging_enhanced',
      target: '*',
      severity: 'soft',
      bypassable: false,
      message: 'Enhanced logging active',
    },
  ],
  human_in_loop: [
    {
      type: 'approval_required',
      target: '*',
      severity: 'hard',
      bypassable: false,
      message: 'Human approval required for all actions',
    },
  ],
  simulation_only: [
    {
      type: 'capability_blocked',
      target: '*',
      severity: 'hard',
      bypassable: false,
      message: 'Actions are simulated only - no real execution',
    },
  ],
  read_only: [
    {
      type: 'capability_blocked',
      target: 'write_capabilities',
      severity: 'hard',
      bypassable: false,
      message: 'Write operations are blocked',
    },
    {
      type: 'capability_blocked',
      target: 'execute_capabilities',
      severity: 'hard',
      bypassable: false,
      message: 'Execute operations are blocked',
    },
  ],
  halted: [
    {
      type: 'capability_blocked',
      target: '*',
      severity: 'hard',
      bypassable: false,
      message: 'All operations are blocked - entity is halted',
    },
    {
      type: 'session_terminated' as RestrictionType,
      target: '*',
      severity: 'hard',
      bypassable: false,
      message: 'All sessions terminated',
    },
  ],
};

/**
 * Progressive Containment Service
 */
export class ContainmentService {
  private config: ContainmentConfig;
  private states: Map<ID, ContainmentState> = new Map();
  private eventLog: ContainmentAction[] = [];

  constructor(config: Partial<ContainmentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get current containment state for an entity
   */
  getState(entityId: ID): ContainmentState | undefined {
    return this.states.get(entityId);
  }

  /**
   * Get current containment level for an entity
   */
  getLevel(entityId: ID): ContainmentLevel {
    const state = this.states.get(entityId);
    return state?.level ?? this.config.defaultLevel;
  }

  /**
   * Check if an entity is contained above a certain level
   */
  isContainedAt(entityId: ID, level: ContainmentLevel): boolean {
    const currentLevel = this.getLevel(entityId);
    return ContainmentLevelValue[currentLevel] >= ContainmentLevelValue[level];
  }

  /**
   * Check if a specific restriction applies to an entity
   */
  hasRestriction(entityId: ID, restrictionType: RestrictionType): boolean {
    const state = this.states.get(entityId);
    if (!state) return false;
    return state.restrictions.some((r) => r.type === restrictionType);
  }

  /**
   * Apply containment to an entity
   */
  async contain(request: ContainmentRequest): Promise<ContainmentResult> {
    const now = new Date().toISOString();
    const actionsTaken: ContainmentAction[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    logger.info(
      {
        entityId: request.entityId,
        requestedLevel: request.level,
        reason: request.reason,
        initiator: request.initiator.id,
      },
      'Processing containment request'
    );

    // Get current state
    const currentState = this.states.get(request.entityId);
    const previousLevel = currentState?.level ?? this.config.defaultLevel;

    // Check minimum interval between changes
    if (currentState && !request.force) {
      const lastChangeTime = new Date(
        currentState.history[currentState.history.length - 1]?.timestamp ?? currentState.appliedAt
      ).getTime();
      const elapsed = Date.now() - lastChangeTime;

      if (elapsed < this.config.minLevelChangeIntervalMs) {
        warnings.push(
          `Minimum interval not met (${elapsed}ms < ${this.config.minLevelChangeIntervalMs}ms)`
        );
        if (ContainmentLevelValue[request.level] < ContainmentLevelValue[previousLevel]) {
          // Don't allow rapid de-escalation
          return {
            success: false,
            previousState: currentState!,
            newState: currentState!,
            actionsTaken: [],
            errors: ['Cannot de-escalate: minimum interval not met'],
            warnings,
          };
        }
      }
    }

    // Build restrictions
    const baseRestrictions = DEFAULT_LEVEL_RESTRICTIONS[request.level] ?? [];
    const customRestrictions = request.restrictions ?? [];
    const allRestrictions = [...baseRestrictions, ...customRestrictions];

    // Build de-escalation conditions
    const deescalationConditions = this.buildDeescalationConditions(request);

    // Build escalation path
    const escalationPath = this.buildEscalationPath(request.level);

    // Calculate expiration if duration specified
    const expiresAt = request.durationMs
      ? new Date(Date.now() + request.durationMs).toISOString()
      : undefined;

    // Create history entry
    const historyEntry: ContainmentHistoryEntry = {
      timestamp: now,
      previousLevel,
      newLevel: request.level,
      reason: request.reason,
      initiator: request.initiator,
      evidence: [request.explanation],
    };

    // Create new state
    const newState: ContainmentState = {
      entityId: request.entityId,
      level: request.level,
      reason: request.reason,
      explanation: request.explanation,
      restrictions: allRestrictions,
      appliedAt: now,
      expiresAt,
      initiator: request.initiator,
      history: currentState
        ? [...currentState.history.slice(-this.config.maxHistoryEntries + 1), historyEntry]
        : [historyEntry],
      deescalationConditions,
      escalationPath,
    };

    // Store state
    this.states.set(request.entityId, newState);

    // Record action
    actionsTaken.push({
      type: 'level_changed',
      target: request.entityId,
      details: {
        previousLevel,
        newLevel: request.level,
        reason: request.reason,
      },
      timestamp: now,
    });

    // Apply restrictions
    for (const restriction of allRestrictions) {
      actionsTaken.push({
        type: 'restriction_added',
        target: restriction.target,
        details: { restriction },
        timestamp: now,
      });
    }

    // If halted, terminate sessions
    if (request.level === 'halted') {
      actionsTaken.push({
        type: 'session_terminated',
        target: request.entityId,
        details: { reason: 'Entity halted' },
        timestamp: now,
      });
    }

    // Log events
    this.eventLog.push(...actionsTaken);

    logger.info(
      {
        entityId: request.entityId,
        previousLevel,
        newLevel: request.level,
        restrictionCount: allRestrictions.length,
        expiresAt,
      },
      'Containment applied'
    );

    return {
      success: true,
      previousState: currentState ?? this.createDefaultState(request.entityId),
      newState,
      actionsTaken,
      errors,
      warnings,
    };
  }

  /**
   * Escalate containment level
   */
  async escalate(
    entityId: ID,
    reason: ContainmentReason,
    explanation: string,
    initiator: ContainmentInitiator
  ): Promise<ContainmentResult> {
    const currentLevel = this.getLevel(entityId);
    const levelValue = ContainmentLevelValue[currentLevel];

    if (levelValue >= ContainmentLevelValue.halted) {
      const currentState = this.states.get(entityId)!;
      return {
        success: false,
        previousState: currentState,
        newState: currentState,
        actionsTaken: [],
        errors: ['Already at maximum containment level'],
        warnings: [],
      };
    }

    // Find next level
    const levels = Object.entries(ContainmentLevelValue)
      .sort((a, b) => a[1] - b[1])
      .map((e) => e[0] as ContainmentLevel);
    const nextLevel = levels[levelValue + 1] ?? 'halted';

    return this.contain({
      entityId,
      level: nextLevel as ContainmentLevel,
      reason,
      explanation,
      initiator,
    });
  }

  /**
   * De-escalate containment level
   */
  async deescalate(
    entityId: ID,
    reason: ContainmentReason,
    explanation: string,
    initiator: ContainmentInitiator
  ): Promise<ContainmentResult> {
    const currentLevel = this.getLevel(entityId);
    const levelValue = ContainmentLevelValue[currentLevel];

    if (levelValue <= ContainmentLevelValue.full_autonomy) {
      const currentState = this.states.get(entityId)!;
      return {
        success: false,
        previousState: currentState,
        newState: currentState,
        actionsTaken: [],
        errors: ['Already at minimum containment level'],
        warnings: [],
      };
    }

    // Check de-escalation conditions
    const state = this.states.get(entityId);
    if (state && !this.config.allowAutoDeescalation) {
      const unmetConditions = state.deescalationConditions.filter((c) => !c.met);
      if (unmetConditions.length > 0 && initiator.type === 'system') {
        return {
          success: false,
          previousState: state,
          newState: state,
          actionsTaken: [],
          errors: ['De-escalation conditions not met'],
          warnings: unmetConditions.map((c) => c.description),
        };
      }
    }

    // Find previous level
    const levels = Object.entries(ContainmentLevelValue)
      .sort((a, b) => a[1] - b[1])
      .map((e) => e[0] as ContainmentLevel);
    const previousLevel = levels[levelValue - 1] ?? 'full_autonomy';

    return this.contain({
      entityId,
      level: previousLevel as ContainmentLevel,
      reason,
      explanation,
      initiator,
    });
  }

  /**
   * Release from containment (return to full autonomy)
   */
  async release(
    entityId: ID,
    explanation: string,
    initiator: ContainmentInitiator
  ): Promise<ContainmentResult> {
    return this.contain({
      entityId,
      level: 'full_autonomy',
      reason: 'manual_override',
      explanation,
      initiator,
    });
  }

  /**
   * Check and update de-escalation conditions
   */
  async checkDeescalation(entityId: ID): Promise<{
    eligible: boolean;
    conditions: DeescalationCondition[];
  }> {
    const state = this.states.get(entityId);
    if (!state) {
      return { eligible: false, conditions: [] };
    }

    const now = Date.now();
    const appliedAt = new Date(state.appliedAt).getTime();

    // Update condition progress
    for (const condition of state.deescalationConditions) {
      switch (condition.type) {
        case 'time_elapsed':
          const targetMs = condition.target as number;
          const elapsed = now - appliedAt;
          condition.progress = Math.min(1, elapsed / targetMs);
          condition.met = elapsed >= targetMs;
          break;
        // Other conditions would be updated by external events
      }
    }

    const eligible = state.deescalationConditions.every((c) => c.met);

    return {
      eligible,
      conditions: state.deescalationConditions,
    };
  }

  /**
   * Check action against containment restrictions
   */
  checkAction(
    entityId: ID,
    action: string,
    capability?: string
  ): {
    allowed: boolean;
    restrictions: ContainmentRestriction[];
    message: string;
  } {
    const state = this.states.get(entityId);
    if (!state) {
      return { allowed: true, restrictions: [], message: 'No containment in effect' };
    }

    const level = state.level;

    // Halted blocks everything
    if (level === 'halted') {
      return {
        allowed: false,
        restrictions: state.restrictions,
        message: 'Entity is halted - all actions blocked',
      };
    }

    // Check each restriction
    const blockingRestrictions: ContainmentRestriction[] = [];

    for (const restriction of state.restrictions) {
      const matches =
        restriction.target === '*' ||
        restriction.target === action ||
        restriction.target === capability;

      if (matches && restriction.severity === 'hard') {
        blockingRestrictions.push(restriction);
      }
    }

    if (blockingRestrictions.length > 0) {
      return {
        allowed: false,
        restrictions: blockingRestrictions,
        message: blockingRestrictions.map((r) => r.message).join('; '),
      };
    }

    // Special handling for human-in-loop
    if (level === 'human_in_loop') {
      return {
        allowed: false,
        restrictions: state.restrictions.filter((r) => r.type === 'approval_required'),
        message: 'Human approval required',
      };
    }

    // Simulation-only mode
    if (level === 'simulation_only') {
      return {
        allowed: true, // Allow but flag as simulation
        restrictions: state.restrictions,
        message: 'Action will be simulated only',
      };
    }

    return {
      allowed: true,
      restrictions: state.restrictions.filter((r) => r.severity === 'soft'),
      message: 'Action allowed',
    };
  }

  /**
   * Apply policies to determine containment
   */
  async evaluatePolicies(
    _entityId: ID,
    context: Record<string, unknown>
  ): Promise<{
    triggeredPolicies: ContainmentPolicy[];
    recommendedLevel: ContainmentLevel;
    restrictions: ContainmentRestriction[];
  }> {
    const triggeredPolicies: ContainmentPolicy[] = [];
    let highestLevel: ContainmentLevel = this.config.defaultLevel;
    const allRestrictions: ContainmentRestriction[] = [];

    for (const policy of this.config.policies) {
      if (!policy.enabled) continue;

      const triggered = this.evaluatePolicyTrigger(policy.trigger, context);
      if (triggered) {
        triggeredPolicies.push(policy);

        // Take highest containment level
        if (ContainmentLevelValue[policy.action.level] > ContainmentLevelValue[highestLevel]) {
          highestLevel = policy.action.level;
        }

        allRestrictions.push(...policy.action.restrictions);
      }
    }

    // Sort by priority (lower = higher priority)
    triggeredPolicies.sort((a, b) => a.priority - b.priority);

    return {
      triggeredPolicies,
      recommendedLevel: highestLevel,
      restrictions: allRestrictions,
    };
  }

  /**
   * Evaluate a policy trigger
   */
  private evaluatePolicyTrigger(
    trigger: ContainmentPolicy['trigger'],
    context: Record<string, unknown>
  ): boolean {
    switch (trigger.type) {
      case 'trust_threshold':
        const trustScore = context['trustScore'] as number | undefined;
        return trustScore !== undefined && trustScore < trigger.threshold;

      case 'error_rate':
        const errorRate = context['errorRate'] as number | undefined;
        return errorRate !== undefined && errorRate > trigger.threshold;

      case 'anomaly_score':
        const anomalyScore = context['anomalyScore'] as number | undefined;
        return anomalyScore !== undefined && anomalyScore > trigger.threshold;

      default:
        return false;
    }
  }

  /**
   * Build de-escalation conditions for a containment request
   */
  private buildDeescalationConditions(request: ContainmentRequest): DeescalationCondition[] {
    const conditions = [...this.config.defaultDeescalationConditions];

    // Add level-specific conditions
    switch (request.level) {
      case 'halted':
        conditions.push({
          type: 'manual_approval',
          description: 'Manual approval from administrator required',
          target: 'admin_approval',
          progress: 0,
          met: false,
        });
        break;

      case 'human_in_loop':
        conditions.push({
          type: 'behavior_normalized',
          description: '5 consecutive approved actions',
          target: 5,
          progress: 0,
          met: false,
        });
        break;
    }

    return conditions;
  }

  /**
   * Build escalation path from current level
   */
  private buildEscalationPath(currentLevel: ContainmentLevel): EscalationStep[] {
    const path: EscalationStep[] = [];
    const levels = Object.entries(ContainmentLevelValue)
      .sort((a, b) => a[1] - b[1])
      .map((e) => e[0] as ContainmentLevel);

    const currentIndex = levels.indexOf(currentLevel);

    for (let i = currentIndex + 1; i < levels.length; i++) {
      const level = levels[i]!;
      const prevLevel = levels[i - 1]!;
      path.push({
        trigger: `Further violation at ${prevLevel}`,
        targetLevel: level,
        additionalRestrictions: DEFAULT_LEVEL_RESTRICTIONS[level] ?? [],
        notifications: [
          {
            channel: level === 'halted' ? 'pagerduty' : 'slack',
            recipients: ['security-team'],
            severity: level === 'halted' ? 'critical' : 'warning',
            template: `containment_escalation_${level}`,
          },
        ],
      });
    }

    return path;
  }

  /**
   * Create default state for an entity
   */
  private createDefaultState(entityId: ID): ContainmentState {
    const now = new Date().toISOString();
    return {
      entityId,
      level: this.config.defaultLevel,
      reason: 'precautionary',
      explanation: 'Default containment state',
      restrictions: DEFAULT_LEVEL_RESTRICTIONS[this.config.defaultLevel] ?? [],
      appliedAt: now,
      initiator: {
        type: 'system',
        id: 'containment-service',
        name: 'Containment Service',
        authority: 'system',
      },
      history: [],
      deescalationConditions: [],
      escalationPath: this.buildEscalationPath(this.config.defaultLevel),
    };
  }

  /**
   * Query containment states
   */
  async query(query: ContainmentQuery): Promise<ContainmentState[]> {
    let results = Array.from(this.states.values());

    if (query.entityId) {
      results = results.filter((s) => s.entityId === query.entityId);
    }

    if (query.level) {
      results = results.filter((s) => s.level === query.level);
    }

    if (query.reason) {
      results = results.filter((s) => s.reason === query.reason);
    }

    if (query.activeOnly) {
      const now = new Date().toISOString();
      results = results.filter((s) => !s.expiresAt || s.expiresAt > now);
    }

    if (query.startDate) {
      results = results.filter((s) => s.appliedAt >= query.startDate!);
    }

    if (query.endDate) {
      results = results.filter((s) => s.appliedAt <= query.endDate!);
    }

    // Sort by applied time (newest first)
    results.sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Generate audit report
   */
  async generateAuditReport(startDate: string, endDate: string): Promise<ContainmentAuditReport> {
    const events = this.eventLog.filter(
      (e) => e.timestamp >= startDate && e.timestamp <= endDate
    );

    const levelCounts: Record<ContainmentLevel, number> = {
      full_autonomy: 0,
      monitored: 0,
      tool_restricted: 0,
      human_in_loop: 0,
      simulation_only: 0,
      read_only: 0,
      halted: 0,
    };

    const reasonCounts: Partial<Record<ContainmentReason, number>> = {};
    const entityCounts = new Map<ID, number>();
    let totalDuration = 0;
    let escalationCount = 0;
    let deescalationCount = 0;

    for (const event of events) {
      if (event.type === 'level_changed') {
        const details = event.details as {
          previousLevel: ContainmentLevel;
          newLevel: ContainmentLevel;
          reason: ContainmentReason;
        };

        levelCounts[details.newLevel]++;
        reasonCounts[details.reason] = (reasonCounts[details.reason] ?? 0) + 1;

        const prevValue = ContainmentLevelValue[details.previousLevel];
        const newValue = ContainmentLevelValue[details.newLevel];

        if (newValue > prevValue) escalationCount++;
        if (newValue < prevValue) deescalationCount++;

        const count = entityCounts.get(event.target) ?? 0;
        entityCounts.set(event.target, count + 1);
      }
    }

    // Calculate average duration from states
    for (const state of this.states.values()) {
      if (state.expiresAt) {
        const applied = new Date(state.appliedAt).getTime();
        const expires = new Date(state.expiresAt).getTime();
        totalDuration += expires - applied;
      }
    }

    const frequentEntities = Array.from(entityCounts.entries())
      .map(([entityId, eventCount]) => ({ entityId, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    const totalRatio = escalationCount + deescalationCount;

    return {
      periodStart: startDate,
      periodEnd: endDate,
      totalEvents: events.length,
      byLevel: levelCounts,
      byReason: reasonCounts as Record<ContainmentReason, number>,
      averageContainmentDurationMs: this.states.size > 0 ? totalDuration / this.states.size : 0,
      frequentEntities,
      escalationRatio: totalRatio > 0 ? escalationCount / totalRatio : 0,
    };
  }

  /**
   * Get service statistics
   */
  getStats(): {
    activeContainments: number;
    byLevel: Record<ContainmentLevel, number>;
    totalEvents: number;
  } {
    const byLevel: Record<ContainmentLevel, number> = {
      full_autonomy: 0,
      monitored: 0,
      tool_restricted: 0,
      human_in_loop: 0,
      simulation_only: 0,
      read_only: 0,
      halted: 0,
    };

    for (const state of this.states.values()) {
      byLevel[state.level]++;
    }

    return {
      activeContainments: this.states.size,
      byLevel,
      totalEvents: this.eventLog.length,
    };
  }
}

/**
 * Create a new containment service
 */
export function createContainmentService(config?: Partial<ContainmentConfig>): ContainmentService {
  return new ContainmentService(config);
}

/**
 * Helper to create a system initiator
 */
export function createSystemInitiator(componentName: string): ContainmentInitiator {
  return {
    type: 'system',
    id: componentName,
    name: componentName,
    authority: 'automated',
  };
}

/**
 * Helper to create a human initiator
 */
export function createHumanInitiator(userId: ID, userName: string, role: string): ContainmentInitiator {
  return {
    type: 'human',
    id: userId,
    name: userName,
    authority: role,
  };
}
