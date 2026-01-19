/**
 * Planner Engine
 * 
 * The "Brain" of the Architect Agent.
 * Manages a registry of strategies and acts as the decision engine
 * to select the best strategy for a given context.
 */

import { IDecompositionStrategy, Objective, IHierarchyDesignStrategy } from './IPlanningStrategy.js';
import type { Task } from '../../types.js';

export class PlannerEngine {
    private decompositionStrategies: IDecompositionStrategy[] = [];
    private hierarchyStrategies: IHierarchyDesignStrategy[] = [];

    /**
     * Register a new decomposition strategy.
     */
    registerDecompositionStrategy(strategy: IDecompositionStrategy): void {
        console.log(`[PlannerEngine] Registering strategy: ${strategy.name}`);
        this.decompositionStrategies.push(strategy);
    }

    /**
     * Register a new hierarchy design strategy.
     */
    registerHierarchyStrategy(strategy: IHierarchyDesignStrategy): void {
        this.hierarchyStrategies.push(strategy);
    }

    /**
     * Selects the best strategy and decomposes the objective.
     */
    decomposeObjective(objective: Objective): { tasks: Task[], strategyUsed: string } {
        if (this.decompositionStrategies.length === 0) {
            throw new Error('No decomposition strategies registered!');
        }

        // Find the best strategy
        let bestStrategy: IDecompositionStrategy | null = null;
        let bestScore = -1;

        console.log(`[PlannerEngine] Evaluating strategies for: "${objective.title}"`);

        for (const strategy of this.decompositionStrategies) {
            const score = strategy.canHandle(objective);
            console.log(`  - ${strategy.name}: ${score.toFixed(2)}`);
            
            if (score > bestScore) {
                bestScore = score;
                bestStrategy = strategy;
            }
        }

        if (!bestStrategy || bestScore === 0) {
            // Fallback to the first one if nothing matches well, or handle gracefully
            console.warn('[PlannerEngine] No strong match found. Using fallback strategy.');
            const fallback = this.decompositionStrategies[0];
            if (!fallback) {
                 throw new Error('No strategies registered!');
            }
            bestStrategy = fallback;
        }

        console.log(`[PlannerEngine] Selected: ${bestStrategy.name}`);

        return {
            tasks: bestStrategy.decompose(objective),
            strategyUsed: bestStrategy.name
        };
    }

    /**
     * Selects the best strategy and designs the hierarchy.
     */
    designHierarchy(companyType: string): any {
        let bestStrategy: IHierarchyDesignStrategy | null = null;
        let bestScore = -1;

        for (const strategy of this.hierarchyStrategies) {
            const score = strategy.canHandle(companyType);
            if (score > bestScore) {
                bestScore = score;
                bestStrategy = strategy;
            }
        }

        if (!bestStrategy) {
             throw new Error('No hierarchy strategy found.');
        }

        return bestStrategy.design(companyType);
    }
}
