/**
 * TrustHistoryStore Tests
 *
 * Epic 11: Live Trust Scoring Engine
 * Story 11.2: Trust History Database
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Supabase client
const mockSupabaseClient = {
    from: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabaseClient),
}));

import {
    TrustHistoryStore,
    TrustEventInput,
    StoredTrustEvent,
    resetTrustHistoryStore,
} from './TrustHistoryStore.js';

describe('TrustHistoryStore', () => {
    let store: TrustHistoryStore;

    // Helper to create mock query builder
    const createMockQuery = (result: { data: any; error: any }) => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(result),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        then: vi.fn((cb) => cb(result)),
    });

    beforeEach(() => {
        vi.clearAllMocks();
        resetTrustHistoryStore();

        // Set environment variables for tests
        process.env.SUPABASE_URL = 'http://localhost:54321';
        process.env.SUPABASE_ANON_KEY = 'test-key';

        store = new TrustHistoryStore();
    });

    afterEach(() => {
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_ANON_KEY;
    });

    // =========================================================================
    // Event Storage
    // =========================================================================

    describe('Event Storage', () => {
        it('should store a trust event', async () => {
            const storedEvent: StoredTrustEvent = {
                id: 'evt_123',
                agent_id: 'agent_1',
                org_id: 'org_1',
                event_type: 'task_completed',
                points: 10,
                decay_days: 30,
                reason: 'Task finished',
                old_score: 300,
                new_score: 310,
                metadata: null,
                created_at: new Date().toISOString(),
            };

            const mockQuery = createMockQuery({ data: storedEvent, error: null });
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            const input: TrustEventInput = {
                agentId: 'agent_1',
                orgId: 'org_1',
                eventType: 'task_completed',
                points: 10,
                decayDays: 30,
                reason: 'Task finished',
                oldScore: 300,
                newScore: 310,
            };

            const result = await store.store(input);

            expect(mockSupabaseClient.from).toHaveBeenCalledWith('trust_events');
            expect(result.id).toBe('evt_123');
            expect(result.new_score).toBe(310);
        });

        it('should emit event:stored after storing', async () => {
            const storedEvent: StoredTrustEvent = {
                id: 'evt_123',
                agent_id: 'agent_1',
                org_id: 'org_1',
                event_type: 'task_completed',
                points: 10,
                decay_days: 30,
                reason: null,
                old_score: 300,
                new_score: 310,
                metadata: null,
                created_at: new Date().toISOString(),
            };

            const mockQuery = createMockQuery({ data: storedEvent, error: null });
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            const events: StoredTrustEvent[] = [];
            store.on('event:stored', (e) => events.push(e));

            await store.store({
                agentId: 'agent_1',
                orgId: 'org_1',
                eventType: 'task_completed',
                points: 10,
                decayDays: 30,
                oldScore: 300,
                newScore: 310,
            });

            expect(events.length).toBe(1);
            expect(events[0].id).toBe('evt_123');
        });

        it('should throw error on storage failure', async () => {
            const mockQuery = createMockQuery({
                data: null,
                error: { message: 'Database error' },
            });
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            await expect(
                store.store({
                    agentId: 'agent_1',
                    orgId: 'org_1',
                    eventType: 'task_completed',
                    points: 10,
                    decayDays: 30,
                    oldScore: 300,
                    newScore: 310,
                })
            ).rejects.toThrow('Failed to store trust event');
        });

        it('should store batch of events', async () => {
            const storedEvents: StoredTrustEvent[] = [
                {
                    id: 'evt_1',
                    agent_id: 'agent_1',
                    org_id: 'org_1',
                    event_type: 'task_completed',
                    points: 10,
                    decay_days: 30,
                    reason: null,
                    old_score: 300,
                    new_score: 310,
                    metadata: null,
                    created_at: new Date().toISOString(),
                },
                {
                    id: 'evt_2',
                    agent_id: 'agent_1',
                    org_id: 'org_1',
                    event_type: 'task_completed',
                    points: 10,
                    decay_days: 30,
                    reason: null,
                    old_score: 310,
                    new_score: 320,
                    metadata: null,
                    created_at: new Date().toISOString(),
                },
            ];

            const mockQuery = {
                insert: vi.fn().mockReturnThis(),
                select: vi.fn().mockResolvedValue({ data: storedEvents, error: null }),
            };
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            const results = await store.storeBatch([
                {
                    agentId: 'agent_1',
                    orgId: 'org_1',
                    eventType: 'task_completed',
                    points: 10,
                    decayDays: 30,
                    oldScore: 300,
                    newScore: 310,
                },
                {
                    agentId: 'agent_1',
                    orgId: 'org_1',
                    eventType: 'task_completed',
                    points: 10,
                    decayDays: 30,
                    oldScore: 310,
                    newScore: 320,
                },
            ]);

            expect(results.length).toBe(2);
        });
    });

    // =========================================================================
    // Event Retrieval
    // =========================================================================

    describe('Event Retrieval', () => {
        it('should get event by ID', async () => {
            const storedEvent: StoredTrustEvent = {
                id: 'evt_123',
                agent_id: 'agent_1',
                org_id: 'org_1',
                event_type: 'task_completed',
                points: 10,
                decay_days: 30,
                reason: null,
                old_score: 300,
                new_score: 310,
                metadata: null,
                created_at: new Date().toISOString(),
            };

            const mockQuery = createMockQuery({ data: storedEvent, error: null });
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            const result = await store.getById('evt_123');

            expect(result?.id).toBe('evt_123');
        });

        it('should return null for non-existent event', async () => {
            const mockQuery = createMockQuery({
                data: null,
                error: { code: 'PGRST116', message: 'Not found' },
            });
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            const result = await store.getById('nonexistent');

            expect(result).toBeNull();
        });

        it('should get agent events with pagination', async () => {
            const events: StoredTrustEvent[] = [
                {
                    id: 'evt_1',
                    agent_id: 'agent_1',
                    org_id: 'org_1',
                    event_type: 'task_completed',
                    points: 10,
                    decay_days: 30,
                    reason: null,
                    old_score: 300,
                    new_score: 310,
                    metadata: null,
                    created_at: new Date().toISOString(),
                },
            ];

            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                range: vi.fn().mockReturnThis(),
                then: vi.fn((cb) => cb({ data: events, error: null })),
            };
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            const results = await store.getAgentEvents('agent_1', { limit: 10, offset: 0 });

            expect(mockQuery.eq).toHaveBeenCalledWith('agent_id', 'agent_1');
            expect(results.length).toBe(1);
        });

        it('should filter by date range', async () => {
            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                range: vi.fn().mockReturnThis(),
                then: vi.fn((cb) => cb({ data: [], error: null })),
            };
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            const startDate = new Date('2025-01-01');
            const endDate = new Date('2025-01-15');

            await store.getAgentEvents('agent_1', { startDate, endDate });

            expect(mockQuery.gte).toHaveBeenCalledWith('created_at', startDate.toISOString());
            expect(mockQuery.lte).toHaveBeenCalledWith('created_at', endDate.toISOString());
        });

        it('should get org events with event type filter', async () => {
            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                range: vi.fn().mockReturnThis(),
                then: vi.fn((cb) => cb({ data: [], error: null })),
            };
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            await store.getOrgEvents('org_1', {
                eventType: ['task_completed', 'task_failed'],
            });

            expect(mockQuery.in).toHaveBeenCalledWith('event_type', ['task_completed', 'task_failed']);
        });

        it('should query with flexible filters', async () => {
            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                range: vi.fn().mockReturnThis(),
                then: vi.fn((cb) => cb({ data: [], error: null })),
            };
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            await store.query({
                agentId: 'agent_1',
                orgId: 'org_1',
                eventType: 'task_completed',
                limit: 50,
            });

            expect(mockQuery.eq).toHaveBeenCalledWith('agent_id', 'agent_1');
            expect(mockQuery.eq).toHaveBeenCalledWith('org_id', 'org_1');
            expect(mockQuery.eq).toHaveBeenCalledWith('event_type', 'task_completed');
        });
    });

    // =========================================================================
    // Statistics
    // =========================================================================

    describe('Statistics', () => {
        it('should calculate agent stats', async () => {
            const events: StoredTrustEvent[] = [
                {
                    id: 'evt_1',
                    agent_id: 'agent_1',
                    org_id: 'org_1',
                    event_type: 'task_completed',
                    points: 10,
                    decay_days: 30,
                    reason: null,
                    old_score: 300,
                    new_score: 310,
                    metadata: null,
                    created_at: new Date().toISOString(),
                },
                {
                    id: 'evt_2',
                    agent_id: 'agent_1',
                    org_id: 'org_1',
                    event_type: 'task_failed',
                    points: -15,
                    decay_days: 14,
                    reason: null,
                    old_score: 310,
                    new_score: 295,
                    metadata: null,
                    created_at: new Date().toISOString(),
                },
            ];

            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                range: vi.fn().mockReturnThis(),
                then: vi.fn((cb) => cb({ data: events, error: null })),
            };
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            const stats = await store.getAgentStats('agent_1');

            expect(stats.totalEvents).toBe(2);
            expect(stats.eventsByType['task_completed']).toBe(1);
            expect(stats.eventsByType['task_failed']).toBe(1);
            expect(stats.netPointsChange).toBe(-5); // 10 - 15
        });

        it('should get org agent scores', async () => {
            const events = [
                { agent_id: 'agent_1', new_score: 350, created_at: '2025-01-15T12:00:00Z' },
                { agent_id: 'agent_2', new_score: 400, created_at: '2025-01-15T11:00:00Z' },
                { agent_id: 'agent_1', new_score: 340, created_at: '2025-01-14T12:00:00Z' },
            ];

            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                then: vi.fn((cb) => cb({ data: events, error: null })),
            };
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            const scores = await store.getOrgAgentScores('org_1');

            expect(scores.length).toBe(2);

            const agent1 = scores.find((s) => s.agentId === 'agent_1');
            expect(agent1?.score).toBe(350); // Latest score
            expect(agent1?.eventCount).toBe(2);
        });

        it('should count events by type', async () => {
            const events = [
                { event_type: 'task_completed' },
                { event_type: 'task_completed' },
                { event_type: 'task_failed' },
            ];

            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                then: vi.fn((cb) => cb({ data: events, error: null })),
            };
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            const counts = await store.countEventsByType('agent_1');

            expect(counts['task_completed']).toBe(2);
            expect(counts['task_failed']).toBe(1);
        });
    });

    // =========================================================================
    // Active Events
    // =========================================================================

    describe('Active Events', () => {
        it('should get only active (non-decayed) events', async () => {
            const now = Date.now();
            const events: StoredTrustEvent[] = [
                {
                    id: 'evt_1',
                    agent_id: 'agent_1',
                    org_id: 'org_1',
                    event_type: 'task_completed',
                    points: 10,
                    decay_days: 30,
                    reason: null,
                    old_score: 300,
                    new_score: 310,
                    metadata: null,
                    created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
                },
                {
                    id: 'evt_2',
                    agent_id: 'agent_1',
                    org_id: 'org_1',
                    event_type: 'invalid_delegation',
                    points: -20,
                    decay_days: 7,
                    reason: null,
                    old_score: 310,
                    new_score: 290,
                    metadata: null,
                    created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago (fully decayed)
                },
            ];

            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                then: vi.fn((cb) => cb({ data: events, error: null })),
            };
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            const activeEvents = await store.getActiveEvents('agent_1');

            // Only evt_1 should be active (10 days old with 30-day decay)
            // evt_2 is fully decayed (10 days old with 7-day decay)
            expect(activeEvents.length).toBe(1);
            expect(activeEvents[0].id).toBe('evt_1');
        });
    });

    // =========================================================================
    // Score Trend
    // =========================================================================

    describe('Score Trend', () => {
        it('should get score trend over time', async () => {
            const events: StoredTrustEvent[] = [
                {
                    id: 'evt_1',
                    agent_id: 'agent_1',
                    org_id: 'org_1',
                    event_type: 'task_completed',
                    points: 10,
                    decay_days: 30,
                    reason: null,
                    old_score: 300,
                    new_score: 310,
                    metadata: null,
                    created_at: '2025-01-10T12:00:00Z',
                },
                {
                    id: 'evt_2',
                    agent_id: 'agent_1',
                    org_id: 'org_1',
                    event_type: 'task_completed',
                    points: 10,
                    decay_days: 30,
                    reason: null,
                    old_score: 310,
                    new_score: 320,
                    metadata: null,
                    created_at: '2025-01-12T12:00:00Z',
                },
            ];

            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                range: vi.fn().mockReturnThis(),
                then: vi.fn((cb) => cb({ data: events, error: null })),
            };
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            const trend = await store.getScoreTrend('agent_1', 7);

            expect(trend.length).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // Maintenance
    // =========================================================================

    describe('Maintenance', () => {
        it('should get archivable events', async () => {
            const oldEvent: StoredTrustEvent = {
                id: 'evt_old',
                agent_id: 'agent_1',
                org_id: 'org_1',
                event_type: 'task_completed',
                points: 10,
                decay_days: 30,
                reason: null,
                old_score: 300,
                new_score: 310,
                metadata: null,
                created_at: '2024-01-01T00:00:00Z', // Very old
            };

            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                lt: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                then: vi.fn((cb) => cb({ data: [oldEvent], error: null })),
            };
            mockSupabaseClient.from.mockReturnValue(mockQuery);

            const archivable = await store.getArchivableEvents(365);

            expect(archivable.length).toBe(1);
            expect(archivable[0].id).toBe('evt_old');
        });
    });

    // =========================================================================
    // Configuration
    // =========================================================================

    describe('Configuration', () => {
        it('should throw if Supabase credentials missing', () => {
            delete process.env.SUPABASE_URL;
            delete process.env.SUPABASE_ANON_KEY;
            resetTrustHistoryStore();

            expect(() => new TrustHistoryStore()).toThrow('Supabase URL and key are required');
        });
    });
});
