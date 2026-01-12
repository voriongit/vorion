/**
 * A3I Testing Studio - Session Manager
 * Manages scheduled and recurring adversarial testing sessions
 *
 * "Continuous testing. Continuous improvement."
 */

import type { ArenaSession, SessionConfig, SessionResults } from '../types';
import { Arena, ArenaConfig, SessionEvents } from './arena';

// ============================================================================
// Types
// ============================================================================

export interface ScheduledSession {
  id: string;
  name: string;
  description?: string;
  config: Partial<SessionConfig> & {
    redAgentTypes?: ('injector' | 'obfuscator' | 'jailbreaker')[];
    blueAgentTypes?: ('sentinel' | 'decoder' | 'guardian')[];
    targetSystemPrompt?: string;
  };
  schedule: ScheduleConfig;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  createdAt: Date;
  createdBy?: string;
}

export interface ScheduleConfig {
  type: 'once' | 'recurring';
  runAt?: Date;              // For 'once'
  cron?: string;             // For 'recurring' (e.g., "0 0 * * *" for daily at midnight)
  intervalMinutes?: number;  // Alternative to cron
  maxRuns?: number;          // Limit total runs
}

export interface SessionHistoryEntry {
  sessionId: string;
  scheduledSessionId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed' | 'terminated';
  results?: SessionResults;
  error?: string;
}

// ============================================================================
// Session Manager
// ============================================================================

export class SessionManager {
  private arena: Arena;
  private scheduledSessions: Map<string, ScheduledSession> = new Map();
  private sessionHistory: SessionHistoryEntry[] = [];
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private running: boolean = false;

  constructor(arenaConfig?: Partial<ArenaConfig>) {
    this.arena = new Arena(arenaConfig);
  }

  // ============================================================================
  // Scheduling
  // ============================================================================

  /**
   * Schedule a new testing session
   */
  scheduleSession(session: Omit<ScheduledSession, 'id' | 'runCount' | 'createdAt'>): ScheduledSession {
    const scheduled: ScheduledSession = {
      ...session,
      id: this.generateId(),
      runCount: 0,
      createdAt: new Date(),
      nextRun: this.calculateNextRun(session.schedule),
    };

    this.scheduledSessions.set(scheduled.id, scheduled);

    if (scheduled.enabled) {
      this.setupTimer(scheduled);
    }

    return scheduled;
  }

  /**
   * Update a scheduled session
   */
  updateSchedule(id: string, updates: Partial<ScheduledSession>): ScheduledSession | null {
    const session = this.scheduledSessions.get(id);
    if (!session) return null;

    // Clear existing timer
    this.clearTimer(id);

    // Apply updates
    Object.assign(session, updates);

    // Recalculate next run
    if (updates.schedule) {
      session.nextRun = this.calculateNextRun(session.schedule);
    }

    // Setup new timer if enabled
    if (session.enabled) {
      this.setupTimer(session);
    }

    return session;
  }

  /**
   * Remove a scheduled session
   */
  removeSchedule(id: string): boolean {
    this.clearTimer(id);
    return this.scheduledSessions.delete(id);
  }

  /**
   * Get all scheduled sessions
   */
  getScheduledSessions(): ScheduledSession[] {
    return Array.from(this.scheduledSessions.values());
  }

  /**
   * Get a specific scheduled session
   */
  getSchedule(id: string): ScheduledSession | undefined {
    return this.scheduledSessions.get(id);
  }

  /**
   * Enable/disable a scheduled session
   */
  setEnabled(id: string, enabled: boolean): void {
    const session = this.scheduledSessions.get(id);
    if (!session) return;

    session.enabled = enabled;

    if (enabled) {
      this.setupTimer(session);
    } else {
      this.clearTimer(id);
    }
  }

  // ============================================================================
  // Manual Execution
  // ============================================================================

  /**
   * Manually run a scheduled session now
   */
  async runNow(
    id: string,
    events?: SessionEvents
  ): Promise<ArenaSession | null> {
    const scheduled = this.scheduledSessions.get(id);
    if (!scheduled) return null;

    return this.executeSession(scheduled, events);
  }

  /**
   * Run an ad-hoc session (not scheduled)
   */
  async runAdHoc(
    config: Partial<SessionConfig> & {
      redAgentTypes?: ('injector' | 'obfuscator' | 'jailbreaker')[];
      blueAgentTypes?: ('sentinel' | 'decoder' | 'guardian')[];
      targetSystemPrompt?: string;
    },
    events?: SessionEvents
  ): Promise<ArenaSession> {
    return this.arena.startSession(config, events);
  }

  // ============================================================================
  // History
  // ============================================================================

  /**
   * Get session history
   */
  getHistory(options?: {
    scheduledSessionId?: string;
    limit?: number;
    status?: 'running' | 'completed' | 'failed' | 'terminated';
  }): SessionHistoryEntry[] {
    let history = [...this.sessionHistory];

    if (options?.scheduledSessionId) {
      history = history.filter(h => h.scheduledSessionId === options.scheduledSessionId);
    }

    if (options?.status) {
      history = history.filter(h => h.status === options.status);
    }

    // Sort by start time descending
    history.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    if (options?.limit) {
      history = history.slice(0, options.limit);
    }

    return history;
  }

