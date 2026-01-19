/**
 * Software Development Strategy
 * 
 * Specialized decomposition for software engineering tasks.
 * Follows a standard SDLC (Software Development Life Cycle) approach.
 */

import { IDecompositionStrategy, Objective } from '../IPlanningStrategy.js';
import type { Task, AgentTier } from '../../../types.js';
import { v4 as uuidv4 } from 'uuid';

export class SoftwareDevStrategy implements IDecompositionStrategy {
    readonly name = 'Software Development SDLC';
    readonly description = 'Standard lifecycle for building software applications.';
    readonly estimatedCost = 5; // Medium complexity

    canHandle(objective: Objective): number {
        const title = objective.title.toLowerCase();
        const keywords = ['build', 'develop', 'implement', 'code', 'app', 'api', 'service', 'frontend', 'backend'];
        
        // Count keyword matches
        const matchCount = keywords.filter(k => title.includes(k)).length;
        
        if (matchCount > 0) {
            return 0.8 + (matchCount * 0.05); // Base 0.8, max boost
        }
        return 0.1; // Weak match otherwise
    }

    decompose(objective: Objective): Task[] {
        const tasks: Task[] = [];
        const phases = [
            { name: 'System Design', role: 'ARCHITECT', tier: 4 },
            { name: 'Implementation', role: 'DEVELOPER', tier: 3 },
            { name: 'Testing', role: 'QA_ENGINEER', tier: 2 },
            { name: 'Deployment', role: 'DEVOPS', tier: 3 }
        ];

        let previousTaskId: string | null = null;

        phases.forEach((phase, index) => {
            const taskId = `task-${objective.id}-sdlc-${index}`;
            
            const task: Task = {
                id: taskId,
                title: `${phase.name}: ${objective.title}`,
                description: `Execute ${phase.name} phase for the objective.`,
                createdBy: 'T5-PLANNER',
                collaborators: [],
                status: 'PENDING',
                priority: objective.priority,
                tier: phase.tier as AgentTier,
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
