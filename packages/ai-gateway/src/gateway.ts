/**
 * AI Gateway - Intelligent Multi-Provider Router
 *
 * Implements 4-tier routing strategy:
 * 1. Privacy Route: Sensitive data -> Ollama (self-hosted)
 * 2. Task Route: Specialized tasks -> Best-fit models
 * 3. Green Route: Sustainability-aware model selection (20% carbon reduction)
 * 4. Cost Route: General tasks -> Cost-optimized cascade
 */

import OpenAI from 'openai'
import { greenRouter } from './sustainability/green-route.js'
import { carbonTracker } from './sustainability/carbon-tracker.js'
import { semanticRouter } from './routing/semantic-router.js'

// ============================================
// TYPES
// ============================================

export interface GatewayMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface GatewayRequest {
  messages: GatewayMessage[]
  systemPrompt?: string
  metadata?: {
    policy?: 'high-security' | 'standard'
    taskType?: 'coding' | 'reasoning' | 'general' | 'advisor'
    priority?: 'high' | 'medium' | 'low' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
    maxCost?: number
    estimatedTokens?: number // For green routing carbon estimation
  }
  options?: {
    maxTokens?: number
    temperature?: number
    stream?: boolean
  }
}

export interface GatewayResponse {
  content: string
  model: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalCost: number
  }
  metadata: {
    route: 'privacy' | 'specialized' | 'green' | 'cost-optimized'
    provider: 'anthropic' | 'google' | 'ollama'
    latency: number
    sustainability?: {
      carbonEmitted: number // kg CO2e
      energyConsumed: number // kWh
      wasGreenRouted: boolean
      carbonSavings?: number // kg CO2e saved vs. default
    }
  }
}

export interface RoutingDecision {
  model: string
  route: 'privacy' | 'specialized' | 'green' | 'cost-optimized'
  provider: 'anthropic' | 'google' | 'ollama'
  reason: string
  sustainability?: {
    estimatedCarbon: number // kg CO2e
    estimatedSavings?: number // kg CO2e saved
    greenRouted: boolean
  }
}

// ============================================
// PII DETECTION
// ============================================

const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
}

const SENSITIVE_KEYWORDS = [
  'password', 'api key', 'secret', 'token', 'credential',
  'social security', 'ssn', 'bank account', 'routing number',
  'proprietary', 'confidential', 'internal only', 'classified',
  'salary', 'compensation', 'financial statement', 'revenue'
]

function containsPII(text: string): boolean {
  // Check for PII patterns
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    if (pattern.test(text)) {
      console.log(`[GATEWAY] PII detected: ${type}`)
      return true
    }
  }

  // Check for sensitive keywords
  const lowerText = text.toLowerCase()
  for (const keyword of SENSITIVE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      console.log(`[GATEWAY] Sensitive keyword detected: ${keyword}`)
      return true
    }
  }

  return false
}

// ============================================
// TASK TYPE DETECTION
// ============================================

const TASK_TYPE_INDICATORS: Record<string, string[]> = {
  coding: [
    'code', 'function', 'class', 'variable', 'debug', 'refactor',
    'implement', 'algorithm', 'typescript', 'javascript', 'python',
    'react', 'api', 'database', 'sql', 'error', 'bug', 'test'
  ],
  reasoning: [
    'analyze', 'compare', 'evaluate', 'strategy', 'decision', 'plan',
    'why', 'how', 'explain', 'reasoning', 'logic', 'think', 'consider',
    'pros and cons', 'trade-offs', 'implications'
  ],
  advisor: [
    'advice', 'counsel', 'recommend', 'suggest', 'guidance', 'should i',
    'what do you think', 'opinion', 'perspective', 'council', 'meeting'
  ]
}

function detectTaskType(text: string): 'coding' | 'reasoning' | 'advisor' | 'general' {
  const lowerText = text.toLowerCase()
  const scores: Record<string, number> = {
    coding: 0,
    reasoning: 0,
    advisor: 0
  }

  // Count keyword matches
  for (const [type, keywords] of Object.entries(TASK_TYPE_INDICATORS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        scores[type]++
      }
    }
  }

  // Return highest scoring type
  const maxScore = Math.max(...Object.values(scores))
  if (maxScore === 0) return 'general'

  const detectedType = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0]
  return (detectedType as 'coding' | 'reasoning' | 'advisor') || 'general'
}

// ============================================
// AI GATEWAY CLASS
// ============================================

export class AIGateway {
  private client: OpenAI

