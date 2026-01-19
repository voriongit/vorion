/**
 * TrustBot Unified - State Management
 * Single source of truth via Vercel KV
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
  Message,
  Channel,
  ChannelType,
  SystemEvent,
  EventType,
  MCPServer,
  MCPTool,
  TIER_CONFIG,
  EXECUTION_RULES,
  getTierFromScore,
  createInitialWorldState,
} from './types';

// ============================================================================
// KV OPERATIONS
// ============================================================================

const WORLD_KEY = 'trustbot:world:v1';
const LOCK_KEY = 'trustbot:lock';

export async function getWorldState(): Promise<WorldState> {
  const state = await kv.get<WorldState>(WORLD_KEY);
  return state || createInitialWorldState();
}

export async function setWorldState(state: WorldState): Promise<void> {
  state.lastUpdated = Date.now();
  await kv.set(WORLD_KEY, state);
}

export async function updateWorldState(
  updater: (state: WorldState) => WorldState | Promise<WorldState>
): Promise<WorldState> {
  const lockId = nanoid();
  
  // Acquire lock with retry
  let attempts = 0;
  while (attempts < 10) {
    const acquired = await kv.setnx(LOCK_KEY, lockId);
    if (acquired) break;
    await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
    attempts++;
  }
  
  try {
    await kv.expire(LOCK_KEY, 5);
    const state = await getWorldState();
    const newState = await updater(state);
    await setWorldState(newState);
    return newState;
  } finally {
    const currentLock = await kv.get(LOCK_KEY);
    if (currentLock === lockId) {
      await kv.del(LOCK_KEY);
    }
  }
}

// ============================================================================
// EVENT HELPERS
// ============================================================================

function addEvent(
  state: WorldState,
  type: EventType,
  message: string,
  details?: {
    agentId?: string;
    taskId?: string;
    extra?: Record<string, unknown>;
    severity?: 'debug' | 'info' | 'warn' | 'error';
  }
): WorldState {
  const event: SystemEvent = {
    id: nanoid(),
    type,
    message,
    agentId: details?.agentId,
    taskId: details?.taskId,
    details: details?.extra,
    severity: details?.severity || 'info',
    timestamp: Date.now(),
  };
  
  state.events.push(event);
  
  // Trim events
  if (state.events.length > EXECUTION_RULES.MAX_EVENTS_STORED) {
    state.events = state.events.slice(-EXECUTION_RULES.MAX_EVENTS_STORED);
  }
  
  return state;
}

// ============================================================================
// AGENT OPERATIONS
// ============================================================================

export interface CreateAgentParams {
  name: string;
  purpose: string;
  persona: string;
  modelId?: string;
  parentId?: AgentId;
  isRoot?: boolean;
  metadata?: Record<string, unknown>;
}

export function createAgent(
  state: WorldState,
  params: CreateAgentParams
): { state: WorldState; agent: Agent } {
  const id = `agent_${nanoid(8)}` as AgentId;
  const now = Date.now();
  
  const isRoot = params.isRoot || false;
  const initialScore = isRoot ? 1000 : 0;
  const initialTier = isRoot ? TrustTier.ELITE : TrustTier.UNTRUSTED;
  
  // Calculate trust ceiling from parent
  let trustCeiling = TrustTier.ELITE;
  if (params.parentId && state.agents[params.parentId]) {
    const parent = state.agents[params.parentId];
    trustCeiling = Math.min(parent.tier, TrustTier.CERTIFIED) as TrustTier;
  }
  
  const agent: Agent = {
    id,
    name: params.name,
    purpose: params.purpose,
    persona: params.persona,
    
    trustScore: initialScore,
    tier: initialTier,
    trustCeiling,
    
    parentId: params.parentId || null,
    spawnedAgents: [],
    
    status: isRoot ? AgentStatus.IDLE : AgentStatus.INITIALIZING,
    currentTaskId: null,
    lastActivity: now,
    
    modelId: params.modelId || 'claude-sonnet-4-20250514',
    
    tasksCompleted: 0,
    tasksFailed: 0,
    messagesProcessed: 0,
    
    createdAt: now,
    metadata: params.metadata,
  };
  
  // Update parent
  if (params.parentId && state.agents[params.parentId]) {
    state.agents[params.parentId].spawnedAgents.push(id);
  }
  
  state.agents[id] = agent;
  state.totalAgentsSpawned++;
  
  state = addEvent(state, EventType.AGENT_CREATED, `Agent "${agent.name}" created`, {
    agentId: id,
    extra: { tier: initialTier, parentId: params.parentId, isRoot },
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
  
  state = addEvent(state, EventType.AGENT_STATUS_CHANGE, `${agent.name}: ${oldStatus} → ${status}`, {
    agentId,
    extra: { oldStatus, newStatus: status, taskId },
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
  
  agent.trustScore = Math.max(0, Math.min(1000, agent.trustScore + delta));
  
  const newTier = getTierFromScore(agent.trustScore);
  agent.tier = Math.min(newTier, agent.trustCeiling) as TrustTier;
  
  state = addEvent(state, EventType.TRUST_CHANGE, 
    `${agent.name}: ${oldScore} → ${agent.trustScore} (${delta > 0 ? '+' : ''}${delta})`, {
    agentId,
    extra: { oldScore, newScore: agent.trustScore, delta, reason },
  });
  
  if (oldTier !== agent.tier) {
    state = addEvent(state, EventType.TIER_CHANGE,
      `${agent.name} ${agent.tier > oldTier ? 'promoted' : 'demoted'} to ${TIER_CONFIG[agent.tier].name}`, {
      agentId,
      extra: { oldTier, newTier: agent.tier },
    });
  }
  
  return state;
}

// ============================================================================
// TASK OPERATIONS
// ============================================================================

export interface CreateTaskParams {
  type?: TaskType;
  title: string;
  description: string;
  input?: Record<string, unknown>;
  createdBy: AgentId;
  parentTaskId?: TaskId;
  requiredTier?: TrustTier;
  mcpServer?: string;
  mcpTool?: string;
}

export function createTask(
  state: WorldState,
  params: CreateTaskParams
): { state: WorldState; task: Task } {
  const id = `task_${nanoid(8)}` as TaskId;
  const now = Date.now();
  
  let currentDelegations = 0;
  if (params.parentTaskId && state.tasks[params.parentTaskId]) {
    currentDelegations = state.tasks[params.parentTaskId].currentDelegations;
  }
  
  const task: Task = {
    id,
    type: params.type || TaskType.EXECUTE,
    title: params.title,
    description: params.description,
    
    createdBy: params.createdBy,
    assignedTo: null,
    
    status: TaskStatus.PENDING,
    input: params.input || {},
    output: null,
    error: null,
    
    parentTaskId: params.parentTaskId || null,
    subtaskIds: [],
    
    requiredTier: params.requiredTier || TrustTier.UNTRUSTED,
    maxDelegations: EXECUTION_RULES.MAX_DELEGATIONS,
    currentDelegations,
    
    createdAt: now,
    startedAt: null,
    completedAt: null,
    
    reviewedBy: null,
    reviewScore: null,
    
    mcpServer: params.mcpServer,
    mcpTool: params.mcpTool,
  };
  
  if (params.parentTaskId && state.tasks[params.parentTaskId]) {
    state.tasks[params.parentTaskId].subtaskIds.push(id);
  }
  
  state.tasks[id] = task;
  state.pendingTasks.push(id);
  
  state = addEvent(state, EventType.TASK_CREATED, `Task created: "${task.title}"`, {
    taskId: id,
    agentId: params.createdBy,
    extra: { type: params.type, requiredTier: params.requiredTier },
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
  
  if (agent.tier < task.requiredTier) {
    state = addEvent(state, EventType.SYSTEM, 
      `Cannot assign "${task.title}" to ${agent.name}: tier too low`, {
      agentId, taskId, severity: 'warn',
    });
    return state;
  }
  
  task.assignedTo = agentId;
  task.status = TaskStatus.ASSIGNED;
  state.pendingTasks = state.pendingTasks.filter(id => id !== taskId);
  
  state = addEvent(state, EventType.TASK_ASSIGNED, 
    `"${task.title}" assigned to ${agent.name}`, {
    taskId, agentId,
  });
  
  return state;
}

export function startTask(state: WorldState, taskId: TaskId): WorldState {
  const task = state.tasks[taskId];
  if (!task || !task.assignedTo) return state;
  
  task.status = TaskStatus.IN_PROGRESS;
  task.startedAt = Date.now();
  
  state = updateAgentStatus(state, task.assignedTo, AgentStatus.EXECUTING, taskId);
  
  state = addEvent(state, EventType.TASK_STARTED, `Started: "${task.title}"`, {
    taskId, agentId: task.assignedTo,
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
    state = updateTrustScore(state, task.assignedTo, 
      EXECUTION_RULES.TRUST_REWARDS.TASK_COMPLETED, 'Task completed');
  }
  
  state.totalTasksCompleted++;
  
  state = addEvent(state, EventType.TASK_COMPLETED, `Completed: "${task.title}"`, {
    taskId, agentId: task.assignedTo, extra: { output },
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
    state = updateTrustScore(state, task.assignedTo,
      EXECUTION_RULES.TRUST_PENALTIES.TASK_FAILED, 'Task failed');
  }
  
  state.totalTasksFailed++;
  
  state = addEvent(state, EventType.TASK_FAILED, `Failed: "${task.title}"`, {
    taskId, agentId: task.assignedTo, extra: { error }, severity: 'error',
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
  
  if (!TIER_CONFIG[fromAgent.tier].canDelegate) {
    state = addEvent(state, EventType.SYSTEM,
      `${fromAgent.name} cannot delegate (tier too low)`, {
      agentId: fromAgentId, taskId, severity: 'warn',
    });
    return state;
  }
  
  if (task.currentDelegations >= task.maxDelegations) {
    state = addEvent(state, EventType.SYSTEM,
      `Cannot delegate: max delegations reached`, {
      agentId: fromAgentId, taskId, severity: 'warn',
    });
    state = updateTrustScore(state, fromAgentId,
      EXECUTION_RULES.TRUST_PENALTIES.EXCESSIVE_DELEGATION,
      'Attempted excessive delegation');
    return state;
  }
  
  task.assignedTo = toAgentId;
  task.currentDelegations++;
  
  state = updateAgentStatus(state, fromAgentId, AgentStatus.IDLE);
  
  state = addEvent(state, EventType.TASK_DELEGATED,
    `${fromAgent.name} delegated "${task.title}" to ${toAgent.name}`, {
    taskId, agentId: toAgentId,
    extra: { fromAgent: fromAgentId, delegationCount: task.currentDelegations },
  });
  
  return state;
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

export function sendMessage(
  state: WorldState,
  fromAgent: AgentId,
  toAgent: AgentId | null,
  content: string,
  channelId?: ChannelId
): WorldState {
  const from = state.agents[fromAgent];
  if (!from) return state;
  
  const message: Message = {
    id: nanoid(),
    channelId,
    fromAgent,
    toAgent,
    content,
    timestamp: Date.now(),
    read: false,
  };
  
  state.messages.push(message);
  
  if (state.messages.length > EXECUTION_RULES.MAX_MESSAGES_STORED) {
    state.messages = state.messages.slice(-EXECUTION_RULES.MAX_MESSAGES_STORED);
  }
  
  const toName = toAgent ? state.agents[toAgent]?.name || toAgent : 'channel';
  state = addEvent(state, EventType.MESSAGE_SENT,
    `${from.name} → ${toName}: "${content.slice(0, 50)}..."`, {
    agentId: fromAgent,
  });
  
  return state;
}

export function createChannel(
  state: WorldState,
  createdBy: AgentId,
  name: string,
  type: ChannelType,
  members: AgentId[]
): { state: WorldState; channel: Channel } {
  const id = `channel_${nanoid(8)}` as ChannelId;
  
  const channel: Channel = {
    id,
    name,
    type,
    createdBy,
    members: [...new Set([createdBy, ...members])],
    createdAt: Date.now(),
  };
  
  state.channels[id] = channel;
  
  state = addEvent(state, EventType.CHANNEL_CREATED, `Channel "${name}" created`, {
    agentId: createdBy, extra: { channelId: id, type },
  });
  
  return { state, channel };
}

// ============================================================================
// MCP OPERATIONS
// ============================================================================

export function registerMCPServer(
  state: WorldState,
  server: Omit<MCPServer, 'lastPing'>
): WorldState {
  state.mcpServers[server.id] = {
    ...server,
    lastPing: Date.now(),
  };
  
  // Register tools
  for (const tool of server.tools) {
    state.mcpTools[`${server.id}:${tool.name}`] = tool;
  }
  
  state = addEvent(state, EventType.MCP_TOOL_REGISTERED,
    `MCP server "${server.name}" registered with ${server.tools.length} tools`, {
    extra: { serverId: server.id, tools: server.tools.map(t => t.name) },
  });
  
  return state;
}

export function updateMCPServerStatus(
  state: WorldState,
  serverId: string,
  status: MCPServer['status']
): WorldState {
  if (state.mcpServers[serverId]) {
    state.mcpServers[serverId].status = status;
    state.mcpServers[serverId].lastPing = Date.now();
  }
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
    .filter((t): t is Task => t !== undefined);
}

export function getAgentTasks(state: WorldState, agentId: AgentId): Task[] {
  return Object.values(state.tasks).filter(t => 
    t.assignedTo === agentId || t.createdBy === agentId
  );
}

export function getAgentChildren(state: WorldState, agentId: AgentId): Agent[] {
  return Object.values(state.agents).filter(a => a.parentId === agentId);
}

export function getAgentLineage(state: WorldState, agentId: AgentId): Agent[] {
  const lineage: Agent[] = [];
  let current = state.agents[agentId];
  
  while (current?.parentId) {
    const parent = state.agents[current.parentId];
    if (!parent) break;
    lineage.push(parent);
    current = parent;
  }
  
  return lineage;
}

export function getAvailableMCPTools(state: WorldState, agent: Agent): MCPTool[] {
  return Object.values(state.mcpTools).filter(tool => {
    if (tool.requiredTier && agent.tier < tool.requiredTier) return false;
    const server = state.mcpServers[tool.server];
    return server?.status === 'connected';
  });
}
