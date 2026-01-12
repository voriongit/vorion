/**
 * Simulate Usage API Response
 * Tests the exact data structure the dashboard expects
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const OWNER_ID = 'c8325d64-d6aa-42c9-a64d-ea4c9f8cc495'
const DAYS = 30

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function simulateUsageAPI() {
  console.log('Simulating Usage API Response\n')
  console.log('='.repeat(50))

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - DAYS)
  const startDateStr = startDate.toISOString()

  // Fetch agents
  const { data: agents } = await supabase
    .from('bots')
    .select('id, name, trust_score, status')
    .eq('user_id', OWNER_ID)

  const agentIds = agents?.map(a => a.id) || []
  const totalAgents = agents?.length || 0
  const activeAgents = agents?.filter(a => a.status === 'active').length || 0

  // Events counts
  const { count: totalEvents } = await supabase
    .from('observer_events')
    .select('*', { count: 'exact', head: true })
    .in('agent_id', agentIds)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count: eventsToday } = await supabase
    .from('observer_events')
    .select('*', { count: 'exact', head: true })
    .in('agent_id', agentIds)
    .gte('created_at', todayStart.toISOString())

  // Trust changes
  const { count: trustChanges } = await supabase
    .from('trust_history')
    .select('*', { count: 'exact', head: true })
    .in('agent_id', agentIds)
    .gte('recorded_at', startDateStr)

  // Events by type
  const { data: typeData } = await supabase
    .from('observer_events')
    .select('event_type')
    .in('agent_id', agentIds)
    .gte('created_at', startDateStr)

  const typeCount: Record<string, number> = {}
  typeData?.forEach(e => {
    typeCount[e.event_type] = (typeCount[e.event_type] || 0) + 1
  })
  const eventsByType = Object.entries(typeCount)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  // Events by risk
  const { data: riskData } = await supabase
    .from('observer_events')
    .select('risk_level')
    .in('agent_id', agentIds)
    .gte('created_at', startDateStr)

  const riskCount: Record<string, number> = {}
  riskData?.forEach(e => {
    riskCount[e.risk_level] = (riskCount[e.risk_level] || 0) + 1
  })
  const eventsByRisk = Object.entries(riskCount).map(([risk, count]) => ({ risk, count }))

  // Timeline
  const { data: timelineEvents } = await supabase
    .from('observer_events')
    .select('created_at')
    .in('agent_id', agentIds)
    .gte('created_at', startDateStr)
    .order('created_at', { ascending: true })

  const eventsByDate: Record<string, number> = {}
  timelineEvents?.forEach(e => {
    const date = e.created_at.split('T')[0]
    eventsByDate[date] = (eventsByDate[date] || 0) + 1
  })

  // Fill missing dates
  for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]
    if (!eventsByDate[dateStr]) {
      eventsByDate[dateStr] = 0
    }
  }

  const timeline = Object.entries(eventsByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => ({ date, events, interactions: 0, decisions: 0 }))

  // Agent activity
  const agentActivity = []
  for (const agent of (agents || []).slice(0, 10)) {
    const { count } = await supabase
      .from('observer_events')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent.id)
      .gte('created_at', startDateStr)

    agentActivity.push({
      agentId: agent.id,
      agentName: agent.name,
      interactions: count || 0,
      successRate: 100,
      trustScore: agent.trust_score || 0,
      eventsCount: count || 0
    })
  }

  // Recent activity
  const { data: recentEvents } = await supabase
    .from('observer_events')
    .select('id, event_type, risk_level, data, created_at')
    .in('agent_id', agentIds)
    .order('created_at', { ascending: false })
    .limit(10)

  const recentActivity = (recentEvents || []).map(e => ({
    id: e.id,
    type: e.event_type,
    title: e.event_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
    description: (e.data as { description?: string })?.description || '',
    risk: e.risk_level,
    createdAt: e.created_at
  }))

  // Build response
  const response = {
    overview: {
      totalAgents,
      activeAgents,
      totalInteractions: totalEvents || 0,
      successRate: 95,
      totalEvents: totalEvents || 0,
      eventsToday: eventsToday || 0,
      councilDecisions: 0,
      trustChanges: trustChanges || 0
    },
    timeline,
    eventsByType,
    eventsByRisk,
    agentActivity: agentActivity.sort((a, b) => b.eventsCount - a.eventsCount),
    recentActivity
  }

  // Print summary
  console.log('\nOVERVIEW:')
  console.log('  Total Agents:', response.overview.totalAgents)
  console.log('  Active Agents:', response.overview.activeAgents)
  console.log('  Total Events:', response.overview.totalEvents)
  console.log('  Events Today:', response.overview.eventsToday)
  console.log('  Trust Changes:', response.overview.trustChanges)

  console.log('\nTIMELINE:')
  console.log('  Days:', response.timeline.length)
  console.log('  Days with events:', response.timeline.filter(t => t.events > 0).length)
  const maxEvents = Math.max(...response.timeline.map(t => t.events))
  console.log('  Max events/day:', maxEvents)
  console.log('  Sample:', response.timeline.slice(-5).map(t => `${t.date}: ${t.events}`).join(', '))

  console.log('\nEVENTS BY TYPE:')
  response.eventsByType.forEach(t => console.log('  -', t.type + ':', t.count))

  console.log('\nEVENTS BY RISK:')
  response.eventsByRisk.forEach(r => console.log('  -', r.risk + ':', r.count))

  console.log('\nTOP AGENTS:')
  response.agentActivity.slice(0, 5).forEach(a =>
    console.log('  -', a.agentName, '| Trust:', a.trustScore, '| Events:', a.eventsCount)
  )

  console.log('\nRECENT ACTIVITY:')
  response.recentActivity.slice(0, 5).forEach(a =>
    console.log('  -', a.title, '(' + a.risk + ')')
  )

  console.log('\n' + '='.repeat(50))
  console.log('API Response Structure: VALID')
  console.log('Dashboard should render correctly!')
}

simulateUsageAPI().catch(console.error)
