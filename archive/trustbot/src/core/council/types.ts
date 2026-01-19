/**
 * Council Governance Type Definitions
 *
 * TRUST-3.1: Type definitions for the distributed council governance system.
 * The council provides democratic decision-making for critical operations.
 */

import type { AgentId, AgentTier } from '../../types.js';

// ============================================================================
// Request Types
// ============================================================================

/**
 * Types of requests that can be submitted to the council.
 */
export type CouncilRequestType =
    | 'SPAWN'           // Request to spawn a new agent
    | 'TIER_UPGRADE'    // Request to upgrade agent tier
    | 'POLICY_CHANGE'   // Request to change trust policy
    | 'CAPABILITY_GRANT'; // Request to grant new capability

/**
 * Status of a council review.
 */
export type CouncilReviewStatus =
    | 'pending'    // Awaiting votes
    | 'approved'   // Majority approved
    | 'rejected'   // Majority rejected
    | 'timeout'    // Expired without majority
    | 'escalated'; // Escalated to human oversight

/**
 * Vote options for council members.
 */
export type VoteType = 'approve' | 'reject' | 'abstain';

// ============================================================================
// Council Member
// ============================================================================

/**
 * A member of the council eligible to vote on requests.
 */
export interface CouncilMember {
    /** Unique agent identifier */
    agentId: AgentId;

    /** Agent tier (must be >= 4 for council membership) */
    tier: AgentTier;

    /** Optional specialization domain */
    specialization?: string;

    /** Voting weight (default 1, T5 can have higher) */
    votingWeight: number;

    /** Number of currently active reviews (max 3) */
    activeReviews: number;

    /** When the member joined the council */
    joinedAt: Date;

    /** Total votes cast since joining */
    totalVotes: number;

    /** Agreement rate with majority decisions */
    agreementRate: number;
}

// ============================================================================
// Council Vote
// ============================================================================

/**
 * A vote cast by a council member.
 */
export interface CouncilVote {
    /** ID of the voting member */
    voterId: AgentId;

    /** The vote cast */
    vote: VoteType;

    /** Reasoning for the vote (required) */
    reasoning: string;

    /** Confidence in the decision (0-1) */
    confidence: number;

    /** When the vote was cast */
    timestamp: Date;

    /** Optional precedent referenced */
    precedentId?: string;
}

// ============================================================================
// Council Review
// ============================================================================

/**
 * Outcome of a council decision.
 */
export interface CouncilOutcome {
    /** Final decision */
    decision: 'approved' | 'rejected';

    /** Synthesized reasoning from majority votes */
    reasoning: string;

    /** Overall confidence from voters */
    confidence: number;

    /** Precedent created from this decision */
    precedentId?: string;
}

/**
 * A request submitted for council review.
 */
export interface CouncilReview {
    /** Unique review identifier */
    id: string;

    /** Type of request being reviewed */
    requestType: CouncilRequestType;

    /** Agent who submitted the request */
    requesterId: AgentId;

    /** Context and details of the request */
    context: Record<string, unknown>;

    /** Assigned reviewers */
    reviewers: CouncilMember[];

    /** Votes cast so far */
    votes: Map<AgentId, CouncilVote>;

    /** Number of votes required for decision (usually 2 of 3) */
    requiredVotes: number;

    /** Current status of the review */
    status: CouncilReviewStatus;

    /** Outcome if decided */
    outcome?: CouncilOutcome;

    /** When the review was created */
    createdAt: Date;

    /** When the review expires */
    expiresAt: Date;

    /** When the decision was made */
    decidedAt?: Date;

    /** Priority level (affects urgency) */
    priority: 'low' | 'normal' | 'high' | 'critical';

    /** Optional precedent applied automatically */
    appliedPrecedent?: string;
}

// ============================================================================
// Precedent
// ============================================================================

/**
 * A precedent from a previous council decision.
 * Used to provide consistency for similar future requests.
 */
export interface Precedent {
    /** Unique precedent identifier */
    id: string;

    /** Type of request this precedent applies to */
    requestType: CouncilRequestType;

    /** Generalized context pattern for matching */
    contextPattern: Record<string, unknown>;

    /** The decision made */
    decision: 'approved' | 'rejected';

    /** Reasoning for the decision */
    reasoning: string;

    /** Original votes that led to this precedent */
    votes: CouncilVote[];

    /** Confidence in the precedent */
    confidence: number;

    /** When the precedent was created */
    createdAt: Date;

    /** How many times this precedent has been applied */
    appliedCount: number;

    /** Original review ID that created this precedent */
    sourceReviewId: string;

    /** Whether this precedent is still active */
    isActive: boolean;

    /** Optional override justification if precedent was overridden */
    overrideJustification?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the council system.
 */
export interface CouncilConfig {
    /** Minimum tier required for council membership */
    minMemberTier: AgentTier;

    /** Maximum concurrent reviews per member */
    maxActiveReviews: number;

    /** Number of reviewers per request */
    reviewersPerRequest: number;

    /** Votes required for majority (out of reviewersPerRequest) */
    requiredVotesForMajority: number;

    /** Default review timeout in milliseconds (24h default) */
    defaultTimeoutMs: number;

    /** Similarity threshold for precedent matching (0-1) */
    precedentSimilarityThreshold: number;

    /** Minimum confidence for auto-applying precedent */
    precedentConfidenceThreshold: number;

    /** Whether to enable precedent auto-application */
    enablePrecedentAutoApply: boolean;
}

/**
 * Default council configuration.
 */
export const DEFAULT_COUNCIL_CONFIG: CouncilConfig = {
    minMemberTier: 4,
    maxActiveReviews: 3,
    reviewersPerRequest: 3,
    requiredVotesForMajority: 2,
    defaultTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
    precedentSimilarityThreshold: 0.9,
    precedentConfidenceThreshold: 0.8,
    enablePrecedentAutoApply: true,
};

// ============================================================================
// Events
// ============================================================================

/**
 * Events emitted by the council system.
 */
export interface CouncilEvents {
    'council:member-joined': (member: CouncilMember) => void;
    'council:member-left': (member: CouncilMember, reason: string) => void;
    'council:review-submitted': (review: CouncilReview) => void;
    'council:vote-submitted': (reviewId: string, vote: CouncilVote) => void;
    'council:decision-made': (review: CouncilReview) => void;
    'council:review-timeout': (review: CouncilReview) => void;
    'council:review-escalated': (review: CouncilReview) => void;
    'council:precedent-created': (precedent: Precedent) => void;
    'council:precedent-applied': (reviewId: string, precedent: Precedent) => void;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Request to submit for council review.
 */
export interface SubmitReviewRequest {
    requestType: CouncilRequestType;
    requesterId: AgentId;
    context: Record<string, unknown>;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    timeoutMs?: number;
}

/**
 * Vote submission request.
 */
export interface SubmitVoteRequest {
    reviewId: string;
    voterId: AgentId;
    vote: VoteType;
    reasoning: string;
    confidence: number;
    precedentId?: string;
}

/**
 * Result of a precedent search.
 */
export interface PrecedentMatch {
    precedent: Precedent;
    similarity: number;
    shouldAutoApply: boolean;
}

/**
 * Statistics for the council system.
 */
export interface CouncilStats {
    totalMembers: number;
    activeReviews: number;
    totalReviewsProcessed: number;
    approvalRate: number;
    avgDecisionTimeMs: number;
    precedentsApplied: number;
    escalationsToHuman: number;
}
