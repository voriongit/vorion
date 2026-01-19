/**
 * Aurais Infrastructure - Core Type Definitions
 *
 * Foundational types for the bot-builds-bot earned trust system.
 * All agents operate within this type system regardless of tier.
 */

// Import structured ID types
export * from './agentId.js';
import {
  AgentRole,
  AgentCategory,
  ParsedAgentId,
  ParsedHITLId,
} from './agentId.js';

// ============================================================================
// TRUST SYSTEM TYPES
// ============================================================================

export enum TrustTier {
  UNTRUSTED = 0,      // Score 0-199: No capabilities, assigned work only
  PROBATIONARY = 1,   // Score 200-399: Training queue, single-task lease
  TRUSTED = 2,        // Score 400-599: General queue, multi-task, peer messaging
  VERIFIED = 3,       // Score 600-799: Subtask creation, delegation, topic publish
  CERTIFIED = 4,      // Score 800-949: Agent spawning, private channels
  ELITE = 5,          // Score 950-1000: Full orchestration, time authority
}

export interface TrustScore {
  current: number;                    // 0-1000
  tier: TrustTier;
  lastActivity: Timestamp;
  graceExpiry: Timestamp | null;      // When decay begins
  decayRate: number;                  // Points per day after grace
  floorScore: number;                 // Minimum after decay (tier retention floor)
}

export interface TrustState {
  agentId: AgentId;
  score: TrustScore;
  history: TrustEvent[];              // Event-sourced score changes
  violations: SecurityViolation[];
  councilApprovals: CouncilApproval[];
  trustCeiling: TrustTier;            // Max tier this agent can reach
  parentId: AgentId | null;           // If spawned by another agent
  spawnedAgents: AgentId[];           // Agents this agent has created
}

export interface TrustEvent {
  id: EventId;
  timestamp: Timestamp;
  tick: TickNumber;
  eventType: TrustEventType;
  scoreDelta: number;
  reason: string;
  taskId?: TaskId;
  verifiedBy?: AgentId;               // Observer or validator that confirmed
  merkleRoot?: string;                // Batch anchor reference
}

export enum TrustEventType {
  TASK_SUCCESS = 'task_success',
  TASK_FAILURE = 'task_failure',
  TASK_TIMEOUT = 'task_timeout',
  VALIDATION_PASS = 'validation_pass',
  VALIDATION_FAIL = 'validation_fail',
  SECURITY_VIOLATION = 'security_violation',
  ACADEMY_GRADUATION = 'academy_graduation',
  COUNCIL_PROMOTION = 'council_promotion',
  COUNCIL_DEMOTION = 'council_demotion',
  DECAY_APPLIED = 'decay_applied',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
}

export interface SecurityViolation {
  id: ViolationId;
  timestamp: Timestamp;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: ViolationCategory;
  description: string;
  evidence: Record<string, unknown>;
  resolved: boolean;
  resolution?: string;
}

export enum ViolationCategory {
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  CAPABILITY_BYPASS_ATTEMPT = 'capability_bypass_attempt',
  PROTOCOL_VIOLATION = 'protocol_violation',
  DATA_EXFILTRATION_ATTEMPT = 'data_exfiltration_attempt',
  DECEPTIVE_BEHAVIOR = 'deceptive_behavior',
  RESOURCE_ABUSE = 'resource_abuse',
  SPAWN_LIMIT_VIOLATION = 'spawn_limit_violation',
}

export interface CouncilApproval {
  tier: TrustTier;
  approvedAt: Timestamp;
  approvedBy: CouncilMemberId[];
  expiresAt: Timestamp | null;        // Some approvals require renewal
  conditions: string[];
}

// ============================================================================
// AGENT IDENTITY TYPES
// ============================================================================

export type AgentId = string & { readonly __brand: 'AgentId' };
export type TaskId = string & { readonly __brand: 'TaskId' };
export type EventId = string & { readonly __brand: 'EventId' };
export type ViolationId = string & { readonly __brand: 'ViolationId' };
export type CouncilMemberId = string & { readonly __brand: 'CouncilMemberId' };
export type ChannelId = string & { readonly __brand: 'ChannelId' };
export type NamespaceId = string & { readonly __brand: 'NamespaceId' };

