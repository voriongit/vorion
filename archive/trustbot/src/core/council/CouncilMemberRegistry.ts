/**
 * Council Member Registry
 *
 * TRUST-3.2: Manages council membership for qualified agents.
 * Only T4+ agents can be council members.
 */

import { EventEmitter } from 'eventemitter3';
import type { AgentId, AgentTier } from '../../types.js';
import type {
    CouncilMember,
    CouncilConfig,
    CouncilEvents,
} from './types.js';
import { DEFAULT_COUNCIL_CONFIG } from './types.js';

// ============================================================================
// Errors
// ============================================================================

export class CouncilMembershipError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'CouncilMembershipError';
    }
}

// ============================================================================
// Types for Trust Engine interaction
// ============================================================================

interface TrustEngineAdapter {
    getTrust(agentId: AgentId): { numeric: number; level: string } | undefined;
    getTier(agentId: AgentId): AgentTier | undefined;
    on(event: 'trust:level-changed', handler: (agentId: AgentId, oldLevel: string, newLevel: string) => void): void;
}

// ============================================================================
// Council Member Registry
// ============================================================================

export class CouncilMemberRegistry extends EventEmitter<Pick<CouncilEvents, 'council:member-joined' | 'council:member-left'>> {
    private members: Map<AgentId, CouncilMember> = new Map();
    private config: CouncilConfig;
    private trustAdapter?: TrustEngineAdapter;

    constructor(config: Partial<CouncilConfig> = {}) {
        super();
        this.config = { ...DEFAULT_COUNCIL_CONFIG, ...config };
    }

    /**
     * Set the trust engine adapter for tier validation.
     */
    setTrustAdapter(adapter: TrustEngineAdapter): void {
        this.trustAdapter = adapter;

        // Listen for tier changes to auto-unregister demoted members
        adapter.on('trust:level-changed', (agentId, _oldLevel, newLevel) => {
            const member = this.members.get(agentId);
            if (member) {
                const newTier = this.levelToTier(newLevel);
                if (newTier < this.config.minMemberTier) {
                    this.unregisterMember(agentId, 'Tier dropped below minimum');
                }
            }
        });
    }

    /**
     * Register an agent as a council member.
     * Only T4+ agents can join the council.
     */
    registerMember(agentId: AgentId, tier: AgentTier, specialization?: string): CouncilMember {
        // Check if already registered
        if (this.members.has(agentId)) {
            throw new CouncilMembershipError(
                `Agent ${agentId} is already a council member`,
                'ALREADY_MEMBER'
            );
        }

        // Validate tier
        if (tier < this.config.minMemberTier) {
            throw new CouncilMembershipError(
                `Council requires T${this.config.minMemberTier}+ agents. Agent is T${tier}`,
                'INSUFFICIENT_TIER'
            );
        }

        // If we have a trust adapter, verify the tier
        if (this.trustAdapter) {
            const actualTier = this.trustAdapter.getTier(agentId);
            if (actualTier !== undefined && actualTier < this.config.minMemberTier) {
                throw new CouncilMembershipError(
                    `Agent tier verification failed. Actual tier: T${actualTier}`,
                    'TIER_VERIFICATION_FAILED'
                );
            }
        }

        // Calculate voting weight (T5 gets higher weight)
        const votingWeight = tier === 5 ? 1.5 : 1;

        const member: CouncilMember = {
            agentId,
            tier,
            specialization,
            votingWeight,
            activeReviews: 0,
            joinedAt: new Date(),
            totalVotes: 0,
            agreementRate: 1.0, // Start with perfect agreement
        };

        this.members.set(agentId, member);
        this.emit('council:member-joined', member);

        return member;
    }

    /**
     * Unregister an agent from the council.
     */
    unregisterMember(agentId: AgentId, reason: string = 'Voluntary departure'): boolean {
        const member = this.members.get(agentId);
        if (!member) {
            return false;
        }

        // Cannot unregister if they have active reviews
        if (member.activeReviews > 0) {
            throw new CouncilMembershipError(
                `Cannot unregister member with ${member.activeReviews} active reviews`,
                'ACTIVE_REVIEWS'
            );
        }

        this.members.delete(agentId);
        this.emit('council:member-left', member, reason);

        return true;
    }

