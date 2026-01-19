/**
 * Auto-Approval Service Tests
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.2: Auto-Approval System
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    AutoApprovalService,
    getAutoApprovalService,
    resetAutoApprovalService,
    type AutoApprovalRecord,
} from './AutoApprovalService.js';
import { type ActionRequest, type AgentContext, resetTrustGateEngine } from './TrustGateEngine.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createRequest(overrides: Partial<ActionRequest> = {}): ActionRequest {
    return {
        id: `req_${Date.now()}`,
        agentId: 'agent_1',
        orgId: 'org_1',
        actionType: 'read_data',
        category: 'read',
        description: 'Test action',
        urgency: 'normal',
        requestedAt: new Date(),
        ...overrides,
    };
}

function createHighTrustContext(overrides: Partial<AgentContext> = {}): AgentContext {
    return {
        trustScore: 850,
        tier: 'TRUSTED',
        capabilities: ['execute', 'delegate'],
        recentFailures: 0,
        recentSuccesses: 20,
        actionHistory: new Map([['read_data', 10]]),
        ...overrides,
    };
}

function createLowTrustContext(overrides: Partial<AgentContext> = {}): AgentContext {
    return {
        trustScore: 400,
        tier: 'PROBATIONARY',
        capabilities: ['execute'],
        recentFailures: 2,
        recentSuccesses: 5,
        actionHistory: new Map([['read_data', 1]]),
        ...overrides,
    };
}

// ============================================================================
// Tests
// ============================================================================

describe('AutoApprovalService', () => {
    let service: AutoApprovalService;

    beforeEach(() => {
        resetAutoApprovalService();
        resetTrustGateEngine();
        service = new AutoApprovalService();
    });

    // =========================================================================
    // Auto-Approval Evaluation
    // =========================================================================

    describe('tryAutoApprove', () => {
        it('should auto-approve eligible requests from high-trust agents', () => {
            const request = createRequest();
            const context = createHighTrustContext();

            const record = service.tryAutoApprove(request, context);

            expect(record).not.toBeNull();
            expect(record?.requestId).toBe(request.id);
            expect(record?.agentId).toBe(request.agentId);
            expect(record?.orgId).toBe(request.orgId);
            expect(record?.trustScore).toBe(context.trustScore);
            expect(record?.executedAt).toBeUndefined();
        });

        it('should reject low trust score agents', () => {
            const request = createRequest();
            const context = createLowTrustContext();

            const record = service.tryAutoApprove(request, context);

            expect(record).toBeNull();
        });

        it('should reject agents with recent failures', () => {
            const request = createRequest();
            const context = createHighTrustContext({ recentFailures: 1 });

            const record = service.tryAutoApprove(request, context);

            expect(record).toBeNull();
        });

        it('should reject ineligible categories', () => {
            const request = createRequest({ category: 'financial' });
            const context = createHighTrustContext();

            const record = service.tryAutoApprove(request, context);

            expect(record).toBeNull();
        });

        it('should reject blocked actions', () => {
            service.blockAction('delete_user');
            const request = createRequest({ actionType: 'delete_user' });
            const context = createHighTrustContext({
                actionHistory: new Map([['delete_user', 10]]),
            });

            const record = service.tryAutoApprove(request, context);

            expect(record).toBeNull();
        });

        it('should reject first-time actions', () => {
            const request = createRequest({ actionType: 'new_action' });
            const context = createHighTrustContext({
                actionHistory: new Map(), // No history for this action
            });

            const record = service.tryAutoApprove(request, context);

            expect(record).toBeNull();
        });

        it('should emit approval:granted event', () => {
            const grantedHandler = vi.fn();
            service.on('approval:granted', grantedHandler);

            const request = createRequest();
            const context = createHighTrustContext();
            service.tryAutoApprove(request, context);

            expect(grantedHandler).toHaveBeenCalled();
            expect(grantedHandler.mock.calls[0][0].requestId).toBe(request.id);
        });

        it('should emit approval:rejected event', () => {
            const rejectedHandler = vi.fn();
            service.on('approval:rejected', rejectedHandler);

            const request = createRequest();
            const context = createLowTrustContext();
            service.tryAutoApprove(request, context);

            expect(rejectedHandler).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // Eligibility Checking
    // =========================================================================

    describe('checkEligibility', () => {
        it('should return eligible for qualifying requests', () => {
            const request = createRequest();
            const context = createHighTrustContext();

            const result = service.checkEligibility(request, context);

            expect(result.eligible).toBe(true);
            expect(result.reason).toBe('All criteria met');
        });

        it('should reject low trust scores', () => {
            const request = createRequest();
            const context = createHighTrustContext({ trustScore: 700 });

            const result = service.checkEligibility(request, context);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Trust score');
            expect(result.reason).toContain('below minimum');
        });

        it('should reject too many recent failures', () => {
            const request = createRequest();
            const context = createHighTrustContext({ recentFailures: 3 });

            const result = service.checkEligibility(request, context);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Recent failures');
        });

        it('should reject ineligible categories', () => {
            const request = createRequest({ category: 'delegate' });
            const context = createHighTrustContext();

            const result = service.checkEligibility(request, context);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('not eligible for auto-approval');
        });

        it('should reject blocked action types', () => {
            service.blockAction('dangerous_action');
            const request = createRequest({ actionType: 'dangerous_action' });
            const context = createHighTrustContext({
                actionHistory: new Map([['dangerous_action', 10]]),
            });

            const result = service.checkEligibility(request, context);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('blocked');
        });

        it('should reject missing capabilities', () => {
            const request = createRequest();
            const context = createHighTrustContext({ capabilities: [] });

            const result = service.checkEligibility(request, context);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Missing required capability');
        });

        it('should reject insufficient action history', () => {
            const request = createRequest({ actionType: 'rare_action' });
            const context = createHighTrustContext({
                actionHistory: new Map([['rare_action', 1]]),
            });

            const result = service.checkEligibility(request, context);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Insufficient action history');
        });
    });

    // =========================================================================
    // Dry Run
    // =========================================================================

    describe('wouldAutoApprove', () => {
        it('should return wouldApprove=true for eligible requests', () => {
            const request = createRequest();
            const context = createHighTrustContext();

            const result = service.wouldAutoApprove(request, context);

            expect(result.wouldApprove).toBe(true);
            expect(result.eligibility.eligible).toBe(true);
            expect(result.gateDecision).toBe('auto_approve');
        });

        it('should return wouldApprove=false for ineligible requests', () => {
            const request = createRequest();
            const context = createLowTrustContext();

            const result = service.wouldAutoApprove(request, context);

            expect(result.wouldApprove).toBe(false);
            expect(result.eligibility.eligible).toBe(false);
        });

        it('should not create a record (dry run)', () => {
            const request = createRequest();
            const context = createHighTrustContext();

            service.wouldAutoApprove(request, context);

            expect(service.size).toBe(0);
        });
    });

    // =========================================================================
    // Execution Tracking
    // =========================================================================

    describe('recordExecution', () => {
        it('should track successful execution', () => {
            const request = createRequest();
            const context = createHighTrustContext();
            const record = service.tryAutoApprove(request, context)!;

            const result = service.recordExecution(record.id, 'success');

            expect(result).toBe(true);
            const updated = service.getRecord(record.id);
            expect(updated?.executedAt).toBeDefined();
            expect(updated?.executionResult).toBe('success');
        });

        it('should track failed execution', () => {
            const request = createRequest();
            const context = createHighTrustContext();
            const record = service.tryAutoApprove(request, context)!;

            service.recordExecution(record.id, 'failure');

            const updated = service.getRecord(record.id);
            expect(updated?.executionResult).toBe('failure');
        });

        it('should return false for unknown record', () => {
            const result = service.recordExecution('unknown_id', 'success');
            expect(result).toBe(false);
        });

        it('should emit approval:executed event on success', () => {
            const executedHandler = vi.fn();
            service.on('approval:executed', executedHandler);

            const request = createRequest();
            const context = createHighTrustContext();
            const record = service.tryAutoApprove(request, context)!;

            service.recordExecution(record.id, 'success');

            expect(executedHandler).toHaveBeenCalled();
        });

        it('should emit approval:failed event on failure', () => {
            const failedHandler = vi.fn();
            service.on('approval:failed', failedHandler);

            const request = createRequest();
            const context = createHighTrustContext();
            const record = service.tryAutoApprove(request, context)!;

            service.recordExecution(record.id, 'failure');

            expect(failedHandler).toHaveBeenCalled();
        });
    });

    describe('getPendingApprovals', () => {
        it('should return only pending approvals', () => {
            const request1 = createRequest({ id: 'req_1' });
            const request2 = createRequest({ id: 'req_2' });
            const context = createHighTrustContext();

            const record1 = service.tryAutoApprove(request1, context)!;
            const record2 = service.tryAutoApprove(request2, context)!;
            service.recordExecution(record1.id, 'success');

            const pending = service.getPendingApprovals();

            expect(pending.length).toBe(1);
            expect(pending[0].id).toBe(record2.id);
        });

        it('should filter by agent', () => {
            const request1 = createRequest({ id: 'req_1', agentId: 'agent_1' });
            const request2 = createRequest({ id: 'req_2', agentId: 'agent_2' });
            const context = createHighTrustContext();

            service.tryAutoApprove(request1, context);
            service.tryAutoApprove(request2, context);

            const pending = service.getPendingApprovals('agent_1');

            expect(pending.length).toBe(1);
            expect(pending[0].agentId).toBe('agent_1');
        });

        it('should filter by org', () => {
            const request1 = createRequest({ id: 'req_1', orgId: 'org_1' });
            const request2 = createRequest({ id: 'req_2', orgId: 'org_2' });
            const context = createHighTrustContext();

            service.tryAutoApprove(request1, context);
            service.tryAutoApprove(request2, context);

            const pending = service.getPendingApprovals(undefined, 'org_1');

            expect(pending.length).toBe(1);
            expect(pending[0].orgId).toBe('org_1');
        });
    });

    // =========================================================================
    // Record Retrieval
    // =========================================================================

    describe('getRecord', () => {
        it('should return record by ID', () => {
            const request = createRequest();
            const context = createHighTrustContext();
            const record = service.tryAutoApprove(request, context)!;

            const retrieved = service.getRecord(record.id);

            expect(retrieved).not.toBeNull();
            expect(retrieved?.id).toBe(record.id);
        });

        it('should return null for unknown ID', () => {
            const result = service.getRecord('unknown_id');
            expect(result).toBeNull();
        });
    });

    describe('getRecordByRequestId', () => {
        it('should return record by request ID', () => {
            const request = createRequest({ id: 'unique_req_123' });
            const context = createHighTrustContext();
            service.tryAutoApprove(request, context);

            const retrieved = service.getRecordByRequestId('unique_req_123');

            expect(retrieved).not.toBeNull();
            expect(retrieved?.requestId).toBe('unique_req_123');
        });

        it('should return null for unknown request ID', () => {
            const result = service.getRecordByRequestId('unknown_req');
            expect(result).toBeNull();
        });
    });

    describe('getAgentApprovals', () => {
        it('should return approvals for specific agent', () => {
            const request1 = createRequest({ id: 'req_1', agentId: 'agent_1' });
            const request2 = createRequest({ id: 'req_2', agentId: 'agent_1' });
            const request3 = createRequest({ id: 'req_3', agentId: 'agent_2' });
            const context = createHighTrustContext();

            service.tryAutoApprove(request1, context);
            service.tryAutoApprove(request2, context);
            service.tryAutoApprove(request3, context);

            const approvals = service.getAgentApprovals('agent_1');

            expect(approvals.length).toBe(2);
            approvals.forEach(a => expect(a.agentId).toBe('agent_1'));
        });

        it('should respect limit option', () => {
            const context = createHighTrustContext();
            for (let i = 0; i < 5; i++) {
                const request = createRequest({ id: `req_${i}` });
                service.tryAutoApprove(request, context);
            }

            const approvals = service.getAgentApprovals('agent_1', { limit: 3 });

            expect(approvals.length).toBe(3);
        });

        it('should filter by since date', () => {
            const context = createHighTrustContext();
            const request1 = createRequest({ id: 'req_old' });
            service.tryAutoApprove(request1, context);

            // Simulate time passing
            const sinceDate = new Date();
            const request2 = createRequest({ id: 'req_new' });
            const record2 = service.tryAutoApprove(request2, context)!;

            // Manually adjust the date for testing
            const oldRecord = service.getRecordByRequestId('req_old')!;
            (oldRecord as any).approvedAt = new Date(Date.now() - 60000);

            const approvals = service.getAgentApprovals('agent_1', { since: sinceDate });

            expect(approvals.length).toBe(1);
            expect(approvals[0].id).toBe(record2.id);
        });
    });

    describe('getOrgApprovals', () => {
        it('should return approvals for specific org', () => {
            const request1 = createRequest({ id: 'req_1', orgId: 'org_1' });
            const request2 = createRequest({ id: 'req_2', orgId: 'org_2' });
            const context = createHighTrustContext();

            service.tryAutoApprove(request1, context);
            service.tryAutoApprove(request2, context);

            const approvals = service.getOrgApprovals('org_1');

            expect(approvals.length).toBe(1);
            expect(approvals[0].orgId).toBe('org_1');
        });
    });

    // =========================================================================
    // Statistics
    // =========================================================================

    describe('getStats', () => {
        it('should return correct statistics', () => {
            const context = createHighTrustContext();

            // Create approvals
            const request1 = createRequest({ id: 'req_1', category: 'read' });
            const request2 = createRequest({ id: 'req_2', category: 'write' });
            const request3 = createRequest({ id: 'req_3', category: 'read' });

            const record1 = service.tryAutoApprove(request1, context)!;
            const record2 = service.tryAutoApprove(request2, context)!;
            service.tryAutoApprove(request3, context);

            service.recordExecution(record1.id, 'success');
            service.recordExecution(record2.id, 'failure');

            const stats = service.getStats();

            expect(stats.totalApprovals).toBe(3);
            expect(stats.successfulExecutions).toBe(1);
            expect(stats.failedExecutions).toBe(1);
            expect(stats.pendingExecutions).toBe(1);
            expect(stats.approvalsByCategory['read']).toBe(2);
            expect(stats.approvalsByCategory['write']).toBe(1);
        });

        it('should filter by org', () => {
            const context = createHighTrustContext();

            const request1 = createRequest({ id: 'req_1', orgId: 'org_1' });
            const request2 = createRequest({ id: 'req_2', orgId: 'org_2' });

            service.tryAutoApprove(request1, context);
            service.tryAutoApprove(request2, context);

            const stats = service.getStats('org_1');

            expect(stats.totalApprovals).toBe(1);
        });
    });

    describe('getSuccessRate', () => {
        it('should calculate correct success rate', () => {
            const context = createHighTrustContext();

            const request1 = createRequest({ id: 'req_1' });
            const request2 = createRequest({ id: 'req_2' });
            const request3 = createRequest({ id: 'req_3' });

            const record1 = service.tryAutoApprove(request1, context)!;
            const record2 = service.tryAutoApprove(request2, context)!;
            const record3 = service.tryAutoApprove(request3, context)!;

            service.recordExecution(record1.id, 'success');
            service.recordExecution(record2.id, 'success');
            service.recordExecution(record3.id, 'failure');

            const rate = service.getSuccessRate();

            expect(rate).toBeCloseTo(0.667, 2);
        });

        it('should return 1 when no executions', () => {
            const rate = service.getSuccessRate();
            expect(rate).toBe(1);
        });

        it('should filter by agent', () => {
            const context = createHighTrustContext();

            const request1 = createRequest({ id: 'req_1', agentId: 'agent_1' });
            const request2 = createRequest({ id: 'req_2', agentId: 'agent_2' });

            const record1 = service.tryAutoApprove(request1, context)!;
            const record2 = service.tryAutoApprove(request2, context)!;

            service.recordExecution(record1.id, 'success');
            service.recordExecution(record2.id, 'failure');

            const rate = service.getSuccessRate('agent_1');

            expect(rate).toBe(1);
        });
    });

    // =========================================================================
    // Configuration
    // =========================================================================

    describe('setOrgCriteria', () => {
        it('should apply org-specific criteria', () => {
            service.setOrgCriteria('org_strict', {
                minTrustScore: 950,
            });

            const request = createRequest({ orgId: 'org_strict' });
            const context = createHighTrustContext({ trustScore: 900 });

            const result = service.checkEligibility(request, context);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Trust score');
        });

        it('should merge with default criteria', () => {
            service.setOrgCriteria('org_custom', {
                minTrustScore: 750,
            });

            const criteria = service.getOrgCriteria('org_custom');

            expect(criteria.minTrustScore).toBe(750);
            expect(criteria.maxRecentFailures).toBe(0); // Default value preserved
        });
    });

    describe('updateCriteria', () => {
        it('should update global criteria', () => {
            service.updateCriteria({ minTrustScore: 750 });

            const criteria = service.getCriteria();

            expect(criteria.minTrustScore).toBe(750);
        });
    });

    describe('blockAction / unblockAction', () => {
        it('should block action globally', () => {
            service.blockAction('delete_all');

            const criteria = service.getCriteria();

            expect(criteria.blockedActions).toContain('delete_all');
        });

        it('should block action for specific org', () => {
            service.blockAction('dangerous', 'org_cautious');

            const orgCriteria = service.getOrgCriteria('org_cautious');
            const globalCriteria = service.getCriteria();

            expect(orgCriteria.blockedActions).toContain('dangerous');
            expect(globalCriteria.blockedActions).not.toContain('dangerous');
        });

        it('should unblock action', () => {
            service.blockAction('temp_blocked');
            service.unblockAction('temp_blocked');

            const criteria = service.getCriteria();

            expect(criteria.blockedActions).not.toContain('temp_blocked');
        });
    });

    // =========================================================================
    // Rate Limiting
    // =========================================================================

    describe('getRemainingApprovals', () => {
        it('should return max when no approvals yet', () => {
            const remaining = service.getRemainingApprovals('agent_1');
            expect(remaining).toBe(50); // Default max
        });

        it('should decrement with each approval', () => {
            const context = createHighTrustContext();

            const request1 = createRequest({ id: 'req_1' });
            const request2 = createRequest({ id: 'req_2' });
            service.tryAutoApprove(request1, context);
            service.tryAutoApprove(request2, context);

            const remaining = service.getRemainingApprovals('agent_1');

            expect(remaining).toBe(48);
        });
    });

    describe('approval rate limiting', () => {
        it('should reject when rate limit exceeded', () => {
            service.updateCriteria({ maxApprovalsPerHour: 2 });
            const context = createHighTrustContext();

            // Exhaust rate limit
            service.tryAutoApprove(createRequest({ id: 'req_1' }), context);
            service.tryAutoApprove(createRequest({ id: 'req_2' }), context);

            // Third should be rejected
            const record = service.tryAutoApprove(createRequest({ id: 'req_3' }), context);

            expect(record).toBeNull();
        });

        it('should emit rejection event when rate limited', () => {
            const rejectedHandler = vi.fn();
            service.on('approval:rejected', rejectedHandler);
            service.updateCriteria({ maxApprovalsPerHour: 1 });
            const context = createHighTrustContext();

            service.tryAutoApprove(createRequest({ id: 'req_1' }), context);
            service.tryAutoApprove(createRequest({ id: 'req_2' }), context);

            expect(rejectedHandler).toHaveBeenCalledTimes(1);
            expect(rejectedHandler.mock.calls[0][1]).toContain('rate limit');
        });
    });

    // =========================================================================
    // Lifecycle
    // =========================================================================

    describe('clear', () => {
        it('should clear all state', () => {
            const context = createHighTrustContext();
            service.tryAutoApprove(createRequest(), context);
            service.setOrgCriteria('org_1', { minTrustScore: 900 });

            service.clear();

            expect(service.size).toBe(0);
            const criteria = service.getOrgCriteria('org_1');
            expect(criteria.minTrustScore).toBe(800); // Back to default
        });
    });

    describe('size', () => {
        it('should return correct record count', () => {
            const context = createHighTrustContext();
            service.tryAutoApprove(createRequest({ id: 'req_1' }), context);
            service.tryAutoApprove(createRequest({ id: 'req_2' }), context);

            expect(service.size).toBe(2);
        });
    });

    // =========================================================================
    // Singleton
    // =========================================================================

    describe('singleton', () => {
        it('should return same instance', () => {
            resetAutoApprovalService();
            const instance1 = getAutoApprovalService();
            const instance2 = getAutoApprovalService();

            expect(instance1).toBe(instance2);
        });

        it('should reset properly', () => {
            const instance1 = getAutoApprovalService();
            const context = createHighTrustContext();
            instance1.tryAutoApprove(createRequest(), context);

            resetAutoApprovalService();
            const instance2 = getAutoApprovalService();

            expect(instance2.size).toBe(0);
        });
    });

    // =========================================================================
    // Record Pruning
    // =========================================================================

    describe('record pruning', () => {
        it('should prune old records when max exceeded', () => {
            const service = new AutoApprovalService({ maxRecords: 10 });
            const context = createHighTrustContext();

            // Create more than max records
            for (let i = 0; i < 15; i++) {
                service.tryAutoApprove(createRequest({ id: `req_${i}` }), context);
            }

            // Should have pruned oldest 10%
            expect(service.size).toBeLessThanOrEqual(14);
        });
    });
});