  constructor(config: { baseURL: string; apiKey: string }) {
    this.client = new OpenAI({
      baseURL: config.baseURL || 'http://localhost:4000',
      apiKey: config.apiKey || 'sk-1234', // LiteLLM master key
    })
  }

  /**
   * Route 1: Privacy & Security Check
   * If request contains PII or is marked high-security, route to Ollama
   */
  private checkPrivacyRoute(request: GatewayRequest): RoutingDecision | null {
    // Explicit high-security policy
    if (request.metadata?.policy === 'high-security') {
      return {
        model: 'privacy/general',
        route: 'privacy',
        provider: 'ollama',
        reason: 'Explicit high-security policy'
      }
    }

    // Check all messages for PII
    const allContent = request.messages.map(m => m.content).join(' ')

    if (containsPII(allContent)) {
      const taskType = detectTaskType(allContent)
      return {
        model: taskType === 'coding' ? 'privacy/coding' : 'privacy/general',
        route: 'privacy',
        provider: 'ollama',
        reason: 'PII or sensitive data detected'
      }
    }

    return null
  }

  /**
   * Route 2: Task-Type Specialized Routing
   * Route to best model for specific task types
   */
  private checkTaskRoute(request: GatewayRequest): RoutingDecision | null {
    // Explicit task type from metadata
    const taskType = request.metadata?.taskType ||
                     detectTaskType(request.messages[request.messages.length - 1]?.content || '')

    switch (taskType) {
      case 'coding':
        return {
          model: request.metadata?.priority === 'high' ? 'coding/expert' : 'coding/fast',
          route: 'specialized',
          provider: request.metadata?.priority === 'high' ? 'anthropic' : 'ollama',
          reason: `Coding task detected (priority: ${request.metadata?.priority || 'standard'})`
        }

      case 'reasoning':
        return {
          model: request.metadata?.priority === 'high' ? 'reasoning/complex' : 'reasoning/fast',
          route: 'specialized',
          provider: request.metadata?.priority === 'high' ? 'anthropic' : 'google',
          reason: `Complex reasoning task (priority: ${request.metadata?.priority || 'standard'})`
        }

      case 'advisor':
        return {
          model: 'advisor/consultation',
          route: 'specialized',
          provider: 'anthropic',
          reason: 'Advisor consultation'
        }

      default:
        return null
    }
  }

  /**
   * Route 3: Green Route - Sustainability-Aware Selection
   * Routes to energy-efficient models for eligible tasks
   */
  private async checkGreenRoute(request: GatewayRequest): Promise<RoutingDecision | null> {
    // Normalize priority to uppercase format expected by green router
    const priority = this.normalizePriority(request.metadata?.priority)

    // Skip if priority is critical (green routing only for LOW/MEDIUM/HIGH)
    if (priority === 'CRITICAL') {
      return null
    }

    // Determine task type for green routing
    const taskType = request.metadata?.taskType ||
                     detectTaskType(request.messages[request.messages.length - 1]?.content || '')

    // Estimate tokens if not provided
    const estimatedTokens = request.metadata?.estimatedTokens ||
                           this.estimateTokens(request)

    // Check if green routing is beneficial
    const greenDecision = await greenRouter.routeRequest({
      taskType,
      priority,
      estimatedTokens,
    })

    if (!greenDecision.useGreenRoute) {
      return null
    }

    // Map green route recommendation to LiteLLM model name
    const litellmModel = this.mapToLiteLLMModel(
      greenDecision.recommendedProvider,
      greenDecision.recommendedModel
    )

    return {
      model: litellmModel,
      route: 'green',
      provider: greenDecision.recommendedProvider as 'anthropic' | 'google' | 'ollama',
      reason: greenDecision.reason,
      sustainability: {
        estimatedCarbon: greenDecision.estimatedCarbon,
        estimatedSavings: greenDecision.estimatedSavings,
        greenRouted: true,
      }
    }
  }

  /**
   * Normalize priority to uppercase format
   */
  private normalizePriority(
    priority?: string
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (!priority) return 'MEDIUM'
    const upper = priority.toUpperCase()
    if (upper === 'LOW' || upper === 'MEDIUM' || upper === 'HIGH' || upper === 'CRITICAL') {
      return upper as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    }
    return 'MEDIUM'
  }

  /**
   * Estimate tokens for a request
   */
  private estimateTokens(request: GatewayRequest): number {
    // Simple estimation: ~4 characters per token
    const allContent = request.messages.map(m => m.content).join(' ')
    const systemContent = request.systemPrompt || ''
    const totalChars = allContent.length + systemContent.length
    return Math.ceil(totalChars / 4)
  }

