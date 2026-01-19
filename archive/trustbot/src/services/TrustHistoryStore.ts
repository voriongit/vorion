/**
 * Trust History Store
 *
 * Epic 11: Live Trust Scoring Engine
 * Story 11.2: Trust History Database
 *
 * Provides persistent storage for trust events using Supabase.
 * All events are append-only for audit integrity.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'eventemitter3';
import type { TrustEventType } from './TrustScoreCalculator.js';

// ============================================================================
// Types
// ============================================================================

export interface StoredTrustEvent {
    id: string;
    agent_id: string;
    org_id: string;
    event_type: TrustEventType;
    points: number;
    decay_days: number;
    reason: string | null;
    old_score: number;
    new_score: number;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

export interface TrustEventInput {
    agentId: string;
    orgId: string;
    eventType: TrustEventType;
    points: number;
    decayDays: number;
    reason?: string;
    oldScore: number;
    newScore: number;
    metadata?: Record<string, unknown>;
}

export interface TrustEventQuery {
    agentId?: string;
    orgId?: string;
    eventType?: TrustEventType | TrustEventType[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}

export interface TrustEventStats {
    totalEvents: number;
    eventsByType: Record<string, number>;
    avgPointsPerDay: number;
    netPointsChange: number;
}

export interface AgentScoreSnapshot {
    agentId: string;
    score: number;
    lastEventAt: Date | null;
    eventCount: number;
}

interface StoreEvents {
    'event:stored': (event: StoredTrustEvent) => void;
    'error': (error: Error) => void;
}

// ============================================================================
// Trust History Store
// ============================================================================

export class TrustHistoryStore extends EventEmitter<StoreEvents> {
    private supabase: SupabaseClient;
    private tableName = 'trust_events';

    constructor(supabaseUrl?: string, supabaseKey?: string) {
        super();

        const url = supabaseUrl || process.env.SUPABASE_URL;
        const key = supabaseKey || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

        if (!url || !key) {
            throw new Error('Supabase URL and key are required');
        }

        this.supabase = createClient(url, key);
    }

    // =========================================================================
    // Event Storage
    // =========================================================================

    /**
     * Store a new trust event
     * Events are immutable once stored (append-only)
     */
    async store(input: TrustEventInput): Promise<StoredTrustEvent> {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .insert({
                agent_id: input.agentId,
                org_id: input.orgId,
                event_type: input.eventType,
                points: input.points,
                decay_days: input.decayDays,
                reason: input.reason || null,
                old_score: input.oldScore,
                new_score: input.newScore,
                metadata: input.metadata || null,
            })
            .select()
            .single();

        if (error) {
            const err = new Error(`Failed to store trust event: ${error.message}`);
            this.emit('error', err);
            throw err;
        }

        this.emit('event:stored', data);
        return data;
    }

    /**
     * Store multiple events in a batch
     */
    async storeBatch(inputs: TrustEventInput[]): Promise<StoredTrustEvent[]> {
        const records = inputs.map(input => ({
            agent_id: input.agentId,
            org_id: input.orgId,
            event_type: input.eventType,
            points: input.points,
            decay_days: input.decayDays,
            reason: input.reason || null,
            old_score: input.oldScore,
            new_score: input.newScore,
            metadata: input.metadata || null,
        }));

        const { data, error } = await this.supabase
            .from(this.tableName)
            .insert(records)
            .select();

        if (error) {
            const err = new Error(`Failed to store trust events: ${error.message}`);
            this.emit('error', err);
            throw err;
        }

        for (const event of data) {
            this.emit('event:stored', event);
        }

        return data;
    }

    // =========================================================================
    // Event Retrieval
    // =========================================================================

    /**
     * Get a single event by ID
     */
    async getById(id: string): Promise<StoredTrustEvent | null> {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select()
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw new Error(`Failed to get trust event: ${error.message}`);
        }

        return data;
    }

    /**
     * Get events for an agent
     */
    async getAgentEvents(
        agentId: string,
        options?: {
            limit?: number;
            offset?: number;
            startDate?: Date;
            endDate?: Date;
        }
    ): Promise<StoredTrustEvent[]> {
        let query = this.supabase
            .from(this.tableName)
            .select()
            .eq('agent_id', agentId)
            .order('created_at', { ascending: false });

        if (options?.startDate) {
            query = query.gte('created_at', options.startDate.toISOString());
        }
        if (options?.endDate) {
            query = query.lte('created_at', options.endDate.toISOString());
        }
        if (options?.limit) {
            query = query.limit(options.limit);
        }
        if (options?.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Failed to get agent events: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Get events for an organization
     */
    async getOrgEvents(
        orgId: string,
        options?: {
            limit?: number;
            offset?: number;
            startDate?: Date;
            endDate?: Date;
            eventType?: TrustEventType | TrustEventType[];
        }
    ): Promise<StoredTrustEvent[]> {
        let query = this.supabase
            .from(this.tableName)
            .select()
            .eq('org_id', orgId)
            .order('created_at', { ascending: false });

        if (options?.startDate) {
            query = query.gte('created_at', options.startDate.toISOString());
        }
        if (options?.endDate) {
            query = query.lte('created_at', options.endDate.toISOString());
        }
        if (options?.eventType) {
            if (Array.isArray(options.eventType)) {
                query = query.in('event_type', options.eventType);
            } else {
                query = query.eq('event_type', options.eventType);
            }
        }
        if (options?.limit) {
            query = query.limit(options.limit);
        }
        if (options?.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Failed to get org events: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Query events with flexible filters
     */
    async query(filters: TrustEventQuery): Promise<StoredTrustEvent[]> {
        let query = this.supabase
            .from(this.tableName)
            .select()
            .order('created_at', { ascending: false });

        if (filters.agentId) {
            query = query.eq('agent_id', filters.agentId);
        }
        if (filters.orgId) {
            query = query.eq('org_id', filters.orgId);
        }
        if (filters.eventType) {
            if (Array.isArray(filters.eventType)) {
                query = query.in('event_type', filters.eventType);
            } else {
                query = query.eq('event_type', filters.eventType);
            }
        }
        if (filters.startDate) {
            query = query.gte('created_at', filters.startDate.toISOString());
        }
        if (filters.endDate) {
            query = query.lte('created_at', filters.endDate.toISOString());
        }
        if (filters.limit) {
            query = query.limit(filters.limit);
        }
        if (filters.offset) {
            query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Failed to query events: ${error.message}`);
        }

        return data || [];
    }

    // =========================================================================
    // Statistics & Analysis
    // =========================================================================

    /**
     * Get event statistics for an agent
     */
    async getAgentStats(
        agentId: string,
        options?: {
            startDate?: Date;
            endDate?: Date;
        }
    ): Promise<TrustEventStats> {
        const events = await this.getAgentEvents(agentId, {
            startDate: options?.startDate,
            endDate: options?.endDate,
        });

        return this.calculateStats(events, options?.startDate, options?.endDate);
    }

    /**
     * Get event statistics for an organization
     */
    async getOrgStats(
        orgId: string,
        options?: {
            startDate?: Date;
            endDate?: Date;
        }
    ): Promise<TrustEventStats> {
        const events = await this.getOrgEvents(orgId, {
            startDate: options?.startDate,
            endDate: options?.endDate,
        });

        return this.calculateStats(events, options?.startDate, options?.endDate);
    }

    private calculateStats(
        events: StoredTrustEvent[],
        startDate?: Date,
        endDate?: Date
    ): TrustEventStats {
        const eventsByType: Record<string, number> = {};
        let netPointsChange = 0;

        for (const event of events) {
            eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1;
            netPointsChange += event.points;
        }

        // Calculate days in range
        const start = startDate || (events.length > 0 ? new Date(events[events.length - 1].created_at) : new Date());
        const end = endDate || new Date();
        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

        return {
            totalEvents: events.length,
            eventsByType,
            avgPointsPerDay: Math.round((netPointsChange / days) * 100) / 100,
            netPointsChange,
        };
    }

    /**
     * Get current scores for all agents in an org
     * Based on their most recent events
     */
    async getOrgAgentScores(orgId: string): Promise<AgentScoreSnapshot[]> {
        // Get the latest event for each agent using a subquery approach
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('agent_id, new_score, created_at')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to get org agent scores: ${error.message}`);
        }

        // Process to get latest score per agent
        const agentMap = new Map<string, AgentScoreSnapshot>();
        const agentEventCounts = new Map<string, number>();

        for (const row of data || []) {
            agentEventCounts.set(row.agent_id, (agentEventCounts.get(row.agent_id) || 0) + 1);

            if (!agentMap.has(row.agent_id)) {
                agentMap.set(row.agent_id, {
                    agentId: row.agent_id,
                    score: row.new_score,
                    lastEventAt: new Date(row.created_at),
                    eventCount: 0, // Will be set after
                });
            }
        }

        // Update event counts
        for (const [agentId, snapshot] of agentMap) {
            snapshot.eventCount = agentEventCounts.get(agentId) || 0;
        }

        return Array.from(agentMap.values());
    }

    /**
     * Get score trend over time for an agent
     */
    async getScoreTrend(
        agentId: string,
        days: number = 30
    ): Promise<{ date: Date; score: number }[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const events = await this.getAgentEvents(agentId, {
            startDate,
        });

        // Sort by date ascending for trend
        events.sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        // Create daily snapshots
        const trend: { date: Date; score: number }[] = [];

        if (events.length === 0) return trend;

        let currentScore = events[0].old_score;
        let currentDay = new Date(events[0].created_at);
        currentDay.setHours(0, 0, 0, 0);

        for (const event of events) {
            const eventDay = new Date(event.created_at);
            eventDay.setHours(0, 0, 0, 0);

            // Fill in days with no events
            while (currentDay < eventDay) {
                trend.push({ date: new Date(currentDay), score: currentScore });
                currentDay.setDate(currentDay.getDate() + 1);
            }

            currentScore = event.new_score;
        }

        // Add the final day
        trend.push({ date: new Date(currentDay), score: currentScore });

        return trend;
    }

    // =========================================================================
    // Active Events (For Decay Calculation)
    // =========================================================================

    /**
     * Get events that are still active (not fully decayed)
     */
    async getActiveEvents(agentId: string): Promise<StoredTrustEvent[]> {
        // Get all events and filter by decay
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select()
            .eq('agent_id', agentId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to get active events: ${error.message}`);
        }

        const now = Date.now();

        // Filter to only active (not fully decayed) events
        return (data || []).filter(event => {
            const ageMs = now - new Date(event.created_at).getTime();
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            return ageDays < event.decay_days;
        });
    }

    /**
     * Count events by type for an agent
     */
    async countEventsByType(
        agentId: string,
        startDate?: Date
    ): Promise<Record<string, number>> {
        let query = this.supabase
            .from(this.tableName)
            .select('event_type')
            .eq('agent_id', agentId);

        if (startDate) {
            query = query.gte('created_at', startDate.toISOString());
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Failed to count events: ${error.message}`);
        }

        const counts: Record<string, number> = {};
        for (const row of data || []) {
            counts[row.event_type] = (counts[row.event_type] || 0) + 1;
        }

        return counts;
    }

    // =========================================================================
    // Maintenance
    // =========================================================================

    /**
     * Archive old events (move to cold storage)
     * Note: This is a placeholder - actual archival would depend on infrastructure
     */
    async getArchivableEvents(olderThanDays: number): Promise<StoredTrustEvent[]> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const { data, error } = await this.supabase
            .from(this.tableName)
            .select()
            .lt('created_at', cutoffDate.toISOString())
            .order('created_at', { ascending: true })
            .limit(1000);

        if (error) {
            throw new Error(`Failed to get archivable events: ${error.message}`);
        }

        return data || [];
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let storeInstance: TrustHistoryStore | null = null;

export function getTrustHistoryStore(supabaseUrl?: string, supabaseKey?: string): TrustHistoryStore {
    if (!storeInstance) {
        storeInstance = new TrustHistoryStore(supabaseUrl, supabaseKey);
    }
    return storeInstance;
}

export function resetTrustHistoryStore(): void {
    storeInstance = null;
}
