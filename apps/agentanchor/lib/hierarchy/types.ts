/**
 * Agent Hierarchy Types
 *
 * The A3I platform uses a 5-tier agent hierarchy:
 *
 *   HITL (Human-In-The-Loop)     - Human oversight & ultimate authority
 *     └── Orchs (Orchestrators)  - Workflow coordination
 *           └── Metagoats        - Meta-level agent management
 *                 └── Agents     - Domain specialists
 *                       └── Bots - User-facing interfaces
 *
 * Each level is built with three core components:
 *   - Knowledge: What the entity knows (facts, procedures, patterns)
 *   - Memory: What the entity remembers (episodic, semantic, working)
 *   - Abilities: What the entity can do (skills, permissions, constraints)
 */

// =============================================================================
// Canonical Type Imports from @vorion/contracts
// =============================================================================

import {
  HierarchyLevel as CanonicalHierarchyLevel,
  AuthorityScopeType as CanonicalAuthorityScope,
  AuthorityScope as CanonicalAuthorityScopeInterface,
  AgentTask as CanonicalAgentTask,
  AgentPerformanceMetrics as CanonicalAgentMetrics,
  HIERARCHY_LEVELS as CANONICAL_HIERARCHY_LEVELS,
  HIERARCHY_ORDER as CANONICAL_HIERARCHY_ORDER,
  HIERARCHY_TIERS,
  hierarchyLevelSchema,
  authorityScopeTypeSchema,
  agentTaskSchema,
  agentPerformanceMetricsSchema,
} from '@vorion/contracts';

// Re-export canonical types for backwards compatibility
// Re-export canonical types for backwards compatibility
export type {
  CanonicalHierarchyLevel,
  CanonicalAuthorityScope,
  CanonicalAuthorityScopeInterface,
  CanonicalAgentTask,
  CanonicalAgentMetrics,
};

export {
  CANONICAL_HIERARCHY_LEVELS,
  CANONICAL_HIERARCHY_ORDER,
  HIERARCHY_TIERS,
  hierarchyLevelSchema,
  authorityScopeTypeSchema,
  agentTaskSchema,
  agentPerformanceMetricsSchema,
};

// =============================================================================
// HIERARCHY LEVELS
// =============================================================================

/**
 * @deprecated Use `HierarchyLevel` from `@vorion/contracts` instead.
 * This local definition is maintained for backwards compatibility.
 * Maps directly to the canonical HierarchyLevel type.
 */
export type HierarchyLevel = 'hitl' | 'orch' | 'metagoat' | 'agent' | 'bot'

export const HIERARCHY_ORDER: HierarchyLevel[] = [
  'hitl',     // Tier 0 - Human authority (highest)
  'orch',     // Tier 1 - Orchestrators
  'metagoat', // Tier 2 - Meta-level agents
  'agent',    // Tier 3 - Domain specialists
  'bot',      // Tier 4 - User-facing (lowest)
]

/**
 * @deprecated Use `AuthorityScopeType` from `@vorion/contracts` instead.
 * This local definition is maintained for backwards compatibility.
 */
export type AuthorityScope = 'governance' | 'coordination' | 'management' | 'execution' | 'interaction'

export interface HierarchyLevelConfig {
  level: HierarchyLevel
  tier: number
  name: string
  description: string
  authorityScope: AuthorityScope
  authority: number           // 0-100, higher = more authority
  canDelegate: HierarchyLevel[]
  reportsTo: HierarchyLevel | null
  maxAutonomyLevel: number    // 1-5, how independently they can act
  canTrainOthers: boolean
  canApproveOthers: boolean
  requiresHumanOversight: boolean
  minTrustScore: number       // 0-1000
}

