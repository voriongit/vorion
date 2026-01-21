/**
 * @fileoverview Canonical Agent type definitions for the Vorion Platform.
 *
 * This file provides the authoritative definitions for agent-related types,
 * unifying the various representations found across packages into a single
 * canonical source with Zod validation schemas.
 *
 * Agent types cover:
 * - Agent lifecycle status
 * - Runtime operational status
 * - Capabilities and permissions
 * - Configuration and settings
 * - Performance metrics
 * - Task management
 *
 * @module @vorion/contracts/canonical/agent
 */

import { z } from 'zod';

// ============================================================================
// Agent Lifecycle Status
// ============================================================================

/**
 * Canonical agent lifecycle status.
 *
 * Represents the administrative/lifecycle state of an agent in the platform.
 * This is distinct from runtime operational status.
 *
 * States:
 * - `draft`: Initial creation, not yet deployed
 * - `training`: Undergoing training/certification
 * - `active`: Deployed and operational
 * - `suspended`: Temporarily disabled (can be reactivated)
 * - `archived`: Permanently deactivated (historical record)
 *
 * @example
 * ```typescript
 * const status: AgentLifecycleStatus = 'active';
 * ```
 */
export type AgentLifecycleStatus = 'draft' | 'training' | 'active' | 'suspended' | 'archived';

/**
 * Array of all lifecycle statuses in logical order.
 */
export const AGENT_LIFECYCLE_STATUSES: readonly AgentLifecycleStatus[] = [
  'draft',
  'training',
  'active',
  'suspended',
  'archived',
] as const;

/**
 * Human-readable labels for lifecycle statuses.
 */
export const AGENT_LIFECYCLE_LABELS: Readonly<Record<AgentLifecycleStatus, string>> = {
  draft: 'Draft',
  training: 'Training',
  active: 'Active',
  suspended: 'Suspended',
  archived: 'Archived',
} as const;

/**
 * Color codes for lifecycle statuses (for UI display).
 */
export const AGENT_LIFECYCLE_COLORS: Readonly<Record<AgentLifecycleStatus, string>> = {
  draft: '#6b7280',    // Gray
  training: '#f59e0b', // Amber
  active: '#22c55e',   // Green
  suspended: '#ef4444', // Red
  archived: '#9ca3af', // Light Gray
} as const;

/**
 * Zod schema for AgentLifecycleStatus validation.
 */
export const agentLifecycleStatusSchema = z.enum(['draft', 'training', 'active', 'suspended', 'archived'], {
  errorMap: () => ({
    message: "Invalid agent lifecycle status. Must be 'draft', 'training', 'active', 'suspended', or 'archived'.",
  }),
});

// ============================================================================
// Agent Runtime Status
// ============================================================================

/**
 * Canonical agent runtime operational status.
 *
 * Represents the current operational state of an agent during execution.
 * Used for real-time monitoring and coordination.
 *
 * States:
 * - `IDLE`: Ready and waiting for tasks
 * - `WORKING`: Actively processing a task
 * - `PAUSED`: Temporarily halted (can resume)
 * - `ERROR`: In error state requiring attention
 * - `OFFLINE`: Not connected/available
 *
 * @example
 * ```typescript
 * const status: AgentRuntimeStatus = 'WORKING';
 * ```
 */
export type AgentRuntimeStatus = 'IDLE' | 'WORKING' | 'PAUSED' | 'ERROR' | 'OFFLINE';

/**
 * Array of all runtime statuses.
 */
export const AGENT_RUNTIME_STATUSES: readonly AgentRuntimeStatus[] = [
  'IDLE',
  'WORKING',
  'PAUSED',
  'ERROR',
  'OFFLINE',
] as const;

/**
 * Human-readable labels for runtime statuses.
 */
export const AGENT_RUNTIME_LABELS: Readonly<Record<AgentRuntimeStatus, string>> = {
  IDLE: 'Idle',
  WORKING: 'Working',
  PAUSED: 'Paused',
  ERROR: 'Error',
  OFFLINE: 'Offline',
} as const;

