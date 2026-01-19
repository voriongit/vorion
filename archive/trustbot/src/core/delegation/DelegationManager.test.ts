/**
 * Delegation Manager Tests
 *
 * Tests for TRUST-4.1 through TRUST-4.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DelegationManager } from './DelegationManager.js';
import { trustEngine } from '../TrustEngine.js';
import { FEATURES } from '../config/features.js';
import type { AgentId, AgentTier } from '../../types.js';
import type { Permission } from '../SecurityLayer.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestManager(): DelegationManager {
    return new DelegationManager();
}

function setupTestAgent(agentId: AgentId, tier: number): void {
    // Map tier to appropriate trust score based on TIER_THRESHOLDS from types/trust.ts
    // FICO-style scoring: 300-1000 range
    const tierScores: Record<number, number> = {
        0: 150,   // PASSIVE: 0-299
        1: 375,   // WORKER: 300-449
        2: 525,   // OPERATIONAL: 450-599
        3: 675,   // TACTICAL: 600-749
        4: 825,   // EXECUTIVE: 750-899
        5: 950,   // SOVEREIGN: 900-1000
    };
    trustEngine.createTrust(agentId, {
        tier: tier as AgentTier,
        parentId: null,
        initialTrust: tierScores[tier] ?? 500,
    });
}

// ============================================================================
// TRUST-4.1: Type Definitions (implicit through usage)
// ============================================================================

describe('DelegationManager', () => {
    let manager: DelegationManager;

    beforeEach(() => {
        manager = createTestManager();
        FEATURES.setOverride('ENABLE_DELEGATION', true);
    });

    afterEach(() => {
        manager.clear();
        FEATURES.clearOverride('ENABLE_DELEGATION');
    });

    // =========================================================================
    // TRUST-4.2: Delegation Request Creation
    // =========================================================================

    describe('requestCapabilities', () => {
        it('should create a valid delegation request', async () => {
            setupTestAgent('agent-t4' as AgentId, 4);

            const request = await manager.requestCapabilities({
                agentId: 'agent-t4' as AgentId,
                capabilities: ['SPAWN_AGENT'] as Permission[],
                reason: 'Need to spawn a worker',
                duration: 30 * 60 * 1000, // 30 minutes
            });

            expect(request).toBeDefined();
            expect(request.id).toBeDefined();
            expect(request.requesterId).toBe('agent-t4');
            expect(request.requestedCapabilities).toEqual(['SPAWN_AGENT']);
            expect(request.reason).toBe('Need to spawn a worker');
            expect(request.duration).toBe(30 * 60 * 1000);
            expect(request.requesterTier).toBe(4);
        });

        it('should reject invalid capability', async () => {
            setupTestAgent('agent-t4' as AgentId, 4);

            await expect(
                manager.requestCapabilities({
                    agentId: 'agent-t4' as AgentId,
                    capabilities: ['INVALID_CAPABILITY' as Permission],
                    reason: 'Test',
                    duration: 30 * 60 * 1000,
                })
            ).rejects.toThrow(/Invalid capability/);
        });

        it('should reject duration exceeding maximum', async () => {
            setupTestAgent('agent-t4' as AgentId, 4);

            await expect(
                manager.requestCapabilities({
                    agentId: 'agent-t4' as AgentId,
                    capabilities: ['SPAWN_AGENT'] as Permission[],
                    reason: 'Test',
                    duration: 48 * 60 * 60 * 1000, // 48 hours
                })
            ).rejects.toThrow(/Duration exceeds maximum/);
        });

        it('should reject empty capabilities', async () => {
            setupTestAgent('agent-t4' as AgentId, 4);

            await expect(
                manager.requestCapabilities({
                    agentId: 'agent-t4' as AgentId,
                    capabilities: [],
                    reason: 'Test',
                    duration: 30 * 60 * 1000,
                })
            ).rejects.toThrow(/At least one capability/);
        });

        it('should reject missing reason', async () => {
            setupTestAgent('agent-t4' as AgentId, 4);

            await expect(
                manager.requestCapabilities({
                    agentId: 'agent-t4' as AgentId,
                    capabilities: ['SPAWN_AGENT'] as Permission[],
                    reason: '',
                    duration: 30 * 60 * 1000,
                })
            ).rejects.toThrow(/Reason is required/);
        });

        it('should attach requester tier', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const request = await manager.requestCapabilities({
                agentId: 'agent-t3' as AgentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Need to resolve entries',
                duration: 30 * 60 * 1000,
            });

            expect(request.requesterTier).toBe(3);
        });
    });

    // =========================================================================
    // TRUST-4.3: Auto-Approval Logic
    // =========================================================================

    describe('checkAutoApproval', () => {
        it('should auto-approve T4+ with good track record', async () => {
            setupTestAgent('agent-t4' as AgentId, 4);

            // Create manager with relaxed auto-approval requirements
            const mgr = new DelegationManager({
                minSimilarApprovals: 0,
                minAutoApproveSuccessRate: 0.0, // Allow new agents with no history
            });

            const request = await mgr.requestCapabilities({
                agentId: 'agent-t4' as AgentId,
                capabilities: ['SPAWN_AGENT'] as Permission[],
                reason: 'Test spawn',
                duration: 30 * 60 * 1000, // Under 1 hour
            });

            // Should be approved since we relaxed requirements
            // and no restricted capabilities
            expect(request.status).toBe('approved');
            expect(request.approvedBy).toBe('AUTO');

            mgr.clear();
        });

        it('should not auto-approve T3 agents', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const request = await manager.requestCapabilities({
                agentId: 'agent-t3' as AgentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Test',
                duration: 30 * 60 * 1000,
            });

            // Should remain pending (tier too low)
            expect(request.status).toBe('pending');
        });

        it('should not auto-approve restricted capabilities', async () => {
            setupTestAgent('agent-t5' as AgentId, 5);

            const mgr = new DelegationManager({
                minSimilarApprovals: 0,
            });

            const request = await mgr.requestCapabilities({
                agentId: 'agent-t5' as AgentId,
                capabilities: ['SYSTEM_CONFIG'] as Permission[], // Restricted
                reason: 'Need system access',
                duration: 30 * 60 * 1000,
            });

            // Should remain pending (restricted capability)
            expect(request.status).toBe('pending');

            mgr.clear();
        });

        it('should not auto-approve durations over 1 hour', async () => {
            setupTestAgent('agent-t5' as AgentId, 5);

            const mgr = new DelegationManager({
                minSimilarApprovals: 0,
            });

            const request = await mgr.requestCapabilities({
                agentId: 'agent-t5' as AgentId,
                capabilities: ['SPAWN_AGENT'] as Permission[],
                reason: 'Long task',
                duration: 2 * 60 * 60 * 1000, // 2 hours
            });

            // Should remain pending (duration too long)
            expect(request.status).toBe('pending');

            mgr.clear();
        });
    });

    // =========================================================================
    // TRUST-4.4: Delegation Approval Routing
    // =========================================================================

    describe('approval routing', () => {
        it('should manually approve a pending request', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const request = await manager.requestCapabilities({
                agentId: 'agent-t3' as AgentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Test',
                duration: 30 * 60 * 1000,
            });

            expect(request.status).toBe('pending');

            const approved = await manager.approveRequest(request.id, 'HUMAN');

            expect(approved.status).toBe('approved');
            expect(approved.approvedBy).toBe('HUMAN');
            expect(approved.expiresAt).toBeDefined();
        });

        it('should reject a pending request', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const request = await manager.requestCapabilities({
                agentId: 'agent-t3' as AgentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Test',
                duration: 30 * 60 * 1000,
            });

            const rejected = await manager.rejectRequest(request.id, 'Not needed');

            expect(rejected.status).toBe('rejected');
            expect(rejected.rejectionReason).toBe('Not needed');
        });

        it('should not approve already decided request', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const request = await manager.requestCapabilities({
                agentId: 'agent-t3' as AgentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Test',
                duration: 30 * 60 * 1000,
            });

            await manager.approveRequest(request.id, 'HUMAN');

            await expect(
                manager.approveRequest(request.id, 'COUNCIL')
            ).rejects.toThrow(/already approved/);
        });

        it('should emit events on approval', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const handler = vi.fn();
            manager.on('delegation:approved', handler);

            const request = await manager.requestCapabilities({
                agentId: 'agent-t3' as AgentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Test',
                duration: 30 * 60 * 1000,
            });

            await manager.approveRequest(request.id, 'HUMAN');

            expect(handler).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // TRUST-4.5: Active Delegation Management
    // =========================================================================

    describe('active delegation management', () => {
        it('should create active delegation on approval', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const request = await manager.requestCapabilities({
                agentId: 'agent-t3' as AgentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Test',
                duration: 30 * 60 * 1000,
            });

            await manager.approveRequest(request.id, 'HUMAN');

            const delegations = manager.getActiveDelegations('agent-t3' as AgentId);
            expect(delegations).toHaveLength(1);
            expect(delegations[0].capabilities).toContain('BLACKBOARD_RESOLVE');
        });

        it('should check capability via delegation', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            // First, no delegation
            let hasCap = await manager.checkCapability('agent-t3' as AgentId, 'BLACKBOARD_RESOLVE');
            expect(hasCap).toBe(false);

            // Now grant delegation
            const request = await manager.requestCapabilities({
                agentId: 'agent-t3' as AgentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Test',
                duration: 30 * 60 * 1000,
            });

            await manager.approveRequest(request.id, 'HUMAN');

            // Now should have capability
            hasCap = await manager.checkCapability('agent-t3' as AgentId, 'BLACKBOARD_RESOLVE');
            expect(hasCap).toBe(true);
        });

        it('should revoke a delegation', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const request = await manager.requestCapabilities({
                agentId: 'agent-t3' as AgentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Test',
                duration: 30 * 60 * 1000,
            });

            await manager.approveRequest(request.id, 'HUMAN');

            const delegations = manager.getActiveDelegations('agent-t3' as AgentId);
            expect(delegations).toHaveLength(1);

            const revoked = await manager.revokeDelegation(delegations[0].id, 'No longer needed');
            expect(revoked).toBe(true);

            const afterRevoke = manager.getActiveDelegations('agent-t3' as AgentId);
            expect(afterRevoke).toHaveLength(0);
        });

        it('should emit events on revocation', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const handler = vi.fn();
            manager.on('delegation:revoked', handler);

            const request = await manager.requestCapabilities({
                agentId: 'agent-t3' as AgentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Test',
                duration: 30 * 60 * 1000,
            });

            await manager.approveRequest(request.id, 'HUMAN');
            const delegations = manager.getActiveDelegations('agent-t3' as AgentId);
            await manager.revokeDelegation(delegations[0].id, 'Test revoke');

            expect(handler).toHaveBeenCalled();
        });

        it('should clean up expired delegations', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const request = await manager.requestCapabilities({
                agentId: 'agent-t3' as AgentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Test',
                duration: 100, // 100ms - very short
            });

            await manager.approveRequest(request.id, 'HUMAN');

            // Wait for expiry
            await new Promise(resolve => setTimeout(resolve, 150));

            const cleaned = manager.cleanupExpired();
            expect(cleaned).toBe(1);

            const delegations = manager.getActiveDelegations('agent-t3' as AgentId);
            expect(delegations).toHaveLength(0);
        });

        it('should track usage of delegated capability', async () => {
            setupTestAgent('agent-t3' as AgentId, 3);

            const request = await manager.requestCapabilities({
                agentId: 'agent-t3' as AgentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Test',
                duration: 30 * 60 * 1000,
            });

            await manager.approveRequest(request.id, 'HUMAN');

            // Use the capability
            await manager.checkCapability('agent-t3' as AgentId, 'BLACKBOARD_RESOLVE');
            await manager.checkCapability('agent-t3' as AgentId, 'BLACKBOARD_RESOLVE');

            const delegations = manager.getActiveDelegations('agent-t3' as AgentId);
            expect(delegations[0].usageCount).toBe(2);
        });
    });

    // =========================================================================
    // Statistics
    // =========================================================================

    describe('getStats', () => {
        it('should return accurate statistics', async () => {
            setupTestAgent('agent-t4' as AgentId, 4);
            setupTestAgent('agent-t3' as AgentId, 3);

            // Create some requests
            const req1 = await manager.requestCapabilities({
                agentId: 'agent-t3' as AgentId,
                capabilities: ['BLACKBOARD_RESOLVE'] as Permission[],
                reason: 'Test 1',
                duration: 30 * 60 * 1000,
            });

            await manager.approveRequest(req1.id, 'HUMAN');

            const req2 = await manager.requestCapabilities({
                agentId: 'agent-t3' as AgentId,
                capabilities: ['VIEW_AUDIT_LOG'] as Permission[],
                reason: 'Test 2',
                duration: 30 * 60 * 1000,
            });

            await manager.rejectRequest(req2.id, 'Not allowed');

            const stats = manager.getStats();

            expect(stats.totalRequests).toBe(2);
            expect(stats.approvedRequests).toBe(1);
            expect(stats.rejectedRequests).toBe(1);
            expect(stats.activeDelegations).toBe(1);
        });
    });
});
