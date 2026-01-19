/**
 * TrustBot Unified - Core Types
 * Shared across dashboard, API, MCP server, and headquarters
 */

import { z } from 'zod';

// ============================================================================
// TRUST SYSTEM
// ============================================================================

export enum TrustTier {
  UNTRUSTED = 0,
  PROBATIONARY = 1,
  TRUSTED = 2,
  VERIFIED = 3,
  CERTIFIED = 4,
  ELITE = 5,
}

export const TIER_CONFIG = {
  [TrustTier.UNTRUSTED]: {
    name: 'Untrusted',
    color: '#6b7280',
    threshold: 0,
    canDelegate: false,
    canSpawn: false,
    canCreateChannels: false,
    maxConcurrentTasks: 1,
  },
  [TrustTier.PROBATIONARY]: {
    name: 'Probationary',
    color: '#f59e0b',
    threshold: 200,
    canDelegate: false,
    canSpawn: false,
    canCreateChannels: false,
    maxConcurrentTasks: 1,
  },
  [TrustTier.TRUSTED]: {
    name: 'Trusted',
    color: '#3b82f6',
    threshold: 400,
    canDelegate: false,
    canSpawn: false,
    canCreateChannels: false,
    maxConcurrentTasks: 3,
  },
  [TrustTier.VERIFIED]: {
    name: 'Verified',
    color: '#8b5cf6',
    threshold: 600,
    canDelegate: true,
    canSpawn: false,
    canCreateChannels: false,
    maxConcurrentTasks: 5,
  },
  [TrustTier.CERTIFIED]: {
    name: 'Certified',
    color: '#10b981',
    threshold: 800,
    canDelegate: true,
    canSpawn: true,
    canCreateChannels: true,
    maxConcurrentTasks: 10,
  },
  [TrustTier.ELITE]: {
    name: 'Elite',
    color: '#f43f5e',
    threshold: 950,
    canDelegate: true,
    canSpawn: true,
    canCreateChannels: true,
    maxConcurrentTasks: Infinity,
  },
} as const;

// ============================================================================
// AGENT TYPES
// ============================================================================

export type AgentId = string;
export type TaskId = string;
export type ChannelId = string;
export type MessageId = string;
export type EventId = string;

export enum AgentStatus {
  INITIALIZING = 'initializing',
  IDLE = 'idle',
  THINKING = 'thinking',
  EXECUTING = 'executing',
  WAITING = 'waiting',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string(),
  persona: z.string(),
  
  trustScore: z.number().min(0).max(1000),
  tier: z.nativeEnum(TrustTier),
  trustCeiling: z.nativeEnum(TrustTier),
  
  parentId: z.string().nullable(),
  spawnedAgents: z.array(z.string()),
  
  status: z.nativeEnum(AgentStatus),
  currentTaskId: z.string().nullable(),
  lastActivity: z.number(),
  
  modelId: z.string(),
  
  tasksCompleted: z.number(),
  tasksFailed: z.number(),
  messagesProcessed: z.number(),
  
  createdAt: z.number(),
  
  // Extended metadata for headquarters integration
  metadata: z.record(z.unknown()).optional(),
});

export type Agent = z.infer<typeof AgentSchema>;

// ============================================================================
// TASK TYPES
// ============================================================================

export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  AWAITING_REVIEW = 'awaiting_review',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TaskType {
  EXECUTE = 'execute',
  ANALYZE = 'analyze',
  GENERATE = 'generate',
  VALIDATE = 'validate',
  COORDINATE = 'coordinate',
  RESEARCH = 'research',
  ACADEMY_MODULE = 'academy_module',
  MCP_TOOL_CALL = 'mcp_tool_call',
}

export const TaskSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(TaskType),
  title: z.string(),
  description: z.string(),
  
  createdBy: z.string(),
  assignedTo: z.string().nullable(),
  
  status: z.nativeEnum(TaskStatus),
  input: z.record(z.unknown()),
  output: z.record(z.unknown()).nullable(),
  error: z.string().nullable(),
  
  parentTaskId: z.string().nullable(),
  subtaskIds: z.array(z.string()),
  
  requiredTier: z.nativeEnum(TrustTier),
  maxDelegations: z.number(),
  currentDelegations: z.number(),
  
  createdAt: z.number(),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
  
  reviewedBy: z.string().nullable(),
  reviewScore: z.number().nullable(),
  
  // MCP integration
  mcpServer: z.string().optional(),
  mcpTool: z.string().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

// ============================================================================
// MESSAGE & CHANNEL TYPES
// ============================================================================

export const MessageSchema = z.object({
  id: z.string(),
  channelId: z.string().optional(),
  fromAgent: z.string(),
  toAgent: z.string().nullable(),
  content: z.string(),
  timestamp: z.number(),
  read: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
});

export type Message = z.infer<typeof MessageSchema>;

export enum ChannelType {
  DIRECT = 'direct',
  TOPIC = 'topic',
  BROADCAST = 'broadcast',
}

