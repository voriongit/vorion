import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Type for agent data (Supabase types not generated)
interface AgentData {
  id: string
  name: string
  status: string
  trust_score?: number
  user_id: string
}

// POST /api/agents/[id]/archive - Archive an agent
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agentId = params.id

    // Get agent and verify ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: agentData, error: agentError } = await (supabase as any)
      .from('bots')
      .select('id, name, status, user_id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agentData) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const agent = agentData as AgentData

    if (agent.status === 'archived') {
      return NextResponse.json({ error: 'Agent is already archived' }, { status: 400 })
    }

    // Archive the agent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('bots')
      .update({ status: 'archived' })
      .eq('id', agentId)

    if (updateError) {
      console.error('Error archiving agent:', updateError)
      return NextResponse.json({ error: 'Failed to archive agent' }, { status: 500 })
    }

    // Log to audit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('bot_audit_log')
      .insert({
        bot_id: agentId,
        event_type: 'archive',
        event_data: {
          previous_status: agent.status,
          new_status: 'archived',
          archived_by: user.id,
          archived_at: new Date().toISOString(),
        },
        user_id: user.id,
        hash: Buffer.from(JSON.stringify({ agent_id: agentId, action: 'archive', timestamp: Date.now() })).toString('base64'),
      })

    return NextResponse.json({
      message: 'Agent archived successfully',
      agent_id: agentId,
      agent_name: agent.name,
      previous_status: agent.status,
      new_status: 'archived',
    })
  } catch (error) {
    console.error('Archive error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/agents/[id]/archive - Restore an archived agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agentId = params.id

    // Get agent and verify ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: agentData, error: agentError } = await (supabase as any)
      .from('bots')
      .select('id, name, status, trust_score, user_id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agentData) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const agent = agentData as AgentData

    if (agent.status !== 'archived') {
      return NextResponse.json({ error: 'Agent is not archived' }, { status: 400 })
    }

    // Determine restored status based on trust score
    const restoredStatus = (agent.trust_score ?? 0) > 0 ? 'active' : 'draft'

    // Restore the agent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('bots')
      .update({ status: restoredStatus })
      .eq('id', agentId)

    if (updateError) {
      console.error('Error restoring agent:', updateError)
      return NextResponse.json({ error: 'Failed to restore agent' }, { status: 500 })
    }

    // Log to audit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('bot_audit_log')
      .insert({
        bot_id: agentId,
        event_type: 'restore',
        event_data: {
          previous_status: 'archived',
          new_status: restoredStatus,
          restored_by: user.id,
          restored_at: new Date().toISOString(),
        },
        user_id: user.id,
        hash: Buffer.from(JSON.stringify({ agent_id: agentId, action: 'restore', timestamp: Date.now() })).toString('base64'),
      })

    return NextResponse.json({
      message: 'Agent restored successfully',
      agent_id: agentId,
      agent_name: agent.name,
      previous_status: 'archived',
      new_status: restoredStatus,
    })
  } catch (error) {
    console.error('Restore error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
