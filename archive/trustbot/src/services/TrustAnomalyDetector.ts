/**
 * Trust Anomaly Detector
 *
 * Epic 11: Live Trust Scoring Engine
 * Story 11.6: Trust Anomaly Detection
 *
 * Detects unusual patterns in trust scores and agent behavior:
 * - Rapid score drops
 * - Unusual failure rates
 * - Score manipulation attempts
 * - Coordinated agent behavior
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export type AnomalyType =
    | 'rapid_score_drop'        // Score dropped significantly in short time
    | 'unusual_failure_rate'     // Failure rate above normal
    | 'score_manipulation'       // Suspicious score patterns
    | 'coordinated_behavior'     // Multiple agents acting in sync
    | 'sudden_recovery'          // Suspiciously fast score recovery
    | 'repeated_violations'      // Repeated security/rule violations
    | 'tier_oscillation';        // Agent keeps bouncing between tiers

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Anomaly {
    id: string;
    type: AnomalyType;
    severity: AnomalySeverity;
    agentId: string;
    orgId: string;
    description: string;
    detectedAt: Date;
    metadata: Record<string, unknown>;
    acknowledged: boolean;
    resolvedAt?: Date;
}

export interface AnomalyThresholds {
    /** Points drop threshold per hour (default: 50) */
    rapidDropThreshold: number;
    /** Failure rate multiplier threshold (default: 3x) */
    failureRateMultiplier: number;
    /** Time window for rapid drop detection in ms (default: 1 hour) */
    rapidDropWindowMs: number;
    /** Minimum events for failure rate calculation (default: 5) */
    minEventsForFailureRate: number;
    /** Time window for failure rate calculation in ms (default: 24 hours) */
    failureRateWindowMs: number;
    /** Number of agents for coordinated behavior detection (default: 3) */
    coordinatedBehaviorMinAgents: number;
    /** Time window for coordinated behavior in ms (default: 5 minutes) */
    coordinatedBehaviorWindowMs: number;
    /** Tier changes threshold for oscillation (default: 3 in 24h) */
    tierOscillationThreshold: number;
    /** Time window for tier oscillation in ms (default: 24 hours) */
    tierOscillationWindowMs: number;
    /** Repeated violations threshold (default: 3) */
    repeatedViolationsThreshold: number;
    /** Time window for repeated violations in ms (default: 1 hour) */
    repeatedViolationsWindowMs: number;
}

export interface AgentScoreSnapshot {
    agentId: string;
    orgId: string;
    score: number;
    timestamp: number;
}

export interface TrustEventRecord {
    agentId: string;
    orgId: string;
    eventType: string;
    points: number;
    timestamp: number;
}

export interface TierChangeRecord {
    agentId: string;
    orgId: string;
    previousTier: string;
    newTier: string;
    timestamp: number;
}

export interface AnomalyDetectorConfig {
    thresholds?: Partial<AnomalyThresholds>;
    /** Enable real-time monitoring (default: true) */
    realTimeMonitoring?: boolean;
    /** Check interval for batch analysis in ms (default: 60000) */
    batchCheckIntervalMs?: number;
}

interface DetectorEvents {
    'anomaly:detected': (anomaly: Anomaly) => void;
    'anomaly:resolved': (anomaly: Anomaly) => void;
    'anomaly:escalated': (anomaly: Anomaly) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_THRESHOLDS: AnomalyThresholds = {
    rapidDropThreshold: 50,
    failureRateMultiplier: 3,
    rapidDropWindowMs: 60 * 60 * 1000, // 1 hour
    minEventsForFailureRate: 5,
    failureRateWindowMs: 24 * 60 * 60 * 1000, // 24 hours
    coordinatedBehaviorMinAgents: 3,
    coordinatedBehaviorWindowMs: 5 * 60 * 1000, // 5 minutes
    tierOscillationThreshold: 3,
    tierOscillationWindowMs: 24 * 60 * 60 * 1000, // 24 hours
    repeatedViolationsThreshold: 3,
    repeatedViolationsWindowMs: 60 * 60 * 1000, // 1 hour
};

const FAILURE_EVENT_TYPES = [
    'task_failed',
    'task_timeout',
    'invalid_delegation',
    'security_violation',
];

const VIOLATION_EVENT_TYPES = [
    'security_violation',
    'invalid_delegation',
];

// ============================================================================
// Trust Anomaly Detector
// ============================================================================

export class TrustAnomalyDetector extends EventEmitter<DetectorEvents> {
    private thresholds: AnomalyThresholds;
    private realTimeMonitoring: boolean;
    private batchCheckIntervalMs: number;

