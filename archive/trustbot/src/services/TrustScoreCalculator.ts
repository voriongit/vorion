/**
 * Trust Score Calculator
 *
 * Epic 11: Live Trust Scoring Engine
 * Story 11.1: Trust Score Calculator
 *
 * Calculates trust scores based on agent behavior with:
 * - Event-based scoring with configurable weights
 * - Time-based decay for events
 * - 30-day rolling history
 * - Min/Max score bounds
 */

import { EventEmitter } from 'eventemitter3';

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
    | 'manual_adjustment';

export interface TrustEvent {
    id: string;
    agentId: string;
    orgId: string;
    eventType: TrustEventType;
    points: number;
    decayDays: number;
    reason?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}

export interface TrustEventConfig {
    points: number;
    decayDays: number;
}

export interface ScoringConfig {
    events: Record<TrustEventType, TrustEventConfig>;
    minScore: number;
    maxScore: number;
    baseScore: number;
    decayFunction: 'linear' | 'exponential';
}

export interface AgentTrustState {
    agentId: string;
    orgId: string;
    currentScore: number;
    baseScore: number;
    events: TrustEvent[];
    lastCalculatedAt: Date;
    eventCounts: Record<TrustEventType, number>;
}

export interface ScoreChange {
    agentId: string;
    oldScore: number;
    newScore: number;
    delta: number;
    eventType: TrustEventType;
    reason?: string;
    timestamp: Date;
}

interface CalculatorEvents {
    'score:changed': (change: ScoreChange) => void;
    'event:recorded': (event: TrustEvent) => void;
    'score:recalculated': (agentId: string, score: number) => void;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_EVENT_CONFIG: Record<TrustEventType, TrustEventConfig> = {
    task_completed: { points: 10, decayDays: 30 },
    task_reviewed_positive: { points: 5, decayDays: 30 },
    task_reviewed_negative: { points: -5, decayDays: 30 },
    task_failed: { points: -15, decayDays: 14 },
    task_timeout: { points: -10, decayDays: 14 },
    invalid_delegation: { points: -20, decayDays: 7 },
    security_violation: { points: -50, decayDays: 60 },
    manual_adjustment: { points: 0, decayDays: 30 }, // Points set dynamically
};

const DEFAULT_CONFIG: ScoringConfig = {
    events: DEFAULT_EVENT_CONFIG,
    minScore: 0,
    maxScore: 1000,
    baseScore: 300,
    decayFunction: 'linear',
};

// ============================================================================
// Trust Score Calculator
// ============================================================================

export class TrustScoreCalculator extends EventEmitter<CalculatorEvents> {
    private config: ScoringConfig;

    // Agent trust state tracking
    private agentStates: Map<string, AgentTrustState> = new Map();

    // Organization-specific config overrides
    private orgConfigs: Map<string, Partial<ScoringConfig>> = new Map();

    constructor(config: Partial<ScoringConfig> = {}) {
        super();
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
            events: { ...DEFAULT_EVENT_CONFIG, ...config.events },
        };
    }

    // =========================================================================
    // Event Recording
    // =========================================================================

    /**
     * Record a trust event for an agent
     */
    recordEvent(
        agentId: string,
        orgId: string,
        eventType: TrustEventType,
        options?: {
            reason?: string;
            points?: number; // Override default points (for manual_adjustment)
            metadata?: Record<string, unknown>;
        }
    ): TrustEvent {
        const eventConfig = this.getEventConfig(orgId, eventType);
        const points = options?.points ?? eventConfig.points;

        const event: TrustEvent = {
            id: this.generateEventId(),
            agentId,
            orgId,
            eventType,
            points,
            decayDays: eventConfig.decayDays,
            reason: options?.reason,
            metadata: options?.metadata,
            createdAt: new Date(),
        };

        // Get or create agent state
        const state = this.getOrCreateAgentState(agentId, orgId);
        const oldScore = state.currentScore;

        // Add event
        state.events.push(event);
        state.eventCounts[eventType] = (state.eventCounts[eventType] || 0) + 1;

        // Recalculate score
        state.currentScore = this.calculateScore(state);
        state.lastCalculatedAt = new Date();

        // Emit events
        this.emit('event:recorded', event);

        if (state.currentScore !== oldScore) {
            const change: ScoreChange = {
                agentId,
                oldScore,
                newScore: state.currentScore,
                delta: state.currentScore - oldScore,
                eventType,
                reason: options?.reason,
                timestamp: new Date(),
            };
            this.emit('score:changed', change);
        }

        return event;
    }

