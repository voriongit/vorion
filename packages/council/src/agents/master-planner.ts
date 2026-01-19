/**
 * Master Planner Agent
 *
 * Receives user requests and decomposes them into executable task plans.
 * Uses hierarchical task decomposition pattern.
 */

import { createGateway, type GatewayMessage } from '@vorion/ai-gateway'
import type { CouncilState, TaskStep } from '../types/index.js'

const SYSTEM_PROMPT = `You are the Master Planner, the chief orchestrator of the Vorion AI Governance Platform's agent workforce.

YOUR ROLE:
- Receive high-level user requests
- Analyze complexity and requirements
- Decompose requests into executable task steps
- Estimate costs and time for each step
- Determine which agents should handle each step

AVAILABLE RESOURCES:
1. **Advisors** - Strategic counsel
   - Use for: Strategic advice, business decisions, mentorship
   - Cost: Medium-High ($3-15 per 1M tokens)

2. **Workforce Agents** - Operational execution
   - Product & Design Team
   - Engineering Team
   - Marketing Team
   - Sales Team
   - Customer Success Team
   - Quality & Operations
   - Use for: Building features, creating content, analysis, operations
   - Cost: Low-Medium ($0-3 per 1M tokens)

PLANNING GUIDELINES:
1. **Simple requests** (1-2 steps):
   - Single advisor consultation
   - Single team task
   - Example: "Give me advice on hiring" → Advisor consultation

2. **Moderate requests** (3-5 steps):
   - Multiple advisors or teams
   - Sequential workflow
   - Example: "Create a marketing plan" → Strategy (Advisor) → Execution (Marketing Team)

3. **Complex requests** (6+ steps):
   - Cross-functional coordination
   - Multiple phases
   - Example: "Build and launch a product" → Planning → Design → Development → Marketing → Launch

OUTPUT FORMAT:
Respond with a JSON object:
{
  "complexity": "simple" | "moderate" | "complex",
  "steps": [
    {
      "id": "step_1",
      "description": "Clear description of what needs to be done",
      "assignTo": "advisor" | "workforce" | "council",
      "specificAgent": "Name of specific advisor or team (if known)",
      "estimatedCost": 0.05,  // USD estimate
      "estimatedTime": 300,   // seconds estimate
      "dependencies": []      // IDs of steps that must complete first
    }
  ],
  "totalEstimatedCost": 0.15,
  "totalEstimatedTime": 900,
  "rationale": "Brief explanation of your planning decisions"
}

IMPORTANT:
- Be realistic with time and cost estimates
- Consider dependencies between steps
- Prefer existing workforce over advisors for execution tasks
- Use advisors for strategic input, not tactical work
- Always include rationale for your decisions
`

export class MasterPlannerAgent {
  private gateway = createGateway()

  /**
   * Analyze a user request and create an execution plan
   */
  async plan(state: CouncilState): Promise<CouncilState> {
    console.log('[MASTER PLANNER] Analyzing request:', state.userRequest)

    try {
      const messages: GatewayMessage[] = [
        {
          role: 'user',
          content: `User Request: "${state.userRequest}"

Priority: ${state.metadata.priority}
Max Cost: $${state.metadata.maxCost || 'unlimited'}

Please analyze this request and create a detailed execution plan.`
        }
      ]

      // Use high-quality model for planning
      const response = await this.gateway.chat({
        messages,
        systemPrompt: SYSTEM_PROMPT,
        metadata: {
          taskType: 'reasoning',
          priority: 'high' // Planning is critical
        },
        options: {
          maxTokens: 2048,
          temperature: 0.3 // Lower temperature for consistent planning
        }
      })

      // Parse the plan
      const plan = this.parsePlan(response.content)

      // Update state
      return {
        ...state,
        plan: {
          steps: plan.steps,
          estimatedCost: plan.totalEstimatedCost,
          estimatedTime: plan.totalEstimatedTime,
          complexity: plan.complexity,
          createdBy: 'master_planner'
        },
        currentStep: 'compliance_check',
        updatedAt: new Date()
      }
    } catch (error) {
      console.error('[MASTER PLANNER] Error:', error)

      return {
        ...state,
        errors: [
          ...state.errors,
          {
            step: 'planning',
            message: error instanceof Error ? error.message : 'Unknown planning error',
            agentId: 'master_planner',
            timestamp: new Date(),
            severity: 'critical'
          }
        ],
        currentStep: 'failed',
        updatedAt: new Date()
      }
    }
  }

  /**
   * Parse the plan from LLM response
   * Handles both JSON and text responses
   */
  private parsePlan(content: string): {
    complexity: 'simple' | 'moderate' | 'complex'
    steps: TaskStep[]
    totalEstimatedCost: number
    totalEstimatedTime: number
    rationale?: string
  } {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : content

      const parsed = JSON.parse(jsonStr)

      // Ensure all steps have required fields
      const steps: TaskStep[] = parsed.steps.map((step: Record<string, unknown>, index: number) => ({
        id: (step.id as string) || `step_${index + 1}`,
        description: step.description as string,
        assignTo: step.assignTo as 'advisor' | 'workforce' | 'council',
        estimatedCost: (step.estimatedCost as number) || 0.01,
        estimatedTime: (step.estimatedTime as number) || 60,
        dependencies: (step.dependencies as string[]) || [],
        status: 'pending' as const
      }))

      return {
        complexity: parsed.complexity || 'moderate',
        steps,
        totalEstimatedCost: parsed.totalEstimatedCost || steps.reduce((sum, s) => sum + s.estimatedCost, 0),
        totalEstimatedTime: parsed.totalEstimatedTime || steps.reduce((sum, s) => sum + s.estimatedTime, 0),
        rationale: parsed.rationale
      }
    } catch {
      // Fallback: create a simple single-step plan
      console.warn('[MASTER PLANNER] Could not parse plan, creating fallback')

      return {
        complexity: 'simple',
        steps: [
          {
            id: 'step_1',
            description: 'Process user request',
            assignTo: 'advisor',
            estimatedCost: 0.05,
            estimatedTime: 120,
            dependencies: [],
            status: 'pending'
          }
        ],
        totalEstimatedCost: 0.05,
        totalEstimatedTime: 120,
        rationale: 'Fallback plan due to parsing error'
      }
    }
  }

  /**
   * Get agent configuration
   */
  static getConfig() {
    return {
      id: 'master_planner',
      name: 'Master Planner',
      role: 'master_planner' as const,
      description: 'Analyzes requests and creates hierarchical execution plans',
      capabilities: [
        'Task decomposition',
        'Resource allocation',
        'Cost estimation',
        'Dependency analysis',
        'Complexity assessment'
      ],
      model: 'reasoning/complex',
      systemPrompt: SYSTEM_PROMPT
    }
  }
}
