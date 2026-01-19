/**
 * Tier Manager
 *
 * Epic 11: Live Trust Scoring Engine
 * Story 11.3: Automatic Tier Management
 *
 * Manages automatic tier promotion/demotion based on trust scores.
 * Tiers determine agent capabilities and permissions.
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export type TierLevel =
    | 'UNTRUSTED'
    | 'PROBATIONARY'
    | 'TRUSTED'
    | 'VERIFIED'
    | 'CERTIFIED'
    | 'ELITE';

export interface TierDefinition {
    level: TierLevel;
    minScore: number;
    maxScore: number;
    capabilities: TierCapability[];
    maxConcurrentTasks: number;
    description: string;
}

export type TierCapability =
    | 'execute'           // Can execute tasks
    | 'delegate'          // Can delegate to other agents
    | 'spawn'             // Can spawn new agents
    | 'unlimited_tasks'   // No task limit
    | 'approve_low_risk'  // Can auto-approve low-risk actions
    | 'approve_medium_risk'; // Can auto-approve medium-risk actions

export interface AgentTierState {
    agentId: string;
    orgId: string;
    currentScore: number;
    currentTier: TierLevel;
    previousTier: TierLevel | null;
    tierChangedAt: Date | null;
    capabilities: TierCapability[];
    maxConcurrentTasks: number;
}

export interface TierChange {
    agentId: string;
    orgId: string;
    previousTier: TierLevel;
    newTier: TierLevel;
    previousScore: number;
    newScore: number;
    direction: 'promotion' | 'demotion' | 'lateral';
    timestamp: Date;
}

export interface TierManagerConfig {
    /** Whether to allow demotion (default: true) */
    allowDemotion: boolean;
    /** Grace period before demotion in ms (default: 0) */
    demotionGracePeriodMs: number;
    /** Hysteresis points to prevent tier oscillation (default: 10) */
    hysteresisPoints: number;
}

