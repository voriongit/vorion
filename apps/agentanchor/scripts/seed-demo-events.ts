/**
 * AgentAnchor - Demo Events Seeder
 *
 * Creates demo observer events and trust history
 * for testing the usage analytics dashboard
 *
 * Usage:
 *   npx tsx scripts/seed-demo-events.ts
 *
 * Options:
 *   --clear   Remove existing demo events first
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

config({ path: '.env.local' })

const CLEAR_FIRST = process.argv.includes('--clear')
const OWNER_ID = 'c8325d64-d6aa-42c9-a64d-ea4c9f8cc495'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Event types and their risk levels
const eventTemplates = [
  { type: 'task_completed', risk: 'low', desc: 'Successfully completed assigned task' },
  { type: 'task_failed', risk: 'medium', desc: 'Task execution failed' },
  { type: 'decision_made', risk: 'low', desc: 'Autonomous decision executed' },
  { type: 'escalation_triggered', risk: 'high', desc: 'Action escalated to council' },
  { type: 'compliance_check', risk: 'low', desc: 'Routine compliance verification' },
  { type: 'anomaly_detected', risk: 'high', desc: 'Unusual behavior pattern detected' },
  { type: 'api_call', risk: 'low', desc: 'External API integration' },
  { type: 'user_interaction', risk: 'low', desc: 'User engagement recorded' },
  { type: 'resource_access', risk: 'medium', desc: 'Protected resource accessed' },
  { type: 'trust_updated', risk: 'low', desc: 'Trust score recalculated' },
]

const trustReasons = [
  'Task completed successfully',
  'Positive user feedback received',
  'Compliance check passed',
  'Consistent performance maintained',
  'Trust decay adjustment',
  'Council review outcome applied',
  'Anomaly resolved successfully',
  'Quality threshold exceeded',
  'Response time improved',
  'Error rate decreased',
]

function randomDate(daysBack: number): Date {
  const now = new Date()
  return new Date(now.getTime() - Math.random() * daysBack * 24 * 60 * 60 * 1000)
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateHash(data: object): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
}

function getTrustTier(score: number): string {
  if (score >= 900) return 'legendary'
  if (score >= 800) return 'elite'
  if (score >= 600) return 'trusted'
  if (score >= 400) return 'proven'
  if (score >= 200) return 'novice'
  return 'untrusted'
}

async function seedEvents() {
  console.log('🌱 AgentAnchor - Demo Events Seeder\n')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase credentials not configured')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })

  // Get agents
  const { data: agents } = await supabase
    .from('bots')
    .select('id, name, trust_score')
    .eq('user_id', OWNER_ID)
    .neq('status', 'archived')

  if (!agents || agents.length === 0) {
    console.error('❌ No agents found. Run seed-demo-agents.ts first.')
    process.exit(1)
  }

  console.log(`📋 Found ${agents.length} agents\n`)

  // Clear existing events if requested
  if (CLEAR_FIRST) {
    console.log('🗑️  Clearing existing events...')
    const agentIds = agents.map(a => a.id)

    const { error: evErr } = await supabase.from('observer_events').delete().in('agent_id', agentIds)
    if (evErr) console.log('   observer_events clear error:', evErr.message)

    const { error: thErr } = await supabase.from('trust_history').delete().in('agent_id', agentIds)
    if (thErr) console.log('   trust_history clear error:', thErr.message)

    console.log('   Done\n')
  }

  const results = {
    observerEvents: 0,
    trustHistory: 0,
    errors: 0,
  }

  // Seed observer events for each agent
  console.log('📊 Creating observer events...')

  let globalSequence = Date.now()
  let previousHash = '0'.repeat(64)

  for (const agent of agents) {
    // Number of events based on trust score (higher trust = more activity)
    const baseEvents = 10 + Math.floor(agent.trust_score / 100)
    const eventCount = baseEvents + Math.floor(Math.random() * 15)
    let agentEvents = 0

    for (let i = 0; i < eventCount; i++) {
      const template = randomElement(eventTemplates)
      const createdAt = randomDate(30)
      const eventData = {
        agent_id: agent.id,
        event_type: template.type,
        description: template.desc,
        timestamp: createdAt.toISOString(),
      }

      const hash = generateHash({ ...eventData, sequence: globalSequence, prev: previousHash })

      const { error } = await supabase.from('observer_events').insert({
        agent_id: agent.id,
        event_type: template.type,
        source: 'system',
        risk_level: template.risk,
        sequence: globalSequence++,
        data: eventData,
        previous_hash: previousHash,
        hash: hash,
        signature: hash, // Using hash as signature for demo
        created_at: createdAt.toISOString(),
      })

      if (error) {
        results.errors++
      } else {
        results.observerEvents++
        agentEvents++
        previousHash = hash
      }
    }

    console.log(`   ${agent.name}: ${agentEvents} events`)
  }

  // Seed trust history
  console.log('\n📈 Creating trust history...')

  for (const agent of agents) {
    // Create 5-12 trust history entries over the past 30 days
    const historyCount = 5 + Math.floor(Math.random() * 7)
    let currentScore = Math.max(0, agent.trust_score - Math.floor(Math.random() * 150))
    let agentHistory = 0

    for (let i = 0; i < historyCount; i++) {
      const previousScore = currentScore
      const change = Math.floor(Math.random() * 40) - 5 // -5 to +35 (trending up)
      currentScore = Math.max(0, Math.min(1000, currentScore + change))
      const createdAt = randomDate(30)

      const { error } = await supabase.from('trust_history').insert({
        agent_id: agent.id,
        score: currentScore,
        tier: getTrustTier(currentScore),
        previous_score: previousScore,
        change_amount: change,
        reason: randomElement(trustReasons),
        source: 'initial',
        recorded_at: createdAt.toISOString(),
      })

      if (error) {
        results.errors++
      } else {
        results.trustHistory++
        agentHistory++
      }
    }

    console.log(`   ${agent.name}: ${agentHistory} entries`)
  }

  // Summary
  console.log('\n📊 Seed Summary')
  console.log(`   Observer Events: ${results.observerEvents}`)
  console.log(`   Trust History: ${results.trustHistory}`)
  console.log(`   Errors: ${results.errors}`)

  if (results.errors > 0) {
    console.log('\n⚠️  Some errors occurred during seeding')
  }

  console.log('\n✅ Demo events ready for usage dashboard!')
}

seedEvents().catch(console.error)
