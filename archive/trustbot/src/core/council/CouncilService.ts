/**
 * Council Service
 *
 * TRUST-3.3 through TRUST-3.6: Core council governance operations.
 * Handles reviewer selection, review submission, voting, and decision resolution.
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import type { AgentId } from '../../types.js';
import type {
    CouncilMember,
    CouncilReview,
    CouncilVote,
    CouncilOutcome,
    CouncilConfig,
    CouncilEvents,
    CouncilRequestType,
    SubmitReviewRequest,
    SubmitVoteRequest,
    VoteType,
} from './types.js';
import { DEFAULT_COUNCIL_CONFIG } from './types.js';
import { CouncilMemberRegistry } from './CouncilMemberRegistry.js';
import type { PrecedentService } from './PrecedentService.js';

// ============================================================================
// Errors
// ============================================================================

export class CouncilServiceError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'CouncilServiceError';
    }
}

// ============================================================================
// Council Service
// ============================================================================

export class CouncilService extends EventEmitter<CouncilEvents> {
    private reviews: Map<string, CouncilReview> = new Map();
    private config: CouncilConfig;
    private memberRegistry: CouncilMemberRegistry;
    private precedentService?: PrecedentService;
    private timeoutTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(
        memberRegistry: CouncilMemberRegistry,
        config: Partial<CouncilConfig> = {}
    ) {
        super();
        this.memberRegistry = memberRegistry;
        this.config = { ...DEFAULT_COUNCIL_CONFIG, ...config };
    }

    /**
     * Set the precedent service for precedent lookup and creation.
     */
    setPrecedentService(service: PrecedentService): void {
        this.precedentService = service;
    }

    // -------------------------------------------------------------------------
    // TRUST-3.3: Reviewer Selection Algorithm
    // -------------------------------------------------------------------------

    /**
     * Select reviewers for a request.
     * Selects diverse, available reviewers while excluding the requester.
     */
    selectReviewers(
        requestType: CouncilRequestType,
        requesterId: AgentId,
        _context: Record<string, unknown>
    ): CouncilMember[] {
        const allMembers = this.memberRegistry.getMembers();

        // Filter eligible members
        const eligible = allMembers.filter(m =>
            m.agentId !== requesterId &&
            m.activeReviews < this.config.maxActiveReviews
        );

        if (eligible.length < this.config.reviewersPerRequest) {
            throw new CouncilServiceError(
                `Insufficient council members available. Need ${this.config.reviewersPerRequest}, have ${eligible.length}`,
                'INSUFFICIENT_REVIEWERS'
            );
        }

        // Sort by preference:
        // 1. T5 agents first for critical requests
        // 2. Lower active reviews preferred
        // 3. Higher agreement rate preferred
        const isCritical = requestType === 'POLICY_CHANGE' || requestType === 'TIER_UPGRADE';

        const sorted = [...eligible].sort((a, b) => {
            // T5 priority for critical requests
            if (isCritical) {
                if (a.tier === 5 && b.tier !== 5) return -1;
                if (b.tier === 5 && a.tier !== 5) return 1;
            }

            // Fewer active reviews first
            if (a.activeReviews !== b.activeReviews) {
                return a.activeReviews - b.activeReviews;
            }

            // Higher agreement rate first
            return b.agreementRate - a.agreementRate;
        });

        // Try to get diverse specializations
        const selected = this.diverseSelect(sorted, this.config.reviewersPerRequest);

        return selected;
    }

    /**
     * Select diverse reviewers by specialization when possible.
     */
    private diverseSelect(candidates: CouncilMember[], count: number): CouncilMember[] {
        const selected: CouncilMember[] = [];
        const usedSpecializations = new Set<string>();

        // First pass: try to get diverse specializations
        for (const candidate of candidates) {
            if (selected.length >= count) break;

            if (candidate.specialization && !usedSpecializations.has(candidate.specialization)) {
                selected.push(candidate);
                usedSpecializations.add(candidate.specialization);
            }
        }

        // Second pass: fill remaining slots with any available
        for (const candidate of candidates) {
            if (selected.length >= count) break;

            if (!selected.includes(candidate)) {
                selected.push(candidate);
            }
        }

        return selected;
    }

    // -------------------------------------------------------------------------
    // TRUST-3.4: Review Submission
    // -------------------------------------------------------------------------

    /**
     * Submit a request for council review.
     */
    async submitForReview(request: SubmitReviewRequest): Promise<CouncilReview> {
        const {
            requestType,
            requesterId,
            context,
            priority = 'normal',
            timeoutMs = this.config.defaultTimeoutMs,
        } = request;

        // Check for applicable precedent
        if (this.precedentService && this.config.enablePrecedentAutoApply) {
            const precedentMatch = await this.precedentService.findPrecedent(requestType, context);

            if (precedentMatch?.shouldAutoApply) {
                // Create a review that's already decided by precedent
                const review = this.createReview(
                    requestType,
                    requesterId,
                    context,
                    [], // No reviewers needed
                    priority,
                    timeoutMs
                );

                review.status = precedentMatch.precedent.decision;
                review.decidedAt = new Date();
                review.appliedPrecedent = precedentMatch.precedent.id;
                review.outcome = {
                    decision: precedentMatch.precedent.decision,
                    reasoning: `Auto-applied precedent: ${precedentMatch.precedent.reasoning}`,
                    confidence: precedentMatch.precedent.confidence,
                    precedentId: precedentMatch.precedent.id,
                };

                this.reviews.set(review.id, review);
                this.emit('council:precedent-applied', review.id, precedentMatch.precedent);
                this.emit('council:decision-made', review);

                // Update precedent usage
                await this.precedentService.recordApplication(precedentMatch.precedent.id);

                return review;
            }
        }

        // Select reviewers
        const reviewers = this.selectReviewers(requestType, requesterId, context);

        // Create review
        const review = this.createReview(
            requestType,
            requesterId,
            context,
            reviewers,
            priority,
            timeoutMs
        );

        // Increment active reviews for each reviewer
        for (const reviewer of reviewers) {
            this.memberRegistry.incrementActiveReviews(reviewer.agentId);
        }

        // Store review
        this.reviews.set(review.id, review);

        // Set timeout timer
        this.setTimeoutTimer(review);

        // Emit event
        this.emit('council:review-submitted', review);

        return review;
    }

    /**
     * Create a new review object.
     */
    private createReview(
        requestType: CouncilRequestType,
        requesterId: AgentId,
        context: Record<string, unknown>,
        reviewers: CouncilMember[],
        priority: 'low' | 'normal' | 'high' | 'critical',
        timeoutMs: number
    ): CouncilReview {
        const now = new Date();

        return {
            id: uuidv4(),
            requestType,
            requesterId,
            context,
            reviewers: [...reviewers], // Copy to avoid mutations
            votes: new Map(),
            requiredVotes: this.config.requiredVotesForMajority,
            status: 'pending',
            createdAt: now,
            expiresAt: new Date(now.getTime() + timeoutMs),
            priority,
        };
    }

    /**
     * Set timeout timer for a review.
     */
    private setTimeoutTimer(review: CouncilReview): void {
        const timeUntilExpiry = review.expiresAt.getTime() - Date.now();

        if (timeUntilExpiry > 0) {
            const timer = setTimeout(() => {
                this.handleTimeout(review.id);
            }, timeUntilExpiry);

            this.timeoutTimers.set(review.id, timer);
        }
    }

    /**
     * Handle review timeout.
     */
    private async handleTimeout(reviewId: string): Promise<void> {
        const review = this.reviews.get(reviewId);
        if (!review || review.status !== 'pending') return;

        this.timeoutTimers.delete(reviewId);

        // Check if we have a majority despite timeout
        const votes = [...review.votes.values()];
        const approves = votes.filter(v => v.vote === 'approve').length;
        const rejects = votes.filter(v => v.vote === 'reject').length;

        if (approves >= review.requiredVotes) {
            await this.finalizeDecision(review, 'approved');
        } else if (rejects >= review.requiredVotes) {
            await this.finalizeDecision(review, 'rejected');
        } else {
            // No majority - escalate
            review.status = 'escalated';
            this.cleanupReview(review);
            this.emit('council:review-timeout', review);
            this.emit('council:review-escalated', review);
        }
    }

    // -------------------------------------------------------------------------
    // TRUST-3.5: Voting Mechanism
    // -------------------------------------------------------------------------

    /**
     * Submit a vote on a review.
     */
    async submitVote(request: SubmitVoteRequest): Promise<CouncilReview> {
        const { reviewId, voterId, vote, reasoning, confidence, precedentId } = request;

        const review = this.reviews.get(reviewId);
        if (!review) {
            throw new CouncilServiceError(
                `Review ${reviewId} not found`,
                'REVIEW_NOT_FOUND'
            );
        }

        // Validate voter is a reviewer
        if (!review.reviewers.find(r => r.agentId === voterId)) {
            throw new CouncilServiceError(
                `Agent ${voterId} is not authorized to vote on this review`,
                'NOT_AUTHORIZED'
            );
        }

        // Check review is still pending
        if (review.status !== 'pending') {
            throw new CouncilServiceError(
                `Review is already ${review.status}`,
                'REVIEW_DECIDED'
            );
        }

        // Check for duplicate vote
        if (review.votes.has(voterId)) {
            throw new CouncilServiceError(
                `Agent ${voterId} has already voted`,
                'ALREADY_VOTED'
            );
        }

        // Validate confidence
        if (confidence < 0 || confidence > 1) {
            throw new CouncilServiceError(
                'Confidence must be between 0 and 1',
                'INVALID_CONFIDENCE'
            );
        }

        // Validate reasoning
        if (!reasoning || reasoning.trim().length === 0) {
            throw new CouncilServiceError(
                'Reasoning is required',
                'REASONING_REQUIRED'
            );
        }

        // Create vote
        const councilVote: CouncilVote = {
            voterId,
            vote,
            reasoning: reasoning.trim(),
            confidence,
            timestamp: new Date(),
            precedentId,
        };

        review.votes.set(voterId, councilVote);

        // Emit event
        this.emit('council:vote-submitted', reviewId, councilVote);

        // Check if decision can be made
        await this.checkForDecision(review);

        return review;
    }

    // -------------------------------------------------------------------------
    // TRUST-3.6: Decision Resolution
    // -------------------------------------------------------------------------

    /**
     * Check if a decision can be made based on current votes.
     */
    private async checkForDecision(review: CouncilReview): Promise<void> {
        const votes = [...review.votes.values()];
        const approves = votes.filter(v => v.vote === 'approve').length;
        const rejects = votes.filter(v => v.vote === 'reject').length;

        if (approves >= review.requiredVotes) {
            await this.finalizeDecision(review, 'approved');
        } else if (rejects >= review.requiredVotes) {
            await this.finalizeDecision(review, 'rejected');
        }
        // Otherwise, still pending
    }

    /**
     * Finalize a decision.
     */
    private async finalizeDecision(
        review: CouncilReview,
        decision: 'approved' | 'rejected'
    ): Promise<void> {
        // Clear timeout timer
        const timer = this.timeoutTimers.get(review.id);
        if (timer) {
            clearTimeout(timer);
            this.timeoutTimers.delete(review.id);
        }

        // Update review
        review.status = decision;
        review.decidedAt = new Date();

        // Synthesize reasoning from majority votes
        const outcome = this.synthesizeOutcome(review, decision);
        review.outcome = outcome;

        // Create precedent
        if (this.precedentService) {
            const precedent = await this.precedentService.createFromReview(review);
            review.outcome!.precedentId = precedent.id;
        }

        // Cleanup
        this.cleanupReview(review);

        // Update voter statistics
        this.updateVoterStats(review, decision);

        // Emit event
        this.emit('council:decision-made', review);
    }

    /**
     * Synthesize outcome from votes.
     */
    private synthesizeOutcome(
        review: CouncilReview,
        decision: 'approved' | 'rejected'
    ): CouncilOutcome {
        const votes = [...review.votes.values()];
        const majorityVotes = votes.filter(v => v.vote === decision.replace('d', ''));

        // Combine reasoning from majority votes
        const reasonings = majorityVotes.map(v => v.reasoning);
        const synthesizedReasoning = reasonings.length > 0
            ? reasonings.join(' | ')
            : 'Decision made by council vote.';

        // Calculate average confidence from majority
        const avgConfidence = majorityVotes.length > 0
            ? majorityVotes.reduce((sum, v) => sum + v.confidence, 0) / majorityVotes.length
            : 0.5;

        return {
            decision,
            reasoning: synthesizedReasoning,
            confidence: avgConfidence,
        };
    }

    /**
     * Clean up after a review is complete.
     */
    private cleanupReview(review: CouncilReview): void {
        // Decrement active reviews for all reviewers
        for (const reviewer of review.reviewers) {
            this.memberRegistry.decrementActiveReviews(reviewer.agentId);
        }
    }

    /**
     * Update voter statistics after decision.
     */
    private updateVoterStats(review: CouncilReview, decision: 'approved' | 'rejected'): void {
        const winningVote: VoteType = decision === 'approved' ? 'approve' : 'reject';

        for (const [voterId, vote] of review.votes) {
            const agreedWithMajority = vote.vote === winningVote;
            this.memberRegistry.recordVote(voterId, agreedWithMajority);
        }
    }

    // -------------------------------------------------------------------------
    // Query Methods
    // -------------------------------------------------------------------------

    /**
     * Get a review by ID.
     */
    getReview(reviewId: string): CouncilReview | undefined {
        return this.reviews.get(reviewId);
    }

    /**
     * Get all pending reviews.
     */
    getPendingReviews(): CouncilReview[] {
        return [...this.reviews.values()].filter(r => r.status === 'pending');
    }

    /**
     * Get reviews for a specific reviewer.
     */
    getReviewsForReviewer(agentId: AgentId): CouncilReview[] {
        return [...this.reviews.values()].filter(
            r => r.status === 'pending' &&
                r.reviewers.some(rev => rev.agentId === agentId)
        );
    }

    /**
     * Get reviews by status.
     */
    getReviewsByStatus(status: CouncilReview['status']): CouncilReview[] {
        return [...this.reviews.values()].filter(r => r.status === status);
    }

    /**
     * Get reviews by requester.
     */
    getReviewsByRequester(requesterId: AgentId): CouncilReview[] {
        return [...this.reviews.values()].filter(r => r.requesterId === requesterId);
    }

    /**
     * Get all reviews.
     */
    getAllReviews(): CouncilReview[] {
        return [...this.reviews.values()];
    }

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    /**
     * Get council statistics.
     */
    getStats(): {
        totalReviews: number;
        pendingReviews: number;
        approvedReviews: number;
        rejectedReviews: number;
        escalatedReviews: number;
        approvalRate: number;
        avgDecisionTimeMs: number;
    } {
        const reviews = [...this.reviews.values()];

        const pending = reviews.filter(r => r.status === 'pending').length;
        const approved = reviews.filter(r => r.status === 'approved').length;
        const rejected = reviews.filter(r => r.status === 'rejected').length;
        const escalated = reviews.filter(r => r.status === 'escalated').length;

        const decided = reviews.filter(r => r.decidedAt);
        const approvalRate = decided.length > 0
            ? approved / decided.length
            : 0;

        const avgDecisionTimeMs = decided.length > 0
            ? decided.reduce((sum, r) =>
                sum + (r.decidedAt!.getTime() - r.createdAt.getTime()), 0
            ) / decided.length
            : 0;

        return {
            totalReviews: reviews.length,
            pendingReviews: pending,
            approvedReviews: approved,
            rejectedReviews: rejected,
            escalatedReviews: escalated,
            approvalRate,
            avgDecisionTimeMs,
        };
    }

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

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
     * Clear all reviews (for testing).
     */
    clear(): void {
        // Clear all timers
        for (const timer of this.timeoutTimers.values()) {
            clearTimeout(timer);
        }
        this.timeoutTimers.clear();
        this.reviews.clear();
    }
}

// Singleton instance (created with shared registry)
import { councilMemberRegistry } from './CouncilMemberRegistry.js';
export const councilService = new CouncilService(councilMemberRegistry);