interface ManagerEvents {
    'tier:changed': (change: TierChange) => void;
    'tier:promotion': (change: TierChange) => void;
    'tier:demotion': (change: TierChange) => void;
    'tier:warning': (agentId: string, message: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_TIERS: TierDefinition[] = [
    {
        level: 'UNTRUSTED',
        minScore: 0,
        maxScore: 199,
        capabilities: [],
        maxConcurrentTasks: 0,
        description: 'No capabilities - agent is not trusted',
    },
    {
        level: 'PROBATIONARY',
        minScore: 200,
        maxScore: 399,
        capabilities: ['execute'],
        maxConcurrentTasks: 1,
        description: 'Execute only - limited to single task at a time',
    },
    {
        level: 'TRUSTED',
        minScore: 400,
        maxScore: 599,
        capabilities: ['execute'],
        maxConcurrentTasks: 3,
        description: 'Standard operations - up to 3 concurrent tasks',
    },
    {
        level: 'VERIFIED',
        minScore: 600,
        maxScore: 799,
        capabilities: ['execute', 'delegate'],
        maxConcurrentTasks: 5,
        description: 'Can delegate tasks to other agents',
    },
    {
        level: 'CERTIFIED',
        minScore: 800,
        maxScore: 949,
        capabilities: ['execute', 'delegate', 'spawn', 'approve_low_risk'],
        maxConcurrentTasks: 10,
        description: 'Can spawn new agents and auto-approve low-risk actions',
    },
    {
        level: 'ELITE',
        minScore: 950,
        maxScore: 1000,
        capabilities: ['execute', 'delegate', 'spawn', 'approve_low_risk', 'approve_medium_risk', 'unlimited_tasks'],
        maxConcurrentTasks: -1, // Unlimited
        description: 'Full capabilities with no restrictions',
    },
];

const DEFAULT_CONFIG: TierManagerConfig = {
    allowDemotion: true,
    demotionGracePeriodMs: 0,
    hysteresisPoints: 10,
};

// ============================================================================
// Tier Manager
// ============================================================================

export class TierManager extends EventEmitter<ManagerEvents> {
    private config: TierManagerConfig;
    private tiers: TierDefinition[];

    // Agent state tracking
    private agentStates: Map<string, AgentTierState> = new Map();

    // Pending demotions (for grace period)
    private pendingDemotions: Map<string, { newTier: TierLevel; scheduledAt: Date; timer: ReturnType<typeof setTimeout> }> = new Map();

    // Organization-specific tier configs
    private orgTierConfigs: Map<string, TierDefinition[]> = new Map();

    constructor(config: Partial<TierManagerConfig> = {}, tiers?: TierDefinition[]) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.tiers = tiers || [...DEFAULT_TIERS];

        // Validate tiers are sorted
        this.validateTiers();
    }

    // =========================================================================
    // Tier Calculation
    // =========================================================================

    /**
     * Get the tier for a given score
     */
    getTierForScore(score: number, orgId?: string): TierDefinition {
        const tiers = this.getOrgTiers(orgId);

        for (const tier of tiers) {
            if (score >= tier.minScore && score <= tier.maxScore) {
                return tier;
            }
        }

        // Fallback to lowest tier
        return tiers[0];
    }

    /**
     * Update agent tier based on new score
     */
    updateAgentTier(agentId: string, orgId: string, newScore: number): TierChange | null {
        const state = this.getOrCreateAgentState(agentId, orgId);
        const oldScore = state.currentScore;
        const oldTier = state.currentTier;

        // Calculate new tier
        const newTierDef = this.getTierForScore(newScore, orgId);
        const newTier = newTierDef.level;

        // Update score
        state.currentScore = newScore;

        // Check if tier changed
        if (oldTier === newTier) {
            return null;
        }

        // Determine direction
        const oldTierIndex = this.getTierIndex(oldTier, orgId);
        const newTierIndex = this.getTierIndex(newTier, orgId);
        const direction: 'promotion' | 'demotion' | 'lateral' =
            newTierIndex > oldTierIndex ? 'promotion' :
            newTierIndex < oldTierIndex ? 'demotion' : 'lateral';

        // Handle demotion with hysteresis
        if (direction === 'demotion') {
            // Check hysteresis - only demote if score is clearly below threshold
            const currentTierDef = this.getTierDefinition(oldTier, orgId);
            if (currentTierDef && newScore >= currentTierDef.minScore - this.config.hysteresisPoints) {
                // Within hysteresis zone, don't demote yet
                this.emit('tier:warning', agentId, `Score ${newScore} approaching demotion threshold`);
                return null;
            }

            // Handle grace period
            if (this.config.demotionGracePeriodMs > 0) {
                return this.scheduleDemotion(agentId, orgId, oldTier, newTier, oldScore, newScore);
            }

            if (!this.config.allowDemotion) {
                return null;
            }
        }

        // Cancel any pending demotion if score improved
        if (direction === 'promotion') {
            this.cancelPendingDemotion(agentId);
        }

        // Apply tier change
        return this.applyTierChange(state, oldTier, newTier, oldScore, newScore, direction);
    }

    /**
     * Apply a tier change immediately
     */
    private applyTierChange(
        state: AgentTierState,
        oldTier: TierLevel,
        newTier: TierLevel,
        oldScore: number,
        newScore: number,
        direction: 'promotion' | 'demotion' | 'lateral'
    ): TierChange {
        const newTierDef = this.getTierDefinition(newTier, state.orgId)!;

        // Update state
        state.previousTier = oldTier;
        state.currentTier = newTier;
        state.tierChangedAt = new Date();
        state.capabilities = [...newTierDef.capabilities];
        state.maxConcurrentTasks = newTierDef.maxConcurrentTasks;

        // Create change record
        const change: TierChange = {
            agentId: state.agentId,
            orgId: state.orgId,
            previousTier: oldTier,
            newTier,
            previousScore: oldScore,
            newScore,
            direction,
            timestamp: new Date(),
        };

        // Emit events
        this.emit('tier:changed', change);

        if (direction === 'promotion') {
            this.emit('tier:promotion', change);
        } else if (direction === 'demotion') {
            this.emit('tier:demotion', change);
        }

        return change;
    }

    /**
     * Schedule a demotion after grace period
     */
    private scheduleDemotion(
        agentId: string,
        orgId: string,
        oldTier: TierLevel,
        newTier: TierLevel,
        oldScore: number,
        newScore: number
    ): null {
        // Cancel existing pending demotion
        this.cancelPendingDemotion(agentId);

        // Schedule new demotion
        const timer = setTimeout(() => {
            this.pendingDemotions.delete(agentId);

            const state = this.agentStates.get(agentId);
            if (state) {
                // Check if score is still below threshold
                const currentTierDef = this.getTierForScore(state.currentScore, orgId);
                if (this.getTierIndex(currentTierDef.level, orgId) < this.getTierIndex(oldTier, orgId)) {
                    this.applyTierChange(state, oldTier, currentTierDef.level, oldScore, state.currentScore, 'demotion');
                }
            }
        }, this.config.demotionGracePeriodMs);

        this.pendingDemotions.set(agentId, {
            newTier,
            scheduledAt: new Date(),
            timer,
        });

        this.emit('tier:warning', agentId, `Demotion to ${newTier} scheduled in ${this.config.demotionGracePeriodMs}ms`);

        return null;
    }

    /**
     * Cancel a pending demotion
     */
    private cancelPendingDemotion(agentId: string): boolean {
        const pending = this.pendingDemotions.get(agentId);
        if (pending) {
            clearTimeout(pending.timer);
            this.pendingDemotions.delete(agentId);
            return true;
        }
        return false;
    }

    // =========================================================================
    // State Management
    // =========================================================================

    /**
     * Initialize an agent at a specific tier
     */
    initializeAgent(agentId: string, orgId: string, initialScore: number = 300): AgentTierState {
        const tierDef = this.getTierForScore(initialScore, orgId);

        const state: AgentTierState = {
            agentId,
            orgId,
            currentScore: initialScore,
            currentTier: tierDef.level,
            previousTier: null,
            tierChangedAt: null,
            capabilities: [...tierDef.capabilities],
            maxConcurrentTasks: tierDef.maxConcurrentTasks,
        };

        this.agentStates.set(agentId, state);
        return state;
    }

    /**
     * Get agent tier state
     */
    getAgentState(agentId: string): AgentTierState | null {
        return this.agentStates.get(agentId) ?? null;
    }

    /**
     * Get agent's current tier
     */
    getAgentTier(agentId: string): TierLevel | null {
        const state = this.agentStates.get(agentId);
        return state?.currentTier ?? null;
    }

    /**
     * Check if agent has a specific capability
     */
    hasCapability(agentId: string, capability: TierCapability): boolean {
        const state = this.agentStates.get(agentId);
        if (!state) return false;
        return state.capabilities.includes(capability);
    }

    /**
     * Get agent's max concurrent tasks
     */
    getMaxConcurrentTasks(agentId: string): number {
        const state = this.agentStates.get(agentId);
        if (!state) return 0;
        return state.maxConcurrentTasks;
    }

    /**
     * Remove an agent
     */
    removeAgent(agentId: string): boolean {
        this.cancelPendingDemotion(agentId);
        return this.agentStates.delete(agentId);
    }

    private getOrCreateAgentState(agentId: string, orgId: string): AgentTierState {
        let state = this.agentStates.get(agentId);
        if (!state) {
            state = this.initializeAgent(agentId, orgId);
        }
        return state;
    }

    // =========================================================================
    // Tier Definitions
    // =========================================================================

    /**
     * Get tier definition by level
     */
    getTierDefinition(level: TierLevel, orgId?: string): TierDefinition | null {
        const tiers = this.getOrgTiers(orgId);
        return tiers.find(t => t.level === level) ?? null;
    }

    /**
     * Get all tier definitions
     */
    getAllTiers(orgId?: string): TierDefinition[] {
        return this.getOrgTiers(orgId);
    }

    /**
     * Get tier index for ordering
     */
    private getTierIndex(level: TierLevel, orgId?: string): number {
        const tiers = this.getOrgTiers(orgId);
        return tiers.findIndex(t => t.level === level);
    }

    /**
     * Set organization-specific tier configuration
     */
    setOrgTiers(orgId: string, tiers: TierDefinition[]): void {
        // Validate tiers
        this.validateTiersArray(tiers);
        this.orgTierConfigs.set(orgId, tiers);

        // Recalculate tiers for all agents in this org
        for (const [agentId, state] of this.agentStates) {
            if (state.orgId === orgId) {
                this.updateAgentTier(agentId, orgId, state.currentScore);
            }
        }
    }

    /**
     * Get organization tiers (or default)
     */
    private getOrgTiers(orgId?: string): TierDefinition[] {
        if (orgId) {
            const orgTiers = this.orgTierConfigs.get(orgId);
            if (orgTiers) return orgTiers;
        }
        return this.tiers;
    }

    private validateTiers(): void {
        this.validateTiersArray(this.tiers);
    }

    private validateTiersArray(tiers: TierDefinition[]): void {
        // Ensure tiers are sorted by minScore
        for (let i = 1; i < tiers.length; i++) {
            if (tiers[i].minScore <= tiers[i - 1].maxScore) {
                throw new Error(`Tier ${tiers[i].level} overlaps with ${tiers[i - 1].level}`);
            }
        }
    }

    // =========================================================================
    // Bulk Operations
    // =========================================================================

    /**
     * Get all agents in a specific tier
     */
    getAgentsInTier(tier: TierLevel, orgId?: string): AgentTierState[] {
        const agents: AgentTierState[] = [];

        for (const state of this.agentStates.values()) {
            if (state.currentTier === tier) {
                if (!orgId || state.orgId === orgId) {
                    agents.push(state);
                }
            }
        }

        return agents;
    }

    /**
     * Get tier distribution for an org
     */
    getTierDistribution(orgId?: string): Record<TierLevel, number> {
        const distribution: Record<TierLevel, number> = {
            UNTRUSTED: 0,
            PROBATIONARY: 0,
            TRUSTED: 0,
            VERIFIED: 0,
            CERTIFIED: 0,
            ELITE: 0,
        };

        for (const state of this.agentStates.values()) {
            if (!orgId || state.orgId === orgId) {
                distribution[state.currentTier]++;
            }
        }

        return distribution;
    }

    /**
     * Get agents with a specific capability
     */
    getAgentsWithCapability(capability: TierCapability, orgId?: string): AgentTierState[] {
        const agents: AgentTierState[] = [];

        for (const state of this.agentStates.values()) {
            if (state.capabilities.includes(capability)) {
                if (!orgId || state.orgId === orgId) {
                    agents.push(state);
                }
            }
        }

        return agents;
    }

    // =========================================================================
    // Statistics
    // =========================================================================

    /**
     * Get tier statistics
     */
    getStats(orgId?: string): {
        totalAgents: number;
        distribution: Record<TierLevel, number>;
        averageScore: number;
        pendingDemotions: number;
    } {
        const distribution = this.getTierDistribution(orgId);
        let totalAgents = 0;
        let totalScore = 0;
        let pendingDemotions = 0;

        for (const state of this.agentStates.values()) {
            if (!orgId || state.orgId === orgId) {
                totalAgents++;
                totalScore += state.currentScore;

                if (this.pendingDemotions.has(state.agentId)) {
                    pendingDemotions++;
                }
            }
        }

        return {
            totalAgents,
            distribution,
            averageScore: totalAgents > 0 ? Math.round(totalScore / totalAgents) : 0,
            pendingDemotions,
        };
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /**
     * Clear all state
     */
    clear(): void {
        // Cancel all pending demotions
        for (const pending of this.pendingDemotions.values()) {
            clearTimeout(pending.timer);
        }
        this.pendingDemotions.clear();
        this.agentStates.clear();
        this.orgTierConfigs.clear();
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let managerInstance: TierManager | null = null;

export function getTierManager(config?: Partial<TierManagerConfig>, tiers?: TierDefinition[]): TierManager {
    if (!managerInstance) {
        managerInstance = new TierManager(config, tiers);
    }
    return managerInstance;
}

export function resetTierManager(): void {
    if (managerInstance) {
        managerInstance.clear();
    }
    managerInstance = null;
}
