import { getTasks, saveTask, getSystemState, saveSystemState, initStorage } from './lib/storage.js';

/**
 * Agent Tick System - TrustBot with Anti-Delegation Rules
 *
 * The heartbeat of TrustBot - processes agent work loop:
 * 1. Route PENDING tasks to capable agents (respecting tier restrictions)
 * 2. Progress IN_PROGRESS tasks (forced execution for low tiers)
 * 3. Complete tasks and adjust trust scores
 * 4. Update agent statuses
 *
 * KEY INNOVATION: Low-tier agents CANNOT delegate - they MUST execute.
 * Max 2 delegations per task prevents infinite delegation loops.
 */

// ============================================================================
// TRUST TIER SYSTEM (mirrored from types.ts for server-side use)
// ============================================================================

const TrustTier = {
    UNTRUSTED: 0,
    PROBATIONARY: 1,
    TRUSTED: 2,
    VERIFIED: 3,
    CERTIFIED: 4,
    ELITE: 5,
};

const TIER_CONFIG = {
    [TrustTier.UNTRUSTED]: { name: 'Untrusted', threshold: 0, canDelegate: false, canSpawn: false },
    [TrustTier.PROBATIONARY]: { name: 'Probationary', threshold: 200, canDelegate: false, canSpawn: false },
    [TrustTier.TRUSTED]: { name: 'Trusted', threshold: 400, canDelegate: false, canSpawn: false },
    [TrustTier.VERIFIED]: { name: 'Verified', threshold: 600, canDelegate: true, canSpawn: false },
    [TrustTier.CERTIFIED]: { name: 'Certified', threshold: 800, canDelegate: true, canSpawn: true },
    [TrustTier.ELITE]: { name: 'Elite', threshold: 950, canDelegate: true, canSpawn: true },
};

const EXECUTION_RULES = {
    MAX_DELEGATIONS: 2,
    TRUST_REWARDS: { TASK_COMPLETED: 10, TASK_REVIEWED_GOOD: 5 },
    TRUST_PENALTIES: { TASK_FAILED: -15, INVALID_DELEGATION: -20, EXCESSIVE_DELEGATION: -25 },
};

// Helper: Get tier from trust score
function getTierFromScore(score) {
    for (const tier of [TrustTier.ELITE, TrustTier.CERTIFIED, TrustTier.VERIFIED, TrustTier.TRUSTED, TrustTier.PROBATIONARY]) {
        if (score >= TIER_CONFIG[tier].threshold) return tier;
    }
    return TrustTier.UNTRUSTED;
}

// Helper: Check if agent must execute (cannot delegate)
function mustAgentExecute(agent, task) {
    const tier = getTierFromScore(agent.trustScore || 0);
    if (!TIER_CONFIG[tier].canDelegate) return true;
    if ((task.currentDelegations || 0) >= EXECUTION_RULES.MAX_DELEGATIONS) return true;
    return false;
}

// Helper: Get tier name for logging
function getTierName(score) {
    return TIER_CONFIG[getTierFromScore(score)]?.name || 'Unknown';
}

// Capability mapping
const CAPABILITY_MAP = {
    research: ['WORKER', 'LISTENER', 'PLANNER'],
    analysis: ['PLANNER', 'WORKER', 'VALIDATOR'],
    validation: ['VALIDATOR', 'EXECUTOR'],
    execution: ['EXECUTOR', 'WORKER'],
    monitoring: ['LISTENER', 'WORKER'],
    optimization: ['EVOLVER', 'PLANNER'],
    creation: ['SPAWNER', 'EXECUTOR'],
    communication: ['LISTENER', 'WORKER'],
    strategy: ['PLANNER', 'EXECUTOR'],
    review: ['VALIDATOR', 'EXECUTOR'],
};

// Trust requirements for task types
const TRUST_REQUIREMENTS = {
    strategy: 800,
    execution: 600,
    validation: 500,
    analysis: 400,
    research: 200,
    monitoring: 100,
    optimization: 700,
    creation: 600,
    communication: 200,
    review: 500,
};

