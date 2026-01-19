/**
 * TrustBot Live - Shared Types
 * 
 * Single source of truth for all state types.
 * Stored in Vercel KV, streamed to dashboard via SSE.
 */

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

export const TIER_THRESHOLDS = {
  [TrustTier.UNTRUSTED]: 0,
  [TrustTier.PROBATIONARY]: 200,
  [TrustTier.TRUSTED]: 400,
  [TrustTier.VERIFIED]: 600,
  [TrustTier.CERTIFIED]: 800,
  [TrustTier.ELITE]: 950,
};

export const TIER_NAMES: Record<TrustTier, string> = {
  [TrustTier.UNTRUSTED]: 'Untrusted',
  [TrustTier.PROBATIONARY]: 'Probationary',
  [TrustTier.TRUSTED]: 'Trusted',
  [TrustTier.VERIFIED]: 'Verified',
  [TrustTier.CERTIFIED]: 'Certified',
  [TrustTier.ELITE]: 'Elite',
};

export const TIER_COLORS: Record<TrustTier, string> = {
  [TrustTier.UNTRUSTED]: '#6b7280',      // gray
  [TrustTier.PROBATIONARY]: '#f59e0b',   // amber
  [TrustTier.TRUSTED]: '#3b82f6',        // blue
  [TrustTier.VERIFIED]: '#8b5cf6',       // violet
  [TrustTier.CERTIFIED]: '#10b981',      // emerald
  [TrustTier.ELITE]: '#f43f5e',          // rose
};

// ============================================================================
// AGENT TYPES
// ============================================================================

export type AgentId = string;
export type TaskId = string;

export enum AgentStatus {
  INITIALIZING = 'initializing',
  IDLE = 'idle',
  THINKING = 'thinking',
  EXECUTING = 'executing',
  WAITING = 'waiting',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

export interface Agent {
  id: AgentId;
  name: string;
  purpose: string;
  persona: string;
  
  // Trust
  trustScore: number;
  tier: TrustTier;
  trustCeiling: TrustTier;
  
  // Lineage
  parentId: AgentId | null;
  spawnedAgents: AgentId[];
  
  // State
  status: AgentStatus;
  currentTaskId: TaskId | null;
  lastActivity: number;
  
  // Model config
  modelId: string;
  
  // Stats
  tasksCompleted: number;
  tasksFailed: number;
  messagesProcessed: number;
  
  createdAt: number;
}

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
}

export enum TaskType {
  // Executable tasks (agent does real work)
  EXECUTE = 'execute',
  ANALYZE = 'analyze',
  GENERATE = 'generate',
  VALIDATE = 'validate',
  
  // Coordination tasks (may spawn subtasks)
  COORDINATE = 'coordinate',
  RESEARCH = 'research',
  
  // System tasks
  ACADEMY_MODULE = 'academy_module',
}

export interface Task {
  id: TaskId;
  type: TaskType;
  title: string;
  description: string;
  
  // Assignment
  createdBy: AgentId;
  assignedTo: AgentId | null;
  
  // Execution
  status: TaskStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  
  // Hierarchy
  parentTaskId: TaskId | null;
  subtaskIds: TaskId[];
  
  // Constraints
  requiredTier: TrustTier;
  maxDelegations: number;  // Prevent infinite delegation chains
  currentDelegations: number;
  
  // Timing
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  
  // Review
  reviewedBy: AgentId | null;
  reviewScore: number | null;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface Message {
  id: string;
  fromAgent: AgentId;
  toAgent: AgentId;
  content: string;
  timestamp: number;
  read: boolean;
}

// ============================================================================
// EVENT LOG (for dashboard)
// ============================================================================

export enum EventType {
  AGENT_CREATED = 'agent_created',
  AGENT_STATUS_CHANGE = 'agent_status_change',
  TRUST_CHANGE = 'trust_change',
  TASK_CREATED = 'task_created',
  TASK_ASSIGNED = 'task_assigned',
  TASK_STARTED = 'task_started',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  MESSAGE_SENT = 'message_sent',
  EXECUTION_LOG = 'execution_log',
  SYSTEM = 'system',
}

export interface SystemEvent {
  id: string;
  type: EventType;
  agentId?: AgentId;
  taskId?: TaskId;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

// ============================================================================
// WORLD STATE (single source of truth)
// ============================================================================

export interface WorldState {
  tick: number;
  agents: Record<AgentId, Agent>;
  tasks: Record<TaskId, Task>;
  messages: Message[];
  events: SystemEvent[];
  
  // Queues
  pendingTasks: TaskId[];
  
  // Metrics
  totalTasksCompleted: number;
  totalTasksFailed: number;
  
  lastUpdated: number;
}

// ============================================================================
// EXECUTION CONTEXT
// ============================================================================

/**
 * What an agent sees when executing a task.
 * This is the "prompt context" that gets sent to the LLM.
 */
export interface ExecutionContext {
  agent: Agent;
  task: Task;
  
  // What the agent can see
  visibleAgents: Agent[];          // Based on tier
  relatedTasks: Task[];            // Parent, siblings
  recentMessages: Message[];       // Messages to/from this agent
  recentEvents: SystemEvent[];     // Relevant system events
  
  // What the agent can do
  availableActions: ActionType[];
}

export enum ActionType {
  // Task execution
  SUBMIT_RESULT = 'submit_result',
  REPORT_FAILURE = 'report_failure',
  REQUEST_HELP = 'request_help',
  
  // Task management (VERIFIED+)
  CREATE_SUBTASK = 'create_subtask',
  DELEGATE_TASK = 'delegate_task',
  
  // Communication
  SEND_MESSAGE = 'send_message',
  
  // Agent management (CERTIFIED+)
  SPAWN_AGENT = 'spawn_agent',
}

export interface AgentAction {
  type: ActionType;
  payload: Record<string, unknown>;
}

// ============================================================================
// EXECUTION RULES
// ============================================================================

/**
 * Rules to prevent infinite delegation and ensure actual work happens.
 */
export const EXECUTION_RULES = {
  // Max times a task can be delegated before it must be executed
  MAX_DELEGATIONS: 2,
  
  // Tiers that CAN delegate (but don't have to)
  CAN_DELEGATE_TIERS: [TrustTier.VERIFIED, TrustTier.CERTIFIED, TrustTier.ELITE],
  
  // Tiers that MUST execute (cannot delegate)
  MUST_EXECUTE_TIERS: [TrustTier.UNTRUSTED, TrustTier.PROBATIONARY, TrustTier.TRUSTED],
  
  // Trust score changes
  TRUST_REWARDS: {
    TASK_COMPLETED: 10,
    TASK_REVIEWED_GOOD: 5,
    SUBTASK_COMPLETED: 3,
  },
  
  TRUST_PENALTIES: {
    TASK_FAILED: -15,
    TASK_TIMEOUT: -10,
    INVALID_DELEGATION: -20,
    EXCESSIVE_DELEGATION: -25,
  },
};
