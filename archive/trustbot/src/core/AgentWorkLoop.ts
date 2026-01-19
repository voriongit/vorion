/**
 * Agent Work Loop
 *
 * The missing piece that makes agents autonomous. This service runs a continuous
 * work loop for each agent, enabling them to:
 * - Poll for available tasks
 * - Claim and execute tasks
 * - Handle timeouts and retries
 * - Escalate when blocked
 * - Report completion/failure
 *
 * Without this, agents just sit idle waiting to be told what to do.
 */

import { EventEmitter } from 'eventemitter3';
import { getAIClient, AICompletionResult } from './AIProvider.js';
import { WorkLoopPersistence, workLoopPersistence, type WorkLoopState } from './WorkLoopPersistence.js';
import { trustIntegration, TrustIntegration } from './TrustIntegration.js';

// ============================================================================
// Types
// ============================================================================

export type AgentRole = 'PLANNER' | 'EXECUTOR' | 'VALIDATOR' | 'EVOLVER' | 'SPAWNER' | 'WORKER';
export type WorkLoopStatus = 'IDLE' | 'POLLING' | 'EXECUTING' | 'BLOCKED' | 'RECOVERING' | 'STOPPED';

export interface WorkLoopAgent {
    id: string;
    name: string;
    role: AgentRole;
    tier: number;
    status: WorkLoopStatus;
    currentTaskId: string | null;
    consecutiveFailures: number;
    lastActivityAt: number;
    executionCount: number;
    successCount: number;
}

export interface WorkTask {
    id: string;
    title: string;
    description: string;
    type: 'OBJECTIVE' | 'SUBTASK' | 'VALIDATION' | 'PLANNING';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    requiredTier: number;
    requiredRole?: AgentRole;
    parentTaskId?: string;
    dependencies?: string[];
    timeoutMs: number;
    maxRetries: number;
    retryCount: number;
    status: 'QUEUED' | 'CLAIMED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'TIMEOUT';
    assignedTo?: string;
    result?: TaskExecutionResult;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;

    // Validation loop fields
    validationAttempts?: number;      // How many times this task has been validated
    validatedTaskId?: string;         // For VALIDATION tasks: the task being validated
    previousOutput?: string;          // Previous output to improve upon (for re-execution)
    validationFeedback?: string;      // Feedback from validator to guide re-execution
}

export interface TaskExecutionResult {
    success: boolean;
    output: string;
    confidence: number;
    subtasks?: WorkTask[];
    validationScore?: number;
    error?: string;
    duration: number;
}

export interface WorkLoopConfig {
    pollIntervalMs: number;          // How often idle agents check for work
    executionTimeoutMs: number;      // Default timeout for task execution
    maxConsecutiveFailures: number;  // Failures before agent enters recovery
    recoveryBackoffMs: number;       // Base backoff time during recovery
    maxRecoveryAttempts: number;     // Max recovery attempts before escalation
    enableAutoScaling: boolean;      // Spawn workers when queue backs up
    maxWorkersPerRole: number;       // Max workers per role type

    // Validation loop settings
    enableValidationLoop: boolean;   // Auto-validate completed subtasks
    validationThreshold: number;     // Score below which to re-execute (0-100)
    maxValidationAttempts: number;   // Max re-executions before accepting
    validateHighPriorityOnly: boolean; // Only validate HIGH/CRITICAL priority tasks
}

interface WorkLoopEvents {
    'agent:started': (agent: WorkLoopAgent) => void;
    'agent:stopped': (agent: WorkLoopAgent) => void;
    'agent:blocked': (agent: WorkLoopAgent, reason: string) => void;
    'task:claimed': (agent: WorkLoopAgent, task: WorkTask) => void;
    'task:completed': (agent: WorkLoopAgent, task: WorkTask, result: TaskExecutionResult) => void;
    'task:failed': (agent: WorkLoopAgent, task: WorkTask, error: string) => void;
    'task:timeout': (agent: WorkLoopAgent, task: WorkTask) => void;
    'escalation': (agent: WorkLoopAgent, task: WorkTask, reason: string) => void;
    'objective:decomposed': (task: WorkTask, subtasks: WorkTask[]) => void;