    /**
     * Record multiple events at once
     */
    recordEvents(
        agentId: string,
        orgId: string,
        events: Array<{
            eventType: TrustEventType;
            reason?: string;
            points?: number;
            metadata?: Record<string, unknown>;
        }>
    ): TrustEvent[] {
        return events.map(e => this.recordEvent(agentId, orgId, e.eventType, {
            reason: e.reason,
            points: e.points,
            metadata: e.metadata,
        }));
    }

    // =========================================================================
    // Score Calculation
    // =========================================================================

    /**
     * Calculate the current trust score for an agent
     */
    calculateScore(state: AgentTrustState): number {
        const now = Date.now();
        const config = this.getOrgConfig(state.orgId);

        // Use agent's base score (which may differ from config if initialized with custom value)
        let score = state.baseScore;

        for (const event of state.events) {
            const ageMs = now - event.createdAt.getTime();
            const ageDays = ageMs / (1000 * 60 * 60 * 24);

            // Skip fully decayed events
            if (ageDays >= event.decayDays) continue;

            // Calculate decay factor
            const decayFactor = this.calculateDecayFactor(ageDays, event.decayDays, config.decayFunction);

            // Apply weighted points
            score += event.points * decayFactor;
        }

        // Clamp to bounds
        return Math.round(Math.max(config.minScore, Math.min(config.maxScore, score)));
    }

    /**
     * Calculate decay factor based on age
     */
    private calculateDecayFactor(ageDays: number, decayDays: number, decayFunction: 'linear' | 'exponential'): number {
        if (ageDays <= 0) return 1;
        if (ageDays >= decayDays) return 0;

        if (decayFunction === 'exponential') {
            // Exponential decay: e^(-k*t) where k is calculated so that at decayDays we have ~5% remaining
            const k = -Math.log(0.05) / decayDays;
            return Math.exp(-k * ageDays);
        }

        // Linear decay
        return 1 - (ageDays / decayDays);
    }

    /**
     * Recalculate score for an agent (cleanup old events)
     */
    recalculateScore(agentId: string): number | null {
        const state = this.agentStates.get(agentId);
        if (!state) return null;

        // Remove fully decayed events
        const now = Date.now();
        state.events = state.events.filter(event => {
            const ageMs = now - event.createdAt.getTime();
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            return ageDays < event.decayDays;
        });

        // Recalculate
        const oldScore = state.currentScore;
        state.currentScore = this.calculateScore(state);
        state.lastCalculatedAt = new Date();

        if (state.currentScore !== oldScore) {
            this.emit('score:recalculated', agentId, state.currentScore);
        }

        return state.currentScore;
    }

    /**
     * Recalculate scores for all agents
     */
    recalculateAllScores(): Map<string, number> {
        const scores = new Map<string, number>();

        for (const agentId of this.agentStates.keys()) {
            const score = this.recalculateScore(agentId);
            if (score !== null) {
                scores.set(agentId, score);
            }
        }

        return scores;
    }

    // =========================================================================
    // Score Retrieval
    // =========================================================================

    /**
     * Get current score for an agent
     */
    getScore(agentId: string): number | null {
        const state = this.agentStates.get(agentId);
        if (!state) return null;

        return state.currentScore;
    }

    /**
     * Get score, recalculating if stale
     */
    getFreshScore(agentId: string, maxAgeMs: number = 60000): number | null {
        const state = this.agentStates.get(agentId);
        if (!state) return null;

        const age = Date.now() - state.lastCalculatedAt.getTime();
        if (age > maxAgeMs) {
            return this.recalculateScore(agentId);
        }

        return state.currentScore;
    }

    /**
     * Get agent trust state
     */
    getAgentState(agentId: string): AgentTrustState | null {
        return this.agentStates.get(agentId) ?? null;
    }

    /**
     * Get all agent scores for an org
     */
    getOrgScores(orgId: string): Map<string, number> {
        const scores = new Map<string, number>();

        for (const [agentId, state] of this.agentStates) {
            if (state.orgId === orgId) {
                scores.set(agentId, state.currentScore);
            }
        }

        return scores;
    }

