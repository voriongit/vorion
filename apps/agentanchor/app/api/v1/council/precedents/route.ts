/**
 * Precedent Flywheel API
 * Epic 14 - Stories 14-1, 14-2, 14-3
 *
 * GET /api/v1/council/precedents - Search precedents
 * POST /api/v1/council/precedents - Index precedent
 * GET /api/v1/council/precedents/similar - Find similar precedents
 * GET /api/v1/council/precedents/context - Get validator context
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  findSimilarPrecedents,
  indexPrecedent,
  indexAllPrecedents,
  buildValidatorContext,
  formatPrecedentsForPrompt,
} from '@/lib/council/precedent-flywheel'
import { searchPrecedents, getRecentPrecedents } from '@/lib/council/precedent-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Find similar precedents (semantic search)
    if (action === 'similar') {
      const query = searchParams.get('query')
      if (!query) {
        return NextResponse.json(
          { success: false, error: 'query parameter required' },
          { status: 400 }
        )
      }

      const threshold = parseFloat(searchParams.get('threshold') || '0.7')
      const limit = parseInt(searchParams.get('limit') || '5', 10)
      const actionType = searchParams.get('actionType') || undefined
      const outcomeFilter = searchParams.get('outcome') as any || undefined

      const results = await findSimilarPrecedents(query, {
        threshold,
        limit,
        actionType,
        outcomeFilter,
      })

      return NextResponse.json({
        success: true,
        data: results,
      })
    }

    // Get validator context
    if (action === 'context') {
      const actionDescription = searchParams.get('description')
      const actionType = searchParams.get('actionType')
      const riskLevel = parseInt(searchParams.get('riskLevel') || '2', 10)

      if (!actionDescription || !actionType) {
        return NextResponse.json(
          { success: false, error: 'description and actionType required' },
          { status: 400 }
        )
      }

      const context = await buildValidatorContext(actionDescription, actionType, riskLevel)
      const formattedPrompt = formatPrecedentsForPrompt(context.relevantPrecedents)

      return NextResponse.json({
        success: true,
        data: {
          ...context,
          formattedPrompt,
        },
      })
    }

    // Search precedents (keyword search)
    if (action === 'search') {
      const query = searchParams.get('query') || ''
      const actionType = searchParams.get('actionType') || undefined
      const outcome = searchParams.get('outcome') || undefined
      const category = searchParams.get('category') || undefined
      const limit = parseInt(searchParams.get('limit') || '20', 10)

      const results = await searchPrecedents(query, {
        actionType,
        outcome,
        category,
        limit,
      })

      return NextResponse.json({
        success: true,
        data: results,
      })
    }

    // Get recent precedents
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const precedents = await getRecentPrecedents(limit)

    return NextResponse.json({
      success: true,
      data: precedents,
    })
  } catch (error) {
    console.error('Error in precedents GET:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, precedentId } = body

    // Index a single precedent
    if (action === 'index' && precedentId) {
      const success = await indexPrecedent(precedentId)
      return NextResponse.json({
        success,
        message: success ? 'Precedent indexed' : 'Failed to index precedent',
      })
    }

    // Index all unindexed precedents (admin only - could add role check)
    if (action === 'index-all') {
      const result = await indexAllPrecedents()
      return NextResponse.json({
        success: true,
        data: result,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in precedents POST:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
