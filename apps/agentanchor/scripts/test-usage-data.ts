/**
 * Test Usage Dashboard Data
 * Verifies the seeded demo data is accessible
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const OWNER_ID = 'c8325d64-d6aa-42c9-a64d-ea4c9f8cc495'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function testUsageData() {
  console.log('Testing Usage Dashboard Data\n')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase credentials not configured')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })

  // 1. Test agents (bots table)
  console.log('AGENTS (bots table):')
  const { data: agents, error: agentsErr } = await supabase
    .from('bots')
    .select('id, name, trust_score, status')
    .eq('user_id', OWNER_ID)

  if (agentsErr) {
    console.log('   Error:', agentsErr.message)
  } else {
    const totalAgents = agents?.length || 0
    const activeAgents = agents?.filter(a => a.status === 'active').length || 0
    console.log('   Total:', totalAgents)
    console.log('   Active:', activeAgents)
    agents?.slice(0, 3).forEach(a => console.log('      -', a.name, '(' + a.trust_score + ')'))
    if (totalAgents > 3) console.log('      ... and', totalAgents - 3, 'more')
  }

  const agentIds = agents?.map(a => a.id) || []

  // 2. Test observer_events
  console.log('\nOBSERVER EVENTS:')
  if (agentIds.length > 0) {
    const { count: totalEvents } = await supabase
      .from('observer_events')
      .select('*', { count: 'exact', head: true })
      .in('agent_id', agentIds)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { count: todayEvents } = await supabase
      .from('observer_events')
      .select('*', { count: 'exact', head: true })
      .in('agent_id', agentIds)
      .gte('created_at', todayStart.toISOString())

    console.log('   Total events:', totalEvents || 0)
    console.log('   Events today:', todayEvents || 0)

    // Events by type
    const { data: typeData } = await supabase
      .from('observer_events')
      .select('event_type')
      .in('agent_id', agentIds)

    if (typeData) {
      const typeCount: Record<string, number> = {}
      typeData.forEach(e => {
        typeCount[e.event_type] = (typeCount[e.event_type] || 0) + 1
      })
      console.log('   Event types:', Object.keys(typeCount).length)
      Object.entries(typeCount).forEach(([type, count]) => {
        console.log('      -', type + ':', count)
      })
    }

    // Events by risk
    const { data: riskData } = await supabase
      .from('observer_events')
      .select('risk_level')
      .in('agent_id', agentIds)

    if (riskData) {
      const riskCount: Record<string, number> = {}
      riskData.forEach(e => {
        riskCount[e.risk_level] = (riskCount[e.risk_level] || 0) + 1
      })
      console.log('   Risk breakdown:')
      Object.entries(riskCount).forEach(([risk, count]) => {
        console.log('      -', risk + ':', count)
      })
    }
  } else {
    console.log('   No agents found')
  }

  // 3. Test trust_history
  console.log('\nTRUST HISTORY:')
  if (agentIds.length > 0) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: trustChanges } = await supabase
      .from('trust_history')
      .select('*', { count: 'exact', head: true })
      .in('agent_id', agentIds)
      .gte('recorded_at', thirtyDaysAgo.toISOString())

    console.log('   Trust changes (30 days):', trustChanges || 0)

    // Recent trust history
    const { data: recentTrust } = await supabase
      .from('trust_history')
      .select('score, tier, reason')
      .in('agent_id', agentIds)
      .order('recorded_at', { ascending: false })
      .limit(3)

    if (recentTrust && recentTrust.length > 0) {
      console.log('   Recent entries:')
      recentTrust.forEach(t => {
        console.log('      -', t.tier, '(' + t.score + '):', t.reason)
      })
    }
  }

  // 4. Test recent activity
  console.log('\nRECENT ACTIVITY:')
  if (agentIds.length > 0) {
    const { data: recentEvents } = await supabase
      .from('observer_events')
      .select('event_type, risk_level, created_at')
      .in('agent_id', agentIds)
      .order('created_at', { ascending: false })
      .limit(5)

    if (recentEvents && recentEvents.length > 0) {
      console.log('   Latest events:')
      recentEvents.forEach(e => {
        const date = new Date(e.created_at).toLocaleDateString()
        console.log('      -', e.event_type, '(' + e.risk_level + ') -', date)
      })
    }
  }

  console.log('\nUsage dashboard data test complete!')
}

testUsageData().catch(console.error)
