/**
 * TrustAnomalyDetector Tests
 *
 * Epic 11: Live Trust Scoring Engine
 * Story 11.6: Trust Anomaly Detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    TrustAnomalyDetector,
    resetTrustAnomalyDetector,
    type Anomaly,
} from './TrustAnomalyDetector.js';

describe('TrustAnomalyDetector', () => {
    let detector: TrustAnomalyDetector;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
        resetTrustAnomalyDetector();
        detector = new TrustAnomalyDetector({
            realTimeMonitoring: true,
            batchCheckIntervalMs: 0, // Disable automatic batch checking
        });
    });

    afterEach(() => {
        detector.clear();
        vi.useRealTimers();
    });

    // =========================================================================
    // Rapid Score Drop
    // =========================================================================

    describe('Rapid Score Drop', () => {
        it('should detect rapid score drop', () => {
            const anomalies: Anomaly[] = [];
            detector.on('anomaly:detected', (a) => anomalies.push(a));

            // Drop 60 points at once (above threshold of 50)
            detector.recordScoreChange('agent_1', 'org_1', 400, 340);

            expect(anomalies.length).toBe(1);
            expect(anomalies[0].type).toBe('rapid_score_drop');
            expect(anomalies[0].severity).toBe('high');
        });

        it('should not trigger for small drops', () => {
            const anomalies: Anomaly[] = [];
            detector.on('anomaly:detected', (a) => anomalies.push(a));

            // Drop 20 points (below threshold)
            detector.recordScoreChange('agent_1', 'org_1', 400, 380);

            expect(anomalies.length).toBe(0);
        });

        it('should detect cumulative drops in time window', () => {
            const anomalies: Anomaly[] = [];
            detector.on('anomaly:detected', (a) => anomalies.push(a));

            // Multiple small drops that cumulate to >50
            // First we need an initial score snapshot
            detector.recordScoreChange('agent_1', 'org_1', 450, 400);
            detector.recordScoreChange('agent_1', 'org_1', 400, 380);
            detector.recordScoreChange('agent_1', 'org_1', 380, 360);
            detector.recordScoreChange('agent_1', 'org_1', 360, 340);

            // Should detect cumulative drop (450 -> 340 = 110 points in history)
            expect(anomalies.some((a) => a.type === 'rapid_score_drop')).toBe(true);
        });

        it('should not detect drops outside time window', () => {
            const anomalies: Anomaly[] = [];
            detector.on('anomaly:detected', (a) => anomalies.push(a));

            // Drop 30 points
            detector.recordScoreChange('agent_1', 'org_1', 400, 370);

            // Wait 2 hours (outside window)
            vi.advanceTimersByTime(2 * 60 * 60 * 1000);

            // Drop another 30 points
            detector.recordScoreChange('agent_1', 'org_1', 370, 340);

            // Should not trigger cumulative detection
            const rapidDropAnomalies = anomalies.filter((a) => a.type === 'rapid_score_drop');
            expect(rapidDropAnomalies.length).toBe(0);
        });
    });

    // =========================================================================
    // Unusual Failure Rate
    // =========================================================================

    describe('Unusual Failure Rate', () => {
        it('should detect unusual failure rate', () => {
            const anomalies: Anomaly[] = [];
            detector.on('anomaly:detected', (a) => anomalies.push(a));

            // Record many failures (5 total events, all failures = 100% rate)
            detector.recordEvent('agent_1', 'org_1', 'task_failed', -15);
            detector.recordEvent('agent_1', 'org_1', 'task_failed', -15);
            detector.recordEvent('agent_1', 'org_1', 'task_timeout', -10);
            detector.recordEvent('agent_1', 'org_1', 'task_failed', -15);
            detector.recordEvent('agent_1', 'org_1', 'task_failed', -15);

            expect(anomalies.some((a) => a.type === 'unusual_failure_rate')).toBe(true);
        });

        it('should use org baseline for comparison', () => {
            detector.setOrgBaselineFailureRate('org_1', 0.3); // 30% baseline

            const anomalies: Anomaly[] = [];
            detector.on('anomaly:detected', (a) => anomalies.push(a));

            // 4 successes, 3 failures = ~43% rate, which is <3x of 30%
            detector.recordEvent('agent_1', 'org_1', 'task_completed', 10);
            detector.recordEvent('agent_1', 'org_1', 'task_completed', 10);
            detector.recordEvent('agent_1', 'org_1', 'task_completed', 10);
            detector.recordEvent('agent_1', 'org_1', 'task_completed', 10);
            detector.recordEvent('agent_1', 'org_1', 'task_failed', -15);
            detector.recordEvent('agent_1', 'org_1', 'task_failed', -15);
            detector.recordEvent('agent_1', 'org_1', 'task_failed', -15);

            // Should not trigger with 43% when baseline is 30%
            expect(anomalies.filter((a) => a.type === 'unusual_failure_rate').length).toBe(0);
        });

        it('should require minimum events', () => {
            const anomalies: Anomaly[] = [];
            detector.on('anomaly:detected', (a) => anomalies.push(a));

            // Only 3 events (below minimum of 5)
            detector.recordEvent('agent_1', 'org_1', 'task_failed', -15);
            detector.recordEvent('agent_1', 'org_1', 'task_failed', -15);
            detector.recordEvent('agent_1', 'org_1', 'task_failed', -15);

            expect(anomalies.filter((a) => a.type === 'unusual_failure_rate').length).toBe(0);
        });
    });

    // =========================================================================
    // Repeated Violations
    // =========================================================================

    describe('Repeated Violations', () => {
        it('should detect repeated violations', () => {
            const anomalies: Anomaly[] = [];
            detector.on('anomaly:detected', (a) => anomalies.push(a));

            // 3 security violations in an hour
            detector.recordEvent('agent_1', 'org_1', 'security_violation', -50);
            detector.recordEvent('agent_1', 'org_1', 'security_violation', -50);
            detector.recordEvent('agent_1', 'org_1', 'security_violation', -50);

            expect(anomalies.some((a) => a.type === 'repeated_violations')).toBe(true);
        });

        it('should mark security violations as critical', () => {
            const anomalies: Anomaly[] = [];
            detector.on('anomaly:detected', (a) => anomalies.push(a));

            detector.recordEvent('agent_1', 'org_1', 'security_violation', -50);
            detector.recordEvent('agent_1', 'org_1', 'security_violation', -50);
            detector.recordEvent('agent_1', 'org_1', 'security_violation', -50);

            const violation = anomalies.find((a) => a.type === 'repeated_violations');
            expect(violation?.severity).toBe('critical');
        });

        it('should escalate critical anomalies', () => {
            const escalated: Anomaly[] = [];
            detector.on('anomaly:escalated', (a) => escalated.push(a));

            detector.recordEvent('agent_1', 'org_1', 'security_violation', -50);
            detector.recordEvent('agent_1', 'org_1', 'security_violation', -50);
            detector.recordEvent('agent_1', 'org_1', 'security_violation', -50);

            expect(escalated.length).toBe(1);
        });
    });

    // =========================================================================
    // Sudden Recovery
    // =========================================================================

    describe('Sudden Recovery', () => {
        it('should detect suspicious sudden recovery', () => {
            const anomalies: Anomaly[] = [];
            detector.on('anomaly:detected', (a) => anomalies.push(a));

            // Start at stable score
            detector.recordScoreChange('agent_1', 'org_1', 480, 500); // Peak

            // Advance a bit
            vi.advanceTimersByTime(2 * 60 * 1000);

            // Big drop
            detector.recordScoreChange('agent_1', 'org_1', 500, 420); // -80

            // Advance a bit more
            vi.advanceTimersByTime(2 * 60 * 1000);

            // Quick near-complete recovery
            detector.recordScoreChange('agent_1', 'org_1', 420, 495); // +75

            expect(anomalies.some((a) => a.type === 'sudden_recovery')).toBe(true);
        });
    });

    // =========================================================================
    // Tier Oscillation
    // =========================================================================

    describe('Tier Oscillation', () => {
        it('should detect tier oscillation', () => {
            const anomalies: Anomaly[] = [];
            detector.on('anomaly:detected', (a) => anomalies.push(a));

            // 3 tier changes in 24 hours
            detector.recordTierChange('agent_1', 'org_1', 'TRUSTED', 'VERIFIED');
            vi.advanceTimersByTime(1000);
            detector.recordTierChange('agent_1', 'org_1', 'VERIFIED', 'TRUSTED');
            vi.advanceTimersByTime(1000);
            detector.recordTierChange('agent_1', 'org_1', 'TRUSTED', 'VERIFIED');

            expect(anomalies.some((a) => a.type === 'tier_oscillation')).toBe(true);
        });

        it('should not trigger below threshold', () => {
            const anomalies: Anomaly[] = [];
            detector.on('anomaly:detected', (a) => anomalies.push(a));

            // Only 2 tier changes
            detector.recordTierChange('agent_1', 'org_1', 'TRUSTED', 'VERIFIED');
            detector.recordTierChange('agent_1', 'org_1', 'VERIFIED', 'CERTIFIED');

            expect(anomalies.filter((a) => a.type === 'tier_oscillation').length).toBe(0);
        });
    });

    // =========================================================================
    // Coordinated Behavior
    // =========================================================================

    describe('Coordinated Behavior', () => {
        it('should detect coordinated behavior', () => {
            // Record same event type from multiple agents at similar times
            detector.recordEvent('agent_1', 'org_1', 'task_failed', -15);
            detector.recordEvent('agent_2', 'org_1', 'task_failed', -15);
            detector.recordEvent('agent_3', 'org_1', 'task_failed', -15);

            const anomaly = detector.checkCoordinatedBehavior('org_1');

            expect(anomaly).not.toBeNull();
            expect(anomaly?.type).toBe('coordinated_behavior');
            expect(anomaly?.metadata.agentCount).toBe(3);
        });

        it('should not trigger for different orgs', () => {
            detector.recordEvent('agent_1', 'org_1', 'task_failed', -15);
            detector.recordEvent('agent_2', 'org_2', 'task_failed', -15);
            detector.recordEvent('agent_3', 'org_3', 'task_failed', -15);

            const anomaly = detector.checkCoordinatedBehavior('org_1');

            expect(anomaly).toBeNull();
        });
    });

    // =========================================================================
    // Anomaly Management
    // =========================================================================

    describe('Anomaly Management', () => {
        it('should get anomalies by agent', () => {
            detector.recordScoreChange('agent_1', 'org_1', 400, 300);
            detector.recordScoreChange('agent_2', 'org_1', 400, 300);

            const agent1Anomalies = detector.getAnomalies({ agentId: 'agent_1' });

            expect(agent1Anomalies.length).toBe(1);
        });

        it('should get anomalies by severity', () => {
            // Create high severity anomaly
            detector.recordScoreChange('agent_1', 'org_1', 400, 300);

            // Create low severity anomaly
            detector.recordTierChange('agent_2', 'org_1', 'TRUSTED', 'VERIFIED');
            detector.recordTierChange('agent_2', 'org_1', 'VERIFIED', 'TRUSTED');
            detector.recordTierChange('agent_2', 'org_1', 'TRUSTED', 'VERIFIED');

            const highAnomalies = detector.getAnomalies({ severity: 'high' });
            const lowAnomalies = detector.getAnomalies({ severity: 'low' });

            expect(highAnomalies.length).toBe(1);
            expect(lowAnomalies.length).toBe(1);
        });

        it('should acknowledge anomaly', () => {
            detector.recordScoreChange('agent_1', 'org_1', 400, 300);

            const anomalies = detector.getAnomalies();
            const result = detector.acknowledgeAnomaly(anomalies[0].id);

            expect(result).toBe(true);
            expect(anomalies[0].acknowledged).toBe(true);
        });

        it('should resolve anomaly', () => {
            const resolved: Anomaly[] = [];
            detector.on('anomaly:resolved', (a) => resolved.push(a));

            detector.recordScoreChange('agent_1', 'org_1', 400, 300);

            const anomalies = detector.getAnomalies();
            detector.resolveAnomaly(anomalies[0].id);

            expect(resolved.length).toBe(1);
            expect(anomalies[0].resolvedAt).toBeDefined();
        });

        it('should get anomaly counts', () => {
            // Create anomalies
            detector.recordScoreChange('agent_1', 'org_1', 400, 300); // high

            detector.recordEvent('agent_2', 'org_1', 'security_violation', -50);
            detector.recordEvent('agent_2', 'org_1', 'security_violation', -50);
            detector.recordEvent('agent_2', 'org_1', 'security_violation', -50); // critical

            const counts = detector.getAnomalyCounts();

            expect(counts.high).toBeGreaterThanOrEqual(1);
            expect(counts.critical).toBeGreaterThanOrEqual(1);
        });

        it('should filter unresolved anomalies', () => {
            detector.recordScoreChange('agent_1', 'org_1', 400, 300);
            detector.recordScoreChange('agent_2', 'org_1', 400, 300);

            const anomalies = detector.getAnomalies();
            detector.resolveAnomaly(anomalies[0].id);

            const unresolved = detector.getAnomalies({ resolved: false });

            expect(unresolved.length).toBe(1);
        });
    });

    // =========================================================================
    // Configuration
    // =========================================================================

    describe('Configuration', () => {
        it('should allow custom thresholds', () => {
            const customDetector = new TrustAnomalyDetector({
                thresholds: {
                    rapidDropThreshold: 100, // Higher threshold
                },
                batchCheckIntervalMs: 0,
            });

            const anomalies: Anomaly[] = [];
            customDetector.on('anomaly:detected', (a) => anomalies.push(a));

            // 60 point drop won't trigger with 100 threshold
            customDetector.recordScoreChange('agent_1', 'org_1', 400, 340);

            expect(anomalies.filter((a) => a.type === 'rapid_score_drop').length).toBe(0);

            customDetector.clear();
        });

        it('should update thresholds', () => {
            detector.updateThresholds({ rapidDropThreshold: 100 });

            const thresholds = detector.getThresholds();

            expect(thresholds.rapidDropThreshold).toBe(100);
        });
    });

    // =========================================================================
    // Lifecycle
    // =========================================================================

    describe('Lifecycle', () => {
        it('should clear all state', () => {
            detector.recordScoreChange('agent_1', 'org_1', 400, 300);
            detector.recordEvent('agent_1', 'org_1', 'task_completed', 10);
            detector.recordTierChange('agent_1', 'org_1', 'TRUSTED', 'VERIFIED');

            detector.clear();

            expect(detector.getAnomalies().length).toBe(0);
        });

        it('should stop batch checking on clear', () => {
            const batchDetector = new TrustAnomalyDetector({
                batchCheckIntervalMs: 1000,
            });

            batchDetector.clear();

            // Should not throw after clear
            vi.advanceTimersByTime(5000);
        });
    });
});
