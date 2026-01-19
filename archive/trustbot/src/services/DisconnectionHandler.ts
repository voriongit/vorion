/**
 * Disconnection Handler
 *
 * Epic 10: Agent Connection Layer
 * Story 10.7: Graceful Disconnection Handling
 *
 * Provides graceful handling of agent disconnections:
 * - Marks in-progress tasks as "agent_disconnected"
 * - Automatic reassignment option for orphaned tasks
 * - Disconnection reason logging
 * - Reconnection resumes task state
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export type TaskStatus =
    | 'pending'
    | 'assigned'
    | 'in_progress'
    | 'completed'
    | 'failed'
    | 'agent_disconnected'
    | 'reassigned'
    | 'cancelled';

export type DisconnectionReason =
    | 'client_close'
    | 'server_close'
    | 'network_error'
    | 'timeout'
    | 'idle_timeout'
    | 'auth_failure'
    | 'kicked'
    | 'pool_shutdown'
    | 'unknown';

export interface TaskInfo {
    taskId: string;
    agentId: string;
    orgId: string;
    type: string;
    status: TaskStatus;
    progress: number;
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, unknown>;
}

export interface DisconnectionEvent {
    agentId: string;
    orgId: string;
    connectionId: string;
    reason: DisconnectionReason;
    timestamp: Date;
    affectedTasks: string[];
    wasGraceful: boolean;
}

export interface ReconnectionEvent {
    agentId: string;
    orgId: string;
    connectionId: string;
    previousDisconnection?: DisconnectionEvent;
    resumableTasks: string[];
    timestamp: Date;
}

export interface TaskReassignment {
    taskId: string;
    fromAgentId: string;
    toAgentId: string;
    reason: string;
    timestamp: Date;
}

export interface AgentState {
    agentId: string;
    orgId: string;
    tasks: Map<string, TaskInfo>;
    lastConnectedAt: Date | null;
    lastDisconnectedAt: Date | null;
    disconnectionReason: DisconnectionReason | null;
    isConnected: boolean;
}

export interface DisconnectionHandlerConfig {
    /** Reconnection window in ms (default: 5 minutes) */
    reconnectionWindowMs: number;
    /** Whether to auto-reassign tasks after window expires (default: true) */
    autoReassign: boolean;
    /** Maximum tasks to preserve per agent (default: 100) */
    maxPreservedTasks: number;
    /** State cleanup interval in ms (default: 1 minute) */
    cleanupIntervalMs: number;
    /** State retention period in ms (default: 1 hour) */
    stateRetentionMs: number;
}

interface HandlerEvents {
    'agent:disconnected': (event: DisconnectionEvent) => void;
    'agent:reconnected': (event: ReconnectionEvent) => void;
    'task:orphaned': (task: TaskInfo) => void;
    'task:resumed': (task: TaskInfo, agentId: string) => void;
    'task:reassigned': (reassignment: TaskReassignment) => void;
    'task:expired': (task: TaskInfo) => void;
    'state:cleaned': (agentId: string, tasksRemoved: number) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: DisconnectionHandlerConfig = {
    reconnectionWindowMs: 5 * 60 * 1000, // 5 minutes
    autoReassign: true,
    maxPreservedTasks: 100,
    cleanupIntervalMs: 60 * 1000, // 1 minute
    stateRetentionMs: 60 * 60 * 1000, // 1 hour
};

// ============================================================================
// Disconnection Handler
// ============================================================================

export class DisconnectionHandler extends EventEmitter<HandlerEvents> {
    private config: DisconnectionHandlerConfig;

    // Agent state tracking
    private agentStates: Map<string, AgentState> = new Map();

    // Task tracking
    private tasks: Map<string, TaskInfo> = new Map();
    private agentTasks: Map<string, Set<string>> = new Map();

    // Disconnection history
    private disconnectionHistory: Map<string, DisconnectionEvent[]> = new Map();

    // Reassignment queue
    private pendingReassignments: Map<string, ReturnType<typeof setTimeout>> = new Map();

