/**
 * Security Layer Unit Tests
 *
 * Tests for authentication, authorization, and audit logging.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    SecurityLayer,
    UnauthorizedError,
    AuthenticationError,
} from './SecurityLayer.js';

describe('SecurityLayer', () => {
    let security: SecurityLayer;
    let masterKey: string;

    beforeEach(() => {
        security = new SecurityLayer();
        masterKey = security.getMasterKey();
    });

    // ===========================================================================
    // Authentication Tests
    // ===========================================================================

    describe('issueHumanToken', () => {
        it('issues token with valid master key', () => {
            const token = security.issueHumanToken(masterKey);

            expect(token.type).toBe('HUMAN');
            expect(token.permissions).toContain('HITL_MODIFY');
            expect(token.permissions).toContain('SYSTEM_CONFIG');
            expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
        });

        it('throws AuthenticationError with invalid master key', () => {
            expect(() => {
                security.issueHumanToken('invalid-key');
            }).toThrow(AuthenticationError);
        });

        it('logs audit entry on failed authentication', () => {
            try {
                security.issueHumanToken('wrong-key');
            } catch {
                // Expected
            }

            const logs = security.getAuditLog({ action: 'AUTH_TOKEN_ISSUED' });
            const deniedLog = logs.find(l => l.outcome === 'DENIED');
            expect(deniedLog).toBeDefined();
            expect(deniedLog?.reason).toBe('Invalid master key');
        });
    });

    describe('issueAgentToken', () => {
        it('issues token with tier-appropriate permissions', () => {
            const t5Token = security.issueAgentToken('t5-agent', 5);
            const t1Token = security.issueAgentToken('t1-agent', 1);

            expect(t5Token.permissions).toContain('TRUST_PENALIZE');
            expect(t5Token.permissions).toContain('AGENT_TERMINATE');

            expect(t1Token.permissions).toContain('BLACKBOARD_POST');
            expect(t1Token.permissions).not.toContain('TRUST_PENALIZE');
        });

        it('sets correct tier on token', () => {
            const token = security.issueAgentToken('agent-1', 3);

            expect(token.tier).toBe(3);
            expect(token.agentId).toBe('agent-1');
        });
    });

    describe('verifyToken', () => {
        it('returns token for valid token ID', () => {
            const issued = security.issueHumanToken(masterKey);
            const verified = security.verifyToken(issued.id);

            expect(verified).not.toBeNull();
            expect(verified?.id).toBe(issued.id);
        });

        it('returns null for invalid token ID', () => {
            const result = security.verifyToken('nonexistent');
            expect(result).toBeNull();
        });

        it('returns null for revoked token', () => {
            const token = security.issueHumanToken(masterKey);
            security.revokeToken(token.id);

            const result = security.verifyToken(token.id);
            expect(result).toBeNull();
        });
    });

    describe('revokeToken', () => {
        it('revokes token successfully', () => {
            const token = security.issueHumanToken(masterKey);

            security.revokeToken(token.id);

            expect(security.verifyToken(token.id)).toBeNull();
        });

        it('emits token:revoked event', () => {
            const token = security.issueHumanToken(masterKey);
            const spy = vi.fn();
            security.on('token:revoked', spy);

            security.revokeToken(token.id);

            expect(spy).toHaveBeenCalledWith(token.id);
        });
    });

    // ===========================================================================
    // Authorization Tests
    // ===========================================================================

    describe('authorize', () => {
        it('returns true for permitted action', () => {
            const token = security.issueHumanToken(masterKey);

            expect(security.authorize(token.id, 'HITL_MODIFY')).toBe(true);
        });

        it('returns false for unpermitted action', () => {
            const token = security.issueAgentToken('t1-agent', 1);

            expect(security.authorize(token.id, 'HITL_MODIFY')).toBe(false);
        });

        it('returns false for invalid token', () => {
            expect(security.authorize('invalid', 'BLACKBOARD_POST')).toBe(false);
        });
    });

    describe('requireAuth', () => {
        it('returns token for authorized request', () => {
            const token = security.issueHumanToken(masterKey);

            const result = security.requireAuth(token.id, 'HITL_MODIFY', 'TEST_ACTION');

            expect(result.id).toBe(token.id);
        });

        it('throws AuthenticationError for invalid token', () => {
            expect(() => {
                security.requireAuth('invalid', 'HITL_MODIFY', 'TEST_ACTION');
            }).toThrow(AuthenticationError);
        });

        it('throws UnauthorizedError for missing permission', () => {
            const token = security.issueAgentToken('t1-agent', 1);

            expect(() => {
                security.requireAuth(token.id, 'HITL_MODIFY', 'MODIFY_HITL');
            }).toThrow(UnauthorizedError);
        });

        it('logs access denied on unauthorized attempt', () => {
            const token = security.issueAgentToken('t2-agent', 2);

            try {
                security.requireAuth(token.id, 'TRUST_PENALIZE', 'PENALIZE_AGENT');
            } catch {
                // Expected
            }

            const deniedLogs = security.getAuditLog({ action: 'ACCESS_DENIED' });
            expect(deniedLogs.length).toBeGreaterThan(0);
            expect(deniedLogs[0].reason).toContain('Missing permission');
        });

        it('emits security:alert on unauthorized attempt', () => {
            const token = security.issueAgentToken('t1-agent', 1);
            const alertSpy = vi.fn();
            security.on('security:alert', alertSpy);

            try {
                security.requireAuth(token.id, 'AGENT_TERMINATE', 'TERMINATE_AGENT');
            } catch {
                // Expected
            }

            expect(alertSpy).toHaveBeenCalled();
        });
    });

    describe('requiresHITLApproval', () => {
        it('returns true when HITL level above threshold', () => {
            expect(security.requiresHITLApproval('SPAWN', 60)).toBe(true);    // threshold 50
            expect(security.requiresHITLApproval('DECISION', 80)).toBe(true); // threshold 70
            expect(security.requiresHITLApproval('STRATEGY', 40)).toBe(true); // threshold 30
        });

        it('returns false when HITL level below threshold', () => {
            expect(security.requiresHITLApproval('SPAWN', 40)).toBe(false);
            expect(security.requiresHITLApproval('DECISION', 60)).toBe(false);
            expect(security.requiresHITLApproval('STRATEGY', 20)).toBe(false);
        });
    });

    // ===========================================================================
    // Tier Permission Tests
    // ===========================================================================

    describe('tier-based permissions', () => {
        it('T5 (SOVEREIGN) has full agent permissions', () => {
            const token = security.issueAgentToken('t5', 5);

            expect(token.permissions).toContain('TRUST_REWARD');
            expect(token.permissions).toContain('TRUST_PENALIZE');
            expect(token.permissions).toContain('SPAWN_AGENT');
            expect(token.permissions).toContain('VIEW_AUDIT_LOG');
            expect(token.permissions).toContain('AGENT_TERMINATE');
            // But NOT human-only permissions
            expect(token.permissions).not.toContain('HITL_MODIFY');
            expect(token.permissions).not.toContain('SYSTEM_CONFIG');
        });

        it('T4 (EXECUTIVE) can penalize but not terminate', () => {
            const token = security.issueAgentToken('t4', 4);

            expect(token.permissions).toContain('TRUST_PENALIZE');
            expect(token.permissions).not.toContain('AGENT_TERMINATE');
        });

        it('T3 (TACTICAL) can reward but not penalize', () => {
            const token = security.issueAgentToken('t3', 3);

            expect(token.permissions).toContain('TRUST_REWARD');
            expect(token.permissions).not.toContain('TRUST_PENALIZE');
        });

        it('T2 (OPERATIONAL) has limited permissions', () => {
            const token = security.issueAgentToken('t2', 2);

            expect(token.permissions).toContain('BLACKBOARD_POST');
            expect(token.permissions).toContain('BLACKBOARD_RESOLVE');
            expect(token.permissions).not.toContain('TRUST_REWARD');
        });

        it('T1 (WORKER) has minimal permissions', () => {
            const token = security.issueAgentToken('t1', 1);

            expect(token.permissions).toEqual(['BLACKBOARD_POST']);
        });
    });

    // ===========================================================================
    // Audit Logging Tests
    // ===========================================================================

    describe('audit logging', () => {
        it('logs audit entries correctly', () => {
            const entry = security.logAudit({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'test-agent', tier: 5 },
                target: { type: 'AGENT', id: 'target-agent' },
                details: { amount: 50 },
                outcome: 'SUCCESS',
            });

            expect(entry.id).toBeDefined();
            expect(entry.timestamp).toBeDefined();
            expect(entry.action).toBe('TRUST_REWARD');
        });

        it('filters audit log by action', () => {
            security.logAudit({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'a1' },
                details: {},
                outcome: 'SUCCESS',
            });
            security.logAudit({
                action: 'TRUST_PENALIZE',
                actor: { type: 'AGENT', id: 'a2' },
                details: {},
                outcome: 'SUCCESS',
            });

            const rewards = security.getAuditLog({ action: 'TRUST_REWARD' });
            expect(rewards.every(e => e.action === 'TRUST_REWARD')).toBe(true);
        });

        it('filters audit log by actor', () => {
            security.logAudit({
                action: 'BLACKBOARD_POST',
                actor: { type: 'AGENT', id: 'specific-agent' },
                details: {},
                outcome: 'SUCCESS',
            });

            const logs = security.getAuditLog({ actorId: 'specific-agent' });
            expect(logs.every(e => e.actor.id === 'specific-agent')).toBe(true);
        });

        it('limits audit log results', () => {
            for (let i = 0; i < 20; i++) {
                security.logAudit({
                    action: 'BLACKBOARD_POST',
                    actor: { type: 'AGENT', id: `agent-${i}` },
                    details: {},
                    outcome: 'SUCCESS',
                });
            }

            const limited = security.getAuditLog({ limit: 5 });
            expect(limited.length).toBe(5);
        });

        it('returns most recent entries first', async () => {
            security.logAudit({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'first' },
                details: { order: 1 },
                outcome: 'SUCCESS',
            });

            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 5));

            security.logAudit({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'second' },
                details: { order: 2 },
                outcome: 'SUCCESS',
            });

            const logs = security.getAuditLog({ action: 'TRUST_REWARD' });
            // Most recent (second) should be first in the list
            expect(logs[0].actor.id).toBe('second');
            expect(logs[1].actor.id).toBe('first');
        });
    });

    describe('security alerts', () => {
        it('returns denied actions as alerts', () => {
            security.logAudit({
                action: 'ACCESS_DENIED',
                actor: { type: 'AGENT', id: 'bad-actor' },
                details: {},
                outcome: 'DENIED',
                reason: 'Unauthorized',
            });

            const alerts = security.getSecurityAlerts();
            expect(alerts.length).toBeGreaterThan(0);
            expect(alerts[0].outcome).toBe('DENIED');
        });

        it('emits security:alert on denied access', () => {
            const alertSpy = vi.fn();
            security.on('security:alert', alertSpy);

            security.logAudit({
                action: 'HITL_LEVEL_CHANGE',
                actor: { type: 'AGENT', id: 'rogue' },
                details: {},
                outcome: 'DENIED',
                reason: 'Agent tried to modify HITL',
            });

            expect(alertSpy).toHaveBeenCalledWith(
                expect.stringContaining('HITL_LEVEL_CHANGE'),
                'HIGH'
            );
        });
    });

    // ===========================================================================
    // Statistics Tests
    // ===========================================================================

    describe('statistics', () => {
        it('returns accurate stats', () => {
            security.issueHumanToken(masterKey);
            security.issueAgentToken('agent-1', 3);

            security.logAudit({
                action: 'ACCESS_DENIED',
                actor: { type: 'AGENT', id: 'test' },
                details: {},
                outcome: 'DENIED',
            });

            const stats = security.getStats();

            expect(stats.activeTokens).toBe(2);
            expect(stats.deniedActions).toBeGreaterThan(0);
            expect(stats.totalAuditEntries).toBeGreaterThan(0);
        });
    });

    describe('exportAuditLog', () => {
        it('exports all audit entries', () => {
            security.logAudit({
                action: 'TRUST_CREATED',
                actor: { type: 'SYSTEM', id: 'test' },
                details: {},
                outcome: 'SUCCESS',
            });

            const exported = security.exportAuditLog();
            expect(exported.length).toBeGreaterThan(0);
        });
    });
});