/**
 * Color codes for runtime statuses (for UI display).
 */
export const AGENT_RUNTIME_COLORS: Readonly<Record<AgentRuntimeStatus, string>> = {
  IDLE: '#22c55e',    // Green
  WORKING: '#3b82f6', // Blue
  PAUSED: '#f59e0b',  // Amber
  ERROR: '#ef4444',   // Red
  OFFLINE: '#6b7280', // Gray
} as const;

/**
 * Zod schema for AgentRuntimeStatus validation.
 */
export const agentRuntimeStatusSchema = z.enum(['IDLE', 'WORKING', 'PAUSED', 'ERROR', 'OFFLINE'], {
  errorMap: () => ({
    message: "Invalid agent runtime status. Must be 'IDLE', 'WORKING', 'PAUSED', 'ERROR', or 'OFFLINE'.",
  }),
});

// ============================================================================
// Agent Capability Types
// ============================================================================

/**
 * Canonical permission-based agent capability.
 *
 * Represents what actions an agent is authorized to perform.
 * Used for permission enforcement and delegation.
 *
 * Capabilities:
 * - `execute`: Can execute tasks locally
 * - `external`: Can make external API calls
 * - `delegate`: Can delegate tasks to other agents
 * - `spawn`: Can create/spawn new agents
 * - `admin`: Has administrative privileges
 *
 * @example
 * ```typescript
 * const caps: AgentPermission[] = ['execute', 'external'];
 * ```
 */
export type AgentPermission = 'execute' | 'external' | 'delegate' | 'spawn' | 'admin';

/**
 * Array of all agent permissions.
 */
export const AGENT_PERMISSIONS: readonly AgentPermission[] = [
  'execute',
  'external',
  'delegate',
  'spawn',
  'admin',
] as const;

/**
 * Descriptions for each permission.
 */
export const AGENT_PERMISSION_DESCRIPTIONS: Readonly<Record<AgentPermission, string>> = {
  execute: 'Can execute tasks and run operations locally',
  external: 'Can make external API calls and access external services',
  delegate: 'Can delegate tasks to other agents in the hierarchy',
  spawn: 'Can create and spawn new agent instances',
  admin: 'Has full administrative privileges over the system',
} as const;

/**
 * Zod schema for AgentPermission validation.
 */
export const agentPermissionSchema = z.enum(['execute', 'external', 'delegate', 'spawn', 'admin'], {
  errorMap: () => ({
    message: "Invalid agent permission. Must be 'execute', 'external', 'delegate', 'spawn', or 'admin'.",
  }),
});

/**
 * Collaboration mode types for agent interactions.
 */
export type CollaborationMode =
  | 'DELEGATE'    // Hand off task entirely to another agent
  | 'CONSULT'     // Request input while retaining ownership
  | 'PARALLEL'    // Work simultaneously with other agents
  | 'SEQUENTIAL'  // Chain of agents processing in order
  | 'CONSENSUS';  // Multiple agents must agree on outcome

/**
 * Array of all collaboration modes.
 */
export const COLLABORATION_MODES: readonly CollaborationMode[] = [
  'DELEGATE',
  'CONSULT',
  'PARALLEL',
  'SEQUENTIAL',
  'CONSENSUS',
] as const;

/**
 * Zod schema for CollaborationMode validation.
 */
export const collaborationModeSchema = z.enum(['DELEGATE', 'CONSULT', 'PARALLEL', 'SEQUENTIAL', 'CONSENSUS']);

/**
 * Extended agent capability definition with domain and skills.
 *
 * Provides detailed capability information for agent matching and routing.
 */
export interface AgentCapability {
  /** Primary domain of expertise (e.g., 'security', 'data-analysis') */
  domain: string;
  /** Specific skills within the domain */
  skills: string[];
  /** Minimum trust score required to handle tasks (0-1000) */
  trustLevel: number;
  /** Autonomy level (0-5, maps to TrustBand) */
  autonomyLevel: number;
  /** Preferred modes for collaboration */
  collaborationPreference: CollaborationMode[];
}

