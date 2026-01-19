/**
 * Aurais Infrastructure - Time Service
 * 
 * Provides trust-gated access to time primitives.
 * Lower tiers receive only logical tick counts; higher tiers get full temporal control.
 */

import {
  AgentId,
  TrustTier,
  TrustState,
  Timestamp,
  TickNumber,
  TimeContext,
  Timer,
  TimerCallback,
  ScheduledWork,
  TaskDefinition,
  ObserverEvent,
  ObserverEventType,
} from '../types/core.js';
import { CapabilityResolver, capabilityResolver } from './CapabilityResolver.js';

// ============================================================================
// TIME SERVICE INTERFACES
// ============================================================================

export interface ITimeService {
  /**
   * Get the current time context for an agent.
   * What's returned depends on the agent's trust tier.
   */
  getCurrentTime(agentId: AgentId, trustState: TrustState): TimeContext;

  /**
   * Get the current logical tick (always available to all agents).
   */
  getCurrentTick(): TickNumber;

  /**
   * Create a timer (requires CERTIFIED tier).
   */
  createTimer(
    creatorId: AgentId,
    trustState: TrustState,
    targetAgent: AgentId,
    triggerTick: TickNumber,
    callback: TimerCallback,
    options?: TimerOptions
  ): TimerResult;

  /**
   * Schedule future work (requires VERIFIED tier).
   */
  scheduleWork(
    schedulerId: AgentId,
    trustState: TrustState,
    task: TaskDefinition,
    scheduledTick: TickNumber,
    options?: ScheduleOptions
  ): ScheduleResult;

  /**
   * Set a relative deadline for a task (requires TRUSTED tier).
   */
  setDeadline(
    agentId: AgentId,
    trustState: TrustState,
    taskId: string,
    ticksFromNow: number
  ): DeadlineResult;

  /**
   * Pause another agent's execution (requires ELITE tier).
   */
  pauseAgent(
    controllerId: AgentId,
    trustState: TrustState,
    targetAgentId: AgentId,
    reason: string
  ): TemporalControlResult;

  /**
   * Resume a paused agent (requires ELITE tier).
   */
  resumeAgent(
    controllerId: AgentId,
    trustState: TrustState,
    targetAgentId: AgentId
  ): TemporalControlResult;

  /**
   * Advance the logical clock (system use only).
   */
  tick(): TickNumber;

  /**
   * Register a tick listener.
   */
  onTick(callback: TickCallback): () => void;
}

export interface TimerOptions {
  repeating?: boolean;
  intervalTicks?: number;
  metadata?: Record<string, unknown>;
}

export interface TimerResult {
  success: boolean;
  timerId?: string;
  error?: string;
}

export interface ScheduleOptions {
  priority?: number;
  dependencies?: string[];
  assignTo?: AgentId;
}

export interface ScheduleResult {
  success: boolean;
  workId?: string;
  scheduledTick?: TickNumber;
  error?: string;
}

export interface DeadlineResult {
  success: boolean;
  deadlineTick?: TickNumber;
  error?: string;
}

export interface TemporalControlResult {
  success: boolean;
  error?: string;
  affectedAgent?: AgentId;
  previousState?: 'running' | 'paused';
}

export type TickCallback = (tick: TickNumber, timestamp: Timestamp) => void;

// ============================================================================
// TIME SERVICE IMPLEMENTATION
// ============================================================================

export class TimeService implements ITimeService {
  private currentTick: TickNumber = 0;
  private tickDuration: number = 100;  // 100ms per tick default
  private startTime: Timestamp;

  private timers: Map<string, Timer> = new Map();
  private scheduledWork: Map<string, ScheduledWork> = new Map();
  private deadlines: Map<string, TickNumber> = new Map();
  private pausedAgents: Set<AgentId> = new Set();

  private tickListeners: Set<TickCallback> = new Set();
  private eventEmitter: (event: ObserverEvent) => void;

