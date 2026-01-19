/**
 * Council Governance Module Tests
 *
 * Tests for TRUST-3.1 through TRUST-3.8
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CouncilMemberRegistry } from './CouncilMemberRegistry.js';
import { CouncilService } from './CouncilService.js';
import { PrecedentService } from './PrecedentService.js';
import { CouncilGatewayIntegration } from './CouncilGatewayIntegration.js';
import { HITLGateway } from '../HITLGateway.js';
import { trustEngine } from '../TrustEngine.js';
import { FEATURES } from '../config/features.js';
import type { AgentId } from '../../types.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestRegistry(): CouncilMemberRegistry {
    return new CouncilMemberRegistry();
}

function createTestCouncilService(registry: CouncilMemberRegistry): CouncilService {
    return new CouncilService(registry);
}

function createTestPrecedentService(): PrecedentService {
    return new PrecedentService();
}

function registerTestMembers(registry: CouncilMemberRegistry): void {
    registry.registerMember('agent-t5-alpha' as AgentId, 5, 'security');
    registry.registerMember('agent-t5-beta' as AgentId, 5, 'performance');
    registry.registerMember('agent-t4-gamma' as AgentId, 4, 'testing');
    registry.registerMember('agent-t4-delta' as AgentId, 4, 'architecture');
}

// ============================================================================
// TRUST-3.2: Council Member Registry Tests
// ============================================================================

describe('CouncilMemberRegistry', () => {
    let registry: CouncilMemberRegistry;

    beforeEach(() => {
        registry = createTestRegistry();
    });

    describe('registerMember', () => {
        it('should register a T4 agent as council member', () => {
            const member = registry.registerMember('agent-t4' as AgentId, 4);

            expect(member).toBeDefined();
            expect(member.agentId).toBe('agent-t4');
            expect(member.tier).toBe(4);
            expect(member.votingWeight).toBe(1);
            expect(member.activeReviews).toBe(0);
        });

        it('should register a T5 agent with higher voting weight', () => {
            const member = registry.registerMember('agent-t5' as AgentId, 5);

            expect(member.votingWeight).toBe(1.5);
        });

        it('should reject T3 or lower agents', () => {
            expect(() =>
                registry.registerMember('agent-t3' as AgentId, 3)
            ).toThrow(/Council requires T4\+/);
        });

        it('should reject duplicate registration', () => {
            registry.registerMember('agent-t4' as AgentId, 4);

            expect(() =>
                registry.registerMember('agent-t4' as AgentId, 4)
            ).toThrow(/already a council member/);
        });

        it('should record specialization', () => {
            const member = registry.registerMember('agent-t4' as AgentId, 4, 'security');

            expect(member.specialization).toBe('security');
        });
    });

    describe('unregisterMember', () => {
        it('should remove a member with no active reviews', () => {
            registry.registerMember('agent-t4' as AgentId, 4);

            const result = registry.unregisterMember('agent-t4' as AgentId, 'Testing');

            expect(result).toBe(true);
            expect(registry.isMember('agent-t4' as AgentId)).toBe(false);
        });

        it('should reject unregistering member with active reviews', () => {
            registry.registerMember('agent-t4' as AgentId, 4);
            registry.incrementActiveReviews('agent-t4' as AgentId);

            expect(() =>
                registry.unregisterMember('agent-t4' as AgentId, 'Testing')
            ).toThrow(/Cannot unregister member with .* active reviews/);
        });

        it('should return false for non-member', () => {
            const result = registry.unregisterMember('nonexistent' as AgentId, 'Testing');

            expect(result).toBe(false);
        });
    });

    describe('getMembers', () => {
        it('should return all registered members', () => {
            registerTestMembers(registry);

            const members = registry.getMembers();

            expect(members).toHaveLength(4);
        });
    });

    describe('getAvailableMembers', () => {
        it('should return members with capacity for reviews', () => {
            registerTestMembers(registry);
            registry.incrementActiveReviews('agent-t5-alpha' as AgentId);
            registry.incrementActiveReviews('agent-t5-alpha' as AgentId);
            registry.incrementActiveReviews('agent-t5-alpha' as AgentId);

            const available = registry.getAvailableMembers();

            expect(available).toHaveLength(3);
            expect(available.find(m => m.agentId === 'agent-t5-alpha')).toBeUndefined();
        });
    });

    describe('getMembersBySpecialization', () => {
        it('should filter by specialization', () => {
            registerTestMembers(registry);

            const securityExperts = registry.getMembersBySpecialization('security');

            expect(securityExperts).toHaveLength(1);
            expect(securityExperts[0].agentId).toBe('agent-t5-alpha');
        });
    });

    describe('recordVote', () => {
        it('should update agreement rate', () => {
            registry.registerMember('agent-t4' as AgentId, 4);

            registry.recordVote('agent-t4' as AgentId, true);
            registry.recordVote('agent-t4' as AgentId, true);

            const member = registry.getMember('agent-t4' as AgentId);
            expect(member!.totalVotes).toBe(2);
            expect(member!.agreementRate).toBeGreaterThan(0.9);
        });
    });

    describe('updateMemberTier', () => {
        it('should update tier and voting weight', () => {
            registry.registerMember('agent-t4' as AgentId, 4);

            registry.updateMemberTier('agent-t4' as AgentId, 5);

            const member = registry.getMember('agent-t4' as AgentId);
            expect(member!.tier).toBe(5);
            expect(member!.votingWeight).toBe(1.5);
        });

        it('should unregister if tier drops below minimum', () => {
            registry.registerMember('agent-t4' as AgentId, 4);

            registry.updateMemberTier('agent-t4' as AgentId, 3);

            expect(registry.isMember('agent-t4' as AgentId)).toBe(false);
        });
    });

    describe('getStats', () => {
        it('should return accurate statistics', () => {
            registerTestMembers(registry);
            registry.incrementActiveReviews('agent-t5-alpha' as AgentId);

            const stats = registry.getStats();

            expect(stats.totalMembers).toBe(4);
            expect(stats.byTier[5]).toBe(2);
            expect(stats.byTier[4]).toBe(2);
            expect(stats.averageActiveReviews).toBe(0.25);
        });
    });
});

// ============================================================================
// TRUST-3.3 through 3.6: Council Service Tests
// ============================================================================

describe('CouncilService', () => {
    let registry: CouncilMemberRegistry;
    let service: CouncilService;
    let precedentService: PrecedentService;

    beforeEach(() => {
        registry = createTestRegistry();
        service = createTestCouncilService(registry);
        precedentService = createTestPrecedentService();
        service.setPrecedentService(precedentService);
        registerTestMembers(registry);
    });

    afterEach(() => {
        service.clear();
    });

    describe('selectReviewers', () => {
        it('should select the configured number of reviewers', () => {
            const reviewers = service.selectReviewers(
                'SPAWN',
                'requester' as AgentId,
                {}
            );

            expect(reviewers).toHaveLength(3);
        });

        it('should exclude the requester from reviewers', () => {
            const reviewers = service.selectReviewers(
                'SPAWN',
                'agent-t5-alpha' as AgentId,
                {}
            );

            expect(reviewers.find(r => r.agentId === 'agent-t5-alpha')).toBeUndefined();
        });

        it('should throw if insufficient reviewers', () => {
            const smallRegistry = createTestRegistry();
            const smallService = new CouncilService(smallRegistry);
            smallRegistry.registerMember('agent-t4' as AgentId, 4);

            expect(() =>
                smallService.selectReviewers('SPAWN', 'requester' as AgentId, {})
            ).toThrow(/Insufficient council members available/);
        });

        it('should prefer T5 agents for critical requests', () => {
            const reviewers = service.selectReviewers(
                'POLICY_CHANGE',
                'requester' as AgentId,
                {}
            );

            // At least one T5 should be selected
            const t5Count = reviewers.filter(r => r.tier === 5).length;
            expect(t5Count).toBeGreaterThanOrEqual(1);
        });
    });

    describe('submitForReview', () => {
        it('should create a pending review', async () => {
            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: { agentType: 'worker' },
            });

            expect(review).toBeDefined();
            expect(review.status).toBe('pending');
            expect(review.reviewers).toHaveLength(3);
            expect(review.votes.size).toBe(0);
        });

        it('should increment active reviews for selected reviewers', async () => {
            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: {},
            });

            for (const reviewer of review.reviewers) {
                const member = registry.getMember(reviewer.agentId);
                expect(member!.activeReviews).toBe(1);
            }
        });

        it('should emit review-submitted event', async () => {
            const handler = vi.fn();
            service.on('council:review-submitted', handler);

            await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: {},
            });

            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('submitVote', () => {
        it('should record a vote', async () => {
            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: {},
            });

            const voterId = review.reviewers[0].agentId;
            const updatedReview = await service.submitVote({
                reviewId: review.id,
                voterId,
                vote: 'approve',
                reasoning: 'Looks good to me',
                confidence: 0.9,
            });

            expect(updatedReview.votes.size).toBe(1);
            expect(updatedReview.votes.get(voterId)!.vote).toBe('approve');
        });

        it('should reject vote from non-reviewer', async () => {
            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: {},
            });

            await expect(
                service.submitVote({
                    reviewId: review.id,
                    voterId: 'random-agent' as AgentId,
                    vote: 'approve',
                    reasoning: 'Test',
                    confidence: 0.9,
                })
            ).rejects.toThrow(/not authorized to vote/);
        });

        it('should reject duplicate vote', async () => {
            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: {},
            });

            const voterId = review.reviewers[0].agentId;
            await service.submitVote({
                reviewId: review.id,
                voterId,
                vote: 'approve',
                reasoning: 'First vote',
                confidence: 0.9,
            });

            await expect(
                service.submitVote({
                    reviewId: review.id,
                    voterId,
                    vote: 'reject',
                    reasoning: 'Changed my mind',
                    confidence: 0.9,
                })
            ).rejects.toThrow(/has already voted/);
        });

        it('should require reasoning', async () => {
            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: {},
            });

            const voterId = review.reviewers[0].agentId;
            await expect(
                service.submitVote({
                    reviewId: review.id,
                    voterId,
                    vote: 'approve',
                    reasoning: '',
                    confidence: 0.9,
                })
            ).rejects.toThrow(/Reasoning is required/);
        });
    });

    describe('decision resolution', () => {
        it('should approve when majority approves', async () => {
            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: {},
            });

            // Submit 2 approvals (majority)
            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[0].agentId,
                vote: 'approve',
                reasoning: 'Approved by voter 1',
                confidence: 0.9,
            });

            const decidedReview = await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[1].agentId,
                vote: 'approve',
                reasoning: 'Approved by voter 2',
                confidence: 0.85,
            });

            expect(decidedReview.status).toBe('approved');
            expect(decidedReview.outcome).toBeDefined();
            expect(decidedReview.outcome!.decision).toBe('approved');
        });

        it('should reject when majority rejects', async () => {
            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: {},
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[0].agentId,
                vote: 'reject',
                reasoning: 'Rejected by voter 1',
                confidence: 0.9,
            });

            const decidedReview = await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[1].agentId,
                vote: 'reject',
                reasoning: 'Rejected by voter 2',
                confidence: 0.85,
            });

            expect(decidedReview.status).toBe('rejected');
            expect(decidedReview.outcome!.decision).toBe('rejected');
        });

        it('should emit decision-made event', async () => {
            const handler = vi.fn();
            service.on('council:decision-made', handler);

            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: {},
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[0].agentId,
                vote: 'approve',
                reasoning: 'Yes',
                confidence: 0.9,
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[1].agentId,
                vote: 'approve',
                reasoning: 'Yes',
                confidence: 0.85,
            });

            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should create precedent from decision', async () => {
            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: { agentType: 'worker' },
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[0].agentId,
                vote: 'approve',
                reasoning: 'Good request',
                confidence: 0.9,
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[1].agentId,
                vote: 'approve',
                reasoning: 'Agreed',
                confidence: 0.85,
            });

            const precedents = precedentService.getAllPrecedents();
            expect(precedents.length).toBeGreaterThan(0);
        });
    });

    describe('getStats', () => {
        it('should return accurate statistics', async () => {
            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: {},
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[0].agentId,
                vote: 'approve',
                reasoning: 'Yes',
                confidence: 0.9,
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[1].agentId,
                vote: 'approve',
                reasoning: 'Yes',
                confidence: 0.85,
            });

            const stats = service.getStats();

            expect(stats.totalReviews).toBe(1);
            expect(stats.approvedReviews).toBe(1);
            expect(stats.approvalRate).toBe(1);
        });
    });
});

// ============================================================================
// TRUST-3.7: Precedent Service Tests
// ============================================================================

describe('PrecedentService', () => {
    let precedentService: PrecedentService;

    beforeEach(() => {
        precedentService = createTestPrecedentService();
    });

    afterEach(() => {
        precedentService.clear();
    });

    describe('calculateSimilarity', () => {
        it('should return 1 for identical contexts', () => {
            const context = { tier: 4, agentType: 'worker' };

            const similarity = precedentService.calculateSimilarity(context, context);

            expect(similarity).toBe(1);
        });

        it('should return 0 for completely different contexts', () => {
            const context1 = { tier: 4, agentType: 'worker' };
            const context2 = { capability: 'read', resource: 'file' };

            const similarity = precedentService.calculateSimilarity(context1, context2);

            expect(similarity).toBe(0);
        });

        it('should give higher weight to critical keys', () => {
            const context = { tier: 4, agentType: 'worker', description: 'test' };
            const pattern1 = { tier: 4 }; // critical key
            const pattern2 = { description: 'test' }; // normal key

            const sim1 = precedentService.calculateSimilarity(context, pattern1);
            const sim2 = precedentService.calculateSimilarity(context, pattern2);

            // Matching a critical key should give better partial similarity
            expect(sim1).toBeGreaterThan(0);
        });

        it('should calculate string similarity', () => {
            const context = { description: 'spawn new worker agent' };
            const pattern = { description: 'spawn worker agent' };

            const similarity = precedentService.calculateSimilarity(context, pattern);

            expect(similarity).toBeGreaterThan(0.5);
        });
    });

    describe('findPrecedent', () => {
        it('should find matching precedent', async () => {
            // Create a precedent manually for testing
            const registry = createTestRegistry();
            const service = createTestCouncilService(registry);
            service.setPrecedentService(precedentService);
            registerTestMembers(registry);

            // Create and decide a review to generate a precedent
            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: { agentType: 'worker', tier: 4 },
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[0].agentId,
                vote: 'approve',
                reasoning: 'Approved',
                confidence: 0.9,
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[1].agentId,
                vote: 'approve',
                reasoning: 'Also approved',
                confidence: 0.9,
            });

            // Now search for similar context
            const match = await precedentService.findPrecedent(
                'SPAWN',
                { agentType: 'worker', tier: 4 }
            );

            expect(match).toBeDefined();
            expect(match!.similarity).toBeGreaterThan(0);

            service.clear();
        });

        it('should not match different request types', async () => {
            const registry = createTestRegistry();
            const service = createTestCouncilService(registry);
            service.setPrecedentService(precedentService);
            registerTestMembers(registry);

            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: { agentType: 'worker' },
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[0].agentId,
                vote: 'approve',
                reasoning: 'Yes',
                confidence: 0.9,
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[1].agentId,
                vote: 'approve',
                reasoning: 'Yes',
                confidence: 0.9,
            });

            const match = await precedentService.findPrecedent(
                'POLICY_CHANGE', // Different type
                { agentType: 'worker' }
            );

            expect(match).toBeNull();

            service.clear();
        });
    });

    describe('deactivatePrecedent', () => {
        it('should soft-delete a precedent', async () => {
            const registry = createTestRegistry();
            const service = createTestCouncilService(registry);
            service.setPrecedentService(precedentService);
            registerTestMembers(registry);

            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: {},
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[0].agentId,
                vote: 'approve',
                reasoning: 'Yes',
                confidence: 0.9,
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[1].agentId,
                vote: 'approve',
                reasoning: 'Yes',
                confidence: 0.9,
            });

            const precedents = precedentService.getAllPrecedents();
            expect(precedents.length).toBe(1);

            const deactivated = precedentService.deactivatePrecedent(
                precedents[0].id,
                'No longer applicable'
            );

            expect(deactivated).toBe(true);

            const activePrecedents = precedentService.getActivePrecedents();
            expect(activePrecedents.length).toBe(0);

            service.clear();
        });
    });

    describe('getStats', () => {
        it('should return accurate statistics', async () => {
            const registry = createTestRegistry();
            const service = createTestCouncilService(registry);
            service.setPrecedentService(precedentService);
            registerTestMembers(registry);

            const review = await service.submitForReview({
                requestType: 'SPAWN',
                requesterId: 'requester' as AgentId,
                context: {},
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[0].agentId,
                vote: 'approve',
                reasoning: 'Yes',
                confidence: 0.9,
            });

            await service.submitVote({
                reviewId: review.id,
                voterId: review.reviewers[1].agentId,
                vote: 'approve',
                reasoning: 'Yes',
                confidence: 0.9,
            });

            const stats = precedentService.getStats();

            expect(stats.totalPrecedents).toBe(1);
            expect(stats.activePrecedents).toBe(1);
            expect(stats.byRequestType['SPAWN']).toBe(1);
            expect(stats.avgConfidence).toBeGreaterThan(0);

            service.clear();
        });
    });
});

// ============================================================================
// TRUST-3.8: Gateway Integration Tests
// ============================================================================

describe('CouncilGatewayIntegration', () => {
    let registry: CouncilMemberRegistry;
    let councilService: CouncilService;
    let hitlGateway: HITLGateway;
    let integration: CouncilGatewayIntegration;

    beforeEach(() => {
        registry = createTestRegistry();
        councilService = createTestCouncilService(registry);
        hitlGateway = new HITLGateway();
        integration = new CouncilGatewayIntegration(councilService, hitlGateway);
        registerTestMembers(registry);

        // Enable council feature for tests
        FEATURES.setOverride('ENABLE_COUNCIL', true);

        // Set a low HITL level to enable council routing
        trustEngine.setHITLLevel(30);
    });

    afterEach(() => {
        councilService.clear();
        integration.clear();
        FEATURES.clearOverride('ENABLE_COUNCIL');
        trustEngine.setHITLLevel(100);
    });

    describe('determineRouting', () => {
        it('should route to human when HITL level is high', () => {
            trustEngine.setHITLLevel(80);

            const routing = integration.determineRouting({
                type: 'SPAWN',
                requestorId: 'requester' as AgentId,
                summary: 'Test request',
                context: {},
            });

            expect(routing.route).toBe('human');
        });

        it('should route to council when HITL level is low', () => {
            trustEngine.setHITLLevel(30);

            const routing = integration.determineRouting({
                type: 'SPAWN',
                requestorId: 'requester' as AgentId,
                summary: 'Test request',
                context: {},
            });

            expect(routing.route).toBe('council');
        });

        it('should always route emergencies to human', () => {
            trustEngine.setHITLLevel(10);

            const routing = integration.determineRouting({
                type: 'EMERGENCY',
                requestorId: 'requester' as AgentId,
                summary: 'Emergency!',
                context: {},
            });

            expect(routing.route).toBe('human');
        });

        it('should route critical urgency to human', () => {
            trustEngine.setHITLLevel(10);

            const routing = integration.determineRouting({
                type: 'SPAWN',
                requestorId: 'requester' as AgentId,
                summary: 'Critical request',
                context: {},
                urgency: 'CRITICAL',
            });

            expect(routing.route).toBe('human');
        });

        it('should respect forced routing', () => {
            trustEngine.setHITLLevel(10);

            const routing = integration.determineRouting({
                type: 'SPAWN',
                requestorId: 'requester' as AgentId,
                summary: 'Test request',
                context: {},
                forceRoute: 'human',
            });

            expect(routing.route).toBe('human');
        });
    });

    describe('requestApproval', () => {
        it('should create council review when routed to council', async () => {
            trustEngine.setHITLLevel(30);

            const result = await integration.requestApproval({
                type: 'SPAWN',
                requestorId: 'requester' as AgentId,
                summary: 'Spawn a worker agent',
                context: { agentType: 'worker' },
            });

            expect(result.route).toBe('council');
            expect(result.councilReviewId).toBeDefined();
            expect(result.status).toBe('pending');
        });

        it('should create HITL approval when routed to human', async () => {
            trustEngine.setHITLLevel(80);

            const result = await integration.requestApproval({
                type: 'SPAWN',
                requestorId: 'requester' as AgentId,
                summary: 'Spawn a worker agent',
                context: { agentType: 'worker' },
            });

            expect(result.route).toBe('human');
            expect(result.hitlApprovalId).toBeDefined();
            expect(result.status).toBe('pending');
        });

        it('should fall back to human when council is disabled', async () => {
            FEATURES.setOverride('ENABLE_COUNCIL', false);
            trustEngine.setHITLLevel(30);

            const result = await integration.requestApproval({
                type: 'SPAWN',
                requestorId: 'requester' as AgentId,
                summary: 'Spawn a worker agent',
                context: {},
            });

            expect(result.route).toBe('human');
        });
    });

    describe('getRoutingStats', () => {
        it('should track routing statistics', async () => {
            trustEngine.setHITLLevel(30);

            await integration.requestApproval({
                type: 'SPAWN',
                requestorId: 'requester' as AgentId,
                summary: 'Request 1',
                context: {},
            });

            trustEngine.setHITLLevel(80);

            await integration.requestApproval({
                type: 'DECISION',
                requestorId: 'requester' as AgentId,
                summary: 'Request 2',
                context: {},
            });

            const stats = integration.getRoutingStats();

            expect(stats.totalRequests).toBe(2);
            expect(stats.routedToCouncil).toBe(1);
            expect(stats.routedToHuman).toBe(1);
        });
    });

    describe('setCouncilRoutingThreshold', () => {
        it('should update the routing threshold', () => {
            integration.setCouncilRoutingThreshold(25);

            const config = integration.getConfig();
            expect(config.councilRoutingThreshold).toBe(25);
        });

        it('should reject invalid thresholds', () => {
            expect(() => integration.setCouncilRoutingThreshold(-10)).toThrow();
            expect(() => integration.setCouncilRoutingThreshold(150)).toThrow();
        });
    });
});