/**
 * Zod schema for AgentCapability validation.
 */
export const agentCapabilitySchema = z.object({
  domain: z.string().min(1),
  skills: z.array(z.string()),
  trustLevel: z.number().int().min(0).max(1000),
  autonomyLevel: z.number().int().min(0).max(5),
  collaborationPreference: z.array(collaborationModeSchema),
});

/** Inferred type from schema */
export type AgentCapabilityInput = z.input<typeof agentCapabilitySchema>;

// ============================================================================
// Agent Specialization
// ============================================================================

/**
 * Agent specialization categories.
 *
 * Predefined categories for agent domain expertise.
 */
export type AgentSpecialization =
  | 'core'              // General purpose
  | 'customer_service'  // Customer support and service
  | 'technical'         // Technical assistance
  | 'creative'          // Creative content generation
  | 'research'          // Research and analysis
  | 'education'         // Education and training
  | 'security'          // Security operations
  | 'data_analysis'     // Data analysis and insights
  | 'development'       // Software development
  | 'operations';       // Operations and DevOps

/**
 * Array of all specializations.
 */
export const AGENT_SPECIALIZATIONS: readonly AgentSpecialization[] = [
  'core',
  'customer_service',
  'technical',
  'creative',
  'research',
  'education',
  'security',
  'data_analysis',
  'development',
  'operations',
] as const;

/**
 * Human-readable labels for specializations.
 */
export const AGENT_SPECIALIZATION_LABELS: Readonly<Record<AgentSpecialization, string>> = {
  core: 'General Purpose',
  customer_service: 'Customer Service',
  technical: 'Technical Assistant',
  creative: 'Creative Content',
  research: 'Research & Analysis',
  education: 'Education & Training',
  security: 'Security Operations',
  data_analysis: 'Data Analysis',
  development: 'Software Development',
  operations: 'Operations & DevOps',
} as const;

/**
 * Zod schema for AgentSpecialization validation.
 */
export const agentSpecializationSchema = z.enum([
  'core',
  'customer_service',
  'technical',
  'creative',
  'research',
  'education',
  'security',
  'data_analysis',
  'development',
  'operations',
]);

// ============================================================================
// Agent Metrics
// ============================================================================

/**
 * Runtime operational metrics for agent monitoring.
 *
 * Used for real-time health monitoring and load balancing.
 */
export interface AgentRuntimeMetrics {
  /** CPU usage percentage (0-100) */
  cpuUsage?: number;
  /** Memory usage percentage (0-100) */
  memoryUsage?: number;
  /** Number of tasks in queue */
  taskQueue?: number;
  /** Number of currently active tasks */
  activeTasks?: number;
  /** Uptime in milliseconds */
  uptime?: number;
  /** Custom metrics for domain-specific monitoring */
  customMetrics?: Record<string, number>;
}

/**
 * Zod schema for AgentRuntimeMetrics validation.
 */
export const agentRuntimeMetricsSchema = z.object({
  cpuUsage: z.number().min(0).max(100).optional(),
  memoryUsage: z.number().min(0).max(100).optional(),
  taskQueue: z.number().int().min(0).optional(),
  activeTasks: z.number().int().min(0).optional(),
  uptime: z.number().int().min(0).optional(),
  customMetrics: z.record(z.string(), z.number()).optional(),
});

/** Inferred type from schema */
export type AgentRuntimeMetricsInput = z.input<typeof agentRuntimeMetricsSchema>;

/**
 * Performance metrics for agent quality assessment.
 *
 * Used for trust scoring, performance reviews, and optimization.
 */
