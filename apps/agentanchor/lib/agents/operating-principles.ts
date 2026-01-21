/**
 * Agent Operating Principles
 *
 * Core philosophy: Agents are PROACTIVE, not reactive.
 * Analysis leads to action. Input is prioritized.
 * Excellence through iteration: find → fix → implement → change → iterate → succeed
 */

// =============================================================================
// Canonical Type Imports from @vorion/contracts
// =============================================================================

import {
  AgentCapability as CanonicalAgentCapability,
  CollaborationMode as CanonicalCollaborationMode,
  agentCapabilitySchema,
  collaborationModeSchema,
  COLLABORATION_MODES,
} from '@vorion/contracts';

// Re-export canonical types for backwards compatibility
export {
  CanonicalAgentCapability,
  CanonicalCollaborationMode,
  agentCapabilitySchema,
  collaborationModeSchema,
  COLLABORATION_MODES,
};

// =============================================================================
// OPERATING PHILOSOPHY
// =============================================================================

export const OPERATING_PHILOSOPHY = {
  core: 'PROACTIVE_NOT_REACTIVE',

  principles: [
    'Analysis MUST lead to action - no observation without recommendation',
    'Input is prioritized - actively seek information to improve',
    'Think in actionable steps - every insight becomes a task',
    'Collaborate by default - route to specialists when beneficial',
    'Iterate relentlessly - excellence through continuous improvement',
    'Own outcomes - success is measured by results, not effort',
  ],

  cycle: ['FIND', 'FIX', 'IMPLEMENT', 'CHANGE', 'ITERATE', 'SUCCEED'] as const,

  behaviors: {
    // What proactive agents DO
    proactive: [
      'Identify issues before they become problems',
      'Suggest improvements without being asked',
      'Delegate to specialists for better outcomes',
      'Monitor systems and alert on anomalies',
      'Learn from every interaction to improve',
      'Anticipate needs based on context',
    ],
    // What proactive agents DON'T do
    antipatterns: [
      'Wait for explicit instructions when action is clear',
      'Observe problems without proposing solutions',
      'Hoard tasks instead of delegating appropriately',
      'Report without recommendations',
      'Repeat mistakes without learning',
      'Work in isolation when collaboration helps',
    ],
  },
} as const

// =============================================================================
// PROACTIVE BEHAVIOR TYPES
// =============================================================================

export type ProactiveBehavior =
  | 'ANTICIPATE'      // Predict needs before asked
  | 'ANALYZE'         // Deep analysis with actionable output
  | 'DELEGATE'        // Route to better-suited agent
  | 'ESCALATE'        // Push up for human/council review
  | 'ITERATE'         // Improve based on feedback
  | 'COLLABORATE'     // Work with other agents
  | 'MONITOR'         // Watch systems proactively
  | 'SUGGEST'         // Offer improvements unprompted

export interface ProactiveAction {
  behavior: ProactiveBehavior
  trigger: string              // What initiated this action
  analysis: string             // What was observed/analyzed
  recommendation: string       // What should be done
  actionSteps: string[]        // Concrete steps to execute
  delegateTo?: string          // Agent ID to delegate to
  collaborateWith?: string[]   // Agent IDs to collaborate with
  priority: 'low' | 'medium' | 'high' | 'critical'
  confidence: number           // 0-1 confidence in recommendation
}

// =============================================================================
// AGENT COLLABORATION FRAMEWORK
// =============================================================================

export interface CollaborationRequest {
  requesterId: string          // Agent making the request
  targetAgentId?: string       // Specific agent, or null for routing
  taskType: string             // Type of task
  context: Record<string, unknown>
  urgency: 'low' | 'medium' | 'high' | 'critical'
  expectedOutcome: string
  deadline?: Date
}

export interface CollaborationResponse {
  accepted: boolean
  agentId: string
  estimatedCompletion?: Date
  alternativeAgents?: string[] // If declined, suggest alternatives
  reason?: string
}

export type CollaborationMode =
  | 'DELEGATE'        // Hand off entirely
  | 'CONSULT'         // Ask for input, retain ownership
  | 'PARALLEL'        // Work simultaneously
  | 'SEQUENTIAL'      // Chain of agents
  | 'CONSENSUS'       // Multiple agents must agree

// =============================================================================
// ACTIONABLE ANALYSIS FRAMEWORK
// =============================================================================

export interface ActionableAnalysis {
  // What was analyzed
  subject: string
  scope: string
  dataPoints: number

  // Findings
  observations: string[]
  patterns: string[]
  anomalies: string[]

  // REQUIRED: Every analysis must produce actions
  actions: ActionItem[]

  // Prioritization
  immediateActions: ActionItem[]  // Do now
  scheduledActions: ActionItem[]  // Do later
  delegatedActions: ActionItem[]  // Someone else does

  // Meta
  confidence: number
  nextAnalysisRecommended?: Date
}

export interface ActionItem {
  id: string
  description: string
  type: 'fix' | 'implement' | 'change' | 'investigate' | 'monitor' | 'escalate'
  priority: 'low' | 'medium' | 'high' | 'critical'
  owner?: string               // Agent ID responsible
  collaborators?: string[]     // Agent IDs involved
  steps: string[]
  successCriteria: string
  estimatedEffort?: string     // e.g., '2 hours', '1 day'
  blockedBy?: string[]         // Other action IDs
  deadline?: Date
}

// =============================================================================
// AGENT CAPABILITY MATCHING
// =============================================================================

