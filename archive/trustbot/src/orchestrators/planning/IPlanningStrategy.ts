/**
 * Planning Strategy Interfaces
 * 
 * Defines the contract for pluggable planning strategies.
 * This allows "The Architect" to switch between different "modes of thinking"
 * (e.g., Software Engineering, Research, Crisis Management, Swarm)
 * without changing the core agent logic.
 */

import type { Task } from '../../types.js';

export interface Objective {
    id: string;
    title: string;
    description: string;
    keyResults: string[];
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    deadline?: Date;
}

/**
 * Strategy for decomposing a high-level objective into actionable tasks.
 */
export interface IDecompositionStrategy {
    /**
     * Unique name of the strategy (e.g., "Software Development SDLC", "Deep Research")
     */
    readonly name: string;

    /**
     * Description of what this strategy is best for.
     */
    readonly description: string;

    /**
     * Cost estimate (simulated token cost or complexity).
     */
    readonly estimatedCost: number;

    /**
     * Determines if this strategy is suitable for the given objective.
     * Returns a confidence score between 0 and 1.
     * 1 = Perfect match, 0 = Cannot handle.
     */
    canHandle(objective: Objective): number;

    /**
     * Executes the decomposition logic.
     * Returns a list of tasks.
     */
    decompose(objective: Objective): Task[];
}

/**
 * Strategy for designing agent hierarchies.
 */
export interface IHierarchyDesignStrategy {
    readonly name: string;
    
    canHandle(companyType: string): number;
    
    design(companyType: string): {
        pattern: string;
        domains: Array<{
            name: string;
            role: string;
            count: number;
        }>;
    };
}