    // Validation loop events
    'validation:queued': (originalTask: WorkTask, validationTask: WorkTask) => void;
    'validation:passed': (originalTask: WorkTask, score: number) => void;
    'validation:failed': (originalTask: WorkTask, score: number, feedback: string) => void;
    'validation:requeued': (originalTask: WorkTask, attempt: number) => void;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: WorkLoopConfig = {
    pollIntervalMs: 1000,
    executionTimeoutMs: 30000,
    maxConsecutiveFailures: 3,
    recoveryBackoffMs: 5000,
    maxRecoveryAttempts: 3,
    enableAutoScaling: true,
    maxWorkersPerRole: 10,

    // Validation loop defaults
    enableValidationLoop: true,
    validationThreshold: 70,         // Re-execute if score < 70%
    maxValidationAttempts: 3,        // Max 3 attempts before accepting
    validateHighPriorityOnly: false, // Validate all priorities
};

// ============================================================================
// Role-Specific Prompts
// ============================================================================

const ROLE_PROMPTS: Record<AgentRole, string> = {
    PLANNER: `You are a T5 Planner agent in the Aurais autonomous AI system.

Your role is to decompose high-level objectives into executable subtasks.

When given an objective:
1. Analyze what needs to be accomplished
2. Break it down into 3-7 concrete subtasks
3. Identify dependencies between subtasks
4. Assign priority and required capabilities to each
5. Return a structured plan

Output format (JSON):
{
    "analysis": "Brief analysis of the objective",
    "subtasks": [
        {
            "title": "Subtask title",
            "description": "What needs to be done",
            "type": "SUBTASK",
            "priority": "HIGH|MEDIUM|LOW",
            "requiredRole": "WORKER|VALIDATOR",
            "dependencies": ["id-of-dependent-task"],
            "estimatedComplexity": 1-10
        }
    ],
    "executionOrder": "Description of how subtasks should be executed",
    "risks": ["Potential risks or blockers"]
}`,

    EXECUTOR: `You are a T5 Executor agent in the Aurais autonomous AI system.

Your role is to coordinate task execution and aggregate results.

When given a task:
1. Verify all dependencies are met
2. Coordinate with workers to execute
3. Monitor progress and handle blockers
4. Aggregate results from subtasks
5. Report overall completion status

Output format (JSON):
{
    "status": "COMPLETED|FAILED|BLOCKED",
    "summary": "What was accomplished",
    "results": { "key findings or outputs" },
    "blockers": ["Any issues encountered"],
    "recommendations": ["Next steps or improvements"]
}`,

    VALIDATOR: `You are a T5 Validator agent in the Aurais autonomous AI system.

Your role is to validate task outputs and ensure quality.

When validating work:
1. Check if the output meets the task requirements
2. Verify correctness and completeness
3. Identify any errors or gaps
4. Assign a quality score (0-100)
5. Provide specific feedback for improvement

Output format (JSON):
{
    "valid": true|false,
    "score": 0-100,
    "findings": [
        {
            "type": "ERROR|WARNING|SUGGESTION",
            "description": "What was found",
            "location": "Where in the output",
            "fix": "How to fix it"
        }
    ],
    "summary": "Overall assessment",
    "passThreshold": true|false
}`,

    EVOLVER: `You are a T5 Evolver agent in the Aurais autonomous AI system.

Your role is to learn from execution history and improve the system.

When analyzing execution:
1. Identify patterns in successes and failures
2. Find optimization opportunities
3. Suggest prompt improvements
4. Recommend capability adjustments
5. Propose process improvements

Output format (JSON):
{
    "patterns": [
        {
            "type": "SUCCESS|FAILURE|INEFFICIENCY",
            "description": "What pattern was observed",
            "frequency": "How often it occurs",
            "impact": "HIGH|MEDIUM|LOW"
        }
    ],
    "recommendations": [
        {
            "type": "PROMPT|PROCESS|CAPABILITY",
            "description": "What should change",
            "rationale": "Why this improves things",
            "priority": "HIGH|MEDIUM|LOW"
        }
    ],
    "metrics": {
        "successRate": 0-100,
        "avgExecutionTime": "duration",
        "commonFailures": ["list of common issues"]
    }
}`,

    SPAWNER: `You are a T5 Spawner agent in the Aurais autonomous AI system.

Your role is to create new worker agents when needed.

When spawning:
1. Assess the capability gap
2. Design the worker's specialization
3. Define initial trust constraints
4. Set up monitoring parameters
5. Provide onboarding tasks

Output format (JSON):
{
    "recommendation": "SPAWN|WAIT|REUSE",
    "workerSpec": {
        "name": "Descriptive name",
        "role": "WORKER",
        "specialization": "What they're good at",
        "initialTier": 1-2,
        "capabilities": ["list of capabilities"],
        "onboardingTasks": ["initial tasks to build trust"]
    },
    "rationale": "Why this worker is needed",
    "alternativeOptions": ["Other ways to solve the capacity issue"]
}`,

    WORKER: `You are a Worker agent in the Aurais autonomous AI system.

Your role is to execute specific tasks assigned to you.

When executing a task:
1. Understand exactly what is required
2. Execute the work to the best of your ability
3. Document your process and findings
4. Report results clearly
5. Flag any blockers or uncertainties

Output format (JSON):
{
    "status": "COMPLETED|FAILED|BLOCKED",
    "output": "The actual work product or result",
    "process": "How you approached the task",
    "confidence": 0-100,
    "blockers": ["Any issues that prevented completion"],
    "notes": "Additional context or observations"
}`,
};

// ============================================================================
// Agent Work Loop Service
// ============================================================================

export class AgentWorkLoop extends EventEmitter<WorkLoopEvents> {
    private config: WorkLoopConfig;
    private agents: Map<string, WorkLoopAgent> = new Map();
    private taskQueue: WorkTask[] = [];
    private activeTasks: Map<string, WorkTask> = new Map();
    private completedTasks: Map<string, WorkTask> = new Map();
    private agentLoops: Map<string, NodeJS.Timeout> = new Map();
    private running = false;
    private persistence: WorkLoopPersistence;
    private autoSaveInterval: NodeJS.Timeout | null = null;
    private stateRestored = false;

    constructor(config: Partial<WorkLoopConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.persistence = workLoopPersistence;
    }

    // -------------------------------------------------------------------------
    // Persistence
    // -------------------------------------------------------------------------

    /**
     * Save current state to disk
     */
    saveState(): boolean {
        return this.persistence.save(
            this.agents,
            this.taskQueue,
            this.activeTasks,
            this.completedTasks
        );
    }

    /**
     * Restore state from disk
     */
    restoreState(): boolean {
        const state = this.persistence.load();
        if (!state) return false;

        // Restore worker agents (T5 agents are always recreated fresh)
        for (const agent of state.agents) {
            const workLoopAgent: WorkLoopAgent = {
                id: agent.id,
                name: agent.name,
                role: agent.role,
                tier: agent.tier,
                status: 'IDLE',
                currentTaskId: null,
                consecutiveFailures: 0,
                lastActivityAt: Date.now(),
                executionCount: agent.executionCount,
                successCount: agent.successCount,
            };
            this.agents.set(agent.id, workLoopAgent);
        }

        // Restore task queue (re-queue active tasks that were interrupted)
        this.taskQueue = [
            ...state.taskQueue,
            ...state.activeTasks.map(t => ({ ...t, status: 'QUEUED' as const, assignedTo: undefined })),
        ];

        // Restore completed tasks
        for (const task of state.completedTasks) {
            this.completedTasks.set(task.id, task);
        }

        this.stateRestored = true;
        console.log(`[AgentWorkLoop] State restored: ${this.agents.size} workers, ${this.taskQueue.length} queued tasks, ${this.completedTasks.size} completed`);

        return true;
    }

