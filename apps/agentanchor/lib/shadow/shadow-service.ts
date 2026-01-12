/**
 * Shadow Agent Service
 *
 * Manages shadow agents that observe, learn, and inject context.
 */

import { createClient } from '@/lib/supabase/server'
import { DEFAULT_SHADOW_CONFIG, SHADOW_TEMPLATES } from './types'
import type {
  ShadowAgentConfig,
  ShadowObservation,
  ShadowContext,
  ShadowContextItem,
  ShadowAlert,
  ShadowQuery,
  ShadowQueryResult,
  ShadowAgentType,
  ShadowMode,
  ObservationPriority,
  ObservationSource
} from './types'

// ============================================================================
// Shadow Agent Service
// ============================================================================

export class ShadowAgentService {
  private supabase: ReturnType<typeof createClient>

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase
  }

  // --------------------------------------------------------------------------
  // Shadow Agent CRUD
  // --------------------------------------------------------------------------

  async createShadow(config: Partial<ShadowAgentConfig>): Promise<ShadowAgentConfig> {
    const fullConfig = {
      ...DEFAULT_SHADOW_CONFIG,
      ...config,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const { data, error } = await this.supabase
      .from('shadow_agents')
      .insert({
        id: fullConfig.id,
        type: fullConfig.type,
        name: fullConfig.name,
        description: fullConfig.description,
        mode: fullConfig.mode,
        enabled: fullConfig.enabled,
        user_id: fullConfig.userId,
        agent_id: fullConfig.agentId,
        subscriptions: fullConfig.subscriptions,
        persistence_enabled: fullConfig.persistence?.enabled,
        retention_days: fullConfig.persistence?.retentionDays,
        max_observations: fullConfig.persistence?.maxObservations,
        injection_enabled: fullConfig.injection?.enabled,
        min_relevance: fullConfig.injection?.minRelevance,
        max_items_per_injection: fullConfig.injection?.maxItemsPerInjection,
        cooldown_ms: fullConfig.injection?.cooldownMs,
        type_config: fullConfig.typeConfig
      })
      .select()
      .single()

    if (error) throw error
    return this.mapToConfig(data)
  }

  async getShadow(shadowId: string): Promise<ShadowAgentConfig | null> {
    const { data, error } = await this.supabase
      .from('shadow_agents')
      .select('*')
      .eq('id', shadowId)
      .single()

    if (error) return null
    return this.mapToConfig(data)
  }

  async getShadowsForAgent(agentId: string): Promise<ShadowAgentConfig[]> {
    const { data, error } = await this.supabase
      .from('shadow_agents')
      .select('*')
      .eq('agent_id', agentId)
      .eq('enabled', true)

    if (error) throw error
    return data.map(this.mapToConfig)
  }

  async updateShadow(shadowId: string, updates: Partial<ShadowAgentConfig>): Promise<void> {
    const { error } = await this.supabase
      .from('shadow_agents')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', shadowId)

    if (error) throw error
  }

  async deleteShadow(shadowId: string): Promise<void> {
    const { error } = await this.supabase
      .from('shadow_agents')
      .delete()
      .eq('id', shadowId)

    if (error) throw error
  }

  // --------------------------------------------------------------------------
  // Observations
  // --------------------------------------------------------------------------

  async observe(
    shadowId: string,
    observation: Omit<ShadowObservation, 'id' | 'shadowId' | 'createdAt' | 'archived'>
  ): Promise<ShadowObservation> {
    const id = crypto.randomUUID()

    const { data, error } = await this.supabase
      .from('shadow_observations')
      .insert({
        id,
        shadow_id: shadowId,
        shadow_type: observation.shadowType,
        source_type: observation.source.type,
        source_message_id: observation.source.messageId,
        source_agent_id: observation.source.agentId,
        source_task_id: observation.source.taskId,
        source_conversation_id: observation.source.conversationId,
        source_user_id: observation.source.userId,
        summary: observation.summary,
        raw_content: observation.rawContent,
        structured_data: observation.structuredData,
        priority: observation.priority,
        confidence: observation.confidence,
        tags: observation.tags,
        related_observations: observation.relatedObservations,
        supersedes: observation.supersedes,
        expires_at: observation.expiresAt?.toISOString()
      })
      .select()
      .single()

    if (error) throw error

    // Check if this should trigger an alert (guardian mode)
    await this.checkForAlerts(shadowId, observation)

    return this.mapToObservation(data)
  }

  async queryObservations(query: ShadowQuery): Promise<ShadowQueryResult> {
    let q = this.supabase
      .from('shadow_observations')
      .select('*', { count: 'exact' })
      .eq('archived', false)

    if (query.shadowIds?.length) q = q.in('shadow_id', query.shadowIds)
    if (query.shadowTypes?.length) q = q.in('shadow_type', query.shadowTypes)
    if (query.agentIds?.length) q = q.in('source_agent_id', query.agentIds)
    if (query.priority?.length) q = q.in('priority', query.priority)
    if (query.minConfidence) q = q.gte('confidence', query.minConfidence)
    if (query.fromDate) q = q.gte('created_at', query.fromDate.toISOString())
    if (query.toDate) q = q.lte('created_at', query.toDate.toISOString())
    if (query.tags?.length) q = q.overlaps('tags', query.tags)
    if (query.searchText) q = q.ilike('summary', `%${query.searchText}%`)

    // Ordering
    const orderColumn = query.orderBy === 'timestamp' ? 'created_at' :
                        query.orderBy === 'priority' ? 'priority' :
                        query.orderBy === 'confidence' ? 'confidence' : 'created_at'
    q = q.order(orderColumn, { ascending: query.orderDirection === 'asc' })

    // Pagination
    if (query.offset) q = q.range(query.offset, query.offset + (query.limit || 50) - 1)
    else if (query.limit) q = q.limit(query.limit)

    const { data, error, count } = await q

    if (error) throw error

    return {
      observations: data.map(this.mapToObservation),
      total: count || 0,
      hasMore: (count || 0) > (query.offset || 0) + (data?.length || 0),
      query,
      executedAt: new Date()
    }
  }

  // --------------------------------------------------------------------------
  // Context Injection
  // --------------------------------------------------------------------------

  async getContextForAgent(
    agentId: string,
    relevanceQuery: string,
    options: { minRelevance?: number; maxItems?: number } = {}
  ): Promise<ShadowContext> {
    const minRelevance = options.minRelevance || 0.5
    const maxItems = options.maxItems || 5

    // Get all shadows for this agent
    const shadows = await this.getShadowsForAgent(agentId)
    if (!shadows.length) {
      return this.emptyContext(agentId, relevanceQuery, minRelevance)
    }

    const shadowIds = shadows.map(s => s.id)

    // Get recent observations
    const { data: observations, error } = await this.supabase
      .from('shadow_observations')
      .select('*')
      .in('shadow_id', shadowIds)
      .eq('archived', false)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    // Score relevance (simple keyword matching - could use embeddings)
    const queryWords = relevanceQuery.toLowerCase().split(/\s+/)
    const scoredItems: ShadowContextItem[] = observations
      .map(obs => {
        const content = obs.summary.toLowerCase()
        const matchCount = queryWords.filter(w => content.includes(w)).length
        const relevanceScore = matchCount / queryWords.length

        return {
          observationId: obs.id,
          shadowType: obs.shadow_type as ShadowAgentType,
          relevanceScore,
          content: obs.summary,
          priority: obs.priority as ObservationPriority,
          timestamp: new Date(obs.created_at),
          format: this.getFormat(obs.shadow_type, obs.priority)
        }
      })
      .filter(item => item.relevanceScore >= minRelevance)
      .sort((a, b) => {
        // Sort by priority first, then relevance
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 }
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
        return pDiff !== 0 ? pDiff : b.relevanceScore - a.relevanceScore
      })
      .slice(0, maxItems)

    // Record the injection
    const contextId = crypto.randomUUID()
    await this.supabase
      .from('shadow_context_injections')
      .insert({
        id: contextId,
        shadow_id: shadows[0].id,
        target_agent_id: agentId,
        relevance_query: relevanceQuery,
        relevance_threshold: minRelevance,
        items: scoredItems,
        summary: this.generateSummary(scoredItems),
        source_observations: scoredItems.map(i => i.observationId),
        total_observations_considered: observations.length
      })

    return {
      id: contextId,
      preparedAt: new Date(),
      preparedFor: { agentId },
      relevanceQuery,
      relevanceThreshold: minRelevance,
      items: scoredItems,
      summary: this.generateSummary(scoredItems),
      sourceShadows: shadowIds,
      totalObservationsConsidered: observations.length
    }
  }

  // --------------------------------------------------------------------------
  // Alerts
  // --------------------------------------------------------------------------

  async createAlert(
    shadowId: string,
    priority: ObservationPriority,
    message: string,
    observationId?: string,
    targetAgentId?: string,
    targetUserId?: string
  ): Promise<ShadowAlert> {
    const id = crypto.randomUUID()

    const { data, error } = await this.supabase
      .from('shadow_alerts')
      .insert({
        id,
        shadow_id: shadowId,
        priority,
        message,
        observation_id: observationId,
        target_agent_id: targetAgentId,
        target_user_id: targetUserId
      })
      .select()
      .single()

    if (error) throw error
    return this.mapToAlert(data)
  }

  async getOpenAlerts(userId?: string, agentId?: string): Promise<ShadowAlert[]> {
    let q = this.supabase
      .from('shadow_alerts')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })

    if (userId) q = q.eq('target_user_id', userId)
    if (agentId) q = q.eq('target_agent_id', agentId)

    const { data, error } = await q

    if (error) throw error
    return data.map(this.mapToAlert)
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('shadow_alerts')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: acknowledgedBy
      })
      .eq('id', alertId)

    if (error) throw error
  }

  async resolveAlert(alertId: string, actionTaken?: string): Promise<void> {
    const { error } = await this.supabase
      .from('shadow_alerts')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        action_taken: actionTaken
      })
      .eq('id', alertId)

    if (error) throw error
  }

  // --------------------------------------------------------------------------
  // Templates
  // --------------------------------------------------------------------------

  async createFromTemplate(
    templateType: ShadowAgentType,
    userId: string,
    agentId?: string
  ): Promise<ShadowAgentConfig> {
    const template = SHADOW_TEMPLATES.find(t => t.type === templateType)
    if (!template) {
      throw new Error(`No template found for type: ${templateType}`)
    }

    return this.createShadow({
      ...template,
      userId,
      agentId
    })
  }

  // --------------------------------------------------------------------------
  // Stats
  // --------------------------------------------------------------------------

  async getStats(): Promise<{
    activeShadows: number
    observations24h: number
    criticalObservations24h: number
    injections24h: number
    openAlerts: number
    criticalAlerts: number
  }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [shadows, observations, criticalObs, injections, alerts, criticalAlerts] = await Promise.all([
      this.supabase.from('shadow_agents').select('id', { count: 'exact' }).eq('enabled', true),
      this.supabase.from('shadow_observations').select('id', { count: 'exact' }).gte('created_at', oneDayAgo),
      this.supabase.from('shadow_observations').select('id', { count: 'exact' }).gte('created_at', oneDayAgo).eq('priority', 'critical'),
      this.supabase.from('shadow_context_injections').select('id', { count: 'exact' }).gte('created_at', oneDayAgo),
      this.supabase.from('shadow_alerts').select('id', { count: 'exact' }).eq('resolved', false),
      this.supabase.from('shadow_alerts').select('id', { count: 'exact' }).eq('resolved', false).eq('priority', 'critical')
    ])

    return {
      activeShadows: shadows.count || 0,
      observations24h: observations.count || 0,
      criticalObservations24h: criticalObs.count || 0,
      injections24h: injections.count || 0,
      openAlerts: alerts.count || 0,
      criticalAlerts: criticalAlerts.count || 0
    }
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private async checkForAlerts(
    shadowId: string,
    observation: Omit<ShadowObservation, 'id' | 'shadowId' | 'createdAt' | 'archived'>
  ): Promise<void> {
    // Get shadow config
    const shadow = await this.getShadow(shadowId)
    if (!shadow || shadow.mode !== 'guardian') return

    // Create alert for critical or high priority observations
    if (observation.priority === 'critical' || observation.priority === 'high') {
      await this.createAlert(
        shadowId,
        observation.priority,
        observation.summary,
        undefined,
        shadow.agentId,
        shadow.userId
      )
    }
  }

  private getFormat(shadowType: string, priority: string): ShadowContextItem['format'] {
    if (priority === 'critical' || priority === 'high') return 'warning'
    if (shadowType === 'memory') return 'fact'
    if (shadowType === 'pattern' || shadowType === 'learning') return 'suggestion'
    return 'reminder'
  }

  private generateSummary(items: ShadowContextItem[]): string {
    if (!items.length) return 'No relevant context found.'

    const critical = items.filter(i => i.priority === 'critical').length
    const warnings = items.filter(i => i.format === 'warning').length

    if (critical > 0) {
      return `${critical} critical item(s) require attention. ${items.length} total relevant observations.`
    }
    if (warnings > 0) {
      return `${warnings} warning(s) to consider. ${items.length} total relevant observations.`
    }
    return `${items.length} relevant context items from shadow observations.`
  }

  private emptyContext(agentId: string, query: string, threshold: number): ShadowContext {
    return {
      id: crypto.randomUUID(),
      preparedAt: new Date(),
      preparedFor: { agentId },
      relevanceQuery: query,
      relevanceThreshold: threshold,
      items: [],
      summary: 'No shadow agents configured or no relevant observations.',
      sourceShadows: [],
      totalObservationsConsidered: 0
    }
  }

  private mapToConfig(data: Record<string, unknown>): ShadowAgentConfig {
    return {
      id: data.id as string,
      type: data.type as ShadowAgentType,
      name: data.name as string,
      description: data.description as string | undefined,
      mode: data.mode as ShadowMode,
      enabled: data.enabled as boolean,
      userId: data.user_id as string | undefined,
      agentId: data.agent_id as string | undefined,
      subscriptions: data.subscriptions as ShadowAgentConfig['subscriptions'],
      persistence: {
        enabled: data.persistence_enabled as boolean,
        retentionDays: data.retention_days as number,
        maxObservations: data.max_observations as number
      },
      injection: {
        enabled: data.injection_enabled as boolean,
        minRelevance: data.min_relevance as number,
        maxItemsPerInjection: data.max_items_per_injection as number,
        cooldownMs: data.cooldown_ms as number
      },
      typeConfig: data.type_config as Record<string, unknown> | undefined,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string)
    }
  }

  private mapToObservation(data: Record<string, unknown>): ShadowObservation {
    return {
      id: data.id as string,
      shadowId: data.shadow_id as string,
      shadowType: data.shadow_type as ShadowAgentType,
      source: {
        type: data.source_type as ObservationSource['type'],
        messageId: data.source_message_id as string | undefined,
        agentId: data.source_agent_id as string | undefined,
        taskId: data.source_task_id as string | undefined,
        conversationId: data.source_conversation_id as string | undefined,
        userId: data.source_user_id as string | undefined
      },
      summary: data.summary as string,
      rawContent: data.raw_content as string | undefined,
      structuredData: data.structured_data as Record<string, unknown>,
      priority: data.priority as ObservationPriority,
      confidence: data.confidence as number,
      tags: data.tags as string[],
      relatedObservations: data.related_observations as string[] | undefined,
      supersedes: data.supersedes as string | undefined,
      expiresAt: data.expires_at ? new Date(data.expires_at as string) : undefined,
      archived: data.archived as boolean,
      createdAt: new Date(data.created_at as string)
    }
  }

  private mapToAlert(data: Record<string, unknown>): ShadowAlert {
    return {
      id: data.id as string,
      shadowId: data.shadow_id as string,
      priority: data.priority as ObservationPriority,
      message: data.message as string,
      observationId: data.observation_id as string | undefined,
      targetAgentId: data.target_agent_id as string | undefined,
      targetUserId: data.target_user_id as string | undefined,
      acknowledged: data.acknowledged as boolean,
      acknowledgedAt: data.acknowledged_at ? new Date(data.acknowledged_at as string) : undefined,
      acknowledgedBy: data.acknowledged_by as string | undefined,
      actionTaken: data.action_taken as string | undefined,
      resolved: data.resolved as boolean,
      resolvedAt: data.resolved_at ? new Date(data.resolved_at as string) : undefined,
      createdAt: new Date(data.created_at as string)
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createShadowService(supabase: ReturnType<typeof createClient>): ShadowAgentService {
  return new ShadowAgentService(supabase)
}
