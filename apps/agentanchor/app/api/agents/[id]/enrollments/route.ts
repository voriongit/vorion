import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/agents/[id]/enrollments - Get all enrollments for an agent
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

    const agentId = params.id

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, name, status')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Get all enrollments with curriculum details
    const { data: enrollments, error } = await supabase
      .from('academy_enrollments')
      .select(`
        id,
        enrolled_at,
        started_at,
        completed_at,
        status,
        progress,
        final_score,
        curriculum:academy_curriculum (
          id,
          name,
          description,
          specialization,
          difficulty_level,
          modules,
          certification_points,
          trust_points,
          estimated_duration_hours
        )
      `)
      .eq('agent_id', agentId)
      .order('enrolled_at', { ascending: false })

    if (error) {
      console.error('Error fetching enrollments:', error)
      return NextResponse.json(
        { error: 'Failed to fetch enrollments' },
        { status: 500 }
      )
    }

    // Calculate progress stats for each enrollment
    const enrichedEnrollments = enrollments?.map(enrollment => {
      const curriculum = enrollment.curriculum as any
      const modules = curriculum?.modules || []
      const progress = enrollment.progress as any
      const modulesCompleted = progress?.modules_completed?.length || 0
      const totalModules = modules.length

      return {
        ...enrollment,
        progress_stats: {
          modules_completed: modulesCompleted,
          total_modules: totalModules,
          percentage: totalModules > 0
            ? Math.round((modulesCompleted / totalModules) * 100)
            : 0,
        },
      }
    }) || []

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
      },
      enrollments: enrichedEnrollments,
      total: enrichedEnrollments.length,
    })
  } catch (error) {
    console.error('Enrollments GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
