import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/academy/curriculum - List all active curriculum tracks
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

    // Parse query params for filtering
    const searchParams = request.nextUrl.searchParams
    const specialization = searchParams.get('specialization')

    // Build query for active curriculum
    let query = supabase
      .from('academy_curriculum')
      .select('*')
      .eq('is_active', true)
      .order('difficulty_level', { ascending: true })
      .order('name', { ascending: true })

    // Filter by specialization if provided
    if (specialization && specialization !== 'all') {
      query = query.eq('specialization', specialization)
    }

    const { data: curriculum, error } = await query

    if (error) {
      console.error('Error fetching curriculum:', error)
      return NextResponse.json(
        { error: 'Failed to fetch curriculum' },
        { status: 500 }
      )
    }

    // Cast to expected type (Supabase types not generated)
    const curriculumData = curriculum as Array<Record<string, unknown>> | null

    // Get unique specializations for filter UI
    const specializations = [...new Set(curriculumData?.map(c => c.specialization as string) || [])]

    return NextResponse.json({
      curriculum: curriculumData || [],
      specializations,
    })
  } catch (error) {
    console.error('Curriculum GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
