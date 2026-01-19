/**
 * TrustBot Live - State Management
 * 
 * Vercel KV as single source of truth.
 * All reads/writes go through here.
 * Dashboard subscribes via SSE.
 */

import { kv } from '@vercel/kv';
import { nanoid } from 'nanoid';
import {
  WorldState,
  Agent,
  AgentId,
  AgentStatus,
  Task,
  TaskId,
  TaskStatus,
  TaskType,
  TrustTier,
  TIER_THRESHOLDS,
  SystemEvent,
  EventType,
  Message,
  EXECUTION_RULES,
} from './types';

// ============================================================================
// KV KEYS
// ============================================================================

const KEYS = {
  WORLD_STATE: 'trustbot:world',
  LOCK: 'trustbot:lock',
  EVENTS_STREAM: 'trustbot:events',
};

// ============================================================================
// STATE INITIALIZATION
// ============================================================================

export function createInitialState(): WorldState {
  return {
    tick: 0,
    agents: {},
    tasks: {},
    messages: [],
    events: [],
    pendingTasks: [],
    totalTasksCompleted: 0,
    totalTasksFailed: 0,
    lastUpdated: Date.now(),
  };
}

// ============================================================================
// STATE ACCESS
// ============================================================================

export async function getWorldState(): Promise<WorldState> {
  const state = await kv.get<WorldState>(KEYS.WORLD_STATE);
  return state || createInitialState();
}

export async function setWorldState(state: WorldState): Promise<void> {
  state.lastUpdated = Date.now();
  await kv.set(KEYS.WORLD_STATE, state);
}

/**
 * Atomic state update with optimistic locking.
 */
export async function updateWorldState(
  updater: (state: WorldState) => WorldState | Promise<WorldState>
): Promise<WorldState> {
  // Simple lock for now - production would use proper distributed locking
  const lockKey = KEYS.LOCK;
  const lockId = nanoid();
  
  // Try to acquire lock
  const acquired = await kv.setnx(lockKey, lockId);
  if (!acquired) {
    // Wait and retry
    await new Promise(r => setTimeout(r, 50));
    return updateWorldState(updater);
  }
  
  try {
    // Set lock expiry
    await kv.expire(lockKey, 5);
    
    const state = await getWorldState();
    const newState = await updater(state);
    await setWorldState(newState);
    return newState;
  } finally {
    // Release lock
    const currentLock = await kv.get(lockKey);
    if (currentLock === lockId) {
      await kv.del(lockKey);
    }
  }
}

// ============================================================================
// AGENT OPERATIONS
// ============================================================================

export function createAgent(
  state: WorldState,
  config: {
    name: string;
    purpose: string;
    persona: string;
    modelId?: string;
    parentId?: AgentId;
    isRoot?: boolean;
  }
): { state: WorldState; agent: Agent } {
  const id = `agent_${nanoid(8)}`;
  const now = Date.now();
  
  // Root agents start at ELITE, spawned agents start at UNTRUSTED
  const isRoot = config.isRoot || false;
  const initialScore = isRoot ? 1000 : 0;
  const initialTier = isRoot ? TrustTier.ELITE : TrustTier.UNTRUSTED;
  
  // Trust ceiling from parent
  let trustCeiling = TrustTier.ELITE;
  if (config.parentId && state.agents[config.parentId]) {
    const parent = state.agents[config.parentId];
    // Cap at parent's tier, max CERTIFIED (no spawning ELITE)
    trustCeiling = Math.min(parent.tier, TrustTier.CERTIFIED) as TrustTier;
  }
  
  const agent: Agent = {
    id,
    name: config.name,
    purpose: config.purpose,
    persona: config.persona,
    
    trustScore: initialScore,
    tier: initialTier,
    trustCeiling,
    
    parentId: config.parentId || null,
    spawnedAgents: [],
    
    status: isRoot ? AgentStatus.IDLE : AgentStatus.INITIALIZING,
    currentTaskId: null,
    lastActivity: now,
    
    modelId: config.modelId || 'claude-sonnet-4-20250514',
    
    tasksCompleted: 0,
    tasksFailed: 0,
    messagesProcessed: 0,
    
    createdAt: now,
  };
  
  // Update parent's spawnedAgents
  if (config.parentId && state.agents[config.parentId]) {
    state.agents[config.parentId].spawnedAgents.push(id);
  }
  
  state.agents[id] = agent;
  
  // Log event
  state.events.push({
    id: nanoid(),
    type: EventType.AGENT_CREATED,
    agentId: id,
    message: `Agent "${agent.name}" created`,
    details: { tier: initialTier, parentId: config.parentId },
    timestamp: now,
  });
  
  return { state, agent };
}