// Simulated work outputs by task type
const TASK_OUTPUTS = {
    research: [
        'Compiled 47 relevant data points from internal and external sources.',
        'Identified 3 key trends and 2 potential risks in the research domain.',
        'Generated summary report with actionable insights.',
        'Cross-referenced findings with historical patterns.',
    ],
    analysis: [
        'Statistical analysis complete. Confidence interval: 94%.',
        'Identified 5 optimization opportunities with projected 12% improvement.',
        'Root cause analysis points to 3 contributing factors.',
        'Comparative analysis against benchmarks shows favorable positioning.',
    ],
    validation: [
        'All compliance checks passed. No violations detected.',
        'Validated against 23 rule sets. 100% conformance.',
        'Audit trail generated and archived.',
        'Risk assessment: LOW. Recommended for approval.',
    ],
    execution: [
        'Task executed successfully. All objectives met.',
        'Deployment complete. Systems nominal.',
        'Operation completed in optimal time window.',
        'Execution verified by secondary check.',
    ],
    monitoring: [
        'Monitoring period complete. No anomalies detected.',
        'Collected 1,247 data points. Patterns within normal range.',
        'Alert thresholds reviewed and calibrated.',
        'Continuous monitoring handoff to next cycle.',
    ],
    optimization: [
        'Optimization cycle complete. Performance improved by 8%.',
        'Identified and pruned 3 inefficient pathways.',
        'New heuristics deployed. Learning rate: +15%.',
        'Resource utilization optimized. Overhead reduced.',
    ],
    creation: [
        'New resource successfully instantiated.',
        'Blueprint validated and deployed.',
        'Creation verified and registered in system.',
        'Integration tests passed.',
    ],
    strategy: [
        'Strategic plan formulated with 5 key initiatives.',
        'Roadmap created with milestones and dependencies.',
        'Risk mitigation strategies identified for each phase.',
        'Resource allocation optimized for strategic objectives.',
    ],
    review: [
        'Review complete. Quality score: 94/100.',
        'Identified 2 minor issues, both resolved.',
        'Approved for next phase.',
        'Documentation updated with review findings.',
    ],
    communication: [
        'Message delivered and acknowledged.',
        'Coordination complete across 3 agents.',
        'Information synthesized and distributed.',
        'Communication log archived.',
    ],
};

// Tick counter (resets on cold start)
let tickCount = 0;

// Generate realistic result based on task
function generateTaskResult(task, agent) {
    const outputs = TASK_OUTPUTS[task.type] || TASK_OUTPUTS.research;
    const output = outputs[Math.floor(Math.random() * outputs.length)];

    return {
        summary: output,
        completedBy: agent.name,
        completedByType: agent.type,
        duration: `${Math.floor(Math.random() * 45) + 5} minutes`,
        confidence: Math.floor(Math.random() * 20) + 80,
        timestamp: new Date().toISOString(),
    };
}

// Find best agent for a task - PREFERS agents who MUST EXECUTE
function findBestAgent(task, agents) {
    const capableTypes = CAPABILITY_MAP[task.type] || ['WORKER'];
    const minTrust = TRUST_REQUIREMENTS[task.type] || 200;

    // Filter capable and available agents
    const candidates = agents.filter(a =>
        capableTypes.includes(a.type) &&
        a.trustScore >= minTrust &&
        a.status !== 'TERMINATED' &&
        a.status !== 'IN_MEETING'
    );

    if (candidates.length === 0) return null;

    // KEY ANTI-DELEGATION LOGIC:
    // Prefer agents who MUST execute (lower tiers) to force actual work
    // This prevents high-tier agents from endlessly delegating
    const mustExecuteAgents = candidates.filter(a => mustAgentExecute(a, task));
    const canDelegateAgents = candidates.filter(a => !mustAgentExecute(a, task));

    // Sort must-execute agents by: IDLE first, then by trust (to get best worker)
    const sortByIdleAndTrust = (a, b) => {
        if (a.status === 'IDLE' && b.status !== 'IDLE') return -1;
        if (b.status === 'IDLE' && a.status !== 'IDLE') return 1;
        return b.trustScore - a.trustScore;
    };

    mustExecuteAgents.sort(sortByIdleAndTrust);
    canDelegateAgents.sort(sortByIdleAndTrust);

    // Prefer must-execute agents first (they WILL do the work)
    const selected = mustExecuteAgents.length > 0 ? mustExecuteAgents[0] : canDelegateAgents[0];

    if (selected) {
        const tier = getTierName(selected.trustScore);
        const mustExec = mustAgentExecute(selected, task);
        console.log(`[Assign] ${selected.name} (${tier}) selected for "${task.type}" task | Must Execute: ${mustExec}`);
    }

    return selected;
}

