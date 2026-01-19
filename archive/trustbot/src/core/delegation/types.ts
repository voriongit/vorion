/**
 * Delegation System Type Definitions
 *
 * TRUST-4.1: Types for temporary capability delegation.
 * Enables agents to request elevated permissions with oversight.
 */

import type { AgentId, AgentTier } from '../../types.js';
import type { Permission } from '../SecurityLayer.js';

// ============================================================================
// Constants
// ============================================================================

/** Maximum delegation duration: 24 hours */
export const MAX_DELEGATION_DURATION_MS = 24 * 60 * 60 * 1000;

/** Maximum delegation duration for auto-approval: 1 hour */
export const MAX_AUTO_APPROVE_DURATION_MS = 60 * 60 * 1000;

/** Minimum similar approvals required for auto-approval */
export const MIN_SIMILAR_APPROVALS = 3;

/** Minimum success rate for auto-approval (90%) */
export const MIN_SUCCESS_RATE = 0.90;

/** Minimum tier for auto-approval */
export const MIN_AUTO_APPROVE_TIER: AgentTier = 4;

/** Capabilities that can never be auto-approved */
export const RESTRICTED_CAPABILITIES: Permission[] = [
    'SYSTEM_CONFIG',
    'HITL_MODIFY',
    'AGENT_TERMINATE',
];

// ============================================================================
// Status Types
// ============================================================================

/**
 * Status of a delegation request.
 */
export type DelegationStatus =
    | 'pending'   // Awaiting approval
    | 'approved'  // Granted
    | 'rejected'  // Denied
    | 'expired'   // Past expiry time
    | 'revoked';  // Manually revoked

/**
 * Who approved the delegation.
 */
export type ApprovalSource =
    | AgentId     // Approved by specific agent
    | 'AUTO'      // Auto-approved by system
    | 'COUNCIL'   // Approved by council vote
    | 'HUMAN';    // Approved by human operator

// ============================================================================
// Delegation Request
// ============================================================================

/**
 * A request for temporary capabilities.
 */
export interface DelegationRequest {
    /** Unique request identifier */
    id: string;

    /** Agent requesting delegation */
    requesterId: AgentId;

    /** Capabilities being requested */
    requestedCapabilities: Permission[];

    /** Reason for the request */
    reason: string;

    /** Requested duration in milliseconds */
    duration: number;

    /** Additional context for the request */
    context: Record<string, unknown>;

    /** Current status */
    status: DelegationStatus;

    /** Who approved (if approved) */
    approvedBy?: ApprovalSource;

    /** When approved */
    approvedAt?: Date;

    /** When the delegation expires */
    expiresAt?: Date;

    /** When the request was created */
    createdAt: Date;

    /** Requester's historical success rate */
    requesterSuccessRate: number;

    /** Requester's current tier */
    requesterTier: AgentTier;

    /** Number of similar requests previously approved */
    similarRequestsApproved: number;

    /** Rejection reason if rejected */
    rejectionReason?: string;

    /** When revoked (if revoked) */
    revokedAt?: Date;

    /** Reason for revocation */
    revocationReason?: string;
}

// ============================================================================
// Active Delegation
// ============================================================================

/**
 * An active (granted) delegation.
 */
export interface ActiveDelegation {
    /** Unique delegation identifier */
    id: string;

    /** Agent with delegated capabilities */
    agentId: AgentId;

    /** Granted capabilities */
    capabilities: Permission[];

    /** When the delegation was granted */
    grantedAt: Date;

    /** When the delegation expires */
    expiresAt: Date;

    /** Reason for the delegation */
    reason: string;

    /** Who approved */
    approvedBy: ApprovalSource;

    /** Original request ID */
    requestId: string;

    /** Usage tracking */
    usageCount: number;

    /** Last time a delegated capability was used */
    lastUsedAt?: Date;
}

// ============================================================================
// Delegation History
// ============================================================================

/**
 * Historical record of a delegation.
 */
export interface DelegationHistory {
    /** Request ID */
    requestId: string;

    /** Agent who received delegation */
    agentId: AgentId;

    /** Capabilities that were granted */
    capabilities: Permission[];

    /** Duration in milliseconds */
    duration: number;

    /** Final outcome */
    outcome: 'completed' | 'expired' | 'revoked';

    /** Whether the agent completed their task successfully */
    wasSuccessful: boolean;

    /** Any issues that occurred */
    issues?: string[];

    /** When the delegation started */
    startedAt: Date;

    /** When the delegation ended */
    endedAt: Date;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the delegation system.
 */
export interface DelegationConfig {
    /** Maximum duration for any delegation (ms) */
    maxDurationMs: number;

    /** Maximum duration for auto-approval (ms) */
    maxAutoApproveDurationMs: number;

    /** Minimum tier for auto-approval */
    minAutoApproveTier: AgentTier;

    /** Minimum success rate for auto-approval */
    minAutoApproveSuccessRate: number;

    /** Minimum similar approvals for auto-approval */
    minSimilarApprovals: number;

    /** Capabilities that cannot be auto-approved */
    restrictedCapabilities: Permission[];

    /** Whether auto-approval is enabled */
    enableAutoApproval: boolean;

    /** Whether to track usage of delegated capabilities */
    trackUsage: boolean;
}

/**
 * Default delegation configuration.
 */
export const DEFAULT_DELEGATION_CONFIG: DelegationConfig = {
    maxDurationMs: MAX_DELEGATION_DURATION_MS,
    maxAutoApproveDurationMs: MAX_AUTO_APPROVE_DURATION_MS,
    minAutoApproveTier: MIN_AUTO_APPROVE_TIER,
    minAutoApproveSuccessRate: MIN_SUCCESS_RATE,
    minSimilarApprovals: MIN_SIMILAR_APPROVALS,
    restrictedCapabilities: [...RESTRICTED_CAPABILITIES],
    enableAutoApproval: true,
    trackUsage: true,
};

// ============================================================================
// Events
// ============================================================================

/**
 * Events emitted by the delegation system.
 */
export interface DelegationEvents {
    'delegation:requested': (request: DelegationRequest) => void;
    'delegation:auto-approved': (request: DelegationRequest, delegation: ActiveDelegation) => void;
    'delegation:approved': (request: DelegationRequest, delegation: ActiveDelegation) => void;
    'delegation:rejected': (request: DelegationRequest, reason: string) => void;
    'delegation:expired': (delegation: ActiveDelegation) => void;
    'delegation:revoked': (delegation: ActiveDelegation, reason: string) => void;
    'delegation:used': (delegation: ActiveDelegation, capability: Permission) => void;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Request to create a delegation.
 */
export interface CreateDelegationRequest {
    agentId: AgentId;
    capabilities: Permission[];
    reason: string;
    duration: number;
    context?: Record<string, unknown>;
}

/**
 * Result of checking if auto-approval is possible.
 */
export interface AutoApprovalCheck {
    canAutoApprove: boolean;
    reasons: string[];
}

/**
 * Statistics for delegation system.
 */
export interface DelegationStats {
    totalRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    autoApprovedRequests: number;
    activeDelegations: number;
    expiredDelegations: number;
    revokedDelegations: number;
    averageSuccessRate: number;
}
