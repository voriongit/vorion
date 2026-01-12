import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/academy/curriculum/[id] - Get single curriculum with full details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params

    // Get curriculum details
    const { data: curriculum, error } = await supabase
      .from('academy_curriculum')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error || !curriculum) {
      return NextResponse.json(
        { error: 'Curriculum not found' },
        { status: 404 }
      )
    }

    // Get enrollment stats for this curriculum
    const { count: totalEnrollments } = await supabase
      .from('academy_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('curriculum_id', id)

    const { count: completedEnrollments } = await supabase
      .from('academy_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('curriculum_id', id)
      .eq('status', 'completed')

    return NextResponse.json({
      ...(curriculum as Record<string, unknown>),
      stats: {
        total_enrollments: totalEnrollments || 0,
        completed: completedEnrollments || 0,
        completion_rate: totalEnrollments
          ? Math.round((completedEnrollments || 0) / totalEnrollments * 100)
          : 0,
      },
    })
  } catch (error) {
    console.error('Curriculum GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
