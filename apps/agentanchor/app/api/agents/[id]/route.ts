import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schema for updating an agent
const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  system_prompt: z.string().min(1).max(10000).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  max_tokens: z.number().min(256).max(8192).optional(),
  specialization: z.string().optional().nullable(),
  personality_traits: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  avatar_url: z.string().url().optional().nullable(),
  is_public: z.boolean().optional(),
  status: z.enum(['draft', 'training', 'active', 'suspended', 'archived']).optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/agents/[id] - Get a specific agent
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params
    const { id } = params
    const supabase = createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch the agent - try 'agents' table first, fall back to 'bots'
    let { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single()

    if (error || !agent) {
      // Fallback to bots table for backwards compatibility
      const result = await supabase
        .from('bots')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()
      agent = result.data
      error = result.error
    }

    if (error || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Optionally include related data
    const searchParams = request.nextUrl.searchParams
    const includeEnrollments = searchParams.get('include_enrollments') === 'true'
    const includeTrustHistory = searchParams.get('include_trust_history') === 'true'

    let enrollments = null
    let trustHistory = null

    if (includeEnrollments) {
      const { data } = await supabase
        .from('academy_enrollments')
        .select('*, curriculum:academy_curriculum(*)')
        .eq('agent_id', id)
        .order('enrolled_at', { ascending: false })

      enrollments = data
    }

    if (includeTrustHistory) {
      const { data } = await supabase
        .from('trust_history')
        .select('*')
        .eq('agent_id', id)
        .order('recorded_at', { ascending: false })
        .limit(50)

      trustHistory = data
    }

    return NextResponse.json({
      ...agent,
      enrollments,
      trust_history: trustHistory,
    })
  } catch (error) {
    console.error('Agent GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/agents/[id] - Update an agent
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params
    const { id } = params
    const supabase = createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check ownership
    const { data: existingAgent, error: fetchError } = await supabase
      .from('bots')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingAgent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateAgentSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const updates = validationResult.data

    // Prevent certain status transitions
    if (updates.status) {
      const validTransitions: Record<string, string[]> = {
        draft: ['training', 'archived'],
        training: ['draft', 'active', 'archived'],
        active: ['suspended', 'archived'],
        suspended: ['active', 'archived'],
        archived: [], // Cannot transition from archived
      }

      if (existingAgent.status === 'archived') {
        return NextResponse.json(
          { error: 'Cannot modify archived agent' },
          { status: 400 }
        )
      }

      if (!validTransitions[existingAgent.status]?.includes(updates.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${existingAgent.status} to ${updates.status}` },
          { status: 400 }
        )
      }
    }

    // Update the agent
    const { data: agent, error } = await supabase
      .from('bots')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating agent:', error)
      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: 500 }
      )
    }

    return NextResponse.json(agent)
  } catch (error) {
    console.error('Agent PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/agents/[id] - Archive an agent (soft delete)
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params
    const { id } = params
    const supabase = createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Archive the agent (soft delete)
    const { data: agent, error } = await supabase
      .from('bots')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Agent archived successfully' })
  } catch (error) {
    console.error('Agent DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
