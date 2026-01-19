/**
 * Research Strategy
 * 
 * Specialized decomposition for research, analysis, and investigation.
 */

import { IDecompositionStrategy, Objective } from '../IPlanningStrategy.js';
import type { Task, AgentTier } from '../../../types.js';

export class ResearchStrategy implements IDecompositionStrategy {
    readonly name = 'Deep Research Protocol';
    readonly description = 'Systematic approach to gathering and analyzing information.';
    readonly estimatedCost = 3; 

    canHandle(objective: Objective): number {
        const title = objective.title.toLowerCase();
        const keywords = ['research', 'analyze', 'investigate', 'study', 'report', 'evaluate'];
        
        const matchCount = keywords.filter(k => title.includes(k)).length;
        
        if (matchCount > 0) {
            return 0.85 + (matchCount * 0.05);
        }
        return 0.1;
    }

    decompose(objective: Objective): Task[] {
        const tasks: Task[] = [];
        const steps = [
            { name: 'Data Gathering', desc: 'Collect relevant sources and dispersed data', tier: 2 },
            { name: 'Analysis', desc: 'Analyze patterns and extract insights', tier: 3 },
            { name: 'Synthesis & Reporting', desc: 'Compile findings into a final report', tier: 3 }
        ];

        let previousTaskId: string | null = null;

        steps.forEach((step, index) => {
            const taskId = `task-${objective.id}-res-${index}`;
            
            const task: Task = {
                id: taskId,
                title: `${step.name}`,
                description: `${step.desc} for: ${objective.title}`,
                createdBy: 'T5-PLANNER',
                collaborators: [],
                status: 'PENDING',
                priority: objective.priority,
                tier: step.tier as AgentTier,
                dependencies: previousTaskId ? [previousTaskId] : [],
                createdAt: new Date(),
                logs: []
            };

            tasks.push(task);
            previousTaskId = taskId;
        });

        return tasks;
    }
}
