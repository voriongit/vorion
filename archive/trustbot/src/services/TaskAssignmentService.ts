/**
 * Task Assignment Service
 *
 * Enhances task assignment with decision pattern learning.
 * Records assignment decisions and predicts optimal agent assignments
 * based on historical patterns using DecisionPatternService.
 *
 * Problem Solved: UnifiedWorkflowEngine assigns tasks based on simple tier
 * checks, ignoring the sophisticated DecisionPatternService available in
 * the memory system which could predict the best agent based on past success.
 *
 * Integration:
 *   [assignTask] -> [TaskAssignmentService] -> [DecisionPatternService]
 *                                           -> [TrustEngine]
 */

import { EventEmitter } from 'eventemitter3';
import { hasSupabaseConfig } from '../core/SupabasePersistence.js';
import type { AgentId } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface TaskContext {
    taskId: string;
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    requiredTier: number;
    capabilities?: string[];
}

export interface AgentContext {
    agentId: AgentId;
    agentType: string;
    agentTier: number;
    trustScore: number;
    capabilities: string[];
    currentLoad?: number;  // Number of tasks currently assigned
}

export interface AssignmentDecision {
    taskId: string;
    agentId: AgentId;
    decision: 'assigned' | 'rejected' | 'escalated';
    rationale: string;
    confidence: number;
    timestamp: Date;
    hitlUserId?: string;  // If HITL was involved
}

export interface AssignmentRecommendation {
    agentId: AgentId;
    confidence: number;
    reasoning: string;
    basedOnPatterns: number;  // Number of similar patterns found
}

interface AssignmentServiceEvents {
    'assignment:recorded': (decision: AssignmentDecision) => void;
    'assignment:predicted': (taskId: string, recommendations: AssignmentRecommendation[]) => void;
    'outcome:updated': (taskId: string, success: boolean) => void;
}

// ============================================================================
// Task Assignment Service
// ============================================================================

export class TaskAssignmentService extends EventEmitter<AssignmentServiceEvents> {
    private decisionPatternService: any | null = null;  // Lazy loaded
    private recordedDecisions: Map<string, AssignmentDecision> = new Map();
    private patternServiceLoaded = false;
    private patternServiceError: Error | null = null;

    constructor() {
        super();
        // Lazy load DecisionPatternService if Supabase is configured
        this.initializePatternService();
    }

    /**
     * Lazy initialize the DecisionPatternService
     */
    private async initializePatternService(): Promise<void> {
        if (!hasSupabaseConfig()) {
            // No Supabase - pattern learning disabled
            return;
        }

        try {
            // Dynamic import to avoid circular dependencies
            const { DecisionPatternService } = await import('../core/memory/DecisionPatternService.js');
            this.decisionPatternService = new DecisionPatternService();
            this.patternServiceLoaded = true;
        } catch (error) {
            this.patternServiceError = error as Error;
            console.warn('[TaskAssignmentService] DecisionPatternService not available:', error);
        }
    }

    /**
     * Check if pattern learning is available
     */
    isPatternLearningEnabled(): boolean {
        return this.patternServiceLoaded && this.decisionPatternService !== null;
    }

    /**
     * Record a task assignment decision for future learning
     */
    async recordAssignment(
        task: TaskContext,
        agent: AgentContext,
        decision: 'assigned' | 'rejected' | 'escalated',
        rationale: string,
        hitlUserId?: string
    ): Promise<void> {
        const assignmentDecision: AssignmentDecision = {
            taskId: task.taskId,
            agentId: agent.agentId,
            decision,
            rationale,
            confidence: this.calculateConfidence(task, agent),
            timestamp: new Date(),
            hitlUserId,
        };

        this.recordedDecisions.set(task.taskId, assignmentDecision);
        this.emit('assignment:recorded', assignmentDecision);

        // Record to DecisionPatternService if available
        if (this.decisionPatternService) {
            try {
                await this.decisionPatternService.record({
                    patternType: 'task_assignment',
                    agentType: agent.agentType,
                    agentTier: agent.agentTier,
                    actionType: 'assign_task',
                    decision,
                    rationale,
                    hitlUserId,
                    contextSummary: this.buildContextSummary(task, agent),
                });
            } catch (error) {
                console.warn('[TaskAssignmentService] Failed to record pattern:', error);
            }
        }
    }

    /**
     * Get recommendations for task assignment based on past patterns
     */
    async getRecommendations(
        task: TaskContext,
        availableAgents: AgentContext[]
    ): Promise<AssignmentRecommendation[]> {
        const recommendations: AssignmentRecommendation[] = [];

        // If pattern learning is available, query for similar past assignments
        if (this.decisionPatternService) {
            try {
                const contextSummary = `Task: ${task.title}. Priority: ${task.priority}. Required tier: ${task.requiredTier}`;

                const similarPatterns = await this.decisionPatternService.findSimilar(
                    {
                        actionType: 'assign_task',
                        contextSummary,
                    },
                    {
                        patternType: 'task_assignment',
                        limit: 10,
                        minSimilarity: 0.7,
                    }
                );

                // Build recommendations from patterns
                for (const pattern of similarPatterns) {
                    const matchingAgent = availableAgents.find(
                        a => a.agentType === pattern.agentType && a.agentTier >= task.requiredTier
                    );

                    if (matchingAgent && pattern.decision === 'assigned') {
                        // Check if we already have a recommendation for this agent
                        const existing = recommendations.find(r => r.agentId === matchingAgent.agentId);
                        if (existing) {
                            existing.confidence = Math.max(existing.confidence, pattern.similarity * 100);
                            existing.basedOnPatterns++;
                        } else {
                            recommendations.push({
                                agentId: matchingAgent.agentId,
                                confidence: pattern.similarity * 100,
                                reasoning: pattern.rationale || 'Similar past assignment succeeded',
                                basedOnPatterns: 1,
                            });
                        }
                    }
                }
            } catch (error) {
                console.warn('[TaskAssignmentService] Failed to get pattern recommendations:', error);
            }
        }

        // Add basic tier-based recommendations for agents without pattern data
        for (const agent of availableAgents) {
            if (agent.agentTier >= task.requiredTier) {
                const existing = recommendations.find(r => r.agentId === agent.agentId);
                if (!existing) {
                    recommendations.push({
                        agentId: agent.agentId,
                        confidence: this.calculateBaseConfidence(task, agent),
                        reasoning: `Tier ${agent.agentTier} meets requirement (${task.requiredTier})`,
                        basedOnPatterns: 0,
                    });
                }
            }
        }

        // Sort by confidence (highest first)
        recommendations.sort((a, b) => b.confidence - a.confidence);

        this.emit('assignment:predicted', task.taskId, recommendations);
        return recommendations;
    }

