/**
 * Human-Gateway Agents (3 agents)
 *
 * 1. TriageAgent - Determines severity and escalation type
 * 2. ContextBuilderAgent - Prepares comprehensive context for reviewers
 * 3. DecisionTrackerAgent - Logs decisions and tracks patterns for learning
 *
 * NOTE: Database integration is optional via peer dependency.
 * When Prisma is not available, escalations are logged but not persisted.
 */

import type { CouncilState } from '../types/index.js'

// ============================================
// TYPES
// ============================================

export interface EscalationDecision {
  required: boolean
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  escalationType: string
  reason: string
  assignedTo?: string
  deadline?: Date
  flags: FlagData[]
}

export interface FlagData {
  type: string
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  title: string
  description: string
  detectedBy: string
  context: unknown
}

// ============================================
// AGENT 1: TRIAGE AGENT
// ============================================

export class TriageAgent {
  private name = 'triage_agent'

  /**
   * Analyzes state and determines if escalation is needed
   * Returns escalation decision with severity, type, and flags
   */
  analyze(state: CouncilState): EscalationDecision {
    console.log(`[${this.name.toUpperCase()}] Analyzing request for escalation triggers...`)

    const flags: FlagData[] = []
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
    let escalationType = 'UNKNOWN'

    // Check 1: Compliance failures (CRITICAL)
    if (state.compliance && !state.compliance.passed) {
      severity = 'CRITICAL'
      escalationType = 'COMPLIANCE_FAILURE'

      if (state.compliance.containsPII) {
        flags.push({
          type: 'PII_DETECTED',
          severity: 'CRITICAL',
          title: 'PII Detected in Request',
          description: `PII was detected: ${state.compliance.issues?.map(i => i.type).join(', ')}`,
          detectedBy: this.name,
          context: { issues: state.compliance.issues }
        })
      }

      state.compliance.issues?.forEach(issue => {
        flags.push({
          type: 'COMPLIANCE_VIOLATION',
          severity: issue.severity === 'critical' ? 'CRITICAL' : 'ERROR',
          title: `Compliance Issue: ${issue.type}`,
          description: issue.description,
          detectedBy: this.name,
          context: issue
        })
      })
    }

    // Check 2: Budget exceeded (HIGH)
    if (state.plan && state.plan.estimatedCost > (state.metadata.maxCost || Infinity)) {
      severity = severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH'
      escalationType = escalationType === 'COMPLIANCE_FAILURE' ? escalationType : 'BUDGET_EXCEEDED'

      flags.push({
        type: 'BUDGET_EXCEEDED',
        severity: 'ERROR',
        title: 'Budget Exceeded',
        description: `Estimated cost $${state.plan.estimatedCost} exceeds max budget $${state.metadata.maxCost}`,
        detectedBy: this.name,
        context: { estimated: state.plan.estimatedCost, max: state.metadata.maxCost }
      })
    }

    // Check 3: Low confidence output (MEDIUM)
    if (state.output && state.output.confidence < 0.7) {
      severity = severity === 'CRITICAL' || severity === 'HIGH' ? severity : 'MEDIUM'
      escalationType = escalationType === 'UNKNOWN' ? 'LOW_CONFIDENCE' : escalationType

      flags.push({
        type: 'LOW_CONFIDENCE',
        severity: 'WARNING',
        title: 'Low Confidence Output',
        description: `AI confidence is ${(state.output.confidence * 100).toFixed(1)}%, below threshold of 70%`,
        detectedBy: this.name,
        context: { confidence: state.output.confidence }
      })
    }

    // Check 4: QA failures (MEDIUM)
    if (state.qa && state.qa.requiresRevision && state.qa.revisedCount > 2) {
      severity = severity === 'CRITICAL' || severity === 'HIGH' ? severity : 'MEDIUM'
      escalationType = escalationType === 'UNKNOWN' ? 'QUALITY_FAILURE' : escalationType

      flags.push({
        type: 'QUALITY_ISSUE',
        severity: 'WARNING',
        title: 'Multiple QA Failures',
        description: `Output failed QA review ${state.qa.revisedCount} times`,
        detectedBy: this.name,
        context: { revisedCount: state.qa.revisedCount, feedback: state.qa.feedback }
      })
    }

    // Check 5: User requested approval (varies by priority)
    if (state.metadata.requiresHumanApproval) {
      const priorityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
        critical: 'CRITICAL',
        high: 'HIGH',
        medium: 'MEDIUM',
        low: 'LOW'
      }
      severity = priorityMap[state.metadata.priority]
      escalationType = 'USER_REQUESTED'

      flags.push({
        type: 'NOVEL_REQUEST',
        severity: 'INFO',
        title: 'Human Approval Requested',
        description: 'User explicitly requested human review',
        detectedBy: this.name,
        context: { priority: state.metadata.priority }
      })
    }

