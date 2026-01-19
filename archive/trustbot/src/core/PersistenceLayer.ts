/**
 * Persistence Layer
 *
 * File-based persistence for Aurais system state. Supports:
 * - Trust scores and policies
 * - Blackboard entries
 * - Workflow tasks
 * - Audit logs
 * - System configuration
 *
 * Uses JSON files for portability - can be swapped for Redis/KV in production.
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'eventemitter3';
import type { TrustScore, TrustPolicy, AgentId } from '../types.js';
import type { BlackboardEntry } from '../types.js';
import type { AuditEntry } from './SecurityLayer.js';
import type { WorkflowTask, AggressivenessConfig } from '../api/UnifiedWorkflowAPI.js';

// ============================================================================
// Types
// ============================================================================

export interface PersistedState {
    version: string;
    savedAt: string;

    // Trust system
    trustScores: Array<[AgentId, TrustScore]>;
    trustPolicies: Array<[AgentId, TrustPolicy]>;
    hitlLevel: number;

    // Workflow
    tasks: WorkflowTask[];
    aggressiveness: AggressivenessConfig;

    // Blackboard
    blackboardEntries: BlackboardEntry[];

    // Audit (recent only - full log archived separately)
    recentAuditEntries: AuditEntry[];

    // Metrics
    metrics: {
        totalTasksCompleted: number;
        totalTasksFailed: number;
        totalTrustRewards: number;
        totalTrustPenalties: number;
        systemStartTime: string;
        lastActiveTime: string;
    };
}

export interface PersistenceConfig {
    dataDir: string;
    autoSaveIntervalMs: number;
    maxAuditEntriesInMemory: number;
}

interface PersistenceEvents {
    'saved': (filepath: string) => void;
    'loaded': (filepath: string) => void;
    'error': (error: Error) => void;
    'auto-save': () => void;
}

// ============================================================================
// Persistence Layer
// ============================================================================

export class PersistenceLayer extends EventEmitter<PersistenceEvents> {
    private config: PersistenceConfig;
    private autoSaveTimer: NodeJS.Timeout | null = null;
    private dirty: boolean = false;

    // In-memory state
    private state: PersistedState;

    constructor(config?: Partial<PersistenceConfig>) {
        super();

        this.config = {
            // Use DATA_DIR env var (for Fly.io volumes), then fallback to cwd
            dataDir: config?.dataDir ?? process.env.DATA_DIR ?? path.join(process.cwd(), 'aurais-data'),
            autoSaveIntervalMs: config?.autoSaveIntervalMs ?? 30000, // 30 seconds
            maxAuditEntriesInMemory: config?.maxAuditEntriesInMemory ?? 1000,
        };

        // Initialize default state
        this.state = this.createDefaultState();

        // Ensure data directory exists
        this.ensureDataDir();
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    /**
     * Start auto-save timer
     */
    startAutoSave(): void {
        if (this.autoSaveTimer) return;

        this.autoSaveTimer = setInterval(() => {
            if (this.dirty) {
                this.save();
                this.emit('auto-save');
            }
        }, this.config.autoSaveIntervalMs);
    }

    /**
     * Stop auto-save timer
     */
    stopAutoSave(): void {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * Mark state as modified (triggers auto-save)
     */
    markDirty(): void {
        this.dirty = true;
    }

    // -------------------------------------------------------------------------
    // Save/Load Operations
    // -------------------------------------------------------------------------

    /**
     * Save current state to disk
     */
    save(filename: string = 'state.json'): void {
        try {
            const filepath = path.join(this.config.dataDir, filename);
            this.state.savedAt = new Date().toISOString();
            this.state.metrics.lastActiveTime = new Date().toISOString();

            fs.writeFileSync(filepath, JSON.stringify(this.state, null, 2));
            this.dirty = false;
            this.emit('saved', filepath);
        } catch (error) {
            this.emit('error', error as Error);
        }
    }

    /**
     * Load state from disk
     */
    load(filename: string = 'state.json'): boolean {
        try {
            const filepath = path.join(this.config.dataDir, filename);

            if (!fs.existsSync(filepath)) {
                return false;
            }

            const data = fs.readFileSync(filepath, 'utf-8');
            const loaded = JSON.parse(data) as PersistedState;

            // Hydrate dates
            this.hydrateState(loaded);
            this.state = loaded;

            this.emit('loaded', filepath);
            return true;
        } catch (error) {
            this.emit('error', error as Error);
            return false;
        }
    }

    /**
     * Export state for backup
     */
    export(): PersistedState {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Import state from backup
     */
    import(state: PersistedState): void {
        this.hydrateState(state);
        this.state = state;
        this.markDirty();
    }

    // -------------------------------------------------------------------------
    // Trust System
    // -------------------------------------------------------------------------

    setTrustScores(scores: Array<[AgentId, TrustScore]>): void {
        this.state.trustScores = scores;
        this.markDirty();
    }

    getTrustScores(): Array<[AgentId, TrustScore]> {
        return this.state.trustScores;
    }

    setTrustPolicies(policies: Array<[AgentId, TrustPolicy]>): void {
        this.state.trustPolicies = policies;
        this.markDirty();
    }

    getTrustPolicies(): Array<[AgentId, TrustPolicy]> {
        return this.state.trustPolicies;
    }

    setHITLLevel(level: number): void {
        this.state.hitlLevel = level;
        this.markDirty();
    }

    getHITLLevel(): number {
        return this.state.hitlLevel;
    }

    // -------------------------------------------------------------------------
    // Workflow Tasks
    // -------------------------------------------------------------------------

    setTasks(tasks: WorkflowTask[]): void {
        this.state.tasks = tasks;
        this.markDirty();
    }

    getTasks(): WorkflowTask[] {
        return this.state.tasks;
    }

    addTask(task: WorkflowTask): void {
        this.state.tasks.push(task);
        this.markDirty();
    }

    updateTask(taskId: string, updates: Partial<WorkflowTask>): void {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (task) {
            Object.assign(task, updates);
            this.markDirty();
        }
    }

    setAggressiveness(config: AggressivenessConfig): void {
        this.state.aggressiveness = config;
        this.markDirty();
    }

    getAggressiveness(): AggressivenessConfig {
        return this.state.aggressiveness;
    }

    // -------------------------------------------------------------------------
    // Blackboard
    // -------------------------------------------------------------------------

    setBlackboardEntries(entries: BlackboardEntry[]): void {
        this.state.blackboardEntries = entries;
        this.markDirty();
    }

    getBlackboardEntries(): BlackboardEntry[] {
        return this.state.blackboardEntries;
    }

    addBlackboardEntry(entry: BlackboardEntry): void {
        this.state.blackboardEntries.push(entry);
        this.markDirty();
    }

    // -------------------------------------------------------------------------
    // Audit Log
    // -------------------------------------------------------------------------

    addAuditEntries(entries: AuditEntry[]): void {
        this.state.recentAuditEntries.push(...entries);

        // Trim if exceeds max
        if (this.state.recentAuditEntries.length > this.config.maxAuditEntriesInMemory) {
            // Archive old entries
            this.archiveAuditEntries();
        }

        this.markDirty();
    }

    getRecentAuditEntries(): AuditEntry[] {
        return this.state.recentAuditEntries;
    }

    private archiveAuditEntries(): void {
        const toArchive = this.state.recentAuditEntries.slice(
            0,
            this.state.recentAuditEntries.length - this.config.maxAuditEntriesInMemory / 2
        );

        // Write to archive file
        const archivePath = path.join(
            this.config.dataDir,
            `audit-archive-${Date.now()}.json`
        );
        fs.writeFileSync(archivePath, JSON.stringify(toArchive, null, 2));

        // Keep recent half
        this.state.recentAuditEntries = this.state.recentAuditEntries.slice(
            -this.config.maxAuditEntriesInMemory / 2
        );
    }

    // -------------------------------------------------------------------------
    // Metrics
    // -------------------------------------------------------------------------

    incrementMetric(
        metric: 'totalTasksCompleted' | 'totalTasksFailed' | 'totalTrustRewards' | 'totalTrustPenalties',
        amount: number = 1
    ): void {
        this.state.metrics[metric] += amount;
        this.markDirty();
    }

    getMetrics(): PersistedState['metrics'] {
        return { ...this.state.metrics };
    }

    // -------------------------------------------------------------------------
    // Completed Today
    // -------------------------------------------------------------------------

    getCompletedToday(): WorkflowTask[] {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return this.state.tasks.filter(t => {
            if (t.status !== 'COMPLETED' && t.status !== 'FAILED') return false;
            if (!t.completedAt) return false;
            const completedDate = new Date(t.completedAt);
            return completedDate >= today;
        });
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private ensureDataDir(): void {
        if (!fs.existsSync(this.config.dataDir)) {
            fs.mkdirSync(this.config.dataDir, { recursive: true });
        }
    }

    private createDefaultState(): PersistedState {
        return {
            version: '1.0.0',
            savedAt: new Date().toISOString(),
            trustScores: [],
            trustPolicies: [],
            hitlLevel: 100,
            tasks: [],
            aggressiveness: {
                level: 0,
                autoApproveUpToTier: 1,
                maxDelegationDepth: 3,
                trustRewardMultiplier: 1.0,
                trustPenaltyMultiplier: 1.0,
            },
            blackboardEntries: [],
            recentAuditEntries: [],
            metrics: {
                totalTasksCompleted: 0,
                totalTasksFailed: 0,
                totalTrustRewards: 0,
                totalTrustPenalties: 0,
                systemStartTime: new Date().toISOString(),
                lastActiveTime: new Date().toISOString(),
            },
        };
    }

    private hydrateState(state: PersistedState): void {
        // Hydrate dates in trust scores
        state.trustScores.forEach(([_, score]) => {
            score.lastVerified = new Date(score.lastVerified);
        });

        // Hydrate dates in tasks
        state.tasks.forEach(task => {
            task.createdAt = new Date(task.createdAt);
            if (task.startedAt) task.startedAt = new Date(task.startedAt);
            if (task.completedAt) task.completedAt = new Date(task.completedAt);
        });

        // Hydrate dates in blackboard entries
        state.blackboardEntries.forEach(entry => {
            entry.createdAt = new Date(entry.createdAt);
            entry.updatedAt = new Date(entry.updatedAt);
            if (entry.resolvedAt) entry.resolvedAt = new Date(entry.resolvedAt);
        });

        // Hydrate dates in audit entries
        state.recentAuditEntries.forEach(entry => {
            entry.timestamp = new Date(entry.timestamp);
        });
    }

    /**
     * Get data directory path
     */
    getDataDir(): string {
        return this.config.dataDir;
    }

    /**
     * List all state files
     */
    listStateFiles(): string[] {
        return fs.readdirSync(this.config.dataDir)
            .filter(f => f.endsWith('.json'))
            .map(f => path.join(this.config.dataDir, f));
    }

    /**
     * Delete a state file
     */
    deleteStateFile(filename: string): boolean {
        try {
            const filepath = path.join(this.config.dataDir, filename);
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

// Singleton with default config
export const persistenceLayer = new PersistenceLayer();
