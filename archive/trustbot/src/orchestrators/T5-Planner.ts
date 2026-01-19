/**
 * T5-Planner: Strategic Architect
 * 
 * Designs the workforce structure, decomposes objectives into tasks,
 * and creates strategic plans. Adapts the system for different company types.
 * 
 * Responsibilities:
 * - Goal decomposition into domain tasks
 * - Agent hierarchy design
 * - Resource allocation
 * - Long-term capability planning
 * - Daily action plan creation
 */

import { BaseAgent } from '../agents/BaseAgent.js';
import type {
    AgentId,
    AgentLocation,
    AgentTier,
    Task,
    Capability,
} from '../types.js';
import { blackboard } from '../core/Blackboard.js';
// New trust-gated TimeService
import { timeService, TickCallback } from '../core/TimeService.js';
import { TrustTier, TrustState, TickNumber, Timestamp } from '../types/core.js';
import { capabilityResolver } from '../core/CapabilityResolver.js';
import { PlannerEngine } from './planning/PlannerEngine.js';
import { SoftwareDevStrategy } from './planning/strategies/SoftwareDevStrategy.js';
import { ResearchStrategy } from './planning/strategies/ResearchStrategy.js';
import { SwarmStrategy } from './planning/strategies/SwarmStrategy.js';
import { LLMStubStrategy } from './planning/strategies/LLMStubStrategy.js';

// ============================================================================
// Knowledge Base
// ============================================================================

const PLANNER_KNOWLEDGE = {
    role: 'Strategic Architect',
    tier: 5,

    organizationalPatterns: [
        {
            name: 'Functional',
            description: 'Organized by business function',
            domains: ['Sales', 'Marketing', 'Engineering', 'Finance', 'HR', 'Operations'],
            bestFor: 'Traditional companies with clear departmental boundaries',
        },
        {
            name: 'Product',
            description: 'Organized by product lines',
            domains: ['Product A', 'Product B', 'Platform', 'Infrastructure'],
            bestFor: 'Multi-product companies needing product focus',
        },
        {
            name: 'Matrix',
            description: 'Cross-functional teams with domain expertise',
            domains: ['Projects', 'Expertise Centers', 'Shared Services'],
            bestFor: 'Complex organizations needing flexibility',
        },
        {
            name: 'Agile',
            description: 'Squad-based with tribes and chapters',
            domains: ['Squads', 'Tribes', 'Chapters', 'Guilds'],
            bestFor: 'Fast-moving tech companies',
        },
    ],

    decompositionMethods: [
        {
            name: 'WBS',
            description: 'Work Breakdown Structure',
            levels: ['Objective', 'Deliverable', 'Work Package', 'Task', 'Activity'],
        },
        {
            name: 'OKR',
            description: 'Objectives and Key Results',
            levels: ['Objective', 'Key Result', 'Initiative', 'Task'],
        },
        {
            name: 'SMART',
            description: 'Specific, Measurable, Achievable, Relevant, Time-bound',
            levels: ['Strategic Goal', 'SMART Objective', 'Action Item'],
        },
    ],

    resourceAllocation: {
        strategies: [
            'Priority-based: Allocate to highest priority first',
            'Balanced: Even distribution across domains',
            'Capacity-based: Match allocation to agent availability',
            'Dynamic: Real-time reallocation based on demand',
        ],
        constraints: [
            'Trust budget limits',
            'Tier spawn restrictions',
            'Domain expertise requirements',
            'HITL approval requirements',
        ],
    },

    capabilityGaps: {
        identificationMethods: [
            'Task failure analysis',
            'Performance metric review',
            'Agent feedback collection',
            'External trend monitoring',
        ],
        resolutionStrategies: [
            'Spawn new specialized agents',
            'Train existing agents (capability addition)',
            'Cross-domain collaboration',
            'Request human expertise (HITL)',
        ],
    },
};

// ============================================================================
// T5-Planner Class
// ============================================================================

