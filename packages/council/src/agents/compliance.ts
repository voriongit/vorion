/**
 * Compliance & Ethics Agents (4 agents)
 *
 * Ensures all requests and responses comply with:
 * - Privacy regulations (PII detection)
 * - Ethical guidelines
 * - Company policies
 * - Legal requirements
 */

import { createGateway } from '@vorion/ai-gateway'
import type { CouncilState, ComplianceIssue } from '../types/index.js'

const COMPLIANCE_SYSTEM_PROMPT = `You are a Compliance & Ethics Officer for the Vorion AI Governance Platform.

YOUR MISSION:
Protect user privacy, ensure ethical AI use, and enforce company policies.

WHAT YOU CHECK FOR:
1. **PII (Personally Identifiable Information)**:
   - Names, emails, phone numbers, addresses
   - SSN, credit cards, bank accounts
   - IP addresses, device IDs
   - Medical records, financial data

2. **Sensitive Business Data**:
   - Proprietary information
   - Trade secrets
   - Internal financial data
   - Customer confidential data
   - API keys, passwords, credentials

3. **Ethical Concerns**:
   - Bias or discrimination
   - Harmful content
   - Misinformation
   - Manipulative practices

4. **Policy Violations**:
   - Unauthorized data sharing
   - Improper use of AI
   - Regulatory non-compliance

RESPONSE FORMAT:
{
  "passed": true/false,
  "issues": [
    {
      "severity": "low" | "medium" | "high" | "critical",
      "type": "pii" | "sensitive_data" | "policy_violation" | "ethical_concern",
      "description": "Detailed description of the issue",
      "suggestedAction": "How to resolve or mitigate"
    }
  ],
  "containsPII": true/false,
  "sensitivityLevel": "public" | "internal" | "confidential" | "restricted",
  "recommendations": "Overall recommendations for safe processing"
}

IMPORTANT:
- Be thorough but pragmatic
- Classify sensitivity levels accurately
- If PII is detected, recommend routing to self-hosted models
- Critical issues should stop the workflow
- Provide clear, actionable recommendations
`

export class ComplianceAgent {
  private gateway = createGateway()
  private agentId: string

  constructor(agentId: string = 'compliance_1') {
    this.agentId = agentId
  }

  /**
   * Check request and planned execution for compliance issues
   */
  async check(state: CouncilState): Promise<CouncilState> {
    console.log(`[${this.agentId.toUpperCase()}] Checking compliance...`)

    try {
      // Analyze both the user request and the plan
      const analysisContent = `
USER REQUEST:
"${state.userRequest}"

EXECUTION PLAN:
${state.plan?.steps.map((s, i) => `${i + 1}. ${s.description} (${s.assignTo})`).join('\n')}

Please analyze for compliance and ethics issues.
      `.trim()

      const response = await this.gateway.chat({
        messages: [{ role: 'user', content: analysisContent }],
        systemPrompt: COMPLIANCE_SYSTEM_PROMPT,
        metadata: {
          taskType: 'reasoning',
          priority: 'high',
          // Force privacy route since we're analyzing potentially sensitive content
          policy: 'high-security'
        },
        options: {
          maxTokens: 1024,
          temperature: 0.2 // Low temperature for consistent compliance checks
        }
      })

      // Parse compliance result
      const result = this.parseComplianceResult(response.content)

      // Update or initialize compliance state
      const existingChecks = state.compliance?.checkedBy || []

      return {
        ...state,
        compliance: {
          passed: result.passed && (state.compliance?.passed ?? true),
          issues: [...(state.compliance?.issues || []), ...result.issues],
          containsPII: result.containsPII || (state.compliance?.containsPII ?? false),
          sensitivityLevel: this.getHighestSensitivity(
            result.sensitivityLevel,
            state.compliance?.sensitivityLevel
          ),
          checkedBy: [...existingChecks, this.agentId]
        },
        currentStep: result.passed ? state.currentStep : 'human_review',
        updatedAt: new Date()
      }
    } catch (error) {
      console.error(`[${this.agentId.toUpperCase()}] Error:`, error)

      return {
        ...state,
        errors: [
          ...state.errors,
          {
            step: 'compliance_check',
            message: error instanceof Error ? error.message : 'Compliance check error',
            agentId: this.agentId,
            timestamp: new Date(),
            severity: 'error'
          }
        ],
        updatedAt: new Date()
      }
    }
  }

