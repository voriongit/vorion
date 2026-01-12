/**
 * Agent Acquisition API
 * POST - Acquire an agent (commission, clone, or enterprise)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { WalletService } from '@/lib/credits/wallet-service'
import type { AcquisitionModel } from '@/lib/credits/types'

// Admin client for reading agents (bypasses RLS)
function getSupabaseAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const DEFAULT_PRICING = {
  commission: 5,
  clone: 150,
  enterprise: 2000,
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { agentId, model } = body as { agentId: string; model: AcquisitionModel }

    if (!agentId || !model) {
      return NextResponse.json({ error: 'agentId and model are required' }, { status: 400 })
    }

    if (!['commission', 'clone', 'enterprise'].includes(model)) {
      return NextResponse.json({ error: 'Invalid acquisition model' }, { status: 400 })
    }

    // Get agent details using admin client (bypasses RLS)
    const adminClient = getSupabaseAdmin()
    const { data: agent, error: agentError } = await adminClient
      .from('agents')
      .select('id, name, owner_id, system_prompt, config, metadata, trust_score, model, description, specialization, capabilities, personality_traits')
      .eq('id', agentId)
      .eq('status', 'active')
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Can't acquire your own agent
    if (agent.owner_id === user.id) {
      return NextResponse.json({ error: 'Cannot acquire your own agent' }, { status: 400 })
    }

    // Get price for selected model
    const price = DEFAULT_PRICING[model]

    // Check if user can afford
    const canAfford = await WalletService.canAfford(user.id, price)
    if (!canAfford) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 })
    }

    let resultAgentId = agentId
    let acquisitionId: string | undefined

    // Process based on model
    switch (model) {
      case 'commission': {
        // Create subscription
        const { data: subscription, error: subError } = await supabase
          .from('agent_subscriptions')
          .insert({
            user_id: user.id,
            agent_id: agentId,
            status: 'active',
            billing_type: 'per_task',
            rate: price,
          })
          .select('id')
          .single()

        if (subError) {
          // Check if already subscribed
          if (subError.code === '23505') {
            return NextResponse.json({ error: 'Already subscribed to this agent' }, { status: 400 })
          }
          throw subError
        }

        acquisitionId = subscription.id

        // Debit initial task credit
        const debitResult = await WalletService.debit(
          user.id,
          price,
          'commission_paid',
          `Subscription to ${agent.name}`,
          'subscription',
          subscription.id
        )

        if (!debitResult.success) {
          // Rollback subscription
          await supabase.from('agent_subscriptions').delete().eq('id', subscription.id)
          return NextResponse.json({ error: debitResult.error }, { status: 400 })
        }

        // Credit trainer
        if (agent.owner_id) {
          await WalletService.processRevenueSplit(agent.owner_id, price, 'commission_earned', subscription.id)
        }

        break
      }

      case 'clone': {
        // Debit clone price
        const debitResult = await WalletService.debit(
          user.id,
          price,
          'clone_purchase',
          `Clone of ${agent.name}`,
          'acquisition'
        )

        if (!debitResult.success) {
          return NextResponse.json({ error: debitResult.error }, { status: 400 })
        }

        // Create clone agent
        const { data: clonedAgent, error: cloneError } = await supabase
          .from('agents')
          .insert({
            owner_id: user.id,
            name: `${agent.name} (Clone)`,
            description: agent.description,
            system_prompt: agent.system_prompt,
            model: agent.model,
            config: agent.config,
            metadata: {
              ...agent.metadata,
              cloned_from: agentId,
              cloned_at: new Date().toISOString(),
            },
            status: 'active',
            trust_score: 50, // Clones start with base trust
            specialization: agent.specialization,
            capabilities: agent.capabilities,
            personality_traits: agent.personality_traits,
          })
          .select('id')
          .single()

        if (cloneError) {
          // Refund on failure
          await WalletService.credit(user.id, price, 'refund', `Clone failed - refund for ${agent.name}`)
          throw cloneError
        }

        resultAgentId = clonedAgent.id
        acquisitionId = clonedAgent.id

        // Record clone
        await supabase.from('agent_clones').insert({
          original_agent_id: agentId,
          cloned_agent_id: clonedAgent.id,
          cloned_by: user.id,
          clone_price: price,
        })

        // Credit trainer
        if (agent.owner_id) {
          await WalletService.processRevenueSplit(agent.owner_id, price, 'clone_sale', clonedAgent.id)
        }

        break
      }

      case 'enterprise': {
        // Debit enterprise price
        const debitResult = await WalletService.debit(
          user.id,
          price,
          'enterprise_purchase',
          `Full ownership of ${agent.name}`,
          'acquisition',
          agentId
        )

        if (!debitResult.success) {
          return NextResponse.json({ error: debitResult.error }, { status: 400 })
        }

        // Transfer ownership
        const { error: transferError } = await supabase
          .from('agents')
          .update({
            owner_id: user.id,
            metadata: {
              ...agent.metadata,
              previous_owner: agent.owner_id,
              transferred_at: new Date().toISOString(),
            },
          })
          .eq('id', agentId)

        if (transferError) {
          // Refund on failure
          await WalletService.credit(user.id, price, 'refund', `Transfer failed - refund for ${agent.name}`)
          throw transferError
        }

        acquisitionId = agentId

        // Credit previous owner
        if (agent.owner_id) {
          await WalletService.processRevenueSplit(agent.owner_id, price, 'enterprise_sale', agentId)
        }

        break
      }
    }

    // Record acquisition (table might not exist yet, that's ok)
    try {
      await supabase.from('marketplace_acquisitions').insert({
        agent_id: agentId,
        buyer_id: user.id,
        seller_id: agent.owner_id,
        acquisition_type: model,
        price_paid: price,
        currency: 'AC',
        status: 'completed',
      })
    } catch {
      // Table might not exist yet
    }

    return NextResponse.json({
      success: true,
      model,
      agentId: resultAgentId,
      acquisitionId,
      message: model === 'commission'
        ? 'Subscription activated! You can now use this agent.'
        : model === 'clone'
        ? 'Clone created! Find it in your agents.'
        : 'Ownership transferred! The agent is now yours.',
    })
  } catch (error: any) {
    console.error('Acquisition error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