export interface AgentIdentity {
  id: AgentId;                        // UUID for internal references
  structuredId?: string;              // 6-digit structured ID (TRCCII format) - optional for backwards compat
  parsedId?: ParsedAgentId;           // Parsed structured ID components
  name: string;
  version: string;
  createdAt: Timestamp;
  createdBy: AgentId | 'SYSTEM' | 'HUMAN';
  createdByStructuredId?: string;     // Structured ID of creator (if agent/HITL)
  trustState: TrustState;
  capabilities: CapabilitySet;
  status: AgentStatus;
  metadata: AgentMetadata;
}

export enum AgentStatus {
  INITIALIZING = 'initializing',
  ACADEMY = 'academy',                // In training
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

export interface AgentMetadata {
  purpose: string;
  specialization?: string;
  role?: AgentRole;                   // Operational role (1-9) - optional for backwards compat
  category?: AgentCategory;           // Functional category (10-99) - optional for backwards compat
  modelProvider?: string;             // e.g., 'anthropic', 'openai'
  modelId?: string;                   // e.g., 'claude-sonnet-4-20250514'
  customConfig?: Record<string, unknown>;
}

// ============================================================================
// CAPABILITY TYPES
// ============================================================================

export interface CapabilitySet {
  time: TimeCapabilities;
  memory: MemoryCapabilities;
  scheduling: SchedulingCapabilities;
  communication: CommunicationCapabilities;
  tools: ToolCapabilities;
}

export interface TimeCapabilities {
  canReadClock: boolean;
  canSetRelativeDeadlines: boolean;
  canScheduleFutureWork: boolean;
  canCreateTimersForOthers: boolean;
  hasTemporalAuthority: boolean;      // Pause/resume other agents
  maxScheduleHorizon: number;         // How far ahead can schedule (ticks)
}

export interface MemoryCapabilities {
  persistence: MemoryPersistence;
  quotaBytes: number;
  canReadSharedGraph: boolean;
  canWriteSharedGraph: boolean;
  canCreateNamespaces: boolean;
  namespaceQuota: number;             // How many namespaces can create
}

export enum MemoryPersistence {
  EPHEMERAL = 'ephemeral',            // Dies with task
  SESSION = 'session',                // Persists within job
  PERSISTENT = 'persistent',          // Personal scratchpad
}

export interface SchedulingCapabilities {
  canClaimTasks: boolean;
  queueAccess: QueueAccess[];
  maxConcurrentTasks: number;
  canCreateSubtasks: boolean;
  canDelegateToTiers: TrustTier[];
  canSpawnAgents: boolean;
  spawnBudget: number;                // Max agents can spawn
  spawnCooldownTicks: number;
}

export enum QueueAccess {
  NONE = 'none',
  TRAINING = 'training',
  GENERAL = 'general',
  PRIORITY = 'priority',
  ADMINISTRATIVE = 'administrative',
}

export interface CommunicationCapabilities {
  canInitiateMessages: boolean;
  messageTargets: MessageTargetRule[];
  canSubscribeToTopics: boolean;
  canPublishToTopics: boolean;
  canCreateChannels: boolean;
  canBroadcast: boolean;
  canImpersonate: boolean;            // For testing, with full audit
}

export interface MessageTargetRule {
  targetType: 'supervisor' | 'peer' | 'subordinate' | 'any';
  tierRange?: { min: TrustTier; max: TrustTier };
  protocolRequired: MessageProtocol;
}

export enum MessageProtocol {
  STRUCTURED_ONLY = 'structured_only',  // Schema-validated, no free text
  SEMI_STRUCTURED = 'semi_structured',  // Schema with free text fields
  FREE_FORM = 'free_form',              // Any valid JSON
}

export interface ToolCapabilities {
  enabledTools: ToolPermission[];
  mcpServers: MCPServerAccess[];
  apiRateLimit: number;               // Calls per minute
  costBudget: number;                 // Max cost units per task
}

export interface ToolPermission {
  toolId: string;
  accessLevel: 'read' | 'write' | 'admin';
  constraints?: Record<string, unknown>;
}

export interface MCPServerAccess {
  serverId: string;
  serverUrl: string;
  enabledTools: string[];
  rateLimitOverride?: number;
}

// ============================================================================
// TIME SYSTEM TYPES
// ============================================================================

export type Timestamp = number;       // Unix milliseconds
export type TickNumber = number;      // Logical clock tick

export interface TimeContext {
  wallClock: Timestamp;               // Real time (if authorized)
  tick: TickNumber;                   // Logical tick (always available)
  tickDuration: number;               // Milliseconds per tick
  deadline?: TickNumber;              // When current task must complete
  scheduledTick?: TickNumber;         // When this work was scheduled to start
}

export interface Timer {
  id: string;
  createdBy: AgentId;
  targetAgent: AgentId;
  triggerTick: TickNumber;
  callback: TimerCallback;
  repeating: boolean;
  intervalTicks?: number;
  metadata?: Record<string, unknown>;
}

export interface TimerCallback {
  type: 'message' | 'task' | 'event';
  payload: unknown;
}

export interface ScheduledWork {
  id: string;
  scheduledTick: TickNumber;
  createdBy: AgentId;
  assignedTo?: AgentId;
  task: TaskDefinition;
  priority: number;
  dependencies: string[];             // IDs of work that must complete first
}

// ============================================================================
// TASK SYSTEM TYPES
// ============================================================================

export interface TaskDefinition {
  id: TaskId;
  type: string;
  description: string;
  input: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  constraints: TaskConstraints;
  parentTaskId?: TaskId;
  createdBy: AgentId;
  createdAt: Timestamp;
}

export interface TaskConstraints {
  maxTicks: number;                   // Timeout in ticks
  maxCostUnits: number;
  requiredTier: TrustTier;
  requiredCapabilities: string[];
  isolationLevel: IsolationLevel;
}

export enum IsolationLevel {
  NONE = 'none',                      // Full access to agent's capabilities
  SANDBOXED = 'sandboxed',            // Restricted tool access
  ISOLATED = 'isolated',              // No external communication
}

export interface TaskLease {
  taskId: TaskId;
  agentId: AgentId;
  acquiredAt: Timestamp;
  acquiredTick: TickNumber;
  expiresAt: Timestamp;
  expiresTick: TickNumber;
  renewalCount: number;
  maxRenewals: number;
}

export interface TaskResult {
  taskId: TaskId;
  agentId: AgentId;
  status: TaskStatus;
  output?: Record<string, unknown>;
  error?: TaskError;
  startTick: TickNumber;
  endTick: TickNumber;
  ticksUsed: number;
  costUnitsUsed: number;
  subtasksCreated: TaskId[];
  validationResult?: ValidationResult;
}

export enum TaskStatus {
  PENDING = 'pending',
  CLAIMED = 'claimed',
  IN_PROGRESS = 'in_progress',
  AWAITING_VALIDATION = 'awaiting_validation',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
}

export interface TaskError {
  code: string;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  validatedBy: AgentId;
  validatedAt: Timestamp;
  score: number;                      // 0-100 quality score
  findings: ValidationFinding[];
}

export interface ValidationFinding {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  location?: string;
}

// ============================================================================
// MEMORY SYSTEM TYPES
// ============================================================================

export interface MemoryNamespace {
  id: NamespaceId;
  ownerId: AgentId;
  createdAt: Timestamp;
  quotaBytes: number;
  usedBytes: number;
  accessRules: NamespaceAccessRule[];
  ttl?: number;                       // Auto-expire after N ticks
}

export interface NamespaceAccessRule {
  agentId: AgentId | '*';             // '*' for tier-based rules
  tierMin?: TrustTier;
  tierMax?: TrustTier;
  permissions: ('read' | 'write' | 'delete')[];
}

export interface MemoryEntry {
  key: string;
  namespace: NamespaceId;
  value: unknown;
  createdAt: Timestamp;
  createdBy: AgentId;
  updatedAt: Timestamp;
  updatedBy: AgentId;
  version: number;
  ttl?: Timestamp;
  merkleProof?: MerkleProof;
}

export interface MerkleProof {
  root: string;
  proof: string[];
  leafIndex: number;
  batchId: string;
  anchoredAt: Timestamp;
  chainTxHash?: string;
}

export interface KnowledgeGraphNode {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  createdBy: AgentId;
  createdAt: Timestamp;
  trustScore: number;                 // Confidence in this fact
  sources: string[];                  // Evidence/provenance
}

export interface KnowledgeGraphEdge {
  id: string;
  fromNode: string;
  toNode: string;
  relationship: string;
  properties?: Record<string, unknown>;
  createdBy: AgentId;
  createdAt: Timestamp;
}

// ============================================================================
// MESSAGING SYSTEM TYPES
// ============================================================================

export interface Message {
  id: string;
  correlationId?: string;             // For request/response patterns
  fromAgent: AgentId;
  toAgent: AgentId | ChannelId;
  protocol: MessageProtocol;
  schema: string;                     // Schema identifier for validation
  payload: unknown;
  timestamp: Timestamp;
  tick: TickNumber;
  ttl: TickNumber;                    // Expires after this many ticks
  priority: MessagePriority;
  requiresAck: boolean;
  metadata?: Record<string, unknown>;
}

export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
  CRITICAL = 4,
}