    // Anomaly storage
    private anomalies: Map<string, Anomaly> = new Map();

    // Historical data for detection
    private scoreHistory: Map<string, AgentScoreSnapshot[]> = new Map();
    private eventHistory: Map<string, TrustEventRecord[]> = new Map();
    private tierChangeHistory: Map<string, TierChangeRecord[]> = new Map();

    // Baseline failure rates per org
    private orgBaselineFailureRates: Map<string, number> = new Map();

    // Batch check timer
    private batchCheckTimer?: ReturnType<typeof setInterval>;

    constructor(config: AnomalyDetectorConfig = {}) {
        super();
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };
        this.realTimeMonitoring = config.realTimeMonitoring ?? true;
        this.batchCheckIntervalMs = config.batchCheckIntervalMs ?? 60000;

        if (this.realTimeMonitoring && this.batchCheckIntervalMs > 0) {
            this.startBatchChecking();
        }
    }

    // =========================================================================
    // Event Recording
    // =========================================================================

    /**
     * Record a score change for an agent
     */
    recordScoreChange(agentId: string, orgId: string, oldScore: number, newScore: number): void {
        const snapshot: AgentScoreSnapshot = {
            agentId,
            orgId,
            score: newScore,
            timestamp: Date.now(),
        };

        const history = this.scoreHistory.get(agentId) || [];
        history.push(snapshot);
        this.scoreHistory.set(agentId, history);

        // Prune old history
        this.pruneHistory(agentId);

        // Real-time checks
        if (this.realTimeMonitoring) {
            this.checkRapidScoreDrop(agentId, orgId, oldScore, newScore);
            this.checkSuddenRecovery(agentId, orgId, oldScore, newScore);
        }
    }

    /**
     * Record a trust event for an agent
     */
    recordEvent(agentId: string, orgId: string, eventType: string, points: number): void {
        const record: TrustEventRecord = {
            agentId,
            orgId,
            eventType,
            points,
            timestamp: Date.now(),
        };

        const history = this.eventHistory.get(agentId) || [];
        history.push(record);
        this.eventHistory.set(agentId, history);

        // Real-time checks
        if (this.realTimeMonitoring) {
            if (FAILURE_EVENT_TYPES.includes(eventType)) {
                this.checkUnusualFailureRate(agentId, orgId);
            }
            if (VIOLATION_EVENT_TYPES.includes(eventType)) {
                this.checkRepeatedViolations(agentId, orgId);
            }
        }
    }

    /**
     * Record a tier change for an agent
     */
    recordTierChange(agentId: string, orgId: string, previousTier: string, newTier: string): void {
        const record: TierChangeRecord = {
            agentId,
            orgId,
            previousTier,
            newTier,
            timestamp: Date.now(),
        };

        const history = this.tierChangeHistory.get(agentId) || [];
        history.push(record);
        this.tierChangeHistory.set(agentId, history);

        // Real-time check
        if (this.realTimeMonitoring) {
            this.checkTierOscillation(agentId, orgId);
        }
    }

    // =========================================================================
    // Anomaly Detection
    // =========================================================================

    /**
     * Check for rapid score drop
     */
    private checkRapidScoreDrop(agentId: string, orgId: string, oldScore: number, newScore: number): Anomaly | null {
        const drop = oldScore - newScore;
        if (drop <= 0) return null;

        const history = this.scoreHistory.get(agentId) || [];
        const windowStart = Date.now() - this.thresholds.rapidDropWindowMs;

        // Calculate total drop in window
        const recentHistory = history.filter((s) => s.timestamp >= windowStart);
        if (recentHistory.length < 2) {
            // Not enough data, check just this change
            if (drop >= this.thresholds.rapidDropThreshold) {
                return this.createAnomaly(agentId, orgId, 'rapid_score_drop', 'high', {
                    oldScore,
                    newScore,
                    drop,
                    timeWindowMs: 0,
                });
            }
            return null;
        }

        const firstScore = recentHistory[0].score;
        const lastScore = recentHistory[recentHistory.length - 1].score;
        const totalDrop = firstScore - lastScore;

        if (totalDrop >= this.thresholds.rapidDropThreshold) {
            return this.createAnomaly(agentId, orgId, 'rapid_score_drop', 'high', {
                startScore: firstScore,
                endScore: lastScore,
                totalDrop,
                timeWindowMs: this.thresholds.rapidDropWindowMs,
                eventsInWindow: recentHistory.length,
            });
        }

        return null;
    }

