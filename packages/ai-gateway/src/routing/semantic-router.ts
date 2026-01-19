/**
 * Enhanced Semantic Routing with Self-Reflection
 * Intelligent routing based on semantic understanding + learning from mistakes
 *
 * Key Features:
 * - Semantic similarity matching for task -> model routing
 * - Self-reflection after each request (learns from failures)
 * - Adaptive routing based on historical performance
 * - Confidence scoring and fallback strategies
 */

import { nanoid } from 'nanoid'

export interface SemanticRoute {
  id: string
  pattern: string
  description: string
  category: string
  modelProvider: string
  modelName: string
  temperature: number
  examples: string[]
  embedding?: number[] // Would use actual embeddings in production
  historicalPerformance: {
    successRate: number
    avgLatency: number
    avgCost: number
    totalRequests: number
  }
}

export interface RoutingDecision {
  route: SemanticRoute
  confidence: number // 0-100
  reasoning: string
  alternatives: SemanticRoute[]
  shouldReflect: boolean // Trigger self-reflection
}

export interface ReflectionResult {
  id: string
  requestId: string
  route: SemanticRoute
  actualSuccess: boolean
  expectedSuccess: boolean
  latency: number
  userFeedback?: 'positive' | 'negative' | 'neutral'
  learnings: string[]
  adjustments: Array<{
    parameter: string
    oldValue: unknown
    newValue: unknown
    reason: string
  }>
  timestamp: Date
}

/**
 * Semantic Router with Self-Reflection
 * Routes requests intelligently and learns from outcomes
 */
export class SemanticRouter {
  private routes: SemanticRoute[] = []
  private reflections: ReflectionResult[] = []
  private routingHistory: Map<string, RoutingDecision> = new Map()

  constructor() {
    this.initializeRoutes()
  }

  /**
   * Initialize semantic routes
   */
  private initializeRoutes(): void {
    this.routes = [
      // Code-related routes
      {
        id: 'code-generation',
        pattern: 'code generation',
        description: 'Generate code from natural language',
        category: 'coding',
        modelProvider: 'anthropic',
        modelName: 'claude-sonnet-4-5',
        temperature: 0.2,
        examples: [
          'write a function to',
          'implement a class for',
          'create a component that',
          'generate code for',
        ],
        historicalPerformance: {
          successRate: 92,
          avgLatency: 2500,
          avgCost: 0.015,
          totalRequests: 145,
        },
      },
      {
        id: 'code-review',
        pattern: 'code review',
        description: 'Review and improve existing code',
        category: 'coding',
        modelProvider: 'anthropic',
        modelName: 'claude-sonnet-4-5',
        temperature: 0.3,
        examples: [
          'review this code',
          'find bugs in',
          'improve this implementation',
          'what\'s wrong with',
        ],
        historicalPerformance: {
          successRate: 95,
          avgLatency: 3000,
          avgCost: 0.018,
          totalRequests: 89,
        },
      },
      {
        id: 'code-debug',
        pattern: 'debugging',
        description: 'Debug and fix code issues',
        category: 'coding',
        modelProvider: 'anthropic',
        modelName: 'claude-sonnet-4-5',
        temperature: 0.4,
        examples: [
          'why is this not working',
          'debug this error',
          'fix this bug',
          'help me understand why',
        ],
        historicalPerformance: {
          successRate: 88,
          avgLatency: 3500,
          avgCost: 0.022,
          totalRequests: 112,
        },
      },

      // Analysis routes
      {
        id: 'data-analysis',
        pattern: 'data analysis',
        description: 'Analyze data and extract insights',
        category: 'analysis',
        modelProvider: 'google',
        modelName: 'gemini-2.5-pro',
        temperature: 0.5,
        examples: [
          'analyze this data',
          'what insights can you find',
          'summarize these statistics',
          'interpret these results',
        ],
        historicalPerformance: {
          successRate: 90,
          avgLatency: 2200,
          avgCost: 0.012,
          totalRequests: 78,
        },
      },

      // Creative routes
      {
        id: 'content-creation',
        pattern: 'content creation',
        description: 'Create marketing, blog, or creative content',
        category: 'creative',
        modelProvider: 'google',
        modelName: 'gemini-2.5-flash',
        temperature: 0.9,
        examples: [
          'write a blog post about',
          'create marketing copy for',
          'generate ideas for',
          'brainstorm concepts',
        ],
        historicalPerformance: {
          successRate: 87,
          avgLatency: 1800,
          avgCost: 0.008,
          totalRequests: 156,
        },
      },

      // Complex reasoning
      {
        id: 'complex-reasoning',
        pattern: 'complex reasoning',
        description: 'Multi-step reasoning and problem solving',
        category: 'reasoning',
        modelProvider: 'anthropic',
        modelName: 'claude-opus-4',
        temperature: 0.6,
        examples: [
          'explain step by step',
          'analyze the trade-offs',
          'compare and contrast',
          'evaluate this approach',
        ],
        historicalPerformance: {
          successRate: 93,
          avgLatency: 4500,
          avgCost: 0.045,
          totalRequests: 67,
        },
      },

      // Quick Q&A
      {
        id: 'quick-qa',
        pattern: 'quick answer',
        description: 'Fast factual questions',
        category: 'general',
        modelProvider: 'google',
        modelName: 'gemini-2.5-flash',
        temperature: 0.3,
        examples: [
          'what is',
          'how do I',
          'when should',
          'define',
        ],
        historicalPerformance: {
          successRate: 91,
          avgLatency: 1200,
          avgCost: 0.005,
          totalRequests: 234,
        },
      },
    ]
  }

