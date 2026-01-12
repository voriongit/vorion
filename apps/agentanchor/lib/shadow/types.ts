/**
 * Shadow Agent Types
 *
 * Background observers that monitor conversations and provide:
 * - Memory (facts, decisions, preferences)
 * - Pattern detection (recurring behaviors)
 * - Consistency checking (contradictions)
 * - Risk assessment
 * - Context injection
 */

// ============================================================================
// Shadow Agent Types
// ============================================================================

export type ShadowAgentType =
  | 'memory'      // Remembers facts, decisions, preferences
  | 'pattern'     // Detects recurring patterns and behaviors
  | 'consistency' // Monitors for contradictions
  | 'risk'        // Assesses risk of proposed actions
  | 'learning'    // Tracks mistakes and lessons learned
  | 'context'     // Maintains situational awareness
  | 'intent'      // Tracks the "why" behind decisions
  | 'debt'        // Catalogs technical debt
  | 'quality'     // Monitors code quality trends
  | 'custom'      // User-defined shadow type

export type ShadowMode =
  | 'passive'    // Only observes, never injects
  | 'advisory'   // Observes and provides suggestions when queried
  | 'proactive'  // Automatically injects relevant context
  | 'guardian'   // Can block/warn on critical issues

export type ObservationPriority = 'low' | 'normal' | 'high' | 'critical'

// ============================================================================
// Shadow Agent Configuration
// ============================================================================

export interface ShadowAgentConfig {
  id: string
  type: ShadowAgentType
  name: string
  description?: string
  mode: ShadowMode
  enabled: boolean

  // Ownership
  userId?: string
  agentId?: string // Shadow can be attached to specific agent

  // Subscription filters
  subscriptions: ShadowSubscription[]

  // Persistence settings
  persistence: {
    enabled: boolean
    retentionDays: number
    maxObservations: number
  }

  // Injection settings
  injection: {
    enabled: boolean
    minRelevance: number // 0-1 threshold
    maxItemsPerInjection: number
    cooldownMs: number
  }

  // Type-specific config
  typeConfig?: Record<string, unknown>

  createdAt: Date
  updatedAt: Date
}

export interface ShadowSubscription {
  messageTypes?: string[]
  agentIds?: string[]
  agentTypes?: string[]
  taskPatterns?: string[]
  userIds?: string[]
  contentFilters?: string[] // Regex patterns
}

export const DEFAULT_SHADOW_CONFIG: Partial<ShadowAgentConfig> = {
  mode: 'advisory',
  enabled: true,
  persistence: {
    enabled: true,
    retentionDays: 30,
    maxObservations: 10000
  },
  injection: {
    enabled: true,
    minRelevance: 0.5,
    maxItemsPerInjection: 5,
    cooldownMs: 5000
  }
}

// ============================================================================
// Shadow Observations
// ============================================================================

export interface ShadowObservation {
  id: string
  shadowId: string
  shadowType: ShadowAgentType

  // Source of observation
  source: ObservationSource

  // Content
  summary: string
  rawContent?: string
  structuredData: MemoryData | PatternData | ConsistencyData | RiskData | LearningData | Record<string, unknown>

  // Metadata
  priority: ObservationPriority
  confidence: number // 0-1
  tags: string[]

  // Relationships
  relatedObservations?: string[]
  supersedes?: string

  // Lifecycle
  expiresAt?: Date
  archived: boolean

  createdAt: Date
}

export interface ObservationSource {
  type: 'message' | 'action' | 'reasoning' | 'external'
  messageId?: string
  agentId?: string
  taskId?: string
  conversationId?: string
  userId?: string
}

// ============================================================================
// Type-Specific Data Structures
// ============================================================================

export interface MemoryData {
  type: 'fact' | 'decision' | 'preference' | 'constraint' | 'entity'

  fact?: {
    statement: string
    category: string
    certainty: number
  }

  decision?: {
    what: string
    why: string
    alternatives?: string[]
    madeBy?: string
  }

  preference?: {
    subject: string
    prefers: string
    overWhat?: string
    strength: 'weak' | 'moderate' | 'strong'
  }

  constraint?: {
    rule: string
    scope: string
    enforced: boolean
  }

  entity?: {
    name: string
    type: string
    attributes: Record<string, unknown>
  }
}

export interface PatternData {
  type: 'success' | 'failure' | 'behavior' | 'workflow'

  pattern: {
    description: string
    frequency: number
    firstSeen: Date
    lastSeen: Date
    occurrences: number
  }

  triggers?: string[]
  outcomes?: {
    positive: string[]
    negative: string[]
  }
  recommendation?: string
}

export interface ConsistencyData {
  type: 'contradiction' | 'drift' | 'violation'

  conflict: {
    original: {
      statement: string
      source: string
      timestamp: Date
    }
    conflicting: {
      statement: string
      source: string
      timestamp: Date
    }
    severity: 'minor' | 'moderate' | 'major'
  }

  resolution?: {
    resolved: boolean
    decision?: string
    resolvedBy?: string
    resolvedAt?: Date
  }
}

export interface RiskData {
  type: 'security' | 'data_loss' | 'breaking_change' | 'performance' | 'compliance'

  risk: {
    description: string
    level: 'low' | 'medium' | 'high' | 'critical'
    probability: number // 0-1
    impact: number // 0-1
  }

