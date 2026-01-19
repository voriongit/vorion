/**
 * TrustBot - Agent Executor
 * 
 * Makes agents actually DO work by calling Claude.
 * Prevents infinite delegation through tier restrictions and counters.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  Agent,
  Task,
  TrustTier,
  AgentStatus,
  TaskType,
  TIER_CONFIG,
  mustAgentExecute,
} from '@trustbot/core';
import {
  getWorldState,
  updateWorldState,
  completeTask,
  failTask,
  delegateTask,
  createTask,
  createAgent,
  sendMessage,
  startTask,
  updateAgentStatus,
  WorldState,
} from '@trustbot/core';

const anthropic = new Anthropic();

// ============================================================================
// ACTION TYPES
// ============================================================================

enum ActionType {
  SUBMIT_RESULT = 'submit_result',
  REPORT_FAILURE = 'report_failure',
  REQUEST_HELP = 'request_help',
  SEND_MESSAGE = 'send_message',
  CREATE_SUBTASK = 'create_subtask',
  DELEGATE_TASK = 'delegate_task',
  SPAWN_AGENT = 'spawn_agent',
}

interface AgentAction {
  type: ActionType;
  payload: Record<string, unknown>;
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

function buildSystemPrompt(state: WorldState, agent: Agent, task: Task): string {
  const mustExecute = mustAgentExecute(agent, task);
  const tierConfig = TIER_CONFIG[agent.tier];
  
  const visibleAgents = Object.values(state.agents)
    .filter(a => a.id !== agent.id && a.tier <= agent.tier)
    .map(a => `- ${a.id}: ${a.name} (${TIER_CONFIG[a.tier].name}, ${a.status})`)
    .join('\n');

  const delegationWarning = mustExecute
    ? `
⚠️ CRITICAL: You MUST execute this task yourself. You CANNOT delegate.
${task.currentDelegations > 0 ? `This task has already been delegated ${task.currentDelegations} times.` : ''}
Your tier (${tierConfig.name}) requires direct execution.
DO NOT attempt to delegate. Execute the task and submit your result.
`
    : `
You CAN delegate (${task.maxDelegations - task.currentDelegations} remaining), but PREFER to execute yourself.
`;

  return `You are ${agent.name}, an AI agent in the TrustBot system.

## Your Identity
- Name: ${agent.name}
- Purpose: ${agent.purpose}
- Persona: ${agent.persona}
- Trust Tier: ${tierConfig.name} (Score: ${agent.trustScore}/1000)
- Tasks Completed: ${agent.tasksCompleted}

## Current Task
- ID: ${task.id}
- Title: ${task.title}
- Type: ${task.type}
- Description: ${task.description}
- Input: ${JSON.stringify(task.input, null, 2)}
${delegationWarning}

## Available Actions
Respond with a JSON object containing your action.

### SUBMIT_RESULT (task completed - USE THIS)
{
  "type": "submit_result",
  "payload": {
    "result": "Your detailed work output",
    "summary": "Brief summary"
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

### SEND_MESSAGE (communicate)
{
  "type": "send_message",
  "payload": {
    "toAgent": "agent_id",
    "content": "message"
  }
}

${tierConfig.canDelegate && !mustExecute ? `
### DELEGATE_TASK (transfer to another - USE SPARINGLY)
{
  "type": "delegate_task",
  "payload": {
    "toAgent": "agent_id",
    "reason": "why"
  }
}
` : ''}

## Other Agents
${visibleAgents || 'None visible at your tier.'}

## IMPORTANT
1. Your PRIMARY goal is to EXECUTE and produce actual output
2. ${mustExecute ? 'You CANNOT delegate this task' : 'Delegation is a last resort'}
3. Respond ONLY with valid JSON

Execute the task now:`;
}

// ============================================================================
// RESPONSE PARSER
// ============================================================================

function parseResponse(response: string): AgentAction | null {
  try {
    const match = response.match(/\{[\s\S]*\}/);
    if (!match) return null;
    
    const parsed = JSON.parse(match[0]);
    if (!parsed.type || !Object.values(ActionType).includes(parsed.type)) {
      return null;
    }
    
    return { type: parsed.type, payload: parsed.payload || {} };
  } catch {
    return null;
  }
}

// ============================================================================
// ACTION EXECUTOR
// ============================================================================

async function executeAction(
  state: WorldState,
  agent: Agent,
  task: Task,
  action: AgentAction
): Promise<WorldState> {
  const tierConfig = TIER_CONFIG[agent.tier];

  switch (action.type) {
    case ActionType.SUBMIT_RESULT: {
      return completeTask(state, task.id, {
        result: action.payload.result,
        summary: action.payload.summary,
      });
    }

    case ActionType.REPORT_FAILURE: {
      return failTask(state, task.id, action.payload.error as string || 'Unknown error');
    }

    case ActionType.SEND_MESSAGE: {
      const toAgent = action.payload.toAgent as string;
      const content = action.payload.content as string;
      if (toAgent && content && state.agents[toAgent]) {
        return sendMessage(state, agent.id, toAgent, content);
      }
      return state;
    }

    case ActionType.DELEGATE_TASK: {
      // Double-check delegation is allowed
      if (!tierConfig.canDelegate || mustAgentExecute(agent, task)) {
        // Force failure - tried to delegate when not allowed
        return failTask(state, task.id, 'Attempted invalid delegation');
      }
      
      const toAgentId = action.payload.toAgent as string;
      if (!toAgentId || !state.agents[toAgentId]) {
        return failTask(state, task.id, 'Invalid delegation target');
      }
      
      return delegateTask(state, task.id, agent.id, toAgentId);
    }

    case ActionType.CREATE_SUBTASK: {
      if (!tierConfig.canDelegate) return state;
      
      const { state: newState } = createTask(state, {
        type: TaskType.EXECUTE,
        title: action.payload.title as string || 'Subtask',
        description: action.payload.description as string || '',
        input: action.payload.input as Record<string, unknown> || {},
        createdBy: agent.id,
        parentTaskId: task.id,
      });
      return newState;
    }

    case ActionType.SPAWN_AGENT: {
      if (!tierConfig.canSpawn) return state;
      
      const { state: newState } = createAgent(state, {
        name: action.payload.name as string || 'New Agent',
        purpose: action.payload.purpose as string || 'General assistance',
        persona: action.payload.persona as string || 'Helpful assistant',
        parentId: agent.id,
      });
      return newState;
    }

    default:
      return state;
  }
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executeAgentTask(
  agentId: string,
  taskId: string
): Promise<{ success: boolean; action?: AgentAction; error?: string }> {
  try {
    // Start task
    let state = await updateWorldState(s => startTask(s, taskId));
    
    const agent = state.agents[agentId];
    const task = state.tasks[taskId];
    
    if (!agent || !task) {
      return { success: false, error: 'Agent or task not found' };
    }

    // Update status to thinking
    await updateWorldState(s => updateAgentStatus(s, agentId, AgentStatus.THINKING, taskId));

    // Build prompt and call Claude
    const systemPrompt = buildSystemPrompt(state, agent, task);
    
    const response = await anthropic.messages.create({
      model: agent.modelId,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Execute the task now. Respond with JSON.' }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      await updateWorldState(s => failTask(s, taskId, 'No response from LLM'));
      return { success: false, error: 'No text response' };
    }

    // Parse action
    const action = parseResponse(textContent.text);
    if (!action) {
      await updateWorldState(s => failTask(s, taskId, 'Failed to parse agent response'));
      return { success: false, error: 'Failed to parse action' };
    }

    // Execute action
    await updateWorldState(s => executeAction(s, agent, task, action));

    return { success: true, action };

  } catch (error) {
    await updateWorldState(s => failTask(s, taskId, error instanceof Error ? error.message : 'Unknown error'));
    return { success: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

// ============================================================================
// SCHEDULER
// ============================================================================

export async function runSchedulerTick(): Promise<{
  tasksAssigned: number;
  tasksStarted: number;
}> {
  let tasksAssigned = 0;
  let tasksStarted = 0;

  // Phase 1: Assign pending tasks
  await updateWorldState(state => {
    state.tick++;

    const idleAgents = Object.values(state.agents)
      .filter(a => a.status === AgentStatus.IDLE);
    
    const pendingTasks = state.pendingTasks
      .map(id => state.tasks[id])
      .filter((t): t is Task => t !== undefined);

    for (const task of pendingTasks) {
      const eligible = idleAgents.filter(a => a.tier >= task.requiredTier);
      if (eligible.length === 0) continue;

      // Prefer agents who must execute (lower tiers)
      const mustExecuteAgents = eligible.filter(a => !TIER_CONFIG[a.tier].canDelegate);
      const selected = mustExecuteAgents.length > 0 ? mustExecuteAgents[0] : eligible[0];

      task.assignedTo = selected.id;
      task.status = 'assigned' as any;
      state.pendingTasks = state.pendingTasks.filter(id => id !== task.id);

      const idx = idleAgents.indexOf(selected);
      if (idx > -1) idleAgents.splice(idx, 1);

      tasksAssigned++;
    }

    return state;
  });

  // Phase 2: Start execution for assigned tasks
  const state = await getWorldState();
  const assignedTasks = Object.values(state.tasks).filter(
    t => t.status === 'assigned' && t.assignedTo
  );

  for (const task of assignedTasks) {
    if (task.assignedTo) {
      executeAgentTask(task.assignedTo, task.id).catch(console.error);
      tasksStarted++;
    }
  }

  return { tasksAssigned, tasksStarted };
}
