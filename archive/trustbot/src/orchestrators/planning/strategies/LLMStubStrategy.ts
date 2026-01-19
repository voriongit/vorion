/**
 * LLM Stub Strategy
 * 
 * Placeholder for future integration with actual Large Language Model APIs.
 * This class demonstrates where the API call would happen.
 */

import { IDecompositionStrategy, Objective } from '../IPlanningStrategy.js';
import type { Task } from '../../../types.js';

export class LLMStubStrategy implements IDecompositionStrategy {
    readonly name = 'Generative AI Planning (LLM)';
    readonly description = 'Uses external LLM to generate creative plans.';
    readonly estimatedCost = 50; 

    canHandle(objective: Objective): number {
        // Currently disabled/passive
        // In the future, this could be enabled by configuration
        return 0.0; 
    }

    decompose(objective: Objective): Task[] {
        // STUB: This is where we would call:
        // const plan = await openai.chat.completions.create({...})
        // return parsePlan(plan);
        
        throw new Error('LLM Strategy is not yet implemented.');
    }
}