    /**
     * Start auto-save timer
     */
    private startAutoSave(): void {
        if (this.autoSaveInterval) return;

        // Save every 10 seconds
        this.autoSaveInterval = setInterval(() => {
            if (this.running) {
                this.saveState();
            }
        }, 10000);
    }

    /**
     * Stop auto-save timer
     */
    private stopAutoSave(): void {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    start(): void {
        if (this.running) return;
        this.running = true;
        console.log('[AgentWorkLoop] Starting work loop service');

        // Try to restore state from disk
        if (!this.stateRestored) {
            this.restoreState();
        }

        // Set up trust event listeners for tier changes
        this.setupTrustEventListeners();

        // Start work loops for all registered agents
        for (const agent of this.agents.values()) {
            this.startAgentLoop(agent);
        }

        // Start auto-save
        this.startAutoSave();
    }

    /**
     * Set up listeners for trust tier change events
     */
    private setupTrustEventListeners(): void {
        // Listen for agent promotions
        trustIntegration.on('trust:agent_promoted', (agentId, newTier, previousTier) => {
            const agent = this.agents.get(agentId);
            if (agent) {
                const oldTier = agent.tier;
                agent.tier = newTier;
                console.log(`[AgentWorkLoop] Trust promotion: ${agent.name} T${oldTier} -> T${newTier} (trust-based)`);
            }
        });

        // Listen for agent demotions
        trustIntegration.on('trust:agent_demoted', (agentId, newTier, previousTier) => {
            const agent = this.agents.get(agentId);
            if (agent) {
                const oldTier = agent.tier;
                agent.tier = newTier;
                console.log(`[AgentWorkLoop] Trust demotion: ${agent.name} T${oldTier} -> T${newTier} (trust-based)`);

                // If agent was executing a task above their new tier, move to blocked
                if (agent.currentTaskId) {
                    const task = this.activeTasks.get(agent.currentTaskId);
                    if (task && task.requiredTier > newTier) {
                        agent.status = 'BLOCKED';
                        this.emit('agent:blocked', agent, `Trust tier dropped below task requirement (T${newTier} < T${task.requiredTier})`);
                    }
                }
            }
        });

        // Listen for failure detection (accelerated decay warning)
        trustIntegration.on('trust:failure_detected', (agentId, failureCount) => {
            const agent = this.agents.get(agentId);
            if (agent) {
                console.log(`[AgentWorkLoop] Trust failure alert: ${agent.name} has ${failureCount} failures (accelerated decay may be active)`);
            }
        });

        console.log('[AgentWorkLoop] Trust event listeners configured');
    }

    stop(): void {
        if (!this.running) return;
        this.running = false;
        console.log('[AgentWorkLoop] Stopping work loop service');

        // Stop auto-save
        this.stopAutoSave();

        // Final save before stopping
        this.saveState();

        // Stop all agent loops
        for (const [agentId, interval] of this.agentLoops.entries()) {
            clearInterval(interval);
            this.agentLoops.delete(agentId);
            const agent = this.agents.get(agentId);
            if (agent) {
                agent.status = 'STOPPED';
                this.emit('agent:stopped', agent);
            }
        }

        // Shutdown trust integration (saves all trust records)
        trustIntegration.shutdown().catch(err => {
            console.error('[AgentWorkLoop] Error shutting down trust integration:', err);
        });
    }

    // -------------------------------------------------------------------------
    // Agent Management
    // -------------------------------------------------------------------------

    registerAgent(params: {
        id: string;
        name: string;
        role: AgentRole;
        tier: number;
    }): WorkLoopAgent {
        const agent: WorkLoopAgent = {
            ...params,
            status: 'IDLE',
            currentTaskId: null,
            consecutiveFailures: 0,
            lastActivityAt: Date.now(),
            executionCount: 0,
            successCount: 0,
        };

        this.agents.set(agent.id, agent);

        // Initialize trust scoring for this agent (restores from persistence if exists)
        trustIntegration.initializeAgent(agent).then(async (record) => {
            // Check if this is a restored agent (has signals already) or a new one
            const isRestored = record.signals && record.signals.length > 0;

            if (!isRestored) {
                // Record identity signal for agent registration
                await trustIntegration.recordAgentRegistered(agent);
                // Record baseline signals across all dimensions to maintain initial tier
                await trustIntegration.recordInitialBaseline(agent);
            } else {
                // Update agent tier from restored trust record
                agent.tier = record.level;
                console.log(`[AgentWorkLoop] Restored ${agent.name} trust tier to T${record.level}`);
            }
        }).catch(err => {
            console.error(`[AgentWorkLoop] Failed to initialize trust for ${agent.name}:`, err);
        });

        console.log(`[AgentWorkLoop] Registered agent: ${agent.name} (${agent.role}, T${agent.tier})`);

        if (this.running) {
            this.startAgentLoop(agent);
        }

        return agent;
    }

    unregisterAgent(agentId: string): void {
        const interval = this.agentLoops.get(agentId);
        if (interval) {
            clearInterval(interval);
            this.agentLoops.delete(agentId);
        }

        const agent = this.agents.get(agentId);
        if (agent) {
            this.emit('agent:stopped', agent);
        }

        this.agents.delete(agentId);
    }

    getAgent(agentId: string): WorkLoopAgent | undefined {
        return this.agents.get(agentId);
    }

    getAllAgents(): WorkLoopAgent[] {
        return Array.from(this.agents.values());
    }

    // -------------------------------------------------------------------------
    // Task Management
    // -------------------------------------------------------------------------

    submitTask(task: Omit<WorkTask, 'id' | 'status' | 'retryCount' | 'createdAt'>): WorkTask {
        const fullTask: WorkTask = {
            ...task,
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: 'QUEUED',
            retryCount: 0,
            createdAt: Date.now(),
            timeoutMs: task.timeoutMs || this.config.executionTimeoutMs,
            maxRetries: task.maxRetries || 3,
        };

        this.taskQueue.push(fullTask);
        console.log(`[AgentWorkLoop] Task queued: ${fullTask.title} (${fullTask.type})`);

        return fullTask;
    }

    submitObjective(title: string, description: string, priority: WorkTask['priority'] = 'MEDIUM'): WorkTask {
        return this.submitTask({
            title,
            description,
            type: 'OBJECTIVE',
            priority,
            requiredTier: 5,
            requiredRole: 'PLANNER',
            timeoutMs: 60000, // 1 minute for planning
            maxRetries: 2,
        });
    }

    getQueuedTasks(): WorkTask[] {
        return [...this.taskQueue];
    }

    getActiveTasks(): WorkTask[] {
        return Array.from(this.activeTasks.values());
    }

    getCompletedTasks(): WorkTask[] {
        return Array.from(this.completedTasks.values());
    }

    getTaskById(taskId: string): WorkTask | undefined {
        return this.taskQueue.find(t => t.id === taskId)
            || this.activeTasks.get(taskId)
            || this.completedTasks.get(taskId);
    }

    /**
     * Clear all queued tasks (does not affect active or completed tasks)
     */
    clearQueue(): number {
        const count = this.taskQueue.length;
        this.taskQueue = [];
        console.log(`[AgentWorkLoop] Cleared ${count} queued tasks`);
        return count;
    }

    /**
     * Clear completed tasks history
     */
    clearCompleted(): number {
        const count = this.completedTasks.size;
        this.completedTasks.clear();
        console.log(`[AgentWorkLoop] Cleared ${count} completed tasks`);
        return count;
    }

    // -------------------------------------------------------------------------
    // Work Loop
    // -------------------------------------------------------------------------

    private startAgentLoop(agent: WorkLoopAgent): void {
        if (this.agentLoops.has(agent.id)) return;

        const loop = setInterval(() => {
            this.agentTick(agent);
        }, this.config.pollIntervalMs);

        this.agentLoops.set(agent.id, loop);
        this.emit('agent:started', agent);
        console.log(`[AgentWorkLoop] Started loop for ${agent.name}`);
    }

    private async agentTick(agent: WorkLoopAgent): Promise<void> {
        // Skip if not running or agent is in a blocking state
        if (!this.running) return;
        if (agent.status === 'STOPPED' || agent.status === 'BLOCKED') return;

        // If executing, check for timeout
        if (agent.status === 'EXECUTING' && agent.currentTaskId) {
            const task = this.activeTasks.get(agent.currentTaskId);
            if (task && task.startedAt) {
                const elapsed = Date.now() - task.startedAt;
                if (elapsed > task.timeoutMs) {
                    await this.handleTimeout(agent, task);
                }
            }
            return;
        }

        // If recovering, apply backoff
        if (agent.status === 'RECOVERING') {
            const backoff = this.config.recoveryBackoffMs * Math.pow(2, agent.consecutiveFailures - 1);
            const timeSinceLastActivity = Date.now() - agent.lastActivityAt;
            if (timeSinceLastActivity < backoff) {
                return; // Still in backoff period
            }
            // Recovery complete, try again
            agent.status = 'IDLE';
        }

        // Poll for work
        agent.status = 'POLLING';
        const task = this.claimTask(agent);

        if (task) {
            await this.executeTask(agent, task);
        } else {
            agent.status = 'IDLE';
        }
    }

    private claimTask(agent: WorkLoopAgent): WorkTask | null {
        // Find a suitable task for this agent
        const taskIndex = this.taskQueue.findIndex(task => {
            // Check tier requirement
            if (agent.tier < task.requiredTier) return false;

            // Check role requirement
            if (task.requiredRole && task.requiredRole !== agent.role) return false;

            // Check dependencies (supports IDs, titles, and fuzzy matching)
            if (task.dependencies && task.dependencies.length > 0) {
                const allDepsCompleted = task.dependencies.every(depRef => {
                    // Try by ID first
                    let dep = this.completedTasks.get(depRef);
                    if (dep && dep.status === 'COMPLETED') return true;

                    // Extract words for matching (split on non-alphanumeric, lowercase)
                    const extractWords = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 0);
                    const refWords = extractWords(depRef);

                    // Fallback: try by title with fuzzy matching
                    for (const completed of this.completedTasks.values()) {
                        if (completed.status !== 'COMPLETED') continue;

                        // Exact title match
                        if (completed.title === depRef) return true;

                        // Word-based match: all ref words must appear in title
                        const titleWords = extractWords(completed.title);
                        const allWordsMatch = refWords.every(refWord =>
                            titleWords.some(titleWord =>
                                titleWord.includes(refWord) || refWord.includes(titleWord)
                            )
                        );
                        if (allWordsMatch && refWords.length > 0) {
                            return true;
                        }
                    }
                    return false;
                });
                if (!allDepsCompleted) return false;
            }

            return true;
        });

        if (taskIndex === -1) return null;

        // Claim the task
        const task = this.taskQueue.splice(taskIndex, 1)[0];
        if (!task) return null;

        task.status = 'CLAIMED';
        task.assignedTo = agent.id;
        agent.currentTaskId = task.id;
        this.activeTasks.set(task.id, task);

        this.emit('task:claimed', agent, task);
        console.log(`[AgentWorkLoop] ${agent.name} claimed: ${task.title}`);

        // Record trust signals for task claiming
        this.recordClaimSignals(agent, task);

        return task;
    }

