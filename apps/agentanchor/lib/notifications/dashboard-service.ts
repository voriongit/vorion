/**
 * Dashboard Service
 * Epic 7: Story 7-1 Role-Based Dashboard (FR129-131)
 */

import { createClient } from '@/lib/supabase/server'
import { DashboardPreferences } from './types'

export interface TrainerDashboardStats {
  total_agents: number
  active_agents: number
  training_agents: number
  published_agents: number
  total_earnings: number
  available_earnings: number
  this_month_earnings: number
  average_trust_score: number
  total_acquisitions: number
  pending_escalations: number
  pending_complaints: number
}

export interface ConsumerDashboardStats {
  acquired_agents: number
  active_acquisitions: number
  total_tasks: number
  this_month_tasks: number
  total_spent: number
  this_month_spent: number
  active_agents_count: number
}

export interface RecentActivity {
  id: string
  type: 'agent_created' | 'training_started' | 'graduation' | 'acquisition' | 'task_completed' | 'feedback' | 'council_decision' | 'trust_change'
  title: string
  description: string
  agent_id?: string
  agent_name?: string
  created_at: string
}

/**
 * Get or create dashboard preferences
 */
export async function getDashboardPreferences(userId: string): Promise<DashboardPreferences> {
  const supabase = createClient()

  // Try to get existing preferences
  const { data, error } = await supabase
    .from('user_dashboard_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (data) {
    return data
  }

  // Create default preferences
  const { data: created, error: createError } = await supabase
    .from('user_dashboard_preferences')
    .insert({
      user_id: userId,
      active_role: 'trainer',
      default_tab: 'overview',
      widget_layout: [],
    })
    .select()
    .single()

  if (createError) {
    // Return defaults if creation fails
    return {
      id: '',
      user_id: userId,
      active_role: 'trainer',
      default_tab: 'overview',
      widget_layout: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  return created
}

/**
 * Update dashboard preferences
 */
export async function updateDashboardPreferences(
  userId: string,
  updates: Partial<Pick<DashboardPreferences, 'active_role' | 'default_tab' | 'widget_layout'>>
): Promise<DashboardPreferences> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('user_dashboard_preferences')
    .upsert({
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update preferences: ${error.message}`)
  }

  return data
}

/**
 * Get trainer dashboard stats (FR130)
 */
export async function getTrainerDashboardStats(trainerId: string): Promise<TrainerDashboardStats> {
  const supabase = createClient()

  // Get trainer's agents first
  const { data: agents } = await supabase
    .from('bots')
    .select('id, status, trust_score, published')
    .eq('creator_id', trainerId)

  const agentList = agents || []
  const agentIds = agentList.map(a => a.id)

  // Get other stats in parallel
  const [earningsResult, listingsResult] = await Promise.all([
    supabase
      .from('trainer_earnings')
      .select('net_amount, status, earned_at')
      .eq('trainer_id', trainerId),

    supabase
      .from('marketplace_listings')
      .select('id')
      .eq('trainer_id', trainerId),
  ])

  const earnings = earningsResult.data || []
  const listingIds = (listingsResult.data || []).map(l => l.id)

  // Get acquisition count, escalation count, complaint count
  let totalAcquisitions = 0
  let pendingEscalations = 0
  let pendingComplaints = 0

  if (listingIds.length > 0) {
    const { count: acqCount } = await supabase
      .from('acquisitions')
      .select('id', { count: 'exact', head: true })
      .in('listing_id', listingIds)
    totalAcquisitions = acqCount || 0
  }

  if (agentIds.length > 0) {
    const [escResult, compResult] = await Promise.all([
      supabase
        .from('council_decisions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'escalated')
        .in('agent_id', agentIds),

      supabase
        .from('agent_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('is_complaint', true)
        .in('complaint_status', ['pending', 'investigating'])
        .in('agent_id', agentIds),
    ])

    pendingEscalations = escResult.count || 0
    pendingComplaints = compResult.count || 0
  }

  // Calculate stats
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const totalEarnings = earnings.reduce((sum, e) => sum + Number(e.net_amount || 0), 0)
  const availableEarnings = earnings
    .filter(e => e.status === 'available')
    .reduce((sum, e) => sum + Number(e.net_amount || 0), 0)
  const thisMonthEarnings = earnings
    .filter(e => new Date(e.earned_at) >= monthStart)
    .reduce((sum, e) => sum + Number(e.net_amount || 0), 0)

  const trustScores = agentList
    .filter(a => a.trust_score > 0)
    .map(a => a.trust_score)
  const avgTrustScore = trustScores.length > 0
    ? Math.round(trustScores.reduce((sum, s) => sum + s, 0) / trustScores.length)
    : 0

  return {
    total_agents: agentList.length,
    active_agents: agentList.filter(a => a.status === 'active').length,
    training_agents: agentList.filter(a => a.status === 'training').length,
    published_agents: agentList.filter(a => a.published).length,
    total_earnings: totalEarnings,
    available_earnings: availableEarnings,
    this_month_earnings: thisMonthEarnings,
    average_trust_score: avgTrustScore,
    total_acquisitions: totalAcquisitions,
    pending_escalations: pendingEscalations,
    pending_complaints: pendingComplaints,
  }
}

/**
 * Get consumer dashboard stats (FR131)
 */
export async function getConsumerDashboardStats(consumerId: string): Promise<ConsumerDashboardStats> {
  const supabase = createClient()

  const [acquisitionsResult, usageResult] = await Promise.all([
    supabase
      .from('acquisitions')
      .select('id, status')
      .eq('consumer_id', consumerId),

    supabase
      .from('acquisition_usage')
      .select('task_count, cost, recorded_at')
      .eq('consumer_id', consumerId),
  ])

  const acquisitions = acquisitionsResult.data || []
  const usage = usageResult.data || []

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const totalTasks = usage.reduce((sum, u) => sum + u.task_count, 0)
  const thisMonthTasks = usage
    .filter(u => new Date(u.recorded_at) >= monthStart)
    .reduce((sum, u) => sum + u.task_count, 0)

  const totalSpent = usage.reduce((sum, u) => sum + Number(u.cost || 0), 0)
  const thisMonthSpent = usage
    .filter(u => new Date(u.recorded_at) >= monthStart)
    .reduce((sum, u) => sum + Number(u.cost || 0), 0)

  return {
    acquired_agents: acquisitions.length,
    active_acquisitions: acquisitions.filter(a => a.status === 'active').length,
    total_tasks: totalTasks,
    this_month_tasks: thisMonthTasks,
    total_spent: totalSpent,
    this_month_spent: thisMonthSpent,
    active_agents_count: acquisitions.filter(a => a.status === 'active').length,
  }
}

/**
 * Get recent activity for user
 */
export async function getRecentActivity(
  userId: string,
  role: 'trainer' | 'consumer',
  limit: number = 10
): Promise<RecentActivity[]> {
  const supabase = createClient()

  const activities: RecentActivity[] = []

  if (role === 'trainer') {
    // Get trainer's agent IDs first
    const { data: agents } = await supabase
      .from('bots')
      .select('id, name, status, created_at, updated_at')
      .eq('creator_id', userId)
      .order('updated_at', { ascending: false })
      .limit(5)

    const agentList = agents || []
    const agentIds = agentList.map(a => a.id)

    // Process agent events
    for (const agent of agentList) {
      activities.push({
        id: `agent-${agent.id}`,
        type: 'agent_created',
        title: 'Agent Created',
        description: `Created agent "${agent.name}"`,
        agent_id: agent.id,
        agent_name: agent.name,
        created_at: agent.created_at,
      })
    }

    if (agentIds.length > 0) {
      // Get council decisions
      const { data: councilEvents } = await supabase
        .from('council_decisions')
        .select('id, action, outcome, created_at, agent_id')
        .in('agent_id', agentIds)
        .order('created_at', { ascending: false })
        .limit(5)

      // Get agent names for decisions
      const agentMap = new Map(agentList.map(a => [a.id, a.name]))

      for (const decision of councilEvents || []) {
        activities.push({
          id: `council-${decision.id}`,
          type: 'council_decision',
          title: 'Council Decision',
          description: `${decision.action} - ${decision.outcome}`,
          agent_id: decision.agent_id,
          agent_name: agentMap.get(decision.agent_id),
          created_at: decision.created_at,
        })
      }

      // Get feedback events
      const { data: feedbackEvents } = await supabase
        .from('agent_feedback')
        .select('id, rating, is_complaint, created_at, agent_id')
        .in('agent_id', agentIds)
        .order('created_at', { ascending: false })
        .limit(5)

      for (const fb of feedbackEvents || []) {
        activities.push({
          id: `feedback-${fb.id}`,
          type: 'feedback',
          title: fb.is_complaint ? 'Complaint Received' : 'Review Received',
          description: `${fb.rating} star ${fb.is_complaint ? 'complaint' : 'review'} for "${agentMap.get(fb.agent_id) || 'agent'}"`,
          agent_id: fb.agent_id,
          agent_name: agentMap.get(fb.agent_id),
          created_at: fb.created_at,
        })
      }
    }
  } else {
    // Consumer activities
    const { data: acquisitionEvents } = await supabase
      .from('acquisitions')
      .select('id, status, created_at, listing_id')
      .eq('consumer_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    for (const acq of acquisitionEvents || []) {
      activities.push({
        id: `acquisition-${acq.id}`,
        type: 'acquisition',
        title: 'Agent Acquired',
        description: `Acquired a new agent`,
        created_at: acq.created_at,
      })
    }

    const { data: usageEvents } = await supabase
      .from('acquisition_usage')
      .select('id, task_count, recorded_at')
      .eq('consumer_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(5)

    for (const usage of usageEvents || []) {
      activities.push({
        id: `task-${usage.id}`,
        type: 'task_completed',
        title: 'Tasks Completed',
        description: `Completed ${usage.task_count} tasks`,
        created_at: usage.recorded_at,
      })
    }
  }

  // Sort by date and limit
  return activities
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
}