    // Check 6: High-priority + High-cost = HIGH_RISK_DECISION
    if (
      state.metadata.priority === 'critical' &&
      state.plan &&
      state.plan.estimatedCost > 0.50
    ) {
      severity = 'CRITICAL'
      escalationType = 'HIGH_RISK_DECISION'

      flags.push({
        type: 'HIGH_COST',
        severity: 'ERROR',
        title: 'High-Risk Decision',
        description: `Critical priority request with high cost ($${state.plan.estimatedCost})`,
        detectedBy: this.name,
        context: { cost: state.plan.estimatedCost, priority: state.metadata.priority }
      })
    }

    const required = flags.length > 0 || state.metadata.requiresHumanApproval || false

    console.log(`[${this.name.toUpperCase()}] Escalation ${required ? 'REQUIRED' : 'NOT REQUIRED'}`)
    console.log(`[${this.name.toUpperCase()}] Severity: ${severity}, Type: ${escalationType}, Flags: ${flags.length}`)

    return {
      required,
      severity,
      escalationType,
      reason: this.generateReason(escalationType, flags),
      assignedTo: this.assignReviewer(severity),
      deadline: this.calculateDeadline(severity),
      flags
    }
  }

  private generateReason(escalationType: string, flags: FlagData[]): string {
    if (flags.length === 0) return 'No issues detected'

    const typeMap: Record<string, string> = {
      COMPLIANCE_FAILURE: 'Compliance violations detected',
      BUDGET_EXCEEDED: 'Request exceeds budget threshold',
      LOW_CONFIDENCE: 'AI output has low confidence',
      QUALITY_FAILURE: 'Multiple QA review failures',
      USER_REQUESTED: 'User requested human approval',
      HIGH_RISK_DECISION: 'High-risk business decision'
    }

    return typeMap[escalationType] || `${flags.length} issue(s) detected`
  }

  private assignReviewer(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): string | undefined {
    // Assignment based on severity
    const assignmentMap: Record<string, string | undefined> = {
      CRITICAL: 'CEO', // or CTO for technical issues
      HIGH: 'MANAGER',
      MEDIUM: 'PROJECT_MANAGER',
      LOW: undefined // Auto-approve after timeout
    }

    return assignmentMap[severity]
  }

  private calculateDeadline(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): Date {
    const now = new Date()
    const deadlineMap: Record<string, number> = {
      CRITICAL: 2, // 2 hours
      HIGH: 8, // 8 hours
      MEDIUM: 24, // 24 hours
      LOW: 72 // 72 hours (auto-approve)
    }

    const hours = deadlineMap[severity]
    return new Date(now.getTime() + hours * 60 * 60 * 1000)
  }
}

// ============================================
// AGENT 2: CONTEXT BUILDER AGENT
// ============================================

export class ContextBuilderAgent {
  private name = 'context_builder_agent'

  /**
   * Builds comprehensive context for human reviewers
   * Summarizes request, plan, compliance issues, flags, and estimated impact
   */
  buildContext(state: CouncilState, decision: EscalationDecision): {
    contextSummary: string
    recommendedAction: string
    estimatedImpact: string
  } {
    console.log(`[${this.name.toUpperCase()}] Building context for reviewer...`)

    const contextSummary = this.buildSummary(state, decision)
    const recommendedAction = this.buildRecommendation(state, decision)
    const estimatedImpact = this.buildImpactAnalysis(state, decision)

    return { contextSummary, recommendedAction, estimatedImpact }
  }

  private buildSummary(state: CouncilState, decision: EscalationDecision): string {
    const parts = [
      `**Request ID:** ${state.requestId}`,
      `**User:** ${state.userId}`,
      `**Priority:** ${state.metadata.priority}`,
      ``,
      `**Original Request:**`,
      state.userRequest,
      ``,
      `**Escalation Reason:** ${decision.reason}`,
      `**Severity:** ${decision.severity}`,
      `**Type:** ${decision.escalationType}`,
    ]

    if (state.plan) {
      parts.push(
        ``,
        `**Execution Plan:**`,
        `- ${state.plan.steps.length} steps`,
        `- Estimated cost: $${state.plan.estimatedCost.toFixed(4)}`,
        `- Estimated time: ${state.plan.estimatedTime}s`,
        `- Complexity: ${state.plan.complexity}`
      )
    }

    if (decision.flags.length > 0) {
      parts.push(
        ``,
        `**Flags (${decision.flags.length}):**`,
        ...decision.flags.map(f => `- [${f.severity}] ${f.title}: ${f.description}`)
      )
    }

    return parts.join('\n')
  }

  private buildRecommendation(state: CouncilState, decision: EscalationDecision): string {
    const parts: string[] = []

    if (decision.escalationType === 'COMPLIANCE_FAILURE') {
      parts.push('**RECOMMENDED ACTION: REJECT**')
      parts.push('')
      parts.push('This request contains PII or compliance violations.')
      parts.push('- Review the detected issues carefully')
      parts.push('- If PII is necessary, ensure it routes to self-hosted models')
      parts.push('- Consider rejecting if compliance cannot be ensured')
    } else if (decision.escalationType === 'BUDGET_EXCEEDED') {
      parts.push('**RECOMMENDED ACTION: REVIEW BUDGET**')
      parts.push('')
      parts.push('This request exceeds the allocated budget.')
      parts.push('- Evaluate if the cost is justified')
      parts.push('- Consider approving with increased budget limit')
      parts.push('- Or request the user to simplify the request')
    } else if (decision.escalationType === 'LOW_CONFIDENCE') {
      parts.push('**RECOMMENDED ACTION: REVIEW OUTPUT**')
      parts.push('')
      parts.push('The AI has low confidence in its output.')
      parts.push('- Review the output for accuracy')
      parts.push('- Consider approving with modifications')
      parts.push('- Or reject and suggest alternative approach')
    } else {
      parts.push('**RECOMMENDED ACTION: REVIEW**')
      parts.push('')
      parts.push('Review the request and make a decision based on context.')
    }

    return parts.join('\n')
  }