  trigger: {
    action: string
    context: string
  }

  mitigation?: {
    suggested: string[]
    required?: string[]
  }
}

export interface LearningData {
  type: 'mistake' | 'correction' | 'insight' | 'best_practice'

  lesson: {
    description: string
    context: string
    learnedFrom: string
  }

  application?: {
    when: string
    how: string
    avoid?: string
  }

  validated?: boolean
  validationCount?: number
}

// ============================================================================
// Context Injection
// ============================================================================

export interface ShadowContext {
  id: string
  preparedAt: Date
  preparedFor: {
    agentId?: string
    taskId?: string
    conversationId?: string
  }

  relevanceQuery: string
  relevanceThreshold: number

  items: ShadowContextItem[]
  summary: string
  sourceShadows: string[]
  totalObservationsConsidered: number
}

export interface ShadowContextItem {
  observationId: string
  shadowType: ShadowAgentType
  relevanceScore: number
  content: string
  priority: ObservationPriority
  timestamp: Date
  format: 'reminder' | 'warning' | 'fact' | 'suggestion'
}

// ============================================================================
// Shadow Alerts
// ============================================================================

export interface ShadowAlert {
  id: string
  shadowId: string
  priority: ObservationPriority
  message: string
  observationId?: string

  targetAgentId?: string
  targetUserId?: string

  acknowledged: boolean
  acknowledgedAt?: Date
  acknowledgedBy?: string

  actionTaken?: string
  resolved: boolean
  resolvedAt?: Date

  createdAt: Date
}

// ============================================================================
// Shadow Query
// ============================================================================

export interface ShadowQuery {
  shadowIds?: string[]
  shadowTypes?: ShadowAgentType[]
  agentIds?: string[]
  taskIds?: string[]
  conversationIds?: string[]
  userIds?: string[]
  tags?: string[]
  searchText?: string
  priority?: ObservationPriority[]
  minConfidence?: number
  fromDate?: Date
  toDate?: Date
  limit?: number
  offset?: number
  orderBy?: 'timestamp' | 'relevance' | 'priority' | 'confidence'
  orderDirection?: 'asc' | 'desc'
}

export interface ShadowQueryResult {
  observations: ShadowObservation[]
  total: number
  hasMore: boolean
  query: ShadowQuery
  executedAt: Date
}

// ============================================================================
// Shadow Events
// ============================================================================

export type ShadowEventType =
  | 'observation_created'
  | 'observation_updated'
  | 'observation_archived'
  | 'context_injected'
  | 'shadow_registered'
  | 'shadow_unregistered'
  | 'alert'

export interface ShadowEvent {
  type: ShadowEventType
  shadowId: string
  data: Record<string, unknown>
  timestamp: Date
}

// ============================================================================
// Shadow System Stats
// ============================================================================

export interface ShadowSystemStats {
  activeShadows: number
  observations24h: number
  criticalObservations24h: number
  injections24h: number
  openAlerts: number
  criticalAlerts: number
  byType: Record<ShadowAgentType, number>
  byMode: Record<ShadowMode, number>
}

// ============================================================================
// Pre-built Shadow Templates
// ============================================================================

export const SHADOW_TEMPLATES: Partial<ShadowAgentConfig>[] = [
  {
    type: 'memory',
    name: 'Fact Keeper',
    description: 'Remembers important facts, decisions, and preferences from conversations',
    mode: 'proactive',
    subscriptions: [{ messageTypes: ['user', 'assistant'] }],
    persistence: { enabled: true, retentionDays: 90, maxObservations: 50000 }
  },
  {
    type: 'pattern',
    name: 'Pattern Detector',
    description: 'Identifies recurring behaviors, success patterns, and failure modes',
    mode: 'advisory',
    subscriptions: [{ messageTypes: ['action', 'result'] }],
    persistence: { enabled: true, retentionDays: 180, maxObservations: 20000 }
  },
  {
    type: 'consistency',
    name: 'Contradiction Watcher',
    description: 'Monitors for conflicting statements and policy violations',
    mode: 'guardian',
    subscriptions: [{ messageTypes: ['user', 'assistant', 'decision'] }],
    persistence: { enabled: true, retentionDays: 60, maxObservations: 10000 }
  },
  {
    type: 'risk',
    name: 'Risk Assessor',
    description: 'Evaluates proposed actions for potential risks and impacts',
    mode: 'guardian',
    subscriptions: [{ messageTypes: ['action', 'plan'] }],
    persistence: { enabled: true, retentionDays: 30, maxObservations: 5000 }
  },
  {
    type: 'learning',
    name: 'Lesson Tracker',
    description: 'Captures mistakes, corrections, and best practices',
    mode: 'proactive',
    subscriptions: [{ messageTypes: ['error', 'correction', 'feedback'] }],
    persistence: { enabled: true, retentionDays: 365, maxObservations: 10000 }
  },
  {
    type: 'debt',
    name: 'Debt Cataloger',
    description: 'Tracks technical debt, TODOs, and deferred work',
    mode: 'advisory',
    subscriptions: [{ contentFilters: ['TODO', 'FIXME', 'HACK', 'technical debt'] }],
    persistence: { enabled: true, retentionDays: 180, maxObservations: 5000 }
  }
]
