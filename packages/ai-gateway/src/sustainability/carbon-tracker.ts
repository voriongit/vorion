/**
 * Carbon Tracking System
 * Monitors energy consumption and carbon footprint of AI operations
 * Based on 2025 sustainability best practices and CodeCarbon methodology
 */

export interface CarbonMetrics {
  taskId: string
  modelProvider: string
  modelName: string
  tokensInput: number
  tokensOutput: number
  duration: number // milliseconds
  energyConsumed: number // kWh
  carbonEmitted: number // kg CO2e
  timestamp: Date
}

export interface ModelEnergyProfile {
  provider: string
  model: string
  energyPerToken: number // Wh per token
  carbonIntensity: number // kg CO2e per kWh
  isGreenOptimized: boolean
}

/**
 * Carbon Tracker
 * Tracks energy consumption and carbon emissions for AI operations
 */
export class CarbonTracker {
  private static MODEL_ENERGY_PROFILES: Record<string, ModelEnergyProfile> = {
    // Anthropic - Cloud-based (US average grid)
    'claude-opus-4': {
      provider: 'anthropic',
      model: 'claude-opus-4',
      energyPerToken: 0.000025, // 25 uWh per token (large model estimate)
      carbonIntensity: 0.386, // kg CO2e per kWh (US grid average 2025)
      isGreenOptimized: false,
    },
    'claude-sonnet-4-5': {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      energyPerToken: 0.000015, // 15 uWh per token
      carbonIntensity: 0.386,
      isGreenOptimized: false,
    },
    'claude-haiku-4': {
      provider: 'anthropic',
      model: 'claude-haiku-4',
      energyPerToken: 0.000008, // 8 uWh per token (efficient)
      carbonIntensity: 0.386,
      isGreenOptimized: false,
    },

    // Google - Using renewable energy (lower carbon intensity)
    'gemini-2.5-pro': {
      provider: 'google',
      model: 'gemini-2.5-pro',
      energyPerToken: 0.000020, // 20 uWh per token
      carbonIntensity: 0.128, // Google's renewable-powered data centers
      isGreenOptimized: true,
    },
    'gemini-2.5-flash': {
      provider: 'google',
      model: 'gemini-2.5-flash',
      energyPerToken: 0.000006, // 6 uWh per token (very efficient)
      carbonIntensity: 0.128,
      isGreenOptimized: true,
    },

    // OpenAI - Cloud-based (improving renewable usage)
    'gpt-4o': {
      provider: 'openai',
      model: 'gpt-4o',
      energyPerToken: 0.000018, // 18 uWh per token
      carbonIntensity: 0.250, // Azure's carbon commitment
      isGreenOptimized: false,
    },
    'gpt-4o-mini': {
      provider: 'openai',
      model: 'gpt-4o-mini',
      energyPerToken: 0.000007, // 7 uWh per token
      carbonIntensity: 0.250,
      isGreenOptimized: true,
    },

    // Self-hosted Ollama (depends on local grid)
    'llama-3.1-70b': {
      provider: 'ollama',
      model: 'llama-3.1-70b',
      energyPerToken: 0.000012, // 12 uWh per token (on-premise efficiency)
      carbonIntensity: 0.386, // Assumes US grid average (configurable)
      isGreenOptimized: false,
    },
    'deepseek-r1': {
      provider: 'ollama',
      model: 'deepseek-r1',
      energyPerToken: 0.000010, // 10 uWh per token
      carbonIntensity: 0.386,
      isGreenOptimized: false,
    },
    'llama-3.2-90b': {
      provider: 'ollama',
      model: 'llama-3.2-90b',
      energyPerToken: 0.000014, // 14 uWh per token (larger model)
      carbonIntensity: 0.386,
      isGreenOptimized: false,
    },
  }

  /**
   * Track carbon emissions for a task
   */
  async trackTask(
    taskId: string,
    modelProvider: string,
    modelName: string,
    tokensInput: number,
    tokensOutput: number,
    duration: number
  ): Promise<CarbonMetrics> {
    const profile = this.getModelProfile(modelProvider, modelName)

    const totalTokens = tokensInput + tokensOutput
    const energyConsumed = totalTokens * profile.energyPerToken / 1000 // Convert Wh to kWh
    const carbonEmitted = energyConsumed * profile.carbonIntensity

    const metrics: CarbonMetrics = {
      taskId,
      modelProvider,
      modelName,
      tokensInput,
      tokensOutput,
      duration,
      energyConsumed,
      carbonEmitted,
      timestamp: new Date(),
    }

    console.log(
      `[CARBON_TRACKER] Task ${taskId}: ${carbonEmitted.toFixed(6)} kg CO2e (${energyConsumed.toFixed(6)} kWh)`
    )

    return metrics
  }