    /**
     * Check for unusual failure rate
     */
    private checkUnusualFailureRate(agentId: string, orgId: string): Anomaly | null {
        const history = this.eventHistory.get(agentId) || [];
        const windowStart = Date.now() - this.thresholds.failureRateWindowMs;
        const recentHistory = history.filter((e) => e.timestamp >= windowStart);

        if (recentHistory.length < this.thresholds.minEventsForFailureRate) {
            return null;
        }

        const failureCount = recentHistory.filter((e) =>
            FAILURE_EVENT_TYPES.includes(e.eventType)
        ).length;

        const failureRate = failureCount / recentHistory.length;

        // Get or calculate baseline
        let baseline = this.orgBaselineFailureRates.get(orgId);
        if (baseline === undefined) {
            baseline = 0.1; // Default 10% failure rate baseline
        }

        if (failureRate > baseline * this.thresholds.failureRateMultiplier) {
            return this.createAnomaly(agentId, orgId, 'unusual_failure_rate', 'medium', {
                failureRate: Math.round(failureRate * 100) / 100,
                baselineRate: baseline,
                multiplier: Math.round((failureRate / baseline) * 100) / 100,
                failureCount,
                totalEvents: recentHistory.length,
            });
        }

        return null;
    }

    /**
     * Check for repeated violations
     */
    private checkRepeatedViolations(agentId: string, orgId: string): Anomaly | null {
        const history = this.eventHistory.get(agentId) || [];
        const windowStart = Date.now() - this.thresholds.repeatedViolationsWindowMs;

        const violations = history.filter(
            (e) => e.timestamp >= windowStart && VIOLATION_EVENT_TYPES.includes(e.eventType)
        );

        if (violations.length >= this.thresholds.repeatedViolationsThreshold) {
            const severity: AnomalySeverity =
                violations.filter((v) => v.eventType === 'security_violation').length > 0
                    ? 'critical'
                    : 'high';

            return this.createAnomaly(agentId, orgId, 'repeated_violations', severity, {
                violationCount: violations.length,
                violations: violations.map((v) => ({
                    type: v.eventType,
                    timestamp: v.timestamp,
                })),
            });
        }

        return null;
    }

    /**
     * Check for sudden recovery (possible manipulation)
     */
    private checkSuddenRecovery(agentId: string, orgId: string, oldScore: number, newScore: number): Anomaly | null {
        const gain = newScore - oldScore;
        if (gain <= 0) return null;

        const history = this.scoreHistory.get(agentId) || [];
        const windowStart = Date.now() - this.thresholds.rapidDropWindowMs;

        // Look for previous drop followed by rapid recovery
        const recentHistory = history.filter((s) => s.timestamp >= windowStart);
        if (recentHistory.length < 3) return null;

        // Find if there was a significant drop followed by this recovery
        let maxScore = 0;
        let minAfterMax = Infinity;

        for (const snapshot of recentHistory) {
            if (snapshot.score > maxScore) {
                maxScore = snapshot.score;
                minAfterMax = snapshot.score;
            } else if (snapshot.score < minAfterMax) {
                minAfterMax = snapshot.score;
            }
        }

        const dropAmount = maxScore - minAfterMax;
        const recoveryAmount = newScore - minAfterMax;

        // Suspicious if big drop followed by near-complete recovery in short time
        if (
            dropAmount >= this.thresholds.rapidDropThreshold &&
            recoveryAmount >= dropAmount * 0.8
        ) {
            return this.createAnomaly(agentId, orgId, 'sudden_recovery', 'medium', {
                peakScore: maxScore,
                bottomScore: minAfterMax,
                currentScore: newScore,
                dropAmount,
                recoveryAmount,
                recoveryPercent: Math.round((recoveryAmount / dropAmount) * 100),
            });
        }

        return null;
    }

    /**
     * Check for tier oscillation
     */
    private checkTierOscillation(agentId: string, orgId: string): Anomaly | null {
        const history = this.tierChangeHistory.get(agentId) || [];
        const windowStart = Date.now() - this.thresholds.tierOscillationWindowMs;
        const recentChanges = history.filter((t) => t.timestamp >= windowStart);

        if (recentChanges.length >= this.thresholds.tierOscillationThreshold) {
            return this.createAnomaly(agentId, orgId, 'tier_oscillation', 'low', {
                changeCount: recentChanges.length,
                changes: recentChanges.map((c) => ({
                    from: c.previousTier,
                    to: c.newTier,
                    timestamp: c.timestamp,
                })),
            });
        }

        return null;
    }

