/**
 * Secure Trust Engine
 *
 * A security-hardened wrapper around TrustEngine that enforces authentication,
 * authorization, and audit logging for all trust operations.
 *
 * CRITICAL: Use this class instead of TrustEngine directly in production.
 */

import { EventEmitter } from 'eventemitter3';
import { TrustEngine } from './TrustEngine.js';
import { SecurityLayer, AuthToken, UnauthorizedError } from './SecurityLayer.js';
import type {
    AgentId,
    AgentTier,
    TrustScore,
    TrustPolicy,
    ValidationReport,
} from '../types.js';

// ============================================================================
// Events
// ============================================================================

interface SecureTrustEngineEvents {
    'secure:operation': (operation: string, actor: string, success: boolean) => void;
    'secure:hitl-change': (oldLevel: number, newLevel: number, changedBy: string) => void;
}

// ============================================================================
// Secure Trust Engine Class
// ============================================================================

export class SecureTrustEngine extends EventEmitter<SecureTrustEngineEvents> {
    private engine: TrustEngine;
    private security: SecurityLayer;

    constructor(engine?: TrustEngine, security?: SecurityLayer) {
        super();
        this.engine = engine ?? new TrustEngine();
        this.security = security ?? new SecurityLayer();
    }

    // -------------------------------------------------------------------------
    // HITL Management (HUMAN ONLY)
    // -------------------------------------------------------------------------

    /**
     * Set HITL level - REQUIRES HUMAN AUTHENTICATION
     *
     * This is the most sensitive operation in the system. Only human operators
     * with valid tokens can modify the governance level.
     */
    setHITLLevel(level: number, tokenId: string): void {
        const token = this.security.requireAuth(tokenId, 'HITL_MODIFY', 'SET_HITL_LEVEL');

        if (token.type !== 'HUMAN') {
            this.security.logAudit({
                action: 'HITL_LEVEL_CHANGE',
                actor: { type: token.type, id: token.agentId ?? 'UNKNOWN', tier: token.tier },
                details: { attemptedLevel: level, currentLevel: this.engine.getHITLLevel() },
                outcome: 'DENIED',
                reason: 'Only HUMAN operators can modify HITL level',
            });

            throw new UnauthorizedError(
                'HITL level can only be modified by human operators',
                'SET_HITL_LEVEL',
                token.agentId ?? 'AGENT'
            );
        }

        const oldLevel = this.engine.getHITLLevel();
        this.engine.setHITLLevel(level);
        const newLevel = this.engine.getHITLLevel();

        this.security.logAudit({
            action: 'HITL_LEVEL_CHANGE',
            actor: { type: 'HUMAN', id: 'OPERATOR' },
            details: { oldLevel, newLevel, requestedLevel: level },
            outcome: 'SUCCESS',
        });

        this.emit('secure:hitl-change', oldLevel, newLevel, 'HUMAN_OPERATOR');
    }

    /**
     * Fade HITL level - REQUIRES HUMAN AUTHENTICATION
     */
    fadeHITL(decrement: number, tokenId: string): void {
        const token = this.security.requireAuth(tokenId, 'HITL_MODIFY', 'FADE_HITL');

        if (token.type !== 'HUMAN') {
            throw new UnauthorizedError(
                'HITL fading can only be triggered by human operators',
                'FADE_HITL',
                token.agentId ?? 'AGENT'
            );
        }

        const oldLevel = this.engine.getHITLLevel();
        this.engine.fadeHITL(decrement);
        const newLevel = this.engine.getHITLLevel();

        this.security.logAudit({
            action: 'HITL_LEVEL_CHANGE',
            actor: { type: 'HUMAN', id: 'OPERATOR' },
            details: { oldLevel, newLevel, decrement, method: 'FADE' },
            outcome: 'SUCCESS',
        });

        this.emit('secure:hitl-change', oldLevel, newLevel, 'HUMAN_OPERATOR');
    }

