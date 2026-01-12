import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schema for creating an agent
const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  system_prompt: z.string().min(1).max(10000),
  model: z.string().default('claude-sonnet-4-20250514'),
  temperature: z.number().min(0).max(1).default(0.7),
  max_tokens: z.number().min(256).max(8192).default(4096),
  specialization: z.string().optional(),
  personality_traits: z.array(z.string()).default([]),
  capabilities: z.array(z.string()).default([]),
  // Extra config from frontend form
  config: z.object({
    guardrails: z.any().optional(),
    governance: z.any().optional(),
  }).optional(),
})

// GET /api/agents - List all agents for the current user
export async function GET(request: NextRequest) {
  try {
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

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '20')
    const offset = (page - 1) * perPage

    // Build query
    let query = supabase
      .from('bots')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Filter by status if provided
    if (status && status !== 'all') {
      query = query.eq('status', status)
    } else {
      // By default, exclude archived agents
      query = query.neq('status', 'archived')
    }

    // Pagination
    query = query.range(offset, offset + perPage - 1)

    const { data: agents, error, count } = await query

    if (error) {
      console.error('Error fetching agents:', error)
      return NextResponse.json(
        { error: 'Failed to fetch agents' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      agents: agents || [],
      total: count || 0,
      page,
      per_page: perPage,
    })
  } catch (error) {
    console.error('Agents GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
  try {
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

    // Parse and validate request body
    const body = await request.json()
    const validationResult = createAgentSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const input = validationResult.data

    // Create the agent with governance defaults
    const { data: agent, error } = await supabase
      .from('bots')
      .insert({
        user_id: user.id,
        name: input.name,
        description: input.description || null,
        system_prompt: input.system_prompt,
        model: input.model,
        temperature: input.temperature,
        max_tokens: input.max_tokens,
        specialization: input.specialization || null,
        personality_traits: input.personality_traits,
        capabilities: input.capabilities,
        // Store extra config (guardrails, governance)
        config: input.config || null,
        // Governance defaults
        trust_score: 0,
        trust_tier: 'untrusted',
        certification_level: 0,
        status: 'draft',
        maintenance_flag: 'author',
        published: false,
        is_public: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating agent:', error)
      return NextResponse.json(
        { error: 'Failed to create agent' },
        { status: 500 }
      )
    }

    // Record initial trust history
    await supabase.from('trust_history').insert({
      agent_id: agent.id,
      score: 0,
      tier: 'untrusted',
      previous_score: null,
      change_amount: 0,
      reason: 'Agent created',
      source: 'initial',
    })

    return NextResponse.json(agent, { status: 201 })
  } catch (error) {
    console.error('Agents POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