    /**
     * Get recent events for an agent
     */
    getRecentEvents(agentId: string, limit: number = 50): TrustEvent[] {
        const state = this.agentStates.get(agentId);
        if (!state) return [];

        return state.events
            .slice()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }

    /**
     * Get events by type for an agent
     */
    getEventsByType(agentId: string, eventType: TrustEventType): TrustEvent[] {
        const state = this.agentStates.get(agentId);
        if (!state) return [];

        return state.events.filter(e => e.eventType === eventType);
    }

    /**
     * Get event counts for an agent
     */
    getEventCounts(agentId: string): Record<TrustEventType, number> | null {
        const state = this.agentStates.get(agentId);
        if (!state) return null;

        return { ...state.eventCounts };
    }

    // =========================================================================
    // Score Analysis
    // =========================================================================

    /**
     * Get score breakdown showing contribution of each event type
     */
    getScoreBreakdown(agentId: string): Record<TrustEventType, { count: number; totalPoints: number; currentContribution: number }> | null {
        const state = this.agentStates.get(agentId);
        if (!state) return null;

        const now = Date.now();
        const config = this.getOrgConfig(state.orgId);
        const breakdown: Record<string, { count: number; totalPoints: number; currentContribution: number }> = {};

        // Initialize all event types
        for (const eventType of Object.keys(this.config.events) as TrustEventType[]) {
            breakdown[eventType] = { count: 0, totalPoints: 0, currentContribution: 0 };
        }

        for (const event of state.events) {
            const ageMs = now - event.createdAt.getTime();
            const ageDays = ageMs / (1000 * 60 * 60 * 24);

            breakdown[event.eventType].count++;
            breakdown[event.eventType].totalPoints += event.points;

            if (ageDays < event.decayDays) {
                const decayFactor = this.calculateDecayFactor(ageDays, event.decayDays, config.decayFunction);
                breakdown[event.eventType].currentContribution += event.points * decayFactor;
            }
        }

        // Round contributions
        for (const key of Object.keys(breakdown)) {
            breakdown[key].currentContribution = Math.round(breakdown[key].currentContribution * 100) / 100;
        }

        return breakdown as Record<TrustEventType, { count: number; totalPoints: number; currentContribution: number }>;
    }

    /**
     * Get score trend over time
     */
    getScoreTrend(agentId: string, days: number = 7): { date: Date; score: number }[] {
        const state = this.agentStates.get(agentId);
        if (!state) return [];

        const trend: { date: Date; score: number }[] = [];
        const now = new Date();

        for (let i = days; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            date.setHours(23, 59, 59, 999);

            // Calculate score as of this date
            const score = this.calculateScoreAsOf(state, date);
            trend.push({ date, score });
        }

        return trend;
    }

    /**
     * Calculate score as of a specific date
     */
    private calculateScoreAsOf(state: AgentTrustState, asOf: Date): number {
        const asOfMs = asOf.getTime();
        const config = this.getOrgConfig(state.orgId);

        let score = config.baseScore;

        for (const event of state.events) {
            // Only include events created before asOf
            if (event.createdAt.getTime() > asOfMs) continue;

            const ageMs = asOfMs - event.createdAt.getTime();
            const ageDays = ageMs / (1000 * 60 * 60 * 24);

            // Skip fully decayed events
            if (ageDays >= event.decayDays) continue;

            const decayFactor = this.calculateDecayFactor(ageDays, event.decayDays, config.decayFunction);
            score += event.points * decayFactor;
        }

        return Math.round(Math.max(config.minScore, Math.min(config.maxScore, score)));
    }

    // =========================================================================
    // Configuration
    // =========================================================================

    /**
     * Set organization-specific scoring config
     */
    setOrgConfig(orgId: string, config: Partial<ScoringConfig>): void {
        this.orgConfigs.set(orgId, config);

        // Recalculate scores for this org
        for (const [agentId, state] of this.agentStates) {
            if (state.orgId === orgId) {
                this.recalculateScore(agentId);
            }
        }
    }

    /**
     * Get organization-specific config (merged with defaults)
     */
    getOrgConfig(orgId: string): ScoringConfig {
        const orgConfig = this.orgConfigs.get(orgId);
        if (!orgConfig) return this.config;

        return {
            ...this.config,
            ...orgConfig,
            events: { ...this.config.events, ...orgConfig.events },
        };
    }