    /**
     * Update the outcome of a task assignment (for learning)
     */
    async updateOutcome(taskId: string, success: boolean, metrics?: {
        completionTimeMs?: number;
        qualityScore?: number;
        requiredRetries?: number;
    }): Promise<void> {
        const decision = this.recordedDecisions.get(taskId);
        if (!decision) {
            return;
        }

        this.emit('outcome:updated', taskId, success);

        // Update pattern outcome if available
        if (this.decisionPatternService) {
            try {
                // Find the pattern and update its outcome
                const patterns = await this.decisionPatternService.findSimilar(
                    {
                        actionType: 'assign_task',
                        contextSummary: `taskId: ${taskId}`,
                    },
                    {
                        patternType: 'task_assignment',
                        limit: 1,
                        minSimilarity: 0.99,
                    }
                );

                if (patterns.length > 0) {
                    await this.decisionPatternService.updateOutcome(
                        patterns[0].id,
                        success ? 'success' : 'failure',
                        metrics
                    );
                }
            } catch (error) {
                console.warn('[TaskAssignmentService] Failed to update outcome:', error);
            }
        }
    }

    /**
     * Calculate confidence for an assignment based on task/agent match
     */
    private calculateConfidence(task: TaskContext, agent: AgentContext): number {
        let confidence = 50;  // Base confidence

        // Tier match bonus
        if (agent.agentTier >= task.requiredTier) {
            confidence += 20;
        }
        if (agent.agentTier === task.requiredTier) {
            confidence += 10;  // Exact tier match is ideal
        }

        // Trust score bonus
        if (agent.trustScore >= 750) {
            confidence += 15;
        } else if (agent.trustScore >= 600) {
            confidence += 10;
        }

        // Capability match bonus
        if (task.capabilities && task.capabilities.length > 0) {
            const matchingCaps = task.capabilities.filter(
                c => agent.capabilities.includes(c)
            );
            confidence += Math.min(matchingCaps.length * 5, 15);
        }

        // Load penalty (higher cap for heavily loaded agents)
        if (agent.currentLoad !== undefined && agent.currentLoad > 3) {
            confidence -= Math.min(agent.currentLoad * 3, 30);
        }

        return Math.min(Math.max(confidence, 0), 100);
    }

    /**
     * Calculate base confidence without pattern data
     */
    private calculateBaseConfidence(task: TaskContext, agent: AgentContext): number {
        let confidence = 30;  // Lower base for non-pattern recommendations

        // Tier match - higher tiers get bonus, exact match gets small bonus
        const tierDiff = agent.agentTier - task.requiredTier;
        if (tierDiff >= 0) {
            confidence += 20;
            // Bonus for being above required tier (up to 10 points)
            confidence += Math.min(tierDiff * 3, 10);
        }

        // Trust score (more granular influence)
        confidence += Math.min(agent.trustScore / 20, 35);

        return Math.min(confidence, 90);  // Cap at 90% for non-pattern recommendations
    }

    /**
     * Build context summary for pattern matching
     */
    private buildContextSummary(task: TaskContext, agent: AgentContext): string {
        return `Task "${task.title}" (${task.priority}, tier ${task.requiredTier}) ` +
               `assigned to ${agent.agentType} agent (tier ${agent.agentTier}, ` +
               `trust ${agent.trustScore}, capabilities: ${agent.capabilities.join(', ')})`;
    }

    /**
     * Get statistics about assignment patterns
     */
    getStats(): {
        totalRecorded: number;
        patternLearningEnabled: boolean;
        byDecision: Record<string, number>;
    } {
        const byDecision: Record<string, number> = {};
        for (const decision of this.recordedDecisions.values()) {
            byDecision[decision.decision] = (byDecision[decision.decision] || 0) + 1;
        }

        return {
            totalRecorded: this.recordedDecisions.size,
            patternLearningEnabled: this.isPatternLearningEnabled(),
            byDecision,
        };
    }

    /**
     * Clear recorded decisions (for testing)
     */
    clear(): void {
        this.recordedDecisions.clear();
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let serviceInstance: TaskAssignmentService | null = null;

/**
 * Get or create the TaskAssignmentService singleton
 */
export function getTaskAssignmentService(): TaskAssignmentService {
    if (!serviceInstance) {
        serviceInstance = new TaskAssignmentService();
    }
    return serviceInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetTaskAssignmentService(): void {
    serviceInstance = null;
}