    /**
     * Get HITL level (read-only, no auth required)
     */
    getHITLLevel(): number {
        return this.engine.getHITLLevel();
    }

    /**
     * Check if HITL is required for an action
     */
    requiresHITL(actionType: 'SPAWN' | 'DECISION' | 'STRATEGY'): boolean {
        return this.engine.requiresHITL(actionType);
    }

    // -------------------------------------------------------------------------
    // Trust Score Operations
    // -------------------------------------------------------------------------

    /**
     * Create trust for a new agent
     */
    createTrust(
        agentId: AgentId,
        params: { tier: AgentTier; parentId: AgentId | null; initialTrust?: number },
        tokenId: string
    ): TrustScore {
        this.security.requireAuth(tokenId, 'SPAWN_AGENT', 'CREATE_TRUST');

        const score = this.engine.createTrust(agentId, params);

        this.security.logAudit({
            action: 'TRUST_CREATED',
            actor: this.getActorFromToken(tokenId),
            target: { type: 'AGENT', id: agentId },
            details: { tier: params.tier, parentId: params.parentId, initialTrust: score.numeric },
            outcome: 'SUCCESS',
        });

        this.emit('secure:operation', 'CREATE_TRUST', agentId, true);

        return score;
    }

    /**
     * Reward an agent (requires T3+ or HUMAN)
     */
    reward(agentId: AgentId, amount: number, reason: string, tokenId: string): TrustScore | null {
        const token = this.security.requireAuth(tokenId, 'TRUST_REWARD', 'REWARD_AGENT');

        const oldScore = this.engine.getTrust(agentId);
        const newScore = this.engine.reward(agentId, amount, reason);

        this.security.logAudit({
            action: 'TRUST_REWARD',
            actor: this.getActorFromToken(tokenId),
            target: { type: 'AGENT', id: agentId },
            details: {
                amount,
                reason,
                oldNumeric: oldScore?.numeric,
                newNumeric: newScore?.numeric,
            },
            outcome: newScore ? 'SUCCESS' : 'ERROR',
            reason: newScore ? undefined : 'Agent not found',
        });

        this.emit('secure:operation', 'TRUST_REWARD', token.agentId ?? 'HUMAN', !!newScore);

        return newScore;
    }

    /**
     * Penalize an agent (requires T4+ or HUMAN)
     */
    penalize(agentId: AgentId, amount: number, reason: string, tokenId: string): TrustScore | null {
        const token = this.security.requireAuth(tokenId, 'TRUST_PENALIZE', 'PENALIZE_AGENT');

        const oldScore = this.engine.getTrust(agentId);
        const newScore = this.engine.penalize(agentId, amount, reason);

        this.security.logAudit({
            action: 'TRUST_PENALIZE',
            actor: this.getActorFromToken(tokenId),
            target: { type: 'AGENT', id: agentId },
            details: {
                amount,
                reason,
                oldNumeric: oldScore?.numeric,
                newNumeric: newScore?.numeric,
                levelChanged: oldScore?.level !== newScore?.level,
            },
            outcome: newScore ? 'SUCCESS' : 'ERROR',
            reason: newScore ? undefined : 'Agent not found',
        });

        this.emit('secure:operation', 'TRUST_PENALIZE', token.agentId ?? 'HUMAN', !!newScore);

        return newScore;
    }

    /**
     * Get trust score (read-only, no auth required)
     */
    getTrust(agentId: AgentId): TrustScore | undefined {
        return this.engine.getTrust(agentId);
    }

    /**
     * Get trust policy (read-only, no auth required)
     */
    getPolicy(agentId: AgentId): TrustPolicy | undefined {
        return this.engine.getPolicy(agentId);
    }

    // -------------------------------------------------------------------------
    // Spawn Validation
    // -------------------------------------------------------------------------

