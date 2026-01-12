import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface TimelineEvent {
  id: string
  type: 'creation' | 'enrollment' | 'module_complete' | 'examination' | 'graduation' | 'trust_change' | 'status_change'
  title: string
  description: string
  timestamp: string
  metadata?: Record<string, any>
}

// GET /api/agents/[id]/history - Get agent timeline history
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

    // Get agent and verify ownership
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, name, status, trust_score, trust_tier, created_at, user_id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const timeline: TimelineEvent[] = []

    // 1. Agent creation
    timeline.push({
      id: `creation-${agent.id}`,
      type: 'creation',
      title: 'Agent Created',
      description: `${agent.name} was created`,
      timestamp: agent.created_at,
    })

    // 2. Academy enrollments
    const { data: enrollments } = await supabase
      .from('academy_enrollments')
      .select(`
        id,
        enrolled_at,
        started_at,
        completed_at,
        status,
        progress,
        curriculum:academy_curriculum (name)
      `)
      .eq('agent_id', agentId)
      .order('enrolled_at', { ascending: true })

    if (enrollments) {
      for (const enrollment of enrollments) {
        const curriculum = enrollment.curriculum as any

        // Enrollment event
        timeline.push({
          id: `enrollment-${enrollment.id}`,
          type: 'enrollment',
          title: 'Enrolled in Academy',
          description: `Enrolled in ${curriculum?.name || 'curriculum'}`,
          timestamp: enrollment.enrolled_at,
          metadata: { curriculum_name: curriculum?.name },
        })

        // Module completions from progress
        const progress = enrollment.progress as any
        if (progress?.modules_completed && progress.modules_completed.length > 0) {
          // Note: We don't have exact timestamps for modules, so we'll skip individual module events
          // or estimate them. For now, just note the count.
        }

        // Completion event
        if (enrollment.completed_at) {
          timeline.push({
            id: `completion-${enrollment.id}`,
            type: 'module_complete',
            title: 'Curriculum Complete',
            description: `Completed all modules in ${curriculum?.name || 'curriculum'}`,
            timestamp: enrollment.completed_at,
          })
        }
      }
    }

    // 3. Council examinations
    const { data: examinations } = await supabase
      .from('council_examinations')
      .select(`
        id,
        outcome,
        examined_at,
        created_at,
        final_reasoning,
        curriculum:academy_curriculum (name)
      `)
      .eq('agent_id', agentId)
      .order('created_at', { ascending: true })

    if (examinations) {
      for (const exam of examinations) {
        const curriculum = exam.curriculum as any
        timeline.push({
          id: `exam-${exam.id}`,
          type: 'examination',
          title: `Council Examination: ${exam.outcome === 'passed' ? 'Passed' : exam.outcome === 'failed' ? 'Failed' : 'Pending'}`,
          description: exam.final_reasoning || `Examined for ${curriculum?.name || 'curriculum'}`,
          timestamp: exam.examined_at || exam.created_at,
          metadata: { outcome: exam.outcome },
        })
      }
    }

    // 4. Trust history
    const { data: trustHistory } = await supabase
      .from('trust_history')
      .select('*')
      .eq('agent_id', agentId)
      .order('recorded_at', { ascending: true })

    if (trustHistory) {
      for (const record of trustHistory) {
        // Skip initial/creation records if already covered
        if (record.source === 'graduation') {
          timeline.push({
            id: `graduation-${record.id}`,
            type: 'graduation',
            title: 'Agent Graduated',
            description: `${record.reason} - Initial Trust Score: ${record.score} (${record.tier})`,
            timestamp: record.recorded_at,
            metadata: {
              trust_score: record.score,
              trust_tier: record.tier,
            },
          })
        } else if (record.source !== 'initial') {
          timeline.push({
            id: `trust-${record.id}`,
            type: 'trust_change',
            title: record.change_amount >= 0 ? 'Trust Increased' : 'Trust Decreased',
            description: `${record.reason} (${record.change_amount >= 0 ? '+' : ''}${record.change_amount})`,
            timestamp: record.recorded_at,
            metadata: {
              previous_score: record.previous_score,
              new_score: record.score,
              change: record.change_amount,
              source: record.source,
            },
          })
        }
      }
    }

    // Sort timeline by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        trust_score: agent.trust_score,
        trust_tier: agent.trust_tier,
      },
      timeline,
      total_events: timeline.length,
    })
  } catch (error) {
    console.error('History error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