export interface AgentPerformanceMetrics {
  /** Total number of tasks completed */
  tasksCompleted: number;
  /** Total number of tasks that failed */
  tasksFailed: number;
  /** Average quality score (0-1) */
  averageQuality: number;
  /** Average response time in milliseconds */
  averageResponseTime: number;
  /** User satisfaction score (0-1) */
  userSatisfaction: number;
  /** Rate of escalations to higher authority (0-1) */
  escalationRate: number;
  /** Collaboration effectiveness score (0-1) */
  collaborationScore: number;
}

/**
 * Zod schema for AgentPerformanceMetrics validation.
 */
export const agentPerformanceMetricsSchema = z.object({
  tasksCompleted: z.number().int().min(0),
  tasksFailed: z.number().int().min(0),
  averageQuality: z.number().min(0).max(1),
  averageResponseTime: z.number().min(0),
  userSatisfaction: z.number().min(0).max(1),
  escalationRate: z.number().min(0).max(1),
  collaborationScore: z.number().min(0).max(1),
});

/** Inferred type from schema */
export type AgentPerformanceMetricsInput = z.input<typeof agentPerformanceMetricsSchema>;

// ============================================================================
// Agent Task Types
// ============================================================================

/**
 * Task priority levels.
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Array of all task priorities in ascending order.
 */
export const TASK_PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high', 'critical'] as const;

/**
 * Zod schema for TaskPriority validation.
 */
export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Task status values.
 */
export type TaskStatus =
  | 'queued'      // Waiting to be assigned
  | 'assigned'    // Assigned to an agent
  | 'active'      // Currently being processed
  | 'paused'      // Temporarily halted
  | 'completed'   // Successfully finished
  | 'failed'      // Failed to complete
  | 'delegated'   // Handed off to another agent
  | 'cancelled';  // Cancelled before completion

/**
 * Array of all task statuses.
 */
export const TASK_STATUSES: readonly TaskStatus[] = [
  'queued',
  'assigned',
  'active',
  'paused',
  'completed',
  'failed',
  'delegated',
  'cancelled',
] as const;

/**
 * Zod schema for TaskStatus validation.
 */
export const taskStatusSchema = z.enum([
  'queued',
  'assigned',
  'active',
  'paused',
  'completed',
  'failed',
  'delegated',
  'cancelled',
]);

/**
 * Task source indicating where the task originated.
 */
export type TaskSource =
  | 'system'        // Generated by the system
  | 'user'          // Requested by a user
  | 'agent'         // Created by another agent
  | 'collaboration' // Part of a collaboration workflow
  | 'proactive'     // Proactive agent behavior
  | 'scheduled';    // Scheduled/recurring task

/**
 * Array of all task sources.
 */
export const TASK_SOURCES: readonly TaskSource[] = [
  'system',
  'user',
  'agent',
  'collaboration',
  'proactive',
  'scheduled',
] as const;

/**
 * Zod schema for TaskSource validation.
 */
export const taskSourceSchema = z.enum(['system', 'user', 'agent', 'collaboration', 'proactive', 'scheduled']);

/**
 * Canonical agent task definition.
 *
 * Comprehensive task structure for agent workloads.
 */
