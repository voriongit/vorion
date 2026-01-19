/**
 * Decision Analytics Service
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.7: Decision Analytics
 *
 * Provides analytics on decision patterns to optimize automation thresholds.
 * Metrics include:
 * - Auto-approval rate by action type
 * - Average decision time by risk level
 * - Override rate (human vs tribunal)
 * - False positive rate
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type DecisionSource = 'auto_approval' | 'tribunal' | 'hitl';
export type DecisionOutcome = 'approved' | 'denied' | 'expired' | 'escalated';

export interface DecisionRecord {
    id: string;
    requestId: string;
    orgId: string;
    agentId: string;
    actionType: string;
    riskLevel: RiskLevel;
    source: DecisionSource;
    outcome: DecisionOutcome;
    createdAt: Date;
    decidedAt: Date;
    decisionTimeMs: number;
    trustScore: number;
    wasOverridden?: boolean;
    overrideReason?: string;
    metadata?: Record<string, unknown>;
}

export interface AutoApprovalMetrics {
    totalRequests: number;
    autoApproved: number;
    rejected: number;
    rate: number; // 0-1
    byActionType: Record<string, {
        total: number;
        approved: number;
        rate: number;
    }>;
}

export interface DecisionTimeMetrics {
    overall: {
        mean: number;
        median: number;
        p95: number;
        p99: number;
    };
    byRiskLevel: Record<RiskLevel, {
        mean: number;
        median: number;
        min: number;
        max: number;
    }>;
    bySource: Record<DecisionSource, {
        mean: number;
        median: number;
    }>;
}

export interface OverrideMetrics {
    total: number;
    bySource: Record<DecisionSource, {
        total: number;
        overridden: number;
        rate: number;
    }>;
    reasons: Record<string, number>;
}

export interface FalsePositiveMetrics {
    autoApprovalFalsePositives: number;
    tribunalOverturned: number;
    totalDecisions: number;
    rate: number; // 0-1
    byActionType: Record<string, {
        total: number;
        falsePositives: number;
        rate: number;
    }>;
}

export interface DecisionAnalyticsSummary {
    orgId: string;
    period: {
        start: Date;
        end: Date;
    };
    totalDecisions: number;
    bySource: Record<DecisionSource, number>;
    byOutcome: Record<DecisionOutcome, number>;
    byRiskLevel: Record<RiskLevel, number>;
    autoApproval: AutoApprovalMetrics;
    decisionTime: DecisionTimeMetrics;
    override: OverrideMetrics;
    falsePositive: FalsePositiveMetrics;
    trends: {
        autoApprovalRateTrend: number; // -1 to 1, positive = improving
        decisionTimeTrend: number; // -1 to 1, negative = faster
        overrideRateTrend: number; // -1 to 1, negative = less overrides
    };
}

export interface AnalyticsConfig {
    /** Retention period in days for detailed records */
    retentionDays: number;
    /** Window size for trend calculation */
    trendWindowDays: number;
    /** Enable detailed action type tracking */
    trackActionTypes: boolean;
    /** Maximum number of records to keep */
    maxRecords: number;
}

interface AnalyticsEvents {
    'decision:recorded': (record: DecisionRecord) => void;
    'metrics:updated': (orgId: string) => void;
    'threshold:alert': (alert: ThresholdAlert) => void;
}

interface ThresholdAlert {
    orgId: string;
    metric: string;
    current: number;
    threshold: number;
    message: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: AnalyticsConfig = {
    retentionDays: 90,
    trendWindowDays: 7,
    trackActionTypes: true,
    maxRecords: 100000,
};

// ============================================================================
// Decision Analytics Service
// ============================================================================

export class DecisionAnalytics extends EventEmitter<AnalyticsEvents> {
    private config: AnalyticsConfig;
    private records: Map<string, DecisionRecord> = new Map();
    private recordsByOrg: Map<string, string[]> = new Map();
    private recordsByAgent: Map<string, string[]> = new Map();

    // Alert thresholds
    private thresholds: Map<string, Map<string, number>> = new Map();

