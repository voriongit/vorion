/**
 * Trust Engine
 *
 * Central trust verification and scoring system. Manages trust inheritance,
 * trust budget allocation, and trust score calculations. Trust is the
 * fundamental currency of the Aurais system.
 *
 * TRUST-1.8: Enhanced with FICO-style scoring via TrustScoreCalculator.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type {
    AgentId,
    AgentTier,
    TrustLevel,
    TrustScore,
    TrustPolicy,
    ValidationReport,
} from '../types.js';
import type { EnhancedTrustScore, TrustComponents } from './types/trust.js';
import { TIER_THRESHOLDS } from './types/trust.js';
import { TrustScoreCalculator } from './TrustScoreCalculator.js';
import { FEATURES } from './config/features.js';

// ============================================================================
// Constants
// ============================================================================

// Use centralized tier thresholds from types/trust.ts for FICO-style scoring (300-1000 range)
// TIER_THRESHOLDS is imported above and used in numericToLevel()

const TRUST_INHERITANCE_RATE = 0.8; // Children inherit 80% of parent's trust
const TRUST_PENALTY_PROPAGATION = 0.5; // 50% of child's penalty affects parent

// ============================================================================
// Events
// ============================================================================

interface TrustEngineEvents {
    'trust:created': (agentId: AgentId, score: TrustScore) => void;
    'trust:updated': (agentId: AgentId, oldScore: TrustScore, newScore: TrustScore) => void;
    'trust:violation': (agentId: AgentId, reason: string, penalty: number) => void;
    'trust:reward': (agentId: AgentId, reason: string, amount: number) => void;
    'trust:level-changed': (agentId: AgentId, oldLevel: TrustLevel, newLevel: TrustLevel) => void;
    'trust:score-recalculated': (agentId: AgentId, score: EnhancedTrustScore, components: TrustComponents) => void;
}

// ============================================================================
// Trust Engine Class
// ============================================================================

export class TrustEngine extends EventEmitter<TrustEngineEvents> {
    private trustScores: Map<AgentId, TrustScore> = new Map();
    private enhancedScores: Map<AgentId, EnhancedTrustScore> = new Map();
    private trustPolicies: Map<AgentId, TrustPolicy> = new Map();
    private lineageTree: Map<AgentId, AgentId[]> = new Map(); // parent -> children

    // Current HITL level (0-100, starts at 100)
    private hitlLevel: number = 100;

    // TRUST-1.8: Enhanced scoring calculator
    private calculator: TrustScoreCalculator;

    constructor(calculator?: TrustScoreCalculator) {
        super();
        this.calculator = calculator ?? new TrustScoreCalculator();
    }

    // -------------------------------------------------------------------------
    // Trust Score Management
    // -------------------------------------------------------------------------

    /**
     * Create a trust score for a new agent
     */
    createTrust(agentId: AgentId, params: {
        tier: AgentTier;
        parentId: AgentId | null;
        initialTrust?: number;
    }): TrustScore {
        let numeric: number;
        let inherited: number;

        if (params.parentId) {
            // Child agent - inherits from parent
            const parentScore = this.trustScores.get(params.parentId);
            if (!parentScore) {
                throw new Error(`Parent agent ${params.parentId} not found`);
            }
            inherited = Math.floor(parentScore.numeric * TRUST_INHERITANCE_RATE);
            numeric = inherited;

            // Track lineage
            const siblings = this.lineageTree.get(params.parentId) ?? [];
            siblings.push(agentId);
            this.lineageTree.set(params.parentId, siblings);
        } else {
            // T5 agent - sovereign trust (inherited IS their base trust)
            inherited = params.initialTrust ?? 1000;
            numeric = inherited;
        }

        const level = this.numericToLevel(numeric);

        const score: TrustScore = {
            level,
            numeric,
            inherited,
            earned: 0,
            penalties: 0,
            lastVerified: new Date(),
            parentId: params.parentId,
        };

        this.trustScores.set(agentId, score);

        // Create default policy
        this.trustPolicies.set(agentId, this.createDefaultPolicy(params.tier));

        this.emit('trust:created', agentId, score);

        return score;
    }

    /**
     * Get trust score for an agent
     */
    getTrust(agentId: AgentId): TrustScore | undefined {
        return this.trustScores.get(agentId);
    }

    /**
     * Get trust policy for an agent
     */
    getPolicy(agentId: AgentId): TrustPolicy | undefined {
        return this.trustPolicies.get(agentId);
    }

    /**
     * Reward an agent for good behavior
     */
    reward(agentId: AgentId, amount: number, reason: string): TrustScore | null {
        const score = this.trustScores.get(agentId);
        if (!score) return null;

        const oldScore = { ...score };

        score.earned += amount;
        score.numeric = Math.min(1000, score.inherited + score.earned - score.penalties);
        score.lastVerified = new Date();

        const newLevel = this.numericToLevel(score.numeric);
        if (newLevel !== score.level) {
            const oldLevel = score.level;
            score.level = newLevel;
            this.emit('trust:level-changed', agentId, oldLevel, newLevel);
        }

        this.emit('trust:reward', agentId, reason, amount);
        this.emit('trust:updated', agentId, oldScore, score);

        return score;
    }

    /**
     * Penalize an agent for violations
     */
    penalize(agentId: AgentId, amount: number, reason: string): TrustScore | null {
        const score = this.trustScores.get(agentId);
        if (!score) return null;

        const oldScore = { ...score };

        score.penalties += amount;
        score.numeric = Math.max(0, score.inherited + score.earned - score.penalties);
        score.lastVerified = new Date();

        const newLevel = this.numericToLevel(score.numeric);
        if (newLevel !== score.level) {
            const oldLevel = score.level;
            score.level = newLevel;
            this.emit('trust:level-changed', agentId, oldLevel, newLevel);
        }

        this.emit('trust:violation', agentId, reason, amount);
        this.emit('trust:updated', agentId, oldScore, score);

        // Propagate penalty to parent
        if (score.parentId) {
            const propagatedPenalty = Math.floor(amount * TRUST_PENALTY_PROPAGATION);
            if (propagatedPenalty > 0) {
                this.penalize(score.parentId, propagatedPenalty, `Child ${agentId} violation: ${reason}`);
            }
        }

        return score;
    }

    // -------------------------------------------------------------------------
    // Validation
    // -------------------------------------------------------------------------

    /**
     * Validate a spawn request
     */
    validateSpawn(requestorId: AgentId, params: {
        requestedTier: AgentTier;
        trustBudget: number;
        purpose: string;
    }): ValidationReport {
        const score = this.trustScores.get(requestorId);
        const policy = this.trustPolicies.get(requestorId);

        const warnings: string[] = [];
        const errors: string[] = [];
        const recommendations: string[] = [];

        if (!score || !policy) {
            return {
                isValid: false,
                trustScore: 0,
                warnings,
                errors: ['Agent not found in trust registry'],
                recommendations,
                validatedBy: 'TRUST_ENGINE' as AgentId,
                validatedAt: new Date(),
            };
        }

        // Check tier permission
        if (params.requestedTier > policy.maxChildTier) {
            errors.push(`Cannot spawn tier ${params.requestedTier}. Max allowed: ${policy.maxChildTier}`);
        }

        // Check trust budget
        const availableBudget = score.numeric * 0.5; // Can allocate up to 50% of own trust
        if (params.trustBudget > availableBudget) {
            errors.push(`Trust budget ${params.trustBudget} exceeds available ${availableBudget}`);
        }

        // Check minimum score
        if (score.numeric < policy.minScoreToSpawn) {
            errors.push(`Trust score ${score.numeric} below spawn minimum ${policy.minScoreToSpawn}`);
        }

        // Check HITL requirements
        if (this.hitlLevel >= 50 && params.requestedTier >= 3) {
            warnings.push('High-tier spawn requires HITL approval at current governance level');
        }

        // Add recommendations
        if (score.numeric < 500) {
            recommendations.push('Consider earning more trust before spawning agents');
        }

        return {
            isValid: errors.length === 0,
            trustScore: score.numeric,
            warnings,
            errors,
            recommendations,
            validatedBy: 'T5_VALIDATOR' as AgentId,
            validatedAt: new Date(),
        };
    }

    /**
     * Verify agent identity and trust chain
     */
    verifyChain(agentId: AgentId): { valid: boolean; chain: AgentId[] } {
        const chain: AgentId[] = [];
        let currentId: AgentId | null = agentId;

        while (currentId) {
            chain.push(currentId);
            const score = this.trustScores.get(currentId);
            if (!score) {
                return { valid: false, chain };
            }
            currentId = score.parentId;
        }

        return { valid: true, chain: chain.reverse() };
    }

    // -------------------------------------------------------------------------
    // HITL Level Management
    // -------------------------------------------------------------------------

    /**
     * Get current HITL level (0-100)
     */
    getHITLLevel(): number {
        return this.hitlLevel;
    }

    /**
     * Adjust HITL level (fading governance)
     */
    setHITLLevel(level: number): void {
        this.hitlLevel = Math.max(0, Math.min(100, level));
    }

    /**
     * Gradually decrease HITL level based on trust performance
     */
    fadeHITL(decrement: number = 1): void {
        this.hitlLevel = Math.max(0, this.hitlLevel - decrement);
    }

    /**
     * Check if HITL approval is required for an action
     */
    requiresHITL(actionType: 'SPAWN' | 'DECISION' | 'STRATEGY'): boolean {
        const thresholds = {
            SPAWN: 50,      // Require HITL above 50%
            DECISION: 70,   // Require HITL above 70%
            STRATEGY: 30,   // Require HITL above 30%
        };
        return this.hitlLevel >= thresholds[actionType];
    }

    // -------------------------------------------------------------------------
    // TRUST-1.8: Enhanced FICO-Style Scoring
    // -------------------------------------------------------------------------

    /**
     * Check if FICO-style scoring is enabled.
     */
    isFicoScoringEnabled(): boolean {
        return FEATURES.isEnabled('USE_FICO_SCORING');
    }

    /**
     * Get the enhanced trust score for an agent (if FICO scoring enabled).
     * Returns undefined if FICO scoring is disabled or no enhanced score exists.
     */
    getEnhancedTrust(agentId: AgentId): EnhancedTrustScore | undefined {
        if (!this.isFicoScoringEnabled()) {
            return undefined;
        }
        return this.enhancedScores.get(agentId);
    }

    /**
     * Recalculate trust score using the FICO-style calculator.
     * This should be called periodically or after significant events.
     *
     * @param agentId The agent to recalculate
     * @param data Historical data for component calculations
     * @returns Enhanced trust score if FICO enabled, otherwise legacy score
     */
    recalculateScore(
        agentId: AgentId,
        data: {
            decisionAccuracy: Array<{ approved: number; rejected: number; riskLevel: 'low' | 'medium' | 'high' | 'critical' }>;
            ethicsCompliance: { violations: number; escalations: number };
            taskSuccess: { completed: number; failed: number };
            operationalStability: { errors: number; avgResponseTimeMs: number };
            peerReviews: { endorsements: number; resolvedSolutions: number; totalContributions: number };
        }
    ): TrustScore | EnhancedTrustScore | null {
        const existingScore = this.trustScores.get(agentId);
        if (!existingScore) {
            return null;
        }

        if (!this.isFicoScoringEnabled()) {
            // Legacy mode - return existing score
            return existingScore;
        }

        // Calculate enhanced score
        const enhancedScore = this.calculator.calculateFullScore(
            agentId,
            data,
            existingScore.inherited,
            existingScore.penalties
        );

        // Update parentId from existing score
        enhancedScore.parentId = existingScore.parentId;

        // Store enhanced score
        this.enhancedScores.set(agentId, enhancedScore);

        // Also update the base score to keep them in sync
        const oldScore = { ...existingScore };
        existingScore.numeric = enhancedScore.ficoScore;
        existingScore.level = enhancedScore.level;
        existingScore.lastVerified = enhancedScore.lastCalculated;

        // Emit events
        this.emit('trust:score-recalculated', agentId, enhancedScore, enhancedScore.components);
        this.emit('trust:updated', agentId, oldScore, existingScore);

        // Check for level change
        if (oldScore.level !== existingScore.level) {
            this.emit('trust:level-changed', agentId, oldScore.level, existingScore.level);
        }

        return enhancedScore;
    }

    /**
     * Get the trust score calculator instance.
     * Useful for testing or advanced integrations.
     */
    getCalculator(): TrustScoreCalculator {
        return this.calculator;
    }

    /**
     * Set a custom calculator (for testing or custom implementations).
     */
    setCalculator(calculator: TrustScoreCalculator): void {
        this.calculator = calculator;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private numericToLevel(numeric: number): TrustLevel {
        for (const [level, threshold] of Object.entries(TIER_THRESHOLDS)) {
            if (numeric >= threshold.min && numeric <= threshold.max) {
                return level as TrustLevel;
            }
        }
        return 'PASSIVE';
    }

    private createDefaultPolicy(tier: AgentTier): TrustPolicy {
        return {
            minScoreToSpawn: tier * 100,
            maxChildTier: Math.max(0, tier - 1) as AgentTier,
            requiresValidation: true,
            canSelfModify: tier === 5,
            autonomyLevel: 100 - this.hitlLevel, // Inverse of HITL
        };
    }

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    /**
     * Get trust statistics across all agents
     */
    getStats(): {
        totalAgents: number;
        byLevel: Record<TrustLevel, number>;
        avgTrust: number;
        hitlLevel: number;
    } {
        const scores = Array.from(this.trustScores.values());

        const byLevel = scores.reduce((acc, s) => {
            acc[s.level] = (acc[s.level] ?? 0) + 1;
            return acc;
        }, {} as Record<TrustLevel, number>);

        const avgTrust = scores.length > 0
            ? scores.reduce((sum, s) => sum + s.numeric, 0) / scores.length
            : 0;

        return {
            totalAgents: scores.length,
            byLevel,
            avgTrust: Math.round(avgTrust),
            hitlLevel: this.hitlLevel,
        };
    }

    /**
     * Get lineage tree for an agent
     */
    getLineage(agentId: AgentId): AgentId[] {
        return this.lineageTree.get(agentId) ?? [];
    }

    /**
     * Export all trust data (for persistence)
     */
    export(): { scores: Array<[AgentId, TrustScore]>; policies: Array<[AgentId, TrustPolicy]> } {
        return {
            scores: Array.from(this.trustScores.entries()),
            policies: Array.from(this.trustPolicies.entries()),
        };
    }

    /**
     * Import trust data (from persistence)
     */
    import(data: { scores: Array<[AgentId, TrustScore]>; policies: Array<[AgentId, TrustPolicy]> }): void {
        for (const [id, score] of data.scores) {
            this.trustScores.set(id, score);
        }
        for (const [id, policy] of data.policies) {
            this.trustPolicies.set(id, policy);
        }
    }
}

// Singleton instance
export const trustEngine = new TrustEngine();
