/**
 * Decision Execution Tracker
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.5: Decision Execution Tracker
 *
 * Tracks the execution of approved decisions and their outcomes.
 */

import { EventEmitter } from 'eventemitter3';
import type { ActionRequest } from './TrustGateEngine.js';

// ============================================================================
// Types
// ============================================================================

export type ExecutionStatus = 'queued' | 'executing' | 'completed' | 'failed' | 'cancelled' | 'timeout';

/**
 * Source of execution approval.
 * - auto_approval: Low-risk actions auto-approved by system
 * - tribunal: Medium-high risk approved by multi-agent tribunal vote
 * - council: Critical governance decisions approved by T4+ council
 * - hitl: Human-in-the-loop approval by operator/supervisor
 */
export type ApprovalSource = 'auto_approval' | 'tribunal' | 'council' | 'hitl';

export interface ExecutionRecord {
    id: string;
    requestId: string;
    request: ActionRequest;
    approvalSource: ApprovalSource;
    approvalId?: string;
    status: ExecutionStatus;
    progress: number; // 0-100
    startedAt?: Date;
    completedAt?: Date;
    duration?: number; // ms
    result?: unknown;
    error?: string;
    retryCount: number;
    maxRetries: number;
    queuedAt: Date;
    metadata?: Record<string, unknown>;
}

export interface ExecutionProgress {
    recordId: string;
    status: ExecutionStatus;
    progress: number;
    message?: string;
    timestamp: Date;
}

export interface ExecutionConfig {
    /** Maximum retries before failure (default: 3) */
    maxRetries: number;
    /** Execution timeout in ms (default: 5 minutes) */
    executionTimeoutMs: number;
    /** Queue timeout in ms before auto-cancel (default: 30 minutes) */
    queueTimeoutMs: number;
    /** Maximum concurrent executions (default: 10) */
    maxConcurrent: number;
    /** Track detailed progress (default: true) */
    trackProgress: boolean;
}

interface TrackerEvents {
    'execution:queued': (record: ExecutionRecord) => void;
    'execution:started': (record: ExecutionRecord) => void;
    'execution:progress': (record: ExecutionRecord, progress: ExecutionProgress) => void;
    'execution:completed': (record: ExecutionRecord) => void;
    'execution:failed': (record: ExecutionRecord) => void;
    'execution:cancelled': (record: ExecutionRecord) => void;
    'execution:timeout': (record: ExecutionRecord) => void;
    'execution:retry': (record: ExecutionRecord) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: ExecutionConfig = {
    maxRetries: 3,
    executionTimeoutMs: 5 * 60 * 1000,
    queueTimeoutMs: 30 * 60 * 1000,
    maxConcurrent: 10,
    trackProgress: true,
};

// ============================================================================
// Execution Tracker
// ============================================================================

export class ExecutionTracker extends EventEmitter<TrackerEvents> {
    private config: ExecutionConfig;

    // Execution records
    private records: Map<string, ExecutionRecord> = new Map();
    private recordsByRequest: Map<string, string> = new Map();
    private recordsByAgent: Map<string, string[]> = new Map();
    private recordsByOrg: Map<string, string[]> = new Map();

    // Progress history
    private progressHistory: Map<string, ExecutionProgress[]> = new Map();

    // Execution queue
    private executionQueue: string[] = [];
    private executingCount = 0;

    // Timeouts
    private executionTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private queueTimeouts: Map<string, NodeJS.Timeout> = new Map();