  /**
   * Get model energy profile
   */
  private getModelProfile(provider: string, model: string): ModelEnergyProfile {
    const key = `${model}`
    const profile = CarbonTracker.MODEL_ENERGY_PROFILES[key]

    if (profile) {
      return profile
    }

    // Default profile for unknown models
    console.warn(`[CARBON_TRACKER] No profile for ${provider}/${model}, using default`)
    return {
      provider,
      model,
      energyPerToken: 0.000015, // Conservative estimate
      carbonIntensity: 0.386,
      isGreenOptimized: false,
    }
  }

  /**
   * Get green-optimized models
   */
  getGreenModels(): ModelEnergyProfile[] {
    return Object.values(CarbonTracker.MODEL_ENERGY_PROFILES).filter(
      (profile) => profile.isGreenOptimized
    )
  }

  /**
   * Calculate carbon savings
   */
  calculateSavings(
    baselineModel: string,
    greenModel: string,
    tokens: number
  ): {
    energySaved: number
    carbonSaved: number
    savingsPercent: number
  } {
    const baseline = this.getModelProfile('', baselineModel)
    const green = this.getModelProfile('', greenModel)

    const baselineEnergy = tokens * baseline.energyPerToken / 1000
    const greenEnergy = tokens * green.energyPerToken / 1000

    const baselineCarbon = baselineEnergy * baseline.carbonIntensity
    const greenCarbon = greenEnergy * green.carbonIntensity

    const energySaved = baselineEnergy - greenEnergy
    const carbonSaved = baselineCarbon - greenCarbon
    const savingsPercent = (carbonSaved / baselineCarbon) * 100

    return { energySaved, carbonSaved, savingsPercent }
  }

  /**
   * Get aggregate carbon metrics
   */
  async getAggregateMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalTasks: number
    totalEnergy: number
    totalCarbon: number
    avgCarbonPerTask: number
    greenTaskPercent: number
  }> {
    // Would query from database in production
    // For now, return mock data
    return {
      totalTasks: 150,
      totalEnergy: 2.4, // kWh
      totalCarbon: 0.92, // kg CO2e
      avgCarbonPerTask: 0.0061, // kg CO2e
      greenTaskPercent: 45.5, // %
    }
  }

  /**
   * Get hourly carbon intensity forecast
   * (for off-peak scheduling)
   */
  async getCarbonIntensityForecast(): Promise<
    Array<{
      hour: number
      intensity: number // kg CO2e per kWh
      isLowEmission: boolean
    }>
  > {
    // In production, would use WattTime API or similar
    // Simulated 24-hour profile with lower emissions at night
    const baseIntensity = 0.386
    const forecast = []

    for (let hour = 0; hour < 24; hour++) {
      // Lower emissions 10pm-6am (off-peak)
      const isOffPeak = hour >= 22 || hour <= 6
      const intensity = isOffPeak
        ? baseIntensity * 0.7 // 30% lower at night
        : baseIntensity * 1.1 // 10% higher during day

      forecast.push({
        hour,
        intensity,
        isLowEmission: isOffPeak,
      })
    }

    return forecast
  }

  /**
   * Check if current time is low-emission period
   */
  async isLowEmissionPeriod(): Promise<boolean> {
    const hour = new Date().getHours()
    const forecast = await this.getCarbonIntensityForecast()
    const current = forecast.find((f) => f.hour === hour)
    return current?.isLowEmission ?? false
  }

  /**
   * Get recommended model for green routing
   */
  async getGreenRecommendation(
    taskType: string,
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ): Promise<{
    model: string
    provider: string
    reason: string
  }> {
    const isLowEmission = await this.isLowEmissionPeriod()

    // For non-critical tasks, always prefer green models
    if (priority === 'LOW' || priority === 'MEDIUM') {
      return {
        model: 'gemini-2.5-flash',
        provider: 'google',
        reason: 'Green-optimized model with renewable energy',
      }
    }

    // For critical tasks during low-emission periods, can use larger green models
    if (priority === 'HIGH' && isLowEmission) {
      return {
        model: 'gemini-2.5-pro',
        provider: 'google',
        reason: 'High-quality green model during off-peak hours',
      }
    }

    // For critical tasks during high-emission periods, use quality model but log impact
    return {
      model: 'claude-sonnet-4-5',
      provider: 'anthropic',
      reason: 'Quality priority, consider rescheduling non-urgent tasks',
    }
  }
}

// Export singleton
export const carbonTracker = new CarbonTracker()
