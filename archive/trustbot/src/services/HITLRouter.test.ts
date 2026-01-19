/**
 * HITL Router Tests
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.4: HITL Routing Engine
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    HITLRouter,
    getHITLRouter,
    resetHITLRouter,
    type Reviewer,
    type HITLRequest,
} from './HITLRouter.js';
import type { ActionRequest, GateResult } from './TrustGateEngine.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createRequest(overrides: Partial<ActionRequest> = {}): ActionRequest {
    return {
        id: `req_${Date.now()}`,
        agentId: 'agent_1',
        orgId: 'org_1',
        actionType: 'critical_action',
        category: 'delegate',
        description: 'High risk action requiring HITL',
        urgency: 'normal',
        requestedAt: new Date(),
        ...overrides,
    };
}

function createGateResult(overrides: Partial<GateResult> = {}): GateResult {
    return {
        requestId: 'req_123',
        decision: 'hitl_required',
        riskLevel: 'high',
        reasons: ['Requires human review'],
        evaluatedAt: new Date(),
        rules: [],
        ...overrides,
    };
}

function createReviewer(id: string, role: 'operator' | 'supervisor' | 'director' | 'security_team', orgId = 'org_1'): Reviewer {
    return {
        id,
        name: `${role.charAt(0).toUpperCase() + role.slice(1)} ${id}`,
        role,
        email: `${id}@example.com`,
        orgId,
        isAvailable: true,
        currentLoad: 0,
        maxLoad: 10,
    };
}

function setupReviewers(router: HITLRouter, orgId = 'org_1'): void {
    router.registerReviewer(createReviewer('op1', 'operator', orgId));
    router.registerReviewer(createReviewer('op2', 'operator', orgId));
    router.registerReviewer(createReviewer('sup1', 'supervisor', orgId));
    router.registerReviewer(createReviewer('sup2', 'supervisor', orgId));
    router.registerReviewer(createReviewer('dir1', 'director', orgId));
    router.registerReviewer(createReviewer('sec1', 'security_team', orgId));
}

// ============================================================================
// Tests
// ============================================================================

describe('HITLRouter', () => {
    let router: HITLRouter;

    beforeEach(() => {
        vi.useFakeTimers();
        resetHITLRouter();
        router = new HITLRouter();
    });

    afterEach(() => {
        vi.useRealTimers();
        router.clear();
    });

    // =========================================================================
    // Request Routing
    // =========================================================================

    describe('routeToHuman', () => {
        it('should create HITL request', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });

            const hitlRequest = router.routeToHuman(request, gateResult, 'normal');

            expect(hitlRequest.id).toBeDefined();
            expect(hitlRequest.requestId).toBe(request.id);
            expect(hitlRequest.riskLevel).toBe('high');
            expect(hitlRequest.urgency).toBe('normal');
        });

        it('should assign reviewers based on risk level', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'high' });

            const hitlRequest = router.routeToHuman(request, gateResult);

            expect(hitlRequest.status).toBe('assigned');
            expect(hitlRequest.assignedTo).toBeDefined();
            expect(hitlRequest.assignedTo!.length).toBeGreaterThan(0);
        });

        it('should route low risk to operator', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });

            const hitlRequest = router.routeToHuman(request, gateResult);

            // Check assigned reviewer is an operator
            const reviewer = router.getReviewer(hitlRequest.assignedTo![0], 'org_1');
            expect(reviewer?.role).toBe('operator');
        });

        it('should route high risk to supervisor', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'high' });

            const hitlRequest = router.routeToHuman(request, gateResult);

            const reviewer = router.getReviewer(hitlRequest.assignedTo![0], 'org_1');
            expect(reviewer?.role).toBe('supervisor');
        });

        it('should route critical to director', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'critical' });

            const hitlRequest = router.routeToHuman(request, gateResult);

            const reviewer = router.getReviewer(hitlRequest.assignedTo![0], 'org_1');
            expect(reviewer?.role).toBe('director');
        });

        it('should require multiple approvers for critical', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'critical' });

            const hitlRequest = router.routeToHuman(request, gateResult);

            expect(hitlRequest.requiredApprovers).toBe(2);
        });

        it('should emit request:created event', () => {
            setupReviewers(router);
            const createdHandler = vi.fn();
            router.on('request:created', createdHandler);

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            router.routeToHuman(request, gateResult);

            expect(createdHandler).toHaveBeenCalled();
        });

        it('should emit request:assigned event', () => {
            setupReviewers(router);
            const assignedHandler = vi.fn();
            router.on('request:assigned', assignedHandler);

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            router.routeToHuman(request, gateResult);

            expect(assignedHandler).toHaveBeenCalled();
        });

        it('should emit notification:send for notify roles', () => {
            setupReviewers(router);
            const notifyHandler = vi.fn();
            router.on('notification:send', notifyHandler);

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'high' });
            router.routeToHuman(request, gateResult);

            expect(notifyHandler).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // Decision Submission
    // =========================================================================

    describe('submitDecision', () => {
        it('should accept approval from assigned reviewer', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            const hitlRequest = router.routeToHuman(request, gateResult);

            const result = router.submitDecision(
                hitlRequest.id,
                hitlRequest.assignedTo![0],
                'approved',
                'Looks good'
            );

            expect(result).toBe(true);
            expect(hitlRequest.approvals.length).toBe(1);
            expect(hitlRequest.status).toBe('decided');
            expect(hitlRequest.decision).toBe('approved');
        });

        it('should accept denial and immediately complete', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            const hitlRequest = router.routeToHuman(request, gateResult);

            router.submitDecision(
                hitlRequest.id,
                hitlRequest.assignedTo![0],
                'denied',
                'Too risky'
            );

            expect(hitlRequest.status).toBe('decided');
            expect(hitlRequest.decision).toBe('denied');
        });

        it('should reject decision from non-assigned reviewer', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            const hitlRequest = router.routeToHuman(request, gateResult);

            const result = router.submitDecision(
                hitlRequest.id,
                'unknown_reviewer',
                'approved',
                'Looks good'
            );

            expect(result).toBe(false);
        });

        it('should reject duplicate decision from same reviewer', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            const hitlRequest = router.routeToHuman(request, gateResult);
            const reviewerId = hitlRequest.assignedTo![0];

            router.submitDecision(hitlRequest.id, reviewerId, 'approved', 'First');
            const result = router.submitDecision(hitlRequest.id, reviewerId, 'denied', 'Second');

            expect(result).toBe(false);
        });

        it('should emit request:approved event', () => {
            setupReviewers(router);
            const approvedHandler = vi.fn();
            router.on('request:approved', approvedHandler);

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            const hitlRequest = router.routeToHuman(request, gateResult);

            router.submitDecision(hitlRequest.id, hitlRequest.assignedTo![0], 'approved', 'OK');

            expect(approvedHandler).toHaveBeenCalled();
        });

        it('should emit request:denied event', () => {
            setupReviewers(router);
            const deniedHandler = vi.fn();
            router.on('request:denied', deniedHandler);

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            const hitlRequest = router.routeToHuman(request, gateResult);

            router.submitDecision(hitlRequest.id, hitlRequest.assignedTo![0], 'denied', 'No');

            expect(deniedHandler).toHaveBeenCalled();
        });

        it('should emit request:decided event when complete', () => {
            setupReviewers(router);
            const decidedHandler = vi.fn();
            router.on('request:decided', decidedHandler);

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            const hitlRequest = router.routeToHuman(request, gateResult);

            router.submitDecision(hitlRequest.id, hitlRequest.assignedTo![0], 'approved', 'OK');

            expect(decidedHandler).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // Escalation
    // =========================================================================

    describe('escalate', () => {
        it('should escalate request to next level', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            const hitlRequest = router.routeToHuman(request, gateResult);

            const result = router.escalate(hitlRequest.id, 'Needs supervisor review');

            expect(result).toBe(true);
            expect(hitlRequest.escalationLevel).toBe(1);
            expect(hitlRequest.status).toBe('escalated');
        });

        it('should add new reviewers on escalation', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            const hitlRequest = router.routeToHuman(request, gateResult);

            const originalAssigned = hitlRequest.assignedTo!.length;
            router.escalate(hitlRequest.id);

            expect(hitlRequest.assignedTo!.length).toBeGreaterThan(originalAssigned);
        });

        it('should emit request:escalated event', () => {
            setupReviewers(router);
            const escalatedHandler = vi.fn();
            router.on('request:escalated', escalatedHandler);

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            const hitlRequest = router.routeToHuman(request, gateResult);

            router.escalate(hitlRequest.id);

            expect(escalatedHandler).toHaveBeenCalled();
        });

        it('should not escalate beyond max level', () => {
            setupReviewers(router);
            router.updateConfig({ maxEscalationLevel: 2 });

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            const hitlRequest = router.routeToHuman(request, gateResult);

            router.escalate(hitlRequest.id);
            router.escalate(hitlRequest.id);
            const result = router.escalate(hitlRequest.id);

            expect(result).toBe(false);
            expect(hitlRequest.escalationLevel).toBe(2);
        });

        it('should not escalate decided requests', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            const hitlRequest = router.routeToHuman(request, gateResult);

            router.submitDecision(hitlRequest.id, hitlRequest.assignedTo![0], 'approved', 'OK');
            const result = router.escalate(hitlRequest.id);

            expect(result).toBe(false);
        });
    });

    // =========================================================================
    // Timeout
    // =========================================================================

    describe('request timeout', () => {
        it('should expire request after timeout', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            const hitlRequest = router.routeToHuman(request, gateResult);

            // Fast-forward past timeout (low risk = 60 minutes)
            vi.advanceTimersByTime(61 * 60 * 1000);

            expect(hitlRequest.status).toBe('expired');
        });

        it('should emit request:expired event', () => {
            setupReviewers(router);
            const expiredHandler = vi.fn();
            router.on('request:expired', expiredHandler);

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            router.routeToHuman(request, gateResult);

            vi.advanceTimersByTime(61 * 60 * 1000);

            expect(expiredHandler).toHaveBeenCalled();
        });

        it('should auto-escalate before expiration if configured', () => {
            setupReviewers(router);
            router.updateConfig({ autoEscalate: true });

            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'high' });
            const hitlRequest = router.routeToHuman(request, gateResult);

            // High risk has autoEscalateAfter: 10 minutes
            vi.advanceTimersByTime(11 * 60 * 1000);

            expect(hitlRequest.escalationLevel).toBe(1);
        });
    });

    // =========================================================================
    // Reviewer Management
    // =========================================================================

    describe('registerReviewer', () => {
        it('should register reviewer', () => {
            const reviewer = createReviewer('test1', 'operator');
            router.registerReviewer(reviewer);

            const retrieved = router.getReviewer('test1', 'org_1');
            expect(retrieved).not.toBeNull();
            expect(retrieved?.name).toBe('Operator test1');
        });
    });

    describe('unregisterReviewer', () => {
        it('should unregister reviewer', () => {
            const reviewer = createReviewer('test1', 'operator');
            router.registerReviewer(reviewer);
            router.unregisterReviewer('test1', 'org_1');

            const retrieved = router.getReviewer('test1', 'org_1');
            expect(retrieved).toBeNull();
        });
    });

    describe('getReviewersByRole', () => {
        it('should return reviewers by role', () => {
            setupReviewers(router);

            const operators = router.getReviewersByRole('operator', 'org_1');

            expect(operators.length).toBe(2);
            expect(operators.every(r => r.role === 'operator')).toBe(true);
        });
    });

    describe('getAvailableReviewers', () => {
        it('should return only available reviewers', () => {
            setupReviewers(router);
            router.setReviewerAvailability('op1', 'org_1', false);

            const available = router.getAvailableReviewers('operator', 'org_1');

            expect(available.length).toBe(1);
            expect(available[0].id).toBe('op2');
        });

        it('should exclude overloaded reviewers', () => {
            setupReviewers(router);
            const reviewer = router.getReviewer('op1', 'org_1')!;
            reviewer.currentLoad = reviewer.maxLoad;

            const available = router.getAvailableReviewers('operator', 'org_1');

            expect(available.some(r => r.id === 'op1')).toBe(false);
        });
    });

    describe('setReviewerAvailability', () => {
        it('should update reviewer availability', () => {
            setupReviewers(router);

            router.setReviewerAvailability('op1', 'org_1', false);

            const reviewer = router.getReviewer('op1', 'org_1');
            expect(reviewer?.isAvailable).toBe(false);
        });
    });

    // =========================================================================
    // Request Management
    // =========================================================================

    describe('getRequest', () => {
        it('should return request by ID', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            const hitlRequest = router.routeToHuman(request, gateResult);

            const retrieved = router.getRequest(hitlRequest.id);

            expect(retrieved?.id).toBe(hitlRequest.id);
        });

        it('should return null for unknown ID', () => {
            const result = router.getRequest('unknown');
            expect(result).toBeNull();
        });
    });

    describe('getRequestByRequestId', () => {
        it('should return request by original request ID', () => {
            setupReviewers(router);
            const request = createRequest({ id: 'original_123' });
            const gateResult = createGateResult({ requestId: request.id });
            router.routeToHuman(request, gateResult);

            const retrieved = router.getRequestByRequestId('original_123');

            expect(retrieved?.requestId).toBe('original_123');
        });
    });

    describe('getReviewerQueue', () => {
        it('should return pending requests for reviewer', () => {
            // Disable load balancing so both go to same reviewer
            router.updateConfig({ loadBalance: false });
            setupReviewers(router);

            const request1 = createRequest({ id: 'req_1' });
            const gateResult1 = createGateResult({ requestId: request1.id, riskLevel: 'low' });
            router.routeToHuman(request1, gateResult1);

            const request2 = createRequest({ id: 'req_2' });
            const gateResult2 = createGateResult({ requestId: request2.id, riskLevel: 'low' });
            router.routeToHuman(request2, gateResult2);

            // With load balancing disabled, check any operator's queue
            const allPending = router.getPendingRequests();
            expect(allPending.length).toBe(2);

            // Get the queue for the assigned reviewer
            const assignedReviewer = allPending[0].assignedTo![0];
            const queue = router.getReviewerQueue(assignedReviewer);
            expect(queue.length).toBe(2);
        });

        it('should sort by urgency then creation time', () => {
            // Disable load balancing so both go to same reviewer
            router.updateConfig({ loadBalance: false });
            setupReviewers(router);

            const request1 = createRequest({ id: 'req_1' });
            const gateResult1 = createGateResult({ requestId: request1.id, riskLevel: 'low' });
            router.routeToHuman(request1, gateResult1, 'low');

            const request2 = createRequest({ id: 'req_2' });
            const gateResult2 = createGateResult({ requestId: request2.id, riskLevel: 'low' });
            router.routeToHuman(request2, gateResult2, 'high');

            // Get the queue for the assigned reviewer
            const allPending = router.getPendingRequests();
            const assignedReviewer = allPending[0].assignedTo![0];
            const queue = router.getReviewerQueue(assignedReviewer);

            expect(queue.length).toBe(2);
            expect(queue[0].urgency).toBe('high');
            expect(queue[1].urgency).toBe('low');
        });
    });

    describe('getPendingRequests', () => {
        it('should return all pending requests', () => {
            setupReviewers(router);

            const request1 = createRequest({ id: 'req_1' });
            const gateResult1 = createGateResult({ requestId: request1.id, riskLevel: 'low' });
            router.routeToHuman(request1, gateResult1);

            const request2 = createRequest({ id: 'req_2' });
            const gateResult2 = createGateResult({ requestId: request2.id, riskLevel: 'low' });
            const hitl2 = router.routeToHuman(request2, gateResult2);

            // Complete one
            router.submitDecision(hitl2.id, hitl2.assignedTo![0], 'approved', 'OK');

            const pending = router.getPendingRequests();

            expect(pending.length).toBe(1);
        });

        it('should filter by org', () => {
            setupReviewers(router);
            setupReviewers(router, 'org_2');

            const request1 = createRequest({ id: 'req_1', orgId: 'org_1' });
            const gateResult1 = createGateResult({ requestId: request1.id, riskLevel: 'low' });
            router.routeToHuman(request1, gateResult1);

            const request2 = createRequest({ id: 'req_2', orgId: 'org_2' });
            const gateResult2 = createGateResult({ requestId: request2.id, riskLevel: 'low' });
            router.routeToHuman(request2, gateResult2);

            const pending = router.getPendingRequests('org_1');

            expect(pending.length).toBe(1);
            expect(pending[0].request.orgId).toBe('org_1');
        });
    });

    // =========================================================================
    // Routing Rules
    // =========================================================================

    describe('addRoutingRule', () => {
        it('should add custom routing rule', () => {
            router.addRoutingRule({
                riskLevel: 'medium',
                urgency: 'immediate',
                routeTo: ['director'],
                requiredApprovers: 2,
                timeoutMinutes: 5,
            });

            const rules = router.getRoutingRules();
            const customRule = rules.find(
                r => r.riskLevel === 'medium' && r.urgency === 'immediate'
            );

            expect(customRule).toBeDefined();
            expect(customRule?.routeTo).toContain('director');
        });
    });

    describe('findRoutingRule', () => {
        it('should find exact match first', () => {
            const rule = router.findRoutingRule('medium', 'high');

            expect(rule).not.toBeNull();
            expect(rule?.urgency).toBe('high');
        });

        it('should fall back to risk level only', () => {
            const rule = router.findRoutingRule('high');

            expect(rule).not.toBeNull();
            expect(rule?.riskLevel).toBe('high');
        });
    });

    // =========================================================================
    // Configuration
    // =========================================================================

    describe('configuration', () => {
        it('should update config', () => {
            router.updateConfig({ defaultTimeoutMinutes: 60 });

            const config = router.getConfig();

            expect(config.defaultTimeoutMinutes).toBe(60);
        });
    });

    // =========================================================================
    // Statistics
    // =========================================================================

    describe('getStats', () => {
        it('should return correct statistics', () => {
            setupReviewers(router);

            // Create and complete some requests
            const request1 = createRequest({ id: 'req_1' });
            const gateResult1 = createGateResult({ requestId: request1.id, riskLevel: 'low' });
            const hitl1 = router.routeToHuman(request1, gateResult1);
            router.submitDecision(hitl1.id, hitl1.assignedTo![0], 'approved', 'OK');

            const request2 = createRequest({ id: 'req_2' });
            const gateResult2 = createGateResult({ requestId: request2.id, riskLevel: 'low' });
            const hitl2 = router.routeToHuman(request2, gateResult2);
            router.submitDecision(hitl2.id, hitl2.assignedTo![0], 'denied', 'No');

            const request3 = createRequest({ id: 'req_3' });
            const gateResult3 = createGateResult({ requestId: request3.id, riskLevel: 'low' });
            router.routeToHuman(request3, gateResult3);

            const stats = router.getStats();

            expect(stats.totalRequests).toBe(3);
            expect(stats.decidedRequests).toBe(2);
            expect(stats.pendingRequests).toBe(1);
            expect(stats.approvalRate).toBe(0.5);
        });
    });

    // =========================================================================
    // Load Balancing
    // =========================================================================

    describe('load balancing', () => {
        it('should distribute load across reviewers', () => {
            setupReviewers(router);

            // Create multiple requests
            for (let i = 0; i < 4; i++) {
                const request = createRequest({ id: `req_${i}` });
                const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
                router.routeToHuman(request, gateResult);
            }

            const op1 = router.getReviewer('op1', 'org_1');
            const op2 = router.getReviewer('op2', 'org_1');

            // Should be distributed between operators
            expect(op1!.currentLoad).toBeGreaterThan(0);
            expect(op2!.currentLoad).toBeGreaterThan(0);
        });

        it('should decrease load when request is decided', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id, riskLevel: 'low' });
            const hitlRequest = router.routeToHuman(request, gateResult);

            const reviewerId = hitlRequest.assignedTo![0];
            const reviewer = router.getReviewer(reviewerId, 'org_1');
            const loadBefore = reviewer!.currentLoad;

            router.submitDecision(hitlRequest.id, reviewerId, 'approved', 'OK');

            expect(reviewer!.currentLoad).toBe(loadBefore - 1);
        });
    });

    // =========================================================================
    // Lifecycle
    // =========================================================================

    describe('clear', () => {
        it('should clear all state', () => {
            setupReviewers(router);
            const request = createRequest();
            const gateResult = createGateResult({ requestId: request.id });
            router.routeToHuman(request, gateResult);

            router.clear();

            expect(router.requestCount).toBe(0);
        });
    });

    // =========================================================================
    // Singleton
    // =========================================================================

    describe('singleton', () => {
        it('should return same instance', () => {
            resetHITLRouter();
            const instance1 = getHITLRouter();
            const instance2 = getHITLRouter();

            expect(instance1).toBe(instance2);
        });

        it('should reset properly', () => {
            const instance1 = getHITLRouter();
            setupReviewers(instance1);

            resetHITLRouter();
            const instance2 = getHITLRouter();

            expect(instance2.getReviewersByRole('operator', 'org_1').length).toBe(0);
        });
    });
});
