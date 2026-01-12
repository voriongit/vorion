import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPrecedentById, citePrecedent } from '@/lib/council/precedent-service'

export const dynamic = 'force-dynamic'

// GET /api/council/precedents/[id] - Get precedent details
export async function GET(
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

    const precedent = await getPrecedentById(params.id)

    if (!precedent) {
      return NextResponse.json({ error: 'Precedent not found' }, { status: 404 })
    }

    // Get citation count
    const { count } = await supabase
      .from('precedent_citations')
      .select('*', { count: 'exact', head: true })
      .eq('precedent_id', params.id)

    return NextResponse.json({
      precedent,
      citations: count || 0,
    })
  } catch (error) {
    console.error('Get precedent error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/council/precedents/[id] - Cite this precedent
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

    const body = await request.json()
    const { decisionId, context } = body

    const success = await citePrecedent(params.id, decisionId, context)

    if (!success) {
      return NextResponse.json({ error: 'Failed to cite precedent' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Precedent cited successfully',
      precedentId: params.id,
    })
  } catch (error) {
    console.error('Cite precedent error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