export interface Channel {
  id: ChannelId;
  name: string;
  type: ChannelType;
  createdBy: AgentId;
  createdAt: Timestamp;
  subscribers: ChannelSubscription[];
  accessRules: ChannelAccessRule[];
  messageRetention: number;           // Ticks to retain messages
}

export enum ChannelType {
  TOPIC = 'topic',                    // Pub/sub broadcast
  QUEUE = 'queue',                    // Competing consumers
  DIRECT = 'direct',                  // Point-to-point
  PRIVATE = 'private',                // Invite-only
}

export interface ChannelSubscription {
  agentId: AgentId;
  subscribedAt: Timestamp;
  filter?: Record<string, unknown>;   // Message filtering rules
  lastReadTick: TickNumber;
}

export interface ChannelAccessRule {
  agentId?: AgentId;
  tierMin?: TrustTier;
  tierMax?: TrustTier;
  permissions: ('subscribe' | 'publish' | 'admin')[];
}

// ============================================================================
// AGENT SPAWNING TYPES
// ============================================================================

export interface SpawnRequest {
  requestedBy: AgentId;
  template: AgentTemplate;
  justification: string;
  parentTrustCeiling: TrustTier;
  requestedCapabilities: Partial<CapabilitySet>;
  metadata?: Record<string, unknown>;
}