export class T5Planner extends BaseAgent {
    private currentObjectives: Map<string, Objective> = new Map();
    private domainMap: Map<string, AgentId> = new Map(); // domain -> T4 orchestrator
    private dailyPlan: DailyPlan | null = null;
    private localState: Map<string, any> = new Map();
    private plannerEngine: PlannerEngine;

    constructor() {
        super({
            name: 'T5-PLANNER',
            type: 'PLANNER',
            tier: 5,
            parentId: null,
            location: {
                floor: 'EXECUTIVE',
                room: 'PLANNER_OFFICE',
            },
            capabilities: [
                { id: 'goal_decomposition', name: 'Goal Decomposition', description: 'Break down objectives into actionable tasks', requiredTier: 5 },
                { id: 'hierarchy_design', name: 'Hierarchy Design', description: 'Design optimal agent hierarchy', requiredTier: 5 },
                { id: 'resource_allocation', name: 'Resource Allocation', description: 'Allocate trust and resources across domains', requiredTier: 5 },
                { id: 'pattern_recognition', name: 'Pattern Recognition', description: 'Identify successful patterns across projects', requiredTier: 5 },
                { id: 'capability_planning', name: 'Capability Planning', description: 'Plan long-term capability development', requiredTier: 5 },
            ],
        });

        this.metadata['knowledge'] = PLANNER_KNOWLEDGE;

        // Subscribe to TimeService (Planner is Tier 5 = ELITE, gets full temporal control)
        timeService.onTick(this.onTick.bind(this));

        // Initialize Planner Engine and Strategies
        this.plannerEngine = new PlannerEngine();
        this.plannerEngine.registerDecompositionStrategy(new SoftwareDevStrategy());
        this.plannerEngine.registerDecompositionStrategy(new ResearchStrategy());
        this.plannerEngine.registerDecompositionStrategy(new SwarmStrategy());
        this.plannerEngine.registerDecompositionStrategy(new LLMStubStrategy());
    }

    /**
     * Create a mock trust state for T5-Planner (ELITE tier)
     */
    private getTrustState(): TrustState {
        return {
            agentId: this.id as any,
            score: {
                current: 1000,
                tier: TrustTier.ELITE,
                lastActivity: Date.now(),
                graceExpiry: null,
                decayRate: 0,
                floorScore: 950,
            },
            history: [],
            violations: [],
            councilApprovals: [],
            trustCeiling: TrustTier.ELITE,
            parentId: null,
            spawnedAgents: [],
        };
    }

    /**
     * Derive office phase from EST hour
     */
    private getPhaseFromHour(hour: number): 'PLANNING' | 'EXECUTION' | 'REVIEW' | 'IDLE' {
        if (hour >= 9 && hour < 11) return 'PLANNING';
        if (hour >= 11 && hour < 16) return 'EXECUTION';
        if (hour >= 16 && hour < 17) return 'REVIEW';
        return 'IDLE';
    }

    private onTick(tick: TickNumber, timestamp: Timestamp) {
        // Only log every 60 ticks to avoid spamming
        if (tick % 60 === 0) {
            // Get full time context (T5 has ELITE access)
            const trustState = this.getTrustState();
            const timeContext = timeService.getCurrentTime(this.id as any, trustState);

            // Derive phase from wall clock (ELITE has access)
            const estDate = new Date(timeContext.wallClock);
            const estString = estDate.toLocaleString("en-US", { timeZone: "America/New_York" });
            const estTime = new Date(estString);
            const hour = estTime.getHours();
            const phase = this.getPhaseFromHour(hour);

            const formattedTime = estTime.toLocaleTimeString("en-US", {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
            }) + " EST";

            console.log(`[T5-Planner] Tick ${tick} | Phase: ${phase} | Time: ${formattedTime}`);
            this.evaluateSchedule(tick, phase);
        }
    }