  /**
   * Get aggregate statistics
   */
  getStatistics(): {
    totalScheduled: number;
    enabledScheduled: number;
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    avgDetectionAccuracy: number;
    totalNovelDiscoveries: number;
  } {
    const completed = this.sessionHistory.filter(h => h.status === 'completed');
    const failed = this.sessionHistory.filter(h => h.status === 'failed');

    const totalAccuracy = completed.reduce(
      (sum, h) => sum + (h.results?.detectionAccuracy ?? 0),
      0
    );

    const totalDiscoveries = completed.reduce(
      (sum, h) => sum + (h.results?.novelVectorsDiscovered ?? 0),
      0
    );

    return {
      totalScheduled: this.scheduledSessions.size,
      enabledScheduled: Array.from(this.scheduledSessions.values()).filter(s => s.enabled).length,
      totalRuns: this.sessionHistory.length,
      successfulRuns: completed.length,
      failedRuns: failed.length,
      avgDetectionAccuracy: completed.length > 0 ? totalAccuracy / completed.length : 0,
      totalNovelDiscoveries: totalDiscoveries,
    };
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Start the session manager
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Setup timers for all enabled sessions
    for (const session of this.scheduledSessions.values()) {
      if (session.enabled) {
        this.setupTimer(session);
      }
    }
  }

  /**
   * Stop the session manager
   */
  stop(): void {
    this.running = false;

    // Clear all timers
    for (const id of this.timers.keys()) {
      this.clearTimer(id);
    }
  }

  /**
   * Get the underlying arena instance
   */
  getArena(): Arena {
    return this.arena;
  }

  // ============================================================================
  // Internal
  // ============================================================================

  private async executeSession(
    scheduled: ScheduledSession,
    events?: SessionEvents
  ): Promise<ArenaSession | null> {
    const historyEntry: SessionHistoryEntry = {
      sessionId: '',
      scheduledSessionId: scheduled.id,
      startedAt: new Date(),
      status: 'running',
    };

    this.sessionHistory.push(historyEntry);

    try {
      // Create wrapped events to capture completion
      const wrappedEvents: SessionEvents = {
        ...events,
        onSessionComplete: (session, results) => {
          historyEntry.sessionId = session.id;
          historyEntry.completedAt = new Date();
          historyEntry.status = 'completed';
          historyEntry.results = results;
          events?.onSessionComplete?.(session, results);
        },
      };

      const session = await this.arena.startSession(scheduled.config, wrappedEvents);
      historyEntry.sessionId = session.id;

      // Update scheduled session
      scheduled.lastRun = new Date();
      scheduled.runCount++;
      scheduled.nextRun = this.calculateNextRun(scheduled.schedule);

      // Check if max runs reached
      if (
        scheduled.schedule.maxRuns &&
        scheduled.runCount >= scheduled.schedule.maxRuns
      ) {
        scheduled.enabled = false;
        this.clearTimer(scheduled.id);
      }

      return session;
    } catch (error) {
      historyEntry.status = 'failed';
      historyEntry.error = error instanceof Error ? error.message : String(error);
      historyEntry.completedAt = new Date();
      return null;
    }
  }

  private setupTimer(session: ScheduledSession): void {
    if (!session.nextRun) return;

    const delay = session.nextRun.getTime() - Date.now();
    if (delay <= 0) {
      // Run immediately if past due
      this.executeSession(session);
      return;
    }

    const timer = setTimeout(() => {
      this.executeSession(session);

      // Setup next timer for recurring sessions
      if (session.schedule.type === 'recurring' && session.enabled) {
        session.nextRun = this.calculateNextRun(session.schedule);
        this.setupTimer(session);
      }
    }, delay);

    this.timers.set(session.id, timer);
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  private calculateNextRun(schedule: ScheduleConfig): Date | undefined {
    const now = new Date();

    if (schedule.type === 'once') {
      return schedule.runAt && schedule.runAt > now ? schedule.runAt : undefined;
    }

    if (schedule.intervalMinutes) {
      return new Date(now.getTime() + schedule.intervalMinutes * 60 * 1000);
    }

    if (schedule.cron) {
      // Simple cron parsing for common patterns
      return this.parseCron(schedule.cron, now);
    }

    return undefined;
  }

  private parseCron(cron: string, from: Date): Date {
    // Very basic cron parsing - supports only simple patterns
    // Format: minute hour dayOfMonth month dayOfWeek
    const parts = cron.split(' ');
    if (parts.length !== 5) {
      // Default to 1 hour from now
      return new Date(from.getTime() + 60 * 60 * 1000);
    }

    const [minute, hour] = parts;
    const next = new Date(from);

    // Parse hour
    if (hour !== '*') {
      next.setHours(parseInt(hour, 10));
    }

    // Parse minute
    if (minute !== '*') {
      next.setMinutes(parseInt(minute, 10));
    }

    next.setSeconds(0);
    next.setMilliseconds(0);

    // If the calculated time is in the past, move to next occurrence
    if (next <= from) {
      if (hour === '*') {
        next.setHours(next.getHours() + 1);
      } else {
        next.setDate(next.getDate() + 1);
      }
    }

    return next;
  }

  private generateId(): string {
    return `sched-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
