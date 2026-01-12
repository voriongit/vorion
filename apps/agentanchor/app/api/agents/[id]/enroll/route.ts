import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Validation schema for enrollment
const enrollSchema = z.object({
  curriculumId: z.string().uuid(),
})

// POST /api/agents/[id]/enroll - Enroll agent in curriculum
export async function POST(
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
      .select('*')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = enrollSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { curriculumId } = validationResult.data

    // Verify curriculum exists and is active
    const { data: curriculum, error: curriculumError } = await supabase
      .from('academy_curriculum')
      .select('*')
      .eq('id', curriculumId)
      .eq('is_active', true)
      .single()

    if (curriculumError || !curriculum) {
      return NextResponse.json(
        { error: 'Curriculum not found or inactive' },
        { status: 404 }
      )
    }

    // Check for prerequisites
    if (curriculum.prerequisites && curriculum.prerequisites.length > 0) {
      const { data: completedCourses } = await supabase
        .from('academy_enrollments')
        .select('curriculum_id')
        .eq('agent_id', agentId)
        .eq('status', 'completed')

      const completedIds = completedCourses?.map(c => c.curriculum_id) || []
      const missingPrereqs = curriculum.prerequisites.filter(
        (prereq: string) => !completedIds.includes(prereq)
      )

      if (missingPrereqs.length > 0) {
        // Get names of missing prerequisites
        const { data: missingCourses } = await supabase
          .from('academy_curriculum')
          .select('name')
          .in('id', missingPrereqs)

        return NextResponse.json(
          {
            error: 'Prerequisites not met',
            missing: missingCourses?.map(c => c.name) || missingPrereqs,
          },
          { status: 400 }
        )
      }
    }

    // Check if already enrolled
    const { data: existingEnrollment } = await supabase
      .from('academy_enrollments')
      .select('id, status')
      .eq('agent_id', agentId)
      .eq('curriculum_id', curriculumId)
      .single()

    if (existingEnrollment) {
      if (existingEnrollment.status === 'completed') {
        return NextResponse.json(
          { error: 'Agent has already completed this curriculum' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Agent is already enrolled in this curriculum' },
        { status: 400 }
      )
    }

    // Create enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('academy_enrollments')
      .insert({
        agent_id: agentId,
        curriculum_id: curriculumId,
        status: 'enrolled',
        progress: {
          modules_completed: [],
          current_module: null,
          scores: {},
          attempts: 0,
        },
      })
      .select()
      .single()

    if (enrollmentError) {
      console.error('Error creating enrollment:', enrollmentError)
      return NextResponse.json(
        { error: 'Failed to create enrollment' },
        { status: 500 }
      )
    }

    // Update agent status to "training" if currently "draft"
    if (agent.status === 'draft') {
      await supabase
        .from('bots')
        .update({ status: 'training' })
        .eq('id', agentId)
    }

    return NextResponse.json({
      enrollment,
      curriculum: {
        id: curriculum.id,
        name: curriculum.name,
        specialization: curriculum.specialization,
        difficulty_level: curriculum.difficulty_level,
        modules: curriculum.modules,
      },
      message: `Successfully enrolled in ${curriculum.name}`,
    }, { status: 201 })
  } catch (error) {
    console.error('Enrollment POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
