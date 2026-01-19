/**
 * Council Orchestration Types
 *
 * Defines the state machine and types for the 16-agent council
 */

import { z } from 'zod'

// ============================================
// COUNCIL STATE
// ============================================

/**
 * The complete state of a council orchestration session
 * This state flows through the orchestration workflow
 */
export interface CouncilState {
  // Input
  userRequest: string
  userId: string
  requestId: string
  metadata: {
    priority: 'low' | 'medium' | 'high' | 'critical'
    expectedResponseTime?: number // seconds
    maxCost?: number // USD
    requiresHumanApproval?: boolean
  }

  // Planning Phase
  plan?: {
    steps: TaskStep[]
    estimatedCost: number
    estimatedTime: number
    complexity: 'simple' | 'moderate' | 'complex'
    createdBy: 'master_planner'
  }

  // Compliance Phase
  compliance?: {
    passed: boolean
    issues: ComplianceIssue[]
    containsPII: boolean
    sensitivityLevel: 'public' | 'internal' | 'confidential' | 'restricted'
    checkedBy: string[] // Agent IDs
  }

  // Routing Phase
  routing?: {
    selectedAgents: SelectedAgent[]
    rationale: string
    routedBy: string // Agent ID
  }

  // Execution Phase
  execution?: {
    results: ExecutionResult[]
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    startTime: Date
    endTime?: Date
  }

  // QA Phase
  qa?: {
    passed: boolean
    feedback: QAFeedback[]
    requiresRevision: boolean
    revisedCount: number
    reviewedBy: string[] // Agent IDs
  }

  // Human Escalation
  humanEscalation?: {
    required: boolean
    reason: string
    escalatedBy: string // Agent ID
    reviewId?: string // HumanReview database ID
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    assignedTo?: string // UserRole assigned to
    deadline?: Date // Review deadline
    resolvedAt?: Date
    resolution?: string
  }

  // Final Output
  output?: {
    content: string
    confidence: number // 0-1
    totalCost: number
    totalTime: number // seconds
    model: string
  }

  // Metadata
  currentStep: CouncilStep
  iterationCount: number
  errors: CouncilError[]
  createdAt: Date
  updatedAt: Date
}

export type CouncilStep =
  | 'received'
  | 'planning'
  | 'compliance_check'
  | 'routing'
  | 'execution'
  | 'qa_review'
  | 'human_review'
  | 'completed'
  | 'failed'

// ============================================
// SUB-TYPES
// ============================================

export interface TaskStep {
  id: string
  description: string
  assignTo: 'advisor' | 'workforce' | 'council'
  estimatedCost: number
  estimatedTime: number
  dependencies: string[] // Step IDs
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
}

export interface ComplianceIssue {
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: 'pii' | 'sensitive_data' | 'policy_violation' | 'ethical_concern'
  description: string
  detectedBy: string // Agent ID
  suggestedAction: string
}

export interface SelectedAgent {
  agentId: string
  agentType: 'advisor' | 'employee' | 'team'
  agentName: string
  role: string
  reason: string
}

export interface ExecutionResult {
  agentId: string
  agentName: string
  content: string
  confidence: number
  cost: number
  time: number // seconds
  model: string
  error?: string
}

export interface QAFeedback {
  aspect: 'accuracy' | 'completeness' | 'clarity' | 'relevance' | 'tone'
  score: number // 0-10
  feedback: string
  reviewedBy: string // Agent ID
  requiresRevision: boolean
}

export interface CouncilError {
  step: CouncilStep
  message: string
  agentId: string
  timestamp: Date
  severity: 'warning' | 'error' | 'critical'
}

// ============================================
// AGENT DEFINITIONS
// ============================================

export interface CouncilAgent {
  id: string
  name: string
  role: CouncilAgentRole
  description: string
  capabilities: string[]
  model: string
  systemPrompt: string
}

export type CouncilAgentRole =
  | 'master_planner'
  | 'routing_dispatch'
  | 'compliance_ethics'
  | 'qa_critique'
  | 'meta_orchestrator'
  | 'human_gateway'

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface CouncilRequest {
  userRequest: string
  userId: string
  metadata?: {
    priority?: 'low' | 'medium' | 'high' | 'critical'
    maxCost?: number
    requiresHumanApproval?: boolean
  }
}

export interface CouncilResponse {
  requestId: string
  content: string
  confidence: number
  totalCost: number
  totalTime: number
  metadata: {
    stepsCompleted: CouncilStep[]
    agentsInvolved: string[]
    iterationCount: number
    compliancePassed: boolean
    qaPassed: boolean
    humanApprovalRequired: boolean
  }
}

// ============================================
// ZOD SCHEMAS (for validation)
// ============================================

export const CouncilRequestSchema = z.object({
  userRequest: z.string().min(1),
  userId: z.string(),
  metadata: z.object({
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    maxCost: z.number().positive().optional(),
    requiresHumanApproval: z.boolean().optional()
  }).optional()
})

export const TaskStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  assignTo: z.enum(['advisor', 'workforce', 'council']),
  estimatedCost: z.number(),
  estimatedTime: z.number(),
  dependencies: z.array(z.string()),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed'])
})