    private async executeTask(agent: WorkLoopAgent, task: WorkTask): Promise<void> {
        agent.status = 'EXECUTING';
        task.status = 'IN_PROGRESS';
        task.startedAt = Date.now();

        console.log(`[AgentWorkLoop] ${agent.name} executing: ${task.title}`);

        try {
            const result = await this.runTaskWithAI(agent, task);

            // Update stats
            agent.executionCount++;
            agent.lastActivityAt = Date.now();

            if (result.success) {
                await this.handleSuccess(agent, task, result);
            } else {
                await this.handleFailure(agent, task, result.error || 'Unknown error');
            }
        } catch (error) {
            await this.handleFailure(agent, task, error instanceof Error ? error.message : 'Execution error');
        }
    }

    private async runTaskWithAI(agent: WorkLoopAgent, task: WorkTask): Promise<TaskExecutionResult> {
        const startTime = Date.now();

        try {
            // Build the prompt for this agent's role
            const systemPrompt = ROLE_PROMPTS[agent.role];
            const taskPrompt = this.buildTaskPrompt(task);

            // Call AI provider
            const aiClient = getAIClient();
            const response = await aiClient.complete([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: taskPrompt },
            ], {
                temperature: 0.7,
                maxTokens: 4096,
            });

            // Parse the response
            const result = this.parseAIResponse(agent, task, response);
            result.duration = Date.now() - startTime;

            return result;
        } catch (error) {
            return {
                success: false,
                output: '',
                confidence: 0,
                error: error instanceof Error ? error.message : 'AI call failed',
                duration: Date.now() - startTime,
            };
        }
    }

