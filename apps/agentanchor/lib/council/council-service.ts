// Council Service - Core governance logic
// Handles validator voting, decision making, and precedent management

import Anthropic from '@anthropic-ai/sdk'
import {
  ValidatorId,
  ValidatorVote,
  UpchainRequest,
  CouncilDecision,
  RiskLevel,
  VoteDecision,
  RISK_LEVELS,
} from './types'
import { canonicalToNumericRisk } from './risk-assessment'
import { VALIDATORS, VALIDATOR_IDS, getValidator } from './validators'

// Initialize Anthropic client
const anthropic = new Anthropic()

interface EvaluationContext {
  request: UpchainRequest
  precedents?: any[]
}

/**
 * Get a single validator's vote on a request
 */
async function getValidatorVote(
  validatorId: ValidatorId,
  context: EvaluationContext
): Promise<ValidatorVote> {
  const validator = getValidator(validatorId)
  const { request, precedents } = context

    const numericRisk = typeof request.riskLevel === 'number'
      ? request.riskLevel
      : canonicalToNumericRisk(request.riskLevel)

    // Build the evaluation prompt
    const evaluationPrompt = `
Evaluate this action request:

**Agent ID:** ${request.agentId}
**Action Type:** ${request.actionType}
**Action Details:** ${request.actionDetails}
**Justification:** ${request.justification}
**Risk Level:** ${request.riskLevel} (${RISK_LEVELS[numericRisk].name})
**Context:** ${JSON.stringify(request.context, null, 2)}

${precedents?.length ? `
**Relevant Precedents:**
${precedents.map((p, i) => `${i + 1}. ${p.summary}`).join('\n')}
` : ''}

Provide your evaluation as JSON only.
`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0, // Deterministic for governance
      system: validator.systemPrompt,
      messages: [
        { role: 'user', content: evaluationPrompt }
      ],
    })

    // Parse the response
    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      validatorId,
      decision: parsed.decision as VoteDecision,
      reasoning: parsed.reasoning,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      votedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error(`Validator ${validatorId} error:`, error)
    // On error, abstain with low confidence
    return {
      validatorId,
      decision: 'abstain',
      reasoning: 'Error during evaluation - abstaining for safety',
      confidence: 0,
      votedAt: new Date().toISOString(),
    }
  }
}

/**
 * Determine required validators based on risk level
 */
function getRequiredValidators(riskLevel: RiskLevel): ValidatorId[] {
  const numericRisk = typeof riskLevel === 'number' ? riskLevel : canonicalToNumericRisk(riskLevel)
  switch (numericRisk) {
    case 0:
    case 1:
      return [] // Auto-approve, no validators needed
    case 2:
      return ['guardian'] // Single validator (start with Guardian)
    case 3:
    case 4:
      return VALIDATOR_IDS // All validators
    default:
      return VALIDATOR_IDS
  }
}

/**
 * Calculate decision outcome based on votes and risk level
 */