export const HIERARCHY_LEVELS: Record<HierarchyLevel, HierarchyLevelConfig> = {
  hitl: {
    level: 'hitl',
    tier: 0,
    name: 'Human-In-The-Loop',
    description: 'Human oversight and ultimate authority. Makes final decisions on ethics, safety, strategic direction, and high-stakes operations.',
    authorityScope: 'governance',
    authority: 100,
    canDelegate: ['orch', 'metagoat', 'agent', 'bot'],
    reportsTo: null,
    maxAutonomyLevel: 5,
    canTrainOthers: true,
    canApproveOthers: true,
    requiresHumanOversight: false, // IS human
    minTrustScore: 0,
  },
  orch: {
    level: 'orch',
    tier: 1,
    name: 'Orchestrator',
    description: 'Coordinates complex multi-agent workflows. Manages resource allocation, task distribution, and cross-team collaboration.',
    authorityScope: 'coordination',
    authority: 80,
    canDelegate: ['metagoat', 'agent', 'bot'],
    reportsTo: 'hitl',
    maxAutonomyLevel: 4,
    canTrainOthers: true,
    canApproveOthers: true,
    requiresHumanOversight: true,
    minTrustScore: 800,
  },
  metagoat: {
    level: 'metagoat',
    tier: 2,
    name: 'Metagoat',
    description: 'Meta-level agent that optimizes, teaches, and manages other agents. Handles strategy, capability enhancement, and performance optimization.',
    authorityScope: 'management',
    authority: 60,
    canDelegate: ['agent', 'bot'],
    reportsTo: 'orch',
    maxAutonomyLevel: 4,
    canTrainOthers: true,
    canApproveOthers: true,
    requiresHumanOversight: false,
    minTrustScore: 600,
  },
  agent: {
    level: 'agent',
    tier: 3,
    name: 'Agent',
    description: 'Domain specialist with deep expertise. Executes complex tasks, provides recommendations, and manages bots within their specialty.',
    authorityScope: 'execution',
    authority: 40,
    canDelegate: ['bot'],
    reportsTo: 'metagoat',
    maxAutonomyLevel: 3,
    canTrainOthers: false,
    canApproveOthers: false,
    requiresHumanOversight: false,
    minTrustScore: 400,
  },
  bot: {
    level: 'bot',
    tier: 4,
    name: 'Bot',
    description: 'User-facing interface with defined persona and guardrails. Handles direct interactions, follows scripts, and escalates when needed.',
    authorityScope: 'interaction',
    authority: 20,
    canDelegate: [],
    reportsTo: 'agent',
    maxAutonomyLevel: 2,
    canTrainOthers: false,
    canApproveOthers: false,
    requiresHumanOversight: false,
    minTrustScore: 200,
  },
}

// =============================================================================
// KNOWLEDGE SYSTEM
// =============================================================================

export type KnowledgeType =
  | 'fact'           // Verified information
  | 'concept'        // Abstract understanding
  | 'procedure'      // How to do something
  | 'principle'      // Governing rules
  | 'pattern'        // Recognized patterns
  | 'anti_pattern'   // What to avoid
  | 'relationship'   // Connections between entities
  | 'context'        // Situational understanding
  | 'preference'     // Learned preferences
  | 'constraint'     // Limitations and boundaries

export interface KnowledgeItem {
  id: string
  type: KnowledgeType
  content: string
  confidence: number        // 0-1
  source: string           // Where this knowledge came from
  verifiedBy?: string      // ID of verifying entity
  createdAt: Date
  updatedAt: Date
  expiresAt?: Date         // Optional expiration
  tags: string[]
  embedding?: number[]     // Vector for semantic search
  metadata: Record<string, unknown>
}

export interface KnowledgeBase {
  level: HierarchyLevel
  entityId: string
  items: KnowledgeItem[]
  inheritedFrom?: string[] // IDs of parent entities whose knowledge is inherited
  capacity: number         // Max items
  consolidationRule: 'merge' | 'replace' | 'archive'
}

// =============================================================================
// MEMORY SYSTEM
// =============================================================================

export type MemoryType =
  | 'episodic'     // Specific events/interactions
  | 'semantic'     // Facts and concepts
  | 'procedural'   // Skills and how-to
  | 'working'      // Current session context
  | 'long_term'    // Persistent important memories

export interface MemoryItem {
  id: string
  type: MemoryType
  content: string
  importance: number       // 0-1, affects retention
  emotionalValence?: number // -1 to 1, for context
  timestamp: Date
  lastAccessed: Date
  accessCount: number
  decay: number            // How much importance decays per day
  associations: string[]   // Related memory IDs
  context: Record<string, unknown>
}

export interface MemoryStore {
  level: HierarchyLevel
  entityId: string
  workingMemory: MemoryItem[]      // Current session (volatile)
  shortTermMemory: MemoryItem[]    // Recent, may decay
  longTermMemory: MemoryItem[]     // Consolidated, persistent
  maxWorkingMemory: number
  maxShortTermMemory: number
  maxLongTermMemory: number
  consolidationThreshold: number   // Importance threshold for long-term storage
  decayRate: number                // Daily decay multiplier
}

// =============================================================================
// ABILITIES SYSTEM
// =============================================================================