    /**
     * Validate a spawn request
     */
    validateSpawn(
        requestorId: AgentId,
        params: { requestedTier: AgentTier; trustBudget: number; purpose: string },
        tokenId: string
    ): ValidationReport {
        this.security.requireAuth(tokenId, 'SPAWN_AGENT', 'VALIDATE_SPAWN');

        const report = this.engine.validateSpawn(requestorId, params);

        // Check if HITL approval is required
        if (this.requiresHITL('SPAWN') && params.requestedTier >= 3) {
            report.warnings.push('This spawn requires HITL approval before execution');
        }

        this.security.logAudit({
            action: 'SPAWN_REQUEST',
            actor: this.getActorFromToken(tokenId),
            target: { type: 'AGENT', id: requestorId },
            details: {
                requestedTier: params.requestedTier,
                trustBudget: params.trustBudget,
                purpose: params.purpose,
                validationResult: report.isValid,
                errors: report.errors,
                warnings: report.warnings,
            },
            outcome: report.isValid ? 'SUCCESS' : 'DENIED',
            reason: report.errors.length > 0 ? report.errors.join('; ') : undefined,
        });

        return report;
    }

    /**
     * Verify trust chain
     */
    verifyChain(agentId: AgentId): { valid: boolean; chain: AgentId[] } {
        return this.engine.verifyChain(agentId);
    }

    // -------------------------------------------------------------------------
    // Statistics & Export
    // -------------------------------------------------------------------------

    /**
     * Get trust statistics
     */
    getStats(): ReturnType<TrustEngine['getStats']> {
        return this.engine.getStats();
    }

    /**
     * Get lineage for an agent
     */
    getLineage(agentId: AgentId): AgentId[] {
        return this.engine.getLineage(agentId);
    }

    /**
     * Export trust data (requires HUMAN auth for compliance)
     */
    export(tokenId: string): ReturnType<TrustEngine['export']> {
        this.security.requireAuth(tokenId, 'VIEW_AUDIT_LOG', 'EXPORT_TRUST_DATA');
        return this.engine.export();
    }

    /**
     * Import trust data (requires HUMAN auth)
     */
    import(data: Parameters<TrustEngine['import']>[0], tokenId: string): void {
        this.security.requireAuth(tokenId, 'SYSTEM_CONFIG', 'IMPORT_TRUST_DATA');

        this.security.logAudit({
            action: 'CONFIG_CHANGE',
            actor: this.getActorFromToken(tokenId),
            details: { action: 'IMPORT_TRUST_DATA', recordCount: data.scores.length },
            outcome: 'SUCCESS',
        });

        this.engine.import(data);
    }

    // -------------------------------------------------------------------------
    // Security Layer Access
    // -------------------------------------------------------------------------

    /**
     * Get the security layer instance
     */
    getSecurityLayer(): SecurityLayer {
        return this.security;
    }

    /**
     * Issue a human token (requires master key)
     */
    issueHumanToken(masterKey: string): AuthToken {
        return this.security.issueHumanToken(masterKey);
    }

    /**
     * Issue an agent token
     */
    issueAgentToken(agentId: AgentId, tier: AgentTier): AuthToken {
        return this.security.issueAgentToken(agentId, tier);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private getActorFromToken(tokenId: string): { type: 'HUMAN' | 'AGENT' | 'SYSTEM'; id: string; tier?: AgentTier } {
        const token = this.security.verifyToken(tokenId);
        if (!token) {
            return { type: 'SYSTEM', id: 'UNKNOWN' };
        }
        return {
            type: token.type,
            id: token.agentId ?? 'OPERATOR',
            tier: token.tier,
        };
    }
}

// Factory function to create secure engine with new security layer
export function createSecureTrustEngine(): { engine: SecureTrustEngine; masterKey: string } {
    const security = new SecurityLayer();
    const engine = new SecureTrustEngine(new TrustEngine(), security);
    return { engine, masterKey: security.getMasterKey() };
}
