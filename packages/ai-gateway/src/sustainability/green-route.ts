/**
 * Green Route - Sustainability-Aware Model Selection
 * Prioritizes energy-efficient models for cost and carbon reduction
 * Implements 2025 best practices for carbon-aware computing
 */

import { carbonTracker } from './carbon-tracker.js'

export interface GreenRoutingPolicy {
  enabled: boolean
  minPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' // Only route tasks at or below this priority
  carbonBudget?: number // kg CO2e per day
  offPeakOnly: boolean // Only use green routing during off-peak hours
  trackSavings: boolean
}

export interface GreenRouteDecision {
  useGreenRoute: boolean
  recommendedModel: string
  recommendedProvider: string
  reason: string
  estimatedCarbon: number // kg CO2e
  estimatedSavings?: number // kg CO2e saved vs. default
}

/**
 * Green Router
 * Makes sustainability-aware routing decisions
 */
export class GreenRouter {
  private policy: GreenRoutingPolicy = {
    enabled: true,
    minPriority: 'MEDIUM', // Route LOW and MEDIUM priority tasks through green models
    offPeakOnly: false,
    trackSavings: true,
  }

  /**
   * Update routing policy
   */
  setPolicy(policy: Partial<GreenRoutingPolicy>): void {
    this.policy = { ...this.policy, ...policy }
    console.log('[GREEN_ROUTE] Policy updated:', this.policy)
  }

  /**
   * Get current policy
   */
  getPolicy(): GreenRoutingPolicy {
    return { ...this.policy }
  }

  /**
   * Make green routing decision
   */
  async routeRequest(request: {
    taskType: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    estimatedTokens: number
    requiredCapabilities?: string[]
  }): Promise<GreenRouteDecision> {
    // Check if green routing is enabled
    if (!this.policy.enabled) {
      return this.getDefaultRoute(request)
    }

    // Check if task priority is eligible
    if (!this.isPriorityEligible(request.priority)) {
      return this.getDefaultRoute(request)
    }

    // Check if we're in off-peak hours (if required)
    if (this.policy.offPeakOnly) {
      const isOffPeak = await carbonTracker.isLowEmissionPeriod()
      if (!isOffPeak) {
        return {
          useGreenRoute: false,
          ...await this.getStandardModel(request),
          reason: 'Off-peak only policy, currently peak hours',
        }
      }
    }

    // Get green recommendation
    const recommendation = await carbonTracker.getGreenRecommendation(
      request.taskType,
      request.priority
    )

    // Calculate estimated carbon
    const estimatedCarbon = await this.estimateCarbon(
      recommendation.provider,
      recommendation.model,
      request.estimatedTokens
    )

    // Calculate savings vs. default
    const defaultModel = this.getDefaultModelForPriority(request.priority)
    const defaultCarbon = await this.estimateCarbon(
      defaultModel.provider,
      defaultModel.model,
      request.estimatedTokens
    )

    const savings = defaultCarbon - estimatedCarbon
    const savingsPercent = (savings / defaultCarbon) * 100

    return {
      useGreenRoute: true,
      recommendedModel: recommendation.model,
      recommendedProvider: recommendation.provider,
      reason: `${recommendation.reason} (${savingsPercent.toFixed(1)}% carbon reduction)`,
      estimatedCarbon,
      estimatedSavings: savings,
    }
  }

  /**
   * Check if priority is eligible for green routing
   */
  private isPriorityEligible(priority: string): boolean {
    const priorityOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    const taskPriorityIndex = priorityOrder.indexOf(priority)
    const policyPriorityIndex = priorityOrder.indexOf(this.policy.minPriority)

    return taskPriorityIndex <= policyPriorityIndex
  }

  /**
   * Get default route (no green optimization)
   */
  private async getDefaultRoute(request: {
    priority: string
    estimatedTokens: number
  }): Promise<GreenRouteDecision> {
    const defaultModel = this.getDefaultModelForPriority(
      request.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    )

    const estimatedCarbon = await this.estimateCarbon(
      defaultModel.provider,
      defaultModel.model,
      request.estimatedTokens
    )

    return {
      useGreenRoute: false,
      recommendedModel: defaultModel.model,
      recommendedProvider: defaultModel.provider,
      reason: 'Default routing (green route not applicable)',
      estimatedCarbon,
    }
  }