  private parseComplianceResult(content: string): {
    passed: boolean
    issues: ComplianceIssue[]
    containsPII: boolean
    sensitivityLevel: 'public' | 'internal' | 'confidential' | 'restricted'
  } {
    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : content
      const parsed = JSON.parse(jsonStr)

      return {
        passed: parsed.passed ?? true,
        issues: parsed.issues?.map((issue: Record<string, unknown>) => ({
          severity: issue.severity as ComplianceIssue['severity'],
          type: issue.type as ComplianceIssue['type'],
          description: issue.description as string,
          detectedBy: this.agentId,
          suggestedAction: issue.suggestedAction as string
        })) || [],
        containsPII: parsed.containsPII ?? false,
        sensitivityLevel: parsed.sensitivityLevel || 'public'
      }
    } catch {
      // Fallback: assume passed if we can't parse
      console.warn(`[${this.agentId}] Could not parse compliance result, assuming passed`)
      return {
        passed: true,
        issues: [],
        containsPII: false,
        sensitivityLevel: 'public'
      }
    }
  }

  private getHighestSensitivity(
    level1?: string,
    level2?: string
  ): 'public' | 'internal' | 'confidential' | 'restricted' {
    const hierarchy = ['public', 'internal', 'confidential', 'restricted']
    const index1 = level1 ? hierarchy.indexOf(level1) : 0
    const index2 = level2 ? hierarchy.indexOf(level2) : 0
    return hierarchy[Math.max(index1, index2)] as 'public' | 'internal' | 'confidential' | 'restricted'
  }

  static getConfig(agentNumber: number) {
    return {
      id: `compliance_${agentNumber}`,
      name: `Compliance Officer ${agentNumber}`,
      role: 'compliance_ethics' as const,
      description: 'Ensures privacy, ethics, and policy compliance',
      capabilities: [
        'PII detection',
        'Sensitive data identification',
        'Ethical review',
        'Policy enforcement',
        'Risk assessment'
      ],
      model: 'privacy/general', // Use self-hosted for compliance checks
      systemPrompt: COMPLIANCE_SYSTEM_PROMPT
    }
  }
}

/**
 * Run all 4 compliance agents in parallel for thorough checking
 */
export async function runComplianceCheck(state: CouncilState): Promise<CouncilState> {
  console.log('[COMPLIANCE TEAM] Running parallel compliance checks...')

  // Create 4 compliance agents
  const agents = [
    new ComplianceAgent('compliance_1'),
    new ComplianceAgent('compliance_2'),
    new ComplianceAgent('compliance_3'),
    new ComplianceAgent('compliance_4')
  ]

  // Run all checks in parallel
  const results = await Promise.all(
    agents.map(agent => agent.check(state))
  )

  // Combine results (most restrictive wins)
  const finalState = results.reduce((combined, result) => {
    return {
      ...combined,
      compliance: {
        passed: (combined.compliance?.passed ?? true) && (result.compliance?.passed ?? true),
        issues: [...(combined.compliance?.issues || []), ...(result.compliance?.issues || [])],
        containsPII: (combined.compliance?.containsPII ?? false) || (result.compliance?.containsPII ?? false),
        sensitivityLevel: combined.compliance?.sensitivityLevel === 'restricted' || result.compliance?.sensitivityLevel === 'restricted'
          ? 'restricted'
          : combined.compliance?.sensitivityLevel === 'confidential' || result.compliance?.sensitivityLevel === 'confidential'
          ? 'confidential'
          : combined.compliance?.sensitivityLevel === 'internal' || result.compliance?.sensitivityLevel === 'internal'
          ? 'internal'
          : 'public',
        checkedBy: [...new Set([...(combined.compliance?.checkedBy || []), ...(result.compliance?.checkedBy || [])])]
      },
      errors: [...combined.errors, ...result.errors]
    }
  }, state)

  console.log(`[COMPLIANCE TEAM] Check complete. Passed: ${finalState.compliance?.passed}, Issues: ${finalState.compliance?.issues.length}`)

  return {
    ...finalState,
    currentStep: finalState.compliance?.passed ? 'routing' : 'human_review',
    updatedAt: new Date()
  }
}