    private buildTaskPrompt(task: WorkTask): string {
        let prompt = `## Task: ${task.title}\n\n`;
        prompt += `**Description:** ${task.description}\n\n`;
        prompt += `**Type:** ${task.type}\n`;
        prompt += `**Priority:** ${task.priority}\n\n`;

        if (task.parentTaskId) {
            const parent = this.getTaskById(task.parentTaskId);
            if (parent) {
                prompt += `**Parent Objective:** ${parent.title}\n`;
                prompt += `${parent.description}\n\n`;
            }
        }

        if (task.dependencies && task.dependencies.length > 0) {
            prompt += `**Dependencies Completed:**\n`;
            for (const depRef of task.dependencies) {
                // Use fuzzy matching to find the dependency
                const dep = this.findCompletedTask(depRef);
                if (dep && dep.result) {
                    // Ensure output is a string (could be object from AI response)
                    let output = dep.result.output || 'Task completed successfully';
                    if (typeof output !== 'string') {
                        output = JSON.stringify(output);
                    }
                    prompt += `- ${dep.title}: ${output.substring(0, 500)}${output.length > 500 ? '...' : ''}\n`;
                }
            }
            prompt += '\n';
        }

        prompt += `Please execute this task according to your role and return a JSON response.`;

        return prompt;
    }

    private parseAIResponse(agent: WorkLoopAgent, task: WorkTask, response: AICompletionResult): TaskExecutionResult {
        try {
            // Try to extract JSON from the response
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return {
                    success: true,
                    output: response.content,
                    confidence: 70,
                    duration: 0,
                };
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // Handle role-specific responses
            if (agent.role === 'PLANNER' && parsed.subtasks) {
                // Create subtasks from planner output
                const subtasks = this.createSubtasks(task, parsed.subtasks);
                return {
                    success: true,
                    output: parsed.analysis || response.content,
                    confidence: 85,
                    subtasks,
                    duration: 0,
                };
            }

            if (agent.role === 'VALIDATOR') {
                // Extract error details from findings if validation failed
                let errorDetails = '';
                if (parsed.valid === false && parsed.findings) {
                    errorDetails = parsed.findings
                        .filter((f: any) => f.type === 'ERROR')
                        .map((f: any) => f.description)
                        .join('; ') || parsed.summary || 'Validation failed';
                }

                return {
                    success: parsed.valid !== false,
                    output: parsed.summary || response.content,
                    confidence: parsed.score || 75,
                    validationScore: parsed.score,
                    error: parsed.valid === false ? errorDetails : undefined,
                    duration: 0,
                };
            }

            // Generic response handling
            return {
                success: parsed.status !== 'FAILED' && parsed.status !== 'BLOCKED',
                output: parsed.output || parsed.summary || response.content,
                confidence: parsed.confidence || 75,
                duration: 0,
            };
        } catch {
            // If JSON parsing fails, treat as successful text output
            return {
                success: true,
                output: response.content,
                confidence: 60,
                duration: 0,
            };
        }
    }

    /**
     * Find a completed task by ID, title, or fuzzy match
     */
    private findCompletedTask(depRef: string): WorkTask | undefined {
        // Try by ID first
        let dep = this.completedTasks.get(depRef);
        if (dep) return dep;

        // Extract words for matching (split on non-alphanumeric, lowercase)
        const extractWords = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 0);
        const refWords = extractWords(depRef);