export interface AgentTask {
  /** Unique task identifier */
  id: string;
  /** Agent ID this task is assigned to */
  agentId: string;
  /** Type/category of the task */
  taskType: string;
  /** Human-readable title */
  title?: string;
  /** Detailed description */
  description: string;
  /** Task context and parameters */
  context: Record<string, unknown>;
  /** Priority level */
  priority: TaskPriority;
  /** Current status */
  status: TaskStatus;
  /** Origin of the task */
  source: TaskSource;
  /** Reference ID for the source (e.g., user ID, agent ID) */
  sourceId?: string;
  /** ID of agent/entity that assigned the task */
  assignedBy?: string;
  /** ID of agent task was delegated to */
  delegatedTo?: string;
  /** Scheduled execution time */
  scheduledFor?: Date | string;
  /** Deadline for completion */
  deadline?: Date | string;
  /** When the task started processing */
  startedAt?: Date | string;
  /** When the task completed */
  completedAt?: Date | string;
  /** Task creation timestamp */
  createdAt: Date | string;
  /** Task input data */
  input?: Record<string, unknown>;
  /** Task output/result */
  output?: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for AgentTask validation.
 */
export const agentTaskSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  taskType: z.string().min(1),
  title: z.string().optional(),
  description: z.string(),
  context: z.record(z.string(), z.unknown()),
  priority: taskPrioritySchema,
  status: taskStatusSchema,
  source: taskSourceSchema,
  sourceId: z.string().optional(),
  assignedBy: z.string().optional(),
  delegatedTo: z.string().optional(),
  scheduledFor: z.union([z.date(), z.string().datetime()]).optional(),
  deadline: z.union([z.date(), z.string().datetime()]).optional(),
  startedAt: z.union([z.date(), z.string().datetime()]).optional(),
  completedAt: z.union([z.date(), z.string().datetime()]).optional(),
  createdAt: z.union([z.date(), z.string().datetime()]),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Inferred type from schema */
export type AgentTaskInput = z.input<typeof agentTaskSchema>;

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Agent persona/personality configuration.
 */
export interface AgentPersona {
  /** Display name */
  displayName: string;
  /** Avatar URL */
  avatar?: string;
  /** Communication/voice style descriptor */
  voiceStyle?: string;
  /** Personality traits (e.g., 'professional', 'friendly') */
  traits: string[];
  /** Default greeting message */
  greeting?: string;
  /** Default farewell message */
  farewell?: string;
  /** Default error response */
  errorResponse?: string;
}

/**
 * Zod schema for AgentPersona validation.
 */
export const agentPersonaSchema = z.object({
  displayName: z.string().min(1),
  avatar: z.string().url().optional(),
  voiceStyle: z.string().optional(),
  traits: z.array(z.string()),
  greeting: z.string().optional(),
  farewell: z.string().optional(),
  errorResponse: z.string().optional(),
});

/** Inferred type from schema */
export type AgentPersonaInput = z.input<typeof agentPersonaSchema>;

/**
 * MCP (Model Context Protocol) server configuration.
 */
export interface MCPServerConfig {
  /** Server name/identifier */
  name: string;
  /** Server URL */
  url: string;
  /** Whether the server is enabled */
  enabled: boolean;
  /** Minimum trust score required to use this server */
  minTrustScore?: number;
  /** Server capabilities/features */
  capabilities?: string[];
  /** Additional configuration */
  config?: Record<string, unknown>;
}

/**
 * Zod schema for MCPServerConfig validation.
 */
export const mcpServerConfigSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  enabled: z.boolean(),
  minTrustScore: z.number().int().min(0).max(1000).optional(),
  capabilities: z.array(z.string()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

/** Inferred type from schema */
export type MCPServerConfigInput = z.input<typeof mcpServerConfigSchema>;

/**
 * User role for permission context.
 */
export type UserRole = 'owner' | 'admin' | 'operator' | 'viewer' | 'both';

/**
 * Zod schema for UserRole validation.
 */
export const userRoleSchema = z.enum(['owner', 'admin', 'operator', 'viewer', 'both']);

/**
 * Comprehensive agent configuration for runtime.
 *
 * This is the main configuration structure used when initializing
 * an agent for execution.
 */
export interface AgentConfig {
  /** Unique agent identifier */
  agentId: string;
  /** Owner/user identifier */
  userId: string;
  /** User's role/permissions */
  userRole: UserRole;
  /** Agent lifecycle status */
  status: AgentLifecycleStatus;

  // Trust
  /** Current trust score (0-1000) */
  trustScore: number;
  /** Last activity timestamp */
  lastActivity?: Date | string;

  // Identity
  /** Agent name */
  name: string;
  /** Agent description */
  description?: string;
  /** Domain specialization */
  specialization?: AgentSpecialization | string;
  /** Personality traits */
  personalityTraits?: string[];
  /** Custom system prompt */
  systemPrompt?: string;

  // Capabilities
  /** Enabled capabilities/skills */
  capabilities: string[];
  /** Agent permissions */
  permissions?: AgentPermission[];

  // Model Configuration
  /** AI model identifier */
  model?: string;
  /** Temperature for generation */
  temperature?: number;
  /** Maximum tokens for responses */
  maxTokens?: number;

  // MCP Integration
  /** Configured MCP servers */
  mcpServers?: MCPServerConfig[];

  // Environment
  /** Environment variables */
  environment?: Record<string, string>;

  // Session
  /** Current session identifier */
  sessionId?: string;
  /** Current conversation identifier */
  conversationId?: string;
  /** Message count in current session */
  messageCount?: number;
}

/**
 * Zod schema for AgentConfig validation.
 */
export const agentConfigSchema = z.object({
  agentId: z.string().min(1),
  userId: z.string().min(1),
  userRole: userRoleSchema,
  status: agentLifecycleStatusSchema,

  trustScore: z.number().int().min(0).max(1000),
  lastActivity: z.union([z.date(), z.string().datetime()]).optional(),

  name: z.string().min(1),
  description: z.string().optional(),
  specialization: z.union([agentSpecializationSchema, z.string()]).optional(),
  personalityTraits: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),

  capabilities: z.array(z.string()),
  permissions: z.array(agentPermissionSchema).optional(),

  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),

  mcpServers: z.array(mcpServerConfigSchema).optional(),

  environment: z.record(z.string(), z.string()).optional(),

  sessionId: z.string().optional(),
  conversationId: z.string().optional(),
  messageCount: z.number().int().min(0).optional(),
});