  constructor(
    private resolver: CapabilityResolver = capabilityResolver,
    eventEmitter?: (event: ObserverEvent) => void
  ) {
    this.startTime = Date.now();
    this.eventEmitter = eventEmitter || (() => { });
  }

  // --------------------------------------------------------------------------
  // Core Time Access
  // --------------------------------------------------------------------------

  getCurrentTime(agentId: AgentId, trustState: TrustState): TimeContext {
    const capabilities = this.resolver.getCapabilities(trustState);

    const context: TimeContext = {
      wallClock: capabilities.time.canReadClock ? Date.now() : 0,
      tick: this.currentTick,
      tickDuration: this.tickDuration,
    };

    // Add deadline if one is set for this agent's current task
    const agentDeadline = this.findAgentDeadline(agentId);
    if (agentDeadline) {
      context.deadline = agentDeadline;
    }

    return context;
  }

  getCurrentTick(): TickNumber {
    return this.currentTick;
  }

  // --------------------------------------------------------------------------
  // Timer Management (CERTIFIED+)
  // --------------------------------------------------------------------------

  createTimer(
    creatorId: AgentId,
    trustState: TrustState,
    targetAgent: AgentId,
    triggerTick: TickNumber,
    callback: TimerCallback,
    options: TimerOptions = {}
  ): TimerResult {
    // Check capability
    const check = this.resolver.canPerform(trustState, {
      category: 'time',
      action: 'create_timer',
    });

    if (!check.allowed) {
      this.emitCapabilityDenied(creatorId, 'create_timer', check.reason);
      return { success: false, error: check.reason };
    }

    // Validate trigger tick
    if (triggerTick <= this.currentTick) {
      return { success: false, error: 'Trigger tick must be in the future' };
    }

    // Check schedule horizon
    const capabilities = this.resolver.getCapabilities(trustState);
    const ticksAhead = triggerTick - this.currentTick;
    if (ticksAhead > capabilities.time.maxScheduleHorizon) {
      return {
        success: false,
        error: `Cannot schedule ${ticksAhead} ticks ahead (max: ${capabilities.time.maxScheduleHorizon})`
      };
    }

    const timerId = this.generateId('timer');
    const timer: Timer = {
      id: timerId,
      createdBy: creatorId,
      targetAgent,
      triggerTick,
      callback,
      repeating: options.repeating || false,
      intervalTicks: options.intervalTicks,
      metadata: options.metadata,
    };

    this.timers.set(timerId, timer);

    this.emitEvent({
      agentId: creatorId,
      eventType: ObserverEventType.TOOL_INVOKED,
      payload: {
        tool: 'TimeService.createTimer',
        params: { targetAgent, triggerTick, repeating: options.repeating },
        result: { timerId },
      },
    });

    return { success: true, timerId };
  }

  // --------------------------------------------------------------------------
  // Work Scheduling (VERIFIED+)
  // --------------------------------------------------------------------------

  scheduleWork(
    schedulerId: AgentId,
    trustState: TrustState,
    task: TaskDefinition,
    scheduledTick: TickNumber,
    options: ScheduleOptions = {}
  ): ScheduleResult {
    // Check capability
    const check = this.resolver.canPerform(trustState, {
      category: 'time',
      action: 'schedule_future',
    });

    if (!check.allowed) {
      this.emitCapabilityDenied(schedulerId, 'schedule_future', check.reason);
      return { success: false, error: check.reason };
    }

    // Validate scheduled tick
    if (scheduledTick <= this.currentTick) {
      return { success: false, error: 'Scheduled tick must be in the future' };
    }

    // Check schedule horizon
    const capabilities = this.resolver.getCapabilities(trustState);
    const ticksAhead = scheduledTick - this.currentTick;
    if (ticksAhead > capabilities.time.maxScheduleHorizon) {
      return {
        success: false,
        error: `Cannot schedule ${ticksAhead} ticks ahead (max: ${capabilities.time.maxScheduleHorizon})`
      };
    }

    const workId = this.generateId('work');
    const work: ScheduledWork = {
      id: workId,
      scheduledTick,
      createdBy: schedulerId,
      assignedTo: options.assignTo,
      task,
      priority: options.priority || 0,
      dependencies: options.dependencies || [],
    };

    this.scheduledWork.set(workId, work);

    this.emitEvent({
      agentId: schedulerId,
      eventType: ObserverEventType.TOOL_INVOKED,
      payload: {
        tool: 'TimeService.scheduleWork',
        params: { taskId: task.id, scheduledTick, priority: options.priority },
        result: { workId },
      },
    });

    return { success: true, workId, scheduledTick };
  }