    private evaluateSchedule(tick: TickNumber, phase: 'PLANNING' | 'EXECUTION' | 'REVIEW' | 'IDLE') {
        // Daily Planning Trigger (e.g., 9 AM Planning Phase)
        const planningDone = this.localState.get('daily_planning_done');

        if (phase === 'PLANNING' && !planningDone) {
            console.log('[T5-Planner] 🟢 Starting Daily Planning Phase');
            this.createDailyPlan();
            this.localState.set('daily_planning_done', true);
        }

        // Reset daily flag if we move out of planning phase
        if (phase !== 'PLANNING' && planningDone) {
            this.localState.set('daily_planning_done', false);
        }
    }

    protected getDefaultLocation(): AgentLocation {
        return { floor: 'EXECUTIVE', room: 'PLANNER_OFFICE' };
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    async initialize(): Promise<void> {
        await super.initialize();

        this.postToBlackboard({
            type: 'OBSERVATION',
            title: 'T5-PLANNER Online',
            content: {
                message: 'Strategic Architect initialized',
                organizationalPatterns: PLANNER_KNOWLEDGE.organizationalPatterns.map(p => p.name),
                decompositionMethods: PLANNER_KNOWLEDGE.decompositionMethods.map(m => m.name),
            },
            priority: 'HIGH',
        });
    }

    async execute(): Promise<void> {
        while (this.status !== 'TERMINATED') {
            // Handle incoming requests
            const requests = this.getPendingRequests();
            for (const req of requests) {
                await this.handleRequest(req);
            }

            // Review objectives
            await this.reviewObjectives();

            // Identify capability gaps
            await this.identifyCapabilityGaps();

            // Monitor stale tasks and auto-spawn if needed
            await this.monitorStaleTasks();

            await this.pause(1000);
        }
    }

    private async pause(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // -------------------------------------------------------------------------
    // Goal Decomposition
    // -------------------------------------------------------------------------

    /**
     * Decompose a high-level objective into tasks
     */
    // -------------------------------------------------------------------------
    // Goal Decomposition
    // -------------------------------------------------------------------------

    /**
     * Decompose a high-level objective into tasks using the Planner Engine
     */
    decomposeObjective(objective: Objective): Task[] {
        this.makeDecision(
            `Decomposing objective: ${objective.title}`,
            `Delegating to PlannerEngine to select best strategy.`
        );

        try {
            // Use the engine to find the best strategy and decompose
            const result = this.plannerEngine.decomposeObjective(objective);
            
            const tasks = result.tasks;

            // Store objective
            this.currentObjectives.set(objective.id, objective);

            // Post to blackboard
            this.postToBlackboard({
                type: 'TASK',
                title: `Plan: ${objective.title}`,
                content: {
                    objective,
                    tasks: tasks.map(t => t.title),
                    method: result.strategyUsed,
                },
                priority: objective.priority,
            });

            this.remember('DECOMPOSITION', { 
                objectiveId: objective.id, 
                taskCount: tasks.length,
                strategy: result.strategyUsed 
            }, true);

            return tasks;

        } catch (error: boolean | string | Error | any) { // Use 'any' effectively for catch variable if desired, or simpler type
            console.error('[T5-Planner] Decomposition failed:', error);
            // Fallback?
            return [];
        }
    }

    private determineTierForTask(taskDescription: string): AgentTier {
        // Simple heuristic based on keywords
        const strategicKeywords = ['strategy', 'plan', 'design', 'architect'];
        const tacticalKeywords = ['coordinate', 'manage', 'oversee', 'orchestrate'];
        const operationalKeywords = ['implement', 'execute', 'build', 'create'];

        const lower = taskDescription.toLowerCase();

        if (strategicKeywords.some(k => lower.includes(k))) return 4;
        if (tacticalKeywords.some(k => lower.includes(k))) return 3;
        if (operationalKeywords.some(k => lower.includes(k))) return 2;

        return 1; // Default to worker level
    }

    // -------------------------------------------------------------------------
    // Hierarchy Design
    // -------------------------------------------------------------------------

    /**
     * Design agent hierarchy for a company type
     */
    designHierarchy(companyType: string): HierarchyDesign {
        // Find matching organizational pattern
        const pattern = PLANNER_KNOWLEDGE.organizationalPatterns.find(
            p => p.bestFor.toLowerCase().includes(companyType.toLowerCase())
        ) ?? PLANNER_KNOWLEDGE.organizationalPatterns[0]!;

        const design: HierarchyDesign = {
            pattern: pattern.name,
            domains: pattern.domains.map(domain => ({
                name: domain,
                tier4Count: 1,       // One T4 orchestrator per domain
                tier3Count: 2,       // Two task orchestrators
                tier2Count: 5,       // Five specialists
                tier1Count: 10,      // Ten workers
                tier0Count: 3,       // Three listeners
            })),
            totalAgents: 0,
            estimatedTrustBudget: 0,
        };

        // Calculate totals
        for (const domain of design.domains) {
            design.totalAgents += domain.tier4Count + domain.tier3Count +
                domain.tier2Count + domain.tier1Count + domain.tier0Count;
        }
        design.estimatedTrustBudget = design.totalAgents * 100; // 100 trust per agent avg

        this.makeDecision(
            `Hierarchy designed for ${companyType}`,
            `Using ${pattern.name} pattern with ${design.domains.length} domains and ${design.totalAgents} total agents`
        );

        this.postToBlackboard({
            type: 'SOLUTION',
            title: `Hierarchy Design: ${companyType}`,
            content: design,
            priority: 'HIGH',
        });

        return design;
    }

    // -------------------------------------------------------------------------
    // Resource Allocation
    // -------------------------------------------------------------------------

    /**
     * Allocate resources to domains
     */
    allocateResources(totalBudget: number, priorities: Map<string, number>): Map<string, number> {
        const allocation = new Map<string, number>();

        // Calculate total priority weight
        let totalWeight = 0;
        for (const weight of priorities.values()) {
            totalWeight += weight;
        }

        // Allocate proportionally
        for (const [domain, weight] of priorities) {
            const share = Math.floor((weight / totalWeight) * totalBudget);
            allocation.set(domain, share);
        }

        this.makeDecision(
            'Resource allocation completed',
            `Distributed ${totalBudget} trust budget across ${priorities.size} domains`
        );

        return allocation;
    }

    // -------------------------------------------------------------------------
    // Daily Planning
    // -------------------------------------------------------------------------

    /**
     * Create daily action plan
     */
    createDailyPlan(): DailyPlan {
        const plan: DailyPlan = {
            date: new Date(),
            objectives: [],
            scheduledTasks: [],
            meetings: [],
            checkpoints: [],
        };

        // Review current objectives
        for (const [id, objective] of this.currentObjectives) {
            if (objective.status === 'IN_PROGRESS') {
                plan.objectives.push(objective.title);
            }
        }

        // Get open tasks from blackboard
        const openTasks = blackboard.getByType('TASK')
            .filter(e => e.status === 'OPEN')
            .slice(0, 10); // Top 10

        for (const task of openTasks) {
            plan.scheduledTasks.push({
                id: task.id,
                title: task.title,
                priority: task.priority,
            });
        }

        // Standard checkpoints
        plan.checkpoints = [
            { time: '09:00', description: 'Morning check-in with T5-Executor' },
            { time: '12:00', description: 'Mid-day progress review' },
            { time: '17:00', description: 'End-of-day report preparation' },
        ];

        this.dailyPlan = plan;

        this.postToBlackboard({
            type: 'TASK',
            title: `Daily Plan: ${plan.date.toDateString()}`,
            content: plan,
            priority: 'HIGH',
        });

        return plan;
    }

    // -------------------------------------------------------------------------
    // Capability Gap Analysis
    // -------------------------------------------------------------------------

    private async identifyCapabilityGaps(): Promise<void> {
        // Analyze anti-patterns for gaps
        const antiPatterns = blackboard.getAntiPatterns();

        for (const ap of antiPatterns) {
            // Post hypothesis about capability gap
            this.postToBlackboard({
                type: 'HYPOTHESIS',
                title: `Capability Gap: Related to ${ap.title}`,
                content: {
                    observation: ap.content,
                    hypothesis: 'Missing capability causing repeated failures',
                    suggestedResolution: PLANNER_KNOWLEDGE.capabilityGaps.resolutionStrategies[0],
                },
                priority: 'MEDIUM',
            });
        }
    }

    // -------------------------------------------------------------------------
    // Auto-Spawn Logic (Stale Task Monitor)
    // -------------------------------------------------------------------------

    private async monitorStaleTasks(): Promise<void> {
        // Find tasks that are OPEN and older than 30 seconds (simulated staleness)
        const openTasks = blackboard.getByType('TASK').filter(e => e.status === 'OPEN');
        const now = Date.now();
        const STALE_THRESHOLD_MS = 30000; // 30 seconds

        const staleTasks = openTasks.filter(t => {
            const age = now - t.createdAt.getTime();
            return age > STALE_THRESHOLD_MS;
        });

        if (staleTasks.length > 0) {
            console.log(`[T5-Planner] Detected ${staleTasks.length} stale tasks. Initiating auto-spawn sequence.`);
            
            // Group by likely required skill (simplified)
            // In a real system, we'd analyze the task content.
            // Here, we just request a generic worker for now or use the title.
            
            for (const task of staleTasks) {
                // Post a spawn request to the Blackboard (or directly handle if we have T5-Spawner)
                this.postToBlackboard({
                    type: 'DECISION',
                    title: `Auto-Spawn Request: Worker for Task ${task.id.substring(0, 8)}`,
                    content: {
                        action: 'SPAWN_AGENT',
                        reason: 'Task Stagnation',
                        suggestedType: 'WORKER',
                        suggestedTier: 2,
                        targetTask: task.id
                    },
                    priority: 'HIGH'
                });
                
                // Mark task as having a pending action to prevent spamming
                // (In a real impl, we'd update the task metadata or status)
                // For now, let's just log it.
                console.log(`[T5-Planner] Requested spawn for stale task: ${task.title}`);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Request Handling
    // -------------------------------------------------------------------------

    private async handleRequest(msg: any): Promise<void> {
        switch (msg.subject) {
            case 'Daily Plan Request':
                const plan = this.createDailyPlan();
                this.respond(msg.id, { plan: plan.objectives });
                break;

            case 'Decompose Objective':
                const tasks = this.decomposeObjective(msg.content as Objective);
                this.respond(msg.id, { tasks });
                break;

            case 'Design Hierarchy':
                const design = this.designHierarchy(msg.content.companyType);
                this.respond(msg.id, { design });
                break;

            default:
                this.respond(msg.id, { error: 'Unknown request type' });
        }
    }

    // -------------------------------------------------------------------------
    // Objective Review
    // -------------------------------------------------------------------------

    private async reviewObjectives(): Promise<void> {
        for (const [id, objective] of this.currentObjectives) {
            // Check if any key results are blocked
            const relatedTasks = blackboard.search(objective.title);
            const blockedCount = relatedTasks.filter(t => t.status === 'BLOCKED').length;

            if (blockedCount > 0) {
                this.postToBlackboard({
                    type: 'PROBLEM',
                    title: `Objective Blocked: ${objective.title}`,
                    content: {
                        objectiveId: id,
                        blockedTasks: blockedCount,
                        recommendation: 'Review blocked tasks and resolve dependencies',
                    },
                    priority: 'HIGH',
                });
            }
        }
    }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface Objective {
    id: string;
    title: string;
    description: string;
    keyResults: string[];
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    deadline?: Date;
}

interface HierarchyDesign {
    pattern: string;
    domains: Array<{
        name: string;
        tier4Count: number;
        tier3Count: number;
        tier2Count: number;
        tier1Count: number;
        tier0Count: number;
    }>;
    totalAgents: number;
    estimatedTrustBudget: number;
}

interface DailyPlan {
    date: Date;
    objectives: string[];
    scheduledTasks: Array<{ id: string; title: string; priority: string }>;
    meetings: Array<{ time: string; topic: string; participants: AgentId[] }>;
    checkpoints: Array<{ time: string; description: string }>;
}