    // Cleanup
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;
    private isShuttingDown = false;

    constructor(config: Partial<DisconnectionHandlerConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // =========================================================================
    // Task Management
    // =========================================================================

    /**
     * Register a task for an agent
     */
    registerTask(task: Omit<TaskInfo, 'updatedAt'>): void {
        const taskInfo: TaskInfo = {
            ...task,
            updatedAt: new Date(),
        };

        this.tasks.set(task.taskId, taskInfo);

        // Track by agent
        if (!this.agentTasks.has(task.agentId)) {
            this.agentTasks.set(task.agentId, new Set());
        }
        this.agentTasks.get(task.agentId)!.add(task.taskId);

        // Update agent state
        const state = this.getOrCreateAgentState(task.agentId, task.orgId);
        state.tasks.set(task.taskId, taskInfo);

        // Enforce max preserved tasks
        this.enforceTaskLimit(task.agentId);
    }

    /**
     * Update task status
     */
    updateTaskStatus(taskId: string, status: TaskStatus, progress?: number): boolean {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        task.status = status;
        task.updatedAt = new Date();
        if (progress !== undefined) {
            task.progress = Math.min(100, Math.max(0, progress));
        }

        // Update in agent state
        const state = this.agentStates.get(task.agentId);
        if (state) {
            state.tasks.set(taskId, task);
        }

        return true;
    }

    /**
     * Complete a task
     */
    completeTask(taskId: string): boolean {
        return this.updateTaskStatus(taskId, 'completed', 100);
    }

    /**
     * Fail a task
     */
    failTask(taskId: string): boolean {
        return this.updateTaskStatus(taskId, 'failed');
    }

    /**
     * Remove a task
     */
    removeTask(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        this.tasks.delete(taskId);

        // Remove from agent tracking
        const agentTaskSet = this.agentTasks.get(task.agentId);
        if (agentTaskSet) {
            agentTaskSet.delete(taskId);
            if (agentTaskSet.size === 0) {
                this.agentTasks.delete(task.agentId);
            }
        }

        // Remove from agent state
        const state = this.agentStates.get(task.agentId);
        if (state) {
            state.tasks.delete(taskId);
        }

        return true;
    }

    /**
     * Get task info
     */
    getTask(taskId: string): TaskInfo | null {
        return this.tasks.get(taskId) ?? null;
    }

    /**
     * Get all tasks for an agent
     */
    getAgentTasks(agentId: string): TaskInfo[] {
        const taskIds = this.agentTasks.get(agentId);
        if (!taskIds) return [];

        return Array.from(taskIds)
            .map(id => this.tasks.get(id))
            .filter((t): t is TaskInfo => t !== undefined);
    }

    /**
     * Get in-progress tasks for an agent
     */
    getInProgressTasks(agentId: string): TaskInfo[] {
        return this.getAgentTasks(agentId).filter(t => t.status === 'in_progress');
    }

    /**
     * Get orphaned tasks (agent_disconnected status)
     */
    getOrphanedTasks(orgId?: string): TaskInfo[] {
        const orphaned: TaskInfo[] = [];
        for (const task of this.tasks.values()) {
            if (task.status === 'agent_disconnected') {
                if (!orgId || task.orgId === orgId) {
                    orphaned.push(task);
                }
            }
        }
        return orphaned;
    }

    // =========================================================================
    // Disconnection Handling
    // =========================================================================

    /**
     * Handle agent disconnection
     */
    handleDisconnection(
        agentId: string,
        orgId: string,
        connectionId: string,
        reason: DisconnectionReason
    ): DisconnectionEvent {
        const now = new Date();
        const wasGraceful = reason === 'client_close' || reason === 'server_close';

        // Get in-progress tasks
        const inProgressTasks = this.getInProgressTasks(agentId);
        const affectedTaskIds: string[] = [];

        // Mark in-progress tasks as agent_disconnected
        for (const task of inProgressTasks) {
            this.updateTaskStatus(task.taskId, 'agent_disconnected');
            affectedTaskIds.push(task.taskId);
            this.emit('task:orphaned', task);
        }

        // Update agent state
        const state = this.getOrCreateAgentState(agentId, orgId);
        state.isConnected = false;
        state.lastDisconnectedAt = now;
        state.disconnectionReason = reason;

        // Create disconnection event
        const event: DisconnectionEvent = {
            agentId,
            orgId,
            connectionId,
            reason,
            timestamp: now,
            affectedTasks: affectedTaskIds,
            wasGraceful,
        };

        // Record in history
        if (!this.disconnectionHistory.has(agentId)) {
            this.disconnectionHistory.set(agentId, []);
        }
        this.disconnectionHistory.get(agentId)!.push(event);

        // Schedule auto-reassignment if enabled
        if (this.config.autoReassign && affectedTaskIds.length > 0) {
            this.scheduleReassignment(agentId, affectedTaskIds);
        }

        this.emit('agent:disconnected', event);

        return event;
    }

    /**
     * Handle agent reconnection
     */
    handleReconnection(
        agentId: string,
        orgId: string,
        connectionId: string
    ): ReconnectionEvent {
        const now = new Date();

        // Cancel pending reassignment
        this.cancelPendingReassignment(agentId);

        // Get previous disconnection
        const history = this.disconnectionHistory.get(agentId);
        const previousDisconnection = history?.[history.length - 1];

        // Find resumable tasks (still in agent_disconnected status)
        const resumableTasks: string[] = [];
        const agentTaskIds = this.agentTasks.get(agentId);

        if (agentTaskIds) {
            for (const taskId of agentTaskIds) {
                const task = this.tasks.get(taskId);
                if (task && task.status === 'agent_disconnected') {
                    // Check if within reconnection window
                    const disconnectedAt = previousDisconnection?.timestamp ?? now;
                    const elapsed = now.getTime() - disconnectedAt.getTime();

                    if (elapsed <= this.config.reconnectionWindowMs) {
                        // Resume task
                        this.updateTaskStatus(taskId, 'in_progress');
                        resumableTasks.push(taskId);
                        this.emit('task:resumed', task, agentId);
                    }
                }
            }
        }

        // Update agent state
        const state = this.getOrCreateAgentState(agentId, orgId);
        state.isConnected = true;
        state.lastConnectedAt = now;

        // Create reconnection event
        const event: ReconnectionEvent = {
            agentId,
            orgId,
            connectionId,
            previousDisconnection,
            resumableTasks,
            timestamp: now,
        };

        this.emit('agent:reconnected', event);

        return event;
    }

    // =========================================================================
    // Task Reassignment
    // =========================================================================

    /**
     * Reassign a task to a different agent
     */
    reassignTask(taskId: string, toAgentId: string, reason: string = 'manual'): TaskReassignment | null {
        const task = this.tasks.get(taskId);
        if (!task) return null;

        const fromAgentId = task.agentId;

        // Remove from old agent
        const oldAgentTasks = this.agentTasks.get(fromAgentId);
        if (oldAgentTasks) {
            oldAgentTasks.delete(taskId);
            if (oldAgentTasks.size === 0) {
                this.agentTasks.delete(fromAgentId);
            }
        }

        const oldState = this.agentStates.get(fromAgentId);
        if (oldState) {
            oldState.tasks.delete(taskId);
        }

        // Update task
        task.agentId = toAgentId;
        task.status = 'reassigned';
        task.updatedAt = new Date();

        // Add to new agent
        if (!this.agentTasks.has(toAgentId)) {
            this.agentTasks.set(toAgentId, new Set());
        }
        this.agentTasks.get(toAgentId)!.add(taskId);

        const newState = this.getOrCreateAgentState(toAgentId, task.orgId);
        newState.tasks.set(taskId, task);

        // Create reassignment record
        const reassignment: TaskReassignment = {
            taskId,
            fromAgentId,
            toAgentId,
            reason,
            timestamp: new Date(),
        };

        this.emit('task:reassigned', reassignment);

        return reassignment;
    }

    /**
     * Reassign all orphaned tasks for an agent
     */
    reassignOrphanedTasks(fromAgentId: string, toAgentId: string, reason: string = 'bulk_reassign'): TaskReassignment[] {
        const orphanedTasks = this.getAgentTasks(fromAgentId).filter(t => t.status === 'agent_disconnected');
        const reassignments: TaskReassignment[] = [];

        for (const task of orphanedTasks) {
            const reassignment = this.reassignTask(task.taskId, toAgentId, reason);
            if (reassignment) {
                reassignments.push(reassignment);
            }
        }

        return reassignments;
    }

    /**
     * Get agents available for task reassignment
     */
    getAvailableAgents(orgId: string, excludeAgentId?: string): string[] {
        const available: string[] = [];

        for (const [agentId, state] of this.agentStates) {
            if (state.orgId === orgId && state.isConnected) {
                if (!excludeAgentId || agentId !== excludeAgentId) {
                    available.push(agentId);
                }
            }
        }

        return available;
    }

    private scheduleReassignment(agentId: string, taskIds: string[]): void {
        // Cancel existing timer
        this.cancelPendingReassignment(agentId);

        // Schedule new timer
        const timer = setTimeout(() => {
            this.pendingReassignments.delete(agentId);

            // Check if tasks are still orphaned
            for (const taskId of taskIds) {
                const task = this.tasks.get(taskId);
                if (task && task.status === 'agent_disconnected') {
                    // Emit expired event - let external handler decide reassignment
                    this.emit('task:expired', task);
                }
            }
        }, this.config.reconnectionWindowMs);

        this.pendingReassignments.set(agentId, timer);
    }

    private cancelPendingReassignment(agentId: string): void {
        const timer = this.pendingReassignments.get(agentId);
        if (timer) {
            clearTimeout(timer);
            this.pendingReassignments.delete(agentId);
        }
    }

    // =========================================================================
    // Agent State Management
    // =========================================================================

    /**
     * Get agent state
     */
    getAgentState(agentId: string): AgentState | null {
        return this.agentStates.get(agentId) ?? null;
    }

    /**
     * Check if agent is connected
     */
    isAgentConnected(agentId: string): boolean {
        const state = this.agentStates.get(agentId);
        return state?.isConnected ?? false;
    }

    /**
     * Get disconnection history for an agent
     */
    getDisconnectionHistory(agentId: string): DisconnectionEvent[] {
        return this.disconnectionHistory.get(agentId) ?? [];
    }

    /**
     * Mark agent as connected
     */
    markAgentConnected(agentId: string, orgId: string): void {
        const state = this.getOrCreateAgentState(agentId, orgId);
        state.isConnected = true;
        state.lastConnectedAt = new Date();
    }

    private getOrCreateAgentState(agentId: string, orgId: string): AgentState {
        let state = this.agentStates.get(agentId);
        if (!state) {
            state = {
                agentId,
                orgId,
                tasks: new Map(),
                lastConnectedAt: null,
                lastDisconnectedAt: null,
                disconnectionReason: null,
                isConnected: false,
            };
            this.agentStates.set(agentId, state);
        }
        return state;
    }

    // =========================================================================
    // Cleanup & Lifecycle
    // =========================================================================

    /**
     * Start state cleanup timer
     */
    startCleanup(): void {
        this.stopCleanup();

        this.cleanupTimer = setInterval(() => {
            this.cleanupStaleState();
        }, this.config.cleanupIntervalMs);
    }

    /**
     * Stop state cleanup timer
     */
    stopCleanup(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Cleanup stale state
     */
    cleanupStaleState(): number {
        const now = Date.now();
        let cleaned = 0;

        for (const [agentId, state] of this.agentStates) {
            // Skip connected agents
            if (state.isConnected) continue;

            // Check if state is stale
            const lastActivity = state.lastDisconnectedAt?.getTime() ?? 0;
            const elapsed = now - lastActivity;

            if (elapsed > this.config.stateRetentionMs) {
                // Remove tasks
                const taskIds = this.agentTasks.get(agentId);
                let tasksRemoved = 0;

                if (taskIds) {
                    for (const taskId of Array.from(taskIds)) {
                        const task = this.tasks.get(taskId);
                        // Only remove completed/failed/cancelled tasks
                        if (task && ['completed', 'failed', 'cancelled'].includes(task.status)) {
                            this.tasks.delete(taskId);
                            tasksRemoved++;
                        }
                    }
                    this.agentTasks.delete(agentId);
                }

                // Remove agent state if no active tasks
                const remainingTasks = this.getAgentTasks(agentId);
                if (remainingTasks.length === 0) {
                    this.agentStates.delete(agentId);
                    this.disconnectionHistory.delete(agentId);
                    cleaned++;
                }

                if (tasksRemoved > 0) {
                    this.emit('state:cleaned', agentId, tasksRemoved);
                }
            }
        }

        return cleaned;
    }

    private enforceTaskLimit(agentId: string): void {
        const taskIds = this.agentTasks.get(agentId);
        if (!taskIds || taskIds.size <= this.config.maxPreservedTasks) return;

        // Get tasks sorted by update time (oldest first)
        const tasks = Array.from(taskIds)
            .map(id => this.tasks.get(id))
            .filter((t): t is TaskInfo => t !== undefined)
            .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

        // Remove oldest completed/failed tasks
        const toRemove = tasks.length - this.config.maxPreservedTasks;
        let removed = 0;

        for (const task of tasks) {
            if (removed >= toRemove) break;

            if (['completed', 'failed', 'cancelled'].includes(task.status)) {
                this.removeTask(task.taskId);
                removed++;
            }
        }
    }

    /**
     * Shutdown handler
     */
    async shutdown(gracePeriodMs: number = 5000): Promise<void> {
        this.isShuttingDown = true;
        this.stopCleanup();

        // Cancel all pending reassignments
        for (const timer of this.pendingReassignments.values()) {
            clearTimeout(timer);
        }
        this.pendingReassignments.clear();

        // Wait for grace period
        await new Promise(resolve => setTimeout(resolve, gracePeriodMs));

        this.clear();
    }

    /**
     * Clear all state
     */
    clear(): void {
        this.agentStates.clear();
        this.tasks.clear();
        this.agentTasks.clear();
        this.disconnectionHistory.clear();

        for (const timer of this.pendingReassignments.values()) {
            clearTimeout(timer);
        }
        this.pendingReassignments.clear();

        this.isShuttingDown = false;
    }

    // =========================================================================
    // Statistics
    // =========================================================================

    /**
     * Get handler statistics
     */
    getStats(): {
        totalAgents: number;
        connectedAgents: number;
        disconnectedAgents: number;
        totalTasks: number;
        orphanedTasks: number;
        pendingReassignments: number;
    } {
        let connectedAgents = 0;
        let disconnectedAgents = 0;

        for (const state of this.agentStates.values()) {
            if (state.isConnected) {
                connectedAgents++;
            } else {
                disconnectedAgents++;
            }
        }

        return {
            totalAgents: this.agentStates.size,
            connectedAgents,
            disconnectedAgents,
            totalTasks: this.tasks.size,
            orphanedTasks: this.getOrphanedTasks().length,
            pendingReassignments: this.pendingReassignments.size,
        };
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let handlerInstance: DisconnectionHandler | null = null;

export function getDisconnectionHandler(config?: Partial<DisconnectionHandlerConfig>): DisconnectionHandler {
    if (!handlerInstance) {
        handlerInstance = new DisconnectionHandler(config);
    }
    return handlerInstance;
}

export function resetDisconnectionHandler(): void {
    if (handlerInstance) {
        handlerInstance.clear();
    }
    handlerInstance = null;
}