  /**
   * Get standard model for comparison
   */
  private async getStandardModel(request: {
    priority: string
    estimatedTokens: number
  }): Promise<{
    recommendedModel: string
    recommendedProvider: string
    estimatedCarbon: number
  }> {
    const model = this.getDefaultModelForPriority(
      request.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    )
    const estimatedCarbon = await this.estimateCarbon(
      model.provider,
      model.model,
      request.estimatedTokens
    )

    return {
      recommendedModel: model.model,
      recommendedProvider: model.provider,
      estimatedCarbon,
    }
  }

  /**
   * Get default model for priority level
   */
  private getDefaultModelForPriority(
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ): { provider: string; model: string } {
    switch (priority) {
      case 'LOW':
        return { provider: 'google', model: 'gemini-2.5-flash' }
      case 'MEDIUM':
        return { provider: 'google', model: 'gemini-2.5-pro' }
      case 'HIGH':
        return { provider: 'anthropic', model: 'claude-sonnet-4-5' }
      case 'CRITICAL':
        return { provider: 'anthropic', model: 'claude-opus-4' }
    }
  }

  /**
   * Estimate carbon for a request
   */
  private async estimateCarbon(
    provider: string,
    model: string,
    tokens: number
  ): Promise<number> {
    // Would use carbon tracker's calculation
    const metrics = await carbonTracker.trackTask(
      'estimate',
      provider,
      model,
      tokens * 0.7, // Assume 70% input tokens
      tokens * 0.3, // Assume 30% output tokens
      0
    )

    return metrics.carbonEmitted
  }

  /**
   * Get green routing statistics
   */
  async getStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRequests: number
    greenRoutedRequests: number
    greenRoutedPercent: number
    totalCarbonSaved: number // kg CO2e
    totalEnergySaved: number // kWh
  }> {
    // Would query from database in production
    // For now, return mock data
    return {
      totalRequests: 1250,
      greenRoutedRequests: 568,
      greenRoutedPercent: 45.4,
      totalCarbonSaved: 1.85, // kg CO2e
      totalEnergySaved: 4.8, // kWh
    }
  }

  /**
   * Get carbon budget status
   */
  async getCarbonBudgetStatus(): Promise<{
    budget?: number
    used: number
    remaining?: number
    percentUsed?: number
  }> {
    if (!this.policy.carbonBudget) {
      return {
        used: 0,
        budget: undefined,
        remaining: undefined,
        percentUsed: undefined,
      }
    }

    // Would track actual usage in production
    const used = 0.45 // kg CO2e today
    const remaining = this.policy.carbonBudget - used
    const percentUsed = (used / this.policy.carbonBudget) * 100

    return {
      budget: this.policy.carbonBudget,
      used,
      remaining,
      percentUsed,
    }
  }

  /**
   * Get recommendation for sustainability improvements
   */
  async getRecommendations(): Promise<
    Array<{
      title: string
      description: string
      potentialSavings: number // kg CO2e per day
      implementation: string
    }>
  > {
    const stats = await this.getStatistics(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date()
    )

    const recommendations = []

    // Recommendation 1: Increase green routing coverage
    if (stats.greenRoutedPercent < 50) {
      recommendations.push({
        title: 'Increase Green Routing Coverage',
        description: `Currently only ${stats.greenRoutedPercent.toFixed(1)}% of tasks use green routing`,
        potentialSavings: 0.5,
        implementation: 'Set minPriority to HIGH to route more tasks through green models',
      })
    }

    // Recommendation 2: Enable off-peak scheduling
    if (!this.policy.offPeakOnly) {
      recommendations.push({
        title: 'Enable Off-Peak Scheduling',
        description: 'Schedule non-urgent tasks during off-peak hours (10pm-6am)',
        potentialSavings: 0.3,
        implementation: 'Enable offPeakOnly policy and implement task queuing',
      })
    }

    // Recommendation 3: Use local models for sensitive data
    recommendations.push({
      title: 'Expand Local Model Usage',
      description: 'Use self-hosted Ollama models for more tasks to reduce data center emissions',
      potentialSavings: 0.2,
      implementation: 'Route privacy-sensitive and batch tasks to local infrastructure',
    })

    return recommendations
  }
}

// Export singleton
export const greenRouter = new GreenRouter()
