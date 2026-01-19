/**
 * Decision Timeout Handler Tests
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.6: Decision Timeout Handler
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    DecisionTimeoutHandler,
    getDecisionTimeoutHandler,
    resetDecisionTimeoutHandler,
    type PendingDecision,
    type TimeoutResult,
} from './DecisionTimeoutJob.js';

// ============================================================================
// Tests
// ============================================================================

describe('DecisionTimeoutHandler', () => {
    let handler: DecisionTimeoutHandler;

    beforeEach(() => {
        vi.useFakeTimers();
        resetDecisionTimeoutHandler();
        handler = new DecisionTimeoutHandler({ autoProcess: false });
    });

    afterEach(() => {
        vi.useRealTimers();
        handler.clear();
    });

    // =========================================================================
    // Registration
    // =========================================================================

    describe('register', () => {
        it('should register pending decision', () => {
            const decision = handler.register(
                'dec_1',
                'req_1',
                'org_1',
                'normal',
                'hitl'
            );

            expect(decision.id).toBe('dec_1');
            expect(decision.requestId).toBe('req_1');
            expect(decision.urgency).toBe('normal');
            expect(decision.source).toBe('hitl');
            expect(decision.escalationLevel).toBe(0);
        });

        it('should set correct timeout based on urgency', () => {
            const immediate = handler.register('dec_1', 'req_1', 'org_1', 'immediate', 'hitl');
            const low = handler.register('dec_2', 'req_2', 'org_1', 'low', 'hitl');

            const immediateTimeout = immediate.timeoutAt.getTime() - immediate.createdAt.getTime();
            const lowTimeout = low.timeoutAt.getTime() - low.createdAt.getTime();

            expect(immediateTimeout).toBe(15 * 60 * 1000); // 15 minutes
            expect(lowTimeout).toBe(24 * 60 * 60 * 1000); // 24 hours
        });

        it('should emit decision:registered event', () => {
            const registeredHandler = vi.fn();
            handler.on('decision:registered', registeredHandler);

            handler.register('dec_1', 'req_1', 'org_1', 'normal', 'tribunal');

            expect(registeredHandler).toHaveBeenCalled();
        });
    });

    describe('resolve', () => {
        it('should resolve pending decision', () => {
            handler.register('dec_1', 'req_1', 'org_1', 'normal', 'hitl');

            const result = handler.resolve('dec_1');

            expect(result).toBe(true);
            expect(handler.getDecision('dec_1')).toBeNull();
        });

        it('should return false for unknown decision', () => {
            const result = handler.resolve('unknown');
            expect(result).toBe(false);
        });

        it('should emit decision:resolved event', () => {
            const resolvedHandler = vi.fn();
            handler.on('decision:resolved', resolvedHandler);

            handler.register('dec_1', 'req_1', 'org_1', 'normal', 'hitl');
            handler.resolve('dec_1');

            expect(resolvedHandler).toHaveBeenCalled();
        });
    });

    describe('resolveByRequestId', () => {
        it('should resolve by request ID', () => {
            handler.register('dec_1', 'req_unique', 'org_1', 'normal', 'hitl');

            const result = handler.resolveByRequestId('req_unique');

            expect(result).toBe(true);
            expect(handler.pendingCount).toBe(0);
        });
    });

    // =========================================================================
    // Timeout Processing
    // =========================================================================

    describe('processTimeouts', () => {
        it('should escalate immediate urgency on timeout', async () => {
            const escalateCallback = vi.fn().mockResolvedValue(true);
            handler.onEscalate(escalateCallback);

            handler.register('dec_1', 'req_1', 'org_1', 'immediate', 'hitl');

            // Advance past 15 minute timeout
            vi.advanceTimersByTime(16 * 60 * 1000);
            const results = await handler.processTimeouts();

            expect(results.length).toBe(1);
            expect(results[0].action).toBe('escalate');
            expect(results[0].escalated).toBe(true);
            expect(escalateCallback).toHaveBeenCalled();
        });

        it('should expire low urgency on timeout', async () => {
            const expireCallback = vi.fn().mockResolvedValue(true);
            handler.onExpire(expireCallback);

            handler.register('dec_1', 'req_1', 'org_1', 'low', 'hitl');

            // Advance past 24 hour timeout
            vi.advanceTimersByTime(25 * 60 * 60 * 1000);
            const results = await handler.processTimeouts();

            expect(results.length).toBe(1);
            expect(results[0].action).toBe('expire');
            expect(results[0].expired).toBe(true);
            expect(expireCallback).toHaveBeenCalled();
        });

        it('should not process non-timed-out decisions', async () => {
            handler.register('dec_1', 'req_1', 'org_1', 'low', 'hitl');

            // Only advance 1 hour (24 hour timeout)
            vi.advanceTimersByTime(1 * 60 * 60 * 1000);
            const results = await handler.processTimeouts();

            expect(results.length).toBe(0);
        });

        it('should emit warning before timeout', async () => {
            const warningHandler = vi.fn();
            handler.on('decision:warning', warningHandler);

            // Immediate has 10 minute warning
            handler.register('dec_1', 'req_1', 'org_1', 'immediate', 'hitl');

            // Advance past warning threshold (10 min) but before timeout (15 min)
            vi.advanceTimersByTime(11 * 60 * 1000);
            await handler.processTimeouts();

            expect(warningHandler).toHaveBeenCalled();
        });

        it('should force expire after max escalations', async () => {
            const expireCallback = vi.fn().mockResolvedValue(true);
            handler.onExpire(expireCallback);
            handler.updateConfig({ maxEscalations: 2 });

            const decision = handler.register('dec_1', 'req_1', 'org_1', 'immediate', 'hitl');
            decision.escalationLevel = 2; // Already at max

            vi.advanceTimersByTime(16 * 60 * 1000);
            const results = await handler.processTimeouts();

            expect(results[0].action).toBe('expire');
            expect(expireCallback).toHaveBeenCalled();
        });

        it('should increment escalation level', async () => {
            handler.register('dec_1', 'req_1', 'org_1', 'immediate', 'hitl');
            const decision = handler.getDecision('dec_1')!;

            vi.advanceTimersByTime(16 * 60 * 1000);
            await handler.processTimeouts();

            expect(decision.escalationLevel).toBe(1);
        });

        it('should emit check events', async () => {
            const startedHandler = vi.fn();
            const completedHandler = vi.fn();
            handler.on('check:started', startedHandler);
            handler.on('check:completed', completedHandler);

            await handler.processTimeouts();

            expect(startedHandler).toHaveBeenCalled();
            expect(completedHandler).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // Auto Processing
    // =========================================================================

    describe('start/stop', () => {
        it('should start automatic processing', () => {
            handler.start();

            expect(handler.running).toBe(true);

            handler.stop();
        });

        it('should stop automatic processing', () => {
            handler.start();
            handler.stop();

            expect(handler.running).toBe(false);
        });

        it('should auto-process at configured interval', async () => {
            handler.updateConfig({ checkIntervalMs: 1000 });
            handler.register('dec_1', 'req_1', 'org_1', 'immediate', 'hitl');
            handler.start();

            const completedHandler = vi.fn();
            handler.on('check:completed', completedHandler);

            // Advance past check interval and run pending timers
            await vi.advanceTimersByTimeAsync(1500);

            expect(completedHandler).toHaveBeenCalled();

            handler.stop();
        });
    });

    // =========================================================================
    // Decision Retrieval
    // =========================================================================

    describe('getDecision', () => {
        it('should return decision by ID', () => {
            handler.register('dec_1', 'req_1', 'org_1', 'normal', 'hitl');

            const decision = handler.getDecision('dec_1');

            expect(decision?.id).toBe('dec_1');
        });

        it('should return null for unknown ID', () => {
            const result = handler.getDecision('unknown');
            expect(result).toBeNull();
        });
    });

    describe('getDecisionByRequestId', () => {
        it('should return decision by request ID', () => {
            handler.register('dec_1', 'req_unique', 'org_1', 'normal', 'hitl');

            const decision = handler.getDecisionByRequestId('req_unique');

            expect(decision?.requestId).toBe('req_unique');
        });
    });

    describe('getPendingDecisions', () => {
        it('should return all pending decisions', () => {
            handler.register('dec_1', 'req_1', 'org_1', 'normal', 'hitl');
            handler.register('dec_2', 'req_2', 'org_1', 'high', 'tribunal');

            const pending = handler.getPendingDecisions();

            expect(pending.length).toBe(2);
        });

        it('should filter by orgId', () => {
            handler.register('dec_1', 'req_1', 'org_1', 'normal', 'hitl');
            handler.register('dec_2', 'req_2', 'org_2', 'normal', 'hitl');

            const pending = handler.getPendingDecisions({ orgId: 'org_1' });

            expect(pending.length).toBe(1);
            expect(pending[0].orgId).toBe('org_1');
        });

        it('should filter by urgency', () => {
            handler.register('dec_1', 'req_1', 'org_1', 'high', 'hitl');
            handler.register('dec_2', 'req_2', 'org_1', 'low', 'hitl');

            const pending = handler.getPendingDecisions({ urgency: 'high' });

            expect(pending.length).toBe(1);
            expect(pending[0].urgency).toBe('high');
        });

        it('should filter by source', () => {
            handler.register('dec_1', 'req_1', 'org_1', 'normal', 'hitl');
            handler.register('dec_2', 'req_2', 'org_1', 'normal', 'tribunal');

            const pending = handler.getPendingDecisions({ source: 'tribunal' });

            expect(pending.length).toBe(1);
            expect(pending[0].source).toBe('tribunal');
        });

        it('should sort by timeout ascending', () => {
            handler.register('dec_1', 'req_1', 'org_1', 'low', 'hitl'); // 24h
            handler.register('dec_2', 'req_2', 'org_1', 'immediate', 'hitl'); // 15m

            const pending = handler.getPendingDecisions();

            expect(pending[0].urgency).toBe('immediate'); // Shorter timeout first
        });
    });

    describe('getExpiringSoon', () => {
        it('should return decisions expiring soon', () => {
            handler.register('dec_1', 'req_1', 'org_1', 'immediate', 'hitl'); // 15m
            handler.register('dec_2', 'req_2', 'org_1', 'low', 'hitl'); // 24h

            // Check within 30 minutes
            const expiring = handler.getExpiringSoon(30 * 60 * 1000);

            expect(expiring.length).toBe(1);
            expect(expiring[0].urgency).toBe('immediate');
        });
    });

    // =========================================================================
    // Rules Configuration
    // =========================================================================

    describe('setRule', () => {
        it('should set custom timeout rule', () => {
            handler.setRule({
                urgency: 'immediate',
                timeoutMs: 5 * 60 * 1000, // 5 minutes
                action: 'expire',
            });

            const rule = handler.getRule('immediate');

            expect(rule?.timeoutMs).toBe(5 * 60 * 1000);
            expect(rule?.action).toBe('expire');
        });
    });

    describe('getRules', () => {
        it('should return all rules', () => {
            const rules = handler.getRules();

            expect(rules.length).toBe(4); // immediate, high, normal, low
        });
    });

    // =========================================================================
    // Configuration
    // =========================================================================

    describe('configuration', () => {
        it('should update config', () => {
            handler.updateConfig({ maxEscalations: 5 });

            const config = handler.getConfig();

            expect(config.maxEscalations).toBe(5);
        });
    });

    // =========================================================================
    // Statistics
    // =========================================================================

    describe('getStats', () => {
        it('should return correct statistics', () => {
            handler.register('dec_1', 'req_1', 'org_1', 'immediate', 'hitl');
            handler.register('dec_2', 'req_2', 'org_1', 'low', 'tribunal');
            const decision = handler.getDecision('dec_1')!;
            decision.escalationLevel = 1;

            const stats = handler.getStats();

            expect(stats.totalPending).toBe(2);
            expect(stats.byUrgency.immediate).toBe(1);
            expect(stats.byUrgency.low).toBe(1);
            expect(stats.bySource.hitl).toBe(1);
            expect(stats.bySource.tribunal).toBe(1);
            expect(stats.escalatedCount).toBe(1);
        });

        it('should filter by org', () => {
            handler.register('dec_1', 'req_1', 'org_1', 'normal', 'hitl');
            handler.register('dec_2', 'req_2', 'org_2', 'normal', 'hitl');

            const stats = handler.getStats('org_1');

            expect(stats.totalPending).toBe(1);
        });
    });

    // =========================================================================
    // Lifecycle
    // =========================================================================

    describe('clear', () => {
        it('should clear all state', () => {
            handler.register('dec_1', 'req_1', 'org_1', 'normal', 'hitl');
            handler.start();

            handler.clear();

            expect(handler.pendingCount).toBe(0);
            expect(handler.running).toBe(false);
        });
    });

    // =========================================================================
    // Singleton
    // =========================================================================

    describe('singleton', () => {
        it('should return same instance', () => {
            resetDecisionTimeoutHandler();
            const instance1 = getDecisionTimeoutHandler({ autoProcess: false });
            const instance2 = getDecisionTimeoutHandler();

            expect(instance1).toBe(instance2);

            instance1.clear();
        });

        it('should reset properly', () => {
            const instance1 = getDecisionTimeoutHandler({ autoProcess: false });
            instance1.register('dec_1', 'req_1', 'org_1', 'normal', 'hitl');

            resetDecisionTimeoutHandler();
            const instance2 = getDecisionTimeoutHandler({ autoProcess: false });

            expect(instance2.pendingCount).toBe(0);

            instance2.clear();
        });
    });
});
