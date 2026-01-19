/**
 * Blackboard Task Bridge
 *
 * Bridges the gap between T5-Planner's Blackboard posts and the
 * UnifiedWorkflowEngine's task execution system.
 *
 * Problem Solved: T5-Planner posts TASK entries to Blackboard, but these
 * are just "ideas" that never become executable tasks. This bridge:
 *   1. Monitors Blackboard for TASK type entries
 *   2. Converts them into WorkflowTask objects
 *   3. Maintains bidirectional links for output sync
 *
 * Architecture Integration:
 *   [T5-Planner] -> [Blackboard] -> [BlackboardTaskBridge] -> [UnifiedWorkflowAPI]
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import type { Blackboard } from '../core/Blackboard.js';
import type { BlackboardEntry, BlackboardEntryType, AgentId } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface BridgedTask {
    id: string;                          // Unique task ID in workflow system
    blackboardEntryId: string;           // Corresponding Blackboard entry ID
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    requiredTier: number;
    sourceAgentId: AgentId;              // Who posted the original Blackboard entry
    status: 'QUEUED' | 'PENDING_APPROVAL' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    createdAt: Date;
    syncedAt: Date;                      // When the bridge synced this task
    assignedTo?: string;
    result?: unknown;
}

export interface BridgeConfig {
    autoConvert: boolean;                // Auto-convert all TASK entries
    sourceFilter?: AgentId[];            // Only bridge tasks from these agents
    priorityMapping?: Record<string, BridgedTask['priority']>;  // Map Blackboard priority
    requiredTierDefault: number;         // Default tier if not specified
    enableBidirectionalSync: boolean;    // Sync completion back to Blackboard
}

interface BridgeEvents {
    'task:bridged': (task: BridgedTask, entry: BlackboardEntry) => void;
    'task:assigned': (task: BridgedTask, agentId: AgentId) => void;
    'task:completed': (task: BridgedTask, result: unknown) => void;
    'task:failed': (task: BridgedTask, error: string) => void;
    'sync:error': (taskId: string, error: Error) => void;
}

// ============================================================================
// Blackboard Task Bridge
// ============================================================================

export class BlackboardTaskBridge extends EventEmitter<BridgeEvents> {
    private blackboard: Blackboard;
    private bridgedTasks: Map<string, BridgedTask> = new Map();
    private entryToTask: Map<string, string> = new Map();  // blackboardEntryId -> taskId
    private config: BridgeConfig;

    // Callback for creating tasks in the workflow system
    private createTaskCallback?: (task: {
        title: string;
        description: string;
        priority: BridgedTask['priority'];
        requiredTier: number;
    }) => { id: string; blackboardEntryId?: string };

    constructor(blackboard: Blackboard, config?: Partial<BridgeConfig>) {
        super();
        this.blackboard = blackboard;
        this.config = {
            autoConvert: true,
            requiredTierDefault: 2,
            enableBidirectionalSync: true,
            priorityMapping: {
                'LOW': 'LOW',
                'MEDIUM': 'MEDIUM',
                'HIGH': 'HIGH',
                'CRITICAL': 'CRITICAL',
            },
            ...config,
        };

        // Subscribe to Blackboard events
        this.setupBlackboardListeners();
    }

    /**
     * Register the callback function for creating tasks in the workflow system.
     * This decouples the bridge from UnifiedWorkflowAPI.
     */
    registerTaskCreator(callback: typeof this.createTaskCallback): void {
        this.createTaskCallback = callback;
    }

    /**
     * Set up listeners for Blackboard events
     */
    private setupBlackboardListeners(): void {
        // Listen for new entries
        this.blackboard.on('entry:posted', (entry) => {
            if (this.shouldBridge(entry)) {
                this.bridgeEntry(entry);
            }
        });

        // Listen for entry resolutions (for reverse sync if task completes externally)
        this.blackboard.on('entry:resolved', (entry) => {
            const taskId = this.entryToTask.get(entry.id);
            if (taskId) {
                const task = this.bridgedTasks.get(taskId);
                if (task && task.status !== 'COMPLETED') {
                    // Blackboard was resolved externally - sync to task
                    task.status = 'COMPLETED';
                    task.result = entry.resolution;
                    this.emit('task:completed', task, entry.resolution);
                }
            }
        });
    }

    /**
     * Determine if a Blackboard entry should be bridged to a task
     */
    private shouldBridge(entry: BlackboardEntry): boolean {
        // Only bridge TASK type entries
        if (entry.type !== 'TASK') {
            return false;
        }

        // Check source filter if configured
        if (this.config.sourceFilter && this.config.sourceFilter.length > 0) {
            if (!this.config.sourceFilter.includes(entry.author)) {
                return false;
            }
        }

        // Don't re-bridge already bridged entries
        if (this.entryToTask.has(entry.id)) {
            return false;
        }

        // Check if auto-convert is enabled
        if (!this.config.autoConvert) {
            return false;
        }

        return true;
    }

    /**
     * Bridge a Blackboard entry to a workflow task
     */
    bridgeEntry(entry: BlackboardEntry): BridgedTask | null {
        // Extract task details from entry content
        const content = entry.content as Record<string, unknown>;

        const description = this.extractDescription(entry, content);
        const requiredTier = this.extractRequiredTier(content);
        const priority = this.mapPriority(entry.priority || 'MEDIUM');

        // Create bridged task
        const taskId = uuidv4();
        const bridgedTask: BridgedTask = {
            id: taskId,
            blackboardEntryId: entry.id,
            title: entry.title,
            description,
            priority,
            requiredTier,
            sourceAgentId: entry.author,
            status: 'QUEUED',
            createdAt: new Date(),
            syncedAt: new Date(),
        };

        // Store the mapping
        this.bridgedTasks.set(taskId, bridgedTask);
        this.entryToTask.set(entry.id, taskId);

        // Create the task in the workflow system if callback registered
        if (this.createTaskCallback) {
            try {
                const createdTask = this.createTaskCallback({
                    title: bridgedTask.title,
                    description: bridgedTask.description,
                    priority: bridgedTask.priority,
                    requiredTier: bridgedTask.requiredTier,
                });
                // Update our record with the workflow system's ID
                bridgedTask.id = createdTask.id;
                this.bridgedTasks.delete(taskId);
                this.bridgedTasks.set(createdTask.id, bridgedTask);
                this.entryToTask.set(entry.id, createdTask.id);
            } catch (error) {
                this.emit('sync:error', taskId, error as Error);
            }
        }

        this.emit('task:bridged', bridgedTask, entry);
        return bridgedTask;
    }

    /**
     * Manually bridge a specific Blackboard entry by ID
     */
    bridgeEntryById(entryId: string): BridgedTask | null {
        // Check if already bridged
        if (this.entryToTask.has(entryId)) {
            return null;
        }

        const entries = this.blackboard.getByType('TASK');
        const entry = entries.find(e => e.id === entryId);

        if (!entry) {
            return null;
        }

        return this.bridgeEntry(entry);
    }

    /**
     * Bridge all existing TASK entries that haven't been bridged yet
     */
    bridgeAllPending(): BridgedTask[] {
        const taskEntries = this.blackboard.getByType('TASK');
        const bridged: BridgedTask[] = [];

        for (const entry of taskEntries) {
            if (!this.entryToTask.has(entry.id) && entry.status === 'OPEN') {
                const task = this.bridgeEntry(entry);
                if (task) {
                    bridged.push(task);
                }
            }
        }

        return bridged;
    }

    /**
     * Mark a bridged task as assigned
     */
    assignTask(taskId: string, agentId: AgentId): void {
        const task = this.bridgedTasks.get(taskId);
        if (!task) return;

        task.assignedTo = agentId;
        task.status = 'IN_PROGRESS';
        this.emit('task:assigned', task, agentId);
    }

    /**
     * Mark a bridged task as completed and sync back to Blackboard
     */
    completeTask(taskId: string, result: unknown): void {
        const task = this.bridgedTasks.get(taskId);
        if (!task) return;

        task.status = 'COMPLETED';
        task.result = result;

        // Sync back to Blackboard if enabled
        if (this.config.enableBidirectionalSync) {
            this.syncCompletionToBlackboard(task, result);
        }

        this.emit('task:completed', task, result);
    }

    /**
     * Mark a bridged task as failed and sync back to Blackboard
     */
    failTask(taskId: string, error: string): void {
        const task = this.bridgedTasks.get(taskId);
        if (!task) return;

        task.status = 'FAILED';
        task.result = { error };

        // Sync back to Blackboard if enabled
        if (this.config.enableBidirectionalSync) {
            this.syncFailureToBlackboard(task, error);
        }

        this.emit('task:failed', task, error);
    }

    /**
     * Sync task completion back to the Blackboard entry
     */
    private syncCompletionToBlackboard(task: BridgedTask, result: unknown): void {
        try {
            // Update content with result
            this.blackboard.updateContent(task.blackboardEntryId, {
                taskId: task.id,
                originalContent: this.blackboard.get(task.blackboardEntryId)?.content,
                result,
                completedAt: new Date().toISOString(),
                completedBy: task.assignedTo,
            });

            // Resolve the entry
            this.blackboard.resolve(task.blackboardEntryId, {
                resolution: `Task completed successfully`,
                resolvedBy: task.assignedTo || 'WORKFLOW_ENGINE',
            });
        } catch (error) {
            this.emit('sync:error', task.id, error as Error);
        }
    }

    /**
     * Sync task failure back to the Blackboard entry
     */
    private syncFailureToBlackboard(task: BridgedTask, error: string): void {
        try {
            // Add contribution with error
            this.blackboard.contribute(task.blackboardEntryId, {
                agentId: task.assignedTo || 'WORKFLOW_ENGINE',
                content: `Task failed: ${error}`,
                confidence: 0,
            });
        } catch (err) {
            this.emit('sync:error', task.id, err as Error);
        }
    }

    /**
     * Extract description from entry content
     */
    private extractDescription(entry: BlackboardEntry, content: Record<string, unknown>): string {
        if (typeof content.description === 'string') {
            return content.description;
        }
        if (typeof content.objective === 'object' && content.objective) {
            const obj = content.objective as Record<string, unknown>;
            if (typeof obj.description === 'string') {
                return obj.description;
            }
            if (typeof obj.title === 'string') {
                return obj.title;
            }
        }
        if (Array.isArray(content.tasks)) {
            return `Execute: ${content.tasks.join(', ')}`;
        }
        return entry.title;
    }

    /**
     * Extract required tier from content
     */
    private extractRequiredTier(content: Record<string, unknown>): number {
        if (typeof content.requiredTier === 'number') {
            return content.requiredTier;
        }
        if (typeof content.minTier === 'number') {
            return content.minTier;
        }
        if (typeof content.objective === 'object' && content.objective) {
            const obj = content.objective as Record<string, unknown>;
            if (typeof obj.requiredTier === 'number') {
                return obj.requiredTier;
            }
        }
        return this.config.requiredTierDefault;
    }

    /**
     * Map Blackboard priority to task priority
     */
    private mapPriority(priority: string): BridgedTask['priority'] {
        return this.config.priorityMapping?.[priority] || 'MEDIUM';
    }

    // =========================================================================
    // Query Methods
    // =========================================================================

    /**
     * Get a bridged task by its ID
     */
    getTask(taskId: string): BridgedTask | null {
        return this.bridgedTasks.get(taskId) || null;
    }

    /**
     * Get a bridged task by its Blackboard entry ID
     */
    getTaskByEntryId(entryId: string): BridgedTask | null {
        const taskId = this.entryToTask.get(entryId);
        if (!taskId) return null;
        return this.bridgedTasks.get(taskId) || null;
    }

    /**
     * Get all bridged tasks
     */
    getAllTasks(): BridgedTask[] {
        return Array.from(this.bridgedTasks.values());
    }

    /**
     * Get bridged tasks by status
     */
    getTasksByStatus(status: BridgedTask['status']): BridgedTask[] {
        return this.getAllTasks().filter(t => t.status === status);
    }

    /**
     * Get bridge statistics
     */
    getStats(): {
        total: number;
        byStatus: Record<string, number>;
        queuedCount: number;
        inProgressCount: number;
        completedCount: number;
        failedCount: number;
    } {
        const tasks = this.getAllTasks();
        const byStatus: Record<string, number> = {};

        for (const task of tasks) {
            byStatus[task.status] = (byStatus[task.status] || 0) + 1;
        }

        return {
            total: tasks.length,
            byStatus,
            queuedCount: byStatus['QUEUED'] || 0,
            inProgressCount: byStatus['IN_PROGRESS'] || 0,
            completedCount: byStatus['COMPLETED'] || 0,
            failedCount: byStatus['FAILED'] || 0,
        };
    }

    /**
     * Clear all bridged tasks (for testing)
     */
    clear(): void {
        this.bridgedTasks.clear();
        this.entryToTask.clear();
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let bridgeInstance: BlackboardTaskBridge | null = null;

/**
 * Get or create the BlackboardTaskBridge singleton
 */
export function getBlackboardTaskBridge(
    blackboard?: Blackboard,
    config?: Partial<BridgeConfig>
): BlackboardTaskBridge {
    if (!bridgeInstance) {
        if (!blackboard) {
            throw new Error('Blackboard required for initial bridge creation');
        }
        bridgeInstance = new BlackboardTaskBridge(blackboard, config);
    }
    return bridgeInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetBlackboardTaskBridge(): void {
    bridgeInstance = null;
}