export function updateAgentStatus(
  state: WorldState,
  agentId: AgentId,
  status: AgentStatus,
  taskId?: TaskId
): WorldState {
  const agent = state.agents[agentId];
  if (!agent) return state;
  
  const oldStatus = agent.status;
  agent.status = status;
  agent.currentTaskId = taskId || null;
  agent.lastActivity = Date.now();
  
  state.events.push({
    id: nanoid(),
    type: EventType.AGENT_STATUS_CHANGE,
    agentId,
    message: `${agent.name}: ${oldStatus} → ${status}`,
    details: { oldStatus, newStatus: status, taskId },
    timestamp: Date.now(),
  });
  
  return state;
}

export function updateTrustScore(
  state: WorldState,
  agentId: AgentId,
  delta: number,
  reason: string
): WorldState {
  const agent = state.agents[agentId];
  if (!agent) return state;
  
  const oldScore = agent.trustScore;
  const oldTier = agent.tier;
  
  // Apply delta with bounds
  agent.trustScore = Math.max(0, Math.min(1000, agent.trustScore + delta));
  
  // Recalculate tier (respect ceiling)
  let newTier = TrustTier.UNTRUSTED;
  for (const [tier, threshold] of Object.entries(TIER_THRESHOLDS).reverse()) {
    if (agent.trustScore >= threshold) {
      newTier = parseInt(tier) as TrustTier;
      break;
    }
  }
  agent.tier = Math.min(newTier, agent.trustCeiling) as TrustTier;
  
  state.events.push({
    id: nanoid(),
    type: EventType.TRUST_CHANGE,
    agentId,
    message: `${agent.name}: ${oldScore} → ${agent.trustScore} (${delta > 0 ? '+' : ''}${delta})`,
    details: { oldScore, newScore: agent.trustScore, oldTier, newTier: agent.tier, reason },
    timestamp: Date.now(),
  });
  
  return state;
}

// ============================================================================
// TASK OPERATIONS
// ============================================================================

export function createTask(
  state: WorldState,
  config: {
    type: TaskType;
    title: string;
    description: string;
    input: Record<string, unknown>;
    createdBy: AgentId;
    parentTaskId?: TaskId;
    requiredTier?: TrustTier;
  }
): { state: WorldState; task: Task } {
  const id = `task_${nanoid(8)}`;
  const now = Date.now();
  
  // Inherit delegation count from parent
  let currentDelegations = 0;
  if (config.parentTaskId && state.tasks[config.parentTaskId]) {
    currentDelegations = state.tasks[config.parentTaskId].currentDelegations;
  }
  
  const task: Task = {
    id,
    type: config.type,
    title: config.title,
    description: config.description,
    
    createdBy: config.createdBy,
    assignedTo: null,
    
    status: TaskStatus.PENDING,
    input: config.input,
    output: null,
    error: null,
    
    parentTaskId: config.parentTaskId || null,
    subtaskIds: [],
    
    requiredTier: config.requiredTier || TrustTier.UNTRUSTED,
    maxDelegations: EXECUTION_RULES.MAX_DELEGATIONS,
    currentDelegations,
    
    createdAt: now,
    startedAt: null,
    completedAt: null,
    
    reviewedBy: null,
    reviewScore: null,
  };
  
  // Update parent's subtaskIds
  if (config.parentTaskId && state.tasks[config.parentTaskId]) {
    state.tasks[config.parentTaskId].subtaskIds.push(id);
  }
  
  state.tasks[id] = task;
  state.pendingTasks.push(id);
  
  state.events.push({
    id: nanoid(),
    type: EventType.TASK_CREATED,
    taskId: id,
    agentId: config.createdBy,
    message: `Task created: "${task.title}"`,
    details: { type: config.type, requiredTier: config.requiredTier },
    timestamp: now,
  });
  
  return { state, task };
}

