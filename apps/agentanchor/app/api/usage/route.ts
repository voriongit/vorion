import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface UsageStats {
  overview: {
    totalAgents: number
    activeAgents: number
    totalInteractions: number
    successRate: number
    totalEvents: number
    eventsToday: number
    councilDecisions: number
    trustChanges: number
  }
  timeline: {
    date: string
    events: number
    interactions: number
    decisions: number
  }[]
  eventsByType: {
    type: string
    count: number
  }[]
  eventsByRisk: {
    risk: string
    count: number
  }[]
  agentActivity: {
    agentId: string
    agentName: string
    interactions: number
    successRate: number
    trustScore: number
    eventsCount: number
  }[]
  recentActivity: {
    id: string
    type: string
    title: string
    description: string
    risk: string
    createdAt: string
  }[]
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    // Fetch user's agents from bots table
    const { data: agents } = await supabase
      .from('bots')
      .select('id, name, trust_score, status')
      .eq('user_id', user.id)

    const agentIds = agents?.map(a => a.id) || []

    // Calculate agent stats
    const totalAgents = agents?.length || 0
    const activeAgents = agents?.filter(a => a.status === 'active').length || 0

    // Fetch observer events for user's agents
    let totalEvents = 0
    let eventsToday = 0
    let eventsByType: { type: string; count: number }[] = []
    let eventsByRisk: { risk: string; count: number }[] = []
    let recentActivity: UsageStats['recentActivity'] = []
    let timeline: UsageStats['timeline'] = []

    if (agentIds.length > 0) {
      // Total events count
      const { count: eventsCount } = await supabase
        .from('observer_events')
        .select('*', { count: 'exact', head: true })
        .in('agent_id', agentIds)
      totalEvents = eventsCount || 0

      // Events today
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { count: todayCount } = await supabase
        .from('observer_events')
        .select('*', { count: 'exact', head: true })
        .in('agent_id', agentIds)
        .gte('created_at', todayStart.toISOString())
      eventsToday = todayCount || 0

      // Events by type
      const { data: typeData } = await supabase
        .from('observer_events')
        .select('event_type')
        .in('agent_id', agentIds)
        .gte('created_at', startDateStr)

      if (typeData) {
        const typeCount: Record<string, number> = {}
        typeData.forEach(e => {
          typeCount[e.event_type] = (typeCount[e.event_type] || 0) + 1
        })
        eventsByType = Object.entries(typeCount).map(([type, count]) => ({
          type,
          count
        })).sort((a, b) => b.count - a.count)
      }

      // Events by risk level
      const { data: riskData } = await supabase
        .from('observer_events')
        .select('risk_level')
        .in('agent_id', agentIds)
        .gte('created_at', startDateStr)

      if (riskData) {
        const riskCount: Record<string, number> = {}
        riskData.forEach(e => {
          riskCount[e.risk_level] = (riskCount[e.risk_level] || 0) + 1
        })
        eventsByRisk = Object.entries(riskCount).map(([risk, count]) => ({
          risk,
          count
        }))
      }

      // Recent activity
      const { data: recentEvents } = await supabase
        .from('observer_events')
        .select('id, event_type, risk_level, data, created_at')
        .in('agent_id', agentIds)
        .order('created_at', { ascending: false })
        .limit(10)

      recentActivity = (recentEvents || []).map(e => ({
        id: e.id,
        type: e.event_type,
        title: e.event_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        description: (e.data as { description?: string })?.description || '',
        risk: e.risk_level,
        createdAt: e.created_at
      }))

      // Timeline data (last N days)
      const { data: timelineEvents } = await supabase
        .from('observer_events')
        .select('created_at')
        .in('agent_id', agentIds)
        .gte('created_at', startDateStr)
        .order('created_at', { ascending: true })

      // Group events by date
      const eventsByDate: Record<string, number> = {}
      timelineEvents?.forEach(e => {
        const date = e.created_at.split('T')[0]
        eventsByDate[date] = (eventsByDate[date] || 0) + 1
      })

      // Fill in missing dates
      for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        if (!eventsByDate[dateStr]) {
          eventsByDate[dateStr] = 0
        }
      }

      timeline = Object.entries(eventsByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, events]) => ({
          date,
          events,
          interactions: 0,
          decisions: 0
        }))
    }

    // Trust changes
    let trustChanges = 0
    if (agentIds.length > 0) {
      const { count: trustCount } = await supabase
        .from('trust_history')
        .select('*', { count: 'exact', head: true })
        .in('agent_id', agentIds)
        .gte('recorded_at', startDateStr)
      trustChanges = trustCount || 0
    }

    // Agent activity breakdown
    const agentActivity: UsageStats['agentActivity'] = []
    if (agents && agentIds.length > 0) {
      for (const agent of agents.slice(0, 10)) {
        const { count: agentEventsCount } = await supabase
          .from('observer_events')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', agent.id)
          .gte('created_at', startDateStr)

        agentActivity.push({
          agentId: agent.id,
          agentName: agent.name,
          interactions: agentEventsCount || 0,
          successRate: 100, // Placeholder - would need task tracking
          trustScore: agent.trust_score || 0,
          eventsCount: agentEventsCount || 0
        })
      }
    }

    const stats: UsageStats = {
      overview: {
        totalAgents,
        activeAgents,
        totalInteractions: totalEvents, // Using events as proxy for interactions
        successRate: 95, // Placeholder
        totalEvents,
        eventsToday,
        councilDecisions: 0, // Council decisions table doesn't exist in schema
        trustChanges
      },
      timeline,
      eventsByType,
      eventsByRisk,
      agentActivity: agentActivity.sort((a, b) => b.eventsCount - a.eventsCount),
      recentActivity
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Usage API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    )
  }
}
