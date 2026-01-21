/**
 * Agent Collaboration System Types
 *
 * Type definitions for agent-to-agent collaboration, consensus,
 * proactive actions, and excellence cycles.
 */

// ============================================================================
// Canonical Type Imports from @vorion/contracts
// ============================================================================

import {
  AgentTask as CanonicalAgentTask,
  TaskPriority,
  TaskStatus as CanonicalTaskStatus,
  TaskSource as CanonicalTaskSource,
  CollaborationMode as CanonicalCollaborationMode,
  agentTaskSchema,
  taskPrioritySchema,
  taskStatusSchema,
  taskSourceSchema,
  collaborationModeSchema,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_SOURCES,
  COLLABORATION_MODES,
} from '@vorion/contracts';

// Re-export canonical types for backwards compatibility
export {
  CanonicalAgentTask,
  TaskPriority,
  CanonicalTaskStatus,
  CanonicalTaskSource,
  CanonicalCollaborationMode,
  agentTaskSchema,
  taskPrioritySchema,
  taskStatusSchema,
  taskSourceSchema,
  collaborationModeSchema,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_SOURCES,
  COLLABORATION_MODES,
};

// ============================================================================
// COLLABORATION TYPES
// ============================================================================

export type CollaborationMode =
  | 'DELEGATE'    // Hand off entirely
  | 'CONSULT'     // Ask for input, retain ownership
  | 'PARALLEL'    // Work simultaneously
  | 'SEQUENTIAL'  // Chain of agents
  | 'CONSENSUS';  // Multiple agents must agree

export type CollaborationStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type Urgency = 'low' | 'medium' | 'high' | 'critical';

export interface AgentCollaboration {
  id: string;
  initiatorId: string;
  targetId?: string;
  participants: string[];
  mode: CollaborationMode;
  taskType: string;
  taskDescription?: string;
  context: Record<string, unknown>;
  urgency: Urgency;
  expectedOutcome?: string;
  status: CollaborationStatus;
  finalOutcome?: string;
  successRate?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  deadline?: Date;
}

export interface CollaborationOutcome {
  id: string;
  collaborationId: string;
  agentId: string;
  contribution: string;
  confidence: number;
  actionItems: ActionItem[];
  timeSpentMs?: number;
  tokensUsed?: number;
  submittedAt: Date;
}

export interface ActionItem {
  id: string;
  description: string;
  priority: Urgency;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: string;
}

// ============================================================================
// CONSENSUS TYPES
// ============================================================================

export type ConsensusStatus =
  | 'voting'
  | 'consensus_reached'
  | 'no_consensus'
  | 'expired'
  | 'cancelled';

export type VoteChoice = 'approve' | 'reject' | 'abstain';

export interface AgentConsensus {
  id: string;
  initiatorId: string;
  question: string;
  context: Record<string, unknown>;
  participants: string[];
  requiredAgreement: number;
  status: ConsensusStatus;
  finalDecision?: string;
  agreementRate?: number;
  createdAt: Date;
  deadline?: Date;
  resolvedAt?: Date;
}

export interface ConsensusVote {
  id: string;
  consensusId: string;
  agentId: string;
  vote: VoteChoice;
  reasoning?: string;
  confidence: number;
  votedAt: Date;
}

// ============================================================================
// PROACTIVE ACTION TYPES
// ============================================================================

export type ProactiveBehavior =
  | 'ANTICIPATE'
  | 'ANALYZE'
  | 'DELEGATE'
  | 'ESCALATE'
  | 'ITERATE'
  | 'COLLABORATE'
  | 'MONITOR'
  | 'SUGGEST';

export type ProactiveStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ProactiveAction {
  id: string;
  agentId: string;
  behavior: ProactiveBehavior;
  triggerEvent: string;
  analysis?: string;
  recommendation: string;
  actionSteps: ActionStep[];
  delegatedTo?: string;
  collaboratedWith: string[];
  priority: Urgency;
  confidence?: number;
  status: ProactiveStatus;
  outcome?: string;
  success?: boolean;
  createdAt: Date;
  executedAt?: Date;
  completedAt?: Date;
}

