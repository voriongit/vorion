/**
 * Autonomy Budget Type Definitions
 *
 * TRUST-4.6: Types for daily autonomy budgets.
 * Controls how many autonomous actions each tier can perform.
 */

import type { AgentId, AgentTier } from '../../types.js';

// ============================================================================
// Tier Budget Limits
// ============================================================================

/**
 * Budget limits for a specific tier.
 */
export interface TierBudgetLimits {
    /** Maximum autonomous actions per day (-1 = unlimited) */
    actions: number;
    /** Maximum delegation requests per day (-1 = unlimited) */
    delegations: number;
    /** Maximum token spend per day (-1 = unlimited) */
    tokens: number;
}

/**
 * Per-tier budget limits.
 * T5 has unlimited (-1) values.
 */
export const TIER_BUDGETS: Record<AgentTier, TierBudgetLimits> = {
    0: { actions: 0, delegations: 0, tokens: 0 },       // PASSIVE - no autonomy
    1: { actions: 5, delegations: 0, tokens: 1000 },    // WORKER - minimal
    2: { actions: 20, delegations: 1, tokens: 5000 },   // OPERATIONAL
    3: { actions: 50, delegations: 3, tokens: 20000 },  // TACTICAL
    4: { actions: 200, delegations: 10, tokens: 100000 }, // EXECUTIVE
    5: { actions: -1, delegations: -1, tokens: -1 },    // SOVEREIGN - unlimited
};

// ============================================================================
// Budget Action
// ============================================================================

/**
 * A single action that consumes budget.
 */
export interface BudgetAction {
    /** Action identifier */
    id: string;

    /** When the action occurred */
    timestamp: Date;

    /** Type of action performed */
    actionType: string;

    /** Cost of the action */
    cost: number;

    /** Whether the action was approved */
    approved: boolean;

    /** Token cost if applicable */
    tokenCost?: number;

    /** Reason if denied */
    denialReason?: string;

    /** Additional context */
    context?: Record<string, unknown>;
}

// ============================================================================
// Daily Budget
// ============================================================================

/**
 * An agent's daily budget allocation and usage.
 */
export interface DailyBudget {
    /** Agent ID */
    agentId: AgentId;

    /** Date string (YYYY-MM-DD) */
    date: string;

    /** Agent's tier when budget was created */
    tier: AgentTier;

    /** Maximum autonomous actions allowed */
    maxAutonomousActions: number;

    /** Maximum delegation requests allowed */
    maxDelegations: number;

    /** Maximum token spend allowed */
    maxTokenSpend: number;

    /** Autonomous actions used */
    autonomousActionsUsed: number;

    /** Delegations used */
    delegationsUsed: number;

    /** Tokens spent */
    tokensSpent: number;

    /** Individual actions tracked */
    actions: BudgetAction[];

    /** When the budget resets */
    resetAt: Date;

    /** When the budget was created */
    createdAt: Date;

    /** When the budget was last updated */
    updatedAt: Date;
}

// ============================================================================
// Budget Check Result
// ============================================================================

/**
 * Result of checking if an action is within budget.
 */
export interface BudgetCheckResult {
    /** Whether the action is allowed */
    allowed: boolean;

    /** Reason if not allowed */
    reason?: string;

    /** Remaining budget after this action (if allowed) */
    remaining?: number;

    /** Current usage */
    used?: number;

    /** Maximum allowed */
    max?: number;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the autonomy budget system.
 */
export interface AutonomyBudgetConfig {
    /** Hour of day (UTC) when budgets reset (0-23) */
    resetHourUTC: number;

    /** Whether to track individual actions */
    trackActions: boolean;

    /** Maximum actions to keep in history per budget */
    maxActionsPerBudget: number;

    /** Whether to emit events for budget changes */
    emitEvents: boolean;

    /** Custom tier overrides */
    tierOverrides?: Partial<Record<AgentTier, Partial<TierBudgetLimits>>>;
}

/**
 * Default autonomy budget configuration.
 */
export const DEFAULT_AUTONOMY_CONFIG: AutonomyBudgetConfig = {
    resetHourUTC: 0, // Midnight UTC
    trackActions: true,
    maxActionsPerBudget: 1000,
    emitEvents: true,
};

// ============================================================================
// Events
// ============================================================================

/**
 * Events emitted by the autonomy budget system.
 */
export interface AutonomyBudgetEvents {
    'budget:created': (budget: DailyBudget) => void;
    'budget:reset': (agentId: AgentId, oldBudget: DailyBudget, newBudget: DailyBudget) => void;
    'budget:action': (agentId: AgentId, action: BudgetAction) => void;
    'budget:exhausted': (agentId: AgentId, budget: DailyBudget, type: 'actions' | 'delegations' | 'tokens') => void;
    'budget:warning': (agentId: AgentId, budget: DailyBudget, percentUsed: number, type: 'actions' | 'delegations' | 'tokens') => void;
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Statistics for the autonomy budget system.
 */
export interface AutonomyBudgetStats {
    /** Total budgets tracked */
    totalBudgets: number;

    /** Budgets at limit */
    exhaustedBudgets: number;

    /** Total actions recorded today */
    totalActionsToday: number;

    /** Total tokens spent today */
    totalTokensSpentToday: number;

    /** By tier breakdown */
    byTier: Record<AgentTier, {
        agents: number;
        actionsUsed: number;
        actionsRemaining: number;
    }>;

    /** Average utilization percentage */
    avgUtilization: number;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Request to record an action.
 */
export interface RecordActionRequest {
    agentId: AgentId;
    actionType: string;
    cost?: number;
    tokenCost?: number;
    context?: Record<string, unknown>;
}

/**
 * Budget summary for an agent.
 */
export interface AgentBudgetSummary {
    agentId: AgentId;
    tier: AgentTier;
    actions: {
        used: number;
        max: number;
        remaining: number;
        percentUsed: number;
    };
    delegations: {
        used: number;
        max: number;
        remaining: number;
        percentUsed: number;
    };
    tokens: {
        spent: number;
        max: number;
        remaining: number;
        percentUsed: number;
    };
    resetsIn: number; // milliseconds
}
