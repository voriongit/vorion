/**
 * Marketplace Listings API
 * Story 6-1: Agent Publishing (FR12, FR13)
 * Story 6-2: Marketplace Browse & Search (FR23, FR24, FR106)
 *
 * GET  /api/marketplace/listings - Search/browse listings
 * POST /api/marketplace/listings - Create new listing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  searchListings,
  createListing,
  getCategories,
  getFeaturedListings,
  getTopRatedListings,
} from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

const createListingSchema = z.object({
  agent_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().min(10),
  short_description: z.string().max(500).optional(),
  category: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  commission_rate: z.number().min(0.001).max(10),
  complexity_multiplier: z.number().min(0.5).max(5).optional().default(1.0),
})

// GET /api/marketplace/listings - Search/browse listings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Special endpoints
    const featured = searchParams.get('featured')
    const topRated = searchParams.get('top_rated')
    const categories = searchParams.get('categories')

    if (categories === 'true') {
      const cats = await getCategories()
      return NextResponse.json({ categories: cats })
    }

    if (featured === 'true') {
      const limit = parseInt(searchParams.get('limit') || '6')
      const listings = await getFeaturedListings(limit)
      return NextResponse.json({ listings })
    }

    if (topRated === 'true') {
      const limit = parseInt(searchParams.get('limit') || '6')
      const listings = await getTopRatedListings(limit)
      return NextResponse.json({ listings })
    }

    // Search params
    const query = searchParams.get('query') || undefined
    const category = searchParams.get('category') || undefined
    const minTrustScore = searchParams.get('min_trust_score')
      ? parseInt(searchParams.get('min_trust_score')!)
      : undefined
    const maxCommission = searchParams.get('max_commission')
      ? parseFloat(searchParams.get('max_commission')!)
      : undefined
    const minRating = searchParams.get('min_rating')
      ? parseFloat(searchParams.get('min_rating')!)
      : undefined
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || undefined
    const sortBy = searchParams.get('sort_by') as any || 'newest'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const result = await searchListings({
      query,
      category,
      min_trust_score: minTrustScore,
      max_commission: maxCommission,
      min_rating: minRating,
      tags,
      sort_by: sortBy,
      limit,
      offset,
    })

    return NextResponse.json({
      listings: result.listings,
      total: result.total,
      limit,
      offset,
      has_more: offset + result.listings.length < result.total,
    })
  } catch (error) {
    console.error('Marketplace search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/marketplace/listings - Create new listing
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
    const validation = createListingSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    // Get user subscription tier (default to free)
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    const tier = (profile?.subscription_tier || 'free') as 'free' | 'pro' | 'enterprise'

    const listing = await createListing(user.id, validation.data, tier)

    return NextResponse.json({ listing }, { status: 201 })
  } catch (error: any) {
    console.error('Create listing error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message?.includes('not found') ? 404 : 400 }
    )
  }
}