export function assignTask(
  state: WorldState,
  taskId: TaskId,
  agentId: AgentId
): WorldState {
  const task = state.tasks[taskId];
  const agent = state.agents[agentId];
  if (!task || !agent) return state;
  
  // Check tier requirement
  if (agent.tier < task.requiredTier) {
    state.events.push({
      id: nanoid(),
      type: EventType.SYSTEM,
      agentId,
      taskId,
      message: `Cannot assign: ${agent.name} tier too low`,
      timestamp: Date.now(),
    });
    return state;
  }
  
  task.assignedTo = agentId;
  task.status = TaskStatus.ASSIGNED;
  
  // Remove from pending
  state.pendingTasks = state.pendingTasks.filter(id => id !== taskId);
  
  state.events.push({
    id: nanoid(),
    type: EventType.TASK_ASSIGNED,
    taskId,
    agentId,
    message: `"${task.title}" assigned to ${agent.name}`,
    timestamp: Date.now(),
  });
  
  return state;
}

export function startTask(
  state: WorldState,
  taskId: TaskId
): WorldState {
  const task = state.tasks[taskId];
  if (!task || !task.assignedTo) return state;
  
  task.status = TaskStatus.IN_PROGRESS;
  task.startedAt = Date.now();
  
  state = updateAgentStatus(state, task.assignedTo, AgentStatus.EXECUTING, taskId);
  
  state.events.push({
    id: nanoid(),
    type: EventType.TASK_STARTED,
    taskId,
    agentId: task.assignedTo,
    message: `Started: "${task.title}"`,
    timestamp: Date.now(),
  });
  
  return state;
}

export function completeTask(
  state: WorldState,
  taskId: TaskId,
  output: Record<string, unknown>
): WorldState {
  const task = state.tasks[taskId];
  if (!task || !task.assignedTo) return state;
  
  const agent = state.agents[task.assignedTo];
  
  task.status = TaskStatus.COMPLETED;
  task.output = output;
  task.completedAt = Date.now();
  
  if (agent) {
    agent.tasksCompleted++;
    state = updateAgentStatus(state, task.assignedTo, AgentStatus.IDLE);
    state = updateTrustScore(
      state,
      task.assignedTo,
      EXECUTION_RULES.TRUST_REWARDS.TASK_COMPLETED,
      'Task completed'
    );
  }
  
  state.totalTasksCompleted++;
  
  state.events.push({
    id: nanoid(),
    type: EventType.TASK_COMPLETED,
    taskId,
    agentId: task.assignedTo,
    message: `Completed: "${task.title}"`,
    details: { output },
    timestamp: Date.now(),
  });
  
  return state;
}

export function failTask(
  state: WorldState,
  taskId: TaskId,
  error: string
): WorldState {
  const task = state.tasks[taskId];
  if (!task || !task.assignedTo) return state;
  
  const agent = state.agents[task.assignedTo];
  
  task.status = TaskStatus.FAILED;
  task.error = error;
  task.completedAt = Date.now();
  
  if (agent) {
    agent.tasksFailed++;
    state = updateAgentStatus(state, task.assignedTo, AgentStatus.IDLE);
    state = updateTrustScore(
      state,
      task.assignedTo,
      EXECUTION_RULES.TRUST_PENALTIES.TASK_FAILED,
      'Task failed'
    );
  }
  
  state.totalTasksFailed++;
  
  state.events.push({
    id: nanoid(),
    type: EventType.TASK_FAILED,
    taskId,
    agentId: task.assignedTo,
    message: `Failed: "${task.title}"`,
    details: { error },
    timestamp: Date.now(),
  });
  
  return state;
}