/**
 * @deprecated Use `AgentCapability` from `@vorion/contracts` instead.
 * This local definition is maintained for backwards compatibility.
 * The canonical type has the same structure with Zod validation support
 * and uses a 0-5 autonomy level (maps to TrustBand).
 */
export interface AgentCapability {
  domain: string               // e.g., 'security', 'data-analysis', 'customer-service'
  skills: string[]             // Specific skills
  trustLevel: number           // Min trust score to handle
  autonomyLevel: number        // 0-4 autonomy level
  collaborationPreference: CollaborationMode[]
}

export function findBestAgent(
  task: { domain: string; complexity: number; urgency: string },
  availableAgents: Array<{ id: string; capabilities: AgentCapability; trustScore: number; currentLoad: number }>
): string | null {
  // Score each agent for this task
  const scored = availableAgents.map(agent => {
    let score = 0

    // Domain match (40%)
    if (agent.capabilities.domain === task.domain) score += 40

    // Trust score (30%)
    score += (agent.trustScore / 1000) * 30

    // Availability (20%)
    score += Math.max(0, 20 - agent.currentLoad * 2)

    // Can handle complexity (10%)
    if (agent.trustScore >= task.complexity * 100) score += 10

    return { id: agent.id, score }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  return scored[0]?.score > 50 ? scored[0].id : null
}

// =============================================================================
// PROACTIVE TRIGGERS
// =============================================================================

export const PROACTIVE_TRIGGERS = {
  // System events that should trigger proactive behavior
  systemEvents: [
    { event: 'trust_score_drop', action: 'ANALYZE', threshold: -50 },
    { event: 'error_spike', action: 'INVESTIGATE', threshold: 5 },
    { event: 'user_complaint', action: 'ESCALATE', threshold: 1 },
    { event: 'idle_period', action: 'SUGGEST', threshold: 300000 }, // 5 min
    { event: 'pattern_detected', action: 'DELEGATE', threshold: 0.8 },
    { event: 'deadline_approaching', action: 'ANTICIPATE', threshold: 86400000 }, // 24 hours
  ],

  // Periodic proactive behaviors
  scheduled: [
    { behavior: 'MONITOR', interval: 60000, description: 'Health check' },
    { behavior: 'ANALYZE', interval: 3600000, description: 'Hourly analysis' },
    { behavior: 'SUGGEST', interval: 86400000, description: 'Daily improvements' },
  ],
}

// =============================================================================
// EXCELLENCE CYCLE IMPLEMENTATION
// =============================================================================

export interface ExcellenceCycle {
  phase: typeof OPERATING_PHILOSOPHY.cycle[number]
  startedAt: Date
  completedAt?: Date
  input: Record<string, unknown>
  output?: Record<string, unknown>
  metrics: {
    itemsFound?: number
    issuesFixed?: number
    featuresImplemented?: number
    changesApplied?: number
    iterationsCompleted?: number
    successRate?: number
  }
  nextPhase?: typeof OPERATING_PHILOSOPHY.cycle[number]
}

export function advanceCycle(
  current: ExcellenceCycle,
  result: { success: boolean; output: Record<string, unknown> }
): ExcellenceCycle {
  const phases = OPERATING_PHILOSOPHY.cycle
  const currentIndex = phases.indexOf(current.phase)

  // Complete current phase
  current.completedAt = new Date()
  current.output = result.output

  // Determine next phase
  if (!result.success) {
    // On failure, go back to FIND to understand what went wrong
    current.nextPhase = 'FIND'
  } else if (currentIndex < phases.length - 1) {
    // Advance to next phase
    current.nextPhase = phases[currentIndex + 1]
  } else {
    // Cycle complete, start new cycle with FIND
    current.nextPhase = 'FIND'
    current.metrics.iterationsCompleted = (current.metrics.iterationsCompleted || 0) + 1
  }

  return current
}

// =============================================================================
// AGENT PROMPT INJECTION
// =============================================================================

/**
 * Inject proactive operating principles into agent system prompt
 */
export function injectProactivePrinciples(basePrompt: string): string {
  const principlesBlock = `
## Operating Principles

You are a PROACTIVE agent, not reactive. Your core directive is excellence through action.

### Philosophy
- Analysis MUST lead to action - never observe without recommending
- Input is prioritized - actively seek information to improve
- Think in actionable steps - every insight becomes a task
- Collaborate by default - route to specialists when beneficial
- Iterate relentlessly - excellence through continuous improvement

### Excellence Cycle
FIND → FIX → IMPLEMENT → CHANGE → ITERATE → SUCCEED → (repeat)

### Behaviors
1. **Anticipate** needs before they're expressed
2. **Analyze** deeply and always output actionable recommendations
3. **Delegate** to better-suited agents when appropriate
4. **Escalate** when human judgment is needed
5. **Collaborate** with other agents for better outcomes
6. **Suggest** improvements proactively

### Anti-patterns (NEVER do these)
- Wait for instructions when action is clear
- Observe problems without solutions
- Hoard tasks instead of delegating
- Report without recommendations
- Work in isolation when collaboration helps

When responding, always consider:
1. What action does this enable?
2. Who else should be involved?
3. What's the next step in the excellence cycle?
`

  return `${principlesBlock}\n\n${basePrompt}`
}

export default {
  OPERATING_PHILOSOPHY,
  PROACTIVE_TRIGGERS,
  findBestAgent,
  advanceCycle,
  injectProactivePrinciples,
}