    constructor(config: Partial<AnalyticsConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // =========================================================================
    // Decision Recording
    // =========================================================================

    /**
     * Record a decision for analytics
     */
    recordDecision(
        id: string,
        requestId: string,
        orgId: string,
        agentId: string,
        actionType: string,
        riskLevel: RiskLevel,
        source: DecisionSource,
        outcome: DecisionOutcome,
        createdAt: Date,
        decidedAt: Date,
        trustScore: number,
        options?: {
            wasOverridden?: boolean;
            overrideReason?: string;
            metadata?: Record<string, unknown>;
        }
    ): DecisionRecord {
        const record: DecisionRecord = {
            id,
            requestId,
            orgId,
            agentId,
            actionType,
            riskLevel,
            source,
            outcome,
            createdAt,
            decidedAt,
            decisionTimeMs: decidedAt.getTime() - createdAt.getTime(),
            trustScore,
            wasOverridden: options?.wasOverridden,
            overrideReason: options?.overrideReason,
            metadata: options?.metadata,
        };

        this.storeRecord(record);
        this.emit('decision:recorded', record);
        this.checkThresholds(orgId);

        return record;
    }

    /**
     * Update a record with override information
     */
    recordOverride(
        id: string,
        reason: string,
        newOutcome: DecisionOutcome
    ): boolean {
        const record = this.records.get(id);
        if (!record) return false;

        record.wasOverridden = true;
        record.overrideReason = reason;
        record.outcome = newOutcome;

        this.emit('metrics:updated', record.orgId);
        return true;
    }

    // =========================================================================
    // Analytics Retrieval
    // =========================================================================

    /**
     * Get comprehensive analytics summary
     */
    getAnalyticsSummary(
        orgId: string,
        options?: {
            startDate?: Date;
            endDate?: Date;
        }
    ): DecisionAnalyticsSummary {
        const records = this.getOrgRecords(orgId, options?.startDate, options?.endDate);

        const period = {
            start: options?.startDate || this.getOldestRecordDate(records),
            end: options?.endDate || new Date(),
        };

        return {
            orgId,
            period,
            totalDecisions: records.length,
            bySource: this.countBySource(records),
            byOutcome: this.countByOutcome(records),
            byRiskLevel: this.countByRiskLevel(records),
            autoApproval: this.calculateAutoApprovalMetrics(records),
            decisionTime: this.calculateDecisionTimeMetrics(records),
            override: this.calculateOverrideMetrics(records),
            falsePositive: this.calculateFalsePositiveMetrics(records),
            trends: this.calculateTrends(orgId),
        };
    }

    /**
     * Get auto-approval metrics
     */
    getAutoApprovalMetrics(orgId: string, startDate?: Date, endDate?: Date): AutoApprovalMetrics {
        const records = this.getOrgRecords(orgId, startDate, endDate);
        return this.calculateAutoApprovalMetrics(records);
    }

    /**
     * Get decision time metrics
     */
    getDecisionTimeMetrics(orgId: string, startDate?: Date, endDate?: Date): DecisionTimeMetrics {
        const records = this.getOrgRecords(orgId, startDate, endDate);
        return this.calculateDecisionTimeMetrics(records);
    }

    /**
     * Get override metrics
     */
    getOverrideMetrics(orgId: string, startDate?: Date, endDate?: Date): OverrideMetrics {
        const records = this.getOrgRecords(orgId, startDate, endDate);
        return this.calculateOverrideMetrics(records);
    }

    /**
     * Get false positive metrics
     */
    getFalsePositiveMetrics(orgId: string, startDate?: Date, endDate?: Date): FalsePositiveMetrics {
        const records = this.getOrgRecords(orgId, startDate, endDate);
        return this.calculateFalsePositiveMetrics(records);
    }

    /**
     * Get agent-specific analytics
     */
    getAgentAnalytics(agentId: string, startDate?: Date, endDate?: Date): {
        totalDecisions: number;
        approvalRate: number;
        avgDecisionTime: number;
        overrideRate: number;
        bySource: Record<DecisionSource, number>;
        byOutcome: Record<DecisionOutcome, number>;
    } {
        const ids = this.recordsByAgent.get(agentId) || [];
        let records = ids.map(id => this.records.get(id)).filter(Boolean) as DecisionRecord[];

        if (startDate) {
            records = records.filter(r => r.createdAt >= startDate);
        }
        if (endDate) {
            records = records.filter(r => r.createdAt <= endDate);
        }

        const approved = records.filter(r => r.outcome === 'approved').length;
        const overridden = records.filter(r => r.wasOverridden).length;
        const times = records.map(r => r.decisionTimeMs);

        return {
            totalDecisions: records.length,
            approvalRate: records.length > 0 ? approved / records.length : 0,
            avgDecisionTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
            overrideRate: records.length > 0 ? overridden / records.length : 0,
            bySource: this.countBySource(records),
            byOutcome: this.countByOutcome(records),
        };
    }

    /**
     * Get action type analytics
     */
    getActionTypeAnalytics(orgId: string, actionType: string, startDate?: Date, endDate?: Date): {
        total: number;
        approvalRate: number;
        avgDecisionTime: number;
        autoApprovalRate: number;
        falsePositiveRate: number;
    } {
        let records = this.getOrgRecords(orgId, startDate, endDate)
            .filter(r => r.actionType === actionType);

        const approved = records.filter(r => r.outcome === 'approved').length;
        const autoApproved = records.filter(r => r.source === 'auto_approval' && r.outcome === 'approved').length;
        const falsePositives = records.filter(r =>
            r.source === 'auto_approval' && r.wasOverridden
        ).length;
        const times = records.map(r => r.decisionTimeMs);

        return {
            total: records.length,
            approvalRate: records.length > 0 ? approved / records.length : 0,
            avgDecisionTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
            autoApprovalRate: records.length > 0 ? autoApproved / records.length : 0,
            falsePositiveRate: autoApproved > 0 ? falsePositives / autoApproved : 0,
        };
    }

    // =========================================================================
    // Threshold Management
    // =========================================================================

    /**
     * Set alert threshold for a metric
     */
    setThreshold(orgId: string, metric: string, threshold: number): void {
        let orgThresholds = this.thresholds.get(orgId);
        if (!orgThresholds) {
            orgThresholds = new Map();
            this.thresholds.set(orgId, orgThresholds);
        }
        orgThresholds.set(metric, threshold);
    }

    /**
     * Get threshold for a metric
     */
    getThreshold(orgId: string, metric: string): number | null {
        const orgThresholds = this.thresholds.get(orgId);
        if (!orgThresholds) return null;
        return orgThresholds.get(metric) ?? null;
    }

    /**
     * Clear threshold for a metric
     */
    clearThreshold(orgId: string, metric: string): boolean {
        const orgThresholds = this.thresholds.get(orgId);
        if (!orgThresholds) return false;
        return orgThresholds.delete(metric);
    }

    // =========================================================================
    // Record Retrieval
    // =========================================================================

    /**
     * Get a specific record
     */
    getRecord(id: string): DecisionRecord | null {
        return this.records.get(id) || null;
    }

    /**
     * Get records by request ID
     */
    getRecordByRequestId(requestId: string): DecisionRecord | null {
        for (const record of this.records.values()) {
            if (record.requestId === requestId) {
                return record;
            }
        }
        return null;
    }

    /**
     * Get recent records
     */
    getRecentRecords(
        orgId: string,
        limit: number = 100,
        options?: {
            source?: DecisionSource;
            outcome?: DecisionOutcome;
            riskLevel?: RiskLevel;
        }
    ): DecisionRecord[] {
        let records = this.getOrgRecords(orgId);

        if (options?.source) {
            records = records.filter(r => r.source === options.source);
        }
        if (options?.outcome) {
            records = records.filter(r => r.outcome === options.outcome);
        }
        if (options?.riskLevel) {
            records = records.filter(r => r.riskLevel === options.riskLevel);
        }

        return records
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }

    // =========================================================================
    // Configuration
    // =========================================================================

    /**
     * Update configuration
     */
    updateConfig(config: Partial<AnalyticsConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): AnalyticsConfig {
        return { ...this.config };
    }

    // =========================================================================
    // Statistics
    // =========================================================================

    /**
     * Get overall statistics
     */
    getStats(): {
        totalRecords: number;
        uniqueOrgs: number;
        uniqueAgents: number;
        oldestRecord: Date | null;
        newestRecord: Date | null;
    } {
        let oldest: Date | null = null;
        let newest: Date | null = null;

        for (const record of this.records.values()) {
            if (!oldest || record.createdAt < oldest) {
                oldest = record.createdAt;
            }
            if (!newest || record.createdAt > newest) {
                newest = record.createdAt;
            }
        }

        return {
            totalRecords: this.records.size,
            uniqueOrgs: this.recordsByOrg.size,
            uniqueAgents: this.recordsByAgent.size,
            oldestRecord: oldest,
            newestRecord: newest,
        };
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /**
     * Clean up old records
     */
    cleanup(): number {
        const cutoff = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
        let removed = 0;

        for (const [id, record] of this.records.entries()) {
            if (record.createdAt < cutoff) {
                this.removeRecord(id);
                removed++;
            }
        }

        return removed;
    }

    /**
     * Clear all data
     */
    clear(): void {
        this.records.clear();
        this.recordsByOrg.clear();
        this.recordsByAgent.clear();
        this.thresholds.clear();
    }

    /**
     * Get record count
     */
    get recordCount(): number {
        return this.records.size;
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    private storeRecord(record: DecisionRecord): void {
        // Enforce max records
        if (this.records.size >= this.config.maxRecords) {
            this.cleanup();
            // If still at max, remove oldest
            if (this.records.size >= this.config.maxRecords) {
                const oldest = this.findOldestRecord();
                if (oldest) {
                    this.removeRecord(oldest.id);
                }
            }
        }

        this.records.set(record.id, record);

        // Index by org
        const orgRecords = this.recordsByOrg.get(record.orgId) || [];
        orgRecords.push(record.id);
        this.recordsByOrg.set(record.orgId, orgRecords);

        // Index by agent
        const agentRecords = this.recordsByAgent.get(record.agentId) || [];
        agentRecords.push(record.id);
        this.recordsByAgent.set(record.agentId, agentRecords);
    }

    private removeRecord(id: string): void {
        const record = this.records.get(id);
        if (!record) return;

        this.records.delete(id);

        // Remove from org index
        const orgRecords = this.recordsByOrg.get(record.orgId);
        if (orgRecords) {
            const idx = orgRecords.indexOf(id);
            if (idx >= 0) orgRecords.splice(idx, 1);
        }

        // Remove from agent index
        const agentRecords = this.recordsByAgent.get(record.agentId);
        if (agentRecords) {
            const idx = agentRecords.indexOf(id);
            if (idx >= 0) agentRecords.splice(idx, 1);
        }
    }

    private findOldestRecord(): DecisionRecord | null {
        let oldest: DecisionRecord | null = null;
        for (const record of this.records.values()) {
            if (!oldest || record.createdAt < oldest.createdAt) {
                oldest = record;
            }
        }
        return oldest;
    }

    private getOrgRecords(orgId: string, startDate?: Date, endDate?: Date): DecisionRecord[] {
        const ids = this.recordsByOrg.get(orgId) || [];
        let records = ids.map(id => this.records.get(id)).filter(Boolean) as DecisionRecord[];

        if (startDate) {
            records = records.filter(r => r.createdAt >= startDate);
        }
        if (endDate) {
            records = records.filter(r => r.createdAt <= endDate);
        }

        return records;
    }

    private getOldestRecordDate(records: DecisionRecord[]): Date {
        if (records.length === 0) return new Date();
        return records.reduce((min, r) => r.createdAt < min ? r.createdAt : min, records[0].createdAt);
    }

    private countBySource(records: DecisionRecord[]): Record<DecisionSource, number> {
        const counts: Record<DecisionSource, number> = {
            auto_approval: 0,
            tribunal: 0,
            hitl: 0,
        };
        for (const r of records) {
            counts[r.source]++;
        }
        return counts;
    }

    private countByOutcome(records: DecisionRecord[]): Record<DecisionOutcome, number> {
        const counts: Record<DecisionOutcome, number> = {
            approved: 0,
            denied: 0,
            expired: 0,
            escalated: 0,
        };
        for (const r of records) {
            counts[r.outcome]++;
        }
        return counts;
    }

    private countByRiskLevel(records: DecisionRecord[]): Record<RiskLevel, number> {
        const counts: Record<RiskLevel, number> = {
            low: 0,
            medium: 0,
            high: 0,
            critical: 0,
        };
        for (const r of records) {
            counts[r.riskLevel]++;
        }
        return counts;
    }

    private calculateAutoApprovalMetrics(records: DecisionRecord[]): AutoApprovalMetrics {
        const autoRecords = records.filter(r => r.source === 'auto_approval');
        const approved = autoRecords.filter(r => r.outcome === 'approved');

        const byActionType: Record<string, { total: number; approved: number; rate: number }> = {};

        if (this.config.trackActionTypes) {
            for (const r of records) {
                if (!byActionType[r.actionType]) {
                    byActionType[r.actionType] = { total: 0, approved: 0, rate: 0 };
                }
                byActionType[r.actionType].total++;
                if (r.source === 'auto_approval' && r.outcome === 'approved') {
                    byActionType[r.actionType].approved++;
                }
            }

            // Calculate rates
            for (const type of Object.keys(byActionType)) {
                const data = byActionType[type];
                data.rate = data.total > 0 ? data.approved / data.total : 0;
            }
        }

        return {
            totalRequests: records.length,
            autoApproved: approved.length,
            rejected: autoRecords.length - approved.length,
            rate: records.length > 0 ? approved.length / records.length : 0,
            byActionType,
        };
    }

    private calculateDecisionTimeMetrics(records: DecisionRecord[]): DecisionTimeMetrics {
        const times = records.map(r => r.decisionTimeMs).sort((a, b) => a - b);

        const byRiskLevel: Record<RiskLevel, { mean: number; median: number; min: number; max: number }> = {
            low: { mean: 0, median: 0, min: 0, max: 0 },
            medium: { mean: 0, median: 0, min: 0, max: 0 },
            high: { mean: 0, median: 0, min: 0, max: 0 },
            critical: { mean: 0, median: 0, min: 0, max: 0 },
        };

        const bySource: Record<DecisionSource, { mean: number; median: number }> = {
            auto_approval: { mean: 0, median: 0 },
            tribunal: { mean: 0, median: 0 },
            hitl: { mean: 0, median: 0 },
        };

        // Calculate by risk level
        for (const level of ['low', 'medium', 'high', 'critical'] as RiskLevel[]) {
            const levelRecords = records.filter(r => r.riskLevel === level);
            if (levelRecords.length > 0) {
                const levelTimes = levelRecords.map(r => r.decisionTimeMs).sort((a, b) => a - b);
                byRiskLevel[level] = {
                    mean: levelTimes.reduce((a, b) => a + b, 0) / levelTimes.length,
                    median: this.median(levelTimes),
                    min: levelTimes[0],
                    max: levelTimes[levelTimes.length - 1],
                };
            }
        }

        // Calculate by source
        for (const source of ['auto_approval', 'tribunal', 'hitl'] as DecisionSource[]) {
            const sourceRecords = records.filter(r => r.source === source);
            if (sourceRecords.length > 0) {
                const sourceTimes = sourceRecords.map(r => r.decisionTimeMs).sort((a, b) => a - b);
                bySource[source] = {
                    mean: sourceTimes.reduce((a, b) => a + b, 0) / sourceTimes.length,
                    median: this.median(sourceTimes),
                };
            }
        }

        return {
            overall: {
                mean: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
                median: this.median(times),
                p95: this.percentile(times, 95),
                p99: this.percentile(times, 99),
            },
            byRiskLevel,
            bySource,
        };
    }

    private calculateOverrideMetrics(records: DecisionRecord[]): OverrideMetrics {
        const overridden = records.filter(r => r.wasOverridden);

        const bySource: Record<DecisionSource, { total: number; overridden: number; rate: number }> = {
            auto_approval: { total: 0, overridden: 0, rate: 0 },
            tribunal: { total: 0, overridden: 0, rate: 0 },
            hitl: { total: 0, overridden: 0, rate: 0 },
        };

        for (const r of records) {
            bySource[r.source].total++;
            if (r.wasOverridden) {
                bySource[r.source].overridden++;
            }
        }

        for (const source of Object.keys(bySource) as DecisionSource[]) {
            const data = bySource[source];
            data.rate = data.total > 0 ? data.overridden / data.total : 0;
        }

        const reasons: Record<string, number> = {};
        for (const r of overridden) {
            const reason = r.overrideReason || 'unspecified';
            reasons[reason] = (reasons[reason] || 0) + 1;
        }

        return {
            total: overridden.length,
            bySource,
            reasons,
        };
    }

    private calculateFalsePositiveMetrics(records: DecisionRecord[]): FalsePositiveMetrics {
        // False positives: auto-approved but later overridden/failed
        const autoApproved = records.filter(
            r => r.source === 'auto_approval' && r.outcome === 'approved'
        );
        const falsePositives = autoApproved.filter(r => r.wasOverridden);

        // Tribunal overturned: tribunal approved but later overridden
        const tribunalApproved = records.filter(
            r => r.source === 'tribunal' && r.outcome === 'approved'
        );
        const tribunalOverturned = tribunalApproved.filter(r => r.wasOverridden);

        const byActionType: Record<string, { total: number; falsePositives: number; rate: number }> = {};

        if (this.config.trackActionTypes) {
            for (const r of autoApproved) {
                if (!byActionType[r.actionType]) {
                    byActionType[r.actionType] = { total: 0, falsePositives: 0, rate: 0 };
                }
                byActionType[r.actionType].total++;
                if (r.wasOverridden) {
                    byActionType[r.actionType].falsePositives++;
                }
            }

            for (const type of Object.keys(byActionType)) {
                const data = byActionType[type];
                data.rate = data.total > 0 ? data.falsePositives / data.total : 0;
            }
        }

        return {
            autoApprovalFalsePositives: falsePositives.length,
            tribunalOverturned: tribunalOverturned.length,
            totalDecisions: autoApproved.length,
            rate: autoApproved.length > 0 ? falsePositives.length / autoApproved.length : 0,
            byActionType,
        };
    }

    private calculateTrends(orgId: string): {
        autoApprovalRateTrend: number;
        decisionTimeTrend: number;
        overrideRateTrend: number;
    } {
        const windowMs = this.config.trendWindowDays * 24 * 60 * 60 * 1000;
        const now = Date.now();

        const currentStart = new Date(now - windowMs);
        const previousStart = new Date(now - 2 * windowMs);
        const previousEnd = new Date(now - windowMs);

        const currentRecords = this.getOrgRecords(orgId, currentStart, new Date(now));
        const previousRecords = this.getOrgRecords(orgId, previousStart, previousEnd);

        if (previousRecords.length === 0 || currentRecords.length === 0) {
            return {
                autoApprovalRateTrend: 0,
                decisionTimeTrend: 0,
                overrideRateTrend: 0,
            };
        }

        // Auto-approval rate trend
        const currentAutoRate = currentRecords.filter(r => r.source === 'auto_approval' && r.outcome === 'approved').length / currentRecords.length;
        const previousAutoRate = previousRecords.filter(r => r.source === 'auto_approval' && r.outcome === 'approved').length / previousRecords.length;
        const autoApprovalRateTrend = previousAutoRate > 0 ? (currentAutoRate - previousAutoRate) / previousAutoRate : 0;

        // Decision time trend
        const currentAvgTime = currentRecords.reduce((a, r) => a + r.decisionTimeMs, 0) / currentRecords.length;
        const previousAvgTime = previousRecords.reduce((a, r) => a + r.decisionTimeMs, 0) / previousRecords.length;
        const decisionTimeTrend = previousAvgTime > 0 ? (currentAvgTime - previousAvgTime) / previousAvgTime : 0;

        // Override rate trend
        const currentOverrideRate = currentRecords.filter(r => r.wasOverridden).length / currentRecords.length;
        const previousOverrideRate = previousRecords.filter(r => r.wasOverridden).length / previousRecords.length;
        const overrideRateTrend = previousOverrideRate > 0 ? (currentOverrideRate - previousOverrideRate) / previousOverrideRate : 0;

        // Clamp to -1 to 1
        return {
            autoApprovalRateTrend: Math.max(-1, Math.min(1, autoApprovalRateTrend)),
            decisionTimeTrend: Math.max(-1, Math.min(1, decisionTimeTrend)),
            overrideRateTrend: Math.max(-1, Math.min(1, overrideRateTrend)),
        };
    }

    private checkThresholds(orgId: string): void {
        const orgThresholds = this.thresholds.get(orgId);
        if (!orgThresholds || orgThresholds.size === 0) return;

        const records = this.getOrgRecords(orgId);
        if (records.length === 0) return;

        // Check auto-approval rate threshold
        if (orgThresholds.has('autoApprovalRate')) {
            const threshold = orgThresholds.get('autoApprovalRate')!;
            const autoApproved = records.filter(r => r.source === 'auto_approval' && r.outcome === 'approved');
            const rate = autoApproved.length / records.length;
            if (rate < threshold) {
                this.emit('threshold:alert', {
                    orgId,
                    metric: 'autoApprovalRate',
                    current: rate,
                    threshold,
                    message: `Auto-approval rate (${(rate * 100).toFixed(1)}%) below threshold (${(threshold * 100).toFixed(1)}%)`,
                });
            }
        }

        // Check override rate threshold
        if (orgThresholds.has('maxOverrideRate')) {
            const threshold = orgThresholds.get('maxOverrideRate')!;
            const overridden = records.filter(r => r.wasOverridden);
            const rate = overridden.length / records.length;
            if (rate > threshold) {
                this.emit('threshold:alert', {
                    orgId,
                    metric: 'maxOverrideRate',
                    current: rate,
                    threshold,
                    message: `Override rate (${(rate * 100).toFixed(1)}%) exceeds threshold (${(threshold * 100).toFixed(1)}%)`,
                });
            }
        }

        // Check false positive rate threshold
        if (orgThresholds.has('maxFalsePositiveRate')) {
            const threshold = orgThresholds.get('maxFalsePositiveRate')!;
            const autoApproved = records.filter(r => r.source === 'auto_approval' && r.outcome === 'approved');
            const falsePositives = autoApproved.filter(r => r.wasOverridden);
            const rate = autoApproved.length > 0 ? falsePositives.length / autoApproved.length : 0;
            if (rate > threshold) {
                this.emit('threshold:alert', {
                    orgId,
                    metric: 'maxFalsePositiveRate',
                    current: rate,
                    threshold,
                    message: `False positive rate (${(rate * 100).toFixed(1)}%) exceeds threshold (${(threshold * 100).toFixed(1)}%)`,
                });
            }
        }
    }

    private median(sorted: number[]): number {
        if (sorted.length === 0) return 0;
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    private percentile(sorted: number[], p: number): number {
        if (sorted.length === 0) return 0;
        const idx = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, idx)];
    }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: DecisionAnalytics | null = null;

export function getDecisionAnalytics(config?: Partial<AnalyticsConfig>): DecisionAnalytics {
    if (!instance) {
        instance = new DecisionAnalytics(config);
    }
    return instance;
}

export function resetDecisionAnalytics(): void {
    if (instance) {
        instance.clear();
    }
    instance = null;
}

export default DecisionAnalytics;