/** Inferred type from schema */
export type AgentConfigInput = z.input<typeof agentConfigSchema>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for AgentLifecycleStatus.
 */
export function isAgentLifecycleStatus(value: unknown): value is AgentLifecycleStatus {
  return typeof value === 'string' && AGENT_LIFECYCLE_STATUSES.includes(value as AgentLifecycleStatus);
}

/**
 * Type guard for AgentRuntimeStatus.
 */
export function isAgentRuntimeStatus(value: unknown): value is AgentRuntimeStatus {
  return typeof value === 'string' && AGENT_RUNTIME_STATUSES.includes(value as AgentRuntimeStatus);
}

/**
 * Type guard for AgentPermission.
 */
export function isAgentPermission(value: unknown): value is AgentPermission {
  return typeof value === 'string' && AGENT_PERMISSIONS.includes(value as AgentPermission);
}

/**
 * Type guard for AgentSpecialization.
 */
export function isAgentSpecialization(value: unknown): value is AgentSpecialization {
  return typeof value === 'string' && AGENT_SPECIALIZATIONS.includes(value as AgentSpecialization);
}

/**
 * Type guard for TaskPriority.
 */
export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && TASK_PRIORITIES.includes(value as TaskPriority);
}

/**
 * Type guard for TaskStatus.
 */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && TASK_STATUSES.includes(value as TaskStatus);
}

/**
 * Type guard for TaskSource.
 */
export function isTaskSource(value: unknown): value is TaskSource {
  return typeof value === 'string' && TASK_SOURCES.includes(value as TaskSource);
}

// ============================================================================
// Conversion Utilities
// ============================================================================

/**
 * Checks if an agent can transition to a new lifecycle status.
 *
 * Valid transitions:
 * - draft -> training, active
 * - training -> active, suspended, draft
 * - active -> suspended, archived
 * - suspended -> active, archived
 * - archived -> (no transitions allowed)
 *
 * @param current - Current lifecycle status
 * @param target - Target lifecycle status
 * @returns True if transition is valid
 */
export function canTransitionLifecycleStatus(
  current: AgentLifecycleStatus,
  target: AgentLifecycleStatus
): boolean {
  const validTransitions: Record<AgentLifecycleStatus, AgentLifecycleStatus[]> = {
    draft: ['training', 'active'],
    training: ['active', 'suspended', 'draft'],
    active: ['suspended', 'archived'],
    suspended: ['active', 'archived'],
    archived: [],
  };

  return validTransitions[current].includes(target);
}