function calculateOutcome(
  votes: ValidatorVote[],
  riskLevel: RiskLevel
): { outcome: CouncilDecision['outcome']; reasoning: string } {
  const numericRisk = typeof riskLevel === 'number' ? riskLevel : canonicalToNumericRisk(riskLevel)
  const approvals = votes.filter(v => v.decision === 'approve').length
  const denials = votes.filter(v => v.decision === 'deny').length
  const abstentions = votes.filter(v => v.decision === 'abstain').length
  const totalVoters = votes.length

  // Risk level 0-1: Auto-approve
  if (numericRisk <= 1) {
    return {
      outcome: 'approved',
      reasoning: 'Routine action auto-approved (Risk Level 0-1)',
    }
  }

  // Risk level 2: Single validator approval
  if (numericRisk === 2) {
    if (approvals > 0) {
      return {
        outcome: 'approved',
        reasoning: votes.find(v => v.decision === 'approve')?.reasoning || 'Approved by validator',
      }
    }
    if (denials > 0) {
      return {
        outcome: 'denied',
        reasoning: votes.find(v => v.decision === 'deny')?.reasoning || 'Denied by validator',
      }
    }
    return {
      outcome: 'escalated',
      reasoning: 'All validators abstained - escalating to human review',
    }
  }

  // Risk level 3: Majority required (3/4)
  if (numericRisk === 3) {
    const requiredApprovals = Math.ceil((totalVoters - abstentions) * 0.75)

    if (approvals >= requiredApprovals && approvals >= 3) {
      return {
        outcome: 'approved',
        reasoning: `Majority approved (${approvals}/${totalVoters})`,
      }
    }
    if (denials > totalVoters - requiredApprovals) {
      const denyReasons = votes
        .filter(v => v.decision === 'deny')
        .map(v => `${getValidator(v.validatorId).name}: ${v.reasoning}`)
        .join('; ')
      return {
        outcome: 'denied',
        reasoning: denyReasons,
      }
    }
    return {
      outcome: 'escalated',
      reasoning: 'No clear majority - escalating to human review',
    }
  }

  // Risk level 4: Unanimous + Human
  if (numericRisk === 4) {
    if (denials > 0) {
      const denyReasons = votes
        .filter(v => v.decision === 'deny')
        .map(v => `${getValidator(v.validatorId).name}: ${v.reasoning}`)
        .join('; ')
      return {
        outcome: 'denied',
        reasoning: denyReasons,
      }
    }
    if (approvals === totalVoters) {
      return {
        outcome: 'escalated', // Even unanimous approval needs human confirmation for L4
        reasoning: 'Council unanimously approves - awaiting human confirmation',
      }
    }
    return {
      outcome: 'escalated',
      reasoning: 'Critical action requires human review',
    }
  }

  return {
    outcome: 'escalated',
    reasoning: 'Unable to determine outcome',
  }
}

/**
 * Main evaluation function - evaluates an Upchain request through the Council
 */
export async function evaluateRequest(
  request: UpchainRequest,
  options?: { precedents?: any[] }
): Promise<CouncilDecision> {
  const numericRisk = typeof request.riskLevel === 'number' ? request.riskLevel : canonicalToNumericRisk(request.riskLevel)
  const requiredValidators = getRequiredValidators(numericRisk)

  // Auto-approve low-risk actions
  if (requiredValidators.length === 0) {
    return {
      id: crypto.randomUUID(),
      requestId: request.id,
      agentId: request.agentId,
      votes: [],
      outcome: 'approved',
      finalReasoning: `Auto-approved: ${RISK_LEVELS[numericRisk].name} action`,
      createsPrecedent: false,
      decidedAt: new Date().toISOString(),
      recordedOnTruthChain: false, // Will be set true after recording
    }
  }

  // Collect votes from required validators (in parallel)
  const context: EvaluationContext = {
    request,
    precedents: options?.precedents,
  }

  const votePromises = requiredValidators.map(id => getValidatorVote(id, context))
  const votes = await Promise.all(votePromises)

  // Calculate outcome
  const { outcome, reasoning } = calculateOutcome(votes, numericRisk)

  // Determine if this creates precedent (significant decisions)
  const createsPrecedent =
    numericRisk >= 3 &&
    (outcome === 'approved' || outcome === 'denied')

  return {
    id: crypto.randomUUID(),
    requestId: request.id,
    agentId: request.agentId,
    votes,
    outcome,
    finalReasoning: reasoning,
    createsPrecedent,
    decidedAt: new Date().toISOString(),
    recordedOnTruthChain: false,
  }
}

/**
 * Quick evaluation for examination requests (Academy graduation)
 */
export async function evaluateExamination(
  agentId: string,
  curriculumName: string,
  trainingResults: { modulesCompleted: number; totalModules: number; averageScore: number }
): Promise<CouncilDecision> {
  const request: UpchainRequest = {
    id: crypto.randomUUID(),
    agentId,
    actionType: 'academy_examination',
    actionDetails: `Agent requesting graduation from ${curriculumName}`,
    context: {
      curriculum: curriculumName,
      ...trainingResults,
    },
    justification: `Completed ${trainingResults.modulesCompleted}/${trainingResults.totalModules} modules with ${trainingResults.averageScore}% average score`,
    riskLevel: 2, // Elevated - single validator can approve
    requestedAt: new Date().toISOString(),
  }

  return evaluateRequest(request)
}

export { VALIDATORS, VALIDATOR_IDS, getValidator, getAllValidators } from './validators'
export { RISK_LEVELS, TRUST_TIER_AUTONOMY } from './types'