export type AbilityCategory =
  | 'communication'   // Speaking, writing, translating
  | 'analysis'        // Research, evaluation, synthesis
  | 'creation'        // Building, designing, generating
  | 'coordination'    // Managing, delegating, scheduling
  | 'learning'        // Adapting, improving, teaching
  | 'decision'        // Choosing, prioritizing, judging
  | 'execution'       // Performing tasks, running workflows
  | 'observation'     // Monitoring, detecting, reporting

export interface Ability {
  id: string
  name: string
  description: string
  category: AbilityCategory
  minLevel: HierarchyLevel        // Minimum hierarchy level required
  prerequisites: string[]         // Required ability IDs
  parameters: AbilityParameter[]
  constraints: AbilityConstraint[]
  trustRequired: number           // Minimum trust score 0-1000
  cooldown?: number               // Milliseconds between uses
  maxConcurrent?: number          // Max parallel executions
  enabled: boolean
}

export interface AbilityParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  description: string
  defaultValue?: unknown
  validation?: string             // Validation rule/regex
}

export interface AbilityConstraint {
  type: 'rate_limit' | 'scope' | 'approval_required' | 'time_window' | 'resource_limit'
  value: unknown
  description: string
}

export interface AbilitySet {
  level: HierarchyLevel
  entityId: string
  innate: Ability[]               // Built-in abilities for this level
  learned: Ability[]              // Acquired through training/experience
  delegated: Ability[]            // Granted by higher level entity
  restricted: string[]            // Ability IDs that are blocked
  pending: string[]               // Abilities awaiting approval
}

// =============================================================================
// ENTITY DEFINITIONS
// =============================================================================

export interface HierarchyEntity {
  id: string
  level: HierarchyLevel
  name: string
  description: string
  status: 'active' | 'inactive' | 'suspended' | 'training' | 'probation'
  trustScore: number              // 0-1000
  knowledge: KnowledgeBase
  memory: MemoryStore
  abilities: AbilitySet
  parentId?: string               // Supervising entity
  childIds: string[]              // Supervised entities
  createdAt: Date
  updatedAt: Date
  metadata: Record<string, unknown>
}

// =============================================================================
// HITL - Human-In-The-Loop
// =============================================================================

export interface HITL extends HierarchyEntity {
  level: 'hitl'
  userId: string                  // Link to human user account
  role: 'owner' | 'admin' | 'operator' | 'reviewer'
  approvalQueue: ApprovalRequest[]
  escalationPreferences: EscalationPreference[]
  availabilitySchedule?: AvailabilitySchedule
}

export interface ApprovalRequest {
  id: string
  requesterId: string
  requesterLevel: HierarchyLevel
  action: string
  reason: string
  context: Record<string, unknown>
  urgency: 'low' | 'medium' | 'high' | 'critical'
  deadline?: Date
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'delegated'
  response?: {
    decision: 'approved' | 'rejected' | 'delegated'
    reason?: string
    conditions?: string[]
    delegatedTo?: string
    respondedAt: Date
  }
  createdAt: Date
}

export interface EscalationPreference {
  triggerType: string
  threshold: number
  notificationMethod: 'immediate' | 'digest' | 'scheduled'
  channels: string[]
  autoApprove?: boolean
}

export interface AvailabilitySchedule {
  timezone: string
  windows: { dayOfWeek: number; startHour: number; endHour: number }[]
  fallbackHitlId?: string
}

// =============================================================================
// ORCH - Orchestrator
// =============================================================================

export interface Orch extends HierarchyEntity {
  level: 'orch'
  domain: string                  // Area of orchestration (e.g., 'engineering', 'support')
  managedMetagoats: string[]      // IDs of metagoats under management
  activeWorkflows: WorkflowInstance[]
  resourceBudget: ResourceBudget
  performanceMetrics: OrchMetrics
  strategies: OrchStrategy[]
}

export interface WorkflowInstance {
  id: string
  workflowType: string
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed'
  participants: string[]
  progress: number               // 0-100
  startedAt: Date
  estimatedCompletion?: Date
}

export interface ResourceBudget {
  computeUnits: number
  apiCalls: number
  storageBytes: number
  concurrentTasks: number
  used: {
    computeUnits: number
    apiCalls: number
    storageBytes: number
    concurrentTasks: number
  }
  resetPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly'
  nextReset: Date
}

export interface OrchMetrics {
  workflowsCompleted: number
  workflowsFailed: number
  averageCompletionTime: number  // milliseconds
  successRate: number            // 0-1
  escalationRate: number         // 0-1
  resourceUtilization: number    // 0-1
}