/**
 * Converts runtime status to lifecycle status where applicable.
 *
 * @param runtimeStatus - Agent runtime status
 * @returns Corresponding lifecycle status or null if no direct mapping
 */
export function runtimeToLifecycleStatus(runtimeStatus: AgentRuntimeStatus): AgentLifecycleStatus | null {
  const mapping: Partial<Record<AgentRuntimeStatus, AgentLifecycleStatus>> = {
    IDLE: 'active',
    WORKING: 'active',
    PAUSED: 'suspended',
    ERROR: 'active', // Errors don't change lifecycle
    // OFFLINE intentionally omitted - could be any status
  };

  return mapping[runtimeStatus] ?? null;
}

/**
 * Gets the numeric priority value for sorting.
 *
 * @param priority - Task priority
 * @returns Numeric value (0-3, higher = more urgent)
 */
export function getTaskPriorityValue(priority: TaskPriority): number {
  const values: Record<TaskPriority, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  return values[priority];
}

/**
 * Compares two task priorities.
 *
 * @param a - First priority
 * @param b - Second priority
 * @returns -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareTaskPriorities(a: TaskPriority, b: TaskPriority): -1 | 0 | 1 {
  const diff = getTaskPriorityValue(a) - getTaskPriorityValue(b);
  if (diff < 0) return -1;
  if (diff > 0) return 1;
  return 0;
}

// ============================================================================
// Legacy Compatibility
// ============================================================================

/**
 * Maps legacy status strings to canonical AgentLifecycleStatus.
 *
 * @deprecated Use AgentLifecycleStatus directly. This is for migration only.
 */
export const LEGACY_STATUS_MAP: Readonly<Record<string, AgentLifecycleStatus>> = {
  // Common legacy values
  'inactive': 'draft',
  'pending': 'draft',
  'in_training': 'training',
  'trained': 'active',
  'enabled': 'active',
  'disabled': 'suspended',
  'paused': 'suspended',
  'deleted': 'archived',
  'removed': 'archived',
} as const;

/**
 * Converts a legacy status string to canonical AgentLifecycleStatus.
 *
 * @deprecated Use AgentLifecycleStatus directly. This is for migration only.
 * @param legacyStatus - Legacy status string
 * @returns Canonical status or 'draft' if not recognized
 */
export function legacyToLifecycleStatus(legacyStatus: string): AgentLifecycleStatus {
  const normalized = legacyStatus.toLowerCase().trim();

  // Check if already canonical
  if (isAgentLifecycleStatus(normalized)) {
    return normalized;
  }

  // Check legacy mapping
  return LEGACY_STATUS_MAP[normalized] ?? 'draft';
}

/**
 * Maps legacy AgentStatus from SDK (uppercase) to canonical types.
 *
 * @deprecated Use AgentRuntimeStatus directly. This is for migration only.
 */
export const LEGACY_RUNTIME_STATUS_MAP: Readonly<Record<string, AgentRuntimeStatus>> = {
  'idle': 'IDLE',
  'working': 'WORKING',
  'paused': 'PAUSED',
  'error': 'ERROR',
  'offline': 'OFFLINE',
  'busy': 'WORKING',
  'available': 'IDLE',
  'unavailable': 'OFFLINE',
} as const;

/**
 * Converts a legacy runtime status to canonical AgentRuntimeStatus.
 *
 * @deprecated Use AgentRuntimeStatus directly. This is for migration only.
 * @param legacyStatus - Legacy status string
 * @returns Canonical runtime status or 'OFFLINE' if not recognized
 */
export function legacyToRuntimeStatus(legacyStatus: string): AgentRuntimeStatus {
  // Check if already canonical (uppercase)
  if (isAgentRuntimeStatus(legacyStatus)) {
    return legacyStatus;
  }

  const normalized = legacyStatus.toLowerCase().trim();
  return LEGACY_RUNTIME_STATUS_MAP[normalized] ?? 'OFFLINE';
}