    /**
     * Check for coordinated behavior across agents
     */
    checkCoordinatedBehavior(orgId: string): Anomaly | null {
        const windowStart = Date.now() - this.thresholds.coordinatedBehaviorWindowMs;

        // Group events by type and time
        const eventGroups: Map<string, string[]> = new Map();

        for (const [agentId, history] of this.eventHistory) {
            const recentEvents = history.filter(
                (e) => e.orgId === orgId && e.timestamp >= windowStart
            );

            for (const event of recentEvents) {
                // Create time bucket (1-minute granularity)
                const bucket = Math.floor(event.timestamp / 60000);
                const key = `${event.eventType}:${bucket}`;

                const agents = eventGroups.get(key) || [];
                if (!agents.includes(agentId)) {
                    agents.push(agentId);
                    eventGroups.set(key, agents);
                }
            }
        }

        // Find groups with multiple agents
        for (const [key, agents] of eventGroups) {
            if (agents.length >= this.thresholds.coordinatedBehaviorMinAgents) {
                const [eventType] = key.split(':');
                return this.createAnomaly(agents[0], orgId, 'coordinated_behavior', 'high', {
                    eventType,
                    agentCount: agents.length,
                    agents,
                });
            }
        }

        return null;
    }

    // =========================================================================
    // Anomaly Management
    // =========================================================================

    /**
     * Create and store an anomaly
     */
    private createAnomaly(
        agentId: string,
        orgId: string,
        type: AnomalyType,
        severity: AnomalySeverity,
        metadata: Record<string, unknown>
    ): Anomaly {
        const id = this.generateAnomalyId();
        const anomaly: Anomaly = {
            id,
            type,
            severity,
            agentId,
            orgId,
            description: this.getAnomalyDescription(type, metadata),
            detectedAt: new Date(),
            metadata,
            acknowledged: false,
        };

        this.anomalies.set(id, anomaly);
        this.emit('anomaly:detected', anomaly);

        // Auto-escalate critical anomalies
        if (severity === 'critical') {
            this.emit('anomaly:escalated', anomaly);
        }

        return anomaly;
    }

    /**
     * Get human-readable description for anomaly
     */
    private getAnomalyDescription(type: AnomalyType, metadata: Record<string, unknown>): string {
        switch (type) {
            case 'rapid_score_drop':
                return `Trust score dropped by ${metadata.totalDrop || metadata.drop} points in a short period`;
            case 'unusual_failure_rate':
                return `Failure rate ${metadata.multiplier}x higher than baseline (${Math.round((metadata.failureRate as number) * 100)}%)`;
            case 'score_manipulation':
                return 'Suspicious score pattern detected that may indicate manipulation';
            case 'coordinated_behavior':
                return `${metadata.agentCount} agents performed ${metadata.eventType} events simultaneously`;
            case 'sudden_recovery':
                return `Score recovered ${metadata.recoveryPercent}% of a ${metadata.dropAmount} point drop unusually quickly`;
            case 'repeated_violations':
                return `${metadata.violationCount} violations detected in the last hour`;
            case 'tier_oscillation':
                return `Agent tier changed ${metadata.changeCount} times in 24 hours`;
            default:
                return 'Unknown anomaly detected';
        }
    }

    /**
     * Get all anomalies
     */
    getAnomalies(options?: {
        agentId?: string;
        orgId?: string;
        type?: AnomalyType;
        severity?: AnomalySeverity;
        acknowledged?: boolean;
        resolved?: boolean;
    }): Anomaly[] {
        let anomalies = Array.from(this.anomalies.values());

        if (options?.agentId) {
            anomalies = anomalies.filter((a) => a.agentId === options.agentId);
        }
        if (options?.orgId) {
            anomalies = anomalies.filter((a) => a.orgId === options.orgId);
        }
        if (options?.type) {
            anomalies = anomalies.filter((a) => a.type === options.type);
        }
        if (options?.severity) {
            anomalies = anomalies.filter((a) => a.severity === options.severity);
        }
        if (options?.acknowledged !== undefined) {
            anomalies = anomalies.filter((a) => a.acknowledged === options.acknowledged);
        }
        if (options?.resolved !== undefined) {
            anomalies = anomalies.filter((a) =>
                options.resolved ? a.resolvedAt !== undefined : a.resolvedAt === undefined
            );
        }

        return anomalies.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
    }