  private buildImpactAnalysis(state: CouncilState, decision: EscalationDecision): string {
    const parts: string[] = []

    // Cost impact
    if (state.plan) {
      parts.push(`**Cost Impact:** $${state.plan.estimatedCost.toFixed(4)}`)
    }

    // Time impact
    if (state.plan) {
      parts.push(`**Time Impact:** ${state.plan.estimatedTime}s (~${Math.ceil(state.plan.estimatedTime / 60)} minutes)`)
    }

    // Risk level
    const riskLevel = decision.severity === 'CRITICAL' ? 'HIGH' : decision.severity === 'HIGH' ? 'MEDIUM' : 'LOW'
    parts.push(`**Risk Level:** ${riskLevel}`)

    // Compliance risk
    if (state.compliance && !state.compliance.passed) {
      parts.push(`**Compliance Risk:** HIGH - ${state.compliance.issues?.length || 0} violations detected`)
    } else {
      parts.push(`**Compliance Risk:** LOW`)
    }

    return parts.join('\n')
  }
}

// ============================================
// AGENT 3: DECISION TRACKER AGENT
// ============================================

export class DecisionTrackerAgent {
  private name = 'decision_tracker_agent'

  /**
   * Creates escalation record (logs to console when database not available)
   * Returns a generated review ID for tracking
   */
  async createReview(
    state: CouncilState,
    decision: EscalationDecision,
    context: { contextSummary: string; recommendedAction: string; estimatedImpact: string }
  ): Promise<string> {
    console.log(`[${this.name.toUpperCase()}] Creating human review record...`)

    const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Log the review details
    console.log(`[${this.name.toUpperCase()}] Review ID: ${reviewId}`)
    console.log(`[${this.name.toUpperCase()}] Severity: ${decision.severity}`)
    console.log(`[${this.name.toUpperCase()}] Type: ${decision.escalationType}`)
    console.log(`[${this.name.toUpperCase()}] Assigned to: ${decision.assignedTo || 'Unassigned'}`)
    console.log(`[${this.name.toUpperCase()}] Deadline: ${decision.deadline?.toISOString()}`)
    console.log(`[${this.name.toUpperCase()}] Flags: ${decision.flags.length}`)

    // In production with Prisma available, this would persist to database
    // For now, we log and return the generated ID

    return reviewId
  }

  /**
   * Tracks decision outcome
   */
  async trackDecision(
    reviewId: string,
    decision: 'APPROVE' | 'REJECT' | 'MODIFY',
    decidedById: string,
    reason?: string
  ): Promise<void> {
    console.log(`[${this.name.toUpperCase()}] Tracking decision: ${decision}`)
    console.log(`[${this.name.toUpperCase()}] Review ID: ${reviewId}`)
    console.log(`[${this.name.toUpperCase()}] Decided by: ${decidedById}`)
    console.log(`[${this.name.toUpperCase()}] Reason: ${reason || 'No reason provided'}`)

    // In production with Prisma available, this would update the database
  }
}

// ============================================
// ORCHESTRATOR
// ============================================

export class HumanGatewayOrchestrator {
  private triageAgent = new TriageAgent()
  private contextAgent = new ContextBuilderAgent()
  private trackerAgent = new DecisionTrackerAgent()

  /**
   * Main entry point - checks if escalation needed and creates review if required
   */
  async checkEscalation(state: CouncilState): Promise<CouncilState> {
    console.log('[HUMAN-GATEWAY] Starting escalation check...')

    // Step 1: Triage - determine if escalation needed
    const decision = this.triageAgent.analyze(state)

    if (!decision.required) {
      console.log('[HUMAN-GATEWAY] No escalation required')
      return state
    }

    // Step 2: Context Builder - prepare context for reviewers
    const context = this.contextAgent.buildContext(state, decision)

    // Step 3: Decision Tracker - create review record
    const reviewId = await this.trackerAgent.createReview(state, decision, context)

    console.log('[HUMAN-GATEWAY] Escalation complete, awaiting human review')

    // Update state with escalation info
    return {
      ...state,
      humanEscalation: {
        required: true,
        reason: decision.reason,
        escalatedBy: 'human_gateway_orchestrator',
        reviewId,
        severity: decision.severity,
        assignedTo: decision.assignedTo,
        deadline: decision.deadline
      },
      currentStep: 'human_review'
    }
  }
}

// Export main orchestrator as default
export const humanGateway = new HumanGatewayOrchestrator()
