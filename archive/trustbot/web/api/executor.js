/**
 * Claude API Executor - Real LLM Agent Reasoning
 *
 * This endpoint provides REAL AI execution for agents using Claude.
 * Agents receive context about their task and must produce actual output.
 *
 * Anti-delegation rules are enforced in the system prompt.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getSystemState, saveSystemState, getTasks, saveTask } from './lib/storage.js';

// Initialize Anthropic client (uses ANTHROPIC_API_KEY env var)
let anthropic = null;
try {
    anthropic = new Anthropic();
} catch (e) {
    console.warn('Anthropic SDK not initialized - will use simulation mode');
}

// ============================================================================
// TRUST TIER SYSTEM (server-side)
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
    [TrustTier.UNTRUSTED]: { name: 'Untrusted', threshold: 0, canDelegate: false },
    [TrustTier.PROBATIONARY]: { name: 'Probationary', threshold: 200, canDelegate: false },
    [TrustTier.TRUSTED]: { name: 'Trusted', threshold: 400, canDelegate: false },
    [TrustTier.VERIFIED]: { name: 'Verified', threshold: 600, canDelegate: true },
    [TrustTier.CERTIFIED]: { name: 'Certified', threshold: 800, canDelegate: true },
    [TrustTier.ELITE]: { name: 'Elite', threshold: 950, canDelegate: true },
};

const MAX_DELEGATIONS = 2;

function getTierFromScore(score) {
    for (const tier of [TrustTier.ELITE, TrustTier.CERTIFIED, TrustTier.VERIFIED, TrustTier.TRUSTED, TrustTier.PROBATIONARY]) {
        if (score >= TIER_CONFIG[tier].threshold) return tier;
    }
    return TrustTier.UNTRUSTED;
}

function getTierName(score) {
    return TIER_CONFIG[getTierFromScore(score)]?.name || 'Unknown';
}

function mustAgentExecute(agent, task) {
    const tier = getTierFromScore(agent.trustScore || 0);
    if (!TIER_CONFIG[tier].canDelegate) return true;
    if ((task.currentDelegations || 0) >= MAX_DELEGATIONS) return true;
    return false;
}

// ============================================================================
// SYSTEM PROMPT BUILDER
// ============================================================================

function buildSystemPrompt(agent, task, otherAgents) {
    const tierName = getTierName(agent.trustScore || 0);
    const mustExecute = mustAgentExecute(agent, task);
    const delegationsRemaining = MAX_DELEGATIONS - (task.currentDelegations || 0);

    const visibleAgents = otherAgents
        .filter(a => a.id !== agent.id)
        .map(a => `- ${a.name} (${getTierName(a.trustScore || 0)}, ${a.status})`)
        .join('\n');

    const delegationWarning = mustExecute
        ? `
## CRITICAL EXECUTION REQUIREMENT
You MUST execute this task yourself. You CANNOT delegate.
${task.currentDelegations > 0 ? `This task has already been delegated ${task.currentDelegations} times.` : ''}
Your tier (${tierName}) requires direct execution.
DO NOT attempt to delegate. Execute the task and submit your result.
`
        : `
## Delegation Status
You CAN delegate (${delegationsRemaining} remaining), but PREFER to execute yourself.
Delegation should only be used when another agent has clearly superior capabilities.
`;

    return `You are ${agent.name}, an AI agent in the TrustBot system.

## Your Identity
- Name: ${agent.name}
- Type: ${agent.type}
- Trust Tier: ${tierName} (Score: ${agent.trustScore || 0}/1000)
- Capabilities: ${(agent.capabilities || []).join(', ') || 'General'}

## Current Task
- ID: ${task.id}
- Description: ${task.description}
- Type: ${task.type}
- Priority: ${task.priority}
${delegationWarning}

## Available Actions
Respond with a JSON object containing your action.

### SUBMIT_RESULT (task completed - PREFERRED)
{
  "type": "submit_result",
  "payload": {
    "result": "Your detailed work output - be specific and thorough",
    "summary": "Brief 1-2 sentence summary"
  }
}

### REPORT_FAILURE (cannot complete)
{
  "type": "report_failure",
  "payload": {
    "error": "Why you couldn't complete it",
    "attempted": "What you tried"
  }
}

${!mustExecute ? `
### DELEGATE_TASK (transfer to another - USE SPARINGLY)
{
  "type": "delegate_task",
  "payload": {
    "toAgent": "agent_name",
    "reason": "why this agent is better suited"
  }
}
` : ''}

## Other Agents in System
${visibleAgents || 'None currently active.'}

## IMPORTANT RULES
1. Your PRIMARY goal is to EXECUTE and produce actual, useful output
2. ${mustExecute ? 'You CANNOT delegate this task - you MUST execute it' : 'Delegation is a last resort'}
3. Be thorough and specific in your results
4. Respond ONLY with valid JSON

Execute the task now:`;
}

// ============================================================================
// RESPONSE PARSER
// ============================================================================

function parseResponse(response) {
    try {
        // Find JSON in response
        const match = response.match(/\{[\s\S]*\}/);
        if (!match) return null;

        const parsed = JSON.parse(match[0]);
        if (!parsed.type) return null;

        return { type: parsed.type, payload: parsed.payload || {} };
    } catch (e) {
        console.error('Failed to parse response:', e);
        return null;
    }
}

// ============================================================================
// EXECUTOR ENDPOINT
// ============================================================================

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { agentId, taskId, mode = 'auto' } = req.body;

        if (!agentId || !taskId) {
            return res.status(400).json({ error: 'agentId and taskId required' });
        }

        // Get current state
        const state = await getSystemState();
        if (!state) {
            return res.status(500).json({ error: 'System state not initialized' });
        }

        const agent = state.agents.find(a => a.id === agentId);
        const tasks = await getTasks();
        const task = tasks.find(t => t.id === taskId);

        if (!agent || !task) {
            return res.status(404).json({ error: 'Agent or task not found' });
        }

        // Check if we should use real Claude or simulation
        const useRealClaude = mode === 'real' || (mode === 'auto' && anthropic && process.env.ANTHROPIC_API_KEY);

        let action;
        let executionMode;

        if (useRealClaude && anthropic) {
            // REAL CLAUDE EXECUTION
            executionMode = 'claude';
            console.log(`[Executor] Real Claude execution for ${agent.name} on task ${task.id}`);

            const systemPrompt = buildSystemPrompt(agent, task, state.agents);

            const response = await anthropic.messages.create({
                model: 'claude-3-haiku-20240307', // Fast and cost-effective for agents
                max_tokens: 1024,
                system: systemPrompt,
                messages: [{ role: 'user', content: 'Execute the task now. Respond with JSON.' }],
            });

            const textContent = response.content.find(c => c.type === 'text');
            if (!textContent) {
                return res.status(500).json({ error: 'No response from Claude' });
            }

            action = parseResponse(textContent.text);
            if (!action) {
                // Claude didn't respond with valid JSON - treat as completion with raw text
                action = {
                    type: 'submit_result',
                    payload: {
                        result: textContent.text,
                        summary: textContent.text.slice(0, 100) + '...'
                    }
                };
            }
        } else {
            // SIMULATION MODE
            executionMode = 'simulation';
            console.log(`[Executor] Simulation mode for ${agent.name} on task ${task.id}`);

            // Generate simulated result
            const simulatedResults = {
                research: 'Compiled analysis from multiple sources. Key findings: 3 relevant data points identified.',
                analysis: 'Statistical analysis complete. Confidence: 92%. Recommend proceeding.',
                validation: 'All checks passed. Compliance verified.',
                execution: 'Task executed successfully. Objectives met.',
                monitoring: 'Monitoring complete. No anomalies detected.',
                strategy: 'Strategic plan formulated with 3 key initiatives.',
            };

            action = {
                type: 'submit_result',
                payload: {
                    result: simulatedResults[task.type] || 'Task completed successfully.',
                    summary: `${agent.name} completed ${task.type} task.`
                }
            };
        }

        // Process the action
        let resultMessage;
        const events = state.events || [];

        if (action.type === 'submit_result') {
            // Complete the task
            task.status = 'COMPLETED';
            task.result = action.payload;
            task.completedAt = new Date().toISOString();
            task.nextSteps = 'Completed';
            task.progress = 100;

            // Update agent trust
            const oldTrust = agent.trustScore || 0;
            agent.trustScore = Math.min(1000, oldTrust + 10);
            agent.status = 'IDLE';

            // Add to blackboard
            const bbEntry = {
                id: `bb-${Date.now()}`,
                type: 'SOLUTION',
                title: `Completed: ${task.description.slice(0, 40)}...`,
                content: action.payload.result,
                author: agent.id,
                priority: task.priority || 'NORMAL',
                status: 'RESOLVED',
                createdAt: new Date().toISOString(),
            };
            state.blackboard = [bbEntry, ...(state.blackboard || [])].slice(0, 50);

            events.unshift(`[${new Date().toLocaleTimeString()}] ${agent.name} completed: "${task.description.slice(0, 30)}..." (+10 trust)`);

            resultMessage = 'Task completed successfully';

        } else if (action.type === 'report_failure') {
            // Fail the task
            task.status = 'FAILED';
            task.error = action.payload.error;
            task.completedAt = new Date().toISOString();

            // Penalize agent trust
            const oldTrust = agent.trustScore || 0;
            agent.trustScore = Math.max(0, oldTrust - 15);
            agent.status = 'IDLE';

            events.unshift(`[${new Date().toLocaleTimeString()}] ${agent.name} FAILED: "${task.description.slice(0, 30)}..." (-15 trust)`);

            resultMessage = 'Task failed';

        } else if (action.type === 'delegate_task') {
            // Attempt delegation
            if (mustAgentExecute(agent, task)) {
                // Invalid delegation - penalize
                agent.trustScore = Math.max(0, (agent.trustScore || 0) - 20);
                agent.status = 'IDLE';
                task.status = 'FAILED';
                task.error = 'Invalid delegation attempt';

                events.unshift(`[${new Date().toLocaleTimeString()}] ${agent.name} INVALID DELEGATION (-20 trust)`);

                resultMessage = 'Invalid delegation - agent must execute';
            } else {
                // Valid delegation - find target agent
                const targetName = action.payload.toAgent;
                const targetAgent = state.agents.find(a =>
                    a.name.toLowerCase().includes(targetName.toLowerCase()) ||
                    a.id === targetName
                );

                if (targetAgent) {
                    task.currentDelegations = (task.currentDelegations || 0) + 1;
                    task.assignee = targetAgent.id;
                    task.assigneeName = targetAgent.name;
                    task.delegationHistory = task.delegationHistory || [];
                    task.delegationHistory.push({
                        from: agent.id,
                        to: targetAgent.id,
                        timestamp: new Date().toISOString(),
                        reason: action.payload.reason
                    });

                    agent.status = 'IDLE';
                    targetAgent.status = 'WORKING';

                    events.unshift(`[${new Date().toLocaleTimeString()}] ${agent.name} delegated to ${targetAgent.name}`);

                    resultMessage = `Delegated to ${targetAgent.name}`;
                } else {
                    task.status = 'FAILED';
                    task.error = `Delegation target not found: ${targetName}`;
                    agent.status = 'IDLE';

                    resultMessage = 'Delegation failed - target not found';
                }
            }
        }

        // Save updates
        await saveTask(task);
        state.events = events.slice(0, 20);

        // Update agent in state
        const agentIdx = state.agents.findIndex(a => a.id === agent.id);
        if (agentIdx >= 0) state.agents[agentIdx] = agent;

        await saveSystemState(state);

        return res.status(200).json({
            success: true,
            mode: executionMode,
            action: action.type,
            message: resultMessage,
            agent: {
                id: agent.id,
                name: agent.name,
                trustScore: agent.trustScore,
                tier: getTierName(agent.trustScore || 0),
            },
            task: {
                id: task.id,
                status: task.status,
                result: task.result,
            },
        });

    } catch (error) {
        console.error('Executor error:', error);
        return res.status(500).json({
            error: 'Execution failed',
            details: error.message,
        });
    }
}
