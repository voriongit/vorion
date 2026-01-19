/**
 * TrustEventStore
 *
 * Epic 11: Live Trust Scoring Engine
 * Story 11.4: Trust Event Sourcing
 *
 * Immutable event store with hash chain for tamper detection.
 * Implements event sourcing pattern for complete trust audit trail.
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type TrustEventType =
    | 'task_completed'
    | 'task_reviewed_positive'
    | 'task_reviewed_negative'
    | 'task_failed'
    | 'task_timeout'
    | 'invalid_delegation'
    | 'security_violation'
    | 'manual_adjustment'
    | 'tier_promotion'
    | 'tier_demotion'
    | 'score_decay'
    | 'score_reset';

export interface TrustEvent {
    id: string;
    sequence: number;
    agentId: string;
    orgId: string;
    eventType: TrustEventType;
    points: number;
    oldScore: number;
    newScore: number;
    reason?: string;
    metadata?: Record<string, unknown>;
    timestamp: number;
    previousHash: string;
    hash: string;
}

export interface TrustEventInput {
    agentId: string;
    orgId: string;
    eventType: TrustEventType;
    points: number;
    oldScore: number;
    newScore: number;
    reason?: string;
    metadata?: Record<string, unknown>;
}

export interface EventQueryOptions {
    startTime?: number;
    endTime?: number;
    eventTypes?: TrustEventType[];
    limit?: number;
    offset?: number;
    order?: 'asc' | 'desc';
}

export interface IntegrityCheckResult {
    valid: boolean;
    checkedEvents: number;
    firstInvalidSequence?: number;
    errors: string[];
}

export interface EventStoreStats {
    totalEvents: number;
    eventsByType: Record<TrustEventType, number>;
    eventsByAgent: Record<string, number>;
    oldestEvent?: number;
    newestEvent?: number;
}

export interface TrustEventStoreConfig {
    genesisHash?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// ============================================================================
// TrustEventStore
// ============================================================================

export class TrustEventStore extends EventEmitter {
    private events: Map<string, TrustEvent> = new Map();
    private eventsByAgent: Map<string, string[]> = new Map();
    private eventsByOrg: Map<string, string[]> = new Map();
    private sequenceByAgent: Map<string, number> = new Map();
    private latestHashByAgent: Map<string, string> = new Map();
    private globalSequence: number = 0;
    private genesisHash: string;

    constructor(config: TrustEventStoreConfig = {}) {
        super();
        this.genesisHash = config.genesisHash || DEFAULT_GENESIS_HASH;
    }

    // ========================================================================
    // Event Appending
    // ========================================================================

    /**
     * Append a new event to the store.
     * Events are immutable - once appended, they cannot be modified.
     */
    append(input: TrustEventInput): TrustEvent {
        const agentSequence = (this.sequenceByAgent.get(input.agentId) || 0) + 1;
        const previousHash = this.latestHashByAgent.get(input.agentId) || this.genesisHash;
        this.globalSequence++;

        const timestamp = Date.now();
        const id = this.generateEventId(input.agentId, agentSequence);

        // Create event without hash first
        const eventData = {
            id,
            sequence: agentSequence,
            agentId: input.agentId,
            orgId: input.orgId,
            eventType: input.eventType,
            points: input.points,
            oldScore: input.oldScore,
            newScore: input.newScore,
            reason: input.reason,
            metadata: input.metadata,
            timestamp,
            previousHash,
        };

        // Calculate hash including all event data
        const hash = this.calculateHash(eventData);

        const event: TrustEvent = {
            ...eventData,
            hash,
        };

        // Store event
        this.events.set(id, event);

        // Index by agent
        const agentEvents = this.eventsByAgent.get(input.agentId) || [];
        agentEvents.push(id);
        this.eventsByAgent.set(input.agentId, agentEvents);

        // Index by org
        const orgEvents = this.eventsByOrg.get(input.orgId) || [];
        orgEvents.push(id);
        this.eventsByOrg.set(input.orgId, orgEvents);

        // Update sequence and hash tracking
        this.sequenceByAgent.set(input.agentId, agentSequence);
        this.latestHashByAgent.set(input.agentId, hash);

        // Emit event
        this.emit('event:appended', event);

        return event;
    }

    /**
     * Append multiple events in order.
     */
    appendBatch(inputs: TrustEventInput[]): TrustEvent[] {
        return inputs.map((input) => this.append(input));
    }

    // ========================================================================
    // Event Retrieval
    // ========================================================================

    /**
     * Get event by ID.
     */
    getById(id: string): TrustEvent | null {
        return this.events.get(id) || null;
    }

    /**
     * Get event by agent and sequence number.
     */
    getBySequence(agentId: string, sequence: number): TrustEvent | null {
        const id = this.generateEventId(agentId, sequence);
        return this.getById(id);
    }

    /**
     * Get all events for an agent.
     */
    getAgentEvents(agentId: string, options: EventQueryOptions = {}): TrustEvent[] {
        const eventIds = this.eventsByAgent.get(agentId) || [];
        return this.filterAndSortEvents(eventIds, options);
    }

    /**
     * Get all events for an organization.
     */
    getOrgEvents(orgId: string, options: EventQueryOptions = {}): TrustEvent[] {
        const eventIds = this.eventsByOrg.get(orgId) || [];
        return this.filterAndSortEvents(eventIds, options);
    }

    /**
     * Get latest event for an agent.
     */
    getLatestEvent(agentId: string): TrustEvent | null {
        const sequence = this.sequenceByAgent.get(agentId);
        if (!sequence) return null;
        return this.getBySequence(agentId, sequence);
    }

    /**
     * Get event count for an agent.
     */
    getEventCount(agentId: string): number {
        return this.sequenceByAgent.get(agentId) || 0;
    }

    /**
     * Get the current sequence number for an agent.
     */
    getSequence(agentId: string): number {
        return this.sequenceByAgent.get(agentId) || 0;
    }

    // ========================================================================
    // Hash Chain Verification
    // ========================================================================

    /**
     * Verify the integrity of an agent's event chain.
     */
    verifyAgentChain(agentId: string): IntegrityCheckResult {
        const events = this.getAgentEvents(agentId, { order: 'asc' });
        return this.verifyEventChain(events);
    }

    /**
     * Verify the integrity of an org's event chain.
     */
    verifyOrgChain(orgId: string): IntegrityCheckResult {
        // For org-level verification, we verify each agent's chain separately
        const agentIds = new Set<string>();
        const orgEventIds = this.eventsByOrg.get(orgId) || [];

        for (const eventId of orgEventIds) {
            const event = this.events.get(eventId);
            if (event) {
                agentIds.add(event.agentId);
            }
        }

        const errors: string[] = [];
        let totalChecked = 0;
        let firstInvalid: number | undefined;

        for (const agentId of agentIds) {
            const result = this.verifyAgentChain(agentId);
            totalChecked += result.checkedEvents;
            errors.push(...result.errors);
            if (!result.valid && firstInvalid === undefined) {
                firstInvalid = result.firstInvalidSequence;
            }
        }

        return {
            valid: errors.length === 0,
            checkedEvents: totalChecked,
            firstInvalidSequence: firstInvalid,
            errors,
        };
    }

    /**
     * Verify a chain of events.
     */
    private verifyEventChain(events: TrustEvent[]): IntegrityCheckResult {
        const errors: string[] = [];
        let expectedPreviousHash = this.genesisHash;

        for (const event of events) {
            // Verify previous hash chain
            if (event.previousHash !== expectedPreviousHash) {
                errors.push(
                    `Event ${event.id}: previousHash mismatch. Expected ${expectedPreviousHash}, got ${event.previousHash}`
                );
                return {
                    valid: false,
                    checkedEvents: events.indexOf(event) + 1,
                    firstInvalidSequence: event.sequence,
                    errors,
                };
            }

            // Verify event hash
            const calculatedHash = this.calculateHash({
                id: event.id,
                sequence: event.sequence,
                agentId: event.agentId,
                orgId: event.orgId,
                eventType: event.eventType,
                points: event.points,
                oldScore: event.oldScore,
                newScore: event.newScore,
                reason: event.reason,
                metadata: event.metadata,
                timestamp: event.timestamp,
                previousHash: event.previousHash,
            });

            if (event.hash !== calculatedHash) {
                errors.push(
                    `Event ${event.id}: hash mismatch. Expected ${calculatedHash}, got ${event.hash}`
                );
                return {
                    valid: false,
                    checkedEvents: events.indexOf(event) + 1,
                    firstInvalidSequence: event.sequence,
                    errors,
                };
            }

            expectedPreviousHash = event.hash;
        }

        return {
            valid: true,
            checkedEvents: events.length,
            errors: [],
        };
    }

    /**
     * Verify a single event's hash.
     */
    verifyEvent(eventId: string): boolean {
        const event = this.events.get(eventId);
        if (!event) return false;

        const calculatedHash = this.calculateHash({
            id: event.id,
            sequence: event.sequence,
            agentId: event.agentId,
            orgId: event.orgId,
            eventType: event.eventType,
            points: event.points,
            oldScore: event.oldScore,
            newScore: event.newScore,
            reason: event.reason,
            metadata: event.metadata,
            timestamp: event.timestamp,
            previousHash: event.previousHash,
        });

        return event.hash === calculatedHash;
    }

    // ========================================================================
    // Replay / State Reconstruction
    // ========================================================================

    /**
     * Replay events to reconstruct an agent's score at a point in time.
     */
    replayToTime(agentId: string, targetTime: number, baseScore: number = 300): number {
        const events = this.getAgentEvents(agentId, {
            endTime: targetTime,
            order: 'asc',
        });

        let score = baseScore;
        for (const event of events) {
            score = event.newScore;
        }

        return score;
    }

    /**
     * Replay events to reconstruct an agent's score at a sequence number.
     */
    replayToSequence(agentId: string, targetSequence: number, baseScore: number = 300): number {
        const events = this.getAgentEvents(agentId, { order: 'asc' });

        let score = baseScore;
        for (const event of events) {
            if (event.sequence > targetSequence) break;
            score = event.newScore;
        }

        return score;
    }

    /**
     * Get score history for an agent (useful for charting).
     */
    getScoreHistory(agentId: string, options: EventQueryOptions = {}): Array<{ timestamp: number; score: number }> {
        const events = this.getAgentEvents(agentId, { ...options, order: 'asc' });
        return events.map((e) => ({ timestamp: e.timestamp, score: e.newScore }));
    }

    // ========================================================================
    // Statistics
    // ========================================================================

    /**
     * Get store statistics.
     */
    getStats(orgId?: string): EventStoreStats {
        const eventIds = orgId
            ? this.eventsByOrg.get(orgId) || []
            : Array.from(this.events.keys());

        const eventsByType: Record<string, number> = {};
        const eventsByAgent: Record<string, number> = {};
        let oldest: number | undefined;
        let newest: number | undefined;

        for (const id of eventIds) {
            const event = this.events.get(id);
            if (!event) continue;

            // Count by type
            eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;

            // Count by agent
            eventsByAgent[event.agentId] = (eventsByAgent[event.agentId] || 0) + 1;

            // Track time range
            if (oldest === undefined || event.timestamp < oldest) {
                oldest = event.timestamp;
            }
            if (newest === undefined || event.timestamp > newest) {
                newest = event.timestamp;
            }
        }

        return {
            totalEvents: eventIds.length,
            eventsByType: eventsByType as Record<TrustEventType, number>,
            eventsByAgent,
            oldestEvent: oldest,
            newestEvent: newest,
        };
    }

    /**
     * Get point delta for an agent in a time range.
     */
    getPointsDelta(agentId: string, startTime?: number, endTime?: number): number {
        const events = this.getAgentEvents(agentId, {
            startTime,
            endTime,
            order: 'asc',
        });

        return events.reduce((sum, e) => sum + e.points, 0);
    }

    // ========================================================================
    // Lifecycle
    // ========================================================================

    /**
     * Clear all events (for testing).
     */
    clear(): void {
        this.events.clear();
        this.eventsByAgent.clear();
        this.eventsByOrg.clear();
        this.sequenceByAgent.clear();
        this.latestHashByAgent.clear();
        this.globalSequence = 0;
    }

    /**
     * Get global event count.
     */
    get size(): number {
        return this.events.size;
    }

    // ========================================================================
    // Private Helpers
    // ========================================================================

    private generateEventId(agentId: string, sequence: number): string {
        return `${agentId}:${sequence}`;
    }

    private calculateHash(data: Omit<TrustEvent, 'hash'>): string {
        const content = JSON.stringify({
            id: data.id,
            sequence: data.sequence,
            agentId: data.agentId,
            orgId: data.orgId,
            eventType: data.eventType,
            points: data.points,
            oldScore: data.oldScore,
            newScore: data.newScore,
            reason: data.reason || null,
            metadata: data.metadata || null,
            timestamp: data.timestamp,
            previousHash: data.previousHash,
        });

        return crypto.createHash('sha256').update(content).digest('hex');
    }

    private filterAndSortEvents(eventIds: string[], options: EventQueryOptions): TrustEvent[] {
        let events: TrustEvent[] = [];

        for (const id of eventIds) {
            const event = this.events.get(id);
            if (!event) continue;

            // Time filters
            if (options.startTime !== undefined && event.timestamp < options.startTime) {
                continue;
            }
            if (options.endTime !== undefined && event.timestamp > options.endTime) {
                continue;
            }

            // Event type filter
            if (options.eventTypes && !options.eventTypes.includes(event.eventType)) {
                continue;
            }

            events.push(event);
        }

        // Sort
        const order = options.order || 'desc';
        events.sort((a, b) => {
            return order === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
        });

        // Pagination
        const offset = options.offset || 0;
        const limit = options.limit;

        if (offset > 0) {
            events = events.slice(offset);
        }
        if (limit !== undefined) {
            events = events.slice(0, limit);
        }

        return events;
    }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: TrustEventStore | null = null;

export function getTrustEventStore(config?: TrustEventStoreConfig): TrustEventStore {
    if (!instance) {
        instance = new TrustEventStore(config);
    }
    return instance;
}

export function resetTrustEventStore(): void {
    if (instance) {
        instance.clear();
    }
    instance = null;
}

export default TrustEventStore;
