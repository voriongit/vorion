/**
 * Add Agent to My Agents API
 * POST - Add an agent to user's collection (free for dev)
 * Creates a subscription without charging credits
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Admin client for reading agents (bypasses RLS)
function getSupabaseAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { agentId } = body as { agentId: string }

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    // Get agent details using admin client (bypasses RLS)
    const adminClient = getSupabaseAdmin()
    const { data: agent, error: agentError } = await adminClient
      .from('agents')
      .select('id, name, owner_id')
      .eq('id', agentId)
      .eq('status', 'active')
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Can't add your own agent
    if (agent.owner_id === user.id) {
      return NextResponse.json({
        error: 'This is already your agent',
        alreadyOwned: true
      }, { status: 400 })
    }

    // Check if already subscribed
    const { data: existing } = await supabase
      .from('agent_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('agent_id', agentId)
      .eq('status', 'active')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Already added to your agents',
        alreadyAdded: true,
        subscriptionId: existing.id
      })
    }

    // Create free subscription
    const { data: subscription, error: subError } = await supabase
      .from('agent_subscriptions')
      .insert({
        user_id: user.id,
        agent_id: agentId,
        status: 'active',
        billing_type: 'free',
        rate: 0,
      })
      .select('id')
      .single()

    if (subError) {
      console.error('Subscription error:', subError)
      return NextResponse.json({
        error: 'Failed to add agent',
        details: subError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${agent.name} added to your agents!`,
      subscriptionId: subscription.id,
    })
  } catch (error: any) {
    console.error('Add agent error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
