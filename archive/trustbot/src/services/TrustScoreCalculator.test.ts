/**
 * TrustScoreCalculator Tests
 *
 * Epic 11: Live Trust Scoring Engine
 * Story 11.1: Trust Score Calculator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    TrustScoreCalculator,
    TrustEventType,
    DEFAULT_EVENT_CONFIG,
    resetTrustScoreCalculator,
} from './TrustScoreCalculator.js';

describe('TrustScoreCalculator', () => {
    let calculator: TrustScoreCalculator;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
        resetTrustScoreCalculator();
        calculator = new TrustScoreCalculator({
            baseScore: 300,
            minScore: 0,
            maxScore: 1000,
        });
    });

    afterEach(() => {
        calculator.clear();
        vi.useRealTimers();
    });

    // =========================================================================
    // Event Recording
    // =========================================================================

    describe('Event Recording', () => {
        it('should record a trust event', () => {
            const event = calculator.recordEvent('agent_1', 'org_1', 'task_completed', {
                reason: 'Task finished successfully',
            });

            expect(event.agentId).toBe('agent_1');
            expect(event.orgId).toBe('org_1');
            expect(event.eventType).toBe('task_completed');
            expect(event.points).toBe(10); // Default for task_completed
            expect(event.reason).toBe('Task finished successfully');
        });

        it('should update score after recording event', () => {
            calculator.initializeAgent('agent_1', 'org_1');
            const initialScore = calculator.getScore('agent_1');

            calculator.recordEvent('agent_1', 'org_1', 'task_completed');

            const newScore = calculator.getScore('agent_1');
            expect(newScore).toBe(initialScore! + 10);
        });

        it('should allow custom points for manual_adjustment', () => {
            calculator.initializeAgent('agent_1', 'org_1');

            calculator.recordEvent('agent_1', 'org_1', 'manual_adjustment', {
                points: 50,
                reason: 'Admin bonus',
            });

            const score = calculator.getScore('agent_1');
            expect(score).toBe(350); // 300 + 50
        });

        it('should record multiple events', () => {
            calculator.initializeAgent('agent_1', 'org_1');

            calculator.recordEvents('agent_1', 'org_1', [
                { eventType: 'task_completed' },
                { eventType: 'task_completed' },
                { eventType: 'task_reviewed_positive' },
            ]);

            const score = calculator.getScore('agent_1');
            expect(score).toBe(325); // 300 + 10 + 10 + 5
        });

        it('should emit event:recorded event', () => {
            const events: any[] = [];
            calculator.on('event:recorded', (event) => events.push(event));

            calculator.recordEvent('agent_1', 'org_1', 'task_completed');

            expect(events.length).toBe(1);
            expect(events[0].eventType).toBe('task_completed');
        });

        it('should emit score:changed event', () => {
            calculator.initializeAgent('agent_1', 'org_1');

            const changes: any[] = [];
            calculator.on('score:changed', (change) => changes.push(change));

            calculator.recordEvent('agent_1', 'org_1', 'task_failed');

            expect(changes.length).toBe(1);
            expect(changes[0].oldScore).toBe(300);
            expect(changes[0].newScore).toBe(285);
            expect(changes[0].delta).toBe(-15);
        });
    });

    // =========================================================================
    // Score Calculation
    // =========================================================================

    describe('Score Calculation', () => {
        it('should calculate score from base + events', () => {
            calculator.initializeAgent('agent_1', 'org_1');

            calculator.recordEvent('agent_1', 'org_1', 'task_completed'); // +10
            calculator.recordEvent('agent_1', 'org_1', 'task_failed'); // -15

            const score = calculator.getScore('agent_1');
            expect(score).toBe(295); // 300 + 10 - 15
        });

        it('should respect minScore bound', () => {
            calculator.initializeAgent('agent_1', 'org_1', 50);

            // Record many negative events
            for (let i = 0; i < 10; i++) {
                calculator.recordEvent('agent_1', 'org_1', 'security_violation'); // -50 each
            }

            const score = calculator.getScore('agent_1');
            expect(score).toBe(0); // Clamped to min
        });

        it('should respect maxScore bound', () => {
            calculator.initializeAgent('agent_1', 'org_1', 950);

            // Record many positive events
            for (let i = 0; i < 20; i++) {
                calculator.recordEvent('agent_1', 'org_1', 'task_completed'); // +10 each
            }

            const score = calculator.getScore('agent_1');
            expect(score).toBe(1000); // Clamped to max
        });

        it('should apply linear decay over time', () => {
            calculator.initializeAgent('agent_1', 'org_1');
            calculator.recordEvent('agent_1', 'org_1', 'task_completed'); // +10, 30-day decay

            // Advance 15 days (half decay period)
            vi.advanceTimersByTime(15 * 24 * 60 * 60 * 1000);

            calculator.recalculateScore('agent_1');
            const score = calculator.getScore('agent_1');

            // After 15 days, should be ~50% of 10 = 5
            expect(score).toBe(305); // 300 + 5
        });

        it('should fully decay events after decay period', () => {
            calculator.initializeAgent('agent_1', 'org_1');
            calculator.recordEvent('agent_1', 'org_1', 'task_completed'); // +10, 30-day decay

            // Advance 31 days
            vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);

            calculator.recalculateScore('agent_1');
            const score = calculator.getScore('agent_1');

            expect(score).toBe(300); // Back to base
        });

        it('should handle different decay periods per event type', () => {
            calculator.initializeAgent('agent_1', 'org_1');

            calculator.recordEvent('agent_1', 'org_1', 'task_completed'); // 30-day decay
            calculator.recordEvent('agent_1', 'org_1', 'invalid_delegation'); // 7-day decay

            // After 10 days, invalid_delegation should be decayed but task_completed still active
            vi.advanceTimersByTime(10 * 24 * 60 * 60 * 1000);

            calculator.recalculateScore('agent_1');
            const score = calculator.getScore('agent_1');

            // task_completed: ~66% of 10 = ~7
            // invalid_delegation: fully decayed (0)
            expect(score).toBeGreaterThanOrEqual(305);
            expect(score).toBeLessThan(310);
        });
    });

    // =========================================================================
    // Exponential Decay
    // =========================================================================

    describe('Exponential Decay', () => {
        it('should apply exponential decay when configured', () => {
            const expCalculator = new TrustScoreCalculator({
                baseScore: 300,
                decayFunction: 'exponential',
            });

            expCalculator.initializeAgent('agent_1', 'org_1');
            expCalculator.recordEvent('agent_1', 'org_1', 'task_completed');

            // After 15 days
            vi.advanceTimersByTime(15 * 24 * 60 * 60 * 1000);

            expCalculator.recalculateScore('agent_1');
            const score = expCalculator.getScore('agent_1');

            // Exponential decay is faster at midpoint than linear
            // Linear at 15/30 days = 50% remaining, exponential ≈ 22% remaining
            // So exponential score should be less than linear (305) but more than 300
            expect(score).toBeGreaterThan(300);
            expect(score).toBeLessThan(305);
        });
    });

    // =========================================================================
    // Score Retrieval
    // =========================================================================

    describe('Score Retrieval', () => {
        it('should return null for unknown agent', () => {
            const score = calculator.getScore('unknown');
            expect(score).toBeNull();
        });

        it('should get fresh score with recalculation', () => {
            calculator.initializeAgent('agent_1', 'org_1');
            calculator.recordEvent('agent_1', 'org_1', 'task_completed');

            // Advance time
            vi.advanceTimersByTime(5 * 24 * 60 * 60 * 1000);

            // getFreshScore should recalculate
            const score = calculator.getFreshScore('agent_1', 1000);
            expect(score).toBeLessThan(310);
        });

        it('should get agent state', () => {
            calculator.initializeAgent('agent_1', 'org_1');
            calculator.recordEvent('agent_1', 'org_1', 'task_completed');

            const state = calculator.getAgentState('agent_1');

            expect(state).not.toBeNull();
            expect(state?.currentScore).toBe(310);
            expect(state?.events.length).toBe(1);
        });

        it('should get org scores', () => {
            calculator.initializeAgent('agent_1', 'org_1');
            calculator.initializeAgent('agent_2', 'org_1');
            calculator.initializeAgent('agent_3', 'org_2');

            calculator.recordEvent('agent_1', 'org_1', 'task_completed');

            const scores = calculator.getOrgScores('org_1');

            expect(scores.size).toBe(2);
            expect(scores.get('agent_1')).toBe(310);
            expect(scores.get('agent_2')).toBe(300);
        });

        it('should get recent events', () => {
            calculator.initializeAgent('agent_1', 'org_1');

            for (let i = 0; i < 10; i++) {
                calculator.recordEvent('agent_1', 'org_1', 'task_completed');
            }

            const events = calculator.getRecentEvents('agent_1', 5);

            expect(events.length).toBe(5);
        });

        it('should get events by type', () => {
            calculator.initializeAgent('agent_1', 'org_1');

            calculator.recordEvent('agent_1', 'org_1', 'task_completed');
            calculator.recordEvent('agent_1', 'org_1', 'task_failed');
            calculator.recordEvent('agent_1', 'org_1', 'task_completed');

            const completedEvents = calculator.getEventsByType('agent_1', 'task_completed');
            const failedEvents = calculator.getEventsByType('agent_1', 'task_failed');

            expect(completedEvents.length).toBe(2);
            expect(failedEvents.length).toBe(1);
        });

        it('should get event counts', () => {
            calculator.initializeAgent('agent_1', 'org_1');

            calculator.recordEvent('agent_1', 'org_1', 'task_completed');
            calculator.recordEvent('agent_1', 'org_1', 'task_completed');
            calculator.recordEvent('agent_1', 'org_1', 'task_failed');

            const counts = calculator.getEventCounts('agent_1');

            expect(counts?.task_completed).toBe(2);
            expect(counts?.task_failed).toBe(1);
        });
    });

    // =========================================================================
    // Score Analysis
    // =========================================================================

    describe('Score Analysis', () => {
        it('should get score breakdown', () => {
            calculator.initializeAgent('agent_1', 'org_1');

            calculator.recordEvent('agent_1', 'org_1', 'task_completed');
            calculator.recordEvent('agent_1', 'org_1', 'task_completed');
            calculator.recordEvent('agent_1', 'org_1', 'task_failed');

            const breakdown = calculator.getScoreBreakdown('agent_1');

            expect(breakdown).not.toBeNull();
            expect(breakdown?.task_completed.count).toBe(2);
            expect(breakdown?.task_completed.totalPoints).toBe(20);
            expect(breakdown?.task_failed.count).toBe(1);
            expect(breakdown?.task_failed.totalPoints).toBe(-15);
        });

        it('should get score trend', () => {
            calculator.initializeAgent('agent_1', 'org_1');

            // Record events over time
            calculator.recordEvent('agent_1', 'org_1', 'task_completed');

            vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);
            calculator.recordEvent('agent_1', 'org_1', 'task_completed');

            const trend = calculator.getScoreTrend('agent_1', 3);

            expect(trend.length).toBe(4); // 3 days + today
            // Score should generally increase over the period
        });
    });

    // =========================================================================
    // Organization Config
    // =========================================================================

    describe('Organization Config', () => {
        it('should use org-specific event config', () => {
            calculator.setOrgConfig('org_1', {
                events: {
                    ...DEFAULT_EVENT_CONFIG,
                    task_completed: { points: 20, decayDays: 30 }, // Double points
                },
            });

            calculator.initializeAgent('agent_1', 'org_1');
            calculator.recordEvent('agent_1', 'org_1', 'task_completed');

            const score = calculator.getScore('agent_1');
            expect(score).toBe(320); // 300 + 20
        });

        it('should use org-specific base score', () => {
            calculator.setOrgConfig('org_1', {
                baseScore: 500,
            });

            calculator.initializeAgent('agent_1', 'org_1');

            const score = calculator.getScore('agent_1');
            expect(score).toBe(500);
        });

        it('should recalculate scores when org config changes', () => {
            calculator.initializeAgent('agent_1', 'org_1');
            calculator.recordEvent('agent_1', 'org_1', 'task_completed');

            const scoreBefore = calculator.getScore('agent_1');
            expect(scoreBefore).toBe(310);

            // Change org config - note: existing events keep their original points
            // New events will use the new config
            calculator.setOrgConfig('org_1', {
                events: {
                    ...DEFAULT_EVENT_CONFIG,
                    task_completed: { points: 50, decayDays: 30 },
                },
            });

            // Existing event still has original 10 points
            const scoreAfter = calculator.getScore('agent_1');
            expect(scoreAfter).toBe(310); // Still 300 + 10 (events are immutable)

            // New events use new config
            calculator.recordEvent('agent_1', 'org_1', 'task_completed');
            expect(calculator.getScore('agent_1')).toBe(360); // 300 + 10 + 50
        });

        it('should get event config for org', () => {
            calculator.setOrgConfig('org_1', {
                events: {
                    ...DEFAULT_EVENT_CONFIG,
                    security_violation: { points: -100, decayDays: 90 },
                },
            });

            const config = calculator.getEventConfig('org_1', 'security_violation');

            expect(config.points).toBe(-100);
            expect(config.decayDays).toBe(90);
        });
    });

    // =========================================================================
    // Agent Management
    // =========================================================================

    describe('Agent Management', () => {
        it('should initialize agent with base score', () => {
            const state = calculator.initializeAgent('agent_1', 'org_1');

            expect(state.currentScore).toBe(300);
            expect(state.events.length).toBe(0);
        });

        it('should initialize agent with custom score', () => {
            const state = calculator.initializeAgent('agent_1', 'org_1', 500);

            expect(state.currentScore).toBe(500);
        });

        it('should remove agent', () => {
            calculator.initializeAgent('agent_1', 'org_1');

            const removed = calculator.removeAgent('agent_1');

            expect(removed).toBe(true);
            expect(calculator.hasAgent('agent_1')).toBe(false);
        });

        it('should check if agent exists', () => {
            expect(calculator.hasAgent('agent_1')).toBe(false);

            calculator.initializeAgent('agent_1', 'org_1');

            expect(calculator.hasAgent('agent_1')).toBe(true);
        });

        it('should auto-create agent on event recording', () => {
            calculator.recordEvent('agent_1', 'org_1', 'task_completed');

            expect(calculator.hasAgent('agent_1')).toBe(true);
            const score = calculator.getScore('agent_1');
            expect(score).toBe(310);
        });
    });

    // =========================================================================
    // Bulk Operations
    // =========================================================================

    describe('Bulk Operations', () => {
        it('should get agents below threshold', () => {
            calculator.initializeAgent('agent_1', 'org_1', 100);
            calculator.initializeAgent('agent_2', 'org_1', 200);
            calculator.initializeAgent('agent_3', 'org_1', 500);

            const agents = calculator.getAgentsBelowThreshold(300);

            expect(agents.length).toBe(2);
        });

        it('should filter by org when getting agents below threshold', () => {
            calculator.initializeAgent('agent_1', 'org_1', 100);
            calculator.initializeAgent('agent_2', 'org_2', 100);

            const agents = calculator.getAgentsBelowThreshold(300, 'org_1');

            expect(agents.length).toBe(1);
            expect(agents[0].agentId).toBe('agent_1');
        });

        it('should get top agents', () => {
            calculator.initializeAgent('agent_1', 'org_1', 900);
            calculator.initializeAgent('agent_2', 'org_1', 800);
            calculator.initializeAgent('agent_3', 'org_1', 700);
            calculator.initializeAgent('agent_4', 'org_1', 600);

            const top = calculator.getTopAgents(2);

            expect(top.length).toBe(2);
            expect(top[0].currentScore).toBe(900);
            expect(top[1].currentScore).toBe(800);
        });

        it('should recalculate all scores', () => {
            calculator.initializeAgent('agent_1', 'org_1');
            calculator.initializeAgent('agent_2', 'org_1');

            calculator.recordEvent('agent_1', 'org_1', 'task_completed');
            calculator.recordEvent('agent_2', 'org_1', 'task_completed');

            // Advance time
            vi.advanceTimersByTime(15 * 24 * 60 * 60 * 1000);

            const scores = calculator.recalculateAllScores();

            expect(scores.size).toBe(2);
            expect(scores.get('agent_1')).toBeLessThan(310);
        });
    });

    // =========================================================================
    // Statistics
    // =========================================================================

    describe('Statistics', () => {
        it('should get aggregate stats', () => {
            calculator.initializeAgent('agent_1', 'org_1', 400);
            calculator.initializeAgent('agent_2', 'org_1', 600);
            calculator.initializeAgent('agent_3', 'org_1', 800);

            calculator.recordEvent('agent_1', 'org_1', 'task_completed');

            const stats = calculator.getStats();

            expect(stats.totalAgents).toBe(3);
            expect(stats.averageScore).toBe(Math.round((410 + 600 + 800) / 3));
            expect(stats.minScore).toBe(410);
            expect(stats.maxScore).toBe(800);
            expect(stats.totalEvents).toBe(1);
        });

        it('should filter stats by org', () => {
            calculator.initializeAgent('agent_1', 'org_1', 400);
            calculator.initializeAgent('agent_2', 'org_1', 600);
            calculator.initializeAgent('agent_3', 'org_2', 800);

            const stats = calculator.getStats('org_1');

            expect(stats.totalAgents).toBe(2);
            expect(stats.averageScore).toBe(500);
        });
    });

    // =========================================================================
    // Default Event Configuration
    // =========================================================================

    describe('Default Event Configuration', () => {
        it('should have correct default points for task_completed', () => {
            expect(DEFAULT_EVENT_CONFIG.task_completed.points).toBe(10);
            expect(DEFAULT_EVENT_CONFIG.task_completed.decayDays).toBe(30);
        });

        it('should have correct default points for task_failed', () => {
            expect(DEFAULT_EVENT_CONFIG.task_failed.points).toBe(-15);
            expect(DEFAULT_EVENT_CONFIG.task_failed.decayDays).toBe(14);
        });

        it('should have correct default points for security_violation', () => {
            expect(DEFAULT_EVENT_CONFIG.security_violation.points).toBe(-50);
            expect(DEFAULT_EVENT_CONFIG.security_violation.decayDays).toBe(60);
        });

        it('should have correct default points for invalid_delegation', () => {
            expect(DEFAULT_EVENT_CONFIG.invalid_delegation.points).toBe(-20);
            expect(DEFAULT_EVENT_CONFIG.invalid_delegation.decayDays).toBe(7);
        });
    });

    // =========================================================================
    // Lifecycle
    // =========================================================================

    describe('Lifecycle', () => {
        it('should clear all state', () => {
            calculator.initializeAgent('agent_1', 'org_1');
            calculator.recordEvent('agent_1', 'org_1', 'task_completed');
            calculator.setOrgConfig('org_1', { baseScore: 500 });

            calculator.clear();

            expect(calculator.hasAgent('agent_1')).toBe(false);
            expect(calculator.getStats().totalAgents).toBe(0);
        });
    });
});
