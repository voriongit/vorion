/**
 * Routing & Dispatch Agents (2 agents)
 * Select appropriate advisors or workforce teams for execution
 *
 * NOTE: This is a simplified implementation. In production, this would include:
 * - ML-based agent selection
 * - Agent availability checking
 * - Cost-aware selection
 * - Load balancing
 */

import { createGateway } from '@vorion/ai-gateway'
import type { CouncilState, SelectedAgent } from '../types/index.js'

export class RoutingAgent {
  private gateway = createGateway()

  async route(state: CouncilState): Promise<CouncilState> {
    console.log('[ROUTING] Selecting agents for execution...')

    const selectedAgents: SelectedAgent[] = []

    // Simple routing based on plan
    for (const step of state.plan?.steps || []) {
      if (step.assignTo === 'advisor') {
        selectedAgents.push({
          agentId: 'advisor_general',
          agentType: 'advisor',
          agentName: 'Advisory Council',
          role: 'Strategic Advisor',
          reason: `Step requires strategic advice: ${step.description}`
        })
      } else if (step.assignTo === 'workforce') {
        selectedAgents.push({
          agentId: 'workforce_general',
          agentType: 'team',
          agentName: 'General Workforce',
          role: 'Task Executor',
          reason: `Step requires execution: ${step.description}`
        })
      }
    }

    return {
      ...state,
      routing: {
        selectedAgents,
        rationale: 'Agents selected based on task requirements',
        routedBy: 'routing_1'
      },
      currentStep: 'execution',
      updatedAt: new Date()
    }
  }

  static getConfig() {
    return {
      id: 'routing_1',
      name: 'Routing Agent',
      role: 'routing_dispatch' as const,
      description: 'Selects appropriate agents for task execution',
      capabilities: [
        'Agent selection',
        'Load balancing',
        'Cost optimization',
        'Availability checking'
      ],
      model: 'general/fast',
      systemPrompt: 'Select the best available agents for task execution.'
    }
  }
}