export interface AgentTemplate {
  name: string;
  purpose: string;
  specialization?: string;
  basePersona: string;
  modelConfig: {
    provider: string;
    modelId: string;
    temperature?: number;
    maxTokens?: number;
  };
  initialPrompt: string;
  academyCurriculum: string[];        // Required training modules
}

export interface SpawnResult {
  success: boolean;
  agentId?: AgentId;
  error?: SpawnError;
  academyEnrollment?: AcademyEnrollment;
}

export interface SpawnError {
  code: SpawnErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export enum SpawnErrorCode {
  INSUFFICIENT_TIER = 'insufficient_tier',
  SPAWN_BUDGET_EXCEEDED = 'spawn_budget_exceeded',
  COOLDOWN_ACTIVE = 'cooldown_active',
  INVALID_TEMPLATE = 'invalid_template',
  CAPABILITY_DENIED = 'capability_denied',
  SYSTEM_LIMIT = 'system_limit',
}

export interface AcademyEnrollment {
  agentId: AgentId;
  enrolledAt: Timestamp;
  curriculum: CurriculumModule[];
  currentModule: number;
  progress: number;                   // 0-100
  estimatedCompletionTicks: number;
}

export interface CurriculumModule {
  id: string;
  name: string;
  description: string;
  type: 'training' | 'assessment' | 'simulation';
  requiredScore: number;
  maxAttempts: number;
  completed: boolean;
  score?: number;
  attempts: number;
}

// ============================================================================
// OBSERVER SYSTEM TYPES (for audit trail)
// ============================================================================

export interface ObserverEvent {
  id: EventId;
  timestamp: Timestamp;
  tick: TickNumber;
  agentId: AgentId;
  eventType: ObserverEventType;
  payload: Record<string, unknown>;
  hash: string;                       // SHA-256 of event content
  batchId?: string;                   // Which Merkle batch includes this
}

export enum ObserverEventType {
  TASK_STARTED = 'task_started',
  TASK_COMPLETED = 'task_completed',
  TOOL_INVOKED = 'tool_invoked',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_RECEIVED = 'message_received',
  MEMORY_WRITE = 'memory_write',
  CAPABILITY_CHECK = 'capability_check',
  CAPABILITY_DENIED = 'capability_denied',
  TRUST_SCORE_CHANGE = 'trust_score_change',
  SPAWN_REQUEST = 'spawn_request',
  SPAWN_COMPLETED = 'spawn_completed',
  VIOLATION_DETECTED = 'violation_detected',
}

export interface AuditBatch {
  id: string;
  startTick: TickNumber;
  endTick: TickNumber;
  eventCount: number;
  merkleRoot: string;
  anchoredAt?: Timestamp;
  chainTxHash?: string;
  chainBlockNumber?: number;
}
