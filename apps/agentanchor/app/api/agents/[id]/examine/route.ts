import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluateExamination } from '@/lib/council'

export const dynamic = 'force-dynamic'

// POST /api/agents/[id]/examine - Request Council examination for graduation
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

    // Get agent and verify ownership
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, name, status, trust_score, user_id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Get active enrollment that's ready for examination
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('academy_enrollments')
      .select(`
        *,
        curriculum:academy_curriculum (
          id,
          name,
          modules,
          trust_points,
          certification_points
        )
      `)
      .eq('agent_id', agentId)
      .eq('status', 'in_progress')
      .single()

    if (enrollmentError || !enrollment) {
      return NextResponse.json(
        { error: 'No active enrollment found' },
        { status: 400 }
      )
    }

    const curriculum = enrollment.curriculum as any
    const modules = curriculum?.modules || []
    const progress = enrollment.progress as any
    const modulesCompleted = progress?.modules_completed || []

    // Check if all modules are complete
    if (modulesCompleted.length < modules.length) {
      return NextResponse.json(
        {
          error: 'Curriculum not complete',
          completed: modulesCompleted.length,
          required: modules.length,
        },
        { status: 400 }
      )
    }

    // Check for recent failed examination (24-hour cooldown)
    const { data: recentExam } = await supabase
      .from('council_examinations')
      .select('*')
      .eq('agent_id', agentId)
      .eq('curriculum_id', curriculum.id)
      .eq('outcome', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (recentExam) {
      const examDate = new Date(recentExam.created_at)
      const cooldownEnd = new Date(examDate.getTime() + 24 * 60 * 60 * 1000)

      if (new Date() < cooldownEnd) {
        return NextResponse.json(
          {
            error: 'Examination on cooldown',
            cooldownEnds: cooldownEnd.toISOString(),
            message: 'Please wait 24 hours after a failed examination to retry',
          },
          { status: 429 }
        )
      }
    }

    // Calculate average score from modules
    const scores = progress?.scores || {}
    const scoreValues = Object.values(scores) as number[]
    const averageScore = scoreValues.length > 0
      ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
      : 0

    // Submit to Council for examination
    const councilDecision = await evaluateExamination(
      agentId,
      curriculum.name,
      {
        modulesCompleted: modulesCompleted.length,
        totalModules: modules.length,
        averageScore,
      }
    )

    // Store examination result
    const { data: examination, error: examError } = await supabase
      .from('council_examinations')
      .insert({
        agent_id: agentId,
        curriculum_id: curriculum.id,
        enrollment_id: enrollment.id,
        examiner_votes: councilDecision.votes,
        required_votes: 3,
        outcome: councilDecision.outcome === 'approved' ? 'passed' :
                 councilDecision.outcome === 'denied' ? 'failed' : 'deferred',
        final_reasoning: councilDecision.finalReasoning,
        certification_awarded: councilDecision.outcome === 'approved' ? curriculum.certification_points : 0,
        trust_points_awarded: councilDecision.outcome === 'approved' ? curriculum.trust_points : 0,
        examined_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (examError) {
      console.error('Error storing examination:', examError)
      return NextResponse.json({ error: 'Failed to store examination' }, { status: 500 })
    }

    // If passed, update enrollment and prepare for graduation
    if (councilDecision.outcome === 'approved') {
      await supabase
        .from('academy_enrollments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', enrollment.id)
    }

    return NextResponse.json({
      examination: {
        id: examination.id,
        outcome: examination.outcome,
        reasoning: examination.final_reasoning,
        votes: councilDecision.votes.map(v => ({
          validator: v.validatorId,
          decision: v.decision,
          reasoning: v.reasoning,
          confidence: v.confidence,
        })),
        certification_awarded: examination.certification_awarded,
        trust_points_awarded: examination.trust_points_awarded,
      },
      next_steps: councilDecision.outcome === 'approved'
        ? 'Agent passed examination! Proceed to graduation.'
        : 'Agent did not pass. Review the feedback and retry after 24 hours.',
      ready_for_graduation: councilDecision.outcome === 'approved',
    })
  } catch (error) {
    console.error('Examination error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/agents/[id]/examine - Get examination history
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
      .select('id, name, user_id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Get all examinations
    const { data: examinations, error } = await supabase
      .from('council_examinations')
      .select(`
        *,
        curriculum:academy_curriculum (
          id,
          name,
          specialization
        )
      `)
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching examinations:', error)
      return NextResponse.json({ error: 'Failed to fetch examinations' }, { status: 500 })
    }

    return NextResponse.json({
      agent: { id: agent.id, name: agent.name },
      examinations: examinations || [],
      total: examinations?.length || 0,
    })
  } catch (error) {
    console.error('Get examinations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