        // Try fuzzy matching
        for (const completed of this.completedTasks.values()) {
            // Exact title match
            if (completed.title === depRef) return completed;

            // Word-based match: all ref words must appear in title
            const titleWords = extractWords(completed.title);
            const allWordsMatch = refWords.every(refWord =>
                titleWords.some(titleWord =>
                    titleWord.includes(refWord) || refWord.includes(titleWord)
                )
            );
            if (allWordsMatch && refWords.length > 0) {
                return completed;
            }
        }
        return undefined;
    }

    private createSubtasks(parentTask: WorkTask, subtaskSpecs: any[]): WorkTask[] {
        const subtasks: WorkTask[] = [];

        for (const spec of subtaskSpecs) {
            const subtask = this.submitTask({
                title: spec.title,
                description: spec.description,
                type: 'SUBTASK',
                priority: spec.priority || 'MEDIUM',
                requiredTier: spec.requiredTier || 2,
                requiredRole: spec.requiredRole || 'WORKER',
                parentTaskId: parentTask.id,
                dependencies: spec.dependencies,
                timeoutMs: this.config.executionTimeoutMs,
                maxRetries: 3,
            });
            subtasks.push(subtask);
        }

        this.emit('objective:decomposed', parentTask, subtasks);
        console.log(`[AgentWorkLoop] Decomposed objective into ${subtasks.length} subtasks`);

        return subtasks;
    }

    // -------------------------------------------------------------------------
    // Result Handlers
    // -------------------------------------------------------------------------

    private async handleSuccess(agent: WorkLoopAgent, task: WorkTask, result: TaskExecutionResult): Promise<void> {
        task.status = 'COMPLETED';
        task.completedAt = Date.now();
        task.result = result;

        // Move to completed
        this.activeTasks.delete(task.id);
        this.completedTasks.set(task.id, task);

        // Update agent
        agent.currentTaskId = null;
        agent.consecutiveFailures = 0;
        agent.successCount++;
        agent.status = 'IDLE';

        this.emit('task:completed', agent, task, result);
        console.log(`[AgentWorkLoop] ${agent.name} completed: ${task.title} (confidence: ${result.confidence}%)`);

        // Record trust signals for successful task completion
        this.recordCompletionSignals(agent, task, result);

        // If this was a planning task and subtasks were created, they're already queued
        if (result.subtasks && result.subtasks.length > 0) {
            console.log(`[AgentWorkLoop] ${result.subtasks.length} subtasks queued for execution`);
            // Record decomposition signal for planners
            trustIntegration.recordObjectiveDecomposed(agent, task, result.subtasks.length).catch(err => {
                console.error(`[AgentWorkLoop] Failed to record decomposition signal:`, err);
            });
        }

        // =====================================================================
        // VALIDATION LOOP HANDLING
        // =====================================================================

        // If this was a VALIDATION task, handle the validation result
        if (task.type === 'VALIDATION' && task.validatedTaskId) {
            await this.handleValidationResult(task, result);
        }
        // If this was a SUBTASK, potentially queue validation
        else if (task.type === 'SUBTASK' && this.shouldValidate(task)) {
            this.queueValidationTask(task);
        }

        // Check if this completes a parent objective
        if (task.parentTaskId) {
            this.checkObjectiveCompletion(task.parentTaskId);
        }

        // Save state after completion
        this.saveState();
    }

    // -------------------------------------------------------------------------
    // Validation Loop Methods
    // -------------------------------------------------------------------------

    /**
     * Determine if a task should be validated
     */
    private shouldValidate(task: WorkTask): boolean {
        if (!this.config.enableValidationLoop) return false;
        if (task.type !== 'SUBTASK') return false;

        // Check priority filter
        if (this.config.validateHighPriorityOnly) {
            if (task.priority !== 'HIGH' && task.priority !== 'CRITICAL') {
                return false;
            }
        }

        // Check if already at max validation attempts
        const attempts = task.validationAttempts || 0;
        if (attempts >= this.config.maxValidationAttempts) {
            console.log(`[ValidationLoop] ${task.title} already at max validation attempts (${attempts})`);
            return false;
        }

        return true;
    }

    /**
     * Queue a validation task for a completed subtask
     */
    private queueValidationTask(originalTask: WorkTask): void {
        // Ensure output is a string (could be object from AI response)
        let taskOutput = originalTask.result?.output || 'No output provided';
        if (typeof taskOutput !== 'string') {
            taskOutput = JSON.stringify(taskOutput, null, 2);
        }

        const validationTask = this.submitTask({
            title: `Validate: ${originalTask.title}`,
            description: `Validate the output of task "${originalTask.title}".

**Original Task Description:**
${originalTask.description}

**Task Output to Validate:**
${taskOutput}

Please verify:
1. The output correctly addresses the task requirements
2. The result is accurate and complete
3. There are no errors or issues

Assign a score (0-100) and provide specific feedback.`,
            type: 'VALIDATION',
            priority: originalTask.priority,
            requiredTier: 5, // Validators are T5
            requiredRole: 'VALIDATOR',
            parentTaskId: originalTask.parentTaskId,
            timeoutMs: this.config.executionTimeoutMs,
            maxRetries: 2,
        });

        // Link validation task to original
        validationTask.validatedTaskId = originalTask.id;

        this.emit('validation:queued', originalTask, validationTask);
        console.log(`[ValidationLoop] Queued validation for: ${originalTask.title}`);
    }

    /**
     * Handle the result of a validation task
     */
    private async handleValidationResult(validationTask: WorkTask, result: TaskExecutionResult): Promise<void> {
        const originalTaskId = validationTask.validatedTaskId!;
        const originalTask = this.completedTasks.get(originalTaskId);

        if (!originalTask) {
            console.log(`[ValidationLoop] Original task ${originalTaskId} not found`);
            return;
        }

        const score = result.validationScore || result.confidence;
        const threshold = this.config.validationThreshold;

        console.log(`[ValidationLoop] Validation score for "${originalTask.title}": ${score}% (threshold: ${threshold}%)`);

        if (score >= threshold) {
            // Validation passed
            this.emit('validation:passed', originalTask, score);
            console.log(`[ValidationLoop] ✓ Validation PASSED for: ${originalTask.title}`);

            // Record trust signal for validation pass (for the original task's agent)
            const originalAgent = originalTask.assignedTo ? this.agents.get(originalTask.assignedTo) : null;
            if (originalAgent) {
                trustIntegration.recordValidationPassed(originalAgent, originalTask, score).catch(err => {
                    console.error(`[AgentWorkLoop] Failed to record validation pass signal:`, err);
                });
            }
        } else {
            // Validation failed - check if we should re-execute
            const attempts = (originalTask.validationAttempts || 0) + 1;
            originalTask.validationAttempts = attempts;

            // Extract feedback from validation result
            const feedback = result.output || 'Validation failed - please improve the output';

            this.emit('validation:failed', originalTask, score, feedback);
            console.log(`[ValidationLoop] ✗ Validation FAILED for: ${originalTask.title} (attempt ${attempts}/${this.config.maxValidationAttempts})`);

            // Record trust signal for validation failure (for the original task's agent)
            const originalAgent = originalTask.assignedTo ? this.agents.get(originalTask.assignedTo) : null;
            if (originalAgent) {
                trustIntegration.recordValidationFailed(originalAgent, originalTask, score).catch(err => {
                    console.error(`[AgentWorkLoop] Failed to record validation fail signal:`, err);
                });
            }

            if (attempts < this.config.maxValidationAttempts) {
                // Re-queue the original task for re-execution
                this.requeueTaskForImprovement(originalTask, feedback);
            } else {
                console.log(`[ValidationLoop] Max attempts reached for: ${originalTask.title} - accepting current result`);
            }
        }
    }

    /**
     * Re-queue a task for improvement based on validation feedback
     */
    private requeueTaskForImprovement(originalTask: WorkTask, feedback: string): void {
        // Remove from completed tasks
        this.completedTasks.delete(originalTask.id);

        // Create improved version of the task
        const improvedTask = this.submitTask({
            title: originalTask.title,
            description: `${originalTask.description}

**IMPROVEMENT REQUIRED - Validation Feedback:**
${feedback}

**Previous Output (to improve upon):**
${originalTask.result?.output || 'No previous output'}

Please address the validation feedback and provide an improved result.`,
            type: 'SUBTASK',
            priority: originalTask.priority,
            requiredTier: originalTask.requiredTier,
            requiredRole: originalTask.requiredRole,
            parentTaskId: originalTask.parentTaskId,
            dependencies: originalTask.dependencies,
            timeoutMs: originalTask.timeoutMs,
            maxRetries: originalTask.maxRetries,
        });

        // Carry over validation attempt count
        improvedTask.validationAttempts = originalTask.validationAttempts;
        improvedTask.previousOutput = originalTask.result?.output;
        improvedTask.validationFeedback = feedback;

        this.emit('validation:requeued', originalTask, improvedTask.validationAttempts || 1);
        console.log(`[ValidationLoop] Re-queued for improvement: ${originalTask.title} (attempt ${improvedTask.validationAttempts})`);
    }

    private async handleFailure(agent: WorkLoopAgent, task: WorkTask, error: string): Promise<void> {
        console.log(`[AgentWorkLoop] ${agent.name} failed: ${task.title} - ${error}`);

        task.retryCount++;
        agent.consecutiveFailures++;
        agent.currentTaskId = null;

        this.emit('task:failed', agent, task, error);

        // Record trust signal for task failure
        trustIntegration.recordTaskFailed(agent, task, error).catch(err => {
            console.error(`[AgentWorkLoop] Failed to record failure signal:`, err);
        });

        // Check if we should retry
        if (task.retryCount < task.maxRetries) {
            console.log(`[AgentWorkLoop] Retrying task (${task.retryCount}/${task.maxRetries})`);
            task.status = 'QUEUED';
            task.assignedTo = undefined;
            this.activeTasks.delete(task.id);
            this.taskQueue.push(task);
            agent.status = 'IDLE';
        } else {
            // Max retries exceeded - mark failed
            task.status = 'FAILED';
            task.completedAt = Date.now();
            task.result = {
                success: false,
                output: '',
                confidence: 0,
                error,
                duration: Date.now() - (task.startedAt || task.createdAt),
            };
            this.activeTasks.delete(task.id);
            this.completedTasks.set(task.id, task);

            // Escalate
            this.emit('escalation', agent, task, `Max retries (${task.maxRetries}) exceeded: ${error}`);
        }

        // Check if agent needs recovery
        if (agent.consecutiveFailures >= this.config.maxConsecutiveFailures) {
            agent.status = 'RECOVERING';
            this.emit('agent:blocked', agent, `${agent.consecutiveFailures} consecutive failures`);
        } else {
            agent.status = 'IDLE';
        }
    }

    private async handleTimeout(agent: WorkLoopAgent, task: WorkTask): Promise<void> {
        console.log(`[AgentWorkLoop] ${agent.name} timeout: ${task.title}`);

        this.emit('task:timeout', agent, task);

        // Record trust signal for timeout (separate from failure)
        trustIntegration.recordTaskTimeout(agent, task).catch(err => {
            console.error(`[AgentWorkLoop] Failed to record timeout signal:`, err);
        });

        await this.handleFailure(agent, task, `Execution timeout (${task.timeoutMs}ms)`);
    }

    private checkObjectiveCompletion(parentTaskId: string): void {
        // Find all subtasks for this parent
        const subtasks = Array.from(this.completedTasks.values())
            .filter(t => t.parentTaskId === parentTaskId);

        const pendingSubtasks = this.taskQueue.filter(t => t.parentTaskId === parentTaskId);
        const activeSubtasks = Array.from(this.activeTasks.values())
            .filter(t => t.parentTaskId === parentTaskId);

        if (pendingSubtasks.length === 0 && activeSubtasks.length === 0) {
            // All subtasks complete - check if all succeeded
            const allSucceeded = subtasks.every(t => t.status === 'COMPLETED');
            const parentTask = this.completedTasks.get(parentTaskId);

            if (parentTask) {
                console.log(`[AgentWorkLoop] Objective ${parentTask.title} - All subtasks complete (success: ${allSucceeded})`);

                // Queue validation if all succeeded
                if (allSucceeded) {
                    this.submitTask({
                        title: `Validate: ${parentTask.title}`,
                        description: `Validate the completion of objective: ${parentTask.title}`,
                        type: 'VALIDATION',
                        priority: parentTask.priority,
                        requiredTier: 5,
                        requiredRole: 'VALIDATOR',
                        parentTaskId: parentTask.id,
                        dependencies: subtasks.map(t => t.id),
                        timeoutMs: 30000,
                        maxRetries: 2,
                    });
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Trust Signal Helpers
    // -------------------------------------------------------------------------

    /**
     * Record trust signals when an agent claims a task
     */
    private recordClaimSignals(agent: WorkLoopAgent, task: WorkTask): void {
        // Compliance: tier respected (agent tier >= required tier)
        trustIntegration.recordTierCompliance(agent, task, true).catch(err => {
            console.error(`[AgentWorkLoop] Failed to record tier compliance:`, err);
        });

        // Identity: role consistency (agent role matches required role)
        const roleConsistent = !task.requiredRole || task.requiredRole === agent.role;
        trustIntegration.recordRoleConsistency(agent, task, roleConsistent).catch(err => {
            console.error(`[AgentWorkLoop] Failed to record role consistency:`, err);
        });

        // Context: appropriate task for this agent
        trustIntegration.recordAppropriateTask(agent, task, true).catch(err => {
            console.error(`[AgentWorkLoop] Failed to record appropriate task:`, err);
        });

        // Context: dependencies satisfied (task was claimable means deps are met)
        if (task.dependencies && task.dependencies.length > 0) {
            trustIntegration.recordDependencySatisfied(agent, task, true).catch(err => {
                console.error(`[AgentWorkLoop] Failed to record dependency satisfaction:`, err);
            });
        }
    }

    /**
     * Record trust signals when an agent completes a task
     */
    private recordCompletionSignals(
        agent: WorkLoopAgent,
        task: WorkTask,
        result: TaskExecutionResult
    ): void {
        // Behavioral: task completion (existing)
        trustIntegration.recordTaskCompleted(agent, task, result).catch(err => {
            console.error(`[AgentWorkLoop] Failed to record task completion:`, err);
        });

        // Compliance: timeout respected
        trustIntegration.recordTimeoutCompliance(agent, task, result.duration).catch(err => {
            console.error(`[AgentWorkLoop] Failed to record timeout compliance:`, err);
        });

        // Compliance: retry limit respected (0 retries = first attempt success)
        trustIntegration.recordRetryCompliance(agent, task, task.retryCount).catch(err => {
            console.error(`[AgentWorkLoop] Failed to record retry compliance:`, err);
        });

        // Identity: capability verified (successful completion demonstrates capability)
        const capability = agent.role === 'PLANNER' ? 'planning'
            : agent.role === 'VALIDATOR' ? 'validation'
            : agent.role === 'EXECUTOR' ? 'coordination'
            : 'task_execution';
        trustIntegration.recordCapabilityVerified(agent, capability, result.success).catch(err => {
            console.error(`[AgentWorkLoop] Failed to record capability verification:`, err);
        });

        // Context: priority handling
        trustIntegration.recordPriorityHandling(agent, task, result.success).catch(err => {
            console.error(`[AgentWorkLoop] Failed to record priority handling:`, err);
        });
    }

    // -------------------------------------------------------------------------
    // Stats
    // -------------------------------------------------------------------------

    getStats(): {
        agents: { total: number; byStatus: Record<WorkLoopStatus, number>; byRole: Record<AgentRole, number> };
        tasks: { queued: number; active: number; completed: number; failed: number };
        performance: { successRate: number; avgExecutionTime: number };
    } {
        const agents = Array.from(this.agents.values());
        const completed = Array.from(this.completedTasks.values());

        const byStatus: Record<WorkLoopStatus, number> = {
            IDLE: 0, POLLING: 0, EXECUTING: 0, BLOCKED: 0, RECOVERING: 0, STOPPED: 0,
        };
        const byRole: Record<AgentRole, number> = {
            PLANNER: 0, EXECUTOR: 0, VALIDATOR: 0, EVOLVER: 0, SPAWNER: 0, WORKER: 0,
        };

        for (const agent of agents) {
            byStatus[agent.status]++;
            byRole[agent.role]++;
        }

        const successful = completed.filter(t => t.status === 'COMPLETED').length;
        const failed = completed.filter(t => t.status === 'FAILED').length;
        const successRate = completed.length > 0 ? (successful / completed.length) * 100 : 0;

        const durations = completed
            .filter(t => t.result?.duration)
            .map(t => t.result!.duration);
        const avgExecutionTime = durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;

        return {
            agents: { total: agents.length, byStatus, byRole },
            tasks: {
                queued: this.taskQueue.length,
                active: this.activeTasks.size,
                completed: successful,
                failed,
            },
            performance: { successRate, avgExecutionTime },
        };
    }

    // -------------------------------------------------------------------------
    // Validation Loop Configuration
    // -------------------------------------------------------------------------

    /**
     * Get current validation loop configuration
     */
    getValidationConfig(): {
        enabled: boolean;
        threshold: number;
        maxAttempts: number;
        highPriorityOnly: boolean;
    } {
        return {
            enabled: this.config.enableValidationLoop,
            threshold: this.config.validationThreshold,
            maxAttempts: this.config.maxValidationAttempts,
            highPriorityOnly: this.config.validateHighPriorityOnly,
        };
    }

    /**
     * Update validation loop configuration
     */
    setValidationConfig(config: {
        enabled?: boolean;
        threshold?: number;
        maxAttempts?: number;
        highPriorityOnly?: boolean;
    }): void {
        if (config.enabled !== undefined) {
            this.config.enableValidationLoop = config.enabled;
        }
        if (config.threshold !== undefined) {
            this.config.validationThreshold = Math.max(0, Math.min(100, config.threshold));
        }
        if (config.maxAttempts !== undefined) {
            this.config.maxValidationAttempts = Math.max(1, Math.min(10, config.maxAttempts));
        }
        if (config.highPriorityOnly !== undefined) {
            this.config.validateHighPriorityOnly = config.highPriorityOnly;
        }
        console.log(`[ValidationLoop] Config updated:`, this.getValidationConfig());
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const agentWorkLoop = new AgentWorkLoop();