export interface OrchStrategy {
  id: string
  name: string
  description: string
  priority: number
  active: boolean
  rules: string[]                // Strategy rules
}

// =============================================================================
// METAGOAT - Meta-level Agent
// =============================================================================

export interface Metagoat extends HierarchyEntity {
  level: 'metagoat'
  specialty: string               // Meta-level focus (e.g., 'optimization', 'training', 'quality')
  managedAgents: string[]         // IDs of agents under management
  optimizationStrategies: OptimizationStrategy[]
  learningPrograms: LearningProgram[]
  performanceMetrics: MetagoatMetrics
  insights: MetagoatInsight[]
}

export interface OptimizationStrategy {
  id: string
  name: string
  description: string
  targetMetric: string
  currentValue: number
  targetValue: number
  actions: OptimizationAction[]
  status: 'planning' | 'executing' | 'evaluating' | 'complete' | 'abandoned'
  startedAt: Date
  completedAt?: Date
}

export interface OptimizationAction {
  id: string
  type: 'tune' | 'retrain' | 'restructure' | 'delegate' | 'escalate'
  target: string                 // Entity ID
  parameters: Record<string, unknown>
  executed: boolean
  result?: string
}

export interface LearningProgram {
  id: string
  name: string
  targetAgents: string[]
  skill: string
  curriculum: string[]
  currentLevel: number           // 0-100
  targetLevel: number
  progress: number               // 0-1
  deadline?: Date
}

export interface MetagoatMetrics {
  agentsManaged: number
  agentsOptimized: number
  strategiesExecuted: number
  strategiesSuccessful: number
  averageAgentImprovement: number // 0-1
  learningProgramsCompleted: number
}

export interface MetagoatInsight {
  id: string
  type: 'pattern' | 'anomaly' | 'opportunity' | 'risk'
  description: string
  confidence: number             // 0-1
  affectedEntities: string[]
  recommendedAction?: string
  createdAt: Date
}

// =============================================================================
// AGENT - Domain Specialist
// =============================================================================

export interface Agent extends HierarchyEntity {
  level: 'agent'
  expertise: string[]             // Domain expertise areas
  specializations: string[]       // Specific skills
  managedBots: string[]           // IDs of bots under management
  taskQueue: AgentTask[]
  certifications: Certification[]
  performanceMetrics: AgentMetrics
  collaborators: string[]         // Other agents frequently worked with
}

/**
 * @deprecated Use `AgentTask` from `@vorion/contracts` instead.
 * This local definition is maintained for backwards compatibility.
 * The canonical version includes additional fields like `agentId`, `taskType`,
 * `description`, `context`, `source`, `sourceId`, and `createdAt`.
 */
export interface AgentTask {
  id: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'queued' | 'active' | 'paused' | 'completed' | 'failed' | 'delegated'
  input: Record<string, unknown>
  output?: Record<string, unknown>
  assignedBy: string
  delegatedTo?: string
  startedAt?: Date
  completedAt?: Date
  deadline?: Date
}

export interface Certification {
  id: string
  domain: string
  name: string
  level: 'basic' | 'intermediate' | 'advanced' | 'expert' | 'master'
  issuedAt: Date
  expiresAt?: Date
  issuedBy: string               // Metagoat or HITL ID
  score?: number                 // Assessment score
}

/**
 * @deprecated Use `AgentPerformanceMetrics` from `@vorion/contracts` instead.
 * This local definition is maintained for backwards compatibility.
 * The canonical type has the same fields with full Zod validation support.
 */
export interface AgentMetrics {
  tasksCompleted: number
  tasksFailed: number
  averageQuality: number         // 0-1
  averageResponseTime: number    // milliseconds
  userSatisfaction: number       // 0-1
  escalationRate: number         // 0-1
  collaborationScore: number     // 0-1
}

// =============================================================================
// BOT - User-Facing
// =============================================================================

export interface Bot extends HierarchyEntity {
  level: 'bot'
  persona: BotPersona
  channels: string[]              // Where this bot operates
  capabilities: string[]          // What this bot can do
  guardrails: BotGuardrail[]     // What this bot cannot do
  conversationStats: ConversationStats
  userPreferences: Record<string, unknown>
  performanceMetrics: BotMetrics
}

export interface BotPersona {
  displayName: string
  avatar?: string
  voiceStyle: string             // Communication style descriptor
  traits: string[]               // Personality traits
  greeting: string
  farewell: string
  errorResponse: string
}

export interface BotGuardrail {
  id: string
  type: 'topic' | 'action' | 'language' | 'data'
  rule: string
  action: 'block' | 'warn' | 'escalate' | 'log'
  message?: string               // Message to show user if triggered
}