    /**
     * Get a specific member.
     */
    getMember(agentId: AgentId): CouncilMember | undefined {
        return this.members.get(agentId);
    }

    /**
     * Get all active council members.
     */
    getMembers(): CouncilMember[] {
        return Array.from(this.members.values());
    }

    /**
     * Get members available for review (activeReviews < max).
     */
    getAvailableMembers(): CouncilMember[] {
        return this.getMembers().filter(
            m => m.activeReviews < this.config.maxActiveReviews
        );
    }

    /**
     * Get members by specialization.
     */
    getMembersBySpecialization(specialization: string): CouncilMember[] {
        return this.getMembers().filter(m => m.specialization === specialization);
    }

    /**
     * Check if an agent is a council member.
     */
    isMember(agentId: AgentId): boolean {
        return this.members.has(agentId);
    }

    /**
     * Increment active reviews for a member.
     */
    incrementActiveReviews(agentId: AgentId): void {
        const member = this.members.get(agentId);
        if (!member) {
            throw new CouncilMembershipError(
                `Agent ${agentId} is not a council member`,
                'NOT_A_MEMBER'
            );
        }

        if (member.activeReviews >= this.config.maxActiveReviews) {
            throw new CouncilMembershipError(
                `Member ${agentId} already has maximum active reviews (${this.config.maxActiveReviews})`,
                'MAX_REVIEWS_REACHED'
            );
        }

        member.activeReviews++;
    }

    /**
     * Decrement active reviews for a member.
     */
    decrementActiveReviews(agentId: AgentId): void {
        const member = this.members.get(agentId);
        if (!member) {
            return; // Silently ignore if not a member
        }

        if (member.activeReviews > 0) {
            member.activeReviews--;
        }
    }

    /**
     * Record a vote for statistics.
     */
    recordVote(agentId: AgentId, agreedWithMajority: boolean): void {
        const member = this.members.get(agentId);
        if (!member) return;

        member.totalVotes++;

        // Update agreement rate (exponential moving average)
        const alpha = 0.1; // Weight for new data
        member.agreementRate = member.agreementRate * (1 - alpha) +
            (agreedWithMajority ? 1 : 0) * alpha;
    }

    /**
     * Update member tier (when agent is promoted/demoted).
     */
    updateMemberTier(agentId: AgentId, newTier: AgentTier): void {
        const member = this.members.get(agentId);
        if (!member) return;

        if (newTier < this.config.minMemberTier) {
            // Demoted below minimum - unregister
            this.unregisterMember(agentId, `Tier dropped to T${newTier}`);
            return;
        }

        member.tier = newTier;
        member.votingWeight = newTier === 5 ? 1.5 : 1;
    }

    /**
     * Get council statistics.
     */
    getStats(): {
        totalMembers: number;
        byTier: Record<number, number>;
        averageActiveReviews: number;
        averageAgreementRate: number;
    } {
        const members = this.getMembers();

        const byTier: Record<number, number> = {};
        let totalActiveReviews = 0;
        let totalAgreementRate = 0;

        for (const member of members) {
            byTier[member.tier] = (byTier[member.tier] ?? 0) + 1;
            totalActiveReviews += member.activeReviews;
            totalAgreementRate += member.agreementRate;
        }

        return {
            totalMembers: members.length,
            byTier,
            averageActiveReviews: members.length > 0
                ? totalActiveReviews / members.length
                : 0,
            averageAgreementRate: members.length > 0
                ? totalAgreementRate / members.length
                : 0,
        };
    }

    /**
     * Get configuration.
     */
    getConfig(): CouncilConfig {
        return { ...this.config };
    }

    /**
     * Update configuration.
     */
    setConfig(config: Partial<CouncilConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Clear all members (for testing).
     */
    clear(): void {
        this.members.clear();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private levelToTier(level: string): AgentTier {
        const tierMap: Record<string, AgentTier> = {
            SOVEREIGN: 5,
            EXECUTIVE: 4,
            TACTICAL: 3,
            OPERATIONAL: 2,
            WORKER: 1,
            PASSIVE: 0,
        };
        return tierMap[level] ?? 0;
    }
}

// Singleton instance
export const councilMemberRegistry = new CouncilMemberRegistry();
