/**
 * TrustEventStore Tests
 *
 * Epic 11: Live Trust Scoring Engine
 * Story 11.4: Trust Event Sourcing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    TrustEventStore,
    TrustEventInput,
    resetTrustEventStore,
} from './TrustEventStore.js';

describe('TrustEventStore', () => {
    let store: TrustEventStore;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
        resetTrustEventStore();
        store = new TrustEventStore();
    });

    afterEach(() => {
        store.clear();
        vi.useRealTimers();
    });

    // =========================================================================
    // Event Appending
    // =========================================================================

    describe('Event Appending', () => {
        it('should append event with generated ID', () => {
            const input: TrustEventInput = {
                agentId: 'agent_1',
                orgId: 'org_1',
                eventType: 'task_completed',
                points: 10,
                oldScore: 300,
                newScore: 310,
            };

            const event = store.append(input);

            expect(event.id).toBe('agent_1:1');
            expect(event.sequence).toBe(1);
            expect(event.points).toBe(10);
            expect(event.newScore).toBe(310);
        });

        it('should increment sequence per agent', () => {
            store.append(createInput('agent_1'));
            store.append(createInput('agent_1'));
            const event3 = store.append(createInput('agent_1'));

            expect(event3.sequence).toBe(3);
            expect(event3.id).toBe('agent_1:3');
        });

        it('should maintain separate sequences per agent', () => {
            store.append(createInput('agent_1'));
            store.append(createInput('agent_1'));
            const agent2Event = store.append(createInput('agent_2'));

            expect(agent2Event.sequence).toBe(1);
            expect(store.getSequence('agent_1')).toBe(2);
            expect(store.getSequence('agent_2')).toBe(1);
        });

        it('should generate hash for each event', () => {
            const event = store.append(createInput('agent_1'));

            expect(event.hash).toBeDefined();
            expect(event.hash.length).toBe(64); // SHA-256 hex
        });

        it('should chain events with previousHash', () => {
            const event1 = store.append(createInput('agent_1'));
            const event2 = store.append(createInput('agent_1'));

            expect(event2.previousHash).toBe(event1.hash);
        });

        it('should use genesis hash for first event', () => {
            const event = store.append(createInput('agent_1'));

            expect(event.previousHash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
        });

        it('should emit event:appended on append', () => {
            const appended: any[] = [];
            store.on('event:appended', (e) => appended.push(e));

            store.append(createInput('agent_1'));

            expect(appended.length).toBe(1);
        });

        it('should append batch in order', () => {
            const events = store.appendBatch([
                createInput('agent_1', 10),
                createInput('agent_1', 20),
                createInput('agent_1', 30),
            ]);

            expect(events.length).toBe(3);
            expect(events[0].sequence).toBe(1);
            expect(events[1].sequence).toBe(2);
            expect(events[2].sequence).toBe(3);
            expect(events[1].previousHash).toBe(events[0].hash);
            expect(events[2].previousHash).toBe(events[1].hash);
        });
    });

    // =========================================================================
    // Event Retrieval
    // =========================================================================

    describe('Event Retrieval', () => {
        it('should get event by ID', () => {
            store.append(createInput('agent_1'));

            const event = store.getById('agent_1:1');

            expect(event).not.toBeNull();
            expect(event?.agentId).toBe('agent_1');
        });

        it('should return null for unknown ID', () => {
            expect(store.getById('unknown:1')).toBeNull();
        });

        it('should get event by sequence', () => {
            store.append(createInput('agent_1'));
            store.append(createInput('agent_1'));

            const event = store.getBySequence('agent_1', 2);

            expect(event?.sequence).toBe(2);
        });

        it('should get all agent events', () => {
            store.append(createInput('agent_1'));
            store.append(createInput('agent_1'));
            store.append(createInput('agent_2'));

            const events = store.getAgentEvents('agent_1');

            expect(events.length).toBe(2);
        });

        it('should get all org events', () => {
            store.append(createInput('agent_1', 10, 'org_1'));
            store.append(createInput('agent_2', 10, 'org_1'));
            store.append(createInput('agent_3', 10, 'org_2'));

            const events = store.getOrgEvents('org_1');

            expect(events.length).toBe(2);
        });

        it('should get latest event for agent', () => {
            store.append(createInput('agent_1', 10));
            store.append(createInput('agent_1', 20));

            const latest = store.getLatestEvent('agent_1');

            expect(latest?.points).toBe(20);
        });

        it('should filter by time range', () => {
            vi.setSystemTime(new Date('2025-01-15T10:00:00Z'));
            store.append(createInput('agent_1'));

            vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
            store.append(createInput('agent_1'));

            vi.setSystemTime(new Date('2025-01-15T14:00:00Z'));
            store.append(createInput('agent_1'));

            const midEvents = store.getAgentEvents('agent_1', {
                startTime: new Date('2025-01-15T11:00:00Z').getTime(),
                endTime: new Date('2025-01-15T13:00:00Z').getTime(),
            });

            expect(midEvents.length).toBe(1);
        });

        it('should filter by event type', () => {
            store.append({ ...createInput('agent_1'), eventType: 'task_completed' });
            store.append({ ...createInput('agent_1'), eventType: 'task_failed' });
            store.append({ ...createInput('agent_1'), eventType: 'task_completed' });

            const completed = store.getAgentEvents('agent_1', {
                eventTypes: ['task_completed'],
            });

            expect(completed.length).toBe(2);
        });

        it('should paginate results', () => {
            for (let i = 0; i < 10; i++) {
                store.append(createInput('agent_1'));
            }

            const page1 = store.getAgentEvents('agent_1', { limit: 3, offset: 0 });
            const page2 = store.getAgentEvents('agent_1', { limit: 3, offset: 3 });

            expect(page1.length).toBe(3);
            expect(page2.length).toBe(3);
        });

        it('should sort by timestamp', () => {
            vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
            store.append(createInput('agent_1', 10));

            vi.setSystemTime(new Date('2025-01-15T13:00:00Z'));
            store.append(createInput('agent_1', 20));

            const descEvents = store.getAgentEvents('agent_1', { order: 'desc' });
            const ascEvents = store.getAgentEvents('agent_1', { order: 'asc' });

            expect(descEvents[0].points).toBe(20); // Latest first
            expect(ascEvents[0].points).toBe(10); // Oldest first
        });
    });

    // =========================================================================
    // Hash Chain Verification
    // =========================================================================

    describe('Hash Chain Verification', () => {
        it('should verify valid chain', () => {
            store.append(createInput('agent_1'));
            store.append(createInput('agent_1'));
            store.append(createInput('agent_1'));

            const result = store.verifyAgentChain('agent_1');

            expect(result.valid).toBe(true);
            expect(result.checkedEvents).toBe(3);
            expect(result.errors.length).toBe(0);
        });

        it('should detect tampered event', () => {
            const event1 = store.append(createInput('agent_1'));
            store.append(createInput('agent_1'));

            // Tamper with the stored event (simulate corruption)
            const tamperedEvent = { ...event1, points: 999 };
            (store as any).events.set(event1.id, tamperedEvent);

            const result = store.verifyAgentChain('agent_1');

            expect(result.valid).toBe(false);
            expect(result.firstInvalidSequence).toBe(1);
        });

        it('should verify single event', () => {
            const event = store.append(createInput('agent_1'));

            expect(store.verifyEvent(event.id)).toBe(true);
        });

        it('should detect single tampered event', () => {
            const event = store.append(createInput('agent_1'));

            // Tamper
            const tampered = { ...event, points: 999 };
            (store as any).events.set(event.id, tampered);

            expect(store.verifyEvent(event.id)).toBe(false);
        });

        it('should verify org chain across all agents', () => {
            store.append(createInput('agent_1', 10, 'org_1'));
            store.append(createInput('agent_2', 10, 'org_1'));
            store.append(createInput('agent_1', 20, 'org_1'));

            const result = store.verifyOrgChain('org_1');

            expect(result.valid).toBe(true);
            expect(result.checkedEvents).toBe(3);
        });
    });

    // =========================================================================
    // Replay / State Reconstruction
    // =========================================================================

    describe('Replay', () => {
        it('should replay to time', () => {
            vi.setSystemTime(new Date('2025-01-15T10:00:00Z'));
            store.append(createInput('agent_1', 10, 'org_1', 300, 310));

            vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
            store.append(createInput('agent_1', 20, 'org_1', 310, 330));

            vi.setSystemTime(new Date('2025-01-15T14:00:00Z'));
            store.append(createInput('agent_1', -10, 'org_1', 330, 320));

            const scoreAt11 = store.replayToTime(
                'agent_1',
                new Date('2025-01-15T11:00:00Z').getTime(),
                300
            );

            expect(scoreAt11).toBe(310); // Only first event
        });

        it('should replay to sequence', () => {
            store.append(createInput('agent_1', 10, 'org_1', 300, 310));
            store.append(createInput('agent_1', 20, 'org_1', 310, 330));
            store.append(createInput('agent_1', -10, 'org_1', 330, 320));

            const scoreAtSeq2 = store.replayToSequence('agent_1', 2, 300);

            expect(scoreAtSeq2).toBe(330); // After events 1 and 2
        });

        it('should get score history', () => {
            vi.setSystemTime(new Date('2025-01-15T10:00:00Z'));
            store.append(createInput('agent_1', 10, 'org_1', 300, 310));

            vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
            store.append(createInput('agent_1', 20, 'org_1', 310, 330));

            const history = store.getScoreHistory('agent_1');

            expect(history.length).toBe(2);
            expect(history[0].score).toBe(310);
            expect(history[1].score).toBe(330);
        });
    });

    // =========================================================================
    // Statistics
    // =========================================================================

    describe('Statistics', () => {
        it('should get store stats', () => {
            store.append({ ...createInput('agent_1'), eventType: 'task_completed' });
            store.append({ ...createInput('agent_1'), eventType: 'task_failed' });
            store.append({ ...createInput('agent_2'), eventType: 'task_completed' });

            const stats = store.getStats();

            expect(stats.totalEvents).toBe(3);
            expect(stats.eventsByType.task_completed).toBe(2);
            expect(stats.eventsByType.task_failed).toBe(1);
            expect(stats.eventsByAgent.agent_1).toBe(2);
            expect(stats.eventsByAgent.agent_2).toBe(1);
        });

        it('should filter stats by org', () => {
            store.append(createInput('agent_1', 10, 'org_1'));
            store.append(createInput('agent_2', 10, 'org_2'));

            const stats = store.getStats('org_1');

            expect(stats.totalEvents).toBe(1);
        });

        it('should calculate points delta', () => {
            store.append(createInput('agent_1', 10));
            store.append(createInput('agent_1', -5));
            store.append(createInput('agent_1', 20));

            const delta = store.getPointsDelta('agent_1');

            expect(delta).toBe(25); // 10 - 5 + 20
        });

        it('should calculate points delta in time range', () => {
            vi.setSystemTime(new Date('2025-01-15T10:00:00Z'));
            store.append(createInput('agent_1', 10));

            vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
            store.append(createInput('agent_1', 20));

            vi.setSystemTime(new Date('2025-01-15T14:00:00Z'));
            store.append(createInput('agent_1', 30));

            const delta = store.getPointsDelta(
                'agent_1',
                new Date('2025-01-15T11:00:00Z').getTime(),
                new Date('2025-01-15T13:00:00Z').getTime()
            );

            expect(delta).toBe(20); // Only middle event
        });
    });

    // =========================================================================
    // Immutability
    // =========================================================================

    describe('Immutability', () => {
        it('should detect tampering via hash verification', () => {
            const event = store.append(createInput('agent_1'));

            // Verify event is valid before tampering
            expect(store.verifyEvent(event.id)).toBe(true);

            // Tamper with stored event (simulate malicious modification)
            const tampered = store.getById(event.id);
            if (tampered) {
                (tampered as any).points = 9999;
            }

            // Hash verification detects the tampering
            expect(store.verifyEvent(event.id)).toBe(false);
        });

        it('should detect chain breaks', () => {
            store.append(createInput('agent_1'));
            const event2 = store.append(createInput('agent_1'));

            // Break the chain by modifying previousHash
            const tampered = store.getById(event2.id);
            if (tampered) {
                (tampered as any).previousHash = 'invalid_hash';
            }

            const result = store.verifyAgentChain('agent_1');
            expect(result.valid).toBe(false);
        });
    });

    // =========================================================================
    // Custom Genesis Hash
    // =========================================================================

    describe('Custom Configuration', () => {
        it('should support custom genesis hash', () => {
            const customStore = new TrustEventStore({
                genesisHash: 'custom_genesis_hash_for_org',
            });

            const event = customStore.append(createInput('agent_1'));

            expect(event.previousHash).toBe('custom_genesis_hash_for_org');

            customStore.clear();
        });
    });

    // =========================================================================
    // Lifecycle
    // =========================================================================

    describe('Lifecycle', () => {
        it('should clear all state', () => {
            store.append(createInput('agent_1'));
            store.append(createInput('agent_2'));

            store.clear();

            expect(store.size).toBe(0);
            expect(store.getAgentEvents('agent_1').length).toBe(0);
        });

        it('should report size', () => {
            store.append(createInput('agent_1'));
            store.append(createInput('agent_1'));
            store.append(createInput('agent_2'));

            expect(store.size).toBe(3);
        });
    });
});

// ============================================================================
// Test Helpers
// ============================================================================

function createInput(
    agentId: string,
    points: number = 10,
    orgId: string = 'org_1',
    oldScore: number = 300,
    newScore: number = 310
): TrustEventInput {
    return {
        agentId,
        orgId,
        eventType: 'task_completed',
        points,
        oldScore,
        newScore,
        reason: 'Test event',
    };
}