    /**
     * Get anomaly by ID
     */
    getAnomaly(id: string): Anomaly | null {
        return this.anomalies.get(id) || null;
    }

    /**
     * Acknowledge an anomaly
     */
    acknowledgeAnomaly(id: string): boolean {
        const anomaly = this.anomalies.get(id);
        if (!anomaly) return false;

        anomaly.acknowledged = true;
        return true;
    }

    /**
     * Resolve an anomaly
     */
    resolveAnomaly(id: string): boolean {
        const anomaly = this.anomalies.get(id);
        if (!anomaly) return false;

        anomaly.resolvedAt = new Date();
        this.emit('anomaly:resolved', anomaly);
        return true;
    }

    /**
     * Get anomaly counts by severity
     */
    getAnomalyCounts(orgId?: string): Record<AnomalySeverity, number> {
        const counts: Record<AnomalySeverity, number> = {
            low: 0,
            medium: 0,
            high: 0,
            critical: 0,
        };

        for (const anomaly of this.anomalies.values()) {
            if (orgId && anomaly.orgId !== orgId) continue;
            if (anomaly.resolvedAt) continue;
            counts[anomaly.severity]++;
        }

        return counts;
    }

    // =========================================================================
    // Configuration
    // =========================================================================

    /**
     * Set baseline failure rate for an org
     */
    setOrgBaselineFailureRate(orgId: string, rate: number): void {
        this.orgBaselineFailureRates.set(orgId, rate);
    }

    /**
     * Update thresholds
     */
    updateThresholds(thresholds: Partial<AnomalyThresholds>): void {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    /**
     * Get current thresholds
     */
    getThresholds(): AnomalyThresholds {
        return { ...this.thresholds };
    }

    // =========================================================================
    // Batch Analysis
    // =========================================================================

    /**
     * Start batch checking interval
     */
    private startBatchChecking(): void {
        if (this.batchCheckTimer) return;

        this.batchCheckTimer = setInterval(() => {
            this.runBatchAnalysis();
        }, this.batchCheckIntervalMs);
    }

    /**
     * Stop batch checking
     */
    stopBatchChecking(): void {
        if (this.batchCheckTimer) {
            clearInterval(this.batchCheckTimer);
            this.batchCheckTimer = undefined;
        }
    }

    /**
     * Run batch analysis for all orgs
     */
    runBatchAnalysis(): void {
        // Collect all org IDs
        const orgIds = new Set<string>();

        for (const history of this.eventHistory.values()) {
            for (const event of history) {
                orgIds.add(event.orgId);
            }
        }

        // Check coordinated behavior per org
        for (const orgId of orgIds) {
            this.checkCoordinatedBehavior(orgId);
        }
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /**
     * Prune old history for an agent
     */
    private pruneHistory(agentId: string): void {
        const maxAge = Math.max(
            this.thresholds.rapidDropWindowMs,
            this.thresholds.failureRateWindowMs,
            this.thresholds.tierOscillationWindowMs
        );
        const cutoff = Date.now() - maxAge;

        // Prune score history
        const scores = this.scoreHistory.get(agentId);
        if (scores) {
            this.scoreHistory.set(
                agentId,
                scores.filter((s) => s.timestamp >= cutoff)
            );
        }

        // Prune event history
        const events = this.eventHistory.get(agentId);
        if (events) {
            this.eventHistory.set(
                agentId,
                events.filter((e) => e.timestamp >= cutoff)
            );
        }

        // Prune tier change history
        const tierChanges = this.tierChangeHistory.get(agentId);
        if (tierChanges) {
            this.tierChangeHistory.set(
                agentId,
                tierChanges.filter((t) => t.timestamp >= cutoff)
            );
        }
    }

    /**
     * Clear all state
     */
    clear(): void {
        this.stopBatchChecking();
        this.anomalies.clear();
        this.scoreHistory.clear();
        this.eventHistory.clear();
        this.tierChangeHistory.clear();
        this.orgBaselineFailureRates.clear();
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    private generateAnomalyId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `anom_${timestamp}_${random}`;
    }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: TrustAnomalyDetector | null = null;

export function getTrustAnomalyDetector(config?: AnomalyDetectorConfig): TrustAnomalyDetector {
    if (!instance) {
        instance = new TrustAnomalyDetector(config);
    }
    return instance;
}

export function resetTrustAnomalyDetector(): void {
    if (instance) {
        instance.clear();
    }
    instance = null;
}

export default TrustAnomalyDetector;