    /**
     * Get event config for a specific org and event type
     */
    getEventConfig(orgId: string, eventType: TrustEventType): TrustEventConfig {
        const orgConfig = this.getOrgConfig(orgId);
        return orgConfig.events[eventType];
    }

    /**
     * Update global config
     */
    updateConfig(config: Partial<ScoringConfig>): void {
        this.config = {
            ...this.config,
            ...config,
            events: { ...this.config.events, ...config.events },
        };
    }

    // =========================================================================
    // Agent Management
    // =========================================================================

    /**
     * Initialize an agent with base score
     */
    initializeAgent(agentId: string, orgId: string, initialScore?: number): AgentTrustState {
        const config = this.getOrgConfig(orgId);
        const score = initialScore ?? config.baseScore;

        const state: AgentTrustState = {
            agentId,
            orgId,
            currentScore: score,
            baseScore: score,
            events: [],
            lastCalculatedAt: new Date(),
            eventCounts: {} as Record<TrustEventType, number>,
        };

        this.agentStates.set(agentId, state);

        return state;
    }

    /**
     * Remove an agent from tracking
     */
    removeAgent(agentId: string): boolean {
        return this.agentStates.delete(agentId);
    }

    /**
     * Check if agent exists
     */
    hasAgent(agentId: string): boolean {
        return this.agentStates.has(agentId);
    }

    private getOrCreateAgentState(agentId: string, orgId: string): AgentTrustState {
        let state = this.agentStates.get(agentId);
        if (!state) {
            state = this.initializeAgent(agentId, orgId);
        }
        return state;
    }

    // =========================================================================
    // Bulk Operations
    // =========================================================================

    /**
     * Get all agents with scores below threshold
     */
    getAgentsBelowThreshold(threshold: number, orgId?: string): AgentTrustState[] {
        const agents: AgentTrustState[] = [];

        for (const state of this.agentStates.values()) {
            if (orgId && state.orgId !== orgId) continue;
            if (state.currentScore < threshold) {
                agents.push(state);
            }
        }

        return agents;
    }

    /**
     * Get top performing agents
     */
    getTopAgents(limit: number, orgId?: string): AgentTrustState[] {
        const agents: AgentTrustState[] = [];

        for (const state of this.agentStates.values()) {
            if (orgId && state.orgId !== orgId) continue;
            agents.push(state);
        }

        return agents
            .sort((a, b) => b.currentScore - a.currentScore)
            .slice(0, limit);
    }

    // =========================================================================
    // Statistics
    // =========================================================================

    /**
     * Get aggregate statistics
     */
    getStats(orgId?: string): {
        totalAgents: number;
        averageScore: number;
        minScore: number;
        maxScore: number;
        totalEvents: number;
    } {
        let totalAgents = 0;
        let totalScore = 0;
        let minScore = Infinity;
        let maxScore = -Infinity;
        let totalEvents = 0;

        for (const state of this.agentStates.values()) {
            if (orgId && state.orgId !== orgId) continue;

            totalAgents++;
            totalScore += state.currentScore;
            minScore = Math.min(minScore, state.currentScore);
            maxScore = Math.max(maxScore, state.currentScore);
            totalEvents += state.events.length;
        }

        return {
            totalAgents,
            averageScore: totalAgents > 0 ? Math.round(totalScore / totalAgents) : 0,
            minScore: totalAgents > 0 ? minScore : 0,
            maxScore: totalAgents > 0 ? maxScore : 0,
            totalEvents,
        };
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /**
     * Clear all state
     */
    clear(): void {
        this.agentStates.clear();
        this.orgConfigs.clear();
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    private generateEventId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        return `evt_${timestamp}_${random}`;
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let calculatorInstance: TrustScoreCalculator | null = null;

export function getTrustScoreCalculator(config?: Partial<ScoringConfig>): TrustScoreCalculator {
    if (!calculatorInstance) {
        calculatorInstance = new TrustScoreCalculator(config);
    }
    return calculatorInstance;
}

export function resetTrustScoreCalculator(): void {
    if (calculatorInstance) {
        calculatorInstance.clear();
    }
    calculatorInstance = null;
}