    constructor(config: Partial<ExecutionConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // =========================================================================
    // Queue Management
    // =========================================================================

    /**
     * Queue an approved action for execution
     */
    queueExecution(
        request: ActionRequest,
        approvalSource: ApprovalSource,
        approvalId?: string
    ): ExecutionRecord {
        const record: ExecutionRecord = {
            id: this.generateRecordId(),
            requestId: request.id,
            request,
            approvalSource,
            approvalId,
            status: 'queued',
            progress: 0,
            retryCount: 0,
            maxRetries: this.config.maxRetries,
            queuedAt: new Date(),
        };

        this.storeRecord(record);
        this.executionQueue.push(record.id);

        // Set queue timeout
        this.setQueueTimeout(record);

        this.emit('execution:queued', record);

        // Try to start execution if under limit
        this.processQueue();

        return record;
    }

    /**
     * Start executing a queued record
     */
    startExecution(recordId: string): boolean {
        const record = this.records.get(recordId);
        if (!record) return false;

        if (record.status !== 'queued') {
            return false;
        }

        record.status = 'executing';
        record.startedAt = new Date();
        record.progress = 0;
        this.executingCount++;

        // Clear queue timeout
        this.clearQueueTimeout(recordId);

        // Set execution timeout
        this.setExecutionTimeout(record);

        this.emit('execution:started', record);
        this.recordProgress(record, 'Execution started');

        return true;
    }

    /**
     * Update execution progress
     */
    updateProgress(recordId: string, progress: number, message?: string): boolean {
        const record = this.records.get(recordId);
        if (!record) return false;

        if (record.status !== 'executing') {
            return false;
        }

        record.progress = Math.max(0, Math.min(100, progress));
        this.recordProgress(record, message);

        return true;
    }

    /**
     * Complete an execution successfully
     */
    completeExecution(recordId: string, result?: unknown): boolean {
        const record = this.records.get(recordId);
        if (!record) return false;

        if (record.status !== 'executing') {
            return false;
        }

        record.status = 'completed';
        record.completedAt = new Date();
        record.progress = 100;
        record.result = result;

        if (record.startedAt) {
            record.duration = record.completedAt.getTime() - record.startedAt.getTime();
        }

        this.executingCount--;
        this.clearExecutionTimeout(recordId);

        this.emit('execution:completed', record);
        this.recordProgress(record, 'Execution completed successfully');

        // Process next in queue
        this.processQueue();

        return true;
    }

    /**
     * Mark execution as failed
     */
    failExecution(recordId: string, error: string): boolean {
        const record = this.records.get(recordId);
        if (!record) return false;

        if (record.status !== 'executing') {
            return false;
        }

        record.error = error;
        record.retryCount++;

        // Check if should retry
        if (record.retryCount < record.maxRetries) {
            // Re-queue for retry
            record.status = 'queued';
            record.progress = 0;
            this.executingCount--;
            this.clearExecutionTimeout(recordId);
            this.executionQueue.push(record.id);

            this.emit('execution:retry', record);
            this.recordProgress(record, `Retrying (attempt ${record.retryCount + 1}/${record.maxRetries})`);

            this.processQueue();
            return true;
        }

        // No more retries - mark as failed
        record.status = 'failed';
        record.completedAt = new Date();

        if (record.startedAt) {
            record.duration = record.completedAt.getTime() - record.startedAt.getTime();
        }

        this.executingCount--;
        this.clearExecutionTimeout(recordId);

        this.emit('execution:failed', record);
        this.recordProgress(record, `Execution failed: ${error}`);

        // Process next in queue
        this.processQueue();

        return true;
    }

    /**
     * Cancel a queued or executing record
     */
    cancelExecution(recordId: string, reason?: string): boolean {
        const record = this.records.get(recordId);
        if (!record) return false;

        if (record.status === 'completed' || record.status === 'failed' || record.status === 'cancelled') {
            return false;
        }

        const wasExecuting = record.status === 'executing';

        record.status = 'cancelled';
        record.completedAt = new Date();
        record.error = reason || 'Cancelled by user';

        if (record.startedAt) {
            record.duration = record.completedAt.getTime() - record.startedAt.getTime();
        }

        // Remove from queue if queued
        const queueIndex = this.executionQueue.indexOf(recordId);
        if (queueIndex >= 0) {
            this.executionQueue.splice(queueIndex, 1);
        }

        if (wasExecuting) {
            this.executingCount--;
        }

        this.clearExecutionTimeout(recordId);
        this.clearQueueTimeout(recordId);

        this.emit('execution:cancelled', record);
        this.recordProgress(record, `Cancelled: ${record.error}`);

        // Process next in queue
        if (wasExecuting) {
            this.processQueue();
        }

        return true;
    }

    // =========================================================================
    // Record Retrieval
    // =========================================================================

    /**
     * Get execution record by ID
     */
    getRecord(recordId: string): ExecutionRecord | null {
        return this.records.get(recordId) || null;
    }

    /**
     * Get record by request ID
     */
    getRecordByRequestId(requestId: string): ExecutionRecord | null {
        const recordId = this.recordsByRequest.get(requestId);
        if (!recordId) return null;
        return this.records.get(recordId) || null;
    }

    /**
     * Get records for an agent
     */
    getAgentRecords(agentId: string, options?: {
        status?: ExecutionStatus;
        limit?: number;
        since?: Date;
    }): ExecutionRecord[] {
        const recordIds = this.recordsByAgent.get(agentId) || [];
        let records = recordIds
            .map(id => this.records.get(id))
            .filter((r): r is ExecutionRecord => r !== undefined);

        if (options?.status) {
            records = records.filter(r => r.status === options.status);
        }

        if (options?.since) {
            records = records.filter(r => r.queuedAt >= options.since!);
        }

        records.sort((a, b) => b.queuedAt.getTime() - a.queuedAt.getTime());

        if (options?.limit) {
            records = records.slice(0, options.limit);
        }

        return records;
    }

    /**
     * Get records for an organization
     */
    getOrgRecords(orgId: string, options?: {
        status?: ExecutionStatus;
        limit?: number;
        since?: Date;
    }): ExecutionRecord[] {
        const recordIds = this.recordsByOrg.get(orgId) || [];
        let records = recordIds
            .map(id => this.records.get(id))
            .filter((r): r is ExecutionRecord => r !== undefined);

        if (options?.status) {
            records = records.filter(r => r.status === options.status);
        }

        if (options?.since) {
            records = records.filter(r => r.queuedAt >= options.since!);
        }

        records.sort((a, b) => b.queuedAt.getTime() - a.queuedAt.getTime());

        if (options?.limit) {
            records = records.slice(0, options.limit);
        }

        return records;
    }

    /**
     * Get currently executing records
     */
    getExecutingRecords(): ExecutionRecord[] {
        return Array.from(this.records.values())
            .filter(r => r.status === 'executing');
    }

    /**
     * Get queued records
     */
    getQueuedRecords(): ExecutionRecord[] {
        return this.executionQueue
            .map(id => this.records.get(id))
            .filter((r): r is ExecutionRecord => r !== undefined);
    }

    /**
     * Get progress history for a record
     */
    getProgressHistory(recordId: string): ExecutionProgress[] {
        return this.progressHistory.get(recordId) || [];
    }

    // =========================================================================
    // Statistics
    // =========================================================================

    /**
     * Get execution statistics
     */
    getStats(orgId?: string): {
        totalExecutions: number;
        queuedCount: number;
        executingCount: number;
        completedCount: number;
        failedCount: number;
        cancelledCount: number;
        averageDurationMs: number;
        successRate: number;
        byApprovalSource: Record<ApprovalSource, number>;
    } {
        let records = Array.from(this.records.values());

        if (orgId) {
            records = records.filter(r => r.request.orgId === orgId);
        }

        const completed = records.filter(r => r.status === 'completed');
        const failed = records.filter(r => r.status === 'failed');
        const finished = [...completed, ...failed];

        let totalDuration = 0;
        for (const r of finished) {
            if (r.duration) {
                totalDuration += r.duration;
            }
        }

        const byApprovalSource: Record<ApprovalSource, number> = {
            auto_approval: 0,
            tribunal: 0,
            council: 0,
            hitl: 0,
        };

        for (const r of records) {
            byApprovalSource[r.approvalSource]++;
        }

        return {
            totalExecutions: records.length,
            queuedCount: records.filter(r => r.status === 'queued').length,
            executingCount: records.filter(r => r.status === 'executing').length,
            completedCount: completed.length,
            failedCount: failed.length,
            cancelledCount: records.filter(r => r.status === 'cancelled').length,
            averageDurationMs: finished.length > 0 ? totalDuration / finished.length : 0,
            successRate: finished.length > 0 ? completed.length / finished.length : 1,
            byApprovalSource,
        };
    }

    /**
     * Get queue stats
     */
    getQueueStats(): {
        queueLength: number;
        executingCount: number;
        maxConcurrent: number;
        available: number;
    } {
        return {
            queueLength: this.executionQueue.length,
            executingCount: this.executingCount,
            maxConcurrent: this.config.maxConcurrent,
            available: Math.max(0, this.config.maxConcurrent - this.executingCount),
        };
    }

    // =========================================================================
    // Configuration
    // =========================================================================

    /**
     * Update configuration
     */
    updateConfig(config: Partial<ExecutionConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): ExecutionConfig {
        return { ...this.config };
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    private processQueue(): void {
        while (
            this.executionQueue.length > 0 &&
            this.executingCount < this.config.maxConcurrent
        ) {
            const recordId = this.executionQueue.shift();
            if (recordId) {
                this.startExecution(recordId);
            }
        }
    }

    private storeRecord(record: ExecutionRecord): void {
        this.records.set(record.id, record);
        this.recordsByRequest.set(record.requestId, record.id);

        // Index by agent
        const agentRecords = this.recordsByAgent.get(record.request.agentId) || [];
        agentRecords.push(record.id);
        this.recordsByAgent.set(record.request.agentId, agentRecords);

        // Index by org
        const orgRecords = this.recordsByOrg.get(record.request.orgId) || [];
        orgRecords.push(record.id);
        this.recordsByOrg.set(record.request.orgId, orgRecords);
    }

    private recordProgress(record: ExecutionRecord, message?: string): void {
        if (!this.config.trackProgress) return;

        const progress: ExecutionProgress = {
            recordId: record.id,
            status: record.status,
            progress: record.progress,
            message,
            timestamp: new Date(),
        };

        const history = this.progressHistory.get(record.id) || [];
        history.push(progress);
        this.progressHistory.set(record.id, history);

        this.emit('execution:progress', record, progress);
    }

    private setExecutionTimeout(record: ExecutionRecord): void {
        const timeout = setTimeout(() => {
            this.timeoutExecution(record.id);
        }, this.config.executionTimeoutMs);

        this.executionTimeouts.set(record.id, timeout);
    }

    private clearExecutionTimeout(recordId: string): void {
        const timeout = this.executionTimeouts.get(recordId);
        if (timeout) {
            clearTimeout(timeout);
            this.executionTimeouts.delete(recordId);
        }
    }

    private setQueueTimeout(record: ExecutionRecord): void {
        const timeout = setTimeout(() => {
            this.cancelExecution(record.id, 'Queue timeout exceeded');
        }, this.config.queueTimeoutMs);

        this.queueTimeouts.set(record.id, timeout);
    }

    private clearQueueTimeout(recordId: string): void {
        const timeout = this.queueTimeouts.get(recordId);
        if (timeout) {
            clearTimeout(timeout);
            this.queueTimeouts.delete(recordId);
        }
    }

    private timeoutExecution(recordId: string): void {
        const record = this.records.get(recordId);
        if (!record) return;

        if (record.status !== 'executing') return;

        record.status = 'timeout';
        record.completedAt = new Date();
        record.error = 'Execution timeout exceeded';

        if (record.startedAt) {
            record.duration = record.completedAt.getTime() - record.startedAt.getTime();
        }

        this.executingCount--;
        this.executionTimeouts.delete(recordId);

        this.emit('execution:timeout', record);
        this.recordProgress(record, 'Execution timed out');

        // Process next in queue
        this.processQueue();
    }

    private generateRecordId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `exec_${timestamp}_${random}`;
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /**
     * Clear all state
     */
    clear(): void {
        // Clear all timeouts
        for (const timeout of this.executionTimeouts.values()) {
            clearTimeout(timeout);
        }
        for (const timeout of this.queueTimeouts.values()) {
            clearTimeout(timeout);
        }

        this.records.clear();
        this.recordsByRequest.clear();
        this.recordsByAgent.clear();
        this.recordsByOrg.clear();
        this.progressHistory.clear();
        this.executionQueue = [];
        this.executingCount = 0;
        this.executionTimeouts.clear();
        this.queueTimeouts.clear();
    }

    /**
     * Get total record count
     */
    get recordCount(): number {
        return this.records.size;
    }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: ExecutionTracker | null = null;

export function getExecutionTracker(config?: Partial<ExecutionConfig>): ExecutionTracker {
    if (!instance) {
        instance = new ExecutionTracker(config);
    }
    return instance;
}

export function resetExecutionTracker(): void {
    if (instance) {
        instance.clear();
    }
    instance = null;
}

export default ExecutionTracker;