// Create blackboard entry for completed task
function createCompletionEntry(task, result, agent) {
    return {
        id: `bb-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'SOLUTION',
        title: `Completed: ${task.description.slice(0, 40)}${task.description.length > 40 ? '...' : ''}`,
        content: result.summary,
        author: agent.id,
        priority: task.priority || 'NORMAL',
        status: 'RESOLVED',
        createdAt: new Date().toISOString(),
        taskId: task.id,
        metadata: {
            taskType: task.type,
            duration: result.duration,
            confidence: result.confidence,
            completedBy: result.completedBy,
        },
        comments: [],
    };
}

// Create activity event string
function createEvent(message) {
    return `[${new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' })}] ${message}`;
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        await initStorage();
        tickCount++;

        const tasks = await getTasks();
        const state = await getSystemState();

        if (!state || !state.agents || state.agents.length === 0) {
            return res.status(200).json({
                success: true,
                tick: tickCount,
                message: 'No agents available - skipping tick',
                processed: 0,
            });
        }

        const agents = state.agents;
        const events = state.events || [];
        const blackboard = state.blackboard || [];

        let processed = 0;
        let assigned = 0;
        let completed = 0;
        let newEvents = [];
        let newBlackboardEntries = [];
        let agentUpdates = {};

        // =====================================================================
        // PHASE 1: Route PENDING tasks to available agents
        // =====================================================================
        const pendingTasks = tasks.filter(t => t.status === 'PENDING');

        for (const task of pendingTasks.slice(0, 3)) { // Max 3 per tick
            const agent = findBestAgent(task, agents);

            if (agent) {
                const tier = getTierName(agent.trustScore || 0);
                const mustExec = mustAgentExecute(agent, task);

                // Assign and start task
                task.assignee = agent.id;
                task.assigneeName = agent.name;
                task.status = 'IN_PROGRESS';
                task.startedAt = new Date().toISOString();
                task.updatedAt = new Date().toISOString();
                task.progress = 10;
                task.nextSteps = mustExec
                    ? `${agent.name} (${tier}) is EXECUTING this task`
                    : `${agent.name} (${tier}) is working on this task`;

                // Initialize delegation tracking if not present
                if (task.currentDelegations === undefined) {
                    task.currentDelegations = 0;
                    task.maxDelegations = EXECUTION_RULES.MAX_DELEGATIONS;
                    task.delegationHistory = [];
                }

                await saveTask(task);

                // Track agent status update
                agentUpdates[agent.id] = { status: 'WORKING' };

                const execMsg = mustExec ? '[MUST EXECUTE]' : '[can delegate]';
                newEvents.push(createEvent(`📋 ${agent.name} (${tier}) claimed task: "${task.description.slice(0, 30)}..." ${execMsg}`));
                assigned++;
                processed++;
            }
        }

        // =====================================================================
        // PHASE 2: Progress IN_PROGRESS tasks
        // =====================================================================
        const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS');

        for (const task of inProgressTasks) {
            // Simulate work progress (20-50% per tick)
            const progressIncrement = Math.floor(Math.random() * 30) + 20;
            task.progress = Math.min(100, (task.progress || 0) + progressIncrement);
            task.updatedAt = new Date().toISOString();

            // Find the assigned agent
            const agent = agents.find(a => a.id === task.assignee);

            if (task.progress >= 100 && agent) {
                // COMPLETE the task
                const result = generateTaskResult(task, agent);

                task.status = 'COMPLETED';
                task.result = result;
                task.completedAt = new Date().toISOString();
                task.nextSteps = 'Completed';

                // Create blackboard entry
                const bbEntry = createCompletionEntry(task, result, agent);
                newBlackboardEntries.push(bbEntry);

                // TRUST SCORE ADJUSTMENT: Reward for completion
                const oldTrust = agent.trustScore || 0;
                const reward = EXECUTION_RULES.TRUST_REWARDS.TASK_COMPLETED;
                const newTrust = Math.min(1000, oldTrust + reward);
                const oldTier = getTierName(oldTrust);
                const newTier = getTierName(newTrust);

                agentUpdates[agent.id] = {
                    status: 'IDLE',
                    trustScore: newTrust,
                };

                // Log tier promotion if it happened
                if (oldTier !== newTier) {
                    newEvents.push(createEvent(`🎖️ ${agent.name} promoted to ${newTier}! (${oldTrust} → ${newTrust})`));
                }

                newEvents.push(createEvent(`✅ ${agent.name} completed: "${task.description.slice(0, 30)}..." (+${reward} trust)`));
                completed++;
            } else if (agent) {
                // Update progress message
                const progressMessages = [
                    'Analyzing data...',
                    'Processing information...',
                    'Validating results...',
                    'Cross-referencing sources...',
                    'Finalizing output...',
                ];
                task.nextSteps = progressMessages[Math.floor(task.progress / 25)] || 'Working...';

                // Keep agent working
                agentUpdates[agent.id] = { status: 'WORKING' };
            }

            await saveTask(task);
            processed++;
        }

        // =====================================================================
        // PHASE 3: Update system state
        // =====================================================================

        // Update agent statuses
        const updatedAgents = agents.map(a => {
            if (agentUpdates[a.id]) {
                return { ...a, ...agentUpdates[a.id] };
            }
            return a;
        });

        // Merge new blackboard entries (keep last 50)
        const updatedBlackboard = [...newBlackboardEntries, ...blackboard].slice(0, 50);

        // Merge events (keep last 20)
        const updatedEvents = [...newEvents, ...events].slice(0, 20);

        // Save updated state
        await saveSystemState({
            ...state,
            agents: updatedAgents,
            blackboard: updatedBlackboard,
            events: updatedEvents,
        });

        // =====================================================================
        // PHASE 4: Return tick summary
        // =====================================================================

        // Calculate average trust for the system
        const avgTrust = updatedAgents.length > 0
            ? Math.round(updatedAgents.reduce((sum, a) => sum + (a.trustScore || 0), 0) / updatedAgents.length)
            : 0;

        const summary = {
            success: true,
            tick: tickCount,
            timestamp: new Date().toISOString(),
            processed,
            assigned,
            completed,
            queue: {
                pending: pendingTasks.length - assigned,
                inProgress: inProgressTasks.length - completed + assigned,
                totalTasks: tasks.length,
            },
            trustSystem: {
                avgTrust,
                agentsByTier: {
                    untrusted: updatedAgents.filter(a => getTierFromScore(a.trustScore || 0) === TrustTier.UNTRUSTED).length,
                    probationary: updatedAgents.filter(a => getTierFromScore(a.trustScore || 0) === TrustTier.PROBATIONARY).length,
                    trusted: updatedAgents.filter(a => getTierFromScore(a.trustScore || 0) === TrustTier.TRUSTED).length,
                    verified: updatedAgents.filter(a => getTierFromScore(a.trustScore || 0) === TrustTier.VERIFIED).length,
                    certified: updatedAgents.filter(a => getTierFromScore(a.trustScore || 0) === TrustTier.CERTIFIED).length,
                    elite: updatedAgents.filter(a => getTierFromScore(a.trustScore || 0) === TrustTier.ELITE).length,
                },
            },
            events: newEvents,
            newBlackboardEntries: newBlackboardEntries.length,
        };

        console.log(`[Tick ${tickCount}] Processed: ${processed}, Assigned: ${assigned}, Completed: ${completed}`);

        return res.status(200).json(summary);

    } catch (error) {
        console.error('Tick error:', error);
        return res.status(500).json({
            error: 'Tick processing failed',
            details: error.message,
            tick: tickCount,
        });
    }
}
