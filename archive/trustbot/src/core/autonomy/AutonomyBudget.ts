/**
 * Autonomy Budget Service
 *
 * TRUST-4.7 & TRUST-4.8: Daily budget creation, reset, and enforcement.
 * Controls how many autonomous actions each agent can perform.
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import type { AgentId, AgentTier, TrustLevel } from '../../types.js';
import { trustEngine } from '../TrustEngine.js';
import { securityLayer } from '../SecurityLayer.js';
import type {
    DailyBudget,
    BudgetAction,
    BudgetCheckResult,
    AutonomyBudgetConfig,
    AutonomyBudgetEvents,
    AutonomyBudgetStats,
    RecordActionRequest,
    AgentBudgetSummary,
    TierBudgetLimits,
} from './types.js';
import {
    TIER_BUDGETS,
    DEFAULT_AUTONOMY_CONFIG,
} from './types.js';

// ============================================================================
// Errors
// ============================================================================

export class BudgetError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'BudgetError';
    }
}

// ============================================================================
// Autonomy Budget Service
// ============================================================================

export class AutonomyBudgetService extends EventEmitter<AutonomyBudgetEvents> {
    private budgets: Map<string, DailyBudget> = new Map(); // key: agentId:date
    private config: AutonomyBudgetConfig;

    // Reset timer
    private resetTimer?: NodeJS.Timeout;

    constructor(config: Partial<AutonomyBudgetConfig> = {}) {
        super();
        this.config = { ...DEFAULT_AUTONOMY_CONFIG, ...config };
    }

    /**
     * Start automatic midnight reset.
     */
    startResetTimer(): void {
        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
        }

        const scheduleNext = () => {
            const msUntilReset = this.getMsUntilReset();
            this.resetTimer = setTimeout(() => {
                this.resetAllBudgets();
                scheduleNext();
            }, msUntilReset);
        };

        scheduleNext();
    }

    /**
     * Stop automatic reset.
     */
    stopResetTimer(): void {
        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
            this.resetTimer = undefined;
        }
    }

    // -------------------------------------------------------------------------
    // TRUST-4.7: Budget Creation & Reset
    // -------------------------------------------------------------------------

    /**
     * Get or create today's budget for an agent.
     */
    async getOrCreateBudget(agentId: AgentId): Promise<DailyBudget> {
        const today = this.getDateString(new Date());
        const key = `${agentId}:${today}`;

        let budget = this.budgets.get(key);
        if (budget) {
            return budget;
        }

        // Get agent's tier
        const trust = trustEngine.getTrust(agentId);
        const tier = trust ? this.levelToTier(trust.level) : 0;
        const limits = this.getLimitsForTier(tier);

        const now = new Date();
        budget = {
            agentId,
            date: today,
            tier,
            maxAutonomousActions: limits.actions,
            maxDelegations: limits.delegations,
            maxTokenSpend: limits.tokens,
            autonomousActionsUsed: 0,
            delegationsUsed: 0,
            tokensSpent: 0,
            actions: [],
            resetAt: this.getNextResetTime(),
            createdAt: now,
            updatedAt: now,
        };

        this.budgets.set(key, budget);

        if (this.config.emitEvents) {
            this.emit('budget:created', budget);
        }

        return budget;
    }

    /**
     * Get limits for a tier (with any config overrides).
     */
    private getLimitsForTier(tier: AgentTier): TierBudgetLimits {
        const baseLimits = TIER_BUDGETS[tier];
        const overrides = this.config.tierOverrides?.[tier];

        if (overrides) {
            return {
                actions: overrides.actions ?? baseLimits.actions,
                delegations: overrides.delegations ?? baseLimits.delegations,
                tokens: overrides.tokens ?? baseLimits.tokens,
            };
        }

        return { ...baseLimits };
    }

    /**
     * Reset all budgets (called at midnight).
     */
    resetAllBudgets(): void {
        const today = this.getDateString(new Date());

        for (const [key, oldBudget] of this.budgets) {
            if (!key.endsWith(`:${today}`)) {
                // This is from a previous day - create new budget
                const agentId = key.split(':')[0] as AgentId;
                const tier = oldBudget.tier;
                const limits = this.getLimitsForTier(tier);
                const now = new Date();

                const newBudget: DailyBudget = {
                    agentId,
                    date: today,
                    tier,
                    maxAutonomousActions: limits.actions,
                    maxDelegations: limits.delegations,
                    maxTokenSpend: limits.tokens,
                    autonomousActionsUsed: 0,
                    delegationsUsed: 0,
                    tokensSpent: 0,
                    actions: [],
                    resetAt: this.getNextResetTime(),
                    createdAt: now,
                    updatedAt: now,
                };

                const newKey = `${agentId}:${today}`;
                this.budgets.set(newKey, newBudget);
                this.budgets.delete(key);

                if (this.config.emitEvents) {
                    this.emit('budget:reset', agentId, oldBudget, newBudget);
                }
            }
        }
    }

    /**
     * Update budget when agent's tier changes.
     */
    async updateTier(agentId: AgentId, newTier: AgentTier): Promise<DailyBudget> {
        const budget = await this.getOrCreateBudget(agentId);
        const limits = this.getLimitsForTier(newTier);

        budget.tier = newTier;
        budget.maxAutonomousActions = limits.actions;
        budget.maxDelegations = limits.delegations;
        budget.maxTokenSpend = limits.tokens;
        budget.updatedAt = new Date();

        return budget;
    }

    // -------------------------------------------------------------------------
    // TRUST-4.8: Budget Enforcement
    // -------------------------------------------------------------------------

    /**
     * Check if an action is within budget.
     */
    async canPerformAction(
        agentId: AgentId,
        actionType: string,
        cost: number = 1
    ): Promise<BudgetCheckResult> {
        const budget = await this.getOrCreateBudget(agentId);

        // T5 unlimited
        if (budget.maxAutonomousActions === -1) {
            return {
                allowed: true,
                remaining: Infinity,
                used: budget.autonomousActionsUsed,
                max: -1,
            };
        }

        if (budget.autonomousActionsUsed + cost > budget.maxAutonomousActions) {
            return {
                allowed: false,
                reason: `Daily action limit reached (${budget.maxAutonomousActions})`,
                remaining: 0,
                used: budget.autonomousActionsUsed,
                max: budget.maxAutonomousActions,
            };
        }

        return {
            allowed: true,
            remaining: budget.maxAutonomousActions - budget.autonomousActionsUsed - cost,
            used: budget.autonomousActionsUsed,
            max: budget.maxAutonomousActions,
        };
    }

    /**
     * Check if a delegation is within budget.
     */
    async canRequestDelegation(agentId: AgentId): Promise<BudgetCheckResult> {
        const budget = await this.getOrCreateBudget(agentId);

        // T5 unlimited
        if (budget.maxDelegations === -1) {
            return {
                allowed: true,
                remaining: Infinity,
                used: budget.delegationsUsed,
                max: -1,
            };
        }

        if (budget.delegationsUsed >= budget.maxDelegations) {
            return {
                allowed: false,
                reason: `Daily delegation limit reached (${budget.maxDelegations})`,
                remaining: 0,
                used: budget.delegationsUsed,
                max: budget.maxDelegations,
            };
        }

        return {
            allowed: true,
            remaining: budget.maxDelegations - budget.delegationsUsed - 1,
            used: budget.delegationsUsed,
            max: budget.maxDelegations,
        };
    }

    /**
     * Check if token spend is within budget.
     */
    async canSpendTokens(agentId: AgentId, amount: number): Promise<BudgetCheckResult> {
        const budget = await this.getOrCreateBudget(agentId);

        // T5 unlimited
        if (budget.maxTokenSpend === -1) {
            return {
                allowed: true,
                remaining: Infinity,
                used: budget.tokensSpent,
                max: -1,
            };
        }

        if (budget.tokensSpent + amount > budget.maxTokenSpend) {
            return {
                allowed: false,
                reason: `Daily token limit reached (${budget.maxTokenSpend})`,
                remaining: Math.max(0, budget.maxTokenSpend - budget.tokensSpent),
                used: budget.tokensSpent,
                max: budget.maxTokenSpend,
            };
        }

        return {
            allowed: true,
            remaining: budget.maxTokenSpend - budget.tokensSpent - amount,
            used: budget.tokensSpent,
            max: budget.maxTokenSpend,
        };
    }

    /**
     * Record an action and consume budget.
     */
    async recordAction(request: RecordActionRequest): Promise<DailyBudget> {
        const { agentId, actionType, cost = 1, tokenCost = 0, context = {} } = request;
        const budget = await this.getOrCreateBudget(agentId);

        // Check if allowed first
        const check = await this.canPerformAction(agentId, actionType, cost);
        if (!check.allowed && budget.maxAutonomousActions !== -1) {
            throw new BudgetError(
                check.reason ?? 'Budget exceeded',
                'BUDGET_EXCEEDED'
            );
        }

        // Record the action
        const action: BudgetAction = {
            id: uuidv4(),
            timestamp: new Date(),
            actionType,
            cost,
            approved: true,
            tokenCost: tokenCost > 0 ? tokenCost : undefined,
            context: Object.keys(context).length > 0 ? context : undefined,
        };

        // Update usage (only if not unlimited)
        if (budget.maxAutonomousActions !== -1) {
            budget.autonomousActionsUsed += cost;
        }

        if (tokenCost > 0 && budget.maxTokenSpend !== -1) {
            budget.tokensSpent += tokenCost;
        }

        // Track action if configured
        if (this.config.trackActions) {
            budget.actions.push(action);

            // Trim if too many actions
            if (budget.actions.length > this.config.maxActionsPerBudget) {
                budget.actions = budget.actions.slice(-this.config.maxActionsPerBudget);
            }
        }

        budget.updatedAt = new Date();

        // Emit events
        if (this.config.emitEvents) {
            this.emit('budget:action', agentId, action);

            // Check for exhaustion
            if (budget.maxAutonomousActions !== -1 &&
                budget.autonomousActionsUsed >= budget.maxAutonomousActions) {
                this.emit('budget:exhausted', agentId, budget, 'actions');
            }

            if (budget.maxTokenSpend !== -1 &&
                budget.tokensSpent >= budget.maxTokenSpend) {
                this.emit('budget:exhausted', agentId, budget, 'tokens');
            }

            // Warning at 80%
            if (budget.maxAutonomousActions > 0) {
                const pct = budget.autonomousActionsUsed / budget.maxAutonomousActions;
                if (pct >= 0.8 && pct < 1) {
                    this.emit('budget:warning', agentId, budget, pct * 100, 'actions');
                }
            }
        }

        // Audit log
        securityLayer.logAudit({
            action: 'TASK_DELEGATED',
            actor: { type: 'AGENT', id: agentId, tier: budget.tier },
            details: {
                budgetAction: actionType,
                cost,
                tokenCost,
                remaining: budget.maxAutonomousActions === -1
                    ? 'unlimited'
                    : budget.maxAutonomousActions - budget.autonomousActionsUsed,
            },
            outcome: 'SUCCESS',
        });

        return budget;
    }

    /**
     * Record a delegation request.
     */
    async recordDelegation(agentId: AgentId): Promise<DailyBudget> {
        const budget = await this.getOrCreateBudget(agentId);

        // Check if allowed first
        const check = await this.canRequestDelegation(agentId);
        if (!check.allowed && budget.maxDelegations !== -1) {
            throw new BudgetError(
                check.reason ?? 'Delegation budget exceeded',
                'DELEGATION_BUDGET_EXCEEDED'
            );
        }

        // Update usage (only if not unlimited)
        if (budget.maxDelegations !== -1) {
            budget.delegationsUsed++;
        }

        budget.updatedAt = new Date();

        // Emit events
        if (this.config.emitEvents && budget.maxDelegations !== -1 &&
            budget.delegationsUsed >= budget.maxDelegations) {
            this.emit('budget:exhausted', agentId, budget, 'delegations');
        }

        return budget;
    }

    /**
     * Record token spend.
     */
    async recordTokenSpend(agentId: AgentId, amount: number): Promise<DailyBudget> {
        const budget = await this.getOrCreateBudget(agentId);

        // Check if allowed first
        const check = await this.canSpendTokens(agentId, amount);
        if (!check.allowed && budget.maxTokenSpend !== -1) {
            throw new BudgetError(
                check.reason ?? 'Token budget exceeded',
                'TOKEN_BUDGET_EXCEEDED'
            );
        }

        // Update usage (only if not unlimited)
        if (budget.maxTokenSpend !== -1) {
            budget.tokensSpent += amount;
        }

        budget.updatedAt = new Date();

        // Emit events
        if (this.config.emitEvents && budget.maxTokenSpend !== -1 &&
            budget.tokensSpent >= budget.maxTokenSpend) {
            this.emit('budget:exhausted', agentId, budget, 'tokens');
        }

        return budget;
    }

    // -------------------------------------------------------------------------
    // Query Methods
    // -------------------------------------------------------------------------

    /**
     * Get budget for an agent (if exists).
     */
    getBudget(agentId: AgentId): DailyBudget | undefined {
        const today = this.getDateString(new Date());
        return this.budgets.get(`${agentId}:${today}`);
    }

    /**
     * Get budget summary for an agent.
     */
    async getBudgetSummary(agentId: AgentId): Promise<AgentBudgetSummary> {
        const budget = await this.getOrCreateBudget(agentId);

        const calcPercent = (used: number, max: number): number => {
            if (max === -1) return 0;
            if (max === 0) return 100;
            return (used / max) * 100;
        };

        const calcRemaining = (used: number, max: number): number => {
            if (max === -1) return Infinity;
            return Math.max(0, max - used);
        };

        return {
            agentId,
            tier: budget.tier,
            actions: {
                used: budget.autonomousActionsUsed,
                max: budget.maxAutonomousActions,
                remaining: calcRemaining(budget.autonomousActionsUsed, budget.maxAutonomousActions),
                percentUsed: calcPercent(budget.autonomousActionsUsed, budget.maxAutonomousActions),
            },
            delegations: {
                used: budget.delegationsUsed,
                max: budget.maxDelegations,
                remaining: calcRemaining(budget.delegationsUsed, budget.maxDelegations),
                percentUsed: calcPercent(budget.delegationsUsed, budget.maxDelegations),
            },
            tokens: {
                spent: budget.tokensSpent,
                max: budget.maxTokenSpend,
                remaining: calcRemaining(budget.tokensSpent, budget.maxTokenSpend),
                percentUsed: calcPercent(budget.tokensSpent, budget.maxTokenSpend),
            },
            resetsIn: budget.resetAt.getTime() - Date.now(),
        };
    }

    /**
     * Get all today's budgets.
     */
    getAllBudgets(): DailyBudget[] {
        const today = this.getDateString(new Date());
        return [...this.budgets.values()].filter(b => b.date === today);
    }

    /**
     * Get statistics.
     */
    getStats(): AutonomyBudgetStats {
        const today = this.getDateString(new Date());
        const todayBudgets = [...this.budgets.values()].filter(b => b.date === today);

        const byTier: Record<AgentTier, { agents: number; actionsUsed: number; actionsRemaining: number }> = {
            0: { agents: 0, actionsUsed: 0, actionsRemaining: 0 },
            1: { agents: 0, actionsUsed: 0, actionsRemaining: 0 },
            2: { agents: 0, actionsUsed: 0, actionsRemaining: 0 },
            3: { agents: 0, actionsUsed: 0, actionsRemaining: 0 },
            4: { agents: 0, actionsUsed: 0, actionsRemaining: 0 },
            5: { agents: 0, actionsUsed: 0, actionsRemaining: 0 },
        };

        let exhaustedBudgets = 0;
        let totalActionsToday = 0;
        let totalTokensSpentToday = 0;
        let totalUtilization = 0;
        let utilizationCount = 0;

        for (const budget of todayBudgets) {
            byTier[budget.tier].agents++;
            byTier[budget.tier].actionsUsed += budget.autonomousActionsUsed;

            if (budget.maxAutonomousActions !== -1) {
                byTier[budget.tier].actionsRemaining += budget.maxAutonomousActions - budget.autonomousActionsUsed;

                if (budget.autonomousActionsUsed >= budget.maxAutonomousActions) {
                    exhaustedBudgets++;
                }

                totalUtilization += budget.autonomousActionsUsed / budget.maxAutonomousActions;
                utilizationCount++;
            }

            totalActionsToday += budget.autonomousActionsUsed;
            totalTokensSpentToday += budget.tokensSpent;
        }

        return {
            totalBudgets: todayBudgets.length,
            exhaustedBudgets,
            totalActionsToday,
            totalTokensSpentToday,
            byTier,
            avgUtilization: utilizationCount > 0 ? (totalUtilization / utilizationCount) * 100 : 0,
        };
    }

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    /**
     * Get configuration.
     */
    getConfig(): AutonomyBudgetConfig {
        return { ...this.config };
    }

    /**
     * Update configuration.
     */
    setConfig(config: Partial<AutonomyBudgetConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Clear all data (for testing).
     */
    clear(): void {
        this.stopResetTimer();
        this.budgets.clear();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Get date string in YYYY-MM-DD format.
     */
    private getDateString(date: Date): string {
        const isoString = date.toISOString();
        const datePart = isoString.split('T')[0];
        return datePart ?? isoString.substring(0, 10);
    }

    /**
     * Get the next reset time.
     */
    private getNextResetTime(): Date {
        const now = new Date();
        const reset = new Date(now);
        reset.setUTCHours(this.config.resetHourUTC, 0, 0, 0);

        // If we've already passed today's reset, schedule for tomorrow
        if (reset <= now) {
            reset.setUTCDate(reset.getUTCDate() + 1);
        }

        return reset;
    }

    /**
     * Get milliseconds until next reset.
     */
    private getMsUntilReset(): number {
        return this.getNextResetTime().getTime() - Date.now();
    }

    /**
     * Convert trust level to tier.
     */
    private levelToTier(level: TrustLevel): AgentTier {
        const tierMap: Record<TrustLevel, AgentTier> = {
            SOVEREIGN: 5,
            EXECUTIVE: 4,
            TACTICAL: 3,
            OPERATIONAL: 2,
            WORKER: 1,
            PASSIVE: 0,
        };
        return tierMap[level] ?? 0;
    }
}

// Singleton instance
export const autonomyBudgetService = new AutonomyBudgetService();
