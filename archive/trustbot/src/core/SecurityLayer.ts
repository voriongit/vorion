/**
 * Security Layer
 *
 * Provides authentication, authorization, and audit logging for the Aurais system.
 * This layer wraps sensitive operations to ensure proper access control and
 * maintains a complete audit trail for governance compliance.
 *
 * TRUST-2.6: Enhanced with cryptographic hash-chained audit logging.
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import type { AgentId, AgentTier, TrustLevel } from '../types.js';
import { CryptographicAuditLogger } from './CryptographicAuditLogger.js';
import type { CryptographicAuditEntry, AuditChainStatus } from './types/audit.js';
import { FEATURES } from './config/features.js';

// ============================================================================
// Types
// ============================================================================

export interface AuthToken {
    id: string;
    type: 'HUMAN' | 'AGENT' | 'SYSTEM';
    agentId?: AgentId;
    tier?: AgentTier;
    issuedAt: Date;
    expiresAt: Date;
    permissions: Permission[];
}

export type Permission =
    | 'HITL_MODIFY'           // Only HUMAN tokens
    | 'TRUST_REWARD'          // T3+ or HUMAN
    | 'TRUST_PENALIZE'        // T4+ or HUMAN
    | 'SPAWN_AGENT'           // Based on tier policy
    | 'VIEW_AUDIT_LOG'        // T4+ or HUMAN
    | 'SYSTEM_CONFIG'         // Only HUMAN tokens
    | 'BLACKBOARD_POST'       // All authenticated
    | 'BLACKBOARD_RESOLVE'    // T2+ or author
    | 'AGENT_TERMINATE';      // T5 or HUMAN

export interface AuditEntry {
    id: string;
    timestamp: Date;
    action: AuditAction;
    actor: {
        type: 'HUMAN' | 'AGENT' | 'SYSTEM';
        id: string;
        tier?: AgentTier;
    };
    target?: {
        type: 'AGENT' | 'ENTRY' | 'SYSTEM';
        id: string;
    };
    details: Record<string, unknown>;
    outcome: 'SUCCESS' | 'DENIED' | 'ERROR';
    reason?: string;
}

export type AuditAction =
    | 'HITL_LEVEL_CHANGE'
    | 'TRUST_REWARD'
    | 'TRUST_PENALIZE'
    | 'TRUST_CREATED'
    | 'SPAWN_REQUEST'
    | 'SPAWN_APPROVED'
    | 'SPAWN_DENIED'
    | 'AGENT_TERMINATED'
    | 'BLACKBOARD_POST'
    | 'BLACKBOARD_RESOLVE'
    | 'AUTH_TOKEN_ISSUED'
    | 'AUTH_TOKEN_REVOKED'
    | 'ACCESS_DENIED'
    | 'CONFIG_CHANGE'
    | 'TASK_DELEGATED'
    | 'TASK_COMPLETED'
    | 'TASK_FAILED';

export class UnauthorizedError extends Error {
    constructor(message: string, public readonly action: string, public readonly actor: string) {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

export class AuthenticationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthenticationError';
    }
}

// ============================================================================
// Events
// ============================================================================

interface SecurityEvents {
    'audit:logged': (entry: AuditEntry) => void;
    'access:denied': (action: string, actor: string, reason: string) => void;
    'token:issued': (token: AuthToken) => void;
    'token:revoked': (tokenId: string) => void;
    'security:alert': (message: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => void;
}

// ============================================================================
// Security Layer Class
// ============================================================================

export class SecurityLayer extends EventEmitter<SecurityEvents> {
    private tokens: Map<string, AuthToken> = new Map();
    private auditLog: AuditEntry[] = [];
    private revokedTokens: Set<string> = new Set();

    // Human master key (from env or generated)
    private humanMasterKey: string;

    // TRUST-2.6: Cryptographic audit logger
    private cryptoAuditLogger: CryptographicAuditLogger;

    constructor(masterKey?: string, cryptoLogger?: CryptographicAuditLogger) {
        super();
        // Priority: constructor arg > env var > generated
        this.humanMasterKey = masterKey ?? process.env.MASTER_KEY ?? this.generateMasterKey();
        this.cryptoAuditLogger = cryptoLogger ?? new CryptographicAuditLogger();

        // Warn if using generated key in production
        if (!masterKey && !process.env.MASTER_KEY && process.env.NODE_ENV === 'production') {
            console.warn('⚠️  MASTER_KEY not set - generating random key. Set MASTER_KEY env var for persistence.');
        }
    }

    // -------------------------------------------------------------------------
    // Authentication
    // -------------------------------------------------------------------------

    /**
     * Issue a token for a human operator
     */
    issueHumanToken(masterKey: string, expiryHours: number = 24): AuthToken {
        if (masterKey !== this.humanMasterKey) {
            this.logAudit({
                action: 'AUTH_TOKEN_ISSUED',
                actor: { type: 'HUMAN', id: 'UNKNOWN' },
                details: { attempted: true },
                outcome: 'DENIED',
                reason: 'Invalid master key',
            });
            throw new AuthenticationError('Invalid master key');
        }

        const token: AuthToken = {
            id: uuidv4(),
            type: 'HUMAN',
            issuedAt: new Date(),
            expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
            permissions: [
                'HITL_MODIFY',
                'TRUST_REWARD',
                'TRUST_PENALIZE',
                'SPAWN_AGENT',
                'VIEW_AUDIT_LOG',
                'SYSTEM_CONFIG',
                'BLACKBOARD_POST',
                'BLACKBOARD_RESOLVE',
                'AGENT_TERMINATE',
            ],
        };

        this.tokens.set(token.id, token);
        this.emit('token:issued', token);

        this.logAudit({
            action: 'AUTH_TOKEN_ISSUED',
            actor: { type: 'HUMAN', id: 'OPERATOR' },
            details: { tokenId: token.id, expiryHours },
            outcome: 'SUCCESS',
        });

        return token;
    }

    /**
     * Issue a token for an agent
     */
    issueAgentToken(agentId: AgentId, tier: AgentTier): AuthToken {
        const permissions = this.getPermissionsForTier(tier);

        const token: AuthToken = {
            id: uuidv4(),
            type: 'AGENT',
            agentId,
            tier,
            issuedAt: new Date(),
            expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours for agents
            permissions,
        };

        this.tokens.set(token.id, token);
        this.emit('token:issued', token);

        this.logAudit({
            action: 'AUTH_TOKEN_ISSUED',
            actor: { type: 'SYSTEM', id: 'SECURITY_LAYER' },
            target: { type: 'AGENT', id: agentId },
            details: { tokenId: token.id, tier, permissions },
            outcome: 'SUCCESS',
        });

        return token;
    }

    /**
     * Verify and return token if valid
     */
    verifyToken(tokenId: string): AuthToken | null {
        if (this.revokedTokens.has(tokenId)) {
            return null;
        }

        const token = this.tokens.get(tokenId);
        if (!token) {
            return null;
        }

        if (token.expiresAt < new Date()) {
            this.revokeToken(tokenId);
            return null;
        }

        return token;
    }

    /**
     * Revoke a token
     */
    revokeToken(tokenId: string): void {
        this.revokedTokens.add(tokenId);
        this.tokens.delete(tokenId);
        this.emit('token:revoked', tokenId);

        this.logAudit({
            action: 'AUTH_TOKEN_REVOKED',
            actor: { type: 'SYSTEM', id: 'SECURITY_LAYER' },
            details: { tokenId },
            outcome: 'SUCCESS',
        });
    }

    // -------------------------------------------------------------------------
    // Authorization
    // -------------------------------------------------------------------------

    /**
     * Check if token has required permission
     */
    authorize(tokenId: string, permission: Permission): boolean {
        const token = this.verifyToken(tokenId);
        if (!token) {
            return false;
        }
        return token.permissions.includes(permission);
    }

    /**
     * Require authorization - throws if not authorized
     */
    requireAuth(tokenId: string, permission: Permission, action: string): AuthToken {
        const token = this.verifyToken(tokenId);

        if (!token) {
            this.logAudit({
                action: 'ACCESS_DENIED',
                actor: { type: 'AGENT', id: 'UNKNOWN' },
                details: { permission, attemptedAction: action },
                outcome: 'DENIED',
                reason: 'Invalid or expired token',
            });

            this.emit('access:denied', action, 'UNKNOWN', 'Invalid or expired token');
            throw new AuthenticationError('Invalid or expired token');
        }

        if (!token.permissions.includes(permission)) {
            const actorId = token.agentId ?? 'HUMAN';

            this.logAudit({
                action: 'ACCESS_DENIED',
                actor: { type: token.type, id: actorId, tier: token.tier },
                details: { permission, attemptedAction: action, hasPermissions: token.permissions },
                outcome: 'DENIED',
                reason: `Missing permission: ${permission}`,
            });

            this.emit('access:denied', action, actorId, `Missing permission: ${permission}`);
            this.emit('security:alert', `Unauthorized ${action} attempt by ${actorId}`, 'MEDIUM');

            throw new UnauthorizedError(
                `Permission '${permission}' required for action '${action}'`,
                action,
                actorId
            );
        }

        return token;
    }

    /**
     * Check if action requires HITL approval based on current governance level
     */
    requiresHITLApproval(action: 'SPAWN' | 'DECISION' | 'STRATEGY', hitlLevel: number): boolean {
        const thresholds = {
            SPAWN: 50,
            DECISION: 70,
            STRATEGY: 30,
        };
        return hitlLevel >= thresholds[action];
    }

    // -------------------------------------------------------------------------
    // Audit Logging
    // -------------------------------------------------------------------------

    /**
     * Check if cryptographic audit logging is enabled.
     */
    isCryptoAuditEnabled(): boolean {
        return FEATURES.isEnabled('USE_CRYPTO_AUDIT');
    }

    /**
     * Log an audit entry (and to crypto logger if enabled)
     */
    logAudit(params: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
        const entry: AuditEntry = {
            id: uuidv4(),
            timestamp: new Date(),
            ...params,
        };

        this.auditLog.push(entry);
        this.emit('audit:logged', entry);

        // TRUST-2.6: Also log to cryptographic audit logger if enabled
        if (this.isCryptoAuditEnabled()) {
            // Fire and forget - crypto logging is async but we don't wait
            this.cryptoAuditLogger.logEntry({
                action: params.action,
                actor: params.actor,
                target: params.target,
                details: params.details,
                outcome: params.outcome,
                reason: params.reason,
            }).catch(err => {
                // Log error but don't fail the main audit
                console.error('Crypto audit logging failed:', err);
            });
        }

        // Alert on denied access or errors
        if (entry.outcome === 'DENIED' || entry.outcome === 'ERROR') {
            const severity = entry.action === 'HITL_LEVEL_CHANGE' ? 'HIGH' : 'MEDIUM';
            this.emit('security:alert', `${entry.action}: ${entry.reason}`, severity);
        }

        return entry;
    }

    /**
     * Get audit log entries
     */
    getAuditLog(params?: {
        action?: AuditAction;
        actorId?: string;
        since?: Date;
        limit?: number;
    }): AuditEntry[] {
        let entries = [...this.auditLog];

        if (params?.action) {
            entries = entries.filter(e => e.action === params.action);
        }

        if (params?.actorId) {
            entries = entries.filter(e => e.actor.id === params.actorId);
        }

        if (params?.since) {
            entries = entries.filter(e => e.timestamp >= params.since!);
        }

        // Most recent first
        entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        if (params?.limit) {
            entries = entries.slice(0, params.limit);
        }

        return entries;
    }

    /**
     * Get security alerts from recent log
     */
    getSecurityAlerts(since?: Date): AuditEntry[] {
        const cutoff = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24h
        return this.auditLog.filter(
            e => e.timestamp >= cutoff && (e.outcome === 'DENIED' || e.outcome === 'ERROR')
        );
    }

    // -------------------------------------------------------------------------
    // TRUST-2.6: Cryptographic Audit Methods
    // -------------------------------------------------------------------------

    /**
     * Verify the integrity of the cryptographic audit chain.
     */
    async verifyAuditChain(): Promise<AuditChainStatus> {
        return this.cryptoAuditLogger.verifyChain();
    }

    /**
     * Export audit log for compliance (with cryptographic verification).
     */
    async exportAuditLogForCompliance(
        startDate: Date,
        endDate: Date,
        format: 'json' | 'csv' = 'json'
    ): Promise<string> {
        if (this.isCryptoAuditEnabled()) {
            return this.cryptoAuditLogger.exportForCompliance(startDate, endDate, format);
        }

        // Legacy export - just JSON of audit entries
        const entries = this.auditLog.filter(
            e => e.timestamp >= startDate && e.timestamp <= endDate
        );
        return JSON.stringify({ entries, chainStatus: { isValid: false, reason: 'Crypto audit disabled' } }, null, 2);
    }

    /**
     * Get the cryptographic audit logger instance.
     */
    getCryptoAuditLogger(): CryptographicAuditLogger {
        return this.cryptoAuditLogger;
    }

    /**
     * Get cryptographic audit entries (if crypto audit enabled).
     */
    getCryptoAuditLog(): CryptographicAuditEntry[] {
        if (!this.isCryptoAuditEnabled()) {
            return [];
        }
        return this.cryptoAuditLogger.getAllEntries();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private getPermissionsForTier(tier: AgentTier): Permission[] {
        const basePermissions: Permission[] = ['BLACKBOARD_POST'];

        switch (tier) {
            case 5: // SOVEREIGN
                return [
                    ...basePermissions,
                    'TRUST_REWARD',
                    'TRUST_PENALIZE',
                    'SPAWN_AGENT',
                    'VIEW_AUDIT_LOG',
                    'BLACKBOARD_RESOLVE',
                    'AGENT_TERMINATE',
                ];
            case 4: // EXECUTIVE
                return [
                    ...basePermissions,
                    'TRUST_REWARD',
                    'TRUST_PENALIZE',
                    'SPAWN_AGENT',
                    'VIEW_AUDIT_LOG',
                    'BLACKBOARD_RESOLVE',
                ];
            case 3: // TACTICAL
                return [
                    ...basePermissions,
                    'TRUST_REWARD',
                    'SPAWN_AGENT',
                    'BLACKBOARD_RESOLVE',
                ];
            case 2: // OPERATIONAL
                return [
                    ...basePermissions,
                    'BLACKBOARD_RESOLVE',
                ];
            default: // WORKER, PASSIVE
                return basePermissions;
        }
    }

    private generateMasterKey(): string {
        // In production, this would come from env
        return uuidv4();
    }

    /**
     * Get the current master key (for initial setup only)
     */
    getMasterKey(): string {
        return this.humanMasterKey;
    }

    /**
     * Export audit log for compliance
     */
    exportAuditLog(): AuditEntry[] {
        return [...this.auditLog];
    }

    /**
     * Get statistics
     */
    getStats(): {
        totalAuditEntries: number;
        activeTokens: number;
        deniedActions: number;
        last24hActivity: number;
    } {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        return {
            totalAuditEntries: this.auditLog.length,
            activeTokens: this.tokens.size,
            deniedActions: this.auditLog.filter(e => e.outcome === 'DENIED').length,
            last24hActivity: this.auditLog.filter(e => e.timestamp >= dayAgo).length,
        };
    }
}

// Singleton instance
export const securityLayer = new SecurityLayer();
