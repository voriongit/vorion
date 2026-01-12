/**
 * Metrics Tracking
 *
 * Track application metrics, usage, and costs.
 * Provides structured data for analytics and monitoring.
 */

import { logger } from './logger'
import { createClient } from '@supabase/supabase-js'
import { config } from './config'

/**
 * Claude API pricing (USD per 1K tokens)
 */
const CLAUDE_PRICING = {
  'claude-3-5-sonnet-20241022': {
    input: 0.003,
    output: 0.015,
  },
  'claude-3-opus-20240229': {
    input: 0.015,
    output: 0.075,
  },
  'claude-3-sonnet-20240229': {
    input: 0.003,
    output: 0.015,
  },
  'claude-3-haiku-20240307': {
    input: 0.00025,
    output: 0.00125,
  },
} as const

type ClaudeModel = keyof typeof CLAUDE_PRICING

/**
 * Calculate cost for Claude API usage
 */
export function calculateClaudeCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing =
    CLAUDE_PRICING[model as ClaudeModel] ||
    CLAUDE_PRICING['claude-3-sonnet-20240229']

  const inputCost = (inputTokens / 1000) * pricing.input
  const outputCost = (outputTokens / 1000) * pricing.output

  return inputCost + outputCost
}

/**
 * Track chat message metrics
 */
export interface ChatMessageMetrics {
  userId: string
  botId: string
  conversationId: string
  model: string
  inputTokens: number
  outputTokens: number
  duration: number
  cost: number
}

export async function trackChatMessage(metrics: ChatMessageMetrics) {
  logger.info({
    type: 'metrics',
    category: 'chat_message',
    ...metrics,
  })

  // Store in database for analytics
  try {
    const supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    )

    await supabase.from('usage_logs').insert({
      user_id: metrics.userId,
      bot_id: metrics.botId,
      conversation_id: metrics.conversationId,
      model: metrics.model,
      input_tokens: metrics.inputTokens,
      output_tokens: metrics.outputTokens,
      cost_usd: metrics.cost,
    })
  } catch (error) {
    logger.error({
      type: 'error',
      category: 'metrics_tracking',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Track bot creation
 */
export function trackBotCreation(userId: string, botId: string, botType: string) {
  logger.info({
    type: 'metrics',
    category: 'bot_creation',
    userId,
    botId,
    botType,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Track conversation creation
 */
export function trackConversationCreation(
  userId: string,
  conversationId: string,
  type: 'bot' | 'team'
) {
  logger.info({
    type: 'metrics',
    category: 'conversation_creation',
    userId,
    conversationId,
    conversationType: type,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Track MCP server usage
 */
export function trackMCPToolCall(
  userId: string,
  botId: string,
  mcpServerId: string,
  toolName: string,
  duration: number,
  success: boolean
) {
  logger.info({
    type: 'metrics',
    category: 'mcp_tool_call',
    userId,
    botId,
    mcpServerId,
    toolName,
    duration,
    success,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Track API errors
 */
export function trackError(
  errorType: string,
  errorMessage: string,
  context?: object
) {
  logger.error({
    type: 'metrics',
    category: 'error',
    errorType,
    errorMessage,
    ...context,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Track rate limit hits
 */
export function trackRateLimit(
  userId: string,
  endpoint: string,
  limit: number
) {
  logger.warn({
    type: 'metrics',
    category: 'rate_limit',
    userId,
    endpoint,
    limit,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Track authentication events
 */
export function trackAuth(
  userId: string,
  event: 'login' | 'logout' | 'signup' | 'failed',
  metadata?: object
) {
  logger.info({
    type: 'metrics',
    category: 'auth',
    userId,
    event,
    ...metadata,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  operation: string
  duration: number
  success: boolean
  metadata?: object
}

export function trackPerformance(metrics: PerformanceMetrics) {
  const level = metrics.duration > 5000 ? 'warn' : 'info'

  logger[level]({
    type: 'metrics',
    category: 'performance',
    ...metrics,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Business metrics
 */
export function trackUserActivity(
  userId: string,
  activity: string,
  metadata?: object
) {
  logger.info({
    type: 'metrics',
    category: 'user_activity',
    userId,
    activity,
    ...metadata,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Cost tracking summary
 */
export interface CostSummary {
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  messagesCount: number
  period: string
}

export async function getCostSummary(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<CostSummary> {
  const supabase = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey
  )

  const { data, error } = await supabase
    .from('usage_logs')
    .select('cost_usd, input_tokens, output_tokens')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (error) {
    logger.error({ type: 'error', category: 'cost_summary', error: error.message })
    throw error
  }

  const summary = data.reduce(
    (acc, row) => ({
      totalCost: acc.totalCost + (row.cost_usd || 0),
      totalInputTokens: acc.totalInputTokens + (row.input_tokens || 0),
      totalOutputTokens: acc.totalOutputTokens + (row.output_tokens || 0),
      messagesCount: acc.messagesCount + 1,
    }),
    {
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      messagesCount: 0,
    }
  )

  return {
    ...summary,
    period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
  }
}

/**
 * Health check metrics
 */
export interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy'
  services: {
    database: boolean
    anthropic: boolean
    redis?: boolean
  }
  timestamp: string
}

export async function getHealthMetrics(): Promise<HealthMetrics> {
  const health: HealthMetrics = {
    status: 'healthy',
    services: {
      database: false,
      anthropic: false,
      redis: false,
    },
    timestamp: new Date().toISOString(),
  }

  // Check Supabase
  try {
    const supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    )
    const { error } = await supabase.from('profiles').select('id').limit(1)
    health.services.database = !error
  } catch (error) {
    health.services.database = false
  }

  // Check Anthropic (simple API key validation)
  health.services.anthropic = !!config.anthropic.apiKey

  // Check Redis (if configured)
  if (config.rateLimit.redis) {
    try {
      // Redis check would go here
      health.services.redis = true
    } catch (error) {
      health.services.redis = false
    }
  }

  // Determine overall status
  const servicesUp = Object.values(health.services).filter(Boolean).length
  const totalServices = Object.values(health.services).length

  if (servicesUp === totalServices) {
    health.status = 'healthy'
  } else if (servicesUp > 0) {
    health.status = 'degraded'
  } else {
    health.status = 'unhealthy'
  }

  return health
}

export default {
  calculateClaudeCost,
  trackChatMessage,
  trackBotCreation,
  trackConversationCreation,
  trackMCPToolCall,
  trackError,
  trackRateLimit,
  trackAuth,
  trackPerformance,
  trackUserActivity,
  getCostSummary,
  getHealthMetrics,
}