export const ChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.nativeEnum(ChannelType),
  createdBy: z.string(),
  members: z.array(z.string()),
  createdAt: z.number(),
});

export type Channel = z.infer<typeof ChannelSchema>;

// ============================================================================
// EVENT LOG
// ============================================================================

export enum EventType {
  AGENT_CREATED = 'agent_created',
  AGENT_STATUS_CHANGE = 'agent_status_change',
  AGENT_SPAWNED = 'agent_spawned',
  TRUST_CHANGE = 'trust_change',
  TIER_CHANGE = 'tier_change',
  TASK_CREATED = 'task_created',
  TASK_ASSIGNED = 'task_assigned',
  TASK_STARTED = 'task_started',
  TASK_DELEGATED = 'task_delegated',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  MESSAGE_SENT = 'message_sent',
  CHANNEL_CREATED = 'channel_created',
  MCP_TOOL_REGISTERED = 'mcp_tool_registered',
  MCP_TOOL_CALLED = 'mcp_tool_called',
  EXECUTION_LOG = 'execution_log',
  SYSTEM = 'system',
  ERROR = 'error',
}

export const SystemEventSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(EventType),
  agentId: z.string().optional(),
  taskId: z.string().optional(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.number(),
  severity: z.enum(['debug', 'info', 'warn', 'error']).optional(),
});

export type SystemEvent = z.infer<typeof SystemEventSchema>;

// ============================================================================
// MCP INTEGRATION
// ============================================================================

export const MCPToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.unknown()),
  server: z.string(),
  requiredTier: z.nativeEnum(TrustTier).optional(),
});

export type MCPTool = z.infer<typeof MCPToolSchema>;

export const MCPServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  status: z.enum(['connected', 'disconnected', 'error']),
  tools: z.array(MCPToolSchema),
  lastPing: z.number(),
});

export type MCPServer = z.infer<typeof MCPServerSchema>;

// ============================================================================
// WORLD STATE
// ============================================================================

export const WorldStateSchema = z.object({
  tick: z.number(),
  
  agents: z.record(AgentSchema),
  tasks: z.record(TaskSchema),
  messages: z.array(MessageSchema),
  channels: z.record(ChannelSchema),
  events: z.array(SystemEventSchema),
  
  // MCP
  mcpServers: z.record(MCPServerSchema),
  mcpTools: z.record(MCPToolSchema),
  
  // Queues
  pendingTasks: z.array(z.string()),
  
  // Metrics
  totalTasksCompleted: z.number(),
  totalTasksFailed: z.number(),
  totalAgentsSpawned: z.number(),
  
  lastUpdated: z.number(),
  version: z.string(),
});

export type WorldState = z.infer<typeof WorldStateSchema>;

// ============================================================================
// API TYPES
// ============================================================================

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// EXECUTION RULES
// ============================================================================

export const EXECUTION_RULES = {
  MAX_DELEGATIONS: 2,
  
  TRUST_REWARDS: {
    TASK_COMPLETED: 10,
    TASK_REVIEWED_GOOD: 5,
    SUBTASK_COMPLETED: 3,
    MCP_TOOL_SUCCESS: 2,
    ACADEMY_MODULE_PASSED: 15,
  },
  
  TRUST_PENALTIES: {
    TASK_FAILED: -15,
    TASK_TIMEOUT: -10,
    INVALID_DELEGATION: -20,
    EXCESSIVE_DELEGATION: -25,
    MCP_TOOL_ABUSE: -30,
    SECURITY_VIOLATION: -50,
  },
  
  TICK_INTERVAL_MS: 1000,
  MAX_EVENTS_STORED: 1000,
  MAX_MESSAGES_STORED: 500,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getTierFromScore(score: number): TrustTier {
  for (const tier of [
    TrustTier.ELITE,
    TrustTier.CERTIFIED,
    TrustTier.VERIFIED,
    TrustTier.TRUSTED,
    TrustTier.PROBATIONARY,
  ]) {
    if (score >= TIER_CONFIG[tier].threshold) {
      return tier;
    }
  }
  return TrustTier.UNTRUSTED;
}

export function canAgentDelegate(agent: Agent): boolean {
  return TIER_CONFIG[agent.tier].canDelegate;
}

export function canAgentSpawn(agent: Agent): boolean {
  return TIER_CONFIG[agent.tier].canSpawn;
}

export function mustAgentExecute(agent: Agent, task: Task): boolean {
  // Low tiers must execute
  if (!TIER_CONFIG[agent.tier].canDelegate) return true;
  
  // Max delegations reached
  if (task.currentDelegations >= task.maxDelegations) return true;
  
  return false;
}

export function createInitialWorldState(): WorldState {
  return {
    tick: 0,
    agents: {},
    tasks: {},
    messages: [],
    channels: {},
    events: [],
    mcpServers: {},
    mcpTools: {},
    pendingTasks: [],
    totalTasksCompleted: 0,
    totalTasksFailed: 0,
    totalAgentsSpawned: 0,
    lastUpdated: Date.now(),
    version: '1.0.0',
  };
}