  /**
   * Route request semantically
   */
  async route(
    query: string,
    context?: Record<string, unknown>
  ): Promise<RoutingDecision> {
    console.log(`[SEMANTIC_ROUTER] Routing query: ${query.substring(0, 50)}...`)

    // Calculate semantic similarity for each route
    const scores = this.routes.map((route) => ({
      route,
      similarity: this.calculateSimilarity(query, route),
      performance: this.calculatePerformanceScore(route),
    }))

    // Combine similarity and performance for final score
    scores.forEach((score) => {
      score.similarity = score.similarity * 0.6 + score.performance * 0.4
    })

    // Sort by combined score
    scores.sort((a, b) => b.similarity - a.similarity)

    const bestMatch = scores[0]
    const alternatives = scores.slice(1, 4).map((s) => s.route)

    // Calculate confidence based on score gap
    const confidence = this.calculateConfidence(scores)

    const decision: RoutingDecision = {
      route: bestMatch.route,
      confidence,
      reasoning: this.generateReasoning(query, bestMatch.route, confidence),
      alternatives,
      shouldReflect: confidence < 80, // Low confidence triggers reflection
    }

    // Store decision for reflection
    const requestId = nanoid()
    this.routingHistory.set(requestId, decision)

    console.log(
      `[SEMANTIC_ROUTER] Selected: ${bestMatch.route.pattern} ` +
      `(confidence: ${confidence.toFixed(1)}%)`
    )

    return decision
  }