  // --------------------------------------------------------------------------
  // Deadline Management (TRUSTED+)
  // --------------------------------------------------------------------------

  setDeadline(
    agentId: AgentId,
    trustState: TrustState,
    taskId: string,
    ticksFromNow: number
  ): DeadlineResult {
    // Check capability
    const check = this.resolver.canPerform(trustState, {
      category: 'time',
      action: 'set_deadline',
    });

    if (!check.allowed) {
      this.emitCapabilityDenied(agentId, 'set_deadline', check.reason);
      return { success: false, error: check.reason };
    }

    if (ticksFromNow <= 0) {
      return { success: false, error: 'Deadline must be in the future' };
    }

    const deadlineTick = this.currentTick + ticksFromNow;
    const deadlineKey = `${agentId}:${taskId}`;
    this.deadlines.set(deadlineKey, deadlineTick);

    this.emitEvent({
      agentId,
      eventType: ObserverEventType.TOOL_INVOKED,
      payload: {
        tool: 'TimeService.setDeadline',
        params: { taskId, ticksFromNow },
        result: { deadlineTick },
      },
    });

    return { success: true, deadlineTick };
  }

  // --------------------------------------------------------------------------
  // Temporal Authority (ELITE only)
  // --------------------------------------------------------------------------

  pauseAgent(
    controllerId: AgentId,
    trustState: TrustState,
    targetAgentId: AgentId,
    reason: string
  ): TemporalControlResult {
    // Check capability
    const check = this.resolver.canPerform(trustState, {
      category: 'time',
      action: 'temporal_authority',
    });

    if (!check.allowed) {
      this.emitCapabilityDenied(controllerId, 'temporal_authority', check.reason);
      return { success: false, error: check.reason };
    }

    // Cannot pause self
    if (controllerId === targetAgentId) {
      return { success: false, error: 'Cannot pause self' };
    }

    const wasPaused = this.pausedAgents.has(targetAgentId);
    this.pausedAgents.add(targetAgentId);

    this.emitEvent({
      agentId: controllerId,
      eventType: ObserverEventType.TOOL_INVOKED,
      payload: {
        tool: 'TimeService.pauseAgent',
        params: { targetAgentId, reason },
        result: { wasPaused },
      },
    });

    return {
      success: true,
      affectedAgent: targetAgentId,
      previousState: wasPaused ? 'paused' : 'running',
    };
  }

  resumeAgent(
    controllerId: AgentId,
    trustState: TrustState,
    targetAgentId: AgentId
  ): TemporalControlResult {
    // Check capability
    const check = this.resolver.canPerform(trustState, {
      category: 'time',
      action: 'temporal_authority',
    });

    if (!check.allowed) {
      this.emitCapabilityDenied(controllerId, 'temporal_authority', check.reason);
      return { success: false, error: check.reason };
    }

    const wasPaused = this.pausedAgents.has(targetAgentId);
    this.pausedAgents.delete(targetAgentId);

    this.emitEvent({
      agentId: controllerId,
      eventType: ObserverEventType.TOOL_INVOKED,
      payload: {
        tool: 'TimeService.resumeAgent',
        params: { targetAgentId },
        result: { wasPaused },
      },
    });

    return {
      success: true,
      affectedAgent: targetAgentId,
      previousState: wasPaused ? 'paused' : 'running',
    };
  }

