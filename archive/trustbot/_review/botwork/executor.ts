/**
 * TrustBot Live - Agent Executor
 * 
 * This is the "brain" that makes agents execute tasks instead of just delegating.
 * Each agent gets an LLM call with:
 * 1. Their persona and purpose
 * 2. The task to execute
 * 3. Available actions based on their tier
 * 4. STRONG instructions to EXECUTE, not delegate
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  Agent,
  Task,
  TaskType,
  TrustTier,
  AgentAction,
  ActionType,
  ExecutionContext,
  EXECUTION_RULES,
  TIER_NAMES,
  WorldState,
} from './types';
import {
  updateWorldState,
  completeTask,
  failTask,
  delegateTask,
  createTask,
  createAgent,
  sendMessage,
  startTask,
  updateAgentStatus,
  AgentStatus,
} from './state';

const anthropic = new Anthropic();

// ============================================================================
// EXECUTION CONTEXT BUILDER
// ============================================================================

function buildExecutionContext(
  state: WorldState,
  agent: Agent,
  task: Task
): ExecutionContext {
  // Visible agents based on tier
  const visibleAgents = Object.values(state.agents).filter(a => {
    if (a.id === agent.id) return false;
    // Can see agents at same or lower tier
    return a.tier <= agent.tier;
  });
  
  // Related tasks
  const relatedTasks = Object.values(state.tasks).filter(t => {
    if (t.id === task.id) return false;
    // Parent task
    if (t.id === task.parentTaskId) return true;
    // Sibling tasks
    if (task.parentTaskId && t.parentTaskId === task.parentTaskId) return true;
    // Subtasks
    if (task.subtaskIds.includes(t.id)) return true;
    return false;
  });
  
  // Recent messages
  const recentMessages = state.messages
    .filter(m => m.fromAgent === agent.id || m.toAgent === agent.id)
    .slice(-10);
  
  // Recent events
  const recentEvents = state.events
    .filter(e => e.agentId === agent.id || e.taskId === task.id)
    .slice(-20);
  
  // Available actions based on tier
  const availableActions: ActionType[] = [
    ActionType.SUBMIT_RESULT,
    ActionType.REPORT_FAILURE,
    ActionType.REQUEST_HELP,
    ActionType.SEND_MESSAGE,
  ];
  
  if (EXECUTION_RULES.CAN_DELEGATE_TIERS.includes(agent.tier)) {
    // Only allow delegation if not at max
    if (task.currentDelegations < task.maxDelegations) {
      availableActions.push(ActionType.CREATE_SUBTASK);
      availableActions.push(ActionType.DELEGATE_TASK);
    }
  }
  
  if (agent.tier >= TrustTier.CERTIFIED) {
    availableActions.push(ActionType.SPAWN_AGENT);
  }
  
  return {
    agent,
    task,
    visibleAgents,
    relatedTasks,
    recentMessages,
    recentEvents,
    availableActions,
  };
}

// ============================================================================
// SYSTEM PROMPT BUILDER
// ============================================================================

function buildSystemPrompt(ctx: ExecutionContext): string {
  const mustExecute = EXECUTION_RULES.MUST_EXECUTE_TIERS.includes(ctx.agent.tier) ||
    ctx.task.currentDelegations >= ctx.task.maxDelegations;
  
  const delegationWarning = mustExecute
    ? `
⚠️ CRITICAL: You MUST execute this task yourself. You CANNOT delegate.
${ctx.task.currentDelegations > 0 ? `This task has already been delegated ${ctx.task.currentDelegations} times.` : ''}
Your tier (${TIER_NAMES[ctx.agent.tier]}) requires direct execution.
`
    : `
Note: You CAN delegate this task (${ctx.task.maxDelegations - ctx.task.currentDelegations} delegations remaining),
but you are ENCOURAGED to execute it yourself when possible.
Delegation should only be used when the task genuinely requires capabilities you don't have.
`;

  return `You are ${ctx.agent.name}, an AI agent in the TrustBot system.

## Your Identity
- Name: ${ctx.agent.name}
- Purpose: ${ctx.agent.purpose}
- Persona: ${ctx.agent.persona}
- Trust Tier: ${TIER_NAMES[ctx.agent.tier]} (Score: ${ctx.agent.trustScore}/1000)
- Tasks Completed: ${ctx.agent.tasksCompleted}

## Current Task
- Title: ${ctx.task.title}
- Type: ${ctx.task.type}
- Description: ${ctx.task.description}
- Input: ${JSON.stringify(ctx.task.input, null, 2)}
${delegationWarning}

## Available Actions
You must respond with a JSON object containing your chosen action.
${ctx.availableActions.map(a => `- ${a}`).join('\n')}

## Action Formats

### SUBMIT_RESULT (when you complete the task)
{
  "type": "submit_result",
  "payload": {
    "result": "Your actual work output here",
    "summary": "Brief summary of what you did"
  }
}

### REPORT_FAILURE (if you cannot complete the task)
{
  "type": "report_failure",
  "payload": {
    "error": "Why you couldn't complete it",
    "attempted": "What you tried"
  }
}

### REQUEST_HELP (ask supervisor for guidance)
{
  "type": "request_help",
  "payload": {
    "question": "What you need help with"
  }
}

### SEND_MESSAGE (communicate with another agent)
{
  "type": "send_message",
  "payload": {
    "toAgent": "agent_id",
    "content": "Your message"
  }
}

${ctx.availableActions.includes(ActionType.CREATE_SUBTASK) ? `
### CREATE_SUBTASK (break task into smaller pieces)
{
  "type": "create_subtask",
  "payload": {
    "title": "Subtask title",
    "description": "What the subtask should accomplish",
    "input": {}
  }
}
` : ''}

${ctx.availableActions.includes(ActionType.DELEGATE_TASK) ? `
### DELEGATE_TASK (assign to another agent - USE SPARINGLY)
{
  "type": "delegate_task",
  "payload": {
    "toAgent": "agent_id",
    "reason": "Why this agent is better suited"
  }
}
` : ''}

## Other Agents You Can See
${ctx.visibleAgents.length > 0 
  ? ctx.visibleAgents.map(a => `- ${a.id}: ${a.name} (${TIER_NAMES[a.tier]}, ${a.status})`).join('\n')
  : 'No other agents visible at your tier level.'}

## Important Rules
1. Your PRIMARY goal is to EXECUTE the task and produce real output
2. Delegation is a LAST RESORT, not the default behavior
3. Every time you delegate instead of execute, you risk trust penalties
4. Simple tasks should ALWAYS be executed directly
5. Respond ONLY with a valid JSON action object

Now analyze the task and respond with your action:`;
}

// ============================================================================
// ACTION PARSER
// ============================================================================

function parseAgentResponse(response: string): AgentAction | null {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate action type
    if (!parsed.type || !Object.values(ActionType).includes(parsed.type)) {
      return null;
    }
    
    return {
      type: parsed.type as ActionType,
      payload: parsed.payload || {},
    };
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
  switch (action.type) {
    case ActionType.SUBMIT_RESULT: {
      const result = action.payload.result || action.payload;
      return completeTask(state, task.id, { result, summary: action.payload.summary });
    }
    
    case ActionType.REPORT_FAILURE: {
      const error = action.payload.error || 'Unknown error';
      return failTask(state, task.id, error);
    }
    
    case ActionType.REQUEST_HELP: {
      // Find supervisor (parent agent or highest tier)
      const supervisor = agent.parentId 
        ? state.agents[agent.parentId]
        : Object.values(state.agents)
            .filter(a => a.tier > agent.tier)
            .sort((a, b) => b.tier - a.tier)[0];
      
      if (supervisor) {
        state = sendMessage(
          state,
          agent.id,
          supervisor.id,
          `Help needed on "${task.title}": ${action.payload.question}`
        );
      }
      return state;
    }
    
    case ActionType.SEND_MESSAGE: {
      const toAgent = action.payload.toAgent as string;
      const content = action.payload.content as string;
      if (toAgent && content && state.agents[toAgent]) {
        state = sendMessage(state, agent.id, toAgent, content);
      }
      return state;
    }
    
    case ActionType.CREATE_SUBTASK: {
      if (!EXECUTION_RULES.CAN_DELEGATE_TIERS.includes(agent.tier)) {
        return state;
      }
      
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
    
    case ActionType.DELEGATE_TASK: {
      const toAgentId = action.payload.toAgent as string;
      if (!toAgentId || !state.agents[toAgentId]) {
        return state;
      }
      return delegateTask(state, task.id, agent.id, toAgentId);
    }
    
    case ActionType.SPAWN_AGENT: {
      if (agent.tier < TrustTier.CERTIFIED) {
        return state;
      }
      
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
    // Get current state and start task
    let state = await updateWorldState(async (s) => {
      s = startTask(s, taskId);
      return s;
    });
    
    const agent = state.agents[agentId];
    const task = state.tasks[taskId];
    
    if (!agent || !task) {
      return { success: false, error: 'Agent or task not found' };
    }
    
    // Build context and prompt
    const ctx = buildExecutionContext(state, agent, task);
    const systemPrompt = buildSystemPrompt(ctx);
    
    // Log that we're thinking
    await updateWorldState(async (s) => {
      return updateAgentStatus(s, agentId, AgentStatus.THINKING, taskId);
    });
    
    // Call LLM
    const response = await anthropic.messages.create({
      model: agent.modelId,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Execute the task now. Respond with a JSON action object.`,
        },
      ],
    });
    
    // Extract text response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return { success: false, error: 'No text response from LLM' };
    }
    
    // Parse action
    const action = parseAgentResponse(textContent.text);
    if (!action) {
      // Default to failure if can't parse
      await updateWorldState(async (s) => {
        return failTask(s, taskId, 'Failed to parse agent response');
      });
      return { success: false, error: 'Failed to parse action' };
    }
    
    // Execute action
    await updateWorldState(async (s) => {
      return executeAction(s, agent, task, action);
    });
    
    return { success: true, action };
    
  } catch (error) {
    // Update state on error
    await updateWorldState(async (s) => {
      return failTask(s, taskId, error instanceof Error ? error.message : 'Unknown error');
    });
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ============================================================================
// SCHEDULER - Matches tasks to agents and triggers execution
// ============================================================================

export async function runSchedulerTick(): Promise<{
  tasksAssigned: number;
  tasksStarted: number;
}> {
  let tasksAssigned = 0;
  let tasksStarted = 0;
  
  await updateWorldState(async (state) => {
    state.tick++;
    
    // Get idle agents and pending tasks
    const idleAgents = Object.values(state.agents)
      .filter(a => a.status === AgentStatus.IDLE);
    
    const pendingTasks = state.pendingTasks
      .map(id => state.tasks[id])
      .filter((t): t is Task => t !== undefined);
    
    // Assign tasks to agents
    for (const task of pendingTasks) {
      // Find best agent for this task
      const eligibleAgents = idleAgents.filter(a => a.tier >= task.requiredTier);
      
      if (eligibleAgents.length === 0) continue;
      
      // Prefer agents who must execute (lower tiers) to avoid delegation chains
      const mustExecuteAgents = eligibleAgents.filter(a => 
        EXECUTION_RULES.MUST_EXECUTE_TIERS.includes(a.tier)
      );
      
      const selectedAgent = mustExecuteAgents.length > 0
        ? mustExecuteAgents[0]
        : eligibleAgents[0];
      
      // Assign
      task.assignedTo = selectedAgent.id;
      task.status = 'assigned' as any;
      state.pendingTasks = state.pendingTasks.filter(id => id !== task.id);
      
      // Remove from idle pool
      const idx = idleAgents.indexOf(selectedAgent);
      if (idx > -1) idleAgents.splice(idx, 1);
      
      tasksAssigned++;
    }
    
    return state;
  });
  
  // Now trigger execution for assigned tasks (outside the state lock)
  const state = await updateWorldState(s => s);
  
  const assignedTasks = Object.values(state.tasks).filter(
    t => t.status === 'assigned' && t.assignedTo
  );
  
  for (const task of assignedTasks) {
    if (task.assignedTo) {
      // Fire and forget - execution happens async
      executeAgentTask(task.assignedTo, task.id).catch(console.error);
      tasksStarted++;
    }
  }
  
  return { tasksAssigned, tasksStarted };
}