  /**
   * Calculate semantic similarity
   */
  private calculateSimilarity(query: string, route: SemanticRoute): number {
    const queryLower = query.toLowerCase()

    // Check exact pattern match
    if (queryLower.includes(route.pattern.toLowerCase())) {
      return 95
    }

    // Check examples
    let maxExampleMatch = 0
    for (const example of route.examples) {
      const exampleWords = example.toLowerCase().split(' ')
      const matches = exampleWords.filter((word) => queryLower.includes(word)).length
      const matchRatio = matches / exampleWords.length
      maxExampleMatch = Math.max(maxExampleMatch, matchRatio * 85)
    }

    if (maxExampleMatch > 0) {
      return maxExampleMatch
    }

    // Category-based similarity
    const categoryKeywords: Record<string, string[]> = {
      coding: ['code', 'function', 'class', 'implement', 'bug', 'error', 'typescript', 'javascript'],
      analysis: ['analyze', 'data', 'statistics', 'insights', 'trends', 'interpret'],
      creative: ['write', 'create', 'generate', 'brainstorm', 'ideas', 'content'],
      reasoning: ['explain', 'compare', 'evaluate', 'why', 'how', 'trade-off'],
      general: ['what', 'define', 'quick', 'simple'],
    }

    const keywords = categoryKeywords[route.category] || []
    const keywordMatches = keywords.filter((kw) => queryLower.includes(kw)).length

    return (keywordMatches / Math.max(keywords.length, 1)) * 70
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(route: SemanticRoute): number {
    const perf = route.historicalPerformance

    // Weight: success rate 60%, latency 20%, cost 20%
    const successScore = perf.successRate
    const latencyScore = Math.max(0, 100 - (perf.avgLatency / 50)) // Lower is better
    const costScore = Math.max(0, 100 - (perf.avgCost * 1000)) // Lower is better

    return successScore * 0.6 + latencyScore * 0.2 + costScore * 0.2
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(
    scores: Array<{ route: SemanticRoute; similarity: number; performance: number }>
  ): number {
    if (scores.length === 0) return 50

    const bestScore = scores[0].similarity
    const secondBestScore = scores.length > 1 ? scores[1].similarity : 0

    // High confidence if clear winner
    const gap = bestScore - secondBestScore

    if (gap > 30) return 95
    if (gap > 20) return 85
    if (gap > 10) return 75
    if (gap > 5) return 65

    return 55 // Low confidence
  }

  /**
   * Generate reasoning
   */
  private generateReasoning(
    query: string,
    route: SemanticRoute,
    confidence: number
  ): string {
    const parts = [
      `Selected "${route.pattern}" route`,
      `based on semantic match (${confidence.toFixed(1)}% confidence)`,
    ]

    if (route.historicalPerformance.successRate >= 90) {
      parts.push(`with excellent historical success rate (${route.historicalPerformance.successRate}%)`)
    }

    if (confidence < 70) {
      parts.push('- low confidence, will trigger self-reflection')
    }

    return parts.join(' ')
  }

  /**
   * Reflect on routing decision after execution
   */
  async reflect(
    requestId: string,
    actualSuccess: boolean,
    latency: number,
    userFeedback?: 'positive' | 'negative' | 'neutral'
  ): Promise<ReflectionResult> {
    const decision = this.routingHistory.get(requestId)
    if (!decision) {
      throw new Error(`No routing decision found for request: ${requestId}`)
    }

    console.log(`[SEMANTIC_ROUTER] Reflecting on request: ${requestId}`)

    const expectedSuccess = decision.route.historicalPerformance.successRate >= 80

    const learnings: string[] = []
    const adjustments: Array<{
      parameter: string
      oldValue: unknown
      newValue: unknown
      reason: string
    }> = []

    // Learning 1: Success/failure mismatch
    if (actualSuccess !== expectedSuccess) {
      if (!actualSuccess) {
        learnings.push(`Route underperformed: expected success but failed`)
        learnings.push(`May need to adjust route pattern or switch to alternative model`)

        // Decrease success rate
        const oldSuccessRate = decision.route.historicalPerformance.successRate
        const newSuccessRate = oldSuccessRate * 0.95
        adjustments.push({
          parameter: 'successRate',
          oldValue: oldSuccessRate,
          newValue: newSuccessRate,
          reason: 'Actual failure reduces confidence in this route',
        })
        decision.route.historicalPerformance.successRate = newSuccessRate
      } else {
        learnings.push(`Route exceeded expectations: succeeded despite low confidence`)

        // Increase success rate
        const oldSuccessRate = decision.route.historicalPerformance.successRate
        const newSuccessRate = Math.min(100, oldSuccessRate * 1.05)
        adjustments.push({
          parameter: 'successRate',
          oldValue: oldSuccessRate,
          newValue: newSuccessRate,
          reason: 'Unexpected success increases confidence',
        })
        decision.route.historicalPerformance.successRate = newSuccessRate
      }
    }

    // Learning 2: Latency variance
    const expectedLatency = decision.route.historicalPerformance.avgLatency
    const latencyDiff = Math.abs(latency - expectedLatency) / expectedLatency

    if (latencyDiff > 0.5) {
      learnings.push(`Significant latency variance: ${latency}ms vs expected ${expectedLatency}ms`)

      // Update average latency (moving average)
      const oldLatency = decision.route.historicalPerformance.avgLatency
      const newLatency = oldLatency * 0.9 + latency * 0.1
      adjustments.push({
        parameter: 'avgLatency',
        oldValue: oldLatency,
        newValue: newLatency,
        reason: 'Update latency expectation based on actual performance',
      })
      decision.route.historicalPerformance.avgLatency = newLatency
    }

    // Learning 3: User feedback
    if (userFeedback === 'negative') {
      learnings.push('User provided negative feedback - route may not be optimal for this query type')

      // Penalize success rate
      const oldSuccessRate = decision.route.historicalPerformance.successRate
      const newSuccessRate = oldSuccessRate * 0.9
      adjustments.push({
        parameter: 'successRate',
        oldValue: oldSuccessRate,
        newValue: newSuccessRate,
        reason: 'Negative user feedback reduces route confidence',
      })
      decision.route.historicalPerformance.successRate = newSuccessRate
    } else if (userFeedback === 'positive') {
      learnings.push('User provided positive feedback - route is well-suited for this query type')

      // Boost success rate
      const oldSuccessRate = decision.route.historicalPerformance.successRate
      const newSuccessRate = Math.min(100, oldSuccessRate * 1.03)
      adjustments.push({
        parameter: 'successRate',
        oldValue: oldSuccessRate,
        newValue: newSuccessRate,
        reason: 'Positive user feedback increases route confidence',
      })
      decision.route.historicalPerformance.successRate = newSuccessRate
    }

    // Update request count
    decision.route.historicalPerformance.totalRequests++

    const reflection: ReflectionResult = {
      id: nanoid(),
      requestId,
      route: decision.route,
      actualSuccess,
      expectedSuccess,
      latency,
      userFeedback,
      learnings,
      adjustments,
      timestamp: new Date(),
    }

    this.reflections.push(reflection)

    console.log(
      `[SEMANTIC_ROUTER] Reflection complete: ${learnings.length} learnings, ` +
      `${adjustments.length} adjustments`
    )

    return reflection
  }

  /**
   * Get routing statistics
   */
  async getStatistics(): Promise<{
    totalRoutes: number
    totalRoutingDecisions: number
    totalReflections: number
    avgConfidence: number
    topRoutes: Array<{ route: string; requests: number; successRate: number }>
  }> {
    const decisions = Array.from(this.routingHistory.values())

    const avgConfidence = decisions.length > 0
      ? decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length
      : 0

    const topRoutes = this.routes
      .sort((a, b) => b.historicalPerformance.totalRequests - a.historicalPerformance.totalRequests)
      .slice(0, 5)
      .map((r) => ({
        route: r.pattern,
        requests: r.historicalPerformance.totalRequests,
        successRate: r.historicalPerformance.successRate,
      }))

    return {
      totalRoutes: this.routes.length,
      totalRoutingDecisions: decisions.length,
      totalReflections: this.reflections.length,
      avgConfidence,
      topRoutes,
    }
  }

  /**
   * Get recent reflections
   */
  getRecentReflections(limit: number = 10): ReflectionResult[] {
    return this.reflections
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Get route by ID
   */
  getRoute(routeId: string): SemanticRoute | null {
    return this.routes.find((r) => r.id === routeId) || null
  }

  /**
   * Add custom route
   */
  addRoute(route: Omit<SemanticRoute, 'id' | 'historicalPerformance'>): SemanticRoute {
    const newRoute: SemanticRoute = {
      ...route,
      id: nanoid(),
      historicalPerformance: {
        successRate: 75, // Default moderate success rate
        avgLatency: 2000,
        avgCost: 0.01,
        totalRequests: 0,
      },
    }

    this.routes.push(newRoute)
    console.log(`[SEMANTIC_ROUTER] Added route: ${newRoute.pattern}`)

    return newRoute
  }
}

// Export singleton
export const semanticRouter = new SemanticRouter()