  /**
   * Map provider and model to LiteLLM model name
   */
  private mapToLiteLLMModel(provider: string, model: string): string {
    // Map green route models to our existing LiteLLM model names
    const mapping: Record<string, string> = {
      'google:gemini-2.5-flash': 'general/fast',
      'google:gemini-2.5-pro': 'general/balanced',
      'anthropic:claude-sonnet-4-5': 'general/premium',
      'anthropic:claude-opus-4': 'reasoning/complex',
      'openai:gpt-4o-mini': 'general/fast',
      'openai:gpt-4o': 'general/premium',
    }

    const key = `${provider}:${model}`
    return mapping[key] || 'general/balanced'
  }

  /**
   * Route 4: Cost-Optimized Default Route
   * Cascade from cheap to expensive for general tasks
   */
  private getCostOptimizedRoute(request: GatewayRequest): RoutingDecision {
    const maxCost = request.metadata?.maxCost
    const priority = request.metadata?.priority

    // High priority or no cost constraint -> Premium
    if (priority === 'high' || !maxCost) {
      return {
        model: 'general/premium',
        route: 'cost-optimized',
        provider: 'anthropic',
        reason: 'High priority task'
      }
    }

    // Try cheap first
    if (maxCost < 0.001) {
      return {
        model: 'general/fast',
        route: 'cost-optimized',
        provider: 'ollama',
        reason: 'Ultra low-cost route (free)'
      }
    }

    // Balanced default
    return {
      model: 'general/balanced',
      route: 'cost-optimized',
      provider: 'google',
      reason: 'Cost-balanced route'
    }
  }

  /**
   * Main routing decision logic
   */
  async route(request: GatewayRequest): Promise<RoutingDecision> {
    console.log('[GATEWAY] Analyzing request for optimal route...')

    // Route 1: Privacy check (highest priority)
    const privacyRoute = this.checkPrivacyRoute(request)
    if (privacyRoute) {
      console.log(`[GATEWAY] Route: PRIVACY -> ${privacyRoute.model} (${privacyRoute.reason})`)
      return privacyRoute
    }

    // Route 2: Task-specific routing
    const taskRoute = this.checkTaskRoute(request)
    if (taskRoute) {
      console.log(`[GATEWAY] Route: SPECIALIZED -> ${taskRoute.model} (${taskRoute.reason})`)
      return taskRoute
    }

    // Route 3: Green route (sustainability-aware)
    const greenRoute = await this.checkGreenRoute(request)
    if (greenRoute) {
      console.log(`[GATEWAY] Route: GREEN -> ${greenRoute.model} (${greenRoute.reason})`)
      return greenRoute
    }

    // Route 4: Cost-optimized default
    const costRoute = this.getCostOptimizedRoute(request)
    console.log(`[GATEWAY] Route: COST-OPTIMIZED -> ${costRoute.model} (${costRoute.reason})`)
    return costRoute
  }

