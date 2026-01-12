import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  searchPrecedents,
  getRecentPrecedents,
  getMostCitedPrecedents,
  createPrecedent,
  CreatePrecedentInput,
} from '@/lib/council/precedent-service'
import { RiskLevel } from '@/lib/council/types'

export const dynamic = 'force-dynamic'

const createPrecedentSchema = z.object({
  title: z.string().min(1).max(255),
  summary: z.string().min(1),
  actionType: z.string().min(1),
  riskLevel: z.number().min(0).max(4).transform(n => n as RiskLevel),
  outcome: z.enum(['approved', 'denied', 'escalated']),
  reasoning: z.string().min(1),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  contextSummary: z.string().optional(),
})

// GET /api/council/precedents - Search or list precedents
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const actionType = searchParams.get('actionType') || undefined
    const outcome = searchParams.get('outcome') || undefined
    const riskLevel = searchParams.get('riskLevel')
    const category = searchParams.get('category') || undefined
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)
    const sort = searchParams.get('sort') || 'recent' // 'recent' | 'cited'
    const limit = parseInt(searchParams.get('limit') || '20')

    let precedents

    if (query || actionType || outcome || riskLevel || category || tags) {
      // Search with filters
      precedents = await searchPrecedents(query, {
        actionType,
        outcome,
        riskLevel: riskLevel ? parseInt(riskLevel) as any : undefined,
        category,
        tags,
        limit,
      })
    } else if (sort === 'cited') {
      // Most cited
      precedents = await getMostCitedPrecedents(limit)
    } else {
      // Recent
      precedents = await getRecentPrecedents(limit)
    }

    return NextResponse.json({
      precedents,
      total: precedents.length,
      query: query || null,
      filters: {
        actionType,
        outcome,
        riskLevel: riskLevel ? parseInt(riskLevel) : null,
        category,
        tags,
      },
    })
  } catch (error) {
    console.error('Precedents error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/council/precedents - Create a new precedent (admin/system use)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createPrecedentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const precedent = await createPrecedent(validation.data)

    if (!precedent) {
      return NextResponse.json({ error: 'Failed to create precedent' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Precedent created successfully',
      precedent,
    }, { status: 201 })
  } catch (error) {
    console.error('Create precedent error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
