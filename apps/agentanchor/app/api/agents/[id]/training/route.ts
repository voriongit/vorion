import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET /api/agents/[id]/training - Get training state for agent
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

    const agentId = params.id

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, name, status, trust_score, trust_tier')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Get all enrollments with curriculum details
    const { data: enrollments, error: enrollmentsError } = await supabase
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

    if (enrollmentsError) {
      console.error('Error fetching enrollments:', enrollmentsError)
      return NextResponse.json({ error: 'Failed to fetch training data' }, { status: 500 })
    }

    // Enrich enrollments with computed progress
    const enrichedEnrollments = enrollments?.map(enrollment => {
      const curriculum = enrollment.curriculum as any
      const modules = curriculum?.modules || []
      const progress = enrollment.progress as any
      const modulesCompleted = progress?.modules_completed || []

      // Calculate module states
      const moduleStates = modules.map((module: any, index: number) => {
        const isCompleted = modulesCompleted.includes(module.id)
        const isCurrent = progress?.current_module === module.id
        const previousCompleted = index === 0 || modulesCompleted.includes(modules[index - 1]?.id)
        const isLocked = !isCompleted && !isCurrent && !previousCompleted

        return {
          ...module,
          state: isCompleted ? 'completed' : isCurrent ? 'current' : isLocked ? 'locked' : 'available',
          score: progress?.scores?.[module.id] || null,
        }
      })

      const completedCount = modulesCompleted.length
      const totalModules = modules.length
      const isReadyForExam = completedCount === totalModules && totalModules > 0

      return {
        ...enrollment,
        modules: moduleStates,
        progress_stats: {
          completed: completedCount,
          total: totalModules,
          percentage: totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0,
          ready_for_exam: isReadyForExam,
        },
      }
    }) || []

    // Find active enrollment (in_progress status)
    const activeEnrollment = enrichedEnrollments.find(e => e.status === 'in_progress')

    return NextResponse.json({
      agent,
      enrollments: enrichedEnrollments,
      active_enrollment: activeEnrollment || null,
      stats: {
        total_enrollments: enrichedEnrollments.length,
        completed: enrichedEnrollments.filter(e => e.status === 'completed').length,
        in_progress: enrichedEnrollments.filter(e => e.status === 'in_progress').length,
      },
    })
  } catch (error) {
    console.error('Training GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Start module schema
const startModuleSchema = z.object({
  enrollmentId: z.string().uuid(),
  moduleId: z.string(),
})

// POST /api/agents/[id]/training - Start a module
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
    const body = await request.json()

    // Check action type
    const action = body.action || 'start_module'

    if (action === 'start_module') {
      const validation = startModuleSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json({ error: 'Invalid input', details: validation.error.errors }, { status: 400 })
      }

      const { enrollmentId, moduleId } = validation.data

      // Get enrollment and verify ownership
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('academy_enrollments')
        .select(`
          *,
          curriculum:academy_curriculum (modules),
          agent:bots!inner (user_id)
        `)
        .eq('id', enrollmentId)
        .eq('agent_id', agentId)
        .single()

      if (enrollmentError || !enrollment) {
        return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
      }

      if ((enrollment.agent as any).user_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      const modules = (enrollment.curriculum as any)?.modules || []
      const progress = enrollment.progress as any
      const modulesCompleted = progress?.modules_completed || []

      // Find module index
      const moduleIndex = modules.findIndex((m: any) => m.id === moduleId)
      if (moduleIndex === -1) {
        return NextResponse.json({ error: 'Module not found' }, { status: 404 })
      }

      // Check if module is already completed
      if (modulesCompleted.includes(moduleId)) {
        return NextResponse.json({ error: 'Module already completed' }, { status: 400 })
      }

      // Check if previous module is completed (unless first module)
      if (moduleIndex > 0) {
        const prevModuleId = modules[moduleIndex - 1].id
        if (!modulesCompleted.includes(prevModuleId)) {
          return NextResponse.json({ error: 'Previous module not completed' }, { status: 400 })
        }
      }

      // Update progress
      const newProgress = {
        ...progress,
        current_module: moduleId,
        modules_completed: modulesCompleted,
      }

      // Update enrollment
      const updates: any = {
        progress: newProgress,
      }

      // Set started_at if first time
      if (!enrollment.started_at) {
        updates.started_at = new Date().toISOString()
      }

      // Update status to in_progress if currently enrolled
      if (enrollment.status === 'enrolled') {
        updates.status = 'in_progress'
      }

      const { error: updateError } = await supabase
        .from('academy_enrollments')
        .update(updates)
        .eq('id', enrollmentId)

      if (updateError) {
        console.error('Error updating enrollment:', updateError)
        return NextResponse.json({ error: 'Failed to start module' }, { status: 500 })
      }

      // Update agent status if needed
      const { data: agent } = await supabase
        .from('bots')
        .select('status')
        .eq('id', agentId)
        .single()

      if (agent?.status === 'draft') {
        await supabase
          .from('bots')
          .update({ status: 'training' })
          .eq('id', agentId)
      }

      return NextResponse.json({
        message: 'Module started',
        module: modules[moduleIndex],
        progress: newProgress,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Training POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