export interface ActionStep {
  order: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  result?: string;
}

// ============================================================================
// EXCELLENCE CYCLE TYPES
// ============================================================================

export type ExcellencePhase =
  | 'FIND'
  | 'FIX'
  | 'IMPLEMENT'
  | 'CHANGE'
  | 'ITERATE'
  | 'SUCCEED';

export type CycleStatus = 'active' | 'completed' | 'failed' | 'paused';

export interface ExcellenceCycle {
  id: string;
  agentId: string;
  phase: ExcellencePhase;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  itemsFound: number;
  issuesFixed: number;
  featuresImplemented: number;
  changesApplied: number;
  iterationsCompleted: number;
  successRate?: number;
  status: CycleStatus;
  startedAt: Date;
  completedAt?: Date;
  nextPhase?: ExcellencePhase;
}

// ============================================================================
// TASK QUEUE TYPES
// ============================================================================

/**
 * @deprecated Use `TaskSource` from `@vorion/contracts` instead.
 * This local definition is maintained for backwards compatibility.
 */
export type TaskSource =
  | 'system'
  | 'user'
  | 'agent'
  | 'collaboration'
  | 'proactive'
  | 'scheduled';

/**
 * @deprecated Use `TaskStatus` from `@vorion/contracts` instead.
 * This local definition is maintained for backwards compatibility.
 * The canonical version includes additional statuses: 'active', 'paused', 'delegated'.
 */
export type TaskStatus =
  | 'queued'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * @deprecated Use `AgentTask` from `@vorion/contracts` instead.
 * This local definition is maintained for backwards compatibility.
 * The canonical version includes additional fields like `title`, `input`,
 * `output`, `metadata`, and uses `TaskPriority` enum for priority.
 */
export interface AgentTask {
  id: string;
  agentId: string;
  taskType: string;
  description: string;
  context: Record<string, unknown>;
  priority: number;
  urgency: Urgency;
  scheduledFor?: Date;
  deadline?: Date;
  source: TaskSource;
  sourceId?: string;
  status: TaskStatus;
  startedAt?: Date;
  completedAt?: Date;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateCollaborationRequest {
  initiatorId: string;
  targetId?: string;
  participants?: string[];
  mode: CollaborationMode;
  taskType: string;
  taskDescription?: string;
  context?: Record<string, unknown>;
  urgency?: Urgency;
  expectedOutcome?: string;
  deadline?: Date;
}

export interface SubmitOutcomeRequest {
  collaborationId: string;
  agentId: string;
  contribution: string;
  confidence: number;
  actionItems?: ActionItem[];
  timeSpentMs?: number;
  tokensUsed?: number;
}

export interface CreateConsensusRequest {
  initiatorId: string;
  question: string;
  context?: Record<string, unknown>;
  participants: string[];
  requiredAgreement?: number;
  deadline?: Date;
}

export interface SubmitVoteRequest {
  consensusId: string;
  agentId: string;
  vote: VoteChoice;
  reasoning?: string;
  confidence: number;
}

export interface CreateProactiveActionRequest {
  agentId: string;
  behavior: ProactiveBehavior;
  triggerEvent: string;
  analysis?: string;
  recommendation: string;
  actionSteps?: ActionStep[];
  delegatedTo?: string;
  collaboratedWith?: string[];
  priority?: Urgency;
  confidence?: number;
}

export interface QueueTaskRequest {
  agentId: string;
  taskType: string;
  description: string;
  context?: Record<string, unknown>;
  priority?: number;
  urgency?: Urgency;
  scheduledFor?: Date;
  deadline?: Date;
  source?: TaskSource;
  sourceId?: string;
}

export interface StartCycleRequest {
  agentId: string;
  input?: Record<string, unknown>;
}

export interface AdvanceCycleRequest {
  cycleId: string;
  output?: Record<string, unknown>;
  metrics?: {
    itemsFound?: number;
    issuesFixed?: number;
    featuresImplemented?: number;
    changesApplied?: number;
    iterationsCompleted?: number;
  };
}
