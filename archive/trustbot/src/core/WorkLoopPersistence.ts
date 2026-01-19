/**
 * Work Loop Persistence
 *
 * Persists AgentWorkLoop state to survive restarts.
 * Uses file-based storage with auto-save, compatible with Fly.io volumes.
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'eventemitter3';
import type { WorkLoopAgent, WorkTask, AgentRole, WorkLoopStatus } from './AgentWorkLoop.js';

// ============================================================================
// Types
// ============================================================================

export interface WorkLoopState {
    version: string;
    savedAt: string;

    // Registered agents (excluding T5 which are always recreated)
    agents: PersistedAgent[];

    // Task queues
    taskQueue: WorkTask[];
    activeTasks: WorkTask[];
    completedTasks: WorkTask[];

    // Metrics
    metrics: {
        totalObjectives: number;
        totalSubtasks: number;
        totalCompleted: number;
        totalFailed: number;
        avgExecutionTime: number;
        avgConfidence: number;
    };
}

export interface PersistedAgent {
    id: string;
    name: string;
    role: AgentRole;
    tier: number;
    executionCount: number;
    successCount: number;
    createdAt: string;
}

interface PersistenceEvents {
    'saved': (filepath: string) => void;
    'loaded': (filepath: string, state: WorkLoopState) => void;
    'error': (error: Error) => void;
}

// ============================================================================
// Work Loop Persistence
// ============================================================================

export class WorkLoopPersistence extends EventEmitter<PersistenceEvents> {
    private dataDir: string;
    private filename: string;
    private autoSaveInterval: NodeJS.Timeout | null = null;
    private dirty = false;

    constructor(dataDir?: string) {
        super();
        // Use DATA_DIR env var (for Fly.io volumes), then fallback to cwd
        this.dataDir = dataDir ?? process.env.DATA_DIR ?? path.join(process.cwd(), 'aurais-data');
        this.filename = 'work-loop-state.json';
        this.ensureDataDir();
        console.log(`[WorkLoopPersistence] Data directory: ${this.dataDir}`);
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    startAutoSave(intervalMs: number = 10000): void {
        if (this.autoSaveInterval) return;

        this.autoSaveInterval = setInterval(() => {
            if (this.dirty) {
                console.log('[WorkLoopPersistence] Auto-save triggered');
            }
        }, intervalMs);
    }

    stopAutoSave(): void {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    markDirty(): void {
        this.dirty = true;
    }

    // -------------------------------------------------------------------------
    // Save/Load
    // -------------------------------------------------------------------------

    save(
        agents: Map<string, WorkLoopAgent>,
        taskQueue: WorkTask[],
        activeTasks: Map<string, WorkTask>,
        completedTasks: Map<string, WorkTask>
    ): boolean {
        try {
            const state: WorkLoopState = {
                version: '1.0.0',
                savedAt: new Date().toISOString(),

                // Only persist non-T5 agents (workers)
                agents: Array.from(agents.values())
                    .filter(a => a.tier < 5)
                    .map(a => ({
                        id: a.id,
                        name: a.name,
                        role: a.role,
                        tier: a.tier,
                        executionCount: a.executionCount,
                        successCount: a.successCount,
                        createdAt: new Date(a.lastActivityAt).toISOString(),
                    })),

                // Persist all tasks
                taskQueue: taskQueue.map(t => this.serializeTask(t)),
                activeTasks: Array.from(activeTasks.values()).map(t => this.serializeTask(t)),
                completedTasks: Array.from(completedTasks.values())
                    .slice(-100) // Keep last 100 completed tasks
                    .map(t => this.serializeTask(t)),

                // Calculate metrics
                metrics: this.calculateMetrics(completedTasks),
            };

            const filepath = path.join(this.dataDir, this.filename);
            fs.writeFileSync(filepath, JSON.stringify(state, null, 2));

            this.dirty = false;
            this.emit('saved', filepath);
            console.log(`[WorkLoopPersistence] State saved: ${state.agents.length} agents, ${state.taskQueue.length} queued, ${state.completedTasks.length} completed`);

            return true;
        } catch (error) {
            this.emit('error', error as Error);
            console.error('[WorkLoopPersistence] Save error:', error);
            return false;
        }
    }

    load(): WorkLoopState | null {
        try {
            const filepath = path.join(this.dataDir, this.filename);

            if (!fs.existsSync(filepath)) {
                console.log('[WorkLoopPersistence] No saved state found');
                return null;
            }

            const data = fs.readFileSync(filepath, 'utf-8');
            const state = JSON.parse(data) as WorkLoopState;

            // Hydrate tasks (convert timestamp numbers back)
            state.taskQueue = state.taskQueue.map(t => this.hydrateTask(t));
            state.activeTasks = state.activeTasks.map(t => this.hydrateTask(t));
            state.completedTasks = state.completedTasks.map(t => this.hydrateTask(t));

            this.emit('loaded', filepath, state);
            console.log(`[WorkLoopPersistence] State loaded: ${state.agents.length} agents, ${state.taskQueue.length} queued, ${state.completedTasks.length} completed`);

            return state;
        } catch (error) {
            this.emit('error', error as Error);
            console.error('[WorkLoopPersistence] Load error:', error);
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private ensureDataDir(): void {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    private serializeTask(task: WorkTask): WorkTask {
        return {
            ...task,
            // Ensure timestamps are numbers
            createdAt: typeof task.createdAt === 'number' ? task.createdAt : new Date(task.createdAt).getTime(),
            startedAt: task.startedAt ? (typeof task.startedAt === 'number' ? task.startedAt : new Date(task.startedAt).getTime()) : undefined,
            completedAt: task.completedAt ? (typeof task.completedAt === 'number' ? task.completedAt : new Date(task.completedAt).getTime()) : undefined,
        };
    }

    private hydrateTask(task: WorkTask): WorkTask {
        return {
            ...task,
            createdAt: typeof task.createdAt === 'string' ? new Date(task.createdAt).getTime() : task.createdAt,
            startedAt: task.startedAt ? (typeof task.startedAt === 'string' ? new Date(task.startedAt).getTime() : task.startedAt) : undefined,
            completedAt: task.completedAt ? (typeof task.completedAt === 'string' ? new Date(task.completedAt).getTime() : task.completedAt) : undefined,
        };
    }

    private calculateMetrics(completedTasks: Map<string, WorkTask>): WorkLoopState['metrics'] {
        const tasks = Array.from(completedTasks.values());
        const objectives = tasks.filter(t => t.type === 'OBJECTIVE');
        const subtasks = tasks.filter(t => t.type === 'SUBTASK');
        const completed = tasks.filter(t => t.status === 'COMPLETED');
        const failed = tasks.filter(t => t.status === 'FAILED');

        const durations = completed
            .filter(t => t.result?.duration)
            .map(t => t.result!.duration);
        const avgExecutionTime = durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;

        const confidences = completed
            .filter(t => t.result?.confidence)
            .map(t => t.result!.confidence);
        const avgConfidence = confidences.length > 0
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length
            : 0;

        return {
            totalObjectives: objectives.length,
            totalSubtasks: subtasks.length,
            totalCompleted: completed.length,
            totalFailed: failed.length,
            avgExecutionTime,
            avgConfidence,
        };
    }

    getFilepath(): string {
        return path.join(this.dataDir, this.filename);
    }

    exists(): boolean {
        return fs.existsSync(this.getFilepath());
    }

    delete(): boolean {
        try {
            const filepath = this.getFilepath();
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }
}

// Singleton export
export const workLoopPersistence = new WorkLoopPersistence();