export function delegateTask(
  state: WorldState,
  taskId: TaskId,
  fromAgentId: AgentId,
  toAgentId: AgentId
): WorldState {
  const task = state.tasks[taskId];
  const fromAgent = state.agents[fromAgentId];
  const toAgent = state.agents[toAgentId];
  
  if (!task || !fromAgent || !toAgent) return state;
  
  // Check if delegation is allowed
  if (!EXECUTION_RULES.CAN_DELEGATE_TIERS.includes(fromAgent.tier)) {
    state.events.push({
      id: nanoid(),
      type: EventType.SYSTEM,
      agentId: fromAgentId,
      taskId,
      message: `${fromAgent.name} cannot delegate (tier too low)`,
      timestamp: Date.now(),
    });
    return state;
  }
  
  // Check delegation limit
  if (task.currentDelegations >= task.maxDelegations) {
    state.events.push({
      id: nanoid(),
      type: EventType.SYSTEM,
      agentId: fromAgentId,
      taskId,
      message: `Cannot delegate: max delegations reached (${task.maxDelegations})`,
      timestamp: Date.now(),
    });
    // Penalize excessive delegation
    state = updateTrustScore(
      state,
      fromAgentId,
      EXECUTION_RULES.TRUST_PENALTIES.EXCESSIVE_DELEGATION,
      'Attempted excessive delegation'
    );
    return state;
  }
  
  // Perform delegation
  task.assignedTo = toAgentId;
  task.currentDelegations++;
  
  state = updateAgentStatus(state, fromAgentId, AgentStatus.IDLE);
  
  state.events.push({
    id: nanoid(),
    type: EventType.TASK_ASSIGNED,
    taskId,
    agentId: toAgentId,
    message: `${fromAgent.name} delegated "${task.title}" to ${toAgent.name}`,
    details: { delegationCount: task.currentDelegations },
    timestamp: Date.now(),
  });
  
  return state;
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

export function sendMessage(
  state: WorldState,
  fromAgent: AgentId,
  toAgent: AgentId,
  content: string
): WorldState {
  const from = state.agents[fromAgent];
  const to = state.agents[toAgent];
  if (!from || !to) return state;
  
  const message: Message = {
    id: nanoid(),
    fromAgent,
    toAgent,
    content,
    timestamp: Date.now(),
    read: false,
  };
  
  state.messages.push(message);
  
  // Keep only last 100 messages
  if (state.messages.length > 100) {
    state.messages = state.messages.slice(-100);
  }
  
  state.events.push({
    id: nanoid(),
    type: EventType.MESSAGE_SENT,
    agentId: fromAgent,
    message: `${from.name} → ${to.name}: "${content.slice(0, 50)}..."`,
    timestamp: Date.now(),
  });
  
  return state;
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getIdleAgents(state: WorldState): Agent[] {
  return Object.values(state.agents).filter(a => a.status === AgentStatus.IDLE);
}

export function getPendingTasks(state: WorldState): Task[] {
  return state.pendingTasks
    .map(id => state.tasks[id])
    .filter((t): t is Task => t !== undefined && t.status === TaskStatus.PENDING);
}

export function getAgentTasks(state: WorldState, agentId: AgentId): Task[] {
  return Object.values(state.tasks).filter(t => t.assignedTo === agentId);
}

export function canExecute(agent: Agent, task: Task): boolean {
  // Tier check
  if (agent.tier < task.requiredTier) return false;
  
  // Status check
  if (agent.status !== AgentStatus.IDLE) return false;
  
  return true;
}

export function mustExecute(agent: Agent, task: Task): boolean {
  // Low tiers must execute
  if (EXECUTION_RULES.MUST_EXECUTE_TIERS.includes(agent.tier)) return true;
  
  // Max delegations reached
  if (task.currentDelegations >= task.maxDelegations) return true;
  
  return false;
}