export interface ConversationStats {
  totalConversations: number
  activeConversations: number
  averageSessionLength: number   // milliseconds
  averageMessagesPerSession: number
}

export interface BotMetrics {
  conversationsHandled: number
  messagesProcessed: number
  averageResponseTime: number    // milliseconds
  userRating: number             // 0-5
  escalationRate: number         // 0-1
  resolutionRate: number         // 0-1
  guardrailTriggers: number
}

// =============================================================================
// HIERARCHY UTILITIES
// =============================================================================

export function getHierarchyLevel(level: HierarchyLevel): HierarchyLevelConfig {
  return HIERARCHY_LEVELS[level]
}

export function getTier(level: HierarchyLevel): number {
  return HIERARCHY_LEVELS[level].tier
}

export function canDelegate(from: HierarchyLevel, to: HierarchyLevel): boolean {
  return HIERARCHY_LEVELS[from].canDelegate.includes(to)
}

export function getAuthorityLevel(level: HierarchyLevel): number {
  return HIERARCHY_LEVELS[level].authority
}

export function getReportingChain(level: HierarchyLevel): HierarchyLevel[] {
  const chain: HierarchyLevel[] = [level]
  let current = HIERARCHY_LEVELS[level].reportsTo
  while (current) {
    chain.unshift(current)
    current = HIERARCHY_LEVELS[current].reportsTo
  }
  return chain
}

export function isHigherAuthority(a: HierarchyLevel, b: HierarchyLevel): boolean {
  return getAuthorityLevel(a) > getAuthorityLevel(b)
}

export function canApprove(level: HierarchyLevel): boolean {
  return HIERARCHY_LEVELS[level].canApproveOthers
}

export function canTrain(level: HierarchyLevel): boolean {
  return HIERARCHY_LEVELS[level].canTrainOthers
}

export function requiresHumanOversight(level: HierarchyLevel): boolean {
  return HIERARCHY_LEVELS[level].requiresHumanOversight
}

export function meetsMinTrust(level: HierarchyLevel, trustScore: number): boolean {
  return trustScore >= HIERARCHY_LEVELS[level].minTrustScore
}

export function getMaxAutonomy(level: HierarchyLevel): number {
  return HIERARCHY_LEVELS[level].maxAutonomyLevel
}

export function getAuthorityScope(level: HierarchyLevel): AuthorityScope {
  return HIERARCHY_LEVELS[level].authorityScope
}

export function getManagedLevels(level: HierarchyLevel): HierarchyLevel[] {
  return HIERARCHY_LEVELS[level].canDelegate
}

export function getParentLevel(level: HierarchyLevel): HierarchyLevel | null {
  return HIERARCHY_LEVELS[level].reportsTo
}

// Create default knowledge/memory/abilities for a level
export function createDefaultKnowledgeBase(level: HierarchyLevel, entityId: string): KnowledgeBase {
  const capacities: Record<HierarchyLevel, number> = {
    hitl: 10000,
    orch: 5000,
    metagoat: 3000,
    agent: 1000,
    bot: 500,
  }

  return {
    level,
    entityId,
    items: [],
    capacity: capacities[level],
    consolidationRule: level === 'bot' ? 'replace' : 'merge',
  }
}

export function createDefaultMemoryStore(level: HierarchyLevel, entityId: string): MemoryStore {
  const configs: Record<HierarchyLevel, { working: number; short: number; long: number; threshold: number }> = {
    hitl: { working: 100, short: 1000, long: 10000, threshold: 0.3 },
    orch: { working: 50, short: 500, long: 5000, threshold: 0.4 },
    metagoat: { working: 30, short: 300, long: 3000, threshold: 0.5 },
    agent: { working: 20, short: 200, long: 1000, threshold: 0.6 },
    bot: { working: 10, short: 100, long: 500, threshold: 0.7 },
  }

  const config = configs[level]

  return {
    level,
    entityId,
    workingMemory: [],
    shortTermMemory: [],
    longTermMemory: [],
    maxWorkingMemory: config.working,
    maxShortTermMemory: config.short,
    maxLongTermMemory: config.long,
    consolidationThreshold: config.threshold,
    decayRate: 0.05,
  }
}

export function createDefaultAbilitySet(level: HierarchyLevel, entityId: string): AbilitySet {
  return {
    level,
    entityId,
    innate: [],
    learned: [],
    delegated: [],
    restricted: [],
    pending: [],
  }
}
