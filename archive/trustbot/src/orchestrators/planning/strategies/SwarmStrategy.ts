/**
 * Swarm Strategy (Fractal Delegation)
 * 
 * Capability: High-Volume Parallel Execution
 * Concept: "Shadow Bots" or "Map-Reduce"
 * 
 * Logic:
 * Detects tasks that imply high cardinality (e.g., "Search 20 sites", "Analyze 50 files").
 * "Splits" the objective into N parallel subtasks (Map phase).
 * Assigns an aggregator task at the end (Reduce phase).
 * 
 * This simulates "riding the context" by assuming all workers share the initial system prompt
 * and only receive their specific shard of work.
 */

import { IDecompositionStrategy, Objective } from '../IPlanningStrategy.js';
import type { Task, AgentTier } from '../../../types.js';

export class SwarmStrategy implements IDecompositionStrategy {
    readonly name = 'Swarm Delegation (Map-Reduce)';
    readonly description = 'Spawns parallel shadow bots for high-volume tasks.';
    readonly estimatedCost = 10; // Higher cost due to multiple agents

    canHandle(objective: Objective): number {
        const title = objective.title.toLowerCase();
        
        // Check for indicators of multiplicity
        const hasNumber = /\d+/.test(title);
        const keywords = ['each', 'every', 'all', 'scan', 'bulk', 'batch', 'parallel', 'swarm'];
        
        const matchCount = keywords.filter(k => title.includes(k)).length;
        
        // Strong signal: Number + Keyword (e.g. "Scan 20 files")
        if (hasNumber && matchCount > 0) {
            return 0.95; 
        }
        
        if (matchCount > 1) {
            return 0.7; // Moderate signal
        }

        return 0.05; // Very weak signal
    }

    decompose(objective: Objective): Task[] {
        const tasks: Task[] = [];
        
        // 1. Determine cardinality (N)
        // Try to parse a number from the string, default to 5 if not found but strategy selected
        const numberMatch = objective.title.match(/(\d+)/);
        let count = numberMatch ? parseInt(numberMatch[0], 10) : 5;
        
        // Cap reasonably for simulation
        if (count > 20) count = 20;

        // 2. Map Phase: Generate N parallel tasks
        const workerIds: string[] = [];
        
        for (let i = 1; i <= count; i++) {
            const taskId = `task-${objective.id}-shard-${i}`;
            workerIds.push(taskId);

            const task: Task = {
                id: taskId,
                title: `[Shadow Bot ${i}] ${objective.title} (Shard ${i}/${count})`,
                description: `Parallel execution unit ${i}. Process subset of target data.`,
                createdBy: 'T5-PLANNER',
                collaborators: [],
                status: 'PENDING',
                priority: objective.priority,
                tier: 2 as AgentTier, // Workers are typically lower tier
                dependencies: [], // No dependencies = Parallel
                createdAt: new Date(),
                logs: []
            };
            tasks.push(task);
        }

        // 3. Reduce Phase: Aggregator
        const reduceTask: Task = {
            id: `task-${objective.id}-reduce`,
            title: `[Aggregator] Synthesize Swarm Results`,
            description: `Collect outputs from ${count} shadow bots and merge into final result.`,
            createdBy: 'T5-PLANNER',
            collaborators: [],
            status: 'PENDING',
            priority: objective.priority,
            tier: 3 as AgentTier, // Aggregator needs slightly higher intelligence
            dependencies: workerIds, // Dependent on ALL workers finishing
            createdAt: new Date(),
            logs: []
        };

        tasks.push(reduceTask);

        return tasks;
    }
}