  isAgentPaused(agentId: AgentId): boolean {
    return this.pausedAgents.has(agentId);
  }

  // --------------------------------------------------------------------------
  // Tick Management
  // --------------------------------------------------------------------------

  tick(): TickNumber {
    this.currentTick++;
    const now = Date.now();

    // Fire tick listeners
    for (const listener of this.tickListeners) {
      try {
        listener(this.currentTick, now);
      } catch (error) {
        console.error('Tick listener error:', error);
      }
    }

    // Process due timers
    this.processDueTimers();

    // Check for deadline violations
    this.checkDeadlines();

    return this.currentTick;
  }

  onTick(callback: TickCallback): () => void {
    this.tickListeners.add(callback);
    return () => this.tickListeners.delete(callback);
  }

  // --------------------------------------------------------------------------
  // Internal Helpers
  // --------------------------------------------------------------------------

  private processDueTimers(): void {
    const dueTimers: Timer[] = [];

    for (const timer of this.timers.values()) {
      if (timer.triggerTick <= this.currentTick) {
        dueTimers.push(timer);
      }
    }

    for (const timer of dueTimers) {
      // Execute callback
      this.executeTimerCallback(timer);

      if (timer.repeating && timer.intervalTicks) {
        // Reschedule
        timer.triggerTick = this.currentTick + timer.intervalTicks;
      } else {
        // Remove one-shot timer
        this.timers.delete(timer.id);
      }
    }
  }

  private executeTimerCallback(timer: Timer): void {
    // In a real implementation, this would dispatch the callback
    // to the appropriate agent handler
    this.emitEvent({
      agentId: timer.targetAgent,
      eventType: ObserverEventType.MESSAGE_RECEIVED,
      payload: {
        source: 'timer',
        timerId: timer.id,
        callback: timer.callback,
        triggeredAt: this.currentTick,
      },
    });
  }

  private checkDeadlines(): void {
    const violations: string[] = [];

    for (const [key, deadline] of this.deadlines.entries()) {
      if (deadline <= this.currentTick) {
        violations.push(key);
      }
    }

    for (const key of violations) {
      const [agentId, taskId] = key.split(':');
      this.emitEvent({
        agentId: agentId as AgentId,
        eventType: ObserverEventType.TASK_COMPLETED,
        payload: {
          taskId,
          status: 'timeout',
          deadlineTick: this.deadlines.get(key),
          currentTick: this.currentTick,
        },
      });
      this.deadlines.delete(key);
    }
  }

  private findAgentDeadline(agentId: AgentId): TickNumber | undefined {
    for (const [key, deadline] of this.deadlines.entries()) {
      if (key.startsWith(`${agentId}:`)) {
        return deadline;
      }
    }
    return undefined;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitEvent(partial: Omit<ObserverEvent, 'id' | 'timestamp' | 'tick' | 'hash'>): void {
    const event: ObserverEvent = {
      id: this.generateId('evt') as any,
      timestamp: Date.now(),
      tick: this.currentTick,
      hash: '',  // Would be computed by observer
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
  // Scheduled Work Access
  // --------------------------------------------------------------------------

  getScheduledWork(workId: string): ScheduledWork | undefined {
    return this.scheduledWork.get(workId);
  }

  getDueWork(): ScheduledWork[] {
    const due: ScheduledWork[] = [];
    for (const work of this.scheduledWork.values()) {
      if (work.scheduledTick <= this.currentTick) {
        // Check dependencies
        const depsComplete = work.dependencies.every(
          depId => !this.scheduledWork.has(depId)
        );
        if (depsComplete) {
          due.push(work);
        }
      }
    }
    return due.sort((a, b) => b.priority - a.priority);
  }

  completeWork(workId: string): void {
    this.scheduledWork.delete(workId);
  }
}

// Export singleton instance
export const timeService = new TimeService();
