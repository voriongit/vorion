/**
 * Decision Analytics Tests
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.7: Decision Analytics
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    DecisionAnalytics,
    getDecisionAnalytics,
    resetDecisionAnalytics,
    type DecisionRecord,
    type RiskLevel,
    type DecisionSource,
    type DecisionOutcome,
} from './DecisionAnalytics.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createDecision(
    analytics: DecisionAnalytics,
    overrides: Partial<{
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
        trustScore: number;
        wasOverridden: boolean;
        overrideReason: string;
    }> = {}
): DecisionRecord {
    const createdAt = overrides.createdAt || new Date();
    const decidedAt = overrides.decidedAt || new Date(createdAt.getTime() + 1000);

    return analytics.recordDecision(
        overrides.id || `dec_${Date.now()}_${Math.random()}`,
        overrides.requestId || `req_${Date.now()}`,
        overrides.orgId || 'org_1',
        overrides.agentId || 'agent_1',
        overrides.actionType || 'execute',
        overrides.riskLevel || 'low',
        overrides.source || 'auto_approval',
        overrides.outcome || 'approved',
        createdAt,
        decidedAt,
        overrides.trustScore || 850,
        {
            wasOverridden: overrides.wasOverridden,
            overrideReason: overrides.overrideReason,
        }
    );
}

// ============================================================================
// Tests
// ============================================================================

describe('DecisionAnalytics', () => {
    let analytics: DecisionAnalytics;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
        resetDecisionAnalytics();
        analytics = new DecisionAnalytics({ trackActionTypes: true });
    });

    afterEach(() => {
        vi.useRealTimers();
        analytics.clear();
    });

    // =========================================================================
    // Decision Recording
    // =========================================================================

    describe('recordDecision', () => {
        it('should record a decision', () => {
            const record = createDecision(analytics);

            expect(record.id).toBeDefined();
            expect(record.outcome).toBe('approved');
            expect(analytics.recordCount).toBe(1);
        });

        it('should calculate decision time correctly', () => {
            const createdAt = new Date('2025-01-15T10:00:00Z');
            const decidedAt = new Date('2025-01-15T10:05:00Z');

            const record = createDecision(analytics, { createdAt, decidedAt });

            expect(record.decisionTimeMs).toBe(5 * 60 * 1000); // 5 minutes
        });

        it('should emit decision:recorded event', () => {
            const handler = vi.fn();
            analytics.on('decision:recorded', handler);

            createDecision(analytics);

            expect(handler).toHaveBeenCalled();
        });

        it('should index by org and agent', () => {
            createDecision(analytics, { orgId: 'org_1', agentId: 'agent_1' });
            createDecision(analytics, { orgId: 'org_1', agentId: 'agent_2' });
            createDecision(analytics, { orgId: 'org_2', agentId: 'agent_3' });

            const summary = analytics.getAnalyticsSummary('org_1');
            expect(summary.totalDecisions).toBe(2);
        });
    });

    describe('recordOverride', () => {
        it('should update record with override info', () => {
            const record = createDecision(analytics, { id: 'dec_1' });

            const result = analytics.recordOverride('dec_1', 'Security concern', 'denied');

            expect(result).toBe(true);
            const updated = analytics.getRecord('dec_1');
            expect(updated?.wasOverridden).toBe(true);
            expect(updated?.overrideReason).toBe('Security concern');
            expect(updated?.outcome).toBe('denied');
        });

        it('should return false for unknown record', () => {
            const result = analytics.recordOverride('unknown', 'reason', 'denied');
            expect(result).toBe(false);
        });
    });

    // =========================================================================
    // Auto-Approval Metrics
    // =========================================================================

    describe('getAutoApprovalMetrics', () => {
        it('should calculate auto-approval rate', () => {
            createDecision(analytics, { source: 'auto_approval', outcome: 'approved' });
            createDecision(analytics, { source: 'auto_approval', outcome: 'approved' });
            createDecision(analytics, { source: 'tribunal', outcome: 'approved' });
            createDecision(analytics, { source: 'hitl', outcome: 'denied' });

            const metrics = analytics.getAutoApprovalMetrics('org_1');

            expect(metrics.totalRequests).toBe(4);
            expect(metrics.autoApproved).toBe(2);
            expect(metrics.rate).toBe(0.5);
        });

        it('should track by action type', () => {
            createDecision(analytics, {
                actionType: 'execute',
                source: 'auto_approval',
                outcome: 'approved',
            });
            createDecision(analytics, {
                actionType: 'execute',
                source: 'tribunal',
                outcome: 'approved',
            });
            createDecision(analytics, {
                actionType: 'external',
                source: 'auto_approval',
                outcome: 'approved',
            });

            const metrics = analytics.getAutoApprovalMetrics('org_1');

            expect(metrics.byActionType['execute'].total).toBe(2);
            expect(metrics.byActionType['execute'].approved).toBe(1);
            expect(metrics.byActionType['execute'].rate).toBe(0.5);
        });

        it('should return zero rate for no records', () => {
            const metrics = analytics.getAutoApprovalMetrics('org_1');

            expect(metrics.rate).toBe(0);
            expect(metrics.totalRequests).toBe(0);
        });
    });

    // =========================================================================
    // Decision Time Metrics
    // =========================================================================

    describe('getDecisionTimeMetrics', () => {
        it('should calculate overall statistics', () => {
            const base = new Date('2025-01-15T10:00:00Z');
            createDecision(analytics, {
                createdAt: base,
                decidedAt: new Date(base.getTime() + 1000),
            });
            createDecision(analytics, {
                createdAt: base,
                decidedAt: new Date(base.getTime() + 2000),
            });
            createDecision(analytics, {
                createdAt: base,
                decidedAt: new Date(base.getTime() + 3000),
            });

            const metrics = analytics.getDecisionTimeMetrics('org_1');

            expect(metrics.overall.mean).toBe(2000);
            expect(metrics.overall.median).toBe(2000);
        });

        it('should calculate by risk level', () => {
            const base = new Date('2025-01-15T10:00:00Z');
            createDecision(analytics, {
                riskLevel: 'low',
                createdAt: base,
                decidedAt: new Date(base.getTime() + 1000),
            });
            createDecision(analytics, {
                riskLevel: 'high',
                createdAt: base,
                decidedAt: new Date(base.getTime() + 5000),
            });

            const metrics = analytics.getDecisionTimeMetrics('org_1');

            expect(metrics.byRiskLevel.low.mean).toBe(1000);
            expect(metrics.byRiskLevel.high.mean).toBe(5000);
        });

        it('should calculate by source', () => {
            const base = new Date('2025-01-15T10:00:00Z');
            createDecision(analytics, {
                source: 'auto_approval',
                createdAt: base,
                decidedAt: new Date(base.getTime() + 100),
            });
            createDecision(analytics, {
                source: 'hitl',
                createdAt: base,
                decidedAt: new Date(base.getTime() + 60000),
            });

            const metrics = analytics.getDecisionTimeMetrics('org_1');

            expect(metrics.bySource.auto_approval.mean).toBe(100);
            expect(metrics.bySource.hitl.mean).toBe(60000);
        });
    });

    // =========================================================================
    // Override Metrics
    // =========================================================================

    describe('getOverrideMetrics', () => {
        it('should track override counts', () => {
            createDecision(analytics, { source: 'auto_approval', wasOverridden: true });
            createDecision(analytics, { source: 'auto_approval', wasOverridden: false });
            createDecision(analytics, { source: 'tribunal', wasOverridden: true });

            const metrics = analytics.getOverrideMetrics('org_1');

            expect(metrics.total).toBe(2);
            expect(metrics.bySource.auto_approval.overridden).toBe(1);
            expect(metrics.bySource.auto_approval.rate).toBe(0.5);
        });

        it('should track override reasons', () => {
            createDecision(analytics, { wasOverridden: true, overrideReason: 'Security' });
            createDecision(analytics, { wasOverridden: true, overrideReason: 'Security' });
            createDecision(analytics, { wasOverridden: true, overrideReason: 'Policy' });

            const metrics = analytics.getOverrideMetrics('org_1');

            expect(metrics.reasons['Security']).toBe(2);
            expect(metrics.reasons['Policy']).toBe(1);
        });
    });

    // =========================================================================
    // False Positive Metrics
    // =========================================================================

    describe('getFalsePositiveMetrics', () => {
        it('should calculate false positive rate', () => {
            // Auto-approved and not overridden (true positive)
            createDecision(analytics, {
                source: 'auto_approval',
                outcome: 'approved',
                wasOverridden: false,
            });
            createDecision(analytics, {
                source: 'auto_approval',
                outcome: 'approved',
                wasOverridden: false,
            });
            // Auto-approved but overridden (false positive)
            createDecision(analytics, {
                source: 'auto_approval',
                outcome: 'approved',
                wasOverridden: true,
            });

            const metrics = analytics.getFalsePositiveMetrics('org_1');

            expect(metrics.autoApprovalFalsePositives).toBe(1);
            expect(metrics.totalDecisions).toBe(3);
            expect(metrics.rate).toBeCloseTo(0.333, 2);
        });

        it('should track tribunal overturned', () => {
            createDecision(analytics, {
                source: 'tribunal',
                outcome: 'approved',
                wasOverridden: true,
            });
            createDecision(analytics, {
                source: 'tribunal',
                outcome: 'approved',
                wasOverridden: false,
            });

            const metrics = analytics.getFalsePositiveMetrics('org_1');

            expect(metrics.tribunalOverturned).toBe(1);
        });

        it('should track by action type', () => {
            createDecision(analytics, {
                actionType: 'execute',
                source: 'auto_approval',
                outcome: 'approved',
                wasOverridden: false,
            });
            createDecision(analytics, {
                actionType: 'execute',
                source: 'auto_approval',
                outcome: 'approved',
                wasOverridden: true,
            });

            const metrics = analytics.getFalsePositiveMetrics('org_1');

            expect(metrics.byActionType['execute'].total).toBe(2);
            expect(metrics.byActionType['execute'].falsePositives).toBe(1);
            expect(metrics.byActionType['execute'].rate).toBe(0.5);
        });
    });

    // =========================================================================
    // Summary
    // =========================================================================

    describe('getAnalyticsSummary', () => {
        it('should return comprehensive summary', () => {
            createDecision(analytics, { source: 'auto_approval', outcome: 'approved', riskLevel: 'low' });
            createDecision(analytics, { source: 'tribunal', outcome: 'denied', riskLevel: 'high' });
            createDecision(analytics, { source: 'hitl', outcome: 'approved', riskLevel: 'medium' });

            const summary = analytics.getAnalyticsSummary('org_1');

            expect(summary.totalDecisions).toBe(3);
            expect(summary.bySource.auto_approval).toBe(1);
            expect(summary.bySource.tribunal).toBe(1);
            expect(summary.bySource.hitl).toBe(1);
            expect(summary.byOutcome.approved).toBe(2);
            expect(summary.byOutcome.denied).toBe(1);
            expect(summary.byRiskLevel.low).toBe(1);
            expect(summary.byRiskLevel.high).toBe(1);
        });

        it('should filter by date range', () => {
            const old = new Date('2025-01-01T10:00:00Z');
            const recent = new Date('2025-01-15T10:00:00Z');

            createDecision(analytics, { createdAt: old, decidedAt: old });
            createDecision(analytics, { createdAt: recent, decidedAt: recent });

            const summary = analytics.getAnalyticsSummary('org_1', {
                startDate: new Date('2025-01-10T00:00:00Z'),
            });

            expect(summary.totalDecisions).toBe(1);
        });
    });

    // =========================================================================
    // Agent Analytics
    // =========================================================================

    describe('getAgentAnalytics', () => {
        it('should return agent-specific analytics', () => {
            createDecision(analytics, { agentId: 'agent_1', outcome: 'approved' });
            createDecision(analytics, { agentId: 'agent_1', outcome: 'denied' });
            createDecision(analytics, { agentId: 'agent_2', outcome: 'approved' });

            const agentAnalytics = analytics.getAgentAnalytics('agent_1');

            expect(agentAnalytics.totalDecisions).toBe(2);
            expect(agentAnalytics.approvalRate).toBe(0.5);
        });

        it('should calculate override rate for agent', () => {
            createDecision(analytics, { agentId: 'agent_1', wasOverridden: true });
            createDecision(analytics, { agentId: 'agent_1', wasOverridden: false });

            const agentAnalytics = analytics.getAgentAnalytics('agent_1');

            expect(agentAnalytics.overrideRate).toBe(0.5);
        });
    });

    // =========================================================================
    // Action Type Analytics
    // =========================================================================

    describe('getActionTypeAnalytics', () => {
        it('should return action-specific analytics', () => {
            createDecision(analytics, {
                actionType: 'execute',
                source: 'auto_approval',
                outcome: 'approved',
            });
            createDecision(analytics, {
                actionType: 'execute',
                source: 'tribunal',
                outcome: 'denied',
            });

            const actionAnalytics = analytics.getActionTypeAnalytics('org_1', 'execute');

            expect(actionAnalytics.total).toBe(2);
            expect(actionAnalytics.approvalRate).toBe(0.5);
            expect(actionAnalytics.autoApprovalRate).toBe(0.5);
        });
    });

    // =========================================================================
    // Thresholds
    // =========================================================================

    describe('thresholds', () => {
        it('should set and get threshold', () => {
            analytics.setThreshold('org_1', 'autoApprovalRate', 0.7);

            const threshold = analytics.getThreshold('org_1', 'autoApprovalRate');

            expect(threshold).toBe(0.7);
        });

        it('should emit threshold:alert when exceeded', () => {
            const handler = vi.fn();
            analytics.on('threshold:alert', handler);
            analytics.setThreshold('org_1', 'autoApprovalRate', 0.8);

            // Create records with low auto-approval rate
            createDecision(analytics, { source: 'tribunal', outcome: 'approved' });
            createDecision(analytics, { source: 'hitl', outcome: 'approved' });

            expect(handler).toHaveBeenCalled();
            expect(handler.mock.calls[0][0].metric).toBe('autoApprovalRate');
        });

        it('should clear threshold', () => {
            analytics.setThreshold('org_1', 'autoApprovalRate', 0.7);

            const cleared = analytics.clearThreshold('org_1', 'autoApprovalRate');

            expect(cleared).toBe(true);
            expect(analytics.getThreshold('org_1', 'autoApprovalRate')).toBeNull();
        });
    });

    // =========================================================================
    // Record Retrieval
    // =========================================================================

    describe('getRecord', () => {
        it('should return record by ID', () => {
            createDecision(analytics, { id: 'dec_123' });

            const record = analytics.getRecord('dec_123');

            expect(record?.id).toBe('dec_123');
        });

        it('should return null for unknown ID', () => {
            const record = analytics.getRecord('unknown');
            expect(record).toBeNull();
        });
    });

    describe('getRecordByRequestId', () => {
        it('should return record by request ID', () => {
            createDecision(analytics, { requestId: 'req_456' });

            const record = analytics.getRecordByRequestId('req_456');

            expect(record?.requestId).toBe('req_456');
        });
    });

    describe('getRecentRecords', () => {
        it('should return recent records sorted by date', () => {
            const older = new Date('2025-01-14T10:00:00Z');
            const newer = new Date('2025-01-15T10:00:00Z');

            createDecision(analytics, { id: 'dec_1', createdAt: older, decidedAt: older });
            createDecision(analytics, { id: 'dec_2', createdAt: newer, decidedAt: newer });

            const recent = analytics.getRecentRecords('org_1', 10);

            expect(recent[0].id).toBe('dec_2'); // Newer first
        });

        it('should filter by source', () => {
            createDecision(analytics, { source: 'auto_approval' });
            createDecision(analytics, { source: 'tribunal' });

            const recent = analytics.getRecentRecords('org_1', 10, { source: 'tribunal' });

            expect(recent.length).toBe(1);
            expect(recent[0].source).toBe('tribunal');
        });

        it('should filter by outcome', () => {
            createDecision(analytics, { outcome: 'approved' });
            createDecision(analytics, { outcome: 'denied' });

            const recent = analytics.getRecentRecords('org_1', 10, { outcome: 'denied' });

            expect(recent.length).toBe(1);
            expect(recent[0].outcome).toBe('denied');
        });

        it('should filter by risk level', () => {
            createDecision(analytics, { riskLevel: 'low' });
            createDecision(analytics, { riskLevel: 'critical' });

            const recent = analytics.getRecentRecords('org_1', 10, { riskLevel: 'critical' });

            expect(recent.length).toBe(1);
            expect(recent[0].riskLevel).toBe('critical');
        });

        it('should respect limit', () => {
            for (let i = 0; i < 20; i++) {
                createDecision(analytics);
            }

            const recent = analytics.getRecentRecords('org_1', 5);

            expect(recent.length).toBe(5);
        });
    });

    // =========================================================================
    // Trends
    // =========================================================================

    describe('trends', () => {
        it('should calculate positive auto-approval trend', () => {
            // Set up two windows of data
            const windowDays = 7;
            const msPerDay = 24 * 60 * 60 * 1000;

            // Previous window: low auto-approval
            const previousStart = new Date(Date.now() - 2 * windowDays * msPerDay);
            for (let i = 0; i < 5; i++) {
                createDecision(analytics, {
                    source: 'hitl',
                    outcome: 'approved',
                    createdAt: previousStart,
                    decidedAt: previousStart,
                });
            }
            createDecision(analytics, {
                source: 'auto_approval',
                outcome: 'approved',
                createdAt: previousStart,
                decidedAt: previousStart,
            });

            // Current window: high auto-approval
            const currentStart = new Date(Date.now() - 1 * msPerDay);
            for (let i = 0; i < 4; i++) {
                createDecision(analytics, {
                    source: 'auto_approval',
                    outcome: 'approved',
                    createdAt: currentStart,
                    decidedAt: currentStart,
                });
            }
            createDecision(analytics, {
                source: 'hitl',
                outcome: 'approved',
                createdAt: currentStart,
                decidedAt: currentStart,
            });

            const summary = analytics.getAnalyticsSummary('org_1');

            expect(summary.trends.autoApprovalRateTrend).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // Configuration
    // =========================================================================

    describe('configuration', () => {
        it('should update config', () => {
            analytics.updateConfig({ retentionDays: 30 });

            const config = analytics.getConfig();

            expect(config.retentionDays).toBe(30);
        });
    });

    // =========================================================================
    // Statistics
    // =========================================================================

    describe('getStats', () => {
        it('should return overall statistics', () => {
            createDecision(analytics, { orgId: 'org_1', agentId: 'agent_1' });
            createDecision(analytics, { orgId: 'org_2', agentId: 'agent_2' });

            const stats = analytics.getStats();

            expect(stats.totalRecords).toBe(2);
            expect(stats.uniqueOrgs).toBe(2);
            expect(stats.uniqueAgents).toBe(2);
        });
    });

    // =========================================================================
    // Lifecycle
    // =========================================================================

    describe('cleanup', () => {
        it('should remove old records', () => {
            const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
            createDecision(analytics, { createdAt: old, decidedAt: old });
            createDecision(analytics);

            const removed = analytics.cleanup();

            expect(removed).toBe(1);
            expect(analytics.recordCount).toBe(1);
        });
    });

    describe('clear', () => {
        it('should clear all data', () => {
            createDecision(analytics);
            analytics.setThreshold('org_1', 'test', 0.5);

            analytics.clear();

            expect(analytics.recordCount).toBe(0);
            expect(analytics.getThreshold('org_1', 'test')).toBeNull();
        });
    });

    // =========================================================================
    // Max Records
    // =========================================================================

    describe('maxRecords', () => {
        it('should enforce max records limit', () => {
            analytics.updateConfig({ maxRecords: 5 });

            for (let i = 0; i < 10; i++) {
                createDecision(analytics);
            }

            expect(analytics.recordCount).toBeLessThanOrEqual(5);
        });
    });

    // =========================================================================
    // Singleton
    // =========================================================================

    describe('singleton', () => {
        it('should return same instance', () => {
            resetDecisionAnalytics();
            const instance1 = getDecisionAnalytics();
            const instance2 = getDecisionAnalytics();

            expect(instance1).toBe(instance2);

            instance1.clear();
        });

        it('should reset properly', () => {
            const instance1 = getDecisionAnalytics();
            createDecision(instance1);

            resetDecisionAnalytics();
            const instance2 = getDecisionAnalytics();

            expect(instance2.recordCount).toBe(0);

            instance2.clear();
        });
    });
});