  /**
   * Send request through the gateway
   */
  async chat(request: GatewayRequest): Promise<GatewayResponse> {
    const startTime = Date.now()
    const taskId = `gw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Optional: Use semantic routing for enhanced intelligence
    let semanticDecision: Awaited<ReturnType<typeof semanticRouter.route>> | null = null
    if (request.metadata?.taskType) {
      const userQuery = request.messages[request.messages.length - 1]?.content || ''
      semanticDecision = await semanticRouter.route(userQuery, request.metadata)

      // If semantic routing has high confidence, consider its recommendation
      if (semanticDecision.confidence > 85) {
        console.log(
          `[GATEWAY] Semantic routing suggests: ${semanticDecision.route.modelProvider}/${semanticDecision.route.modelName} ` +
          `(${semanticDecision.confidence}% confidence)`
        )
      }
    }

    // Make routing decision
    const decision = await this.route(request)

    // Build messages array
    const messages: OpenAI.ChatCompletionMessageParam[] = []

    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt
      })
    }

    for (const msg of request.messages) {
      messages.push({
        role: msg.role === 'system' ? 'system' : msg.role,
        content: msg.content
      })
    }

    try {
      // Call LiteLLM with selected model
      const response = await this.client.chat.completions.create({
        model: decision.model,
        messages,
        max_tokens: request.options?.maxTokens || 4096,
        temperature: request.options?.temperature ?? 0.7,
        stream: request.options?.stream || false,
      })

      const endTime = Date.now()

      // Extract response
      const completion = response as OpenAI.ChatCompletion
      const content = completion.choices?.[0]?.message?.content || ''
      const usage = completion.usage

      // Track carbon emissions for this request
      const carbonMetrics = await this.trackCarbon(
        taskId,
        decision,
        usage?.prompt_tokens || 0,
        usage?.completion_tokens || 0,
        endTime - startTime
      )

      const gatewayResponse: GatewayResponse = {
        content,
        model: decision.model,
        usage: {
          inputTokens: usage?.prompt_tokens || 0,
          outputTokens: usage?.completion_tokens || 0,
          totalCost: this.calculateCost(decision.model, usage?.prompt_tokens || 0, usage?.completion_tokens || 0)
        },
        metadata: {
          route: decision.route,
          provider: decision.provider,
          latency: endTime - startTime,
          sustainability: carbonMetrics
        }
      }

      // Trigger self-reflection (async, don't wait)
      if (semanticDecision && semanticDecision.shouldReflect) {
        // Reflect after response is returned
        setImmediate(async () => {
          const success = content.length > 0 && !content.toLowerCase().includes('error')
          await semanticRouter.reflect(
            taskId,
            success,
            endTime - startTime
          ).catch(err => {
            console.error('[GATEWAY] Reflection failed:', err)
          })
        })
      }

      return gatewayResponse
    } catch (error) {
      console.error('[GATEWAY] Request failed:', error)
      throw error
    }
  }

  /**
   * Track carbon emissions for a request
   */
  private async trackCarbon(
    taskId: string,
    decision: RoutingDecision,
    inputTokens: number,
    outputTokens: number,
    duration: number
  ): Promise<{
    carbonEmitted: number
    energyConsumed: number
    wasGreenRouted: boolean
    carbonSavings?: number
  }> {
    // Map LiteLLM model to actual provider model
    const actualModel = this.mapLiteLLMToActualModel(decision.model, decision.provider)

    // Track with carbon tracker
    const metrics = await carbonTracker.trackTask(
      taskId,
      decision.provider,
      actualModel,
      inputTokens,
      outputTokens,
      duration
    )

    return {
      carbonEmitted: metrics.carbonEmitted,
      energyConsumed: metrics.energyConsumed,
      wasGreenRouted: decision.route === 'green',
      carbonSavings: decision.sustainability?.estimatedSavings
    }
  }

  /**
   * Map LiteLLM model name back to actual model
   */
  private mapLiteLLMToActualModel(litellmModel: string, provider: string): string {
    // Map our LiteLLM names to actual model names for carbon tracking
    const mapping: Record<string, Record<string, string>> = {
      'anthropic': {
        'general/premium': 'claude-sonnet-4-5',
        'reasoning/complex': 'claude-opus-4',
        'coding/expert': 'claude-sonnet-4-5',
        'advisor/consultation': 'claude-sonnet-4-5',
      },
      'google': {
        'general/balanced': 'gemini-2.5-pro',
        'general/fast': 'gemini-2.5-flash',
        'reasoning/fast': 'gemini-2.5-pro',
      },
      'ollama': {
        'general/fast': 'llama-3.1-70b',
        'coding/fast': 'deepseek-r1',
        'privacy/general': 'llama-3.1-70b',
        'privacy/coding': 'deepseek-r1',
      },
    }

    return mapping[provider]?.[litellmModel] || 'claude-sonnet-4-5'
  }

  /**
   * Calculate estimated cost based on model and tokens
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      'general/premium': { input: 3.00, output: 15.00 },
      'general/balanced': { input: 0.15, output: 0.60 },
      'general/fast': { input: 0, output: 0 },
      'coding/expert': { input: 3.00, output: 15.00 },
      'coding/fast': { input: 0, output: 0 },
      'reasoning/complex': { input: 15.00, output: 75.00 },
      'reasoning/fast': { input: 0.15, output: 0.60 },
      'advisor/council': { input: 15.00, output: 75.00 },
      'advisor/consultation': { input: 3.00, output: 15.00 },
      'privacy/general': { input: 0, output: 0 },
      'privacy/coding': { input: 0, output: 0 },
    }

    const prices = pricing[model] || { input: 0, output: 0 }
    const inputCost = (inputTokens / 1_000_000) * prices.input
    const outputCost = (outputTokens / 1_000_000) * prices.output

    return inputCost + outputCost
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createGateway(config?: { baseURL?: string; apiKey?: string }): AIGateway {
  return new AIGateway({
    baseURL: config?.baseURL || process.env.LITELLM_BASE_URL || 'http://localhost:4000',
    apiKey: config?.apiKey || process.env.LITELLM_MASTER_KEY || 'sk-1234'
  })
}
