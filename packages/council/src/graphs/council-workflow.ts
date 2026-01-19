/**
 * Council Orchestration Workflow
 *
 * Sequential workflow for the 16-agent council
 *
 * Flow:
 * 1. Receive Request
 * 2. Master Planner -> Create execution plan
 * 3. Compliance Team -> Check for PII/policy violations
 * 4. Routing -> Select agents
 * 5. Execution -> Run advisors/workforce
 * 6. QA Review -> Critique outputs
 * 7. Human Gateway -> Escalate if needed
 * 8. Complete or Iterate
 */

import type { CouncilState } from '../types/index.js'
import {
  MasterPlannerAgent,
  runComplianceCheck,
  RoutingAgent,
  runQAReview,
  HumanGatewayAgent
} from '../agents/index.js'
import { createGateway } from '@vorion/ai-gateway'

// ============================================
// NODE FUNCTIONS
// ============================================

/**
 * Initial node: Receive and validate request
 */
async function receiveRequest(state: CouncilState): Promise<CouncilState> {
  console.log('[COUNCIL] Request received:', state.requestId)

  return {
    ...state,
    currentStep: 'planning',
    updatedAt: new Date()
  }
}

/**
 * Planning node: Master Planner creates execution plan
 */
async function planExecution(state: CouncilState): Promise<CouncilState> {
  const planner = new MasterPlannerAgent()
  return await planner.plan(state)
}

/**
 * Compliance node: 4 agents check in parallel
 */
async function checkCompliance(state: CouncilState): Promise<CouncilState> {
  return await runComplianceCheck(state)
}

/**
 * Routing node: Select appropriate agents
 */
async function routeToAgents(state: CouncilState): Promise<CouncilState> {
  const router = new RoutingAgent()
  return await router.route(state)
}

/**
 * Execution node: Run advisors or workforce
 */
async function executeTask(state: CouncilState): Promise<CouncilState> {
  console.log('[EXECUTION] Running selected agents...')

  const gateway = createGateway()

  try {
    // For now, execute a simple advisor consultation
    const response = await gateway.chat({
      messages: [
        { role: 'user', content: state.userRequest }
      ],
      metadata: {
        taskType: 'advisor',
        priority: state.metadata.priority as 'low' | 'medium' | 'high',
        policy: state.compliance?.containsPII ? 'high-security' : 'standard'
      }
    })

    return {
      ...state,
      execution: {
        results: [
          {
            agentId: 'advisor_1',
            agentName: 'Strategic Advisor',
            content: response.content,
            confidence: 0.85,
            cost: response.usage.totalCost,
            time: response.metadata.latency / 1000,
            model: response.model
          }
        ],
        status: 'completed',
        startTime: new Date(),
        endTime: new Date()
      },
      output: {
        content: response.content,
        confidence: 0.85,
        totalCost: response.usage.totalCost,
        totalTime: response.metadata.latency / 1000,
        model: response.model
      },
      currentStep: 'qa_review',
      updatedAt: new Date()
    }
  } catch (error) {
    return {
      ...state,
      errors: [
        ...state.errors,
        {
          step: 'execution',
          message: error instanceof Error ? error.message : 'Execution error',
          agentId: 'executor',
          timestamp: new Date(),
          severity: 'error'
        }
      ],
      currentStep: 'failed',
      updatedAt: new Date()
    }
  }
}

/**
 * QA Review node: Critique the output
 */
async function reviewQuality(state: CouncilState): Promise<CouncilState> {
  return await runQAReview(state)
}

/**
 * Human escalation check
 */
async function checkHumanEscalation(state: CouncilState): Promise<CouncilState> {
  const gateway = new HumanGatewayAgent()
  return gateway.checkEscalation(state)
}

/**
 * Completion node
 */
async function completeRequest(state: CouncilState): Promise<CouncilState> {
  console.log('[COUNCIL] Request completed:', state.requestId)

  return {
    ...state,
    currentStep: 'completed',
    updatedAt: new Date()
  }
}


// ============================================
// SEQUENTIAL WORKFLOW
// ============================================

/**
 * Execute the council workflow sequentially
 */
async function runWorkflow(initialState: CouncilState): Promise<CouncilState> {
  let state = initialState

  // Step 1: Receive
  state = await receiveRequest(state)

  // Step 2: Plan
  state = await planExecution(state)

  // Step 3: Compliance
  state = await checkCompliance(state)

  // Check compliance - if failed, go to human review
  if (!state.compliance?.passed) {
    state = await checkHumanEscalation(state)
    return state
  }

  // Step 4: Routing
  state = await routeToAgents(state)

  // Step 5: Execution with QA loop
  let iterations = 0
  const maxIterations = 3

  while (iterations < maxIterations) {
    state = await executeTask(state)
    state = await reviewQuality(state)

    if (!state.qa?.requiresRevision) {
      break
    }
    iterations++
  }

  // Step 6: Complete
  state = await completeRequest(state)

  return state
}

// ============================================
// MAIN ORCHESTRATOR
// ============================================

export class CouncilOrchestrator {
  /**
   * Process a user request through the council workflow
   */
  async process(request: {
    userRequest: string
    userId: string
    metadata?: {
      priority?: 'low' | 'medium' | 'high' | 'critical'
      maxCost?: number
      requiresHumanApproval?: boolean
    }
  }): Promise<CouncilState> {
    const initialState: CouncilState = {
      userRequest: request.userRequest,
      userId: request.userId,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        priority: request.metadata?.priority || 'medium',
        expectedResponseTime: 120,
        maxCost: request.metadata?.maxCost,
        requiresHumanApproval: request.metadata?.requiresHumanApproval || false
      },
      currentStep: 'received',
      iterationCount: 0,
      errors: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    console.log('\n========================================')
    console.log('COUNCIL ORCHESTRATION STARTED')
    console.log('========================================')
    console.log(`Request ID: ${initialState.requestId}`)
    console.log(`User Request: "${request.userRequest}"`)
    console.log(`Priority: ${initialState.metadata.priority}`)
    console.log('========================================\n')

    // Run through the sequential workflow
    const finalState = await runWorkflow(initialState)

    console.log('\n========================================')
    console.log('COUNCIL ORCHESTRATION COMPLETED')
    console.log('========================================')
    console.log(`Final Step: ${finalState.currentStep}`)
    console.log(`Total Cost: $${finalState.output?.totalCost?.toFixed(6) || 0}`)
    console.log(`Total Time: ${finalState.output?.totalTime?.toFixed(2) || 0}s`)
    console.log(`Compliance Passed: ${finalState.compliance?.passed}`)
    console.log(`QA Passed: ${finalState.qa?.passed}`)
    console.log('========================================\n')

    return finalState
  }
}
